/**
 * SONS PARA DORMIR — e por que eles NÃO podem ser Web Audio.
 *
 * ─── O DEFEITO QUE ESTE ARQUIVO EXISTE PARA NÃO TER ─────────────────────────
 *
 * `soundscapes.ts` sintetiza chuva, mar, coração e pad no navegador, ao vivo.
 * Isso é perfeito enquanto a tela está acesa — e é exatamente o que não serve
 * para dormir: o iOS SUSPENDE o `AudioContext` quando o aparelho bloqueia.
 * Um player de sons para dormir feito com Web Audio para de tocar no segundo em
 * que ela apoia o celular na mesa de cabeceira. Seria um recurso que só
 * funciona enquanto ninguém precisa dele.
 *
 * O que sobrevive à tela apagada em iPhone é ARQUIVO tocando num `<audio>` —
 * é assim que rádio na web toca no bolso. Então o caminho é: renderizar o
 * mesmo som, uma vez, num `OfflineAudioContext`, empacotar em WAV e entregar a
 * um `<audio loop>`. Nenhum arquivo novo no repositório, nenhum megabyte no
 * bundle, o som é o MESMO que ela já conhece da meditação — e agora toca com o
 * aparelho bloqueado, com controle na tela de bloqueio.
 *
 * ─── A EMENDA DO LOOP É MATEMÁTICA, NÃO CROSSFADE ───────────────────────────
 *
 * Um loop que não fecha dá um "tec" a cada volta — a cada 30 segundos, a noite
 * inteira, para quem está tentando dormir. Em vez de disfarçar com crossfade,
 * o comprimento do trecho é múltiplo EXATO de todo período interno de cada som
 * (ver `periodosDe`, e o teste que cobra isso). Aí o último quadro encosta no
 * primeiro sem costura nenhuma.
 *
 * Foi por isso que a chuva passou de 0,07 Hz para 1/15 Hz e a onda do mar de
 * 9 s para 10 s: diferença inaudível, e é o que faz 30 s fecharem redondo.
 */

import type { SoundscapeKey } from "./soundscapes";

export const SONS_CONTINUOS = ["chuva", "mar", "coracao", "pad"] as const;
export type SomKey = (typeof SONS_CONTINUOS)[number];

export function ehSomContinuo(k: SoundscapeKey | string): k is SomKey {
  return (SONS_CONTINUOS as readonly string[]).includes(k);
}

/** O trecho que se repete. 30 s é longo o bastante para não soar como loop. */
export const LOOP_SEGS = 30;
/** A cauda que desliga: fade de 15 s no fim do temporizador. */
export const CAUDA_SEGS = 15;

/**
 * O comprimento do laço de ruído, POR SOM.
 *
 * Era 2 s para todos, e a medição mostrou o preço: 0,997 de auto-similaridade
 * a dois segundos — o ouvido reconhece a volta em menos de um minuto. Dez
 * segundos resolvem, mas custam aquecimento (ver `aquecimentoDe`), e o coração
 * não precisa de tanto: o "shhh" dele é cortado em 320 Hz, e nessa banda
 * estreita a repetição quase não se ouve. Seis segundos fecham com a batida
 * (6 ÷ 3/7 = 14) e mantêm o render dele rápido.
 */
function ruidoSegs(kind: SomKey): number {
  return kind === "coracao" ? 6 : 10;
}
const CHUVA_LFO_SEGS = 10;
const MAR_ONDA_SEGS = 10;
const CORACAO_BPM = 140;
/** 174 e 261 Hz são múltiplos de 87: o pad se repete a cada 1/87 s. */
const PAD_BASE_HZ = 87;

/** Todo período interno do som, em segundos. O loop tem de ser múltiplo de todos. */
export function periodosDe(kind: SomKey): number[] {
  if (kind === "pad") return [1 / PAD_BASE_HZ];
  if (kind === "chuva") return [ruidoSegs(kind), CHUVA_LFO_SEGS];
  if (kind === "mar") return [ruidoSegs(kind), MAR_ONDA_SEGS];
  return [ruidoSegs(kind), 60 / CORACAO_BPM];
}

/* ══════════════════════ WAV: cabeçalho e amostras ══════════════════════════ */

