import { describe, expect, test } from "bun:test";
import { podeRetomar } from "./pausa-da-sessao";

const ok = { etapa: "sessao", pausada: true, escondida: false, viva: true };

describe("posso retomar?", () => {
  test("pausada, na sessão, visível e montada: sim", () => {
    expect(podeRetomar(ok)).toBe(true);
  });

  test("⚠️ escondida: NÃO", () => {
    /* O ▶︎ da tela bloqueada e o botão do fone chegam com a página escondida.
       Despausar ali devolve a sessão a um mundo em que o iOS congela os
       relógios e suspende o áudio: ela voltaria para a bolha parada no meio de
       um "Inspire", muda — o defeito que a pausa existe para consertar, agora
       sem o véu que o explicava. */
    expect(podeRetomar({ ...ok, escondida: true })).toBe(false);
  });

  test("⚠️ desmontada: NÃO", () => {
    /* Retomar depois de a folha fechar criava um som NOVO tocando num
       componente que não existe mais — sem nenhum botão que o desligasse. */
    expect(podeRetomar({ ...ok, viva: false })).toBe(false);
  });

  test("fora da sessão: não", () => {
    for (const etapa of ["escolha", "reflexo", "fim"]) {
      expect(podeRetomar({ ...ok, etapa })).toBe(false);
    }
  });

  test("não pausada: não (dois toques em Continuar não retomam duas vezes)", () => {
    expect(podeRetomar({ ...ok, pausada: false })).toBe(false);
  });
});
