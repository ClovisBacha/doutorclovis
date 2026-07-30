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
  /* Perfil rico — o que as pacientes mais querem saber (migração
     20260717030000; opcionais para tolerar banco ainda não migrado). */
  instagram?: string | null;
  rqe?: string | null;
  education?: string | null;
  hospitals?: string | null;
  insurances?: string | null;
  languages?: string | null;
  approach?: string | null;
  consultation_price_brl?: number | null;
  offers_telehealth?: boolean | null;
  personal_phone?: string | null;
  accepts_insurance?: boolean | null;
  accepts_private?: boolean | null;
  plan_expires_at?: string | null;
  verified?: boolean | null;
};

/** Colunas do perfil lidas em todas as consultas de médico. */
const RICH_COLS =
  "instagram,rqe,education,hospitals,insurances,languages,approach,consultation_price_brl,offers_telehealth,personal_phone,accepts_insurance,accepts_private";
const BASE_COLS =
  "id,display_name,title,specialty,crm,whatsapp,pix_key,slug,plan,plan_expires_at,verified,active,bio,subspecialty,years_experience,has_masters,has_doctorate,city,state,accepting_patients";
const DOCTOR_COLS = `${BASE_COLS},${RICH_COLS}`;

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
  // Perfil rico (tudo opcional — o stripUndefined não sobrescreve ausentes)
  instagram: z.string().max(200).optional(),
  rqe: z.string().max(60).optional(),
  education: z.string().max(2000).optional(),
  hospitals: z.string().max(1000).optional(),
  insurances: z.string().max(1000).optional(),
  languages: z.string().max(200).optional(),
  approach: z.string().max(1500).optional(),
  consultation_price_brl: z.number().int().min(0).max(100000).nullable().optional(),
  offers_telehealth: z.boolean().optional(),
  /* Telefone PESSOAL — nunca mostrado à paciente. Existe porque `whatsapp` é
     o número DAS PACIENTES (o que o SOS disca), e um médico tem dois. Sem a
     separação, ou ele expõe o pessoal ou a emergência fica sem destino. */
  personal_phone: z.string().max(40).optional(),
  /* Convênio e particular são independentes: há quem faça os dois. Dois
     booleanos dizem isso sem ambiguidade — uma lista de convênios em branco
     antes podia significar "só particular" OU "ainda não preencheu". */
  accepts_insurance: z.boolean().optional(),
  accepts_private: z.boolean().optional(),
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

    const first = await (supabaseAdmin as any)
      .from("doctors")
      .select(DOCTOR_COLS)
      .eq("id", user.id)
      .maybeSingle();
    let row = first.data;
    if (first.error?.code === "42703") {
      // Colunas do perfil rico ainda não migradas: segue com as básicas.
      const fb = await (supabaseAdmin as any)
        .from("doctors")
        .select(BASE_COLS)
        .eq("id", user.id)
        .maybeSingle();
      row = fb.data;
    }

    const isPlatformAdmin = !!user.email && adminEmails().includes(user.email.toLowerCase());

    // Entitlements resolvidos do plano — a UI usa para liberar/bloquear
    // recursos (IA no app, IA no WhatsApp, limite de pacientes, equipe).
    const { getEntitlements } = await import("./entitlements.server");
    const entitlements = await getEntitlements(user);

    /* Quantas pacientes ele JÁ TEM. Sem este número o painel mostrava o plano
       e escondia o consumo: o médico no Free descobria o teto de 5 como um
       erro ao tentar aceitar a sexta. Um limite que só aparece quando é
       atingido é indistinguível de um bug. */
    let patientCount = 0;
    try {
      const { count } = await (supabaseAdmin as any)
        .from("patient_profiles")
        .select("id", { count: "exact", head: true })
        .eq("doctor_id", user.id);
      patientCount = count ?? 0;
    } catch {
      /* contagem é informativa — não derruba o perfil */
    }

    return {
      ok: true as const,
      doctor: (row ?? null) as DoctorProfile | null,
      isPlatformAdmin,
      entitlements,
      patientCount,
    };
  });

