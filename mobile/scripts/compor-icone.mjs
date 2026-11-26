/**
 * O ÍCONE "AURORA" (26/11/2026), composto por código — sem crédito.
 *
 * O dono, olhando o ícone na tela inicial dele: "veja como ele some no meio
 * dos outros [...] será que não colocamos a bolha de maneira mais visualmente
 * forte para dar destaque". Medido no print dele: a Bolha é TRANSPARENTE e
 * pegava o roxo escuro de trás (ficava escura, sem contraste), o fundo escuro
 * se misturava com o papel de parede, e as estrelinhas viravam ruído. Das
 * propostas, ele escolheu a Bolha DE PERTO (enorme, cortada embaixo, "como os
 * personagens que mais aparecem na tela") no roxo com o degradê "Aurora".
 *
 * O que faz ela saltar:
 * - a BASE branca por baixo do vidro: a bolha deixa de ser transparente e
 *   fica clara e colorida sobre qualquer fundo;
 * - o contorno branco grosso, de ADESIVO, que a recorta do fundo;
 * - a cor um pouco mais viva, e nenhuma estrelinha;
 * - o fundo violeta com um véu rosa no alto e um azul embaixo (a aurora).
 *
 * Fonte: `marca/bolha-de-capelo.webp` (o recorte, `recortar-bolha-da-noite.mjs`).
 * Saída: `marca/icone-bolha.webp`, 2048 × 2048, que o `gerar-marca.mjs` usa.
 *
 * Uso, no Mac:
 *   node mobile/scripts/compor-icone.mjs && node mobile/scripts/gerar-marca.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const MARCA = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "marca");
const bolha =
  "data:image/webp;base64," + readFileSync(join(MARCA, "bolha-de-capelo.webp")).toString("base64");

const nav = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const pag = await nav.newPage();
const png = await pag.evaluate(async (src) => {
  const B = await new Promise((ok) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.src = src;
  });
  const L = 2048;
  const canvas = (w) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = w;
    const g = c.getContext("2d");
    g.imageSmoothingQuality = "high";
    return [c, g];
  };

  /* A FIGURA: só o alfa cheio (a luz em volta do recorte fica de fora), e só
     o disco da bolha (centro 1024 × 984, raio 679, medido) e o capelo. */
  const [F, gf] = canvas(B.width);
  gf.drawImage(B, 0, 0);
  {
    const W = B.width;
    const im = gf.getImageData(0, 0, W, W);
    const d = im.data;
    for (let y = 0; y < W; y++)
      for (let x = 0; x < W; x++) {
        const k = (y * W + x) * 4 + 3;
        const noDisco = Math.hypot(x - 1024, y - 984) < 700;
        const noCapelo = x > 0.06 * W && x < 0.56 * W && y > 0.03 * W && y < 0.42 * W;
        d[k] = !noDisco && !noCapelo ? 0 : d[k] > 215 ? 255 : Math.max(0, (d[k] - 175) * 6);
      }
    gf.putImageData(im, 0, 0);
  }
  /* A caixa do que tem tinta. */
  let x0 = L, y0 = L, x1 = 0, y1 = 0;
  {
    const d = gf.getImageData(0, 0, F.width, F.width).data;
    for (let y = 0; y < F.width; y += 2)
      for (let x = 0; x < F.width; x += 2)
        if (d[(y * F.width + x) * 4 + 3] > 128) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
  }
  const silhueta = (cor) => {
    const [c, g] = canvas(F.width);
    g.drawImage(F, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = cor;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  };

  const [c, g] = canvas(L);
  /* O FUNDO "AURORA": o violeta na diagonal, um véu rosa no canto de cima e
     um azul no de baixo. */
  {
    const d = g.createLinearGradient(0, 0, L, L);
    d.addColorStop(0, "#6a2bff");
    d.addColorStop(1, "#3a0fb0");
    g.fillStyle = d;
    g.fillRect(0, 0, L, L);
    for (const [cx, cy, r, cor] of [
      [0.95, 0.05, 0.75, "255,92,200,0.95"],
      [0.0, 1.0, 0.7, "70,200,255,0.8"],
    ]) {
      const v = g.createRadialGradient(cx * L, cy * L, 0, cx * L, cy * L, r * L);
      v.addColorStop(0, `rgba(${cor})`);
      v.addColorStop(1, `rgba(${cor.replace(/[\d.]+$/, "0")})`);
      g.fillStyle = v;
      g.fillRect(0, 0, L, L);
    }
  }

  /* A BOLHA DE PERTO: a caixa dela com 1,18 vez o lado do ícone, o centro um
     pouco à direita e abaixo do meio (o capelo fica no alto à esquerda, e a
     bolha é cortada embaixo e à direita). */
  const alvo = L * 1.18;
  const k = alvo / Math.max(x1 - x0, y1 - y0);
  const dx = L * 0.6 - (x0 + (x1 - x0) / 2) * k;
  const dy = L * 0.66 - (y0 + (y1 - y0) / 2) * k;
  const W = F.width * k;
  const desenha = (img, filtro = "none", ox = 0, oy = 0) => {
    g.save();
    g.filter = filtro;
    g.drawImage(img, dx + ox, dy + oy, W, W);
    g.restore();
  };
  /* A sombra, o adesivo (32 cópias brancas em volta), a base branca e a Bolha. */
  desenha(silhueta("rgba(30,6,80,0.55)"), `blur(${alvo * 0.035}px)`, 0, alvo * 0.035);
  const adesivo = silhueta("#ffffff");
  const r = alvo * 0.016;
  for (let a = 0; a < 32; a++)
    desenha(adesivo, "none", Math.cos((a / 32) * Math.PI * 2) * r, Math.sin((a / 32) * Math.PI * 2) * r);
  desenha(silhueta("rgba(255,255,255,0.9)"));
  desenha(F, "saturate(1.45) contrast(1.08)");
  return c.toDataURL("image/png").split(",")[1];
}, bolha);
await nav.close();

const tmp = mkdtempSync(join(tmpdir(), "icone-"));
writeFileSync(join(tmp, "i.png"), Buffer.from(png, "base64"));
execFileSync("cwebp", ["-quiet", "-q", "94", "-m", "6", join(tmp, "i.png"), "-o", join(MARCA, "icone-bolha.webp")]);
rmSync(tmp, { recursive: true });
console.log("ok marca/icone-bolha.webp (Aurora)");
