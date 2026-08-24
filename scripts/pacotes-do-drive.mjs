/**
 * AS TRÊS ILUSTRAÇÕES DA LOJA DE SEMENTINHAS, recortadas da referência.
 *
 * ─── POR QUE RECORTAR, E NÃO REDESENHAR ─────────────────────────────────────
 *
 * O dono mandou o layout inteiro numa imagem só e pediu que ficasse "exatamente
 * dessa forma". Tudo o que é TEXTO, cor, botão e espaçamento eu consigo
 * reconstruir em CSS — e preciso, porque preço e saldo vêm do código e a tela
 * tem de responder a qualquer tamanho de celular.
 *
 * O que eu não consigo reproduzir é a arte: o saco de sementes, o pote e o
 * frasquinho. Esses três saem da imagem dele, no tamanho original, e viram
 * PNG com fundo transparente para pousarem sobre o gradiente do cartão que o
 * CSS desenha.
 *
 * ─── ⚠️ O RECORTE DE FUNDO É POR CONEXÃO COM A BORDA ────────────────────────
 *
 * O fundo do cartão é um gradiente CLARO, e a ilustração tem brilhos claros
 * dentro dela (o reflexo no vidro do pote, a etiqueta bege). Um limiar de
 * brilho comeria esses brilhos.
 *
 * Então o teste é o mesmo de `scripts/bebes/do-drive.mjs`: só vira transparente
 * o pixel claro-e-pouco-saturado que está LIGADO À BORDA do recorte. O reflexo
 * no meio do vidro não alcança a borda sem atravessar o contorno escuro do
 * desenho, então fica opaco por construção.
 *
 * A borda ganha uma rampa (não um corte seco) para não serrilhar sobre o
 * gradiente do cartão.
 *
 * ⚠️ ELE GRAVA PNG, e o app usa WEBP. A `pngjs` é o que sabe fazer o recorte
 * por inundação, e é ela que dita o formato de saída; a conversão é o passo
 * seguinte, medida e com trava de alfa:
 *
 *   node scripts/pacotes-do-drive.mjs <referencia.png> src/assets/pacotes
 *   node scripts/pacotes-para-webp.mjs src/assets/pacotes
 *
 * O segundo APAGA os PNG quando passa. 456 KB de PNG eram os três maiores
 * arquivos de imagem do build; em WebP são 90 KB, com o alfa idêntico casa
 * decimal a casa decimal e PSNR acima de 42 dB.
 *
 * Uso:
 *   node scripts/pacotes-do-drive.mjs <referencia.png> <pasta-destino>
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";

/**
 * As três caixas, MEDIDAS na referência de 853×1844.
 *
 * ⚠️ A DO GRANDE ESTAVA CORTANDO O DESENHO. Era `{x:95, y:800, w:320, h:278}`,
 * e uma auditoria mediu o estrago: **203 dos 310 pixels da primeira linha eram
 * opacos** (65% da largura), contra 9/299 no médio e 17/324 no pequeno. Ou
 * seja, o topo do monte de sementinhas terminava em corte reto — no cartão da
 * fita "MELHOR VALOR", que é o herói do layout que o dono pediu "exatamente
 * dessa forma".
 *
 * A extensão real do desenho, medida (topo do monte, base da sombra, e as duas
 * bordas laterais): **y 735–1049, x 74–403**. A caixa nova cobre isso com
 * folga, e `apara()` devolve o enquadramento justo depois.
 *
 * ⚠️ A fita "MELHOR VALOR" da REFERÊNCIA entra nessa caixa — ela cruza o canto
 * superior esquerdo do cartão. Ela não pode ser recortada junto (é desenhada em
 * CSS, para acompanhar o cartão quando ele muda de largura), e por isso o
 * recorte de fundo aprendeu a comê-la: ver `CORES_DE_FUNDO`.
 */
const CAIXAS = [
  { nome: "pacote-grande", x: 62, y: 722, w: 352, h: 336, fitaNoCanto: true },
  { nome: "pacote-medio", x: 66, y: 1118, w: 320, h: 284 },
  /* ⚠️ A do pequeno era LARGA DEMAIS (`w: 328`) e entrava no texto roxo
     "1.100 sementinhas" à direita — a trava de borda pegou 10% da coluna
     direita opaca. O frasquinho mede x 105–360, y 1460–1730. */
  { nome: "pacote-pequeno", x: 100, y: 1444, w: 272, h: 302 },
];

/** Claro e sem cor: candidato a fundo. */
const BRILHO_FUNDO = 214;
/** Onde o pixel passa a ser 100% opaco — a rampa vive entre os dois. */
const BRILHO_CHEIO = 176;
const CROMA_MAXIMA = 34;

function recorta(src, cx) {
  const out = new PNG({ width: cx.w, height: cx.h });
  for (let y = 0; y < cx.h; y++) {
    for (let x = 0; x < cx.w; x++) {
      const i = (src.width * (y + cx.y) + (x + cx.x)) << 2;
      const j = (cx.w * y + x) << 2;
      out.data[j] = src.data[i];
      out.data[j + 1] = src.data[i + 1];
      out.data[j + 2] = src.data[i + 2];
      out.data[j + 3] = 255;
    }
  }
  return out;
}

