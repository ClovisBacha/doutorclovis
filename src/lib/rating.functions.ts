import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { typedDb } from "@/integrations/supabase/types.extended";
import { grantSementinhas } from "@/lib/sementinhas.functions";
import { isCareModeActive } from "@/lib/care-mode.functions";

/**
 * Avaliar o app na loja → 100 Sementinhas 🌱 (uma vez).
 *
 * Como as lojas (Play/App Store) não dizem QUEM avaliou, a confirmação é por
 * confiança: a paciente toca em avaliar (abre a loja), volta e toca "já
 * avaliei" → ganha 100 🌱 uma única vez. Por ser cosmético e one-time, o risco
 * é irrelevante. Só aparece quando pelo menos uma URL de loja está configurada
 * (enquanto as lojas não existem, o card fica escondido — nada de promessa
 * morta). O crédito é sempre server-only.
 */

export const APP_RATING_REWARD = 100;
const DEDUPE_KEY = "app_rating";

/** Links das lojas (públicos). Vazio = loja ainda não publicada. */
function storeLinks() {
  return {
    play: process.env.PLAY_STORE_URL || "",
    apple: process.env.APP_STORE_URL || "",
  };
}

/** A recompensa só "existe" quando há ao menos uma loja pra avaliar. */
export function ratingConfigured(): boolean {
  const { play, apple } = storeLinks();
  return Boolean(play || apple);
}

async function authUid(accessToken: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user.id;
}

/** Estado da recompensa de avaliação (ligada?, links, já resgatou?). */
export const getRatingReward = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const uid = await authUid(data.accessToken);
    if (!uid) return { ok: false as const, error: "Não autenticado" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: existing } = await db
      .from("sementinhas_ledger")
      .select("amount")
      .eq("user_id", uid)
      .eq("dedupe_key", DEDUPE_KEY)
      .maybeSingle();
    const links = storeLinks();
    return {
      ok: true as const,
      enabled: ratingConfigured(),
      reward: APP_RATING_REWARD,
      playUrl: links.play || null,
      appleUrl: links.apple || null,
      claimed: Boolean(existing),
    };
  });

/**
 * Resgata as 100 🌱 da avaliação (uma vez, por confiança). Só concede se há
 * loja configurada e fora do Modo Cuidado. Idempotente (dedupe fixo).
 */
export const claimRatingReward = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const uid = await authUid(data.accessToken);
    if (!uid) return { ok: false as const, error: "Não autenticado" };
    if (!ratingConfigured()) return { ok: true as const, granted: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    if (await isCareModeActive(supabaseAdmin, uid)) return { ok: true as const, granted: 0 };
    const { data: existing } = await db
      .from("sementinhas_ledger")
      .select("amount")
      .eq("user_id", uid)
      .eq("dedupe_key", DEDUPE_KEY)
      .maybeSingle();
    if (existing) return { ok: true as const, granted: 0 };
    await grantSementinhas(db, uid, [
      { amount: APP_RATING_REWARD, reason: "Avaliou o app na loja ⭐", dedupeKey: DEDUPE_KEY },
    ]);
    return { ok: true as const, granted: APP_RATING_REWARD };
  });
