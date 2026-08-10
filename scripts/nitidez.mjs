/**
 * AUDITORIA DE NITIDEZ: toda imagem que a tela AMPLIA.
 *
 * A conta é uma só: `pixels reais = largura CSS × densidade da tela`. Se o
 * arquivo tem menos que isso, o navegador inventa pixel — e o resultado é o
 * borrão. Num iPhone a densidade é 3.
 *
 * ─── POR QUE ISTO VIROU SCRIPT ──────────────────────────────────────────────
 *
 * O mesmo defeito aconteceu DUAS VEZES em agosto de 2026, em telas diferentes,
 * e nenhuma das duas foi notada por quem exportou a arte:
 *
 *   mascote   arte de 320px  desenhada em 894  → esticada 2,76×
 *   céus      arte de 853px  desenhados em 1383 → esticados 1,62×
 *
 * O motivo de escapar é sempre o mesmo: no computador de quem desenvolve a
 * densidade é 1 ou 2, e o defeito só aparece em 3. Não dá para confiar no
 * olho — é preciso comparar dois números.
 *
 * ─── COMO RODAR ─────────────────────────────────────────────────────────────
 *
 *   bun run dev --host 127.0.0.1 --port 8080     # noutro terminal
 *   node scripts/nitidez.mjs
 *
 * Toda linha marcada com ← AMPLIA é uma imagem que vai sair borrada no
 * celular. O corte é 1,15: abaixo disso o olho não separa.
 */
import { chromium } from "playwright";

const DPR = 3;
const PAGINAS = [
  ["home · dia", "/preview-home?w=20", 12],
  ["home · anoitecer", "/preview-home?w=20", 21],
  ["folha do dia", "/preview-jogo?tela=jogos&feitos=0", 12],
  ["trilha", "/preview-jogo", 12],
];

const n = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const linhas = [];
for (const [rotulo, url, hora] of PAGINAS) {
  const c = await n.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: DPR,
    timezoneId: "America/Sao_Paulo",
  });
  const p = await c.newPage();
  await p.clock.setFixedTime(new Date(`2026-08-10T${String(hora).padStart(2, "0")}:00:00-03:00`));
  await p.goto("http://127.0.0.1:8080" + url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(6500);
  const imgs = await p.evaluate((d) => {
    return [...document.querySelectorAll("img")]
      .map((i) => {
        const r = i.getBoundingClientRect();
        if (r.width < 24 || !i.naturalWidth) return null;
        return {
          arq: (i.currentSrc || i.src).split("/").pop().split("?")[0],
          natural: i.naturalWidth,
          precisa: Math.round(r.width * d),
          fator: +((r.width * d) / i.naturalWidth).toFixed(2),
        };
      })
      .filter(Boolean);
  }, DPR);
  for (const i of imgs) linhas.push({ tela: rotulo, ...i });
  await c.close();
}
await n.close();

const vistos = new Map();
for (const l of linhas) {
  const k = l.arq + "|" + l.precisa;
  if (!vistos.has(k)) vistos.set(k, l);
}
const todas = [...vistos.values()].sort((a, b) => b.fator - a.fator);
console.log(
  "arquivo".padEnd(34),
  "tem".padStart(6),
  "precisa".padStart(8),
  "fator".padStart(7),
  " ",
);
for (const l of todas) {
  console.log(
    l.arq.slice(0, 33).padEnd(34),
    String(l.natural).padStart(6),
    String(l.precisa).padStart(8),
    String(l.fator).padStart(7),
    l.fator > 1.15 ? "  ← AMPLIA" : "  ok",
  );
}
