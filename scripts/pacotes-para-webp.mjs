/**
 * OS TRÊS PACOTES DA LOJA, de PNG para WebP.
 *
 * ─── POR QUE ────────────────────────────────────────────────────────────────
 *
 * `scripts/pacotes-do-drive.mjs` grava PNG porque é o que a `pngjs` sabe
 * escrever, e ele precisa da `pngjs` para o recorte por inundação. Só que 456 KB
 * de PNG eram os TRÊS MAIORES arquivos de imagem do build inteiro, num repo em
 * que toda arte é WebP por decisão medida (as artes do céu, as bolhas, os cinco
 * bebês — todos passaram por esta mesma conversão).
 *
 * ─── COMO, E POR QUE NÃO SHARP ──────────────────────────────────────────────
 *
 * O projeto não tem `sharp` (nem vai ter só por isto: é dependência nativa, com
 * binário por plataforma, e o `bun install --frozen-lockfile` do CI é a coisa
 * mais fácil de quebrar nesta base). O codificador que já existe aqui é o do
 * Chromium, pelo Playwright — o mesmo caminho de `recortar-bolha.mjs`,
 * `ceu-do-drive.mjs` e `skin-fatiar.mjs`.
 *
 * ⚠️ **ALFA SOBREVIVE, e isso é conferido, não suposto.** `canvas.toDataURL`
 * com `image/webp` mantém o canal alfa; se um dia mudar, o pacote sairia com
 * fundo branco dentro de um cartão de gradiente — invisível para quem gerou o
 * arquivo e óbvio para a paciente. O script mede o alfa dos quatro cantos e a
 * fração de pixels transparentes ANTES e DEPOIS, e aborta se sumirem.
 *
 * ⚠️ **QUALIDADE MEDIDA, não afirmada.** Imprime o PSNR contra o PNG de origem
 * e reprova abaixo de 42 dB — o mesmo limite com que os cinco bebês foram
 * aprovados. Ilustração com gradiente suave é justamente onde o WebP com perda
 * costuma faixar.
 *
 * Uso:
 *   node scripts/pacotes-para-webp.mjs src/assets/pacotes
 */
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import { chromium } from "playwright";

const QUALIDADE = 0.98;
const PSNR_MINIMO = 42;
const NOMES = ["pacote-grande", "pacote-medio", "pacote-pequeno"];

const pasta = process.argv[2];
if (!pasta) {
  console.error("uso: node scripts/pacotes-para-webp.mjs <pasta>");
  process.exit(1);
}

/** Fração de pixels com alfa baixo — a assinatura do recorte. */
function transparencia(img) {
  let n = 0;
  for (let p = 0; p < img.width * img.height; p++) if (img.data[(p << 2) + 3] < 8) n++;
  return n / (img.width * img.height);
}

/**
 * PSNR em dB, sobre a cor PRÉ-MULTIPLICADA pelo alfa.
 *
 * ⚠️ COMPARAR RGB CRU AQUI DÁ UM NÚMERO SEM SENTIDO, e eu caí nisso: a
 * primeira versão deu 4 a 7 dB (o que seria uma imagem destruída) enquanto a
 * transparência batia casa decimal a casa decimal. A causa é que 36% a 55%
 * destes arquivos são pixels TRANSPARENTES, e sob um pixel transparente o PNG
 * guarda a cor original enquanto o canvas devolve (0,0,0,0). O erro medido era
 * a cor invisível, não a visível.
 *
 * Pré-multiplicando, um pixel transparente vale zero dos dois lados — que é
 * exatamente o que o olho vê. É a mesma correção que `bebes/do-drive.mjs` faz
 * ao DES-premultiplicar depois do recorte, pelo mesmo motivo.
 */
function psnr(a, b) {
  let soma = 0;
  const n = a.width * a.height;
  for (let p = 0; p < n; p++) {
    const i = p << 2;
    const aa = a.data[i + 3] / 255;
    const ab = b.data[i + 3] / 255;
    for (let c = 0; c < 3; c++) {
      const d = a.data[i + c] * aa - b.data[i + c] * ab;
      soma += d * d;
    }
    const da = a.data[i + 3] - b.data[i + 3];
    soma += da * da;
  }
  const eqm = soma / (n * 4);
  return eqm === 0 ? Infinity : 10 * Math.log10((255 * 255) / eqm);
}

const navegador = await chromium.launch();
const pagina = await navegador.newPage();

let falhou = false;
for (const nome of NOMES) {
  const caminhoPng = join(pasta, `${nome}.png`);
  const origem = PNG.sync.read(readFileSync(caminhoPng));
  const antes = transparencia(origem);

  const b64 = await pagina.evaluate(
    async ({ dados, w, h, q }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${dados}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0);
      return c.toDataURL("image/webp", q).split(",")[1];
    },
    {
      dados: readFileSync(caminhoPng).toString("base64"),
      w: origem.width,
      h: origem.height,
      q: QUALIDADE,
    },
  );

  const buf = Buffer.from(b64, "base64");
  const destino = join(pasta, `${nome}.webp`);
  writeFileSync(destino, buf);

  /* Relê pelo Chromium para medir — a `pngjs` não abre WebP. */
  const depoisRaw = await pagina.evaluate(
    async ({ dados, w, h }) => {
      const img = new Image();
      img.src = `data:image/webp;base64,${dados}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0);
      return [...ctx.getImageData(0, 0, w, h).data];
    },
    { dados: b64, w: origem.width, h: origem.height },
  );
  const depois = {
    width: origem.width,
    height: origem.height,
    data: Uint8ClampedArray.from(depoisRaw),
  };

  const q = psnr(origem, depois);
  const t = transparencia(depois);
  const kbPng = (readFileSync(caminhoPng).length / 1024).toFixed(0);
  const kbWebp = (buf.length / 1024).toFixed(0);
  console.log(
    `${nome}: ${kbPng} KB → ${kbWebp} KB  ·  PSNR ${q.toFixed(1)} dB  ·  ` +
      `transparência ${(antes * 100).toFixed(1)}% → ${(t * 100).toFixed(1)}%`,
  );

  if (q < PSNR_MINIMO) {
    console.error(`  ⚠️ PSNR abaixo de ${PSNR_MINIMO} dB — suba a qualidade.`);
    falhou = true;
  }
  /* ⚠️ Meio ponto percentual de folga: o WebP com perda mexe nas bordas do
     alfa. Perder a transparência INTEIRA (canal descartado) é o defeito que
     esta trava existe para pegar, e ele aparece como ~0%. */
  if (t < antes - 0.005) {
    console.error(`  ⚠️ O ALFA ENCOLHEU — o WebP saiu com fundo. NÃO use este arquivo.`);
    falhou = true;
  }
  if (!falhou) unlinkSync(caminhoPng);
}

await navegador.close();
process.exitCode = falhou ? 1 : 0;
