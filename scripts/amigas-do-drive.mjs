/**
 * OS ELEMENTOS DA REFERÊNCIA DA ABA AMIGAS, recortados do arquivo do dono.
 *
 * ─── POR QUE ISTO EXISTE ────────────────────────────────────────────────────
 *
 * A primeira versão desta tela reconstruiu TUDO em CSS: gradiente no lugar do
 * fundo pintado, a bolha `feliz` que já existia no lugar da bolha de olhos de
 * coração, emoji no lugar dos ícones desenhados. O resultado ficou parecido de
 * estrutura e completamente diferente de acabamento — o dono olhou e disse, com
 * razão, que "uma tem cara de feita aqui, a outra de profissional".
 *
 * Gradiente não vira pintura e emoji não vira ícone. O que separa as duas telas
 * não é layout: é ARTE, e a arte está no arquivo dele.
 *
 * ⚠️ O RECORTE É POR CONEXÃO COM A BORDA, como em `pacotes-do-drive.mjs` e
 * `bebes/do-drive.mjs`: só vira transparente o pixel que está LIGADO à borda da
 * caixa e parecido com o fundo. Um limiar de brilho comeria os brilhos internos
 * (o reflexo da bolha, o branco do olho).
 *
 * ⚠️ E O FUNDO É AMOSTRADO POR LINHA, não chutado. Ele é um gradiente vertical
 * com bokeh; a coluna x=840 é a mais limpa da imagem (poucos elementos a
 * cruzam), e é dela que sai a rampa. Medido: 253,237,231 no topo →
 * 241,234,247 no meio → 251,246,249 no pé.
 *
 * Uso:
 *   node scripts/amigas-do-drive.mjs <referencia.png> <pasta-destino>
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";

/** As caixas, MEDIDAS na referência de 852×1846. */
const CAIXAS = [
  /* A bolha de olhos de coração. Nenhuma das oito expressões que o app já tem
     é esta — ela é da referência, e é o elemento que mais define a tela. */
  /* MEDIDA: a região saturada da bolha vai de x 95..379, y 190..569 (o croma
     alto a separa do fundo pastel). A caixa abre 8px de folga e começa em
     x=88 para não abocanhar o coração que flutua à esquerda, em x 60..115. */
  { nome: "bolha-coracao", x: 88, y: 184, w: 300, h: 392 },
  /* Os corações 3D. Três tamanhos, e o maior é o que pousa no balão. */
  { nome: "coracao-grande", x: 735, y: 455, w: 90, h: 85 },
  { nome: "coracao-medio", x: 35, y: 240, w: 80, h: 75 },
  { nome: "coracao-pequeno", x: 380, y: 145, w: 45, h: 42 },
  /* As bolhinhas iridescentes que acompanham a grande. */
  /* A bolhinha iridescente é quase toda saturada — o aviso de "quase tudo
     opaco" é esperado aqui e não indica recorte ruim. */
  { nome: "bolhinha", x: 38, y: 478, w: 72, h: 72 },
];

/** Claro e sem cor: candidato a fundo. */
const BRILHO_FUNDO = 250;
const BRILHO_CHEIO = 226;
const CROMA_MAXIMA = 22;

function recorta(src, cx) {
  const out = new PNG({ width: cx.w, height: cx.h });
  for (let y = 0; y < cx.h; y++) {
    for (let x = 0; x < cx.w; x++) {
      const i = (src.width * (y + cx.y) + (x + cx.x)) << 2;
      const j = (cx.w * y + x) << 2;
      out.data[j] = src.data[i];
      out.data[j + 1] = src.data[i + 1];
      out.data[j + 2] = src.data[i + 2];
      out.data[j + 3] = 255;
    }
  }
  return out;
}

