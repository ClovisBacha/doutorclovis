import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  horariosLivres,
  paredeDaClinica,
  type Bloqueio,
  type HorarioLivre,
  type RegraDaGrade,
} from "./disponibilidade";

/**
 * A GRADE DE HORÁRIOS — ler, escrever, e responder "o que está livre?".
 *
 * ─── A DECISÃO QUE MANDA AQUI ───────────────────────────────────────────────
 *
 * A paciente PODE ler a grade e os bloqueios do médico dela (a RLS permite).
 * O que ela não pode é calcular o que está livre, porque isso exige subtrair as
 * consultas JÁ MARCADAS — que são de outras pacientes. Dar esse SELECT a ela
 * vazaria nome, e-mail e horário de todo mundo.
 *
 * Então `horariosLivresDoMedico` roda com service role e devolve SÓ os
 * horários: `{dia, hora}[]`, sem dizer de quem é nenhum deles, nem quantos
 * foram removidos, nem por quê.
 */

export type GradeDoMedico = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  kind: "presencial" | "teleconsulta" | "ambos";
};

export type BloqueioDoMedico = {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
};

const Tk = z.object({ accessToken: z.string().min(10) });

/** `time` do Postgres chega como "09:00:00". A régua fala `HH:MM`. */
function hhmm(t: string): string {
  return String(t).slice(0, 5);
}

async function medicoLogado(accessToken: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user.id;
}

/* ─────────────────────────── LEITURA DO MÉDICO ─────────────────────────── */

export const minhaGrade = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Tk.parse(i))
  .handler(async ({ data }) => {
    const doctorId = await medicoLogado(data.accessToken);
    if (!doctorId) return { ok: false as const, motivo: "sem_permissao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [g, b] = await Promise.all([
      (supabaseAdmin as any)
        .from("doctor_slots")
        .select("id, weekday, start_time, end_time, slot_minutes, kind")
        .eq("doctor_id", doctorId)
        .order("weekday")
        .order("start_time"),
      (supabaseAdmin as any)
        .from("doctor_blocks")
        .select("id, starts_at, ends_at, reason")
        .eq("doctor_id", doctorId)
        .gte("ends_at", new Date(Date.now() - 86400_000).toISOString())
        .order("starts_at"),
    ]);

    /* Tabela ausente tem motivo PRÓPRIO: "não consegui ler" e "você ainda não
       rodou o SQL" mandam o médico fazer coisas diferentes, e devolver lista
       vazia para os dois faria a tela dizer "nenhum horário cadastrado" para
       quem cadastrou vinte. */
    if (g.error || b.error) {
      const { faltaNoBanco } = await import("./postgrest");
      if (faltaNoBanco(g.error ?? b.error))
        return { ok: false as const, motivo: "sem_tabela" as const };
      return { ok: false as const, motivo: "falhou" as const };
    }

    return {
      ok: true as const,
      grade: (g.data ?? []) as GradeDoMedico[],
      bloqueios: (b.data ?? []) as BloqueioDoMedico[],
    };
  });

/* ─────────────────────────── ESCRITA DO MÉDICO ─────────────────────────── */

const FaixaSchema = z.object({
  accessToken: z.string().min(10),
  weekday: z.number().int().min(0).max(6),
  inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  fim: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  minutos: z.number().int().min(5).max(240),
  tipo: z.enum(["presencial", "teleconsulta", "ambos"]),
});

export const abrirFaixa = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => FaixaSchema.parse(i))
  .handler(async ({ data }) => {
    const doctorId = await medicoLogado(data.accessToken);
    if (!doctorId) return { ok: false as const, motivo: "sem_permissao" as const };
    /* O CHECK do banco já barra, mas a mensagem dele é um erro de constraint.
       Aqui a recusa tem nome e a tela sabe o que dizer. */
    if (data.fim <= data.inicio) return { ok: false as const, motivo: "faixa_invertida" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("doctor_slots").insert({
      doctor_id: doctorId,
      weekday: data.weekday,
      start_time: data.inicio,
      end_time: data.fim,
      slot_minutes: data.minutos,
      kind: data.tipo,
    });
    if (error) {
      const { faltaNoBanco } = await import("./postgrest");
      if (faltaNoBanco(error)) return { ok: false as const, motivo: "sem_tabela" as const };
      return { ok: false as const, motivo: "falhou" as const };
    }
    return { ok: true as const };
  });

export const fecharFaixa = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const doctorId = await medicoLogado(data.accessToken);
    if (!doctorId) return { ok: false as const, motivo: "sem_permissao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    /* O `.eq("doctor_id")` não é redundante com a RLS: aqui quem escreve é o
       service role, que a ignora. Sem ele, um id de faixa de outro médico
       apagaria a grade dele. */
    const { error } = await (supabaseAdmin as any)
      .from("doctor_slots")
      .delete()
      .eq("id", data.id)
      .eq("doctor_id", doctorId);
    return error ? { ok: false as const, motivo: "falhou" as const } : { ok: true as const };
  });

export const bloquearPeriodo = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        /* Com fuso, sempre: o valor sai de um `datetime-local`, que devolve
           hora sem fuso, e mandá-lo cru para `timestamptz` são três horas de
           erro no Brasil. A conversão é `deCampoLocal`, na tela. */
        inicio: z.string().datetime({ offset: true }),
        fim: z.string().datetime({ offset: true }),
        motivo: z.string().trim().max(200),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const doctorId = await medicoLogado(data.accessToken);
    if (!doctorId) return { ok: false as const, motivo: "sem_permissao" as const };
    if (new Date(data.fim) <= new Date(data.inicio))
      return { ok: false as const, motivo: "faixa_invertida" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("doctor_blocks").insert({
      doctor_id: doctorId,
      starts_at: data.inicio,
      ends_at: data.fim,
      reason: data.motivo || null,
    });
    if (error) {
      const { faltaNoBanco } = await import("./postgrest");
      if (faltaNoBanco(error)) return { ok: false as const, motivo: "sem_tabela" as const };
      return { ok: false as const, motivo: "falhou" as const };
    }
    return { ok: true as const };
  });

