/**
 * TIRA O FUNDO GRAVADO das duas artes antigas do bebê.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O BUG QUE ISTO CONSERTA — e está no ar agora
 *
 * `baby-embriao.png` (semanas 4-9) tem o QUADRICULADO de transparência gravado
 * dentro do PNG, e `baby-termo.png` (37-42) tem um retângulo BRANCO. Os dois
 * são opacos: não há canal alfa nenhum.
 *
 * O código contornava com `mixBlendMode: multiply`, que apaga branco sobre
 * fundo claro. Sobre o céu NOTURNO da home isso nunca funcionou — e o Clóvis
 * mandou o print: uma paciente de verdade, na semana 8, com um quadrado xadrez
 * cinza no meio da tela.
 *
 * São 12 das 39 semanas, e são as duas pontas: o começo (quando ela abre o app
 * de novidade, toda hora) e o termo (quando abre de ansiedade).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO, E NÃO ESPERAR A ARTE NOVA
 *
 * A série de 39 ilustrações vai substituir estas duas — mas leva horas de fila
 * e ainda não começou. Enquanto isso, toda paciente entre 4 e 9 semanas vê um
 * xadrez. Este script conserta HOJE, de graça, e o resultado é descartado
 * naturalmente quando a arte própria daquela semana chegar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COMO — e por que não é "apagar o que é claro"
 *
 * Um teste "é claro? então some" abriria BURACOS no bebê: os brilhos especulares
 * da pele são quase brancos. A regra certa é topológica, não de cor:
 *
 *   fundo = o que se alcança A PARTIR DA BORDA sem cruzar o contorno
 *
 * Vindo da borda, o interior fica salvo mesmo sendo claro. É a mesma técnica do
 * `skin-fatiar.mjs`, que já resolveu este problema nas peles da trilha.
 *
 * A borda do desenho é suavizada (anti-aliasing) e mistura pele com fundo. Um
 * alfa binário deixaria auréola branca, então os pixels de transição recebem
 * alfa proporcional a quanto ainda são fundo.
 */

import { chromium } from "playwright";
import { writeFileSync, copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ASSETS = resolve("src/assets");

/** As duas com fundo gravado. As outras três já têm alfa de verdade. */
const ALVOS = ["baby-embriao.png", "baby-termo.png"];

/** Acima disto o pixel é claro o bastante para ser fundo candidato. */
const LUZ_MINIMA = 232;

/** Diferença máxima entre canais para o pixel ser NEUTRO (cinza/branco).
 *  A pele do bebê é pêssego — tem vermelho bem acima do azul — e por isso
 *  nunca passa neste teste, mesmo nos brilhos mais claros. */
const CROMA_MAXIMA = 10;

const navegador = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--allow-file-access-from-files"],
});
const pagina = await navegador.newPage();
await pagina.goto(`file://${ASSETS}/`);

for (const arquivo of ALVOS) {
  const caminho = `${ASSETS}/${arquivo}`;
  if (!existsSync(caminho)) {
    console.log(`pulando ${arquivo}: não existe`);
    continue;
  }
  /* Guarda o original UMA vez. Rodar de novo não pode degradar a imagem em
     cima do resultado anterior — o script tem que ser idempotente. */
  const backup = `${caminho}.original`;
  if (!existsSync(backup)) copyFileSync(caminho, backup);

  const r = await pagina.evaluate(
    async ([nome, luzMin, cromaMax]) => {
      const img = new Image();
      img.src = `${nome}.original?v=1`;
      await img.decode().catch(async () => {
        img.src = nome;
        await img.decode();
      });

      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const cx = c.getContext("2d", { willReadFrequently: true });
      cx.drawImage(img, 0, 0);
      const im = cx.getImageData(0, 0, c.width, c.height);
      const d = im.data;
      const w = c.width;
      const h = c.height;

      /** Claro E neutro — os dois, sempre. */
      const ehFundo = (k) => {
        const r = d[k],
          g = d[k + 1],
          b = d[k + 2];
        const claro = r > luzMin && g > luzMin && b > luzMin;
        const neutro = Math.max(r, g, b) - Math.min(r, g, b) <= cromaMax;
        return claro && neutro;
      };

      // Preenchimento a partir das quatro bordas.
      const fundo = new Uint8Array(w * h);
      const fila = [];
      for (let x = 0; x < w; x++) {
        fila.push(x, (h - 1) * w + x);
      }
      for (let y = 0; y < h; y++) {
        fila.push(y * w, y * w + w - 1);
      }
      while (fila.length) {
        const p = fila.pop();
        if (fundo[p]) continue;
        if (!ehFundo(p * 4)) continue;
        fundo[p] = 1;
        const x = p % w,
          y = (p / w) | 0;
        if (x > 0) fila.push(p - 1);
        if (x < w - 1) fila.push(p + 1);
        if (y > 0) fila.push(p - w);
        if (y < h - 1) fila.push(p + w);
      }

      /* Transição suave. O pixel que NÃO é fundo mas encosta em fundo e ainda é
         claro está na borda anti-serrilhada: recebe alfa proporcional a quanto
         já saiu do branco. Sem isto sobra auréola. */
      let apagados = 0;
      const alfa = new Uint8Array(w * h).fill(255);
      for (let p = 0; p < w * h; p++) {
        if (fundo[p]) {
          alfa[p] = 0;
          apagados++;
          continue;
        }
        const x = p % w,
          y = (p / w) | 0;
        const vizinhoFundo =
          (x > 0 && fundo[p - 1]) ||
          (x < w - 1 && fundo[p + 1]) ||
          (y > 0 && fundo[p - w]) ||
          (y < h - 1 && fundo[p + w]);
        if (!vizinhoFundo) continue;
        const k = p * 4;
        const lum = (d[k] + d[k + 1] + d[k + 2]) / 3;
        if (lum <= luzMin) continue;
        // 255 (branco puro) → 0 ; luzMin → 255
        alfa[p] = Math.round(255 * (1 - (lum - luzMin) / (255 - luzMin)));
      }
      for (let p = 0; p < w * h; p++) d[p * 4 + 3] = alfa[p];
      cx.putImageData(im, 0, 0);

      return {
        largura: w,
        altura: h,
        pctApagado: +((apagados / (w * h)) * 100).toFixed(1),
        png: c.toDataURL("image/png").split(",")[1],
      };
    },
    [arquivo, LUZ_MINIMA, CROMA_MAXIMA],
  );

  writeFileSync(caminho, Buffer.from(r.png, "base64"));
  console.log(`${arquivo}: ${r.largura}x${r.altura} · ${r.pctApagado}% virou transparente`);
}

await navegador.close();
console.log("\nOs `.original` ficam ao lado como matéria-prima (ignorados pelo git).");
