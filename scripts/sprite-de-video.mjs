/**
 * O VÍDEO DA CHAMA VIRA FOLHA DE SPRITES.
 *
 *   node scripts/sprite-de-video.mjs <video.webm> <destino.webp> [quadros] [colunas]

 *
 * Nasceu para a chama da sequência e serviu ao troféu no dia seguinte — daí o
 * nome genérico e os parâmetros. Duas cópias quase iguais deste arquivo
 * divergiriam no primeiro conserto, e o conserto que importa aqui (a guarda de
 * alfa lá embaixo) é justamente o que ninguém lembra de copiar.
 *
 * ─── POR QUE NÃO USAR O VÍDEO DIRETO ────────────────────────────────────────
 *
 * A arte chegou como `.webm` VP8 com canal alfa de verdade — medido aqui:
 * cantos com alpha 0, 86% da área transparente. O arquivo está certo. O
 * problema é onde ele ia rodar: **WebM com alfa não tem transparência no motor
 * do Safari**, e o app é instalado na tela de início do iPhone. A chama
 * apareceria dentro de um retângulo preto, só nos iPhones — a categoria de
 * defeito que nenhuma máquina de desenvolvimento mostra.
 *
 * A folha de sprites não passa por codec de vídeo nenhum: é uma imagem com
 * alfa animada por `steps()` no CSS. Igual nos três motores, sem política de
 * autoplay, e sem um `<video>` decodificando num canto da tela o tempo todo.
 *
 * ─── POR QUE CHROMIUM E NÃO ffmpeg ──────────────────────────────────────────
 *
 * Não há ffmpeg neste ambiente, e o mesmo já valeu para `recortar-bolha.mjs`.
 * O Chromium decodifica o vídeo, o canvas recorta os quadros e exporta WebP
 * com alfa — sem dependência nativa nenhuma.
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const [, , ORIGEM, DESTINO, QUADROS_ARG, COLUNAS_ARG, LARGURA_ARG] = process.argv;
if (!ORIGEM || !DESTINO) {
  console.error(
    "uso: node scripts/sprite-de-video.mjs <video.webm> <destino.webp> [quadros] [colunas] [larguraDoQuadro]",
  );
  process.exit(1);
}

/* Largura do quadro na folha. Sem ela, o quadro sai no tamanho da origem —
   que é o certo para o que aparece grande na tela. Para um ícone de 26px isso
   é peso sem ganho nenhum: a chama em 150px pesa 121 KB e em 128px pesa 83 KB,
   e a diferença é invisível em qualquer densidade que exista. */
const LARGURA = LARGURA_ARG ? Number(LARGURA_ARG) : 0;

const QUADROS = Number(QUADROS_ARG ?? 36);
const COLUNAS = Number(COLUNAS_ARG ?? 6);

/* QUADROS tem de ser múltiplo de COLUNAS: uma grade com celas sobrando deixa
   quadros VAZIOS no fim do ciclo, e o desenho some por uma fração de segundo a
   cada volta. Falhar aqui é muito mais barato que descobrir isso na tela. */
if (!Number.isInteger(QUADROS / COLUNAS)) {
  console.error(`✗ ${QUADROS} quadros não fecham uma grade de ${COLUNAS} colunas.`);
  process.exit(1);
}

const dataUri = `data:video/webm;base64,${readFileSync(ORIGEM).toString("base64")}`;

const b = await chromium.launch();
const p = await b.newPage();
/* Data URI em vez de servir por HTTP: o script não depende do servidor de dev
   estar de pé nem de deixar um arquivo solto em `public/`. */
await p.setContent("<body></body>");

const r = await p.evaluate(
  async ({ dataUri, QUADROS, COLUNAS, LARGURA }) => {
    const v = document.createElement("video");
    v.src = dataUri;
    v.muted = true;
    v.playsInline = true;
    await new Promise((ok, no) => {
      v.onloadeddata = ok;
      v.onerror = () => no(new Error("não decodificou"));
    });

    /* O quadro sai no TAMANHO DA ORIGEM. Ampliar aqui só inventaria pixels
       (o navegador faria o mesmo na hora de desenhar) e multiplicaria o peso
       do arquivo; e forçar quadrado deformaria um vídeo 5:4 como o do troféu. */
    const LADO_X = LARGURA > 0 ? LARGURA : v.videoWidth;
    /* Proporção MANTIDA: forçar quadrado deformaria um vídeo 5:4 como o do
       troféu, e um troféu achatado é o tipo de defeito que passa despercebido
       até alguém comparar com a arte original. */
    const LADO_Y = Math.round((LADO_X * v.videoHeight) / v.videoWidth);
    const linhas = QUADROS / COLUNAS;
    const c = document.createElement("canvas");
    c.width = COLUNAS * LADO_X;
    c.height = linhas * LADO_Y;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingQuality = "high";

    /* O último quadro NÃO repete o primeiro: com `steps()` o ciclo já volta ao
       começo sozinho, e duplicar o inicial trava a chama por um quadro a cada
       volta — visível como uma gagueira de 83 ms. */
    for (let i = 0; i < QUADROS; i++) {
      await new Promise((ok) => {
        v.onseeked = ok;
        v.currentTime = (v.duration * i) / QUADROS;
      });
      const x = (i % COLUNAS) * LADO_X;
      const y = Math.floor(i / COLUNAS) * LADO_Y;
      ctx.clearRect(x, y, LADO_X, LADO_Y);
      ctx.drawImage(v, x, y, LADO_X, LADO_Y);
    }

    /* Confere que o alfa sobreviveu ao canvas ANTES de gravar: uma folha opaca
       só se descobre quando a chama aparece como quadrado na tela da paciente. */
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let transp = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 250) transp++;

    return {
      webp: c.toDataURL("image/webp", 0.92),
      w: c.width,
      h: c.height,
      linhas,
      ladoX: LADO_X,
      ladoY: LADO_Y,
      dur: +v.duration.toFixed(2),
      pctTransparente: +((transp / (c.width * c.height)) * 100).toFixed(1),
    };
  },
  { dataUri, QUADROS, COLUNAS, LARGURA },
);
await b.close();

if (r.pctTransparente < 20) {
  console.error(
    `\n✗ ALFA PERDIDO: só ${r.pctTransparente}% transparente.\n` +
      `  O vídeo de origem provavelmente não tem canal alfa — a chama sairia\n` +
      `  dentro de um retângulo. Nada foi gravado.\n`,
  );
  process.exit(1);
}

const bytes = Buffer.from(r.webp.split(",")[1], "base64");
writeFileSync(DESTINO, bytes);
console.log(
  `✓ ${DESTINO}\n` +
    `  origem  ${r.dur}s → ${QUADROS} quadros (${(QUADROS / r.dur).toFixed(1)} fps)\n` +
    `  folha   ${r.w}×${r.h}, grade ${COLUNAS}×${r.linhas} de ${r.ladoX}×${r.ladoY}\n` +
    `  alfa    ${r.pctTransparente}% transparente\n` +
    `  peso    ${(bytes.length / 1024).toFixed(1)} KB`,
);
