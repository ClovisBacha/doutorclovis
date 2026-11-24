import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CANTINHO_BY_ID } from "@/lib/cantinho";
import { semComentarios } from "@/lib/sem-comentarios";
import {
  alternar,
  APOIO,
  CHAVE_DO_QUARTINHO,
  contaDaCompra,
  decorarAoAcaso,
  cumprirSePronta,
  ehNoiteNoQuarto,
  emOrdemDeDesenho,
  falaDoEmBreve,
  guardarMemoria,
  ITEM_POR_ID,
  ITENS,
  lerQuartinho,
  missaoDoDia,
  MISSOES,
  presenteDaMissao,
  QUARTO_INICIAL,
  REGUA_DA_LUZ,
  situacaoDoItem,
  vendaNoQuarto,
  type Quartinho,
  type VitrineDoQuarto,
} from "./quarto";
import { linhasDaTabela, type ItemPorFase } from "~/lib/jornada/loja-por-fase";

const RAIZ = join(import.meta.dir, "..", "..", "..");
const preco = (id: string) => CANTINHO_BY_ID[id]?.price;
/** A loja por fase como o banco a devolve (a tabela gerada do mesmo arquivo). */
const FASES: ReadonlyMap<string, ItemPorFase> = new Map(
  linhasDaTabela().map((l) => [l.item_id, { preco: l.preco, semana: l.semana_minima }]),
);
const vitrine = (posse: string[] | null, semana = 24): VitrineDoQuarto => ({
  posse: posse ? new Set(posse) : null,
  porFase: FASES,
  semana,
});
const quarto = (postos: Quartinho["postos"], missoes: Quartinho["missoes"] = {}): Quartinho => ({
  v: 1,
  postos,
  missoes,
  memorias: [],
});

