import { useEffect, useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";
import { gravarJson, lerJson } from "~/lib/armazem";
import { ehBancada } from "~/lib/bancada";
import { portaoLigado, temPlanoNaBancada, vendaLigada } from "~/lib/assinatura/bancada";

/**
 * ELA TEM O PLANO COMPLETO? — um estado só para o app inteiro.
 *
 * - Ao abrir: primeiro o que ficou guardado no aparelho (`dc-plano`), para o
 *   portão não piscar o convite para quem assina; logo depois o StoreKit, que
 *   VENCE. Ao voltar ao app (o iPhone a deixa dias em segundo plano; a
 *   assinatura pode ter vencido ou renovado), o StoreKit de novo.
 * - O guardado tem o prefixo `dc-`: sair da conta o apaga (`limparRastrosLocais`),
 *   e o StoreKit responde de novo na próxima abertura.
 * - Com a chave desligada nada daqui roda: ninguém monta o vigia nem um portão.
 *
 * ⚠️ O estado devolvido é o MESMO objeto até mudar (`useSyncExternalStore`
 * com um objeto novo a cada leitura já deixou este app sem abrir).
 */

export type EstadoDoPlano = { readonly conhecido: boolean; readonly temPlano: boolean };

const DESCONHECIDO: EstadoDoPlano = Object.freeze({ conhecido: false, temPlano: false });
/** Fora da venda (a chave desligada): tudo liberado, e já se sabe. */
const FORA: EstadoDoPlano = Object.freeze({ conhecido: true, temPlano: false });

let atual: EstadoDoPlano = DESCONHECIDO;
const ouvintes = new Set<() => void>();

function definir(temPlano: boolean) {
  if (atual.conhecido && atual.temPlano === temPlano) return;
  atual = Object.freeze({ conhecido: true, temPlano });
  for (const f of ouvintes) f();
}

const CHAVE = "dc-plano";

/** O direito que chegou da Apple: vale na tela e fica guardado no aparelho. */
export function guardarDireito(temPlano: boolean) {
  definir(temPlano);
  if (!ehBancada()) void gravarJson(CHAVE, { temPlano });
}

/** O teto para "ainda não sei": o portão não fica esperando para sempre. */
const TETO_DA_PRIMEIRA_LEITURA_MS = 4000;
/** Ao voltar ao app, relê no máximo a cada 15 s. */
const INTERVALO_DA_RELEITURA_MS = 15_000;

let iniciado = false;

async function comecar() {
  const guardado = await lerJson<{ temPlano?: unknown } | null>(CHAVE, null);
  if (!atual.conhecido && guardado && typeof guardado.temPlano === "boolean") {
    definir(guardado.temPlano);
  }
  const loja = await import("~/lib/assinatura/loja");
  loja.ouvirDireito(guardarDireito);
  const reler = async () => {
    const tem = await loja.lerDireito();
    if (tem != null) guardarDireito(tem);
    else if (!atual.conhecido) definir(false);
  };
  await reler();
  let ultima = Date.now();
  AppState.addEventListener("change", (s) => {
    if (s !== "active" || Date.now() - ultima < INTERVALO_DA_RELEITURA_MS) return;
    ultima = Date.now();
    void reler();
  });
}

/** Liga o estado (uma vez por abertura). Na bancada, o `&plano=1` decide. */
export function iniciarPlano() {
  if (iniciado) return;
  iniciado = true;
  if (ehBancada()) return definir(temPlanoNaBancada());
  if (Platform.OS !== "ios") return definir(false);
  setTimeout(() => {
    if (!atual.conhecido) definir(false);
  }, TETO_DA_PRIMEIRA_LEITURA_MS);
  void comecar().catch(() => {
    if (!atual.conhecido) definir(false);
  });
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

const ler = () => atual;

/**
 * O estado do plano. Fora da venda (a chave desligada e sem bancada), sempre
 * "conhecido, sem plano" — e nada é ligado.
 */
export function usePlano(): EstadoDoPlano {
  const ligado = vendaLigada() || portaoLigado();
  useEffect(() => {
    if (ligado) iniciarPlano();
  }, [ligado]);
  const estado = useSyncExternalStore(assinar, ler, ler);
  return ligado ? estado : FORA;
}

/**
 * O VIGIA, na raiz do app (só com a chave ligada): abre a conexão com a App
 * Store na abertura, para as compras que ficaram por terminar (uma aprovação
 * do "Pedir para Comprar", uma renovação) serem lidas e terminadas logo.
 */
export function VigiaDoPlano() {
  useEffect(() => {
    iniciarPlano();
  }, []);
  return null;
}
