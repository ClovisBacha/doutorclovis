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
 * O conteúdo vive em daily-quizzes.data.json (294 entradas). O normalizador
 * abaixo aceita TANTO o formato novo (`questions[]`) quanto o antigo
 * (`q1`/`q2`), para a migração do conteúdo nunca quebrar o app.
 *
 * ─── ⚠️ O JSON NÃO ENTRA NO PACOTE PRINCIPAL (ago/2026) ─────────────────────
 *
 * Ele tem 674 KB. Com `import raw from "./daily-quizzes.data.json"` o Vite o
 * embutia dentro do chunk de `gestacao-path` — MEDIDO: 892 KB crus, 264 KB
 * comprimidos, e o banco de aulas sozinho era a maior fatia disso. Pior: esse
 * chunk baixa junto com a tela de Minha Conta INTEIRA, mesmo quando a paciente
 * nunca abre a aba Caminho naquele dia. No 4G, à noite, é o "app estragado"
 * que o dono relatou.
 *
 * Agora é `import()` dinâmico: o Vite corta o JSON num arquivo próprio, e ele
 * só desce quando alguém abre o dia. As 294 aulas são 674 KB para entregar UMA
 * de cada vez — baixar as 293 que ela não vai ler hoje é o desperdício inteiro.
 *
 * ⚠️ Isto torna a leitura ASSÍNCRONA, e é de propósito que não existe um
 * `quizForDay` síncrono lendo um cache: ele devolveria `null` no primeiro
 * render, e "não tem aula hoje" é indistinguível de "ainda não carregou". Quem
 * precisa decidir sem esperar usa `temQuizNoDia`, que é FAIXA, não conteúdo.
 */

/**
 * A faixa coberta pelo banco de aulas — 7 (semana 1, dia 1) a 300 (semana 42,
 * dia 6), sem buracos.
 *
 * ⚠️ São CONSTANTES, e não `Object.keys(RAW)`, porque a pergunta "existe aula
 * neste dia?" precisa ser respondida ANTES de baixar os 674 KB — é ela que
 * decide se a intro da aula roda e se o dia mostra aula ou desafio. Ler a
 * cobertura do próprio JSON o traria de volta pro pacote e desfaria a mudança
 * inteira.
 *
 * `daily-quizzes.test.ts` confere estes dois números contra o arquivo real e
 * cobra que não haja buraco no meio — é o teste que impede a constante de
 * mentir depois que alguém acrescentar ou tirar um dia.
 */
export const QUIZ_PRIMEIRO_DIA = 7;
export const QUIZ_ULTIMO_DIA = 300;

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

/**
 * Existe aula neste dia? Responde SEM baixar o banco.
 *
 * É o que decide se a intro roda e se o dia abre com aula ou com desafio —
 * duas decisões que acontecem no toque, antes de qualquer espera.
 */
export function temQuizNoDia(D: number): boolean {
  return Number.isFinite(D) && D >= QUIZ_PRIMEIRO_DIA && D <= QUIZ_ULTIMO_DIA;
}

/** Converte qualquer formato bruto no shape canônico com `questions[]`. */
function normalize(r: RawQuiz): DailyQuiz {
  const questions = r.questions ?? [r.q1, r.q2].filter((q): q is QuizQuestion => !!q);
  return { teach: r.teach, funFact: r.funFact, questions };
}

/**
 * O banco, baixado UMA vez por sessão.
 *
 * A PROMESSA é guardada (e não só o resultado) de propósito: dois toques
 * rápidos em dias diferentes chegam aqui antes de o primeiro `import()`
 * resolver, e guardar só o resultado faria os dois baixarem. Mesmo raciocínio
 * da fila `emVoo` do service worker.
 */
let bancoEmVoo: Promise<Record<string, RawQuiz>> | null = null;

function banco(): Promise<Record<string, RawQuiz>> {
  if (!bancoEmVoo) {
    bancoEmVoo = import("./daily-quizzes.data.json")
      .then((m) => (m.default ?? m) as unknown as Record<string, RawQuiz>)
      .catch((e) => {
        /* Rede caída no meio do download: solta a promessa para a próxima
           tentativa poder acontecer. Sem isto, uma falha única deixaria a aula
           indisponível pelo resto da sessão. */
        bancoEmVoo = null;
        throw e;
      });
  }
  return bancoEmVoo;
}

/**
 * A aula do dia gestacional D; `null` fora da faixa (pós-data) ou se o
 * download falhar — aí a tela cai no desafio do dia, que é local.
 */
export async function carregarQuizDoDia(D: number): Promise<DailyQuiz | null> {
  if (!temQuizNoDia(D)) return null;
  try {
    const r = (await banco())[String(D)];
    return r ? normalize(r) : null;
  } catch {
    return null;
  }
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
