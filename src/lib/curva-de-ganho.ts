/**
 * A FAIXA DE GANHO DE PESO RECOMENDADA NA GESTAÇÃO (curva do IOM/NAM 2009).
 *
 * ⚠️ **A RÉGUA MORA AQUI PORQUE JÁ SÃO DOIS LEITORES.** Ela nasceu privada
 * dentro de `health-tab.tsx`, e a nutricionista passou a precisar dela para
 * saber se a paciente está dentro, abaixo ou acima da faixa — sem isso ela
 * "personalizava" sem conhecer o dado mais básico. Duas cópias divergiriam no
 * primeiro ajuste, e a divergência apareceria como o gráfico dizendo uma coisa
 * e a nutricionista dizendo outra sobre o mesmo peso.
 *
 * ⚠️ **É FAIXA DE REFERÊNCIA, NUNCA META.** Nada nesta base transforma o
 * resultado em cobrança: quem define o alvo de uma gestante de alto risco é o
 * médico dela. `posicaoNaFaixa` devolve o FATO ("abaixo", "dentro", "acima") e
 * quem escreve a frase decide o tom.
 */

/** IMC pré-gestacional a partir do peso (kg) e da altura (cm). */
export function imcPreGestacional(pesoKg: number, alturaCm: number): number | null {
  if (!Number.isFinite(pesoKg) || !Number.isFinite(alturaCm)) return null;
  if (pesoKg < 25 || alturaCm < 100 || alturaCm > 250) return null;
  const m = alturaCm / 100;
  return pesoKg / (m * m);
}

/** Ganho acumulado esperado, em kg, na semana `week` para quem tinha esse IMC. */
export function iomGain(week: number, bmi: number): { min: number; max: number } {
  let rMin: number, rMax: number;
  if (bmi < 18.5) {
    rMin = 0.44;
    rMax = 0.58;
  } else if (bmi < 25) {
    rMin = 0.35;
    rMax = 0.5;
  } else if (bmi < 30) {
    rMin = 0.23;
    rMax = 0.33;
  } else {
    rMin = 0.17;
    rMax = 0.27;
  }

  if (week <= 12) {
    const f = week / 12;
    return { min: f * 0.5, max: f * 2.0 };
  }
  return { min: 0.5 + (week - 12) * rMin, max: 2.0 + (week - 12) * rMax };
}

/** Como o nutricionista chama a faixa do IMC — entra na frase, não na conta. */
export function faixaDoImc(
  bmi: number,
): "baixo peso" | "peso adequado" | "sobrepeso" | "obesidade" {
  if (bmi < 18.5) return "baixo peso";
  if (bmi < 25) return "peso adequado";
  if (bmi < 30) return "sobrepeso";
  return "obesidade";
}

export type PosicaoNaFaixa = "abaixo" | "dentro" | "acima";

/**
 * Onde o ganho dela cai na faixa daquela semana.
 *
 * ⚠️ Uma folga de 0,5 kg em cada ponta, e ela existe por medida: a balança de
 * casa varia, a roupa pesa, e a paciente que ganhou 0,2 kg a mais que o teto
 * não está "acima do recomendado" — está dentro do erro. Sem a folga, a
 * nutricionista mudaria de discurso por causa de um copo d'água.
 */
export const FOLGA_KG = 0.5;

export function posicaoNaFaixa(ganhoKg: number, week: number, bmi: number): PosicaoNaFaixa {
  const { min, max } = iomGain(week, bmi);
  if (ganhoKg < min - FOLGA_KG) return "abaixo";
  if (ganhoKg > max + FOLGA_KG) return "acima";
  return "dentro";
}
