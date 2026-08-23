/**
 * OS VINTE SONS — as receitas, com os números medidos.
 *
 * Eram quatro (chuva, mar, coração, pad). O dono pediu muitos mais, e pediu
 * especialmente cuidado com a aba de meditar. Cada receita aqui saiu de
 * pesquisa com número, não de tentativa: taxa de eventos, frequência de
 * filtro, Q, envelope e alvo de medição estão escritos, e
 * `node scripts/ouvir.mjs` confere.
 *
 * ─── ⚠️ O QUE SEPARA UM SOM BOM DE UM CHIADO ────────────────────────────────
 *
 * Quase todo som ambiente sintetizado erra do mesmo jeito: alguém pega ruído,
 * passa num filtro, e chama de chuva. Ruído filtrado é chiado de televisão.
 * O que faz o ouvido reconhecer chuva é **densidade de impactos**; o que faz
 * reconhecer riacho é a **bolha** (e o deslize ascendente dela); o que faz
 * reconhecer fogo é o **agrupamento** dos estalos; o que faz reconhecer pássaro
 * é a **ausência de ruído** (canto é tom puro com trajetória).
 *
 * ─── ⚠️ E O QUE NÃO PODE ENTRAR ─────────────────────────────────────────────
 *
 * Nada aqui promete efeito clínico. Um som chamado "útero" imita o ambiente
 * acústico intrauterino porque é um som bonito e reconhecível — não porque
 * trate coisa nenhuma. `afinacao.test.ts` varre o `src/` inteiro contra isso.
 */

import { noLaco, nota } from "./afinacao";
import {
  bandaLenta,
  bolha,
  comVolta,
  emLaco,
  estalo,
  gota,
  moduladorLento,
  naGrade,
  branco,
  marrom as ruidoMarromGuardado,
  rosa,
  semente,
  silaba,
  sorteador,
  tigela,
  type Contexto,
} from "./som-primitivas";

/**
 * ⚠️ ORDEM IMPORTA: é a ordem em que aparecem na tela.
 *
 * Águas primeiro porque são o que a maioria procura; o corpo por último dos
 * "naturais" porque é o mais íntimo; os tons e as máquinas no fim porque são
 * gosto adquirido. Quem quiser mudar a ordem muda aqui, num lugar só.
 */
export const SONS_CONTINUOS = [
  // águas
  "chuva",
  "chuva-forte",
  "chuva-telhado",
  "riacho",
  "cachoeira",
  "mar",
  // ar e fogo
  "vento-folhas",
  "vento-janela",
  "lareira",
  "fogueira",
  // vida
  "floresta-noite",
  "passaros",
  // corpo
  "coracao",
  "ventre",
  // tons
  "pad",
  "drone",
  "tigela",
  // o quieto
  "aviao",
  "ventilador",
  "marrom",
] as const;

export type SomKey = (typeof SONS_CONTINUOS)[number];

export const FAMILIAS = ["Águas", "Ar e fogo", "Vida", "Corpo", "Tons", "O quieto"] as const;
export type Familia = (typeof FAMILIAS)[number];

/**
 * A que família cada som pertence.
 *
 * ⚠️ Vinte sons numa lista lisa é um catálogo que ninguém percorre — a paciente
 * toca nos dois primeiros e desiste. Agrupados, ela procura pelo que quer
 * ("quero água") em vez de ler vinte rótulos.
 */
export const FAMILIA_DO_SOM: Record<SomKey, Familia> = {
  chuva: "Águas",
  "chuva-forte": "Águas",
  "chuva-telhado": "Águas",
  riacho: "Águas",
  cachoeira: "Águas",
  mar: "Águas",
  "vento-folhas": "Ar e fogo",
  "vento-janela": "Ar e fogo",
  lareira: "Ar e fogo",
  fogueira: "Ar e fogo",
  "floresta-noite": "Vida",
  passaros: "Vida",
  coracao: "Corpo",
  ventre: "Corpo",
  pad: "Tons",
  drone: "Tons",
  tigela: "Tons",
  aviao: "O quieto",
  ventilador: "O quieto",
  marrom: "O quieto",
};

/**
 * ⚠️ A LEGENDA DE UMA LINHA NÃO É ENFEITE.
 *
 * Com quatro sons dava para adivinhar o que cada um era pelo nome. Com vinte,
 * "Drone grave" e "Pad calmo" são a mesma coisa para quem nunca ouviu os dois —
 * e a paciente não vai tocar em cada um para descobrir. A legenda diz o que
 * muda, em palavras que ela usa.
 */
export const ROTULO_DO_SOM: Record<SomKey, { label: string; emoji: string; sub: string }> = {
  chuva: { label: "Chuva", emoji: "🌧️", sub: "miúda, sem trovão" },
  "chuva-forte": { label: "Chuva forte", emoji: "⛈️", sub: "temporal, com o grave da água" },
  "chuva-telhado": { label: "Chuva no telhado", emoji: "🏠", sub: "batendo na telha, seca" },
  riacho: { label: "Riacho", emoji: "🏞️", sub: "água correndo entre pedras" },
  cachoeira: { label: "Cachoeira", emoji: "💦", sub: "longe, contínua" },
  mar: { label: "Mar", emoji: "🌊", sub: "onda indo e voltando" },
  "vento-folhas": { label: "Vento nas folhas", emoji: "🍃", sub: "árvore respirando" },
  "vento-janela": { label: "Vento na janela", emoji: "🪟", sub: "assobio na fresta" },
  lareira: { label: "Lareira", emoji: "🔥", sub: "estalo dentro de casa" },
  fogueira: { label: "Fogueira", emoji: "🪵", sub: "estalo aberto, mais brilhante" },
  "floresta-noite": { label: "Floresta à noite", emoji: "🌙", sub: "grilos, longe e perto" },
  passaros: { label: "Passarinhos", emoji: "🐦", sub: "amanhecer, com silêncio entre" },
  coracao: { label: "Coração do bebê", emoji: "💓", sub: "o batimento dele, do doppler" },
  ventre: { label: "Ventre", emoji: "🤰", sub: "o seu, é o que ele ouve aí dentro" },
  pad: { label: "Pad calmo", emoji: "🎵", sub: "duas notas graves" },
  drone: { label: "Drone grave", emoji: "🎼", sub: "acorde parado, bem grave" },
  tigela: { label: "Tigela tibetana", emoji: "🎎", sub: "batida a cada quinze segundos" },
  aviao: { label: "Cabine de avião", emoji: "✈️", sub: "cabine em cruzeiro" },
  ventilador: { label: "Ventilador", emoji: "🌀", sub: "grave, com o tom da pá" },
  marrom: { label: "Ruído marrom", emoji: "🟤", sub: "grave puro, sem nada acontecendo" },
};

