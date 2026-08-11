/**
 * O VÍDEO DA CHAMA VIRA FOLHA DE SPRITES.
 *
 *   node scripts/chama-sprite.mjs <caminho-do-video.webm>
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

const ORIGEM = process.argv[2];
if (!ORIGEM) {
  console.error("uso: node scripts/chama-sprite.mjs <video.webm>");
  process.exit(1);
}
const DESTINO = "src/assets/chama-sequencia.webp";

const QUADROS = 36; // 12 fps ao longo dos ~3 s do original: é onde fogo lê como fogo
const COLUNAS = 6;
const LADO = 128; // a UI desenha ~26px CSS; 128 dá folga até dsf 4

const dataUri = `data:video/webm;base64,${readFileSync(ORIGEM).toString("base64")}`;

const b = await chromium.launch();
const p = await b.newPage();
/* Data URI em vez de servir por HTTP: o script não depende do servidor de dev
   estar de pé nem de deixar um arquivo solto em `public/`. */
await p.setContent("<body></body>");

const r = await p.evaluate(
  async ({ dataUri, QUADROS, COLUNAS, LADO }) => {
    const v = document.createElement("video");
    v.src = dataUri;
    v.muted = true;
    v.playsInline = true;
    await new Promise((ok, no) => {
      v.onloadeddata = ok;
      v.onerror = () => no(new Error("não decodificou"));
    });

    const linhas = Math.ceil(QUADROS / COLUNAS);
    const c = document.createElement("canvas");
    c.width = COLUNAS * LADO;
    c.height = linhas * LADO;
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
      const x = (i % COLUNAS) * LADO;
      const y = Math.floor(i / COLUNAS) * LADO;
      ctx.clearRect(x, y, LADO, LADO);
      ctx.drawImage(v, x, y, LADO, LADO);
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
      dur: +v.duration.toFixed(2),
      pctTransparente: +((transp / (c.width * c.height)) * 100).toFixed(1),
    };
  },
  { dataUri, QUADROS, COLUNAS, LADO },
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
    `  folha   ${r.w}×${r.h}, grade ${COLUNAS}×${r.linhas}\n` +
    `  alfa    ${r.pctTransparente}% transparente\n` +
    `  peso    ${(bytes.length / 1024).toFixed(1)} KB`,
);
