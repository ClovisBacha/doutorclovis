/**
 * O portão da promessa.
 *
 * Quando a dúvida da paciente não está coberta pelo cérebro do médico, a IA
 * responde textualmente: *"registrei aqui para ele ver"*. Essa frase só é
 * verdadeira se a pergunta de fato entrou na fila dele — e quem decide isso são
 * duas funções puras: `normalizeGapQuestion` (tamanho mínimo) e
 * `isSuporteDoApp` (dúvida de suporte não vira trabalho clínico).
 *
 * O risco é sutil e caro: o `chat.ts` reimplementa a MESMA condição para
 * decidir se pode dizer a frase. Se as duas divergirem, o produto passa a
 * mentir para a paciente — ela espera por uma resposta que ninguém vai dar.
 * Estes testes prendem as duas pontas.
 */

import { describe, expect, test } from "bun:test";
import { normalizeGapQuestion } from "./doctorthink/core";
import { isCortesia, isSuporteDoApp } from "./secondbrain.server";

/** A condição, escrita uma vez. É esta que os dois lados têm que respeitar. */
function viraLacuna(pergunta: string): boolean {
  return (
    normalizeGapQuestion(pergunta).length >= 8 && !isSuporteDoApp(pergunta) && !isCortesia(pergunta)
  );
}

describe("o que vira lacuna na fila do médico", () => {
  test("dúvida clínica de verdade entra", () => {
    expect(viraLacuna("posso tomar dipirona na gravidez?")).toBe(true);
    expect(viraLacuna("estou com dor de cabeça forte, é normal?")).toBe(true);
  });

  test("interjeição não vira trabalho para o médico", () => {
    expect(viraLacuna("oi")).toBe(false);
    expect(viraLacuna("ok")).toBe(false);
    expect(viraLacuna("obrigada!!")).toBe(false);
  });

  /* DEFEITO REAL, achado por este arquivo: "obrigada!!" normaliza para
     "obrigada" — oito caracteres, passava o piso e virava lacuna. Com a tabela
     de quem perguntou, a paciente ficaria esperando resposta para um
     agradecimento e ganharia push quando ele "respondesse". */
  test("cortesia não vira dúvida esperando resposta", () => {
    expect(viraLacuna("obrigada!!")).toBe(false);
    expect(viraLacuna("muito obrigada")).toBe(false);
    expect(viraLacuna("bom dia")).toBe(false);
    expect(viraLacuna("entendido")).toBe(false);
  });

  test("cortesia SEGUIDA de pergunta continua sendo pergunta", () => {
    expect(viraLacuna("obrigada, mas posso tomar dipirona?")).toBe(true);
    expect(viraLacuna("bom dia, estou com dor nas costas")).toBe(true);
  });

  test("suporte do app não vira fila clínica", () => {
    expect(viraLacuna("como faço para trocar minha senha no aplicativo?")).toBe(false);
  });
});

describe("normalização — a chave de deduplicação", () => {
  /* A lacuna é deduplicada por `(médico, pergunta normalizada)`. É isso que faz
     cinquenta pacientes com a mesma dúvida virarem UM item na fila dele, com
     contador — e não cinquenta vezes o mesmo trabalho. Se a normalização
     deixasse de colapsar variações triviais, a fila do médico viraria ruído. */
  test("acento, caixa e pontuação não criam lacunas diferentes", () => {
    const a = normalizeGapQuestion("Posso tomar DIPIRONA?");
    const b = normalizeGapQuestion("posso tomar dipirona");
    const c = normalizeGapQuestion("  posso  tomar   dipirona!!!  ");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  test("perguntas diferentes continuam diferentes", () => {
    expect(normalizeGapQuestion("posso tomar dipirona")).not.toBe(
      normalizeGapQuestion("posso tomar paracetamol"),
    );
  });

  test("não estoura com entrada vazia ou só símbolos", () => {
    expect(normalizeGapQuestion("").length).toBe(0);
    expect(normalizeGapQuestion("!!!???").length).toBeLessThan(8);
  });
});
