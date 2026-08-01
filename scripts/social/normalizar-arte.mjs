/**
 * Normaliza as ilustrações de pilar: mesma ocupação, mesmo tamanho, WebP.
 *
 *   node scripts/social/normalizar-arte.mjs
 *
 * Por que existe. O modelo não obedece pedido de enquadramento — foi o mesmo
 * defeito dos bebês semanais, onde o cordão fugia da bolha por mais que o
 * prompt mandasse ficar dentro. Insistir na palavra não resolve; dividir o
 * trabalho, sim. O modelo desenha solto, com margem sobrando, e aqui o código
 * recorta pelo desenho e devolve todas com a mesma proporção de tinta.
 *
 * Sem isso, uma arte ocupa 60% do quadro e outra 35%. Recortadas no mesmo
 * círculo do carrossel, uma enche e a outra some — e a coleção deixa de
 * parecer uma coleção.
 *
 * Lê os PNG de `src/assets/social/` (matéria-prima, fora do git) e grava os
 * `.webp` ao lado. Rodar de novo é seguro: sempre parte do PNG.
 */

import { chromium } from "playwright";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { CAMINHOS } from "./caminhos.mjs";

const PASTA = CAMINHOS.arte;
const CHROMIUM = process.env.CHROMIUM_PATH || undefined;

/** Quanto do quadro final o desenho deve ocupar. */
const OCUPACAO_ALVO = 0.78;
const LADO = 768;

/**
 * O que conta como fundo.
 *
 * A primeira versão usava um limiar fixo de claridade, e falhou calada: o
 * creme dessas artes tem grão e uma vinheta leve, então boa parte do fundo
 * ficava abaixo do corte, a caixa do desenho dava o quadro inteiro e a
 * "normalização" só acrescentava borda. O valor certo não é fixo — é o próprio
 * creme daquela imagem, lido do canto. Um pixel vira desenho quando se afasta
 * dele mais que a tolerância, que é folgada o bastante para o grão e apertada
 * o bastante para a pele mais clara.
 */
const TOLERANCIA = 34;

const pngs = readdirSync(PASTA).filter((f) => f.endsWith(".png"));
if (!pngs.length) {
  console.log("Nenhum PNG em src/assets/social/ — nada a normalizar.");
  process.exit(0);
}

const navegador = await chromium.launch({ executablePath: CHROMIUM });
const pagina = await navegador.newPage({ viewport: { width: LADO, height: LADO } });

for (const arquivo of pngs) {
  const nome = arquivo.replace(/\.png$/, "");
  const dados = readFileSync(join(PASTA, arquivo)).toString("base64");

  const saida = await pagina.evaluate(
    async ({ dados, LADO, OCUPACAO_ALVO, TOLERANCIA }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${dados}`;
      await img.decode();

      const m = document.createElement("canvas");
      m.width = img.width;
      m.height = img.height;
      const mc = m.getContext("2d", { willReadFrequently: true });
      mc.drawImage(img, 0, 0);
      const d = mc.getImageData(0, 0, m.width, m.height).data;

      // O creme desta imagem, lido nos quatro cantos (mediana por canal, para
      // um canto sujo não contaminar a leitura).
      const cantos = [
        [2, 2],
        [m.width - 3, 2],
        [2, m.height - 3],
        [m.width - 3, m.height - 3],
      ].map(([x, y]) => {
        const k = (y * m.width + x) * 4;
        return [d[k], d[k + 1], d[k + 2]];
      });
      const fundo = [0, 1, 2].map((c) => {
        const v = cantos.map((p) => p[c]).sort((a, b) => a - b);
        return Math.round((v[1] + v[2]) / 2);
      });

      /**
       * Caixa robusta: conta quantos pixels de desenho existem em cada coluna
       * e em cada linha, e fica com a faixa que contém 99% dessa massa.
       *
       * O mínimo/máximo absoluto não serve. Basta um respingo de grão numa
       * borda para a caixa esticar até lá, e aí o centro calculado sai do
       * lugar — foi o que empurrou a gestante para a direita do quadro. A
       * faixa por massa ignora esses pontos soltos porque eles não somam nada.
       */
      const porColuna = new Uint32Array(m.width);
      const porLinha = new Uint32Array(m.height);
      let massa = 0;
      for (let y = 0; y < m.height; y++) {
        for (let x = 0; x < m.width; x++) {
          const k = (y * m.width + x) * 4;
          const dist =
            Math.abs(d[k] - fundo[0]) +
            Math.abs(d[k + 1] - fundo[1]) +
            Math.abs(d[k + 2] - fundo[2]);
          if (dist <= TOLERANCIA) continue;
          porColuna[x]++;
          porLinha[y]++;
          massa++;
        }
      }
      if (!massa) return null;

      const faixa = (hist) => {
        const corte = massa * 0.005;
        let soma = 0,
          ini = 0,
          fim = hist.length - 1;
        for (let i = 0; i < hist.length; i++) {
          soma += hist[i];
          if (soma > corte) {
            ini = i;
            break;
          }
        }
        soma = 0;
        for (let i = hist.length - 1; i >= 0; i--) {
          soma += hist[i];
          if (soma > corte) {
            fim = i;
            break;
          }
        }
        return [ini, fim];
      };

      const [x0, x1] = faixa(porColuna);
      const [y0, y1] = faixa(porLinha);

      const larg = x1 - x0 + 1;
      const alt = y1 - y0 + 1;
      const lado = Math.max(larg, alt) / OCUPACAO_ALVO;
      const cx = x0 + larg / 2;
      const cy = y0 + alt / 2;

      const s = document.createElement("canvas");
      s.width = LADO;
      s.height = LADO;
      const sc = s.getContext("2d");
      // A moldura acrescentada usa o creme medido, não o pixel do canto — se o
      // canto estiver com grão, a emenda apareceria como um quadrado de tom
      // ligeiramente diferente. Foi o que aconteceu na primeira versão.
      sc.fillStyle = `rgb(${fundo[0]},${fundo[1]},${fundo[2]})`;
      sc.fillRect(0, 0, LADO, LADO);
      sc.imageSmoothingQuality = "high";
      sc.drawImage(img, cx - lado / 2, cy - lado / 2, lado, lado, 0, 0, LADO, LADO);

      return {
        webp: s.toDataURL("image/webp", 0.9).split(",")[1],
        // Quanto do quadro ORIGINAL o desenho ocupava. Perto de 100 significa
        // que a deteccão falhou e leu o fundo como desenho.
        antes: Math.round((Math.max(larg, alt) / m.width) * 100),
      };
    },
    { dados, LADO, OCUPACAO_ALVO, TOLERANCIA },
  );

  if (!saida) {
    console.log(`  ${nome}: quadro inteiro lido como fundo — pulado.`);
    continue;
  }

  const destino = join(PASTA, `${nome}.webp`);
  writeFileSync(destino, Buffer.from(saida.webp, "base64"));
  const kb = Math.round(Buffer.from(saida.webp, "base64").length / 1024);
  const suspeito = saida.antes >= 97 ? "  ⚠ deteccão suspeita" : "";
  console.log(
    `  ${nome.padEnd(10)} ocupava ${String(saida.antes).padStart(3)}%  →  78%   ${kb} KB${suspeito}`,
  );
}

await navegador.close();
console.log(`\n${pngs.length} artes normalizadas a ${OCUPACAO_ALVO * 100}% de ocupação.`);
