import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { typedDb } from "@/integrations/supabase/types.extended";
import { grantSementinhas } from "@/lib/sementinhas.functions";
import { isCareModeActive } from "@/lib/care-mode.functions";

/**
 * Compartilhar no Instagram → 100 Sementinhas 🌱 (automático).
 *
 * Fluxo: a paciente registra o @ dela; posta um Story marcando @obstetrica.app;
 * o Instagram avisa nosso webhook (ver src/routes/api/instagram-webhook.ts);
 * nós casamos o @ de quem marcou com a conta e creditamos 100 🌱 — no máximo
 * 1x por semana (anti-farm) e nunca em Modo Cuidado. O crédito é SEMPRE
 * server-only, como todo ganho de Sementinhas.
 *
 * A verificação real vem do Instagram (não dá pra forjar ser marcado), então
 * não precisa de aprovação manual — some que a config da Meta esteja pronta.
 */

export const INSTAGRAM_SHARE_REWARD = 100;
/** Handle público que a paciente deve marcar no Story. */
export const INSTAGRAM_TAG = "obstetrica.app";

/** Normaliza um @: minúsculo, sem @, só [a-z0-9._], no máx. 30 chars. */
export function normalizeHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, 30);
}

/**
 * Balde semanal (fuso America/Sao_Paulo) para dedupe do prêmio: no máx. 1
 * crédito de Instagram por semana, por mais Stories que a paciente poste.
 */
function weekBucketSaoPaulo(): number {
  const ymd = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const [y, m, d] = ymd.split("-").map(Number);
  const days = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return Math.floor(days / 7);
}

function dedupeKeyThisWeek(): string {
  return `instagram_share:${weekBucketSaoPaulo()}`;
}

/** A integração só "existe" pra paciente quando a Meta está configurada. */
export function instagramConfigured(): boolean {
  return Boolean(process.env.INSTAGRAM_APP_SECRET && process.env.INSTAGRAM_VERIFY_TOKEN);
}

async function authUid(accessToken: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user.id;
}

/**
 * Concede as 100 🌱 do Instagram (server-only). Idempotente por semana; nunca em
 * Modo Cuidado. Chamado pelo webhook quando alguém marca @obstetrica.app num
 * Story e o @ casa com uma conta. Devolve quanto concedeu (0 se já ganhou esta
 * semana ou em Modo Cuidado).
 */
export async function grantInstagramShare(uid: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = typedDb(supabaseAdmin);
  if (await isCareModeActive(supabaseAdmin, uid)) return 0;
  const dedupeKey = dedupeKeyThisWeek();
  const { data: existing } = await db
    .from("sementinhas_ledger")
    .select("amount")
    .eq("user_id", uid)
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (existing) return 0;
  await grantSementinhas(db, uid, [
    { amount: INSTAGRAM_SHARE_REWARD, reason: "Compartilhou no Instagram 📸", dedupeKey },
  ]);
  return INSTAGRAM_SHARE_REWARD;
}

/** Acha o usuário dono de um @ do Instagram (normalizado). Server-only. */
export async function findUidByInstagramHandle(handle: string): Promise<string | null> {
  const norm = normalizeHandle(handle);
  if (!norm) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (
    supabaseAdmin.from("patient_profiles") as unknown as {
      select: (c: string) => {
        eq: (
          c: string,
          v: string,
        ) => {
          limit: (n: number) => {
            maybeSingle: () => Promise<{ data: { id?: string } | null }>;
          };
        };
      };
    }
  )
    .select("id")
    .eq("instagram_handle", norm)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/** Lê o estado do Instagram da paciente (o @ salvo, se ligado, se ganhou na semana). */
export const getInstagramShare = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const uid = await authUid(data.accessToken);
    if (!uid) return { ok: false as const, error: "Não autenticado" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: prof } = await (
      supabaseAdmin.from("patient_profiles") as unknown as {
        select: (c: string) => {
          eq: (
            c: string,
            v: string,
          ) => { single: () => Promise<{ data: { instagram_handle?: string | null } | null }> };
        };
      }
    )
      .select("instagram_handle")
      .eq("id", uid)
      .single();
    const { data: week } = await db
      .from("sementinhas_ledger")
      .select("amount")
      .eq("user_id", uid)
      .eq("dedupe_key", dedupeKeyThisWeek())
      .maybeSingle();
    return {
      ok: true as const,
      enabled: instagramConfigured(),
      handle: prof?.instagram_handle ?? null,
      reward: INSTAGRAM_SHARE_REWARD,
      tag: INSTAGRAM_TAG,
      rewardedThisWeek: Boolean(week),
    };
  });

/** Salva/atualiza o @ do Instagram da paciente (normalizado). Vazio = remove. */
export const setInstagramHandle = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), handle: z.string().max(40) }).parse(i),
  )
  .handler(async ({ data }) => {
    const uid = await authUid(data.accessToken);
    if (!uid) return { ok: false as const, error: "Não autenticado" };
    const norm = normalizeHandle(data.handle);
    if (data.handle.trim() && norm.length < 2) {
      return { ok: false as const, error: "@ inválido" };
    }
    const value = norm || null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (
      supabaseAdmin.from("patient_profiles") as unknown as {
        update: (v: { instagram_handle: string | null }) => {
          eq: (c: string, val: string) => Promise<{ error: unknown }>;
        };
      }
    )
      .update({ instagram_handle: value })
      .eq("id", uid);
    if (error) return { ok: false as const, error: "Falha ao salvar" };
    return { ok: true as const, handle: value };
  });
