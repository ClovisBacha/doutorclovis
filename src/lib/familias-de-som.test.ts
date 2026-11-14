/**
 * UMA RÉGUA SÓ AGRUPA OS SONS POR FAMÍLIA — e ela carrega o Modo Cuidado.
 *
 * A expressão estava escrita TRÊS vezes: nos grupos do motor ao vivo, na folha
 * dos Sons para dormir, e numa terceira constante (`SOUNDSCAPES_POR_FAMILIA`)
 * com ZERO chamadores.
 *
 * ⚠️ **O perigo não era a repetição: era que a terceira não passava por
 * `ofertaveis`.** Ela agrupava `SONS_CONTINUOS` cru — ou seja, oferecia
 * "Coração do bebê" e "Ventre" a quem acabou de perder a gestação, que é o
 * furo de Modo Cuidado que a folha de sons já pagou uma vez. Morta, ela não
 * fazia mal a ninguém; ligada por quem precisasse de um agrupamento amanhã,
 * faria — e nem o `tsc` nem o lint diriam nada, porque o tipo estava certo.
 * É a mesma família do `emCuidado` sem leitor que este repositório já fechou:
 * campo morto que falha ABERTO é armadilha para o próximo.
 *
 * Por isso este arquivo tem as duas metades: ele EXECUTA a régua (o que um
 * teste de texto nunca prova) e varre o `src/` atrás de uma quarta cópia.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "./sem-comentarios";
import { familiasDeSom, FAMILIAS, FORA_DO_MODO_CUIDADO, SONS_CONTINUOS } from "./som-receitas";
import { gruposDeSom } from "./soundscapes";

describe("a régua agrupa e recorta ao mesmo tempo", () => {
  test("fora do luto, nenhum som do catálogo fica sem família", () => {
    const agrupados = familiasDeSom(false).flatMap((g) => g.sons);
    expect([...agrupados].sort()).toEqual([...SONS_CONTINUOS].sort());
  });

  test("⚠️ no luto, os dois que afirmam sobre a gestação somem do agrupamento", () => {
    const agrupados = new Set(familiasDeSom(true).flatMap((g) => g.sons));
    for (const k of FORA_DO_MODO_CUIDADO) expect(agrupados.has(k)).toBe(false);
    /* E só eles: o resto do catálogo continua inteiro. */
    expect(agrupados.size).toBe(SONS_CONTINUOS.length - FORA_DO_MODO_CUIDADO.length);
  });

  test("⚠️ família que ficou vazia não vira título sem nada embaixo", () => {
    /* "Corpo" tem exatamente os dois sons que o Modo Cuidado retira, então ela
       some INTEIRA — é o caso que justifica o filtro, e o que apareceria como
       um som que sumiu se ele não existisse. */
    for (const g of familiasDeSom(true)) expect(g.sons.length).toBeGreaterThan(0);
    const comLuto = familiasDeSom(true).map((g) => g.familia);
    expect(comLuto).not.toContain("Corpo");
    expect(familiasDeSom(false).map((g) => g.familia)).toContain("Corpo");
  });

  test("a ordem é a do catálogo, e não a de um `Object.keys`", () => {
    const ordem = familiasDeSom(false).map((g) => g.familia);
    expect(ordem).toEqual(FAMILIAS.filter((f) => ordem.includes(f)));
  });
});

describe("os dois consumidores herdam o portão", () => {
  test("⚠️ `gruposDeSom` no luto não oferece os dois, em fileira nenhuma", () => {
    const todos = new Set(gruposDeSom(true).flatMap((g) => g.sons));
    for (const k of FORA_DO_MODO_CUIDADO) expect(todos.has(k)).toBe(false);
    /* E o que NÃO é ambiente continua lá: a música e o silêncio não são sons
       do catálogo e não passam pelo recorte. */
    expect(todos.has("silencio")).toBe(true);
  });

  test("`comMusica: false` tira só a música", () => {
    const semMusica = new Set(gruposDeSom(false, false).flatMap((g) => g.sons));
    expect(semMusica.has("musica")).toBe(false);
    expect(semMusica.has("silencio")).toBe(true);
  });
});

/* ── A varredura: ninguém monta o par família→sons por conta própria ──────── */

function fontes(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fontes(p, acc);
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) acc.push(p);
  }
  return acc;
}

/**
 * ⚠️ Casa a LEITURA do mapa de famílias dentro de um filtro — que é a forma
 * exata das três cópias. Um agrupamento escrito de outro jeito escaparia, e
 * tudo bem: isto é uma REDE contra a cópia que já aconteceu três vezes, não
 * uma prova de que nenhuma existe.
 */
const AGRUPA_POR_CONTA_PROPRIA = /FAMILIA_DO_SOM\s*\[[^\]]*\]\s*===/;

describe("a quarta cópia não nasce", () => {
  test("⚠️ só `som-receitas.ts` agrupa — a prosa sai antes de procurar", () => {
    /* ⚠️ `semComentarios` aqui é PREVENTIVO, e é honesto dizer isso: medido
       por mutação, tirá-lo hoje deixa o teste VERDE, porque nenhum comentário
       do `src/` escreve a forma literal que o padrão procura — eles falam do
       agrupamento em português.

       Ele fica porque é a régua da casa para todo teste que lê fonte, e
       porque o caso que ele evita é concreto: no dia em que alguém explicar a
       cópia proibida MOSTRANDO-A num comentário — que é como se explica uma
       proibição —, esta catraca passaria a acusar o arquivo que a documenta. */
    const fora = fontes("src")
      .filter((f) => !f.endsWith("som-receitas.ts"))
      .filter((f) => AGRUPA_POR_CONTA_PROPRIA.test(semComentarios(readFileSync(f, "utf8"))));
    expect(fora).toEqual([]);
  });

  test("a varredura MORDE — senão ela é um enfeite que passa em vazio", () => {
    const copia = `
      const porFamilia = FAMILIAS.map((f) => ({
        familia: f,
        sons: SONS_CONTINUOS.filter((k) => FAMILIA_DO_SOM[k] === f),
      }));
    `;
    expect(AGRUPA_POR_CONTA_PROPRIA.test(semComentarios(copia))).toBe(true);
    /* E a régua verdadeira continua sendo encontrada onde ela mora. */
    expect(
      AGRUPA_POR_CONTA_PROPRIA.test(
        semComentarios(readFileSync("src/lib/som-receitas.ts", "utf8")),
      ),
    ).toBe(true);
  });
});