describe("o quartinho: os itens", () => {
  test("todo item tem a sua arte, e o quarto tem a dele e a janela da noite", () => {
    for (const i of ITENS)
      expect({
        i: i.id,
        tem: existsSync(join(RAIZ, "assets", "quartinho", `${i.id}.webp`)),
      }).toEqual({ i: i.id, tem: true });
    for (const q of ["quarto-dia", "quarto-noite", "estrelas-noite"])
      expect(existsSync(join(RAIZ, "assets", "quartinho", `${q}.webp`))).toBe(true);
  });

  test("o item da lojinha é um item que existe no catálogo, com preço", () => {
    for (const i of ITENS.filter((x) => x.lojinha)) {
      expect(CANTINHO_BY_ID[i.lojinha!]).toBeDefined();
      expect(preco(i.lojinha!)).toBeGreaterThan(0);
    }
    /* Dois itens do quarto nunca são o MESMO item da lojinha. */
    const ids = ITENS.flatMap((i) => (i.lojinha ? [i.lojinha] : []));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("os lugares cabem no quarto, e a parede fica atrás do chão", () => {
    for (const i of ITENS) {
      const { x, base, largura } = i.lugar;
      expect(x - largura / 2).toBeGreaterThanOrEqual(-0.01);
      expect(x + largura / 2).toBeLessThanOrEqual(1.01);
      expect(base).toBeGreaterThan(0.15);
      expect(base).toBeLessThan(0.8);
    }
    const ordem = emOrdemDeDesenho(["ursinho", "berco", "prateleira", "tapete"]).map((i) => i.id);
    expect(ordem).toEqual(["prateleira", "tapete", "berco", "ursinho"]);
  });
});

describe("o quartinho: a luz de cada item", () => {
  test("todo item declara a sua luz (ou que não tem), num degrau da régua", () => {
    const degraus = new Set<number>(Object.values(REGUA_DA_LUZ));
    for (const i of ITENS) {
      /* `undefined` é item novo sem a ficha: a régua é obrigatória. */
      expect({ i: i.id, declarou: i.luz !== undefined }).toEqual({ i: i.id, declarou: true });
      if (!i.luz) continue;
      expect({ i: i.id, naRegua: degraus.has(i.luz.potencia) }).toEqual({ i: i.id, naRegua: true });
      expect(i.luz.tom).toMatch(/^#[0-9a-f]{6}$/i);
      for (const f of i.luz.de) {
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThanOrEqual(1);
      }
      /* Só quem ilumina de verdade lança luz no chão. */
      if (i.luz.chao) expect(i.luz.potencia).toBeGreaterThanOrEqual(REGUA_DA_LUZ.luzNoturna);
    }
  });

  test("a proporção é a da vida real: a lâmpada manda, e o que não acende fica apagado", () => {
    expect(ITEM_POR_ID.luminaria.luz?.potencia).toBe(REGUA_DA_LUZ.lampada);
    expect(ITEM_POR_ID.mobile.luz?.potencia).toBe(REGUA_DA_LUZ.brilhaNoEscuro);
    for (const id of ["poltrona", "ursinho", "coelhinho", "berco", "comoda", "tapete"] as const)
      expect(ITEM_POR_ID[id].luz).toBeNull();
    const degraus = Object.values(REGUA_DA_LUZ);
    expect([...degraus].sort((a, b) => b - a)).toEqual(degraus);
  });
});

describe("o quartinho: pôr, tirar e ter", () => {
  test("lê o guardado com cuidado: lixo vira o quarto de saída", () => {
    expect(lerQuartinho(null)).toEqual(QUARTO_INICIAL);
    expect(
      lerQuartinho({ postos: ["berco", "nada", "berco"], missoes: { ursinho: "ontem" } }),
    ).toEqual(quarto(["berco"]));
  });

  test("pôr e tirar; o móbile só vai com o berço, e sai com ele", () => {
    const q = quarto(["comoda"]);
    expect(alternar(q, "ursinho").postos).toEqual(["comoda", "ursinho"]);
    expect(alternar(alternar(q, "ursinho"), "ursinho").postos).toEqual(["comoda"]);
    expect(alternar(q, "mobile")).toBe(q);
    const comBerco = alternar(alternar(q, "berco"), "mobile");
    expect(comBerco.postos).toEqual(["comoda", "berco", "mobile"]);
    expect(alternar(comBerco, "berco").postos).toEqual(["comoda"]);
  });

  test("da lojinha: livre se ela tem; se não tem, à venda quando a fase dela chega", () => {
    const q = quarto([]);
    const berco = ITEM_POR_ID.berco;
    expect(situacaoDoItem(berco, q, vitrine(["objeto-berco"]))).toEqual({ tipo: "livre" });
    /* O berço abre no 3º trimestre: na semana 24 ele ainda não se vende. */
    expect(situacaoDoItem(berco, q, vitrine([], 24))).toEqual({
      tipo: "em-breve",
      lojinha: "objeto-berco",
      quando: "No 3º trimestre",
    });
    expect(situacaoDoItem(berco, q, vitrine([], 30))).toEqual({
      tipo: "comprar",
      preco: FASES.get("objeto-berco")!.preco,
      lojinha: "objeto-berco",
      daFase: true,
    });
  });

  test("a venda no quarto é a MESMA da vitrine da lojinha", () => {
    /* O que não é Premium: à venda pelo preço do catálogo, sem a loja por fase. */
    expect(vendaNoQuarto("objeto-cestinho", null, 0)).toEqual({
      tipo: "comprar",
      preco: preco("objeto-cestinho")!,
      lojinha: "objeto-cestinho",
      daFase: false,
    });
    /* Premium sem a tabela do banco: o servidor do site recusa, então não vende. */
    expect(vendaNoQuarto("objeto-luminaria", null, 40).tipo).toBe("em-breve");
    /* O preço que vale é o do banco, não o do catálogo. */
    const caro = new Map([["objeto-luminaria", { preco: 999, semana: 0 }]]);
    expect(vendaNoQuarto("objeto-luminaria", caro, 5)).toMatchObject({ preco: 999, daFase: true });
    /* Depois do parto, tudo aberto. */
    for (const i of ITENS.filter((x) => x.lojinha))
      expect(situacaoDoItem(i, quarto([]), vitrine([], 99)).tipo).toBe("comprar");
    /* Todo item da lojinha no quarto existe na vitrine em alguma fase (ou não é Premium). */
    for (const i of ITENS.filter((x) => x.lojinha)) {
      const c = CANTINHO_BY_ID[i.lojinha!]!;
      expect({ i: i.id, vende: !c.premium || FASES.has(i.lojinha!) }).toEqual({
        i: i.id,
        vende: true,
      });
    }
  });

  test("a conta da compra e a fala do que ainda não abriu", () => {
    expect(contaDaCompra(80, 100)).toEqual({ pode: true, fica: 20 });
    expect(contaDaCompra(80, 80)).toEqual({ pode: true, fica: 0 });
    expect(contaDaCompra(80, 50)).toEqual({ pode: false, faltam: 30 });
    expect(contaDaCompra(80, null)).toEqual({ pode: true, fica: null });
    expect(falaDoEmBreve("No 3º trimestre")).toBe("Abre no 3º trimestre. Junte sementinhas!");
    expect(falaDoEmBreve("Em breve")).toBe("Esse chega em breve na lojinha.");
  });

  test("os presentes: os de saída livres; os da missão, só depois dela", () => {
    const q = quarto([]);
    for (const id of ["comoda", "prateleira", "ursinho"] as const)
      expect(situacaoDoItem(ITEM_POR_ID[id], q, vitrine(null)).tipo).toBe("livre");
    expect(situacaoDoItem(ITEM_POR_ID["quadro-lua"], q, vitrine(null)).tipo).toBe("missao");
    expect(
      situacaoDoItem(
        ITEM_POR_ID["quadro-lua"],
        quarto([], { ursinho: "2026-11-23" }),
        vitrine(null),
      ).tipo,
    ).toBe("livre");
    /* Toda missão que dá presente dá um item que não é da lojinha. */
    for (const m of MISSOES) {
      const p = presenteDaMissao(m);
      if (p) expect(p.lojinha).toBeUndefined();
    }
  });
});

describe("o quartinho: as missões", () => {
  test("uma por dia, na ordem; cumprida, a próxima espera amanhã", () => {
    const hoje = "2026-11-23";
    const q0 = quarto(["comoda"]);
    const d0 = missaoDoDia(q0, hoje);
    expect(d0).toMatchObject({ estado: "aberta", feitos: 0, total: 1 });
    expect(d0.estado === "aberta" && d0.missao.id).toBe("ursinho");

    const { quarto: q1, cumprida } = cumprirSePronta(alternar(q0, "ursinho"), hoje);
    expect(cumprida?.id).toBe("ursinho");
    expect(q1.missoes.ursinho).toBe(hoje);
    expect(missaoDoDia(q1, hoje)).toMatchObject({ estado: "cumprida-hoje" });

    /* No mesmo dia, mesmo com a parede pronta, a segunda não fecha. */
    const comQuadro = alternar(q1, "quadro-lua");
    expect(cumprirSePronta(comQuadro, hoje).cumprida).toBeNull();
    /* No dia seguinte, ela fecha. */
    expect(cumprirSePronta(comQuadro, "2026-11-24").cumprida?.id).toBe("parede");
  });

  test("a missão de dois itens conta cada um", () => {
    const q = quarto(["poltrona"], {
      ursinho: "2026-11-20",
      parede: "2026-11-21",
    });
    expect(missaoDoDia(q, "2026-11-23")).toMatchObject({ estado: "aberta", feitos: 1, total: 2 });
  });

  test("as memórias: uma por dia, a última do dia vale", () => {
    let q = quarto(["comoda"]);
    q = guardarMemoria(q, "2026-11-22");
    q = guardarMemoria(alternar(q, "ursinho"), "2026-11-23");
    q = guardarMemoria(alternar(q, "berco"), "2026-11-23");
    expect(q.memorias).toEqual([
      { dia: "2026-11-22", postos: ["comoda"] },
      { dia: "2026-11-23", postos: ["comoda", "ursinho", "berco"] },
    ]);
  });

  test("decorar ao acaso: só o que ela pode pôr, e o móbile só com o berço", () => {
    const livres = ["comoda", "prateleira", "ursinho", "mobile", "tapete"] as const;
    /* Sorteio que tira o berço (não está livre) e deixa o resto: o móbile sai. */
    const q = decorarAoAcaso(quarto(["berco"]), livres, () => 0.1);
    expect(q.postos).toEqual(["comoda", "prateleira", "ursinho", "tapete"]);
    /* Um sorteio que não põe quase nada ainda deixa o quarto mobiliado. */
    expect(decorarAoAcaso(quarto([]), livres, () => 0.99).postos.length).toBeGreaterThanOrEqual(3);
    /* Todo item tem onde se apoiar (é o que decide a sombra dele). */
    for (const i of ITENS) expect(APOIO[i.id]).toBeDefined();
  });

  test("a noite do quarto é a do céu do app", () => {
    expect([18, 19, 23, 0, 4, 5].map(ehNoiteNoQuarto)).toEqual([
      false,
      true,
      true,
      true,
      true,
      false,
    ]);
  });
});

describe("o quartinho: a tela (catraca do fonte)", () => {
  const ler = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, "src", ...p), "utf8"));

  test("a Bolha do céu abre o quartinho", () => {
    expect(ler("componentes", "jornada", "hoje.tsx")).toMatch(/router\.push\("\/quartinho"\)/);
  });

  test("a compra é ali mesmo, pela mesma compra da lojinha, sem mandar à lojinha", () => {
    const tela = ler("app", "quartinho.tsx");
    expect(tela).toMatch(/comprarItem\(s\.lojinha, s\.daFase\)/);
    expect(tela).toMatch(/lerALojaPorFase\(\)/);
    expect(tela).not.toMatch(/router\.push\("\/jornada\/recompensas"\)/);
    expect(tela).not.toMatch(/CANTINHO_BY_ID\[[^\]]+\]\??\.price/);
  });

  test("Modo Cuidado não abre o quarto; sementinha não se compra; o quarto se grava", () => {
    const tela = ler("app", "quartinho.tsx");
    expect(tela).toMatch(/estadoDoPerfil === "pronto" && cuidado\) return <Redirect/);
    expect(tela).not.toMatch(/estrelinha|comprar sementinhas|pacote de sementinhas/i);
    expect(tela).toMatch(/gravarChave\(CHAVE_DO_QUARTINHO/);
    expect(CHAVE_DO_QUARTINHO.startsWith("dc-path-")).toBe(true);
  });
});
