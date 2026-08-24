/**
 * O DIAGNÓSTICO QUE FALTAVA — e a razão de ele existir.
 *
 * Uma paciente perguntou "pode comer comida japonesa", recebeu informação geral
 * e, no fim, "registrei sua pergunta para a Dra." — com a médica já tendo
 * escrito sobre peixe cru. A pergunta que sobrou foi: *ela respondeu e não
 * valeu de nada?*
 *
 * A causa está em `podeAtribuir`: assinar o nome do médico exige uma
 * similaridade MEDIDA, e o ranking por palavras não produz número nenhum. Sem
 * a busca vetorial, atribuir é IMPOSSÍVEL e toda pergunta vira lacuna — o
 * cérebro responde e parece vazio, indefinidamente, sem um único sinal.
 *
 * O que este arquivo protege é a leitura desse sinal. Em particular o `null`,
 * que é onde o diagnóstico se inverte.
 */

import { describe, expect, test } from "bun:test";
import {
  ATRIBUICAO_MIN_SIMILARITY,
  SEMANTIC_MIN_SIMILARITY,
  distribuirPorFaixa,
} from "./secondbrain.server";

const linhas = (...s: (number | null)[]) => s.map((similaridade) => ({ similaridade }));

describe("null não é zero — é a busca desligada", () => {
  test("respostas sem número não entram em nenhuma faixa", () => {
    /* O erro caro seria contá-las como "nada parecido": o médico leria que a
       base dele não cobre as dúvidas e iria escrever mais, quando o que ele
       escreveu já está lá e é invisível. Diagnóstico exatamente invertido. */
    const d = distribuirPorFaixa(linhas(null, null, null));
    expect(d).toEqual({
      respostas: 3,
      comNumero: 0,
      assinadas: 0,
      faixaDoMeio: 0,
      semNada: 0,
    });
  });

  test("a diferença entre respostas e comNumero é o que denuncia", () => {
    const d = distribuirPorFaixa(linhas(0.9, null, null, null));
    expect(d.respostas - d.comNumero).toBe(3);
  });

  test("NaN e Infinity não passam por número", () => {
    // `Number.isFinite` e não `typeof`: os dois são `"number"` em JavaScript.
    const d = distribuirPorFaixa(linhas(Number.NaN, Number.POSITIVE_INFINITY, 0.8));
    expect(d.comNumero).toBe(1);
    expect(d.assinadas).toBe(1);
  });
});

describe("as faixas são exatamente os cortes que o chat usa para decidir", () => {
  test("no corte de atribuição a resposta JÁ leva o nome dele", () => {
    /* `>=`, não `>`. Um número no painel que não seja o número da decisão
       descreveria um produto que não existe. */
    const d = distribuirPorFaixa(linhas(ATRIBUICAO_MIN_SIMILARITY));
    expect(d.assinadas).toBe(1);
    expect(d.faixaDoMeio).toBe(0);
  });

  test("um fio abaixo do corte de atribuição cai na faixa do meio", () => {
    const d = distribuirPorFaixa(linhas(ATRIBUICAO_MIN_SIMILARITY - 0.0001));
    expect(d.assinadas).toBe(0);
    expect(d.faixaDoMeio).toBe(1);
  });

  test("no corte semântico o material dele ENTRA na resposta", () => {
    const d = distribuirPorFaixa(linhas(SEMANTIC_MIN_SIMILARITY));
    expect(d.faixaDoMeio).toBe(1);
    expect(d.semNada).toBe(0);
  });

  test("um fio abaixo do corte semântico não entra", () => {
    const d = distribuirPorFaixa(linhas(SEMANTIC_MIN_SIMILARITY - 0.0001));
    expect(d.faixaDoMeio).toBe(0);
    expect(d.semNada).toBe(1);
  });

  test("as três faixas somam comNumero — nenhuma resposta some nem conta duas vezes", () => {
    const d = distribuirPorFaixa(linhas(0.95, 0.8, 0.74, 0.7, 0.62, 0.5, 0.1, null));
    expect(d.assinadas + d.faixaDoMeio + d.semNada).toBe(d.comNumero);
    expect(d).toEqual({
      respostas: 8,
      comNumero: 7,
      assinadas: 3, // 0,95 · 0,80 · 0,74
      faixaDoMeio: 2, // 0,70 · 0,62
      semNada: 2, // 0,50 · 0,10
    });
  });
});

describe("o cérebro que ninguém usou não pode parecer quebrado", () => {
  test("sem respostas, tudo é zero e nada é acusado", () => {
    expect(distribuirPorFaixa([])).toEqual({
      respostas: 0,
      comNumero: 0,
      assinadas: 0,
      faixaDoMeio: 0,
      semNada: 0,
    });
  });
});