/**
 * ⚠️ O NÍVEL AO VIVO — porque a normalização só existe no render offline.
 *
 * `renderizar` normaliza pelo pico, então os arquivos dos Sons para dormir
 * saem todos no mesmo nível. **O caminho ao vivo da meditação não passa por
 * lá**: `montar` entrega direto num master fixo. A auditoria mediu 19,3 dB de
 * diferença entre os quatro sons antigos; com vinte, `node scripts/ouvir.mjs
 * --niveis` mediu **31,5 dB**. Trocar de som no meio de uma sessão era um
 * susto ou um sumiço.
 *
 * ⚠️ **O ganho é limitado pelo PICO, não só mirado no RMS.** Igualar o RMS de
 * todos só seria certo se todos tivessem a mesma densidade — mas uma lareira é
 * silêncio com estalos (crista 15) e um pad é contínuo (crista 3,2). Para a
 * lareira alcançar o RMS do pad, o estalo dela sairia a 3,7 de amplitude:
 * distorção, e um susto no meio da meditação.
 *
 * Então cada ganho é o MENOR entre "chega no RMS alvo (0,20)" e "não passa do
 * pico 1,0". Sons densos alcançam o alvo; sons esparsos param onde o pico
 * manda e ficam um pouco abaixo — o que é honesto, porque um som esparso É
 * mais baixo. **Espalhamento medido: 31,5 dB → 9,7 dB.** O que se elimina é o
 * abismo, não a diferença.
 *
 * ⚠️ E ele NÃO entra no render offline: lá a normalização por pico já iguala
 * tudo, e um ganho a mais seria desfeito por ela — ou pior, mudaria o que a
 * normalização vê. Quem aplica é `createSoundscape`.
 *
 * Para refazer a tabela depois de mexer numa receita:
 *     node scripts/ouvir.mjs --niveis
 */
export const NIVEL_AO_VIVO: Record<SomKey, number> = {
  chuva: 5.183, // RMS 0.0311 pico 0.19  (+14.3 dB)
  "chuva-forte": 3.047, // RMS 0.0470 pico 0.33  (+9.7 dB)
  "chuva-telhado": 3.557, // RMS 0.0244 pico 0.28  (+11.0 dB)
  riacho: 4.771, // RMS 0.0211 pico 0.21  (+13.6 dB)
  cachoeira: 2.603, // RMS 0.0707 pico 0.38  (+8.3 dB)
  mar: 3.345, // RMS 0.0295 pico 0.30  (+10.5 dB)
  "vento-folhas": 7.07, // RMS 0.0202 pico 0.14  (+17.0 dB)
  "vento-janela": 7.035, // RMS 0.0207 pico 0.14  (+16.9 dB)
  lareira: 9.044, // RMS 0.0073 pico 0.11  (+19.1 dB)
  fogueira: 10.747, // RMS 0.0072 pico 0.09  (+20.6 dB)
  "floresta-noite": 4.938, // RMS 0.0157 pico 0.20  (+13.9 dB)
  passaros: 5.508, // RMS 0.0128 pico 0.18  (+14.8 dB)
  coracao: 0.971, // RMS 0.1328 pico 1.03  (-0.3 dB)
  ventre: 1.024, // RMS 0.0864 pico 0.98  (+0.2 dB)
  pad: 0.738, // RMS 0.2710 pico 0.86  (-2.6 dB)
  drone: 1.089, // RMS 0.1837 pico 0.70  (+0.7 dB)
  tigela: 1.184, // RMS 0.1095 pico 0.84  (+1.5 dB)
  aviao: 3.864, // RMS 0.0518 pico 0.22  (+11.7 dB)
  ventilador: 4.66, // RMS 0.0429 pico 0.20  (+13.4 dB)
  marrom: 2.433, // RMS 0.0822 pico 0.38  (+7.7 dB)
};

/* ════════════════════════ Números que decidem ══════════════════════════════ */

const LFO_CHUVA = 15;
const MAR_ONDA_SEGS = 10;
/**
 * ⚠️ 140 bpm É O CORAÇÃO DO BEBÊ, não o que se ouve dentro do útero.
 *
 * O que o feto ouve é dominado pelo coração MATERNO, 70 a 80 bpm; 140 a 160 é
 * a frequência FETAL, que é o que a mãe ouve no doppler. São dois sons
 * diferentes, e o app passou a ter os dois com nomes que não mentem:
 * `coracao` é o do bebê (é o apelo emocional, e é o que já existia) e `ventre`
 * é o materno, que é o que serve para dormir — 140 bpm é rápido demais para
 * induzir sono, e induzir sono é justamente o uso.
 */
const CORACAO_BPM = 140;
/** Materno em repouso na gestação. 30 s ÷ (60/72) = 36 batidas exatas. */
const VENTRE_BPM = 72;

/** As quatro vozes do pad: fá 3 e dó 4 em A = 432, desafinadas ±0,6 Hz. */
const PAD_VOZES = [
  noLaco(nota("fa", 3) - 0.6),
  noLaco(nota("fa", 3) + 0.6),
  noLaco(nota("do", 4) - 0.6),
  noLaco(nota("do", 4) + 0.6),
];

/**
 * O drone: lá 1 com quinta e oitava, seis pares desafinados.
 *
 * ⚠️ Os seis deltas de batimento são k/30 Hz com k COPRIMO entre si
 * (5·8·13·19·23·29). Se todos os pares batessem no mesmo delta, o composto se
 * repetiria em poucos segundos e o drone soaria como um acorde pulsando.
 */
const DRONE_BASE = nota("la", 1);
const DRONE_RAZOES = [1, 1.5, 2, 3, 4, 6];
const DRONE_DELTAS = [5, 8, 13, 19, 23, 29].map((k) => k / 30);

