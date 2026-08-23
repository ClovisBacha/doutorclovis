/**
 * A BANCADA DE OUVIR — porque eu não ouço, e "ficou bom" não é medida.
 *
 * ─── POR QUE ELA EXISTE ─────────────────────────────────────────────────────
 *
 * O CLAUDE.md conta, com números, como os sons foram consertados em ago/2026:
 * "fator de crista 4,25 → 8,30", "auto-similaridade 0,997 → −0,002", "o degrau
 * na emenda do coração era 0,0443, maior que qualquer outro degrau do arquivo".
 * Cada um desses números decidiu uma linha de código.
 *
 * ⚠️ E NENHUM DELES ERA REPRODUZÍVEL. As medições foram feitas à mão, uma vez,
 * e morreram no terminal. Quem acrescentasse o quinto som não tinha como saber
 * se ele estava no mesmo padrão dos quatro — e como ninguém que escreve este
 * código ouve o resultado, "parece bom" é literalmente indisponível.
 *
 * É a mesma lacuna que a skill `/tela` nomeia para layout ("se você não
 * consegue verificar, não entregue"), aplicada a som. Esta bancada fecha ela.
 *
 * ─── O QUE ELA MEDE, E POR QUE CADA UMA ─────────────────────────────────────
 *
 * • **degrau da emenda** — o `<audio loop>` encosta o último quadro no
 *   primeiro. Se o salto ali for maior que os saltos naturais do sinal, é um
 *   "tec" a cada 30 s, a noite inteira, no ouvido de quem tenta dormir. Medido
 *   como PERCENTIL dentro da distribuição de degraus do próprio som — valor
 *   absoluto não diz nada, porque chuva tem degraus grandes por natureza e pad
 *   não tem nenhum.
 *
 * • **fator de crista** (pico ÷ RMS) — separa som com IMPACTO de chiado. Foi
 *   ele que provou que a chuva antiga era ruído de TV: 4,25. Chuva de verdade
 *   é feita de gotas, e gota é transiente.
 *
 * • **auto-similaridade** no laço do ruído — o ouvido reconhece repetição em
 *   menos de um minuto. 0,997 era o laço de 2 s audível.
 *
 * • **envelope máx ÷ mediano** — densidade de transiente. A curtose foi
 *   tentada primeiro e é a métrica ERRADA para chuva (ela mede esparsidade; o
 *   coração pontua alto porque é silêncio-silêncio-batida, e chuva é densa por
 *   natureza). Isto está escrito no `som-continuo.ts` e é repetido aqui para
 *   não ser redescoberto pela terceira vez.
 *
 * • **energia por oitava** — é o que diz se o som ocupa a faixa que ele
 *   promete. Chuva com 92% acima de 1 kHz é chiado; útero com energia acima de
 *   1 kHz não é útero.
 *
 * • **pico** — tem de bater `PICO_ALVO`. Acima de 1 satura e vira estalo.
 *
 * ⚠️ **O WAV É LIDO CRU, nunca por `decodeAudioData`.** Ele reamostra e
 * INVENTA um degrau nas bordas que não existe no arquivo — foi assim que uma
 * medição anterior "achou" uma emenda ruim numa que estava perfeita.
 *
 * ⚠️ **O render acontece num Chromium de verdade**, porque `OfflineAudioContext`
 * não existe em Node. Não há como medir isto sem navegador.
 *
 * Uso:
 *   node scripts/ouvir.mjs                # mede todos os sons contínuos
 *   node scripts/ouvir.mjs chuva mar      # só alguns
 *   node scripts/ouvir.mjs --json         # saída para outro programa
 *
 * Sai com código 1 se algum som reprovar num dos limites.
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RAIZ = process.cwd();
const args = process.argv.slice(2);
const comoJson = args.includes("--json");
const pedidos = args.filter((a) => !a.startsWith("--"));

/* ─────────────────────────── Limites ────────────────────────────────────────
 *
 * ⚠️ Estes números NÃO são gosto: cada um sai de um defeito medido e escrito no
 * `som-continuo.ts`. Mexer num deles é decidir aceitar aquele defeito de volta.
 */
const LIMITES = {
  /* O degrau da emenda não pode passar o p99 dos degraus do próprio sinal.
     Um sinal cheio de transiente tem p99 alto e aguenta muito; um drone liso
     tem p99 baixo e qualquer coisa nele é o estalo. Autocalibrado por som. */
  emendaSobreP99Max: 1,
  /* Pico: `PICO_ALVO` é 0,89. Abaixo de 0,80 o som sai baixo demais num iPhone,
     onde a página não controla volume nenhum; acima de 0,95 encosta no teto. */
  picoMin: 0.8,
  picoMax: 0.95,
  /* Auto-similaridade no laço do ruído. 0,997 era o laço de 2 s audível. */
  autoSimilaridadeMax: 0.5,
  /* Silêncio quase total é som que não veio. */
  rmsMin: 0.01,
};

