import { AppState } from "react-native";
import { useSyncExternalStore } from "react";
import { gravarJson, lerJson } from "~/lib/armazem";
import {
  chaveDoDia,
  fecharDiasCompletos,
  marcarMomento,
  type Blob,
  type Momento,
} from "~/lib/jornada/momentos";
import {
  fecharDiasDoPosCompletos,
  marcarTarefaDoPos,
  type MarcaDoPos,
  type TarefaDoPos,
} from "~/lib/jornada/pos-parto";
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
 * ⚠️ POR ISSO TODO PUSH VEM DEPOIS DE UM PULL QUE DEU CERTO — e não só o
 * primeiro. Empurrar antes sobrescreveria a jornada real na nuvem por um blob
 * vazio (aparelho novo), incompleto, ou VELHO: o iOS deixa o app suspenso por
 * dias, e um pull só na abertura do processo fazia o iPhone devolver à nuvem
 * a cópia da semana passada, apagando o que ela tinha feito no site ou noutro
 * aparelho nesse meio-tempo (out/2026). O site libera o push mesmo depois de
 * um pull que falhou; aqui não: sem pull bem-sucedido, não empurra — o
 * progresso fica no aparelho até a próxima vez. E ao voltar para o primeiro
 * plano o app puxa de novo, para a tela mostrar o que mudou lá fora.
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

const VAZIO: EstadoDaLoja = {
  uid: null,
  blob: {},
  pronto: false,
  nuvem: "esperando",
  bancada: false,
};

let estado: EstadoDaLoja = VAZIO;
let marca: string | null = null;
let sujo = false;
/**
 * Cresce a cada mudança que precisa subir. O push compara antes e depois do
 * envio: o que mudou DURANTE ele não subiu, e não pode ser dado como enviado
 * (o humor marcado enquanto a meditação ainda subia se perdia assim).
 */
let versao = 0;
let ultimoPull = 0;
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

function sujar() {
  sujo = true;
  versao++;
}

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
  if (Object.keys(jaMarcado).length) sujar();
  definir({ blob, pronto: true });
  await puxar();
}

/**
 * O pull, com duas novas tentativas. Devolve se deu certo. `agendar` = empurrar
 * depois o que sobrou aqui (o push chama sem, porque ele mesmo empurra).
 */
function puxar(agendar = true): Promise<boolean> {
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
            /* A aula feita lá e as quatro atividades aqui: o dia completou na
               mescla, e só agora entra nos feitos (e pede o bônus na aba). */
            const f = fecharDiasCompletos(r.blob);
            /* O mesmo no pós-parto: o check-in feito lá e a leitura aqui. */
            const fp = fecharDiasDoPosCompletos(f.blob);
            marca = linha.updated_at;
            if (r.localTinhaExtra || f.fechados.length || fp.fechados.length) sujar();
            definir({ blob: fp.blob });
          }
        } else if (Object.keys(estado.blob).length) {
          /* Sem jornada na nuvem e com progresso aqui: sobe. */
          sujar();
        }
        ultimoPull = Date.now();
        definir({ nuvem: "ok" });
        await salvarLocal();
        if (sujo && agendar) agendarPush();
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
  /* ⚠️ A barreira: só empurra depois de um pull que deu certo — e RECENTE, não
     só o primeiro do processo. Se a nuvem mudou desde a marca, o pull mescla
     e o que sobe é a jornada inteira, a de lá com a daqui. Um pull de menos
     de 30 s dispensa outro: o push que sai quando ela tranca o celular tem
     poucos segundos antes de o iOS suspender o app. */
  if (estado.nuvem !== "ok" || Date.now() - ultimoPull > 30_000) {
    const ok = await puxar(false);
    if (!ok) return;
  }
  if (estado.uid !== uid || !sujo) return;
  const enviada = versao;
  try {
    const { data, error } = await supabase
      .from("journey_state")
      .upsert({ user_id: uid, data: estado.blob })
      .select("updated_at")
      .maybeSingle();
    if (error || estado.uid !== uid) return;
    const quando = (data as { updated_at?: string } | null)?.updated_at;
    if (quando) marca = quando;
    /* O que mudou enquanto subia continua pendente, e sobe no próximo envio. */
    if (versao === enviada) sujo = false;
    else agendarPush();
    await salvarLocal();
  } catch {
    /* sem rede: `sujo` continua, e a próxima escrita ou abertura tenta de novo */
  }
}

