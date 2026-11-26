/**
 * Uma expressão da Bolha, do Drive para o APP (`mobile/assets/bolha/`), sem
 * nada cortado.
 *
 *   node mobile/scripts/bolha-do-drive.mjs <origem.png> <saida.png>
 *   cwebp -q 95 -m 6 -alpha_q 100 <saida.png> -o mobile/assets/bolha/<humor>.webp
 *
 * É o `scripts/bolha-do-drive.mjs` do site (que grava em `src/assets`, e o
 * site não muda mais), com um passo a mais. As originais estão no Drive do
 * dono, na pasta "Imagens Obstétrica" ("Bebê bolha expressão …").
 *
 * O PASSO NOVO (23/11/2026, o dono: "a imagem dele de coração está ficando
 * cortada em cima"; "as imagens originais têm no Drive"): o teto da escala do
 * script do site mede só o componente PRINCIPAL (a bolha e o que encosta
 * nela). Os enfeites SOLTOS — a bolhinha do alto da apaixonada — ficavam fora
 * da conta e saíam cortados na borda da tela de 960. Aqui conta toda a tinta
 * (alfa > 24; ciscos de menos de 200 px saem): a bolha guarda o tamanho e
 * DESCE o mínimo para o alto caber com 14 px de folga, e só encolhe se nem
 * descendo couber.
 *
 * Para refazer uma arte que já está no app IGUAL (mesmo tamanho e lugar da
 * bolha), passe a escala e o deslocamento dela: `ESCALA=0.827 OFFX=-66.76
 * OFFY=-90.06` (a estudiosa, feita em ago/2026 com a primeira versão do
 * script, que media a faixa à mão). A apaixonada sai igual sem isso.
 *
 * Sem o Chromium do Playwright instalado, usa o Google Chrome do Mac
 * (`CHROME=<caminho>` troca), numa janela invisível e num perfil temporário.
 *
 * O que vem abaixo é o script do site, passo a passo (o recorte de fundo, o
 * componente principal, o ajuste de círculo e a escala), mais o passo 5.
 */
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { readFileSync, writeFileSync } from "node:fs";

const [, , ORIGEM, DESTINO] = process.argv;
if (!ORIGEM || !DESTINO) {
  console.error("uso: node bolha-inteira.mjs <origem.png> <saida.png>");
  process.exit(1);
}
/** A folga mínima entre qualquer pedaço da arte e a borda da tela. */
const MARGEM = 14;
/** A escala e o deslocamento da arte que já está no app (para repeti-la igual). */
const FIXO = process.env.ESCALA
  ? {
      escala: Number(process.env.ESCALA),
      offX: Number(process.env.OFFX),
      offY: Number(process.env.OFFY),
    }
  : null;

/** A esfera-alvo, medida em feliz.webp com o mesmo método (ver commit). */
const ALVO = { diametro: 663, cx: 459, cy: 396 };
/** Passo da varredura de linhas, em pixels da origem (~1250px de lado). */
const PASSO = 5;
/** Salto de largura, entre duas linhas consecutivas do passo, que denuncia
 *  "saiu da bolha e entrou no acessório". Folgado o bastante pra curvatura
 *  normal de um círculo de raio ~300-450px não disparar falso positivo. */
const SALTO_MAXIMO = 20;

const uri = `data:image/png;base64,${readFileSync(ORIGEM).toString("base64")}`;
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const nav = await chromium.launch(
  existsSync(CHROME) ? { executablePath: CHROME, headless: true } : {},
);
const page = await nav.newPage();

