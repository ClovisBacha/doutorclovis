// Triagem de sintomas na gestação.
//
// IMPORTANTE: o NÍVEL de risco (verde/amarelo/vermelho) é definido por REGRAS
// determinísticas, nunca por IA. A IA (quando configurada) apenas escreve uma
// explicação acolhedora em cima do resultado das regras — ela não pode rebaixar
// um sinal de alerta. Isto não substitui avaliação médica.

export type RiskLevel = "verde" | "amarelo" | "vermelho";

export type Symptom = { id: string; label: string; severity: "vermelho" | "amarelo" };

// Sinais de alerta graves → procurar atendimento imediatamente.
export const RED_SYMPTOMS: Symptom[] = [
  { id: "sangramento", label: "Sangramento vaginal", severity: "vermelho" },
  { id: "perda_liquido", label: "Perda de líquido (bolsa rompida)", severity: "vermelho" },
  { id: "dor_abdominal", label: "Dor abdominal forte e persistente", severity: "vermelho" },
  { id: "movimentos", label: "Redução dos movimentos do bebê", severity: "vermelho" },
  { id: "cefaleia_visao", label: "Dor de cabeça forte com visão turva", severity: "vermelho" },
  { id: "convulsao", label: "Convulsão, desmaio ou confusão", severity: "vermelho" },
  { id: "febre", label: "Febre acima de 38 °C", severity: "vermelho" },
  { id: "falta_ar", label: "Falta de ar súbita ou dor no peito", severity: "vermelho" },
  { id: "inchaco_subito", label: "Inchaço súbito no rosto e mãos", severity: "vermelho" },
  { id: "contracoes", label: "Contrações regulares antes de 37 semanas", severity: "vermelho" },
];

// Sinais de atenção → falar com o consultório.
export const YELLOW_SYMPTOMS: Symptom[] = [
  { id: "vomito", label: "Vômitos persistentes", severity: "amarelo" },
  { id: "ardor_urinar", label: "Ardor ou dor ao urinar", severity: "amarelo" },
  { id: "dor_lombar", label: "Dor lombar contínua", severity: "amarelo" },
  { id: "inchaco_pes", label: "Inchaço nos pés e tornozelos", severity: "amarelo" },
  { id: "tontura", label: "Tonturas leves", severity: "amarelo" },
  { id: "coceira", label: "Coceira intensa nas mãos e pés", severity: "amarelo" },
];

export const ALL_SYMPTOMS = [...RED_SYMPTOMS, ...YELLOW_SYMPTOMS];

export function assessLevel(
  selectedIds: string[],
  vitals?: { systolic?: number | null; diastolic?: number | null },
): { level: RiskLevel; reasons: string[] } {
  const selected = new Set(selectedIds);
  const reasons: string[] = [];
  let hasRed = false;
  let hasYellow = false;

  for (const s of ALL_SYMPTOMS) {
    if (selected.has(s.id)) {
      reasons.push(s.label);
      if (s.severity === "vermelho") hasRed = true;
      else hasYellow = true;
    }
  }

  const sys = vitals?.systolic ?? null;
  const dia = vitals?.diastolic ?? null;
  if ((sys != null && sys >= 160) || (dia != null && dia >= 110)) {
    reasons.push("Pressão arterial muito elevada");
    hasRed = true;
  } else if ((sys != null && sys >= 140) || (dia != null && dia >= 90)) {
    reasons.push("Pressão arterial elevada");
    hasYellow = true;
  }

  const level: RiskLevel = hasRed ? "vermelho" : hasYellow ? "amarelo" : "verde";
  return { level, reasons };
}

export const LEVEL_FALLBACK: Record<RiskLevel, string> = {
  vermelho:
    "Os sinais que você marcou podem ser graves na gestação. Procure atendimento agora: ligue 192 (SAMU) ou vá ao pronto-socorro/maternidade mais próxima. Não espere.",
  amarelo:
    "Os sinais que você marcou merecem atenção. Entre em contato com o consultório do seu médico ainda hoje para avaliar. Se piorar, procure atendimento.",
  verde:
    "Você não marcou sinais de alerta. Continue o acompanhamento pré-natal normalmente e registre como está se sentindo. Qualquer dúvida, fale com o consultório.",
};
