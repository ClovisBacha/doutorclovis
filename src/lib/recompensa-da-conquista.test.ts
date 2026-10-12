/**
 * A RECOMPENSA DA CONQUISTA SAI DA RARIDADE — e `SEMENTINHAS` não a guarda.
 *
 * A economia anterior tinha dois valores nesta tabela (`achievementDefault`,
 * 20; `achievementBig`, 100) e um `Set` de duas chaves decidindo qual valia —
 * o que significava que "primeira mamada" e "10 sessões de chutes" pagavam
 * igual. A régua virou a RARIDADE (ago/2026), que é a mesma que pinta o anel
 * do cartão: cor e número não têm como discordar.
 *
 * ⚠️ **As três constantes ficaram, sem um leitor sequer, por uma leva
 * inteira.** Não quebravam nada — e é isso que as tornava caras: um valor de
 * PREÇO com cara de fonte da verdade, num arquivo que abre dizendo que os
 * números da economia vivem nele. A próxima pessoa a calibrar a economia lê
 * `achievementBig: 100` e acredita. Este repositório já pagou exatamente isso
 * com três preços mortos que a prosa da Loja citava como se valessem.
 *
 * Esta catraca é sobre o RESÍDUO. Quem cobre a régua em si é
 * `conquistas.test.ts`.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "./sem-comentarios";
import { SEMENTINHAS } from "./sementinhas.functions";
import { RARIDADES, RARIDADES_EM_ORDEM, sementinhasDaRaridade } from "./conquistas";

describe("a tabela de ganho não fala de conquista", () => {
  test("⚠️ nenhuma chave de `SEMENTINHAS` decide o que uma conquista paga", () => {
    /* Em RUNTIME, e não por texto: o que importa é o objeto que os chamadores
       leem, não a grafia de uma linha. */
    const chaves = Object.keys(SEMENTINHAS);
    expect(chaves.filter((k) => /achievement|conquista|badge/i.test(k))).toEqual([]);
    /* E o que sobrou é o que de fato tem leitor. */
    expect(chaves.sort()).toEqual(["dailyCheckin", "trimesterMilestone", "weekMilestone"]);
  });

  test("toda raridade paga, e nenhuma paga zero por esquecimento", () => {
    for (const r of RARIDADES_EM_ORDEM) {
      expect(sementinhasDaRaridade(r)).toBe(RARIDADES[r].sementinhas);
      expect(sementinhasDaRaridade(r)).toBeGreaterThan(0);
    }
  });

  test("⚠️ mais difícil paga mais — senão a raridade vira enfeite", () => {
    expect(sementinhasDaRaridade("epico")).toBeGreaterThan(sementinhasDaRaridade("raro"));
    expect(sementinhasDaRaridade("raro")).toBeGreaterThan(sementinhasDaRaridade("comum"));
  });
});

/* ── O resíduo não volta ──────────────────────────────────────────────────── */

function fontes(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fontes(p, acc);
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) acc.push(p);
  }
  return acc;
}

const MORTOS = ["BIG_ACHIEVEMENTS", "achievementBig", "achievementDefault"];

describe("o resíduo da economia antiga não volta", () => {
  test("⚠️ os três nomes não existem em CÓDIGO — só na prosa que os enterra", () => {
    /* ⚠️ `semComentarios` é OBRIGATÓRIO aqui, e a prova está no próprio
       repositório: `achievements.functions.ts` explica a mudança citando os
       dois nomes ("antes eram dois valores…"), e este cabeçalho faz o mesmo.
       Sem a linha, a catraca ficaria vermelha exatamente sobre o comentário
       que documenta a decisão — é a armadilha da prosa, na direção que
       reprova código correto. */
    const vivos = fontes("src").flatMap((f) => {
      const codigo = semComentarios(readFileSync(f, "utf8"));
      return MORTOS.filter((n) => codigo.includes(n)).map((n) => `${f}: ${n}`);
    });
    expect(vivos).toEqual([]);
  });

  test("a varredura MORDE, e a prosa não a faz morder", () => {
    const codigo = 'export const BIG_ACHIEVEMENTS = new Set(["course_complete"]);';
    expect(MORTOS.some((n) => semComentarios(codigo).includes(n))).toBe(true);
    /* O mesmo nome dentro de um comentário NÃO acusa — que é o que permite a
       história continuar escrita. */
    const prosa = "/* Antes eram dois valores (`achievementBig` para duas chaves). */\n";
    expect(MORTOS.some((n) => semComentarios(prosa).includes(n))).toBe(false);
  });

  test("⚠️ a história FICA escrita — apagar o porquê é como o resíduo volta", () => {
    const fonte = readFileSync("src/lib/achievements.functions.ts", "utf8");
    expect(fonte).toContain("achievementBig");
    expect(semComentarios(fonte)).not.toContain("achievementBig");
  });
});
