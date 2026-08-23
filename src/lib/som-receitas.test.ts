/**
 * O QUE PRECISA ESTAR CERTO NUM CATÁLOGO DE VINTE SONS.
 *
 * ⚠️ Nada aqui mede COMO o som soa — isso é trabalho de `scripts/ouvir.mjs`,
 * que renderiza num Chromium de verdade e mede crista, emenda, repetição e
 * energia por banda. Um teste unitário não ouve, e fingir que ouve seria pior
 * que não testar.
 *
 * O que se cobra aqui é o que quebra em SILÊNCIO: a lista e a tela
 * discordarem, uma frequência sair da grade do laço, um som sem nome, um som
 * sem família.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { LACO } from "./som-primitivas";
import {
  FAMILIAS,
  FAMILIA_DO_SOM,
  ROTULO_DO_SOM,
  SONS_CONTINUOS,
  ehSomContinuo,
  periodosDe,
} from "./som-receitas";
import { LOOP_SEGS } from "./som-continuo";

describe("o catálogo", () => {
  test("são vinte sons, e nenhum repetido", () => {
    expect(SONS_CONTINUOS.length).toBe(20);
    expect(new Set(SONS_CONTINUOS).size).toBe(20);
  });

  test("⚠️ todo som tem nome, emoji e legenda", () => {
    /* Um som sem legenda é um botão que a paciente não toca: com quatro dava
       para adivinhar pelo nome, com vinte "Drone grave" e "Pad calmo" são a
       mesma coisa para quem nunca ouviu os dois. */
    for (const k of SONS_CONTINUOS) {
      const r = ROTULO_DO_SOM[k];
      expect({ k, temNome: !!r?.label, temEmoji: !!r?.emoji, temSub: !!r?.sub }).toEqual({
        k,
        temNome: true,
        temEmoji: true,
        temSub: true,
      });
    }
  });

  test("⚠️ todo som pertence a uma família CONHECIDA", () => {
    /* Uma família nova escrita à mão no mapa e ausente de `FAMILIAS` faria o
       som sumir da tela: a tela desenha família por família, e o que não está
       em nenhuma não é desenhado. Sem erro nenhum. */
    for (const k of SONS_CONTINUOS) {
      const f = FAMILIA_DO_SOM[k];
      expect({ k, conhecida: (FAMILIAS as readonly string[]).includes(f) }).toEqual({
        k,
        conhecida: true,
      });
    }
  });

  test("nenhuma família fica vazia", () => {
    /* Um título de seção sobre uma grade sem nada é o que sobra quando alguém
       tira o último som de uma família. */
    for (const f of FAMILIAS) {
      const n = SONS_CONTINUOS.filter((k) => FAMILIA_DO_SOM[k] === f).length;
      expect({ f, tem: n > 0 }).toEqual({ f, tem: true });
    }
  });

  test("as vinte legendas são diferentes entre si", () => {
    const nomes = SONS_CONTINUOS.map((k) => ROTULO_DO_SOM[k].label);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  test("o silêncio nunca é um som contínuo — ele é a ausência de um", () => {
    expect(ehSomContinuo("silencio")).toBe(false);
    expect(ehSomContinuo("chuva")).toBe(true);
    expect(ehSomContinuo("nao-existe")).toBe(false);
  });
});

