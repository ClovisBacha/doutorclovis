/**
 * O QUE SOBROU EM `voz.ts` — e por que só isso.
 *
 * Ele tinha sete faixas por tema (30 a 37 s cada), cinco rechamadas e um
 * fechamento. A auditoria mediu o que entregavam: 34 segundos de voz numa
 * sessão de dez minutos, 5,5%. Foram substituídas pelos 149 trechos de
 * `assets/audio/med`, montados por `meditacao-sessao.ts` — ver
 * `voz-meditacao.test.ts`.
 *
 * Aqui ficaram as três palavras da respiração e os nove movimentos, que
 * continuam sendo faixa única por serem exatamente isso: uma frase, um som.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { faixaDoMovimento, movimentosComFaixa, RESPIRACAO } from "./voz";

const RAIZ = process.cwd();

function movimentosDoComponente(): Set<string> {
  const s = readFileSync(join(RAIZ, "src", "components", "gestacao-path.tsx"), "utf8");
  const bloco = s.slice(
    s.indexOf("const MOVIMENTOS: Movimento[] = ["),
    // Âncora no CÓDIGO, não num comentário: a primeira versão terminava a
    // fatia num texto de comentário, e bastou reescrevê-lo para o teste varrer
    // o arquivo inteiro e achar `id:` de outras coisas.
    s.indexOf("function movimentosForDay"),
  );
  return new Set([...bloco.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]));
}

describe("as três palavras da respiração", () => {
  test("existem e são arquivos distintos", () => {
    const vs = [RESPIRACAO.in, RESPIRACAO.hold, RESPIRACAO.out];
    expect(vs.every(Boolean)).toBe(true);
    expect(new Set(vs).size).toBe(3);
  });
});

describe("os nove movimentos", () => {
  test("todo movimento tem faixa", () => {
    const ids = movimentosDoComponente();
    expect(ids.size).toBeGreaterThan(0);
    expect([...ids].filter((i) => faixaDoMovimento(i) === null)).toEqual([]);
  });

  test("nenhuma faixa de movimento órfã", () => {
    const ids = movimentosDoComponente();
    expect(movimentosComFaixa().filter((i) => !ids.has(i))).toEqual([]);
  });
});

describe("as faixas por tema não voltaram", () => {
  test("`voz.ts` não importa mais nenhum áudio de meditação", () => {
    /* Duas fontes de voz para a mesma tela é como o app começa a se
       contradizer — e a antiga não sabia servir as quatro durações. */
    const voz = readFileSync(join(RAIZ, "src", "lib", "voz.ts"), "utf8");
    for (const morta of [
      "calma",
      "conexao",
      "descanso",
      "gratidao",
      "sono",
      "coragem",
      "rechamada",
    ]) {
      expect(voz).not.toContain(`audio/${morta}`);
    }
    expect(voz).not.toContain("faixaDoTema");
  });
});
