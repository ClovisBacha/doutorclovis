/**
 * O TECLADO NÃO PODE ESPREMER A CONVERSA.
 *
 * ⚠️ Medido a 393×500 (um iPhone com o teclado aberto), a Nutricionista
 * Virtual entregava **111px** de área de conversa: uma linha e meia. Ela
 * digitava a pergunta e tinha de fechar o teclado para ler a resposta que
 * acabou de pedir. A causa é que `55vh` mede a tela INTEIRA — com o teclado, o
 * que sobra é metade dela, e 55% de metade é um quarto.
 *
 * O Chat IA já tinha o conserto, escrito DENTRO do componente; este arquivo é
 * a régua única, e o teste existe para as duas telas não voltarem a divergir.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { alturaNoFluxo, PISO_DA_CAIXA } from "./janela-do-teclado";

/** Sem os comentários: eles CITAM os padrões proibidos para explicá-los. */
const semProsa = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("a altura da caixa no fluxo", () => {
  test("no computador (sem visualViewport) NÃO mexe em nada", () => {
    /* Devolver um número aqui trocaria o `55vh` de todo dia por um valor
       medido — a correção mudaria o desenho de quem nunca teve o problema. */
    expect(alturaNoFluxo(null)).toBeNull();
  });

  test("⚠️ com o teclado FECHADO também não mexe", () => {
    /* A janela visual bate com a tela: não há teclado, e a caixa fica com o
       `vh` que o CSS dá. A folga cobre a barra do navegador aparecendo e
       sumindo, que não é teclado. */
    expect(alturaNoFluxo({ h: 852, top: 0, tela: 852 })).toBeNull();
    expect(alturaNoFluxo({ h: 820, top: 0, tela: 852 })).toBeNull();
  });

  test("⚠️ com o teclado ABERTO a caixa vale o que SOBRA, e não 55% do que sobra", () => {
    /* O caso medido: 852 de tela, 500 visíveis. Com `55vh` a caixa dava 275 e
       a lista 111; aqui ela passa dos 300. */
    const h = alturaNoFluxo({ h: 500, top: 0, tela: 852 });
    expect(h).not.toBeNull();
    expect(h!).toBeGreaterThan(275);
    expect(h!).toBeLessThanOrEqual(500);
  });

  test("⚠️ nunca desce do piso — teclado grande não pode fechar a conversa", () => {
    /* Um teclado com barra de sugestões e emoji deixa pouco: sem piso, a
       caixa viraria uma faixa de 40px, que é pior que o defeito original. */
    expect(alturaNoFluxo({ h: 300, top: 0, tela: 852 })).toBe(PISO_DA_CAIXA);
    expect(alturaNoFluxo({ h: 120, top: 0, tela: 852 })).toBe(PISO_DA_CAIXA);
  });
});

describe("uma régua só para os dois chats", () => {
  const CHAT = semProsa(readFileSync("src/components/chat-tab.tsx", "utf8"));
  const NUTRI = semProsa(readFileSync("src/components/nutricao-tab.tsx", "utf8"));

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

  test("⚠️ a Nutrição usa a régua para dimensionar a caixa", () => {
    /* Chamar o hook e ignorar o resultado deixaria o import bonito e o defeito
       de pé — é o "importar sem chamar" que a catraca de função morta pega. */
    expect(NUTRI).toContain("alturaNoFluxo(janela)");
    expect(NUTRI).toMatch(/height: alturaDaCaixa \?\? "55vh"/);
  });
});