/* Sons de IMPACTO precisam de crista; sons de cama, não. Um pad com crista 9
   estaria estalando, e uma chuva com crista 2 é chiado de TV.
   ⚠️ E crista ALTA DEMAIS também é defeito: acima de ~20 o pico é um evento
   isolado, e como o arquivo é normalizado pelo pico, tudo o mais fica baixo. */
const CRISTA = {
  chuva: [5, 20],
  mar: [5, 20],
  coracao: [5, 20],
};

/* Sons cuja repetição é o próprio som: drone, batimento, onda com período.
   Cobrar ausência de padrão neles seria cobrar que deixassem de ser o que são. */
const PERIODICOS = ["pad", "coracao", "mar"];

/* ─────────────────────────── Render no navegador ───────────────────────── */

async function renderizarTodos(sons) {
  const dir = join(tmpdir(), "ouvir-" + Date.now());
  mkdirSync(dir, { recursive: true });
  const entrada = join(dir, "entrada.ts");
  const saida = join(dir, "som.js");
  execFileSync("bun", [
    "build",
    "--outfile=" + saida,
    "--target=browser",
    "--format=esm",
    escreverEntrada(entrada),
  ]);
  const bundle = readFileSync(saida, "utf8");

  const exe = "/opt/pw-browsers/chromium/chrome-linux/chrome";
  const navegador = await chromium.launch({
    ...(existsSync(exe) ? { executablePath: exe } : {}),
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  try {
    const pagina = await navegador.newPage();
    await pagina.goto("about:blank");
    await pagina.addScriptTag({ content: bundle, type: "module" });
    await pagina.waitForFunction(() => !!globalThis.SOM, { timeout: 15000 });

    const saidas = {};
    for (const som of sons) {
      /* O WAV volta como array de bytes: `Blob` não atravessa a fronteira do
         `evaluate`, e transformar em base64 no meio custaria memória à toa. */
      const bytes = await pagina.evaluate(async (k) => {
        const blob = await globalThis.SOM.renderizar(k);
        if (!blob) return null;
        return Array.from(new Uint8Array(await blob.arrayBuffer()));
      }, som);
      saidas[som] = bytes ? Uint8Array.from(bytes) : null;
    }
    return saidas;
  } finally {
    await navegador.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function escreverEntrada(caminho) {
  const mod = join(RAIZ, "src/lib/som-continuo.ts");
  writeFileSync(caminho, 'import * as SC from "' + mod + '";\n(globalThis).SOM = SC;\n');
  return caminho;
}

/* ─────────────────────────── Leitura do WAV cru ─────────────────────────── */

/**
 * ⚠️ Lê o PCM à mão. `decodeAudioData` reamostra e inventa degrau nas bordas —
 * exatamente o valor que esta bancada existe para medir.
 */
function lerWav(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const txt = (p, n) =>
    String.fromCharCode(...Array.from({ length: n }, (_, i) => v.getUint8(p + i)));
  if (txt(0, 4) !== "RIFF" || txt(8, 4) !== "WAVE") throw new Error("não é WAV");
  const taxa = v.getUint32(24, true);
  const bits = v.getUint16(34, true);
  if (bits !== 16) throw new Error("esperava 16 bits, veio " + bits);
  const n = v.getUint32(40, true) / 2;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = v.getInt16(44 + i * 2, true) / 32768;
  return { x, taxa };
}

/* ─────────────────────────── Medidas ────────────────────────────────────── */

function pico(x) {
  let p = 0;
  for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i]));
  return p;
}

function rms(x) {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return Math.sqrt(s / x.length);
}

/**
 * O DEGRAU DA EMENDA — absoluto, e contra o p99 dos degraus do próprio sinal.
 *
 * ⚠️ A PRIMEIRA VERSÃO USAVA SÓ O PERCENTIL, e ela mentia nos dois sentidos.
 * Num pad todos os degraus são minúsculos e parecidos, então um degrau
 * inaudível cai no percentil 100 e "reprova"; numa chuva, cheia de gotas, um
 * degrau grande cai no percentil 60 e "passa". O percentil descreve a POSIÇÃO
 * na fila, nunca o tamanho — e quem estala no ouvido é o tamanho.
 *
 * Medido para provar: variando só o aquecimento, o percentil da chuva pulou
 * 91,5 → 10,4 → 33,4 → 78,7 → 89,5 → 95%, enquanto o degrau absoluto ficou
 * entre 0,0025 e 0,084 — todos MUITO abaixo do p99 dela, que é 0,25. Nenhuma
 * daquelas leituras significava nada.
 *
 * O critério que ficou: **o degrau da emenda não pode passar o p99 dos degraus
 * do próprio sinal.** É uma comparação de tamanho contra tamanho, e é
 * autocalibrada por som — 0,25 é normal na chuva e seria um estalo no pad.
 * O percentil continua impresso, como diagnóstico.
 */
function emenda(x) {
  const degrau = Math.abs(x[0] - x[x.length - 1]);
  const todos = new Float64Array(x.length - 1);
  for (let i = 0; i < x.length - 1; i++) todos[i] = Math.abs(x[i + 1] - x[i]);
  todos.sort();
  let abaixo = 0;
  let lo = 0;
  let hi = todos.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (todos[mid] < degrau) lo = mid + 1;
    else hi = mid;
  }
  abaixo = lo;
  return {
    degrau,
    percentil: (100 * abaixo) / todos.length,
    p99: todos[Math.floor(todos.length * 0.99)],
    maior: todos[todos.length - 1],
  };
}

