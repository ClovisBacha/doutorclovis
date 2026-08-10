/**
 * CONTRASTE DO TEXTO DO HERO nos quatro céus.
 *
 * Mede contra o PIXEL COMPOSTO da cena (não contra cor chapada), pelo método
 * de três fotos: normal / só-sombra (`color:transparent`) / sem-texto. A
 * cobertura por pixel vem da foto só-sombra normalizada; só entram pixels com
 * α ≥ 0,97, para excluir a borda anti-serrilhada — sem esse corte, os pixels
 * de borda entram como se fossem tinta e reprovam tudo.
 *
 * Para CENTRAGEM óptica use `scripts/centragem-hero.mjs`: medir a tinta pela
 * foto depende do fundo, e no rótulo pequeno isso variava 6px de céu para céu
 * para o MESMO texto. `measureText` não depende de fundo nenhum.
 *
 * ─── COMO RODAR ─────────────────────────────────────────────────────────────
 *
 *   bun run dev --host 127.0.0.1 --port 8080     # noutro terminal
 *   node scripts/contraste-hero.mjs
 *
 * A hora de cada céu é fixada com `page.clock`, SEMPRE com fuso explícito
 * (`-03:00`): o contêiner roda em UTC e sem o fuso a cena escolhida é outra.
 *
 * Este texto não tem cartão atrás — ele se apoia direto na arte, e a arte tem
 * contraste LOCAL (uma crista de onda acesa passando por trás dos dígitos).
 * Por isso o piso é o percentil 5 dos pixels, e não a mediana: a mediana passa
 * enquanto o pior ponto do glifo está ilegível.
 */
import { chromium } from "playwright";

const HORA = {
  amanhecer: "2026-08-10T06:40:00-03:00",
  dia: "2026-08-10T12:00:00-03:00",
  "por-do-sol": "2026-08-10T17:20:00-03:00",
  anoitecer: "2026-08-10T21:00:00-03:00",
};
/* Os pisos são os da WCAG 2.1 AA: 4,5:1 para texto normal e 3:1 para texto
   grande (o número da semana passa dos 24px em negrito por larga margem).
   A pílula do clima ("graus") saiu da barra em ago/2026 e saiu daqui junto —
   alvo que não existe mais na tela vira linha que nunca reprova. */
const MIN = { nome: 4.5, numero: 3, semanas: 4.5 };
/* Alvos que a tela pode legitimamente não ter (o nome só existe se a paciente
   deu nome ao bebê). Some da lista sem reprovar; o que NÃO pode é um alvo
   obrigatório sumir em silêncio, e é isso que a conferência abaixo cobra. */
const OPCIONAIS = new Set(["nome"]);

const n = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let falhas = 0;

