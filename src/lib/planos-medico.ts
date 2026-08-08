/**
 * A ESCADA DE MENSAGENS DO MÉDICO — só a conta.
 *
 * ─── O QUE ELA SUBSTITUI ────────────────────────────────────────────────────
 *
 * Sete planos com nome (`trial`, `essencial`, `starter`, `pro`, `elite`,
 * `black`, `clinica`), cada um com teto de PACIENTES, teto de cérebros,
 * convites premium e um punhado de interruptores. A tabela tinha doze linhas e
 * ninguém — nem quem a escreveu — sabia dizer de cabeça a diferença entre dois
 * degraus vizinhos.
 *
 * Decisão do dono (ago/2026): **um eixo só, mensagens de IA.**
 *
 * O raciocínio que fecha: paciente não custa nada, mensagem custa. Limitar
 * pacientes punia o médico por crescer sem proteger a nossa conta; limitar
 * mensagens protege exatamente o que se paga. E vira uma frase que cabe num
 * cartaz: *a plataforma é grátis, você só paga a IA que responde por você.*
 *
 * ─── O PISO EXISTE PARA NÃO HAVER SURPRESA ──────────────────────────────────
 *
 * O preço marginal cai a cada faixa e **para** em R$ 0,09. Não é um número
 * escolhido por estética: é 3,3× o custo de PLANEJAMENTO (R$ 0,027, que já é o
 * pior caso possível, não a média de R$ 0,015). Com ele, o degrau mais fundo da
 * escada ainda dá 51% de margem no cenário em que as mensagens vêm no tamanho
 * máximo E o modelo custa o dobro do de hoje.
 *
 * Uma faixa abaixo de R$ 0,09 daria margem NEGATIVA nesse cenário — e é por
 * isso que a escada termina em 2.500 mensagens em vez de seguir descendo. Acima
 * disso é Clínica, sob consulta, onde se olha o uso real antes de dar preço.
 *
 * Este arquivo é só a conta. Sem rede, sem banco, sem React.
 */

/**
 * As faixas, em centavos por mensagem.
 *
 * `ate` é o teto ACUMULADO da faixa; `centavos` é o preço de cada mensagem
 * DENTRO dela — preço graduado, igual ao do Stripe. A primeira faixa é
 * `fixo`: R$ 29,90 fechados, não por unidade, e isso faz dois trabalhos de uma
 * vez — bate exato no preço de entrada que o dono escolheu e vira tíquete
 * mínimo (ninguém assina por R$ 5).
 *
 * ─── POR QUE DEZ FAIXAS, E NÃO QUATRO ───────────────────────────────────────
 *
 * A escada tinha quatro faixas (15 / 12 / 9) e o dono achou o degrau errado:
 * **na mensagem 151 o desconto despencava de uma vez**. A entrada sai a
 * R$ 0,1993 por mensagem (29,90 ÷ 150); a faixa seguinte cobrava R$ 0,15 — uma
 * queda instantânea de 25% por comprar UMA mensagem a mais que o pacote mínimo.
 * Quem comprasse 151 já levava quase todo o desconto que existia, e o resto da
 * escada não motivava mais nada.
 *
 * Agora a segunda faixa é R$ 0,19: encosta na entrada (queda de 5%) e o
 * desconto vai sendo conquistado faixa a faixa, um centavo por vez, até o piso.
 * O desconto passa a viver ONDE ELE FOI PEDIDO — nas mensagens de cima.
 *
 * ─── O PISO COMEÇA EM 2.001, E ISSO É DECISÃO DO DONO ───────────────────────
 *
 * "Acima de dois mil, a gente coloca o preço de R$ 0,09 pra cima, e depois o
 * preço da clínica." É exatamente o que a última faixa faz.
 *
 * ─── CUIDADO AO LER ESTES NÚMEROS ───────────────────────────────────────────
 *
 * `centavos` é o preço MARGINAL da faixa, não o que o médico paga por mensagem.
 * Em preço graduado o efetivo nunca alcança o marginal do último degrau: quem
 * compra 2.500 paga R$ 0,1358 por mensagem, não R$ 0,09. Quem quiser o número
 * que aparece na tela use `centavosPorMensagem`, nunca esta tabela.
 */
export const FAIXAS = [
  { ate: 150, fixo: 2_990 },
  { ate: 300, centavos: 19 },
  { ate: 500, centavos: 18 },
  { ate: 750, centavos: 17 },
  { ate: 1_000, centavos: 15 },
  { ate: 1_250, centavos: 14 },
  { ate: 1_500, centavos: 13 },
  { ate: 1_750, centavos: 11 },
  { ate: 2_000, centavos: 10 },
  { ate: 2_500, centavos: 9 },
] as const;

/** O menor pacote — e o preço de entrada. */
export const ENTRADA_MENSAGENS = 150;

/**
 * O maior pacote que se compra sozinho.
 *
 * Acima disso, Clínica. Não é limitação técnica: 2.500 mensagens ≈ 165
 * gestantes ativas, e quem pede mais que isso quase nunca é UM obstetra — é
 * clínica com vários médicos, e cada médico precisa do próprio cérebro. O
 * pedido em si é a informação, e vale uma conversa antes de um preço.
 */
export const TETO_AUTOATENDIMENTO = 2_500;

/** O piso do desconto: nenhuma mensagem é vendida abaixo disto. */
export const PISO_CENTAVOS_POR_MENSAGEM = 9;

