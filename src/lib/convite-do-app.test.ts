import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fraseDoRodape, ROTULO_DO_BOTAO, type OndeConvida } from "./convite-do-app";

const TODAS: OndeConvida[] = ["presentes", "album", "nome", "acompanhante", "perfil"];

describe("as frases do rodapé", () => {
  test("cada página tem a sua, e são diferentes", () => {
    const titulos = TODAS.map((o) => fraseDoRodape(o).titulo);
    expect(new Set(titulos).size).toBe(TODAS.length);
  });

  /* ⚠️ Cada uma fala do que a pessoa ACABOU de ver — quem estava escolhendo
     uma fralda não quer ler "acompanhamento semana a semana". */
  test("⚠️ cada frase fala da página em que está", () => {
    expect(fraseDoRodape("presentes").titulo.toLowerCase()).toContain("lista");
    expect(fraseDoRodape("album").titulo.toLowerCase()).toContain("álbum");
    expect(fraseDoRodape("nome").titulo.toLowerCase()).toContain("votação");
    expect(fraseDoRodape("acompanhante").titulo.toLowerCase()).toContain("acompanhando");
    expect(fraseDoRodape("perfil").titulo.toLowerCase()).toContain("perfil");
  });

  /* ⚠️ Quem lê pode estar grávida, e a promessa clínica é do médico dela — não
     de um rodapé. Mesma proibição das frases do mascote. */
  test("⚠️ nenhuma promete cuidado, segurança ou desfecho", () => {
    const tudo = TODAS.map((o) => `${fraseDoRodape(o).titulo} ${fraseDoRodape(o).sub}`)
      .join(" ")
      .toLocaleLowerCase("pt-BR");
    for (const proibido of [
      "seguro",
      "segurança",
      "cuida de você",
      "vai te ajudar",
      "está tudo bem",
      "tranquil",
      "garant",
      "médico responde",
      /* ⚠️ A da vitrine não pode prometer seguir: a página pública não tem
         botão de seguir, e seguir exige conta. */
      "siga",
      "seguir",
    ]) {
      expect(tudo).not.toContain(proibido);
    }
  });

  /* ⚠️ Metade de quem abre estes links não é gestante — é a tia, o colega de
     trabalho, o marido. "Crie sua conta" é o rodapé não ter entendido para
     quem está falando. */
  test("⚠️ o botão NÃO manda criar conta", () => {
    const r = ROTULO_DO_BOTAO.toLocaleLowerCase("pt-BR");
    expect(r).not.toContain("criar");
    expect(r).not.toContain("cadastr");
    expect(r).toContain("conhec");
  });

  test("toda frase tem título e subtítulo não vazios", () => {
    for (const o of TODAS) {
      const f = fraseDoRodape(o);
      expect(f.titulo.trim().length).toBeGreaterThan(8);
      expect(f.sub.trim().length).toBeGreaterThan(8);
    }
  });
});

/**
 * ⚠️ CADA PÁGINA PÚBLICA USA A VARIANTE DELA — e esta catraca nasceu de um
 * defeito real.
 *
 * `/votar-nome` foi escrita copiando a linha da página vizinha e ficou com
 * `onde="album"`: quem votava num nome lia, no pé, "Este álbum vive no
 * Obstétrica" — um rodapé descrevendo uma tela que aquela pessoa nunca viu. Não
 * quebra nada, não aparece em teste, e é exatamente o tipo de coisa que faz o
 * app parecer descuidado para quem ainda não é usuário.
 *
 * A frase é o único trabalho deste componente. Se ela fala de outra página, o
 * componente não fez nada.
 */
describe("a variante de cada rota pública", () => {
  const ESPERADO: Record<string, OndeConvida> = {
    "src/routes/album.$token.tsx": "album",
    "src/routes/votar-nome.$token.tsx": "nome",
    "src/routes/acompanhar.$token.tsx": "acompanhante",
    "src/routes/presente.$token.tsx": "presentes",
    "src/routes/p.$codigo.tsx": "perfil",
  };

  for (const [arquivo, onde] of Object.entries(ESPERADO)) {
    test(`${arquivo} usa onde="${onde}"`, () => {
      const fonte = readFileSync(arquivo, "utf8");
      const achados = [...fonte.matchAll(/<ConviteDoApp[^>]*onde="([a-z]+)"/g)].map((m) => m[1]);
      expect(achados.length).toBeGreaterThan(0);
      for (const a of achados) expect(a).toBe(onde);
    });
  }
});
