import type { DailyQuiz } from "@/lib/daily-quizzes";
import TITULOS from "./aulas-do-app.titulos.json";

/**
 * O BANCO DE AULAS DO APP — fase 2 da decisão do dono (21/10/2026): o app é
 * rede social + gamificação, e não conselho médico.
 *
 * O banco do site (`src/lib/daily-quizzes.data.json`, congelado) é um curso
 * de pré-natal: metade dos dias ensina conduta (suplemento e dose, "sangramento:
 * o que fazer?", exames, quando ligar). As aulas do app moram aqui, por dia D,
 * no MESMO formato do site, e cobrem a gestação inteira (D 7–300): nenhum dia
 * cai mais na aula do site, e o app não tem recuo para ela (18/11/2026 — o
 * recuo era o único caminho que ainda puxava o banco do site daqui).
 *
 * ⚠️ O NÚMERO DE PERGUNTAS DE CADA DIA É O DO SITE, e não por estética: o
 * servidor (`grantDailyQuizReward`) paga 5 + 3 por acerto, com os acertos
 * presos ao número de perguntas que a aula DO SITE tem naquele dia. Uma aula
 * do app com uma pergunta a menos pagaria menos; com uma a mais, a última
 * nunca seria paga. `aulas-do-app.test.ts` confere dia a dia.
 *
 * ── O peso (18/11/2026, "o app está travado") ──
 * Os três trimestres somam 880 KB. Importados no topo, o Hermes montava os
 * 294 dias na abertura — antes do primeiro quadro — só para a aba do bebê
 * dizer o assunto da aula de hoje. Agora:
 * - o ASSUNTO de cada dia vem de um índice pequeno
 *   (`aulas-do-app.titulos.json`, gerado por
 *   `bun scripts/gerar-titulos-das-aulas.ts`), já cortado por
 *   `tituloCurtoDaAula`;
 * - a AULA inteira só é montada quando alguém a pede, um trimestre por vez:
 *   o `require` fica dentro da função, e o Metro só executa o módulo do JSON
 *   na primeira chamada.
 * `titulos-das-aulas.test.ts` cobra que o índice bate com as aulas.
 */

type Banco = Readonly<Record<string, DailyQuiz>>;

const PRIMEIRO_DIA = 7;
const ULTIMO_DIA = 300;

/** O último dia de cada arquivo: o 1º trimestre vai até D 97, o 2º até D 195. */
export const FIM_DO_1O_TRIMESTRE = 97;
export const FIM_DO_2O_TRIMESTRE = 195;

const trimestres: (Banco | null)[] = [null, null, null];

function bancoDoDia(D: number): Banco | null {
  if (!Number.isInteger(D) || D < PRIMEIRO_DIA || D > ULTIMO_DIA) return null;
  const i = D <= FIM_DO_1O_TRIMESTRE ? 0 : D <= FIM_DO_2O_TRIMESTRE ? 1 : 2;
  const pronto = trimestres[i];
  if (pronto) return pronto;
  /* Um `require` com o caminho escrito por inteiro em cada ramo: é o que o
     Metro sabe empacotar. */
  const banco = (
    i === 0
      ? require("./aulas-do-app.t1.json")
      : i === 1
        ? require("./aulas-do-app.t2.json")
        : require("./aulas-do-app.t3.json")
  ) as Banco;
  trimestres[i] = banco;
  return banco;
}

const ASSUNTOS = TITULOS as Readonly<Record<string, string>>;

/** Os dias em que a aula é a do app (para os testes e o diário). */
export const DIAS_COM_AULA_DO_APP: readonly number[] = Object.keys(ASSUNTOS)
  .map(Number)
  .sort((a, b) => a - b);

/**
 * O assunto da aula do dia D numa linha curta — o mesmo texto de
 * `tituloCurtoDaAula(aula.teach)`, sem montar a aula. `null` fora de 7–300.
 * É o que a aba do bebê, a Semana e os lembretes mostram.
 */
export function tituloDaAulaDoApp(D: number): string | null {
  return ASSUNTOS[String(D)] ?? null;
}

/**
 * A aula do app no dia D, sem esperar: o banco do app vem no pacote (só o
 * trimestre do dia é montado). `null` fora de 7–300.
 */
export function aulaDoAppNoDia(D: number): DailyQuiz | null {
  return bancoDoDia(D)?.[String(D)] ?? null;
}

/**
 * A aula do dia gestacional D como o app a dá. `null` fora de 7–300: o dia
 * da jornada é preso a essa faixa, e `aulas-do-app.test.ts` cobra que os 294
 * dias estão aqui.
 */
export async function carregarAulaDoDia(D: number): Promise<DailyQuiz | null> {
  return aulaDoAppNoDia(D);
}
