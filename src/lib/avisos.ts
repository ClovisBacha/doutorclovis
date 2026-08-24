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
import { pushSupport, subscribeToPush, vapidPublicKey, type PushSupport } from "@/lib/push";

export type ResultadoAvisos = PushSupport;

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
  if (ehNativo()) {
    const { inscreverPushNativo } = await import("@/lib/push-nativo");
    return await inscreverPushNativo();
  }
  return await subscribeToPush();
}

/**
 * Já autorizado antes? Então garante que o registro existe no banco.
 *
 * Permissão concedida e banco vazio não entrega nada — e é um estado comum:
 * trocar de aparelho, limpar dados, ou reinstalar o app mantém a permissão do
 * sistema e perde a linha. Chamado na abertura, sem pedir nada a ninguém.
 */
export async function renovarAvisosSeJaAutorizado(): Promise<void> {
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
