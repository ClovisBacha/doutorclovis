import { describe, expect, test } from "bun:test";
import { fraseDoRodape, ROTULO_DO_BOTAO, type OndeConvida } from "./convite-do-app";

const TODAS: OndeConvida[] = ["presentes", "album", "acompanhante"];

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
    expect(fraseDoRodape("acompanhante").titulo.toLowerCase()).toContain("acompanhando");
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
