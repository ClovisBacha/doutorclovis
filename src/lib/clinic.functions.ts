/**
 * Plano Clínica — server functions.
 *
 * A clínica é uma conta (owner_user_id) que agrupa médicos. Cada médico
 * CONTINUA com o próprio Segundo Cérebro (tudo chaveado por doctor_id);
 * a clínica ganha apenas o direito de OPERAR cada cérebro individualmente
 * pelo painel (admin da clínica) — nada é misturado entre médicos.
 *
 * Papéis:
 *   - admin  → dono da clínica (owner_user_id) ou médico com clinic_role='admin'.
 *   - member → médico da clínica; usa o painel normalmente, só o próprio cérebro.
 * Membro de clínica ativa herda as capacidades do plano Clínica
 * (entitlements.server.ts) — o assento vem da clínica, não do plano pessoal.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function authedUser(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user;
}

export type ClinicInfo = {
  id: string;
  name: string;
  active: boolean;
  role: "admin" | "member";
};

export type ClinicMember = {
  id: string;
  display_name: string;
  specialty: string | null;
  plan: string | null;
  active: boolean;
  clinic_role: string;
  brainEntries: number;
  brainGaps: number;
  // Relatório do mês por médico (null = sem dados/telemetria não migrada).
  coveragePct: number | null;
  satisfactionPct: number | null;
};

/**
 * Clínica do usuário como ADMIN (dono da conta da clínica ou médico com
 * clinic_role='admin'). null = não administra clínica nenhuma.
 */
async function adminClinicOf(userId: string): Promise<{ id: string; name: string } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;
  const { data: owned, error } = await sb
    .from("clinics")
    .select("id,name,active")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (error) return null; // tabela ainda não migrada → sem clínica
  if (owned?.active) return { id: owned.id, name: owned.name };
  const { data: me } = await sb
    .from("doctors")
    .select("clinic_id,clinic_role")
    .eq("id", userId)
    .maybeSingle();
  if (!me?.clinic_id || me.clinic_role !== "admin") return null;
  const { data: clinic } = await sb
    .from("clinics")
    .select("id,name,active")
    .eq("id", me.clinic_id)
    .maybeSingle();
  return clinic?.active ? { id: clinic.id, name: clinic.name } : null;
}

const TokenSchema = z.object({ accessToken: z.string().min(10) });

/** Clínica do usuário + (se admin) lista de médicos com resumo do cérebro. */
export const getMyClinic = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await authedUser(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    // Admin?
    const admin = await adminClinicOf(user.id);
    let clinic: ClinicInfo | null = null;
    if (admin) {
      clinic = { id: admin.id, name: admin.name, active: true, role: "admin" };
    } else {
      // Membro comum?
      const { data: me, error } = await sb
        .from("doctors")
        .select("clinic_id")
        .eq("id", user.id)
        .maybeSingle();
      if (error?.code === "42703")
        return { ok: true as const, clinic: null, members: [] as ClinicMember[], migrate: true };
      if (me?.clinic_id) {
        const { data: c } = await sb
          .from("clinics")
          .select("id,name,active")
          .eq("id", me.clinic_id)
          .maybeSingle();
        if (c) clinic = { id: c.id, name: c.name, active: c.active, role: "member" };
      }
    }
    if (!clinic) return { ok: true as const, clinic: null, members: [] as ClinicMember[] };

    // Lista de médicos só para o admin (member não vê os cérebros dos colegas).
    let members: ClinicMember[] = [];
    if (clinic.role === "admin") {
      const { data: docs } = await sb
        .from("doctors")
        .select("id,display_name,specialty,plan,active,clinic_role")
        .eq("clinic_id", clinic.id)
        .order("display_name", { ascending: true });
      const rows = (docs ?? []) as Omit<
        ClinicMember,
        "brainEntries" | "brainGaps" | "coveragePct" | "satisfactionPct"
      >[];
      const { computeBrainQualityStats } = await import("./secondbrain.server");
      members = await Promise.all(
        rows.map(async (d) => {
          const [entries, gaps, quality] = await Promise.all([
            sb
              .from("brain_entries")
              .select("id", { count: "exact", head: true })
              .eq("doctor_id", d.id)
              .eq("approved", true),
            sb
              .from("brain_gaps")
              .select("id", { count: "exact", head: true })
              .eq("doctor_id", d.id)
              .eq("status", "aberta"),
            // Relatório do mês (cobertura/satisfação) — mesmo cálculo do
            // placar individual, por médico, para a gestão da clínica.
            computeBrainQualityStats(d.id),
          ]);
          return {
            ...d,
            brainEntries: entries?.count ?? 0,
            brainGaps: gaps?.count ?? 0,
            coveragePct: quality?.coveragePct ?? null,
            satisfactionPct: quality?.satisfactionPct ?? null,
          } as ClinicMember;
        }),
      );
    }
    return { ok: true as const, clinic, members };
  });

