import { describe, expect, test } from "bun:test";
import { ITENS_A_VENDA_NO_QUARTO } from "~/lib/quartinho/quarto";
import { escadaDosTrofeus } from "./trofeus";

const loja = new Set(["bicho-borboleta"]);

describe("a escada dos troféus", () => {
  test("os degraus: as conquistas de troféu, e o item de troféu que o app vender", () => {
    const { degraus } = escadaDosTrofeus(0, loja);
    expect(degraus.map((d) => d.trofeus)).toEqual([1, 10, 30]);
    expect(degraus[1]!.rotulos).toEqual([
      "A conquista Dez Dias Redondos",
      "Borboleta no quartinho",
    ]);
  });

  test("o quartinho (a loja do app desde 24/11/2026) não vende item de troféu: só as conquistas", () => {
    const { degraus } = escadaDosTrofeus(0, ITENS_A_VENDA_NO_QUARTO);
    expect(degraus.flatMap((d) => d.rotulos).every((r) => r.startsWith("A conquista"))).toBe(true);
  });

  test("os itens de troféu que a loja do app não vende não viram promessa", () => {
    const { degraus } = escadaDosTrofeus(0, loja);
    const tudo = degraus.flatMap((d) => d.rotulos).join(" ");
    expect(tudo).not.toContain("deserto");
    expect(tudo).not.toContain("Coração");
  });

  test("quanto falta para o próximo, e nada depois do último", () => {
    expect(escadaDosTrofeus(4, loja).proximo).toEqual({ trofeus: 10, faltam: 6 });
    expect(escadaDosTrofeus(10, loja).degraus[1]!.feito).toBe(true);
    expect(escadaDosTrofeus(31, loja).proximo).toBeNull();
  });
});
