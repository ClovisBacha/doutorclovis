/**
 * O QUE O BEBÊ BOLHA DIZ — a régua, longe do JSX.
 *
 * Ela mora aqui e não no componente por dois motivos. O primeiro é o de sempre
 * neste repositório: `mascote-da-home.tsx` importa `bolha.tsx`, que importa
 * cinco `.webp`, e um teste que importasse isso morreria no primeiro `import`.
 *
 * O segundo é o que interessa: esta régua vai crescer. Hoje ela decide entre
 * "tenho recado" e silêncio; quando o tutorial do primeiro acesso existir, ela
 * vai decidir entre ensinar, avisar e calar — e essa é uma decisão de produto
 * que precisa de teste, não de leitura de JSX.
 */

export type FalaDoMascote = {
  /** O que ele diz. Uma ou duas linhas — o balão não é uma tela. */
  texto: string;
  /** Rótulo do toque, para leitor de tela. */
  aria: string;
  /**
   * O que o toque no BALÃO faz, quando a fala promete um lugar.
   *
   * É a porta do "Você sabia?": a bolha apresenta uma função e o toque leva
   * até ela. Sem isto, o balão repete o toque do personagem (o chat) — que é
   * o certo para a frase do dia, que não promete lugar nenhum.
   */
  aoTocar?: () => void;
};

/**
 * A fala dos recados — ou `null`, que é o silêncio.
 *
 * ─── FICAR QUIETO É METADE DO VALOR ────────────────────────────────────────
 *
 * Um personagem que fala toda vez que a tela abre vira ruído em três dias, e
 * aí a paciente para de ler o balão exatamente quando ele tiver algo urgente.
 * Sem recado, ele não diz nada — e é isso que faz a fala significar quando
 * aparece.
 *
 * ─── O NÚMERO, E NÃO UM PONTO ──────────────────────────────────────────────
 *
 * "Tem coisa" obriga a abrir para descobrir se vale a pena. Numa gestação de
 * alto risco a pergunta que ela faz é QUANTOS, não se.
 */
export function falaDosRecados(recados: number): FalaDoMascote | null {
  const n = Math.max(0, Math.floor(recados) || 0);
  if (n === 0) return null;
  return {
    texto: n === 1 ? "Tenho um recado para você 💌" : `Tenho ${n} recados 💌`,
    aria: `Abrir ${n} ${n === 1 ? "recado" : "recados"}`,
  };
}

/**
 * QUEM VENCE quando há fala explícita e recado ao mesmo tempo.
 *
 * A explícita, sempre. É a porta do tutorial: enquanto o personagem estiver
 * ensinando, o número de recados não o interrompe — um personagem que muda de
 * assunto no meio da frase não ensina nada, e o recado continua lá quando ele
 * terminar.
 */
export function oQueOMascoteDiz(
  fala: FalaDoMascote | null | undefined,
  recados: number,
): FalaDoMascote | null {
  return fala ?? falaDosRecados(recados);
}

/**
 * O toque no BALÃO abre a central de recados — ou faz o mesmo que o toque no
 * personagem?
 *
 * Depende de quem está falando, e a pergunta só passou a existir agora.
 *
 * ⚠️ Antes, os dois toques iam para a central e não havia o que decidir. Hoje o
 * toque no PERSONAGEM abre o chat (pedido do dono: o chat sai da barra de baixo
 * e vira a boca da bolha, porque ele é a única coisa da barra que não atravessa
 * fronteira — só existe em português). Com dois destinos, o balão precisa
 * escolher, e escolher errado custa nos dois sentidos: um balão de conforto que
 * abrisse a central levaria a paciente a uma tela vazia, e um balão de recado
 * que abrisse o chat perderia justamente os recados que ele acabou de anunciar.
 *
 * A régua é a origem do texto. Quando o balão É o anúncio dos recados ("Tenho 3
 * recados 💌"), ele promete um lugar e tocar nele leva lá. Quando quem fala é a
 * frase do dia — conforto, clima, hora —, o balão não promete lugar nenhum, e o
 * toque nele é o mesmo toque no personagem.
 */
export function oBalaoAbreOsRecados(
  fala: FalaDoMascote | null | undefined,
  recados: number,
): boolean {
  return !fala && falaDosRecados(recados) !== null;
}

/**
 * O que o emblema mostra.
 *
 * O teto em "9+" é de LARGURA: o emblema fica pendurado na borda de um
 * personagem de 44px, e três dígitos o empurrariam para fora do canto da tela.
 * Quem tem mais de nove recados não precisa do número exato para saber que
 * precisa abrir.
 */
export function emblemaDeRecados(recados: number): string | null {
  const n = Math.max(0, Math.floor(recados) || 0);
  if (n === 0) return null;
  return n > 9 ? "9+" : String(n);
}
