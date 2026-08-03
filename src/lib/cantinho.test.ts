/**
 * O catálogo do Cantinho é dado, não código — e por isso erra em silêncio.
 * Um id repetido, um item de categoria que não renderiza, um preço fora da
 * escala: nada disso quebra o build, tudo isso a paciente paga.
 *
 * O teste mais importante daqui é o último: a Coroa da Coleção não pode ser
 * RETIRADA de quem já a tem. Foi o que quase aconteceu ao criar Luzes e Águas.
 */

import { describe, expect, test } from "bun:test";
import {
  CANTINHO_CATEGORIES,
  CANTINHO_COMPLETION_CATEGORIES,
  CANTINHO_COMPLETION_MIN,
  CANTINHO_COMPLETIONIST_ID,
  CANTINHO_FUNDO_BG,
  CANTINHO_ITEMS,
  cantinhoCategoriasCompletas,
  isCantinhoCollectionComplete,
  type CantinhoType,
} from "./cantinho";
import { TRILHA_SKINS } from "./trilha-skins";

const pagos = CANTINHO_ITEMS.filter((i) => i.price > 0 && i.id !== CANTINHO_COMPLETIONIST_ID);

describe("integridade do catálogo", () => {
  test("nenhum id repetido", () => {
    const ids = CANTINHO_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("nenhum nome repetido (dois tiles iguais na grade confundem)", () => {
    const nomes = CANTINHO_ITEMS.map((i) => i.name);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  test("toda categoria usada por um item aparece no filtro da loja", () => {
    const noFiltro = new Set(CANTINHO_CATEGORIES.map((c) => c.key));
    for (const i of CANTINHO_ITEMS) expect(noFiltro.has(i.type)).toBe(true);
  });

  test("toda categoria do filtro tem pelo menos um item", () => {
    for (const c of CANTINHO_CATEGORIES)
      expect(CANTINHO_ITEMS.some((i) => i.type === c.key)).toBe(true);
  });

  test("preço não-negativo e inteiro", () => {
    for (const i of CANTINHO_ITEMS) {
      expect(Number.isInteger(i.price)).toBe(true);
      expect(i.price).toBeGreaterThanOrEqual(0);
    }
  });

  test("só o Fundo Suave e a Coroa são de graça", () => {
    const gratis = CANTINHO_ITEMS.filter((i) => i.price === 0).map((i) => i.id);
    expect(gratis.sort()).toEqual(["especial-colecao", "fundo-simples"]);
  });
});

/* ── Item que não aparece é dinheiro em troca de nada ────────────────────
   Foi o que a auditoria encontrou: cinco itens de `ceu` que só existiam se a
   paciente descobrisse sozinha o modo Arrumar. */
describe("todo item pago tem onde aparecer", () => {
  test("todo cenário comprável tem gradiente", () => {
    for (const i of pagos.filter((i) => i.type === "fundo"))
      if (!CANTINHO_FUNDO_BG[i.id]) throw new Error(`cenário sem gradiente: ${i.id}`);
  });

  test("toda pele da loja tem as três artes", () => {
    for (const i of CANTINHO_ITEMS.filter((i) => i.type === "trilha")) {
      const skin = TRILHA_SKINS[i.id];
      if (!skin) throw new Error(`pele na loja sem arte: ${i.id}`);
      for (const estado of ["futuro", "atual", "feito"] as const)
        if (!skin.arte[estado]) throw new Error(`${i.id} sem o estado ${estado}`);
    }
  });

  test("toda pele com arte está na loja (senão ninguém a alcança)", () => {
    const naLoja = new Set(CANTINHO_ITEMS.filter((i) => i.type === "trilha").map((i) => i.id));
    for (const id of Object.keys(TRILHA_SKINS)) expect(naLoja.has(id)).toBe(true);
  });

  test("todo emoji é não-vazio (o sprite da trilha é o emoji)", () => {
    for (const i of CANTINHO_ITEMS) expect(i.emoji.trim().length).toBeGreaterThan(0);
  });
});

describe("a Coroa da Coleção é alcançável", () => {
  test("o piso é menor ou igual ao número de categorias", () => {
    expect(CANTINHO_COMPLETION_MIN).toBeLessThanOrEqual(CANTINHO_COMPLETION_CATEGORIES.length);
  });

  test("dá para chegar ao piso SEM assinar o Premium", () => {
    const semPremium = CANTINHO_COMPLETION_CATEGORIES.filter((t) =>
      pagos.some((i) => i.type === t && !i.premium),
    );
    expect(semPremium.length).toBeGreaterThanOrEqual(CANTINHO_COMPLETION_MIN);
  });

  test("o caminho mais barato cabe numa gestação", () => {
    /* ~70 🌱/dia é o teto de ganho diário (check-in 5 + quiz ~20 +
       bem-estar 25 + bônus 20). A Coroa tem de caber em bem menos que os
       294 dias da jornada, senão é enfeite inalcançável. */
    const maisBarato = CANTINHO_COMPLETION_CATEGORIES.map((t) =>
      Math.min(...pagos.filter((i) => i.type === t).map((i) => i.price)),
    )
      .sort((a, b) => a - b)
      .slice(0, CANTINHO_COMPLETION_MIN)
      .reduce((s, p) => s + p, 0);
    expect(maisBarato / 70).toBeLessThan(60);
  });

  test("um item pago de N categorias fecha a Coroa em N >= piso", () => {
    const umDeCada = CANTINHO_COMPLETION_CATEGORIES.map((t) => pagos.find((i) => i.type === t)!.id);
    expect(isCantinhoCollectionComplete(umDeCada)).toBe(true);
    expect(cantinhoCategoriasCompletas(umDeCada)).toBe(CANTINHO_COMPLETION_CATEGORIES.length);
  });

  test("item grátis não conta para a Coroa", () => {
    expect(isCantinhoCollectionComplete(["fundo-simples"])).toBe(false);
    expect(cantinhoCategoriasCompletas(["fundo-simples"])).toBe(0);
  });

  /* ── A invariante que motivou este arquivo ────────────────────────────
     Luzes e Águas nasceram depois da Coroa. Se o requisito fosse "todas as
     categorias", quem fechou a coleção antiga perderia a coroa da noite pro
     dia — o app tiraria de volta um troféu já conquistado. */
  test("categoria nova NÃO revoga a Coroa de quem já a tinha", () => {
    const CATEGORIAS_ANTIGAS: CantinhoType[] = [
      "trilha",
      "tema",
      "fundo",
      "ceu",
      "planta",
      "objeto",
      "bicho",
      "especial",
    ];
    const colecaoAntiga = CATEGORIAS_ANTIGAS.map((t) => pagos.find((i) => i.type === t)!.id);
    expect(isCantinhoCollectionComplete(colecaoAntiga)).toBe(true);
  });
});
