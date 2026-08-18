import { describe, expect, test } from "bun:test";
import {
  assinarAtalhos,
  atalhosDe,
  oToqueAbreOsAtalhos,
  publicarAtalhos,
  type AtalhoDaAba,
} from "./atalhos-da-aba";

const um = (id: string): AtalhoDaAba => ({
  id,
  rotulo: id,
  icone: "mais",
  aoTocar: () => {},
});

describe("quando o toque na barra abre os atalhos", () => {
  test("estando na seção, com atalhos: abre", () => {
    expect(oToqueAbreOsAtalhos("comunidade", "comunidade", 3)).toBe(true);
  });

  test("⚠️ vindo de OUTRA aba, o primeiro toque NAVEGA", () => {
    // Um menu no lugar da navegação faria o caminho mais usado do app custar
    // dois toques.
    expect(oToqueAbreOsAtalhos("comunidade", "saude", 3)).toBe(false);
    expect(oToqueAbreOsAtalhos("comunidade", null, 3)).toBe(false);
  });

  test("⚠️ sem atalho publicado, nunca abre", () => {
    // Uma nuvem de bolinhas vazia lê como defeito.
    expect(oToqueAbreOsAtalhos("saude", "saude", 0)).toBe(false);
  });
});

describe("o registro", () => {
  test("publica, lê e limpa", () => {
    const limpar = publicarAtalhos("teste", [um("a"), um("b")]);
    expect(atalhosDe("teste").map((a) => a.id)).toEqual(["a", "b"]);
    limpar();
    expect(atalhosDe("teste")).toEqual([]);
  });

  test("⚠️ a limpeza de uma tela ANTIGA não apaga a lista da nova", () => {
    // Ao trocar de tela, o React monta a nova ANTES de limpar a velha. Se a
    // limpeza apagasse a chave sem conferir de quem ela é, a aba nova ficaria
    // sem atalho nenhum — e o defeito só apareceria ao voltar para ela.
    const limparVelha = publicarAtalhos("teste", [um("velho")]);
    publicarAtalhos("teste", [um("novo")]);
    limparVelha();
    expect(atalhosDe("teste").map((a) => a.id)).toEqual(["novo"]);
  });

  test("seção desconhecida devolve lista vazia", () => {
    expect(atalhosDe("nada")).toEqual([]);
    expect(atalhosDe(null)).toEqual([]);
  });

  test("quem assina é avisado ao publicar e ao limpar", () => {
    let avisos = 0;
    const cancelar = assinarAtalhos(() => avisos++);
    const limpar = publicarAtalhos("outra", [um("x")]);
    expect(avisos).toBe(1);
    limpar();
    expect(avisos).toBe(2);
    cancelar();
    publicarAtalhos("outra", [um("y")]);
    expect(avisos).toBe(2);
  });
});