/** Cria a clínica (uma por conta). Exige plano com assentos de equipe. */
export const createClinic = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), name: z.string().min(2).max(120) }).parse(i),
  )
  .handler(async ({ data }) => {
    const user = await authedUser(data.accessToken);
    if (!user) return { ok: false as const };
    const { getEntitlements } = await import("./entitlements.server");
    if (!(await getEntitlements(user)).teamSeats)
      return { ok: false as const, reason: "plan" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: existing, error: exErr } = await sb
      .from("clinics")
      .select("id,name")
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (exErr?.code === "42P01") return { ok: false as const, reason: "migracao" as const };
    if (existing) return { ok: true as const, clinicId: existing.id, already: true as const };

    const { data: clinic, error } = await sb
      .from("clinics")
      .insert({ name: data.name.trim(), owner_user_id: user.id })
      .select("id")
      .single();
    if (error || !clinic) return { ok: false as const };

    /* Se o dono também é médico, entra como admin da própria clínica.
       ─── E SÓ SE ELE NÃO ESTIVER EM OUTRA ────────────────────────────────
       `sairDaClinica` foi escrita para ser a porta de saída, e este caminho
       passava por fora dela: criar uma clínica sobrescrevia `clinic_id` em
       silêncio, tirando o médico da clínica anterior sem avisar ninguém — nem
       ele, nem o admin de lá, que perde um membro sem um evento sequer.
       Com vínculo existente, a criação segue e o assento NÃO troca: ele decide
       sair pela porta que existe para isso. */
    const { data: atual } = await sb
      .from("doctors")
      .select("clinic_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!atual?.clinic_id) {
      await sb
        .from("doctors")
        .update({ clinic_id: clinic.id, clinic_role: "admin" })
        .eq("id", user.id);
    } else {
      console.error("[clínica] dono já pertence a outra clínica; assento não trocado", user.id);
    }
    return { ok: true as const, clinicId: clinic.id as string };
  });

/** Adiciona um médico à clínica pelo e-mail da conta dele. */
export const addClinicDoctor = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), email: z.string().email() }).parse(i),
  )
  .handler(async ({ data }) => {
    const user = await authedUser(data.accessToken);
    if (!user) return { ok: false as const };
    const clinic = await adminClinicOf(user.id);
    if (!clinic) return { ok: false as const, reason: "nao_admin" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: uid, error: rpcErr } = await sb.rpc("get_user_id_by_email", {
      p_email: data.email.trim().toLowerCase(),
    });
    if (rpcErr || !uid) return { ok: false as const, reason: "sem_conta" as const };

    const { data: doc } = await sb
      .from("doctors")
      .select("id,display_name,clinic_id")
      .eq("id", uid)
      .maybeSingle();
    if (!doc) return { ok: false as const, reason: "sem_conta_medico" as const };
    if (doc.clinic_id && doc.clinic_id !== clinic.id)
      return { ok: false as const, reason: "outra_clinica" as const };
    if (doc.clinic_id === clinic.id)
      return { ok: true as const, already: true as const, name: doc.display_name as string };

    // Escada de planos: teto de cérebros/médicos da clínica pelo plano do
    // DONO da conta (Elite 5 → Black 20 → Clínica 100). Atingiu → upgrade.
    const { getEntitlements } = await import("./entitlements.server");
    const ent = await getEntitlements(user);
    if (ent.maxBrains != null) {
      const { count, error: cntErr } = await sb
        .from("doctors")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinic.id);
      if (!cntErr && (count ?? 0) >= ent.maxBrains) {
        return {
          ok: false as const,
          reason: "limite" as const,
          limit: ent.maxBrains,
          plan: ent.label,
        };
      }
    }

    const { error } = await sb
      .from("doctors")
      .update({ clinic_id: clinic.id, clinic_role: "member" })
      .eq("id", doc.id)
      .is("clinic_id", null); // corrida: só entra se ainda estiver sem clínica
    if (error) return { ok: false as const };

    /* O MÉDICO PRECISA SABER.

       A associação não tinha convite, aceite nem aviso: bastava o e-mail dele.
       E o que ela libera é ler as CONVERSAS das pacientes dele com a IA, com o
       nome delas. Uma porta que se abria com um e-mail, em silêncio.

       Convite com aceite seria o certo, e é mais trabalho do que cabe aqui.
       O aviso é o mínimo: ele descobre no mesmo dia, e agora tem como sair. */
    try {
      const { sendPushToUser } = await import("./push.server");
      await sendPushToUser(doc.id as string, {
        title: "Você foi adicionado a uma clínica",
        body: "A administração da clínica passa a operar o seu Segundo Cérebro. Veja em Clínica.",
        url: "/painel",
      });
    } catch {
      /* sem push; o aviso por e-mail abaixo cobre */
    }
    try {
      const { sendEmail, emailLayout, escEmail } = await import("./email.server");
      /* O e-mail é o que ele DIGITOU para achar o médico — `doctors` não guarda
         e-mail, e ir buscá-lo no Auth seria uma ida a mais para o dado que já
         está na mão. */
      const email = data.email.trim().toLowerCase();
      if (email) {
        await sendEmail({
          to: email,
          subject: "Você foi adicionado a uma clínica na Obstétrica",
          html: emailLayout(
            "Você foi adicionado a uma clínica",
            `<p>A clínica <strong>${escEmail(clinic.name ?? "de um colega")}</strong> adicionou você como membro.</p>
             <p>Isso significa que a administração dela pode operar o seu Segundo Cérebro e ver as
             conversas das suas pacientes com a IA.</p>
             <p>Se você não esperava isso, saia da clínica na aba <strong>Clínica</strong> do seu
             painel — o seu cérebro e as suas pacientes continuam seus.</p>`,
          ),
        });
      }
    } catch {
      /* o médico ainda vê a clínica no painel dele */
    }
    return { ok: true as const, name: doc.display_name as string };
  });