/**
 * A FITA "MELHOR VALOR" DA REFERÊNCIA, e por que ela não sai por cor.
 *
 * Ela cruza o canto superior esquerdo do cartão do pacote grande, e qualquer
 * caixa que contenha o saco inteiro contém um pedaço dela — o saco começa 65 px
 * para dentro, mas a fita é uma faixa diagonal no canto. Recortá-la junto está
 * fora de questão: a fita é desenhada em CSS, para acompanhar o cartão quando
 * ele muda de largura.
 *
 * ⚠️ TIREI ELA POR COR PRIMEIRO, e não funcionou. O verde chapado
 * (105,143,58) sai fácil, mas as LETRAS brancas por cima têm uma rampa inteira
 * de antisserrilhado entre o verde e o branco — medido: 214,221,133 ·
 * 170,191,141 · 129,159,92 · 152,176,114… uma dúzia de tons, cada um com dois
 * ou três pixels. Nenhuma tolerância pega essa rampa sem começar a comer o
 * saco, que é verde da mesma família.
 *
 * O que separa os dois com certeza é GEOMETRIA, não cor: a fita é um borrão
 * conectado que encosta no canto, e o saco não encosta em canto nenhum (há
 * fundo claro entre os dois). Então some o COMPONENTE inteiro que toca o canto
 * — letras, antisserrilhado e sombra junto, sem precisar acertar tom nenhum.
 *
 * É a mesma ideia de `bolha-do-drive.mjs`, que fica só com o maior componente
 * para descartar brilhos soltos. Aqui é o inverso: descarta-se um componente
 * conhecido em vez de guardar o maior — as sementinhas soltas no chão são
 * componentes próprios e precisam ficar.
 */
const CANTO_DA_FITA = 30;

/** Apaga o borrão opaco que encosta no canto superior esquerdo. */
function apagaFitaDoCanto(img) {
  const { width: w, height: h, data } = img;
  const opaco = (p) => data[(p << 2) + 3] > 8;
  const visto = new Uint8Array(w * h);
  const fila = [];
  for (let y = 0; y < CANTO_DA_FITA; y++) {
    for (let x = 0; x < CANTO_DA_FITA; x++) {
      const p = y * w + x;
      if (opaco(p) && !visto[p]) {
        visto[p] = 1;
        fila.push(p);
      }
    }
  }
  while (fila.length) {
    const p = fila.pop();
    data[(p << 2) + 3] = 0;
    const x = p % w;
    const vizinhos = [p - w, p + w];
    if (x > 0) vizinhos.push(p - 1);
    if (x < w - 1) vizinhos.push(p + 1);
    for (const q of vizinhos) {
      if (q < 0 || q >= w * h || visto[q] || !opaco(q)) continue;
      visto[q] = 1;
      fila.push(q);
    }
  }
}

