import { describe, expect, test } from "bun:test";
import { base64ParaBytes, fronteiraAleatoria, montarMultipart, tamanhoReduzido } from "./foto";

describe("a redução da foto (lado maior em 1024)", () => {
  test("paisagem grande: a largura vai a 1024, a altura acompanha", () => {
    expect(tamanhoReduzido(4032, 3024)).toEqual({ width: 1024, height: null });
  });
  test("retrato grande: a altura vai a 1024", () => {
    expect(tamanhoReduzido(3024, 4032)).toEqual({ width: null, height: 1024 });
  });
  test("já pequena, ou medida desconhecida: não redimensiona", () => {
    expect(tamanhoReduzido(800, 600)).toBeNull();
    expect(tamanhoReduzido(1024, 1024)).toBeNull();
    expect(tamanhoReduzido(0, 0)).toBeNull();
  });
});

describe("base64 → bytes", () => {
  test("bate com o Buffer do node, com e sem padding e com prefixo data:", () => {
    const amostras = [new Uint8Array([]), new Uint8Array([0xff]), new Uint8Array([1, 2]), new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70])];
    for (const b of amostras) {
      const b64 = Buffer.from(b).toString("base64");
      expect(Array.from(base64ParaBytes(b64))).toEqual(Array.from(b));
      expect(Array.from(base64ParaBytes(`data:image/jpeg;base64,${b64}`))).toEqual(Array.from(b));
      expect(Array.from(base64ParaBytes(b64.replace(/=+$/, "")))).toEqual(Array.from(b));
    }
    const grande = new Uint8Array(5000).map((_, i) => (i * 37) % 256);
    expect(Array.from(base64ParaBytes(Buffer.from(grande).toString("base64")))).toEqual(Array.from(grande));
  });
  test("quebra de linha no meio (como alguns codificadores mandam) não estraga", () => {
    const b64 = Buffer.from("olá, prato").toString("base64");
    const comQuebra = b64.slice(0, 4) + "\n" + b64.slice(4);
    expect(new TextDecoder().decode(base64ParaBytes(comQuebra))).toBe("olá, prato");
  });
});

describe("o corpo multipart do /api/prato", () => {
  test("um parser de verdade (o FormData do Request) lê os três campos e a foto inteira", async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x0d, 0x0a, 0x2d, 0x2d, 0x00, 0xd9]);
    const { corpo, contentType } = montarMultipart(
      { assunto: "rotulo", contexto: JSON.stringify({}) },
      { campo: "foto", nome: "foto.jpg", tipo: "image/jpeg", bytes },
    );
    expect(contentType).toMatch(/^multipart\/form-data; boundary=----ObstetricaFoto[A-Za-z0-9]{16}$/);
    const form = await new Request("http://x/api/prato", {
      method: "POST",
      headers: { "content-type": contentType },
      body: corpo,
    }).formData();
    expect(form.get("assunto")).toBe("rotulo");
    expect(form.get("contexto")).toBe("{}");
    const foto = form.get("foto") as Blob;
    expect(typeof foto).not.toBe("string");
    expect(foto.type).toBe("image/jpeg");
    expect(foto.size).toBe(bytes.length);
    expect(Array.from(new Uint8Array(await foto.arrayBuffer()))).toEqual(Array.from(bytes));
  });

  test("a fronteira é aleatória e só tem caracteres seguros", () => {
    expect(fronteiraAleatoria(() => 0)).toBe("----ObstetricaFotoAAAAAAAAAAAAAAAA");
    expect(fronteiraAleatoria()).toMatch(/^----ObstetricaFoto[A-Za-z0-9]{16}$/);
  });
});