/** A tigela: 236 Hz é a fundamental medida de uma tigela tibetana antiga. */
const TIGELA_HZ = noLaco(236);
/** Uma batida a cada 15 s: duas por laço, e o resíduo fecha a emenda. */
const TIGELA_PERIODO = 15;

/**
 * SEIS GRILOS, e é a POPULAÇÃO que é o som.
 *
 * ⚠️ O número de chirps em 30 s é INTEIRO em todos, o que fecha o laço de
 * graça; e as taxas ficam quase iguais e nunca iguais, que é exatamente a
 * dessincronização que soa como floresta. Sincronizados, soa como efeito
 * sonoro de desenho animado.
 *
 * ⚠️ E o nível decrescente É a distância — o corte agudo que acompanha é a
 * absorção do ar. Seis grilos no mesmo nível soam como seis grilos numa caixa.
 */
const GRILOS = [
  { hz: 4900, chirps: 63, nivel: 0.5, lp: 11000 },
  { hz: 4620, chirps: 60, nivel: 0.32, lp: 11000 },
  { hz: 5180, chirps: 69, nivel: 0.24, lp: 7000 },
  { hz: 4380, chirps: 66, nivel: 0.14, lp: 5500 },
  { hz: 5340, chirps: 72, nivel: 0.09, lp: 4500 },
  { hz: 4750, chirps: 75, nivel: 0.06, lp: 4000 },
];

/** Todo período interno de cada som. O laço tem de ser múltiplo de todos. */
export function periodosDe(kind: SomKey): number[] {
  switch (kind) {
    case "pad":
      return [...PAD_VOZES.map((f) => 1 / f), 15];
    case "drone":
      return [15, 10];
    case "tigela":
      return [TIGELA_PERIODO];
    case "coracao":
      return [60 / CORACAO_BPM];
    case "ventre":
      return [60 / VENTRE_BPM];
    case "mar":
      return [MAR_ONDA_SEGS];
    case "chuva":
      return [LFO_CHUVA];
    case "floresta-noite":
      return GRILOS.map((g) => 30 / g.chirps);
    default:
      return [];
  }
}

export function ehSomContinuo(k: string): k is SomKey {
  return (SONS_CONTINUOS as readonly string[]).includes(k);
}

/* ════════════════════════ As receitas ══════════════════════════════════════ */

type Args = {
  ctx: Contexto;
  saida: AudioNode;
  segundos: number;
  t0: number;
  base: boolean;
  r: () => number;
};

/** Uma cama de ruído filtrada, do tamanho do laço. Serve quase todas. */
function cama(
  ctx: Contexto,
  saida: AudioNode,
  buf: AudioBuffer,
  ganho: number,
  filtros: { tipo: BiquadFilterType; hz: number; q?: number }[],
) {
  const src = emLaco(ctx, buf);
  let no: AudioNode = src;
  for (const f of filtros) {
    const bq = ctx.createBiquadFilter();
    bq.type = f.tipo;
    bq.frequency.value = noLaco(f.hz);
    if (f.q !== undefined) bq.Q.value = f.q;
    no = no.connect(bq);
  }
  const g = ctx.createGain();
  g.gain.value = ganho;
  no.connect(g).connect(saida);
  src.start(0);
  return g;
}

/* ── Chuva, em três intensidades ──────────────────────────────────────────── */

function chuvas(a: Args, kind: "chuva" | "chuva-forte" | "chuva-telhado") {
  const { ctx, saida, segundos, t0, base, r } = a;
  /**
   * ⚠️ DENSIDADE É O CONTROLE DE INTENSIDADE, NUNCA O GANHO.
   *
   * Subir o volume da cama não faz "chuva forte" — faz chiado alto. O que
   * separa as três é quantas gotas caem por segundo, e o quanto o grave entra.
   */
  const perfil = {
    chuva: {
      camaG: 0.24,
      hp: 500,
      lp: 6500,
      passo: [0.04, 0.2],
      f: [1200, 6000],
      q: [4, 9],
      dur: [0.012, 0.035],
    },
    "chuva-forte": {
      camaG: 0.3,
      hp: 180,
      lp: 8000,
      passo: [0.008, 0.042],
      f: [700, 5000],
      q: [2, 5],
      dur: [0.02, 0.06],
    },
    "chuva-telhado": {
      camaG: 0.16,
      hp: 300,
      lp: 7000,
      passo: [0.012, 0.028],
      f: [900, 4500],
      q: [2, 4],
      dur: [0.008, 0.02],
    },
  }[kind];

  if (base) {
    const g = cama(ctx, saida, rosa(ctx, 30, 101), perfil.camaG, [
      { tipo: "highpass", hz: perfil.hp },
      { tipo: "lowpass", hz: perfil.lp },
    ]);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 1 / LFO_CHUVA;
    const lg = ctx.createGain();
    lg.gain.value = perfil.camaG * 0.35;
    lfo.connect(lg).connect(g.gain);
    lfo.start(0);
    if (kind === "chuva-forte") {
      /* O chão de chuva forte: o ronco grave da água em volume. */
      cama(ctx, saida, ruidoMarromGuardado(ctx, 30, 202), 0.1, [{ tipo: "lowpass", hz: 400 }]);
    }
  }

  const fonte = branco(ctx, 2, 991);
  /**
   * ⚠️ O TELHADO É UM RESSOADOR COMPARTILHADO, e é isso que o faz telhado.
   *
   * Todas as gotas passam por um banco fixo de três modos depois do filtro
   * individual delas — a cauda vem do telhado, não da gota. Por isso o
   * decaimento individual cai para 8–20 ms: mantendo os 40 ms E o ressoador,
   * vira lata.
   */
  let destino: AudioNode = saida;
  if (kind === "chuva-telhado" && base) {
    /**
     * ⚠️ EM SÉRIE, NUNCA EM PARALELO — e a primeira versão errou isso.
     *
     * Um filtro de realce (`peaking`) deixa passar o sinal INTEIRO e só
     * levanta uma banda. Três deles em paralelo somam três cópias do mesmo
     * sinal — o que não é um ressoador, é um sinal três vezes mais alto com
     * um realce leve. Em série, o sinal atravessa os três e cada um levanta a
     * sua banda: é isso que faz a chapa do telhado ressoar.
     *
     * ⚠️ E o Q alto NÃO é enfeite: é ele que dá a CAUDA. O decaimento
     * individual da gota cai para 8–20 ms justamente porque quem sustenta o
     * som depois do impacto é o telhado. Mantendo os 40 ms E o ressoador,
     * vira lata.
     */
    const mix = ctx.createGain();
    mix.gain.value = 1;
    let no: AudioNode = mix;
    for (const m of [
      { f: 620, q: 14, g: 9 },
      { f: 1350, q: 11, g: 6 },
      { f: 2900, q: 8, g: 4 },
    ]) {
      const bq = ctx.createBiquadFilter();
      bq.type = "peaking";
      bq.frequency.value = noLaco(m.f);
      bq.Q.value = m.q;
      bq.gain.value = m.g;
      no = no.connect(bq);
    }
    no.connect(saida);
    destino = mix;
  }

  const fim = t0 + segundos;
  for (let t = t0; t < fim; t += perfil.passo[0] + r() * (perfil.passo[1] - perfil.passo[0])) {
    const gorda = kind !== "chuva" && r() < 1 / 14;
    const quando = t;
    comVolta(
      (q) =>
        gota(ctx, destino, fonte, q, r, {
          fLo: gorda ? 300 : perfil.f[0],
          fHi: gorda ? 800 : perfil.f[1],
          qLo: gorda ? 5 : perfil.q[0],
          qHi: gorda ? 7 : perfil.q[1],
          durLo: gorda ? 0.08 : perfil.dur[0],
          durHi: gorda ? 0.14 : perfil.dur[1],
          forca: (gorda ? 1.4 : 1) * GANHO_GOTA,
        }),
      quando,
      0.2,
      fim,
    );
  }
}

