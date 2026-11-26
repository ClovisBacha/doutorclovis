/**
 * AS MINIATURAS DAS LUZES DO QUARTINHO (26/11/2026): a arte da bandeja (o
 * cartão e a aba) das seis luzes desenhadas por código — sem crédito. No
 * cômodo elas são desenhadas ao vivo (`src/componentes/quartinho/luzes.tsx`);
 * aqui sai só o "retrato" de cada uma, acesa, em 512 × 512 com fundo
 * transparente, em `assets/quartinho/<id>.webp`.
 *
 * Uso, no Mac (usa o Chrome pelo Playwright, como os outros scripts de arte):
 *   node mobile/scripts/gerar-luzes.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const DESTINO = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "quartinho");

const nav = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const pag = await nav.newPage();
const pngs = await pag.evaluate(() => {
  const N = 512;
  const tela = () => {
    const c = document.createElement("canvas");
    c.width = N;
    c.height = N;
    return [c, c.getContext("2d")];
  };
  /* Um brilho redondo (a luz em volta de uma lâmpada). */
  const brilho = (g, x, y, r, cor, forca) => {
    const d = g.createRadialGradient(x, y, 0, x, y, r);
    d.addColorStop(0, cor.replace("A", String(forca)));
    d.addColorStop(0.45, cor.replace("A", String(forca * 0.4)));
    d.addColorStop(1, cor.replace("A", "0"));
    g.fillStyle = d;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  };
  /* Uma lâmpada redonda, com o vidro claro no meio. */
  const lampada = (g, x, y, r, cor) => {
    brilho(g, x, y, r * 3.4, cor.halo, 0.55);
    const d = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    d.addColorStop(0, "#ffffff");
    d.addColorStop(0.5, cor.miolo);
    d.addColorStop(1, cor.borda);
    g.fillStyle = d;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  };
  const CORES = {
    ouro: { miolo: "#ffe39a", borda: "#f2a93b", halo: "rgba(255,206,110,A)" },
    rosa: { miolo: "#ffc4d6", borda: "#ef7fa3", halo: "rgba(255,150,190,A)" },
    lilas: { miolo: "#dccfff", borda: "#9a7cf0", halo: "rgba(190,165,255,A)" },
    menta: { miolo: "#c4f3df", borda: "#5fc79c", halo: "rgba(140,230,190,A)" },
    pessego: { miolo: "#ffd8bd", borda: "#f29a63", halo: "rgba(255,180,130,A)" },
    vermelho: { miolo: "#ffb3b3", borda: "#e85d5d", halo: "rgba(255,130,130,A)" },
    azul: { miolo: "#c4e4ff", borda: "#5aa7ea", halo: "rgba(130,190,255,A)" },
  };
  /* Um arco de fio (a catenária) entre dois pontos, com lâmpadas ao longo. */
  const varal = (g, x0, x1, y, caida, cores, n, r, soquete) => {
    const ponto = (t) => [x0 + (x1 - x0) * t, y + caida * 4 * t * (1 - t)];
    g.strokeStyle = "#6b4f3a";
    g.lineWidth = 5;
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const [x, yy] = ponto(i / 40);
      if (i) g.lineTo(x, yy);
      else g.moveTo(x, yy);
    }
    g.stroke();
    for (let i = 0; i < n; i++) {
      const [x, yy] = ponto((i + 0.5) / n);
      if (soquete) {
        g.fillStyle = "#5a4636";
        g.fillRect(x - r * 0.45, yy, r * 0.9, r * 0.7);
      }
      lampada(g, x, yy + r * (soquete ? 1.5 : 0.2), r, CORES[cores[i % cores.length]]);
    }
  };
  const png = (c) => c.toDataURL("image/png").split(",")[1];
  const saidas = {};

  /* O varal de luzinhas: dois arcos, lâmpadas pastel. */
  {
    const [c, g] = tela();
    varal(g, 30, 256, 170, 120, ["ouro", "rosa", "lilas", "menta", "pessego"], 5, 22, true);
    varal(g, 256, 482, 170, 120, ["menta", "pessego", "ouro", "rosa", "lilas"], 5, 22, true);
    saidas.varal = png(c);
  }
  /* O neon de lua: a lua crescente em tubo rosa, com uma estrelinha. */
  {
    const [c, g] = tela();
    brilho(g, 256, 256, 250, "rgba(255,120,200,A)", 0.35);
    const lua = new Path2D();
    lua.arc(250, 260, 150, Math.PI * 0.32, Math.PI * 1.68, false);
    lua.arc(300, 230, 120, Math.PI * 1.55, Math.PI * 0.45, true);
    lua.closePath();
    for (const [w, cor] of [
      [34, "rgba(255,110,190,0.25)"],
      [22, "rgba(255,130,200,0.55)"],
      [12, "#ff8fd0"],
      [6, "#ffe6f4"],
    ]) {
      g.strokeStyle = cor;
      g.lineWidth = w;
      g.lineJoin = "round";
      g.stroke(lua);
    }
    const estrela = new Path2D();
    const [sx, sy, sr] = [395, 150, 38];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? sr * 0.45 : sr;
      const p = [sx + Math.cos(a) * rr, sy + Math.sin(a) * rr];
      if (i) estrela.lineTo(...p);
      else estrela.moveTo(...p);
    }
    estrela.closePath();
    for (const [w, cor] of [
      [18, "rgba(255,200,120,0.4)"],
      [8, "#ffd27a"],
      [3, "#fff6dc"],
    ]) {
      g.strokeStyle = cor;
      g.lineWidth = w;
      g.stroke(estrela);
    }
    saidas["neon-lua"] = png(c);
  }
  /* O projetor de estrelas: a cúpula lilás com estrelas vazadas, acesa. */
  {
    const [c, g] = tela();
    brilho(g, 256, 250, 240, "rgba(170,150,255,A)", 0.45);
    for (const [x, y, r] of [
      [90, 90, 10],
      [420, 70, 8],
      [440, 200, 6],
      [70, 230, 7],
      [180, 40, 6],
      [330, 30, 9],
    ])
      brilho(g, x, y, r * 3, "rgba(255,240,200,A)", 0.9);
    /* A base. */
    const b = g.createLinearGradient(0, 360, 0, 430);
    b.addColorStop(0, "#f3ecff");
    b.addColorStop(1, "#b9a8e6");
    g.fillStyle = b;
    g.beginPath();
    g.ellipse(256, 395, 150, 38, 0, 0, Math.PI * 2);
    g.fill();
    /* A cúpula. */
    const d = g.createRadialGradient(215, 220, 20, 256, 290, 160);
    d.addColorStop(0, "#efe6ff");
    d.addColorStop(0.55, "#b7a1f5");
    d.addColorStop(1, "#7f62d6");
    g.fillStyle = d;
    g.beginPath();
    g.arc(256, 380, 135, Math.PI, 0);
    g.closePath();
    g.fill();
    for (const [x, y, r] of [
      [210, 320, 16],
      [290, 300, 12],
      [255, 270, 10],
      [320, 350, 10],
      [185, 365, 9],
    ]) {
      brilho(g, x, y, r * 2.4, "rgba(255,236,170,A)", 0.9);
      g.fillStyle = "#fff4c8";
      g.beginPath();
      g.arc(x, y, r * 0.55, 0, Math.PI * 2);
      g.fill();
    }
    saidas.projetor = png(c);
  }
  /* O pisca-pisca: dois arcos de lâmpadas coloridas. */
  {
    const [c, g] = tela();
    varal(g, 30, 256, 190, 110, ["vermelho", "ouro", "menta", "azul", "rosa"], 6, 17, false);
    varal(g, 256, 482, 190, 110, ["azul", "rosa", "vermelho", "ouro", "menta"], 6, 17, false);
    saidas["pisca-pisca"] = png(c);
  }
  /* A fita de LED: a régua de luz e a luz que cai dela. */
  {
    const [c, g] = tela();
    const cai = g.createLinearGradient(0, 230, 0, 470);
    cai.addColorStop(0, "rgba(255,210,140,0.75)");
    cai.addColorStop(1, "rgba(255,210,140,0)");
    g.fillStyle = cai;
    g.beginPath();
    g.moveTo(40, 236);
    g.lineTo(472, 236);
    g.lineTo(500, 470);
    g.lineTo(12, 470);
    g.closePath();
    g.fill();
    g.fillStyle = "#d9a86c";
    g.fillRect(30, 200, 452, 30);
    const fita = g.createLinearGradient(0, 226, 0, 244);
    fita.addColorStop(0, "#fff7e2");
    fita.addColorStop(1, "#ffcf8a");
    g.fillStyle = fita;
    g.fillRect(40, 228, 432, 14);
    for (let x = 52; x < 470; x += 34) brilho(g, x, 236, 22, "rgba(255,240,200,A)", 0.9);
    saidas["fita-led"] = png(c);
  }
  /* Os pendentes de vidro: dois globos acesos nos fios. */
  {
    const [c, g] = tela();
    for (const [x, y] of [
      [165, 330],
      [350, 290],
    ]) {
      g.strokeStyle = "#4a3a2e";
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, y - 82);
      g.stroke();
      const latao = g.createLinearGradient(x - 22, 0, x + 22, 0);
      latao.addColorStop(0, "#a87d3e");
      latao.addColorStop(0.5, "#f0cf8a");
      latao.addColorStop(1, "#a87d3e");
      g.fillStyle = latao;
      g.beginPath();
      g.moveTo(x - 14, y - 86);
      g.lineTo(x + 14, y - 86);
      g.lineTo(x + 24, y - 62);
      g.lineTo(x - 24, y - 62);
      g.closePath();
      g.fill();
      brilho(g, x, y, 150, "rgba(255,196,120,A)", 0.5);
      const v = g.createRadialGradient(x - 18, y - 22, 6, x, y, 72);
      v.addColorStop(0, "#ffffff");
      v.addColorStop(0.45, "#fff0cf");
      v.addColorStop(1, "#ffbe6e");
      g.fillStyle = v;
      g.beginPath();
      g.arc(x, y, 72, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.75)";
      g.beginPath();
      g.ellipse(x - 30, y - 28, 14, 22, -0.6, 0, Math.PI * 2);
      g.fill();
    }
    saidas.pendentes = png(c);
  }
  return saidas;
});
await nav.close();

const tmp = mkdtempSync(join(tmpdir(), "luzes-"));
for (const [id, b64] of Object.entries(pngs)) {
  const p = join(tmp, `${id}.png`);
  writeFileSync(p, Buffer.from(b64, "base64"));
  execFileSync("cwebp", ["-quiet", "-q", "90", "-alpha_q", "100", "-m", "6", p, "-o", join(DESTINO, `${id}.webp`)]);
  console.log("ok", `quartinho/${id}.webp`);
}
rmSync(tmp, { recursive: true });
