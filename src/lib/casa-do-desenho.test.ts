/**
 * O NÚMERO CALCULADO NÃO PODE DERRUBAR A HIDRATAÇÃO.
 *
 * ⚠️ Este defeito já apareceu DUAS vezes, em duas telas escritas com meses de
 * distância: a trilha do Jogo (`left: "31.615223689149722%"` contra
 * `"31.6152%"`) e o anel de fases do ciclo (`cx={39.635166577877314}` contra
 * `cx="39.63516657787733"`). Nos dois, o React descarta a árvore inteira.
 *
 * Medido no navegador, com o anel: revertendo o arredondamento, o console
 * volta a imprimir "A tree hydrated but some attributes … didn't match"; com
 * ele, os sete estados da bancada saem limpos.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { casaDoDesenho } from "./casa-do-desenho";

/** Sem os comentários: eles CITAM os padrões proibidos para explicá-los. */
const semProsa = (t: string) =>
  t
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

describe("a régua", () => {
  test("⚠️ o resultado sobrevive a ir e voltar de uma string", () => {
    /* É EXATAMENTE isto que o navegador faz com um atributo, e é onde os 17
       dígitos morrem. Sem o arredondamento, `String(v)` e a releitura podem
       diferir na última casa. */
    for (const angulo of [0, 1, 2, 3, 5, 7, 11, 13]) {
      const v = casaDoDesenho(110 + 90 * Math.cos((angulo / 28) * 2 * Math.PI));
      expect(Number(String(v))).toBe(v);
      expect(String(v).replace("-", "").split(".")[1]?.length ?? 0).toBeLessThanOrEqual(3);
    }
  });

  test("três casas, e não menos", () => {
    /* Menos casas moveria o desenho: num `viewBox` de 220, a terceira casa é
       0,001 unidade — abaixo de um pixel físico. */
    expect(casaDoDesenho(1.23456)).toBe(1.235);
    expect(casaDoDesenho(39.635166577877314)).toBe(39.635);
    expect(casaDoDesenho(-2.0004)).toBe(-2);
  });
});

describe("as duas telas usam a MESMA régua", () => {
  const TELAS = [
    ["a trilha do Jogo", "src/components/gestacao-path.tsx"],
    ["o anel do ciclo", "src/components/ciclo-menstrual-tab.tsx"],
  ] as const;

  test("⚠️ nenhuma delas manda `Math.sin`/`Math.cos` cru para a tela", () => {
    /* A régua nasceu privada dentro de `gestacao-path.tsx`, e o anel do ciclo
       — escrito noutro arquivo — repetiu o defeito inteiro. Uma cópia
       divergiria; nenhuma cópia é como a terceira tela nasce com ele. */
    for (const [nome, arquivo] of TELAS) {
      const fonte = semProsa(readFileSync(arquivo, "utf8"));
      expect(fonte).toContain("casaDoDesenho");
      /* Toda linha com trigonometria tem de passar pela régua. */
      /* ⚠️ `.toFixed(` ISENTA, e a razão importa: formatar já torna o valor
         determinístico dos dois lados — é a mesma proteção por outro caminho.
         Reprovar aí seria reprovar código correto, e catraca que reprova o
         certo é catraca que a próxima pessoa desliga. */
      const cruas = fonte
        .split("\n")
        .filter(
          (l) =>
            /Math\.(sin|cos)\(/.test(l) && !/casaDoDesenho\(/.test(l) && !/\.toFixed\(/.test(l),
        );
      expect(`${nome}: ${cruas.join(" | ")}`).toBe(`${nome}: `);
    }
  });

  test("⚠️ a régua não voltou a ser privada de um componente", () => {
    /* `casaDaTrilha` era isto: correta, testada por ninguém, e invisível para
       quem escrevesse a tela seguinte. */
    for (const [, arquivo] of TELAS) {
      expect(semProsa(readFileSync(arquivo, "utf8"))).not.toMatch(
        /function casa[A-Za-z]*\(v: number\)/,
      );
    }
  });
});