/**
 * Quanto uma gota precisa ser amplificada para valer o que o envelope diz.
 *
 * ⚠️ Não é tempero: `pico` é o ganho de um nó de GANHO, e o que passa por ele é
 * ruído já cortado por um passa-faixa de Q alto. Decompondo o render antigo, as
 * gotas ficavam em RMS 0,0012 contra 0,0126 da cama — 1% da energia, num som
 * cujo comentário afirmava que "quem define são os impactos". Acertado na
 * bancada.
 */
const GANHO_GOTA = 1.2;

/* ── Riacho ───────────────────────────────────────────────────────────────── */

function riacho(a: Args) {
  const { ctx, saida, segundos, t0, base, r } = a;
  if (base) {
    cama(ctx, saida, rosa(ctx, 30, 303), 0.1, [
      { tipo: "highpass", hz: 250 },
      { tipo: "lowpass", hz: 5000 },
    ]);
    cama(ctx, saida, ruidoMarromGuardado(ctx, 30, 404), 0.06, [{ tipo: "lowpass", hz: 300 }]);
  }
  /**
   * ⚠️ 45 BOLHAS POR SEGUNDO NÃO VIRA CAMA — e é por isso que a taxa é tão
   * mais alta que a da chuva. Cada bolha dura 4 a 14 ms, então mesmo a 45/s o
   * tempo ocupado é ~40%; as gotas de chuva duram 25 a 70 ms e já se somam a
   * 12/s. Densidade sem sobreposição é o que faz água correndo.
   */
  const fim = t0 + segundos;
  for (let t = t0; t < fim; t += 0.006 + r() * 0.038) {
    comVolta((q) => bolha(ctx, saida, q, r, 0.55), t, 0.05, fim);
  }
}

/* ── Cachoeira ────────────────────────────────────────────────────────────── */

function cachoeira(a: Args) {
  const { ctx, saida, base, r } = a;
  if (!base) return;
  /**
   * ⚠️ A ÚNICA RECEITA EM QUE "CHIADO" É A RESPOSTA CERTA — e por isso a mais
   * fácil de estragar acrescentando eventos. Cachoeira LONGE tem fator de
   * crista entre 4,3 e 5,0 e zero transientes, por definição: a distância soma
   * milhares de impactos até virar gaussiana. Acrescentar gotas transforma
   * cachoeira distante em cachoeira perto, que é outro som.
   */
  const src = emLaco(ctx, rosa(ctx, 30, 505));
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = noLaco(80);
  /* Dois passa-baixa em cascata = 12 dB por oitava. Um só deixa agudo demais
     e a cachoeira soa perto. */
  const lp1 = ctx.createBiquadFilter();
  lp1.type = "lowpass";
  lp1.frequency.value = noLaco(2000);
  const lp2 = ctx.createBiquadFilter();
  lp2.type = "lowpass";
  lp2.frequency.value = noLaco(2000);
  const g = ctx.createGain();
  g.gain.value = 0.45;
  src.connect(hp).connect(lp1).connect(lp2).connect(g).connect(a.saida);
  src.start(0);

  /**
   * ⚠️ O ACOPLAMENTO NÍVEL↔CORTE É OBRIGATÓRIO. É o vento carregando o som:
   * mais alto = mais brilhante. Descorrelacionados, o ouvido lê como dois sons
   * distintos tocando juntos.
   */
  const respiro = moduladorLento(ctx, 1 / 15, 1 / 8, r, 1);
  const gNivel = ctx.createGain();
  gNivel.gain.value = 0.12;
  respiro.connect(gNivel).connect(g.gain);
  const gCorte = ctx.createGain();
  gCorte.gain.value = 500;
  respiro.connect(gCorte).connect(lp1.frequency);
  respiro.connect(gCorte).connect(lp2.frequency);

  cama(ctx, a.saida, ruidoMarromGuardado(ctx, 30, 606), 0.12, [{ tipo: "lowpass", hz: 250 }]);
}

/* ── Mar ──────────────────────────────────────────────────────────────────── */

