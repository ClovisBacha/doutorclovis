/**
 * Perfil do médico assinante — server functions.
 *
 * Qualquer usuário autenticado pode se registrar como médico (trial); o gate
 * de cobrança/plano vem na etapa de billing do roadmap (docs/MULTI_TENANT.md).
 * A equipe da instalação (ADMIN_EMAILS) é o superadmin da plataforma.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type DoctorProfile = {
  id: string;
  display_name: string;
  title: string;
  specialty: string;
  crm: string;
  whatsapp: string;
  pix_key: string;
  slug: string | null;
  plan: string;
  active: boolean;
};

function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function requireUser(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user;
}

/** Slug de URL a partir do nome: "Dra. Ana Souza" → "ana-souza". */
function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^dr[a]?\.?\s+/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

const ProfileSchema = z.object({
  display_name: z.string().min(2),
  title: z.string().default(""),
  specialty: z.string().default(""),
  crm: z.string().default(""),
  whatsapp: z.string().default(""),
  pix_key: z.string().default(""),
});

const TokenSchema = z.object({ accessToken: z.string().min(10) });

/** Perfil do médico do usuário logado (+ se é da equipe da plataforma). */
export const getMyDoctor = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    if (!user) return { ok: false as const, doctor: null, isPlatformAdmin: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await (supabaseAdmin as any)
      .from("doctors")
      .select("id,display_name,title,specialty,crm,whatsapp,pix_key,slug,plan,active")
      .eq("id", user.id)
      .maybeSingle();

    const isPlatformAdmin = !!user.email && adminEmails().includes(user.email.toLowerCase());

    // Entitlements resolvidos do plano — a UI usa para liberar/bloquear
    // recursos (IA no app, IA no WhatsApp, limite de pacientes, equipe).
    const { getEntitlements } = await import("./entitlements.server");
    const entitlements = await getEntitlements(user);

    return {
      ok: true as const,
      doctor: (row ?? null) as DoctorProfile | null,
      isPlatformAdmin,
      entitlements,
    };
  });

/** Cria (ou completa) o perfil de médico do usuário logado — plano trial. */
export const registerDoctor = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), profile: ProfileSchema }).parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    if (!user) return { ok: false as const, error: "Sessão inválida — entre novamente." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Idempotente: se já existe, vira update do próprio perfil
    const { data: existing } = await (supabaseAdmin as any)
      .from("doctors")
      .select("id,slug")
      .eq("id", user.id)
      .maybeSingle();

    // Slug único: tenta o base; em conflito, sufixa -2, -3...
    let slug: string | null = existing?.slug ?? null;
    if (!slug) {
      const base = slugify(data.profile.display_name) || null;
      if (base) {
        for (let n = 0; n < 5; n++) {
          const candidate = n === 0 ? base : `${base}-${n + 1}`;
          const { data: taken } = await (supabaseAdmin as any)
            .from("doctors")
            .select("id")
            .eq("slug", candidate)
            .maybeSingle();
          if (!taken) {
            slug = candidate;
            break;
          }
        }
      }
    }

    // Corrida de slug (dois homônimos simultâneos): na violação de UNIQUE,
    // tenta uma vez com sufixo aleatório antes de desistir.
    const doUpsert = (s: string | null) =>
      (supabaseAdmin as any)
        .from("doctors")
        .upsert({
          id: user.id,
          ...data.profile,
          slug: s,
          updated_at: new Date().toISOString(),
        })
        .select("id,display_name,title,specialty,crm,whatsapp,pix_key,slug,plan,active")
        .single();

    let { data: row, error } = await doUpsert(slug);
    if (error && error.code === "23505" && slug) {
      ({ data: row, error } = await doUpsert(`${slug}-${Math.random().toString(36).slice(2, 6)}`));
    }
    if (error) {
      console.error("[registerDoctor]", error);
      return { ok: false as const, error: error.message as string };
    }
    return { ok: true as const, doctor: row as DoctorProfile };
  });

/** Atualiza o perfil de médico do usuário logado. */
export const updateMyDoctor = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), profile: ProfileSchema }).parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await (supabaseAdmin as any)
      .from("doctors")
      .update({ ...data.profile, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    return { ok: !error };
  });