/** Remove um médico da clínica (o cérebro dele fica intacto, com ele). */
export const removeClinicDoctor = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), doctorId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const user = await authedUser(data.accessToken);
    if (!user) return { ok: false as const };
    const clinic = await adminClinicOf(user.id);
    if (!clinic) return { ok: false as const, reason: "nao_admin" as const };
    if (data.doctorId === user.id) return { ok: false as const, reason: "proprio" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("doctors")
      .update({ clinic_id: null, clinic_role: "member" })
      .eq("id", data.doctorId)
      .eq("clinic_id", clinic.id);
    return { ok: !error };
  });

/**
 * Sair da clínica por conta própria.
 *
 * Não existia. `addClinicDoctor` associa um médico com o e-mail dele e mais
 * nada — sem convite, sem aceite, sem aviso —, e a única saída era
 * `removeClinicDoctor`, que exige ser admin da clínica. O médico também não
 * conseguia se soltar pelo banco: `clinic_id` e `clinic_role` não estão no
 * grant de UPDATE de `authenticated` em `doctors`.
 *
 * O que a associação libera não é pouco: o admin passa a operar o cérebro dele
 * e a ler as CONVERSAS das pacientes dele com a IA, com o nome delas. Uma porta
 * que se abre com um e-mail e só fecha por dentro de quem abriu.
 *
 * O cérebro fica intacto e com ele — sair da clínica não é perder o trabalho.
 */
export const sairDaClinica = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const user = await authedUser(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: eu } = await sb
      .from("doctors")
      .select("id,clinic_id,clinic_role")
      .eq("id", user.id)
      .maybeSingle();
    if (!eu?.clinic_id) return { ok: false as const, reason: "sem_clinica" as const };
    /* O dono não sai: a clínica ficaria sem administrador e os membros presos
       de vez. Ele remove os membros e apaga a clínica, nessa ordem. */
    if (eu.clinic_role === "admin") return { ok: false as const, reason: "e_admin" as const };

    /* ─── A PORTA DE SAÍDA NÃO ABRIA ──────────────────────────────────────
     *
     * `clinic_role` é `text NOT NULL DEFAULT 'member'` (APLICAR_PENDENTES.sql:
     * 2023). Escrever `null` viola a constraint: o update falhava, e a única
     * forma de o médico sair de uma clínica em que foi posto sem consentimento
     * simplesmente não funcionava.
     *
     * Agravante: `sairDaClinica` não é chamada por nenhuma tela — a função
     * existia, quebrada, e inalcançável.
     *
     * `member` é o valor certo para quem não está em clínica nenhuma: é o
     * DEFAULT da coluna, e o gatilho `protect_doctor_billing` já força esse
     * valor quando alguém tenta se auto-promover. */
    const { error } = await sb
      .from("doctors")
      .update({ clinic_id: null, clinic_role: "member" })
      .eq("id", user.id);
    if (error) {
      console.error("[clínica] o médico não conseguiu sair", user.id, error);
      return { ok: false as const };
    }
    return { ok: true as const };
  });