function mar(a: Args) {
  const { ctx, saida, segundos, t0, base, r } = a;
  if (base) {
    cama(ctx, saida, rosa(ctx, 30, 707), 0.16, [{ tipo: "lowpass", hz: 260 }]);
  }
  const fonte = rosa(ctx, 30, 808);
  for (const q of naGrade(t0, segundos, MAR_ONDA_SEGS)) {
    /* A quebra: estouro largo, espuma caindo por 3 s, e a sucção — o corte
       SOBE enquanto o volume desce, que é o que o ouvido lê como a água
       escorrendo de volta pela areia. */
    const src = ctx.createBufferSource();
    src.buffer = fonte;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(320, q);
    bp.frequency.linearRampToValueAtTime(1500, q + 0.5);
    bp.frequency.exponentialRampToValueAtTime(3400, q + 4.2);
    bp.Q.value = 0.6;
    const g = ctx.createGain();
    /* Ataque de 180 ms: é a quebra. Meio segundo já lê como "o volume subiu". */
    g.gain.setValueAtTime(0.0001, q);
    g.gain.linearRampToValueAtTime(0.8 + r() * 0.3, q + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, q + 4.6);
    src.connect(bp).connect(g).connect(saida);
    src.start(q, r() * 3);
    src.stop(q + 4.8);

    const esp = ctx.createBufferSource();
    esp.buffer = fonte;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = noLaco(1800);
    const eg = ctx.createGain();
    eg.gain.setValueAtTime(0.0001, q);
    eg.gain.linearRampToValueAtTime(0.5, q + 0.12);
    eg.gain.exponentialRampToValueAtTime(0.0001, q + 2.4);
    esp.connect(hp).connect(eg).connect(saida);
    esp.start(q, r() * 3);
    esp.stop(q + 2.6);
  }
}

/* ── Vento ────────────────────────────────────────────────────────────────── */

function ventoFolhas(a: Args) {
  const { ctx, saida, base, r } = a;
  if (!base) return;
  /**
   * ⚠️ VENTO SOZINHO É QUASE INAUDÍVEL. O que se ouve é vento CONTRA alguma
   * coisa, e é essa coisa que a receita descreve.
   *
   * ⚠️ E amplitude e brilho andam JUNTOS, correlação 1. Rajada mais forte é
   * mais aguda. Descorrelacionar é o erro mais comum, e soa imediatamente como
   * um filtro de sintetizador varrendo.
   */
  const rajada = moduladorLento(ctx, 0.05, 0.4, r, 1);

  const src = emLaco(ctx, rosa(ctx, 30, 909));
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = noLaco(1400);
  bp.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.value = 0.22;
  src.connect(bp).connect(g).connect(saida);
  src.start(0);

  const gCorte = ctx.createGain();
  gCorte.gain.value = 800;
  rajada.connect(gCorte).connect(bp.frequency);
  const gNivel = ctx.createGain();
  gNivel.gain.value = 0.18;
  rajada.connect(gNivel).connect(g.gain);

  /**
   * ⚠️ A FOLHAGEM SÓ APARECE NO PICO DA RAJADA, e a potência não é estética:
   * linear na rajada daria chiado agudo constante. Ela precisa SURGIR e sumir.
   * Aqui a potência é aproximada por um segundo estágio de ganho alimentado
   * pela mesma rajada — barato, e o efeito é o mesmo.
   */
  const folha = emLaco(ctx, rosa(ctx, 30, 1010));
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = noLaco(3000);
  const fg = ctx.createGain();
  fg.gain.value = 0.02;
  const fg2 = ctx.createGain();
  fg2.gain.value = 0;
  const gFolha = ctx.createGain();
  gFolha.gain.value = 0.16;
  rajada.connect(gFolha).connect(fg2.gain);
  folha.connect(hp).connect(fg).connect(fg2).connect(saida);
  folha.start(0);
}

function ventoJanela(a: Args) {
  const { ctx, saida, base, r } = a;
  if (!base) return;
  ventoFolhas({ ...a, saida });
  /**
   * ⚠️ FRESTA ASSOBIA POR VÓRTICE, e o expoente é a peça central.
   *
   * `f = 0,2·U/d` — a frequência sobe com a velocidade do ar. Três ressoadores
   * estreitos dão o assobio. **O ganho é cúbico na rajada**: assobio constante
   * lê como filtro estragado; assobio que aparece no pico da rajada e some é
   * uma janela.
   */
  const rajada = moduladorLento(ctx, 0.05, 0.4, r, 1);
  const fonte = emLaco(ctx, rosa(ctx, 30, 1111));
  fonte.start(0);
  for (const res of [
    { f: 320, q: 14, g: 0.09 },
    { f: 780, q: 22, g: 0.06 },
    { f: 1240, q: 30, g: 0.035 },
  ]) {
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = noLaco(res.f);
    bp.Q.value = res.q;
    const g1 = ctx.createGain();
    g1.gain.value = 0;
    const g2 = ctx.createGain();
    g2.gain.value = 0;
    const gA = ctx.createGain();
    gA.gain.value = res.g;
    const gB = ctx.createGain();
    gB.gain.value = 1;
    rajada.connect(gA).connect(g1.gain);
    rajada.connect(gB).connect(g2.gain);
    /* Modulação de ±6% na própria frequência do ressoador: o assobio desliza
       com a rajada, como uma fresta de verdade. */
    const gF = ctx.createGain();
    gF.gain.value = res.f * 0.06;
    rajada.connect(gF).connect(bp.frequency);
    fonte.connect(bp).connect(g1).connect(g2).connect(saida);
  }
}

/* ── Fogo ─────────────────────────────────────────────────────────────────── */

