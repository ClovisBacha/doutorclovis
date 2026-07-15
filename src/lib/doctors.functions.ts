/**
 * Perfil do médico assinante — server functions.
 *
 * Qualquer usuário autenticado pode se registrar como médico (trial); o gate
 * de cobrança/plano vem na etapa de billing do roadmap (docs/MULTI_TENANT.md).
 * A equipe da instalação (ADMIN_EMAILS) é o superadmin da plataforma.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PLAN_RANK, normalizePlan, entitlementsFor } from "@/lib/entitlements";

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
  bio: string;
  subspecialty: string;
  years_experience: number | null;
  has_masters: boolean;
  has_doctorate: boolean;
  city: string;
  state: string;
  accepting_patients: boolean;
};

/** Colunas do perfil lidas em todas as consultas de médico. */
const DOCTOR_COLS =
  "id,display_name,title,specialty,crm,whatsapp,pix_key,slug,plan,active,bio,subspecialty,years_experience,has_masters,has_doctorate,city,state,accepting_patients";

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

// display_name é obrigatório; os campos do formulário de cadastro têm default
// (o cadastro sempre os envia). Os demais são OPCIONAIS (sem default): quando
// um formulário parcial (ex.: o cadastro básico) NÃO envia esses campos, eles
// ficam AUSENTES no objeto — e assim NÃO sobrescrevem (zeram) o que o médico
// já preencheu em "Meu Perfil". Ver stripUndefined() no upsert/update.
const ProfileSchema = z.object({
  display_name: z.string().min(2),
  title: z.string().default(""),
  specialty: z.string().default(""),
  crm: z.string().default(""),
  whatsapp: z.string().default(""),
  pix_key: z.string().default(""),
  bio: z.string().optional(),
  subspecialty: z.string().optional(),
  years_experience: z.number().int().min(0).max(70).nullable().optional(),
  has_masters: z.boolean().optional(),
  has_doctorate: z.boolean().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  accepting_patients: z.boolean().optional(),
});

/** Remove chaves com valor undefined (não sobrescrevem colunas no upsert/update). */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) (out as any)[k] = v;
  return out;
}

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
      .select(DOCTOR_COLS)
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

    // Médico NOVO começa em trial com prazo de 14 dias (o "grátis por 14
    // dias" prometido). Médico já existente NÃO tem o prazo redefinido aqui
    // (pode ser um assinante pago só atualizando o perfil).
    const trialFields = existing
      ? {}
      : { plan: "trial", plan_expires_at: new Date(Date.now() + 14 * 86400000).toISOString() };

    // Corrida de slug (dois homônimos simultâneos): na violação de UNIQUE,
    // tenta uma vez com sufixo aleatório antes de desistir.
    const doUpsert = (s: string | null) =>
      (supabaseAdmin as any)
        .from("doctors")
        .upsert({
          id: user.id,
          ...stripUndefined(data.profile),
          ...trialFields,
          slug: s,
          updated_at: new Date().toISOString(),
        })
        .select(DOCTOR_COLS)
        .single();

    let { data: row, error } = await doUpsert(slug);
    if (error && error.code === "23505" && slug) {
      ({ data: row, error } = await doUpsert(`${slug}-${Math.random().toString(36).slice(2, 6)}`));
    }
    if (error) {
      console.error("[registerDoctor]", error);
      return { ok: false as const, error: error.message as string };
    }

    // Cadastro NOVO avisa a equipe para fazer a ativação do painel (o gate do
    // painel é operado manualmente enquanto o multi-tenant não chega às
    // consultas). Não bloqueia o fluxo se o e-mail falhar.
    if (!existing) {
      try {
        const { sendEmail, emailLayout } = await import("@/lib/email.server");
        const notify = (process.env.ADMIN_EMAILS || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (notify.length) {
          await sendEmail({
            to: notify,
            replyTo: user.email ?? undefined,
            subject: `🩺 Novo médico cadastrado — ${data.profile.display_name}`,
            html: emailLayout(
              "Novo médico na plataforma",
              `<p style="margin:0 0 6px"><strong>Nome:</strong> ${data.profile.display_name}</p>
               <p style="margin:0 0 6px"><strong>CRM:</strong> ${data.profile.crm}</p>
               <p style="margin:0 0 6px"><strong>WhatsApp:</strong> ${data.profile.whatsapp ?? "—"}</p>
               <p style="margin:0 0 6px"><strong>E-mail:</strong> ${user.email ?? "—"}</p>
               <p style="margin:14px 0 0">O painel dele já está ativo (trial 14 dias) — vale dar as boas-vindas e ajudar no onboarding.</p>`,
            ),
          });
        }
      } catch (e) {
        console.error("[registerDoctor] notify failed", e);
      }
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
      .update({ ...stripUndefined(data.profile), updated_at: new Date().toISOString() })
      .eq("id", user.id);
    return { ok: !error };
  });

/* ══════════════════ Diretório: busca de médico pela paciente ══════════════════ */

export type DirectoryDoctor = {
  id: string;
  display_name: string;
  title: string;
  specialty: string;
  subspecialty: string;
  city: string;
  state: string;
  years_experience: number | null;
  has_masters: boolean;
  has_doctorate: boolean;
  plan: string; // para o selo
  slug: string | null;
  bio: string;
  whatsapp: string;
};

