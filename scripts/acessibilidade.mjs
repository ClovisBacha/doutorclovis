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
  /* ⚠️ AS CINCO TELAS DO CORAÇÃO entraram aqui em set/2026, e não antes porque
     não eram fotografáveis: sem bancada, esta varredura não tinha como abri-las.
     Foi assim que o 👍👎 da nutrição passou meses com alvo de 16×18px. */
  "/preview-saude-registros?estado=normal",
  "/preview-chutes?estado=contando",
  "/preview-contracoes?estado=parto",
  "/preview-nutricao?estado=conversa",
  "/preview-saude-mulher?tela=ciclo",
  "/preview-saude-mulher?tela=preventivos",
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
  /* ⚠️ **TERCEIRA ARMADILHA, e esta REPROVA O CERTO.** As duas anteriores estão
     no cabeçalho: o `oklch` lido por regex (aprovou seis textos a 1,03:1) e o
     fundo translúcido não composto (reprovou vinte links a 2,30:1). Esta é o
     `background-image`: um botão que pinta com gradiente tem
     `background-color: transparent`, então a pilha sobe até o creme da página e
     um texto BRANCO sobre um gradiente rosa escuro "mede" 1,01:1.
     Medido no contador de chutes (`.liquid-pulse`, radial-gradient) e no botão
     de contração.
     Não dá para compor um gradiente a partir do CSS computado — então o
     honesto é dizer que o método NÃO ALCANÇA aquele texto, e listá-lo à parte.
     Um número inventado ali faria alguém "consertar" um texto que está certo. */
  const fundoReal = (el) => {
    const pilha = [];
    let n = el;
    let pintadoPorImagem = false;
    while (n) {
      const st = getComputedStyle(n);
      if (st.backgroundImage && st.backgroundImage !== "none") pintadoPorImagem = true;
      const c = parse(st.backgroundColor);
      if (c.a > 0) pilha.push(c);
      if (c.a >= 1) break;
      n = n.parentElement;
    }
    if (pintadoPorImagem) return null;
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

  const out = { contraste: [], alvo: [], semNome: [], semAlt: [], naoMedivel: [] };

  /* CONTRASTE — só folhas com texto próprio. */
  for (const el of document.querySelectorAll("p,span,a,button,h1,h2,h3,h4,label,li,td,th,div")) {
    const t = (el.textContent || "").trim();
    if (!t || el.children.length > 0 || !visivel(el)) continue;
    const s = getComputedStyle(el);
    const px = parseFloat(s.fontSize);
    const bold = +s.fontWeight >= 700;
    const fundo = fundoReal(el);
    /* ⚠️ Pintado por gradiente: o método não alcança. Vai para a lista de
       "olhe com o olho", NUNCA para a de reprovados — um número inventado ali
       faria alguém consertar um texto que está certo. */
    if (!fundo) {
      /* ⚠️ **E AGORA O MÉTODO ALCANÇA — pela FOTO, não pelo CSS.** A prosa
         acima continua verdadeira sobre o CSS computado: não dá para compor um
         gradiente a partir dele. O que dá é MEDIR O PIXEL, e é o que a segunda
         passada faz — ver `porMascaraDeGlifo` no fim deste arquivo.

         Aqui o elemento só é MARCADO e vai com a caixa e a cor do texto. Sem
         isto, todo botão primário do app (os que pintam com gradiente, que são
         justamente os CTAs) ficava fora da medição: 456 textos numa varredura
         de 21 telas. */
      const cx2 = el.getBoundingClientRect();
      el.setAttribute("data-a11y", String(out.naoMedivel.length));
      out.naoMedivel.push({
        i: out.naoMedivel.length,
        px,
        grande: px >= 24 || (px >= 18.66 && bold),
        t: t.slice(0, 40),
        frente: (() => {
          const c = parse(s.color);
          return [Math.round(c.r), Math.round(c.g), Math.round(c.b)];
        })(),
        caixa: [
          Math.round(cx2.x + window.scrollX),
          Math.round(cx2.y + window.scrollY),
          Math.round(cx2.width),
          Math.round(cx2.height),
        ],
      });
      continue;
    }
    const fundoDoPai = fundoReal(el.parentElement || el) ?? fundo;
    const fg = sobre(parse(s.color), fundoDoPai);
    const r = razao(fg, fundo);
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

/**
 * ⚠️ **A MÁSCARA DE GLIFO — como medir contraste sobre gradiente.**
 *
 * Fotografa-se o elemento DUAS vezes: a segunda com `color: transparent`. Os
 * pixels em que as fotos diferem são os do MIOLO do glifo, e o fundo real
 * atrás da letra é o da SEGUNDA foto exatamente ali. Canto redondo, gradiente,
 * imagem, sombra e halo animado saem certos por construção.
 *
 * ⚠️ E a diferença tem PISO (90 na soma dos canais): a franja do
 * antisserrilhado é meio fundo e meio letra, e mediria um contraste que
 * ninguém lê.
 *
 * ⚠️ **A primeira tentativa disto amostrava um ANEL na borda da caixa, e
 * MENTIU:** em botão de canto redondo o fundo do PAI aparece nos cantos, e ela
 * mediu o rosa-100 do cartão atrás de um botão rosa-600 — reprovando 1,2:1 um
 * botão que passa.
 */
async function porMascaraDeGlifo(p, itens) {
  const fora = [];
  for (const g of itens) {
    const [x, y, w, h] = g.caixa;
    if (w < 4 || h < 4) continue;
    const clip = { x, y, width: w, height: h };
    let comLetra, semLetra;
    try {
      comLetra = (await p.screenshot({ clip })).toString("base64");
      await p.evaluate((i) => {
        const el = document.querySelector(`[data-a11y="${i}"]`);
        if (el) el.style.color = "transparent";
      }, g.i);
      semLetra = (await p.screenshot({ clip })).toString("base64");
      await p.evaluate((i) => {
        const el = document.querySelector(`[data-a11y="${i}"]`);
        if (el) el.style.color = "";
      }, g.i);
    } catch {
      continue;
    }
    const r = await p.evaluate(
      async ({ a, b: bb, frente }) => {
        const carrega = (b64) =>
          new Promise((ok, falha) => {
            const img = new Image();
            img.onload = () => ok(img);
            img.onerror = falha;
            img.src = "data:image/png;base64," + b64;
          });
        const [ia, ib] = await Promise.all([carrega(a), carrega(bb)]);
        const pinta = (img) => {
          const c = document.createElement("canvas");
          c.width = img.width;
          c.height = img.height;
          const g2 = c.getContext("2d", { willReadFrequently: true });
          g2.drawImage(img, 0, 0);
          return g2.getImageData(0, 0, c.width, c.height).data;
        };
        const da = pinta(ia);
        const db = pinta(ib);
        const L = (q) => {
          const f = (v) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * f(q.r) + 0.7152 * f(q.g) + 0.0722 * f(q.b);
        };
        const lf = L({ r: frente[0], g: frente[1], b: frente[2] });
        let pior = Infinity;
        let glifos = 0;
        for (let i = 0; i < da.length; i += 4) {
          const d =
            Math.abs(da[i] - db[i]) +
            Math.abs(da[i + 1] - db[i + 1]) +
            Math.abs(da[i + 2] - db[i + 2]);
          if (d < 90) continue;
          glifos++;
          const lq = L({ r: db[i], g: db[i + 1], b: db[i + 2] });
          const [m, n] = lf > lq ? [lf, lq] : [lq, lf];
          const razao = (m + 0.05) / (n + 0.05);
          if (razao < pior) pior = razao;
        }
        return glifos ? +pior.toFixed(2) : null;
      },
      { a: comLetra, b: semLetra, frente: g.frente },
    );
    if (r != null && r < (g.grande ? 3 : 4.5)) fora.push({ r, px: g.px, t: g.t });
  }
  return fora;
}

const total = { contraste: 0, alvo: 0, semNome: 0, semAlt: 0, naoMedivel: 0 };
for (const rota of ROTAS) {
  const p = await ctx.newPage();
  try {
    await p.goto("http://127.0.0.1:8080" + rota, { waitUntil: "networkidle", timeout: 30000 });
    await p.waitForTimeout(1600);
    const r = await p.evaluate(MEDIR);
    /* ⚠️ A segunda passada mede o que o CSS não alcança, e o resultado ENTRA na
       lista de reprovados — não numa lista "olhe com o olho". */
    const emGradiente = await porMascaraDeGlifo(p, r.naoMedivel);
    r.contraste.push(...emGradiente);
    const n = r.contraste.length + r.alvo.length + r.semNome.length + r.semAlt.length;
    if (n) {
      console.log(`\n■ ${rota}`);
      r.contraste
        .slice(0, 4)
        .forEach((x) => console.log(`   contraste ${x.r}:1 (${x.px}px) "${x.t}"`));
      r.alvo.slice(0, 4).forEach((x) => console.log(`   alvo ${x.w}×${x.h} "${x.t}"`));
      r.semNome.slice(0, 3).forEach((x) => console.log(`   sem nome: ${x.html}`));
      r.semAlt.slice(0, 3).forEach((x) => console.log(`   sem alt: …${x.src}`));
      if (r.naoMedivel.length)
        console.log(`   (${r.naoMedivel.length} sobre gradiente, medidos pela máscara de glifo)`);
    }
    total.contraste += r.contraste.length;
    total.alvo += r.alvo.length;
    total.semNome += r.semNome.length;
    total.semAlt += r.semAlt.length;
    total.naoMedivel += r.naoMedivel.length;
  } catch (e) {
    console.log(`\n■ ${rota} — não abriu: ${String(e).slice(0, 80)}`);
  }
  await p.close();
}
await b.close();
console.log(
  `\n${ROTAS.length} telas · contraste ${total.contraste} · alvo ${total.alvo} · sem nome ${total.semNome} · sem alt ${total.semAlt}` +
    `\n${total.naoMedivel} textos sobre gradiente, medidos pela máscara de glifo (a foto, não o CSS)`,
);
