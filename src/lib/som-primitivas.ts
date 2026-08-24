/**
 * AS PEÇAS DE QUE OS SONS SÃO FEITOS.
 *
 * `som-receitas.ts` monta os sons; este arquivo tem as peças. A separação é
 * porque as receitas cresceram de quatro para vinte, e uma gota, um estalo e
 * uma bolha são usados por várias delas — duas cópias divergiriam no primeiro
 * conserto, e num som isso aparece como "um deles ficou estranho", nunca como
 * erro.
 *
 * ─── ⚠️ A REGRA QUE ATRAVESSA TODO ESTE ARQUIVO ─────────────────────────────
 *
 * O trecho renderizado toca em `<audio loop>`: o último quadro encosta no
 * primeiro. Então **tudo que é periódico tem de fechar um número inteiro de
 * voltas em `LOOP_SEGS`**. Isso vale para osciladores, LFOs, batidas, taxas de
 * chirp e comprimento de buffer de ruído — e é o que `noLaco()` (em
 * `afinacao.ts`) existe para garantir.
 *
 * Meia volta sobrando a cada 30 s é um estalo a cada 30 s, a noite inteira, no
 * ouvido de quem está tentando dormir. E nunca é um erro: é só um barulhinho.
 */

import { noLaco } from "./afinacao";

/** Contexto que serve tanto ao render offline quanto ao ao vivo. */
export type Contexto = BaseAudioContext;

/** O trecho que se repete, em segundos. Espelhado de `som-continuo.ts`. */
export const LACO = 30;

/* ═══════════════════════════ Sorteio ═══════════════════════════════════════ */

/**
 * Sorteio determinístico.
 *
 * ⚠️ Determinismo aqui não é capricho: é o que torna `scripts/ouvir.mjs` uma
 * bancada. Com `Math.random()`, o mesmo som medido duas vezes dá dois números,
 * e não há como saber se uma mudança melhorou ou se foi o sorteio.
 */