export const desbloquearPeriodo = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const doctorId = await medicoLogado(data.accessToken);
    if (!doctorId) return { ok: false as const, motivo: "sem_permissao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("doctor_blocks")
      .delete()
      .eq("id", data.id)
      .eq("doctor_id", doctorId);
    return error ? { ok: false as const, motivo: "falhou" as const } : { ok: true as const };
  });

/* ─────────────────────── O QUE A PACIENTE ENXERGA ─────────────────────── */

/**
 * Os horários livres de um médico, num intervalo.
 *
 * ─── O QUE NÃO SAI DAQUI ────────────────────────────────────────────────────
 *
 * Só `{dia, hora}`. Nem quem ocupou os outros, nem quantos existiam, nem se o
 * buraco é bloqueio ou consulta — porque a lista de ocupados é feita de
 * consultas de OUTRAS pacientes, e qualquer detalhe a mais é vazamento.
 *
 * ─── QUEM PODE PERGUNTAR ────────────────────────────────────────────────────
 *
 * Quem estiver logada e vinculada a esse médico. `doctorId` vem do corpo do
 * pedido, então sem essa conferência qualquer paciente montaria a agenda de
 * qualquer médico da plataforma — e saberia, pelos buracos, quando cada um
 * atende.
 */
export const horariosLivresDoMedico = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        doctorId: z.string().uuid(),
        de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        tipo: z.enum(["presencial", "teleconsulta"]).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: quem, error: erroAuth } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (erroAuth || !quem.user) return { ok: false as const, motivo: "sem_permissao" as const };

    /* Vínculo ATUAL, e não um carimbo antigo: encerrado o acompanhamento, ela
       para de enxergar a agenda dele no mesmo instante. O próprio médico também
       passa (é ele conferindo o que a paciente vai ver). */
    if (quem.user.id !== data.doctorId) {
      const { data: perfil } = await (supabaseAdmin as any)
        .from("patient_profiles")
        .select("doctor_id")
        .eq("id", quem.user.id)
        .maybeSingle();
      if (!perfil || perfil.doctor_id !== data.doctorId)
        return { ok: false as const, motivo: "sem_vinculo" as const };
    }

    const [g, b, ap, tc] = await Promise.all([
      (supabaseAdmin as any)
        .from("doctor_slots")
        .select("weekday, start_time, end_time, slot_minutes, kind")
        .eq("doctor_id", data.doctorId),
      (supabaseAdmin as any)
        .from("doctor_blocks")
        .select("starts_at, ends_at")
        .eq("doctor_id", data.doctorId)
        .lte("starts_at", `${data.ate}T23:59:59Z`)
        .gte("ends_at", `${data.de}T00:00:00Z`),
      /* Só o que é COMPROMISSO ocupa horário: um pedido ainda não confirmado é
         um "quem sabe" que ninguém aceitou, e deixá-lo bloquear faria o
         calendário esconder horários que estão livres de verdade. */
      (supabaseAdmin as any)
        .from("appointment_requests")
        .select("confirmed_date, confirmed_time")
        .eq("doctor_id", data.doctorId)
        .eq("status", "confirmed")
        .gte("confirmed_date", data.de)
        .lte("confirmed_date", data.ate),
      (supabaseAdmin as any)
        .from("teleconsulta_sessions")
        .select("scheduled_for")
        .eq("doctor_id", data.doctorId)
        .not("scheduled_for", "is", null)
        .neq("status", "encerrada"),
    ]);

    if (g.error) {
      const { faltaNoBanco } = await import("./postgrest");
      if (faltaNoBanco(g.error)) return { ok: false as const, motivo: "sem_tabela" as const };
      return { ok: false as const, motivo: "falhou" as const };
    }

    const regras: RegraDaGrade[] = ((g.data ?? []) as any[])
      .filter((r) => !data.tipo || r.kind === "ambos" || r.kind === data.tipo)
      .map((r) => ({
        diaDaSemana: r.weekday as number,
        inicio: hhmm(r.start_time),
        fim: hhmm(r.end_time),
        minutos: r.slot_minutes as number,
      }));

    const bloqueios: Bloqueio[] = ((b.data ?? []) as any[]).map((x) => ({
      inicio: x.starts_at as string,
      fim: x.ends_at as string,
    }));

    const ocupados: HorarioLivre[] = [];
    for (const a of (ap.data ?? []) as any[]) {
      if (a.confirmed_date && a.confirmed_time) {
        ocupados.push({ dia: String(a.confirmed_date), hora: hhmm(String(a.confirmed_time)) });
      }
    }
    /* A teleconsulta é a única fonte que guarda INSTANTE. A conversão para o
       relógio do consultório acontece aqui, na fronteira, e num lugar só. */
    for (const t of (tc.data ?? []) as any[]) {
      const p = paredeDaClinica(String(t.scheduled_for));
      if (p) ocupados.push(p);
    }

    /* Falha na leitura dos ocupados NÃO vira "está tudo livre": ofereceríamos
       horários já marcados, e a paciente marcaria em cima de outra pessoa. */
    if (ap.error || tc.error) return { ok: false as const, motivo: "falhou" as const };

    return {
      ok: true as const,
      livres: horariosLivres({
        regras,
        de: data.de,
        ate: data.ate,
        bloqueios,
        ocupados,
        agora: new Date(),
      }),
    };
  });
