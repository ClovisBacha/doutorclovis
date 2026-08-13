/**
 * Uma expressão nova da bolha, do Drive pra src/assets/bolha/.
 *
 *   node scripts/bolha-do-drive.mjs <origem.png> <nome-do-humor>
 *
 * Duas etapas, cada uma medida:
 *
 *  1. RECORTE DE FUNDO — mesmo algoritmo de `scripts/bebes/do-drive.mjs`
 *     (porta de croma + rampa de brilho + conexão com a borda, então
 *     des-premultiplica). A arte chega em RGB sem alfa, fundo quase-branco.
 *
 *  2. ENCAIXE NA MESMA ESFERA — as cinco expressões vivas (`bolha.tsx`)
 *     partem todas de uma esfera de 663px de diâmetro centrada em 459×396
 *     numa tela de 960×960; é isso que impede a bolha de mudar de tamanho ao
 *     trocar de humor. A esfera da arte nova é medida por AJUSTE DE CÍRCULO
 *     na borda direita (livre de boné/livro), com REJEIÇÃO DE OUTLIER: um
 *     brilho ou confete que fique mais à direita que a bolha naquela altura
 *     vence a busca ingênua por "pixel opaco mais à direita da linha" — o
 *     ajuste roda três vezes, descartando a cada volta os pontos que mais
 *     destoam do círculo até então, o que os afasta do resultado final.
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const [, , ORIGEM, NOME] = process.argv;
if (!ORIGEM || !NOME) {
  console.error("uso: node scripts/bolha-do-drive.mjs <origem.png> <nome-do-humor>");
  process.exit(1);
}
const DESTINO = `src/assets/bolha/${NOME}.webp`;

/** A esfera-alvo, medida em feliz.webp com o mesmo método (ver commit). */
const ALVO = { diametro: 663, cx: 459, cy: 396 };

const uri = `data:image/png;base64,${readFileSync(ORIGEM).toString("base64")}`;
const nav = await chromium.launch();
const page = await nav.newPage();

