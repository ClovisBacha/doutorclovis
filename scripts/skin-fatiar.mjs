import { chromium } from "/home/user/doutorclovis/node_modules/playwright/index.mjs";
import { writeFileSync } from "node:fs";
const B = "/tmp/claude-0/-home-user-doutorclovis/21574d88-055c-5fb9-a5a7-8e7e168fb333/scratchpad";
const nome = process.argv[2];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await b.newContext()).newPage();
await p.goto("http://127.0.0.1:8099/prova.html");
const saidas = await p.evaluate(async (arq) => {
  const img = new Image();
  img.src = `http://127.0.0.1:8099/skins/${arq}.png`;
  await img.decode();
  const W = img.naturalWidth,
    H = img.naturalHeight,
    terco = Math.floor(W / 3);
  const out = [];
  for (let i = 0; i < 3; i++) {
    const c = document.createElement("canvas");
    c.width = terco - 26;
    c.height = H;
    const g = c.getContext("2d");
    g.drawImage(img, i * terco + 13, 0, c.width, H, 0, 0, c.width, H);
    const im = g.getImageData(0, 0, c.width, c.height);
    const d = im.data,
      w = c.width,
      h = c.height;
    /* FUNDO = o que se alcança a partir da borda sem cruzar contorno.
       Um teste "é claro? então some" abriria buracos nos brilhos do vidro,
       que também são quase brancos. Vindo da borda, o interior fica salvo. */
    const fundo = new Uint8Array(w * h);
    const fila = [];
    const claro = (k) => d[k] > 232 && d[k + 1] > 232 && d[k + 2] > 232;
    for (let x = 0; x < w; x++) {
      fila.push(x);
      fila.push((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      fila.push(y * w);
      fila.push(y * w + w - 1);
    }
    while (fila.length) {
      const i2 = fila.pop();
      if (fundo[i2]) continue;
      if (!claro(i2 * 4)) continue;
      fundo[i2] = 1;
      const x = i2 % w,
        y = (i2 - x) / w;
      if (x > 0) fila.push(i2 - 1);
      if (x < w - 1) fila.push(i2 + 1);
      if (y > 0) fila.push(i2 - w);
      if (y < h - 1) fila.push(i2 + w);
    }
    // caixa do objeto + alfa
    let x0 = w,
      y0 = h,
      x1 = 0,
      y1 = 0;
    for (let i2 = 0; i2 < w * h; i2++) {
      if (fundo[i2]) {
        d[i2 * 4 + 3] = 0;
        continue;
      }
      const x = i2 % w,
        y = (i2 - x) / w;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    g.putImageData(im, 0, 0);
    // quadrado com margem, sem estourar a tela
    const m = 12;
    const lado = Math.max(x1 - x0, y1 - y0) + m * 2;
    const cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2;
    const q = document.createElement("canvas");
    q.width = 192;
    q.height = 192;
    q.getContext("2d").drawImage(c, cx - lado / 2, cy - lado / 2, lado, lado, 0, 0, 192, 192);
    out.push(q.toDataURL("image/webp", 0.92));
  }
  return out;
}, nome);
["futuro", "atual", "feito"].forEach((e, i) =>
  writeFileSync(`${B}/skins/${nome}-${e}.webp`, Buffer.from(saidas[i].split(",")[1], "base64")),
);
console.log("pronto:", nome);
await b.close();