/**
 * Custo de PLANEJAMENTO por mensagem, em centavos.
 *
 * Não é a média (R$ 0,015) — é o pior caso possível depois do teto de
 * histórico. Precificar contra a média é o que produz a surpresa que o dono
 * pediu para não existir: o dia em que as mensagens crescem, a margem já foi.
 *
 * É também a LINHA VERMELHA de monitoramento: se o custo médio real passar
 * daqui, a escada saiu do plano e precisa ser reprecificada com calma, não com
 * susto.
 */
export const CUSTO_PLANEJADO_CENTAVOS = 2.7;

/**
 * Quanto custam N mensagens por mês, em centavos.
 *
 * Graduado: cada faixa cobra só o que cai DENTRO dela. É a mesma conta que o
 * Stripe faz com `tiers_mode: graduated`, e ela vive aqui para a tela poder
 * mostrar o preço antes de o Stripe existir na conversa — e para o teste poder
 * conferir que os dois chegam ao mesmo número.
 */
export function precoDe(mensagens: number): number {
  const n = Math.max(ENTRADA_MENSAGENS, Math.min(mensagens, TETO_AUTOATENDIMENTO));
  let total = 0;
  let jaCobradas = 0;
  for (const faixa of FAIXAS) {
    if (n <= jaCobradas) break;
    const nestaFaixa = Math.min(n, faixa.ate) - jaCobradas;
    if (nestaFaixa <= 0) continue;
    total += "fixo" in faixa ? faixa.fixo : nestaFaixa * faixa.centavos;
    jaCobradas = Math.min(n, faixa.ate);
  }
  return total;
}

/** O preço de entrada, derivado da escada — nunca escrito à mão. */
export const ENTRADA_CENTAVOS = precoDe(ENTRADA_MENSAGENS);

/** Quanto custa CADA mensagem num pacote de N, em centavos (pode ter fração). */
export function centavosPorMensagem(mensagens: number): number {
  const n = Math.max(ENTRADA_MENSAGENS, Math.min(mensagens, TETO_AUTOATENDIMENTO));
  return precoDe(n) / n;
}

/**
 * O desconto por mensagem contra o PLANO DE ENTRADA, em % inteira.
 *
 * É o número que aparece no cartão ("40% de economia por mensagem"), e é
 * comparação verdadeira: os dois lados são preços que a plataforma cobra de
 * verdade.
 *
 * `floor`, e pelo mesmo motivo de `promo.ts`: anunciar um desconto maior do que
 * a fatura entrega é propaganda enganosa, ainda que por centavos. Arredondar
 * para baixo é o único arredondamento seguro num desconto.
 */
export function descontoVsEntrada(mensagens: number): number {
  const base = centavosPorMensagem(ENTRADA_MENSAGENS);
  return Math.floor((1 - centavosPorMensagem(mensagens) / base) * 100);
}

/**
 * Os degraus que a tela mostra.
 *
 * O slider é contínuo, mas ninguém compara oito números de cabeça — os cartões
 * âncora são três (o primeiro, o do meio e o topo) e o resto vive no slider.
 */
export const DEGRAUS = [150, 300, 500, 750, 1_000, 1_250, 1_500, 1_750, 2_000, 2_500] as const;

/**
 * Os três que viram cartão.
 *
 * O do meio é 1.000 e não 1.250 de propósito: é o primeiro degrau em que o
 * desconto chega a dois dígitos (12%), que é o número que o cartão mostra.
 */
export const DEGRAUS_DESTAQUE = [150, 1_000, 2_500] as const;

/**
 * Quantas mensagens uma gestante ativa consome por mês, em média.
 *
 * ─── POR QUE ESTE NÚMERO PRECISA EXISTIR ────────────────────────────────────
 *
 * "1.000 mensagens" não dimensiona nada para um obstetra — ele não conta
 * mensagens, conta gestantes. Sem a conversão, o slider vende numa unidade que
 * o comprador não sabe estimar, que é o defeito que a escada de nomes tinha.
 *
 * Quinze sai do próprio comentário do teto: 2.500 mensagens ≈ 165 gestantes
 * ativas. Mora aqui para a tela não inventar a própria régua — foi assim que a
 * tabela de preços já divergiu quatro vezes nesta base.
 *
 * É estimativa, e a tela precisa dizer isso: "cerca de", nunca "até".
 */
export const MENSAGENS_POR_GESTANTE_MES = 15;

/** Quantas gestantes ativas um pacote atende, aproximadamente. */
export function gestantesAtendidas(mensagens: number): number {
  const n = Math.max(ENTRADA_MENSAGENS, Math.min(mensagens, TETO_AUTOATENDIMENTO));
  return Math.floor(n / MENSAGENS_POR_GESTANTE_MES);
}

/**
 * A margem que sobra num pacote, em centavos, num custo por mensagem dado.
 *
 * Inclui a taxa do Stripe no Brasil (3,99% + R$ 0,39) porque margem sem a
 * taxa é margem que não existe — e num tíquete de R$ 29,90 os R$ 0,39 fixos
 * são 1,3% sozinhos.
 */
export function margemCentavos(mensagens: number, custoPorMensagem: number): number {
  const preco = precoDe(mensagens);
  const taxa = preco * 0.0399 + 39;
  return preco - taxa - mensagens * custoPorMensagem;
}
