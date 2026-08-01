/**
 * Recorta a folha de expressões da bolha em quatro sprites soltos.
 *
 *   node scripts/recortar-bolha.mjs
 *
 * A folha vem do gerador como uma grade 2×2 numa única imagem. Cada expressão
 * precisa virar arquivo próprio, com fundo transparente, para poder pousar em
 * cima de qualquer tela do app — a trilha tem céu que muda com a hora do dia, e
 * um retângulo creme colado ali apareceria em todas elas.
 *
 * Não corto em quartos fixos. As bolhas não estão centradas nas células (a de
 * comemoração é mais larga por causa do confete, a de sono é mais baixa), então
 * o quarto geométrico decepa umas e sobra nas outras. O corte sai da massa de
 * pixels de cada quadrante — o mesmo método do normalizador das ilustrações de
 * pilar, que já tinha errado uma vez com caixa por mínimo/máximo absoluto.
 */

import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");
const FOLHA = join(RAIZ, "saida", "bolha", "expressoes.png");
const DESTINO = join(RAIZ, "src", "assets", "bolha");

/** Ordem da grade 2×2, lida da esquerda para a direita, de cima para baixo. */
const EXPRESSOES = ["feliz", "comemorando", "dormindo", "preocupada"];

const LADO = 320;
const OCUPACAO = 0.86;
/** Distância do creme a partir da qual o pixel conta como desenho. */
const TOLERANCIA = 30;

if (!existsSync(FOLHA)) {
  console.error(`Folha não encontrada em ${FOLHA}`);
  process.exit(1);
}

mkdirSync(DESTINO, { recursive: true });

const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const pagina = await navegador.newPage({ viewport: { width: LADO, height: LADO } });
const dados = readFileSync(FOLHA).toString("base64");

