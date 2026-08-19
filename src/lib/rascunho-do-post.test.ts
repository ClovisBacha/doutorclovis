import { describe, expect, test } from "bun:test";
import {
  chaveDoRascunho,
  ehRascunhoUtil,
  lerRascunho,
  paraGuardar,
  VALIDADE_DIAS,
  type RascunhoDoPost,
} from "./rascunho-do-post";

const AGORA = new Date("2026-08-19T12:00:00Z");
const base = (mudar: Partial<RascunhoDoPost> = {}): RascunhoDoPost => ({
  texto: "",
  visibilidade: "amigas",
  enquete: null,
  comAula: false,
  marcadas: [],
  em: AGORA.toISOString(),
  ...mudar,
});

describe("a chave", () => {
  /* ⚠️ O aparelho é compartilhado com mais gente do que se imagina, e o
     rascunho de uma publicação sobre a gestação é texto íntimo. */
  test("⚠️ carrega o id da conta", () => {
    expect(chaveDoRascunho("aaa")).not.toBe(chaveDoRascunho("bbb"));
    expect(chaveDoRascunho("aaa")).toContain("aaa");
  });
});

describe("ehRascunhoUtil", () => {
  test("texto conta", () => {
    expect(ehRascunhoUtil(base({ texto: "oi" }))).toBe(true);
  });

  test("enquete com opção escrita conta", () => {
    expect(ehRascunhoUtil(base({ enquete: ["Menino", ""] }))).toBe(true);
  });

  test("marcadas contam, e a aula também", () => {
    expect(ehRascunhoUtil(base({ marcadas: ["x"] }))).toBe(true);
    expect(ehRascunhoUtil(base({ comAula: true }))).toBe(true);
  });

  /* ⚠️ A camada nasce preenchida (`amigas` é o padrão do compositor), então um
     rascunho só com ela é o estado de quem abriu e desistiu. Oferecer "você
     tinha um rascunho" sobre nada é como a tela perde a credibilidade. */
  test("⚠️ só a visibilidade NÃO conta como rascunho", () => {
    expect(ehRascunhoUtil(base({ visibilidade: "publico" }))).toBe(false);
    expect(ehRascunhoUtil(base())).toBe(false);
    expect(ehRascunhoUtil(base({ texto: "   " }))).toBe(false);
    expect(ehRascunhoUtil(base({ enquete: ["", ""] }))).toBe(false);
  });

  test("nulo não é rascunho", () => {
    expect(ehRascunhoUtil(null)).toBe(false);
    expect(ehRascunhoUtil(undefined)).toBe(false);
  });
});

describe("lerRascunho", () => {
  test("volta inteiro dentro da validade", () => {
    const r = base({ texto: "meu texto", marcadas: ["a", "b"] });
    expect(lerRascunho(JSON.stringify(r), AGORA)).toEqual(r);
  });

  test("⚠️ vencido some", () => {
    const velho = base({
      texto: "de outra era",
      em: new Date(AGORA.getTime() - (VALIDADE_DIAS + 1) * 86_400_000).toISOString(),
    });
    expect(lerRascunho(JSON.stringify(velho), AGORA)).toBeNull();
  });

  test("dentro da validade por pouco ainda volta", () => {
    const quase = base({
      texto: "ainda vale",
      em: new Date(AGORA.getTime() - (VALIDADE_DIAS - 0.5) * 86_400_000).toISOString(),
    });
    expect(lerRascunho(JSON.stringify(quase), AGORA)?.texto).toBe("ainda vale");
  });

  /* ⚠️ O que está no armazenamento foi escrito por outra versão do app, ou por
     nada. Um `JSON.parse` solto aqui derrubaria a abertura do compositor. */
  test("⚠️ lixo e formato antigo não estouram — viram 'sem rascunho'", () => {
    expect(lerRascunho(null, AGORA)).toBeNull();
    expect(lerRascunho("", AGORA)).toBeNull();
    expect(lerRascunho("{isso não é json", AGORA)).toBeNull();
    expect(lerRascunho("[]", AGORA)).toBeNull();
    expect(lerRascunho('{"texto":"sem data"}', AGORA)).toBeNull();
    expect(lerRascunho('{"texto":"oi","em":"não é data"}', AGORA)).toBeNull();
  });

  /* ⚠️ O erro possível é publicar para MENOS gente do que ela queria, nunca
     para mais — a mesma régua do padrão do compositor. */
  test("⚠️ visibilidade desconhecida cai no MAIS FECHADO", () => {
    const bruto = JSON.stringify({ ...base({ texto: "oi" }), visibilidade: "mundo-inteiro" });
    expect(lerRascunho(bruto, AGORA)?.visibilidade).toBe("amigas");
  });

  test("rascunho vazio guardado não é oferecido de volta", () => {
    expect(lerRascunho(JSON.stringify(base()), AGORA)).toBeNull();
  });
});

describe("paraGuardar", () => {
  test("carimba a hora", () => {
    const r = paraGuardar({ ...base({ texto: "oi" }) }, AGORA);
    expect(r.guardar).toBe(true);
    if (r.guardar) expect(JSON.parse(r.texto).em).toBe(AGORA.toISOString());
  });

  /* ⚠️ Se ela apagou tudo, desistiu daquele texto — reoferecê-lo depois seria
     devolver o que ela acabou de tirar da tela. */
  test("⚠️ rascunho vazio manda APAGAR, não gravar vazio", () => {
    expect(paraGuardar({ ...base() }, AGORA).guardar).toBe(false);
  });
});

describe("as fotos", () => {
  /* ⚠️ Cada foto é um data URL de ~300 KB e cabem dez: guardar isso encostaria
     nos ~5 MB de cota, e o que quebra quando a cota estoura é a PRÓXIMA
     gravação de qualquer coisa — incluindo o `journey_state`, que carrega a
     jornada inteira dela. */
  test("⚠️ NÃO existem no rascunho", () => {
    const campos = Object.keys(base());
    expect(campos).not.toContain("fotos");
    expect(campos).not.toContain("imagens");
    expect(JSON.stringify(base({ texto: "oi" }))).not.toContain("data:image");
  });
});