function fogo(a: Args, lareira: boolean) {
  const { ctx, saida, segundos, t0, base, r } = a;
  if (base) {
    /**
     * O rugido da combustão, modulado pelo TREMELUZIR — que tem lei física:
     * `f ≈ 1,5/√D` Hz, com D o diâmetro da base. Uma fogueira de meio metro
     * tremeluz a 2,1 Hz; uma lareira de trinta centímetros, a 2,7.
     */
    /**
     * ⚠️ AQUI HAVIA UM DEFEITO QUE A BANCADA PEGOU: lareira e fogueira saíam
     * IDÊNTICAS. Medido — crista 7,80 contra 6,89, centroide 319 contra 312, e
     * as nove bandas de energia iguais até a primeira casa.
     *
     * A causa era um passa-baixa a mais: o código punha
     * `lowpass(lareira ? 5000 : 9000)` e logo em seguida `lowpass(1200)`. O
     * segundo sempre vence, então a única diferença entre os dois sons era
     * cortada por uma linha escrita para outra coisa. Duas receitas que se
     * anunciam diferentes e medem igual são uma delas que não existe.
     */
    const g = cama(ctx, saida, rosa(ctx, 30, 1212), 0.04, [{ tipo: "lowpass", hz: 1200 }]);
    const cintila = bandaLenta(ctx, 1.2, 3.0, r, 0.016);
    cintila.connect(g.gain);
  }

  /* O brilho é o que separa os dois: a fogueira é ao ar livre e o estalo chega
     inteiro; a lareira tem parede, e a parede come o agudo. */
  const brilho = ctx.createBiquadFilter();
  brilho.type = "lowpass";
  brilho.frequency.value = noLaco(lareira ? 4200 : 9000);
  brilho.connect(saida);

  const fonte = branco(ctx, 2, 1313);
  const fim = t0 + segundos;
  const fator = lareira ? 0.7 : 1;

  /**
   * ⚠️ O AGRUPAMENTO É O QUE FAZ SER FOGO E NÃO METRÔNOMO.
   *
   * Dois estalos e meio por segundo, espaçados uniformemente, soam como um
   * relógio quebrado. Com um em cada quatro gerando dois a cinco filhotes
   * espaçados de 18 a 60 ms, soa como madeira liberando gás.
   */
  for (let t = t0; t < fim; t += (0.2 + r() * 0.6) / fator) {
    comVolta((q) => estalo(ctx, brilho, fonte, q, r, false), t, 0.05, fim);
    if (r() < 0.25) {
      let d = 0;
      const filhotes = 2 + Math.floor(r() * 4);
      for (let i = 0; i < filhotes; i++) {
        d += 0.018 + r() * 0.042;
        const q = t + d;
        if (q < fim) comVolta((x) => estalo(ctx, brilho, fonte, x, r, false), q, 0.05, fim);
      }
    }
  }
  for (let t = t0 + r() * 3; t < fim; t += (1.5 + r() * 4) / fator) {
    comVolta((q) => estalo(ctx, brilho, fonte, q, r, true), t, 0.12, fim);
  }
}

/* ── Floresta à noite ─────────────────────────────────────────────────────── */

function florestaNoite(a: Args) {
  const { ctx, saida, segundos, t0, base, r } = a;
  if (base) {
    /* O ar da noite: quase nada, e é ele que impede o silêncio entre os
       chirps de soar como um arquivo cortado. */
    /* ⚠️ Medido: com a cama em 0,02 a floresta ficava com 92,6% da energia entre
       4 e 8 kHz — só grilo, sem noite em volta. O ar precisa existir. */
    cama(ctx, saida, rosa(ctx, 30, 1414), 0.05, [{ tipo: "lowpass", hz: 900 }]);
    cama(ctx, saida, ruidoMarromGuardado(ctx, 30, 1415), 0.05, [{ tipo: "lowpass", hz: 200 }]);
  }

  const fim = t0 + segundos;
  for (const g of GRILOS) {
    const periodo = 30 / g.chirps;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = noLaco(g.lp);
    const nivel = ctx.createGain();
    nivel.gain.value = g.nivel * 0.25;
    lp.connect(nivel).connect(saida);

    for (const t of naGrade(t0 - 0.5, segundos + 0.5, periodo)) {
      /**
       * Um chirp são 3 a 5 pulsos de 15 a 22 ms espaçados de 30 a 40 ms. A
       * hierarquia dos três níveis (pulso → chirp → canto) é o que faz grilo:
       * um tom pulsado sem essa estrutura é um bipe.
       */
      const pulsos = 3 + Math.floor(r() * 3);
      for (let i = 0; i < pulsos; i++) {
        const q = t + i * (0.03 + r() * 0.01);
        if (q < t0 - 0.2 || q >= fim) continue;
        const dur = 0.015 + r() * 0.007;
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = noLaco(g.hz);
        const h = ctx.createOscillator();
        h.type = "sine";
        h.frequency.value = noLaco(g.hz * 2);
        const hg = ctx.createGain();
        /* 2º harmônico a −20 dB. Mais que isso vira zumbido. */
        hg.gain.value = 0.1;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, q);
        env.gain.exponentialRampToValueAtTime(1, q + 0.002);
        env.gain.exponentialRampToValueAtTime(0.0001, q + dur);
        o.connect(env);
        h.connect(hg).connect(env);
        env.connect(lp);
        o.start(q);
        o.stop(q + dur + 0.01);
        h.start(q);
        h.stop(q + dur + 0.01);
      }
    }
  }
}

/* ── Passarinhos ──────────────────────────────────────────────────────────── */

const ESPECIES = [
  { f: [1500, 3000], silabas: [3, 6], traj: ["sobe", "chevron"] as const, pausa: [4, 11], dist: 0 },
  {
    f: [2000, 7000],
    silabas: [4, 9],
    traj: ["chevron", "desce"] as const,
    pausa: [5, 13],
    dist: 20,
  },
  { f: [3000, 6000], silabas: [2, 5], traj: ["sobe", "desce"] as const, pausa: [3, 9], dist: 45 },
  {
    f: [3500, 7000],
    silabas: [3, 7],
    traj: ["trinado", "sobe"] as const,
    pausa: [6, 15],
    dist: 80,
  },
  {
    f: [3000, 8000],
    silabas: [5, 12],
    traj: ["trinado", "chevron"] as const,
    pausa: [7, 16],
    dist: 130,
  },
];

