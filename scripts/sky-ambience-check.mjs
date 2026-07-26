/**
 * Prova de que o ambiente do céu (src/components/sky-ambience.tsx) cai onde
 * deve, em cada faixa de hora. Print não basta: um efeito pode renderizar
 * perfeitamente e ainda assim estar atrás de um cartão, ou por cima do bebê.
 * Aqui a régua é geométrica.
 *
 * Para cada cena o script congela as animações no pico e mede:
 *   na moldura   pelo menos um elemento visível dentro do herói
 *   sobre o bebê nenhuma partícula sobre a TINTA dele (tem que dar 0)
 *   coberto      nenhuma partícula inteiramente escondida por um cartão
 *
 *   bun run dev --host 127.0.0.1 --port 8080     # noutro terminal
 *   node scripts/sky-ambience-check.mjs
 *
 * O mapa das zonas livres da tela sai de scripts/sky-geo.mjs — é ele que diz
 * onde há céu limpo. Rode os dois antes de mexer numa coordenada.
 */
import { chromium } from "playwright";
const OUT = process.env.SKY_OUT ?? "/tmp/sky-ambience";
// [hora, nome, instante do ciclo (ms) em que a cena está no pico]
const PADRAO = [
  [2, "madrugada", 59650],
  [5, "pre-amanhecer", 16500],
  [7, "amanhecer", 23000],
  [9, "manha", 10000],
  [12, "meio-dia", 1080],
  [15, "tarde", 70000],
  [17, "golden-hour", 4750],
  [18, "entardecer", 72000],
  [20, "anoitecer", 7000],
  [22, "noite", 3080],
];
const CENAS = process.argv[2] ? JSON.parse(process.argv[2]) : PADRAO;
let falhas = 0;
// PLAYWRIGHT_CHROMIUM aponta para um binário já instalado; sem ela o
// Playwright usa o navegador que ele mesmo baixou.
const b = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
await import("node:fs").then((fs) => fs.mkdirSync(OUT, { recursive: true }));
for (const [hora, nome, seek] of CENAS) {
  const ctx = await b.newContext({
    viewport: { width: 430, height: 900 },
    deviceScaleFactor: 2,
    geolocation: { latitude: -19.9, longitude: -43.9 },
    permissions: ["geolocation"],
  });
  const p = await ctx.newPage();
  await p.route("**/api.open-meteo.com/**", (r) =>
    r.fulfill({ json: { current: { temperature_2m: 20, weather_code: 0 } } }),
  );
  await p.clock.setFixedTime(new Date(`2026-07-25T${String(hora).padStart(2, "0")}:30:00`));
  await p.goto("http://127.0.0.1:8080/preview-home", { waitUntil: "networkidle" });
  await p.waitForTimeout(2200);
  const r = await p.evaluate((seek) => {
    const CLS = [
      "dc-shooting-star",
      "dc-shooting-star-l",
      "dc-mist",
      "dc-star-wake",
      "dc-star-fade",
      "dc-satellite",
      "dc-firefly",
      "dc-bird",
      "dc-seed",
      "dc-ray",
      "dc-glint",
      "dc-aviao",
      "dc-mote",
      "dc-flock",
    ];
    const els = [...document.querySelectorAll("*")].filter((e) =>
      CLS.some((c) => e.classList?.contains(c)),
    );
    // congela cada animação no pico e mede
    document.getAnimations().forEach((a) => {
      const el = a.effect?.target;
      if (el && CLS.some((c) => el.classList?.contains(c))) {
        a.currentTime = seek;
        a.pause();
      }
    });
    const hero = document.querySelector(".shine")?.getBoundingClientRect();
    const bebe = document.querySelector('svg[role="img"]')?.getBoundingClientRect();
    let foraDoHeroi = 0,
      sobreOBebe = 0;
    // So conta o que esta VISIVEL: um passaro no inicio da travessia esta em
    // -8vw com opacidade 0, recortado pelo overflow-hidden. Nao e defeito.
    const visiveis = els.filter((e) => {
      let op = 1,
        n = e;
      while (n && n !== document.body) {
        op *= parseFloat(getComputedStyle(n).opacity || "1");
        n = n.parentElement;
      }
      return op > 0.05;
    });
    const caixas = visiveis.map((e) => e.getBoundingClientRect());
    // `overflow-hidden` no heroi garante que nada ESCAPA visualmente; um
    // elemento a meio caminho da entrada fica recortado, e isso e normal. O
    // que importa e ter pelo menos um elemento visivel DENTRO da moldura.
    let dentroEVisivel = 0;
    caixas.forEach((c) => {
      if (
        hero &&
        c.right > hero.left &&
        c.left < hero.right &&
        c.bottom > hero.top &&
        c.top < hero.bottom
      )
        dentroEVisivel++;
      if (bebe) {
        // A caixa do SVG inclui margem transparente larga (a escala 1.43 a
        // amplia): medir contra ela reprovaria estrelas que estao em ceu
        // limpo. O recorte abaixo aproxima a TINTA do bebe.
        const tinta = {
          left: bebe.left + bebe.width * 0.22,
          right: bebe.right - bebe.width * 0.22,
          top: bebe.top + bebe.height * 0.1,
          bottom: bebe.bottom - bebe.height * 0.12,
        };
        const ox = Math.min(c.right, tinta.right) - Math.max(c.left, tinta.left);
        const oy = Math.min(c.bottom, tinta.bottom) - Math.max(c.top, tinta.top);
        if (ox > 2 && oy > 2) sobreOBebe++;
      }
    });
    let cobertoPorCartao = 0;
    const cartoes = [...document.querySelectorAll("div[style]")]
      .filter((d) => (d.style.backdropFilter || "").includes("blur(22px)"))
      .map((d) => d.getBoundingClientRect());
    caixas.forEach((c) => {
      // COMPLETAMENTE coberto. Uma faixa larga (a nevoa) cruza cartoes mas
      // segue visivel nas laterais — isso nao e defeito. Sumir por inteiro e.
      if (
        cartoes.some(
          (k) =>
            c.left >= k.left - 1 &&
            c.right <= k.right + 1 &&
            c.top >= k.top - 1 &&
            c.bottom <= k.bottom + 1,
        )
      )
        cobertoPorCartao++;
    });
    return {
      elementos: els.length,
      visiveis: visiveis.length,
      dentroEVisivel,
      foraDoHeroi,
      sobreOBebe,
      cobertoPorCartao,
    };
  }, seek);
  console.log(
    String(hora).padStart(2, "0") +
      "h " +
      nome.padEnd(15) +
      " elementos:" +
      String(r.elementos).padStart(2) +
      " visíveis:" +
      String(r.visiveis).padStart(2) +
      "  na moldura:" +
      r.dentroEVisivel +
      "  sobre o bebê:" +
      r.sobreOBebe +
      "  coberto:" +
      r.cobertoPorCartao +
      (r.dentroEVisivel < 1 || r.sobreOBebe || r.cobertoPorCartao ? "   << FALHA" : "   ok"),
  );
  if (r.dentroEVisivel < 1 || r.sobreOBebe || r.cobertoPorCartao) falhas++;
  await p.screenshot({ path: `${OUT}/${nome}.png` });
  await ctx.close();
}
await b.close();
console.log(falhas ? `\n${falhas} cena(s) reprovada(s)` : "\ntodas as cenas ok");
process.exit(falhas ? 1 : 0);
