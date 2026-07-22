/**
 * Convites premium — o médico Elite/Black gera um código NA HORA e envia como
 * quiser. Cada código é de USO ÚNICO; a paciente digita e ganha o premium.
 *
 *   - getMyInviteInfo: (médico) elegibilidade + cota do mês (gerados/limite).
 *   - generateInviteCode: (médico) cria um código novo e único na hora.
 *   - redeemInviteCode: (paciente) resgata um código válido não usado.
 *
 * A cota mensal conta os códigos GERADOS no mês (Elite 25, Black 250). Tudo
 * escrito via service_role; a UI nunca concede acesso.
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

async function loadDoctor(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: u } = await supabaseAdmin.auth.getUser(accessToken);
  if (!u.user) return { supabaseAdmin, user: null, doc: null as any };
  const { data: doc } = await (supabaseAdmin as any)
    .from("doctors")
    .select("id,plan,active")
    .eq("id", u.user.id)
    .maybeSingle();
  return { supabaseAdmin, user: u.user, doc };
}

async function monthlyUsed(supabaseAdmin: any, doctorId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("invite_codes")
    .select("id", { count: "exact", head: true })
    .eq("doctor_id", doctorId)
    .gte("created_at", monthStartISO());
  return count ?? 0;
}

export type InviteInfo = {
  eligible: boolean; // o plano do médico dá convites?
  limit: number;
  used: number;
  remaining: number;
};

export const getMyInviteInfo = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }): Promise<{ ok: false } | ({ ok: true } & InviteInfo)> => {
    const { supabaseAdmin, doc } = await loadDoctor(data.accessToken);
    if (!doc) return { ok: false as const };
    const limit = doc.active ? entitlementsFor(doc.plan).premiumInvitesPerMonth : 0;
    if (limit <= 0) return { ok: true as const, eligible: false, limit: 0, used: 0, remaining: 0 };
    const used = await monthlyUsed(supabaseAdmin, doc.id);
    return {
      ok: true as const,
      eligible: true,
      limit,
      used,
      remaining: Math.max(0, limit - used),
    };
  });

export const generateInviteCode = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin, doc } = await loadDoctor(data.accessToken);
    if (!doc) return { ok: false as const, error: "sem_perfil" };
    const limit = doc.active ? entitlementsFor(doc.plan).premiumInvitesPerMonth : 0;
    if (limit <= 0) return { ok: false as const, error: "sem_convites" };

    const used = await monthlyUsed(supabaseAdmin, doc.id);
    if (used >= limit) return { ok: false as const, error: "cota_esgotada" };

    // Gera um código único (retenta em colisão de UNIQUE).
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = genCode();
      const { error } = await (supabaseAdmin as any)
        .from("invite_codes")
        .insert({ code, doctor_id: doc.id });
      if (!error) {
        return { ok: true as const, code, used: used + 1, limit, remaining: limit - used - 1 };
      }
      if (error.code !== "23505") return { ok: false as const, error: "falha_geracao" };
    }
    return { ok: false as const, error: "falha_geracao" };
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

    // 1) Cupom de PLATAFORMA (gerado pelo super-admin) tem prioridade. Pode
    //    ter vários usos; 1 resgate por usuário (idempotente). Tabela ausente
    //    (migração pendente) → cai para o convite do médico abaixo.
    try {
      const sb = supabaseAdmin as any;
      const { data: pc } = await sb
        .from("platform_coupons")
        .select("id,active,max_redemptions")
        .eq("code", code)
        .maybeSingle();
      if (pc) {
        if (!pc.active) return { ok: false as const, error: "codigo_invalido" };
        const { data: mine } = await sb
          .from("platform_coupon_redemptions")
          .select("user_id")
          .eq("coupon_id", pc.id)
          .eq("user_id", u.user.id)
          .maybeSingle();
        if (!mine) {
          // Insere PRIMEIRO (a PK torna a contagem pós-insert autoritativa) e,
          // se ultrapassou o teto, reverte o próprio resgate — fecha a janela
          // TOCTOU em que dois usuários simultâneos furariam max_redemptions.
          const ins = await sb
            .from("platform_coupon_redemptions")
            .insert({ coupon_id: pc.id, user_id: u.user.id });
          if (ins.error && ins.error.code !== "23505")
            return { ok: false as const, error: "codigo_usado" };
          if (pc.max_redemptions != null) {
            const { count } = await sb
              .from("platform_coupon_redemptions")
              .select("user_id", { count: "exact", head: true })
              .eq("coupon_id", pc.id);
            if ((count ?? 0) > pc.max_redemptions) {
              await sb
                .from("platform_coupon_redemptions")
                .delete()
                .eq("coupon_id", pc.id)
                .eq("user_id", u.user.id);
              return { ok: false as const, error: "codigo_usado" };
            }
          }
        }
        await sb.from("patient_profiles").update({ quiz_premium: true }).eq("id", u.user.id);
        // Origem 'cupom' → o premium sobrevive ao toggle manual (mesma
        // proteção de stripe/doctor_invite/convite).
        try {
          await sb.from("subscriptions").upsert(
            {
              user_id: u.user.id,
              product: "quiz_premium",
              plan: "cupom",
              source: "cupom",
              status: "active",
              stripe_subscription_id: `cupom_${pc.id}_${u.user.id}`,
            },
            { onConflict: "stripe_subscription_id" },
          );
        } catch {
          /* opcional */
        }
        return { ok: true as const };
      }
    } catch {
      /* tabela ausente → segue para o convite do médico */
    }

    // 2) Convite do MÉDICO (invite_codes) — uso único, vincula ao médico.
    const { data: row } = await (supabaseAdmin as any)
      .from("invite_codes")
      .select("id,doctor_id,redeemed_by")
      .eq("code", code)
      .maybeSingle();
    if (!row) return { ok: false as const, error: "codigo_invalido" };

    // Já usado por OUTRA paciente? Uso único.
    if (row.redeemed_by && row.redeemed_by !== u.user.id) {
      return { ok: false as const, error: "codigo_usado" };
    }

    // Marca como resgatado (idempotente para a mesma paciente). A condição
    // redeemed_by IS NULL evita corrida: só a 1ª resgata.
    if (!row.redeemed_by) {
      const { data: upd } = await (supabaseAdmin as any)
        .from("invite_codes")
        .update({ redeemed_by: u.user.id, redeemed_at: new Date().toISOString() })
        .eq("id", row.id)
        .is("redeemed_by", null)
        .select("id");
      if (!upd || upd.length === 0) {
        // Alguém resgatou no meio-tempo.
        return { ok: false as const, error: "codigo_usado" };
      }
    }

    // Libera o premium.
    await (supabaseAdmin as any)
      .from("patient_profiles")
      .update({ quiz_premium: true })
      .eq("id", u.user.id);

    // Vincula ao médico só se a paciente ainda não tem um (não "rouba").
    const { data: prof } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select("doctor_id")
      .eq("id", u.user.id)
      .maybeSingle();
    if (prof && !prof.doctor_id) {
      await (supabaseAdmin as any)
        .from("patient_profiles")
        .update({ doctor_id: row.doctor_id })
        .eq("id", u.user.id);
    }

    // Registro em subscriptions (origem convite) — não trava se faltar a tabela.
    try {
      await (supabaseAdmin as any).from("subscriptions").upsert(
        {
          user_id: u.user.id,
          product: "quiz_premium",
          plan: "invite",
          source: "doctor_invite",
          status: "active",
          stripe_subscription_id: `invite_${row.id}`,
        },
        { onConflict: "stripe_subscription_id" },
      );
    } catch {
      /* opcional */
    }

    return { ok: true as const };
  });
