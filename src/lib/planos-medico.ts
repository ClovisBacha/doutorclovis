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
 * O preço marginal cai a cada faixa e **para** em R$ 0,08. Não é estética: é 3×
 * o custo de PLANEJAMENTO (R$ 0,027, que já é o pior caso possível, não a média
 * de R$ 0,015).
 *
 * No topo — R$ 999,00 por 11.100 mensagens, a 9 centavos efetivos — a margem é
 * de 66% no custo planejado e de **36% no cenário de estresse**, aquele em que
 * as mensagens vêm no tamanho máximo E o modelo custa o dobro do de hoje. É
 * menos folga que os degraus de baixo têm (68% na entrada), e é o preço de o
 * topo ser barato: quem compra volume paga menos por mensagem, e a margem
 * acompanha. Acima de 11.100 é Clínica, sob consulta, onde se olha o uso real
 * antes de dar preço.
 *
 * Este arquivo é só a conta. Sem rede, sem banco, sem React.
 */

/**
 * As faixas, em centavos por mensagem.
 *
 * `ate` é o teto ACUMULADO da faixa; `centavos` é o preço de cada mensagem
 * DENTRO dela — preço graduado, igual ao do Stripe. A primeira faixa é `fixo`:
 * R$ 29,90 fechados, não por unidade, e isso faz dois trabalhos de uma vez —
 * bate exato no preço de entrada que o dono escolheu e vira tíquete mínimo
 * (ninguém assina por R$ 5).
 *
 * ─── OS DOIS NÚMEROS QUE O DONO FIXOU ───────────────────────────────────────
 *
 *   · a entrada custa **20 centavos por mensagem** (R$ 29,90 ÷ 150 = 19,93c);
 *   · o último plano de autoatendimento custa **R$ 999,00 a 9 centavos por
 *     mensagem** — o que define 11.100 mensagens, porque 999 ÷ 0,09 = 11.100.
 *
 * Tudo entre esses dois pontos é consequência, e a escada foi resolvida DE TRÁS
 * PARA A FRENTE (do topo para a entrada) para que os dois batessem exatos e os
 * preços marginais coubessem em duas casas decimais — que é o que se digita no
 * painel do Stripe.
 *
 * ─── O DESCONTO SOBE SEIS PONTOS POR DEGRAU, E ISSO NÃO É SORTE ─────────────
 *
 * Os dez degraus dão 0 · 6 · 12 · 18 · 24 · 30 · 36 · 42 · 48 · 54% de economia
 * por mensagem. O preço efetivo cai cerca de 1,21 centavo a cada degrau, sempre
 * o mesmo passo: era esse o pedido — "vai passar de vinte centavos até nove
 * centavos, dividido em dez partes".
 *
 * ─── CUIDADO AO LER ESTES NÚMEROS ───────────────────────────────────────────
 *
 * `centavos` é o preço MARGINAL da faixa, não o que o médico paga por mensagem.
 * Em preço graduado o efetivo nunca alcança o marginal do último degrau — e é
 * por isso que o marginal do fim é 8 centavos enquanto o EFETIVO no topo é 9.
 * Quem quiser o número que aparece na tela use `centavosPorMensagem`, nunca
 * esta tabela.
 *
 * ─── E POR QUE HÁ CASA DECIMAL ──────────────────────────────────────────────
 *
 * Porque a conta não fecha sem ela. As nove faixas por unidade precisam somar
 * exatamente R$ 969,10 em 10.950 mensagens; com limites redondos e marginais
 * inteiros a soma é sempre múltipla de 50 centavos, e R$ 969,10 não é. O Stripe
 * cobra decimal por unidade (`unit_amount_decimal`) justamente para isto.
 */
export const FAIXAS = [
  { ate: 150, fixo: 2_990 },
  { ate: 250, centavos: 16.9 },
  { ate: 350, centavos: 14.45 },
  { ate: 550, centavos: 14.18 },
  { ate: 850, centavos: 12.85 },
  { ate: 1_350, centavos: 11.79 },
  { ate: 2_100, centavos: 10.46 },
  { ate: 3_200, centavos: 9.14 },
  { ate: 5_000, centavos: 8.05 },
  { ate: 11_100, centavos: 8.0 },
] as const;

/**
 * A chave do `localStorage` onde a quantidade escolhida no site espera.
 *
 * Entre o seletor da `/medicos` e o checkout do painel há um cadastro, um
 * e-mail de confirmação e às vezes um desvio pelo Google. Sem um lugar para o
 * número esperar, a escolha morre no caminho — e a pessoa que arrastou até
 * 1.500 abre o painel em 1.000 sem entender por quê.
 *
 * Mora aqui, junto da escada, para não virar uma string solta repetida em dois
 * arquivos que um dia divergem por uma letra.
 */
export const MENSAGENS_ESCOLHIDAS = "obstetrica:mensagens-escolhidas";

/** O menor pacote — e o preço de entrada. */
export const ENTRADA_MENSAGENS = 150;

/**
 * O maior pacote que se compra sozinho: R$ 999,00.
 *
 * Acima disso, Clínica. Não é limitação técnica: 11.100 mensagens ≈ 740
 * gestantes ativas, e quem pede mais que isso não é UM obstetra — é clínica com
 * vários médicos, e cada médico precisa do próprio cérebro. O pedido em si é a
 * informação, e vale uma conversa antes de um preço.
 */
export const TETO_AUTOATENDIMENTO = 11_100;

/**
 * O piso MARGINAL: nenhuma faixa é vendida abaixo disto.
 *
 * Oito centavos, e não os nove do efetivo do topo — em preço graduado o efetivo
 * é sempre maior que o marginal do fim. Continua sendo 3× o custo de
 * PLANEJAMENTO (2,7c), e no cenário de estresse o topo ainda entrega 36% de
 * margem depois da taxa do Stripe.
 */
export const PISO_CENTAVOS_POR_MENSAGEM = 8;

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
  /* ─── ARREDONDA UMA VEZ, NO FIM ────────────────────────────────────────────
     As faixas cobram centavos com casa decimal, então uma quantidade no meio de
     uma faixa pode dar meio centavo (1.000 mensagens caem em 14.584,5). O
     Stripe também arredonda a linha da fatura ao centavo; arredondar aqui e
     mais nada é o que mantém as duas contas iguais.

     Os dez degraus da tabela foram escolhidos para dar centavos inteiros ANTES
     do arredondamento — não é o `round` que os salva. */
  return Math.round(total);
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
export const DEGRAUS = [150, 250, 350, 550, 850, 1_350, 2_100, 3_200, 5_000, 11_100] as const;

/**
 * Os três que viram cartão: a entrada, o meio da escada e o topo.
 *
 * O do meio é 1.350 — o quinto degrau, com 30% de economia por mensagem. Meio
 * de verdade: metade dos degraus abaixo, metade acima.
 */
export const DEGRAUS_DESTAQUE = [150, 1_350, 11_100] as const;

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
