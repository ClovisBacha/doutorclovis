/**
 * `?x=1` CHEGA COMO NÚMERO — e uma bancada que compara com a STRING abre no
 * estado errado, em silêncio.
 *
 * O router JSON-parseia a query: `?luto=1` vira o NÚMERO 1, e
 * `q.luto === "1"` é falso. A bancada abre no PADRÃO e a URL volta reescrita
 * como `?luto=false`. Medido em quatro parâmetros de três arquivos, todos
 * documentados no CLAUDE.md como se funcionassem:
 *
 *   · `/preview-sons?luto=1`            a folha de sons sem "Ritmo de ninar"
 *   · `/preview-cantinho?luto=1`        o Cantinho no Modo Cuidado
 *   · `/preview-cantinho?vazio=1`       o vazio que ensina
 *   · `/preview-jogo?…&premium=1`       a assinante
 *
 * ⚠️ **E A VARREDURA DE BANCADAS NÃO TEM COMO VER.** Ela abre a página e lê o
 * CONSOLE — uma tela que desenha o estado errado não registra erro nenhum, e
 * as quatro passavam verdes há levas. É a mesma cegueira que já deixou uma
 * bancada aprovar uma frase que o servidor nunca produziria.
 *
 * ⚠️ É a QUARTA aparição desta família no repositório: `Number(true)` virando
 * 1 em `preview-home`, `Number(null)` virando 0 em `preview-saude`, e agora o
 * número que não casa a string. Por isso ela tem catraca.
 *
 * `preview-saude.tsx` já tinha o conserto (`|| q.luto === 1`), e foi ele que
 * provou a causa: era o único dos cinco medidos que voltava `?luto=true`.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "./sem-comentarios";

const ROTAS = "src/routes";

/** O corpo do `validateSearch`, por contagem de chaves. */
function validador(fonte: string): string {
  const i = fonte.indexOf("validateSearch");
  if (i < 0) return "";
  const abre = fonte.indexOf("{", i);
  if (abre < 0) return "";
  let n = 0;
  for (let j = abre; j < fonte.length; j++) {
    if (fonte[j] === "{") n++;
    else if (fonte[j] === "}" && --n === 0) return fonte.slice(abre, j + 1);
  }
  return "";
}

/**
 * ⚠️ Acusa `=== "1"` que NÃO aceite o número ao lado. As três formas seguras
 * do repositório passam: `String(q.x ?? "") === "1"`, `q.x === 1`, e
 * `Boolean(q.x)`.
 */
function comparaSoComString(corpo: string): boolean {
  return [...corpo.matchAll(/===\s*"1"/g)].some((m) => {
    const volta = corpo.slice(Math.max(0, m.index - 120), m.index);
    const vai = corpo.slice(m.index, m.index + 160);
    if (/String\s*\(/.test(volta)) return false;
    return !/===\s*1\b/.test(vai) && !/===\s*1\b/.test(volta);
  });
}

const BANCADAS = readdirSync(ROTAS).filter((f) => /^preview-.*\.tsx$/.test(f));

describe("o parâmetro da bancada chega", () => {
  test("há bancadas para varrer — senão isto passa em vazio", () => {
    expect(BANCADAS.length).toBeGreaterThan(20);
  });

  test('⚠️ nenhuma compara só com a STRING `"1"`', () => {
    /* ⚠️ `semComentarios` fica porque os arquivos consertados EXPLICAM a
       armadilha CITANDO o padrão proibido — e um comentário é justamente onde
       se mostra a forma errada.

       Medido por mutação: tirá-lo HOJE deixa o teste verde, e por um
       acidente de redação — a heurística abaixo absolve qualquer `=== "1"`
       precedido de `String(`, e as três notas por acaso dizem `String(...)`
       antes de citar o padrão. Depender disso é deixar a catraca acusar o
       arquivo que a documenta na primeira vez que alguém reescrever a frase.
       O teste logo abaixo prova o caso, sem depender da redação de hoje. */
    const frageis = BANCADAS.filter((f) =>
      comparaSoComString(validador(semComentarios(readFileSync(join(ROTAS, f), "utf8")))),
    );
    expect(frageis).toEqual([]);
  });

  test("a varredura MORDE, e não acusa as formas seguras", () => {
    expect(comparaSoComString('luto: q.luto === "1" || q.luto === true,')).toBe(true);
    expect(comparaSoComString('luto: q.luto === "1" || q.luto === 1 || q.luto === true,')).toBe(
      false,
    );
    expect(comparaSoComString('luto: q.luto === true || String(q.luto ?? "") === "1",')).toBe(
      false,
    );
    expect(comparaSoComString("luto: q.luto == null ? false : Boolean(q.luto),")).toBe(false);
  });

  test("⚠️ sem apagar a prosa, a catraca acusaria o comentário que a explica", () => {
    /* Uma nota que mostra a forma errada — que é como se explica uma
       proibição — e NÃO tem `String(` antes dela. */
    const comProsa = [
      "{",
      '  /* nunca compare com q.x === "1" sozinho: o número não casa. */',
      '  x: q.x === true || String(q.x ?? "") === "1",',
      "}",
    ].join("\n");
    expect(comparaSoComString(comProsa)).toBe(true);
    expect(comparaSoComString(semComentarios(comProsa))).toBe(false);
  });

  test("o recorte é o `validateSearch`, e ele casa de verdade", () => {
    const fonte = semComentarios(readFileSync(join(ROTAS, "preview-sons.tsx"), "utf8"));
    const corpo = validador(fonte);
    expect(corpo.length).toBeGreaterThan(10);
    expect(corpo).toContain("luto");
    /* E não engoliu o arquivo inteiro. */
    expect(corpo.length).toBeLessThan(fonte.length / 2);
  });
});
