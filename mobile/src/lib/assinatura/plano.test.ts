import { describe, expect, test } from "bun:test";
import {
  decidirPortao,
  destinoDepois,
  ehDoPlano,
  itensDoPlano,
  origemValida,
  paraOBebe,
  planoDoProduto,
  PRODUTOS,
  RECURSOS,
  subtituloDaVenda,
  temPlanoCompleto,
  TEXTO_DO_CONVITE,
  tituloDaVenda,
  tituloDoConvite,
  type Recurso,
} from "~/lib/assinatura/plano";

const TODOS = Object.keys(RECURSOS) as Recurso[];

describe("os produtos da Apple", () => {
  test("os três IDs do App Store Connect, no Bundle ID do app", () => {
    expect(PRODUTOS).toEqual({
      anual: "br.com.obstetrica.app.plano.anual",
      mensal: "br.com.obstetrica.app.plano.mensal",
      vitalicio: "br.com.obstetrica.app.plano.vitalicio",
    });
    for (const id of Object.values(PRODUTOS))
      expect(id.startsWith("br.com.obstetrica.app.")).toBe(true);
  });

  test("o produto diz o plano, e um produto de fora não é nosso", () => {
    expect(planoDoProduto(PRODUTOS.vitalicio)).toBe("vitalicio");
    expect(planoDoProduto("br.com.outro.app.plano")).toBeNull();
  });
});

describe("o que é grátis e o que é do plano completo", () => {
  test("grátis: a semana, a Bolha, a aula de hoje, a trilha, as amigas, o perfil e a gratidão", () => {
    for (const r of [
      "semana",
      "bolha",
      "aulaDeHoje",
      "trilha",
      "amigas",
      "perfil",
      "gratidao",
    ] as const) {
      expect({ r, doPlano: ehDoPlano(r) }).toEqual({ r, doPlano: false });
    }
  });

  test("do plano: respirar, os sons, mexer, ler para o bebê, para vocês dois e rever aulas", () => {
    for (const r of ["meditar", "sons", "mexer", "ler", "casal", "reverAulas"] as const) {
      expect({ r, doPlano: ehDoPlano(r) }).toEqual({ r, doPlano: true });
    }
  });

  test("a lista não tem socorro, documentos nem a conta: esses nunca têm portão", () => {
    const nomes = TODOS.join(" ").toLowerCase();
    expect(nomes).not.toMatch(/sos|socorro|192|termos|privacidade|copia|excluir|conta/);
  });
});

describe("o portão", () => {
  const base = { chaveLigada: true, emCuidado: false, conhecido: true, temPlano: false };

  test("com a chave DESLIGADA, tudo abre — inclusive sem saber do plano", () => {
    for (const recurso of TODOS) {
      for (const conhecido of [true, false]) {
        expect(decidirPortao({ ...base, chaveLigada: false, recurso, conhecido })).toBe("liberado");
      }
    }
  });

  test("no Modo Cuidado (luto) nunca há venda", () => {
    for (const recurso of TODOS) {
      expect(decidirPortao({ ...base, emCuidado: true, recurso })).toBe("liberado");
    }
  });

  test("o grátis abre; o do plano abre para quem tem e convida quem não tem", () => {
    expect(decidirPortao({ ...base, recurso: "trilha" })).toBe("liberado");
    expect(decidirPortao({ ...base, recurso: "meditar" })).toBe("convite");
    expect(decidirPortao({ ...base, recurso: "meditar", temPlano: true })).toBe("liberado");
  });

  test("sem saber ainda, espera (não pisca o convite para quem assina)", () => {
    expect(decidirPortao({ ...base, recurso: "mexer", conhecido: false })).toBe("esperando");
  });
});