describe("⚠️ a grade do laço", () => {
  test("todo período declarado fecha volta inteira em 30 s", () => {
    /* É isto, e só isto, que faz o laço fechar sem costura nos componentes
       periódicos. Um som com período que não divide 30 volta a dar o "tec". */
    for (const som of SONS_CONTINUOS) {
      for (const p of periodosDe(som)) {
        const voltas = LOOP_SEGS / p;
        expect({ som, p, inteiro: Math.abs(voltas - Math.round(voltas)) < 1e-9 }).toEqual({
          som,
          p,
          inteiro: true,
        });
      }
    }
  });

  test("o laço das primitivas é o MESMO do motor", () => {
    /* Estão duplicados porque `som-primitivas` não pode importar
       `som-continuo` (o motor importa as receitas, que importam as
       primitivas). Se divergirem, `bandaLenta` passa a gerar componentes fora
       da grade e a emenda estala — sem erro nenhum. */
    expect(LACO).toBe(LOOP_SEGS);
  });

  test("o coração e o ventre fecham em batidas inteiras", () => {
    /* 30 s a 140 bpm = 70 batidas; a 72 bpm = 36. Meia batida na virada seria
       uma arritmia a cada volta, num som que existe para imitar o corpo. */
    expect((LOOP_SEGS * 140) / 60).toBe(70);
    expect((LOOP_SEGS * 72) / 60).toBe(36);
  });

  test("os seis grilos cantam um número INTEIRO de vezes no laço", () => {
    /* E as taxas ficam quase iguais e nunca iguais: é a dessincronização que
       soa como floresta. Sincronizados, soa como efeito sonoro. */
    const ps = periodosDe("floresta-noite");
    expect(ps.length).toBe(6);
    expect(new Set(ps).size).toBe(6);
    for (const p of ps) expect(Number.isInteger(Math.round(LOOP_SEGS / p))).toBe(true);
  });
});

describe("⚠️ o que a bancada não pega, mas o código pode dizer", () => {
  const fonte = readFileSync("src/lib/som-receitas.ts", "utf8");
  const semComentarios = fonte.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

  test("toda frequência de filtro passa por noLaco", () => {
    /* Uma frequência escrita crua num `.frequency.value` é uma emenda que
       estala. `noLaco` é barato e a chamada é a prova de que alguém pensou. */
    const cruas: string[] = [];
    for (const linha of semComentarios.split("\n")) {
      const m = linha.match(/\.frequency\.value = ([^;]+);/);
      if (!m) continue;
      const v = m[1].trim();
      /**
       * ⚠️ A REGRA VALE PARA ATRIBUIÇÃO ESTÁTICA, não para automação de evento.
       *
       * Um filtro parado não tem período — ele é invariante no tempo, e a
       * saída dele repete no mesmo período da entrada. Quem PRECISA da grade é
       * oscilador e LFO. Mas snapar filtro estático também não custa nada, e
       * uma regra uniforme é mais fácil de seguir que uma sutil: "toda
       * atribuição direta passa por noLaco".
       *
       * As rampas (`setValueAtTime`, `exponentialRampToValueAtTime`) ficam de
       * fora de propósito: elas descrevem um EVENTO, que é aperiódico por
       * natureza — a quebra de uma onda, o deslize de uma bolha.
       *
       * Frações de 30 escritas como `1 / N` e variáveis já tratadas passam.
       */
      if (v.startsWith("noLaco(") || v.startsWith("1 / ") || /^[a-zA-Z]/.test(v)) continue;
      cruas.push(linha.trim().slice(0, 90));
    }
    expect(cruas).toEqual([]);
  });

  test("⚠️ lareira e fogueira NÃO podem ser a mesma receita", () => {
    /* Elas mediram idênticas na bancada — crista 7,80 contra 6,89, centroide
       319 contra 312, e as nove bandas de energia iguais na primeira casa. A
       causa era um `lowpass(1200)` escrito depois do `lowpass(4200 ou 9000)`,
       anulando a única diferença entre as duas. Duas receitas que se anunciam
       diferentes e medem igual são uma delas que não existe. */
    expect(semComentarios).toContain("lareira ? 4200 : 9000");
    /* E o corte do brilho tem de vir DEPOIS, não antes de um corte mais baixo. */
    const i1 = semComentarios.indexOf("lareira ? 4200 : 9000");
    const i2 = semComentarios.indexOf('{ tipo: "lowpass", hz: 1200 }');
    expect(i2).toBeGreaterThan(-1);
    expect(i1).toBeGreaterThan(i2);
  });

  test("⚠️ o ressoador do telhado é em SÉRIE", () => {
    /* Em paralelo, três filtros de realce somam três cópias do sinal inteiro —
       não é ressoador, é volume. Medido: crista 21,3 em paralelo contra 11,5
       em série, com o alvo da pesquisa em 9–12. */
    expect(semComentarios).toContain("no = no.connect(bq)");
    /* E o último da corrente vai para a saída UMA vez — não três. */
    expect(semComentarios).toContain("no.connect(saida);");
  });
});
