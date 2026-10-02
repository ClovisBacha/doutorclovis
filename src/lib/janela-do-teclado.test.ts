/**
 * O TECLADO NÃO PODE ESPREMER A CONVERSA.
 *
 * ⚠️ Medido a 393×500 (um iPhone com o teclado aberto), a Nutricionista
 * Virtual entregava **111px** de área de conversa: uma linha e meia. Ela
 * digitava a pergunta e tinha de fechar o teclado para ler a resposta que
 * acabou de pedir. A causa era que `55vh` mede a tela INTEIRA — com o teclado,
 * o que sobra é metade dela, e 55% de metade é um quarto.
 *
 * Hoje os dois chats são PAINÉIS em tela cheia no celular, e os dois medem a
 * janela que sobra pela MESMA régua (`janela-do-teclado.ts`). O teste existe
 * para as duas telas não voltarem a divergir — nem uma medindo por conta
 * própria, nem uma dimensionando por `vh` enquanto a outra mede.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { semComentarios } from "./sem-comentarios";

/** Sem os comentários: eles CITAM os padrões proibidos para explicá-los. */
const semProsa = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("uma régua só para os dois chats", () => {
  const CHAT = semProsa(readFileSync("src/components/chat-tab.tsx", "utf8"));
  /* ⚠️ ESTA TELA PASSA POR `semComentarios`, e não pelo apagador local.
     Ela tem `accept="image/(estrela)"` no seletor de foto, e a barra-asterisco
     dentro dessa string faz um apagador por regex engolir centenas de linhas —
     medido. A asserção de baixo é NEGATIVA, ou seja, ela ficaria VERDE em
     silêncio sobre o buraco: é a direção perigosa da armadilha. */
  const NUTRI = semComentarios(readFileSync("src/components/nutricao-tab.tsx", "utf8"));

  test("⚠️ nenhum dos dois mede o `visualViewport` por conta própria", () => {
    /* Era assim que estava: a medição inteira dentro do Chat IA, e a Nutrição
       sem nada. Duas cópias divergem no primeiro ajuste, e a divergência
       aparece como um dos dois chats voltando a se esconder atrás do teclado. */
    for (const [nome, fonte] of [
      ["chat", CHAT],
      ["nutrição", NUTRI],
    ] as const) {
      expect(`${nome}:${fonte.includes("visualViewport")}`).toBe(`${nome}:false`);
      expect(fonte).toContain("useJanelaDoTeclado");
    }
  });

  test("⚠️ os dois dimensionam o PAINEL pela janela medida, e não por `vh`", () => {
    /* Chamar o hook e ignorar o resultado deixaria o import bonito e o defeito
       de pé — é o "importar sem chamar" que a catraca de função morta pega. O
       que se cobra é a GARANTIA: a altura e o topo do painel saem da janela. */
    for (const fonte of [CHAT, NUTRI]) {
      expect(fonte).toMatch(/height: janela\.h, top: janela\.top/);
    }
  });
});
