/**
 * Para quem, e assinado por quem: o destinatário-médico de um e-mail.
 *
 * Seis lugares diferentes já resolviam "e-mail do médico" na mão
 * (`auth.admin.getUserById`) e nenhum resolvia o NOME — então o e-mail saía
 * assinado pelo fundador mesmo quando o assunto era paciente de outro médico.
 * Pior: quando não havia médico vinculado, vários caíam em `ADMIN_EMAILS`, e
 * dado clínico de paciente ia para a caixa de entrada da plataforma.
 *
 * Aqui a regra fica em um lugar só:
 * - com médico vinculado → e-mail dele, assinado com o nome dele;
 * - sem médico vinculado → `ADMIN_EMAILS` só quando a plataforma é a única
 *   que pode agir (formulário público, sem conta), e nunca assinado por
 *   ninguém em particular.
 */

import type { MarcaEmail } from "@/lib/email.server";

export type DestinoMedico = {
  /** E-mail de login do médico. Vazio = não achou. */
  email: string;
  /** Nome de exibição, já pronto para assinar o e-mail. */
  nome: string;
  /** Assinatura do rodapé: título + especialidade, quando houver. */
  marca: MarcaEmail;
};

const VAZIO: DestinoMedico = { email: "", nome: "", marca: {} };

/**
 * Nome + e-mail do médico. Nunca lança: e-mail é best-effort e não pode
 * derrubar o fluxo que o disparou.
 */
export async function destinoMedico(doctorId: string | null | undefined): Promise<DestinoMedico> {
  if (!doctorId) return VAZIO;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: u }, { data: doc }] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(doctorId),
      (supabaseAdmin as any)
        .from("doctors")
        .select("display_name,title,specialty")
        .eq("id", doctorId)
        .maybeSingle(),
    ]);
    const nome = ((doc?.display_name as string | null) ?? "").trim();
    const titulo = ((doc?.title as string | null) ?? "").trim();
    const espec = ((doc?.specialty as string | null) ?? "").trim();
    return {
      email: u?.user?.email ?? "",
      nome,
      // Só assina com o nome do médico se ele existir. Assinar com o nome
      // errado é pior do que assinar com o nome da plataforma.
      marca: nome ? { nome, linha: [titulo, espec].filter(Boolean).join(" · ") || null } : {},
    };
  } catch {
    return VAZIO;
  }
}

/** E-mails de `ADMIN_EMAILS`, já limpos. */
export function emailsDaPlataforma(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Quem recebe o aviso operacional de uma paciente: o médico dela.
 *
 * `plataformaSeOrfa` existe para o formulário público do site, onde a paciente
 * ainda não escolheu médico — aí a plataforma é a única que pode triar. Em
 * qualquer fluxo dentro do app (paciente logada, com médico) fica `false`:
 * dado clínico não vai para quem não é o médico dela.
 */
export async function avisarMedico(
  doctorId: string | null | undefined,
  opts?: { plataformaSeOrfa?: boolean },
): Promise<{ para: string[]; marca: MarcaEmail; nome: string }> {
  const d = await destinoMedico(doctorId);
  if (d.email) return { para: [d.email], marca: d.marca, nome: d.nome };
  if (opts?.plataformaSeOrfa) return { para: emailsDaPlataforma(), marca: {}, nome: "" };
  return { para: [], marca: {}, nome: "" };
}
