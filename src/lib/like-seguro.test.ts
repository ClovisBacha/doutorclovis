import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { paraLike, trechoParaLike } from "./like-seguro";

describe("os curingas viram literais", () => {
  test("`_` deixa de casar um caractere qualquer", () => {
    /* O cenário medido: a afiliada usa `maria.silva@hotmail.com`; alguém cria
       `maria_silva@hotmail.com`, que é um e-mail legal, e o `ILIKE` casava a
       linha dela — entregando faturamento, código e a lista de indicadas. */
    expect(paraLike("maria_silva@hotmail.com")).toBe("maria\\_silva@hotmail.com");
  });

  test("`%` deixa de casar qualquer sequência", () => {
    expect(paraLike("%@gmail.com")).toBe("\\%@gmail.com");
  });

  test("⚠️ a barra invertida é escapada PRIMEIRO", () => {
    /* Escapando `%`/`_` antes dela, as barras recém-inseridas seriam escapadas
       de novo e o padrão sairia errado. Uma regex com os três numa classe só
       resolve porque o `replace` varre uma vez. */
    expect(paraLike("a\\_b")).toBe("a\\\\\\_b");
  });

  test("texto comum não muda", () => {
    expect(paraLike("maria.silva@hotmail.com")).toBe("maria.silva@hotmail.com");
    expect(paraLike("")).toBe("");
  });

  test("o trecho embrulha depois de escapar", () => {
    /* Os `%` das pontas são NOSSOS e não podem ser escapados — só o miolo. */
    expect(trechoParaLike("ana%")).toBe("%ana\\%%");
    expect(trechoParaLike("%%%")).toBe("%\\%\\%\\%%");
  });
});

describe("⚠️ nenhum `ilike` do repo cola valor cru", () => {
  test("todo `.ilike(` passa por `paraLike`/`trechoParaLike` ou é literal", () => {
    /* A catraca. Um `.ilike("email", email)` novo é o mesmo vazamento de novo,
       e ele é indistinguível de código correto a olho nu. */
    const arquivos: string[] = [];
    const anda = (dir: string) => {
      for (const nome of readdirSync(dir)) {
        const p = join(dir, nome);
        if (statSync(p).isDirectory()) {
          anda(p);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(nome) || nome.includes(".test.")) continue;
        arquivos.push(p);
      }
    };
    anda("src");

    const suspeitos: string[] = [];
    for (const f of arquivos) {
      const src = readFileSync(f, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
      for (const m of src.matchAll(/\.ilike\(\s*("[^"]*"|`[^`]*`)\s*,\s*([^)]*)\)/g)) {
        const valor = m[2];
        const seguro =
          valor.includes("paraLike") ||
          valor.includes("trechoParaLike") ||
          /^\s*(["'`])[^%_$]*\1\s*$/.test(valor);
        if (!seguro) suspeitos.push(`${f}: .ilike(${m[1]}, ${valor.trim().slice(0, 60)})`);
      }
    }
    expect(suspeitos).toEqual([]);
  });
});
