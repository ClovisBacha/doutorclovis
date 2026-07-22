import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Escapa texto do usuário antes de interpolar em HTML de e-mail. */
function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const Schema = z.object({
  kind: z.enum(["gestante", "clinica"]),
  name: z.string().min(2).max(120),
  phone: z.string().min(8).max(40),
  email: z.string().email().max(160).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  weeks: z.number().int().min(1).max(42).optional().nullable(),
  clinicName: z.string().max(120).optional().nullable(),
  /** Código da clínica que indicou (?clinica= na URL) — atribuição da parceria. */
  clinicRef: z.string().max(60).optional().nullable(),
  message: z.string().max(1000).optional().nullable(),
});

/**
 * Inscrição na Experiência Perinatal 3D — gestante interessada OU clínica
 * querendo parceria. Grava com service role (tabela sem acesso anon) e avisa
 * a equipe por e-mail; falha de e-mail nunca bloqueia a inscrição.
 */
export const submitExperienceLead = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Schema.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("experience_leads").insert({
      kind: data.kind,
      name: data.name,
      phone: data.phone,
      email: data.email?.toLowerCase() ?? null,
      city: data.city ?? null,
      weeks: data.weeks ?? null,
      clinic_name: data.clinicName ?? null,
      clinic_ref: data.clinicRef ?? null,
      message: data.message ?? null,
    });
    if (error) {
      console.error("experience lead insert failed", error);
      return {
        ok: false as const,
        error: "Não foi possível enviar agora. Tente novamente em instantes.",
      };
    }

    try {
      const { sendEmail, emailLayout } = await import("@/lib/email.server");
      const notify = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (notify.length) {
        const titulo =
          data.kind === "gestante"
            ? "Nova gestante — Experiência Perinatal 3D 💗"
            : "Nova clínica interessada — Experiência Perinatal 3D 🏥";
        await sendEmail({
          to: notify,
          replyTo: data.email ?? undefined,
          subject: titulo,
          html: emailLayout(
            titulo,
            `<p style="margin:0 0 6px"><strong>Nome:</strong> ${esc(data.name)}</p>
             <p style="margin:0 0 6px"><strong>WhatsApp:</strong> ${esc(data.phone)}</p>
             ${data.email ? `<p style="margin:0 0 6px"><strong>E-mail:</strong> ${esc(data.email)}</p>` : ""}
             ${data.city ? `<p style="margin:0 0 6px"><strong>Cidade:</strong> ${esc(data.city)}</p>` : ""}
             ${data.weeks ? `<p style="margin:0 0 6px"><strong>Semanas:</strong> ${data.weeks}</p>` : ""}
             ${data.clinicName ? `<p style="margin:0 0 6px"><strong>Clínica:</strong> ${esc(data.clinicName)}</p>` : ""}
             ${data.clinicRef ? `<p style="margin:0 0 6px"><strong>Indicada pela clínica:</strong> ${esc(data.clinicRef)}</p>` : ""}
             ${data.message ? `<p style="margin:0 0 6px"><strong>Mensagem:</strong> ${esc(data.message)}</p>` : ""}`,
          ),
        });
      }
    } catch (e) {
      console.error("experience lead email failed", e);
    }

    return { ok: true as const };
  });
