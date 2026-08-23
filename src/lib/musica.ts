/**
 * A MÚSICA — a régua. O app não tinha nenhuma.
 *
 * Havia vinte sons ambientes, 191 falas gravadas e um pad de quatro vozes. Não
 * havia MÚSICA: nada com nota escolhida, harmonia, arco ou fim. O dono pediu
 * "as melhores músicas" e pediu que dez minutos de sessão tivessem dez minutos
 * de som — que é exatamente o que um motor generativo resolve por construção, e
 * um arquivo gravado não resolve nunca.
 *
 * ⚠️ Aqui não há JSX nem Web Audio: é régua pura e testada. O grafo mora em
 * `musica-audio.ts`. É a mesma separação de `gratidao.ts`, `frases-do-mascote.ts`
 * e `assinatura.ts` — e ela custou uma volta em cada um daqueles antes de virar
 * hábito.
 *
 * ─── ⚠️ A ESCALA NÃO É GOSTO: É UM TEOREMA ──────────────────────────────────
 *
 * Numa geração aleatória não há revisão humana entre o sorteio e o ouvido da
 * paciente. A escala é a única coisa que impede duas notas dissonantes de
 * caírem juntas. E a pergunta "qual escala é segura para sobreposição livre?"
 * tem resposta fechada:
 *
 *     Proibir distância circular 1 (segunda menor) e 6 (trítono) é pedir um
 *     conjunto independente no grafo circulante C₁₂(1,6). Em Z₁₂ os únicos
 *     independentes de tamanho 6 são os dois alternados — {0,2,4,6,8,10} e os
 *     ímpares — e AMBOS contêm pares antípodas, ou seja trítonos. Logo o
 *     máximo é CINCO.
 *
 * **Nenhuma escala de seis ou mais notas em temperamento igual é segura para
 * sobreposição livre.** Escolher pentatônica não é preferência estética: é a
 * única família que existe. `musica.test.ts` varre os 4096 subconjuntos de Z₁₂
 * e prova isso — se um dia alguém quiser "só mais uma nota", o teste responde.
 *
 * ─── E A EMOÇÃO VEM DE ONDE, SE O CONJUNTO NÃO MUDA? ────────────────────────
 *
 * Da ROTAÇÃO DO DRONE. Um conjunto só — lá · dó · ré · mi · sol — dá cinco
 * cores conforme onde o drone pousa, e todas seguras por construção, porque o
 * conjunto de notas nunca muda.
 */

import { nota, semDissonancia, type Nota } from "./afinacao";
import { CICLO, JANELAS } from "./meditacao-sessao";
import type { Momento } from "./meditacao-roteiros";

/* ═══════════════════════ A escala, e as cinco cores ════════════════════════ */

/** O conjunto, em semitons a partir do lá. É o mesmo a sessão inteira. */
export const PENTATONICA: readonly number[] = [0, 3, 5, 7, 10];

/** As notas, na ordem em que o drone pode pousar. */
export const NOTAS_DA_ESCALA: readonly Nota[] = ["la", "do", "re", "mi", "sol"];

export type Cor = {
  drone: Nota;
  oitava: number;
  /** O que essa cor faz — para quem for mexer, não para a tela. */
  sensacao: string;
  /** ⚠️ Nem toda cor pode aparecer no Modo Cuidado. */
  noLuto: boolean;
};

/**
 * ⚠️ AS CINCO CORES, E POR QUE UMA DELAS NUNCA APARECE NO MODO CUIDADO.
 *
 * Trocar o drone de lugar dentro do MESMO conjunto muda o acorde implícito sem
 * mudar uma nota: sobre lá o conjunto lê como Am7add11 (recolhido); sobre ré,
 * como Dm7add9 (neutro, flutuante); sobre dó, C6/9 (luminoso).
 *
 * **Sobre mi o conjunto vira Em7add11, que é a cor mais escura das cinco** — e
 * é a única barrada no Modo Cuidado. Não é superstição: o Modo Cuidado existe
 * para quem acabou de perder a gestação, e a diferença entre "recolhido" e
 * "escuro" é a diferença entre acolher e afirmar a perda. A régua do luto mora
 * em `humorDaJornada` para a personagem; aqui ela mora neste campo, e o teste
 * cobra que o luto nunca receba `mi`.
 */
export const CORES: Record<Momento, Cor> = {
  acolhimento: { drone: "la", oitava: 3, sensacao: "recolhido, íntimo", noLuto: true },
  ancoragem: { drone: "re", oitava: 3, sensacao: "neutro, flutuante", noLuto: true },
  corpo: { drone: "re", oitava: 3, sensacao: "neutro, flutuante", noLuto: true },
  silencio: { drone: "la", oitava: 2, sensacao: "recolhido, grave", noLuto: true },
  volta: { drone: "la", oitava: 3, sensacao: "recolhido, íntimo", noLuto: true },
  /* ⚠️ `fechamento` existe no tipo `Momento` e NÃO existe em `JANELAS` — as
     falas de fechamento entram dentro da janela `volta`. Ele está aqui só para
     o mapa ser total (o compilador cobra), e `arcoDaMusica` nunca chega nele.
     Igual a `volta` de propósito: se um dia virar janela própria, herda o certo
     em vez de um valor inventado. */
  fechamento: { drone: "la", oitava: 3, sensacao: "recolhido, íntimo", noLuto: true },
};

