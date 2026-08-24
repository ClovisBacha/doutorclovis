#!/usr/bin/env node
/**
 * BAIXAR AS GRAVAÇÕES CC0 PELO OPENVERSE — sem chave de API nenhuma.
 *
 *   node scripts/sons/do-openverse.mjs             # a lista toda
 *   node scripts/sons/do-openverse.mjs fogueira    # um só
 *   node scripts/sons/do-openverse.mjs --ver fogueira   # o que viria, sem baixar
 *
 * ⚠️ **POR QUE O OPENVERSE E NÃO A API DO FREESOUND.** A API do Freesound exige
 * um token pessoal, e depender de credencial de terceiro para o app ter som é
 * uma dependência que ninguém consegue honrar num domingo. O Openverse
 * (Automattic/WordPress) AGREGA o Freesound, é anônimo, e devolve a URL do CDN
 * direto — o mesmo arquivo, sem a porta trancada.
 *
 * ⚠️ **SÓ CC0, CONFERIDO DUAS VEZES** — no filtro da consulta E no resultado. Um
 * único CC-BY entrando põe obrigação de atribuição dentro de um app clínico que
 * não tem tela de créditos, e ninguém descobriria até virar problema jurídico.
 * Licença diferente de `cc0` ABORTA o som; nunca "passa com aviso".
 *
 * ⚠️ **A PROCEDÊNCIA VAI PARA O DISCO** (`public/sons/CREDITOS.json`), mesmo CC0
 * não exigindo atribuição: sem ela, daqui a um ano ninguém sabe de onde veio o
 * arquivo nem prova que podia usá-lo.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const API = "https://api.openverse.org/v1/audio/";
const SAIDA = "public/sons";

/**
 * O QUE PEDIR, E POR QUE SÃO OITO E NÃO TRINTA E DOIS.
 *
 * ⚠️ Ruído (branco/rosa/marrom) sintetizado é EXATO — gravá-lo só acrescentaria
 * o chiado do microfone. Tons (pad, drone, tigela) são instrumentos por
 * natureza. Máquinas são filtro mais harmônico, e é assim que soam mesmo.
 * Sobram fogo, bicho e as duas águas que a medição mostrou a síntese perdendo.
 *
 * ⚠️ `minSegs` é grande porque repetição curta é reconhecível na hora: um canto
 * de pássaro distinto voltando a cada 15 s vira a coisa mais audível da tela.
 */
const PEDIDOS = {
  fogueira: { q: "campfire crackling", minSegs: 60 },
  lareira: { q: "fireplace burning", minSegs: 60 },
  passaros: { q: "birds forest morning ambience", minSegs: 60 },
  sapos: { q: "frogs pond night", minSegs: 60 },
  cigarras: { q: "cicadas summer", minSegs: 60 },
  "floresta-noite": { q: "forest night crickets ambience", minSegs: 60 },
  riacho: { q: "stream creek water", minSegs: 60 },
  cachoeira: { q: "waterfall", minSegs: 60 },
};

function ffmpeg() {
  /* Ferramenta de bancada, não dependência do app: 80 MB não entram no
     `package.json` de um app clínico por causa de um script que roda uma vez.
     ⚠️ E fora do `node_modules` do projeto de propósito — instalá-lo lá dentro
     já podou pacotes e quebrou os tipos de `node:crypto` numa rodada. */
  const candidatos = [
    process.env.FFMPEG,
    join(process.env.SCRATCH ?? "", "ferramentas/node_modules/ffmpeg-static/ffmpeg"),
    join(process.cwd(), "node_modules/ffmpeg-static/ffmpeg"),
  ].filter(Boolean);
  for (const c of candidatos) if (existsSync(c)) return c;
  console.error("ffmpeg não encontrado. Aponte com FFMPEG=/caminho/para/ffmpeg");
  process.exit(1);
}

/**
 * ⚠️ ESCOLHE POR DURAÇÃO ÚTIL, NÃO PELO PRIMEIRO RESULTADO.
 *
 * A relevância casa o texto com o TÍTULO, e o topo costuma ser um clipe de dois
 * segundos chamado "fire.wav". O que serve aqui é gravação longa: entre as
 * candidatas válidas, a mais comprida ganha, porque é a que dá mais material
 * antes de o laço voltar.
 */
