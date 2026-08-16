/**
 * O HERÓI DA LOJA DE SEMENTINHAS — o fundo pintado e a bolha com broto.
 *
 * ─── POR QUE ISTO EXISTE ────────────────────────────────────────────────────
 *
 * A primeira versão desta tela AMOSTROU o céu da referência e reconstruiu o
 * herói como um `linear-gradient` de onze paradas. O gradiente ficou fiel de
 * cor e completamente diferente de resultado: a referência é uma ILUSTRAÇÃO de
 * jardim — céu, nuvem, grama, flores, folhas ao vento, bokeh — e um degradê não
 * tem nada disso.
 *
 * O dono comparou as duas telas e resumiu: "uma tem cara de feita aqui, a outra
 * de profissional". A diferença era essa, e ela era uma escolha minha.
 *
 * ─── ⚠️ O FUNDO SAI COMO IMAGEM, NÃO COMO GRADIENTE ─────────────────────────
 *
 * E vai com `object-fit: cover` numa caixa de altura fixa, como o céu da home
 * já faz (`.dc-hero-tela`). A lição de lá vale aqui: `cover` amplia de menos de
 * 1% nos iPhones reais, e é isso que permite a arte preencher a tela sem a
 * deformação que `preserveAspectRatio="none"` causaria.
 *
 * ⚠️ A ALTURA DO HERÓI FOI MEDIDA, não estimada: a grama termina em y≈663 e a
 * lista de cartões começa no cinza claro (246,246,226) em y≈670. O corte vai em
 * 666 — dentro da transição, sem levar um filete do fundo da lista junto.
 *
 * ─── A BOLHA COM BROTO É OUTRA ARTE ─────────────────────────────────────────
 *
 * Nenhuma das oito expressões que o app tem é esta: ela tem um broto de duas
 * folhas saindo do topo. É o mascote da LOJA, e usar a `feliz` no lugar dela
 * foi o que fez o herói perder metade da identidade.
 *
 * Uso:
 *   node scripts/loja-heroi-do-drive.mjs <referencia.png> <pasta-destino>
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";

/** MEDIDO na referência de 853×1844. */
const ALTURA_DO_HEROI = 666;

/**
 * A bolha com broto.
 *
 * ⚠️ A caixa vai até o TOPO da folha (y=180), e não até o topo da esfera: o
 * broto é parte do desenho, e cortá-lo deixaria a bolha careca — o mesmo erro
 * que decapitou o saco de sementes na primeira leva.
 */
const BOLHA = { x: 486, y: 180, w: 350, h: 470 };

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

const [, , origem, destino] = process.argv;
if (!origem || !destino) {
  console.error("uso: node scripts/loja-heroi-do-drive.mjs <referencia.png> <pasta-destino>");
  process.exit(1);
}
const src = PNG.sync.read(readFileSync(origem));
if (src.width !== 853 || src.height !== 1844) {
  console.error(
    `⚠️ a referência mudou de tamanho (${src.width}×${src.height}, esperado 853×1844).\n` +
      "As caixas foram MEDIDAS nessa imagem — refaça a medição antes de rodar.",
  );
  process.exit(1);
}
mkdirSync(destino, { recursive: true });

/* ── O HERÓI INTEIRO, COMO IMAGEM ───────────────────────────────────────────
   ⚠️ ISTO É UMA COLAGEM, DE PROPÓSITO — e a pergunta do dono foi exatamente
   essa: "você só não consegue colar ela, já que é o mesmo modelo de proporção,
   e depois atribuir as funções?".

   Consegue, e é a escolha certa AQUI. Tudo neste herói é estático: o jardim, o
   título "Loja de Sementinhas", a frase, o selo "Compra 100% segura" e a bolha
   com broto. Nada disso depende de dado nenhum, então reconstruir em CSS é
   trabalho para chegar num resultado pior.

   ⚠️ MAS A LINHA DIVISÓRIA IMPORTA: o que é DADO não pode virar imagem. O
   saldo (118 na referência) e os PREÇOS dos cartões ficam em código — um preço
   pintado numa imagem vira mentira no dia em que ele mudar, e preço errado é o
   defeito mais caro que existe. Por isso só o herói é colagem; os cartões são
   montados com as ilustrações recortadas.

   ⚠️ E o texto do herói vira `alt`: quem usa leitor de tela não perde o
   título nem a frase só porque eles são pixels agora.

   O botão de voltar e a pílula de saldo estão QUEIMADOS nesta arte (x 38..135
   e x 646..813, y 47..149 — medidos). Não os apago: os controles de verdade
   são desenhados exatamente por cima, e cobrem. Apagar exigiria inventar
   jardim onde não há, e o resultado seria pior que a sobreposição. */
const fundo = recorta(src, { x: 0, y: 0, w: src.width, h: ALTURA_DO_HEROI });
writeFileSync(join(destino, "heroi-fundo.png"), PNG.sync.write(fundo));
console.log(`heroi-fundo.png  ${fundo.width}×${fundo.height}  (herói inteiro, com título e bolha)`);

/* A cor do ÚLTIMO pixel do fundo, para a emenda com o creme da lista não virar
   uma aresta — a mesma solução da `corDeBaixo` do céu da home. */
const iBase = (src.width * (ALTURA_DO_HEROI - 1) + Math.floor(src.width / 2)) << 2;
const hex = (v) => v.toString(16).padStart(2, "0");
console.log(
  `cor do pé do herói: #${hex(src.data[iBase])}${hex(src.data[iBase + 1])}${hex(src.data[iBase + 2])}`,
);

/* ⚠️ A BOLHA NÃO É MAIS RECORTADA À PARTE, e a tentativa está registrada
   porque ela falhou de um jeito instrutivo: a bolha é de VIDRO — o interior
   dela É o fundo, visto através. A inundação por semelhança de cor atravessou o
   contorno e comeu o miolo inteiro, deixando só o broto e a boca. Não há
   tolerância que separe "céu" de "céu visto através de uma bolha".

   Com o herói inteiro virando colagem, o problema desaparece: a bolha vai junto
   com o fundo, exatamente onde a arte a pôs. */
