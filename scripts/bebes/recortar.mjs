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
 * RECORTA O FUNDO CINZA das 39 ilustrações geradas.
 *
 * O prompt pede `#9a9a9a` chapado de borda a borda justamente para que este
 * passo seja possível. Entra PNG opaco com fundo cinza, sai PNG com alfa —
 * pronto para o `normalizar.mjs`, que reenquadra e converte para WebP.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ALAGAMENTO A PARTIR DA BORDA, E NÃO "É CINZA? ENTÃO SOME"
 *
 * Um teste por distância de cor abre BURACOS no bebê. A pele tem brilhos
 * especulares quase acinzentados na testa e no ombro, e o cordão tem sombra
 * própria: qualquer limiar que mate o fundo mata esses pixels também. O defeito
 * é invisível sobre fundo claro e escancarado sobre o céu noturno da home — foi
 * exatamente assim que ele passou despercebido nas bolhas.
 *
 * Fundo é o que se ALCANÇA a partir da borda sem atravessar o contorno. Um
 * brilho cercado de pele não é alcançável, então sobrevive por construção, sem
 * depender de limiar nenhum.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A TOLERÂNCIA
 *
 * 2,4x o desvio medido do fundo. Este número tem história: em outra série eu
 * subi para 4,2x para matar uma sombra projetada e a tinta caiu de 41% para 9%
 * — o alagamento tinha vazado para dentro do personagem por uma fresta de
 * antialiasing. Por isso o script IMPRIME a fração de tinta de cada arquivo e
 * reclama nos dois sentidos: tinta de menos significa vazamento, tinta demais
 * significa fundo sobrando.
 *
 * Uso:  node scripts/bebes/recortar.mjs [entrada] [saida]
 */

import { chromium } from "playwright";
import { readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, basename } from "node:path";

const ENTRADA = resolve(process.argv[2] ?? "scripts/bebes/brutas");
const SAIDA = resolve(process.argv[3] ?? "scripts/bebes/recortadas");

/** Múltiplo do desvio do fundo abaixo do qual o pixel ainda é fundo. */
const TOLERANCIA = 2.4;

/** Faixa de tinta plausível. Fora disso o recorte errou — ver comentário acima. */
const TINTA_MINIMA = 0.12;
const TINTA_MAXIMA = 0.55;

let arquivos = [];
try {
  arquivos = readdirSync(ENTRADA)
    .filter((f) => f.endsWith(".png"))
    .sort();
} catch {
  console.error(`A pasta de entrada não existe: ${ENTRADA}`);
  process.exit(1);
}
if (!arquivos.length) {
  console.error(`Nenhum .png em ${ENTRADA}`);
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
  const saida = await pagina.evaluate(
    async ([nome, tol, N]) => {
      const img = new Image();
      img.src = nome;
      await img.decode();
      const L = img.naturalWidth;
      const A = img.naturalHeight;
      const c = document.createElement("canvas");
      c.width = L;
      c.height = A;
      const cx = c.getContext("2d", { willReadFrequently: true });
      cx.drawImage(img, 0, 0);
      const d = cx.getImageData(0, 0, L, A);
      const p = d.data;

      /* A cor do fundo sai da MÉDIA da moldura de N pixels, e o desvio dessa
         mesma moldura vira a escala da tolerância. Ler um pixel só (o canto)
         faria o ruído daquele pixel definir o corte da imagem inteira. */
      let sr = 0,
        sg = 0,
        sb = 0,
        n = 0;
      const naMoldura = (x, y) => x < N || y < N || x >= L - N || y >= A - N;
      for (let y = 0; y < A; y++)
        for (let x = 0; x < L; x++) {
          if (!naMoldura(x, y)) continue;
          const i = (y * L + x) * 4;
          sr += p[i];
          sg += p[i + 1];
          sb += p[i + 2];
          n++;
        }
      const fr = sr / n,
        fg = sg / n,
        fb = sb / n;
      let sq = 0;
      for (let y = 0; y < A; y++)
        for (let x = 0; x < L; x++) {
          if (!naMoldura(x, y)) continue;
          const i = (y * L + x) * 4;
          sq += (p[i] - fr) ** 2 + (p[i + 1] - fg) ** 2 + (p[i + 2] - fb) ** 2;
        }
      const desvio = Math.sqrt(sq / (n * 3));
      const corte = Math.max(12, desvio * tol);

      /* Alagamento em 4 direções a partir de toda a borda, com pilha explícita:
         recursão em 2048x2048 estoura a pilha do JS. */
      const fundo = new Uint8Array(L * A);
      const pilha = [];
      const ehFundo = (i4) => Math.hypot(p[i4] - fr, p[i4 + 1] - fg, p[i4 + 2] - fb) <= corte;
      const empurra = (x, y) => {
        if (x < 0 || y < 0 || x >= L || y >= A) return;
        const k = y * L + x;
        if (fundo[k]) return;
        if (!ehFundo(k * 4)) return;
        fundo[k] = 1;
        pilha.push(k);
      };
      for (let x = 0; x < L; x++) {
        empurra(x, 0);
        empurra(x, A - 1);
      }
      for (let y = 0; y < A; y++) {
        empurra(0, y);
        empurra(L - 1, y);
      }
      while (pilha.length) {
        const k = pilha.pop();
        const x = k % L,
          y = (k / L) | 0;
        empurra(x + 1, y);
        empurra(x - 1, y);
        empurra(x, y + 1);
        empurra(x, y - 1);
      }

      /* Alfa suave na fronteira: o pixel de fundo some, o de assunto fica, e o
         que está entre o corte e o dobro dele entra com alfa proporcional. Sem
         isso a silhueta fica serrilhada e o cinza vaza como franja. */
      let tinta = 0;
      for (let k = 0; k < L * A; k++) {
        const i = k * 4;
        if (fundo[k]) {
          p[i + 3] = 0;
          continue;
        }
        const dist = Math.hypot(p[i] - fr, p[i + 1] - fg, p[i + 2] - fb);
        p[i + 3] = dist >= corte * 2 ? 255 : Math.round((dist / (corte * 2)) * 255);
        if (p[i + 3] > 30) tinta++;
      }
      cx.putImageData(d, 0, 0);
      return {
        png: c.toDataURL("image/png").split(",")[1],
        tinta: +(tinta / (L * A)).toFixed(3),
        corte: Math.round(corte),
      };
    },
    [arquivo, TOLERANCIA, 6],
  );

  writeFileSync(`${SAIDA}/${basename(arquivo)}`, Buffer.from(saida.png, "base64"));
  const alerta =
    saida.tinta < TINTA_MINIMA
      ? "VAZOU (o alagamento entrou no bebê)"
      : saida.tinta > TINTA_MAXIMA
        ? "SOBROU FUNDO"
        : "";
  relatorio.push({
    arquivo,
    tinta: `${(saida.tinta * 100).toFixed(1)}%`,
    corte: saida.corte,
    alerta,
  });
}

await navegador.close();
console.table(relatorio);

const ruins = relatorio.filter((r) => r.alerta);
if (ruins.length) {
  console.log(`\n${ruins.length} recorte(s) fora da faixa plausível:`);
  for (const r of ruins) console.log(`  ✗ ${r.arquivo}: ${r.alerta} (${r.tinta})`);
  process.exit(1);
}
console.log(`\n✓ ${relatorio.length} recortadas em ${SAIDA}`);
