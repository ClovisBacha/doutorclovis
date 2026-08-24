/**
 * Quanto tempo a IA poupou do médico.
 *
 * ─── Por que isto virou um arquivo ──────────────────────────────────────
 *
 * O card "Valor gerado este mês" dizia, e diz, quantas horas a IA respondeu por
 * ele. A conta era `respostas × 3 minutos` — três minutos fixos, iguais para
 * todo mundo, escolhidos por ninguém.
 *
 * Isso não é grave enquanto o número é pequeno. Vira grave quando ele fica
 * grande: "a IA economizou 50 horas suas" é uma afirmação forte, e um médico
 * que escreve respostas de duas linhas faz a conta de cabeça, não reconhece o
 * número e passa a desconfiar do painel inteiro — inclusive das partes certas.
 *
 * A saída não é diminuir a afirmação, é **fundamentá-la no que ele escreve**.
 * O tempo poupado por resposta passa a sair do tamanho MEDIANO das respostas
 * DELE. Quem escreve pouco vê um número menor e verdadeiro; quem escreve muito
 * vê um número maior — e também verdadeiro.
 *
 * ─── As três regras ─────────────────────────────────────────────────────
 *
 * 1. **Mediana, não média.** Uma única resposta enorme (um texto colado, um
 *    protocolo inteiro) puxaria a média para cima e inflaria o card. A mediana
 *    ignora o outlier por construção.
 *
 * 2. **Sempre para baixo.** Onde há arredondamento, ele desce. Um número que o
 *    médico contesta e descobre inflado custa mais do que o número maior
 *    valeria.
 *
 * 3. **Poucos dados → volta para o padrão conservador.** Com duas ou três
 *    respostas, a mediana é ruído. Abaixo do mínimo, vale o piso.
 */

/** Palavras por minuto digitando. Conservador de propósito — ver regra 2. */
const PALAVRAS_POR_MINUTO = 40;

/** Abaixo disto a mediana é ruído, não medida. */
export const MINIMO_DE_AMOSTRAS = 5;

/** O padrão de antes, mantido como piso para quem ainda não escreveu nada. */
export const MINUTOS_PADRAO = 3;

/**
 * Nem toda resposta é digitada do zero: parte é revisão, parte é copiar de algo
 * que ele já tinha. Cortar pela metade mantém a afirmação defensável — é o
 * mesmo espírito do resto do card, que mostra a premissa em vez de escondê-la.
 */
const FATOR_DE_REDACAO = 0.5;

/** Teto: acima disto quase certamente é texto colado, não redigido. */
const MINUTOS_MAXIMO = 10;

/** Conta palavras de um jeito que não se engana com pontuação e quebras. */
export function palavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

/** A mediana de uma lista de números. Lista vazia devolve 0. */
export function mediana(ns: number[]): number {
  if (ns.length === 0) return 0;
  const ord = [...ns].sort((a, b) => a - b);
  const meio = Math.floor(ord.length / 2);
  /* Par: a média dos dois centrais, arredondada PARA BAIXO — regra 2. */
  return ord.length % 2 === 1 ? ord[meio] : Math.floor((ord[meio - 1] + ord[meio]) / 2);
}

/**
 * Minutos que uma resposta DELE custaria, a partir das respostas que ele já
 * escreveu. Devolve `MINUTOS_PADRAO` enquanto não houver amostra suficiente.
 */
export function minutosPorResposta(respostasDele: string[]): number {
  const tamanhos = respostasDele
    .map((r) => palavras(r ?? ""))
    /* Respostas de uma palavra ("sim", "ok") não representam o trabalho que a
       IA substitui, e puxariam a mediana para baixo sem motivo. */
    .filter((n) => n >= 5);

  if (tamanhos.length < MINIMO_DE_AMOSTRAS) return MINUTOS_PADRAO;

  const bruto = (mediana(tamanhos) / PALAVRAS_POR_MINUTO) * FATOR_DE_REDACAO;
  const minutos = Math.floor(bruto * 10) / 10; // uma casa, para baixo
  /* O piso é o padrão antigo: a estimativa nova nunca pode fazer o médico
     parecer MAIS rápido do que a conta conservadora que já estava no ar. */
  return Math.min(MINUTOS_MAXIMO, Math.max(MINUTOS_PADRAO, minutos));
}

/**
 * O rótulo do card: "45 min", "1h30", "84 horas".
 *
 * ─── Por que NÃO se converte para "dias" ────────────────────────────────
 *
 * A primeira versão virava "6 dias de consultório" acima de 8 horas, e isso
 * estava errado por um motivo de negócio, não de formatação: **consulta é a
 * renda do médico.** Dizer que ele "economizou 6 dias de consultório" é dizer
 * que ele faturou menos — o oposto do que o card quer afirmar.
 *
 * O tempo que a IA devolve não é o do consultório: é o NÃO PAGO. A mensagem
 * respondida às onze da noite, no domingo, no meio do jantar. Esse tempo não se
 * mede em jornadas de trabalho, então a unidade certa é hora — e "84 horas"
 * continua sendo um número que impressiona, sem sugerir agenda vazia.
 */
export function tempoPoupado(respostas: number, minutosCada = MINUTOS_PADRAO): string {
  const total = Math.floor(respostas * minutosCada);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  /* Depois de 10 horas, os minutos viram ruído: "84h" lê melhor que "84h37". */
  if (h >= 10) return `${h} horas`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/**
 * A frase que fecha o card. Rotaciona pelo MÊS, não por sorteio.
 *
 * Sorteio faria a frase mudar a cada carregamento da página, o que lê como
 * defeito. Pelo mês, ela muda quando o número muda — e o médico que volta ao
 * painel três vezes no mesmo dia vê a mesma coisa, como deve ser.
 *
 * O que elas nunca dizem: nada sobre a agenda do consultório. Todas apontam
 * para o tempo que a IA de fato devolveu — o de casa.
 */
const FECHOS = [
  "Aproveite para jantar sem o celular na mesa.",
  "Aproveite para dormir cedo uma noite.",
  "Aproveite para ficar com quem estava esperando por você.",
  "Aproveite para não abrir o WhatsApp no fim de semana.",
  "Aproveite para sair do plantão e não levar trabalho para casa.",
  "Aproveite para fazer aquilo que você vive adiando.",
];

export function fechoDoTempo(mes: number): string {
  return FECHOS[((mes % FECHOS.length) + FECHOS.length) % FECHOS.length];
}
