import { describe, expect, test } from "bun:test";
import {
  bandeja,
  categoriasDaLoja,
  conjuntosDaLoja,
  corNoDegrade,
  enfeitesVisiveis,
  itensDaLoja,
  lerDecoracao,
  paradasDoDegrade,
  semearPertoDeHoje,
  semearNovos,
  alturaNoSite,
  enfeitesPorBloco,
  escalaArrastada,
  fatiaDoDegrade,
  moverEnfeite,
  novoEnfeite,
} from "~/lib/jornada/enfeites";
import {
  CANTINHO_BY_ID,
  CANTINHO_COMPLETION_CATEGORIES,
  CANTINHO_COMPLETION_MIN,
} from "@/lib/cantinho";
import { CONJUNTO_POR_ID } from "@/lib/conjuntos";

describe("os enfeites novos nascem perto de hoje (a régua do app)", () => {
  const HOJE = 17000;
  const TRILHA = 27152;
  const de = (r: ReturnType<typeof semearPertoDeHoje>, id: string) => r.filter((p) => p.id === id);

  test("uma compra cai na primeira tela, nas calhas, em duas cópias", () => {
    const r = semearPertoDeHoje(["bicho-joaninha"], HOJE, TRILHA, 0);
    expect(r).toHaveLength(2);
    for (const p of r) {
      expect(Math.abs(p.y - HOJE)).toBeLessThanOrEqual(290);
      // por fora das bolinhas (que chegam a 16% e 84% da largura)
      expect(p.x <= 11 || p.x >= 89).toBe(true);
    }
    // uma de cada lado
    expect(r.some((p) => p.x <= 11) && r.some((p) => p.x >= 89)).toBe(true);
  });

  test("o céu nasce acima de hoje; o especial em uma cópia, maior; a planta maior", () => {
    const r = semearPertoDeHoje(
      ["ceu-estrelinhas", "especial-primavera", "planta-suculenta"],
      HOJE,
      TRILHA,
      0,
    );
    for (const p of de(r, "ceu-estrelinhas")) expect(p.y).toBeLessThan(HOJE);
    expect(de(r, "especial-primavera")).toHaveLength(1);
    expect(de(r, "especial-primavera")[0].s).toBe(1.6);
    expect(de(r, "planta-suculenta").map((p) => p.s)).toEqual([1.25, 1.25]);
  });

  test("é sempre o mesmo lugar para o mesmo item, e nunca fora da trilha", () => {
    expect(semearPertoDeHoje(["luz-vela"], HOJE, TRILHA, 3)).toEqual(
      semearPertoDeHoje(["luz-vela"], HOJE, TRILHA, 3),
    );
    for (const p of semearPertoDeHoje(["ceu-estrelinhas", "agua-poca"], 30, TRILHA, 0))
      expect(p.y).toBeGreaterThanOrEqual(20);
    for (const p of semearPertoDeHoje(["agua-poca"], TRILHA, TRILHA, 0))
      expect(p.y).toBeLessThanOrEqual(TRILHA - 20);
  });

  test("um lote grande se abre mais, sem amontoar", () => {
    const ids = itensDaLoja([])
      .filter((i) => i.price > 0 && i.type !== "fundo" && i.type !== "trilha")
      .map((i) => i.id);
    const ys = semearPertoDeHoje(ids, HOJE, TRILHA, 0).map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(600);
    for (const y of ys) expect(Math.abs(y - HOJE)).toBeLessThanOrEqual(800);
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
    const primeira = semearNovos(
      null,
      ["planta-suculenta", "ceu-estrelinhas"],
      27000,
      17000,
    ).decoracao!;
    expect(primeira.items).toHaveLength(4);
    expect(primeira.seen).toEqual(["planta-suculenta", "ceu-estrelinhas"]);
    expect(semearNovos(primeira, ["planta-suculenta", "ceu-estrelinhas"], 27000, 17000)).toEqual({
      decoracao: null,
      esperando: 0,
    });
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
    // primavera, que vinha depois, espera a próxima abertura; e as duas
    // ficam FORA do `seen`, para nascerem quando houver vaga
    expect(semearNovos(cheia, ["bicho-joaninha", "especial-primavera"], 27000, 17000)).toEqual({
      decoracao: null,
      esperando: 2,
    });
    const so = semearNovos(cheia, ["especial-primavera"], 27000, 17000);
    expect(so.decoracao?.items).toHaveLength(120);
    expect(so.esperando).toBe(0);
  });

  test("cada enfeite cai no bloco certo, na altura certa dentro dele", () => {
    // blocos de 120, 112 e 78 — começando em y = 8, como no site
    const alturas = [120, 112, 78];
    expect(alturaNoSite(alturas)).toBe(8 + 310 + 40);
    const em = (y: number) => ({ k: `k${y}`, id: "planta-trevo", x: 50, y, s: 1 });
    const porBloco = enfeitesPorBloco([em(0), em(8), em(127), em(128), em(240), em(9999)], alturas);
    expect(porBloco.map((b) => b.map((e) => e.y))).toEqual([[-8, 0, 119], [0], [0, 9999 - 240]]);
  });

  test("arrastar, redimensionar e pôr da bandeja ficam dentro da trilha", () => {
    const p = { k: "a", id: "planta-trevo", x: 90, y: 100, s: 1 };
    expect(moverEnfeite(p, 20, -500, 27000)).toEqual({ ...p, x: 97, y: 20 });
    expect(moverEnfeite(p, -5, 26950, 27000)).toEqual({ ...p, x: 85, y: 26980 });
    expect(escalaArrastada(1, 80, 80)).toBe(2);
    expect(escalaArrastada(1, -400, 0)).toBe(0.5);
    expect(escalaArrastada(4, 400, 400)).toBe(4.5);
    expect(novoEnfeite("bicho-joaninha", 5, 27000, "u1")).toEqual({
      k: "u1",
      id: "bicho-joaninha",
      x: 50,
      y: 40,
      s: 1.4,
    });
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
  test("a fatia da janela à vista leva as pontas e as paradas do meio", () => {
    const p = paradasDoDegrade("linear-gradient(180deg,#fde7c8 0%,#fbcfa0 40%,#f6e6cf 100%)");
    const f = fatiaDoDegrade(p, 0.3, 0.5);
    expect(f.cores).toEqual([corNoDegrade(p, 0.3), "#fbcfa0", corNoDegrade(p, 0.5)]);
    expect(f.posicoes.map((n) => Number(n.toFixed(3)))).toEqual([0, 0.5, 1]);
    expect(fatiaDoDegrade(p, 0.9, 0.9).cores).toHaveLength(2);
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
