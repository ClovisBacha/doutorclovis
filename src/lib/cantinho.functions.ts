import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { typedDb } from "@/integrations/supabase/types.extended";
import {
  CANTINHO_BY_ID,
  CANTINHO_ITEMS,
  CANTINHO_COMPLETIONIST_ID,
  CANTINHO_COMPLETION_REQUIRED,
  isCantinhoCollectionComplete,
} from "@/lib/cantinho";

/**
 * Itens grátis (preço 0) — sempre possuídos, não precisam de compra. O troféu
 * da coleção (também preço 0) é EXCLUÍDO: ele não é grátis, é desbloqueado ao
 * completar a coleção.
 */
const FREE_ITEM_IDS = CANTINHO_ITEMS.filter(
  (i) => i.price <= 0 && i.id !== CANTINHO_COMPLETIONIST_ID,
).map((i) => i.id);

/**
 * Backend do Meu Cantinho. Toda compra valida o PREÇO pelo catálogo do servidor
 * (nunca confia no cliente) e roda pela função atômica buy_cantinho_item.
 */

async function authUid(accessToken: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !data.user) return null;
    return data.user.id;
  } catch (e) {
    console.error("[cantinho authUid] erro:", e);
    return null;
  }
}

/** Saldo + itens que a paciente já possui. */
export const getCantinho = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const uid = await authUid(data.accessToken);
    if (!uid) return { ok: false as const, error: "Não autenticado" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: ledger } = await db
      .from("sementinhas_ledger")
      .select("amount")
      .eq("user_id", uid);
    const balance = ((ledger ?? []) as { amount: number }[]).reduce(
      (s, r) => s + (r.amount ?? 0),
      0,
    );
    const { data: owned } = await db.from("cantinho_items").select("item_id").eq("user_id", uid);
    const { data: prof } = await supabaseAdmin
      .from("patient_profiles")
      .select("quiz_premium, cantinho_fundo")
      .eq("id", uid)
      .single();
    const p = prof as { quiz_premium?: boolean; cantinho_fundo?: string | null } | null;
    // Itens grátis entram como possuídos sempre (sem linha na tabela de compras).
    const ownedIds = new Set(((owned ?? []) as { item_id: string }[]).map((r) => r.item_id));
    for (const id of FREE_ITEM_IDS) ownedIds.add(id);
    // Troféu da coleção: concedido (virtual) assim que tem todos os itens comuns.
    const collectionComplete = isCantinhoCollectionComplete(ownedIds);
    if (collectionComplete) ownedIds.add(CANTINHO_COMPLETIONIST_ID);
    const collectionOwned = CANTINHO_COMPLETION_REQUIRED.filter((id) => ownedIds.has(id)).length;
    return {
      ok: true as const,
      balance,
      owned: [...ownedIds],
      premium: Boolean(p?.quiz_premium),
      // Nada por padrão: o Caminho só ganha cenário quando a paciente ESCOLHE
      // um fundo que possui (nada aparece sem ela querer).
      equippedFundo: p?.cantinho_fundo ?? null,
      collectionComplete,
      collectionOwned,
      collectionTotal: CANTINHO_COMPLETION_REQUIRED.length,
    };
  });