const SearchSchema = z.object({
  q: z.string().default(""),
  state: z.string().default(""),
  city: z.string().default(""),
  minExperience: z.number().int().min(0).max(70).default(0),
  hasMasters: z.boolean().default(false),
  hasDoctorate: z.boolean().default(false),
});

/**
 * Busca pública de médicos. Ranqueia SEMPRE por plano (Elite → Pro → Starter →
 * …) e depois por experiência — os planos melhores aparecem primeiro, como
 * pedido. Filtros são aplicados por cima; nenhum dado sensível (pix) é exposto.
 */
export const searchDoctors = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => SearchSchema.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = (supabaseAdmin as any)
      .from("doctors")
      .select(
        "id,display_name,title,specialty,subspecialty,city,state,years_experience,has_masters,has_doctorate,plan,slug,bio,whatsapp,active,accepting_patients",
      )
      .eq("active", true)
      .eq("accepting_patients", true)
      .eq("verified", true)
      .not("display_name", "is", null);

    if (data.state) query = query.ilike("state", data.state);
    if (data.city) query = query.ilike("city", `%${data.city}%`);
    if (data.hasMasters) query = query.eq("has_masters", true);
    if (data.hasDoctorate) query = query.eq("has_doctorate", true);
    if (data.minExperience > 0) query = query.gte("years_experience", data.minExperience);

    const { data: rows, error } = await query.limit(200);
    if (error) return { ok: false as const, error: error.message, doctors: [] };

    const term = data.q.trim().toLowerCase();
    let list = (rows ?? []) as (DirectoryDoctor & { active: boolean })[];
    // Perfis reais só (com nome) e, se houver texto, casa nome/especialidade/cidade.
    list = list.filter((d) => (d.display_name ?? "").trim().length >= 2);
    if (term) {
      list = list.filter((d) =>
        `${d.display_name} ${d.specialty} ${d.subspecialty} ${d.city} ${d.bio}`
          .toLowerCase()
          .includes(term),
      );
    }
    // Ranking: plano melhor primeiro, depois mais experiência, depois nome.
    list.sort((a, b) => {
      const pr = PLAN_RANK[normalizePlan(b.plan)] - PLAN_RANK[normalizePlan(a.plan)];
      if (pr !== 0) return pr;
      const ex = (b.years_experience ?? 0) - (a.years_experience ?? 0);
      if (ex !== 0) return ex;
      return (a.display_name ?? "").localeCompare(b.display_name ?? "");
    });

    const doctors: DirectoryDoctor[] = list.map((d) => ({
      id: d.id,
      display_name: d.display_name,
      title: d.title ?? "",
      specialty: d.specialty ?? "",
      subspecialty: d.subspecialty ?? "",
      city: d.city ?? "",
      state: d.state ?? "",
      years_experience: d.years_experience ?? null,
      has_masters: !!d.has_masters,
      has_doctorate: !!d.has_doctorate,
      plan: d.plan ?? "free",
      slug: d.slug ?? null,
      bio: d.bio ?? "",
      whatsapp: d.whatsapp ?? "",
    }));
    return { ok: true as const, doctors };
  });

/** A paciente escolhe um médico do diretório → vira paciente dele. */
export const chooseDoctor = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), doctorId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    if (!user) return { ok: false as const, error: "nao_autenticado" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: doc } = await (supabaseAdmin as any)
      .from("doctors")
      .select("id,active,accepting_patients,verified,plan,plan_expires_at")
      .eq("id", data.doctorId)
      .maybeSingle();
    // Defense-in-depth: além de ativo e aceitando pacientes, o médico precisa
    // estar VERIFICADO — igual à busca. Impede vínculo direto a um id de médico
    // não verificado (que a vitrine e a busca já escondem).
    if (!doc || !doc.active || !doc.accepting_patients || !doc.verified) {
      return { ok: false as const, error: "indisponivel" };
    }

    // Plano EFETIVO (trial vencido conta como free) para o limite bater com os
    // demais gates — senão um trial expirado teria pacientes ilimitados.
    const effectivePlan =
      doc.plan === "trial" &&
      doc.plan_expires_at &&
      new Date(doc.plan_expires_at).getTime() < Date.now()
        ? "free"
        : doc.plan;

    // Limite de pacientes do plano (free = 5): não deixa passar do teto.
    const limit = entitlementsFor(effectivePlan).maxPatients;
    if (limit != null) {
      const { count } = await (supabaseAdmin as any)
        .from("patient_profiles")
        .select("id", { count: "exact", head: true })
        .eq("doctor_id", data.doctorId);
      if ((count ?? 0) >= limit) {
        return { ok: false as const, error: "medico_lotado" };
      }
    }
    // Garante que a paciente tem perfil (linha em patient_profiles): faz o
    // upsert por id (PK = uid), assim o vínculo grava mesmo se a linha ainda
    // não existir, e confirmamos que uma linha foi de fato afetada.
    const { data: updated, error } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .upsert({ id: user.id, doctor_id: data.doctorId }, { onConflict: "id" })
      .select("id");
    if (error) return { ok: false as const, error: error.message };
    if (!updated || updated.length === 0) {
      return { ok: false as const, error: "vinculo_falhou" };
    }
    return { ok: true as const };
  });
