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

import { grausEmHz, noLaco, nota } from "./afinacao";
import {
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
  "chuva-carro",
  "tempestade",
  "riacho",
  "cachoeira",
  "mar",
  "lago",
  // ar e fogo
  "vento-folhas",
  "vento-janela",
  "lareira",
  "fogueira",
  // vida
  "floresta-noite",
  "passaros",
  "sapos",
  "cigarras",
  // corpo
  "coracao",
  "ventre",
  // tons
  "pad",
  "drone",
  "tigela",
  "sino-vento",
  "piano",
  // o quieto
  "aviao",
  "ventilador",
  "ar-condicionado",
  "secador",
  "maquina-lavar",
  "branco",
  "rosa",
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
  "chuva-carro": "Águas",
  tempestade: "Águas",
  riacho: "Águas",
  cachoeira: "Águas",
  mar: "Águas",
  lago: "Águas",
  "vento-folhas": "Ar e fogo",
  "vento-janela": "Ar e fogo",
  lareira: "Ar e fogo",
  fogueira: "Ar e fogo",
  "floresta-noite": "Vida",
  passaros: "Vida",
  sapos: "Vida",
  cigarras: "Vida",
  coracao: "Corpo",
  ventre: "Corpo",
  pad: "Tons",
  drone: "Tons",
  tigela: "Tons",
  "sino-vento": "Tons",
  piano: "Tons",
  aviao: "O quieto",
  ventilador: "O quieto",
  "ar-condicionado": "O quieto",
  secador: "O quieto",
  "maquina-lavar": "O quieto",
  branco: "O quieto",
  rosa: "O quieto",
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
  "chuva-carro": { label: "Chuva no carro", emoji: "🚗", sub: "abafada, do lado de dentro" },
  tempestade: { label: "Tempestade", emoji: "🌩️", sub: "chuva forte com trovão longe" },
  riacho: { label: "Riacho", emoji: "🏞️", sub: "água correndo entre pedras" },
  cachoeira: { label: "Cachoeira", emoji: "💦", sub: "longe, contínua" },
  mar: { label: "Mar", emoji: "🌊", sub: "onda indo e voltando" },
  lago: { label: "Lago", emoji: "🦆", sub: "água parada, sem quebra" },
  "vento-folhas": { label: "Vento nas folhas", emoji: "🍃", sub: "árvore respirando" },
  "vento-janela": { label: "Vento na janela", emoji: "🪟", sub: "assobio na fresta" },
  lareira: { label: "Lareira", emoji: "🔥", sub: "estalo dentro de casa" },
  fogueira: { label: "Fogueira", emoji: "🪵", sub: "estalo aberto, mais brilhante" },
  "floresta-noite": { label: "Floresta à noite", emoji: "🌙", sub: "grilos, longe e perto" },
  passaros: { label: "Passarinhos", emoji: "🐦", sub: "amanhecer, com silêncio entre" },
  sapos: { label: "Sapos", emoji: "🐸", sub: "brejo à noite, coro grave" },
  cigarras: { label: "Cigarras", emoji: "🦗", sub: "tarde quente, sobe e desce" },
  /**
   * ⚠️ O RÓTULO NÃO PODE AFIRMAR PROCEDÊNCIA — ele dizia "do doppler".
   *
   * O som é um OSCILADOR: duas senoides deslizando numa grade fixa de 140 bpm.
   * Não vem de doppler nenhum e não é o batimento do bebê dela. A prosa que
   * explica isso está em comentário, que é justamente o que a paciente não lê.
   *
   * O cenário que torna isso clínico, e não estético: redução de movimento
   * fetal é um dos nove sintomas VERMELHOS de `triage.ts`. A paciente abre os
   * Sons para dormir, toca "Coração do bebê — o batimento dele, do doppler",
   * ouve um batimento regular e SE TRANQUILIZA — com um oscilador.
   *
   * ⚠️ E a catraca de `afinacao.test.ts` não alcança esta linha: ela exige
   * contexto de altura (432 / Hz / hertz / afinação) perto da afirmação sobre o
   * bebê, e aqui não há nenhum. A proteção tem de ser o texto.
   *
   * `ventre` fica como está — "o seu, é o que ele ouve aí dentro" é
   * factualmente correto sobre o ambiente acústico intrauterino, e não afirma
   * nada sobre o bebê dela agora.
   */
  coracao: { label: "Ritmo de ninar", emoji: "💓", sub: "batida regular, 140 por minuto" },
  ventre: { label: "Ventre", emoji: "🤰", sub: "o seu, é o que ele ouve aí dentro" },
  pad: { label: "Pad calmo", emoji: "🎵", sub: "duas notas graves" },
  drone: { label: "Drone grave", emoji: "🎼", sub: "acorde parado, bem grave" },
  tigela: { label: "Tigela tibetana", emoji: "🎎", sub: "batida a cada quinze segundos" },
  "sino-vento": { label: "Sino de vento", emoji: "🎐", sub: "tubos ao acaso, na brisa" },
  piano: { label: "Piano esparso", emoji: "🎹", sub: "notas soltas, bem devagar" },
  aviao: { label: "Cabine de avião", emoji: "✈️", sub: "cabine em cruzeiro" },
  ventilador: { label: "Ventilador", emoji: "🌀", sub: "grave, com o tom da pá" },
  "ar-condicionado": { label: "Ar-condicionado", emoji: "❄️", sub: "constante, sem grave" },
  secador: { label: "Secador", emoji: "💨", sub: "o som que acalma recém-nascido" },
  "maquina-lavar": { label: "Máquina de lavar", emoji: "🌀", sub: "gira e vira, com ritmo" },
  branco: { label: "Ruído branco", emoji: "⬜", sub: "todo agudo, o mais neutro" },
  rosa: { label: "Ruído rosa", emoji: "🩷", sub: "equilibrado, como a natureza" },
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
  "chuva-carro": 6.196, // RMS 0.0323 pico 0.15  (+15.8 dB)
  tempestade: 2.367, // RMS 0.0499 pico 0.42  (+7.5 dB)
  riacho: 4.771, // RMS 0.0211 pico 0.21  (+13.6 dB)
  cachoeira: 2.603, // RMS 0.0707 pico 0.38  (+8.3 dB)
  mar: 3.345, // RMS 0.0295 pico 0.30  (+10.5 dB)
  lago: 9.241, // RMS 0.0156 pico 0.11  (+19.3 dB)
  "vento-folhas": 7.07, // RMS 0.0202 pico 0.14  (+17.0 dB)
  "vento-janela": 7.035, // RMS 0.0207 pico 0.14  (+16.9 dB)
  lareira: 9.168, // RMS 0.0079 pico 0.11  (+19.2 dB)
  fogueira: 10.636, // RMS 0.0078 pico 0.09  (+20.5 dB)
  "floresta-noite": 4.938, // RMS 0.0157 pico 0.20  (+13.9 dB)
  passaros: 5.508, // RMS 0.0128 pico 0.18  (+14.8 dB)
  sapos: 4.795, // RMS 0.0222 pico 0.21  (+13.6 dB)
  cigarras: 13.752, // RMS 0.0094 pico 0.07  (+22.8 dB)
  coracao: 0.971, // RMS 0.1328 pico 1.03  (-0.3 dB)
  ventre: 1.024, // RMS 0.0864 pico 0.98  (+0.2 dB)
  pad: 0.738, // RMS 0.2710 pico 0.86  (-2.6 dB)
  drone: 1.054, // RMS 0.1897 pico 0.78  (+0.5 dB)
  tigela: 1.184, // RMS 0.1095 pico 0.84  (+1.5 dB)
  "sino-vento": 4.75, // RMS 0.0289 pico 0.21  (+13.5 dB)
  piano: 6.374, // RMS 0.0229 pico 0.16  (+16.1 dB)
  aviao: 3.854, // RMS 0.0519 pico 0.25  (+11.7 dB)
  ventilador: 4.66, // RMS 0.0429 pico 0.20  (+13.4 dB)
  "ar-condicionado": 3.809, // RMS 0.0525 pico 0.23  (+11.6 dB)
  secador: 2.789, // RMS 0.0717 pico 0.35  (+8.9 dB)
  "maquina-lavar": 4.106, // RMS 0.0487 pico 0.24  (+12.3 dB)
  branco: 1.432, // RMS 0.1376 pico 0.70  (+3.1 dB)
  rosa: 1.409, // RMS 0.1420 pico 0.59  (+3.0 dB)
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
  /* ⚠️ E aqui vale a mesma regra dos sapos: 63 · 60 · 69 · 66 · 72 · 75 eram
     todos múltiplos de três, então os seis grilos voltavam à mesma fase a cada
     dez segundos. O sorteio de pulsos por chirp mascarava isso na medição, mas
     mascarar não é resolver. Com 61 e 71 no meio, o máximo divisor comum é 1. */
  { hz: 4900, chirps: 63, nivel: 0.5, lp: 11000 },
  { hz: 4620, chirps: 61, nivel: 0.32, lp: 11000 },
  { hz: 5180, chirps: 69, nivel: 0.24, lp: 7000 },
  { hz: 4380, chirps: 66, nivel: 0.14, lp: 5500 },
  { hz: 5340, chirps: 71, nivel: 0.09, lp: 4500 },
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
    case "sapos":
      return SAPOS.map((g) => 30 / g.cantos);
    case "tempestade":
      /* Só o LFO da cama: o trovão é sorteado, não periódico — ver a receita. */
      return [LFO_CHUVA];
    case "maquina-lavar":
      return [5];
    default:
      return [];
  }
}

