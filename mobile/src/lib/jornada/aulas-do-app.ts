import { carregarQuizDoDia, type DailyQuiz } from "@/lib/daily-quizzes";
import AULAS_DO_1O_TRIMESTRE from "./aulas-do-app.t1.json";
import AULAS_DO_2O_TRIMESTRE from "./aulas-do-app.t2.json";

/**
 * O BANCO DE AULAS DO APP — fase 2 da decisão do dono (21/10/2026): o app é
 * rede social + gamificação, e não conselho médico.
 *
 * O banco do site (`src/lib/daily-quizzes.data.json`, congelado) é um curso
 * de pré-natal: metade dos dias ensina conduta (suplemento e dose, "sangramento:
 * o que fazer?", exames, quando ligar). As aulas trocadas moram aqui, por dia
 * D, no MESMO formato do site; o dia que não está aqui é a aula do site, que
 * dois juízes independentes acharam 100% dentro das regras.
 *
 * ⚠️ O NÚMERO DE PERGUNTAS DE CADA DIA É O DO SITE, e não por estética: o
 * servidor (`grantDailyQuizReward`) paga 5 + 3 por acerto, com os acertos
 * presos ao número de perguntas que a aula DO SITE tem naquele dia. Uma aula
 * do app com uma pergunta a menos pagaria menos; com uma a mais, a última
 * nunca seria paga. `aulas-do-app.test.ts` confere dia a dia.
 *
 * Por trimestre, um arquivo: o 1º (D 7–97) saiu em 23/10/2026; o 2º (D 98–195),
 * logo depois.
 */
const AULAS_DO_APP: Readonly<Record<string, DailyQuiz>> = {
  ...(AULAS_DO_1O_TRIMESTRE as unknown as Record<string, DailyQuiz>),
  ...(AULAS_DO_2O_TRIMESTRE as unknown as Record<string, DailyQuiz>),
};

/** Os dias em que a aula é a do app (para os testes e o diário). */
export const DIAS_COM_AULA_DO_APP: readonly number[] = Object.keys(AULAS_DO_APP)
  .map(Number)
  .sort((a, b) => a - b);

/**
 * A aula do dia gestacional D como o app a dá: a do app, se o dia foi trocado;
 * senão, a do site. `null` fora da faixa ou se o banco do site não carregar —
 * as aulas do app não dependem dele.
 */
export async function carregarAulaDoDia(D: number): Promise<DailyQuiz | null> {
  const doApp = AULAS_DO_APP[String(D)];
  if (doApp) return doApp;
  return carregarQuizDoDia(D);
}
