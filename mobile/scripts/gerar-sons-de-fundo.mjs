/**
 * GERA OS SONS DE FUNDO DA MEDITAÇÃO DO APP — os MESMOS do site, em arquivo.
 *
 * No site, o som de fundo é sintetizado ao vivo pelo Web Audio
 * (`src/lib/som-receitas.ts`), e oito deles trocam para uma gravação CC0 de
 * `public/sons/`. O app não tem Web Audio: aqui cada som vira um laço de 30 s
 * que emenda sem costura, renderizado pelo MESMO motor do site num Chromium
 * de verdade (`OfflineAudioContext` não existe no Node) — a mesma conta de
 * `renderizar` em `som-continuo.ts`: 8 s de aquecimento, 30 s de trecho e a
 * emenda cruzada de 20 ms. As gravações passam por `fecharLaco`, a mesma do
 * site. Depois o ffmpeg encolhe para AAC (o WAV de 30 s pesaria 1,3 MB cada).
 *
 * O VOLUME de cada som no app sai daqui, e não de ouvido: é o nível que ele
 * tinha ao vivo no site — `NIVEL_AO_VIVO` (ou o ganho medido da gravação) vezes
 * o mestre de 0,28 — dividido pelo quanto o arquivo foi normalizado.
 *
 *   FFMPEG=/caminho/do/ffmpeg node mobile/scripts/gerar-sons-de-fundo.mjs
 *
 * Sem ffmpeg no PATH: `pip download imageio-ffmpeg` traz um binário estático.
 * Rodar de novo se um som do site mudar; `sons-de-fundo.test.ts` cobra que o
 * mapa bate com a lista do site.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RAIZ = join(import.meta.dirname, "..", "..");
const APP = join(RAIZ, "mobile");
const PASTA = join(APP, "assets", "sons", "fundo");
const MAPA = join(APP, "src", "lib", "audio", "sons-de-fundo.ts");
const FFMPEG = process.env.FFMPEG || "ffmpeg";
/* O mestre do som de fundo no site (`alvo` em `createSoundscape`). */
const MESTRE = 0.28;

const { chromium } = createRequire(join(RAIZ, "package.json"))("playwright");

const tmp = join(tmpdir(), "sons-de-fundo-" + process.pid);
mkdirSync(tmp, { recursive: true });
mkdirSync(PASTA, { recursive: true });

const entrada = join(tmp, "entrada.ts");
writeFileSync(
  entrada,
  [
    `import * as SC from ${JSON.stringify(join(RAIZ, "src/lib/som-continuo.ts"))};`,
    `import * as SG from ${JSON.stringify(join(RAIZ, "src/lib/som-gravado.ts"))};`,
    "(globalThis).SOM = { ...SC, ...SG };",
  ].join("\n"),
);
const pacote = join(tmp, "som.js");
execFileSync("bun", ["build", "--outfile=" + pacote, "--target=browser", "--format=esm", entrada]);

const exe = ["/opt/pw-browsers/chromium/chrome-linux/chrome", "/opt/pw-browsers/chromium"].find(existsSync);
const navegador = await chromium.launch(exe ? { executablePath: exe } : {});
const pagina = await navegador.newPage();
await pagina.goto("about:blank");
await pagina.addScriptTag({ content: readFileSync(pacote, "utf8"), type: "module" });
await pagina.waitForFunction(() => !!globalThis.SOM, { timeout: 15000 });

const sons = await pagina.evaluate(() => [...globalThis.SOM.SONS_CONTINUOS]);
const linhas = [];

