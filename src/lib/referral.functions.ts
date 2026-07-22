import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { typedDb } from "@/integrations/supabase/types.extended";
import { grantSementinhas, SEMENTINHAS } from "@/lib/sementinhas.functions";
import { isCareModeActive } from "@/lib/care-mode.functions";

/**
 * Indicar uma amiga → 100 Sementinhas 🌱 quando ela cria a conta.
 *
 * Cada paciente tem um código (referral_code). A amiga entra pelo link
 * (?amiga=CODE), cria a conta e, na 1ª visita logada, o app chama
 * attributeReferral: fixa `referred_by` (uma vez) e credita 100 🌱 à indicadora
 * — uma vez por amiga (dedupe pelo id da amiga). Sem auto-indicação, sem trocar
 * a indicação depois. Crédito sempre server-only.
 */

export const REFERRAL_REWARD = 100;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I (menos confusão)

async function authUid(accessToken: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user.id;
}

function randomCode(len = 7): string {
  const b = new Uint8Array(len);
  globalThis.crypto.getRandomValues(b);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[b[i] % ALPHABET.length];
  return out;
}

function normalizeCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Lê (e cria, se preciso) o código de indicação da paciente + nº de indicações. */
export const getReferral = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const uid = await authUid(data.accessToken);
    if (!uid) return { ok: false as const, error: "Não autenticado" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: prof } = await sb
      .from("patient_profiles")
      .select("referral_code")
      .eq("id", uid)
      .maybeSingle();
    let code: string | null = prof?.referral_code ?? null;

    // Gera na primeira vez (tenta poucas vezes em caso de colisão do índice único).
    if (!code) {
      for (let attempt = 0; attempt < 5 && !code; attempt++) {
        const candidate = randomCode();
        const { error } = await sb
          .from("patient_profiles")
          .update({ referral_code: candidate })
          .eq("id", uid)
          .is("referral_code", null);
        if (!error) {
          const { data: check } = await sb
            .from("patient_profiles")
            .select("referral_code")
            .eq("id", uid)
            .maybeSingle();
          code = check?.referral_code ?? null;
        }
      }
    }

    const { count } = await sb
      .from("patient_profiles")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", uid);

    return { ok: true as const, code, count: count ?? 0 };
  });

/**
 * Atribui a indicação da amiga logada (uid) a quem tem o código `code` e credita
 * 100 🌱 à indicadora. Idempotente: só age se a amiga ainda não tem
 * `referred_by`. Sem auto-indicação. Chamado na 1ª visita logada com o código
 * guardado do link.
 */
export const attributeReferral = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), code: z.string().min(3).max(20) }).parse(i),
  )
  .handler(async ({ data }) => {
    const uid = await authUid(data.accessToken);
    if (!uid) return { ok: false as const, error: "Não autenticado" };
    const code = normalizeCode(data.code);
    if (code.length < 3) return { ok: true as const, attributed: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    // Já indicada? (fixado uma vez) — nada a fazer.
    const { data: me } = await sb
      .from("patient_profiles")
      .select("referred_by")
      .eq("id", uid)
      .maybeSingle();
    // Perfil ainda não criado (amiga recém-chegada): pede pra tentar de novo.
    if (!me) return { ok: true as const, attributed: false, retry: true };
    if (me.referred_by) return { ok: true as const, attributed: false };

    // Quem é a indicadora?
    const { data: ref } = await sb
      .from("patient_profiles")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();
    const referrerId: string | undefined = ref?.id;
    if (!referrerId || referrerId === uid) return { ok: true as const, attributed: false };

    // Fixa a indicação SÓ se ainda está nula (evita corrida / troca posterior).
    const { data: claimed } = await sb
      .from("patient_profiles")
      .update({ referred_by: referrerId })
      .eq("id", uid)
      .is("referred_by", null)
      .select("id");
    if (!claimed || claimed.length === 0) return { ok: true as const, attributed: false };

    // Credita a indicadora: 100 🌱 por amiga (dedupe pelo id da amiga), fora do
    // Modo Cuidado da indicadora. Best-effort — a atribuição já está fixada.
    try {
      if (!(await isCareModeActive(supabaseAdmin, referrerId))) {
        await grantSementinhas(typedDb(supabaseAdmin), referrerId, [
          {
            amount: REFERRAL_REWARD,
            reason: "Indicou uma amiga 👭",
            dedupeKey: `referral:${uid}`,
          },
        ]);
      }
    } catch (e) {
      console.error("[referral] reward failed", e);
    }
    return { ok: true as const, attributed: true };
  });
