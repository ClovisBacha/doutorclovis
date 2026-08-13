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
import { MOVIMENTOS } from "./exercicios";

const RAIZ = process.cwd();

/* Os movimentos saíram do componente para `lib/exercicios.ts` (ago/2026) — o
   teste segue a mudança em vez de continuar lendo um bloco que não existe. */
function todosOsMovimentos(): Set<string> {
  return new Set(MOVIMENTOS.map((m) => m.id));
}

/**
 * ⚠️ OS NOVE PRIMEIROS, e só eles, têm voz gravada hoje.
 *
 * Os dezesseis movimentos novos (assoalho pélvico, ciática, púbis, preparação
 * de parto, pós-parto) nasceram sem faixa: eles rodam em SILÊNCIO, com os
 * passos escritos na tela, e `faixaDoMovimento` devolve `null` sem quebrar
 * nada. É degradação aceitável e temporária — mas é para ser vista, e não para
 * ser esquecida. Esta lista é a fila de gravação.
 */
const COM_VOZ_GRAVADA = [
  "ombros",
  "pescoco",
  "gatocamelo",
  "quadril",
  "tornozelo",
  "pelve",
  "bracos",
  "torcao",
  "balanco",
];

describe("as três palavras da respiração", () => {
  test("existem e são arquivos distintos", () => {
    const vs = [RESPIRACAO.in, RESPIRACAO.hold, RESPIRACAO.out];
    expect(vs.every(Boolean)).toBe(true);
    expect(new Set(vs).size).toBe(3);
  });
});

describe("a voz dos movimentos", () => {
  test("os nove com voz gravada continuam com voz", () => {
    /* Perder uma destas é perder crédito já gasto, e em silêncio. */
    expect(COM_VOZ_GRAVADA.filter((i) => faixaDoMovimento(i) === null)).toEqual([]);
  });

  test("nenhuma faixa de movimento órfã", () => {
    /* Faixa sem movimento é arquivo que ninguém toca — e ninguém percebe. */
    const ids = todosOsMovimentos();
    expect(movimentosComFaixa().filter((i) => !ids.has(i))).toEqual([]);
  });

  test("⚠️ a fila de gravação: quais movimentos ainda rodam mudos", () => {
    /* Este teste NÃO falha por haver movimento mudo — ele falha se a lista
       mudar sem alguém olhar. Quando as faixas forem gravadas, mova o id para
       `COM_VOZ_GRAVADA` e apague-o daqui. */
    const mudos = [...todosOsMovimentos()].filter((i) => faixaDoMovimento(i) === null);
    expect(mudos.sort()).toEqual(
      [
        "agachamento-parede",
        "assoalho-lento",
        "assoalho-rapido",
        "assoalho-soltar",
        "ativar-transverso",
        "circulos-bola",
        "costelas-parede",
        "joelho-ao-peito",
        "panturrilha-parede",
        "pernas-elevadas",
        "piriforme",
        "punho-dedos",
        "respirar-para-baixo",
        "respiracao-diafragma",
        "travesseiro-entre-joelhos",
      ].sort(),
    );
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
