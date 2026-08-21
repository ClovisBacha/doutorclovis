/**
 * VARREDURA DE ACESSIBILIDADE DAS BANCADAS DA PACIENTE.
 *
 * Mede o que dá para medir sem opinião: contraste, tamanho de alvo, botão de
 * ícone sem nome, e imagem informativa sem `alt`.
 *
 * ⚠️ **DUAS ARMADILHAS DE MEDIÇÃO, e as duas já custaram aqui:**
 *
 *  1. **`oklch` lido por regex.** O projeto escreve cor em `oklch`, e
 *     `getComputedStyle` devolve `oklch(...)`. Um parser de expressão regular lê
 *     0.62/0.19/29 como se fosse RGB — foi assim que seis textos a 1,03:1 foram
 *     "aprovados". Converte-se pelo CANVAS.
 *  2. **Fundo TRANSLÚCIDO.** Ler `backgroundColor` e jogar direto no canvas
 *     compõe a cor sobre o preto transparente do canvas, não sobre o que está
 *     atrás dela — foi assim que vinte links de rodapé a 6,15:1 foram
 *     "reprovados" a 2,30:1. Empilha-se até um fundo opaco e compõe-se de baixo
 *     para cima.
 *
 * Uso: node scripts/acessibilidade.mjs
 */
import { chromium } from "playwright";
import { existsSync } from "node:fs";

const ROTAS = [
  "/preview-home?w=20",
  "/preview-saude?w=20",
  "/preview-jogo?tela=jogos&dia=139",
  "/preview-gratidao?w=20&n=12",
  "/preview-bebe?w=20&dia=0&nome=Helena",
  "/preview-amigas?n=4&premium=1",
  "/preview-instagram",
  "/preview-instagram?tela=novo",
  "/preview-sos",
  "/preview-conta?privacidade=1",
  "/preview-meditacao",
  "/preview-exercicio?w=24",
  "/preview-conquistas?quantas=16",
  "/preview-loja-sementinhas?saldo=118",
  "/preview-presentes?dona=1",
];

const caminho = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const b = await chromium.launch({
  ...(existsSync(caminho) ? { executablePath: caminho } : {}),
  args: ["--no-proxy-server"],
});
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, ignoreHTTPSErrors: true });

const MEDIR = () => {
  const cv = document.createElement("canvas");
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const parse = (cor) => {
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = cor;
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  };
  const sobre = (f, g) => ({
    r: f.r * f.a + g.r * (1 - f.a),
    g: f.g * f.a + g.g * (1 - f.a),
    b: f.b * f.a + g.b * (1 - f.a),
    a: 1,
  });
  const fundoReal = (el) => {
    const pilha = [];
    let n = el;
    while (n) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c.a > 0) pilha.push(c);
      if (c.a >= 1) break;
      n = n.parentElement;
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = pilha.length - 1; i >= 0; i--) base = sobre(pilha[i], base);
    return base;
  };
  const L = (c) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const razao = (a, c) => {
    const x = L(a),
      y = L(c);
    const hi = Math.max(x, y),
      lo = Math.min(x, y);
    return +((hi + 0.05) / (lo + 0.05)).toFixed(2);
  };

  const visivel = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.opacity !== "0";
  };

  const out = { contraste: [], alvo: [], semNome: [], semAlt: [] };

  /* CONTRASTE — só folhas com texto próprio. */
  for (const el of document.querySelectorAll("p,span,a,button,h1,h2,h3,h4,label,li,td,th,div")) {
    const t = (el.textContent || "").trim();
    if (!t || el.children.length > 0 || !visivel(el)) continue;
    const s = getComputedStyle(el);
    const px = parseFloat(s.fontSize);
    const bold = +s.fontWeight >= 700;
    const fg = sobre(parse(s.color), fundoReal(el.parentElement || el));
    const r = razao(fg, fundoReal(el));
    const grande = px >= 24 || (px >= 18.66 && bold);
    if (r < (grande ? 3 : 4.5)) out.contraste.push({ r, px, t: t.slice(0, 40) });
  }

  /* ALVO — controles reais abaixo de 44px nos DOIS lados. */
  for (const el of document.querySelectorAll('button,a[href],[role="button"],input,select')) {
    if (!visivel(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 44 && r.height < 44) {
      out.alvo.push({
        w: Math.round(r.width),
        h: Math.round(r.height),
        t: (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 36),
      });
    }
  }

  /* BOTÃO SÓ COM ÍCONE E SEM NOME. */
  for (const el of document.querySelectorAll('button,a[href],[role="button"]')) {
    if (!visivel(el)) continue;
    const texto = (el.textContent || "").replace(/[\s‍️]/g, "");
    const temNome =
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      el.getAttribute("aria-labelledby");
    /* Emoji conta como "sem nome": leitor de tela lê "coração roxo", não a ação. */
    const soEmoji = texto.length > 0 && !/[a-zA-Z0-9À-ÿ]/.test(texto);
    if (!temNome && (texto.length === 0 || soEmoji)) {
      out.semNome.push({ html: el.outerHTML.slice(0, 90) });
    }
  }

  /* IMAGEM SEM ALT. */
  for (const el of document.querySelectorAll("img")) {
    if (!visivel(el)) continue;
    if (el.getAttribute("alt") === null)
      out.semAlt.push({ src: (el.getAttribute("src") || "").slice(-50) });
  }
  return out;
};

const total = { contraste: 0, alvo: 0, semNome: 0, semAlt: 0 };
for (const rota of ROTAS) {
  const p = await ctx.newPage();
  try {
    await p.goto("http://127.0.0.1:8080" + rota, { waitUntil: "networkidle", timeout: 30000 });
    await p.waitForTimeout(1600);
    const r = await p.evaluate(MEDIR);
    const n = r.contraste.length + r.alvo.length + r.semNome.length + r.semAlt.length;
    if (n) {
      console.log(`\n■ ${rota}`);
      r.contraste
        .slice(0, 4)
        .forEach((x) => console.log(`   contraste ${x.r}:1 (${x.px}px) "${x.t}"`));
      r.alvo.slice(0, 4).forEach((x) => console.log(`   alvo ${x.w}×${x.h} "${x.t}"`));
      r.semNome.slice(0, 3).forEach((x) => console.log(`   sem nome: ${x.html}`));
      r.semAlt.slice(0, 3).forEach((x) => console.log(`   sem alt: …${x.src}`));
    }
    total.contraste += r.contraste.length;
    total.alvo += r.alvo.length;
    total.semNome += r.semNome.length;
    total.semAlt += r.semAlt.length;
  } catch (e) {
    console.log(`\n■ ${rota} — não abriu: ${String(e).slice(0, 80)}`);
  }
  await p.close();
}
await b.close();
console.log(
  `\n${ROTAS.length} telas · contraste ${total.contraste} · alvo ${total.alvo} · sem nome ${total.semNome} · sem alt ${total.semAlt}`,
);
