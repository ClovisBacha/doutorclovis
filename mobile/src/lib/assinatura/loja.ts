import { Platform } from "react-native";
import type * as ExpoIap from "expo-iap";
import type { Product, ProductSubscription, Purchase } from "expo-iap";
import {
  codigoDoErro,
  estaEsperandoAprovacao,
  foiCancelado,
  fraseDoErro,
} from "~/lib/assinatura/erros";
import {
  ASSINATURAS,
  PRODUTOS,
  planoDoProduto,
  temPlanoCompleto,
  type Plano,
} from "~/lib/assinatura/plano";
import { ofertaIntrodutoria, type ProdutoDaLoja } from "~/lib/assinatura/precos";

/**
 * A LOJA DA APPLE (StoreKit 2, pelo `expo-iap` 6.4.3) — o único arquivo do app
 * que fala com ela.
 *
 * - o módulo nativo só é carregado aqui, por `import()`, e só no iPhone: com a
 *   chave desligada (`ASSINATURA_NO_APP`) ninguém chama nada daqui, e a web
 *   (a bancada) nunca o carrega;
 * - o DIREITO (ela tem o plano completo?) vem do StoreKit NO APARELHO: uma
 *   assinatura nossa ativa, ou o vitalício. O servidor do app é o do site,
 *   congelado. PRÓXIMO PASSO (quando houver servidor do app): validar a
 *   compra na App Store Server API e ligar a compra à conta com o
 *   `appAccountToken`, para o plano seguir a conta e não só o Apple ID;
 * - toda compra entregue é TERMINADA (`finishTransaction`) depois de lida: sem
 *   isso o iPhone a entrega de novo a cada abertura;
 * - todo erro vira uma frase calma (`erros.ts`); cancelar não é erro.
 */

type Modulo = typeof ExpoIap;

let modulo: Promise<Modulo> | null = null;
function iap(): Promise<Modulo> {
  if (Platform.OS !== "ios") return Promise.reject(new Error("sem StoreKit fora do iPhone"));
  if (!modulo) modulo = import("expo-iap");
  return modulo;
}

export type ResultadoDaCompra =
  | { tipo: "comprou" }
  | { tipo: "cancelou" }
  | { tipo: "esperando" }
  | { tipo: "erro"; frase: string };

export type ResultadoDaRestauracao =
  | { tipo: "restaurou" }
  | { tipo: "nada" }
  | { tipo: "erro"; frase: string };

/* ── O que acontece quando a Apple entrega ou recusa uma compra ───────── */

/** Quem está esperando a compra que está na folha da Apple agora. */
let esperando: { sku: string; responder: (r: ResultadoDaCompra) => void } | null = null;

/** Quem quer saber que o direito mudou (o `usar-plano`). */
const aoMudarDireito = new Set<(temPlano: boolean) => void>();
export function ouvirDireito(f: (temPlano: boolean) => void): () => void {
  aoMudarDireito.add(f);
  return () => aoMudarDireito.delete(f);
}

/** As transações já tratadas nesta abertura (o iOS pode entregar duas vezes). */
const tratadas = new Set<string>();

function responder(r: ResultadoDaCompra, sku?: string) {
  if (!esperando || (sku && esperando.sku !== sku)) return;
  const quem = esperando;
  esperando = null;
  quem.responder(r);
}

