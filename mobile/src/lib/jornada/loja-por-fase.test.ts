import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CANTINHO_BY_ID, CANTINHO_ITEMS } from "@/lib/cantinho";
import { CONJUNTO_POR_ID } from "@/lib/conjuntos";
import { trofeusExigidos } from "@/lib/trofeus";
import { conjuntosDaLoja, itensDaLoja, situacaoNaLoja, type LojaPorFase } from "./enfeites";
import {
  conjuntosDaTabela,
  FASES_DA_LOJA,
  linhasDaTabela,
  quandoAbre,
  SEMANA_DEPOIS_DO_PARTO,
  semanaDaLoja,
  semanasDosItens,
  situacaoNaVitrine,
} from "./loja-por-fase";
import { sqlDaLojaPorFase } from "./loja-por-fase-sql";

const RAIZ = join(import.meta.dir, "..", "..", "..", "..");

const fase = (semana: number): LojaPorFase => ({
  porItem: new Map(
    linhasDaTabela().map((l) => [l.item_id, { preco: l.preco, semana: l.semana_minima }]),
  ),
  semana,
});

describe("a régua da loja por fase", () => {
  test("as fases sobem com a gestação, e a primeira abre desde o começo", () => {
    const semanas = FASES_DA_LOJA.map((f) => f.semana);
    expect(semanas[0]).toBe(0);
    expect([...semanas].sort((a, b) => a - b)).toEqual(semanas);
  });

  test("todo item das fases existe, é Premium, está em circulação e não exige troféu", () => {
    for (const f of FASES_DA_LOJA) {
      for (const c of f.conjuntos) expect(CONJUNTO_POR_ID[c]).toBeDefined();
      for (const id of f.avulsos) {
        const item = CANTINHO_BY_ID[id];
        expect(item?.premium).toBe(true);
        expect(item?.aposentado ?? false).toBe(false);
      }
    }
    for (const id of semanasDosItens().keys()) {
      expect(trofeusExigidos(id)).toBe(0);
      expect(CANTINHO_BY_ID[id]!.aposentado ?? false).toBe(false);
    }
  });

  test("todo conjunto fecha na fase dele: nenhuma peça Premium abre depois", () => {
    const semanas = semanasDosItens();
    for (const f of FASES_DA_LOJA) {
      for (const c of f.conjuntos) {
        for (const id of CONJUNTO_POR_ID[c]!.itens) {
          if (CANTINHO_BY_ID[id]?.premium) expect(semanas.get(id)!).toBeLessThanOrEqual(f.semana);
        }
      }
    }
  });

  test("é misto de verdade: abre perto da metade do valor do Premium, não tudo", () => {
    const premium = CANTINHO_ITEMS.filter((i) => i.premium && !i.aposentado);
    const total = premium.reduce((s, i) => s + i.price, 0);
    const aberto = linhasDaTabela().reduce((s, l) => s + l.preco, 0);
    expect(aberto / total).toBeGreaterThan(0.35);
    expect(aberto / total).toBeLessThan(0.65);
  });

  test("o bônus de conjunto pede só os itens que se compram (o de preço zero já é dela)", () => {
    for (const c of conjuntosDaTabela()) {
      expect(c.itens.length).toBeGreaterThan(0);
      for (const id of c.itens) expect(CANTINHO_BY_ID[id]!.price).toBeGreaterThan(0);
      expect(c.bonus).toBe(CONJUNTO_POR_ID[c.conjunto_id]!.itens.length * 12);
    }
  });

  test("⚠️ catraca: o APLICAR_LOJA_POR_FASE.sql é exatamente o que a régua gera", () => {
    const arquivo = readFileSync(
      join(RAIZ, "mobile", "supabase", "APLICAR_LOJA_POR_FASE.sql"),
      "utf8",
    );
    expect(arquivo).toBe(sqlDaLojaPorFase());
  });
});

describe("a vitrine por fase", () => {
  test("à venda, a próxima fase trancada, as outras escondidas", () => {
    const semanas = [0, 14, 28, 37];
    expect(situacaoNaVitrine({ preco: 60, semana: 14 }, 20, semanas)).toBe("a-venda");
    expect(situacaoNaVitrine({ preco: 60, semana: 28 }, 20, semanas)).toBe("em-breve");
    expect(situacaoNaVitrine({ preco: 60, semana: 37 }, 20, semanas)).toBe("escondido");
  });

  test("a semana da régua: a da gestação, tudo depois do parto, zero sem data", () => {
    expect(semanaDaLoja({ semanaDaGestacao: 20, nasceu: false })).toBe(20);
    expect(semanaDaLoja({ semanaDaGestacao: null, nasceu: false })).toBe(0);
    expect(semanaDaLoja({ semanaDaGestacao: null, nasceu: true })).toBe(SEMANA_DEPOIS_DO_PARTO);
  });

  test("o cadeado fala no trimestre que ela conhece", () => {
    expect(quandoAbre(14)).toBe("No 2º trimestre");
    expect(quandoAbre(28)).toBe("No 3º trimestre");
    expect(quandoAbre(37)).toBe("Na reta final");
  });

  test("com 20 semanas: 1º e 2º trimestres à venda, o 3º no fim e trancado, a reta final fora", () => {
    const f = fase(20);
    const itens = itensDaLoja([], f);
    const ids = itens.map((i) => i.id);
    expect(ids).toContain("planta-vaso");
    expect(ids).toContain("trilha-origami");
    expect(ids).toContain("fundo-quartinho");
    expect(ids).not.toContain("trilha-perolas");
    expect(situacaoNaLoja(CANTINHO_BY_ID["fundo-quartinho"]!, [], f)).toBe("em-breve");
    /* Os trancados vão para o fim da vitrine. */
    const primeiroTrancado = itens.findIndex((i) => situacaoNaLoja(i, [], f) === "em-breve");
    expect(
      itens.slice(primeiroTrancado).every((i) => situacaoNaLoja(i, [], f) === "em-breve"),
    ).toBe(true);
  });

  test("sem a tabela (o banco antes do SQL), a vitrine de antes: nenhum Premium à venda", () => {
    expect(itensDaLoja([]).some((i) => i.premium)).toBe(false);
  });

  test("depois do parto, tudo aberto e os conjuntos da reta final dá para fechar", () => {
    const f = fase(SEMANA_DEPOIS_DO_PARTO);
    expect(itensDaLoja([], f).some((i) => situacaoNaLoja(i, [], f) === "em-breve")).toBe(false);
    expect(conjuntosDaLoja([], f).map((p) => p.conjunto.id)).toContain("mar");
  });

  test("um conjunto com peça da próxima fase ainda não aparece para fechar", () => {
    expect(conjuntosDaLoja([], fase(20)).map((p) => p.conjunto.id)).not.toContain("lago");
    expect(conjuntosDaLoja([], fase(20)).map((p) => p.conjunto.id)).toContain("recife");
  });
});
