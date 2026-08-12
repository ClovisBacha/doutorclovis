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
