/**
 * "Ativar avisos" — uma pergunta só, duas entregas.
 *
 * Existem dois caminhos de push e eles não se substituem:
 *
 * · **Web Push** (`push.ts`) — navegador. No iPhone, só com o site instalado na
 *   Tela de Início; fora disso não existe.
 * · **Push nativo** (`push-nativo.ts`) — APNs e FCM, dentro da casca. É o único
 *   que funciona no `WKWebView` do app, onde Web Push simplesmente não há.
 *
 * As telas não deveriam precisar saber disso. Antes desta camada, cada botão de
 * "ativar avisos" chamava `subscribeToPush` direto — o que, dentro do app,
 * devolvia `ios-not-installed` e mandava a paciente "adicionar à Tela de
 * Início"… estando dentro do aplicativo instalado. Instrução impossível de
 * seguir, num lugar onde o push de fato funcionaria.
 *
 * Aqui a escolha mora num lugar só, igual ao que `canal-de-venda.ts` faz para
 * "onde se compra".
 */

import { ehNativo } from "@/lib/nativo";
import {
  pushSupport,
  subscribeToPush,
  unsubscribeFromPush,
  vapidPublicKey,
  type PushSupport,
} from "@/lib/push";

export type ResultadoAvisos = PushSupport;

/**
 * ⚠️ **A ESCOLHA DE DESLIGAR MORA NO APARELHO, e isso não é economia.**
 *
 * A inscrição É por aparelho: cada navegador e cada celular tem a sua linha
 * (`push_subscriptions.endpoint`, `native_push_tokens.token`). Desligar no
 * celular não pode calar o tablet — quem decidiu foi a pessoa que estava com
 * AQUELE aparelho na mão, e é nele que o aviso incomodava.
 *
 * ⚠️ **A chave NÃO leva o prefixo `dc-path-`**: aquele viaja no blob do
 * `journey_state` e agenda um PUSH a cada gravação. Uma preferência sobre push
 * disparando push seria a piada mais cara deste arquivo.
 */
const CHAVE_DESLIGADOS = "dc-avisos-desligados";

/**
 * Ela desligou os avisos NESTE aparelho?
 *
 * ⚠️ **Não conseguir ler vale LIGADO — nunca o contrário.** Este é o mesmo
 * canal do aviso de consulta e do retorno do SOS: o pior caso de um `false`
 * errado é um push que ela não queria; o de um `true` errado é o silêncio de
 * um canal de emergência, que não deixa rastro nenhum. Modo privado, cota
 * estourada e SSR caem todos aqui.
 */
export function avisosDesligadosNesteAparelho(): boolean {
  try {
    return localStorage.getItem(CHAVE_DESLIGADOS) === "1";
  } catch {
    return false;
  }
}

/**
 * Este aparelho consegue receber avisos? E, se não, por quê?
 *
 * Dentro da casca a resposta é sempre sim: quem entrega é o sistema, não o
 * navegador, e não há chave `VITE_` para conferir — a credencial (APNs/FCM)
 * vive só no servidor. Se ela faltar lá, o envio vira no-op silencioso, e é o
 * comportamento certo: melhor um aviso que não sai do que uma tela dizendo à
 * paciente que o aparelho dela não serve.
 */
export function suporteAAvisos(): ResultadoAvisos {
  if (ehNativo()) return { ok: true };
  if (!vapidPublicKey()) return { ok: false, reason: "no-key" };
  return pushSupport();
}

/** Pede a permissão e registra este aparelho pelo caminho que ele tem. */
export async function ativarAvisos(): Promise<ResultadoAvisos> {
  const r = ehNativo()
    ? await (await import("@/lib/push-nativo")).inscreverPushNativo()
    : await subscribeToPush();
  /* ⚠️ A marca sai só quando a inscrição DEU CERTO. Limpá-la antes deixaria um
     aparelho sem inscrição e sem a marca — ou seja, `renovar` voltaria a
     inscrever sozinho na próxima abertura, desfazendo uma escolha que ela
     tinha tomado e refazendo uma que ela não tomou. */
  if (r.ok) {
    try {
      localStorage.removeItem(CHAVE_DESLIGADOS);
    } catch {
      /* ligar sem conseguir limpar a marca ainda entrega avisos agora; o pior
         caso é `renovar` não renovar depois, e aí ela toca em ativar de novo */
    }
  }
  return r;
}

/**
 * DESLIGAR os avisos neste aparelho — o outro lado de `ativarAvisos`.
 *
 * ⚠️ **Ele existia inteiro e sem porta.** `unsubscribeFromPush` estava escrita
 * desde que o push nasceu e nenhuma tela a chamava: parar de receber só era
 * possível pelas Configurações do sistema, que silenciam o app INTEIRO — o
 * mesmo canal por onde chegam a confirmação da consulta, o lembrete de 24h e o
 * retorno do SOS. "Ou tudo, ou nada" é a escolha que este produto decidiu não
 * cobrar de ninguém, e a leva das preferências da Comunidade já tinha
 * consertado o grão FINO (por espécie de aviso da rede) deixando o grosso de
 * pé.
 *
 * ⚠️ **A ORDEM É CANCELAR E DEPOIS MARCAR.** Marcando antes, um cancelamento
 * que falhasse deixaria o pior estado possível: a linha viva no banco (o push
 * continua saindo) e a marca impedindo a renovação — com a tela afirmando que
 * está desligado.
 *
 * ⚠️ **E falhar ao MARCAR é falhar ao desligar.** Sem a marca, `renovar`
 * re-inscreve na abertura seguinte: a escolha dela duraria até ela fechar o
 * app. Dizer "pronto" sobre isso é a mentira que esta leva inteira veio tirar
 * do produto.
 */
export async function desligarAvisos(): Promise<ResultadoAvisos> {
  const r = ehNativo()
    ? await (await import("@/lib/push-nativo")).cancelarPushNativo()
    : await unsubscribeFromPush();
  if (!r.ok) return r;
  try {
    localStorage.setItem(CHAVE_DESLIGADOS, "1");
  } catch {
    return { ok: false, reason: "sem-memoria" };
  }
  return { ok: true };
}

/**
 * Já autorizado antes? Então garante que o registro existe no banco.
 *
 * Permissão concedida e banco vazio não entrega nada — e é um estado comum:
 * trocar de aparelho, limpar dados, ou reinstalar o app mantém a permissão do
 * sistema e perde a linha. Chamado na abertura, sem pedir nada a ninguém.
 */
export async function renovarAvisosSeJaAutorizado(): Promise<void> {
  /* ⚠️ **O PORTÃO DA ESCOLHA DELA, e ele vem antes de tudo.** Esta função roda
     na abertura e re-inscreve sempre que o sistema diz "permitido" — então,
     sem esta linha, o botão de desligar seria decorativo: ela desligaria, e o
     app a re-inscreveria na próxima vez que abrisse. */
  if (avisosDesligadosNesteAparelho()) return;
  try {
    if (ehNativo()) {
      const { pushNativoJaAutorizado, inscreverPushNativo } = await import("@/lib/push-nativo");
      if (await pushNativoJaAutorizado()) await inscreverPushNativo();
      return;
    }
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    await subscribeToPush();
  } catch {
    /* renovar é oportunista — nunca atrapalha a abertura */
  }
}
