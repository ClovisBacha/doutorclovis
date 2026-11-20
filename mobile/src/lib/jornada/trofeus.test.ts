import { describe, expect, test } from "bun:test";
import { escadaDosTrofeus } from "./trofeus";

const loja = new Set(["bicho-borboleta"]);

describe("a escada dos troféus", () => {
  test("os degraus: as conquistas de troféu e a Borboleta, que o app vende", () => {
    const { degraus } = escadaDosTrofeus(0, loja);
    expect(degraus.map((d) => d.trofeus)).toEqual([1, 10, 30]);
    expect(degraus[1]!.rotulos).toEqual(["A conquista Dez Dias Redondos", "Borboleta no Cantinho"]);
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