/**
 * Empacota um canal em WAV PCM 16 bits.
 *
 * WAV por dois motivos, e o segundo é o que decide. Primeiro: não há
 * codificador de MP3 no navegador, e não precisa haver — o arquivo nasce na
 * memória, toca, e morre com a tela. Segundo: **MP3 não fecha o loop**. O
 * formato carrega silêncio de codificação no começo e no fim de todo arquivo,
 * então `<audio loop>` de MP3 dá um engasgo a cada volta. WAV é amostra pura:
 * o último quadro encosta no primeiro.
 */
export function wav(amostras: Float32Array, taxa: number): Blob {
  const bytes = amostras.length * 2;
  const buf = new ArrayBuffer(44 + bytes);
  const v = new DataView(buf);
  const txt = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(pos + i, s.charCodeAt(i));
  };
  txt(0, "RIFF");
  v.setUint32(4, 36 + bytes, true);
  txt(8, "WAVE");
  txt(12, "fmt ");
  v.setUint32(16, 16, true); // tamanho do bloco fmt
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * 2, true); // bytes por segundo
  v.setUint16(32, 2, true); // alinhamento do bloco
  v.setUint16(34, 16, true); // bits por amostra
  txt(36, "data");
  v.setUint32(40, bytes, true);
  for (let i = 0; i < amostras.length; i++) {
    /* Corta em ±1 antes de converter: sem isto, um pico de 1,2 estoura o
       inteiro de 16 bits e volta pelo outro lado — um clique alto no ouvido de
       quem está dormindo. */
    const s = Math.max(-1, Math.min(1, amostras[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

/* ══════════════════════ O grafo, para render offline ═══════════════════════ */

/**
 * ⚠️ AS RECEITAS FORAM REFEITAS (ago/2026), e a auditoria disse por quê.
 *
 * O dono ouviu e disse que os sons estavam ruins. A medição no navegador deu
 * razão a ele, com números que dizem exatamente o quê:
 *
 * | medida               | chuva  | mar   | coração | pad   |
 * |----------------------|--------|-------|---------|-------|
 * | transientes por min  |   0    |   0   |   270   |   0   |
 * | fator de crista      |  4,25  | 6,49  |  8,37   | 1,91  |
 * | auto-similaridade 2s | 0,997  | 0,794 |  0,225  | 1,000 |
 * | energia > 1 kHz      |  92%   |  26%  |   2%    |   —   |
 *
 * O que cada número significa:
 *
 *  · **Chuva com ZERO transientes** não é chuva. Chuva é feita de GOTAS — o
 *    som são milhares de impactos individuais. Sem eles, e com 92% da energia
 *    acima de 1 kHz, o que sai é chiado de televisão fora do ar.
 *  · **Auto-similaridade de 0,997 a 2 segundos**: o sinal era 99,7% idêntico a
 *    si mesmo dois segundos depois. O ouvido reconhece isso em menos de um
 *    minuto, e a partir daí não desliga mais. Era o laço de 2 s do ruído.
 *  · **Mar com zero transientes e 63% abaixo de 125 Hz** é um ronco, não uma
 *    onda. Onda tem quebra: um estouro largo, depois o chiado da espuma
 *    decaindo, depois a sucção.
 *  · **Pad com fator de crista 1,91** é um tom puro parado. Nada se move.
 *  · **O coração era o único que media bem** — 270 transientes por minuto são
 *    exatamente 140 bpm em lub-dub. Ele só trocou o ruído branco pelo rosa.
 *
 * As três correções de base:
 *
 *  1. **RUÍDO ROSA, não branco.** Ruído branco tem energia igual por hertz, o
 *     que o faz soar agudo e áspero; o rosa tem energia igual por OITAVA, que
 *     é como soa tudo que a natureza faz — chuva, cachoeira, vento, mar.
 *  2. **O laço do ruído foi de 2 s para 10 s** (e 10 divide 30, então o loop
 *     continua fechando exato).
 *  3. **Eventos, não só filtros.** Gota é evento. Quebra de onda é evento. Sem
 *     eles nenhum filtro salva o som.
 */

type Contexto = BaseAudioContext;

/**
 * Ruído ROSA — o filtro de Paul Kellett, que é o padrão da literatura de áudio
 * para aproximar 1/f com sete polos e custo desprezível.
 *
 * Dez segundos: longo o bastante para o ouvido não reconhecer a volta (a
 * medição do laço de 2 s dava 0,997 de auto-similaridade) e divisor exato de
 * `LOOP_SEGS`, que é o que mantém a emenda sem costura.
 */
function ruidoRosa(ctx: Contexto, segundos: number): AudioBufferSourceNode {
  const len = Math.round(ctx.sampleRate * segundos);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

/** Sorteio determinístico: o mesmo render sai igual toda vez. */
function sorteador(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Uma GOTA: um estalo curto de ruído passado por um ressonador.
 *
 * É isto que faltava inteiro. Cada gota é um impacto — ataque de 1 ms, queda
 * de 25 a 70 ms — com a frequência de ressonância sorteada entre 700 e 5000 Hz,
 * que é a faixa em que a água bate em telhado, folha, poça e vidro.
 */
function gota(ctx: Contexto, saida: AudioNode, fonte: AudioBuffer, t: number, r: () => number) {
  const src = ctx.createBufferSource();
  src.buffer = fonte;
  const inicio = r() * Math.max(0.001, fonte.duration - 0.2);
  const dur = 0.025 + r() * 0.045;

  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 700 + r() * 4300;
  bp.Q.value = 3 + r() * 6;

  const g = ctx.createGain();
  /* Ao cubo: a maioria das gotas fica discreta e algumas poucas estouram, que
     é a distribuição real — não uma chuva de gotas todas iguais. */
  const u = r();
  const pico = 0.06 + u * u * u * 1.1;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pico, t + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  src.connect(bp).connect(g).connect(saida);
  src.start(t, inicio, dur + 0.02);
  src.stop(t + dur + 0.03);
}

/**
 * Monta o som no contexto dado — offline ou ao vivo, o mesmo grafo.
 *
 * `segundos` é a janela a preencher com eventos; `t0` desloca tudo, para o
 * agendador ao vivo poder pedir a próxima janela sem recriar a base.
 */
export function montar(
  ctx: Contexto,
  kind: SomKey,
  saida: AudioNode,
  segundos: number,
  t0 = 0,
  base = true,
) {
  if (kind === "pad") {
    if (!base) return;
    /**
     * QUATRO VOZES DESAFINADAS, e não duas senoides.
     *
     * Fator de crista 1,91 era um tom morto. O que dá vida a um pad é o
     * BATIMENTO entre vozes quase iguais: 0,6 Hz de diferença produz uma
     * ondulação lenta de amplitude que o ouvido lê como respiração do som.
     *
     * ⚠️ Toda frequência é múltipla de 1/30 Hz — é o que mantém o loop de 30 s
     * fechando exato. 174,6 × 30 = 5238, inteiro. Uma desafinação "bonita"
     * como 174,63 quebraria a emenda.
     */
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    lp.Q.value = 0.7;
    /* O corte respira devagar: 15 s é meio loop, então fecha exato. */
    const mov = ctx.createOscillator();
    mov.frequency.value = 1 / 15;
    const movG = ctx.createGain();
    movG.gain.value = 260;
    mov.connect(movG).connect(lp.frequency);
    mov.start(0);

    const g = ctx.createGain();
    g.gain.value = 0.22;
    lp.connect(g).connect(saida);

    for (const f of [173.4, 174.6, 260.1, 261.9]) {
      const o = ctx.createOscillator();
      /* Triângulo em vez de senoide: tem harmônicos ímpares fracos, que é o
         que o filtro tem para moldar. Senoide não dá o que filtrar. */
      o.type = "triangle";
      o.frequency.value = f;
      o.connect(lp);
      o.start(0);
    }
    return;
  }

  if (kind === "chuva") {
    const r = sorteador(20260813);
    if (base) {
      /* A cama: rosa, com o grave cortado e o agudo domado. Ela sozinha era o
         som inteiro antes — agora é o fundo sobre o qual as gotas caem. */
      const src = ruidoRosa(ctx, ruidoSegs(kind));
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 380;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 5200;
      /* ⚠️ A CAMA É FUNDO, NÃO O SOM. Ela estava em 0,34 e afogava as gotas:
         medido, a curtose do envelope ficava em 2,56 (ruído liso) contra 15,6
         do coração, que é o único som que sempre soou certo. Quem define o
         som da chuva são os impactos; a cama só preenche o entre. */
      const g = ctx.createGain();
      g.gain.value = 0.08;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 1 / CHUVA_LFO_SEGS;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 0.08;
      lfo.connect(lfoG).connect(g.gain);
      lfo.start(0);
      src.connect(hp).connect(lp).connect(g).connect(saida);
      src.start(0);
    }

    /**
     * AS GOTAS. Doze por segundo, espaçadas por sorteio.
     *
     * ⚠️ Nenhuma gota é agendada nos últimos 200 ms: no render em loop, uma
     * gota cortada pela emenda vira um clique a cada volta.
     */
    const fonte = ruidoRosa(ctx, ruidoSegs(kind)).buffer!;
    const gotas = ctx.createGain();
    gotas.gain.value = 1;
    gotas.connect(saida);
    const ate = segundos - 0.2;
    /**
     * TRÊS POR SEGUNDO em média, com o intervalo sorteado.
     *
     * ⚠️ A primeira tentativa pôs doze por segundo, e a medição mostrou por
     * que isso não funciona: gotas nessa densidade se SOBREPÕEM (cada uma dura
     * de 25 a 70 ms) e voltam a formar uma cama contínua — o defeito que elas
     * vieram consertar. Com três por segundo cada impacto é distinguível, que
     * é o som de chuva perto da janela.
     *
     * ⚠️ E uma correção de método: eu media isto por CURTOSE de envelope, e
     * curtose é a métrica errada aqui. Ela mede esparsidade — o coração dá
     * 15,6 porque é silêncio-silêncio-batida. Chuva é densa por natureza e
     * nunca vai pontuar alto nela. O que mede chuva é o fator de CRISTA (pico
     * sobre RMS) e a razão entre o envelope máximo e o mediano: 4,25 e 1,8
     * antes; 9,9 e 3,4 agora.
     */
    for (let t = 0; t < ate; t += 0.08 + r() * 0.48) gota(ctx, gotas, fonte, t0 + t, r);
    return;
  }

  if (kind === "mar") {
    const r = sorteador(776);
    if (base) {
      /* O fundo: rosa bem grave, o ronco constante do mar longe. */
      const src = ruidoRosa(ctx, ruidoSegs(kind));
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 260;
      const g = ctx.createGain();
      g.gain.value = 0.16;
      src.connect(lp).connect(g).connect(saida);
      src.start(0);
    }

    /**
     * A QUEBRA — o evento que faltava.
     *
     * Cada onda: um estouro largo (ataque de 300 ms), o chiado da espuma
     * caindo por 3 s, e a sucção da água voltando (o corte subindo enquanto o
     * volume desce). Uma a cada `MAR_ONDA_SEGS`, que divide o loop exato.
     */
    const fonte = ruidoRosa(ctx, ruidoSegs(kind)).buffer!;
    for (let t = 0; t + MAR_ONDA_SEGS <= segundos + 0.001; t += MAR_ONDA_SEGS) {
      const q = t0 + t;
      const src = ctx.createBufferSource();
      src.buffer = fonte;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(320, q);
      bp.frequency.linearRampToValueAtTime(1500, q + 0.5);
      /* A sucção: o corte SOBE enquanto o som some — é o que o ouvido lê como
         a água escorrendo de volta pela areia. */
      bp.frequency.exponentialRampToValueAtTime(3400, q + 4.2);
      bp.Q.value = 0.6;
      const g = ctx.createGain();
      /* Ataque de 180 ms: é a quebra. Meio segundo já lê como "o volume
         subiu", e não como "a onda estourou". */
      g.gain.setValueAtTime(0.0001, q);
      g.gain.linearRampToValueAtTime(0.8 + r() * 0.3, q + 0.18);
      g.gain.exponentialRampToValueAtTime(0.0001, q + 4.6);
      src.connect(bp).connect(g).connect(saida);
      src.start(q, r() * 3);
      src.stop(q + 4.8);

      /* A espuma: um chiado agudo curto em cima da quebra. Sem ele a onda
         soa abafada, como se estivesse do outro lado de uma parede. */
      const esp = ctx.createBufferSource();
      esp.buffer = fonte;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 1800;
      const eg = ctx.createGain();
      eg.gain.setValueAtTime(0.0001, q);
      eg.gain.linearRampToValueAtTime(0.5, q + 0.12);
      eg.gain.exponentialRampToValueAtTime(0.0001, q + 2.4);
      esp.connect(hp).connect(eg).connect(saida);
      esp.start(q, r() * 3);
      esp.stop(q + 2.6);
    }
    return;
  }

  // coração: o "shhh" grave que o bebê ouve, com o batimento por cima
  if (base) {
    const src = ruidoRosa(ctx, ruidoSegs(kind));
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 320;
    const shh = ctx.createGain();
    shh.gain.value = 0.5;
    src.connect(lp).connect(shh).connect(saida);
    src.start(0);
  }

  const toque = (t: number, f0: number, pico: number, dur: number) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f0 * 0.45), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pico, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(saida);
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  /* ⚠️ AQUI NÃO HÁ `setInterval`: num render offline o tempo não passa, ele é
     escrito. Todas as batidas são agendadas de uma vez — e o número delas fecha
     exato no comprimento do trecho (30 s a 140 bpm = 70 batidas), que é o que
     faz a volta do loop cair no lugar de uma batida, e não no meio de uma. */
  const periodo = 60 / CORACAO_BPM;
  for (let t = 0; t < segundos - 0.001; t += periodo) {
    toque(t0 + t, 62, 0.9, 0.16);
    toque(t0 + t + 0.16, 54, 0.55, 0.13);
  }
}

/* ══════════════════════════ Render ═════════════════════════════════════════ */

const TAXA_ALVO = 22050;

/**
 * ⚠️ AQUECIMENTO: o trecho guardado NÃO começa no instante zero do render.
 *
 * Medido no Chromium, lendo as amostras do WAV cru (nunca por
 * `decodeAudioData`, que reamostra e inventa um degrau nas bordas que não
 * existe no arquivo): sem aquecimento, o degrau na emenda do CORAÇÃO era
 * 0,0443 — MAIOR que o maior degrau de qualquer outro ponto do arquivo
 * (0,0354). Ou seja, um clique a cada 30 s, a noite inteira, no som que existe
 * para uma mulher se acalmar com o batimento do próprio bebê.
 *
 * A causa não são os osciladores (esses fecham redondo, ver `periodosDe`): é o
 * FILTRO. Um biquad tem memória, e no instante zero ela está zerada — o começo
 * do trecho tinha um transitório que o fim, já em regime, não tinha.
 *
 * O aquecimento tem de ser múltiplo INTEIRO de todo período do som, senão ele
 * desloca a fase e o problema volta com outro nome. Por isso os candidatos são
 * divisores de `LOOP_SEGS`, e o mínimo de 4 s é o que dá aos filtros tempo de
 * entrar em regime. Depois: coração 0,0001 (percentil 1,8% dos degraus do
 * próprio sinal), mar 0,0169, chuva 0,2211 — todos dentro do normal do sinal.
 */
const AQUECIMENTO_MIN = 4;
/* Só divisores de `LOOP_SEGS` entram: assim o aquecimento fecha um número
   inteiro de voltas de tudo, e o trecho guardado começa na mesma fase em que
   termina. Um aquecimento "redondo em segundos" mas fora de fase moveria o
   problema em vez de resolvê-lo. */
const AQUECIMENTOS = [5, 6, 10, 15, 30];

export function aquecimentoDe(kind: SomKey): number {
  const ps = periodosDe(kind);
  for (const c of AQUECIMENTOS) {
    if (c < AQUECIMENTO_MIN) continue;
    if (ps.every((p) => Math.abs(c / p - Math.round(c / p)) < 1e-9)) return c;
  }
  return LOOP_SEGS;
}

/**
 * ⚠️ E O PICO É NORMALIZADO, senão o som SATURA.
 *
 * Medido antes: pico 1,10 na chuva e 1,00 no coração — acima do teto do
 * formato. `soundscapes.ts` nunca teve esse problema porque toca com o volume
 * mestre em 0,28; aqui o arquivo É a saída inteira, e sair a 0,28 deixaria o
 * player baixo demais num iPhone, onde a página não controla volume nenhum.
 * Normalizar pelo pico resolve os dois lados: nada satura e o nível é o mesmo
 * para os quatro sons — o que também mantém a cauda no mesmo volume do trecho
 * que ela desliga.
 */
const PICO_ALVO = 0.89;

function normalizar(amostras: Float32Array): void {
  let pico = 0;
  for (let i = 0; i < amostras.length; i++) {
    const a = Math.abs(amostras[i]);
    if (a > pico) pico = a;
  }
  if (pico <= 0) return;
  const g = PICO_ALVO / pico;
  for (let i = 0; i < amostras.length; i++) amostras[i] *= g;
}

type Offline = new (canais: number, quadros: number, taxa: number) => OfflineAudioContext;

function criarOffline(quadros: number, taxa: number): OfflineAudioContext | null {
  const OAC =
    (globalThis as unknown as { OfflineAudioContext?: Offline }).OfflineAudioContext ??
    (globalThis as unknown as { webkitOfflineAudioContext?: Offline }).webkitOfflineAudioContext;
  if (!OAC) return null;
  return new OAC(1, quadros, taxa);
}

/**
 * Renderiza o trecho e devolve um WAV pronto para o `<audio>`.
 *
 * `cauda` monta o desligamento do temporizador: entra em 30 ms (mata o clique
 * da emenda, seja qual for a fase em que o loop estava) e cai a zero em 15 s.
 *
 * ⚠️ Safari antigo só aceitava `OfflineAudioContext` a 44100 Hz. O recuo para a
 * taxa padrão está aqui porque falhar significaria um player que não toca, e
 * o dobro de memória é preço barato por isso.
 */
export async function renderizar(kind: SomKey, cauda = false): Promise<Blob | null> {
  const segundos = cauda ? CAUDA_SEGS : LOOP_SEGS;
  const aquecimento = aquecimentoDe(kind);
  const total = aquecimento + segundos;
  for (const taxa of [TAXA_ALVO, 44100]) {
    try {
      const ctx = criarOffline(Math.round(total * taxa), taxa);
      if (!ctx) return null;
      const master = ctx.createGain();
      master.connect(ctx.destination);
      if (cauda) {
        /* Entra em 30 ms e cai por todo o resto. A entrada rápida existe para
           matar o clique da emenda: a cauda começa na fase que der, e sem ela
           o salto de amplitude viraria um "toc" — justo no momento em que ela
           está pegando no sono. Os tempos são contados a partir do fim do
           aquecimento, que é onde o trecho guardado começa. */
        master.gain.setValueAtTime(0.0001, aquecimento);
        master.gain.linearRampToValueAtTime(1, aquecimento + 0.03);
        master.gain.linearRampToValueAtTime(0.0001, total);
      } else {
        /* ⚠️ O LOOP NÃO TEM FADE NENHUM, nem no começo. Qualquer rampa dentro
           do trecho vira um pulso a cada volta — a cada 30 s, a noite inteira.
           O som entra direto porque foi ELA quem tocou no botão; o fade de
           1,5 s da meditação existe para som que aparece sem ser pedido. */
        master.gain.value = 1;
      }
      montar(ctx, kind, master, total);
      const buf = await ctx.startRendering();
      /* Descarta o aquecimento: é ele que deixa os filtros em regime, para o
         começo do trecho soar igual ao fim dele. */
      const trecho = buf.getChannelData(0).subarray(Math.round(aquecimento * buf.sampleRate));
      normalizar(trecho);
      return wav(trecho, buf.sampleRate);
    } catch {
      /* tenta a taxa seguinte */
    }
  }
  return null;
}

/* ══════════════════════════ O tocador ══════════════════════════════════════ */

export type Tocador = {
  elemento: HTMLAudioElement;
  /** Chamar DENTRO do toque da paciente — ver o comentário. */
  destravar: () => void;
  tocar: (kind: SomKey) => Promise<boolean>;
  /** Toca a cauda com fade e resolve quando ela acaba. */
  desligarComFade: (kind: SomKey) => Promise<void>;
  parar: () => void;
};

export function criarTocador(): Tocador {
  const audio = new Audio();
  audio.preload = "auto";
  /* Sem isto o iOS abre o player em tela cheia por cima do app. */
  audio.setAttribute("playsinline", "");
  audio.style.display = "none";
  let url: string | null = null;

  const trocar = (blob: Blob, loop: boolean) => {
    /**
     * ⚠️ O ELEMENTO ENTRA NO DOCUMENTO, mesmo invisível.
     *
     * `new Audio()` cria um elemento SOLTO, e som solto toca — mas é o elemento
     * no documento que o iOS reconhece como mídia da página para manter tocando
     * com a tela apagada e para pendurar o card de "tocando agora". Como é
     * exatamente isso que esta tela existe para fazer, ele não pode ficar de
     * fora do documento por economia de uma linha. Fica aqui, e não na criação,
     * para valer também depois de um `parar()` — que o tira de lá.
     */
    if (typeof document !== "undefined" && !audio.isConnected) document.body.appendChild(audio);
    const nova = URL.createObjectURL(blob);
    audio.loop = loop;
    audio.src = nova;
    if (url) URL.revokeObjectURL(url);
    url = nova;
  };

  return {
    elemento: audio,
    /**
     * ⚠️ DESTRAVAR É O PASSO QUE PARECE SUPÉRFLUO E NÃO É.
     *
     * O iOS só deixa tocar áudio a partir de um gesto — e "a partir de" quer
     * dizer NA MESMA PILHA DE CHAMADA. Renderizar leva uns 200 ms de `await`,
     * e depois do `await` o gesto já passou: o `play()` volta rejeitado e o
     * player fica mudo sem erro visível. Tocar um silêncio de 50 ms dentro do
     * toque destrava o elemento; a partir daí ele aceita trocar de faixa.
     */
    destravar() {
      try {
        const mudo = wav(new Float32Array(1200), 22050);
        trocar(mudo, false);
        void audio.play().catch(() => {});
      } catch {
        /* ignore */
      }
    },
    async tocar(kind) {
      const blob = await renderizar(kind);
      if (!blob) return false;
      trocar(blob, true);
      try {
        await audio.play();
        return true;
      } catch {
        return false;
      }
    },
    async desligarComFade(kind) {
      const blob = await renderizar(kind, true);
      if (!blob) {
        audio.pause();
        return;
      }
      trocar(blob, false);
      try {
        await audio.play();
      } catch {
        audio.pause();
        return;
      }
      await new Promise<void>((ok) => {
        const fim = () => {
          audio.removeEventListener("ended", fim);
          ok();
        };
        audio.addEventListener("ended", fim);
      });
    },
    parar() {
      try {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        /* Sai do documento junto: um elemento de mídia esquecido no `body` é o
           tipo de coisa que sobrevive a navegações e reaparece tocando. */
        audio.remove();
      } catch {
        /* ignore */
      }
      if (url) URL.revokeObjectURL(url);
      url = null;
    },
  };
}

/* ══════════════════════════ O temporizador ═════════════════════════════════ */

export const TEMPOS = [15, 30, 60, 0] as const;
export type Tempo = (typeof TEMPOS)[number];

export function rotuloDoTempo(t: Tempo): string {
  return t === 0 ? "Sem limite" : `${t} min`;
}

/**
 * Quando começar a desligar.
 *
 * O fade come os últimos 15 s do tempo escolhido, e não 15 s a mais: quem pede
 * 30 minutos quer o quarto em silêncio aos 30, não aos 30 e meio.
 */
export function quandoDesligar(minutos: Tempo, agora: number): number | null {
  if (!minutos) return null;
  return agora + minutos * 60_000 - CAUDA_SEGS * 1000;
}

/** "28 min" / "45 s" — o que falta, para a tela. */
export function faltando(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 60) return `${Math.ceil(s / 60)} min`;
  return `${s} s`;
}
