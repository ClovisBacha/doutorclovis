import {
  CANTINHO_BY_ID,
  CANTINHO_COMPLETION_MIN,
  CANTINHO_COMPLETIONIST_ID,
  CANTINHO_ITEMS,
  cantinhoCategoriasCompletas,
  isCantinhoCollectionComplete,
} from "@/lib/cantinho";
import { CONJUNTOS, bonusDoConjunto } from "@/lib/conjuntos";
import { BONUS_INFLUENCIADORA } from "@/lib/economia-sementinhas";
import { faltamTrofeus } from "@/lib/trofeus";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import {
  comprarDoCantinho,
  equiparCenario,
  lerCantinho,
  type CompraDoCantinho,
  type LeituraDoCantinho,
} from "~/servidor/cantinho";
import { lerCarteira } from "~/servidor/economia";
import {
  aplicarCodigoDeQuemIndicou,
  enviarDepoimento,
  lerIndicacao,
  lerMeuDepoimento,
  type StatusDoDepoimento,
} from "~/servidor/ganhos";

/**
 * O Cantinho visto pelo app: as funções do servidor com as duas regras da
 * economia da Jornada — NUNCA lançam (falha vira `null`, que a tela mostra como
 * falha, e nunca como saldo zero), e na bancada não chamam o servidor.
 *
 *   ?bancada=1        os seis primeiros itens sem Premium, 420 🌱, 12 🏆 — os
 *                     mesmos números da bancada do site (/preview-cantinho)
 *   &vazio=1          só o que o servidor dá a todas (os itens grátis)
 *   &saldo=N  &trofeus=N  &fundo=<id do cenário em uso>
 */

export type CantinhoOk = Extract<LeituraDoCantinho, { ok: true }>;

const espera = (ms = 250) => new Promise((r) => setTimeout(r, ms));

/** O que o servidor dá a todas sem compra (`FREE_ITEM_IDS` de cantinho.functions.ts). */
const GRATIS = CANTINHO_ITEMS.filter((i) => i.price <= 0 && i.id !== CANTINHO_COMPLETIONIST_ID).map(
  (i) => i.id,
);

/** A posse como o servidor a devolve: grátis sempre, e a Coroa assim que a coleção fecha. */
function comoOServidor(
  owned: Iterable<string>,
): Pick<CantinhoOk, "owned" | "collectionComplete" | "collectionOwned" | "collectionTotal"> {
  const ids = new Set([...owned, ...GRATIS]);
  const completa = isCantinhoCollectionComplete(ids);
  if (completa) ids.add(CANTINHO_COMPLETIONIST_ID);
  return {
    owned: [...ids],
    collectionComplete: completa,
    collectionOwned: cantinhoCategoriasCompletas(ids),
    collectionTotal: CANTINHO_COMPLETION_MIN,
  };
}

/* A bancada guarda o que "comprou" em memória: a tela troca de estado como na
   produção, sem servidor nenhum. */
let bancada: CantinhoOk | null = null;

function cantinhoDaBancada(): CantinhoOk {
  if (bancada) return bancada;
  const vazio = parametroDaBancada("vazio") === "1";
  /* Os MESMOS seis da bancada do site: os primeiros itens sem Premium. */
  const comprados = vazio
    ? []
    : CANTINHO_ITEMS.filter((i) => !i.premium)
        .slice(0, 6)
        .map((i) => i.id);
  bancada = {
    ok: true,
    balance: Number(parametroDaBancada("saldo") ?? 420),
    premium: false,
    equippedFundo: parametroDaBancada("fundo") ?? null,
    trofeus: Number(parametroDaBancada("trofeus") ?? 12),
    ...comoOServidor(comprados),
  };
  return bancada;
}

export async function lerOCantinho(): Promise<CantinhoOk | null> {
  if (ehBancada()) {
    await espera();
    return { ...cantinhoDaBancada() };
  }
  try {
    const r = await lerCantinho();
    return r && r.ok ? r : null;
  } catch {
    return null;
  }
}

/**
 * Compra um item. Na bancada, as mesmas recusas do servidor (já possui, saldo,
 * troféus) e o mesmo bônus de conjunto, para a tela passar pelos mesmos
 * caminhos que a produção.
 */
export async function comprarItem(itemId: string): Promise<CompraDoCantinho | null> {
  if (ehBancada()) {
    await espera(500);
    const b = cantinhoDaBancada();
    const item = CANTINHO_BY_ID[itemId];
    if (!item) return { ok: false, error: "Item inexistente" };
    if (b.owned.includes(itemId))
      return {
        ok: false,
        error: "Você já tem este item 💛",
        motivo: "ja_possui",
        balance: b.balance,
      };
    if (faltamTrofeus(itemId, b.trofeus) > 0)
      return { ok: false, error: "Ainda faltam troféus para este item 🏆" };
    if (b.balance < item.price)
      return {
        ok: false,
        error: "Sementinhas insuficientes 🌱",
        motivo: "saldo_insuficiente",
        balance: b.balance,
      };
    const antes = new Set(b.owned);
    Object.assign(b, comoOServidor([...b.owned, itemId]));
    const novos = CONJUNTOS.filter(
      (c) => c.itens.every((id) => b.owned.includes(id)) && !c.itens.every((id) => antes.has(id)),
    );
    const bonusNovo = novos.reduce((s, c) => s + bonusDoConjunto(c), 0);
    b.balance = b.balance - item.price + bonusNovo;
    return {
      ok: true,
      balance: b.balance,
      itemId,
      conjuntosNovos: novos.map((c) => c.id),
      bonusNovo,
    };
  }
  try {
    return await comprarDoCantinho({ itemId });
  } catch {
    return null;
  }
}

