/**
 * COMPARAR A TELA COM A REFERÊNCIA DO DONO — lado a lado, e com números.
 *
 * ─── POR QUE ISTO EXISTE ────────────────────────────────────────────────────
 *
 * O dono mandou quatro imagens e disse: "as duas abas estão completamente
 * diferentes e desconexas com o que eu te pedi. Uma tem cara que foi feita aqui
 * no Cloud Code, a outra tem cara que realmente é de profissional."
 *
 * A causa não foi falta de capacidade — foi falta de VERIFICAÇÃO. Eu construía
 * a tela, olhava o código, achava que estava parecida e entregava. Nunca pus as
 * duas imagens lado a lado. A documentação do Claude Code chama isso pelo nome:
 *
 *   "The trust-then-verify gap. Claude produces a plausible-looking
 *    implementation that doesn't handle edge cases.
 *    Fix: Always provide verification (tests, scripts, screenshots).
 *    If you can't verify it, don't ship it."
 *
 * Este script é essa verificação. Ele NÃO aprova nem reprova sozinho: ele
 * produz a foto lado a lado (que tem de ser OLHADA) e os números que impedem a
 * conversa de virar "achei parecido".
 *
 * ─── O QUE ELE MEDE, E POR QUE CADA COISA ───────────────────────────────────
 *
 * · **Paleta** — as 6 cores dominantes de cada lado. É o número que teria
 *   pegado o defeito original: eu troquei um jardim PINTADO por um
 *   `linear-gradient` de onze paradas. As cores batiam; a imagem não existia.
 * · **Densidade de tinta por faixa** — a imagem é cortada em 12 faixas
 *   horizontais e mede-se quanto de cada faixa é "conteúdo" (longe da cor de
 *   fundo). Faixa com muita tinta na referência e pouca na minha é elemento
 *   que eu não desenhei; o contrário é coisa que eu inventei.
 * · **Altura relativa** — as duas escaladas para a MESMA largura. Se a minha
 *   tela é 40% mais alta, algum bloco meu está inchado (foi o caso do aviso
 *   âmbar que ocupava um quarto da primeira dobra).
 *
 * ⚠️ NENHUM DESSES NÚMEROS SUBSTITUI OLHAR A FOTO. Eles existem para tornar a
 * divergência impossível de ignorar, não para dispensar o olho.
 *
 * ─── ⚠️ A ÁREA SEGURA É INJETADA ────────────────────────────────────────────
 *
 * O Chromium devolve ZERO em `env(safe-area-inset-*)`. Sem injetar, mede-se uma
 * tela que não existe em nenhum iPhone — e foi exatamente assim que os
 * controles da Loja passaram meses por baixo do relógio do sistema sem ninguém
 * ver. Aqui a injeção é padrão, e desligá-la é explícito (`--sem-area-segura`).
 *
 * ─── ⚠️ COMPARE A MESMA COISA DOS DOIS LADOS ────────────────────────────────
 *
 * A primeira execução deste script devolveu "a minha é 3,33× mais alta" — e não
 * era defeito da tela: a bancada renderiza o SITE inteiro (cabeçalho de
 * marketing, rodapé com telefone e links), e a referência do dono é só o
 * aparelho. Comparar página inteira com componente alinha faixa 3 da referência
 * com faixa 3 de outra coisa, e todo número vira ruído.
 *
 * Daí `--seletor` (fotografa só o elemento) e `--recorte` (apara a referência,
 * tirando a barra de status e a navbar do mockup). Sem eles o relatório mente
 * com confiança, que é pior que não existir.
 *
 * Uso:
 *   node scripts/comparar-com-referencia.mjs <referencia.png> <url> [saida.png]
 *
 * Opções:
 *   --seletor=".minha-aba"   fotografa só esse elemento (recomendado)
 *   --recorte=190,1590       apara a referência entre estas linhas (px da origem)
 *   --largura=393            largura de comparação em CSS px
 *   --sem-area-segura        não injeta a área segura do iPhone
 *
 * Exemplo:
 *   node scripts/comparar-com-referencia.mjs ref-amigas.png \
 *     "http://127.0.0.1:8080/preview-amigas?premium=1" /tmp/lado.png \
 *     --seletor="div.mx-auto.max-w-md" --recorte=190,1590
 */
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import { chromium } from "playwright";

const LARGURA = 393; // iPhone 15 Pro em CSS px — o aparelho do dono
const FAIXAS = 12;
/** Um pixel conta como "tinta" quando se afasta disto da cor de fundo local. */
const LIMIAR_TINTA = 26;

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
const [referencia, url, saida = "/tmp/lado-a-lado.png"] = args;

