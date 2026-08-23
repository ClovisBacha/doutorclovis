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

import { noLaco, nota } from "./afinacao";
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
 * O comprimento do laço de ruído: o LAÇO INTEIRO, para nada se repetir dentro
 * dele.
 *
 * ─── A HISTÓRIA, PORQUE ELA SE REPETIU DUAS VEZES ───────────────────────────
 *
 * Era 2 s para todos, e a medição mostrou o preço: 0,997 de auto-similaridade
 * a dois segundos. Passou para 10 s (6 no coração), e a prosa deu o caso por
 * encerrado.
 *
 * ⚠️ **Não estava.** `scripts/ouvir.mjs` mediu a curva inteira de lags e achou
 * o mesmo defeito um degrau adiante: ~0 em todos os lags e **0,993 exatamente
 * em 10 s** — o laço só tinha ficado cinco vezes mais lento, não tinha sumido.
 * E a decomposição do render mostrou por que isso é grave na chuva: a cama vale
 * 99% da energia (RMS 0,0126 contra 0,0012 das gotas), então o que o ouvido
 * mais ouve É a cama, e a cama voltava a cada dez segundos.
 *
 * Com a cama durando `LOOP_SEGS`, nada se repete dentro do trecho: o laço de
 * ruído e o laço do arquivo passam a ser o MESMO laço.
 *
 * ⚠️ O que impedia isso era uma regra que se provou falsa (ver `XFADE_SEGS`):
 * o aquecimento precisava ser múltiplo de todo período, e uma cama de 30 s
 * forçaria aquecimento de 30 s. Como a emenda hoje fecha por costura e não por
 * fase, o aquecimento é um número só, e a cama pode ter o tamanho que precisar.
 *
 * O custo foi MEDIDO no Chromium, e é barato: gerar 30 s de ruído rosa a
 * 48 kHz leva **45 ms** (10 s levava 16 ms) e ocupa 5,5 MB. São três quadros,
 * uma vez por sessão, atrás de um fade de entrada de 1,5 s.
 */
function ruidoSegs(_kind: SomKey): number {
  return LOOP_SEGS;
}
const CHUVA_LFO_SEGS = 10;
const MAR_ONDA_SEGS = 10;
const CORACAO_BPM = 140;

/**
 * AS QUATRO VOZES DO PAD, agora afinadas — fá 3 e dó 4 em A = 432.
 *
 * Eram 173,4 · 174,6 · 260,1 · 261,9: um fá e um dó de A = 440, arredondados à
 * mão até caírem na grade do laço. Soavam bem e não pertenciam a sistema
 * nenhum — nem ao 440, nem ao 432, nem ao resto do app.
 *
 * ⚠️ A NOTA É A MESMA, só que certa. Em A = 432 o fá 3 dá 171,44 Hz e o dó 4
 * dá 256,87, contra 174,61 e 261,63 do padrão ISO: o timbre não muda, o
 * intervalo continua sendo a quinta justa, e o pad passa a concordar com os
 * sinos, com a música e com o marco da semana.
 *
 * A DESAFINAÇÃO DE ±0,6 Hz é o que dá vida ao pad — o batimento entre vozes
 * quase iguais produz uma ondulação lenta de amplitude que o ouvido lê como
 * respiração do som. Sem ela o fator de crista fica em 1,91, que é um tom
 * morto.
 *
 * ⚠️ E TUDO PASSA POR `noLaco`: cada frequência tem de fechar volta inteira em
 * 30 s, senão sobra meia volta na emenda. `171,44 × 30 = 5143,3` — quebrado, e
 * seria um estalo a cada 30 s. `noLaco` põe em 171,4333, a 0,07 cents de
 * distância.
 */
const PAD_VOZES = [
  noLaco(nota("fa", 3) - 0.6),
  noLaco(nota("fa", 3) + 0.6),
  noLaco(nota("do", 4) - 0.6),
  noLaco(nota("do", 4) + 0.6),
];

