/**
 * Quiz diário da gestação — "a professora do app".
 *
 * 280 exercícios (semanas 1-40 × 7 dias): cada dia gestacional D tem uma
 * mini-lição (teach) + 2 perguntas com explicação, em progressão cronológica.
 * Indexação: D = semana*7 + diaDaSemana (0..6) → D vai de 7 (semana 1, dia 1)
 * a 286 (semana 40, dia 7).
 *
 * Ritmo pedagógico fixo por dia da semana (spaced repetition):
 *   0 · O bebê hoje        1 · Seu corpo          2 · Nutrição & hábitos
 *   3 · Sinais & segurança 4 · Exames & consultas 5 · Bem-estar & vínculo
 *   6 · Revisão da semana
 *
 * O conteúdo vive em daily-quizzes.data.json (280 entradas) e é validado no
 * build por scripts/check-quizzes — este módulo só tipa e indexa.
 */
import raw from "./daily-quizzes.data.json";

export type QuizQuestion = {
  q: string;
  o: [string, string, string];
  a: number; // índice da correta (0..2)
  why: string;
};

export type DailyQuiz = {
  teach: string;
  q1: QuizQuestion;
  q2: QuizQuestion;
};

/** Emoji rotativo do dia (variedade visual; o tema real vem do próprio teach). */
const QUIZ_EMOJIS = ["👶", "🤰", "🥗", "🛟", "🩺", "💛", "⭐"] as const;

const QUIZZES = raw as unknown as Record<string, DailyQuiz>;

/** Quiz do dia gestacional D (semanas 1-40); null fora da faixa (pós-data). */
export function quizForDay(D: number): DailyQuiz | null {
  return QUIZZES[String(D)] ?? null;
}

export function quizEmojiForDay(D: number) {
  return QUIZ_EMOJIS[D % 7];
}