export function sorteador(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * ⚠️ A SEMENTE DEPENDE DA JANELA — e sem isso a chuva se repetia a cada 20 s.
 *
 * No render offline, `montar` é chamada UMA vez: a sequência corre do começo ao
 * fim e nada se repete. **Ao vivo é o contrário** — `createSoundscape` chama
 * uma vez por janela, e com semente fixa toda janela recebia a MESMA sequência:
 * as mesmas gotas, nos mesmos instantes, nas mesmas frequências, durante a
 * meditação inteira.
 *
 * Somar o instante da janela conserta ao vivo e não mexe no offline, onde `t0`
 * é sempre 0 e a semente continua sendo a de sempre.
 */
export function semente(base: number, t0: number): number {
  return (base + Math.round(t0 * 1000)) >>> 0;
}

/* ═══════════════════════════ Ruídos ════════════════════════════════════════ */

/**
 * Ruído ROSA — o filtro de Paul Kellett, sete polos.
 *
 * É o padrão da literatura de áudio para aproximar 1/f, e é exato a ±0,05 dB de
 * 10 Hz a 20 kHz. Energia igual por OITAVA, que é como soa tudo que a natureza
 * faz: chuva, mar, vento, cachoeira.
 *
 * Distribuição medida: 29% abaixo de 125 Hz · 22% de 125 a 500 · 22% de 500 a
 * 2k · 14,5% de 2k a 5k · 12,5% acima. Centroide ~1400 Hz.
 */
export function ruidoRosa(ctx: Contexto, segundos: number, sem = 1): AudioBuffer {
  const len = Math.round(ctx.sampleRate * segundos);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const rnd = sorteador(sem);
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
  return buf;
}

/**
 * Ruído BRANCO — energia igual por hertz, e GAUSSIANO.
 *
 * ⚠️ `Math.random() * 2 − 1` é UNIFORME, e isso estraga a medição. Uniforme tem
 * desvio 1/√3 = 0,577 e teto rígido em 1, o que dá fator de crista **1,73**
 * contra **4,2** de um gaussiano. Perceptualmente a diferença é pequena; para a
 * bancada é total — não dá para comparar a crista da chuva com a do branco se
 * os dois não vierem da mesma família de distribuição.
 *
 * Box–Muller resolve, e de graça: duas amostras por volta.
 *
 * Quem alimenta um RESSONADOR precisa ser branco. O rosa cai 3 dB por oitava, e
 * entre 700 e 5000 Hz — onde a água bate — já sobrou pouquíssima energia. Foi
 * essa a causa de as gotas saírem cem vezes mais fracas do que o envelope pedia.
 */
export function ruidoBranco(ctx: Contexto, segundos: number, sem = 7): AudioBuffer {
  const len = Math.round(ctx.sampleRate * segundos);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const rnd = sorteador(sem);
  for (let i = 0; i < len; i += 2) {
    const u = Math.max(1e-12, rnd());
    const v = rnd();
    const r = Math.sqrt(-2 * Math.log(u)) * 0.25;
    d[i] = r * Math.cos(2 * Math.PI * v);
    if (i + 1 < len) d[i + 1] = r * Math.sin(2 * Math.PI * v);
  }
  return buf;
}

/**
 * Ruído MARROM — integrador com fuga, −6 dB por oitava.
 *
 * 84% da energia abaixo de 125 Hz, centroide ~110 Hz. É o chão de tudo que é
 * grave: mar longe, vento forte, cabine de avião.
 *
 * ⚠️ **O passa-alta no fim não é opcional.** Ruído marrom acumula DC, e deriva
 * de DC é o defeito nº 1 de emenda: não dá clique, dá DEGRAU, que soa como um
 * "puc" grave a cada volta. Aqui a média é removida na própria geração, que é
 * mais barato e mais seguro que um biquad depois.
 */
export function ruidoMarrom(ctx: Contexto, segundos: number, sem = 13): AudioBuffer {
  const len = Math.round(ctx.sampleRate * segundos);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const rnd = sorteador(sem);
  /* a = 0,99 a 22050 Hz dá joelho em 35 Hz: plano abaixo, −6 dB/oit acima. */
  const a = 0.99;
  let y = 0;
  let soma = 0;
  for (let i = 0; i < len; i++) {
    y = a * y + (1 - a) * (rnd() * 2 - 1);
    d[i] = y;
    soma += y;
  }
  const media = soma / len;
  let pico = 0;
  for (let i = 0; i < len; i++) {
    d[i] -= media;
    pico = Math.max(pico, Math.abs(d[i]));
  }
  if (pico > 0) {
    const g = 0.5 / pico;
    for (let i = 0; i < len; i++) d[i] *= g;
  }
  return buf;
}

/**
 * ⚠️ OS BUFFERS SÃO GUARDADOS POR CONTEXTO — e sem isto há vazamento.
 *
 * `montar` é chamada UMA vez no render offline e **uma vez por janela** ao
 * vivo. Todo `ruidoRosa`/`ruidoBranco` dentro dela nasce de novo a cada janela:
 * a auditoria mediu isso como vazamento de nó e de buffer, e a mudança para
 * camas de 30 s PIOROU o quadro — o mar criava 2,6 MB de ruído a cada 20
 * segundos, ou seja ~79 MB numa meditação de dez minutos.
 *
 * O cache é por CONTEXTO (um `WeakMap`), não global: buffers pertencem ao
 * contexto que os criou, e o contexto morre quando a sessão acaba — levando o
 * cache junto, sem ninguém precisar limpar nada.
 *
 * ⚠️ E a chave inclui a TAXA de amostragem: o mesmo som renderizado a 22050 e
 * tocado a 48000 precisa de dois buffers, e servir o errado dá um som com a
 * altura trocada.
 */
const CACHE = new WeakMap<Contexto, Map<string, AudioBuffer>>();

function guardado(ctx: Contexto, chave: string, fazer: () => AudioBuffer): AudioBuffer {
  let m = CACHE.get(ctx);
  if (!m) {
    m = new Map();
    CACHE.set(ctx, m);
  }
  const k = chave + ":" + ctx.sampleRate;
  const achado = m.get(k);
  if (achado) return achado;
  const novo = fazer();
  m.set(k, novo);
  return novo;
}

/** Ruído rosa guardado: a mesma semente devolve o mesmo buffer no contexto. */
export function rosa(ctx: Contexto, segundos: number, sem: number): AudioBuffer {
  return guardado(ctx, "rosa:" + segundos + ":" + sem, () => ruidoRosa(ctx, segundos, sem));
}

/** Ruído branco guardado. */
export function branco(ctx: Contexto, segundos: number, sem: number): AudioBuffer {
  return guardado(ctx, "branco:" + segundos + ":" + sem, () => ruidoBranco(ctx, segundos, sem));
}

/** Ruído marrom guardado. */
export function marrom(ctx: Contexto, segundos: number, sem: number): AudioBuffer {
  return guardado(ctx, "marrom:" + segundos + ":" + sem, () => ruidoMarrom(ctx, segundos, sem));
}

/** Um `BufferSourceNode` em laço, já ligado, para servir de cama. */
export function emLaco(ctx: Contexto, buf: AudioBuffer): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

/* ═══════════════════════ Modulação lenta ═══════════════════════════════════ */

/**
 * ⚠️ MODULAÇÃO LENTA "ALEATÓRIA" NÃO PODE SER RUÍDO FILTRADO.
 *
 * Rajada de vento, tremeluzir de chama, respiração de um pad, variação de nível
 * numa cabine: todos precisam de uma variação lenta, de banda estreita, que
 * pareça aleatória. O jeito óbvio — ruído passado por um passa-baixa bem
 * grave — **nunca fecha o laço**, porque não é periódico em nada.
 *
 * Uma SOMA DE SENOIDES cujas frequências são todas múltiplas de 1/LAÇO fecha
 * por construção e soa igual: o ouvido não distingue "aleatório" de "soma de
 * onze componentes com fases sorteadas".
 *
 * Os pesos 1/k dão espectro rosa à modulação, que é o que a torna orgânica —
 * pesos iguais dariam algo que soa como uma sirene.
 *
 * Exemplos: rajada de folhas 0,05–0,4 Hz → k = 2…12, onze componentes. Chama
 * 1,2–3 Hz → k = 36…90.
 */
/**
 * ⚠️ `bandaLenta` FOI APAGADA, e o defeito dela vale a explicação.
 *
 * Ela devolvia um `GainNode` cujo PARÂMETRO de ganho era modulado pelas
 * senoides — e a saída de ÁUDIO dele era silêncio, porque nada era ligado à
 * entrada. Todos os cinco usos faziam `bandaLenta(...).connect(algo.gain)`, ou
 * seja, ligavam SILÊNCIO a um parâmetro. Nenhum modulava coisa nenhuma.
 *
 * O preço, medido em `node scripts/ouvir.mjs --niveis`: a fogueira nunca
 * tremeluziu, o drone nunca evoluiu, o avião e o ar-condicionado nunca
 * respiraram, e as cigarras — cujo envelope inteiro dependia disso — saíram
 * com pico **0,02** e pediram ganho de 37× para chegar ao nível das outras.
 * Foi esse número absurdo que denunciou o resto.
 *
 * ⚠️ E o `tsc` não pegava: `GainNode.connect(AudioParam)` é uma assinatura
 * válida. O código estava certo em tipo e vazio em efeito.
 *
 * `moduladorLento` é o que sempre foi preciso: um nó cuja SAÍDA é a soma das
 * senoides. Ligado a um parâmetro, ele SOMA ao valor dele — então o centro vai
 * em `param.value` e a amplitude aqui.
 */
/**
 * O mesmo, mas devolvendo um nó de ÁUDIO — para quando a modulação precisa
 * alimentar `frequency` de um filtro em vez de um ganho.
 */
export function moduladorLento(
  ctx: Contexto,
  lo: number,
  hi: number,
  r: () => number,
  amplitude: number,
): GainNode {
  const mix = ctx.createGain();
  mix.gain.value = 1;
  somarComponentes(ctx, lo, hi, r, amplitude, mix);
  return mix;
}

/**
 * ⚠️ A FASE DE UM OSCILADOR SÓ EXISTE POR ONDA PERIÓDICA.
 *
 * `OscillatorNode` não tem parâmetro de fase, e `start(quando, offset)` não
 * existe — isso é de `AudioBufferSourceNode`. A primeira versão deste arquivo
 * tentou o segundo argumento e o `tsc` pegou.
 *
 * O caminho é `createPeriodicWave`: uma senoide de fase φ é
 * `sin(φ)·cos(2πft) + cos(φ)·sin(2πft)`, e os dois coeficientes vão nos
 * vetores real e imaginário do primeiro harmônico. Sem fase, todas as
 * componentes começariam alinhadas em zero e a modulação daria um pico no
 * início de cada volta em vez de parecer aleatória.
 */
function senoideComFase(ctx: Contexto, f: number, fase: number): OscillatorNode {
  const o = ctx.createOscillator();
  const real = new Float32Array([0, Math.sin(fase)]);
  const imag = new Float32Array([0, Math.cos(fase)]);
  o.setPeriodicWave(ctx.createPeriodicWave(real, imag, { disableNormalization: true }));
  o.frequency.value = f;
  return o;
}

function somarComponentes(
  ctx: Contexto,
  lo: number,
  hi: number,
  r: () => number,
  amplitude: number,
  destino: AudioParam | AudioNode,
) {
  const k0 = Math.max(1, Math.ceil(lo * LACO));
  const k1 = Math.max(k0, Math.floor(hi * LACO));
  let soma = 0;
  for (let k = k0; k <= k1; k++) soma += 1 / (k * k);
  /* Variância unitária: sem isto a profundidade pedida não é a entregue, e
     "±40%" viraria ±12% ou ±90% conforme a largura da banda. */
  const norma = amplitude / Math.sqrt(soma / 2);
  for (let k = k0; k <= k1; k++) {
    const o = senoideComFase(ctx, k / LACO, r() * 2 * Math.PI);
    const g = ctx.createGain();
    g.gain.value = norma / k;
    o.connect(g);
    (g as AudioNode).connect(destino as AudioNode & AudioParam);
    o.start(0);
  }
}

/* ═══════════════════════ Eventos que dão a volta ═══════════════════════════ */

/**
 * ⚠️ EVENTO QUE CRUZA A EMENDA GANHA UMA CÓPIA UMA VOLTA ANTES.
 *
 * A versão anterior deixava um BURACO de 200 ms no fim do trecho para nenhum
 * evento ser cortado pela emenda. Isso funciona para três gotas por segundo e
 * quebra para tudo o mais — e, pior, deixa um buraco audível em sons de evento
 * denso.
 *
 * A saída certa é a do laço de amostra: se a cauda do evento cruza o fim, uma
 * cópia idêntica entra em `t − LAÇO`, e a cauda DELA cai exatamente onde a
 * cortada cairia. Sem buraco, sem clique, e o trecho fica periódico de verdade.
 *
 * ⚠️ Exige que o aquecimento seja maior que a cauda mais longa do evento —
 * senão a cópia cai antes do começo do render e não é escrita.
 */
export function comVolta(
  disparar: (t: number) => void,
  t: number,
  cauda: number,
  fim: number,
  paraLaco: boolean,
) {
  disparar(t);
  /**
   * ⚠️ A CÓPIA SÓ EXISTE NO RENDER DO LAÇO — e a falta desta linha derrubava
   * dez dos trinta e dois sons AO VIVO.
   *
   * `comVolta` é um dispositivo de EMENDA: a cópia em `t − LAÇO` existe para
   * que a cabeça do trecho carregue a cauda do evento que cruza o fim. Isso só
   * faz sentido quando a janela É o laço de 30 s do render offline.
   *
   * Ao vivo a janela tem 20 s e `t0` é o `currentTime` de um contexto recém
   * criado — algo entre 0,05 e 1,5 s. Então `t − 30` é NEGATIVO, e
   * `setValueAtTime` com tempo negativo **lança `RangeError`**: não é ignorado,
   * não toca imediatamente, lança.
   *
   * ⚠️ E a consequência era muito pior que o erro. Em `createSoundscape.start()`
   * a exceção subia ANTES de `proximaJanela` ser fixada e de o agendador ser
   * armado, e caía num `catch` que engole. Resultado medido: a paciente
   * escolhia "Chuva", ouvia vinte segundos de chuva com gotas, e **pelo resto
   * da sessão só a cama de ruído** — o chiado de televisão que este arquivo
   * inteiro existe para não ser. Sem erro na tela, sem log, com o chip do som
   * aceso.
   *
   * Medido varrendo `t0` de 0,05 a 1,5 s: chuva, chuva forte, chuva no
   * telhado, chuva no carro, tempestade, riacho, sino de vento e piano
   * estouravam em 6 de 6 aberturas; lago e fogueira, em 1 de 6 (depende do
   * sorteio).
   */
  if (paraLaco && t + cauda > fim) disparar(t - LACO);
}

/**
 * ⚠️ EVENTO PERIÓDICO ANDA NA GRADE ABSOLUTA, nunca a partir da janela.
 *
 * Este é o defeito mais grave que a auditoria da meditação achou, e ele é
 * medido: o batimento do coração TROPEÇAVA a cada 20 segundos.
 *
 * A causa é aritmética. As batidas eram agendadas com
 * `for (t = 0; t < segundos; t += periodo)` e emitidas em `t0 + t` — ou seja,
 * a fase reiniciava no começo de CADA janela. Ao vivo a janela tem 20 s e o
 * período a 140 bpm é 0,42857 s; **20 não é múltiplo de 0,42857**, então a
 * primeira batida de cada janela caía 139 ms adiantada — 32% do período. Numa
 * sessão de dez minutos são **trinta tropeços**, no som cujo propósito inteiro
 * é ser um batimento estável.
 *
 * O render offline nunca teve isso porque 30 s é múltiplo exato de 0,42857
 * (70 batidas). O defeito nasceu de reaproveitar a mesma função com uma janela
 * de tamanho diferente — e por isso a correção não pode ser "escolher uma
 * janela múltipla": qualquer mudança futura em `JANELA_SEGS` traria o tropeço
 * de volta.
 *
 * Ancorando no ZERO ABSOLUTO do contexto, a grade é a mesma para todas as
 * janelas, e a emenda entre elas some por construção.
 */
export function naGrade(t0: number, segundos: number, periodo: number): number[] {
  const out: number[] = [];
  const primeiro = Math.ceil((t0 - 1e-9) / periodo) * periodo;
  for (let t = primeiro; t < t0 + segundos - 1e-9; t += periodo) out.push(t);
  return out;
}

/* ═══════════════════════ Eventos ═══════════════════════════════════════════ */

/**
 * Uma GOTA: um estalo curto de ruído passado por um ressonador.
 *
 * A frequência de ressonância entre 700 e 6000 Hz é a faixa em que a água bate
 * em telhado, folha, poça e vidro.
 *
 * ⚠️ A amplitude ao quadrado, e não ao cubo. Ao cubo (`0,06 + u³·1,1`) a gota
 * mais forte sai 19× a mediana, e como o arquivo é normalizado PELO PICO essa
 * única gota define o volume de tudo: medido, o fator de crista foi a 36 e o
 * RMS caiu de 0,134 para 0,025 — um som cinco vezes mais baixo num iPhone, onde
 * a página não controla volume nenhum. Ao quadrado a razão fica em 4.
 */
export function gota(
  ctx: Contexto,
  saida: AudioNode,
  fonte: AudioBuffer,
  t: number,
  r: () => number,
  op: {
    fLo?: number;
    fHi?: number;
    qLo?: number;
    qHi?: number;
    durLo?: number;
    durHi?: number;
    forca?: number;
  } = {},
) {
  const fLo = op.fLo ?? 700;
  const fHi = op.fHi ?? 6000;
  const qLo = op.qLo ?? 3;
  const qHi = op.qHi ?? 9;
  const durLo = op.durLo ?? 0.025;
  const durHi = op.durHi ?? 0.07;
  const forca = op.forca ?? 1;

  const src = ctx.createBufferSource();
  src.buffer = fonte;
  const inicio = r() * Math.max(0.001, fonte.duration - 0.2);
  const dur = durLo + r() * (durHi - durLo);

  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  /* Log-uniforme, e não uniforme: o ouvido ouve altura em razão, então uniforme
     em hertz concentraria quase todas as gotas no agudo. */
  bp.frequency.value = fLo * Math.pow(fHi / fLo, r());
  bp.Q.value = qLo + r() * (qHi - qLo);

  const g = ctx.createGain();
  const u = r();
  const pico = (0.25 + u * u * 0.75) * forca;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pico, t + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  src.connect(bp).connect(g).connect(saida);
  src.start(t, inicio, dur + 0.02);
  src.stop(t + dur + 0.03);
}

/**
 * Uma BOLHA — e é ela que separa riacho de chuva.
 *
 * Água correndo entranha ar, e cada bolha toca uma senoide amortecida na
 * frequência de Minnaert: `f · d ≈ 3,26 m·Hz`, com d o diâmetro. Uma bolha de
 * 1 mm dá 3260 Hz; de 3 mm, 1087 Hz; de 6 mm, 543 Hz.
 *
 * ⚠️ **A frequência SOBE durante o toque** — a bolha encolhe. Sem esse
 * deslizamento ascendente soa como um sino minúsculo; com ele, soa como água.
 * É a diferença inteira entre a receita funcionar e não funcionar.
 */
export function bolha(ctx: Contexto, saida: AudioNode, t: number, r: () => number, forca = 1) {
  const f0 = 500 * Math.pow(7, r());
  const tau = 0.004 + r() * 0.01;
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f0 * 1.08, t + tau);
  const g = ctx.createGain();
  /* Bolha grande soa mais alta: a amplitude cai com a raiz da frequência. */
  const a = 0.25 * Math.sqrt(1200 / f0) * forca;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(a, t + 0.0008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + tau);
  o.connect(g).connect(saida);
  o.start(t);
  o.stop(t + tau + 0.02);
}

