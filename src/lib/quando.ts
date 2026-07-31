/**
 * "hoje", "ontem", "há N dias" — contando DIAS DE CALENDÁRIO.
 *
 * Estava escrito duas vezes, igual, em `prontuario-paciente.tsx` e
 * `exames-recebidos.tsx`, e as duas cópias faziam a conta errada:
 *
 *   Math.floor((Date.now() - new Date(iso)) / 86400000)
 *
 * Isso conta PERÍODOS DE 24 HORAS, não dias. As consequências numa linha do
 * tempo clínica:
 *
 *   · uma pressão 168/104 registrada ONTEM às 23h aparece como "hoje" se o
 *     médico abre a tela antes das 23h de hoje — 9 horas depois, mas ainda
 *     dentro das primeiras 24;
 *   · um evento de 47 horas atrás — anteontem — aparece como "ontem".
 *
 * Numa tela em que o médico decide se liga para a paciente agora, "hoje" e
 * "ontem" não são enfeite: são a diferença entre um achado novo e um achado que
 * já passou por uma noite.
 *
 * A conta certa zera a hora dos dois lados NO FUSO LOCAL e compara as datas.
 */

/** Meia-noite local do dia em que `d` cai. */
function meiaNoite(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Dias de calendário entre `iso` e agora. Negativo se `iso` está no futuro.
 * `agora` é injetável para o teste — sem isso não há como testar borda de dia.
 */
export function diasDeCalendario(iso: string, agora: Date = new Date()): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.round((meiaNoite(agora) - meiaNoite(d)) / 86400000);
}

export function quando(iso: string, agora: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dias = diasDeCalendario(iso, agora);
  /* Futuro cai em "hoje" de propósito: um carimbo à frente do relógio é erro de
     fuso ou de relógio do aparelho dela, e "daqui a 2 dias" numa linha do tempo
     do passado confundiria mais do que ajuda. */
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  return d.toLocaleDateString("pt-BR");
}
