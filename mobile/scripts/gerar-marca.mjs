/**
 * A MARCA DO APP, gerada das duas fontes (25/11/2026).
 *
 * O dono: "grandes apps têm ícones grandes [...] nosso ícone acabou ficando um
 * pouco pequeno. O ideal seria um bebê bolha somente com um chapéuzinho [...]
 * maior na câmera [...] se inspire em logos famosos de aplicativo". Desde
 * 26/11/2026 o ícone é o "AURORA": a Bolha de capelo de perto, com base
 * branca e contorno de adesivo, sobre o violeta com véus rosa e azul (ele:
 * "veja como ele some no meio dos outros"; ver `compor-icone.mjs`). Guardados
 * para o caso de ele querer voltar: a arte do "Noite A" de 25/11
 * (`arte-noite-a.webp`), o "Viva A" do build 58 (`*-viva.webp`) e o vetor da
 * Bolha saindo do livro (20/11/2026, `icone.svg`).
 *
 * A CADEIA (nunca edite um PNG derivado à mão: mude a fonte e rode tudo):
 *   arte-noite-a.webp → recortar-bolha-da-noite.mjs → bolha-de-capelo.webp
 *   bolha-de-capelo.webp → compor-icone.mjs → icone-bolha.webp
 *   icone-bolha.webp + bolha-de-capelo.webp → este script → os PNGs do app
 * - `assets/marca/icone-bolha.webp`: o ícone inteiro, 2048 × 2048, usado
 *   inteiro (ZOOM 1);
 * - `assets/marca/bolha-de-capelo.webp`: a Bolha recortada, para a abertura e
 *   o Android;
 * - `assets/marca/bolha-de-capelo-viva.webp`: o recorte limpo do Viva A, só
 *   para a silhueta do ícone monocromático do Android.
 *
 * SAÍDAS: `icon.png` (1024, sem alfa: a App Store recusa), `favicon.png`, a
 * `abertura-ios.png` (a splash do iPhone, em tela cheia, no céu da trilha), a
 * `abertura.png` (a do Android), as três camadas do Android e
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

/* O recorte do ícone: o Aurora já é composto no quadrado (`compor-icone.mjs`),
   então entra inteiro. */
const ZOOM = 1;
const CENTRO_Y = 0.5;
/* O fundo do Android: o violeta do ícone Aurora (de cima para baixo). */
const DEGRADE = ["#6a2bff", "#5220d8", "#3a0fb0"];

const nav = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const pag = await nav.newPage();
const saidas = await pag.evaluate(
  async ({ icone, bolha, silhueta, ceu, ZOOM, CENTRO_Y, DEGRADE }) => {
    const carregar = (src) =>
      new Promise((ok, erro) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = erro;
        i.src = src;
      });
    const [ic, bo, si, ce] = await Promise.all([
      carregar(icone),
      carregar(bolha),
      carregar(silhueta),
      carregar(ceu),
    ]);
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
    /* A caixa do que é FIGURA num recorte (alfa acima do limiar): o halo do
       brilho, mais fraco, fica de fora da medida, mas é desenhado inteiro
       (cortá-lo na caixa deixava um retângulo de luz na abertura). */
    const caixaDe = (img, limiar) => {
      const [c, g] = tela(img.width);
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, img.width, img.height).data;
      let x0 = img.width, y0 = img.height, x1 = 0, y1 = 0;
      for (let y = 0; y < img.height; y++)
        for (let x = 0; x < img.width; x++)
          if (d[(y * img.width + x) * 4 + 3] > limiar) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
      return { img, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    };
    const figura = caixaDe(bo, 200);
    const contorno = caixaDe(si, 16);
    /* A figura cabendo numa caixa de `caixa` px no meio de `lado`. */
    const bolhaEm = (f, lado, caixa, branca = false) => {
      const [c, g] = tela(lado);
      const k = caixa / Math.max(f.w, f.h);
      const dx = (lado - f.w * k) / 2 - f.x0 * k;
      const dy = (lado - f.h * k) / 2 - f.y0 * k;
      g.drawImage(f.img, dx, dy, f.img.width * k, f.img.height * k);
      if (branca) {
        g.globalCompositeOperation = "source-in";
        g.fillStyle = "#ffffff";
        g.fillRect(0, 0, lado, lado);
      }
      return png(c);
    };
    /* A ABERTURA DO iPHONE, em tela cheia (25/11/2026, o dono: "esse fundo azul
       ficou muito feio [...] faça o fundo como realmente do ambiente, do mesmo
       fundo que tem na trilha"): o céu da noite da trilha (a mesma arte do
       `CeuVivo`), com a Bolha de capelo no meio, um pouco acima do centro. */
    const aberturaEmTelaCheia = () => {
      const L = 1179;
      const H = Math.round((L * ce.height) / ce.width);
      const c = document.createElement("canvas");
      c.width = L;
      c.height = H;
      const g = c.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(ce, 0, 0, L, H);
      const f = figura;
      const k = (L * 0.6) / Math.max(f.w, f.h);
      const dx = L / 2 - (f.x0 + f.w / 2) * k;
      const dy = H * 0.42 - (f.y0 + f.h / 2) * k;
      g.drawImage(f.img, dx, dy, f.img.width * k, f.img.height * k);
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
      /* A do Android (12+: só um ícone no meio, sobre a cor) e a do iPhone. */
      "abertura.png": bolhaEm(figura, 600, 500),
      "abertura-ios.png": aberturaEmTelaCheia(),
      /* O Android recorta o ícone adaptável em círculo, gota ou quadrado: a
         Bolha fica dentro da zona segura (os 66% do meio). */
      "android-icon-foreground.png": bolhaEm(figura, 512, 300),
      "android-icon-background.png": fundo(512),
      /* O monocromático é só a silhueta (o Android pinta numa cor só): sai do
         recorte limpo do Viva A, a MESMA pose (capelo à esquerda), porque o
         halo do Noite A a deixaria redonda demais. */
      "android-icon-monochrome.png": bolhaEm(contorno, 432, 250, true),
    };
  },
  {
    icone: url(join(A, "marca", "icone-bolha.webp")),
    bolha: url(join(A, "marca", "bolha-de-capelo.webp")),
    silhueta: url(join(A, "marca", "bolha-de-capelo-viva.webp")),
    /* A arte do céu da noite que o app já usa (lida, nunca mudada: é do site). */
    ceu: url(join(MOBILE, "..", "src", "assets", "ceu", "anoitecer.webp")),
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
