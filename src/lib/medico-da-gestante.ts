/**
 * O MÉDICO QUE ELA CADASTROU — nome, celular e e-mail, guardados em
 * `patient_profiles.medico_nome/medico_celular/medico_email`
 * (`supabase/APLICAR_MEDICO_DA_GESTANTE.sql`).
 *
 * Não é o vínculo da plataforma (`doctor_id`): é só o contato que ela mesma
 * digitou, para o SOS mandar o e-mail e a mensagem de WhatsApp. O app de
 * gestantes (mobile/) não tem médico vinculado; este é o único fio com o
 * médico que ele tem, e existe só para a emergência.
 *
 * Régua pura, usada pelo servidor (`dispararEmergencia`) e pelo app.
 */
export type MedicoCadastrado = {
  nome: string | null;
  /** Só dígitos, com DDI 55 — pronto para wa.me e para a API do WhatsApp. */
  celular: string | null;
  email: string | null;
};

const limpo = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Celular em E.164 sem o "+" (5531999990000), ou null se não for telefone. */
export function celularE164(bruto: unknown): string | null {
  const d = (typeof bruto === "string" ? bruto : "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  return null;
}

export function emailValido(bruto: unknown): string | null {
  const e = limpo(bruto);
  return e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e.toLowerCase() : null;
}

/**
 * Lê a linha do perfil. Sem celular E sem e-mail válidos, não há médico
 * cadastrado — um nome sozinho não avisa ninguém, e fingir que há um médico
 * na ficha seria pior que dizer que não há.
 */
export function medicoCadastrado(linha: unknown): MedicoCadastrado | null {
  if (!linha || typeof linha !== "object") return null;
  const l = linha as Record<string, unknown>;
  const celular = celularE164(l.medico_celular);
  const email = emailValido(l.medico_email);
  if (!celular && !email) return null;
  return { nome: limpo(l.medico_nome), celular, email };
}

/** Como o médico aparece na tela e na mensagem: "Dra. Ana" ou "seu médico". */
export function nomeDoMedico(m: MedicoCadastrado | null): string {
  return m?.nome ?? "seu médico ou médica";
}
