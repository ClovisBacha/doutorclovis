import { AppState } from "react-native";
import { useSyncExternalStore } from "react";
import { gravarJson, lerJson } from "~/lib/armazem";
import { marcarMomento, type Blob, type Momento } from "~/lib/jornada/momentos";
import { mesclarBlob } from "~/lib/jornada/sincronia";
import { supabase } from "~/servidor/supabase";

/**
 * A LOJA DA JORNADA — o blob `dc-path-*` da paciente, no aparelho e na nuvem.
 *
 * ── O contrato com o site ──
 * A jornada mora em `journey_state(user_id, data jsonb, updated_at)`: `data` é
 * um objeto com TODAS as chaves `dc-path-*` (o site as guarda no localStorage;
 * o app, num registro só do AsyncStorage, `dc-jornada:<uid>`). O app empurra o
 * blob INTEIRO — inclusive as chaves que ele não usa (decoração, skins, notas
 * das lições), que só chegam aqui pelo pull.
 *
 * ⚠️ POR ISSO NENHUM PUSH ACONTECE ANTES DE UM PULL QUE DEU CERTO. Empurrar
 * antes sobrescreveria a jornada real na nuvem por um blob vazio (aparelho
 * novo) ou incompleto. O site libera o push mesmo depois de um pull que
 * falhou; aqui não: sem pull bem-sucedido, o push tenta o pull de novo e, se
 * ainda falhar, não empurra — o progresso fica no aparelho até a próxima vez.
 *
 * ── A marca ──
 * `marca` é o `updated_at` da nuvem que este aparelho já conhece (do último
 * pull ou push). Se a nuvem não é mais nova que a marca, não há o que mesclar
 * — e mesclar mesmo assim faria "a nuvem vence" desfazer uma mudança local
 * de estado mutável que ainda não subiu. Mesma régua do SYNC_MARKER do site.
 *
 * Um único estado por processo, lido com useSyncExternalStore: a aba e as
 * telas empilhadas enxergam o mesmo blob, e marcar um momento dentro de uma
 * atividade já aparece na aba quando ela volta.
 */

type Registro = { blob: Blob; marca: string | null; sujo: boolean };

export type EstadoDaLoja = {
  uid: string | null;
  blob: Blob;
  /** O blob local já foi lido do aparelho. */
  pronto: boolean;
  /** O pull da nuvem: ainda não, deu certo, ou falhou (o aparelho segue valendo). */
  nuvem: "esperando" | "ok" | "falhou";
  bancada: boolean;
};

const VAZIO: EstadoDaLoja = { uid: null, blob: {}, pronto: false, nuvem: "esperando", bancada: false };

let estado: EstadoDaLoja = VAZIO;
let marca: string | null = null;
let sujo = false;
let pullEmVoo: Promise<boolean> | null = null;
let relogio: ReturnType<typeof setTimeout> | null = null;
const ouvintes = new Set<() => void>();