/**
 * ⚠️ VARRE OS LAGS — não confia no período declarado.
 *
 * A primeira versão media a repetição no maior período que o módulo DECLARAVA,
 * e isso tem dois modos de falhar, os dois já vistos: quando o período
 * declarado é o comprimento inteiro do trecho não sobra lag para medir e a
 * coluna vira "—" (parecendo aprovação); e um som que repita num período que
 * ninguém declarou passa batido, que é exatamente o defeito que se procura.
 *
 * Varrendo, a pergunta fica a certa: **existe ALGUM atraso, abaixo de meio
 * laço, em que este som volta a ser ele mesmo?** Devolve o pior caso e onde.
 */
function repeticao(x, taxa, limiteSegs) {
  let pior = 0;
  let onde = 0;
  /* Passo de 1/4 s: fino o bastante para não passar por cima de um laço curto,
     grosso o bastante para a varredura não custar minutos. */
  for (let lag = 0.25; lag <= limiteSegs; lag += 0.25) {
    const c = autoSimilaridade(x, taxa, lag);
    if (c !== null && Math.abs(c) > pior) {
      pior = Math.abs(c);
      onde = lag;
    }
  }
  return { pior, onde };
}

/** Correlação de Pearson entre o sinal e ele mesmo deslocado por `lag` segundos. */
function autoSimilaridade(x, taxa, lagSegs) {
  const lag = Math.round(lagSegs * taxa);
  if (lag <= 0 || lag >= x.length) return null;
  const n = x.length - lag;
  let sa = 0,
    sb = 0;
  for (let i = 0; i < n; i++) {
    sa += x[i];
    sb += x[i + lag];
  }
  const ma = sa / n;
  const mb = sb / n;
  let num = 0,
    da = 0,
    db = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - ma;
    const b = x[i + lag] - mb;
    num += a * b;
    da += a * a;
    db += b * b;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
}

/**
 * Envelope por janelas de 20 ms, e a razão entre o máximo e a mediana.
 *
 * ⚠️ Não é curtose. Curtose mede ESPARSIDADE — o coração pontua 15,6 porque é
 * silêncio-silêncio-batida, e chuva, que é densa por natureza, nunca pontua.
 * Esta razão mede o que interessa: existem picos que se destacam da cama?
 */
function envelope(x, taxa) {
  const janela = Math.max(1, Math.round(0.02 * taxa));
  const env = [];
  for (let i = 0; i + janela <= x.length; i += janela) {
    let s = 0;
    for (let j = 0; j < janela; j++) s += x[i + j] * x[i + j];
    env.push(Math.sqrt(s / janela));
  }
  const ord = [...env].sort((a, b) => a - b);
  const mediana = ord[ord.length >> 1] || 1e-9;
  return { max: ord[ord.length - 1], mediana, razao: ord[ord.length - 1] / mediana };
}

