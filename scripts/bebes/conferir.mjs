/**
 * ⚠️ DORMENTE desde ago/2026 — a série de 39 ilustrações saiu do app.
 *
 * O dono pediu "tire todos os bebês e só coloque os que tem no drive": hoje o
 * app usa as cinco artes dele (6, 10, 20, 30 e 40 semanas), e quem as prepara é
 * `scripts/bebes/do-drive.mjs`. Este arquivo opera sobre uma pasta de origem
 * que não existe mais no repositório.
 *
 * Fica de pé porque o raciocínio dele continua valendo se a série voltar um
 * dia — não porque haja o que rodar hoje.
 */
/**
 * CONFERE as ilustrações geradas antes de qualquer coisa entrar no app.
 *
 * Olhar 39 imagens e achar que estão boas não é conferir — é torcer. Estes são
 * os defeitos que já apareceram na prática nesta série, cada um virado em
 * medida:
 *
 *  1. ENCOSTA NA BORDA. A primeira leva saiu com o cordão umbilical cortado no
 *     canto esquerdo. Como `normalizar.mjs` reenquadra pela bounding box do
 *     alfa, um cordão que toca a borda entra no recorte CORTADO — e fica um
 *     tronco de cordão terminando no nada.
 *
 *  2. FUNDO SUJO. O prompt pede cinza chapado. Se o modelo inventar sombra,
 *     gradiente ou vinheta, o recorte de fundo erra a silhueta.
 *
 *  3. PELE FRIA. A primeira leva saiu acinzentada porque o fundo cinza
 *     dessaturou o render. A correção está no prompt, mas confiar no prompt sem
 *     medir é como o `answeredThisMonth`: parece certo e não é.
 *
 *  4. IRMÃS IGUAIS. O ponto da série é a semana MUDAR. Duas semanas vizinhas
 *     quase idênticas significam crédito gasto à toa e promessa quebrada com a
 *     paciente, que abre o app esperando novidade.
 *
 * Uso:  node scripts/bebes/conferir.mjs [pasta]
 */

import { chromium } from "playwright";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

const PASTA = resolve(process.argv[2] ?? "scripts/bebes/brutas");

/** Margem, em pixels, que o assunto tem que deixar livre em cada borda. */
const MARGEM_MINIMA = 12;

/** Distância de cor acima da qual o pixel deixa de ser "fundo". */
const TOLERANCIA_FUNDO = 26;

/**
 * Saturação mínima da pele (0-1, HSV). Abaixo disso a arte saiu acinzentada.
 * A arte atual aprovada mede ~0,30; a primeira leva ruim media ~0,17.
 */
const SATURACAO_MINIMA = 0.22;

/** Semelhança acima da qual duas semanas vizinhas são "a mesma imagem". */
const SEMELHANCA_MAXIMA = 0.97;

let arquivos = [];
try {
  arquivos = readdirSync(PASTA)
    .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
    .sort();
} catch {
  console.error(`A pasta não existe: ${PASTA}`);
  process.exit(1);
}
if (!arquivos.length) {
  console.error(`Nenhuma imagem em ${PASTA}`);
  process.exit(1);
}

const navegador = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--allow-file-access-from-files"],
});
const pagina = await navegador.newPage();
await pagina.goto(`file://${PASTA}/`);