/* O iOS congela timers em segundo plano: o push pendente sai antes de ir. E
   na volta o app puxa — a nuvem pode ter mudado enquanto ele dormia. O
   intervalo mínimo poupa a rede de quem só abriu a Central de Controle. */
AppState.addEventListener("change", (s) => {
  if (s !== "active") {
    if (relogio) {
      clearTimeout(relogio);
      relogio = null;
      void empurrar();
    }
    return;
  }
  if (estado.uid && estado.pronto && !estado.bancada && Date.now() - ultimoPull > 15_000) {
    void puxar();
  }
});

/**
 * Sair da conta: a jornada sai da memória ANTES de o aparelho ser limpo, para
 * nenhum pull ou push em voo gravá-la de volta depois da limpeza (LGPD) — e
 * para a próxima conta não desenhar, nem por um instante, a trilha da anterior.
 */
export function fecharLoja() {
  if (relogio) clearTimeout(relogio);
  relogio = null;
  marca = null;
  sujo = false;
  pullEmVoo = null;
  ultimoPull = 0;
  estado = VAZIO;
  ouvintes.forEach((f) => f());
}

/** Grava uma chave `dc-path-*` qualquer (notas do exercício, cartas lidas…). */
export function gravarChave(chave: string, valor: unknown) {
  if (!estado.uid || !chave.startsWith("dc-path-")) return;
  definir({ blob: { ...estado.blob, [chave]: valor } });
  if (estado.bancada) return;
  sujar();
  void salvarLocal();
  agendarPush();
}

/**
 * Marca um momento do dia. Devolve se fechou os cinco AGORA — o chamador é
 * quem celebra e chama o bônus do servidor.
 */
export function marcar(
  D: number,
  m: Momento,
  pos = false,
): { fechouAgora: boolean; jaEstava: boolean } {
  if (!estado.uid) return { fechouAgora: false, jaEstava: false };
  const r = marcarMomento(estado.blob, D, m, { pos });
  if (r.jaEstava) return { fechouAgora: false, jaEstava: true };
  definir({ blob: r.blob });
  if (!estado.bancada) {
    sujar();
    void salvarLocal();
    agendarPush();
  }
  return { fechouAgora: r.fechouAgora, jaEstava: false };
}

/**
 * Marca uma das três tarefas do dia no pós-parto (humor, desafio, leitura).
 * Devolve se o dia fechou AGORA e qual semana ganhou a figurinha — quem
 * celebra é a tela.
 */
export function marcarNoPos(D: number, tarefa: TarefaDoPos): Omit<MarcaDoPos, "blob"> {
  const nada = { jaEstava: false, fechouAgora: false, figurinhaNova: null };
  if (!estado.uid) return nada;
  const r = marcarTarefaDoPos(estado.blob, D, tarefa);
  if (r.jaEstava) return { ...nada, jaEstava: true };
  definir({ blob: r.blob });
  if (!estado.bancada) {
    sujar();
    void salvarLocal();
    agendarPush();
  }
  return { jaEstava: false, fechouAgora: r.fechouAgora, figurinhaNova: r.figurinhaNova };
}

/**
 * Acende uma flag a mais no dia que NÃO é um dos cinco momentos — o `humor` do
 * check-in "Como você está hoje?". Ela acende a chama (qualquer flag do dia
 * conta) mas não é estrela, não paga e não fecha o dia, como no site.
 */
export function marcarFlagDoDia(D: number, flag: string, pos = false) {
  const chave = chaveDoDia(D, pos);
  const atual = estado.blob[chave];
  const dia =
    typeof atual === "object" && atual !== null && !Array.isArray(atual)
      ? (atual as Record<string, unknown>)
      : {};
  if (dia[flag] === true) return;
  gravarChave(chave, { ...dia, [flag]: true });
}
