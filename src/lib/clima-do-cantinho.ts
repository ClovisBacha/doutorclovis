/**
 * NO AR — o tipo de item que não é adesivo.
 *
 * ─── O PEDIDO ───────────────────────────────────────────────────────────────
 *
 * Palavras do dono: "veja se conseguimos criar um outro tipo de item".
 *
 * ─── POR QUE ESTE TIPO, E NÃO OUTRO ─────────────────────────────────────────
 *
 * `cantinho.ts` já tinha a régua escrita: **um tipo só existe se tiver
 * comportamento próprio** — "um tipo que se comporta igual a `objeto` seria só
 * um rótulo a mais na loja". Foi assim que Luzes (piscam) e Águas (boiam)
 * nasceram.
 *
 * Só que os dez tipos existentes são todos a mesma coisa por baixo: uma figura
 * POUSADA num ponto (x, y) da trilha, com uma animação de dois segundos em
 * volta dela. O que faltava não era mais um adesivo — era o AR.
 *
 * Um item de `clima` não tem lugar. Enquanto ele estiver no cantinho, a tela
 * inteira ganha o que ele traz: pétalas descendo, folhas girando, bolhas
 * subindo. É a primeira coisa da loja que muda o AMBIENTE em vez de decorar
 * um canto dele.
 *
 * ⚠️ E resolveu de quebra o que travava a ampliação. As categorias de adesivo
 * estão saturadas de emoji: não existe uma sexta "luz" reconhecível a 24px que
 * não seja 🔥 (a chama da sequência), ⭐ (a estrela do dia) ou 💡 (o "Você
 * sabia?" da aula) — três ícones da própria interface. O ar estava vazio, e
 * pétala, folha, bolha, peninha, neve e poeira de estrela são justamente os
 * desenhos que fazem PÉSSIMO adesivo (uma pétala parada num canto não é nada)
 * e ótimo ambiente.
 *
 * ─── ⚠️ O QUE ISTO NÃO FAZ, E POR QUÊ ───────────────────────────────────────
 *
 *  1. **Não é `fundo`.** O cenário se equipa: um de cada vez, gravado numa
 *     coluna do banco. O clima é possuído como qualquer enfeite — está no
 *     cantinho, então está no ar. Dois climas ao mesmo tempo é decisão DELA
 *     (pétala com bolha é bonito), e o teto de `CLIMAS_NA_TELA` existe só para
 *     que dez itens não virem uma tempestade.
 *
 *  2. **Não pisca nem se move rápido.** Toda partícula atravessa a tela em
 *     9 a 16 segundos. É enfeite de fundo numa tela que a paciente usa para
 *     ler a aula do dia — movimento rápido atrás de texto é o que faz alguém
 *     fechar o app.
 *
 *  3. **Nada disto anima com `prefers-reduced-motion`.** Quem pediu menos
 *     movimento continua vendo a partícula no lugar, parada: apagá-la faria a
 *     paciente achar que o item que ela comprou não veio.
 *
 * ─── ⚠️ A CONTA DE PARTÍCULAS É O CUSTO, E ELA É FIXA ───────────────────────
 *
 * Cada partícula é um `<span>` animado por CSS. `PARTICULAS_POR_CLIMA` é 14 e
 * `CLIMAS_NA_TELA` é 3 — teto de 42 elementos, e nunca mais que isso por mais
 * itens que ela compre. A trilha já desenha até `DECOR_MAX` enfeites, e este
 * arquivo não pode ser o que faz a rolagem engasgar num celular de entrada.
 */

