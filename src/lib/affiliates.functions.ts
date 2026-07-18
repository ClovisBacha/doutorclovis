/**
 * Afiliados (permuta com influenciadores) — administração, só equipe da
 * instalação (ADMIN_EMAILS).
 *
 * Fluxo do dinheiro: link com ?ref=CODIGO → o código fica no navegador →
 * no checkout do Premium a assinatura é carimbada (metadados Stripe) → cada
 * fatura PAGA credita commission_pct (padrão 50%) em affiliate_earnings
 * (webhook, idempotente por fatura). Aqui a equipe cria códigos e acompanha
 * cadastros e comissões por influenciador.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function requireTeam(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user?.email) return null;
  if (!adminEmails().includes(data.user.email.toLowerCase())) return null;
  return data.user;
}

export type Affiliate = {
  code: string;
  name: string;
  commission_pct: number;
  active: boolean;
  created_at: string;
  /** Pacientes que chegaram por este código (atribuição no checkout). */
  signups: number;
  /** Total de comissão acumulada (centavos). */
  commissionCents: number;
  /** Total faturado pelas assinaturas do código (centavos). */
  revenueCents: number;
};

/** Lista os afiliados com cadastros e comissões consolidadas. */
export const listAffiliates = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const user = await requireTeam(data.accessToken);
    if (!user) return { ok: false as const, affiliates: [] as Affiliate[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: rows, error } = await sb
      .from("affiliates")
      .select("code,name,commission_pct,active,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error?.code === "42P01")
      return { ok: false as const, affiliates: [] as Affiliate[], missingTable: true as const };
    if (error) return { ok: false as const, affiliates: [] as Affiliate[] };

    // Consolida ganhos e cadastros (volume pequeno; simples e correto).
    const { data: earnings } = await sb
      .from("affiliate_earnings")
      .select("affiliate_code,commission_cents,amount_paid_cents")
      .limit(5000);
    const { data: signups } = await sb
      .from("patient_profiles")
      .select("ref_code")
      .not("ref_code", "is", null)
      .limit(10000);

    const byCode = new Map<string, { commission: number; revenue: number; signups: number }>();
    for (const e of (earnings ?? []) as {
      affiliate_code: string;
      commission_cents: number;
      amount_paid_cents: number;
    }[]) {
      const cur = byCode.get(e.affiliate_code) ?? { commission: 0, revenue: 0, signups: 0 };
      cur.commission += e.commission_cents ?? 0;
      cur.revenue += e.amount_paid_cents ?? 0;
      byCode.set(e.affiliate_code, cur);
    }
    for (const s of (signups ?? []) as { ref_code: string }[]) {
      const cur = byCode.get(s.ref_code) ?? { commission: 0, revenue: 0, signups: 0 };
      cur.signups += 1;
      byCode.set(s.ref_code, cur);
    }

    const affiliates: Affiliate[] = ((rows ?? []) as any[]).map((r) => ({
      code: r.code,
      name: r.name,
      commission_pct: r.commission_pct,
      active: r.active,
      created_at: r.created_at,
      signups: byCode.get(r.code)?.signups ?? 0,
      commissionCents: byCode.get(r.code)?.commission ?? 0,
      revenueCents: byCode.get(r.code)?.revenue ?? 0,
    }));
    return { ok: true as const, affiliates };
  });

/** Cria um código de afiliado (ex.: MARIA — vira link ?ref=MARIA). */
export const createAffiliate = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        code: z
          .string()
          .min(3)
          .max(24)
          .regex(/^[a-zA-Z0-9_-]+$/, "só letras, números, - e _"),
        name: z.string().min(2).max(80),
        commissionPct: z.number().int().min(1).max(90).default(50),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireTeam(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("affiliates").insert({
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      commission_pct: data.commissionPct,
    });
    if (error?.code === "23505") return { ok: false as const, reason: "duplicado" as const };
    if (error?.code === "42P01") return { ok: false as const, reason: "migracao" as const };
    return { ok: !error };
  });

/** Ativa/desativa um código (desativado: não atribui nem credita mais). */
export const toggleAffiliate = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({ accessToken: z.string().min(10), code: z.string().min(3), active: z.boolean() })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireTeam(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("affiliates")
      .update({ active: data.active })
      .eq("code", data.code.toUpperCase());
    return { ok: !error };
  });