async function aoReceberCompra(compra: Purchase) {
  const nossa = planoDoProduto(compra.productId) != null;
  if (!nossa) return;
  if (compra.purchaseState === "pending") {
    responder({ tipo: "esperando" }, compra.productId);
    return;
  }
  const chave = compra.id || ("transactionId" in compra ? compra.transactionId : "");
  if (chave && tratadas.has(chave)) {
    responder({ tipo: "comprou" }, compra.productId);
    return;
  }
  if (chave) tratadas.add(chave);
  try {
    const m = await iap();
    await m.finishTransaction({ purchase: compra, isConsumable: false });
  } catch {
    /* Terminar falhou: o iPhone a entrega de novo na próxima abertura, e ela
       é tratada de novo. O direito vale do mesmo jeito. */
    if (chave) tratadas.delete(chave);
  }
  const revogada = "revocationDateIOS" in compra && (compra.revocationDateIOS ?? 0) > 0;
  const tem = await lerDireito();
  /* A compra que ela ACABOU de fazer vale na hora (mesmo que o StoreKit ainda
     não a liste); uma entregue depois (renovação, aprovação, reembolso) vale
     pelo que o StoreKit diz agora. */
  const acabouDeComprar = esperando?.sku === compra.productId && !revogada;
  const valeu = acabouDeComprar ? true : (tem ?? !revogada);
  for (const f of aoMudarDireito) f(valeu);
  responder({ tipo: "comprou" }, compra.productId);
}

function aoReceberErro(erro: { code?: unknown }) {
  const codigo = codigoDoErro(erro);
  if (foiCancelado(codigo)) return responder({ tipo: "cancelou" });
  if (estaEsperandoAprovacao(codigo)) return responder({ tipo: "esperando" });
  responder({ tipo: "erro", frase: fraseDoErro(codigo) ?? "" });
}

/* ── A conexão ────────────────────────────────────────────────────────── */

let conexao: Promise<boolean> | null = null;

/**
 * Abre a conexão com a App Store UMA vez por abertura do app e passa a ouvir as
 * compras (as novas, as aprovadas depois e as que ficaram por terminar).
 */
export function abrirConexao(): Promise<boolean> {
  if (!conexao) {
    conexao = (async () => {
      const m = await iap();
      const ok = await m.initConnection();
      if (!ok) throw new Error("conexão recusada");
      m.purchaseUpdatedListener((c) => void aoReceberCompra(c));
      m.purchaseErrorListener(aoReceberErro);
      return true;
    })().catch(() => {
      conexao = null;
      return false;
    });
  }
  return conexao;
}

/* ── O direito ────────────────────────────────────────────────────────── */

/**
 * Ela tem o plano completo NESTE aparelho (na conta da Apple dele)? Nulo:
 * não deu para perguntar (sem StoreKit) — quem chama fica com o que sabia.
 */
export async function lerDireito(): Promise<boolean | null> {
  try {
    if (!(await abrirConexao())) return null;
    const m = await iap();
    const compras = await m.getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
    return temPlanoCompleto(
      compras.map((c) => ({
        produto: c.productId,
        expiraEm: "expirationDateIOS" in c ? (c.expirationDateIOS ?? null) : null,
        revogadaEm: "revocationDateIOS" in c ? (c.revocationDateIOS ?? null) : null,
      })),
      Date.now(),
    );
  } catch {
    return null;
  }
}

/* ── Os produtos ──────────────────────────────────────────────────────── */

async function comDireitoAOferta(
  m: Modulo,
  p: ProductSubscription,
): Promise<ProdutoDaLoja["oferta"]> {
  const oferta = ofertaIntrodutoria(p);
  if (!oferta) return null;
  /* Quem já usou a oferta do grupo não tem direito a ela de novo: a tela não
     promete o que a Apple não vai dar. Sem como perguntar, sem oferta. */
  const grupo = "subscriptionGroupIdIOS" in p ? p.subscriptionGroupIdIOS : null;
  if (!grupo) return null;
  try {
    return (await m.isEligibleForIntroOfferIOS(grupo)) ? oferta : null;
  } catch {
    return null;
  }
}

/**
 * Os três produtos, com o preço e a oferta da loja dela. Lista vazia: a App
 * Store não devolveu nenhum (sem internet, ou os produtos ainda não existem no
 * App Store Connect). Nunca um preço inventado.
 */
