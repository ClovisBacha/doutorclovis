/**
 * "O SERVIDOR ACABOU DE CONCEDER SEMENTINHAS" — o recado, e quem o escuta.
 *
 * ─── DOIS DEFEITOS, UM RECADO ───────────────────────────────────────────────
 *
 * Auditoria da gamificação, ago/2026. Os dois saíram da mesma raiz: o Caminho
 * concedia e não contava a ninguém.
 *
 *  1. **O saldo não subia.** `setSaldo` era chamado UMA vez, na montagem da
 *     trilha. A paciente fazia a aula (+18 🌱), as quatro atividades (+20 🌱)
 *     e o bônus das cinco estrelas (+20 🌱), via os toasts de "+5 🌱" — e o
 *     número no alto da tela ficava igual a tarde inteira. É o defeito mais
 *     caro que uma moeda de jogo pode ter: o contador É a recompensa.
 *
 *  2. ⚠️ **As conquistas do jogo nunca eram concedidas.**
 *     `checkAndAwardAchievements` roda em cinco lugares: quatro telas de
 *     REGISTRO (pressão, chutes, diário, pergunta ao médico) e a própria aba
 *     Conquistas. O Caminho — que é onde ela medita, escreve a gratidão, lê a
 *     carta, fecha o dia e ganha troféu — não chamava em lugar nenhum.
 *     Consequência medida: as conquistas de meditação, gratidão, carta,
 *     exercício e troféu, e também o marco semanal de 25 🌱 e os de trimestre,
 *     só chegavam quando ela abria a aba Conquistas ou registrava uma pressão.
 *     Uma paciente que só jogasse não recebia nada disso.
 *
 * ─── ⚠️ POR QUE UM MÓDULO PRÓPRIO, E NÃO UMA PROP ───────────────────────────
 *
 * Os pontos que concedem (`MovementBlock`, `MeditationBlock`, `BondingBlock`,
 * `GratitudeBlock`, a aula e o bônus do dia) são componentes distintos, em
 * fundos de árvore diferentes. Passar `aoGanhar` por todos seria seis
 * assinaturas novas e uma sétima esquecida no próximo bloco que alguém
 * escrever. O arquivo já usa `CustomEvent` para exatamente este tipo de recado
 * entre partes distantes (`dc-skin-trocada`, que a loja dispara e a trilha
 * ouve).
 *
 * ⚠️ E por que um ARQUIVO SEPARADO, e não uma constante exportada de
 * `gestacao-path.tsx`: `minha-conta` carrega a trilha por `lazy(() =>
 * import(...))`, e um `import` estático de qualquer símbolo dela puxaria os
 * 91 KB do módulo inteiro de volta para o pacote principal — desfazendo em uma
 * linha a divisão que a rodada de desempenho acabou de fazer. Este arquivo não
 * importa nada.
 */

const EVENTO = "dc-sementinhas";

/**
 * Avisa que o servidor concedeu `n` Sementinhas.
 *
 * ⚠️ O número é o que o SERVIDOR devolveu (`r.granted`), nunca um palpite do
 * cliente: quem ouve soma ao saldo, e um palpite viraria um saldo que discorda
 * do banco até a próxima abertura.
 */
export function creditarSementinhas(n: number) {
  if (typeof window === "undefined" || !Number.isFinite(n) || n <= 0) return;
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: n }));
  /**
   * ⚠️ O SOM DA MOEDA MORA AQUI, e este é o único funil que existe.
   *
   * A Sementinha é concedida em seis ou mais pontos diferentes — a aula, as
   * quatro atividades, o fechamento do dia, o bônus da dupla, o presente, a
   * conquista. Pôr o som em cada um seria seis chamadas e uma sétima esquecida
   * no próximo bloco; é exatamente a razão pela qual este módulo existe.
   *
   * ⚠️ E o CLAUDE.md já registra que "o contador É a recompensa": um "+5 🌱"
   * silencioso é indistinguível de nada ter acontecido. O que impedia o som de
   * virar caixa registradora não podia ser disciplina de quem chama — é o teto
   * de cinco por dia de `podeSoar`.
   *
   * O `import` é dinâmico porque este arquivo não importa NADA de propósito: a
   * trilha desce por `lazy()`, e um import estático aqui reabriria a divisão de
   * pacote que a rodada de desempenho fez. `tocar-som-de-ui` é folha (sem
   * React, sem componente), então o pedaço que ele traz é pequeno — mas
   * dinâmico ele nem entra no caminho de quem nunca ganha uma Sementinha.
   */
  void import("./tocar-som-de-ui").then((m) => m.tocarSomDeUI("moeda")).catch(() => {});
}

/** Escuta. Devolve a função que cancela — chame no cleanup do efeito. */
export function ouvirSementinhas(aoGanhar: (n: number) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const ouvir = (e: Event) => {
    const n = Number((e as CustomEvent).detail);
    if (Number.isFinite(n) && n > 0) aoGanhar(n);
  };
  window.addEventListener(EVENTO, ouvir);
  return () => window.removeEventListener(EVENTO, ouvir);
}
