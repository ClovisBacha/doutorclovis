#!/usr/bin/env node
/**
 * O QUE TEM DENTRO DE UMA ARTE DE BEBÊ — antes de ela entrar no app.
 *
 *   node scripts/bebes/olhar.mjs <arte.png> [mais.png …]
 *
 * Responde três coisas que decidem se a arte pode ser colada na bolha:
 *
 *  1. **Tem alfa de verdade?** PNG sem canal alfa aparece como um RETÂNGULO
 *     sobre o céu da home. Já aconteceu: `baby-embriao` e `baby-termo` tinham
 *     o branco gravado, e a semana 40 mostrava uma caixa branca em produção.
 *  2. **O fundo é um XADREZ GRAVADO?** Exportador que mostra transparência em
 *     xadrez e salva em RGB grava o xadrez como pixel. É indistinguível de
 *     "arte com fundo quadriculado" a olho nu no editor, e só aparece quando a
 *     imagem cai sobre o app.
 *  3. **Que fração da caixa a TINTA ocupa?** É o número que `baby-illustration`
 *     usa para o bebê não SALTAR de tamanho ao trocar de arte — o salto não é
 *     crescimento, é o enquadramento do arquivo mudando.
 *
 * Chromium decodifica e mede; não há ffmpeg nem sharp neste ambiente.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const ARQUIVOS = process.argv.slice(2);
if (!ARQUIVOS.length) {
  console.error("uso: node scripts/bebes/olhar.mjs <arte.png> [mais.png …]");
  process.exit(1);
}

const navegador = await chromium.launch();
const pagina = await navegador.newPage();

for (const caminho of ARQUIVOS) {
  const uri = `data:image/png;base64,${readFileSync(caminho).toString("base64")}`;
  const r = await pagina.evaluate(async (uri) => {
    const img = new Image();
    img.src = uri;
    await img.decode();
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, W, H).data;

    const em = (x, y) => {
      const i = (y * W + x) * 4;
      return [px[i], px[i + 1], px[i + 2], px[i + 3]];
    };

    /* ─── ALFA DE VERDADE ───────────────────────────────────────────────
       Não basta o cabeçalho dizer RGBA: uma exportação pode trazer o canal e
       preenchê-lo todo com 255. O que interessa é se ALGUM pixel é
       transparente. */
    let transparentes = 0;
    for (let i = 3; i < px.length; i += 4 * 37) if (px[i] < 250) transparentes++;
    const temAlfa = transparentes > 0;

    /* ─── XADREZ GRAVADO ────────────────────────────────────────────────
       O padrão é uma grade de dois cinzas alternando em células quadradas.
       Procuro na faixa de 12px do canto superior esquerdo, que é fundo em
       qualquer enquadramento: se ali há exatamente DOIS tons e eles se
       alternam, é xadrez. Cor chapada dá um tom só. */
    const tons = new Map();
    for (let y = 0; y < Math.min(200, H); y++) {
      for (let x = 0; x < Math.min(200, W); x++) {
        const [r, g2, b, a] = em(x, y);
        if (a < 250) continue;
        const k = `${r},${g2},${b}`;
        tons.set(k, (tons.get(k) ?? 0) + 1);
      }
    }
    const maisComuns = [...tons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    /* O lado da célula sai da primeira troca de tom na linha 0 — serve para
       confirmar que é grade e não ruído. */
    let ladoDaCelula = null;
    if (maisComuns.length >= 2) {
      const primeiro = em(0, 0).slice(0, 3).join(",");
      for (let x = 1; x < Math.min(200, W); x++) {
        if (em(x, 0).slice(0, 3).join(",") !== primeiro) {
          ladoDaCelula = x;
          break;
        }
      }
    }

    /* ─── A TINTA ───────────────────────────────────────────────────────
       Com alfa, tinta é α ≥ 8. Sem alfa, tinta é "diferente do fundo" — e o
       fundo é o tom mais comum do canto (chapado ou xadrez). */
    const fundo = maisComuns.map(([k]) => k.split(",").map(Number));
    const ehFundo = (r, g2, b, a) => {
      if (temAlfa) return a < 8;
      return fundo.some(
        ([fr, fg, fb]) => Math.abs(r - fr) < 14 && Math.abs(g2 - fg) < 14 && Math.abs(b - fb) < 14,
      );
    };
    let x0 = W,
      y0 = H,
      x1 = -1,
      y1 = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const [r, g2, b, a] = em(x, y);
        if (ehFundo(r, g2, b, a)) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }

    return {
      largura: W,
      altura: H,
      temAlfa,
      tonsDoCanto: maisComuns.map(([k, n]) => ({ cor: k, pixels: n })),
      ladoDaCelula,
      tinta:
        x1 < 0
          ? null
          : {
              x: x0,
              y: y0,
              w: x1 - x0 + 1,
              h: y1 - y0 + 1,
              fracaoDaLargura: +((x1 - x0 + 1) / W).toFixed(4),
              fracaoDaAltura: +((y1 - y0 + 1) / H).toFixed(4),
            },
    };
  }, uri);
  console.log(caminho.split("/").pop(), JSON.stringify(r));
}

await navegador.close();