/* ═══════════════════════ As seis vozes ═════════════════════════════════════ */

export type Voz = {
  /** O período, em segundos. É a identidade da voz. */
  periodo: number;
  ganho: number;
  /** Os dois graus da escala que ela toca, em semitons a partir do lá. */
  graus: [number, number];
  oitava: number;
};

/**
 * ⚠️ SEIS PERÍODOS PRIMOS, E ISSO É O MECANISMO INTEIRO.
 *
 * É o desenho do Eno em *Music for Airports*: laços de comprimentos
 * incomensuráveis, cada um carregando UMA nota, que nunca voltam a sincronizar.
 * A periodicidade individual é inaudível como melodia; o que se ouve é a nuvem
 * se recombinando.
 *
 * Com 19 · 23 · 29 · 31 · 37 · 41, o mínimo múltiplo comum é 595.973.171
 * segundos — **dezoito anos e onze meses**. A constelação não se repete dentro
 * de uma sessão, nem dentro de uma gestação, nem dentro da vida do app.
 *
 * ⚠️ **17 FOI DESCARTADO DE PROPÓSITO**, e a razão é o compasso. A respiração
 * tem ciclo de 16 s; 17 contra 16 deriva um segundo por respiração e atravessa
 * o ciclo inteiro em 16 respirações — uma varredura lenta que o ouvido PEGA, e
 * que soaria como um erro de sincronia. O menor primo que serve é 19.
 *
 * ⚠️ **O GANHO É PROPORCIONAL AO PERÍODO**: quem fala mais, fala mais baixo.
 * Sem isso a voz de 19 s domina e a peça vira um ostinato — o defeito clássico
 * de música generativa amadora.
 *
 * ⚠️ **E O REGISTRO É INVERSO**: as rápidas ficam no meio, nunca no topo.
 * Grave é chão, agudo é incidente — agudo repetido a cada 19 s vira alarme.
 */
export const VOZES: Voz[] = [
  { periodo: 41, ganho: 0.25, graus: [0, 5], oitava: 3 },
  { periodo: 37, ganho: 0.226, graus: [7, 10], oitava: 3 },
  { periodo: 31, ganho: 0.189, graus: [0, 3], oitava: 4 },
  { periodo: 29, ganho: 0.177, graus: [5, 7], oitava: 4 },
  { periodo: 23, ganho: 0.14, graus: [10, 0], oitava: 3 },
  { periodo: 19, ganho: 0.116, graus: [3, 5], oitava: 4 },
];

/* ═══════════════════════ O arco ════════════════════════════════════════════ */

export type Trecho = {
  momento: Momento;
  /** Em segundos, a partir do começo da sessão. */
  de: number;
  ate: number;
  /** Quais vozes tocam aqui (índices em `VOZES`). */
  vozes: number[];
  /** Cauda do reverb, em segundos. */
  rt60: number;
  /** Ataque do sino, em segundos. */
  ataque: number;
  cor: Cor;
};

/**
 * ⚠️ QUAIS VOZES TOCAM EM CADA JANELA — e três princípios nos números.
 *
 * 1. **A densidade pica no CORPO; a amplitude pica na ANCORAGEM.** Se as duas
 *    picassem juntas, o corpo viraria clímax — e clímax é ativação, que é o
 *    oposto do trabalho desta tela.
 * 2. **O silêncio é o mais esparso E o mais reverberante.** Cauda de 9 s com
 *    duas vozes lentas. Sem o reverb longo, "esparso" lê como ABANDONADA; com
 *    ele, lê como espaço.
 * 3. **A volta ACRESCENTA massa** (três vozes contra duas) e devolve o drone
 *    ao lá do começo. Terminar onde começou é o que faz a sessão FECHAR em vez
 *    de simplesmente acabar.
 */
const VOZES_POR_MOMENTO: Record<Momento, number[]> = {
  acolhimento: [0, 1],
  ancoragem: [0, 1, 2, 3],
  corpo: [0, 1, 2, 3, 4, 5],
  silencio: [0, 1],
  volta: [1, 3, 4],
  fechamento: [1, 3, 4],
};

const RT60_POR_MOMENTO: Record<Momento, number> = {
  acolhimento: 4,
  ancoragem: 5.5,
  corpo: 6,
  silencio: 9,
  volta: 5,
  fechamento: 5,
};

const ATAQUE_POR_MOMENTO: Record<Momento, number> = {
  acolhimento: 0.45,
  ancoragem: 0.3,
  corpo: 0.18,
  silencio: 0.8,
  volta: 0.35,
  fechamento: 0.35,
};

/**
 * O arco da peça, em segundos, a partir do número de CICLOS.
 *
 * ⚠️ Parametrizado por ciclos e nunca por minutos, e herdando `JANELAS` da
 * sessão: é isso que faz a música e a voz descreverem o MESMO arco. Duas
 * tabelas de fração fariam o silêncio musical cair num instante e o silêncio da
 * voz noutro — e a sessão passaria a soar como trilha acompanhando a fala em
 * vez de composta com ela.
 *
 * E é também o que garante "dez minutos de sessão, dez minutos de música" sem
 * nenhum arquivo: a peça é construída para a duração pedida.
 */
