/**
 * Perfil do médico assinante — server functions.
 *
 * Qualquer usuário autenticado pode se registrar como médico; ele entra em
 * `free` (perfil no ar, agenda e pacientes) e as capacidades pagas — a IA em
 * primeiro lugar — só com assinatura.
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
  /* Moeda e centavos: `consultation_price_brl` traz a moeda no NOME e guarda
     unidades inteiras. As duas convivem até a última leitura migrar. */
  consultation_currency?: string | null;
  consultation_price_cents?: number | null;
  /** Focos adicionais. `specialty` segue sendo o principal, exibido no card. */
  focos?: string[] | null;
  /** URL pública da foto. Só a URL: a imagem vive no Storage. */
  photo_url?: string | null;
  offers_telehealth?: boolean | null;
  personal_phone?: string | null;
  accepts_insurance?: boolean | null;
  accepts_private?: boolean | null;
  plan_expires_at?: string | null;
  verified?: boolean | null;
};

/** Colunas do perfil lidas em todas as consultas de médico. */
const RICH_COLS =
  "instagram,rqe,education,hospitals,insurances,languages,approach,consultation_price_brl,consultation_currency,consultation_price_cents,focos,photo_url,offers_telehealth,personal_phone,accepts_insurance,accepts_private";
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
  /* Moeda escolhida, não deduzida do nome da coluna: um médico que atende
     brasileiras fora do país cobra em dólar ou euro, e "450" sem moeda é lido
     errado por um fator de cinco. Lista fechada — moeda é enum, não texto. */
  consultation_currency: z.enum(["BRL", "USD", "EUR"]).optional(),
  /* Centavos em inteiro: ponto flutuante para dinheiro erra. Teto de 10 milhões
     de centavos (100 mil na moeda) pelo mesmo motivo do campo acima. */
  consultation_price_cents: z.number().int().min(0).max(10_000_000).nullable().optional(),
  /* Focos adicionais. Teto de 8 porque um médico que marca tudo não está
     dizendo no que é bom — está dizendo que não escolheu. */
  focos: z.array(z.string().max(80)).max(8).optional(),
  /* Só a URL. Enviar a imagem por aqui encheria a linha e a resposta da busca. */
  photo_url: z.string().max(500).optional(),
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

    /* O que falta para ele poder receber paciente. Calculado no servidor e
       devolvido junto do perfil: o painel cobra a lista, e a busca da paciente
       usa a MESMA regra — sem isso, cada tela tinha a sua ideia de "completo".

       Endereço mora em outra tabela, então é consultado aqui e entra como
       booleano. Erro de tabela não migrada = `undefined`, que não cobra nada
       (melhor não cobrar do que cobrar algo que não dá para preencher). */
    let temEndereco: boolean | undefined = undefined;
    try {
      const { count, error: eAddr } = await (supabaseAdmin as any)
        .from("doctor_addresses")
        .select("id", { count: "exact", head: true })
        .eq("doctor_id", user.id);
      if (!eAddr) temEndereco = (count ?? 0) > 0;
    } catch {
      /* sem tabela de endereços: não cobra */
    }
    const { pendenciasDoMedico } = await import("./doctor-required");
    const pendencias = row ? pendenciasDoMedico(row as any, { temEndereco }) : [];

    return {
      ok: true as const,
      doctor: (row ?? null) as DoctorProfile | null,
      isPlatformAdmin,
      entitlements,
      patientCount,
      pendencias,
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

    /* Cadastro NOVO passa pela mesma regra que o formulário aplica — o servidor
       não confia na tela. Só no cadastro novo: um perfil que já existe pode
       estar salvando um campo por vez em "Meu Perfil", e barrar ali trancaria o
       médico fora do próprio painel (foi exatamente o beco sem saída relatado).
       Endereço não é cobrado aqui: ele é criado depois, no painel. */
    if (!existing) {
      const { pendenciasDoMedico } = await import("./doctor-required");
      const faltas = pendenciasDoMedico(data.profile as any, { temEndereco: true });
      if (faltas.length) {
        return {
          ok: false as const,
          error: `${faltas[0].rotulo} — ${faltas[0].porque}`,
        };
      }
    }

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

    /* Médico NOVO entra em `free`: cria o perfil, aparece na busca, recebe
       paciente — mas a IA e as ferramentas pagas só com assinatura.
       O trial de 14 dias saiu. Ele dava as capacidades de Pro (inclusive o
       Segundo Cérebro) sem cartão nenhum, e cada conversa dessas é chamada de
       modelo que a gente paga. Quem já está em `trial` continua até vencer —
       `entitlements.server` derruba no prazo; o que muda é só quem nasce agora.
       Médico já existente NÃO tem o plano mexido aqui (pode ser assinante pago
       só atualizando o perfil). */
    const camposDeEntrada = existing
      ? {}
      : {
          plan: "free",
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
    /* Campos com `.default("")` no schema: quando o formulário não os manda,
       eles chegam como string VAZIA — não como ausentes — e o `stripUndefined`
       não tem como distinguir. Num perfil que JÁ EXISTE isso apaga o que
       estava salvo.
       Não é hipótese: a validação de obrigatórios só roda no cadastro novo
       (`if (!existing)` acima, e por bom motivo — barrar ali trancava o médico
       fora do próprio painel). Então um reenvio com o campo em branco passava
       direto e zerava CRM, WhatsApp ou chave PIX de quem já estava cadastrado.
       Apagar exige intenção: continua possível pelo "Meu Perfil", que manda o
       campo de propósito. O que não pode é acontecer por omissão. */
    const COM_PADRAO_VAZIO = ["title", "specialty", "crm", "whatsapp", "pix_key"] as const;
    const doUpsert = (s: string | null, richOk: boolean) => {
      const profile = stripUndefined(data.profile) as Record<string, unknown>;
      if (existing) {
        for (const k of COM_PADRAO_VAZIO) {
          if (typeof profile[k] === "string" && !(profile[k] as string).trim()) delete profile[k];
        }
      }
      if (!richOk) for (const k of RICH_KEYS) delete profile[k];
      return (supabaseAdmin as any)
        .from("doctors")
        .upsert({
          id: user.id,
          ...profile,
          ...camposDeEntrada,
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
      /* AGUARDADO, e não disparado.
         Era `void (async () => {…})()`, dentro de uma server function que
         retorna logo em seguida. Em servidor sem servidor a invocação congela
         com a resposta — o médico recém-cadastrado podia terminar SEM kit
         nenhum, e o `console.error` do `catch` não pega congelamento: não há
         exceção, o processo simplesmente para.
         O custo é um insert de ~30 linhas no cadastro, que acontece uma vez na
         vida da conta. O benefício é a tela dele não nascer vazia. */
      await (async () => {
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
          const { error } = await (supabaseAdmin as any).from("brain_entries").insert(
            BRAIN_STARTER_PACK.map((e) => ({
              doctor_id: user.id,
              question: e.question,
              answer: e.answer,
              source: "kit",
              approved: false,
            })),
          );
          /* O `catch` abaixo já logava — e nunca capturou nada, porque o
             supabase-js devolve `{ error }`. O médico novo abria o Cérebro
             vazio achando que era assim mesmo. */
          if (error) console.error("[registerDoctor] starter pack seed failed", error);
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
        const { sendEmail, emailLayout, escEmail } = await import("@/lib/email.server");
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
              // Campos livres do cadastro: escapados, senão um "<" no nome
              // quebra a moldura do e-mail.
              `<p style="margin:0 0 6px"><strong>Nome:</strong> ${escEmail(data.profile.display_name)}</p>
               <p style="margin:0 0 6px"><strong>CRM:</strong> ${escEmail(data.profile.crm)}</p>
               <p style="margin:0 0 6px"><strong>WhatsApp:</strong> ${escEmail(data.profile.whatsapp ?? "—")}</p>
               <p style="margin:0 0 6px"><strong>E-mail:</strong> ${escEmail(user.email ?? "—")}</p>
               <p style="margin:14px 0 0">O perfil dele já está no ar — vale dar as boas-vindas e ajudar no onboarding.</p>`,
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
  /** Moeda do valor. O card formata com ela, nunca com "R$" fixo. */
  consultation_currency?: string | null;
  /** Valor em centavos — fonte de verdade do preço. */
  consultation_price_cents?: number | null;
  /** Focos adicionais — as palavras pelas quais ela encontra o médico. */
  focos?: string[] | null;
  /** Foto do médico. Um rosto é a maior diferença entre dois cards. */
  photo_url?: string | null;
  offers_telehealth?: boolean | null;
  /* Como ele atende. Dois booleanos e não um enum porque há quem faça os dois
     — e porque `insurances` em branco antes era ambíguo entre "só particular"
     e "não preenchi". É a primeira pergunta da paciente. */
  accepts_insurance?: boolean | null;
  accepts_private?: boolean | null;
  /** Endereço principal, já montado numa linha. "" = não informado. */
  endereco?: string;
  /** Cidade do endereço principal — quando o perfil não tem cidade preenchida. */
  endereco_cidade?: string;
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
    /* Só o que `doctors` tem desde a criação (20260707200000). É o piso: se nem
       isto existir, o problema não é migração pendente. */
    const DIR_MINIMO = "id,display_name,title,specialty,crm,whatsapp,slug,plan,active";
    const CAMPOS_TEXTO = ["display_name", "specialty", "subspecialty", "city"];
    /* No piso, só o que a tabela tem desde a criação: `subspecialty` e `city`
       são da MESMA migração cuja ausência o piso existe para sobreviver, então
       citá-las no `or(...)` fazia qualquer busca com termo dar 42703 nos três
       degraus — "a busca falhou" num diretório cheio. */
    const CAMPOS_TEXTO_MINIMO = ["display_name", "specialty"];
    const buildQuery = (
      cols: string,
      comTexto = true,
      campos = CAMPOS_TEXTO,
      /** Último recurso: sem nenhum filtro de coluna nova. */
      semFiltros = false,
    ) => {
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
        .not("display_name", "is", null);
      /* `accepting_patients` continua valendo até o penúltimo degrau.
      
         Eu tinha tirado esse filtro do degrau mínimo com um raciocínio errado:
         "degrau mínimo ⇒ a coluna não existe". Não segue. `DIR_BASE` cita
         colunas de DUAS migrações diferentes, e a que provavelmente está
         pendente é a mais nova (o perfil rico) — nesse estado
         `accepting_patients` existe e quer dizer alguma coisa. O resultado era
         devolver na busca justamente o médico que fechou a agenda; e escolher um
         médico é o que liga o botão SOS dela ao telefone dele. */
      if (!semFiltros) q = q.eq("accepting_patients", true);
      /* O texto passa a filtrar NO BANCO.
         
         Antes o `limit(200)` cortava a lista antes de qualquer busca por nome,
         e a filtragem acontecia em JavaScript sobre esse pedaço. Com mais de
         200 médicos cadastrados, procurar "Marina" podia não achar a Marina —
         ela simplesmente não estava nas 200 linhas que o Postgres devolveu, e
         em ordem nenhuma, porque também não havia `ORDER BY`. */
      const termo = comTexto ? data.q.trim() : "";
      if (termo) {
        /* O valor vai ENTRE ASPAS dentro do `or(...)`.
        
           Sem elas, o PostgREST parte o grupo `or=(...)` na primeira vírgula de
           primeiro nível: buscar "Souza, Maria" ou "Bacha (obstetra)" produzia
           um filtro inválido → 400 → lista vazia, e a tela culpava os filtros
           dela. Pior: dava para injetar termos extras no OR e usar a lista como
           oráculo sobre colunas que nem são selecionadas (`pix_key`,
           `personal_phone`). Aspas duplas resolvem os dois casos; as barras e
           aspas internas são escapadas para não fechar a string. */
        const seguro = termo.replace(/[%_*]/g, "").replace(/[\\"]/g, "\\$&");
        const like = `"%${seguro}%"`;
        q = q.or(campos.map((c) => `${c}.ilike.${like}`).join(","));
      }
      /* `state`, `city`, `has_*` e `years_experience` vêm da migração do perfil.
         Só o ÚLTIMO degrau abre mão deles — e quem chama avisa a paciente, com
         `filtrosIgnorados`, que a lista veio sem os filtros dela. Descartar em
         silêncio é pior que o erro que isso substituiu: ela filtra "São Paulo +
         doutorado" e recebe o diretório nacional achando que está filtrado. */
      if (!semFiltros) {
        if (data.state) q = q.ilike("state", data.state);
        if (data.city) q = q.ilike("city", `%${data.city}%`);
        if (data.hasMasters) q = q.eq("has_masters", true);
        if (data.hasDoctorate) q = q.eq("has_doctorate", true);
        if (data.minExperience > 0) q = q.gte("years_experience", data.minExperience);
      }
      /* Ordem estável no SQL para o recorte ser sempre o mesmo conjunto; o
         ranking por plano continua no JS, sobre a lista já filtrada. */
      return q.order("display_name", { ascending: true }).limit(200);
    };

    /** Verdadeiro quando a lista veio SEM os filtros que ela escolheu. */
    let filtrosIgnorados = false;
    let { data: rows, error } = await buildQuery(`${DIR_BASE},${RICH_COLS}`);
    if (error?.code === "42703") {
      /* Degrau intermediário e degrau mínimo.
      
         `DIR_BASE` nomeia colunas que a MESMA migração cria (bio, city, state,
         verified…), então usá-lo como rede de segurança era pedir a mesma coisa
         duas vezes: os dois selects davam 42703 e a paciente via "nenhum médico
         encontrado" num diretório cheio. O último degrau só pede o que existe
         desde a criação da tabela. */
      ({ data: rows, error } = await buildQuery(DIR_BASE));
      if (error?.code === "42703") {
        // Ainda com o filtro de agenda aberta — só as colunas do perfil saem.
        ({ data: rows, error } = await buildQuery(DIR_MINIMO, true, CAMPOS_TEXTO_MINIMO));
      }
      if (error?.code === "42703") {
        // Piso de verdade: nem `accepting_patients` existe.
        ({ data: rows, error } = await buildQuery(DIR_MINIMO, true, CAMPOS_TEXTO_MINIMO, true));
        filtrosIgnorados = !error;
      }
    }
    if (error) return { ok: false as const, error: error.message, doctors: [] };

    /* Comparação sem acento nem caixa: "jose" tem de achar "José", "sao paulo"
       tem de achar "São Paulo". O `ilike` do Postgres dobra a caixa e NÃO dobra
       o acento, então a passada em JS é o que salva a busca mais provável de
       todas — o primeiro nome digitado sem acento. */
    const semAcento = (v: unknown) =>
      String(v ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");
    const term = semAcento(data.q.trim());
    let list = (rows ?? []) as (DirectoryDoctor & { active: boolean })[];
    // Perfis reais só (com nome) e, se houver texto, casa nome/especialidade/cidade.
    list = list.filter((d) => (d.display_name ?? "").trim().length >= 2);
    /* Sem telefone para pacientes, ele NÃO entra na lista.
    
       Não é rigor de cadastro: escolher um médico é o que liga o botão SOS
       dela ao telefone dele. Oferecer na busca alguém sem número é entregar um
       botão de emergência que não disca — e o pior momento para descobrir isso
       é o momento da emergência. Os outros campos que faltam só empurram para
       baixo no ranking; este exclui. */
    list = list.filter((d) => (d.whatsapp ?? "").replace(/\D+/g, "").length >= 10);
    const casa = (d: DirectoryDoctor) =>
      semAcento(
        [d.display_name, d.specialty, d.subspecialty, d.city, d.bio, ...(d.focos ?? [])]
          .filter(Boolean)
          .join(" "),
      ).includes(term);
    /* `.filter(Boolean)` e não interpolação direta: nos degraus reduzidos essas
       colunas não vêm, e `${undefined}` vira a STRING "undefined" — aí buscar
       "def", "ine" ou "nde" casava com todo mundo. */
    if (term) list = list.filter(casa);

    /* Segunda tentativa: sem o filtro de texto no banco.
    
       Resolve DOIS problemas de uma vez.
    
       1) Acento. O `ilike` do Postgres dobra a caixa e não dobra o acento, então
          "jose" nunca traz "José" DO BANCO — nenhum filtro em JS recupera uma
          linha que não veio. Refazendo a consulta sem o termo, a comparação sem
          acento acontece sobre um conjunto que contém o médico.
    
       2) "O médico dela não está aqui". Era um beco: uma linha cinza e nada
          mais. Agora, quando o nome não casa com ninguém, a resposta é o
          diretório inteiro ranqueado (plano mais caro primeiro) com
          `semCorrespondencia: true`, para a tela poder dizer "não achamos esse
          nome — estes são os obstetras do app" em vez de "amplie sua busca".
    
       O custo é uma consulta a mais, e só quando a primeira não achou nada. */
    let semCorrespondencia = false;
    if (term && list.length === 0) {
      let alt = await buildQuery(`${DIR_BASE},${RICH_COLS}`, false);
      if (alt.error?.code === "42703") alt = await buildQuery(DIR_BASE, false);
      if (alt.error?.code === "42703")
        alt = await buildQuery(DIR_MINIMO, false, CAMPOS_TEXTO_MINIMO);
      if (alt.error?.code === "42703") {
        alt = await buildQuery(DIR_MINIMO, false, CAMPOS_TEXTO_MINIMO, true);
        filtrosIgnorados = filtrosIgnorados || !alt.error;
      }
      if (!alt.error) {
        const todos = ((alt.data ?? []) as (DirectoryDoctor & { active: boolean })[])
          .filter((d) => (d.display_name ?? "").trim().length >= 2)
          .filter((d) => (d.whatsapp ?? "").replace(/\D+/g, "").length >= 10);
        const porAcento = todos.filter(casa);
        if (porAcento.length) {
          list = porAcento;
        } else {
          list = todos;
          semCorrespondencia = true;
        }
      }
    }
    // Ranking: plano melhor primeiro, depois mais experiência, depois nome.
    /* Plano VENCIDO não ranqueia como plano pago.
       
       `entitlements.server` derruba o trial vencido, mas a lista usava a coluna
       crua: um Elite cujo cartão falhou continuava no topo de toda busca
       indefinidamente, na frente de quem está pagando. Aqui a data manda. */
    /* A MESMA régua do resto do sistema, importada — não uma cópia.
       Esta função e `planRowFor` respondiam à mesma pergunta com regras
       opostas: aqui qualquer plano vencido caía; lá, só o trial. O médico com o
       cartão recusado perdia a posição na busca e mantinha a IA.
       `planoVigente` ainda acrescenta a carência de renovação, que aqui também
       é o certo: quem está renovando não deve sumir da busca por um webhook
       atrasado. */
    const { planoVigente } = await import("./entitlements.server");
    const planoValido = (d: { plan: string; plan_expires_at?: string | null }) =>
      planoVigente(d.plan, d.plan_expires_at) ?? "free";
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
      /* Perfil completo antes de perfil pela metade: a paciente que abre um
         card sem valor de consulta, sem convênio e sem formação não tem como
         decidir, e volta para a lista. Quem preencheu aparece primeiro. */
      const cp = Number(cadastroUtil(b)) - Number(cadastroUtil(a));
      if (cp !== 0) return cp;
      const ex = (b.years_experience ?? 0) - (a.years_experience ?? 0);
      if (ex !== 0) return ex;
      return (a.display_name ?? "").localeCompare(b.display_name ?? "");
    });

    const comEndereco = await anexarEnderecos(supabaseAdmin, list as any[]);
    const doctors: DirectoryDoctor[] = comEndereco.map((d) => toDirectoryDoctor(d));
    return { ok: true as const, doctors, semCorrespondencia, filtrosIgnorados };
  });

/**
 * O card dele responde as perguntas da paciente?
 *
 * Serve só para ORDENAR (quem responde aparece antes). Não exclui ninguém:
 * excluir por perfil incompleto deixaria a busca vazia justamente no começo da
 * plataforma, quando ninguém terminou o cadastro ainda.
 */
function cadastroUtil(d: any): boolean {
  const temPreco = !d?.accepts_private || (d?.consultation_price_brl ?? 0) > 0;
  const temConv = !d?.accepts_insurance || !!String(d?.insurances ?? "").trim();
  return !!String(d?.education ?? "").trim() && temPreco && temConv;
}

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
    consultation_currency: d.consultation_currency ?? "BRL",
    consultation_price_cents: d.consultation_price_cents ?? null,
    focos: Array.isArray(d.focos) ? d.focos : [],
    photo_url: d.photo_url ?? null,
    offers_telehealth: d.offers_telehealth ?? null,
    accepts_insurance: d.accepts_insurance ?? null,
    accepts_private: d.accepts_private ?? null,
    endereco: d.__endereco ?? "",
    endereco_cidade: d.__endereco_cidade ?? "",
  };
}

/**
 * Anexa o endereço principal a cada linha antes de virar card.
 *
 * O médico cadastra endereços (`doctor_addresses`) desde a migração do cadastro
 * completo, mas a paciente nunca via nenhum: o painel dizia "a paciente vê o
 * endereço principal" e isso simplesmente não era verdade. Uma consulta só,
 * para todos os médicos da página, em vez de uma por card.
 */
async function anexarEnderecos(sb: any, rows: any[]): Promise<any[]> {
  const ids = rows.map((r) => r.id).filter(Boolean);
  if (!ids.length) return rows;
  try {
    const { data: addrs, error } = await sb
      .from("doctor_addresses")
      .select("doctor_id,label,street,city,state,is_primary,position")
      .in("doctor_id", ids)
      .order("position", { ascending: true });
    if (error) return rows;
    const porMedico = new Map<string, any>();
    for (const a of (addrs ?? []) as any[]) {
      // O primário ganha; sem primário, o primeiro da ordem escolhida por ele.
      const atual = porMedico.get(a.doctor_id);
      if (!atual || (a.is_primary && !atual.is_primary)) porMedico.set(a.doctor_id, a);
    }
    return rows.map((r) => {
      const a = porMedico.get(r.id);
      if (!a) return r;
      const linha = [a.street, a.city, a.state].map((x) => String(x ?? "").trim()).filter(Boolean);
      return {
        ...r,
        __endereco: linha.join(" · "),
        __endereco_cidade: String(a.city ?? "").trim(),
      };
    });
  } catch {
    return rows;
  }
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
    /* MEDIDO. Uma trava mecânica achou oito chamadas pagas de modelo que
     ninguém media — esta era uma delas. Canal próprio: a cota conta só
     `app`, então isto aparece no consumo sem comer a franquia clínica. */
    const { registrarUsoAgora } = await import("./uso-ia.server");
    await registrarUsoAgora({
      especie: "chat",
      modelo: process.env.CHAT_MODEL ?? DEFAULT_CHAT_MODEL,
      /* OS TOKENS, que estavam na mao e nao eram passados: a linha era gravada
         com zero e a tabela media a RESPOSTA, nunca o custo. */
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      canal: "busca-medicos",
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

    /* `plan_expires_at` ENTRA. Sem ele, a busca por IA ranqueava pela coluna
       crua: um Elite com o cartao recusado seguia no topo indefinidamente — o
       defeito que o caminho irmao (`planoValido`) ja tinha consertado, vivo no
       outro. A regua e' uma so'; o que faltava era a coluna chegar aqui. */
    const { planoVigente: vigente } = await import("./entitlements.server");
    const DIR_BASE =
      "id,display_name,title,specialty,subspecialty,city,state,years_experience,has_masters,has_doctorate,plan,plan_expires_at,slug,bio,whatsapp";
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
      // Mesma regra do diretório: sem telefone para pacientes, o SOS dela não
      // teria para onde ligar depois de escolher — então ele não é oferecido.
      .filter((d) => String(d.whatsapp ?? "").replace(/\D+/g, "").length >= 10)
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
        /* Desempate leve por plano/selo/experiência (mesma lógica do diretório).
           Pela régua ÚNICA de vencimento — era a coluna crua, e o comentário
           dizia "mesma lógica do diretório" enquanto o diretório já usava
           `planoVigente`. Duas lógicas com o mesmo rótulo. */
        score += PLAN_RANK[normalizePlan(vigente(d.plan, d.plan_expires_at) ?? "free")] ?? 0;
        score += (d as { verified?: boolean }).verified ? 3 : 0;
        score += Math.min(5, (d.years_experience ?? 0) / 10);
        return { d, score, reasons };
      })
      .filter((x) => x.score > 0 || crit.keywords.length === 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    // Mesmo endereço que o diretório mostra — o card é o mesmo componente.
    const comEndereco = await anexarEnderecos(
      supabaseAdmin,
      scored.map((x) => x.d),
    );
    const doctors: DirectoryDoctor[] = scored.map((x, i) => ({
      ...toDirectoryDoctor(comEndereco[i] ?? x.d),
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

    /* O teto vem do MESMO resolvedor que o painel e o aceite usam.
    
       Antes esta função recalculava o plano efetivo na mão, a partir da coluna
       crua. Isso ignorava duas promoções que só o resolvedor conhece: a conta
       dona da plataforma e o assento de clínica. O resultado era um médico que
       via "sem limite" no painel e aceitava pacientes à vontade por um caminho,
       enquanto toda paciente que o escolhia pela busca pública levava "este
       médico já atingiu o limite" a partir da quinta. Duas verdades sobre o
       mesmo médico, e a paciente perdida no caminho mais usado. */
    const { getEntitlements, planoVigente } = await import("./entitlements.server");
    const { data: docUser } = await supabaseAdmin.auth.admin.getUserById(data.doctorId);
    /* O fallback também respeita o vencimento: `TRIAL` herda os limites de PRO,
       então usar a coluna crua dava 150 pacientes a um trial expirado — falhando
       ABERTO no caminho que acabamos de fechar.
       ─── E ERA A QUARTA RÉGUA ─────────────────────────────────────────────
       O que estava escrito aqui era literalmente a regra que `planoVigente`
       nasceu para substituir: rebaixava SÓ o `trial` e não tinha a carência de
       três dias. Ou seja, discordava da régua nova nos dois eixos — deixava um
       `pro` vencido com 150 pacientes e derrubava um assinante em dia por um
       webhook atrasado. Uma "régua única" com quatro cópias não é única. */
    const planoEfetivo = planoVigente(doc.plan, doc.plan_expires_at) ?? doc.plan;
    const entDoc = docUser?.user
      ? await getEntitlements(docUser.user)
      : entitlementsFor(planoEfetivo);
    /* ─── O TETO DE PACIENTES SAIU DO PRODUTO ──────────────────────────────
       Havia aqui a quarta e última contagem de `patient_profiles`, que recusava
       o vínculo com "Este médico já atingiu o limite de pacientes". O eixo
       deixou de existir: `maxPatients` é `null` em todos os planos.

       A medição fechou o argumento — R$ 0,024 por paciente/mês, menos que UMA
       mensagem de IA. O que custa é o modelo, e o modelo já está fechado atrás
       do plano. Ver `docs/custo-de-infraestrutura.md`.

       `entDoc` continua sendo lido acima: ele resolve o plano VIGENTE, que
       outras decisões desta função usam. */
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
    /* O bônus de vínculo. Uma função só para os TRÊS caminhos de vínculo —
       ver `bonusDeVinculo`. */
    {
      const { bonusDeVinculo } = await import("@/lib/sementinhas.functions");
      await bonusDeVinculo(supabaseAdmin, user.id, data.doctorId);
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
