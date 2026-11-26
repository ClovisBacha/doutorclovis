import { computeGestation } from "@/lib/gestacao";
import type { Perfil } from "~/lib/sessao";

/**
 * A gestação da paciente a partir do perfil — pela régua ÚNICA do site
 * (../src/lib/gestacao.ts). O ultrassom, quando existe, manda; senão a DUM.
 *
 * ⚠️ Depois do parto (`birth_date`) a idade gestacional não é mais
 * verdade: computeGestation conta para sempre (até 42 semanas), e mostrar
 * "41 semanas" a quem está com o bebê no colo é o defeito que o site já pagou.
 */
export function gestacaoDoPerfil(perfil: Perfil | null, hoje = new Date()) {
  if (!perfil || perfil.birth_date) return null;
  return computeGestation({
    lmp: perfil.lmp_date ?? null,
    referenceDate: perfil.reference_date ?? null,
    referenceWeeks: perfil.reference_weeks ?? null,
    referenceDays: perfil.reference_days ?? null,
    today: hoje,
  });
}

/** "Hoje" no fuso do aparelho, como AAAA-MM-DD. Nunca toISOString (UTC). */
export function ymdLocal(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

export function primeiroNome(nome: string | null | undefined): string | null {
  const n = (nome ?? "").trim().split(/\s+/)[0];
  return n && n.length > 1 ? n : null;
}