function definir(parcial: Partial<EstadoDaLoja>) {
  estado = { ...estado, ...parcial };
  ouvintes.forEach((f) => f());
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

const lerEstado = () => estado;

export function useLoja(): EstadoDaLoja {
  return useSyncExternalStore(assinar, lerEstado, lerEstado);
}

export function estadoAtual(): EstadoDaLoja {
  return estado;
}

const chaveLocal = (uid: string) => `dc-jornada:${uid}`;

async function salvarLocal() {
  if (!estado.uid || estado.bancada) return;
  await gravarJson(chaveLocal(estado.uid), { blob: estado.blob, marca, sujo } satisfies Registro);
}

/**
 * Abre a jornada da paciente: lê o aparelho e dispara o pull (uma vez por
 * sessão). Na bancada, o blob de exemplo entra no MESMO estado e nada é lido
 * nem gravado.
 */
export async function abrirLoja(uid: string, bancada?: Blob): Promise<void> {
  if (bancada) {
    if (estado.bancada && estado.uid === uid) return;
    estado = { uid, blob: bancada, pronto: true, nuvem: "ok", bancada: true };
    ouvintes.forEach((f) => f());
    return;
  }
  if (estado.uid === uid && estado.pronto) {
    if (estado.nuvem === "falhou") void puxar();
    return;
  }
  /* Troca de conta no mesmo aparelho: nada da anterior pode vazar. */
  if (relogio) clearTimeout(relogio);
  relogio = null;
  marca = null;
  sujo = false;
  pullEmVoo = null;
  estado = { ...VAZIO, uid };
  ouvintes.forEach((f) => f());
  const reg = await lerJson<Registro | null>(chaveLocal(uid), null);
  if (estado.uid !== uid) return;
  marca = reg?.marca ?? null;
  sujo = reg?.sujo ?? false;
  const doAparelho: Blob = reg?.blob && typeof reg.blob === "object" ? reg.blob : {};
  /* Uma marca feita enquanto o aparelho era lido não pode ser apagada por ele. */
  const jaMarcado = estado.blob;
  const blob = Object.keys(jaMarcado).length ? mesclarBlob(jaMarcado, doAparelho).blob : doAparelho;
  if (Object.keys(jaMarcado).length) sujo = true;
  definir({ blob, pronto: true });
  await puxar();
}

/** O pull, com duas novas tentativas. Devolve se deu certo. */
function puxar(): Promise<boolean> {
  if (pullEmVoo) return pullEmVoo;
  const uid = estado.uid;
  if (!uid || estado.bancada) return Promise.resolve(false);
  pullEmVoo = (async () => {
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      try {
        const { data, error } = await supabase
          .from("journey_state")
          .select("data,updated_at")
          .eq("user_id", uid)
          .maybeSingle();
        if (error) throw error;
        if (estado.uid !== uid) return false;
        const linha = data as { data: Blob | null; updated_at: string } | null;
        if (linha?.data && typeof linha.data === "object") {
          const naoMudou = marca != null && marca >= linha.updated_at;
          if (!naoMudou) {
            const r = mesclarBlob(estado.blob, linha.data);
            marca = linha.updated_at;
            if (r.localTinhaExtra) sujo = true;
            definir({ blob: r.blob });
          }
        } else if (Object.keys(estado.blob).length) {
          /* Sem jornada na nuvem e com progresso aqui: sobe. */
          sujo = true;
        }
        definir({ nuvem: "ok" });
        await salvarLocal();
        if (sujo) agendarPush();
        return true;
      } catch {
        if (tentativa < 2) await new Promise((r) => setTimeout(r, 600 * (tentativa + 1)));
      }
    }
    if (estado.uid === uid) definir({ nuvem: "falhou" });
    return false;
  })().finally(() => {
    pullEmVoo = null;
  });
  return pullEmVoo;
}

function agendarPush() {
  if (estado.bancada) return;
  if (relogio) clearTimeout(relogio);
  relogio = setTimeout(() => {
    relogio = null;
    void empurrar();
  }, 1500);
}

async function empurrar(): Promise<void> {
  const uid = estado.uid;
  if (!uid || estado.bancada || !sujo) return;
  /* ⚠️ A barreira: só empurra depois de um pull que deu certo. */
  if (estado.nuvem !== "ok") {
    const ok = await puxar();
    if (!ok) return;
  }
  try {
    const { data, error } = await supabase
      .from("journey_state")
      .upsert({ user_id: uid, data: estado.blob })
      .select("updated_at")
      .maybeSingle();
    if (error || estado.uid !== uid) return;
    sujo = false;
    const quando = (data as { updated_at?: string } | null)?.updated_at;
    if (quando) marca = quando;
    await salvarLocal();
  } catch {
    /* sem rede: `sujo` continua, e a próxima escrita ou abertura tenta de novo */
  }
}

/* O iOS congela timers em segundo plano: o push pendente sai antes de ir. */
AppState.addEventListener("change", (s) => {
  if (s !== "active" && relogio) {
    clearTimeout(relogio);
    relogio = null;
    void empurrar();
  }
});

/** Grava uma chave `dc-path-*` qualquer (notas do exercício, cartas lidas…). */
export function gravarChave(chave: string, valor: unknown) {
  if (!estado.uid || !chave.startsWith("dc-path-")) return;
  definir({ blob: { ...estado.blob, [chave]: valor } });
  if (estado.bancada) return;
  sujo = true;
  void salvarLocal();
  agendarPush();
}

/**
 * Marca um momento do dia. Devolve se fechou os cinco AGORA — o chamador é
 * quem celebra e chama o bônus do servidor.
 */
export function marcar(D: number, m: Momento, pos = false): { fechouAgora: boolean; jaEstava: boolean } {
  if (!estado.uid) return { fechouAgora: false, jaEstava: false };
  const r = marcarMomento(estado.blob, D, m, { pos });
  if (r.jaEstava) return { fechouAgora: false, jaEstava: true };
  definir({ blob: r.blob });
  if (!estado.bancada) {
    sujo = true;
    void salvarLocal();
    agendarPush();
  }
  return { fechouAgora: r.fechouAgora, jaEstava: false };
}
