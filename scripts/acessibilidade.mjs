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

/* O endereço é parametrizável para a CONTRAPROVA poder existir: apontar a
   varredura para uma porta morta é a única forma de provar que ela reprova
   quando nada abre — que é o defeito que ela já teve. */
const BASE = process.env.BASE_DA_VARREDURA ?? "http://127.0.0.1:8080";

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
  /* O painel em tela cheia — a 393px o estado sem `painel=1` mede a aba com
     o cartão compacto, e não a conversa. */
  "/preview-nutricao?estado=conversa&painel=1",
  "/preview-nutricao?estado=socorro&painel=1",
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

  /* ALVO — controle abaixo de 44px em QUALQUER um dos lados.
     ⚠️ ERA `&&` ("nos DOIS lados"), e isso tornava a varredura CEGA para a
     classe mais comum de alvo pequeno: o botão BAIXO E LARGO. Um "Registrar"
     de 80×28 passava batido, e foi assim que a tela de Preventivos chegou a
     TREZE de treze controles abaixo do mínimo sem esta varredura acusar um.
     WCAG 2.5.8 mede os dois lados: reprova se QUALQUER um for menor.
     ⚠️ E o número total SOBE ao consertar isto — não porque a acessibilidade
     piorou, mas porque o instrumento parou de falhar aberto. Ferramenta de
     verificação que falha aberta é pior que não existir: ela dá permissão. */
  for (const el of document.querySelectorAll('button,a[href],[role="button"],input,select')) {
    if (!visivel(el)) continue;
    /* ⚠️ **O LINK DE SALTO NÃO É UM ALVO DE TOQUE.** Ele é `sr-only` — 1×1 de
       propósito — e só ganha tamanho ao receber FOCO, que é o único jeito de
       alcançá-lo. Medi-lo no estado de repouso reprova o desenho certo, e
       reprovar o certo é como uma catraca vira ruído: eram 22 linhas, uma por
       tela, já registradas como falso positivo e contadas assim mesmo. */
    if (el.className && String(el.className).includes("sr-only")) continue;
    /* ⚠️ **O ALVO DE UM CAMPO DENTRO DE UM `<label>` É O LABEL.** Tocar no
       rótulo alterna a caixinha — então a caixinha de 16×16 de um checkbox
       envolvido por um label de 44 de altura NÃO é um alvo pequeno. Medir o
       `<input>` aqui reprovava exatamente o conserto que este repositório já
       tinha feito (o `min-h-11` no label do chá de bebê). */
    const alvo = el.closest("label") ?? el;
    const r = alvo.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) {
      out.alvo.push({
        w: Math.round(r.width),
        h: Math.round(r.height),
        t: (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 36),
        /* ⚠️ **A MOLDURA DO SITE NÃO É O APP DA PACIENTE, e contá-la junto
           inflou o número em SEIS VEZES.** Toda `/preview-*` é rota do site
           institucional, então o cabeçalho e o rodapé dele aparecem em cada
           bancada — e `/minha-conta`, que é o app, os ESCONDE. Medido: 18
           controles da moldura × 22 telas = 396 dos 473 achados. Com eles
           dentro, a dívida de verdade ficava invisível no meio do ruído, que
           é como uma varredura de 474 linhas deixa de ser lida.

           ⚠️ **O separador é `.chrome-publico`, e NUNCA `closest("header,
           footer,nav")`.** A heurística foi tentada e mordeu para o lado
           perigoso: o cartão de publicação da Comunidade é um `<header>` de
           verdade, então os botões de EDITAR e FIXAR — dois alvos reais de 36
           de largura — sumiam para o balde do site. Uma varredura que move
           defeito do app para a lista "não é comigo" é pior que uma que o
           conta duas vezes. `.chrome-publico` é o mesmo invólucro que o app
           usa para ESCONDER a moldura em `/minha-conta`: o que ele esconde é,
           por definição, o que a paciente não vê. */
        moldura: !!alvo.closest(".chrome-publico"),
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

const total = { contraste: 0, alvo: 0, alvoDaMoldura: 0, semNome: 0, semAlt: 0, naoMedivel: 0 };
/* ⚠️ **QUANTAS TELAS DE FATO ABRIRAM.** Sem este contador o script imprimia
   `22 telas · contraste 0 · alvo 0` e saía ZERO com o servidor de dev no chão —
   medido: as 22 rotas devolveram `ERR_CONNECTION_REFUSED` e o relatório saiu
   com cara de aprovação. É a mesma falha ABERTA que este instrumento já pagou
   uma vez (o `&&` do alvo, que o tornava cego ao botão baixo e largo): uma
   ferramenta de verificação que aprova sem ter medido nada não é fraca — ela
   DÁ PERMISSÃO. */
let abriram = 0;
const naoAbriram = [];
for (const rota of ROTAS) {
  const p = await ctx.newPage();
  try {
    const resp = await p.goto(BASE + rota, { waitUntil: "networkidle", timeout: 30000 });
    /* ⚠️ **O CÓDIGO HTTP É CONFERIDO, e não só o "abriu".** Uma bancada que
       deixou de existir devolve 404 — e o router DESENHA uma tela de 404, com
       texto e com a moldura do site. Sem esta linha ela entraria na conta como
       "medida", e a varredura aprovaria uma tela que não existe mais. É a mesma
       falha aberta que a sonda de produção já pagou aqui, tratando um 403 do
       WAF como veredito. */
    if (resp && resp.status() >= 400) throw new Error(`HTTP ${resp.status()}`);
    await p.waitForTimeout(1600);
    /* ⚠️ **PÁGINA QUE NÃO DESENHOU NADA TAMBÉM NÃO FOI MEDIDA.** Um `goto` que
       devolve 200 sobre uma tela em branco produz zero achados — e zero achados
       sobre nada é o mesmo relatório de uma tela perfeita. É a mesma conferência
       que `varrer-bancadas` faz. */
    const temTexto = await p.evaluate(() => (document.body.innerText || "").trim().length > 40);
    if (!temTexto) throw new Error("a página abriu e não desenhou texto nenhum");
    const r = await p.evaluate(MEDIR);
    /* ⚠️ A segunda passada mede o que o CSS não alcança, e o resultado ENTRA na
       lista de reprovados — não numa lista "olhe com o olho". */
    const emGradiente = await porMascaraDeGlifo(p, r.naoMedivel);
    r.contraste.push(...emGradiente);
    const n =
      r.contraste.length +
      r.alvo.filter((x) => !x.moldura).length +
      r.semNome.length +
      r.semAlt.length;
    if (n) {
      console.log(`\n■ ${rota}`);
      r.contraste
        .slice(0, 4)
        .forEach((x) => console.log(`   contraste ${x.r}:1 (${x.px}px) "${x.t}"`));
      r.alvo
        .filter((x) => !x.moldura)
        .slice(0, 6)
        .forEach((x) => console.log(`   alvo ${x.w}×${x.h} "${x.t}"`));
      r.semNome.slice(0, 3).forEach((x) => console.log(`   sem nome: ${x.html}`));
      r.semAlt.slice(0, 3).forEach((x) => console.log(`   sem alt: …${x.src}`));
      if (r.naoMedivel.length)
        console.log(`   (${r.naoMedivel.length} sobre gradiente, medidos pela máscara de glifo)`);
    }
    total.contraste += r.contraste.length;
    total.alvo += r.alvo.filter((x) => !x.moldura).length;
    total.alvoDaMoldura += r.alvo.filter((x) => x.moldura).length;
    total.semNome += r.semNome.length;
    total.semAlt += r.semAlt.length;
    total.naoMedivel += r.naoMedivel.length;
    abriram++;
  } catch (e) {
    naoAbriram.push(rota);
    console.log(`\n■ ${rota} — não abriu: ${String(e).slice(0, 80)}`);
  }
  await p.close();
}
await b.close();
console.log(
  `\n${abriram} de ${ROTAS.length} telas MEDIDAS · contraste ${total.contraste} · alvo ${total.alvo} · sem nome ${total.semNome} · sem alt ${total.semAlt}` +
    `\n(+ ${total.alvoDaMoldura} alvos do CABEÇALHO E DO RODAPÉ DO SITE, que /minha-conta esconde — régua própria, fora da conta acima)` +
    `\n${total.naoMedivel} textos sobre gradiente, medidos pela máscara de glifo (a foto, não o CSS)`,
);
/* ⚠️ **UMA TELA QUE NÃO ABRIU É REPROVAÇÃO, e não uma linha no meio do log.**
   O relatório é lido pelo fim; um "contraste 0" embaixo de vinte e duas falhas
   de conexão lê como aprovação. Sai 1, e diz o que ficou sem medir. */
if (naoAbriram.length) {
  console.log(
    `\n⚠️  ${naoAbriram.length} tela(s) NÃO foram medidas — o número acima não fala delas:\n   ` +
      naoAbriram.join("\n   ") +
      `\n   (o servidor de dev está no ar em 127.0.0.1:8080?)`,
  );
  process.exit(1);
}