export async function buscarProdutos(): Promise<ProdutoDaLoja[]> {
  if (!(await abrirConexao())) return [];
  const m = await iap();
  const fora: ProdutoDaLoja[] = [];
  try {
    const subs = ((await m.fetchProducts({ skus: [...ASSINATURAS], type: "subs" })) ??
      []) as ProductSubscription[];
    for (const p of subs) {
      const plano = planoDoProduto(p.id);
      if (!plano || plano === "vitalicio" || !p.displayPrice) continue;
      fora.push({
        plano,
        id: p.id,
        precoTexto: p.displayPrice,
        preco: p.price ?? null,
        moeda: p.currency || null,
        oferta: await comDireitoAOferta(m, p),
      });
    }
  } catch {
    /* sem as assinaturas: o vitalício ainda pode vir */
  }
  try {
    const unicos = ((await m.fetchProducts({ skus: [PRODUTOS.vitalicio], type: "in-app" })) ??
      []) as Product[];
    for (const p of unicos) {
      if (p.id !== PRODUTOS.vitalicio || !p.displayPrice) continue;
      fora.push({
        plano: "vitalicio",
        id: p.id,
        precoTexto: p.displayPrice,
        preco: p.price ?? null,
        moeda: p.currency || null,
        oferta: null,
      });
    }
  } catch {
    /* sem o vitalício */
  }
  return fora;
}

/* ── Comprar e restaurar ──────────────────────────────────────────────── */

/** O teto de uma compra sem resposta (a folha da Apple some sem avisar). */
const TETO_DA_COMPRA_MS = 5 * 60 * 1000;

/**
 * Abre a folha da Apple para o plano. A resposta vem pelos ouvintes (a compra
 * entregue, o cancelamento, o "Pedir para Comprar"); esta promessa resolve com
 * o que veio.
 */
export async function comprar(plano: Plano): Promise<ResultadoDaCompra> {
  if (!(await abrirConexao())) return { tipo: "erro", frase: fraseDoErro("init-connection")! };
  const m = await iap();
  const sku = PRODUTOS[plano];
  /* Uma compra de cada vez: a anterior (se a folha sumiu sem resposta) acaba aqui. */
  responder({ tipo: "cancelou" });
  return new Promise<ResultadoDaCompra>((resolver) => {
    const teto = setTimeout(() => responder({ tipo: "cancelou" }, sku), TETO_DA_COMPRA_MS);
    esperando = {
      sku,
      responder: (r) => {
        clearTimeout(teto);
        resolver(r);
      },
    };
    const pedido =
      plano === "vitalicio"
        ? m.requestPurchase({ request: { apple: { sku } }, type: "in-app" })
        : m.requestPurchase({ request: { apple: { sku } }, type: "subs" });
    void Promise.resolve(pedido)
      .then((volta) => {
        /* No iPhone a compra também volta aqui; o ouvinte já a trata, e uma
           transação só é tratada uma vez. */
        const lista = Array.isArray(volta) ? volta : volta ? [volta] : [];
        for (const c of lista) if (c && c.productId === sku) void aoReceberCompra(c);
      })
      .catch((e: unknown) => {
        const codigo = codigoDoErro(e);
        if (foiCancelado(codigo)) responder({ tipo: "cancelou" }, sku);
        else if (estaEsperandoAprovacao(codigo)) responder({ tipo: "esperando" }, sku);
        else responder({ tipo: "erro", frase: fraseDoErro(codigo) ?? "" }, sku);
      });
  });
}

/** "Restaurar compras": pergunta à Apple o que esta conta já comprou. */
export async function restaurar(): Promise<ResultadoDaRestauracao> {
  try {
    if (!(await abrirConexao())) return { tipo: "erro", frase: fraseDoErro("init-connection")! };
    const m = await iap();
    await m.restorePurchases();
  } catch (e) {
    const codigo = codigoDoErro(e);
    if (foiCancelado(codigo)) return { tipo: "nada" };
    return { tipo: "erro", frase: fraseDoErro(codigo) ?? "" };
  }
  const tem = await lerDireito();
  if (tem == null) return { tipo: "erro", frase: fraseDoErro("network-error")! };
  for (const f of aoMudarDireito) f(tem);
  return tem ? { tipo: "restaurou" } : { tipo: "nada" };
}