/** Um item de `clima` — o que ele põe no ar. */
export type ClimaSpec = {
  /** O desenho de cada partícula (pode não ser o emoji do tile da loja). */
  particula: string;
  /**
   * De onde vem e para onde vai.
   *  - `cai`   → nasce acima do topo e desce (pétala, folha, neve)
   *  - `sobe`  → nasce abaixo do rodapé e sobe (bolha, poeira de estrela)
   */
  sentido: "cai" | "sobe";
  /** Segundos que uma partícula leva para atravessar. Mínimo e máximo. */
  duracao: [number, number];
  /** Tamanho da partícula em rem. Mínimo e máximo. */
  tamanho: [number, number];
  /** Opacidade máxima. Neve é quase sólida; poeira é fantasma. */
  opacidade: number;
  /** Graus que a partícula gira durante a travessia (0 = não gira). */
  giro: number;
  /** Deslocamento lateral, em % da largura, ao longo da travessia. */
  deriva: number;
};

/**
 * ⚠️ A CHAVE NÃO É SÓ O ITEM DE `clima`.
 *
 * `especial-chuva` ("Chuva mansa", 200 🌱) e `especial-vagalume`
 * ("Vaga-lumes no pote", 220 🌱) vendiam um comportamento que o código não
 * tinha: eram uma nuvem e uma varinha PARADAS. Em vez de aposentar os dois,
 * eles passaram a usar este mesmo motor — o nome deles finalmente descreve o
 * que acontece na tela.
 *
 * Por isso o mapa é por ID de item, e não por tipo: os dois continuam sendo
 * `especial` na loja (com halo, tamanho grande e o preço que já tinham), e
 * ganham o ar de brinde.
 */
export const CLIMA_POR_ITEM: Record<string, ClimaSpec> = {
  "clima-petalas": {
    particula: "🌸",
    sentido: "cai",
    duracao: [11, 16],
    tamanho: [0.7, 1.1],
    opacidade: 0.85,
    giro: 320,
    deriva: 14,
  },
  "clima-folhas": {
    particula: "🍂",
    sentido: "cai",
    duracao: [10, 15],
    tamanho: [0.8, 1.2],
    opacidade: 0.9,
    giro: 420,
    deriva: 18,
  },
  "clima-bolhas": {
    particula: "🫧",
    sentido: "sobe",
    duracao: [12, 16],
    tamanho: [0.6, 1.3],
    opacidade: 0.75,
    giro: 0,
    deriva: 10,
  },
  "clima-peninhas": {
    particula: "🪶",
    sentido: "cai",
    /* A mais lenta de todas: pena que desce rápido não é pena, é pedra. */
    duracao: [14, 16],
    tamanho: [0.7, 1.0],
    opacidade: 0.8,
    giro: 260,
    deriva: 22,
  },
  "clima-neve": {
    particula: "❄️",
    sentido: "cai",
    duracao: [12, 16],
    tamanho: [0.5, 0.9],
    opacidade: 0.95,
    giro: 180,
    deriva: 12,
  },
  "clima-poeira": {
    particula: "✨",
    sentido: "sobe",
    duracao: [9, 14],
    tamanho: [0.5, 0.9],
    opacidade: 0.7,
    giro: 0,
    deriva: 8,
  },
  /* Os dois consertos. Chuva cai reta e rápida — gota que plana não é gota. */
  "especial-chuva": {
    particula: "💧",
    sentido: "cai",
    duracao: [9, 12],
    tamanho: [0.5, 0.8],
    opacidade: 0.6,
    giro: 0,
    deriva: 4,
  },
  "especial-vagalume": {
    particula: "✨",
    sentido: "sobe",
    duracao: [13, 16],
    tamanho: [0.45, 0.75],
    opacidade: 0.85,
    giro: 0,
    deriva: 26,
  },
};

/** Quantas partículas cada clima põe na tela. Ver o cabeçalho: é o custo. */
export const PARTICULAS_POR_CLIMA = 14;

/**
 * Quantos climas desenham ao mesmo tempo.
 *
 * ⚠️ Três, e não "todos os que ela tiver". Com os oito, seriam 112 elementos
 * animados atrás do texto da aula — e visualmente vira granizo, não enfeite.
 * O teto é do MOTOR; a loja continua vendendo os oito, e ela continua podendo
 * ter todos (ver `climasAtivos`, que escolhe quais entram).
 */
