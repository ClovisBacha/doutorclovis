/**
 * OS ERROS DA APPLE EM FRASE CALMA. Nenhum código na tela ("E_USER_ERROR",
 * "sku-not-found"): uma frase em português que diz o que aconteceu e o que dá
 * para fazer. Cancelar a compra NÃO é erro — ela só mudou de ideia
 * (`fraseDoErro` devolve nulo, e a tela fica como estava).
 *
 * Os códigos são os do OpenIAP (`ErrorCode` do expo-iap), escritos aqui como
 * texto para o teste não carregar o StoreKit.
 */

const CONEXAO = "A conexão com a App Store falhou. Confira a internet e tente de novo.";
const INDISPONIVEL = "Este plano não está disponível agora. Tente de novo mais tarde.";
const SEM_COMPRAS =
  "Este iPhone não está permitindo compras agora. Se houver uma restrição em Tempo de Uso, dá para liberar nos Ajustes.";
const NAO_CONFIRMOU =
  "A App Store não conseguiu confirmar a compra. Tente de novo em instantes ou toque em Restaurar compras.";
const JA_TEM = "Este plano já é seu. Toque em Restaurar compras para liberá-lo neste iPhone.";
const PADRAO = "Não deu para concluir agora. Tente de novo em instantes.";

const FRASES: Record<string, string> = {
  "network-error": CONEXAO,
  "service-timeout": CONEXAO,
  "remote-error": CONEXAO,
  "service-disconnected": CONEXAO,
  "connection-closed": CONEXAO,
  "init-connection": CONEXAO,
  "not-prepared": CONEXAO,
  "service-error": CONEXAO,
  "sync-error": CONEXAO,
  "iap-not-available": SEM_COMPRAS,
  "billing-unavailable": SEM_COMPRAS,
  "feature-not-supported": SEM_COMPRAS,
  "user-error": SEM_COMPRAS,
  "item-unavailable": INDISPONIVEL,
  "sku-not-found": INDISPONIVEL,
  "query-product": INDISPONIVEL,
  "empty-sku-list": INDISPONIVEL,
  "sku-offer-mismatch": INDISPONIVEL,
  "developer-error": INDISPONIVEL,
  "already-owned": JA_TEM,
  "duplicate-purchase": JA_TEM,
  "purchase-verification-failed": NAO_CONFIRMOU,
  "purchase-verification-finish-failed": NAO_CONFIRMOU,
  "transaction-validation-failed": NAO_CONFIRMOU,
};

/** Os códigos que querem dizer "está esperando aprovação" (Pedir para Comprar). */
const ESPERANDO = new Set(["deferred-payment", "pending"]);

/** O código de um erro do expo-iap (ou de qualquer coisa que tenha `code`). */
export function codigoDoErro(e: unknown): string | null {
  if (e && typeof e === "object" && "code" in e) {
    const c = (e as { code?: unknown }).code;
    if (typeof c === "string" && c) return c.toLowerCase().replace(/^e_/, "").replace(/_/g, "-");
  }
  return null;
}

/** Ela fechou a folha da Apple: não é erro, a tela não diz nada. */
export function foiCancelado(codigo: string | null): boolean {
  return codigo === "user-cancelled";
}

/** A compra ficou esperando alguém aprovar (Pedir para Comprar, da Família). */
export function estaEsperandoAprovacao(codigo: string | null): boolean {
  return codigo != null && ESPERANDO.has(codigo);
}

/** A frase calma de um erro (nula quando ela só cancelou). */
export function fraseDoErro(codigo: string | null): string | null {
  if (foiCancelado(codigo)) return null;
  return (codigo && FRASES[codigo]) || PADRAO;
}

/** O que a tela diz quando a compra espera aprovação. */
export const FRASE_ESPERANDO_APROVACAO =
  "A compra está esperando a aprovação de quem organiza a Família no iPhone. Quando for aprovada, o plano completo libera sozinho.";

/** O que a tela diz quando restaurar não encontra nada. */
export const FRASE_NADA_A_RESTAURAR =
  "Não encontramos o plano completo nesta conta da Apple. Se você comprou com outra conta, entre com ela nos Ajustes do iPhone e tente de novo.";