function fundoLigadoABorda(img) {
  const { width: w, height: h, data } = img;
  const fundo = new Uint8Array(w * h);
  const candidato = (p) => {
    const i = p << 2;
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const croma = Math.max(r, g, b) - Math.min(r, g, b);
    return Math.max(r, g, b) > BRILHO_CHEIO && croma < CROMA_MAXIMA;
  };
  const fila = [];
  const põe = (p) => {
    if (p < 0 || p >= w * h || fundo[p] || !candidato(p)) return;
    fundo[p] = 1;
    fila.push(p);
  };
  for (let x = 0; x < w; x++) {
    põe(x);
    põe((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    põe(y * w);
    põe(y * w + w - 1);
  }
  while (fila.length) {
    const p = fila.pop();
    const x = p % w;
    if (x > 0) põe(p - 1);
    if (x < w - 1) põe(p + 1);
    põe(p - w);
    põe(p + w);
  }
  return fundo;
}

function aplicaAlfa(img, fundo) {
  const { width: w, height: h, data } = img;
  for (let p = 0; p < w * h; p++) {
    if (!fundo[p]) continue;
    const i = p << 2;
    const brilho = Math.max(data[i], data[i + 1], data[i + 2]);
    const t = (brilho - BRILHO_CHEIO) / (BRILHO_FUNDO - BRILHO_CHEIO);
    data[i + 3] = Math.round(255 * (1 - Math.min(1, Math.max(0, t))));
  }
}

function apara(img) {
  const { width: w, height: h, data } = img;
  let x0 = w,
    y0 = h,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (data[((w * y + x) << 2) + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  if (x1 < 0) return img;
  const nw = x1 - x0 + 1,
    nh = y1 - y0 + 1;
  const out = new PNG({ width: nw, height: nh });
  for (let y = 0; y < nh; y++)
    for (let x = 0; x < nw; x++) {
      const i = (w * (y + y0) + (x + x0)) << 2;
      const j = (nw * y + x) << 2;
      out.data[j] = data[i];
      out.data[j + 1] = data[i + 1];
      out.data[j + 2] = data[i + 2];
      out.data[j + 3] = data[i + 3];
    }
  return out;
}

const [, , origem, destino] = process.argv;
if (!origem || !destino) {
  console.error("uso: node scripts/amigas-do-drive.mjs <referencia.png> <pasta-destino>");
  process.exit(1);
}
const src = PNG.sync.read(readFileSync(origem));
if (src.width !== 852 || src.height !== 1846) {
  console.error(
    `⚠️ a referência mudou de tamanho (${src.width}×${src.height}, esperado 852×1846).\n` +
      "As caixas foram MEDIDAS nessa imagem — refaça a medição antes de rodar.",
  );
  process.exit(1);
}
mkdirSync(destino, { recursive: true });

/* ─── O GRADIENTE DO FUNDO ──────────────────────────────────────────────────
   Não é recorte: é a rampa amostrada linha a linha na coluna mais limpa da
   imagem. Sai como CSS, porque um gradiente vertical em CSS escala para
   qualquer altura de tela sem esticar pixel nenhum — e o bokeh entra por cima,
   como elemento. */
const COLUNA_LIMPA = 840;
const paradas = [0, 8, 16, 25, 33, 43, 54, 65, 76, 87, 100].map((pct) => {
  const y = Math.min(src.height - 1, Math.round((pct / 100) * (src.height - 1)));
  const i = (src.width * y + COLUNA_LIMPA) << 2;
  const hex = (v) => v.toString(16).padStart(2, "0");
  return `#${hex(src.data[i])}${hex(src.data[i + 1])}${hex(src.data[i + 2])} ${pct}%`;
});
console.log("\n/* o gradiente do fundo, amostrado da referência */");
console.log(`linear-gradient(180deg, ${paradas.join(", ")})\n`);

for (const cx of CAIXAS) {
  const img = apara(
    (() => {
      const c = recorta(src, cx);
      aplicaAlfa(c, fundoLigadoABorda(c));
      return c;
    })(),
  );
  let opacos = 0;
  for (let p = 0; p < img.width * img.height; p++) if (img.data[(p << 2) + 3] > 200) opacos++;
  const frac = opacos / (img.width * img.height);
  writeFileSync(join(destino, `${cx.nome}.png`), PNG.sync.write(img));
  console.log(`${cx.nome}.png  ${img.width}×${img.height}  tinta ${(frac * 100).toFixed(1)}%`);
  if (frac < 0.1) console.error(`  ⚠️ pouca tinta — o recorte pode ter comido o desenho.`);
  if (frac > 0.95) console.error(`  ⚠️ quase tudo opaco — o fundo pode não ter saído.`);
}
