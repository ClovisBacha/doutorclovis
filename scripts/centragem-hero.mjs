/**
 * CENTRAGEM ÓPTICA MEDIDA NA FONTE, não na foto.
 *
 * Ler a tinta pela captura de tela depende do limiar de cobertura e o fundo
 * (a cena) muda de céu para céu — no rótulo pequeno isso dava até 6px de
 * variação para o MESMO texto. `measureText` devolve a caixa de tinta real do
 * glifo, e não depende de fundo nenhum.
 */
import { chromium } from "playwright";

const n = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const c = await n.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
const p = await c.newPage();
await p.goto("http://127.0.0.1:8080/preview-home?w=20", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await p.waitForTimeout(5500);

for (const semana of [1, 8, 20, 40]) {
  const r = await p.evaluate((sem) => {
    const ps = [...document.querySelectorAll("p")];
    const num = ps.find(
      (e) => /^\d+$/.test(e.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) > 40,
    );
    const lab = ps.find((e) => /^semanas?$/.test(e.textContent.trim()));
    const medir = (el, txt) => {
      const s = getComputedStyle(el);
      const cv = document.createElement("canvas");
      const g = cv.getContext("2d");
      g.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      if ("letterSpacing" in g) g.letterSpacing = s.letterSpacing;
      const m = g.measureText(txt);
      const tintaEsq = -m.actualBoundingBoxLeft;
      const tintaDir = m.actualBoundingBoxRight;
      const centroTinta = (tintaEsq + tintaDir) / 2;
      const centroCaixa = m.width / 2;
      const indent = parseFloat(s.textIndent) || 0;
      return {
        avanco: +m.width.toFixed(2),
        // quanto a tinta está deslocada dentro da caixa que o flex centra
        desvio: +(centroTinta - centroCaixa + indent).toFixed(2),
      };
    };
    return { num: medir(num, String(sem)), lab: medir(lab, sem === 1 ? "semana" : "semanas") };
  }, semana);
  console.log(
    "semana",
    String(semana).padStart(2),
    "| número desvio",
    String(r.num.desvio).padStart(6),
    "px | rótulo desvio",
    String(r.lab.desvio).padStart(6),
    "px | desencontro",
    (r.num.desvio - r.lab.desvio).toFixed(2),
  );
}
await n.close();