const saida = await page.evaluate(
  async ([uri, ALVO, PASSO, SALTO_MAXIMO, MARGEM, FIXO]) => {
    const img = new Image();
    img.src = uri;
    await img.decode();
    const W = img.naturalWidth,
      H = img.naturalHeight;

    const tela = (w, h) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      return [c, c.getContext("2d", { willReadFrequently: true })];
    };

    const [c0, g0] = tela(W, H);
    g0.drawImage(img, 0, 0);
    const original = g0.getImageData(0, 0, W, H);
    const px = original.data;
    const N = W * H;

    /* ⚠️ ALFA DE VERDADE É ALFA QUE VARIA — mesma checagem de
       `bebes/do-drive.mjs`. Um canal cheio de 255 é o mesmo que não ter
       canal. Quando a arte já chega recortada (algumas do Drive vêm assim,
       outras não — não dá pra supor), o passo 1 inteiro é pulado: rodar a
       porta de croma+brilho por cima de um alfa que já é real jogaria fora
       a transparência de verdade e trocaria por uma pior, estimada. */
    let temAlfaReal = false;
    for (let i = 3; i < px.length; i += 4) {
      if (px[i] < 250) {
        temAlfaReal = true;
        break;
      }
    }

    /* ── 1. RECORTE DE FUNDO (mesmo algoritmo de bebes/do-drive.mjs) ────── */
    const B = [px[0], px[1], px[2]];
    const alfa = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      const i = k * 4;
      const r = px[i],
        g = px[i + 1],
        b = px[i + 2];
      const menor = Math.min(r, g, b);
      const maior = Math.max(r, g, b);
      const porta = Math.max(0, Math.min(1, (maior - menor - 4) / 6));
      const brilho = Math.max(0, Math.min(1, (250 - menor) / 30));
      alfa[k] = porta * brilho;
    }
    const alcanca = new Uint8Array(N);
    const fila = new Int32Array(N);
    let fim = 0;
    const poe = (k) => {
      if (!alcanca[k] && alfa[k] < 0.995) {
        alcanca[k] = 1;
        fila[fim++] = k;
      }
    };
    for (let x = 0; x < W; x++) {
      poe(x);
      poe((H - 1) * W + x);
    }
    for (let y = 0; y < H; y++) {
      poe(y * W);
      poe(y * W + W - 1);
    }
    for (let cabeca = 0; cabeca < fim; cabeca++) {
      const k = fila[cabeca];
      const x = k % W;
      const y = (k - x) / W;
      if (x > 0) poe(k - 1);
      if (x < W - 1) poe(k + 1);
      if (y > 0) poe(k - W);
      if (y < H - 1) poe(k + W);
    }
    let fundoNeutro = 0;
    for (let k = 0; k < N && !temAlfaReal; k++) {
      const i = k * 4;
      const a = alcanca[k] ? alfa[k] : 1;
      if (a >= 0.999) {
        px[i + 3] = 255;
        continue;
      }
      if (a <= 0.001) {
        px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0;
        fundoNeutro++;
        continue;
      }
      for (let ch = 0; ch < 3; ch++) {
        px[i + ch] = Math.max(0, Math.min(255, Math.round((px[i + ch] - (1 - a) * B[ch]) / a)));
      }
      px[i + 3] = Math.round(a * 255);
    }
    g0.putImageData(original, 0, 0);

    /* ── 2. SÓ O COMPONENTE PRINCIPAL ─────────────────────────────────────
       Rotula por 4-vizinhos sobre o alfa recortado (>128 = tinta) e fica só
       com o maior — brilhos, confetes e bolhinhas soltas no fundo são
       componentes pequenos e separados, e saem sozinhos daqui. */
    const depois = g0.getImageData(0, 0, W, H).data;
    const opaco = new Uint8Array(N);
    for (let k = 0; k < N; k++) opaco[k] = depois[k * 4 + 3] > 128 ? 1 : 0;

    const rotulo = new Int32Array(N).fill(-1);
    let maiorId = -1,
      maiorCont = 0;
    const pilha = new Int32Array(N);
    for (let k0 = 0; k0 < N; k0++) {
      if (!opaco[k0] || rotulo[k0] >= 0) continue;
      const id = k0; // usa o próprio índice inicial como id, evita array de comps
      let topo = 0;
      pilha[topo++] = k0;
      rotulo[k0] = id;
      let cont = 0;
      while (topo > 0) {
        const k = pilha[--topo];
        cont++;
        const x = k % W;
        if (x > 0 && opaco[k - 1] && rotulo[k - 1] < 0) {
          rotulo[k - 1] = id;
          pilha[topo++] = k - 1;
        }
        if (x < W - 1 && opaco[k + 1] && rotulo[k + 1] < 0) {
          rotulo[k + 1] = id;
          pilha[topo++] = k + 1;
        }
        if (k - W >= 0 && opaco[k - W] && rotulo[k - W] < 0) {
          rotulo[k - W] = id;
          pilha[topo++] = k - W;
        }
        if (k + W < N && opaco[k + W] && rotulo[k + W] < 0) {
          rotulo[k + W] = id;
          pilha[topo++] = k + W;
        }
      }
      if (cont > maiorCont) {
        maiorCont = cont;
        maiorId = id;
      }
    }

    /* ── 3. FAIXA CONTÍNUA SEM SALTO + AJUSTE DE CÍRCULO ─────────────────── */
    const linhas = [];
    for (let y = 0; y < H; y += PASSO) {
      let x0 = -1,
        x1 = -1;
      const base = y * W;
      for (let x = 0; x < W; x++) {
        if (rotulo[base + x] === maiorId) {
          if (x0 < 0) x0 = x;
          x1 = x;
        }
      }
      linhas.push({ y, x0, x1, largura: x0 < 0 ? 0 : x1 - x0 + 1 });
    }

    // maior sequência contígua (no PASSO) onde a largura muda pouco de uma
    // linha pra próxima — é aí que não há acessório grudado naquela altura.
    let melhorIni = -1,
      melhorFim = -1,
      melhorTam = 0;
    let iniAtual = -1;
    for (let i = 0; i < linhas.length; i++) {
      const valida = linhas[i].largura > 0;
      const continuaSemSalto =
        valida &&
        i > 0 &&
        linhas[i - 1].largura > 0 &&
        linhas[i].y - linhas[i - 1].y === PASSO &&
        Math.abs(linhas[i].largura - linhas[i - 1].largura) <= SALTO_MAXIMO;
      if (valida && (iniAtual < 0 || !continuaSemSalto)) iniAtual = i;
      if (valida) {
        const tam = i - iniAtual + 1;
        if (tam > melhorTam) {
          melhorTam = tam;
          melhorIni = iniAtual;
          melhorFim = i;
        }
      } else {
        iniAtual = -1;
      }
    }
    const faixa = linhas.slice(melhorIni, melhorFim + 1);
    const pts = [];
    for (const l of faixa) {
      pts.push({ x: l.x0, y: l.y });
      pts.push({ x: l.x1, y: l.y });
    }

    function ajustar(pontos) {
      const S = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ];
      const T = [0, 0, 0];
      for (const { x, y } of pontos) {
        const row = [x, y, 1];
        const alvo = x * x + y * y;
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) S[i][j] += row[i] * row[j];
          T[i] += row[i] * alvo;
        }
      }
      const M = S.map((row, i) => [...row, T[i]]);
      for (let i = 0; i < 3; i++) {
        let p = i;
        for (let r = i + 1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
        [M[i], M[p]] = [M[p], M[i]];
        const piv = M[i][i];
        for (let j = i; j <= 3; j++) M[i][j] /= piv;
        for (let r = 0; r < 3; r++) {
          if (r === i) continue;
          const f = M[r][i];
          for (let j = i; j <= 3; j++) M[r][j] -= f * M[i][j];
        }
      }
      const A = M[0][3],
        Bc = M[1][3],
        C = M[2][3];
      const cx = A / 2,
        cy = Bc / 2;
      const r = Math.sqrt(Math.max(0, C + cx * cx + cy * cy));
      return { cx, cy, r };
    }

    const circulo = ajustar(pts);
    const diametro = 2 * circulo.r;

    /* ── 4. ESCALA E DESLOCA PRA ESFERA-ALVO ─────────────────────────────── *
     * ⚠️ A ESCALA CEDE QUANDO OS EXTRAS NÃO CABEM — mesma regra já registrada
     * em `bolha.tsx` pro chapéu de festa do `comemorando` e o ZZZ do
     * `dormindo`: "bolha um tico menor é melhor que acessório cortado ao
     * meio". Sem isto, halteres e bolas de pilates bem maiores que qualquer
     * acessório anterior estourariam a tela de 960 depois de escalados pra
     * bater o diâmetro exato. O teto sai do bounding box do componente
     * PRINCIPAL inteiro (não só da esfera) — inclui todo acessório grudado
     * na bolha — testado nos quatro lados (a bolha raramente fica no centro
     * geométrico do próprio componente). */
    let escala = ALVO.diametro / diametro;
    let x0Comp = Infinity,
      x1Comp = -Infinity,
      y0Comp = Infinity,
      y1Comp = -Infinity;
    for (let k = 0; k < N; k++) {
      if (rotulo[k] !== maiorId) continue;
      const x = k % W,
        y = (k - x) / W;
      if (x < x0Comp) x0Comp = x;
      if (x > x1Comp) x1Comp = x;
      if (y < y0Comp) y0Comp = y;
      if (y > y1Comp) y1Comp = y;
    }
    const tetoEscala = Math.min(
      ALVO.cx / (circulo.cx - x0Comp),
      (960 - ALVO.cx) / (x1Comp - circulo.cx),
      ALVO.cy / (circulo.cy - y0Comp),
      (960 - ALVO.cy) / (y1Comp - circulo.cy),
    );
    const cedeu = tetoEscala < escala;
    if (cedeu) escala = tetoEscala * 0.98; // 2% de folga, não encosta na borda

    /* ── 5. NADA CORTADO (23/11/2026) — o teto acima mede só o componente
       PRINCIPAL; os enfeites soltos (a bolhinha do alto da apaixonada)
       ficavam de fora da conta e saíam cortados na borda. Aqui conta toda a
       tinta (alfa > 24, sem ciscos de menos de 200 px): a bolha guarda o
       tamanho e DESCE o mínimo para o alto caber com folga; só encolhe se nem
       descendo couber. */
    const tinta = new Uint8Array(N);
    for (let k = 0; k < N; k++) tinta[k] = depois[k * 4 + 3] > 24 ? 1 : 0;
    const visto = new Uint8Array(N);
    let y0 = Infinity,
      y1 = -Infinity,
      x0 = Infinity,
      x1 = -Infinity;
    const ciscos = [];
    for (let k0 = 0; k0 < N; k0++) {
      if (!tinta[k0] || visto[k0]) continue;
      const membros = [k0];
      visto[k0] = 1;
      for (let j = 0; j < membros.length; j++) {
        const k = membros[j],
          x = k % W;
        for (const v of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W]) {
          if (v < 0 || v >= N || visto[v] || !tinta[v]) continue;
          visto[v] = 1;
          membros.push(v);
        }
      }
      if (membros.length < 200) {
        ciscos.push(membros.length);
        for (const k of membros) {
          const i = k * 4;
          depois[i] = depois[i + 1] = depois[i + 2] = depois[i + 3] = 0;
        }
        continue;
      }
      for (const k of membros) {
        const x = k % W,
          y = (k - x) / W;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
      }
    }
    const limpo = new ImageData(new Uint8ClampedArray(depois), W, H);
    g0.putImageData(limpo, 0, 0);
    let offX = ALVO.cx - circulo.cx * escala;
    let offY = ALVO.cy - circulo.cy * escala;
    if (FIXO) {
      escala = FIXO.escala;
      offX = FIXO.offX;
      offY = FIXO.offY;
    }
    const cabeAltura = (960 - 2 * MARGEM) / (y1 - y0 || 1);
    const cabeLargura = (960 - 2 * MARGEM) / (x1 - x0 || 1);
    let encolheu = false;
    if (escala > Math.min(cabeAltura, cabeLargura)) {
      escala = Math.min(cabeAltura, cabeLargura);
      encolheu = true;
      offX = ALVO.cx - circulo.cx * escala;
      offY = ALVO.cy - circulo.cy * escala;
    }
    let desceu = 0;
    if (offY + y0 * escala < MARGEM) {
      desceu = MARGEM - (offY + y0 * escala);
      offY += desceu;
    }
    if (offY + y1 * escala > 960 - MARGEM) {
      const sobe = offY + y1 * escala - (960 - MARGEM);
      offY -= sobe;
      desceu -= sobe;
    }
    if (offX + x0 * escala < MARGEM) offX += MARGEM - (offX + x0 * escala);
    if (offX + x1 * escala > 960 - MARGEM) offX -= offX + x1 * escala - (960 - MARGEM);

    const [cSaida, gSaida] = tela(960, 960);
    gSaida.imageSmoothingQuality = "high";
    gSaida.drawImage(c0, offX, offY, W * escala, H * escala);

    const webp = cSaida.toDataURL("image/png").split(",")[1];
    const extra = { desceu: Math.round(desceu), encolheu, ciscos, caixa: [x0, y0, x1, y1] };

    return {
      W,
      H,
      temAlfaReal,
      fracaoTransparente: +(fundoNeutro / N).toFixed(3),
      faixaUsada: { y0: faixa[0]?.y, y1: faixa[faixa.length - 1]?.y, pontos: pts.length },
      medida: { cx: circulo.cx, cy: circulo.cy, diametro },
      componentePrincipal: { x0: x0Comp, x1: x1Comp, y0: y0Comp, y1: y1Comp },
      escala,
      escalaCedeu: cedeu,
      extra,
      offX,
      offY,
      webp,
    };
  },
  [uri, ALVO, PASSO, SALTO_MAXIMO, MARGEM, FIXO],
);

await nav.close();

const bytes = Buffer.from(saida.webp, "base64");
writeFileSync(DESTINO, bytes);
console.log(
  JSON.stringify(
    {
      arquivo: DESTINO,
      origem: `${saida.W}×${saida.H}`,
      recorteDeFundo: saida.temAlfaReal ? "pulado — já tinha alfa de verdade" : "aplicado",
      transparente: `${Math.round(saida.fracaoTransparente * 100)}%`,
      faixaUsada: saida.faixaUsada,
      esferaMedida: saida.medida,
      componentePrincipal: saida.componentePrincipal,
      escala: +saida.escala.toFixed(4),
      escalaCedeuPraCaberOsExtras: saida.escalaCedeu,
      inteira: saida.extra,
      kb: Math.round(bytes.length / 1024),
    },
    null,
    2,
  ),
);