const medidas = await pagina.evaluate(
  async ([nomes, margem, tol, satMin]) => {
    const saida = [];
    /** Assinatura de 16x16 em cinza, para comparar imagens entre si. */
    const assinar = (cx, lado) => {
      const p = cx.getImageData(0, 0, lado, lado).data;
      const a = [];
      for (let i = 0; i < p.length; i += 4) a.push((p[i] + p[i + 1] + p[i + 2]) / 3);
      return a;
    };

    for (const nome of nomes) {
      const img = new Image();
      img.src = nome;
      await img.decode();
      const L = img.naturalWidth;
      const c = document.createElement("canvas");
      c.width = L;
      c.height = img.naturalHeight;
      const cx = c.getContext("2d", { willReadFrequently: true });
      cx.drawImage(img, 0, 0);
      const d = cx.getImageData(0, 0, c.width, c.height).data;
      const at = (x, y) => {
        const i = (y * c.width + x) * 4;
        return [d[i], d[i + 1], d[i + 2], d[i + 3]];
      };

      /* A cor do fundo é a do canto superior esquerdo — o prompt garante que
         ali não há assunto. Pixel longe dessa cor (ou opaco, se já recortada)
         conta como assunto. */
      const [fr, fg, fb, fa] = at(0, 0);
      const temAlfa = fa < 250;
      const ehAssunto = (x, y) => {
        const [r, g, b, a] = at(x, y);
        if (temAlfa) return a > 30;
        return Math.abs(r - fr) + Math.abs(g - fg) + Math.abs(b - fb) > tol;
      };

      // 1. Bounding box do assunto + folga em cada borda.
      let x0 = 1e9,
        y0 = 1e9,
        x1 = -1,
        y1 = -1;
      let somaS = 0,
        somaV = 0,
        n = 0;
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          if (!ehAssunto(x, y)) continue;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
          const [r, g, b] = at(x, y);
          const mx = Math.max(r, g, b),
            mn = Math.min(r, g, b);
          somaS += mx === 0 ? 0 : (mx - mn) / mx;
          somaV += mx / 255;
          n++;
        }
      }
      if (x1 < 0) {
        saida.push({ nome, erro: "nenhum assunto encontrado" });
        continue;
      }
      const folga = Math.min(x0, y0, c.width - 1 - x1, c.height - 1 - y1);

      // 2. Uniformidade do fundo: desvio das bordas em relação ao canto.
      let piorBorda = 0;
      const passo = Math.max(1, Math.floor(c.width / 200));
      for (let x = 0; x < c.width; x += passo) {
        for (const y of [0, c.height - 1]) {
          const [r, g, b] = at(x, y);
          piorBorda = Math.max(piorBorda, Math.abs(r - fr) + Math.abs(g - fg) + Math.abs(b - fb));
        }
      }

      // 3. Assinatura para comparar com as vizinhas.
      const mini = document.createElement("canvas");
      mini.width = 16;
      mini.height = 16;
      const mcx = mini.getContext("2d", { willReadFrequently: true });
      mcx.drawImage(img, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, 16, 16);

      saida.push({
        nome,
        folga,
        ocupacao: +((Math.max(x1 - x0 + 1, y1 - y0 + 1) / c.width) * 100).toFixed(1),
        saturacao: +(somaS / n).toFixed(3),
        brilho: +(somaV / n).toFixed(3),
        fundoSujo: piorBorda,
        assinatura: assinar(mcx, 16),
      });
    }
    return saida;
  },
  [arquivos, MARGEM_MINIMA, TOLERANCIA_FUNDO, SATURACAO_MINIMA],
);

await navegador.close();

/** Correlação entre duas assinaturas (1 = idênticas). */
function semelhanca(a, b) {
  const m = (v) => v.reduce((s, x) => s + x, 0) / v.length;
  const ma = m(a),
    mb = m(b);
  let num = 0,
    da = 0,
    db = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] - ma,
      y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  return da && db ? num / Math.sqrt(da * db) : 1;
}

const problemas = [];
const linhas = medidas.map((m, i) => {
  if (m.erro) {
    problemas.push(`${m.nome}: ${m.erro}`);
    return { arquivo: m.nome, ERRO: m.erro };
  }
  const alertas = [];
  if (m.folga < MARGEM_MINIMA) alertas.push(`encosta na borda (${m.folga}px)`);
  if (m.fundoSujo > TOLERANCIA_FUNDO * 2) alertas.push(`fundo sujo (${m.fundoSujo})`);
  if (m.saturacao < SATURACAO_MINIMA) alertas.push(`pele fria (${m.saturacao})`);

  const ant = medidas[i - 1];
  let vizinha = "";
  if (ant && !ant.erro) {
    const s = semelhanca(m.assinatura, ant.assinatura);
    vizinha = s.toFixed(3);
    if (s > SEMELHANCA_MAXIMA) alertas.push(`quase igual à anterior (${s.toFixed(3)})`);
  }
  if (alertas.length) problemas.push(`${m.nome}: ${alertas.join(" · ")}`);
  return {
    arquivo: m.nome,
    folga: m.folga,
    ocupacao: `${m.ocupacao}%`,
    satur: m.saturacao,
    fundo: m.fundoSujo,
    "vs anterior": vizinha,
    ok: alertas.length ? "✗" : "✓",
  };
});

console.table(linhas);
if (problemas.length) {
  console.log(`\n${problemas.length} imagem(ns) para refazer:`);
  for (const p of problemas) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`\n✓ as ${medidas.length} passaram em todos os critérios`);
