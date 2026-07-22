import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { typedDb } from "@/integrations/supabase/types.extended";
import { CANTINHO_BY_ID } from "@/lib/cantinho";

/**
 * Backend do Meu Cantinho. Toda compra valida o PREÇO pelo catálogo do servidor
 * (nunca confia no cliente) e roda pela função atômica buy_cantinho_item.
 */

async function authUid(accessToken: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user.id;
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
      .select("quiz_premium")
      .eq("id", uid)
      .single();
    return {
      ok: true as const,
      balance,
      owned: ((owned ?? []) as { item_id: string }[]).map((r) => r.item_id),
      premium: Boolean((prof as { quiz_premium?: boolean } | null)?.quiz_premium),
    };
  });

/** Compra um item do catálogo. Preço vem do servidor; débito é atômico. */
export const buyCantinhoItem = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), itemId: z.string().min(1).max(80) }).parse(i),
  )
  .handler(async ({ data }) => {
    const uid = await authUid(data.accessToken);
    if (!uid) return { ok: false as const, error: "Não autenticado" };
    const item = CANTINHO_BY_ID[data.itemId];
    if (!item) return { ok: false as const, error: "Item inexistente" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Gate de Premium no servidor: item premium só p/ assinante (nunca confia no cliente).
    if (item.premium) {
      const { data: prof } = await supabaseAdmin
        .from("patient_profiles")
        .select("quiz_premium")
        .eq("id", uid)
        .single();
      if (!(prof as { quiz_premium?: boolean } | null)?.quiz_premium) {
        return { ok: false as const, error: "Item exclusivo do Premium" };
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
    if (error) return { ok: false as const, error: "Falha na compra" };
    const r = (res ?? {}) as { ok?: boolean; error?: string; balance?: number };
    if (!r.ok) {
      const msg =
        r.error === "saldo_insuficiente"
          ? "Sementinhas insuficientes"
          : r.error === "ja_possui"
            ? "Você já tem este item"
            : "Não foi possível comprar";
      return { ok: false as const, error: msg, balance: r.balance ?? 0 };
    }
    return { ok: true as const, balance: r.balance ?? 0, itemId: item.id };
  });
