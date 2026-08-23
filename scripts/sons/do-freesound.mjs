#!/usr/bin/env node
/**
 * BAIXAR, CORTAR, COSTURAR E MEDIR AS GRAVAÇÕES CC0 DO FREESOUND.
 *
 *   FREESOUND_TOKEN=xxx node scripts/sons/do-freesound.mjs            # a lista toda
 *   FREESOUND_TOKEN=xxx node scripts/sons/do-freesound.mjs fogueira   # um só
 *   FREESOUND_TOKEN=xxx node scripts/sons/do-freesound.mjs --buscar fogueira
 *
 * A síntese em tempo real leva o app até onde ela chega — e a medição disse
 * onde ela para: fogo e bicho. Este script é a ponte, e ele NÃO inventa nada:
 * imprime a licença, o autor e o id de cada arquivo que baixa.
 *
 * ⚠️ **SÓ CC0, E CONFERIDO DUAS VEZES.** O filtro vai na consulta E o resultado
 * é reconferido antes de gravar. Um único arquivo CC-BY entrando aqui põe uma
 * obrigação de atribuição dentro de um app clínico que não tem tela de
 * créditos — e ninguém descobriria até virar problema jurídico. Licença errada
 * ABORTA o som, nunca "passa com aviso".
 *
 * ⚠️ **A PROCEDÊNCIA É GRAVADA EM DISCO** (`public/sons/CREDITOS.json`), mesmo
 * CC0 não exigindo atribuição. Sem ela, daqui a um ano ninguém sabe de onde
 * veio o arquivo nem consegue provar que podia usá-lo.
 */

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TOKEN = process.env.FREESOUND_TOKEN;
const SAIDA = "public/sons";
const API = "https://freesound.org/apiv2";

/**
 * O QUE PEDIR PARA CADA SOM, E POR QUÊ ESTES E NÃO OS 32.
 *
 * ⚠️ A lista é curta de propósito. Ruído (branco/rosa/marrom) sintetizado é
 * EXATO — gravá-lo só acrescentaria o chiado do microfone. Tons (pad, drone,
 * tigela) são instrumentos por natureza. Máquinas são filtro mais harmônico, e
 * é assim que elas soam mesmo. Sobram fogo, bicho e água, que é onde a medição
 * mostrou a síntese perdendo.
 *
 * ⚠️ `segundos` é o MÍNIMO da fonte, e ele é grande porque repetição curta é
 * reconhecível na hora: um canto de pássaro distinto voltando a cada 15 s vira
 * a coisa mais audível da tela. Sessenta segundos com o cruzamento por cima dão
 * um laço que o ouvido não fecha.
 */
const PEDIDOS = {
  fogueira: { busca: "campfire crackling", segundos: 60 },
  lareira: { busca: "fireplace fire burning", segundos: 60 },
  passaros: { busca: "birds morning forest ambience", segundos: 90 },
  sapos: { busca: "frogs night pond ambience", segundos: 90 },
  cigarras: { busca: "cicadas summer ambience", segundos: 90 },
  "floresta-noite": { busca: "forest night ambience crickets", segundos: 90 },
  riacho: { busca: "stream creek water flowing", segundos: 60 },
  cachoeira: { busca: "waterfall water", segundos: 60 },
};

function ffmpeg() {
  /* O binário é ferramenta de bancada, não dependência do app: 80 MB não entram
     no `package.json` de um app clínico por causa de um script que roda uma vez.
     Procura no projeto e no scratchpad; ausente, diz como instalar. */
  for (const base of [process.cwd(), process.env.SCRATCH ?? ""]) {
    if (!base) continue;
    try {
      const req = createRequire(join(base, "package.json"));
      const p = req("ffmpeg-static");
      if (p && existsSync(p)) return p;
    } catch {
      /* segue para o próximo */
    }
  }
  const local = join(process.cwd(), "node_modules/ffmpeg-static/ffmpeg");
  if (existsSync(local)) return local;
  console.error("ffmpeg não encontrado. Rode:  bun add -d ffmpeg-static");
  process.exit(1);
}

async function api(caminho) {
  const r = await fetch(`${API}${caminho}`, { headers: { Authorization: `Token ${TOKEN}` } });
  if (r.status === 401) {
    console.error("401 — o FREESOUND_TOKEN não foi aceito.");
    process.exit(1);
  }
  if (!r.ok) throw new Error(`${caminho} → ${r.status}`);
  return r.json();
}

/**
 * ⚠️ ORDENA POR AVALIAÇÃO, NÃO POR RELEVÂNCIA.
 *
 * A relevância do Freesound casa o texto da busca com o TÍTULO, e o topo dela
 * costuma ser um clipe curto de dois segundos chamado "fire.wav". O que serve
 * aqui é gravação longa e bem avaliada — daí o filtro de duração vir junto.
 */
