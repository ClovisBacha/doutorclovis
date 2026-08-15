/**
 * AS TRÊS ILUSTRAÇÕES DA LOJA DE SEMENTINHAS, recortadas da referência.
 *
 * ─── POR QUE RECORTAR, E NÃO REDESENHAR ─────────────────────────────────────
 *
 * O dono mandou o layout inteiro numa imagem só e pediu que ficasse "exatamente
 * dessa forma". Tudo o que é TEXTO, cor, botão e espaçamento eu consigo
 * reconstruir em CSS — e preciso, porque preço e saldo vêm do código e a tela
 * tem de responder a qualquer tamanho de celular.
 *
 * O que eu não consigo reproduzir é a arte: o saco de sementes, o pote e o
 * frasquinho. Esses três saem da imagem dele, no tamanho original, e viram
 * PNG com fundo transparente para pousarem sobre o gradiente do cartão que o
 * CSS desenha.
 *
 * ─── ⚠️ O RECORTE DE FUNDO É POR CONEXÃO COM A BORDA ────────────────────────
 *
 * O fundo do cartão é um gradiente CLARO, e a ilustração tem brilhos claros
 * dentro dela (o reflexo no vidro do pote, a etiqueta bege). Um limiar de
 * brilho comeria esses brilhos.
 *
 * Então o teste é o mesmo de `scripts/bebes/do-drive.mjs`: só vira transparente
 * o pixel claro-e-pouco-saturado que está LIGADO À BORDA do recorte. O reflexo
 * no meio do vidro não alcança a borda sem atravessar o contorno escuro do
 * desenho, então fica opaco por construção.
 *
 * A borda ganha uma rampa (não um corte seco) para não serrilhar sobre o
 * gradiente do cartão.
 *
 * Uso:
 *   node scripts/pacotes-do-drive.mjs <referencia.png> <pasta-destino>
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";

/** As três caixas, medidas na referência de 853×1844. */
const CAIXAS = [
  /* ⚠️ O saco começa em x=95 e não em x=42 de propósito: a fita diagonal
     "MELHOR VALOR" ocupa o canto superior esquerdo do cartão e é desenhada em
     CSS, não recortada — ela precisa acompanhar o cartão quando ele muda de
     largura. */
  { nome: "pacote-grande", x: 95, y: 800, w: 320, h: 278 },
  { nome: "pacote-medio", x: 78, y: 1118, w: 305, h: 284 },
  { nome: "pacote-pequeno", x: 116, y: 1462, w: 328, h: 302 },
];

/** Claro e sem cor: candidato a fundo. */
const BRILHO_FUNDO = 214;
/** Onde o pixel passa a ser 100% opaco — a rampa vive entre os dois. */
const BRILHO_CHEIO = 176;
const CROMA_MAXIMA = 34;

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

/** Marca o fundo por inundação a partir das quatro bordas. */
function fundoLigadoABorda(img) {
  const { width: w, height: h, data } = img;
  const fundo = new Uint8Array(w * h);
  const candidato = (p) => {
    const i = p << 2;
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const croma = Math.max(r, g, b) - Math.min(r, g, b);
    const brilho = Math.max(r, g, b);
    return brilho > BRILHO_CHEIO && croma < CROMA_MAXIMA;
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
    /* Rampa: quanto mais claro, mais transparente. Corte seco serrilha a
       borda sobre o gradiente do cartão. */
    const t = (brilho - BRILHO_CHEIO) / (BRILHO_FUNDO - BRILHO_CHEIO);
    data[i + 3] = Math.round(255 * (1 - Math.min(1, Math.max(0, t))));
  }
}

/** Apara as bordas que ficaram totalmente transparentes. */
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
  console.error("uso: node scripts/pacotes-do-drive.mjs <referencia.png> <pasta-destino>");
  process.exit(1);
}
const src = PNG.sync.read(readFileSync(origem));
if (src.width !== 853 || src.height !== 1844) {
  console.error(
    `⚠️ a referência mudou de tamanho (${src.width}×${src.height}, esperado 853×1844).\n` +
      "As caixas de recorte foram MEDIDAS nessa imagem — refaça a medição antes de rodar.",
  );
  process.exit(1);
}
mkdirSync(destino, { recursive: true });
for (const cx of CAIXAS) {
  const img = apara(
    (() => {
      const c = recorta(src, cx);
      aplicaAlfa(c, fundoLigadoABorda(c));
      return c;
    })(),
  );
  const opacos = (() => {
    let n = 0;
    for (let p = 0; p < img.width * img.height; p++) if (img.data[(p << 2) + 3] > 200) n++;
    return n;
  })();
  const frac = opacos / (img.width * img.height);
  writeFileSync(join(destino, `${cx.nome}.png`), PNG.sync.write(img));
  console.log(`${cx.nome}.png  ${img.width}×${img.height}  tinta ${(frac * 100).toFixed(1)}%`);
  if (frac < 0.12) console.error(`  ⚠️ pouca tinta — o recorte pode ter comido o desenho.`);
  if (frac > 0.9) console.error(`  ⚠️ quase tudo opaco — o fundo pode não ter saído.`);
}
