import { describe, expect, test } from "bun:test";
import { clarear, comAlfa, escurecer, misturar } from "./cor";

describe("as misturas de cor do material", () => {
  test("as pontas e o meio", () => {
    expect(misturar("#000000", "#ffffff", 0)).toBe("#000000");
    expect(misturar("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(misturar("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  test("o lábio escurece, a ficha clareia, sem sair da faixa", () => {
    expect(escurecer("#007a55", 0.3)).toBe("#00553c");
    expect(clarear("#007a55", 0.9)).toBe("#e6f2ee");
    expect(misturar("#007a55", "#ffffff", 7)).toBe("#ffffff");
  });

  test("cor inválida volta como veio, em vez de virar preto", () => {
    expect(misturar("transparent", "#ffffff", 0.5)).toBe("transparent");
    expect(comAlfa("rgba(0,0,0,0.5)", 0.2)).toBe("rgba(0,0,0,0.5)");
  });

  test("a transparência", () => {
    expect(comAlfa("#007a55", 0.18)).toBe("rgba(0,122,85,0.18)");
  });
});