/** Compensação do passa-faixa. Acertada na bancada. */
const GANHO_ESTALO = 1.8;

/**
 * Um ESTALO de fogo. Duas classes, e a diferença entre elas é o que faz lenha.
 *
 * • **tique** — 1800 a 6000 Hz, Q alto, 3 a 8 ms, fraco. É a madeira rachando.
 * • **estouro** — 250 a 900 Hz, Q baixo, 25 a 70 ms, forte, com um clique
 *   agudo por cima. É a bolha de resina explodindo.
 */
export function estalo(
  ctx: Contexto,
  saida: AudioNode,
  fonte: AudioBuffer,
  t: number,
  r: () => number,
  grande: boolean,
) {
  const fLo = grande ? 250 : 1800;
  const fHi = grande ? 900 : 6000;
  const q = grande ? 3 + r() * 3 : 8 + r() * 12;
  const dur = grande ? 0.025 + r() * 0.045 : 0.003 + r() * 0.005;
  /**
   * ⚠️ `GANHO_ESTALO` existe pela mesma razão que `GANHO_GOTA`: o que passa pelo
   * nó de ganho é ruído já cortado por um passa-faixa de Q entre 3 e 20, e um
   * passa-faixa estreito entrega uma fração pequena da energia. Sem a
   * compensação, a cama do fogo domina e os estalos viram um chiado com
   * cliquezinhos — que é o defeito que a chuva teve por meses.
   */
  const amp = (grande ? 0.7 + r() * 0.3 : 0.15 + r() * 0.25) * GANHO_ESTALO;

  const src = ctx.createBufferSource();
  src.buffer = fonte;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = fLo * Math.pow(fHi / fLo, r());
  bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(amp, t + 0.0008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(saida);
  src.start(t, r() * Math.max(0.001, fonte.duration - 0.2), dur + 0.02);
  src.stop(t + dur + 0.03);
}

/**
 * Uma SÍLABA de canto de pássaro.
 *
 * ⚠️ **A tese que faz isto ser possível sem amostra:** canto de pássaro é
 * essencialmente um TOM PURO com trajetória de frequência. O modelo de
 * Gardner–Mindlin (massa labial, tensão, pressão do saco aéreo) produz uma
 * oscilação praticamente senoidal. **Quem acrescenta ruído erra** — é por isso
 * que quase toda síntese de pássaro sem amostra soa como brinquedo.
 *
 * ⚠️ E a rampa é EXPONENCIAL em hertz, que é linear em cents. Rampa linear em
 * hertz soa como sirene.
 *
 * ⚠️ O ataque tem de ficar entre 5 e 20 ms: abaixo clica, acima vira flauta.
 */
export function silaba(
  ctx: Contexto,
  saida: AudioNode,
  t: number,
  r: () => number,
  op: {
    dur: number;
    f0: number;
    f1: number;
    traj: "sobe" | "desce" | "chevron" | "trinado";
    amp?: number;
  },
) {
  const { dur, f0, f1, traj } = op;
  const amp = op.amp ?? 1;
  const o = ctx.createOscillator();
  o.type = "sine";
  const h2 = ctx.createOscillator();
  h2.type = "sine";

  const f = o.frequency;
  const f2 = h2.frequency;

  if (traj === "trinado") {
    /* FM de 15 a 35 Hz, escrita por amostragem: `OscillatorNode` não aceita um
       segundo oscilador em `frequency` com fase controlada de forma que feche o
       laço, e o trinado é curto o bastante para 40 pontos bastarem. */
    const taxa = 15 + r() * 20;
    const prof = 0.15 + r() * 0.15;
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      const v = f0 * (1 + prof * Math.sin(2 * Math.PI * taxa * u * dur));
      f.setValueAtTime(v, t + u * dur);
      f2.setValueAtTime(v * 2, t + u * dur);
    }
  } else if (traj === "chevron") {
    const apice = 0.55 + r() * 0.1;
    f.setValueAtTime(f0, t);
    f.exponentialRampToValueAtTime(f1, t + dur * apice);
    f.exponentialRampToValueAtTime(f0 * 0.92, t + dur);
    f2.setValueAtTime(f0 * 2, t);
    f2.exponentialRampToValueAtTime(f1 * 2, t + dur * apice);
    f2.exponentialRampToValueAtTime(f0 * 1.84, t + dur);
  } else {
    f.setValueAtTime(f0, t);
    f.exponentialRampToValueAtTime(f1, t + dur);
    f2.setValueAtTime(f0 * 2, t);
    f2.exponentialRampToValueAtTime(f1 * 2, t + dur);
  }

  const g = ctx.createGain();
  const g2 = ctx.createGain();
  /* 2º harmônico a −20 dB. Mais que isso deixa de ser pássaro. */
  g2.gain.value = 0.1;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(amp, t + 0.006);
  g.gain.setValueAtTime(amp, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  /* O trato vocal: um formante em 1,6× a média, e um corte grave que tira o
     peso — pássaro não tem grave. */
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = ((f0 + f1) / 2) * 1.6;
  bp.Q.value = 3;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1200;

  o.connect(g);
  h2.connect(g2).connect(g);
  g.connect(bp).connect(hp).connect(saida);
  o.start(t);
  o.stop(t + dur + 0.02);
  h2.start(t);
  h2.stop(t + dur + 0.02);
}

/* ═══════════════════════ Modos inarmônicos ═════════════════════════════════ */

/**
 * As razões modais MEDIDAS de tigelas tibetanas antigas — quatro tigelas,
 * medidas por Inácio e por Bush.
 *
 * ⚠️ **Use as medidas, não a fórmula.** O anel livre ideal daria
 * `1 : 2,828 : 5,423 : 8,767 : 12,86`, e tigelas reais ficam ligeiramente
 * ABAIXO disso porque o bojo tem espessura variável. A diferença é audível: com
 * as razões ideais o som fica metálico de sino de igreja, e não de tigela.
 */
export const MODOS_TIGELA = [1, 2.756, 5.017, 8.2, 12.3];
export const AMPS_TIGELA = [1, 0.45, 0.22, 0.1, 0.05];
/** T60 do modo fundamental. Os outros seguem `T60(n) ≈ T60(1) · n^(−0,7)`. */
export const T60_TIGELA = 45;

/**
 * ⚠️ O RESÍDUO — é ele que faz um sino caber num laço de 30 s.
 *
 * Um modo `A·e^(−t/τ)·sin(2πft)` percutido a cada `P` segundos tem estado
 * estacionário com forma fechada: a cauda da volta anterior ainda está soando
 * quando a próxima bate. Renderizando UM golpe com amplitude inicial
 * `A · resíduo`, o que sobra da cauda além do laço é exatamente o que a volta
 * seguinte reinjeta — e a emenda fica matematicamente exata.
 *
 *     resíduo = 1 / (1 − e^(−P/τ)),  com τ = T60 / 6,908
 *
 * Para T60 = 45 s e P = 30 s: τ = 6,51 s, resíduo = 1,0100. Um por cento a
 * mais, imperceptível, e o "tec" some.
 */
export function residuoDoLaco(t60: number, periodo = LACO): number {
  const tau = t60 / 6.908;
  return 1 / (1 - Math.exp(-periodo / tau));
}

/**
 * Uma TIGELA batida.
 *
 * ⚠️ **O batimento é a assinatura.** A assimetria da tigela desdobra cada modo
 * num PAR separado por alguns hertz, e cada membro tem amplitude igual — o que
 * dá modulação de 100%, a ondulação lenta que se reconhece de imediato como
 * tigela. `Δf_n = Δf₁ · √(f_n / f₁)`.
 *
 * ⚠️ **Osciladores, nunca biquad de Q altíssimo.** Com T60 acima de 5 s um
 * ressonador pediria Q maior que 300, e a transformada bilinear do Web Audio
 * fica instável a 22050 Hz.
 *
 * ⚠️ **E o GOLPE não é enfeite**: sem os poucos milissegundos de ruído no
 * ataque, o tom "aparece" em vez de ser batido.
 */
export function tigela(
  ctx: Contexto,
  saida: AudioNode,
  t: number,
  f0: number,
  op: { golpe?: AudioBuffer; esfregada?: boolean; forca?: number; delta?: number } = {},
) {
  const forca = op.forca ?? 1;
  const delta = op.delta ?? 1.3;
  MODOS_TIGELA.forEach((rz, n) => {
    const f = noLaco(f0 * rz);
    const t60 = T60_TIGELA * Math.pow(n + 1, -0.7);
    const df = noLaco(delta * Math.sqrt(rz));
    /* Esfregada é outra coisa: a fricção do bastão trava no modo fundamental
       (mode lock-in), então quase só ele soa, e sem golpe. */
    const amp = op.esfregada ? (n === 0 ? 1 : n === 1 ? 0.08 : 0) : AMPS_TIGELA[n];
    if (amp === 0) return;
    const inicial = amp * 0.5 * forca * residuoDoLaco(t60);
    for (const fx of [noLaco(f - df / 2), noLaco(f + df / 2)]) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = fx;
      const g = ctx.createGain();
      if (op.esfregada) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(inicial, t + 3);
        g.gain.exponentialRampToValueAtTime(inicial * 1e-4, t + 3 + t60);
      } else {
        g.gain.setValueAtTime(inicial, t);
        g.gain.exponentialRampToValueAtTime(inicial * 1e-4, t + t60);
      }
      o.connect(g).connect(saida);
      o.start(t);
      o.stop(t + t60 + (op.esfregada ? 3.05 : 0.05));
    }
  });

  if (op.golpe && !op.esfregada) {
    const src = ctx.createBufferSource();
    src.buffer = op.golpe;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = noLaco(3500);
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3 * forca, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
    src.connect(bp).connect(g).connect(saida);
    src.start(t, 0.1, 0.05);
    src.stop(t + 0.06);
  }
}
