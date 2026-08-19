import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  assinarAtalhos,
  atalhosDe,
  oToqueAbreOsAtalhos,
  publicarAtalhos,
  SEM_ATALHOS,
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

  /* ⚠️ ESTE BLOCO É O QUE IMPEDE O APP DE PARAR DE ABRIR.
     `useSyncExternalStore` exige que o instantâneo seja a MESMA referência
     enquanto nada muda. Com `?? []`, cada leitura devolvia um array novo: o
     React comparava por `Object.is`, concluía "mudou" e repintava — em laço.
     Medido em `/preview-home`: `Maximum update depth exceeded`, o erro subindo
     até a raiz da rota e a tela "Algo deu errado" no lugar do app. A barra vive
     fora de qualquer `TabErrorBoundary`, então não havia nada entre o defeito e
     a paciente. */
  test("a lista vazia é SEMPRE a mesma referência", () => {
    expect(atalhosDe("nunca-publicada")).toBe(atalhosDe("nunca-publicada"));
    expect(atalhosDe(null)).toBe(atalhosDe(undefined));
    expect(atalhosDe("nunca-publicada")).toBe(SEM_ATALHOS);
  });

  test("depois de limpar, a leitura volta à MESMA vazia", () => {
    const limpar = publicarAtalhos("estavel", [um("a")]);
    const cheia = atalhosDe("estavel");
    expect(atalhosDe("estavel")).toBe(cheia);
    limpar();
    expect(atalhosDe("estavel")).toBe(SEM_ATALHOS);
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

/**
 * A BARRA TAMBÉM PRECISA OBEDECER — e o `tsc` não cobra isto.
 *
 * `getServerSnapshot` é lido na hidratação, e um `[]` literal ali reproduz o
 * laço inteiro no primeiro instante da abertura. O TypeScript aceita
 * `() => []` no lugar de `() => SEM_ATALHOS` sem reclamar (`never[]` é
 * atribuível a `readonly AtalhoDaAba[]`), então quem cobra é este teste.
 */
describe("a barra lê o instantâneo estável", () => {
  /** Sem comentários: um teste que aceita a própria prosa fica verde
      exatamente quando o defeito está documentado. */
  const semComentarios = (t: string) =>
    t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

  const BARRA = semComentarios(readFileSync("src/components/app-mobile-shell.tsx", "utf8"));

  test("os três argumentos de useSyncExternalStore", () => {
    const abre = BARRA.indexOf("useSyncExternalStore(");
    expect(abre).toBeGreaterThan(0);
    const fecha = BARRA.indexOf(");", abre);
    expect(fecha).toBeGreaterThan(abre);
    const chamada = BARRA.slice(abre, fecha);

    /* Assinatura estável (função de módulo), leitura por seção, e a vazia
       compartilhada — nunca um literal. */
    expect(chamada).toContain("assinarAtalhos");
    expect(chamada).toContain("atalhosDe(");
    expect(chamada).toContain("SEM_ATALHOS");
    expect(chamada).not.toContain("[]");
  });
});