export function arcoDaMusica(totalCiclos: number, luto = false): Trecho[] {
  const total = totalCiclos * CICLO;
  const out: Trecho[] = [];
  let de = 0;
  for (const j of JANELAS) {
    const ate = Math.round(total * j.ate);
    if (ate <= de) continue;
    const cor = CORES[j.momento];
    out.push({
      momento: j.momento,
      de,
      ate,
      vozes: VOZES_POR_MOMENTO[j.momento],
      rt60: RT60_POR_MOMENTO[j.momento],
      ataque: ATAQUE_POR_MOMENTO[j.momento],
      /* No Modo Cuidado a cor nunca desce para a mais escura — ver `CORES`. */
      cor: luto && !cor.noLuto ? CORES.acolhimento : cor,
    });
    de = ate;
  }
  return out;
}

/* ═══════════════════════ Onde cada nota cai ════════════════════════════════ */

export type Evento = { t: number; hz: number; ganho: number; voz: number };

/**
 * ⚠️ O VIÉS É 0,62 / 0,38, NUNCA 50/50.
 *
 * Cada voz tem duas notas, e sortear meio a meio faz o ouvido ouvir
 * ALTERNÂNCIA — que é padrão, e padrão é o que este motor existe para não ter.
 * Um viés desigual mantém as duas reconhecíveis sem virar A-B-A-B.
 */
const VIES = 0.62;

/**
 * ⚠️ E O JITTER É DE ±0,8 s. O bastante para desmanchar a grade; pouco o
 * bastante para a identidade do período sobreviver — é ela que dá SENTIDO à
 * peça, e sem sentido a geração aleatória soa como aleatório.
 */
const JITTER = 0.8;

/**
 * Os eventos de um trecho.
 *
 * ⚠️ O PORTÃO DE AGENDAMENTO é a primeira das três travas contra "cortar no
 * meio de uma frase": uma voz só dispara se o envelope INTEIRO couber antes do
 * fim — ataque, sustentação, queda e a cauda do reverb. Com isso o último sino
 * cai naturalmente uns treze segundos antes do fim e o drone termina sozinho.
 * Isso não é um recurso a mais: é o final, e custa zero.
 */
export function eventosDoTrecho(
  trecho: Trecho,
  r: () => number,
  tFim: number,
  queda = 8,
): Evento[] {
  const out: Evento[] = [];
  const base = trecho.cor;
  for (const i of trecho.vozes) {
    const v = VOZES[i];
    const primeiro = Math.ceil(trecho.de / v.periodo) * v.periodo;
    for (let t = primeiro; t < trecho.ate; t += v.periodo) {
      const quando = t + (r() * 2 - 1) * JITTER;
      if (quando < trecho.de) continue;
      /* O envelope inteiro tem de caber — inclusive a cauda do reverb. */
      if (quando + trecho.ataque + queda + trecho.rt60 > tFim) continue;
      const grau = r() < VIES ? v.graus[0] : v.graus[1];
      out.push({
        t: quando,
        hz: hzDoGrau(base.drone, base.oitava, grau, v.oitava - 3),
        ganho: v.ganho,
        voz: i,
      });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/** A frequência de um grau da escala, a partir da nota em que o drone pousa. */
export function hzDoGrau(
  droneNota: Nota,
  droneOitava: number,
  grau: number,
  deslocaOitava = 0,
): number {
  const base = nota(droneNota, droneOitava + deslocaOitava);
  return base * Math.pow(2, grau / 12);
}

/* ═══════════════════════ A segunda régua: aspereza em hertz ════════════════ */

/**
 * ⚠️ `semDissonancia` OLHA CLASSE DE ALTURA, E ISSO NÃO BASTA.
 *
 * Aspereza sensorial depende da distância em HERTZ, não em semitons: ré4 com
 * mi5 são catorze semitons e soam limpos; ré4 com mi4 são dois semitons, 35,6
 * Hz de distância a 306 Hz, e ASPERAM. As duas duplas têm exatamente as mesmas
 * classes de altura.
 *
 * A banda crítica de Zwicker dá o número: dois parciais simultâneos são ásperos
 * quando a distância entre eles é menor que ~35% da banda crítica na média
 * deles. É por isso que as vozes graves ficam em oitavas separadas e por que
 * nenhum timbre passa do sexto parcial.
 */
export function bandaCritica(f: number): number {
  return 25 + 75 * Math.pow(1 + 1.4 * (f / 1000) ** 2, 0.69);
}

export function aspero(f1: number, f2: number): boolean {
  if (f1 === f2) return false;
  return Math.abs(f1 - f2) < 0.35 * bandaCritica((f1 + f2) / 2);
}

/** A escala escolhida é segura para sobreposição — a prova mora no teste. */
export function escalaSegura(): boolean {
  return semDissonancia(PENTATONICA);
}
