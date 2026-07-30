/**
 * Moeda e valor da consulta.
 *
 * Três decisões, e nenhuma é cosmética.
 *
 * 1. **A moeda é escolhida, não deduzida.** O campo antigo chamava-se
 *    `consultation_price_brl` e a tela dizia "em reais" — o que estava certo
 *    enquanto a plataforma era de um consultório em Minas. Um médico atendendo
 *    brasileiras fora do país cobra em dólar ou euro, e "450" sem moeda é um
 *    número que a paciente lê errado por um fator de cinco.
 *
 * 2. **Guardamos CENTAVOS, em inteiro.** Ponto flutuante para dinheiro é como
 *    se sabe: `0.1 + 0.2` não dá `0.3`. Inteiro em centavos não erra, e é o que
 *    o Mercado Pago e o Stripe já usam.
 *
 * 3. **A pontuação é a de quem LÊ, não a de quem digita.** Formatar dólar com
 *    a convenção americana dá "$1,250.50" — e uma paciente brasileira lê isso
 *    como mil e duzentos reais, porque para ela a vírgula é decimal. O símbolo
 *    "US$ 1.250,50" não deixa dúvida sobre nenhuma das duas coisas: nem o valor,
 *    nem a moeda. Por isso o locale é sempre `pt-BR` e o que muda é a moeda.
 *    (Escrevi o contrário antes, formatando cada moeda na convenção do país de
 *    origem, e o teste mostrou o "$1,250.50" que trouxe a decisão de volta.)
 */

export type MoedaChave = "BRL" | "USD" | "EUR";

export const MOEDAS: { chave: MoedaChave; rotulo: string; simbolo: string }[] = [
  { chave: "BRL", rotulo: "Real (R$)", simbolo: "R$" },
  { chave: "USD", rotulo: "Dólar (US$)", simbolo: "US$" },
  { chave: "EUR", rotulo: "Euro (€)", simbolo: "€" },
];

/** Quem lê é brasileiro: milhar com ponto, decimal com vírgula, sempre. */
const LOCALE_LEITOR = "pt-BR";

export function moedaDe(chave?: string | null) {
  return MOEDAS.find((m) => m.chave === (chave || "BRL")) ?? MOEDAS[0];
}

/**
 * A moeda é conhecida? Moeda desconhecida cai em real no `moedaDe` acima, e o
 * fallback é seguro para DESENHAR (melhor um símbolo que nenhum) e perigoso
 * para AFIRMAR: `formatarDinheiro(30000, "GBP")` imprime "R$ 300,00", que é
 * exatamente o erro de fator que o cabeçalho deste arquivo existe para evitar.
 * Quem vai usar o número numa conta pergunta aqui primeiro.
 */
export function moedaConhecida(chave?: string | null): boolean {
  return MOEDAS.some((m) => m.chave === chave);
}

/**
 * Formata centavos para leitura: `45000, "BRL"` → `"R$ 450,00"`.
 *
 * Usado na tela do médico e no card que a paciente vê — o mesmo formatador nos
 * dois lados, para não existir "o preço que ele cadastrou" diferente de "o
 * preço que ela leu".
 */
export function formatarDinheiro(
  centavos: number | null | undefined,
  moeda?: string | null,
): string {
  if (centavos == null || !Number.isFinite(centavos)) return "";
  const m = moedaDe(moeda);
  return new Intl.NumberFormat(LOCALE_LEITOR, {
    style: "currency",
    currency: m.chave,
    minimumFractionDigits: 2,
  }).format(centavos / 100);
}

/**
 * Formata o que está sendo digitado, sem símbolo: `"45000"` → `"450,00"`.
 *
 * A entrada é tratada como uma fila de dígitos da direita para a esquerda — os
 * dois últimos são os centavos. É o comportamento de caixa eletrônico, e o que
 * evita o pior dos campos de dinheiro: o cursor pulando de lugar porque a
 * máscara reposicionou o texto embaixo do dedo.
 */
export function digitandoDinheiro(bruto: string, moeda?: string | null): string {
  const digitos = (bruto ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digitos) return "";
  const centavos = Number(digitos.slice(-14)); // teto sensato: nada de overflow
  return new Intl.NumberFormat(LOCALE_LEITOR, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centavos / 100);
}

/** Só os dígitos do que foi digitado, em centavos. `"1.250,00"` → `125000`. */
export function centavosDe(bruto: string): number | null {
  const digitos = (bruto ?? "").replace(/\D/g, "");
  if (!digitos) return null;
  const n = Number(digitos);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compatibilidade com a coluna antiga `consultation_price_brl`, que guarda
 * unidades inteiras (450, não 45000).
 *
 * Ela continua sendo escrita porque telas antigas e o cálculo de receita a leem;
 * o valor exato em centavos vive em `consultation_price_cents`. Quando todas as
 * leituras migrarem, esta função sai — e o comentário aqui é o rastro de por que
 * as duas existem ao mesmo tempo.
 */
export function unidadesInteirasDe(centavos: number | null | undefined): number | null {
  if (centavos == null) return null;
  return Math.round(centavos / 100);
}