export function ehSomContinuo(k: string): k is SomKey {
  return (SONS_CONTINUOS as readonly string[]).includes(k);
}

/**
 * ⚠️ OS DOIS SONS QUE NÃO SÃO OFERECIDOS EM MODO CUIDADO.
 *
 * "Coração do bebê" e "Ventre" são os únicos do catálogo cujo NOME afirma sobre
 * uma gestação EM CURSO. Numa folha de trinta e dois sons aberta por quem
 * acabou de perder a gestação, seriam a única coisa da tela falando do bebê, no
 * presente.
 *
 * ⚠️ Eles saem da OFERTA, não do catálogo: `montar` continua sabendo tocá-los,
 * e quem já os tinha escolhido não encontra um som que sumiu — é a mesma
 * decisão que manteve `exam_files` de pé quando o envio de exames saiu do
 * produto.
 */
export const FORA_DO_MODO_CUIDADO = ["coracao", "ventre"] as const;

/**
 * O catálogo já recortado pelo Modo Cuidado.
 *
 * ⚠️ O recorte mora AQUI, e não em cada tela: são três chamadores hoje (a folha
 * de sons, os grupos do soundscape e a lista lisa), e um quarto que alguém
 * escrever amanhã esqueceria — que é exatamente como um portão de luto falha.
 */