const saida = await page.evaluate(
  async ([uri, ALVO]) => {
    const img = new Image();
    img.src = uri;
    await img.decode();
    const W = img.naturalWidth,
      H = img.naturalHeight;

    const tela = (w, h) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      return [c, c.getContext("2d", { willReadFrequently: true })];
    };

    const [c0, g0] = tela(W, H);
    g0.drawImage(img, 0, 0);
    const original = g0.getImageData(0, 0, W, H);
    const px = original.data;
    const N = W * H;

    /* ── 1. RECORTE DE FUNDO (mesmo algoritmo de bebes/do-drive.mjs) ────── */
    const B = [px[0], px[1], px[2]];
    const alfa = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      const i = k * 4;
      const r = px[i],
        g = px[i + 1],
        b = px[i + 2];
      const menor = Math.min(r, g, b);
      const maior = Math.max(r, g, b);
      const porta = Math.max(0, Math.min(1, (maior - menor - 4) / 6));
      const brilho = Math.max(0, Math.min(1, (250 - menor) / 30));
      alfa[k] = porta * brilho;
    }
    const alcanca = new Uint8Array(N);
    const fila = new Int32Array(N);
    let fim = 0;
    const poe = (k) => {
      if (!alcanca[k] && alfa[k] < 0.995) {
        alcanca[k] = 1;
        fila[fim++] = k;
      }
    };
    for (let x = 0; x < W; x++) {
      poe(x);
      poe((H - 1) * W + x);
    }
    for (let y = 0; y < H; y++) {
      poe(y * W);
      poe(y * W + W - 1);
    }
    for (let cabeca = 0; cabeca < fim; cabeca++) {
      const k = fila[cabeca];
      const x = k % W;
      const y = (k - x) / W;
      if (x > 0) poe(k - 1);
      if (x < W - 1) poe(k + 1);
      if (y > 0) poe(k - W);
      if (y < H - 1) poe(k + W);
    }
    let fundoNeutro = 0;
    for (let k = 0; k < N; k++) {
      const i = k * 4;
      const a = alcanca[k] ? alfa[k] : 1;
      if (a >= 0.999) {
        px[i + 3] = 255;
        continue;
      }
      if (a <= 0.001) {
        px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0;
        fundoNeutro++;
        continue;
      }
      for (let ch = 0; ch < 3; ch++) {
        px[i + ch] = Math.max(0, Math.min(255, Math.round((px[i + ch] - (1 - a) * B[ch]) / a)));
      }
      px[i + 3] = Math.round(a * 255);
    }
    g0.putImageData(original, 0, 0);

    /* ── 2. AJUSTE DE CÍRCULO NA BORDA DIREITA, COM REJEIÇÃO DE OUTLIER ──── */
    const depois = g0.getImageData(0, 0, W, H).data;
    let pts = [];
    for (let y = 0; y < H; y++) {
      let x1 = -1;
      for (let x = W - 1; x >= 0; x--) {
        if (depois[(y * W + x) * 4 + 3] > 128) {
          x1 = x;
          break;
        }
      }
      if (x1 >= 0) pts.push({ y, x: x1 });
    }
    // A faixa central foi medida à mão (bolha-medir.mjs, perfil linha a
    // linha): fora dela sobra confete/brilho mais à direita que a própria
    // bolha, e a rejeição de outlier sozinha convergia pro círculo errado —
    // ela precisa de uma maioria limpa pra começar, e sem isto não tinha.
    const FAIXA_LIMPA = { y0: 350, y1: 595 };
    pts = pts.filter((p) => p.y >= FAIXA_LIMPA.y0 && p.y <= FAIXA_LIMPA.y1);

    function ajustar(pontos) {
      const S = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ];
      const T = [0, 0, 0];
      for (const { x, y } of pontos) {
        const row = [x, y, 1];
        const alvo = x * x + y * y;
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) S[i][j] += row[i] * row[j];
          T[i] += row[i] * alvo;
        }
      }
      const M = S.map((row, i) => [...row, T[i]]);
      for (let i = 0; i < 3; i++) {
        let p = i;
        for (let r = i + 1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
        [M[i], M[p]] = [M[p], M[i]];
        const piv = M[i][i];
        for (let j = i; j <= 3; j++) M[i][j] /= piv;
        for (let r = 0; r < 3; r++) {
          if (r === i) continue;
          const f = M[r][i];
          for (let j = i; j <= 3; j++) M[r][j] -= f * M[i][j];
        }
      }
      const A = M[0][3],
        Bc = M[1][3],
        C = M[2][3];
      const cx = A / 2,
        cy = Bc / 2;
      const r = Math.sqrt(Math.max(0, C + cx * cx + cy * cy));
      return { cx, cy, r };
    }

    let circulo = ajustar(pts);
    for (let volta = 0; volta < 3; volta++) {
      const comResiduo = pts.map((p) => ({
        ...p,
        residuo: Math.abs(Math.sqrt((p.x - circulo.cx) ** 2 + (p.y - circulo.cy) ** 2) - circulo.r),
      }));
      comResiduo.sort((a, b) => a.residuo - b.residuo);
      // mantém os 70% mais próximos do círculo da rodada anterior.
      pts = comResiduo.slice(0, Math.ceil(comResiduo.length * 0.7));
      circulo = ajustar(pts);
    }
    const diametro = 2 * circulo.r;

    /* ── 3. ESCALA E DESLOCA PRA ESFERA-ALVO ─────────────────────────────── */
    const escala = ALVO.diametro / diametro;
    const offX = ALVO.cx - circulo.cx * escala;
    const offY = ALVO.cy - circulo.cy * escala;

    const [cSaida, gSaida] = tela(960, 960);
    gSaida.imageSmoothingQuality = "high";
    gSaida.drawImage(c0, offX, offY, W * escala, H * escala);

    const webp = cSaida.toDataURL("image/webp", 0.95).split(",")[1];

    return {
      W,
      H,
      fracaoTransparente: +(fundoNeutro / N).toFixed(3),
      medida: { cx: circulo.cx, cy: circulo.cy, diametro, pontosUsados: pts.length },
      escala,
      offX,
      offY,
      webp,
    };
  },
  [uri, ALVO],
);

await nav.close();

const bytes = Buffer.from(saida.webp, "base64");
writeFileSync(DESTINO, bytes);
console.log(
  JSON.stringify(
    {
      arquivo: DESTINO,
      origem: `${saida.W}×${saida.H}`,
      transparente: `${Math.round(saida.fracaoTransparente * 100)}%`,
      esferaMedida: saida.medida,
      escala: +saida.escala.toFixed(4),
      kb: Math.round(bytes.length / 1024),
    },
    null,
    2,
  ),
);