/** Todo período interno do som, em segundos. O loop tem de ser múltiplo de todos. */
export function periodosDe(kind: SomKey): number[] {
  /* Cada voz do pad fecha sozinha em 30 s (é o que `noLaco` garante), então o
     período de cada uma entra na lista — o teste da emenda confere uma a uma
     em vez de confiar numa base comum escrita à mão. */
  if (kind === "pad") return [...PAD_VOZES.map((f) => 1 / f), 15];
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
 * Ruído BRANCO — energia igual por hertz.
 *
 * A cama dos sons é rosa (energia igual por oitava, que é como soa tudo que a
 * natureza faz), mas quem alimenta um RESSONADOR precisa ser branco: o rosa
 * cai 3 dB por oitava, e entre 700 e 5000 Hz — que é onde a água bate — já
 * sobrou pouquíssima energia. Foi essa a causa de as gotas saírem cem vezes
 * mais fracas do que o envelope pedia.
 */
function ruidoBranco(ctx: Contexto, segundos: number, semente = 7): AudioBuffer {
  const len = Math.round(ctx.sampleRate * segundos);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const rnd = sorteador(semente);
  for (let i = 0; i < len; i++) d[i] = rnd() * 2 - 1;
  return buf;
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
 * Ruído ROSA — o filtro de Paul Kellett, que é o padrão da literatura de áudio
 * para aproximar 1/f com sete polos e custo desprezível.
 *
 * Dez segundos: longo o bastante para o ouvido não reconhecer a volta (a
 * medição do laço de 2 s dava 0,997 de auto-similaridade) e divisor exato de
 * `LOOP_SEGS`, que é o que mantém a emenda sem costura.
 */
function ruidoRosa(ctx: Contexto, segundos: number, semente = 1): AudioBufferSourceNode {
  const len = Math.round(ctx.sampleRate * segundos);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  /* ⚠️ SORTEIO COM SEMENTE, e não `Math.random()`.
     Com `Math.random()` a cama saía DIFERENTE a cada render — o mesmo som
     medido duas vezes dava dois números, e `scripts/ouvir.mjs` não teria como
     dizer se uma mudança melhorou ou se foi o sorteio. Determinismo aqui é o
     que torna a bancada uma bancada. */
  const rnd = sorteador(semente);
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = rnd() * 2 - 1;
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

/**
 * Quanto uma gota precisa ser amplificada para valer o que o envelope diz.
 * Medido na bancada — ver o comentário dentro de `gota`.
 */
const GANHO_GOTA = 1.2;

/**
 * Uma GOTA: um estalo curto de ruído passado por um ressonador.
 *
 * É isto que faltava inteiro. Cada gota é um impacto — ataque de 1 ms, queda
 * de 25 a 70 ms — com a frequência de ressonância sorteada entre 700 e 5000 Hz,
 * que é a faixa em que a água bate em telhado, folha, poça e vidro.
 */
function gota(
  ctx: Contexto,
  saida: AudioNode,
  fonte: AudioBuffer,
  t: number,
  r: () => number,
  forca = 1,
) {
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
  /**
   * ⚠️ `GANHO_GOTA` NÃO É TEMPERO — é a correção de um defeito medido.
   *
   * O comentário da chuva sempre disse que "quem define o som são os impactos;
   * a cama só preenche o entre", e a cama foi baixada de 0,34 para 0,08 por
   * causa disso. Só que `pico` é o ganho de um nó de GANHO, não a amplitude de
   * saída: o que passa por ele é ruído já filtrado por um passa-faixa de Q
   * entre 3 e 9, que corta quase tudo. Decompondo o render, as gotas ficavam em
   * RMS 0,0012 contra 0,0126 da cama — **1% da energia**. A intenção escrita
   * nunca chegou ao sinal.
   *
   * Trocar a fonte para ruído branco recupera parte; o resto é este ganho, e
   * ele foi ACERTADO NA BANCADA (`node scripts/ouvir.mjs`) até as gotas e a
   * cama ficarem no mesmo patamar de energia.
   */
  /**
   * ⚠️ A CAUDA DA DISTRIBUIÇÃO PRECISOU SER DOMADA, e o motivo é a
   * normalização.
   *
   * Era `0,06 + u³ · 1,1`: a gota mais forte sai 19× a mediana. Como o arquivo
   * é normalizado PELO PICO, essa única gota define o volume de tudo — medido,
   * o fator de crista foi a 36 e o RMS do arquivo caiu de 0,134 para 0,025,
   * ou seja um som cinco vezes mais baixo num iPhone, onde a página não
   * controla volume nenhum.
   *
   * `0,25 + u² · 0,75` mantém a variedade (a razão entre a mais forte e a mais
   * fraca continua sendo 4) sem que uma gota isolada esmague o arquivo.
   */
  const pico = (0.25 + u * u * 0.75) * GANHO_GOTA * forca;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pico, t + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  src.connect(bp).connect(g).connect(saida);
  src.start(t, inicio, dur + 0.02);
  src.stop(t + dur + 0.03);
}

/**
 * ⚠️ A SEMENTE DEPENDE DA JANELA — e sem isso a chuva se repetia a cada 20 s.
 *
 * `montar` sorteia com semente fixa. No render offline ela é chamada UMA vez,
 * então a sequência corre do começo ao fim e nada se repete. **Ao vivo é o
 * contrário**: `createSoundscape` chama uma vez por janela de `JANELA_SEGS`,
 * e com semente fixa toda janela recebia a MESMA sequência — as mesmas gotas,
 * nos mesmos instantes, nas mesmas frequências, a cada vinte segundos, durante
 * a meditação inteira.
 *
 * Somar o instante da janela conserta ao vivo e não mexe no offline, onde
 * `t0` é sempre 0 e a semente continua sendo a de sempre — o render segue
 * reproduzível, que é o que a bancada precisa.
 */
function semente(base: number, t0: number): number {
  return (base + Math.round(t0 * 1000)) >>> 0;
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
     * ⚠️ Toda frequência passa por `noLaco` — ver `PAD_VOZES`. Uma desafinação
     * "bonita" escrita à mão quebraria a emenda.
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

    for (const f of PAD_VOZES) {
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
    const r = sorteador(semente(20260813, t0));
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
      /**
       * ⚠️ A CAMA VOLTOU A SUBIR — e não é um recuo, é consequência.
       *
       * Ela foi de 0,34 para 0,08 quando as gotas foram criadas, com o
       * argumento de que "afogava as gotas". O argumento estava certo e o
       * remédio errado: as gotas não estavam sendo afogadas pela cama, estavam
       * saindo cem vezes mais fracas do que o envelope pedia (ver
       * `GANHO_GOTA`). Baixar a cama escondeu o sintoma e trouxe outro — o
       * arquivo é normalizado PELO PICO, então cama baixa com gotas altas dá um
       * arquivo de RMS baixo, ou seja um som fraco num iPhone.
       *
       * Com as gotas no nível certo, a cama pode voltar ao que ela é: o chiado
       * das mil gotas distantes que não se distinguem uma da outra. Os dois
       * números foram acertados juntos na bancada.
       */
      const g = ctx.createGain();
      g.gain.value = 0.24;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 1 / CHUVA_LFO_SEGS;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 0.1;
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
    const fonte = ruidoBranco(ctx, 2, 991);
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
    const r = sorteador(semente(776, t0));
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
/**
 * ⚠️ UM NÚMERO SÓ, e a regra antiga era falsa.
 *
 * A versão anterior escolhia o aquecimento entre os divisores de `LOOP_SEGS`
 * que fossem múltiplos de todo período do som, com a justificativa de que um
 * aquecimento "fora de fase moveria o problema em vez de resolvê-lo".
 *
 * A medição (registrada em `XFADE_SEGS`) desmentiu: variando SÓ o aquecimento,
 * o degrau da emenda pula sem padrão nenhum — os múltiplos não são melhores
 * que os outros. A conta explica: para um sinal de período p, o trecho
 * [w, w+L] fecha se **L** for múltiplo de p; w não entra.
 *
 * O que o aquecimento faz de verdade, e só isso, é dar aos FILTROS tempo de
 * sair do estado zerado — um biquad tem memória, e no instante zero ela está
 * vazia. Oito segundos cobrem com folga o mais lento que existe aqui, e são
 * baratos: o render passa a durar `8 + 30` segundos de tempo simulado, contra
 * os 40 do pior caso anterior.
 */
const AQUECIMENTO_SEGS = 8;

export function aquecimentoDe(_kind: SomKey): number {
  return AQUECIMENTO_SEGS;
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

/**
 * ⚠️ A EMENDA FECHA POR CROSSFADE — e a prosa antiga daqui estava errada.
 *
 * O arquivo afirmava que o aquecimento "tem de ser múltiplo inteiro de todo
 * período do som, senão ele desloca a fase e o problema volta". Medido no
 * Chromium, o degrau da emenda por aquecimento (4 · 7 · 10 · 11 · 13 · 30 s):
 *
 *     chuva   0,0269  0,0025  0,0068  0,0131  0,0788  0,0841
 *     pad     0,0441  0,0031  0,0509  0,0041  0,0010  0,0463
 *
 * Não há padrão nenhum favorecendo os múltiplos — os valores pulam. A conta
 * explica por quê: para um sinal de período p, o trecho [w, w+L] fecha se **L**
 * for múltiplo de p, e w não entra na conta. O aquecimento serve para os
 * filtros entrarem em regime, e só.
 *
 * E ficou à mostra um defeito que o critério antigo escondia: no PAD, o maior
 * degrau do arquivo inteiro É a emenda (0,0509 contra p99 de 0,0453). Num
 * drone liso, isso é o único evento largo de banda que existe — exatamente o
 * "tec" que a emenda deveria não ter.
 *
 * O conserto é o de sempre em laço de amostra, e não depende de fase nenhuma:
 * renderiza-se 20 ms A MAIS e mistura-se essa sobra na cabeça do trecho. O
 * primeiro quadro passa a ser, por construção, a continuação do último.
 *
 * ⚠️ Isto NÃO é o "fade dentro do trecho" que o comentário do `renderizar`
 * proíbe — aquilo é uma rampa de volume que vira pulso a cada volta. Aqui a
 * amplitude não muda: dois trechos do MESMO som se somam com pesos que fecham
 * 1. Vinte milissegundos é curto o bastante para nenhum ouvido ouvir a
 * mistura, e longo o bastante (441 amostras a 22050) para matar o degrau.
 */
const XFADE_SEGS = 0.02;

/**
 * Mistura a sobra do fim na cabeça do trecho, para o laço fechar sem degrau.
 *
 * Peso LINEAR e não de potência igual: os dois lados são o mesmo som, e no pad
 * são quase idênticos em fase — com peso linear a soma fica de amplitude
 * constante, enquanto potência igual daria um inchaço de 3 dB. Em ruído, a
 * queda de 3 dB do linear dura 20 ms uma vez a cada 30 s, o que é muito abaixo
 * de qualquer degrau audível.
 */
function costurar(x: Float32Array, quadros: number, sobra: number): Float32Array {
  if (sobra <= 0 || sobra >= quadros) return x.subarray(0, quadros);
  const trecho = x.slice(0, quadros);
  for (let i = 0; i < sobra; i++) {
    const w = i / sobra;
    trecho[i] = trecho[i] * w + x[quadros + i] * (1 - w);
  }
  return trecho;
}

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
  /* A cauda toca UMA vez e não fecha em nada — ela não precisa da sobra. */
  const sobraSegs = cauda ? 0 : XFADE_SEGS;
  const total = aquecimento + segundos + sobraSegs;
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
      const depoisDoAquecimento = buf
        .getChannelData(0)
        .subarray(Math.round(aquecimento * buf.sampleRate));
      const trecho = costurar(
        depoisDoAquecimento,
        Math.round(segundos * buf.sampleRate),
        Math.round(sobraSegs * buf.sampleRate),
      );
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
