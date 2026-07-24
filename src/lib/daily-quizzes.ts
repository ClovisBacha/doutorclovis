/**
 * Quiz diário da gestação — "a professora do app".
 *
 * Um exercício por dia gestacional D (semanas 1-40 × 7 dias): uma mini-lição
 * mais rica (teach) + uma curiosidade opcional (funFact) + 4 a 5 perguntas
 * variadas (escolha única ou "marque todas"), estilo Duolingo, com explicação
 * em cada uma. Progressão cronológica, em português acolhedor.
 *
 * Indexação: D = semana*7 + diaDaSemana (0..6) → D vai de 7 (semana 1, dia 1)
 * a 286 (semana 40, dia 7).
 *
 * Ritmo pedagógico por dia da semana (spaced repetition):
 *   0 · O bebê hoje        1 · Seu corpo          2 · Nutrição & hábitos
 *   3 · Sinais & segurança 4 · Exames & consultas 5 · Bem-estar & vínculo
 *   6 · Revisão da semana
 *
 * O conteúdo vive em daily-quizzes.data.json (280 entradas). O normalizador
 * abaixo aceita TANTO o formato novo (`questions[]`) quanto o antigo
 * (`q1`/`q2`), para a migração do conteúdo nunca quebrar o app.
 */
import raw from "./daily-quizzes.data.json";

/**
 * Uma pergunta. "choice" = uma correta; "multi" = marque todas.
 *
 * O rótulo aparece como `type` no JSON e como `kind` no formato legado — os
 * dois são aceitos. Na prática o sinal decisivo é `a` ser array, mas ler só
 * `kind` deixava `type` morto e a divergência passava despercebida.
 */
export type QuizQuestion = {
  kind?: "choice" | "multi";
  type?: "choice" | "multi";
  q: string;
  o: string[];
  /** Índice da correta (choice) ou lista de índices corretos (multi). */
  a: number | number[];
  why: string;
};

export type DailyQuiz = {
  teach: string;
  /** "Você sabia?" — curiosidade curta para engajar (opcional). */
  funFact?: string;
  questions: QuizQuestion[];
};

/** Formato bruto no JSON: novo (`questions`) ou legado (`q1`/`q2`). */
type RawQuiz = {
  teach: string;
  funFact?: string;
  questions?: QuizQuestion[];
  q1?: QuizQuestion;
  q2?: QuizQuestion;
};

/** Emoji rotativo do dia (variedade visual; o tema real vem do próprio teach). */
const QUIZ_EMOJIS = ["👶", "🤰", "🥗", "🛟", "🩺", "💛", "⭐"] as const;

const RAW = raw as unknown as Record<string, RawQuiz>;

/** Converte qualquer formato bruto no shape canônico com `questions[]`. */
function normalize(r: RawQuiz): DailyQuiz {
  const questions = r.questions ?? [r.q1, r.q2].filter((q): q is QuizQuestion => !!q);
  return { teach: r.teach, funFact: r.funFact, questions };
}

/** Quiz do dia gestacional D (semanas 1-40); null fora da faixa (pós-data). */
export function quizForDay(D: number): DailyQuiz | null {
  const r = RAW[String(D)];
  return r ? normalize(r) : null;
}

export function quizEmojiForDay(D: number) {
  return QUIZ_EMOJIS[D % 7];
}

/** "Marque todas"? True quando é kind:"multi" OU o gabarito é uma lista. */
export function isMultiQuestion(q: QuizQuestion): boolean {
  return q.kind === "multi" || Array.isArray(q.a);
}

/** Uma resposta está correta? Lida com escolha única e "marque todas". */
export function isAnswerCorrect(q: QuizQuestion, answer: number | number[] | null): boolean {
  if (answer == null) return false;
  if (isMultiQuestion(q)) {
    const correct = Array.isArray(q.a) ? q.a : [q.a];
    const given = Array.isArray(answer) ? answer : [answer];
    if (given.length !== correct.length) return false;
    const set = new Set(correct);
    return given.every((i) => set.has(i));
  }
  const correct = Array.isArray(q.a) ? q.a[0] : q.a;
  return answer === correct;
}