/** Compra um item do catálogo. Preço vem do servidor; débito é atômico. */
export const buyCantinhoItem = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), itemId: z.string().min(1).max(80) }).parse(i),
  )
  .handler(async ({ data }) => {
    // TUDO num try/catch: a compra NUNCA lança pro cliente. Qualquer exceção
    // (import, RPC, rede) vira um { ok:false, error } com a mensagem real, que
    // o app mostra no toast — em vez do "Não consegui comprar agora" genérico.
    try {
      const uid = await authUid(data.accessToken);
      if (!uid) return { ok: false as const, error: "Sua sessão expirou — entre novamente." };
      const item = CANTINHO_BY_ID[data.itemId];
      if (!item) return { ok: false as const, error: "Item inexistente" };
      // Troféu da coleção não se compra — desbloqueia ao completar a coleção.
      if (item.id === CANTINHO_COMPLETIONIST_ID) {
        return { ok: false as const, error: "Desbloqueia ao completar a coleção 👑" };
      }
      // Item grátis não passa pela compra — já é da paciente desde o início.
      if (item.price <= 0) return { ok: false as const, error: "Este item já é seu 💛" };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // Gate de Premium no servidor: item premium só p/ assinante (nunca confia no cliente).
      if (item.premium) {
        // maybeSingle (não single): .single() LANÇA quando não há linha de perfil,
        // e era isso que derrubava a compra de itens premium com erro opaco.
        const { data: prof } = await supabaseAdmin
          .from("patient_profiles")
          .select("quiz_premium")
          .eq("id", uid)
          .maybeSingle();
        if (!(prof as { quiz_premium?: boolean } | null)?.quiz_premium) {
          return { ok: false as const, error: "Item exclusivo do Premium 💎" };
        }
      }
      // A função buy_cantinho_item não está nos tipos gerados; cast tipado.
      const rpc = supabaseAdmin.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>;
      const { data: res, error } = await rpc("buy_cantinho_item", {
        p_user: uid,
        p_item: item.id,
        p_price: item.price,
      });
      if (error) {
        // Surface o motivo real (ex.: função ausente, permissão) — ajuda o
        // diagnóstico em produção em vez de um "Falha na compra" opaco.
        const m = (error as { message?: string; code?: string })?.message ?? "erro desconhecido";
        console.error("[buyCantinhoItem] RPC error:", error);
        return { ok: false as const, error: `Erro no banco: ${m}` };
      }
      const r = (res ?? {}) as { ok?: boolean; error?: string; balance?: number };
      if (!r.ok) {
        const msg =
          r.error === "saldo_insuficiente"
            ? "Sementinhas insuficientes 🌱"
            : r.error === "ja_possui"
              ? "Você já tem este item 💛"
              : `Não foi possível comprar (${r.error ?? "motivo desconhecido"})`;
        return { ok: false as const, error: msg, balance: r.balance ?? 0 };
      }
      return { ok: true as const, balance: r.balance ?? 0, itemId: item.id };
    } catch (e) {
      const m = (e as { message?: string })?.message ?? String(e);
      console.error("[buyCantinhoItem] exceção:", e);
      return { ok: false as const, error: `Erro ao comprar: ${m}` };
    }
  });

/** Equipa (ou limpa, com null) o cenário ativo do Cantinho. Só 1 por vez. */
export const setCantinhoFundo = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), fundoId: z.string().max(80).nullable() }).parse(i),
  )
  .handler(async ({ data }) => {
    const uid = await authUid(data.accessToken);
    if (!uid) return { ok: false as const, error: "Não autenticado" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.fundoId) {
      const item = CANTINHO_BY_ID[data.fundoId];
      if (!item || item.type !== "fundo") return { ok: false as const, error: "Cenário inválido" };
      // Item grátis dispensa a checagem de posse (sempre é da paciente).
      if (item.price > 0) {
        // Precisa possuir o item pra equipar.
        const db = typedDb(supabaseAdmin);
        const { data: owned } = await db
          .from("cantinho_items")
          .select("item_id")
          .eq("user_id", uid)
          .eq("item_id", data.fundoId)
          .maybeSingle();
        if (!owned) return { ok: false as const, error: "Você ainda não tem este cenário" };
      }
    }
    const { error: upErr } = await (
      supabaseAdmin.from("patient_profiles") as unknown as {
        update: (v: { cantinho_fundo: string | null }) => {
          eq: (c: string, val: string) => Promise<{ error: unknown }>;
        };
      }
    )
      .update({ cantinho_fundo: data.fundoId })
      .eq("id", uid);
    if (upErr) return { ok: false as const, error: "Falha ao salvar" };
    return { ok: true as const, equippedFundo: data.fundoId };
  });