export const CLIMAS_NA_TELA = 3;

export function ehClima(itemId: string): boolean {
  return itemId in CLIMA_POR_ITEM;
}

/**
 * Quais climas estão no ar, dados os itens que ela colocou na trilha.
 *
 * ⚠️ A ordem de entrada MANDA, e a fonte é a trilha (não o catálogo): assim o
 * que fica de fora do teto é o que ela colocou por último, que é a única regra
 * que ela consegue prever. Ordenar por preço ou por id faria um item novo
 * expulsar, sem aviso, o clima que ela já via ontem.
 *
 * Duplicatas somem: o mesmo item posto duas vezes na trilha é um desenho a
 * mais, nunca o dobro de pétalas.
 */
export function climasAtivos(idsNaTrilha: readonly string[]): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const id of idsNaTrilha) {
    if (!ehClima(id) || vistos.has(id)) continue;
    vistos.add(id);
    out.push(id);
    if (out.length >= CLIMAS_NA_TELA) break;
  }
  return out;
}

/** Uma partícula, já com tudo resolvido — a tela só posiciona e anima. */
export type Particula = {
  /** Chave de React. Estável entre renders: nasce do id e do índice. */
  k: string;
  emoji: string;
  /** % da largura onde ela nasce. */
  esquerda: number;
  /** Segundos até completar a travessia. */
  duracao: number;
  /** Segundos de espera antes de começar — é o que espalha a chuva no tempo. */
  atraso: number;
  /** rem. */
  tamanho: number;
  opacidade: number;
  giro: number;
  deriva: number;
  sentido: "cai" | "sobe";
};

/**
 * Mistura determinística — a MESMA de `seedDecor` e das estrelas do céu.
 *
 * ⚠️ `Math.random()` daria mismatch de hidratação: o servidor renderiza uma
 * posição e o cliente outra, e o React reclama no console de todo mundo. E
 * daria uma chuva diferente a cada abertura, que é ruído sem ganho nenhum.
 */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Devolve `min..max` a partir do hash, sem `Math.random`. */
function entre(h: number, min: number, max: number): number {
  return min + ((h % 1000) / 1000) * (max - min);
}

/**
 * As partículas de um clima. Puro: mesma entrada, mesma saída — é o que
 * permite testar a chuva sem abrir navegador.
 */
export function particulasDe(itemId: string): Particula[] {
  const spec = CLIMA_POR_ITEM[itemId];
  if (!spec) return [];
  const out: Particula[] = [];
  for (let i = 0; i < PARTICULAS_POR_CLIMA; i++) {
    const h = hash(`${itemId}#${i}`);
    const dur = entre(h, spec.duracao[0], spec.duracao[1]);
    out.push({
      k: `${itemId}-${i}`,
      emoji: spec.particula,
      esquerda: entre(h >>> 3, 2, 96),
      duracao: Number(dur.toFixed(2)),
      /* ⚠️ O atraso vai até a duração INTEIRA, e não a um número fixo de
         segundos: é o que faz a chuva já estar caindo quando a tela abre. Com
         atraso curto, as catorze pétalas entram juntas nos primeiros segundos
         e depois a tela fica vazia até a próxima volta. */
      atraso: Number((-entre(h >>> 7, 0, dur)).toFixed(2)),
      tamanho: Number(entre(h >>> 11, spec.tamanho[0], spec.tamanho[1]).toFixed(2)),
      opacidade: spec.opacidade,
      /* Metade gira para cada lado — todas girando no mesmo sentido lê como
         uma engrenagem, não como vento. */
      giro: i % 2 === 0 ? spec.giro : -spec.giro,
      deriva: i % 2 === 0 ? spec.deriva : -spec.deriva,
      sentido: spec.sentido,
    });
  }
  return out;
}