const saidas = await pagina.evaluate(
  async ({ dados, LADO, OCUPACAO, TOLERANCIA, EXPRESSOES }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${dados}`;
    await img.decode();

    const m = document.createElement("canvas");
    m.width = img.width;
    m.height = img.height;
    const mc = m.getContext("2d", { willReadFrequently: true });
    mc.drawImage(img, 0, 0);
    const d = mc.getImageData(0, 0, m.width, m.height).data;

    const canto = [d[0], d[1], d[2]];
    const ehFundo = (k) =>
      Math.abs(d[k] - canto[0]) + Math.abs(d[k + 1] - canto[1]) + Math.abs(d[k + 2] - canto[2]) <=
      TOLERANCIA;

    const meiaL = Math.floor(m.width / 2);
    const meiaA = Math.floor(m.height / 2);
    const quadrantes = [
      [0, 0],
      [meiaL, 0],
      [0, meiaA],
      [meiaL, meiaA],
    ];

    const resultado = [];

    quadrantes.forEach(([ox, oy], i) => {
      // Caixa por massa, não por extremo: um respingo de grão numa borda
      // esticaria a caixa até lá e deslocaria o centro do recorte.
      const col = new Uint32Array(meiaL);
      const lin = new Uint32Array(meiaA);
      let massa = 0;
      for (let y = 0; y < meiaA; y++) {
        for (let x = 0; x < meiaL; x++) {
          if (ehFundo(((oy + y) * m.width + (ox + x)) * 4)) continue;
          col[x]++;
          lin[y]++;
          massa++;
        }
      }
      if (!massa) return;

      const faixa = (h) => {
        const corte = massa * 0.004;
        let s = 0,
          a = 0,
          b = h.length - 1;
        for (let k = 0; k < h.length; k++) {
          s += h[k];
          if (s > corte) {
            a = k;
            break;
          }
        }
        s = 0;
        for (let k = h.length - 1; k >= 0; k--) {
          s += h[k];
          if (s > corte) {
            b = k;
            break;
          }
        }
        return [a, b];
      };

      const [x0, x1] = faixa(col);
      const [y0, y1] = faixa(lin);
      const larg = x1 - x0 + 1;
      const alt = y1 - y0 + 1;
      const lado = Math.max(larg, alt) / OCUPACAO;
      const cx = ox + x0 + larg / 2;
      const cy = oy + y0 + alt / 2;

      const s = document.createElement("canvas");
      s.width = LADO;
      s.height = LADO;
      const sc = s.getContext("2d", { willReadFrequently: true });
      sc.imageSmoothingQuality = "high";
      sc.drawImage(img, cx - lado / 2, cy - lado / 2, lado, lado, 0, 0, LADO, LADO);

      /**
       * O creme vira transparência — mas por alcance a partir da borda, não por
       * cor.
       *
       * Apagar todo pixel parecido com o fundo é o caminho óbvio e está errado:
       * o brilho dentro da bolha também é quase creme, e some junto, abrindo
       * buracos cinzentos no meio do desenho. Deu exatamente isso na primeira
       * tentativa. Fundo é o que se ALCANÇA vindo da margem sem atravessar o
       * contorno — o que estiver cercado pela bolha fica, por mais claro que
       * seja. Mesmo método que limpou o quadriculado dos bebês semanais.
       *
       * A sombra elíptica debaixo da bolha é apagada junto, e isso é
       * intencional: ela é creme sobre creme, então no céu escuro da trilha
       * viraria uma poça bege. Quem faz sombra na tela é o CSS, que sabe a cor
       * do fundo em que está.
       */
      const px = sc.getImageData(0, 0, LADO, LADO);
      const q = px.data;
      const perto = (k, tol) =>
        Math.abs(q[k] - canto[0]) + Math.abs(q[k + 1] - canto[1]) + Math.abs(q[k + 2] - canto[2]) <=
        tol;

      const fundo = new Uint8Array(LADO * LADO);
      const fila = [];
      for (let x = 0; x < LADO; x++) {
        fila.push(x, (LADO - 1) * LADO + x);
      }
      for (let y = 0; y < LADO; y++) {
        fila.push(y * LADO, y * LADO + LADO - 1);
      }
      /**
       * Tolerância do alcance. Não suba este número sem olhar a cobertura que
       * o script imprime.
       *
       * A sombra elíptica sob a bolha é creme mais escuro e sobrevive neste
       * valor. A tentação é subir a tolerância até ela ir embora — tentei 4,2 e
       * a cobertura despencou de 41% para 9%: o interior pálido da bolha passou
       * a ser alcançável pela borda e o preenchimento comeu o personagem. A
       * sombra e o corpo são perto demais em cor para um limiar separar. Se ela
       * incomodar, o conserto é gerar a folha SEM sombra, não apertar aqui.
       */
      const TOL_FUNDO = TOLERANCIA * 2.4;
      while (fila.length) {
        const i = fila.pop();
        if (fundo[i]) continue;
        if (!perto(i * 4, TOL_FUNDO)) continue;
        fundo[i] = 1;
        const x = i % LADO;
        const y = (i / LADO) | 0;
        if (x > 0) fila.push(i - 1);
        if (x < LADO - 1) fila.push(i + 1);
        if (y > 0) fila.push(i - LADO);
        if (y < LADO - 1) fila.push(i + LADO);
      }

      for (let i = 0; i < fundo.length; i++) {
        if (fundo[i]) q[i * 4 + 3] = 0;
      }
      // Suaviza a borda: pixel de desenho encostado no fundo perde um pouco de
      // opacidade, senão o recorte fica serrilhado sobre o céu.
      for (let y = 1; y < LADO - 1; y++) {
        for (let x = 1; x < LADO - 1; x++) {
          const i = y * LADO + x;
          if (fundo[i] || q[i * 4 + 3] === 0) continue;
          if (fundo[i - 1] || fundo[i + 1] || fundo[i - LADO] || fundo[i + LADO]) {
            q[i * 4 + 3] = 150;
          }
        }
      }
      sc.putImageData(px, 0, 0);

      let opacos = 0;
      for (let k = 3; k < q.length; k += 4) if (q[k] > 24) opacos++;

      resultado.push({
        nome: EXPRESSOES[i],
        webp: s.toDataURL("image/webp", 0.92).split(",")[1],
        cobertura: Math.round((opacos / (LADO * LADO)) * 100),
      });
    });

    return resultado;
  },
  { dados, LADO, OCUPACAO, TOLERANCIA, EXPRESSOES },
);

await navegador.close();

if (saidas.length !== EXPRESSOES.length) {
  console.error(`Esperava ${EXPRESSOES.length} expressões, recortei ${saidas.length}.`);
  process.exit(1);
}

for (const s of saidas) {
  const buf = Buffer.from(s.webp, "base64");
  writeFileSync(join(DESTINO, `${s.nome}.webp`), buf);
  // Os dois lados do erro. Cobertura alta = o fundo sobreviveu; baixa = o
  // preenchimento atravessou o contorno e comeu o desenho. A segunda já
  // aconteceu e é a mais traiçoeira, porque o arquivo sai pequeno e parece
  // que deu tudo certo.
  const aviso =
    s.cobertura > 92
      ? "  ⚠ quase nada virou transparente"
      : s.cobertura < 25
        ? "  ⚠ sobrou pouca tinta — o preenchimento pode ter comido o desenho"
        : "";
  console.log(
    `  ${s.nome.padEnd(12)} ${String(Math.round(buf.length / 1024)).padStart(3)} KB   ${s.cobertura}% de tinta${aviso}`,
  );
}
console.log(`\n${saidas.length} expressões em src/assets/bolha/`);
