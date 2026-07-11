/**
 * Convites premium — o médico Elite presenteia pacientes com o app premium.
 *
 *   - getMyInviteInfo: (médico logado) o seu código + cota do mês. Gera o
 *     código na primeira vez que um médico Elite abre a área.
 *   - redeemInviteCode: (paciente logada) digita o código → ganha o premium,
 *     respeitando a cota mensal do médico. Idempotente por paciente/médico.
 *
 * Só médicos com convites no plano (Elite) emitem; a liberação do premium é
 * feita aqui via service_role (o webhook do Stripe cuida do premium pago).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { entitlementsFor } from "@/lib/entitlements";

/** Início do mês corrente (UTC) em ISO — para contar a cota do mês. */
function monthStartISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Código legível de 8 caracteres (sem 0/O/1/I para não confundir). */
function genCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export type InviteInfo = {
  eligible: boolean; // o plano do médico dá convites?
  code: string | null;
  limit: number;
  used: number;
  remaining: number;
};

export const getMyInviteInfo = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }): Promise<{ ok: false } | ({ ok: true } & InviteInfo)> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false as const };

    const { data: doc } = await (supabaseAdmin as any)
      .from("doctors")
      .select("id,plan,active,invite_code")
      .eq("id", u.user.id)
      .maybeSingle();
    if (!doc) return { ok: false as const };

    const limit = doc.active ? entitlementsFor(doc.plan).premiumInvitesPerMonth : 0;
    if (limit <= 0) {
      return { ok: true as const, eligible: false, code: null, limit: 0, used: 0, remaining: 0 };
    }

    // Gera o código na primeira vez (garante unicidade com algumas tentativas).
    let code: string | null = doc.invite_code ?? null;
    if (!code) {
      for (let attempt = 0; attempt < 6 && !code; attempt++) {
        const candidate = genCode();
        const { error } = await (supabaseAdmin as any)
          .from("doctors")
          .update({ invite_code: candidate })
          .eq("id", u.user.id);
        if (!error) code = candidate;
      }
    }

    const { count } = await (supabaseAdmin as any)
      .from("premium_invites")
      .select("id", { count: "exact", head: true })
      .eq("doctor_id", u.user.id)
      .gte("created_at", monthStartISO());
    const used = count ?? 0;
    return {
      ok: true as const,
      eligible: true,
      code,
      limit,
      used,
      remaining: Math.max(0, limit - used),
    };
  });

export const redeemInviteCode = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), code: z.string().min(4).max(16) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false as const, error: "nao_autenticado" };

    const code = data.code.trim().toUpperCase();
    const { data: doc } = await (supabaseAdmin as any)
      .from("doctors")
      .select("id,plan,active,invite_code")
      .eq("invite_code", code)
      .maybeSingle();
    if (!doc) return { ok: false as const, error: "codigo_invalido" };

    const limit = doc.active ? entitlementsFor(doc.plan).premiumInvitesPerMonth : 0;
    if (limit <= 0) return { ok: false as const, error: "codigo_inativo" };

    // Já resgatou este código antes? Idempotente: garante o premium e sai.
    const { data: prior } = await (supabaseAdmin as any)
      .from("premium_invites")
      .select("id")
      .eq("doctor_id", doc.id)
      .eq("patient_user_id", u.user.id)
      .maybeSingle();

    if (!prior) {
      // Cota do mês do médico
      const { count } = await (supabaseAdmin as any)
        .from("premium_invites")
        .select("id", { count: "exact", head: true })
        .eq("doctor_id", doc.id)
        .gte("created_at", monthStartISO());
      if ((count ?? 0) >= limit) return { ok: false as const, error: "cota_esgotada" };

      const { error: insErr } = await (supabaseAdmin as any)
        .from("premium_invites")
        .insert({ doctor_id: doc.id, patient_user_id: u.user.id });
      // Corrida: se duas abas resgatarem juntas, o UNIQUE barra a 2ª — ok.
      if (insErr && !String(insErr.message || "").includes("duplicate")) {
        return { ok: false as const, error: "falha_resgate" };
      }
    }

    // Libera o premium (flag lida pelo resto do app).
    await (supabaseAdmin as any)
      .from("patient_profiles")
      .update({ quiz_premium: true })
      .eq("id", u.user.id);

    // Vincula ao médico só se a paciente ainda não tem um (não "rouba" médico).
    const { data: prof } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select("doctor_id")
      .eq("id", u.user.id)
      .maybeSingle();
    if (prof && !prof.doctor_id) {
      await (supabaseAdmin as any)
        .from("patient_profiles")
        .update({ doctor_id: doc.id })
        .eq("id", u.user.id);
    }

    // Registro em subscriptions (origem convite) — não trava se a tabela faltar.
    try {
      await (supabaseAdmin as any).from("subscriptions").upsert(
        {
          user_id: u.user.id,
          product: "quiz_premium",
          plan: "invite",
          source: "doctor_invite",
          status: "active",
          stripe_subscription_id: `invite_${doc.id}_${u.user.id}`,
        },
        { onConflict: "stripe_subscription_id" },
      );
    } catch {
      /* opcional */
    }

    return { ok: true as const };
  });
