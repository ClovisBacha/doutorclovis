import { ALL_SYMPTOMS, assessLevel, LEVEL_FALLBACK, type RiskLevel } from "@/lib/triage";

/**
 * A TRIAGEM QUE NÃO DEPENDE DE REDE.
 *
 * O nível sai da régua determinística do site (`assessLevel`) — a mesma que o
 * servidor aplica; a IA de lá só reescreve a mensagem. Então a orientação
 * aparece SEMPRE, com ou sem internet, e o servidor nunca pode rebaixá-la.
 */

/** No Modo Cuidado sai o único sintoma que fala do bebê. */
export function sintomasParaMarcar(cuidado: boolean) {
  return cuidado ? ALL_SYMPTOMS.filter((s) => s.id !== "movimentos") : ALL_SYMPTOMS;
}

/**
 * No Modo Cuidado o verde não pode mandar "continuar o pré-natal": ela não
 * está mais grávida. Os outros dois níveis falam do corpo dela e valem igual.
 */
const VERDE_NO_CUIDADO =
  "Você não marcou sinais de alerta. Se algo mudar ou piorar, procure atendimento — e, em dúvida, ligue 192.";

export function orientacaoLocal(
  ids: string[],
  pressao: { systolic: number | null; diastolic: number | null },
  cuidado: boolean,
): { level: RiskLevel; reasons: string[]; message: string } {
  const { level, reasons } = assessLevel(ids, pressao);
  const message = cuidado && level === "verde" ? VERDE_NO_CUIDADO : LEVEL_FALLBACK[level];
  return { level, reasons, message };
}

const ORDEM: Record<RiskLevel, number> = { vermelho: 0, amarelo: 1, verde: 2 };

/** O pior dos dois níveis — a resposta do servidor só pode SUBIR o local. */
export function piorNivel(a: RiskLevel, b: RiskLevel): RiskLevel {
  return ORDEM[a] <= ORDEM[b] ? a : b;
}
