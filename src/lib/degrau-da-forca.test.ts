import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { colunaAusente } from "@/lib/postgrest";
import { semComentarios } from "@/lib/sem-comentarios";

/**
 * ⚠️ `kick_sessions.strength` NASCE NUM `APLICAR_` QUE O DONO RODA À MÃO —
 * e o deploy chega antes. Sem degrau, o `42703` derruba o select INTEIRO e o
 * histórico de noventa dias da aba de chutes some, com a tela dizendo "não
 * consegui ler": um recurso ANTIGO apagado por uma coluna nova que alimenta um
 * chip. É a forma mais cara de defeito deste repositório, e a razão pela qual
 * toda coluna de `APLICAR_` tem escada.
 */

const tab = semComentarios(readFileSync("src/components/kicks-tab.tsx", "utf8"));

describe("o degrau de `strength`", () => {
  test("o código PostgREST de coluna ausente é reconhecido pela régua única", () => {
    expect(colunaAusente({ code: "42703" })).toBe(true);
    /* ⚠️ `PGRST204` é o de ESCRITA — aqui a leitura devolve `42703`. */
    expect(colunaAusente({ code: "PGRST204" })).toBe(true);
    expect(colunaAusente({ code: "57014" })).toBe(false);
  });

  test("a leitura tem recuo, e ele desce por `colunaAusente`", () => {
    expect(tab).toContain("colunaAusente(error)");
    expect(tab).toMatch(/COLUNAS\.replace\(", strength", ""\)/);
  });

  /* A GARANTIA que importa: uma falha de COLUNA não pode cair no mesmo ramo de
     uma falha de REDE. Se `setInstavel(true)` viesse antes do recuo, o degrau
     seria código morto e o histórico sumiria do mesmo jeito. */
  test("o recuo roda ANTES de a tela desistir", () => {
    const i = tab.indexOf("colunaAusente(error)");
    const j = tab.indexOf("setInstavel(true)");
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(-1);
    expect(i).toBeLessThan(j);
  });

  /* Uma lista só: duas cópias da lista de colunas divergiriam no primeiro
     ajuste, e a divergência apareceria como o recuo pedindo uma coluna que o
     degrau de cima já provou não existir. */
  /* Duas cópias da lista de colunas divergiriam no primeiro ajuste, e a
     divergência apareceria como o recuo pedindo uma coluna que o degrau de cima
     já provou não existir. ⚠️ O arquivo tem OUTRO `.select("id")`, de outra
     consulta — o que se cobra é que só UM select leia a lista, e que só ele
     mencione `strength`. */
  test("a lista de colunas é UMA, e o degrau deriva dela", () => {
    expect(tab.match(/const COLUNAS = "[^"]+";/)).not.toBeNull();
    expect(tab).toContain(".select(cols)");
    const comStrength = [...tab.matchAll(/\.select\("[^"]*"\)/g)].filter((m) =>
      m[0].includes("strength"),
    );
    expect(comStrength.length).toBe(0);
  });
});