describe("o direito", () => {
  const agora = Date.parse("2026-11-20T12:00:00-03:00");

  test("uma assinatura nossa valendo, ou o vitalício", () => {
    expect(temPlanoCompleto([{ produto: PRODUTOS.anual, expiraEm: agora + 1000 }], agora)).toBe(
      true,
    );
    expect(temPlanoCompleto([{ produto: PRODUTOS.mensal }], agora)).toBe(true);
    expect(temPlanoCompleto([{ produto: PRODUTOS.vitalicio }], agora)).toBe(true);
  });

  test("vencida, revogada (reembolso) ou de outro produto não vale", () => {
    expect(temPlanoCompleto([{ produto: PRODUTOS.anual, expiraEm: agora - 1 }], agora)).toBe(false);
    expect(temPlanoCompleto([{ produto: PRODUTOS.vitalicio, revogadaEm: agora - 5 }], agora)).toBe(
      false,
    );
    expect(temPlanoCompleto([{ produto: "br.com.obstetrica.app.outra" }], agora)).toBe(false);
    expect(temPlanoCompleto([], agora)).toBe(false);
  });
});

describe("a navegação da tela de venda", () => {
  test("o depois é uma rota do app, nunca um endereço de fora", () => {
    expect(destinoDepois("/ritual")).toBe("/ritual");
    expect(destinoDepois(" /jornada ")).toBe("/jornada");
    for (const ruim of ["//site.com", "https://site.com", "ritual", "", null, 3, "/a\\b"]) {
      expect(destinoDepois(ruim)).toBeNull();
    }
  });

  test("a origem é uma das três do contrato", () => {
    expect(origemValida("plano")).toBe("plano");
    expect(origemValida("portao")).toBe("portao");
    expect(origemValida("perfil")).toBe("perfil");
    expect(origemValida("outra")).toBeNull();
  });
});

/** As palavras que dariam gênero ao bebê, ou que prometem efeito de saúde. */
const GENERO = /\b(ele|ela|dele|dela|nele|nela|do bebê dele|da [A-Z]|do [A-Z])\b/;
const PROMESSA =
  /reduz|diminu|melhora|ansiedade|estresse|insônia|sono melhor|faz bem|saudável|cura|tratamento|você deve|garant/i;

describe("o que a tela diz", () => {
  test("o bebê pelo nome, sem artigo (o artigo diria o gênero), ou 'o bebê'", () => {
    expect(paraOBebe("Helena")).toBe("Helena");
    expect(paraOBebe("  ")).toBe("o bebê");
    expect(paraOBebe(null)).toBe("o bebê");
    expect(tituloDaVenda("Theo")).toBe("Libere o plano completo para você e Theo");
    expect(tituloDaVenda(null)).toBe("Libere o plano completo para você e o bebê");
  });

  test("o subtítulo chama ela pelo nome quando sabe", () => {
    expect(subtituloDaVenda("Marina")).toMatch(/^Marina, mais momentos/);
    expect(subtituloDaVenda(null)).toMatch(/^Mais momentos/);
  });

  test("a lista só tem o que existe no app hoje", () => {
    const itens = itensDoPlano("Helena");
    expect(itens.length).toBe(5);
    expect(itens.join(" ")).not.toMatch(/Rever as aulas/);
    expect(itens).toContain("Leituras em voz alta para Helena");
  });

  test("nenhum texto dá gênero ao bebê nem promete efeito de saúde", () => {
    const textos = [
      tituloDaVenda("Helena"),
      tituloDaVenda(null),
      subtituloDaVenda("Marina"),
      subtituloDaVenda(null),
      ...itensDoPlano("Helena"),
      ...itensDoPlano(null),
      TEXTO_DO_CONVITE,
      ...TODOS.flatMap((r) => [tituloDoConvite(r, "Helena"), tituloDoConvite(r, null)]),
    ];
    for (const t of textos) {
      expect({ t, genero: GENERO.test(t) }).toEqual({ t, genero: false });
      expect({ t, promessa: PROMESSA.test(t) }).toEqual({ t, promessa: false });
      /* Sem travessão nem emoji, como as falas da Bolha. */
      expect({ t, tracao: /—|–/.test(t) }).toEqual({ t, tracao: false });
    }
  });
});
