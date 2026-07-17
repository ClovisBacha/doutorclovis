import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Escapa texto do usuário antes de interpolar em HTML de e-mail (anti-injeção). */
function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const Schema = z.object({
  patient_name: z.string().min(2).max(120),
  patient_email: z.string().email().max(160),
  patient_phone: z.string().min(8).max(40),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferred_time: z.string().min(3).max(20),
  reason: z.string().min(3).max(200),
  notes: z.string().max(1000).optional().nullable(),
  /** Honeypot anti-spam: campo invisível no form — humano nunca preenche. */
  website: z.string().max(200).optional().nullable(),
});

/**
 * Resolve o médico dono desta consulta pelo e-mail da paciente (a consulta é
 * pública, sem sessão — o e-mail é a chave). email → uid (RPC
 * get_user_id_by_email, a mesma de secondbrain.server.ts) → doctor_id do perfil.
 * Best-effort: qualquer falha ou paciente sem médico escolhido → null (a
 * consulta ainda é criada; só não fica vinculada a um médico assinante).
 */
async function resolveDoctorIdForEmail(email: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: uid, error } = await (supabaseAdmin as any).rpc("get_user_id_by_email", {
      p_email: email.toLowerCase(),
    });
    if (error || !uid) return null;
    const { data: profile } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select("doctor_id")
      .eq("id", uid)
      .maybeSingle();
    return (profile?.doctor_id as string | null) ?? null;
  } catch {
    return null;
  }
}

export const submitAppointmentRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data }) => {
    // Bot preencheu o honeypot → finge sucesso e descarta (sem insert, sem
    // e-mail). Responder "ok" evita que o script perceba e mude de tática.
    if (data.website) return { ok: true as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const doctorId = await resolveDoctorIdForEmail(data.patient_email);
    const { error } = await (supabaseAdmin as any).from("appointment_requests").insert({
      patient_name: data.patient_name,
      patient_email: data.patient_email.toLowerCase(),
      patient_phone: data.patient_phone,
      preferred_date: data.preferred_date,
      preferred_time: data.preferred_time,
      reason: data.reason,
      notes: data.notes ?? null,
      doctor_id: doctorId,
    });
    if (error) {
      console.error("appointment insert failed", error);
      return {
        ok: false as const,
        error: "Não foi possível enviar agora. Tente novamente em instantes.",
      };
    }

    // Confirmação para a paciente + aviso para o consultório (não bloqueia o
    // fluxo se o e-mail falhar ou não estiver configurado).
    try {
      const { sendEmail, emailLayout } = await import("@/lib/email.server");
      const dataBr = new Date(data.preferred_date + "T00:00:00").toLocaleDateString("pt-BR");
      const resumo = `
        <p style="margin:0 0 6px"><strong>Data preferida:</strong> ${dataBr} às ${esc(data.preferred_time)}</p>
        <p style="margin:0 0 6px"><strong>Motivo:</strong> ${esc(data.reason)}</p>
        ${data.notes ? `<p style="margin:0 0 6px"><strong>Observações:</strong> ${esc(data.notes)}</p>` : ""}`;

      await sendEmail({
        to: data.patient_email,
        replyTo: process.env.ADMIN_EMAILS?.split(",")[0]?.trim(),
        subject: "Recebemos seu pedido de consulta 💛",
        html: emailLayout(
          `Olá, ${esc(data.patient_name.split(" ")[0])}!`,
          `<p style="margin:0 0 14px">Recebemos sua solicitação de consulta. Nossa equipe vai confirmar o horário disponível com o seu médico em até 1 dia útil.</p>
           ${resumo}
           <p style="margin:14px 0 0;font-size:13px;color:#9b8178">Em caso de urgência, ligue 192 (SAMU) ou procure o pronto-socorro.</p>`,
        ),
      });

      const notify = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (notify.length) {
        await sendEmail({
          to: notify,
          replyTo: data.patient_email,
          subject: `Novo pedido de consulta — ${data.patient_name}`,
          html: emailLayout(
            "Novo pedido de consulta",
            `<p style="margin:0 0 6px"><strong>Paciente:</strong> ${esc(data.patient_name)}</p>
             <p style="margin:0 0 6px"><strong>Contato:</strong> ${esc(data.patient_phone)} · ${esc(data.patient_email)}</p>
             ${resumo}
             <p style="margin:14px 0 0"><a href="https://www.obstetrica.com.br/painel" style="color:#a85a44">Abrir o painel do médico →</a></p>`,
          ),
        });
      }
    } catch (e) {
      console.error("appointment email failed", e);
    }

    return { ok: true as const };
  });

/* ── Consultas da própria paciente (fecha o ciclo médico→paciente) ─────────
   A tabela não tem user_id (o agendamento é público, por e-mail); o vínculo
   é o e-mail da conta logada. Server function com service role: a RLS de
   SELECT é só do admin, então a paciente lê via servidor, nunca direto. */

export type MyAppointment = {
  id: string;
  preferred_date: string;
  preferred_time: string;
  confirmed_date: string | null;
  confirmed_time: string | null;
  status: "pending" | "confirmed" | "done" | "cancelled";
  reason: string;
  price_brl: number | null;
  payment_status: string | null;
  created_at: string;
};

export const getMyAppointments = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: uerr } = await supabaseAdmin.auth.getUser(data.accessToken);
    const email = u?.user?.email;
    if (uerr || !email) return { ok: false as const, appointments: [] as MyAppointment[] };
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("appointment_requests")
      .select(
        "id, preferred_date, preferred_time, confirmed_date, confirmed_time, status, reason, price_brl, payment_status, created_at",
      )
      // ilike mantém a insensibilidade a maiúsculas para linhas antigas, mas o
      // e-mail precisa ter %/_ escapados: sem isso viram curingas LIKE e uma
      // conta maria_jose@ leria as consultas de maria.jose@ (vazamento).
      .ilike("patient_email", email.replace(/([\\%_])/g, "\\$1"))
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("getMyAppointments failed", error);
      return { ok: false as const, appointments: [] as MyAppointment[] };
    }
    return { ok: true as const, appointments: (rows ?? []) as MyAppointment[] };
  });
