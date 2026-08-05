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
 * O rótulo do card: "1h30", "45 min", "2 dias de consultório".
 *
 * Acima de 8 horas a unidade muda para DIAS de trabalho, porque é aí que a hora
 * para de significar alguma coisa: "50h" o médico lê como número; "6 dias de
 * consultório" ele lê como a agenda dele.
 */
export function tempoPoupado(respostas: number, minutosCada = MINUTOS_PADRAO): string {
  const total = Math.floor(respostas * minutosCada);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  if (h < 8) {
    const m = total % 60;
    return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
  }
  const dias = Math.floor(h / 8);
  const resto = h % 8;
  /* "1 dias" é o tipo de erro que faz a tela inteira parecer descuidada. */
  if (resto === 0) return dias === 1 ? "1 dia" : `${dias} dias`;
  return `${dias}d${resto}h`;
}