for (const [ceu, t] of Object.entries(HORA)) {
  const c = await n.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    timezoneId: "America/Sao_Paulo",
  });
  await c.route(/open-meteo/, (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        current: { temperature_2m: 17, weather_code: 1, is_day: 0, precipitation: 0 },
        daily: { sunrise: ["2026-08-10T06:30"], sunset: ["2026-08-10T17:55"] },
      }),
    }),
  );
  const p = await c.newPage();
  await p.clock.setFixedTime(new Date(t));
  await p.goto("http://127.0.0.1:8080/preview-home?w=20&clima=1", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await p.waitForTimeout(5500);
  await p.addStyleTag({ content: "*{animation:none!important;transition:none!important}" });

  // marca os alvos
  await p.evaluate(() => {
    const ps = [...document.querySelectorAll("p,span,div")];
    const num = ps.find(
      (e) =>
        e.children.length === 0 &&
        /^\d+$/.test(e.textContent.trim()) &&
        parseFloat(getComputedStyle(e).fontSize) > 40,
    );
    const lab = ps.find((e) => e.children.length === 0 && /^semanas?$/.test(e.textContent.trim()));
    /* O nome do bebê carrega corações em <span>, então ele NÃO tem
       `children.length === 0` como os outros. A regra aqui é "o <p> mais raso
       que CONTÉM o nome" — sem isso o alvo não é encontrado, e o texto mais
       exposto da tela (branco ou índigo direto sobre a arte, sem cartão atrás)
       passa a vida sem ser medido.

       Era `/^Clovis\b/` sobre o texto aparado, e quebrou no dia em que o nome
       ganhou um coração INVISÍVEL à esquerda para ficar centrado: o texto
       passou a começar com o emoji. `includes` não se importa com o que vem
       antes nem com quantos filhos existem.

       Os emojis não sujam a medida: a foto "só sombra" pinta `color:
       transparent`, e fonte de emoji colorido ignora `color` — os pixels dele
       ficam idênticos nas duas fotos, cobertura zero, fora da conta. */
    const nome = ps.find((e) => e.tagName === "P" && e.textContent.includes("Clovis"));
    num && num.setAttribute("data-alvo", "numero");
    lab && lab.setAttribute("data-alvo", "semanas");
    nome && nome.setAttribute("data-alvo", "nome");
  });

  const caixas = await p.evaluate(() =>
    [...document.querySelectorAll("[data-alvo]")].map((e) => {
      const b = e.getBoundingClientRect();
      return {
        alvo: e.getAttribute("data-alvo"),
        x: Math.floor(b.x) - 6,
        y: Math.floor(b.y) - 6,
        w: Math.ceil(b.width) + 12,
        h: Math.ceil(b.height) + 12,
        cx: b.x + b.width / 2,
      };
    }),
  );

  const tira = async (nome) => {
    const b64 = {};
    for (const c of caixas) {
      const buf = await p.screenshot({ clip: { x: c.x, y: c.y, width: c.w, height: c.h } });
      b64[c.alvo] = buf.toString("base64");
    }
    return b64;
  };

  const normal = await tira();
  await p.addStyleTag({ content: "[data-alvo]{color:transparent!important}" });
  const soSombra = await tira();
  await p.addStyleTag({ content: "[data-alvo]{visibility:hidden!important}" });
  const semTexto = await tira();

  for (const c of caixas) {
    const r = await p.evaluate(
      async ({ a, b, s }) => {
        const carrega = async (x) =>
          createImageBitmap(await (await fetch("data:image/png;base64," + x)).blob());
        const px = async (x) => {
          const bmp = await carrega(x);
          const cv = new OffscreenCanvas(bmp.width, bmp.height);
          const g = cv.getContext("2d");
          g.drawImage(bmp, 0, 0);
          return {
            d: g.getImageData(0, 0, bmp.width, bmp.height).data,
            W: bmp.width,
            H: bmp.height,
          };
        };
        const A = await px(a),
          B = await px(b),
          S = await px(s);
        const lum = (r, g, bb) => {
          const f = (u) => {
            u /= 255;
            return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bb);
        };
        const raz = (l1, l2) => {
          const [x, y] = l1 > l2 ? [l1, l2] : [l2, l1];
          return (x + 0.05) / (y + 0.05);
        };
        // cobertura: quanto o pixel mudou entre "normal" e "só sombra"
        let bruto = [];
        for (let i = 0; i < A.d.length; i += 4) {
          const dif =
            Math.abs(A.d[i] - B.d[i]) +
            Math.abs(A.d[i + 1] - B.d[i + 1]) +
            Math.abs(A.d[i + 2] - B.d[i + 2]);
          bruto.push(dif);
        }
        const teto = Math.max(...bruto);
        const razoes = [];
        for (let k = 0; k < bruto.length; k++) {
          if (teto > 0 && bruto[k] / teto >= 0.97) {
            const i = k * 4;
            const lf = lum(A.d[i], A.d[i + 1], A.d[i + 2]);
            const lb = lum(B.d[i], B.d[i + 1], B.d[i + 2]); // fundo = cena + sombra
            razoes.push(raz(lf, lb));
          }
        }
        razoes.sort((p, q) => p - q);
        const q = (f) =>
          razoes[Math.max(0, Math.min(razoes.length - 1, Math.floor(f * razoes.length)))];
        return {
          n: razoes.length,
          p5: razoes.length ? q(0.05) : null,
          mediana: razoes.length ? q(0.5) : null,
          /* A foto sem-texto não entra na conta: ela existe para conferir a
             olho que o recorte pegou a cena certa quando algo dá errado. */
          semTextoW: S.W,
        };
      },
      { a: normal[c.alvo], b: soSombra[c.alvo], s: semTexto[c.alvo] },
    );
    const min = MIN[c.alvo];
    const ok = r.p5 !== null && r.p5 >= min;
    if (!ok) falhas++;
    console.log(
      ceu.padEnd(11),
      c.alvo.padEnd(8),
      "p5",
      r.p5 === null ? "  —  " : r.p5.toFixed(2).padStart(6),
      "mediana",
      r.mediana === null ? "  —  " : r.mediana.toFixed(2).padStart(6),
      "mín",
      String(min).padStart(4),
      ok ? "PASSA" : "FALHA",
    );
  }

  /* ALVO SUMIDO REPROVA. Sem isto, renomear um elemento fazia o `find` voltar
     vazio, o céu inteiro sair da tabela e o script imprimir "TODOS PASSAM" —
     um verde que quer dizer "não conferi nada". */
  const achados = new Set(caixas.map((c) => c.alvo));
  for (const alvo of Object.keys(MIN)) {
    if (!achados.has(alvo) && !OPCIONAIS.has(alvo)) {
      falhas++;
      console.log(ceu.padEnd(11), alvo.padEnd(8), "NÃO ENCONTRADO na tela");
    }
  }
  await c.close();
}
await n.close();
console.log(falhas === 0 ? "\nTODOS PASSAM" : `\n${falhas} FALHAS`);