async function escolher(termo, minSegs) {
  const q = new URLSearchParams({
    q: termo,
    license: "cc0",
    /* ⚠️ 20 É O TETO DO ACESSO ANÔNIMO, e passar disso devolve **401**, não 400.
       O status mentiu: mandou procurar credencial quando o problema era tamanho
       de página. Custou uma volta — se um dia isto voltar a dar 401, confira o
       `page_size` ANTES de concluir que precisa de chave. */
    page_size: "20",
    fields: "id,title,url,license,duration,creator,foreign_landing_url,filetype",
  });
  const r = await fetch(`${API}?${q}`, { headers: { "User-Agent": "doutorclovis/1.0" } });
  if (!r.ok) throw new Error(`openverse ${r.status}`);
  const { results = [] } = await r.json();

  const bons = results.filter(
    (s) =>
      /^cc0$/i.test(s.license || "") &&
      typeof s.duration === "number" &&
      s.duration >= minSegs * 1000 &&
      typeof s.url === "string" &&
      s.url.startsWith("https://"),
  );
  bons.sort((a, b) => b.duration - a.duration);
  return bons[0] ?? null;
}

async function baixarUm(chave, ff, creditos) {
  const { q, minSegs } = PEDIDOS[chave];
  const s = await escolher(q, minSegs);
  if (!s) {
    console.log(`  ${chave}: nenhum CC0 com ${minSegs}s+ — pulei`);
    return false;
  }
  /* ⚠️ A licença é RECONFERIDA aqui. Confiar só no filtro da consulta é
     confiar que a query saiu como eu escrevi — e ela é uma string montada. */
  if (!/^cc0$/i.test(s.license || "")) {
    console.error(`  ${chave}: ABORTADO, licença "${s.license}" não é CC0`);
    return false;
  }

  /**
   * ⚠️ `curl | ffmpeg`, e cada metade tem uma razão.
   *
   * **Por que não baixar inteiro:** as gravações boas têm 2 a 5 minutos em alta
   * taxa, e puxar dezenas de MB para usar 90 s estourou o tempo limite três
   * execuções seguidas. Com `-t 90`, o ffmpeg fecha o cano quando tem o que
   * precisa e o curl morre de SIGPIPE.
   *
   * **Por que não o ffmpeg direto na URL:** ele TEM https compilado (conferi
   * em `-protocols`), mas a saída deste ambiente passa por um proxy e o ffmpeg
   * não faz `CONNECT` — a conexão morre sem imprimir erro nenhum, que foi o
   * "ffmpeg falhou" mudo de quatro sons seguidos. Quem sabe atravessar o proxy,
   * com o pacote de certificados certo, é o curl.
   */

  /**
   * ⚠️ MONO, 32 kbps, OPUS — cada um com razão.
   *
   * MONO porque isto toca por baixo de uma meditação a 0,28 de ganho: a imagem
   * estéreo não é percebida e custa o dobro. OPUS porque iOS 17+ e todo Android
   * tocam, e ele segura ambiente melhor que mp3 na mesma taxa. 32 kbps porque
   * acima disso não há diferença audível em ruído de fundo — e cada mega é mega
   * que a paciente baixa no plano de dados dela.
   *
   * ⚠️ E COMEÇA EM 2 s (`-ss`): gravação de campo quase sempre abre com o clique
   * do gravador ou um segundo de silêncio, e os dois viram estalo no laço.
   */
  const alvo = join(SAIDA, `${chave}.webm`);
  /**
   * ⚠️ **DUAS PASSADAS DE `loudnorm`, E A MEDIÇÃO PROVA POR QUÊ.**
   *
   * Uma passada só (o modo dinâmico) errou feio nos oito primeiros arquivos:
   * o espalhamento de loudness ficou em **10,4 LU** com alvo de 1, e a fogueira
   * saiu 10 LU abaixo das vizinhas. Pior, quatro arquivos terminaram com pico
   * verdadeiro ACIMA de 0 dBTP (+2,6 na fogueira) — o Opus a 32 kbps ultrapassa
   * o pico do original na decodificação, e isso é distorção audível, não número
   * feio no relatório.
   *
   * A primeira passada MEDE, a segunda APLICA o que foi medido. `linear=true`
   * faz a correção ser um ganho só, sem compressão dinâmica: ambiente comprimido
   * perde justamente a diferença entre o estalo e o corpo do fogo.
   *
   * ⚠️ E A FONTE É BAIXADA UMA VEZ, para um WAV local de 120 s. Sem isso as duas
   * passadas seriam dois downloads — e as fontes vão de 5 a 42 minutos, o que já
   * estourou o tempo limite três vezes.
   */
  const temp = join(SAIDA, `.${chave}.wav`);
  const puxar = [
    `curl -sSL --max-time 480 ${JSON.stringify(s.url)}`,
    `${JSON.stringify(ff)} -y -hide_banner -loglevel error -i pipe:0 -t 120 -ac 1 -ar 48000 -c:a pcm_s16le ${JSON.stringify(temp)}`,
  ].join(" | ");
  spawnSync("bash", ["-c", puxar]);
  if (!existsSync(temp) || readFileSync(temp).length < 100 * 1024) {
    rmSync(temp, { force: true });
    console.error(`  ${chave}: não consegui puxar a fonte`);
    return false;
  }

  const ALVO = "I=-20:TP=-2:LRA=11";
  const medida = spawnSync(ff, [
    "-hide_banner",
    "-i",
    temp,
    "-af",
    `loudnorm=${ALVO}:print_format=json`,
    "-f",
    "null",
    "-",
  ]);
  const texto = String(medida.stderr ?? "");
  const bloco = texto.slice(texto.lastIndexOf("{"), texto.lastIndexOf("}") + 1);
  let m = null;
  try {
    m = JSON.parse(bloco);
  } catch {
    /* Sem medição confiável, cai para a passada única em vez de abortar: som
       com nível imperfeito é melhor que som nenhum. */
  }
  const filtro = m
    ? `loudnorm=${ALVO}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:` +
      `measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:linear=true`
    : `loudnorm=${ALVO}`;

  const r2 = spawnSync(ff, [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    temp,
    "-ss",
    "2",
    "-t",
    "90",
    "-af",
    filtro,
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
  rmSync(temp, { force: true });
  void r2;

  const bytes = existsSync(alvo) ? readFileSync(alvo).length : 0;
  if (bytes < 20 * 1024) {
    console.error(`  ${chave}: saiu vazio ou pequeno demais (${bytes} B)`);
    return false;
  }

  const kb = Math.round(bytes / 1024);
  /* ⚠️ A PROCEDÊNCIA É GRAVADA AGORA, NÃO NO FIM DO LAÇO.
     A primeira versão acumulava tudo em memória e escrevia uma vez só — e
     quando a execução foi interrompida no quinto som, os quatro arquivos que
     JÁ ESTAVAM EM DISCO ficaram sem nenhum registro de origem. Áudio sem
     procedência é áudio que ninguém pode provar que podia usar: teria de ser
     apagado e baixado de novo. Um `write` por arquivo custa nada e torna cada
     download independente do que vem depois. */
  creditos[chave] = {
    titulo: s.title,
    autor: s.creator,
    licenca: "CC0 1.0",
    origem: s.foreign_landing_url,
    via: "openverse",
  };
  writeFileSync(join(SAIDA, "CREDITOS.json"), JSON.stringify(creditos, null, 2) + "\n");
  console.log(
    `  ${chave}: ${kb} KB · ${Math.round(s.duration / 1000)}s · "${s.title}" — ${s.creator}`,
  );
  return true;
}

async function main() {
  const ff = ffmpeg();
  mkdirSync(SAIDA, { recursive: true });
  const args = process.argv.slice(2);

  if (args[0] === "--creditos") {
    /* ⚠️ RECONSTRUÇÃO DA PROCEDÊNCIA. A primeira versão do script só escrevia
       os créditos no fim, e uma execução interrompida deixou quatro arquivos em
       disco sem registro de origem. A escolha é DETERMINÍSTICA (a mais longa
       entre as CC0 acima do mínimo), então reconsultar devolve a mesma. */
    const arq = join(SAIDA, "CREDITOS.json");
    const cred = existsSync(arq) ? JSON.parse(readFileSync(arq, "utf8")) : {};
    for (const k of Object.keys(PEDIDOS)) {
      if (!existsSync(join(SAIDA, `${k}.webm`)) || cred[k]) continue;
      const s = await escolher(PEDIDOS[k].q, PEDIDOS[k].minSegs);
      if (!s) continue;
      cred[k] = {
        titulo: s.title,
        autor: s.creator,
        licenca: "CC0 1.0",
        origem: s.foreign_landing_url,
        via: "openverse",
      };
      console.log(`  ${k}: "${s.title}" — ${s.creator}`);
    }
    writeFileSync(arq, JSON.stringify(cred, null, 2) + "\n");
    return;
  }

  if (args[0] === "--ver") {
    const k = args[1];
    console.log(JSON.stringify(await escolher(PEDIDOS[k].q, PEDIDOS[k].minSegs), null, 2));
    return;
  }

  const arqCred = join(SAIDA, "CREDITOS.json");
  const creditos = existsSync(arqCred) ? JSON.parse(readFileSync(arqCred, "utf8")) : {};
  const chaves = args.length ? args : Object.keys(PEDIDOS);

  console.log(`\nBaixando ${chaves.length} som(ns) CC0 pelo Openverse:\n`);
  let ok = 0;
  for (const k of chaves) {
    if (!PEDIDOS[k]) {
      console.error(`  ${k}: não está na lista`);
      continue;
    }
    try {
      if (await baixarUm(k, ff, creditos)) ok++;
    } catch (e) {
      console.error(`  ${k}: ${e.message}`);
    }
  }
  writeFileSync(arqCred, JSON.stringify(creditos, null, 2) + "\n");
  console.log(`\n${ok}/${chaves.length} prontos em ${SAIDA}/\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
