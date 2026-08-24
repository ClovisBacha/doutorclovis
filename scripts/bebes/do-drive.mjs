#!/usr/bin/env node
/**
 * A ARTE DO BEBÊ, DO DRIVE PARA `src/assets/bebes/`.
 *
 *   node scripts/bebes/do-drive.mjs <origem.png> <destino.webp>
 *
 * Faz três coisas, nesta ordem, e mede o resultado de cada uma:
 *
 *   1. devolve o ALFA quando ele foi perdido na exportação;
 *   2. converte para WebP no tamanho ORIGINAL — nunca reduz;
 *   3. imprime o PSNR contra a origem e a fração de tinta da arte.
 *
 * ─── 1. O XADREZ GRAVADO ────────────────────────────────────────────────────
 *
 * Três das cinco artes que o dono mandou chegaram em RGB, sem canal alfa, com
 * o XADREZ de transparência gravado como pixel — dois cinzas neutros e claros
 * (medidos: 254 e 241/243/246) alternando em células grandes. É o que acontece
 * quando o editor mostra transparência em xadrez e a exportação salva sem alfa.
 * No app isso vira um retângulo quadriculado dentro da bolha; o defeito é
 * invisível no editor e só aparece quando a imagem cai sobre o céu.
 *
 * O recorte não é limiar de brilho. Brilho sozinho comeria os reflexos claros
 * da testa do bebê — eles também são quase brancos. São TRÊS testes juntos:
 *
 *   · **cor**: o xadrez é NEUTRO (r=g=b). A pele é sempre cromática, mesmo nas
 *     sombras. `portaDeCroma` zera tudo que não tem cor.
 *   · **brilho**: `alfaBruto` sobe de 0 a 1 entre 250 e 220 no canal mais
 *     escuro, o que dá uma rampa suave na borda anti-serrilhada em vez de um
 *     recorte de tesoura — e é o que salva o cordão umbilical da semana 6, que
 *     se apaga em degradê por ~150px.
 *   · **conexão**: só é fundo o que ALCANÇA a borda do quadro sem atravessar
 *     tinta. Reflexo no meio da testa não alcança, então fica opaco por
 *     construção, sem número mágico nenhum.
 *
 * Depois disso a cor é DES-PREMULTIPLICADA (`F = (P − (1−α)·B) / α`): sem esse
 * passo a borda fica com uma auréola clara, que é o xadrez ainda misturado ao
 * pixel. É a diferença entre "recortado" e "recortado sobre branco".
 *
 * ─── 2. NUNCA REDUZ ─────────────────────────────────────────────────────────
 *
 * Pedido do dono: "na qualidade exata deles, não perca a qualidade". O script
 * não aceita largura de saída — o WebP sai com a mesma grade de pixels da
 * origem. Quem escolhe o tamanho na tela é o CSS.
 *
 * ─── 3. O PSNR NÃO É ENFEITE ────────────────────────────────────────────────
 *
 * WebP com alfa é lossy por padrão, e "não perca a qualidade" é uma afirmação
 * que se mede. O script imprime o PSNR contra a origem e REPROVA abaixo de
 * 42 dB — a mesma régua com que os quatro céus foram aprovados (44–47 dB).
 * Acima disso a diferença não é visível; abaixo, sobe a qualidade e roda de
 * novo em vez de acreditar no olho.
 *
 * Chromium decodifica, o canvas exporta; não há ffmpeg nem sharp aqui.
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const [, , ORIGEM, DESTINO, QUALIDADE_ARG] = process.argv;
if (!ORIGEM || !DESTINO) {
  console.error("uso: node scripts/bebes/do-drive.mjs <origem.png> <destino.webp> [qualidade]");
  process.exit(1);
}
const QUALIDADE = QUALIDADE_ARG ? Number(QUALIDADE_ARG) : 0.95;
/** O piso de PSNR: abaixo disto a conversão está mordendo a arte. */
const PSNR_MINIMO = 42;

const uri = `data:image/png;base64,${readFileSync(ORIGEM).toString("base64")}`;
const navegador = await chromium.launch();
const pagina = await navegador.newPage();

