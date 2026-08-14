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
  ARVORE_MAX,
  ARVORE_MIN,
  CANTINHO_BY_ID,
  CANTINHO_CATEGORIES,
  CANTINHO_COMPLETION_CATEGORIES,
  CANTINHO_COMPLETION_MIN,
  CANTINHO_COMPLETION_REQUIRED,
  CANTINHO_COMPLETIONIST_ID,
  CANTINHO_FUNDO_BG,
  CANTINHO_ITEMS,
  CANTINHO_LOJA,
  cantinhoCategoriasCompletas,
  escalaDaArvore,
  faseDoDiaNoite,
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

/* ═══════════════════════════════════════════════════════════════════════════
   A AMPLIAÇÃO DE +50% — ago/2026
   ═══════════════════════════════════════════════════════════════════════════ */

describe("⚠️ dois itens nunca têm o mesmo emoji", () => {
  /* O defeito que abriu a varredura: 🎈 era `ceu-balao-ar` (100 🌱) E
     `especial-balao` (200 🌱). Dois tiles com o mesmo desenho, preços
     diferentes, e nenhuma forma de a paciente saber o que estava comprando.
     Eram sete pares assim.

     A régua não é "zero repetição em todo o catálogo": `trilha` e `tema`
     legitimamente repetem (🌱 é a pele Jardim e a Suculenta; 🌅 é o Céu
     Clássico e o Campo ao amanhecer) e são prateleiras que não se encostam —
     uma veste as bolinhas, a outra a home. A régua é sobre o que a paciente
     vê LADO A LADO como enfeite: os tipos que viram adesivo na trilha. */
  const ADESIVOS = ["ceu", "planta", "objeto", "bicho", "especial", "luz", "agua", "clima"];

  /* ⚠️ A régua vale para a LOJA, não para o catálogo: os quatro `aposentado`
     SÃO as colisões, e é por isso que eles saíram. Cobrar o catálogo inteiro
     obrigaria a apagar as linhas — exatamente o que o mecanismo de aposentar
     existe para evitar. */
  test("nenhum emoji repetido entre os itens que viram enfeite", () => {
    const vistos = new Map<string, string>();
    const colisoes: string[] = [];
    for (const i of CANTINHO_LOJA.filter((x) => ADESIVOS.includes(x.type))) {
      const antes = vistos.get(i.emoji);
      if (antes) colisoes.push(`${i.emoji}: ${antes} × ${i.id}`);
      else vistos.set(i.emoji, i.id);
    }
    expect(colisoes).toEqual([]);
  });

  test("nem contra os cenários, que também mostram o emoji na loja", () => {
    /* 🌠 era a `luz-estrela-cadente` (160) e o `fundo-estrelas` (250). Na
       grade da loja os dois são o mesmo quadradinho. */
    const enfeites = new Map(
      CANTINHO_LOJA.filter((x) => ADESIVOS.includes(x.type)).map((i) => [i.emoji, i.id]),
    );
    const colisoes = CANTINHO_LOJA.filter((i) => i.type === "fundo" && enfeites.has(i.emoji)).map(
      (i) => `${i.emoji}: ${i.id} × ${enfeites.get(i.emoji)}`,
    );
    expect(colisoes).toEqual([]);
  });
});