/** Marca o fundo por inundação a partir das quatro bordas. */
function fundoLigadoABorda(img) {
  const { width: w, height: h, data } = img;
  const fundo = new Uint8Array(w * h);
  const candidato = (p) => {
    const i = p << 2;
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const croma = Math.max(r, g, b) - Math.min(r, g, b);
    const brilho = Math.max(r, g, b);
    return brilho > BRILHO_CHEIO && croma < CROMA_MAXIMA;
  };
  const fila = [];
  const põe = (p) => {
    if (p < 0 || p >= w * h || fundo[p] || !candidato(p)) return;
    fundo[p] = 1;
    fila.push(p);
  };
  for (let x = 0; x < w; x++) {
    põe(x);
    põe((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    põe(y * w);
    põe(y * w + w - 1);
  }
  while (fila.length) {
    const p = fila.pop();
    const x = p % w;
    if (x > 0) põe(p - 1);
    if (x < w - 1) põe(p + 1);
    põe(p - w);
    põe(p + w);
  }
  return fundo;
}

function aplicaAlfa(img, fundo) {
  const { width: w, height: h, data } = img;
  for (let p = 0; p < w * h; p++) {
    if (!fundo[p]) continue;
    const i = p << 2;
    const brilho = Math.max(data[i], data[i + 1], data[i + 2]);
    /* Rampa: quanto mais claro, mais transparente. Corte seco serrilha a
       borda sobre o gradiente do cartão. */
    const t = (brilho - BRILHO_CHEIO) / (BRILHO_FUNDO - BRILHO_CHEIO);
    data[i + 3] = Math.round(255 * (1 - Math.min(1, Math.max(0, t))));
  }
}

/** Apara as bordas que ficaram totalmente transparentes. */
function apara(img) {
  const { width: w, height: h, data } = img;
  let x0 = w,
    y0 = h,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (data[((w * y + x) << 2) + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  if (x1 < 0) return img;
  const nw = x1 - x0 + 1,
    nh = y1 - y0 + 1;
  const out = new PNG({ width: nw, height: nh });
  for (let y = 0; y < nh; y++)
    for (let x = 0; x < nw; x++) {
      const i = (w * (y + y0) + (x + x0)) << 2;
      const j = (nw * y + x) << 2;
      out.data[j] = data[i];
      out.data[j + 1] = data[i + 1];
      out.data[j + 2] = data[i + 2];
      out.data[j + 3] = data[i + 3];
    }
  return out;
}

const [, , origem, destino] = process.argv;
if (!origem || !destino) {
  console.error("uso: node scripts/pacotes-do-drive.mjs <referencia.png> <pasta-destino>");
  process.exit(1);
}
const src = PNG.sync.read(readFileSync(origem));
if (src.width !== 853 || src.height !== 1844) {
  console.error(
    `⚠️ a referência mudou de tamanho (${src.width}×${src.height}, esperado 853×1844).\n` +
      "As caixas de recorte foram MEDIDAS nessa imagem — refaça a medição antes de rodar.",
  );
  process.exit(1);
}
mkdirSync(destino, { recursive: true });
for (const cx of CAIXAS) {
  /* ⚠️ ANTES de aparar — é a caixa CRUA que responde "o recorte cortou o
     desenho?". Medir a aparada não responde nada: `apara()` encosta o
     enquadramento na tinta por definição, então a primeira linha da imagem
     aparada SEMPRE tem tinta. A primeira versão desta trava media a aparada e
     reprovava o frasquinho por ele ter uma rolha de topo reto — um alarme sobre
     o próprio andaime. */
  const cru = (() => {
    const c = recorta(src, cx);
    aplicaAlfa(c, fundoLigadoABorda(c));
    if (cx.fitaNoCanto) apagaFitaDoCanto(c);
    return c;
  })();
  const img = apara(cru);
  const opacos = (() => {
    let n = 0;
    for (let p = 0; p < img.width * img.height; p++) if (img.data[(p << 2) + 3] > 200) n++;
    return n;
  })();
  const frac = opacos / (img.width * img.height);

  /* ─── ⚠️ A TRAVA QUE FALTAVA: O DESENHO ENCOSTOU NA BORDA? ────────────────
     O modo de falha de uma caixa medida à mão é CORTAR o desenho, e as duas
     travas antigas (pouca tinta / quase tudo opaco) não veem isso: um desenho
     decapitado tem exatamente a mesma fração de tinta de um inteiro.

     Foi assim que o pacote grande ficou meses com 65% da primeira linha opaca
     — o topo do monte de sementinhas terminando em corte reto no cartão da
     fita "MELHOR VALOR". Uma auditoria mediu; o script não tinha como saber.

     Os scripts irmãos têm a trava equivalente: `bebes/do-drive.mjs` aborta sem
     alfa, `sprite-de-video.mjs` aborta com a grade incompleta. Este passa a
     abortar quando o recorte toca o desenho.

     O limite é 8% da borda CRUA, medido como a maior corrida contígua: com
     folga na caixa o desenho não encosta em nada, e faísca decorativa não faz
     traço. 65% de uma linha, que foi o que o pacote grande tinha, é um desenho
     decapitado. */
  const LIMITE_BORDA = 0.08;
  /* ⚠️ A maior sequência CONTÍGUA, e não a contagem total. Um desenho cortado
     deixa um traço longo e inteiriço na borda; os brilhos decorativos do cartão
     deixam pontinhos espalhados. Contando o total, as faíscas do canto davam 7%
     e reprovavam um recorte perfeito — alarme sobre o próprio andaime, de novo. */
  const maiorCorrida = (n, opacoEm) => {
    let melhor = 0;
    let atual = 0;
    for (let i = 0; i < n; i++) {
      atual = opacoEm(i) ? atual + 1 : 0;
      if (atual > melhor) melhor = atual;
    }
    return melhor / n;
  };
  const linha = (y) =>
    maiorCorrida(cru.width, (x) => cru.data[((cru.width * y + x) << 2) + 3] > 200);
  const coluna = (x) =>
    maiorCorrida(cru.height, (y) => cru.data[((cru.width * y + x) << 2) + 3] > 200);
  const bordas = {
    topo: linha(0),
    base: linha(cru.height - 1),
    esquerda: coluna(0),
    direita: coluna(cru.width - 1),
  };
  const cortadas = Object.entries(bordas).filter(([, v]) => v > LIMITE_BORDA);

  writeFileSync(join(destino, `${cx.nome}.png`), PNG.sync.write(img));
  console.log(
    `${cx.nome}.png  ${img.width}×${img.height}  tinta ${(frac * 100).toFixed(1)}%  ` +
      `bordas ${Object.entries(bordas)
        .map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`)
        .join(" · ")}`,
  );
  if (frac < 0.12) console.error(`  ⚠️ pouca tinta — o recorte pode ter comido o desenho.`);
  if (frac > 0.9) console.error(`  ⚠️ quase tudo opaco — o fundo pode não ter saído.`);
  if (cortadas.length) {
    console.error(
      `  ⚠️ O DESENHO ESTÁ CORTADO em: ${cortadas
        .map(([k, v]) => `${k} (${(v * 100).toFixed(0)}%)`)
        .join(", ")}.\n` + `     Amplie a caixa de ${cx.nome} em CAIXAS e rode de novo.`,
    );
    process.exitCode = 1;
  }
}
