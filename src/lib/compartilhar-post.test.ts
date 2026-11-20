/**
 * COMPARTILHAR UMA PUBLICAÇÃO, MEDIDO.
 *
 * A asserção que carrega o arquivo é a primeira: só a própria publicação sai.
 */

import { describe, expect, test } from "bun:test";
import {
  comoCompartilhar,
  podeCompartilharPost,
  textoDoCompartilhamento,
} from "./compartilhar-post";

const meu = { souAAutora: true, temImagem: true, temVideo: false, temTexto: true };

describe("⚠️ só a PRÓPRIA publicação sai do app", () => {
  test("a minha, sim", () => {
    expect(podeCompartilharPost(meu)).toBe(null);
  });

  test("⚠️ a de outra pessoa, NUNCA — nem sendo pública", () => {
    /* Aqui não há página pública de publicação, então o que sairia é a FOTO —
       e uma foto que sai do app não volta. Compartilhar a ultrassom de outra
       paciente no WhatsApp da família é tirar dela a decisão de onde a imagem
       circula. */
    expect(podeCompartilharPost({ ...meu, souAAutora: false })).toBe("nao_e_sua");
  });

  test("publicação sem nada dentro não tem o que compartilhar", () => {
    expect(
      podeCompartilharPost({
        souAAutora: true,
        temImagem: false,
        temVideo: false,
        temTexto: false,
      }),
    ).toBe("sem_conteudo");
  });

  test("só vídeo, ou só texto, já basta", () => {
    expect(podeCompartilharPost({ ...meu, temImagem: false, temVideo: true })).toBe(null);
    expect(podeCompartilharPost({ ...meu, temImagem: false, temVideo: false })).toBe(null);
  });
});

describe("o texto", () => {
  const LINK = "https://www.obstetrica.com.br/?amiga=ABC123";

  test("⚠️ a legenda DELA vem primeiro, o convite depois", () => {
    /* Invertido, lê como propaganda do app com uma foto anexada — e o que ela
       quer mostrar é o bebê. */
    const t = textoDoCompartilhamento("olha ele mexendo 💛", LINK);
    expect(t.indexOf("olha ele mexendo")).toBeLessThan(t.indexOf("Acompanho"));
  });

  test("⚠️ o link de indicação vai junto", () => {
    /* É o único momento em que ela mostra o app a alguém de fora por vontade
       própria. Sem o código, a amiga chega pela porta da frente e a indicação
       não é de ninguém — o defeito que o botão "Convidar" já teve. */
    expect(textoDoCompartilhamento("oi", LINK)).toContain("amiga=ABC123");
  });

  test("⚠️ SEM LINK não há frase de convite", () => {
    /* "Conheça o app" sem endereço não leva ninguém a lugar nenhum, e ocupa o
       espaço da legenda dela. */
    expect(textoDoCompartilhamento("olha ele mexendo", null)).toBe("olha ele mexendo");
    expect(textoDoCompartilhamento(null, null)).toBe("");
  });

  test("sem legenda, vai só o convite", () => {
    expect(textoDoCompartilhamento(null, LINK)).toBe(`Acompanho minha gestação aqui: ${LINK}`);
  });
});

describe("⚠️ o que o navegador sabe fazer", () => {
  test("com `canShare` de arquivo, manda o arquivo", () => {
    expect(comoCompartilhar({ share: () => {}, canShare: () => true })).toBe("arquivo");
  });

  test("⚠️ `share` sem `canShare` de arquivo cai no TEXTO", () => {
    /* `share({files})` num navegador que só aceita texto falha DEPOIS de a
       paciente tocar, com a folha do sistema já aberta. */
    expect(comoCompartilhar({ share: () => {}, canShare: () => false })).toBe("texto");
    expect(comoCompartilhar({ share: () => {} })).toBe("texto");
  });

  test("⚠️ `canShare` que LANÇA não derruba a tela", () => {
    /* Alguns navegadores lançam em vez de responder `false`. */
    const nav = {
      share: () => {},
      canShare: () => {
        throw new Error("nope");
      },
    };
    expect(comoCompartilhar(nav)).toBe("texto");
  });

  test("sem `share` nenhum, o botão não deve existir", () => {
    expect(comoCompartilhar({})).toBe("nenhum");
  });
});
