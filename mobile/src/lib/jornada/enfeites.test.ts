import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  bandeja,
  categoriasDaLoja,
  conjuntosDaLoja,
  corNoDegrade,
  enfeitesVisiveis,
  itensDaLoja,
  lerDecoracao,
  paradasDoDegrade,
  semearEnfeites,
  semearNovos,
} from "~/lib/jornada/enfeites";
import {
  CANTINHO_BY_ID,
  CANTINHO_COMPLETION_CATEGORIES,
  CANTINHO_COMPLETION_MIN,
} from "@/lib/cantinho";
import { CONJUNTO_POR_ID } from "@/lib/conjuntos";

const SITE = readFileSync(
  join(import.meta.dir, "..", "..", "..", "..", "src", "components", "gestacao-path.tsx"),
  "utf8",
);

describe("os enfeites nascem onde nasceriam no site", () => {
  test("a régua do site é a mesma (seedDecor)", () => {
    expect(SITE).toContain("const span = Math.max(240, height - 260);");
    expect(SITE).toContain("? 40 + (((h % 90) + e * 110 + idx * 37) % 200)");
    expect(SITE).toContain(": 130 + (((h % 400) + e * 880 + idx * 270) % span);");
    expect(SITE).toContain(
      'item.type === "ceu" ? 12 + ((h >>> (e + 5)) % 76) : side === 0 ? 8 + jitter : 82 + jitter;',
    );
  });

  test("o vetor de referência do site", () => {
    const r = semearEnfeites(
      ["ceu-estrelinhas", "bicho-joaninha", "especial-primavera", "planta-suculenta"],
      27000,
      0,
    );
    const de = (id: string) => r.filter((p) => p.id === id).map((p) => [p.x, p.y, p.s]);
    expect(de("ceu-estrelinhas")).toEqual([
      [59, 98, 1],
      [73, 208, 1],
    ]);
    expect(de("bicho-joaninha")).toEqual([
      [88, 746, 1],
      [11, 1626, 1],
    ]);
    expect(de("especial-primavera")).toEqual([[8, 830, 1.6]]);
    expect(de("planta-suculenta")).toEqual([
      [89, 1091, 1.25],
      [16, 1971, 1.25],
    ]);
  });

  test("a bandeja deixa de fora cenário, pele, céu do app e clima", () => {
    expect(
      bandeja([
        "fundo-simples",
        "trilha-jardim",
        "tema-ceu-v1",
        "clima-petalas",
        "planta-suculenta",
        "especial-chuva",
      ]),
    ).toEqual(["planta-suculenta", "especial-chuva"]);
  });

  test("semeia só o que é novo, uma vez, e respeita o teto de 120", () => {
    const primeira = semearNovos(null, ["planta-suculenta", "ceu-estrelinhas"], 27000)!;
    expect(primeira.items).toHaveLength(4);
    expect(primeira.seen).toEqual(["planta-suculenta", "ceu-estrelinhas"]);
    expect(semearNovos(primeira, ["planta-suculenta", "ceu-estrelinhas"], 27000)).toBeNull();
    const cheia = {
      v: 1 as const,
      items: Array.from({ length: 119 }, (_, i) => ({
        k: `p${i}`,
        id: "planta-trevo",
        x: 50,
        y: i,
        s: 1,
      })),
      seen: [],
    };
    // a joaninha (2 vagas) não cabe e PARA a fila, como no site — a
    // primavera, que vinha depois, espera a próxima abertura
    expect(semearNovos(cheia, ["bicho-joaninha", "especial-primavera"], 27000)).toBeNull();
    expect(semearNovos(cheia, ["especial-primavera"], 27000)?.items).toHaveLength(120);
  });

  test("o layout gravado é limpo ao ler, e o de clima nunca aparece", () => {
    const d = lerDecoracao({
      items: [
        { id: "nao-existe" },
        { id: "planta-trevo", x: 500, s: 9 },
        { id: "clima-petalas", x: 10, y: 10 },
      ],
      seen: ["x", 3],
    })!;
    expect(d.items[0]).toEqual({ k: "p0", id: "planta-trevo", x: 97, y: 0, s: 4.5 });
    expect(d.seen).toEqual(["x"]);
    expect(enfeitesVisiveis(d, null).map((p) => p.id)).toEqual(["planta-trevo"]);
    expect(enfeitesVisiveis(d, ["bicho-joaninha"])).toEqual([]);
  });
});

describe("o cenário equipado", () => {
  test("lê o degradê do catálogo e acha a cor em qualquer ponto", () => {
    const p = paradasDoDegrade("linear-gradient(180deg,#fde7c8 0%,#fbcfa0 40%,#f6e6cf 100%)");
    expect(p).toEqual([
      { cor: "#fde7c8", pos: 0 },
      { cor: "#fbcfa0", pos: 0.4 },
      { cor: "#f6e6cf", pos: 1 },
    ]);
    expect(corNoDegrade(p, 0)).toBe("#fde7c8");
    expect(corNoDegrade(p, 0.4)).toBe("#fbcfa0");
    expect(corNoDegrade(p, 1)).toBe("#f6e6cf");
    expect(
      paradasDoDegrade("linear-gradient(180deg,#f3e8ff 0%,#fde2e4 55%,#fff 100%)")[2].cor,
    ).toBe("#ffffff");
  });
});

describe("a lojinha do app, sem Premium", () => {
  test("mostra só os itens de sementinha e os premium que ela já tem", () => {
    const itens = itensDaLoja(["planta-hortela"]);
    expect(itens.some((i) => i.id === "planta-hortela")).toBe(true);
    expect(itens.some((i) => i.id === "planta-cacto")).toBe(false);
    expect(itens.every((i) => !i.premium || i.id === "planta-hortela")).toBe(true);
    expect(itens.some((i) => i.type === "tema")).toBe(false);
    expect(itens[itens.length - 1].id).toBe("especial-colecao");
    expect(categoriasDaLoja(itens).some((c) => c.key === "clima")).toBe(false);
  });
  test("a escada de preço: o que ela alcança primeiro vem primeiro", () => {
    const precos = itensDaLoja([])
      .slice(0, -1)
      .map((i) => i.price);
    expect(precos).toEqual([...precos].sort((a, b) => a - b));
  });
  test("a Coroa continua alcançável: há categorias de sementinha que bastam", () => {
    const categorias = new Set(
      itensDaLoja([])
        .filter((i) => i.price > 0 && CANTINHO_COMPLETION_CATEGORIES.includes(i.type))
        .map((i) => i.type),
    );
    expect(categorias.size).toBeGreaterThanOrEqual(CANTINHO_COMPLETION_MIN);
  });
  test("conjunto que ela não consegue completar no app não aparece", () => {
    expect(conjuntosDaLoja([])).toEqual([]);
    const bichinhos = CONJUNTO_POR_ID["bichinhos"];
    const premiumDele = bichinhos.itens.filter((id) => CANTINHO_BY_ID[id]?.premium);
    expect(conjuntosDaLoja(premiumDele).map((p) => p.conjunto.id)).toContain("bichinhos");
  });
});