for (const som of sons) {
  const gravado = await pagina.evaluate((k) => globalThis.SOM.GRAVADOS[k] ?? null, som);
  const webm = gravado ? readFileSync(join(RAIZ, "public", gravado.arquivo)).toString("base64") : null;
  const r = await pagina.evaluate(
    async ({ k, webm }) => {
      const S = globalThis.SOM;
      const PICO = 0.89;
      let x;
      let taxa;
      let ganho;
      if (webm) {
        /* A gravação: decodificada, o laço fechado pela conta do site, e o
           ganho MEDIDO dela (`GRAVADOS`). */
        taxa = 44100;
        const bin = Uint8Array.from(atob(webm), (c) => c.charCodeAt(0));
        const buf = await new OfflineAudioContext(1, 1, taxa).decodeAudioData(bin.buffer);
        const mono = new Float32Array(buf.length);
        for (let c = 0; c < buf.numberOfChannels; c++) {
          const d = buf.getChannelData(c);
          for (let i = 0; i < d.length; i++) mono[i] += d[i] / buf.numberOfChannels;
        }
        x = S.fecharLaco(mono, taxa);
        ganho = S.ganhoGravado(k);
      } else {
        /* A síntese: a mesma conta de `renderizar` (aquecimento, trecho,
           emenda cruzada), com o mestre em 1 — o nível vem depois. */
        taxa = 22050;
        const aquecimento = S.aquecimentoDe(k);
        const loop = S.LOOP_SEGS;
        const xfade = 0.02;
        const total = aquecimento + loop + xfade;
        const ctx = new OfflineAudioContext(1, Math.round(total * taxa), taxa);
        const m = ctx.createGain();
        m.gain.value = 1;
        m.connect(ctx.destination);
        S.montar(ctx, k, m, total);
        const buf = await ctx.startRendering();
        const depois = buf.getChannelData(0).subarray(Math.round(aquecimento * taxa));
        const quadros = Math.round(loop * taxa);
        const sobra = Math.round(xfade * taxa);
        x = depois.slice(0, quadros);
        for (let i = 0; i < sobra; i++) {
          const w = i / sobra;
          x[i] = x[i] * w + depois[quadros + i] * (1 - w);
        }
        ganho = S.NIVEL_AO_VIVO[k] ?? 1;
      }
      let pico = 0;
      for (let i = 0; i < x.length; i++) pico = Math.max(pico, Math.abs(x[i]));
      const g = pico > 0 ? PICO / pico : 1;
      const pcm = new Int16Array(x.length);
      for (let i = 0; i < x.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(x[i] * g * 32767)));
      let s = "";
      const bytes = new Uint8Array(pcm.buffer);
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return { pcm: btoa(s), taxa, g, ganho, segundos: x.length / taxa };
    },
    { k: som, webm },
  );

  const dados = Buffer.from(r.pcm, "base64");
  const cab = Buffer.alloc(44);
  cab.write("RIFF", 0);
  cab.writeUInt32LE(36 + dados.length, 4);
  cab.write("WAVE", 8);
  cab.write("fmt ", 12);
  cab.writeUInt32LE(16, 16);
  cab.writeUInt16LE(1, 20);
  cab.writeUInt16LE(1, 22);
  cab.writeUInt32LE(r.taxa, 24);
  cab.writeUInt32LE(r.taxa * 2, 28);
  cab.writeUInt16LE(2, 32);
  cab.writeUInt16LE(16, 34);
  cab.write("data", 36);
  cab.writeUInt32LE(dados.length, 40);
  const wav = join(tmp, `${som}.wav`);
  writeFileSync(wav, Buffer.concat([cab, dados]));
  const saida = join(PASTA, `${som}.m4a`);
  execFileSync(FFMPEG, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", wav,
    "-c:a", "aac", "-b:a", "48k",
    "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact",
    saida,
  ]);
  const volume = Math.min(1, (r.ganho * MESTRE) / r.g);
  linhas.push({ som, volume, gravado: !!gravado });
  console.log(
    `${som.padEnd(16)} ${gravado ? "gravado " : "síntese "} ${r.segundos.toFixed(1)} s  volume ${volume.toFixed(3)}` +
      `${(r.ganho * MESTRE) / r.g > 1 ? "  (no teto)" : ""}  ${(readFileSync(saida).length / 1024).toFixed(0)} KB`,
  );
}
await navegador.close();
rmSync(tmp, { recursive: true, force: true });

/* As artes dos chips são as do site (`arte-dos-sons.tsx`), por nome de arquivo. */
const artes = new Set(readdirSync(join(RAIZ, "src", "assets", "sons")).map((f) => f.replace(/\.webp$/, "")));

const q = (s) => JSON.stringify(s);
const ts = [
  "/* eslint-disable */",
  "/**",
  " * GERADO por scripts/gerar-sons-de-fundo.mjs — não edite à mão.",
  " *",
  " * Os sons de fundo da meditação, os MESMOS do site: laços de 30 s que emendam",
  " * sem costura (a síntese renderizada pelo motor do site; as oito gravações com",
  " * o laço fechado). `volume` é o nível que o som tinha ao vivo no site.",
  " */",
  'import type { SomKey } from "@/lib/som-receitas";',
  "",
  "export const SONS_DE_FUNDO: Record<SomKey, { arquivo: number; volume: number }> = {",
  ...linhas.map(
    (l) => `  ${q(l.som)}: { arquivo: require(${q(`../../../assets/sons/fundo/${l.som}.m4a`)}), volume: ${l.volume.toFixed(3)} },`,
  ),
  "};",
  "",
  "/** A arte de cada som (a do chip no site). Sem arte, o chip usa o emoji. */",
  "export const ARTE_DO_SOM: Partial<Record<SomKey, number>> = {",
  ...linhas
    .filter((l) => artes.has(l.som))
    .map((l) => `  ${q(l.som)}: require(${q(`../../../../src/assets/sons/${l.som}.webp`)}),`),
  "};",
  "",
];
writeFileSync(MAPA, ts.join("\n"));
/* Sai já formatado: sem isto, cada geração brigaria com o formatador do commit. */
execFileSync(join(RAIZ, "node_modules", ".bin", "prettier"), ["--write", MAPA], { stdio: "ignore" });
console.log(`\n${linhas.length} sons → ${PASTA}\nmapa → ${MAPA}`);