export function ofertaveis(luto: boolean): readonly SomKey[] {
  if (!luto) return SONS_CONTINUOS;
  const fora = new Set<string>(FORA_DO_MODO_CUIDADO);
  return SONS_CONTINUOS.filter((k) => !fora.has(k));
}

/**
 * ⚠️ NÓS QUE PRECISAM SOBREVIVER ENTRE AS JANELAS.
 *
 * `base` só é verdadeiro na PRIMEIRA janela ao vivo — as seguintes só agendam
 * eventos. Um nó criado dentro do `if (base)` fica inalcançável a partir da
 * segunda, e quem depende dele para de ser modulado.
 *
 * Foi assim que o whoosh do `ventre` congelava: medido, 48 rampas na primeira
 * janela e ZERO na segunda. Depois de vinte segundos o ganho ficava preso no
 * último valor e nunca mais se movia — e o comentário logo acima da receita diz
 * com todas as letras que "estático, é ruído marrom; travado na batida, é
 * útero". Numa sessão de dez minutos eram vinte segundos de útero e quase dez
 * minutos de ruído marrom com um thump por cima.
 *
 * O render offline nunca viu porque lá `montar` é chamada UMA vez, com
 * `base = true` — mais um caso em que o caminho ao vivo e o do render divergem
 * em silêncio.
 */
const PERSISTENTES = new WeakMap<Contexto, Map<string, AudioNode>>();

function persistente<T extends AudioNode>(ctx: Contexto, chave: string, fazer?: () => T): T | null {
  let m = PERSISTENTES.get(ctx);
  if (!m) {
    m = new Map();
    PERSISTENTES.set(ctx, m);
  }
  const achado = m.get(chave) as T | undefined;
  if (achado) return achado;
  if (!fazer) return null;
  const novo = fazer();
  m.set(chave, novo);
  return novo;
}

/* ════════════════════════ As receitas ══════════════════════════════════════ */

type Args = {
  ctx: Contexto;
  saida: AudioNode;
  segundos: number;
  t0: number;
  base: boolean;
  r: () => number;
  /**
   * ⚠️ É o render do LAÇO de 30 s, ou é ao vivo?
   *
   * Só o render do laço quer a cópia de `comVolta` — ver o comentário lá, e o
   * `RangeError` que a falta desta distinção causava em dez dos trinta e dois
   * sons.
   */
  paraLaco: boolean;
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
  const { ctx, saida, segundos, t0, base, r, paraLaco } = a;
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
      paraLaco,
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
  const { ctx, saida, segundos, t0, base, r, paraLaco } = a;
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
    comVolta((q) => bolha(ctx, saida, q, r, 0.55), t, 0.05, fim, paraLaco);
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
  const { ctx, saida, segundos, t0, base, r, paraLaco } = a;
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

  /**
   * ⚠️ A RAJADA TEM PICO 2,27, NÃO 1 — e os dois destinos estouravam.
   *
   * `moduladorLento(0.05, 0.4, r, 1)` tem RMS 1,0 e PICO medido de 2,272 (é uma
   * soma de senoides; o pico é bem maior que o desvio). Com ganho 800 o corte
   * do passa-faixa ia a 1400 ± 1818, ou seja **−418 Hz** — e o Web Audio
   * clampa em zero. Nas rajadas mais fortes o filtro colapsava e **o vento
   * SUMIA**, que é o inverso de uma rajada. O nível fazia o mesmo: 0,22 ± 0,409
   * cruza zero.
   *
   * Os ganhos foram dimensionados pelo PICO, não pelo RMS.
   */
  const gCorte = ctx.createGain();
  gCorte.gain.value = 380;
  rajada.connect(gCorte).connect(bp.frequency);
  const gNivel = ctx.createGain();
  gNivel.gain.value = 0.085;
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
  /**
   * ⚠️ A FOLHAGEM PRECISA DE DOIS ESTÁGIOS MODULADOS, e só um era.
   *
   * O comentário prometia que ela "só aparece no PICO da rajada" e dizia que a
   * potência era aproximada por um segundo estágio de ganho — mas o primeiro
   * (`fg`) era CONSTANTE. Com um estágio só, a folhagem é linear na rajada, e
   * como a rajada é simétrica em torno de zero, ela saía como |rajada|:
   * aparecia igualmente quando o vento MORRIA.
   *
   * Modulando os dois, o efeito é quadrático de verdade — surge no pico e some
   * no vale. `ventoJanela` já fazia assim; era esta metade que faltava.
   */
  const fg = ctx.createGain();
  fg.gain.value = 0;
  const fg2 = ctx.createGain();
  fg2.gain.value = 0;
  const gFolhaA = ctx.createGain();
  gFolhaA.gain.value = 0.09;
  rajada.connect(gFolhaA).connect(fg.gain);
  const gFolhaB = ctx.createGain();
  gFolhaB.gain.value = 0.45;
  rajada.connect(gFolhaB).connect(fg2.gain);
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
  const { ctx, saida, segundos, t0, base, r, paraLaco } = a;
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
    /* O tremeluzir da chama: `f ≈ 1,5/√D` Hz, com D o diâmetro da base. O
       modulador SOMA ao ganho, então o valor de repouso fica no `g.gain.value`
       e a amplitude vem daqui. */
    const cintila = moduladorLento(ctx, 1.2, 3.0, r, 0.016);
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
    comVolta((q) => estalo(ctx, brilho, fonte, q, r, false), t, 0.05, fim, paraLaco);
    if (r() < 0.25) {
      let d = 0;
      const filhotes = 2 + Math.floor(r() * 4);
      for (let i = 0; i < filhotes; i++) {
        d += 0.018 + r() * 0.042;
        const q = t + d;
        if (q < fim)
          comVolta((x) => estalo(ctx, brilho, fonte, x, r, false), q, 0.05, fim, paraLaco);
      }
    }
  }
  for (let t = t0 + r() * 3; t < fim; t += (1.5 + r() * 4) / fator) {
    comVolta((q) => estalo(ctx, brilho, fonte, q, r, true), t, 0.12, fim, paraLaco);
  }
}