/** Equipa (ou tira, com `null`) o cenário do Caminho. `false` = não gravou. */
export async function equiparOCenario(fundoId: string | null): Promise<boolean> {
  if (ehBancada()) {
    await espera(300);
    cantinhoDaBancada().equippedFundo = fundoId;
    return true;
  }
  try {
    const r = await equiparCenario({ fundoId });
    return !!r && r.ok;
  } catch {
    return false;
  }
}

/* ── O "Ganhe mais Sementinhas" ─────────────────────────────────────────── */

export type Indicacao = { codigo: string | null; amigas: number };

export async function lerAIndicacao(): Promise<Indicacao | null> {
  if (ehBancada()) {
    await espera();
    return { codigo: "MARIA7", amigas: 2 };
  }
  try {
    const r = await lerIndicacao();
    return r && r.ok ? { codigo: r.code, amigas: r.count } : null;
  } catch {
    return null;
  }
}

export type Depoimento = {
  texto: string;
  nome: string | null;
  status: StatusDoDepoimento;
} | null;

/** `undefined` = não consegui ler (o cartão se esconde); `null` = ela ainda não escreveu. */
export async function lerODepoimento(): Promise<Depoimento | undefined> {
  if (ehBancada()) {
    await espera();
    const s = parametroDaBancada("depoimento");
    if (s === "pendente" || s === "aprovado" || s === "recusado")
      return {
        texto: "O app me acalmou nas noites em que eu achava que tinha algo errado. 💛",
        nome: "Mariana, mamãe da Alice",
        status: s === "pendente" ? "pending" : s === "aprovado" ? "approved" : "rejected",
      };
    return null;
  }
  try {
    const r = await lerMeuDepoimento();
    if (!r || !r.ok) return undefined;
    return r.testimonial
      ? { texto: r.testimonial.body, nome: r.testimonial.displayName, status: r.testimonial.status }
      : null;
  } catch {
    return undefined;
  }
}

/** `true` = foi para a análise do médico; o texto de erro, quando não foi. */
export async function mandarDepoimento(texto: string, nome: string): Promise<true | string> {
  if (ehBancada()) {
    await espera(400);
    return true;
  }
  try {
    const r = await enviarDepoimento({ body: texto, displayName: nome || undefined });
    if (r && r.ok) return true;
    return (r && !r.ok && r.error) || "Não foi possível enviar";
  } catch {
    return "Sem conexão agora — tente de novo em instantes.";
  }
}

export type CodigoAplicado =
  | { tipo: "aplicado"; bonus: number }
  | { tipo: "invalido" }
  | { tipo: "ja-tinha" }
  | { tipo: "falhou" };

export async function aplicarOCodigo(codigo: string): Promise<CodigoAplicado> {
  if (ehBancada()) {
    await espera(400);
    return codigo.trim().toUpperCase() === "ERRADO"
      ? { tipo: "invalido" }
      : { tipo: "aplicado", bonus: BONUS_INFLUENCIADORA };
  }
  try {
    const r = await aplicarCodigoDeQuemIndicou({ codigo });
    if (!r || !r.ok) return { tipo: "falhou" };
    if (r.atribuido) return { tipo: "aplicado", bonus: r.bonus };
    if (r.invalido) return { tipo: "invalido" };
    if (r.jaTinha) return { tipo: "ja-tinha" };
    return { tipo: "falhou" };
  } catch {
    return { tipo: "falhou" };
  }
}

export type Lancamento = { quantidade: number; motivo: string | null; quando: string };

/** As últimas movimentações (o extrato da Loja de Sementinhas do site). */
export async function lerExtrato(): Promise<Lancamento[] | null> {
  if (ehBancada()) {
    await espera();
    return [
      { quantidade: 5, motivo: "Check-in diário", quando: "2026-10-14T09:12:00-03:00" },
      { quantidade: -22, motivo: "Compra: Joaninha", quando: "2026-10-13T20:40:00-03:00" },
      { quantidade: 20, motivo: "Dia de cinco estrelas", quando: "2026-10-13T19:02:00-03:00" },
      { quantidade: 14, motivo: "Aula do dia", quando: "2026-10-13T08:30:00-03:00" },
    ];
  }
  try {
    const r = await lerCarteira();
    if (!r || !r.ok) return null;
    return (r.recent ?? []).map((l) => ({
      quantidade: l.amount,
      motivo: l.reason ?? null,
      quando: l.created_at,
    }));
  } catch {
    return null;
  }
}
