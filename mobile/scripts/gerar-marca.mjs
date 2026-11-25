/**
 * A MARCA DO APP, gerada das duas fontes (25/11/2026).
 *
 * O dono: "grandes apps têm ícones grandes [...] nosso ícone acabou ficando um
 * pouco pequeno. O ideal seria um bebê bolha somente com um chapéuzinho [...]
 * maior na câmera [...] se inspire em logos famosos de aplicativo". O ícone
 * passou a ser a Bolha de capelo DE PERTO, enchendo o quadrado, sobre o degradê
 * framboesa e pêssego (o "Amanhecer" do app) — arte do Higgsfield, e não mais
 * o vetor da Bolha saindo do livro (20/11/2026, `icone.svg`, guardado para o
 * caso de ele querer voltar).
 *
 * FONTES (nunca edite um PNG derivado à mão: mude a fonte e rode isto):
 * - `assets/marca/icone-bolha.webp`: o ícone inteiro, 2048 × 2048;
 * - `assets/marca/bolha-de-capelo.webp`: a mesma Bolha recortada (fundo
 *   transparente), para a abertura e o Android.
 *
 * SAÍDAS: `icon.png` (1024, sem alfa: a App Store recusa), `favicon.png`, a
 * `abertura.png` (a splash), as três camadas do Android e
 * `marca/instagram-perfil.png`.
 *
 * Uso, no Mac (usa o Chrome pelo Playwright, como os outros scripts de arte):
 *   node mobile/scripts/gerar-marca.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const MOBILE = join(dirname(fileURLToPath(import.meta.url)), "..");
const A = join(MOBILE, "assets");
const url = (p) => "data:image/webp;base64," + readFileSync(p).toString("base64");

/* O recorte do ícone: um pouco mais perto que a arte (1,06), com o centro um
   pouco acima do meio, para o capelo não encostar na borda nem no canto
   arredondado que o iOS recorta. */
const ZOOM = 1.06;
const CENTRO_Y = 966 / 2048;
/* O fundo do Android: o mesmo degradê do ícone (medido na arte, de cima para baixo). */
const DEGRADE = ["#ff9477", "#f76677", "#e8306e"];

const nav = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const pag = await nav.newPage();
const saidas = await pag.evaluate(
  async ({ icone, bolha, ZOOM, CENTRO_Y, DEGRADE }) => {
    const carregar = (src) =>
      new Promise((ok, erro) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = erro;
        i.src = src;
      });
    const [ic, bo] = await Promise.all([carregar(icone), carregar(bolha)]);
    const tela = (lado) => {
      const c = document.createElement("canvas");
      c.width = lado;
      c.height = lado;
      const g = c.getContext("2d");
      g.imageSmoothingQuality = "high";
      return [c, g];
    };
    const png = (c) => c.toDataURL("image/png").split(",")[1];
    /* O ícone, de perto. */
    const iconeEm = (lado) => {
      const [c, g] = tela(lado);
      const s = ic.width / ZOOM;
      const sy = Math.max(0, Math.min(ic.height - s, ic.height * CENTRO_Y - s / 2));
      g.drawImage(ic, (ic.width - s) / 2, sy, s, s, 0, 0, lado, lado);
      return png(c);
    };
    /* A caixa da Bolha recortada (o que tem tinta). */
    const [cb, gb] = tela(bo.width);
    gb.drawImage(bo, 0, 0);
    const d = gb.getImageData(0, 0, bo.width, bo.height).data;
    let x0 = bo.width, y0 = bo.height, x1 = 0, y1 = 0;
    for (let y = 0; y < bo.height; y++)
      for (let x = 0; x < bo.width; x++)
        if (d[(y * bo.width + x) * 4 + 3] > 16) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    /* A Bolha recortada, cabendo numa caixa de `caixa` px no meio de `lado`. */
    const bolhaEm = (lado, caixa, branca = false) => {
      const [c, g] = tela(lado);
      const k = caixa / Math.max(bw, bh);
      const w = bw * k, h = bh * k;
      g.drawImage(cb, x0, y0, bw, bh, (lado - w) / 2, (lado - h) / 2, w, h);
      if (branca) {
        g.globalCompositeOperation = "source-in";
        g.fillStyle = "#ffffff";
        g.fillRect(0, 0, lado, lado);
      }
      return png(c);
    };
    const fundo = (lado) => {
      const [c, g] = tela(lado);
      const l = g.createLinearGradient(0, 0, 0, lado);
      l.addColorStop(0, DEGRADE[0]);
      l.addColorStop(0.5, DEGRADE[1]);
      l.addColorStop(1, DEGRADE[2]);
      g.fillStyle = l;
      g.fillRect(0, 0, lado, lado);
      return png(c);
    };
    return {
      "icon-rgba.png": iconeEm(1024),
      "favicon.png": iconeEm(48),
      "marca/instagram-perfil.png": iconeEm(1080),
      "abertura.png": bolhaEm(600, 560),
      /* O Android recorta o ícone adaptável em círculo, gota ou quadrado: a
         Bolha fica dentro da zona segura (os 66% do meio). */
      "android-icon-foreground.png": bolhaEm(512, 330),
      "android-icon-background.png": fundo(512),
      "android-icon-monochrome.png": bolhaEm(432, 280, true),
    };
  },
  {
    icone: url(join(A, "marca", "icone-bolha.webp")),
    bolha: url(join(A, "marca", "bolha-de-capelo.webp")),
    ZOOM,
    CENTRO_Y,
    DEGRADE,
  },
);
await nav.close();

for (const [nome, b64] of Object.entries(saidas)) {
  writeFileSync(join(A, nome), Buffer.from(b64, "base64"));
  console.log("ok", nome);
}
/* A App Store recusa ícone com canal alfa (ITMS-90717), mesmo opaco. */
execFileSync("python3", [
  join(MOBILE, "scripts", "png-sem-alfa.py"),
  join(A, "icon-rgba.png"),
  join(A, "icon.png"),
  DEGRADE[1].slice(1),
]);
execFileSync("rm", [join(A, "icon-rgba.png")]);
console.log("ok icon.png (sem alfa)");