describe("⚠️ aposentar tira da LOJA, e de mais nada", () => {
  test("todo item aposentado continua no catálogo e resolvível por id", () => {
    /* É o ponto inteiro: `CANTINHO_BY_ID[id]` devolver `undefined` é como um
       `DecorSprite` some da trilha sem erro nenhum — a paciente perderia o
       enfeite que pagou, em silêncio. */
    for (const i of CANTINHO_ITEMS.filter((x) => x.aposentado)) {
      expect(CANTINHO_BY_ID[i.id]?.id).toBe(i.id);
    }
  });

  test("a loja não mostra nenhum aposentado", () => {
    expect(CANTINHO_LOJA.some((i) => i.aposentado)).toBe(false);
  });

  test("e a loja é o catálogo menos exatamente os aposentados", () => {
    const n = CANTINHO_ITEMS.filter((i) => i.aposentado).length;
    expect(CANTINHO_LOJA.length).toBe(CANTINHO_ITEMS.length - n);
    /* Se um dia este número for zero, alguém apagou as linhas em vez de
       marcá-las — que é a coisa que este mecanismo existe para impedir. */
    expect(n).toBeGreaterThan(0);
  });

  test("quem comprou um aposentado continua com a categoria dele na Coroa", () => {
    const ap = CANTINHO_ITEMS.find((i) => i.aposentado)!;
    expect(cantinhoCategoriasCompletas([ap.id])).toBe(1);
  });

  test("⚠️ nenhum representante da Coroa está aposentado", () => {
    /* O contador "X de Y" apontaria para um tile que a loja não mostra. */
    for (const id of CANTINHO_COMPLETION_REQUIRED) {
      expect(CANTINHO_BY_ID[id].aposentado === true).toBe(false);
    }
  });
});

describe("a Árvore que cresce cresce mesmo", () => {
  /* Ela vendia "Árvore que cresce" por 350 🌱 e era um 🌳 parado. */
  test("mais semana, maior — e sempre", () => {
    for (let w = 5; w <= 40; w++) {
      expect(escalaDaArvore(w) > escalaDaArvore(w - 1)).toBe(true);
    }
  });

  test("as pontas são as declaradas", () => {
    expect(escalaDaArvore(4)).toBeCloseTo(ARVORE_MIN, 5);
    expect(escalaDaArvore(40)).toBeCloseTo(ARVORE_MAX, 5);
  });

  test("fora da faixa não estoura nem encolhe mais", () => {
    expect(escalaDaArvore(1)).toBeCloseTo(ARVORE_MIN, 5);
    expect(escalaDaArvore(60)).toBeCloseTo(ARVORE_MAX, 5);
  });

  test("⚠️ sem semana a árvore fica do tamanho que ela pôs", () => {
    /* Devolver `ARVORE_MIN` faria a árvore virar muda toda vez que a semana
       não chegasse a tempo — e leria como item quebrado, não como broto. */
    expect(escalaDaArvore(null)).toBe(1);
    expect(escalaDaArvore(undefined)).toBe(1);
    expect(escalaDaArvore(NaN)).toBe(1);
  });

  test("é MULTIPLICADOR: nunca zera nem inverte o tamanho escolhido", () => {
    for (let w = 0; w <= 45; w++) expect(escalaDaArvore(w)).toBeGreaterThan(0.5);
  });
});

describe("o Ciclo dia/noite cicla mesmo", () => {
  test("as quatro faces aparecem ao longo das 24 horas", () => {
    const faces = new Set(Array.from({ length: 24 }, (_, h) => faseDoDiaNoite(h)));
    expect(faces.size).toBe(4);
  });

  test("de dia é dia, de noite é noite", () => {
    expect(faseDoDiaNoite(13)).toBe("🌞");
    expect(faseDoDiaNoite(2)).toBe("🌃");
    expect(faseDoDiaNoite(23)).toBe("🌃");
    expect(faseDoDiaNoite(7)).toBe("🌄");
    expect(faseDoDiaNoite(19)).toBe("🌆");
  });

  test("⚠️ NENHUMA face é o emoji de um item à venda", () => {
    /* Este teste já mudou o código uma vez: as faces eram 🌙 e ☀️, que são a
       `ceu-lua` (140 🌱) e o `ceu-sol` (120 🌱). A paciente veria na trilha o
       desenho exato de dois itens que ela não comprou. */
    const naLoja = new Set(CANTINHO_LOJA.map((i) => i.emoji));
    for (const f of new Set(Array.from({ length: 24 }, (_, h) => faseDoDiaNoite(h)))) {
      expect(naLoja.has(f)).toBe(false);
    }
  });

  test("hora inválida não estoura", () => {
    expect(faseDoDiaNoite(-1)).toBe("🌃");
    /* 99 % 24 = 3 — madrugada. A conta é a mesma de qualquer hora válida. */
    expect(faseDoDiaNoite(99)).toBe("🌃");
    expect(typeof faseDoDiaNoite(NaN)).toBe("string");
  });
});