/** FFT iterativa radix-2, in-place. */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j];
        const ui = im[i + j];
        const vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci;
        const vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ur + vr;
        im[i + j] = ui + vi;
        re[i + j + len / 2] = ur - vr;
        im[i + j + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/**
 * Energia por banda de oitava, em % do total, e o centroide espectral.
 *
 * Média de vários blocos com janela de Hann: um bloco só de um som com eventos
 * mediria a gota que calhou de cair ali, não o som.
 */
function espectro(x, taxa) {
  const N = 4096;
  const blocos = Math.max(1, Math.min(60, Math.floor(x.length / N)));
  const soma = new Float64Array(N / 2);
  const hann = new Float64Array(N);
  for (let i = 0; i < N; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const passo = Math.floor(x.length / blocos);
  for (let b = 0; b < blocos; b++) {
    const off = b * passo;
    if (off + N > x.length) break;
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[off + i] * hann[i];
    fft(re, im);
    for (let k = 0; k < N / 2; k++) soma[k] += re[k] * re[k] + im[k] * im[k];
  }
  const bandas = [
    ["20-60", 20, 60],
    ["60-125", 60, 125],
    ["125-250", 125, 250],
    ["250-500", 250, 500],
    ["500-1k", 500, 1000],
    ["1k-2k", 1000, 2000],
    ["2k-4k", 2000, 4000],
    ["4k-8k", 4000, 8000],
    ["8k+", 8000, taxa / 2],
  ];
  let total = 0;
  let momento = 0;
  for (let k = 1; k < N / 2; k++) {
    const f = (k * taxa) / N;
    total += soma[k];
    momento += f * soma[k];
  }
  const porBanda = {};
  for (const [nome, lo, hi] of bandas) {
    let s = 0;
    for (let k = 1; k < N / 2; k++) {
      const f = (k * taxa) / N;
      if (f >= lo && f < hi) s += soma[k];
    }
    porBanda[nome] = total > 0 ? (100 * s) / total : 0;
  }
  return { porBanda, centroide: total > 0 ? momento / total : 0 };
}

/* ─────────────────────────── Relatório ──────────────────────────────────── */

function medir(som, bytes, periodos) {
  const { x, taxa } = lerWav(bytes);
  const p = pico(x);
  const r = rms(x);
  const e = emenda(x);
  const env = envelope(x, taxa);
  const esp = espectro(x, taxa);
  /* Varre até METADE do trecho: além disso sobram poucas amostras para a
     correlação significar alguma coisa. */
  const rep = repeticao(x, taxa, x.length / taxa / 2);
  const auto = rep.pior;
  const lag = rep.onde;

  const falhas = [];
  const razaoEmenda = e.degrau / (e.p99 || 1e-9);
  if (razaoEmenda > LIMITES.emendaSobreP99Max)
    falhas.push(
      "degrau da emenda " +
        e.degrau.toFixed(5) +
        " passa o p99 do próprio sinal (" +
        e.p99.toFixed(5) +
        ") — " +
        razaoEmenda.toFixed(2) +
        "×",
    );
  if (p < LIMITES.picoMin || p > LIMITES.picoMax)
    falhas.push(
      "pico " + p.toFixed(3) + " fora de [" + LIMITES.picoMin + ", " + LIMITES.picoMax + "]",
    );
  if (r < LIMITES.rmsMin) falhas.push("RMS " + r.toFixed(4) + " — som quase mudo");
  /* Um som TONAL repete por natureza — um drone que não repetisse não seria um
     drone, e um coração que não repetisse seria arritmia. A cobrança vale só
     para os que prometem textura sem padrão. */
  if (PERIODICOS.includes(som)) {
    /* nada a cobrar: a repetição é o som */
  } else if (auto > LIMITES.autoSimilaridadeMax) {
    falhas.push("repete a cada " + lag.toFixed(2) + "s (r = " + auto.toFixed(3) + ")");
  }
  const faixa = CRISTA[som];
  const crista = p / (r || 1e-9);
  if (faixa && crista < faixa[0])
    falhas.push(
      "fator de crista " + crista.toFixed(2) + " (mínimo " + faixa[0] + ") — sem impacto",
    );
  if (faixa && crista > faixa[1])
    falhas.push(
      "fator de crista " +
        crista.toFixed(2) +
        " (teto " +
        faixa[1] +
        ") — um pico isolado esmaga o resto na normalização",
    );

  return {
    som,
    taxa,
    segundos: +(x.length / taxa).toFixed(2),
    pico: +p.toFixed(4),
    rms: +r.toFixed(4),
    crista: +crista.toFixed(2),
    emendaDegrau: +e.degrau.toFixed(5),
    emendaP99: +e.p99.toFixed(5),
    emendaSobreP99: +razaoEmenda.toFixed(3),
    emendaPercentil: +e.percentil.toFixed(1),
    maiorDegrau: +e.maior.toFixed(5),
    envelopeRazao: +env.razao.toFixed(2),
    autoSimilaridade: auto === null ? null : +auto.toFixed(4),
    lagSegs: lag,
    centroideHz: Math.round(esp.centroide),
    bandas: Object.fromEntries(Object.entries(esp.porBanda).map(([k, v]) => [k, +v.toFixed(1)])),
    falhas,
  };
}

async function main() {
  const bundlePath = join(tmpdir(), "ouvir-lista-" + Date.now() + ".ts");
  /* A lista de sons sai do PRÓPRIO módulo, nunca de uma cópia aqui: um som
     novo entra na medição sozinho, que é o ponto de a bancada existir. */
  const fonte = readFileSync(join(RAIZ, "src/lib/som-continuo.ts"), "utf8");
  const m = fonte.match(/export const SONS_CONTINUOS = \[([^\]]*)\]/);
  const todos = m
    ? m[1]
        .split(",")
        .map((s) => s.trim().replace(/^"|"$/g, ""))
        .filter(Boolean)
    : [];
  rmSync(bundlePath, { force: true });

  const sons = pedidos.length ? pedidos.filter((s) => todos.includes(s)) : todos;
  if (!sons.length) {
    console.error("nenhum som conhecido. conhecidos: " + todos.join(", "));
    process.exit(1);
  }

  const periodosPorSom = await lerPeriodos(sons);
  const bytesPorSom = await renderizarTodos(sons);

  const linhas = [];
  for (const som of sons) {
    const bytes = bytesPorSom[som];
    if (!bytes) {
      linhas.push({ som, falhas: ["o render devolveu null"] });
      continue;
    }
    linhas.push(medir(som, bytes, periodosPorSom[som] ?? []));
  }

  if (comoJson) {
    console.log(JSON.stringify(linhas, null, 2));
  } else {
    imprimir(linhas);
  }
  const reprovados = linhas.filter((l) => l.falhas.length);
  process.exit(reprovados.length ? 1 : 0);
}

/** Os períodos vêm do módulo, para o lag da auto-similaridade ser o certo. */
async function lerPeriodos(sons) {
  const dir = join(tmpdir(), "ouvir-per-" + Date.now());
  mkdirSync(dir, { recursive: true });
  const entrada = join(dir, "e.ts");
  const saida = join(dir, "s.js");
  writeFileSync(
    entrada,
    'export { periodosDe } from "' + join(RAIZ, "src/lib/som-continuo.ts") + '";\n',
  );
  execFileSync("bun", ["build", "--outfile=" + saida, "--target=node", "--format=esm", entrada]);
  const mod = await import("file://" + saida);
  const out = {};
  for (const s of sons) out[s] = mod.periodosDe(s);
  rmSync(dir, { recursive: true, force: true });
  return out;
}

function imprimir(linhas) {
  const col = (s, n) => String(s).padEnd(n);
  const num = (s, n) => String(s).padStart(n);
  console.log("");
  console.log(
    "  " +
      col("som", 12) +
      num("pico", 7) +
      num("RMS", 8) +
      num("crista", 8) +
      num("emenda/p99", 12) +
      num("env.max/med", 13) +
      num("repete", 10) +
      num("no lag", 9) +
      num("centro Hz", 11),
  );
  console.log("  " + "─".repeat(78));
  for (const l of linhas) {
    if (l.pico === undefined) {
      console.log("  " + col(l.som, 12) + "  (não renderizou)");
      continue;
    }
    console.log(
      "  " +
        col(l.som, 12) +
        num(l.pico.toFixed(3), 7) +
        num(l.rms.toFixed(4), 8) +
        num(l.crista.toFixed(2), 8) +
        num(l.emendaSobreP99.toFixed(2), 12) +
        num(l.envelopeRazao.toFixed(2), 13) +
        num(l.autoSimilaridade === null ? "—" : l.autoSimilaridade.toFixed(3), 10) +
        num(l.lagSegs ? l.lagSegs.toFixed(2) + "s" : "—", 9) +
        num(l.centroideHz, 11),
    );
  }
  console.log("");
  console.log("  energia por banda (% do total)");
  console.log("  " + "─".repeat(78));
  const nomes = linhas.find((l) => l.bandas)
    ? Object.keys(linhas.find((l) => l.bandas).bandas)
    : [];
  console.log("  " + col("som", 12) + nomes.map((n) => num(n, 8)).join(""));
  for (const l of linhas) {
    if (!l.bandas) continue;
    console.log("  " + col(l.som, 12) + nomes.map((n) => num(l.bandas[n].toFixed(1), 8)).join(""));
  }
  console.log("");
  const ruins = linhas.filter((l) => l.falhas.length);
  if (!ruins.length) {
    console.log("  ✅ todos dentro dos limites");
  } else {
    for (const l of ruins) {
      console.log("  ❌ " + l.som);
      for (const f of l.falhas) console.log("       " + f);
    }
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