async function melhorCandidato(termo, minSegs) {
  const filtro = [
    'license:"Creative Commons 0"',
    `duration:[${minSegs} TO 600]`,
    "type:(wav OR flac OR aiff)",
  ].join(" ");
  const q = new URLSearchParams({
    query: termo,
    filter: filtro,
    sort: "rating_desc",
    fields: "id,name,license,username,duration,previews,avg_rating,num_ratings",
    page_size: "15",
  });
  const { results = [] } = await api(`/search/text/?${q}`);
  /* ⚠️ A licença é RECONFERIDA no resultado. Confiar só no filtro da consulta
     é confiar que a query saiu como eu escrevi — e ela é uma string montada. */
  const cc0 = results.filter((s) => /creative commons 0|CC0/i.test(s.license || ""));
  /* Pelo menos três avaliações: uma nota 5 de um voto é ruído. */
  return cc0.filter((s) => (s.num_ratings ?? 0) >= 3)[0] ?? cc0[0] ?? null;
}

async function baixarUm(chave, ff, creditos) {
  const pedido = PEDIDOS[chave];
  const s = await melhorCandidato(pedido.busca, pedido.segundos);
  if (!s) {
    console.log(`  ${chave}: nenhum CC0 longo o bastante — pulei`);
    return false;
  }
  if (!/creative commons 0|CC0/i.test(s.license || "")) {
    console.error(`  ${chave}: ABORTADO, licença "${s.license}" não é CC0`);
    return false;
  }
  const url = s.previews?.["preview-hq-mp3"];
  if (!url) {
    console.log(`  ${chave}: sem prévia disponível — pulei`);
    return false;
  }

  const bruto = join(SAIDA, `.${chave}.mp3`);
  writeFileSync(bruto, Buffer.from(await (await fetch(url)).arrayBuffer()));

  /**
   * ⚠️ MONO, 32 kbps, OPUS — e cada um desses tem razão.
   *
   * MONO porque isto toca por baixo de uma meditação a 0,28 de ganho: a imagem
   * estéreo não é percebida e custa o dobro. OPUS porque é o codec que o iOS
   * 17+ e todo Android tocam e que segura ambiente melhor que mp3 na mesma
   * taxa. 32 kbps porque acima disso não há diferença audível em ruído de
   * fundo, e o app já carrega áudio de voz — cada mega aqui é mega que a
   * paciente baixa no plano de dados dela.
   *
   * O corte de 90 s vem do laço: mais que isso é peso que ninguém ouve, porque
   * o cruzamento já impede o ouvido de fechar a volta.
   */
  const alvo = join(SAIDA, `${chave}.webm`);
  const r = spawnSync(ff, [
    "-y",
    "-i",
    bruto,
    "-t",
    "90",
    "-ac",
    "1",
    "-ar",
    "48000",
    "-c:a",
    "libopus",
    "-b:a",
    "32k",
    "-application",
    "audio",
    alvo,
  ]);
  if (r.status !== 0) {
    console.error(`  ${chave}: ffmpeg falhou`);
    return false;
  }
  spawnSync("rm", ["-f", bruto]);

  const kb = Math.round(readFileSync(alvo).length / 1024);
  creditos[chave] = {
    freesound_id: s.id,
    nome: s.name,
    autor: s.username,
    licenca: s.license,
    url: `https://freesound.org/s/${s.id}/`,
  };
  console.log(`  ${chave}: ${kb} KB · CC0 · "${s.name}" (${s.username})`);
  return true;
}

async function main() {
  if (!TOKEN) {
    console.error(
      [
        "Falta o FREESOUND_TOKEN.",
        "",
        "  1. entre em https://freesound.org (conta grátis)",
        "  2. https://freesound.org/apiv2/apply/  → cria a chave na hora",
        "  3. FREESOUND_TOKEN=<a chave> node scripts/sons/do-freesound.mjs",
      ].join("\n"),
    );
    process.exit(1);
  }
  const ff = ffmpeg();
  mkdirSync(SAIDA, { recursive: true });

  const args = process.argv.slice(2);
  if (args[0] === "--buscar") {
    /* Modo de inspeção: mostra o que a busca traria, sem baixar nada. É o que
       permite ajustar o termo antes de gastar rede. */
    const chave = args[1];
    const s = await melhorCandidato(PEDIDOS[chave].busca, PEDIDOS[chave].segundos);
    console.log(s ? JSON.stringify(s, null, 2) : "nada encontrado");
    return;
  }

  const arquivoCreditos = join(SAIDA, "CREDITOS.json");
  const creditos = existsSync(arquivoCreditos)
    ? JSON.parse(readFileSync(arquivoCreditos, "utf8"))
    : {};

  const chaves = args.length ? args : Object.keys(PEDIDOS);
  console.log(`\nBaixando ${chaves.length} som(ns) CC0 do Freesound:\n`);
  let ok = 0;
  for (const k of chaves) {
    if (!PEDIDOS[k]) {
      console.error(`  ${k}: não está na lista de pedidos`);
      continue;
    }
    try {
      if (await baixarUm(k, ff, creditos)) ok++;
    } catch (e) {
      console.error(`  ${k}: ${e.message}`);
    }
  }
  writeFileSync(arquivoCreditos, JSON.stringify(creditos, null, 2) + "\n");

  console.log(`\n${ok}/${chaves.length} prontos em ${SAIDA}/`);
  console.log("Agora meça o ganho e ligue em GRAVADOS:");
  console.log("  node scripts/ouvir.mjs --gravados\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