const saida = await pagina.evaluate(
  async ([uri, qualidade]) => {
    const img = new Image();
    img.src = uri;
    await img.decode();
    const W = img.naturalWidth;
    const H = img.naturalHeight;

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

    /* Alfa de verdade é alfa que varia. Um canal cheio de 255 é o mesmo que
       não ter canal — e é exatamente o caso das artes que vieram achatadas. */
    let temAlfa = false;
    for (let i = 3; i < px.length; i += 4) {
      if (px[i] < 250) {
        temAlfa = true;
        break;
      }
    }

    let recortou = false;
    let fundoNeutro = 0;
    if (!temAlfa) {
      recortou = true;
      const N = W * H;

      /* ── A rampa: croma × brilho ──────────────────────────────────────
         `B` é o tom claro do xadrez, amostrado do canto — é contra ele que a
         cor é des-premultiplicada. O tom escuro do xadrez cai fora pela porta
         de croma, que não olha brilho nenhum. */
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

      /* ── Conexão com a borda ──────────────────────────────────────────
         Fila em vez de recursão: 1,5 milhão de pixels estouram a pilha. O que
         não é alcançado daqui é interior, e interior é opaco — inclusive os
         reflexos brancos da testa, que é o que um limiar de brilho comeria. */
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
        /* Des-premultiplica contra o tom do xadrez: sem isto sobra auréola. */
        for (let ch = 0; ch < 3; ch++) {
          px[i + ch] = Math.max(0, Math.min(255, Math.round((px[i + ch] - (1 - a) * B[ch]) / a)));
        }
        px[i + 3] = Math.round(a * 255);
      }
      g0.putImageData(original, 0, 0);
    }

    /* ── A TINTA, medida DEPOIS do recorte ────────────────────────────────
       É o número que o app usa para o bebê não saltar de tamanho ao trocar de
       arte. Só conta o que é sólido (α ≥ 128): a auréola de meio-tom não é
       corpo do bebê, e contá-la faria a arte parecer maior do que se vê. */
    const dep = g0.getImageData(0, 0, W, H).data;
    let x0 = W,
      y0 = H,
      x1 = -1,
      y1 = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (dep[(y * W + x) * 4 + 3] < 128) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }

    const webp = c0.toDataURL("image/webp", qualidade).split(",")[1];

    /* ── PSNR: o WebP contra o que entrou nele ────────────────────────────
       Comparado sobre CINZA MÉDIO e não sobre branco: composto sobre branco, a
       área transparente vira branco nos dois e infla o número com pixels que
       ninguém olha. */
    const volta = new Image();
    volta.src = "data:image/webp;base64," + webp;
    await volta.decode();
    const [c1, g1] = tela(W, H);
    const [c2, g2] = tela(W, H);
    for (const g of [g1, g2]) {
      g.fillStyle = "#808080";
      g.fillRect(0, 0, W, H);
    }
    g1.drawImage(c0, 0, 0);
    g2.drawImage(volta, 0, 0);
    const A = g1.getImageData(0, 0, W, H).data;
    const Bb = g2.getImageData(0, 0, W, H).data;
    let erro = 0;
    for (let i = 0; i < A.length; i += 4) {
      for (let ch = 0; ch < 3; ch++) {
        const d = A[i + ch] - Bb[i + ch];
        erro += d * d;
      }
    }
    const eqm = erro / ((A.length / 4) * 3);
    const psnr = eqm === 0 ? Infinity : 10 * Math.log10((255 * 255) / eqm);

    return {
      W,
      H,
      recortou,
      fracaoTransparente: +(fundoNeutro / (W * H)).toFixed(3),
      tinta:
        x1 < 0
          ? null
          : {
              w: x1 - x0 + 1,
              h: y1 - y0 + 1,
              fracaoDaLargura: +((x1 - x0 + 1) / W).toFixed(4),
              fracaoDaAltura: +((y1 - y0 + 1) / H).toFixed(4),
              /* ─── O NÚMERO QUE VAI PARA O APP ────────────────────────
                 O componente põe a arte num quadrado de 200 com
                 `preserveAspectRatio="…meet"`: ela é reduzida até o MAIOR lado
                 caber, e o outro sobra em folga. Então a fração que interessa
                 é a tinta do maior lado sobre o maior lado da ARTE — e não
                 `max(fw, fh)`, que mistura duas escalas diferentes e chega a
                 errar 10 pontos numa arte retangular. */
              fracaoNaCaixa: +(Math.max(x1 - x0 + 1, y1 - y0 + 1) / Math.max(W, H)).toFixed(4),
            },
      psnr: psnr === Infinity ? null : +psnr.toFixed(1),
      webp,
    };
  },
  [uri, QUALIDADE],
);

await navegador.close();

const bytes = Buffer.from(saida.webp, "base64");
writeFileSync(DESTINO, bytes);

const ok = saida.psnr === null || saida.psnr >= PSNR_MINIMO;
console.log(
  JSON.stringify({
    arquivo: DESTINO,
    tamanho: `${saida.W}×${saida.H}`,
    kb: Math.round(bytes.length / 1024),
    alfaRecortado: saida.recortou,
    transparente: saida.recortou ? `${Math.round(saida.fracaoTransparente * 100)}%` : "já tinha",
    tinta: saida.tinta,
    psnr: saida.psnr,
    qualidade: QUALIDADE,
    veredito: ok ? "OK" : `REPROVA — PSNR abaixo de ${PSNR_MINIMO} dB`,
  }),
);
if (!ok) process.exit(1);
