/**
 * O RECORTE DA BOLHA DO ÍCONE "NOITE A" (25/11/2026).
 *
 * A abertura, o Android e o ícone Aurora (`compor-icone.mjs`) precisam da
 * Bolha de capelo sem o quadrado da arte. A arte é a do Noite A, o ícone de
 * 25/11 (`marca/arte-noite-a.webp`, do Higgsfield).
 * O fundo do ícone é um degradê vertical (`TOPO` → `BASE`, medidos na arte); o
 * alfa de cada pixel é a distância da cor dele até esse degradê:
 * - o que é FIGURA fica inteiro (`forte`): o disco da bolha, medido na arte,
 *   e o que brilha muito mais que o halo (o capelo, a borla, as estrelinhas);
 * - o BRILHO em volta da bolha vira uma luz limpa de pêssego (`LUZ`), na
 *   forma do brilho da arte (`suave`), que some em círculo (`radial`) para
 *   não deixar borda reta na abertura. Desmultiplicado, o brilho da arte saía
 *   um anel marrom sobre o céu da trilha.
 * A figura é desmultiplicada do fundo: o recorte serve sobre fundo escuro (o
 * céu da noite da abertura, o fundo roxo do Android).
 *
 * Uso, no Mac (depois rode `compor-icone.mjs` e `gerar-marca.mjs`):
 *   node mobile/scripts/recortar-bolha-da-noite.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const MARCA = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "marca");
const src = "data:image/webp;base64," + readFileSync(join(MARCA, "arte-noite-a.webp")).toString("base64");

const nav = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const pag = await nav.newPage();
const png = await pag.evaluate(async (src) => {
  const i = new Image();
  await new Promise((ok) => {
    i.onload = ok;
    i.src = src;
  });
  const W = i.width, H = i.height;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  g.drawImage(i, 0, 0);
  const im = g.getImageData(0, 0, W, H), d = im.data;
  const TOPO = [64, 43, 115], BASE = [32, 17, 60];
  /* A luz em volta da Bolha: o pêssego claro do amanhecer, fraca. */
  const LUZ = [255, 206, 196], FORCA_DA_LUZ = 0.42;
  const CX = 1024 / 2048, CY = 984 / 2048, RAIO = 679 / 2048;
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1), B = TOPO.map((v, k) => v + (BASE[k] - v) * t);
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 4;
      const dist = Math.hypot(d[k] - B[0], d[k + 1] - B[1], d[k + 2] - B[2]);
      const r = Math.hypot(x / W - 0.5, y / H - 0.485);
      const radial = Math.max(0, Math.min(1, (0.45 - r) / 0.09));
      /* A FIGURA: o disco da bolha (medido na arte: centro 1024 × 984 e raio
         679, de 2048) e, fora dele, só o que brilha muito mais que o halo (o
         capelo, a borla, as estrelinhas). O halo da arte, logo fora do disco,
         chega a 150 de distância do fundo: um limiar menor o pintava de marrom. */
      const disco = Math.max(0, Math.min(1, (RAIO * W - Math.hypot(x - CX * W, y - CY * H)) / 1.5 + 0.5));
      /* O capelo e a borla são ROSA (o vermelho bem acima do verde, ou quase
         branco), e o halo é um marrom acinzentado (R − G < 60, R < 180):
         na região deles vale a cor, e não a distância — a sombra do capelo
         fica, e o halo, não. */
      const naRegiao = x > 0.06 * W && x < 0.56 * W && y > 0.03 * H && y < 0.42 * H;
      const rosa = naRegiao
        ? Math.max(
            Math.max(0, Math.min(1, (d[k] - d[k + 1] - 62) / 20)),
            Math.max(0, Math.min(1, (d[k] - 228) / 15)),
          )
        : 0;
      const forte = Math.max(disco, rosa, Math.max(0, Math.min(1, (dist - 165) / 40)));
      const suave = Math.max(0, Math.min(1, (dist - 12) / 95)) * radial;
      /* A figura (cor tirada do fundo) por cima de uma LUZ limpa: o brilho da
         arte, desmultiplicado, saía marrom sobre um céu mais claro. */
      const aF = forte, aL = suave * FORCA_DA_LUZ;
      const a = aF + aL * (1 - aF);
      if (a <= 0) {
        d[k + 3] = 0;
        continue;
      }
      for (let j = 0; j < 3; j++) {
        const fig = aF > 0 ? Math.max(0, Math.min(255, (d[k + j] - (1 - aF) * B[j]) / aF)) : 0;
        d[k + j] = Math.round((fig * aF + LUZ[j] * aL * (1 - aF)) / a);
      }
      d[k + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(im, 0, 0);
  return c.toDataURL("image/png").split(",")[1];
}, src);
await nav.close();

const tmp = mkdtempSync(join(tmpdir(), "recorte-"));
writeFileSync(join(tmp, "r.png"), Buffer.from(png, "base64"));
execFileSync("cwebp", ["-quiet", "-q", "92", "-alpha_q", "100", "-m", "6", join(tmp, "r.png"), "-o", join(MARCA, "bolha-de-capelo.webp")]);
rmSync(tmp, { recursive: true });
console.log("ok marca/bolha-de-capelo.webp");
