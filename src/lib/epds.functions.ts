import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * EPDS (Escala de Edinburgh) — persistência + alerta ao médico.
 *
 * A página /epds é pública e continua funcionando anônima. Quando a paciente
 * está LOGADA, o resultado é gravado na conta dela (epds_logs) e, se o
 * rastreio for positivo (moderado/alto/urgente), o médico vinculado recebe
 * um e-mail de alerta. Fire-and-forget no cliente: nada disso atrapalha a
 * exibição do resultado.
 */
export const saveEpdsLog = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        score: z.number().int().min(0).max(30),
        q10Score: z.number().int().min(0).max(3),
        level: z.enum(["baixo", "moderado", "alto", "urgente"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: uerr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (uerr || !u?.user) return { ok: false as const };

    const { data: prof } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select("doctor_id, display_name")
      .eq("id", u.user.id)
      .maybeSingle();
    const doctorId = (prof?.doctor_id as string | null) ?? null;

    const { error } = await (supabaseAdmin as any).from("epds_logs").insert({
      user_id: u.user.id,
      doctor_id: doctorId,
      score: data.score,
      q10_score: data.q10Score,
      level: data.level,
    });
    if (error) {
      // Tabela ainda não criada (migração pendente) ou outra falha: loga e
      // segue — o resultado já foi mostrado à paciente.
      console.error("saveEpdsLog insert failed", error);
      return { ok: false as const };
    }

    // Alerta ao médico só em rastreio positivo. Best-effort.
    if (doctorId && data.level !== "baixo") {
      try {
        const { data: du } = await supabaseAdmin.auth.admin.getUserById(doctorId);
        const doctorEmail = du?.user?.email;
        if (doctorEmail) {
          const { sendEmail, emailLayout } = await import("@/lib/email.server");
          const nome = (prof?.display_name as string | null) ?? "Uma paciente sua";
          const urgente = data.level === "urgente";
          await sendEmail({
            to: doctorEmail,
            subject: urgente
              ? `🚨 EPDS URGENTE — ${nome} relatou pensamentos de autolesão`
              : `⚠️ EPDS positivo — ${nome} (escore ${data.score})`,
            html: emailLayout(
              "Alerta de rastreio EPDS",
              `<p style="margin:0 0 8px"><strong>Paciente:</strong> ${nome}</p>
               <p style="margin:0 0 8px"><strong>Escore:</strong> ${data.score}/30 · <strong>Nível:</strong> ${data.level}</p>
               ${
                 urgente
                   ? `<p style="margin:0 0 8px;color:#b0402e"><strong>A questão 10 (pensamentos de se machucar) foi positiva.</strong> Recomenda-se contato imediato.</p>`
                   : `<p style="margin:0 0 8px">Escore ≥ 10 — recomenda-se avaliação na próxima consulta.</p>`
               }
               <p style="margin:14px 0 0;font-size:13px;color:#9b8178">Alerta automático do rastreio EPDS feito pela paciente no app Obstétrica.</p>`,
            ),
          });
        }
      } catch (e) {
        console.error("saveEpdsLog alert email failed", e);
      }
    }

    return { ok: true as const };
  });
