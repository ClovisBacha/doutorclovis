/** Arquivar a conversa e editar a mensagem — as duas réguas novas do direct. */
import { describe, expect, test } from "bun:test";
import { conversaArquivada, podeEditarMensagem } from "./conversa";

describe("arquivar a conversa", () => {
  test("arquivada e sem mensagem nova: fica guardada", () => {
    expect(
      conversaArquivada({ arquivadaEm: "2026-08-26T10:00:00Z", ultimaEm: "2026-08-25T10:00:00Z" }),
    ).toBe(true);
  });

  test("⚠️ mensagem NOVA traz a conversa de volta", () => {
    /**
     * É o que separa arquivar de SAIR. Com um booleano no lugar do instante,
     * arquivar seria um sumiço permanente — e sair já existe para isso.
     */
    expect(
      conversaArquivada({ arquivadaEm: "2026-08-26T10:00:00Z", ultimaEm: "2026-08-26T11:00:00Z" }),
    ).toBe(false);
  });

  test("não arquivada nunca some", () => {
    expect(conversaArquivada({ arquivadaEm: null, ultimaEm: "2026-08-26T11:00:00Z" })).toBe(false);
  });

  test("⚠️ sem `ultima_em` legível, a marca VALE", () => {
    /* O pior caso é ficar guardada; não uma conversa reaparecendo sozinha. */
    expect(conversaArquivada({ arquivadaEm: "2026-08-26T10:00:00Z", ultimaEm: null })).toBe(true);
    expect(conversaArquivada({ arquivadaEm: "2026-08-26T10:00:00Z", ultimaEm: "xx" })).toBe(true);
  });

  test("marca ilegível não esconde nada", () => {
    expect(conversaArquivada({ arquivadaEm: "xx", ultimaEm: "2026-08-26T11:00:00Z" })).toBe(false);
  });
});

describe("editar a mensagem", () => {
  const m = (o: Partial<Parameters<typeof podeEditarMensagem>[0]> = {}) =>
    podeEditarMensagem({ souEu: true, texto: "oi", ...o });

  test("a minha, de texto, dá para editar", () => {
    expect(m()).toBe(true);
  });

  test("⚠️ só quem escreveu edita", () => {
    expect(m({ souEu: false })).toBe(false);
  });

  test("⚠️ apagada não se edita — apagar é decisão tomada", () => {
    expect(m({ apagada: true })).toBe(false);
  });

  test("⚠️ foto, áudio e anexo NÃO se editam", () => {
    /**
     * Trocar a mídia depois de a outra ter visto é outra mensagem, não uma
     * correção.
     */
    expect(m({ imagemUrl: "x" })).toBe(false);
    expect(m({ audioUrl: "x" })).toBe(false);
    expect(m({ refId: "x" })).toBe(false);
  });

  test("mensagem sem texto não tem o que editar", () => {
    expect(m({ texto: "" })).toBe(false);
    expect(m({ texto: "   " })).toBe(false);
    expect(m({ texto: null })).toBe(false);
  });
});