/** Contagem de indicações do médico logado (para o card "Indique um colega"). */
export const getMyReferrals = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    if (!user) return { ok: false as const, invited: 0, rewarded: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await (supabaseAdmin as any)
      .from("doctors")
      .select("referral_rewarded")
      .eq("referred_by", user.id);
    const list = (rows ?? []) as { referral_rewarded: boolean | null }[];
    return {
      ok: true as const,
      invited: list.length,
      rewarded: list.filter((r) => r.referral_rewarded).length,
    };
  });

/** Cria (ou completa) o perfil de médico do usuário logado — plano trial. */
export const registerDoctor = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        profile: ProfileSchema,
        ref: z.string().uuid().optional(), // indicação: doctor_id de quem indicou
        // convite de PACIENTE (código): dá +15% no checkout e Premium a ela
        patientInvite: z.string().max(16).optional(),
      })
      .parse(i),
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

    // Indicação (só no cadastro NOVO): o `ref` precisa ser um médico REAL e
    // diferente do próprio (sem auto-indicação). Best-effort — não bloqueia.
    let referredBy: string | null = null;
    if (!existing && data.ref && data.ref !== user.id) {
      const { data: refDoc } = await (supabaseAdmin as any)
        .from("doctors")
        .select("id")
        .eq("id", data.ref)
        .maybeSingle();
      if (refDoc?.id) referredBy = refDoc.id as string;
    }

    // Convite de PACIENTE (só cadastro novo): resolve o código → id dela.
    // O médico ganha +15% em qualquer plano (aplicado no checkout) e, quando
    // assinar, ela ganha o Premium (webhook). Sem auto-convite.
    let invitedByPatient: string | null = null;
    if (!existing && data.patientInvite) {
      const { resolvePatientInviteCode } = await import("./patientlink.functions");
      const pid = await resolvePatientInviteCode(data.patientInvite);
      if (pid && pid !== user.id) invitedByPatient = pid;
    }

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
      : {
          plan: "trial",
          plan_expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
          ...(referredBy ? { referred_by: referredBy } : {}),
          ...(invitedByPatient ? { invited_by_patient: invitedByPatient } : {}),
        };

    // Corrida de slug (dois homônimos simultâneos): na violação de UNIQUE,
    // tenta uma vez com sufixo aleatório antes de desistir.
    const RICH_KEYS = [
      "instagram",
      "rqe",
      "education",
      "hospitals",
      "insurances",
      "languages",
      "approach",
      "consultation_price_brl",
      "offers_telehealth",
      "personal_phone",
      "accepts_insurance",
      "accepts_private",
    ] as const;
    const doUpsert = (s: string | null, richOk: boolean) => {
      const profile = stripUndefined(data.profile) as Record<string, unknown>;
      if (!richOk) for (const k of RICH_KEYS) delete profile[k];
      return (supabaseAdmin as any)
        .from("doctors")
        .upsert({
          id: user.id,
          ...profile,
          ...trialFields,
          slug: s,
          updated_at: new Date().toISOString(),
        })
        .select(richOk ? DOCTOR_COLS : BASE_COLS)
        .single();
    };

    let { data: row, error } = await doUpsert(slug, true);
    if (error && error.code === "42703") {
      // Colunas do perfil rico ainda não migradas: salva o básico mesmo assim.
      ({ data: row, error } = await doUpsert(slug, false));
    }
    if (error && error.code === "23505" && slug) {
      ({ data: row, error } = await doUpsert(
        `${slug}-${Math.random().toString(36).slice(2, 6)}`,
        true,
      ));
      if (error && error.code === "42703") {
        ({ data: row, error } = await doUpsert(
          `${slug}-${Math.random().toString(36).slice(2, 6)}`,
          false,
        ));
      }
    }
    if (error) {
      console.error("[registerDoctor]", error);
      return { ok: false as const, error: error.message as string };
    }

    // Cadastro NOVO: instala o kit de partida do Segundo Cérebro como RASCUNHO
    // (approved=false — a IA só usa depois que o médico revisar e aprovar).
    // Mata o cold start: no dia 1 ele já tem ~30 dúvidas clássicas para editar
    // no próprio estilo em vez de uma tela vazia. Fire-and-forget.
    if (!existing) {
      void (async () => {
        try {
          // Idempotência sob duplo-submit/retry do cadastro: dois
          // registerDoctor concorrentes leem `existing=null` ao mesmo tempo —
          // sem esta checagem, o kit seria semeado em dobro (60 rascunhos).
          const { data: kitRows } = await (supabaseAdmin as any)
            .from("brain_entries")
            .select("id")
            .eq("doctor_id", user.id)
            .eq("source", "kit")
            .limit(1);
          if ((kitRows ?? []).length > 0) return;
          const { BRAIN_STARTER_PACK } = await import("./brain-starter-pack");
          await (supabaseAdmin as any).from("brain_entries").insert(
            BRAIN_STARTER_PACK.map((e) => ({
              doctor_id: user.id,
              question: e.question,
              answer: e.answer,
              source: "kit",
              approved: false,
            })),
          );
        } catch (e) {
          console.error("[registerDoctor] starter pack seed failed", e);
        }
      })();
    }

    // Cadastro NOVO: o painel já nasce ativo (doctors.active default true), então
    // isto é só um AVISO à equipe para dar as boas-vindas/ajudar no onboarding —
    // não há ativação manual. Não bloqueia o fluxo se o e-mail falhar.
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

    /* Mesmo escudo que o `registerDoctor` tem e que aqui faltava: num banco
       onde as colunas do perfil rico ainda não foram migradas, o update
       inteiro falhava e o médico perdia tudo o que digitou sem entender por
       quê. Se o Postgres reclamar de coluna inexistente (42703), grava o
       básico — o trabalho dele não se perde. */
    const RICH_UPDATE_KEYS = [
      "instagram",
      "rqe",
      "education",
      "hospitals",
      "insurances",
      "languages",
      "approach",
      "consultation_price_brl",
      "offers_telehealth",
      "personal_phone",
      "accepts_insurance",
      "accepts_private",
    ] as const;
    const doUpdate = (richOk: boolean) => {
      const profile = stripUndefined(data.profile) as Record<string, unknown>;
      if (!richOk) for (const k of RICH_UPDATE_KEYS) delete profile[k];
      return (supabaseAdmin as any)
        .from("doctors")
        .update({ ...profile, updated_at: new Date().toISOString() })
        .eq("id", user.id);
    };
    let { error } = await doUpdate(true);
    if (error && error.code === "42703") ({ error } = await doUpdate(false));
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
  /* Perfil rico (opcionais até a migração rodar) */
  instagram?: string | null;
  rqe?: string | null;
  education?: string | null;
  hospitals?: string | null;
  insurances?: string | null;
  languages?: string | null;
  approach?: string | null;
  consultation_price_brl?: number | null;
  offers_telehealth?: boolean | null;
  /** Preenchido pela busca com IA: por que este médico deu match. */
  matchReasons?: string[];
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
    const DIR_BASE =
      "id,display_name,title,specialty,subspecialty,city,state,years_experience,has_masters,has_doctorate,plan,plan_expires_at,slug,bio,whatsapp,active,accepting_patients,verified";
    const buildQuery = (cols: string) => {
      let q = (supabaseAdmin as any)
        .from("doctors")
        .select(cols)
        /* `verified` NÃO filtra mais — ele ordena.
           
           Antes um médico recém-cadastrado ficava invisível para toda paciente
           até um super-admin apertar um botão que ninguém avisava que existia:
           ele esperava pacientes que não tinham como chegar nele, e a paciente
           procurava e não achava ninguém. O selo continua valendo — quem o tem
           aparece antes, dentro da mesma faixa de plano — mas deixar de ter o
           selo passou a ser uma posição na lista, não a inexistência. */
        .eq("active", true)
        .eq("accepting_patients", true)
        .not("display_name", "is", null);
      /* O texto passa a filtrar NO BANCO.
         
         Antes o `limit(200)` cortava a lista antes de qualquer busca por nome,
         e a filtragem acontecia em JavaScript sobre esse pedaço. Com mais de
         200 médicos cadastrados, procurar "Marina" podia não achar a Marina —
         ela simplesmente não estava nas 200 linhas que o Postgres devolveu, e
         em ordem nenhuma, porque também não havia `ORDER BY`. */
      const termo = data.q.trim();
      if (termo) {
        const like = `%${termo.replace(/[%_]/g, "")}%`;
        q = q.or(
          [
            `display_name.ilike.${like}`,
            `specialty.ilike.${like}`,
            `subspecialty.ilike.${like}`,
            `city.ilike.${like}`,
          ].join(","),
        );
      }
      if (data.state) q = q.ilike("state", data.state);
      if (data.city) q = q.ilike("city", `%${data.city}%`);
      if (data.hasMasters) q = q.eq("has_masters", true);
      if (data.hasDoctorate) q = q.eq("has_doctorate", true);
      if (data.minExperience > 0) q = q.gte("years_experience", data.minExperience);
      /* Ordem estável no SQL para o recorte ser sempre o mesmo conjunto; o
         ranking por plano continua no JS, sobre a lista já filtrada. */
      return q.order("display_name", { ascending: true }).limit(200);
    };

    let { data: rows, error } = await buildQuery(`${DIR_BASE},${RICH_COLS}`);
    if (error?.code === "42703") {
      // Perfil rico ainda não migrado: busca com as colunas básicas.
      ({ data: rows, error } = await buildQuery(DIR_BASE));
    }
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
    /* Plano VENCIDO não ranqueia como plano pago.
       
       `entitlements.server` derruba o trial vencido, mas a lista usava a coluna
       crua: um Elite cujo cartão falhou continuava no topo de toda busca
       indefinidamente, na frente de quem está pagando. Aqui a data manda. */
    const planoValido = (d: { plan: string; plan_expires_at?: string | null }) => {
      const venc = d.plan_expires_at ? new Date(d.plan_expires_at).getTime() : null;
      if (venc != null && venc < Date.now()) return "free";
      return d.plan;
    };
    list.sort((a, b) => {
      const pr =
        PLAN_RANK[normalizePlan(planoValido(b))] - PLAN_RANK[normalizePlan(planoValido(a))];
      if (pr !== 0) return pr;
      /* O selo desempata DENTRO da faixa de plano. Ele deixou de ser filtro
         (um médico novo era invisível) e virou posição: quem foi conferido
         aparece antes de quem ainda não foi, sem que o não-conferido deixe de
         existir para a paciente. */
      const vf =
        Number(!!(b as { verified?: boolean }).verified) -
        Number(!!(a as { verified?: boolean }).verified);
      if (vf !== 0) return vf;
      const ex = (b.years_experience ?? 0) - (a.years_experience ?? 0);
      if (ex !== 0) return ex;
      return (a.display_name ?? "").localeCompare(b.display_name ?? "");
    });

    const doctors: DirectoryDoctor[] = list.map((d) => toDirectoryDoctor(d));
    return { ok: true as const, doctors };
  });