function passaros(a: Args) {
  const { ctx, saida, segundos, t0, base, r } = a;
  if (base) {
    /* A manhã: um pouco de ar, e nada mais. Reverb com cauda transformaria a
       floresta em igreja — a distância é feita por corte agudo e nível. */
    cama(ctx, saida, rosa(ctx, 30, 1515), 0.012, [{ tipo: "lowpass", hz: 1200 }]);
  }

  const fim = t0 + segundos;
  ESPECIES.forEach((esp, idx) => {
    /* `LP_ar(d) = 11000 · e^(−d/120)` e `nível(d) = 1/(1 + d/8)`. */
    const lpHz = 11000 * Math.exp(-esp.dist / 120);
    const nivel = 1 / (1 + esp.dist / 8);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = noLaco(Math.max(1500, lpHz));
    const g = ctx.createGain();
    g.gain.value = nivel * 0.22;
    lp.connect(g).connect(saida);

    let t = t0 + ((idx * 1.7 + r() * 2) % esp.pausa[1]);
    while (t < fim) {
      const n = esp.silabas[0] + Math.floor(r() * (esp.silabas[1] - esp.silabas[0] + 1));
      let q = t;
      for (let i = 0; i < n; i++) {
        const dur = 0.04 + r() * 0.16;
        /**
         * ⚠️ NENHUMA SÍLABA IDÊNTICA À ANTERIOR. Jitter de ±3% na frequência e
         * ±12% na duração. Repetição exata é o que faz soar como sintetizador.
         */
        const jitter = 1 + (r() - 0.5) * 0.06;
        const sobe = r() < 0.6;
        const f0 = esp.f[0] * jitter;
        const f1 = sobe ? Math.min(esp.f[1], f0 * (1.4 + r() * 1.1)) : f0 * (0.4 + r() * 0.3);
        const traj = esp.traj[Math.floor(r() * esp.traj.length)];
        if (q >= t0 - 0.3 && q < fim) {
          silaba(ctx, lp, q, r, { dur, f0, f1: Math.max(600, f1), traj, amp: 0.9 });
        }
        q += dur + 0.02 + r() * 0.06;
      }
      /* ⚠️ O SILÊNCIO DOMINA: 85 a 92% do tempo. Cantar sem parar é o erro que
         mais mata a ilusão. */
      t = q + esp.pausa[0] + r() * (esp.pausa[1] - esp.pausa[0]);
    }
  });
}

/* ── Corpo ────────────────────────────────────────────────────────────────── */

function batida(
  ctx: Contexto,
  saida: AudioNode,
  t: number,
  f0: number,
  fim: number,
  pico: number,
  dur: number,
) {
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, fim), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pico, t + 0.014);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(saida);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function coracao(a: Args) {
  const { ctx, saida, segundos, t0, base } = a;
  if (base) {
    cama(ctx, saida, rosa(ctx, 30, 1616), 0.5, [{ tipo: "lowpass", hz: 320 }]);
  }
  /* ⚠️ Aqui não há `setInterval`: num render offline o tempo não passa, ele é
     escrito. E as batidas andam na GRADE ABSOLUTA — ver `naGrade`, e o tropeço
     de 139 ms a cada 20 s que isso conserta. */
  for (const t of naGrade(t0, segundos, 60 / CORACAO_BPM)) {
    batida(ctx, saida, t, 62, 28, 0.9, 0.16);
    batida(ctx, saida, t + 0.16, 54, 24, 0.55, 0.13);
  }
}

function ventre(a: Args) {
  const { ctx, saida, segundos, t0, base } = a;
  const periodo = 60 / VENTRE_BPM;

  /**
   * ⚠️ O WHOOSH É TRAVADO NO BATIMENTO — e é essa a diferença inteira.
   *
   * O "shhh" do útero não é estático: é o pulso de sangue placentário, que
   * acompanha a sístole. Estático, é ruído marrom; travado na batida, é útero.
   */
  let whoosh: GainNode | null = null;
  if (base) {
    const src = emLaco(ctx, rosa(ctx, 30, 1717));
    const lp1 = ctx.createBiquadFilter();
    lp1.type = "lowpass";
    lp1.frequency.value = noLaco(500);
    const lp2 = ctx.createBiquadFilter();
    lp2.type = "lowpass";
    lp2.frequency.value = noLaco(500);
    /**
     * ⚠️ O PASSA-ALTA EM 28 Hz É OBRIGATÓRIO. Alto-falante de celular não
     * reproduz nada abaixo de ~60 Hz — o "thump" que se sente é o segundo e o
     * terceiro harmônico. Sem o corte, cerca de 40% da energia é inaudível E
     * mesmo assim conta na normalização, derrubando o volume do arquivo
     * inteiro por causa de uma banda que ninguém ouve.
     */
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = noLaco(28);
    whoosh = ctx.createGain();
    whoosh.gain.value = 0.3;
    src.connect(lp1).connect(lp2).connect(hp).connect(whoosh).connect(saida);
    src.start(0);
  }

  for (const q of naGrade(t0, segundos, periodo)) {
    /* S1 (lub) e S2 (dub): 45→28 Hz e 58→36 Hz, com o dub a 30% do ciclo. */
    batida(ctx, saida, q, 45, 28, 1.0, 0.13);
    batida(ctx, saida, q + 0.3 * periodo, 58, 36, 0.55, 0.09);
    if (whoosh) {
      whoosh.gain.setValueAtTime(0.3, q + 0.04);
      whoosh.gain.linearRampToValueAtTime(0.42, q + 0.16);
      whoosh.gain.linearRampToValueAtTime(0.3, q + 0.42);
    }
  }
}

/* ── Tons ─────────────────────────────────────────────────────────────────── */

function pad(a: Args) {
  const { ctx, saida, base } = a;
  if (!base) return;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = noLaco(700);
  lp.Q.value = 0.7;
  /* O corte respira devagar: 15 s é meio laço, então fecha exato. */
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
    /* Triângulo e não senoide: tem harmônicos ímpares fracos, que é o que o
       filtro tem para moldar. Senoide não dá o que filtrar. */
    o.type = "triangle";
    o.frequency.value = f;
    o.connect(lp);
    o.start(0);
  }
}

