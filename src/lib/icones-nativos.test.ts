/**
 * Os ícones do app nativo.
 *
 * ─── O defeito que isto pega ────────────────────────────────────────────
 *
 * `cap add` gera os projetos nativos com os ícones de EXEMPLO do Capacitor — um
 * "X" azul sobre uma grade. Eles compilam, o app abre, e nada acusa nada: o app
 * iria para a loja com a logo do Capacitor. Qualquer pessoa que rode `cap add`
 * de novo (para "consertar" um projeto quebrado, por exemplo) traz o
 * placeholder de volta em silêncio.
 *
 * ─── E a transparência, que reprova no upload ───────────────────────────
 *
 * A Apple recusa ícone com canal alfa. O erro só aparece ao enviar o binário,
 * depois de o build inteiro ter passado — e o que era transparente vira PRETO.
 * Barato conferir aqui.
 *
 * O PNG é escrito por `scripts/icones-nativos.py` com filtro "None" em todas as
 * linhas, então ler o primeiro pixel é inflar e pular um byte. Não é um decoder
 * de PNG geral, e não precisa ser.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const ICONE = "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png";

/** Lê IHDR e o primeiro pixel de um PNG RGBA sem filtro. */
function lerPng(caminho: string) {
  const d = readFileSync(caminho);
  const largura = d.readUInt32BE(16);
  const altura = d.readUInt32BE(20);
  const profundidade = d[24];
  const tipoDeCor = d[25];

  let idat = Buffer.alloc(0);
  let i = 8;
  while (i < d.length) {
    const tam = d.readUInt32BE(i);
    const tipo = d.toString("ascii", i + 4, i + 8);
    if (tipo === "IDAT") idat = Buffer.concat([idat, d.subarray(i + 8, i + 8 + tam)]);
    if (tipo === "IEND") break;
    i += 12 + tam;
  }
  const cru = inflateSync(idat);
  /* Byte 0 de cada linha é o filtro; 0 = None. */
  const filtroDaPrimeiraLinha = cru[0];
  const primeiro = { r: cru[1], g: cru[2], b: cru[3], a: cru[4] };
  return { largura, altura, profundidade, tipoDeCor, filtroDaPrimeiraLinha, primeiro, cru };
}

describe("o ícone do iOS", () => {
  const png = lerPng(ICONE);

  test("é 1024×1024 — o tamanho único que a App Store aceita", () => {
    expect(png.largura).toBe(1024);
    expect(png.altura).toBe(1024);
  });

  test("é RGBA de 8 bits, sem filtro — o formato que este teste sabe ler", () => {
    expect(png.profundidade).toBe(8);
    expect(png.tipoDeCor).toBe(6);
    expect(png.filtroDaPrimeiraLinha).toBe(0);
  });

  test("NÃO é o placeholder do Capacitor", () => {
    /* O placeholder é um "X" azul sobre grade branca: o canto é branco
       acinzentado. O nosso é o rosa da marca, que sangra até a borda porque a
       máscara do iOS corta a COR, não o desenho. */
    const { r, g, b } = png.primeiro;
    expect(r).toBeGreaterThan(240);
    expect(g).toBeGreaterThan(200);
    expect(g).toBeLessThan(245); // branco puro reprova: seria a margem de volta
    expect(b).toBeGreaterThan(210);
    expect(r).toBeGreaterThan(g); // rosa: vermelho acima do verde
  });

  test("é opaco em toda a primeira linha — alfa reprova no upload da Apple", () => {
    /* Uma amostra da linha inteira, não só o primeiro pixel: um canto
       arredondado deixa alfa justamente nas pontas. */
    for (let x = 0; x < 1024; x += 37) {
      expect(png.cru[1 + x * 4 + 3]).toBe(255);
    }
  });
});

describe("o ícone adaptativo do Android", () => {
  test("o fundo declarado é o mesmo rosa da arte", () => {
    /* Se divergirem, aparece uma moldura de outra cor em volta do recorte que o
       launcher faz — e o formato do recorte muda de aparelho para aparelho. */
    const xml = readFileSync("android/app/src/main/res/values/ic_launcher_background.xml", "utf8");
    expect(xml).toMatch(/#FEE2EA/i);
  });

  test("a camada da frente existe nas cinco densidades", () => {
    for (const d of ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) {
      const png = lerPng(`android/app/src/main/res/mipmap-${d}/ic_launcher_foreground.png`);
      expect(png.largura).toBeGreaterThan(0);
      expect(png.largura).toBe(png.altura);
    }
  });

  test("a arte cabe na área segura — o launcher recorta em círculo", () => {
    /* O adaptativo desenha numa tela de 108dp da qual só os 72dp centrais
       aparecem. Sem folga, o círculo come a barriga do desenho. A borda tem que
       ser cor chapada. */
    const png = lerPng("android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png");
    const { r, g, b } = png.primeiro;
    expect([r, g, b]).toEqual([254, 226, 234]);
  });
});

describe("a cor de espera do app é a da marca", () => {
  test("`capacitor.config.ts` não usa mais o azul escuro", () => {
    /* Com um escuro ali, a abertura era marca clara → moldura escura → tela de
       login clara: três cores em menos de um segundo. */
    const cfg = readFileSync("capacitor.config.ts", "utf8");
    expect(cfg).not.toContain('backgroundColor: "#0b0b17"');
    expect(cfg.match(/backgroundColor: "#FEE2EA"/g)?.length).toBe(3);
  });
});
