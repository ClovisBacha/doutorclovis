/**
 * NORMALIZA O ENQUADRAMENTO das 39 ilustrações e converte para WebP.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O PROBLEMA QUE ISTO RESOLVE
 *
 * A arte atual foi medida e a ocupação da tinta na caixa varia de 72% a 89%:
 *
 *   baby-inicial  72,1%      baby-tardio  83,0%
 *   baby-feto     78,8%      baby-termo   88,7%
 *
 * Como `BabyIllustration` desenha a imagem numa caixa fixa de 200x200, essa
 * diferença vira TAMANHO NA TELA. Hoje, ao cruzar a fronteira de um estágio, o
 * bebê salta — e o salto não tem relação nenhuma com crescimento: é o
 * enquadramento do arquivo mudando.
 *
 * Com 39 arquivos em vez de 5, o problema seria 39 vezes maior: a paciente veria
 * o bebê encolher de uma semana para a outra.
 *
 * A regra: a IMAGEM carrega FORMA, o CÓDIGO carrega TAMANHO. Toda imagem sai
 * daqui com a tinta ocupando exatamente a mesma fração da caixa; quem cresce é
 * a escala contínua por semana, em `BabyIllustration`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COMO
 *
 * 1. acha a bounding box do que NÃO é transparente (alfa > 30)
 * 2. reescala essa caixa para ocupar OCUPACAO_ALVO do lado maior
 * 3. centraliza numa tela quadrada limpa
 * 4. exporta WebP no tamanho de entrega
 *
 * Roda no Chromium (canvas) porque o projeto não tem `sharp`, e instalar uma
 * dependência nativa para 39 imagens que se processam uma vez só seria trocar
 * um problema pequeno por um permanente.
 */

import { chromium } from "playwright";
import { readdirSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { resolve, basename } from "node:path";

/**
 * Fração do lado maior que a tinta deve ocupar.
 *
 * 83% é a ocupação de `baby-tardio.png`, e não foi escolha estética: é a arte
 * que a home usa hoje na faixa 28-36, contra a qual o fator `scale-[1.43]` do
 * `app-mobile-shell` foi calibrado ("medido na tela, não estimado", diz o
 * comentário de lá). Mantendo 83%, aquele fator continua válido e a home não
 * precisa ser recalibrada.
 */
const OCUPACAO_ALVO = 0.83;

/** Lado do arquivo entregue. 512 basta: a home desenha a ~200 CSS px. */
const LADO = 512;

/** Alfa acima disto conta como tinta. 30 ignora a franja semitransparente. */
const LIMIAR_ALFA = 30;

const ENTRADA = resolve(process.argv[2] ?? "scripts/bebes/recortadas");
const SAIDA = resolve(process.argv[3] ?? "src/assets/bebes");

/* `readdirSync` LANÇA quando a pasta não existe, e lançava antes de chegar na
   mensagem amigável logo abaixo — quem rodasse o script sem ter recortado nada
   ainda levava um stack trace de `node:fs` no lugar da instrução. */
let arquivos = [];
try {
  arquivos = readdirSync(ENTRADA)
    .filter((f) => f.endsWith(".png"))
    .sort();
} catch {
  console.error(`A pasta de entrada não existe: ${ENTRADA}`);
  console.error(`Uso: node scripts/bebes/normalizar.mjs [entrada] [saida]`);
  process.exit(1);
}
if (!arquivos.length) {
  console.error(`Nenhum .png em ${ENTRADA} — recorte o fundo antes de normalizar.`);
  process.exit(1);
}
mkdirSync(SAIDA, { recursive: true });

const navegador = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--allow-file-access-from-files"],
});
const pagina = await navegador.newPage();
await pagina.goto(`file://${ENTRADA}/`);

const relatorio = [];

for (const arquivo of arquivos) {
  const r = await pagina.evaluate(
    async ([nome, lado, alvo, limiar]) => {
      const img = new Image();
      img.src = nome;
      await img.decode();

      // Mede a bounding box do alfa na resolução original.
      const m = document.createElement("canvas");
      m.width = img.naturalWidth;
      m.height = img.naturalHeight;
      const mc = m.getContext("2d");
      mc.drawImage(img, 0, 0);
      const d = mc.getImageData(0, 0, m.width, m.height).data;
      let x0 = 1e9,
        y0 = 1e9,
        x1 = -1,
        y1 = -1;
      for (let y = 0; y < m.height; y++) {
        for (let x = 0; x < m.width; x++) {
          if (d[(y * m.width + x) * 4 + 3] > limiar) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      if (x1 < 0) return { erro: "imagem totalmente transparente" };

      const lw = x1 - x0 + 1;
      const lh = y1 - y0 + 1;
      /* O lado MAIOR é que manda: encaixar pela largura deixaria um bebê alto
         estourando a caixa, e vice-versa. */
      const escala = (lado * alvo) / Math.max(lw, lh);

      const c = document.createElement("canvas");
      c.width = lado;
      c.height = lado;
      const cx = c.getContext("2d");
      cx.imageSmoothingQuality = "high";
      const dw = lw * escala;
      const dh = lh * escala;
      cx.drawImage(img, x0, y0, lw, lh, (lado - dw) / 2, (lado - dh) / 2, dw, dh);

      return {
        antes: +((Math.max(lw, lh) / Math.max(m.width, m.height)) * 100).toFixed(1),
        webp: c.toDataURL("image/webp", 0.9).split(",")[1],
      };
    },
    [arquivo, LADO, OCUPACAO_ALVO, LIMIAR_ALFA],
  );

  if (r.erro) {
    console.log(`FALHOU ${arquivo}: ${r.erro}`);
    continue;
  }
  const destino = `${SAIDA}/${basename(arquivo, ".png")}.webp`;
  writeFileSync(destino, Buffer.from(r.webp, "base64"));
  const kb = statSync(destino).size / 1024;
  relatorio.push({ arquivo, ocupacaoAntes: `${r.antes}%`, kb: +kb.toFixed(1) });
}

await navegador.close();

console.table(relatorio);
const total = relatorio.reduce((s, x) => s + x.kb, 0);
console.log(
  `${relatorio.length} imagens · ${(total / 1024).toFixed(2)} MB no total · ` +
    `${(total / relatorio.length).toFixed(1)} KB em média · todas em ${OCUPACAO_ALVO * 100}% de ocupação`,
);
