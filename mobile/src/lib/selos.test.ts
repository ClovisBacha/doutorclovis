import { describe, expect, test } from "bun:test";
import {
  lerSelos,
  mudarSelos,
  rotuloDaAba,
  seloDasAmigas,
  textoDoSelo,
  zerarSelos,
} from "~/lib/selos";

describe("os selos da barra", () => {
  test("as Amigas contam os pedidos e o convite da dupla — mas não no pós-parto", () => {
    expect(seloDasAmigas(0, null, false)).toBe(0);
    expect(seloDasAmigas(2, null, false)).toBe(2);
    expect(seloDasAmigas(1, { estado: "convite-recebido" }, false)).toBe(2);
    expect(seloDasAmigas(1, { estado: "convite-recebido" }, true)).toBe(1);
    expect(seloDasAmigas(0, { estado: "ativa" }, false)).toBe(0);
    expect(seloDasAmigas(0, { estado: "convite-enviado" }, false)).toBe(0);
  });

  test("o selo nunca escreve zero nem mais de dois caracteres", () => {
    expect(textoDoSelo(0)).toBeNull();
    expect(textoDoSelo(-3)).toBeNull();
    expect(textoDoSelo(Number.NaN)).toBeNull();
    expect(textoDoSelo(1)).toBe("1");
    expect(textoDoSelo(9)).toBe("9");
    expect(textoDoSelo(10)).toBe("9+");
    expect(textoDoSelo(240)).toBe("9+");
  });

  test("o leitor de tela diz quantas novidades a aba tem", () => {
    expect(rotuloDaAba("Comunidade", 0)).toBe("Comunidade");
    expect(rotuloDaAba("Comunidade", 1)).toBe("Comunidade, 1 novidade");
    expect(rotuloDaAba("Amigas", 3)).toBe("Amigas, 3 novidades");
  });

  test("o estado só troca de identidade quando um número muda (senão a tela entra em laço)", () => {
    zerarSelos();
    const antes = lerSelos();
    expect(lerSelos()).toBe(antes);
    mudarSelos({ comunidade: 0 });
    expect(lerSelos()).toBe(antes);
    mudarSelos({ comunidade: 2 });
    const depois = lerSelos();
    expect(depois).not.toBe(antes);
    expect(depois).toEqual({ comunidade: 2, amigas: 0 });
    mudarSelos({ comunidade: 2, amigas: 0 });
    expect(lerSelos()).toBe(depois);
    zerarSelos();
    expect(lerSelos()).toEqual({ comunidade: 0, amigas: 0 });
  });
});
