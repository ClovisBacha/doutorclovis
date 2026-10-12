/**
 * O DIA DA JORNADA — a mesma régua do site (gestacao-path.tsx), em puro.
 *
 * D = semana * 7 + diaDaSemana (0–6). A aula, o desafio, a carta e a pergunta
 * da gratidão são todos indexados por D, então um D diferente do site daria
 * conteúdo diferente no app e no navegador para a mesma paciente no mesmo dia.
 *
 * Sem react-native aqui: é testado pelo bun.
 */

export const D_MINIMO = 7;
export const D_MAXIMO = 300;
export const SEMANA_MINIMA = 1;
export const SEMANA_MAXIMA = 42;

/** O dia gestacional da jornada, preso à faixa coberta pelo conteúdo (7–300). */
export function diaDaJornada(totalDays: number): number {
  const d = Math.floor(Number.isFinite(totalDays) ? totalDays : D_MINIMO);
  return Math.min(D_MAXIMO, Math.max(D_MINIMO, d));
}

export function semanaDoDia(D: number): number {
  return Math.min(SEMANA_MAXIMA, Math.max(SEMANA_MINIMA, Math.floor(D / 7)));
}

/** "dia 4" na notação da trilha do site: (D % 7) + 1. */
export function diaNaSemana(D: number): number {
  return (((D % 7) + 7) % 7) + 1;
}

export type Tema = { chave: string; rotulo: string; emoji: string };

/** O ritmo pedagógico por D % 7 — vale para a aula e para o desafio. */
export const TEMAS: readonly Tema[] = [
  { chave: "bebe", rotulo: "O bebê hoje", emoji: "👶" },
  { chave: "corpo", rotulo: "Seu corpo", emoji: "🤰" },
  { chave: "nutricao", rotulo: "Nutrição e hábitos", emoji: "🥗" },
  { chave: "sinais", rotulo: "Sinais e segurança", emoji: "🛟" },
  { chave: "exames", rotulo: "Exames e consultas", emoji: "🩺" },
  { chave: "vinculo", rotulo: "Bem-estar e vínculo", emoji: "💛" },
  { chave: "revisao", rotulo: "Revisão da semana", emoji: "⭐" },
];

export function temaDoDia(D: number): Tema {
  return TEMAS[((D % 7) + 7) % 7];
}

/** Os sete dias (D) da semana gestacional. */
export function diasDaSemana(semana: number): number[] {
  return Array.from({ length: 7 }, (_, i) => semana * 7 + i);
}

/** A data civil em que o dia D acontece, sabendo que hoje é `hojeD`. */
export function dataDoDia(D: number, hojeD: number, hoje: Date): Date {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  d.setDate(d.getDate() + (D - hojeD));
  return d;
}

const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
const DIAS_LONGOS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
] as const;

export function diaCurto(d: Date): string {
  return DIAS_CURTOS[d.getDay()];
}

export function diaLongo(d: Date): string {
  return DIAS_LONGOS[d.getDay()];
}

/** "amanhã", "na quinta-feira", "em 12/10" — quando um dia futuro abre. */
export function quandoAbre(D: number, hojeD: number, hoje: Date): string {
  const faltam = D - hojeD;
  if (faltam <= 0) return "hoje";
  if (faltam === 1) return "amanhã";
  const d = dataDoDia(D, hojeD, hoje);
  if (faltam < 7) {
    const nome = diaLongo(d);
    return d.getDay() === 0 || d.getDay() === 6 ? `no ${nome}` : `na ${nome}`;
  }
  return `em ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * A idade do bebê em dias, contada em datas CIVIS locais (nunca em UTC: das
 * 21h à meia-noite o UTC já está em amanhã).
 */
export function idadeEmDias(nascimentoYmd: string, hoje: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(nascimentoYmd ?? "");
  if (!m) return null;
  const nasc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const h = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dias = Math.round((h - nasc) / 86_400_000);
  return dias < 0 ? null : dias;
}

/** No pós-parto, D = idade do bebê em dias + 7 (a régua do site). */
export function diaDoPosParto(idadeDias: number): number {
  return Math.max(0, Math.floor(idadeDias)) + 7;
}

/** "dd/mm" de um instante ISO, no fuso do aparelho. */
export function dataCurta(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
