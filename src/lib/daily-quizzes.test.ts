/**
 * A FAIXA DE COBERTURA DAS AULAS NÃO PODE MENTIR.
 *
 * ─── POR QUE ESTE TESTE EXISTE ──────────────────────────────────────────────
 *
 * `daily-quizzes.data.json` tem 674 KB e saiu do pacote principal (virou
 * `import()` dinâmico) porque baixava inteiro junto com a tela de Minha Conta,
 * mesmo para quem nunca abria a aba Caminho.
 *
 * Só que a tela ainda precisa saber, NO TOQUE e sem esperar, se existe aula no
 * dia — é isso que decide se a intro roda e se o dia abre com aula ou com
 * desafio. A resposta virou uma FAIXA em constantes (`QUIZ_PRIMEIRO_DIA` /
 * `QUIZ_ULTIMO_DIA`), porque ler `Object.keys` do JSON traria o JSON de volta
 * para o pacote e desfaria a mudança inteira.
 *
 * ⚠️ Constante que descreve um arquivo é constante que um dia diverge dele. O
 * dia em que alguém acrescentar a semana 43 ou apagar a semana 1, a faixa
 * passa a mentir — e o sintoma seria silencioso e do pior tipo: o dia abriria
 * prometendo aula e mostraria o desafio (ou pior, ficaria em "Abrindo a aula
 * de hoje…" para sempre, porque `temQuizNoDia` disse que existe e o banco
 * disse que não).
 *
 * Aqui o JSON é lido de verdade, e é ele quem manda.
 */

import { describe, expect, test } from "bun:test";
import {
  QUIZ_PRIMEIRO_DIA,
  QUIZ_ULTIMO_DIA,
  temQuizNoDia,
  carregarQuizDoDia,
  isAnswerCorrect,
  isMultiQuestion,
} from "./daily-quizzes";
import bruto from "./daily-quizzes.data.json";

const DIAS = Object.keys(bruto as Record<string, unknown>)
  .map(Number)
  .sort((a, b) => a - b);

describe("a faixa declarada é a faixa do arquivo", () => {
  test("o primeiro dia bate", () => {
    expect(QUIZ_PRIMEIRO_DIA).toBe(DIAS[0]);
  });

  test("o último dia bate", () => {
    expect(QUIZ_ULTIMO_DIA).toBe(DIAS[DIAS.length - 1]);
  });

  test("⚠️ não há buraco no meio", () => {
    /* A faixa só PODE ser um par de constantes porque a cobertura é contínua.
       No dia em que faltar um dia no meio, `temQuizNoDia` passa a prometer uma
       aula que o banco não tem — e a tela fica esperando um download que nunca
       traz nada. Aí a resposta não é ajustar as constantes: é ou preencher o
       buraco no conteúdo, ou trocar a faixa por um índice de verdade. */
    const presentes = new Set(DIAS);
    const buracos: number[] = [];
    for (let d = QUIZ_PRIMEIRO_DIA; d <= QUIZ_ULTIMO_DIA; d++) {
      if (!presentes.has(d)) buracos.push(d);
    }
    expect(buracos).toEqual([]);
  });

  test("o total confere com a faixa", () => {
    expect(DIAS.length).toBe(QUIZ_ULTIMO_DIA - QUIZ_PRIMEIRO_DIA + 1);
  });
});

describe("temQuizNoDia responde sem tocar no banco", () => {
  test("dentro da faixa", () => {
    expect(temQuizNoDia(QUIZ_PRIMEIRO_DIA)).toBe(true);
    expect(temQuizNoDia(150)).toBe(true);
    expect(temQuizNoDia(QUIZ_ULTIMO_DIA)).toBe(true);
  });

  test("fora da faixa — pós-data e dias impossíveis", () => {
    expect(temQuizNoDia(QUIZ_PRIMEIRO_DIA - 1)).toBe(false);
    expect(temQuizNoDia(QUIZ_ULTIMO_DIA + 1)).toBe(false);
    expect(temQuizNoDia(0)).toBe(false);
    expect(temQuizNoDia(-5)).toBe(false);
  });

  test("lixo não vira `true`", () => {
    expect(temQuizNoDia(NaN)).toBe(false);
    expect(temQuizNoDia(Infinity)).toBe(false);
  });

  test("⚠️ e concorda com o banco em TODA a faixa", () => {
    /* O contrato que a tela depende: se `temQuizNoDia` diz que sim, o
       `carregarQuizDoDia` tem de achar. Uma discordância aqui é a tela travada
       em "Abrindo a aula de hoje…". */
    const presentes = new Set(DIAS);
    for (let d = QUIZ_PRIMEIRO_DIA - 3; d <= QUIZ_ULTIMO_DIA + 3; d++) {
      expect(temQuizNoDia(d)).toBe(presentes.has(d));
    }
  });
});

describe("carregarQuizDoDia entrega a aula", () => {
  test("um dia real vem com lição e perguntas", async () => {
    const q = await carregarQuizDoDia(150);
    expect(q).not.toBeNull();
    expect(typeof q!.teach).toBe("string");
    expect(q!.teach.length).toBeGreaterThan(10);
    expect(q!.questions.length).toBeGreaterThan(0);
  });

  test("fora da faixa devolve null — e não estoura", async () => {
    expect(await carregarQuizDoDia(QUIZ_ULTIMO_DIA + 10)).toBeNull();
    expect(await carregarQuizDoDia(0)).toBeNull();
  });

  test("o mesmo dia pedido duas vezes devolve o mesmo conteúdo", async () => {
    /* Prova que o cache do banco não corrompe nada entre chamadas. */
    const a = await carregarQuizDoDia(77);
    const b = await carregarQuizDoDia(77);
    expect(a!.teach).toBe(b!.teach);
  });

  test("⚠️ dois pedidos SIMULTÂNEOS não brigam", async () => {
    /* O caso que a promessa guardada (e não só o resultado) existe para
       cobrir: dois toques rápidos chegam antes de o `import()` resolver. */
    const [a, b] = await Promise.all([carregarQuizDoDia(88), carregarQuizDoDia(99)]);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.teach).not.toBe(b!.teach);
  });
});

describe("as funções puras continuam puras (não tocam no banco)", () => {
  test("isMultiQuestion", () => {
    expect(isMultiQuestion({ q: "", o: [], a: [0, 1], why: "" })).toBe(true);
    expect(isMultiQuestion({ q: "", o: [], a: 1, why: "" })).toBe(false);
    expect(isMultiQuestion({ kind: "multi", q: "", o: [], a: 1, why: "" })).toBe(true);
  });

  test("isAnswerCorrect — escolha única", () => {
    const q = { q: "", o: [], a: 2, why: "" };
    expect(isAnswerCorrect(q, 2)).toBe(true);
    expect(isAnswerCorrect(q, 1)).toBe(false);
    expect(isAnswerCorrect(q, null)).toBe(false);
  });

  test("isAnswerCorrect — marque todas", () => {
    const q = { q: "", o: [], a: [0, 2], why: "" };
    expect(isAnswerCorrect(q, [0, 2])).toBe(true);
    expect(isAnswerCorrect(q, [2, 0])).toBe(true);
    expect(isAnswerCorrect(q, [0])).toBe(false);
    expect(isAnswerCorrect(q, [0, 1, 2])).toBe(false);
  });
});