if (!referencia || !url) {
  console.error(
    "uso: node scripts/comparar-com-referencia.mjs <referencia.png> <url> [saida.png]\n" +
      "     --sem-area-segura   não injeta a área segura do iPhone\n" +
      "     --largura=393       largura em CSS px",
  );
  process.exit(1);
}
const largura = Number(
  [...flags].find((f) => f.startsWith("--largura="))?.split("=")[1] ?? LARGURA,
);
const seletor = [...flags].find((f) => f.startsWith("--seletor="))?.slice(10) ?? null;
const recorte = [...flags]
  .find((f) => f.startsWith("--recorte="))
  ?.slice(10)
  .split(",")
  .map(Number);

/* ── Utilidades de imagem ─────────────────────────────────────────────────── */

/** Reamostra para uma largura alvo (vizinho mais próximo — só para comparar). */
function paraLargura(img, alvo) {
  const escala = alvo / img.width;
  const altura = Math.max(1, Math.round(img.height * escala));
  const out = new PNG({ width: alvo, height: altura });
  for (let y = 0; y < altura; y++) {
    const sy = Math.min(img.height - 1, Math.round(y / escala));
    for (let x = 0; x < alvo; x++) {
      const sx = Math.min(img.width - 1, Math.round(x / escala));
      const i = (img.width * sy + sx) << 2;
      const j = (alvo * y + x) << 2;
      out.data[j] = img.data[i];
      out.data[j + 1] = img.data[i + 1];
      out.data[j + 2] = img.data[i + 2];
      out.data[j + 3] = 255;
    }
  }
  return out;
}

/**
 * As N cores dominantes, agrupadas em caixas grosseiras (32 níveis por canal).
 *
 * Grosseiro de propósito: a pergunta é "esta tela é do mesmo mundo visual?", e
 * um agrupamento fino devolveria mil tons de quase-a-mesma-cor.
 */
function paleta(img, quantas = 6) {
  const caixas = new Map();
  for (let p = 0; p < img.width * img.height; p++) {
    const i = p << 2;
    const k = ((img.data[i] >> 3) << 10) | ((img.data[i + 1] >> 3) << 5) | (img.data[i + 2] >> 3);
    caixas.set(k, (caixas.get(k) ?? 0) + 1);
  }
  const total = img.width * img.height;
  return [...caixas.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, quantas)
    .map(([k, n]) => {
      const r = ((k >> 10) & 31) << 3;
      const g = ((k >> 5) & 31) << 3;
      const b = (k & 31) << 3;
      const hex = (v) => v.toString(16).padStart(2, "0");
      return { cor: `#${hex(r)}${hex(g)}${hex(b)}`, pct: (100 * n) / total };
    });
}

/** Quanto de cada faixa horizontal é conteúdo (e não fundo chapado). */
function tintaPorFaixa(img, faixas = FAIXAS) {
  const alt = Math.floor(img.height / faixas);
  const saida = [];
  for (let f = 0; f < faixas; f++) {
    const y0 = f * alt;
    const y1 = f === faixas - 1 ? img.height : y0 + alt;
    /* A cor de fundo da FAIXA é a mediana das bordas laterais — usar uma cor
       global erraria em telas com herói escuro e corpo claro. */
    const bordas = [];
    for (let y = y0; y < y1; y += 2) {
      for (const x of [1, 2, img.width - 3, img.width - 2]) {
        const i = (img.width * y + x) << 2;
        bordas.push([img.data[i], img.data[i + 1], img.data[i + 2]]);
      }
    }
    bordas.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
    const fundo = bordas[Math.floor(bordas.length / 2)] ?? [255, 255, 255];
    let tinta = 0,
      total = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < img.width; x++) {
        const i = (img.width * y + x) << 2;
        const d =
          Math.abs(img.data[i] - fundo[0]) +
          Math.abs(img.data[i + 1] - fundo[1]) +
          Math.abs(img.data[i + 2] - fundo[2]);
        if (d > LIMIAR_TINTA) tinta++;
        total++;
      }
    }
    saida.push((100 * tinta) / total);
  }
  return saida;
}

/** Cola as duas lado a lado, com uma régua de faixas entre elas. */
function ladoALado(a, b) {
  const h = Math.max(a.height, b.height);
  const sep = 16;
  const out = new PNG({ width: a.width + sep + b.width, height: h });
  out.data.fill(24);
  const cola = (img, dx) => {
    for (let y = 0; y < img.height; y++)
      for (let x = 0; x < img.width; x++) {
        const i = (img.width * y + x) << 2;
        const j = (out.width * y + (x + dx)) << 2;
        out.data[j] = img.data[i];
        out.data[j + 1] = img.data[i + 1];
        out.data[j + 2] = img.data[i + 2];
        out.data[j + 3] = 255;
      }
  };
  cola(a, 0);
  cola(b, a.width + sep);
  /* As marcas das faixas na tarja do meio, para o olho saber de qual faixa o
     número está falando. */
  for (let f = 1; f < FAIXAS; f++) {
    const y = Math.round((f * h) / FAIXAS);
    for (let x = a.width; x < a.width + sep; x++) {
      const j = (out.width * y + x) << 2;
      out.data[j] = 255;
      out.data[j + 1] = 80;
      out.data[j + 2] = 80;
    }
  }
  return out;
}