/** Normaliza uma linha crua de doctors para o card público do diretório. */
function toDirectoryDoctor(d: any): DirectoryDoctor {
  return {
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
    instagram: d.instagram ?? null,
    rqe: d.rqe ?? null,
    education: d.education ?? null,
    hospitals: d.hospitals ?? null,
    insurances: d.insurances ?? null,
    languages: d.languages ?? null,
    approach: d.approach ?? null,
    consultation_price_brl: d.consultation_price_brl ?? null,
    offers_telehealth: d.offers_telehealth ?? null,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   Busca com IA: a paciente descreve em linguagem natural ("obstetra de BH
   especialista em alto risco com mestrado e doutorado") e a IA extrai os
   critérios; o ranking pontua cada médico e explica o porquê do match.
   Fallback determinístico por palavras-chave quando a IA está indisponível
   — a busca NUNCA quebra.
   ══════════════════════════════════════════════════════════════════════ */

type ParsedCriteria = {
  city?: string;
  state?: string;
  keywords: string[];
  wantsMasters?: boolean;
  wantsDoctorate?: boolean;
  minExperience?: number;
  wantsTelehealth?: boolean;
  insurance?: string;
};

const UF_LIST =
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");

/** Fallback sem IA: heurística de palavras-chave sobre o texto da paciente. */
function heuristicParse(q: string): ParsedCriteria {
  const lower = q.toLowerCase();
  const crit: ParsedCriteria = { keywords: [] };
  // Cidades comuns por apelido + UF explícita
  if (/\bbh\b|belo horizonte/.test(lower)) crit.city = "Belo Horizonte";
  if (/\bsp\b|são paulo|sao paulo/.test(lower)) crit.city = "São Paulo";
  if (/\brj\b|rio de janeiro/.test(lower)) crit.city = "Rio de Janeiro";
  for (const uf of UF_LIST) {
    if (new RegExp(`\\b${uf.toLowerCase()}\\b`).test(lower)) crit.state = uf;
  }
  if (/mestrado|mestre/.test(lower)) crit.wantsMasters = true;
  if (/doutorado|doutora?\b.*(titulo|título)|phd/.test(lower)) crit.wantsDoctorate = true;
  if (/teleconsulta|online|a distância|a distancia|remoto/.test(lower)) crit.wantsTelehealth = true;
  const exp = lower.match(/(\d{1,2})\s*(\+|anos)/);
  if (exp) crit.minExperience = Number(exp[1]);
  for (const kw of [
    "alto risco",
    "gestação de alto risco",
    "medicina fetal",
    "ultrassom",
    "ultrassonografia",
    "parto normal",
    "parto humanizado",
    "cesárea",
    "cesariana",
    "endometriose",
    "fertilidade",
    "reprodução",
    "gemelar",
    "diabetes",
    "pré-eclâmpsia",
    "pos-parto",
    "pós-parto",
  ]) {
    if (lower.includes(kw)) crit.keywords.push(kw);
  }
  return crit;
}

/** Tenta extrair critérios com o Gemini; falhou → heurística. */
async function parseCriteria(q: string): Promise<ParsedCriteria> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return heuristicParse(q);
  try {
    const { generateText } = await import("ai");
    const { createChatProvider, DEFAULT_CHAT_MODEL } = await import("./ai-gateway.server");
    const google = createChatProvider(apiKey);
    const result = await generateText({
      model: google(process.env.CHAT_MODEL ?? DEFAULT_CHAT_MODEL),
      system:
        `Você extrai critérios de busca de médicos obstetras a partir do texto de uma paciente brasileira. ` +
        `Responda APENAS um JSON válido, sem markdown, no formato: ` +
        `{"city":string|null,"state":string|null (sigla UF),"keywords":string[] (especialidades/temas, ex "alto risco","medicina fetal","parto humanizado"),` +
        `"wantsMasters":boolean,"wantsDoctorate":boolean,"minExperience":number|null,"wantsTelehealth":boolean,"insurance":string|null (nome do convênio se citado)}. ` +
        `"BH"=Belo Horizonte/MG. Não invente critérios que a paciente não pediu.`,
      prompt: q,
      maxOutputTokens: 300,
    });
    const raw = result.text.trim().replace(/^```json?\s*|\s*```$/g, "");
    const p = JSON.parse(raw) as Record<string, unknown>;
    return {
      city: typeof p.city === "string" && p.city ? p.city : undefined,
      state: typeof p.state === "string" && p.state ? p.state.toUpperCase() : undefined,
      keywords: Array.isArray(p.keywords) ? p.keywords.filter((k) => typeof k === "string") : [],
      wantsMasters: p.wantsMasters === true,
      wantsDoctorate: p.wantsDoctorate === true,
      minExperience: typeof p.minExperience === "number" ? p.minExperience : undefined,
      wantsTelehealth: p.wantsTelehealth === true,
      insurance: typeof p.insurance === "string" && p.insurance ? p.insurance : undefined,
    };
  } catch (e) {
    console.error("[aiSearchDoctors] parse via IA falhou, usando heurística", e);
    return heuristicParse(q);
  }
}

export const aiSearchDoctors = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ prompt: z.string().min(3).max(500) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const DIR_BASE =
      "id,display_name,title,specialty,subspecialty,city,state,years_experience,has_masters,has_doctorate,plan,slug,bio,whatsapp";
    let { data: rows, error } = await (supabaseAdmin as any)
      .from("doctors")
      .select(`${DIR_BASE},${RICH_COLS}`)
      .eq("active", true)
      .eq("accepting_patients", true)
      /* Sem filtro de selo, igual ao diretório: ele pesa no score abaixo. */
      .not("display_name", "is", null)
      .limit(300);
    if (error?.code === "42703") {
      ({ data: rows, error } = await (supabaseAdmin as any)
        .from("doctors")
        .select(DIR_BASE)
        .eq("active", true)
        .eq("accepting_patients", true)
        /* Sem filtro de selo, igual ao diretório: ele pesa no score abaixo. */
        .not("display_name", "is", null)
        .limit(300));
    }
    if (error) return { ok: false as const, doctors: [] as DirectoryDoctor[], criteria: null };

    const crit = await parseCriteria(data.prompt);
    const norm = (s: unknown) =>
      String(s ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");

    const scored = ((rows ?? []) as any[])
      .filter((d) => (d.display_name ?? "").trim().length >= 2)
      .map((d) => {
        let score = 0;
        const reasons: string[] = [];
        const haystack = norm(
          `${d.specialty} ${d.subspecialty} ${d.bio} ${d.education} ${d.approach} ${d.hospitals}`,
        );
        if (crit.city && norm(d.city).includes(norm(crit.city))) {
          score += 30;
          reasons.push(`📍 ${d.city}`);
        }
        if (crit.state && norm(d.state) === norm(crit.state)) {
          score += 10;
          if (!crit.city) reasons.push(`📍 ${d.state}`);
        }
        for (const kw of crit.keywords) {
          if (haystack.includes(norm(kw))) {
            score += 20;
            reasons.push(`✓ ${kw}`);
          }
        }
        if (crit.wantsMasters && d.has_masters) {
          score += 15;
          reasons.push("🎓 mestrado");
        }
        if (crit.wantsDoctorate && d.has_doctorate) {
          score += 15;
          reasons.push("🎓 doutorado");
        }
        if (crit.minExperience && (d.years_experience ?? 0) >= crit.minExperience) {
          score += 10;
          reasons.push(`⏱ ${d.years_experience}+ anos`);
        }
        if (crit.wantsTelehealth && d.offers_telehealth) {
          score += 10;
          reasons.push("💻 teleconsulta");
        }
        if (crit.insurance && norm(d.insurances).includes(norm(crit.insurance))) {
          score += 20;
          reasons.push(`🏥 ${crit.insurance}`);
        }
        // Desempate leve por plano/selo/experiência (mesma lógica do diretório)
        score += PLAN_RANK[normalizePlan(d.plan)] ?? 0;
        score += (d as { verified?: boolean }).verified ? 3 : 0;
        score += Math.min(5, (d.years_experience ?? 0) / 10);
        return { d, score, reasons };
      })
      .filter((x) => x.score > 0 || crit.keywords.length === 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    const doctors: DirectoryDoctor[] = scored.map((x) => ({
      ...toDirectoryDoctor(x.d),
      matchReasons: x.reasons,
    }));
    return { ok: true as const, doctors, criteria: crit };
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
    /* O selo saiu da condição: exigir selo aqui fazia a paciente encontrar o
       médico na busca (agora ele aparece) e levar "indisponível" ao tocar —
       o pior dos dois mundos. Quem está ativo e aceitando pacientes pode ser
       escolhido; o selo é reputação, não permissão. */
    if (!doc || !doc.active || !doc.accepting_patients) {
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

    /* AVISA O MÉDICO.
       
       Este é o caminho mais usado — a página pública de busca — e era o único
       que não avisava ninguém: ele ganhava uma paciente e só descobria abrindo
       o painel por conta própria. Aguardado, e não disparado e esquecido: em
       função serverless o que roda depois da resposta pode não rodar. */
    try {
      const { data: prof } = await (supabaseAdmin as any)
        .from("patient_profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      const nome = ((prof?.display_name as string) || "Uma gestante").trim();
      try {
        const { sendPushToUser } = await import("./push.server");
        await sendPushToUser(data.doctorId, {
          title: "Você tem uma nova paciente",
          body: `${nome} escolheu você como obstetra no app.`,
          url: "/painel",
        });
      } catch {
        /* push é opcional */
      }
      const { data: dUser } = await supabaseAdmin.auth.admin.getUserById(data.doctorId);
      if (dUser?.user?.email) {
        const { sendEmail, emailLayout } = await import("./email.server");
        const seguro = nome.replace(/[&<>"]/g, "");
        await sendEmail({
          to: dUser.user.email,
          subject: `👩‍🍼 Nova paciente: ${nome}`,
          html: emailLayout(
            "Você tem uma nova paciente",
            `<p style="margin:0 0 10px"><strong>${seguro}</strong> escolheu você como obstetra no app Obstétrica.</p>
             <p style="margin:0">Ela já aparece na aba <strong>Pacientes</strong> do seu painel.</p>`,
          ),
        });
      }
    } catch {
      /* melhor esforço — o vínculo já está gravado */
    }

    return { ok: true as const };
  });
