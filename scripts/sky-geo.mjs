/**
 * O mapa da tela da home: onde cada elemento cai, em % do herói.
 *
 * Existe porque as partículas de src/components/sky-ambience.tsx são
 * posicionadas em %, e o herói é MAIS ALTO que a janela (~1107px num aparelho
 * de 900) — então "top: 62%" não é 62% da tela, e sim um ponto atrás do cartão
 * de medidas. Foi assim que a névoa do pré-amanhecer se perdeu.
 *
 *   bun run dev --host 127.0.0.1 --port 8080     # noutro terminal
 *   node scripts/sky-geo.mjs 21                  # a hora a inspecionar
 *
 * A saída lista as faixas ocupadas; o que sobra é céu limpo.
 */
// Mapa da tela: onde exatamente cada coisa cai, em px e em % do heroi.
// Sem isso toda posicao de particula e chute — e a calibragem descoberta na
// verificacao (y de tela ~= 1.21 x y configurado) prova que o chute erra.
import { chromium } from "playwright";
const hora = process.argv[2] ?? "21";
const b = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
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
await p.clock.setFixedTime(new Date(`2026-07-25T${hora}:30:00`));
await p.goto("http://127.0.0.1:8080/preview-home", { waitUntil: "networkidle" });
await p.waitForTimeout(2200);
const r = await p.evaluate(() => {
  const hero = document.querySelector(".shine");
  const H = hero.getBoundingClientRect();
  const pct = (c) => ({
    x1: +(((c.left - H.left) / H.width) * 100).toFixed(1),
    x2: +(((c.right - H.left) / H.width) * 100).toFixed(1),
    y1: +(((c.top - H.top) / H.height) * 100).toFixed(1),
    y2: +(((c.bottom - H.top) / H.height) * 100).toFixed(1),
  });
  const out = { hero: { w: H.width, h: H.height, top: H.top }, itens: [] };
  const bebe = document.querySelector('svg[role="img"]');
  if (bebe) {
    const c = bebe.getBoundingClientRect();
    out.itens.push({ o: "BEBÊ (caixa svg)", ...pct(c) });
    out.itens.push({
      o: "BEBÊ (tinta ~)",
      ...pct({
        left: c.left + c.width * 0.22,
        right: c.right - c.width * 0.22,
        top: c.top + c.height * 0.1,
        bottom: c.bottom - c.height * 0.12,
      }),
    });
  }
  // tudo que pinta por cima: textos, pilulas, cartoes de vidro, nav
  const alvos = [...document.querySelectorAll("*")].filter((e) => {
    const s = getComputedStyle(e);
    if (s.visibility === "hidden" || +s.opacity < 0.1) return false;
    const c = e.getBoundingClientRect();
    if (c.width < 8 || c.height < 8 || c.width > H.width * 0.99) return false;
    const temFundo = s.backgroundColor !== "rgba(0, 0, 0, 0)" || s.backdropFilter !== "none";
    const soTexto = e.children.length === 0 && (e.textContent || "").trim().length > 0;
    return temFundo || soTexto;
  });
  alvos.forEach((e) => {
    const c = e.getBoundingClientRect();
    if (c.bottom < H.top || c.top > H.bottom) return;
    const t = (e.textContent || "").trim().slice(0, 22).replace(/\s+/g, " ");
    out.itens.push({ o: t || e.tagName.toLowerCase(), ...pct(c) });
  });
  return out;
});
console.log(`hero ${r.hero.w}x${Math.round(r.hero.h)} (top ${Math.round(r.hero.top)}) — ${hora}h`);
r.itens.forEach((i) =>
  console.log(
    `  y ${String(i.y1).padStart(6)}–${String(i.y2).padEnd(6)}  x ${String(i.x1).padStart(6)}–${String(i.x2).padEnd(6)}  ${i.o}`,
  ),
);
await b.close();
