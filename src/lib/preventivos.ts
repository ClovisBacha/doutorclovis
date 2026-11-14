/**
 * OS PREVENTIVOS: quando vence, quantos dias faltam, e como isso se escreve.
 *
 * ⚠️ **ISTO MORAVA DENTRO DO `.tsx`, E POR ISSO NUNCA FOI EXERCITADO.** Um
 * teste do componente teria de importar `saude-mulher.tsx`, que arrasta o
 * `sonner` (toca `document` ao carregar) e a árvore inteira da tela — é a mesma
 * lição de `assinatura.ts`, `buscar-paciente.ts` e `gratidao.ts`: régua pura em
 * `lib/`, componente só desenha.
 *
 * ⚠️ **E ELA TINHA DOIS DEFEITOS QUE SÓ APARECEM DEPOIS DO MEIO-DIA.** O
 * cálculo era `Math.round((nextDue - new Date()) / 86400000)` — um INSTANTE
 * contra uma MEIA-NOITE:
 *
 *   · um exame que vence HOJE, consultado às 15h, dá −0,625 → arredonda para
 *     **−1** e a tela escreve **"(1 dias em atraso)"** sobre um rastreamento
 *     que está em dia;
 *   · e um que vence AMANHÃ, consultado às 15h, dá 0,375 → arredonda para 0 e
 *     a tela escreve **"(hoje)"**.
 *
 * O que decide é o DIA CIVIL, nunca a distância em horas — a mesma régua de
 * `diasEntre` em `quando-foi.ts`, que existe por causa deste erro.
 */

const DIA = 86400000;

/**
 * Quantos dias faltam para `alvo`, contando DIAS DO CALENDÁRIO.
 *
 * Positivo = ainda vai vencer · 0 = vence hoje · negativo = já venceu.
 */
export function diasAte(alvo: Date, hoje: Date): number {
  const a = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const b = Date.UTC(alvo.getFullYear(), alvo.getMonth(), alvo.getDate());
  return Math.round((b - a) / DIA);
}

/**
 * A data do próximo exame: a do último mais a frequência, em meses.
 *
 * ⚠️ **`setMonth` TRANSBORDA**, e o caso é real: 31 de maio + 6 meses vira 1º
 * de dezembro, porque novembro tem 30 dias. Passa despercebido porque quase
 * toda frequência daqui é múltipla de 12 (mesmo dia, mesmo mês) — mas
 * `pressao_arterial` e `dentista` são semestrais, e um em cada oito meses tem
 * 31 dias contra 30 do seguinte. Transbordou, recua para o último dia do mês,
 * que é o que "daqui a seis meses" quer dizer.
 */
export function proximaData(ultimo: string | null, meses: number): Date | null {
  if (!ultimo) return null;
  const d = new Date(ultimo + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const diaDoMes = d.getDate();
  d.setMonth(d.getMonth() + meses);
  if (d.getDate() !== diaDoMes) d.setDate(0);
  return d;
}

export type StatusDoExame = "overdue" | "soon" | "ok" | "never";

/**
 * ⚠️ **"Nunca registrado" é o estado de quem não tem data, e não o de quem tem
 * uma data ilegível.** Os dois caem aqui no mesmo lugar de propósito: sem data
 * utilizável não há prazo nenhum a afirmar, e inventar um seria pior.
 */
export function statusDoExame(dias: number | null): StatusDoExame {
  if (dias == null) return "never";
  if (dias < 0) return "overdue";
  if (dias <= 60) return "soon";
  return "ok";
}

/**
 * A frase entre parênteses ao lado da próxima data.
 *
 * ⚠️ **O PLURAL É PARTE DO CONSERTO.** Com a conta antiga a tela chegava a
 * escrever "(1 dias em atraso)" — e ela escrevia isso, justamente, no dia em
 * que o exame vencia. Hoje o dia de vencimento é "(hoje)" e o singular existe.
 */
export function frasePrazo(dias: number | null): string | null {
  if (dias == null) return null;
  if (dias === 0) return "(hoje)";
  if (dias < 0) {
    const n = Math.abs(dias);
    return n === 1 ? "(1 dia em atraso)" : `(${n} dias em atraso)`;
  }
  return dias === 1 ? "(em 1 dia)" : `(em ${dias} dias)`;
}
