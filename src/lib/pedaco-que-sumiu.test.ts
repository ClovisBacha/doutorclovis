import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { ehPedacoQueSumiu } from "./pedaco-que-sumiu";

describe("os textos que cada navegador realmente usa", () => {
  test("⚠️ Safari/iOS — o aparelho onde o app fica instalado", () => {
    /* É o que mais sofre com isto: PWA na tela de início, aberto por semanas,
       enquanto o servidor muda embaixo. E é o aparelho em que eu não consigo
       olhar — daí a régua ser testada por comportamento, e não lida no fonte. */
    for (const m of [
      "Importing a module script failed.",
      "TypeError: Importing a module script failed.",
    ]) {
      expect(ehPedacoQueSumiu({ message: m })).toBe(true);
    }
  });

  test("Chrome, Edge e Android", () => {
    for (const m of [
      "Failed to fetch dynamically imported module: https://app/assets/minha-conta-A1b2C3.js",
      "error loading dynamically imported module",
    ]) {
      expect(ehPedacoQueSumiu({ message: m })).toBe(true);
    }
  });

  test("Firefox e empacotadores", () => {
    expect(ehPedacoQueSumiu({ message: "error loading a module" })).toBe(true);
    expect(ehPedacoQueSumiu({ name: "ChunkLoadError", message: "Loading chunk 42 failed." })).toBe(
      true,
    );
  });
});

describe("⚠️ e o que NÃO pode virar recarga", () => {
  test("erro de aplicação comum", () => {
    /* Recarregar num erro de verdade esconde o defeito e devolve a paciente à
       mesma tela quebrada — com a diferença de que agora ela não sabe o que
       aconteceu. */
    for (const e of [
      { name: "TypeError", message: "Cannot read properties of undefined (reading 'nome')" },
      { name: "Error", message: "sessão expirada" },
      { message: "Failed to fetch" },
      { message: "NetworkError when attempting to fetch resource." },
      null,
      {},
      { message: "" },
    ]) {
      expect(ehPedacoQueSumiu(e)).toBe(false);
    }
  });
});

describe("⚠️ a recarga é UMA por sessão", () => {
  test("a tela de erro guarda o carimbo antes de recarregar", () => {
    /* Sem isto, um erro que se repete vira laço de F5 — e a tela de erro, que é
       o último recurso, deixa de aparecer. O carimbo vai no `sessionStorage`
       (morre com a aba), e não no `localStorage`: numa segunda visita legítima
       ela precisa poder se curar de novo. */
    const raiz = readFileSync("src/routes/__root.tsx", "utf8");
    expect(raiz).toContain("sessionStorage.setItem(CHAVE_RECARGA");
    expect(raiz).not.toContain("localStorage.setItem(CHAVE_RECARGA");
    const i = raiz.indexOf("sessionStorage.setItem(CHAVE_RECARGA");
    const j = raiz.indexOf("window.location.reload()");
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
  });

  test("e ela usa a régua de `lib/`, não uma cópia", () => {
    const raiz = readFileSync("src/routes/__root.tsx", "utf8");
    expect(raiz).toContain('from "@/lib/pedaco-que-sumiu"');
    expect(raiz).not.toContain("function ehPedacoQueSumiu");
  });
});