function drone(a: Args) {
  const { ctx, saida, base, r } = a;
  if (!base) return;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = noLaco(600);
  lp.Q.value = 0.7;
  const mov = ctx.createOscillator();
  mov.frequency.value = 1 / 15;
  const movG = ctx.createGain();
  movG.gain.value = 200;
  mov.connect(movG).connect(lp.frequency);
  mov.start(0);

  const mestre = ctx.createGain();
  mestre.gain.value = 0.14;
  lp.connect(mestre).connect(saida);

  DRONE_RAZOES.forEach((rz, i) => {
    const centro = DRONE_BASE * rz;
    const d = DRONE_DELTAS[i];
    const voz = ctx.createGain();
    /* Evolução por voz: cada uma respira num período diferente (30, 15, 10 s),
       com fases espalhadas — é isso que impede o acorde de soar parado. */
    voz.gain.value = 1 / (1 + i * 0.35);
    const evo = bandaLenta(ctx, 1 / 30, 1 / 10, r, 0.25 * voz.gain.value);
    evo.connect(voz.gain);
    voz.connect(lp);
    for (const f of [noLaco(centro - d / 2), noLaco(centro + d / 2)]) {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      o.connect(voz);
      o.start(0);
    }
  });

  /* O ar: inaudível sozinho, e é o que tira o cheiro de sintetizador. */
  cama(ctx, saida, rosa(ctx, 30, 1818), 0.008, [{ tipo: "highpass", hz: 4000 }]);
}

function tigelaTibetana(a: Args) {
  const { ctx, saida, segundos, t0, base } = a;
  const golpe = branco(ctx, 1, 1919);
  if (base) {
    /* Um fio de ar, para o silêncio entre as batidas não soar como corte. */
    cama(ctx, saida, rosa(ctx, 30, 2020), 0.006, [{ tipo: "lowpass", hz: 2000 }]);
  }
  for (const t of naGrade(t0, segundos, TIGELA_PERIODO)) {
    tigela(ctx, saida, t, TIGELA_HZ, { golpe, forca: 0.5 });
  }
}

/* ── O quieto ─────────────────────────────────────────────────────────────── */

function aviao(a: Args) {
  const { ctx, saida, base, r } = a;
  if (!base) return;
  /* Cruzeiro: a energia mora abaixo de 500 Hz, e o que muda com o tempo é só
     um respiro lento de nível — o resto é constante por natureza. */
  const g = cama(ctx, saida, ruidoMarromGuardado(ctx, 30, 2121), 0.55, [
    { tipo: "lowpass", hz: 420 },
    { tipo: "highpass", hz: 35 },
  ]);
  const respiro = bandaLenta(ctx, 1 / 30, 1 / 12, r, 0.05);
  respiro.connect(g.gain);
  cama(ctx, saida, rosa(ctx, 30, 2222), 0.05, [
    { tipo: "highpass", hz: 400 },
    { tipo: "lowpass", hz: 3500 },
  ]);
}

function ventilador(a: Args) {
  const { ctx, saida, base, r } = a;
  if (!base) return;
  cama(ctx, saida, rosa(ctx, 30, 2323), 0.3, [
    { tipo: "lowpass", hz: 1800 },
    { tipo: "highpass", hz: 60 },
  ]);
  /**
   * ⚠️ O TOM DE PÁ É O QUE FAZ SER VENTILADOR, e ele tem de estar na grade.
   *
   * Quatro pás a 1200 rpm dão 80 Hz. `noLaco` põe em 80 exato (2400/30), e o
   * segundo e o terceiro harmônico entram bem abaixo — pá audível demais vira
   * zumbido de transformador.
   */
  const fonte = emLaco(ctx, rosa(ctx, 30, 2424));
  fonte.start(0);
  for (const [f, g] of [
    [80, 0.05],
    [160, 0.025],
    [240, 0.012],
  ]) {
    const bq = ctx.createBiquadFilter();
    bq.type = "bandpass";
    bq.frequency.value = noLaco(f);
    bq.Q.value = 12;
    const gain = ctx.createGain();
    gain.gain.value = g;
    fonte.connect(bq).connect(gain).connect(saida);
  }
  void r;
}

function marrom(a: Args) {
  const { ctx, saida, base } = a;
  if (!base) return;
  /* Puro, e é esse o ponto: 84% da energia abaixo de 125 Hz, centroide ~110 Hz.
     Quem procura ruído marrom quer exatamente isto e nada mais. */
  cama(ctx, saida, ruidoMarromGuardado(ctx, 30, 2525), 0.85, [{ tipo: "highpass", hz: 25 }]);
}

/* ════════════════════════ O despachante ════════════════════════════════════ */

/** Semente base por som: cada um sorteia a própria sequência. */
const SEMENTES: Record<SomKey, number> = {
  chuva: 20260813,
  "chuva-forte": 20260814,
  "chuva-telhado": 20260815,
  riacho: 776,
  cachoeira: 4242,
  mar: 777,
  "vento-folhas": 5150,
  "vento-janela": 5151,
  lareira: 6060,
  fogueira: 6061,
  "floresta-noite": 7070,
  passaros: 8080,
  coracao: 9090,
  ventre: 9091,
  pad: 1234,
  drone: 1235,
  tigela: 2360,
  aviao: 3030,
  ventilador: 4040,
  marrom: 5050,
};

/**
 * Monta o som no contexto dado — offline ou ao vivo, o mesmo grafo.
 *
 * `segundos` é a janela a preencher com eventos; `t0` desloca tudo, para o
 * agendador ao vivo poder pedir a próxima janela sem recriar a base.
 * `base` liga as camadas contínuas, que nascem uma vez só.
 */
export function montar(
  ctx: Contexto,
  kind: SomKey,
  saida: AudioNode,
  segundos: number,
  t0 = 0,
  base = true,
) {
  const r = sorteador(semente(SEMENTES[kind], t0));
  const a: Args = { ctx, saida, segundos, t0, base, r };
  switch (kind) {
    case "chuva":
    case "chuva-forte":
    case "chuva-telhado":
      return chuvas(a, kind);
    case "riacho":
      return riacho(a);
    case "cachoeira":
      return cachoeira(a);
    case "mar":
      return mar(a);
    case "vento-folhas":
      return ventoFolhas(a);
    case "vento-janela":
      return ventoJanela(a);
    case "lareira":
      return fogo(a, true);
    case "fogueira":
      return fogo(a, false);
    case "floresta-noite":
      return florestaNoite(a);
    case "passaros":
      return passaros(a);
    case "coracao":
      return coracao(a);
    case "ventre":
      return ventre(a);
    case "pad":
      return pad(a);
    case "drone":
      return drone(a);
    case "tigela":
      return tigelaTibetana(a);
    case "aviao":
      return aviao(a);
    case "ventilador":
      return ventilador(a);
    case "marrom":
      return marrom(a);
  }
}