/* ── Floresta à noite ─────────────────────────────────────────────────────── */

function florestaNoite(a: Args) {
  const { ctx, saida, segundos, t0, base, r, paraLaco } = a;
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

    /* ⚠️ SEM PRELÚDIO. `naGrade(t0 − 0,5, segundos + 0,5, …)` fazia janelas
         consecutivas emitirem os MESMOS pontos de grade no meio-segundo de
         sobreposição — e como osciladores iniciados no mesmo instante partem da
         mesma fase, a soma é coerente: +6 dB no mesmo chirp. */
    for (const t of naGrade(t0, segundos, periodo)) {
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

/**
 * ⚠️ O PERÍODO DE CADA ESPÉCIE DIVIDE 30, e eles são diferentes entre si.
 *
 * Antes a pausa entre frases era sorteada a cada volta, o que impedia a grade
 * absoluta — e sem grade a frase reancorava na janela (ver `passaros`). Com
 * períodos fixos e distintos (7,5 · 6 · 5 · 10 · 15 s) as cinco espécies se
 * cruzam sem sincronizar, que é o que soa como floresta, e o laço fecha de
 * graça: todos dividem trinta.
 *
 * ⚠️ E o SILÊNCIO continua dominando — as frases duram de 0,6 a 2,5 s dentro
 * de períodos de 5 a 15 s. Cantar sem parar é o erro que mais mata a ilusão.
 */
const ESPECIES = [
  { f: [1500, 3000], silabas: [3, 6], traj: ["sobe", "chevron"] as const, periodo: 7.5, dist: 0 },
  { f: [2000, 7000], silabas: [4, 9], traj: ["chevron", "desce"] as const, periodo: 6, dist: 20 },
  { f: [3000, 6000], silabas: [2, 5], traj: ["sobe", "desce"] as const, periodo: 5, dist: 45 },
  { f: [3500, 7000], silabas: [3, 7], traj: ["trinado", "sobe"] as const, periodo: 10, dist: 80 },
  {
    f: [3000, 8000],
    silabas: [5, 12],
    traj: ["trinado", "chevron"] as const,
    periodo: 15,
    dist: 130,
  },
];

function passaros(a: Args) {
  const { ctx, saida, segundos, t0, base, r, paraLaco } = a;
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

    /**
     * ⚠️ A FRASE ANDA NA GRADE ABSOLUTA, e antes ela reancorava na janela.
     *
     * `t0 + (offset % pausa)` reinicia o relógio a cada janela: medido, a
     * primeira sílaba caía a 1,192 · 0,694 · 0,196 · 1,698 · 1,200 · 0,703 s do
     * começo de seis janelas seguidas — ou seja, **um pássaro cantava,
     * garantido, nos primeiros dois segundos de toda janela de vinte**, para
     * sempre. É o mesmo defeito de 139 ms do coração que `naGrade` foi escrita
     * para consertar, sobrevivendo aqui.
     *
     * ⚠️ E a frase INTEIRA é emitida, mesmo cruzando o fim da janela. Antes o
     * `if (q < fim)` cortava um canto de seis sílabas pela metade na emenda. A
     * janela seguinte não a repete, porque a grade é absoluta.
     */
    for (const t of naGrade(t0, segundos, esp.periodo)) {
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
        silaba(ctx, lp, q, r, { dur, f0, f1: Math.max(600, f1), traj, amp: 0.9 });
        q += dur + 0.02 + r() * 0.06;
      }
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
  let whoosh = persistente<GainNode>(ctx, "ventre:whoosh");
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
    whoosh = persistente<GainNode>(ctx, "ventre:whoosh", () => {
      const g = ctx.createGain();
      g.gain.value = 0.3;
      return g;
    })!;
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
    const evo = moduladorLento(ctx, 1 / 30, 1 / 10, r, 0.25 * voz.gain.value);
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
  const respiro = moduladorLento(ctx, 1 / 30, 1 / 12, r, 0.05);
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

/* ── A leva de agosto: mais doze ────────────────────────────────────────────
 *
 * ⚠️ Três delas — secador, máquina de lavar e ar-condicionado — não são
 * enfeite: são o repertório clássico de acalmar recém-nascido. Num app de
 * gestação, quem procura "som de secador" está procurando exatamente isso, e
 * hoje procura fora do app. Elas custam quinze linhas cada e resolvem uma
 * pergunta que a paciente já tem.
 */

/** Chuva ouvida de DENTRO do carro: o vidro corta o agudo e o metal ressoa. */
function chuvaNoCarro(a: Args) {
  const { ctx, saida, segundos, t0, base, r, paraLaco } = a;
  if (base) {
    /* ⚠️ O corte agudo em 2200 Hz é o que faz ser "de dentro": chuva no carro
       não tem o chiado fino da chuva ao ar livre — o vidro come tudo acima
       disso. Sem o corte, é chuva com um ronco por cima. */
    cama(ctx, saida, rosa(ctx, 30, 3131), 0.22, [
      { tipo: "highpass", hz: 200 },
      { tipo: "lowpass", hz: 2200 },
    ]);
    /* O ronco do capô e do teto, que é a caixa do carro respondendo. */
    cama(ctx, saida, ruidoMarromGuardado(ctx, 30, 3132), 0.14, [{ tipo: "lowpass", hz: 320 }]);
  }
  const fonte = branco(ctx, 2, 3133);
  const fim = t0 + segundos;
  for (let t = t0; t < fim; t += 0.01 + r() * 0.03) {
    comVolta(
      (q) =>
        gota(ctx, saida, fonte, q, r, {
          fLo: 400,
          fHi: 2000,
          qLo: 2,
          qHi: 5,
          durLo: 0.01,
          durHi: 0.03,
          forca: 0.9,
        }),
      t,
      0.1,
      fim,
      paraLaco,
    );
  }
}

/**
 * Tempestade: chuva forte com trovão LONGE.
 *
 * ⚠️ O trovão é longe de propósito, e isso é decisão de produto, não de gosto.
 * Um estouro perto acorda quem estava adormecendo e assusta quem está ansiosa —
 * exatamente as duas pessoas para quem esta tela existe. Longe, ele é um
 * rolar grave que dura segundos e nunca tem ataque.
 */
function tempestade(a: Args) {
  const { ctx, saida, segundos, t0, base, r, paraLaco } = a;
  chuvas({ ...a }, "chuva-forte");
  const fim = t0 + segundos;
  /**
   * ⚠️ O TROVÃO NÃO PODE CAIR NA GRADE — e a primeira versão caía.
   *
   * Ele era agendado a cada 15 s exatos. Como o arquivo é um WAV de 30 s em
   * `<audio loop>`, isso dá **os mesmos dois trovões, com as mesmas duas forças
   * sorteadas, repetindo cento e vinte vezes por hora**, a noite inteira. É o
   * marcador de laço mais reconhecível que existe: um evento singular, alto e
   * espaçado, é exatamente o que o ouvido usa para descobrir o período.
   *
   * A auditoria original desta base condenou 0,997 de auto-similaridade a dois
   * segundos; um trovão relojoeiro é pior, porque não precisa de medição para
   * ser percebido.
   *
   * O sorteio do INTERVALO resolve: os dois trovões do laço caem em instantes
   * diferentes e com forças diferentes, e a repetição de 30 s é a mesma dos
   * outros sons — inaudível.
   */
  for (let t = t0 + 2 + r() * 6; t < fim; t += 9 + r() * 12) {
    const forca = 0.35 + r() * 0.4;
    const src = ctx.createBufferSource();
    src.buffer = ruidoMarromGuardado(ctx, 30, 3134);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    /* O corte DESCE ao longo do rolar: é a distância comendo o agudo enquanto
       o som chega por caminhos cada vez mais longos. */
    lp.frequency.setValueAtTime(noLaco(260), t);
    lp.frequency.exponentialRampToValueAtTime(noLaco(70), t + 6);
    const g = ctx.createGain();
    /* ⚠️ Ataque de 900 ms: trovão longe NÃO tem estouro. Um ataque curto aqui
       é um susto, e susto é o oposto do trabalho desta tela. */
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(forca, t + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 7);
    src.connect(lp).connect(g).connect(saida);
    src.start(t, r() * 20);
    src.stop(Math.min(t + 7.2, fim + 8));
  }
  void base;
}

/** Lago: água parada. Sem quebra, sem espuma — só a borda lambendo. */
function lago(a: Args) {
  const { ctx, saida, segundos, t0, base, r, paraLaco } = a;
  if (base) {
    cama(ctx, saida, rosa(ctx, 30, 3135), 0.1, [
      { tipo: "highpass", hz: 300 },
      { tipo: "lowpass", hz: 3000 },
    ]);
    cama(ctx, saida, ruidoMarromGuardado(ctx, 30, 3136), 0.08, [{ tipo: "lowpass", hz: 200 }]);
  }
  /* ⚠️ Bolhas RARAS e graves — é o que separa lago de riacho. O riacho tem 45
     por segundo; aqui são três. Densidade é o parâmetro que muda a água de
     lugar. */
  const fim = t0 + segundos;
  for (let t = t0; t < fim; t += 0.2 + r() * 0.5) {
    comVolta((q) => bolha(ctx, saida, q, r, 0.3), t, 0.05, fim, paraLaco);
  }
}

/**
 * Sapos no brejo. Um coro de vozes graves, cada uma com o seu período.
 *
 * ⚠️ A mesma estrutura dos grilos, e pela mesma razão: é a POPULAÇÃO que é o
 * som. A diferença é a altura (200 a 700 Hz contra 4 a 5 kHz) e a forma — o
 * sapo tem um coaxo com vibrato, o grilo tem pulsos secos.
 */
/**
 * ⚠️ OS CONTADORES NÃO PODEM TER FATOR COMUM — e os primeiros tinham.
 *
 * Eram 21 · 18 · 24 · 15 · 27 cantos em trinta segundos. Todos múltiplos de
 * TRÊS: os cinco sapos voltavam à mesma fase a cada dez segundos, e o coro
 * inteiro se repetia em um terço do laço. A bancada mediu 0,771 de
 * auto-similaridade nesse lag — o segundo pior número da noite, atrás só da
 * chuva antiga.
 *
 * ⚠️ E máximo divisor comum 1 não bastou. Com 22 · 18 · 25 · 15 · 28 o composto
 * só voltava aos trinta segundos, mas TRÊS dos cinco contadores eram PARES —
 * e contador par volta à mesma fase na METADE do laço. Medido: 0,627 a quinze
 * segundos, ainda acima do limite.
 *
 * Com todos ÍMPARES e primos entre si (23 · 19 · 25 · 17 · 29), nenhum volta
 * aos quinze e só um deles aos dez. Cada sapo continua com o seu período; o
 * que muda é que eles param de se reencontrar.
 */
const SAPOS = [
  { hz: 240, cantos: 23, nivel: 0.5, vib: 28 },
  { hz: 320, cantos: 19, nivel: 0.36, vib: 34 },
  { hz: 430, cantos: 25, nivel: 0.26, vib: 40 },
  { hz: 195, cantos: 17, nivel: 0.2, vib: 22 },
  { hz: 560, cantos: 29, nivel: 0.12, vib: 46 },
];

function sapos(a: Args) {
  const { ctx, saida, segundos, t0, base, r, paraLaco } = a;
  if (base) {
    cama(ctx, saida, rosa(ctx, 30, 3137), 0.035, [{ tipo: "lowpass", hz: 1200 }]);
  }
  const fim = t0 + segundos;
  for (const sp of SAPOS) {
    const periodo = 30 / sp.cantos;
    /* ⚠️ SEM PRELÚDIO. `naGrade(t0 − 0,5, segundos + 0,5, …)` fazia janelas
         consecutivas emitirem os MESMOS pontos de grade no meio-segundo de
         sobreposição — e como osciladores iniciados no mesmo instante partem da
         mesma fase, a soma é coerente: +6 dB no mesmo chirp. */
    for (const t of naGrade(t0, segundos, periodo)) {
      if (t >= fim) continue;
      const dur = 0.12 + r() * 0.18;
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = noLaco(sp.hz);
      /* O vibrato é o coaxo. Sem ele é um tom de sintetizador. */
      const vib = ctx.createOscillator();
      vib.frequency.value = noLaco(sp.vib);
      const vg = ctx.createGain();
      vg.gain.value = sp.hz * 0.08;
      vib.connect(vg).connect(o.frequency);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = noLaco(sp.hz * 4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(sp.nivel * 0.22, t + 0.02);
      g.gain.setValueAtTime(sp.nivel * 0.22, t + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(lp).connect(g).connect(saida);
      o.start(t);
      o.stop(t + dur + 0.02);
      vib.start(t);
      vib.stop(t + dur + 0.02);
    }
  }
}

/**
 * Cigarras na tarde quente.
 *
 * ⚠️ Elas moram em 4,5–6,5 kHz aqui, e não nos 14 kHz do mundo real: a taxa de
 * amostragem é 22050, e as bandas laterais da modulação de 120 Hz precisam
 * caber abaixo de 11 kHz. Acima disso vira aliasing, que soa como assobio.
 */
function cigarras(a: Args) {
  const { ctx, saida, base, r } = a;
  if (!base) return;
  cama(ctx, saida, rosa(ctx, 30, 3138), 0.03, [{ tipo: "lowpass", hz: 900 }]);
  for (const [f, taxa, nivel] of [
    [5200, 118, 0.16],
    [4700, 104, 0.1],
    [5900, 131, 0.06],
  ]) {
    const src = emLaco(ctx, branco(ctx, 30, 3139));
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = noLaco(f);
    bp.Q.value = 3;
    /* A modulação em amplitude a ~120 Hz é o que faz o "zzzz" — sem ela é só
       ruído de banda estreita, que soa como chiado de rádio. */
    const am = ctx.createGain();
    am.gain.value = nivel * 0.55;
    const mod = ctx.createOscillator();
    mod.frequency.value = noLaco(taxa);
    const mg = ctx.createGain();
    mg.gain.value = nivel * 0.45;
    mod.connect(mg).connect(am.gain);
    mod.start(0);
    /* E o envelope lento é a cigarra que sobe, sustenta e cai — nenhuma canta
       o tempo todo. */
    /* ⚠️ O centro vai no `value` e a amplitude no modulador — ele SOMA. A
       versão anterior punha o centro no modulador e deixava o `value` em zero,
       e como aquele nó devolvia silêncio o envelope ficava em zero para sempre:
       as cigarras saíam com pico 0,02. */
    /* ⚠️ O modulador tem pico ~0,76 por unidade de amplitude, então 0,42 levava
       o envelope a −0,26 — a cigarra RETIFICAVA em zero em vez de repousar em
       silêncio. Dimensionado pelo pico. */
    const lento = moduladorLento(ctx, 1 / 30, 1 / 12, r, 0.3);
    const env = ctx.createGain();
    env.gain.value = 0.34;
    lento.connect(env.gain);
    src.connect(bp).connect(am).connect(env).connect(saida);
    src.start(0);
  }
}

/**
 * Sino de vento: tubos batendo ao acaso na brisa.
 *
 * ⚠️ As alturas são a PENTATÔNICA em A = 432 — a mesma do resto do app. Sino de
 * vento real é afinado em pentatônica justamente porque qualquer combinação de
 * tubos soa consonante, que é o mesmo teorema que decidiu a escala da música.
 */
function sinoDeVento(a: Args) {
  const { ctx, saida, segundos, t0, base, r, paraLaco } = a;
  if (base) {
    cama(ctx, saida, rosa(ctx, 30, 3140), 0.05, [{ tipo: "bandpass", hz: 1400, q: 0.7 }]);
  }
  const tubos = grausEmHz("pentatonicaMenor", nota("la", 4), 2, true);
  const fim = t0 + segundos;
  for (let t = t0; t < fim; t += 0.35 + r() * 2.2) {
    const hz = tubos[Math.floor(r() * tubos.length)];
    comVolta(
      (q) => {
        /* Tubo é quase harmônico, com o 2º parcial forte e o 3º levemente
           desafinado — é o que o distingue de uma tigela (inarmônica) e de um
           sino de igreja (muito mais denso). */
        for (const [razao, amp, cai] of [
          [1, 1, 3.2],
          [2.01, 0.35, 1.8],
          [3.04, 0.14, 0.9],
        ]) {
          const o = ctx.createOscillator();
          o.type = "sine";
          o.frequency.value = noLaco(hz * razao);
          const g = ctx.createGain();
          const pico = amp * (0.05 + r() * 0.1);
          g.gain.setValueAtTime(0.0001, q);
          g.gain.exponentialRampToValueAtTime(pico, q + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0001, q + cai);
          o.connect(g).connect(saida);
          o.start(q);
          o.stop(q + cai + 0.05);
        }
      },
      t,
      3.5,
      fim,
      paraLaco,
    );
  }
}

/**
 * Piano esparso: notas soltas, bem devagar.
 *
 * ⚠️ Sem martelo e sem corda — é um tom com parciais decaindo, e o que faz
 * soar como piano é que os AGUDOS MORREM PRIMEIRO. É a mesma assinatura do
 * sino de vidro da música, e a mesma razão: tudo que é percutido faz isso.
 */
function piano(a: Args) {
  const { ctx, saida, segundos, t0, base, r, paraLaco } = a;
  if (base) {
    cama(ctx, saida, rosa(ctx, 30, 3141), 0.012, [{ tipo: "lowpass", hz: 1500 }]);
  }
  const notas = grausEmHz("pentatonicaMenor", nota("la", 3), 2, true);
  const fim = t0 + segundos;
  for (let t = t0; t < fim; t += 2.2 + r() * 4) {
    const hz = notas[Math.floor(r() * notas.length)];
    comVolta(
      (q) => {
        for (const [razao, amp, cai] of [
          [1, 1, 5],
          [2, 0.42, 3],
          [3, 0.18, 1.6],
          [4, 0.08, 0.9],
          [5, 0.04, 0.5],
        ]) {
          const o = ctx.createOscillator();
          o.type = "sine";
          o.frequency.value = noLaco(hz * razao);
          const g = ctx.createGain();
          const pico = amp * (0.08 + r() * 0.06);
          g.gain.setValueAtTime(0.0001, q);
          g.gain.exponentialRampToValueAtTime(pico, q + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0001, q + cai);
          o.connect(g).connect(saida);
          o.start(q);
          o.stop(q + cai + 0.05);
        }
      },
      t,
      5.5,
      fim,
      paraLaco,
    );
  }
}

/** Ar-condicionado: constante, sem grave, sem nada acontecendo. */
function arCondicionado(a: Args) {
  const { ctx, saida, base, r } = a;
  if (!base) return;
  const g = cama(ctx, saida, rosa(ctx, 30, 3142), 0.4, [
    { tipo: "highpass", hz: 180 },
    { tipo: "lowpass", hz: 2600 },
  ]);
  /* Um respiro quase imperceptível: ar-condicionado de verdade não é
     matematicamente constante, e a constância perfeita soa sintética. */
  const respiro = moduladorLento(ctx, 1 / 30, 1 / 15, r, 0.03);
  respiro.connect(g.gain);
}

/**
 * Secador de cabelo — e ele não é enfeite.
 *
 * ⚠️ É o som mais citado no repertório de acalmar recém-nascido, junto com o
 * aspirador e a máquina de lavar. Numa base de gestantes, quem procura isto
 * está procurando exatamente isto — e hoje procura fora do app.
 */
function secador(a: Args) {
  const { ctx, saida, base, r } = a;
  if (!base) return;
  cama(ctx, saida, branco(ctx, 30, 3143), 0.3, [
    { tipo: "highpass", hz: 300 },
    { tipo: "lowpass", hz: 6000 },
  ]);
  cama(ctx, saida, ruidoMarromGuardado(ctx, 30, 3144), 0.25, [{ tipo: "lowpass", hz: 500 }]);
  /* O motor: um tom estreito no grave, que é o que separa secador de ruído
     branco puro. */
  const fonte = emLaco(ctx, rosa(ctx, 30, 3145));
  fonte.start(0);
  for (const [f, gg] of [
    [120, 0.06],
    [240, 0.03],
  ]) {
    const bq = ctx.createBiquadFilter();
    bq.type = "bandpass";
    bq.frequency.value = noLaco(f);
    bq.Q.value = 10;
    const gain = ctx.createGain();
    gain.gain.value = gg;
    fonte.connect(bq).connect(gain).connect(saida);
  }
  void r;
}

/**
 * Máquina de lavar: gira, vira, e volta.
 *
 * ⚠️ O que a distingue do secador é o RITMO — o tambor inverte o sentido a cada
 * poucos segundos, e é essa ondulação lenta que o ouvido reconhece. Um ruído
 * constante com o mesmo espectro seria só um secador mais grave.
 */
function maquinaDeLavar(a: Args) {
  const { ctx, saida, base, r } = a;
  if (!base) return;
  const g = cama(ctx, saida, ruidoMarromGuardado(ctx, 30, 3146), 0.45, [
    { tipo: "lowpass", hz: 800 },
    { tipo: "highpass", hz: 40 },
  ]);
  /* 1/5 Hz: o tambor completa um sentido a cada cinco segundos. Cinco divide
     trinta, então o laço fecha. */
  const gira = ctx.createOscillator();
  gira.frequency.value = 1 / 5;
  const gg = ctx.createGain();
  gg.gain.value = 0.18;
  gira.connect(gg).connect(g.gain);
  gira.start(0);
  cama(ctx, saida, rosa(ctx, 30, 3147), 0.06, [
    { tipo: "highpass", hz: 900 },
    { tipo: "lowpass", hz: 4000 },
  ]);
  void r;
}

/** Ruído branco puro: 54,6% da energia acima de 5 kHz, centroide ~5500 Hz. */
function brancoPuro(a: Args) {
  const { ctx, saida, base } = a;
  if (!base) return;
  cama(ctx, saida, branco(ctx, 30, 3148), 0.55, [{ tipo: "highpass", hz: 25 }]);
}

/** Ruído rosa puro: energia igual por oitava, centroide ~1400 Hz. */
function rosaPuro(a: Args) {
  const { ctx, saida, base } = a;
  if (!base) return;
  cama(ctx, saida, rosa(ctx, 30, 3149), 0.85, [{ tipo: "highpass", hz: 25 }]);
}

/* ════════════════════════ O despachante ════════════════════════════════════ */

/** Semente base por som: cada um sorteia a própria sequência. */
const SEMENTES: Record<SomKey, number> = {
  chuva: 20260813,
  "chuva-forte": 20260814,
  "chuva-telhado": 20260815,
  "chuva-carro": 20260816,
  tempestade: 20260817,
  riacho: 776,
  cachoeira: 4242,
  mar: 777,
  lago: 778,
  "vento-folhas": 5150,
  "vento-janela": 5151,
  lareira: 6060,
  fogueira: 6061,
  "floresta-noite": 7070,
  passaros: 8080,
  sapos: 8081,
  cigarras: 8082,
  coracao: 9090,
  ventre: 9091,
  pad: 1234,
  drone: 1235,
  tigela: 2360,
  "sino-vento": 2361,
  piano: 2362,
  aviao: 3030,
  ventilador: 4040,
  "ar-condicionado": 4041,
  secador: 4042,
  "maquina-lavar": 4043,
  branco: 5048,
  rosa: 5049,
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
  /**
   * ⚠️ O padrão é `true` porque o render do laço é quem tem exigência; o
   * caminho AO VIVO tem de dizer `false` explicitamente. Errar para o lado do
   * laço só acrescenta um evento a mais; errar para o outro lado é o
   * `RangeError` que derrubava dez sons.
   */
  paraLaco = true,
) {
  const r = sorteador(semente(SEMENTES[kind], t0));
  const a: Args = { ctx, saida, segundos, t0, base, r, paraLaco };
  switch (kind) {
    case "chuva":
    case "chuva-forte":
    case "chuva-telhado":
      return chuvas(a, kind);
    case "chuva-carro":
      return chuvaNoCarro(a);
    case "tempestade":
      return tempestade(a);
    case "riacho":
      return riacho(a);
    case "cachoeira":
      return cachoeira(a);
    case "mar":
      return mar(a);
    case "lago":
      return lago(a);
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
    case "sapos":
      return sapos(a);
    case "cigarras":
      return cigarras(a);
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
    case "sino-vento":
      return sinoDeVento(a);
    case "piano":
      return piano(a);
    case "aviao":
      return aviao(a);
    case "ventilador":
      return ventilador(a);
    case "ar-condicionado":
      return arCondicionado(a);
    case "secador":
      return secador(a);
    case "maquina-lavar":
      return maquinaDeLavar(a);
    case "branco":
      return brancoPuro(a);
    case "rosa":
      return rosaPuro(a);
    case "marrom":
      return marrom(a);
  }
}