/* ── Corpo ────────────────────────────────────────────────────────────────── */

/** Apara a referência entre duas linhas — tira barra de status e navbar. */
function apara(img, y0, y1) {
  const a = Math.max(0, Math.min(img.height - 1, y0));
  const b = Math.max(a + 1, Math.min(img.height, y1));
  const out = new PNG({ width: img.width, height: b - a });
  for (let y = 0; y < b - a; y++)
    for (let x = 0; x < img.width; x++) {
      const i = (img.width * (y + a) + x) << 2;
      const j = (img.width * y + x) << 2;
      out.data[j] = img.data[i];
      out.data[j + 1] = img.data[i + 1];
      out.data[j + 2] = img.data[i + 2];
      out.data[j + 3] = 255;
    }
  return out;
}

let refBruta = PNG.sync.read(readFileSync(referencia));
if (recorte?.length === 2) refBruta = apara(refBruta, recorte[0], recorte[1]);
const ref = paraLargura(refBruta, largura);

const navegador = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium",
});
const pagina = await navegador.newPage({
  viewport: { width: largura, height: 852 },
  deviceScaleFactor: 2,
});
await pagina.goto(url, { waitUntil: "domcontentloaded" });
await pagina.waitForTimeout(2500);
if (!flags.has("--sem-area-segura")) {
  await pagina.addStyleTag({
    content: ":root{--safe-area-inset-top:59px;--safe-area-inset-bottom:34px}",
  });
  await pagina.waitForTimeout(300);
}
/* ⚠️ O elemento, quando pedido. `fullPage` numa bancada traz cabeçalho e
   rodapé do site — conteúdo que a referência não tem, e que desalinha todas as
   faixas. */
let bruto;
if (seletor) {
  const alvo = pagina.locator(seletor).first();
  if ((await alvo.count()) === 0) {
    await navegador.close();
    console.error(`⚠️  seletor não encontrado na página: ${seletor}`);
    process.exit(1);
  }
  bruto = await alvo.screenshot();
} else {
  bruto = await pagina.screenshot({ fullPage: true });
}
await navegador.close();

const meu = paraLargura(PNG.sync.read(bruto), largura);
writeFileSync(saida, PNG.sync.write(ladoALado(ref, meu)));

/* ── O relatório ──────────────────────────────────────────────────────────── */

const razaoAltura = meu.height / ref.height;
console.log(
  `\n📐 ALTURA   referência ${ref.height}px · minha ${meu.height}px  (${razaoAltura.toFixed(2)}×)`,
);
if (razaoAltura > 1.25)
  console.log(
    "   ⚠️  A minha é 25%+ mais ALTA — provavelmente inventei bloco ou inflei espaçamento.",
  );
if (razaoAltura < 0.8)
  console.log("   ⚠️  A minha é bem mais BAIXA — provavelmente deixei conteúdo de fora.");

console.log("\n🎨 PALETA DOMINANTE");
const pa = paleta(ref);
const pb = paleta(meu);
for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
  const a = pa[i],
    b = pb[i];
  console.log(
    `   ${(a ? `${a.cor} ${a.pct.toFixed(1).padStart(5)}%` : "".padEnd(14)).padEnd(18)}` +
      `${b ? `${b.cor} ${b.pct.toFixed(1).padStart(5)}%` : ""}`,
  );
}

console.log("\n📊 TINTA POR FAIXA (referência → minha)");
const ta = tintaPorFaixa(ref);
const tb = tintaPorFaixa(meu);
let piores = [];
for (let f = 0; f < FAIXAS; f++) {
  const d = tb[f] - ta[f];
  const marca = Math.abs(d) > 15 ? "  ⚠️" : "";
  if (Math.abs(d) > 15) piores.push({ faixa: f + 1, d });
  console.log(
    `   faixa ${String(f + 1).padStart(2)}  ${ta[f].toFixed(1).padStart(5)}% → ${tb[f]
      .toFixed(1)
      .padStart(5)}%   ${d >= 0 ? "+" : ""}${d.toFixed(1)}${marca}`,
  );
}

console.log(`\n🖼️  LADO A LADO: ${saida}`);
console.log("   ⚠️  ABRA ESTA IMAGEM. Os números acima não substituem olhar.");
if (piores.length) {
  console.log(
    `\n   Faixas que mais divergem: ${piores
      .map((p) => `${p.faixa} (${p.d > 0 ? "sobra" : "falta"} conteúdo)`)
      .join(", ")}`,
  );
}
console.log("");
