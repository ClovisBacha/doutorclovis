#!/usr/bin/env node
/**
 * A ARTE DO CÉU, DO DRIVE PARA `src/assets/ceu/`.
 *
 *   node scripts/ceu-do-drive.mjs <origem.png> <destino.webp> [largura]
 *
 * Converte e, no mesmo passe, MEDE os quatro campos que `ceu-do-dia.tsx` cobra
 * de toda arte nova: `corDeTopo`, `corDeBaixo`, `topoEscuro` e `dark`.
 *
 * ─── POR QUE MEDIR AQUI, E NÃO ESTIMAR NO COMPONENTE ────────────────────────
 *
 * Esses quatro campos decidem se o nome do bebê sai em texto claro ou escuro e
 * de que cor fica a barra de status do iOS. Estimados a olho, já puseram texto
 * escuro sobre violeta escuro (3,43:1, contra os 4,5 que este app cobra). A
 * régua é a luminância RELATIVA da WCAG — corrigida por gama —, e não a média
 * simples dos canais: a média classifica um azul saturado como claro quando ele
 * não é.
 *
 * A faixa de cima é 0–12% da altura e a de baixo 74–100%, porque duas das
 * quatro cenas INVERTEM o brilho entre as pontas — é por isso que são dois
 * booleanos e não um.
 *
 * ─── POR QUE CHROMIUM, E NÃO ffmpeg OU sharp ────────────────────────────────
 *
 * Não existe nenhum dos dois neste ambiente, e o mesmo já valia para
 * `sprite-de-video.mjs` e `recortar-bolha.mjs`. O Chromium decodifica o PNG, o
 * canvas exporta o WebP e o `getImageData` faz a medição — sem dependência
 * nativa nenhuma.
 *
 * ─── SOBRE A LARGURA ────────────────────────────────────────────────────────
 *
 * Por padrão sai no tamanho ORIGINAL. Ampliar aqui não inventa detalhe: o
 * upscale que salvou o anoitecer foi feito FORA (Higgsfield, 4K) e só depois
 * reduzido aqui. Passar uma largura maior que a da origem é quase sempre erro,
 * então o script avisa.
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const [, , ORIGEM, DESTINO, LARGURA_ARG] = process.argv;
if (!ORIGEM || !DESTINO) {
  console.error("uso: node scripts/ceu-do-drive.mjs <origem.png> <destino.webp> [largura]");
  process.exit(1);
}

const dados = readFileSync(ORIGEM);
const tipo = ORIGEM.endsWith(".png") ? "image/png" : "image/jpeg";
const uri = `data:${tipo};base64,${dados.toString("base64")}`;

const navegador = await chromium.launch();
const pagina = await navegador.newPage();

const saida = await pagina.evaluate(
  async ([uri, larguraPedida]) => {
    const img = new Image();
    img.src = uri;
    await img.decode();

    const largura = larguraPedida || img.naturalWidth;
    const altura = Math.round((largura / img.naturalWidth) * img.naturalHeight);

    const c = document.createElement("canvas");
    c.width = largura;
    c.height = altura;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, largura, altura);

    const px = ctx.getImageData(0, 0, largura, altura).data;
    const hex = (i) =>
      "#" + [px[i], px[i + 1], px[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("");

    /* Luminância relativa da WCAG: canal linearizado antes da média. A média
       simples dos canais dá números maiores e classifica azul saturado como
       claro — foi assim que o texto escuro foi parar sobre o violeta. */
    const canal = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const luminanciaDaFaixa = (de, ate) => {
      const y0 = Math.floor(altura * de);
      const y1 = Math.floor(altura * ate);
      let soma = 0;
      let n = 0;
      for (let y = y0; y < y1; y += 2) {
        for (let x = 0; x < largura; x += 2) {
          const i = (y * largura + x) * 4;
          soma += 0.2126 * canal(px[i]) + 0.7152 * canal(px[i + 1]) + 0.0722 * canal(px[i + 2]);
          n++;
        }
      }
      return soma / n;
    };

    const topo = luminanciaDaFaixa(0, 0.12);
    const base = luminanciaDaFaixa(0.74, 1);
    const webp = c.toDataURL("image/webp", 0.94).split(",")[1];

    return {
      largura,
      altura,
      origem: { largura: img.naturalWidth, altura: img.naturalHeight },
      corDeTopo: hex(0),
      corDeBaixo: hex(((altura - 1) * largura + Math.floor(largura / 2)) * 4),
      topo,
      base,
      webp,
    };
  },
  [uri, LARGURA_ARG ? Number(LARGURA_ARG) : 0],
);

await navegador.close();

if (saida.largura > saida.origem.largura) {
  console.warn(
    `⚠️  ampliando de ${saida.origem.largura} para ${saida.largura} — upscale aqui não` +
      " inventa detalhe; faça o upscale fora e reduza por este script.",
  );
}

writeFileSync(DESTINO, Buffer.from(saida.webp, "base64"));

/* O corte em 0,18 é o mesmo dos quatro céus atuais: pôr do sol (0,106) e
   anoitecer (0,013) ficam escuros; amanhecer (0,255) e dia (0,399), claros. */
const escuro = (l) => l < 0.18;
console.log(
  JSON.stringify(
    {
      arquivo: DESTINO,
      tamanho: `${saida.largura}×${saida.altura}`,
      bytes: Buffer.from(saida.webp, "base64").length,
      corDeTopo: saida.corDeTopo,
      corDeBaixo: saida.corDeBaixo,
      luminancia: { topo: +saida.topo.toFixed(3), base: +saida.base.toFixed(3) },
      topoEscuro: escuro(saida.topo),
      dark: escuro(saida.base),
    },
    null,
    2,
  ),
);
