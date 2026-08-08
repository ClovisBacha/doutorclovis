/**
 * A ECONOMIA DAS SEMENTINHAS — a conta que decide se a paciente assina.
 *
 * ─── A IDEIA (decisão do dono, ago/2026) ────────────────────────────────────
 *
 * As Sementinhas deixam de ser um SUBSTITUTO do Premium e viram um GERADOR DE
 * DEMANDA por ele. O mecanismo, na palavra dele: poucos itens grátis, e baratos,
 * de modo que em ~15 dias ela já tenha comprado TODOS — e a partir daí acumule
 * moeda sem ter no que gastar, olhando uma loja cheia de coisa bloqueada.
 *
 * É mais forte que esconder conteúdo. Moeda parada no bolso incomoda de um jeito
 * que conteúdo que ela nunca viu não incomoda: ela já TEM o preço do item, e a
 * única coisa entre os dois é a assinatura.
 *
 * ─── POR QUE A CURVA TEM ESTA FORMA ─────────────────────────────────────────
 *
 * Medido antes de mexer: 37 itens grátis somando 3.300 🌱, com um ganho de
 * ~205 🌱 em quinze dias. Dava **241 dias** para zerar a loja grátis. Não é um
 * ajuste de números, é outro jogo.
 *
 * A curva nova é a que os jogos usam no primeiro mês, e ela faz duas coisas
 * diferentes com dois grupos de itens:
 *
 *  · **catorze itens baratos (5 a 20 🌱)** — vitória quase imediata, várias
 *    vezes por semana. É o que ensina o laço "ganhei → gastei → mudou a minha
 *    tela" nos primeiros minutos, quando ela ainda não tem motivo para voltar.
 *
 *  · **UM item caro (200 🌱)** — o troféu. Leva de cinco a oito dias juntando,
 *    e existe para ser perseguido.
 *
 * E o preço do troféu não é arbitrário: **200 🌱 fica no meio da faixa
 * premium** (mediana 160, Q3 250). É âncora de preço. Ela paga 200 por um item
 * que podia ter de graça, aprende no corpo quanto vale 200 — e quando abre a
 * loja premium o número já significa alguma coisa. Sem essa âncora, o preço
 * premium é só um número grande.
 *
 * CORREÇÃO DE ROTA, registrada porque me enganou: escrevi aqui que 200 era a
 * MEDIANA exata do premium, e era — ANTES. Mover 27 itens baratos de grátis
 * para premium puxou a mediana para 160, e a afirmação virou falsa sem que
 * nenhum número mudasse de lugar. Foi o teste que pegou. A âncora continua
 * valendo (200 está entre a mediana e o Q3); o que não valia era a palavra
 * "mediana", e prosa confiante e errada nesta base é pior que prosa nenhuma.
 *
 * ─── O PRESENTE DO MÉDICO ACELERA A PAREDE ──────────────────────────────────
 *
 * O médico ganha uma mesada mensal de Sementinhas para presentear, do tamanho
 * do plano dele. Quanto mais generoso ele é, MAIS RÁPIDO ela zera os grátis e
 * chega na parede. Ele acha que está mimando a paciente — e está, ela ganha as
 * Sementinhas de verdade — e ao mesmo tempo está empurrando a conversão.
 *
 * Custo da mesada para a plataforma: **zero**. Sementinha compra conteúdo
 * estático (JSON já escrito), não chamada de modelo.
 *
 * Este arquivo é só a conta. Sem rede, sem banco, sem React.
 */

/** Quantos itens ficam grátis na loja. */
export const ITENS_GRATIS = 15;

/**
 * A curva de preços dos grátis, em Sementinhas, do mais barato ao troféu.
 *
 * Catorze degraus e um salto. Somam 704 🌱 — calibrado contra o ganho TÍPICO
 * (35 🌱/dia), não contra o teto, para a paciente COM médico zerar a loja no
 * 15º dia.
 *
 * A primeira versão somava 330 e "dava 15 dias" — mas contra um modelo de
 * ganho que só enxergava o check-in. Com os quatro ganhos diários reais, aquela
 * loja sumia em SEIS dias. Os preços daqui dobraram para caber no ganho de
 * verdade; a FORMA da curva (muitos degraus curtos, um salto no fim) é a mesma,
 * porque a forma é o que faz o laço "ganhei → gastei → mudou minha tela" fechar
 * várias vezes na primeira semana.
 */
export const CURVA_GRATIS = [
  10, 12, 15, 18, 20, 25, 30, 35, 40, 45, 50, 60, 70, 74,
  /* O troféu, no meio da faixa premium (mediana 160, Q3 250). Ver o cabeçalho:
     é âncora de preço, não enfeite. */
  200,
] as const;

/** O que custa comprar a loja grátis inteira. */
export const CUSTO_LOJA_GRATIS = CURVA_GRATIS.reduce((s, p) => s + p, 0);

/**
 * ─── O GANHO DIÁRIO REAL, E O ERRO QUE ISTO CORRIGE ─────────────────────────
 *
 * A primeira versão deste arquivo modelava **só o check-in (5 🌱/dia)** e
 * calibrava a loja em cima disso. Um verificador mediu: existem QUATRO ganhos
 * diários no app, e três estavam fora da conta.
 *
 *   · check-in ................................  5 🌱   (`SEMENTINHAS.dailyCheckin`)
 *   · aula do dia (5 + 3 × acertos) ...........  ~18 🌱  (`grantDailyQuizReward`)
 *   · bem-estar (5 × 5 atividades) ............  25 🌱  (`grantWellnessReward`)
 *   · bônus das 3 estrelas ....................  20 🌱  (`grantDayStarsBonus`)
 *
 * O modelo dizia 13,9 🌱/dia. O teto real é **~68 🌱/dia** — quase cinco vezes.
 * Com o número errado, a loja de 330 🌱 "levava 15 dias" no papel e some em
 * MENOS DE CINCO na vida real. O dono pediu quinze e teria recebido quatro.
 *
 * ─── POR QUE UMA FAIXA, E NÃO UM NÚMERO ─────────────────────────────────────
 *
 * 68 🌱/dia é o TETO: exige check-in, aula respondida, as cinco atividades de
 * bem-estar e as três estrelas fechadas, TODO dia. Quase ninguém faz isso.
 * Modelar o teto como se fosse a média é o mesmo erro de sinal trocado —
 * calibraria a loja para quem não existe.
 *
 * A calibragem usa o TÍPICO. O teto e o mínimo entram como limites, e é assim
 * que o teste os cobra: a loja não pode sumir em três dias para a mais
 * engajada, nem virar inalcançável para a que só faz check-in.
 */
export const GANHO_DIA_TETO = 68;
/** Check-in + aula + parte do bem-estar. É esta que calibra a curva. */
export const GANHO_DIA_TIPICO = 35;
/** Só o check-in — quem abre o app e sai. */
export const GANHO_DIA_MINIMO = 5;

/** Marco de semana: 25 🌱 a cada sete dias, por fora dos diários. */
export const GANHO_SEMANAL = 25;

/**
 * Bônus de vincular um médico — pago uma vez, por médico.
 *
 * Subiu de 100 para 200 junto com a correção do ganho diário. Com a loja em
 * 704 🌱 e um ganho típico de ~38 🌱/dia, cem Sementinhas valiam menos de três
 * dias — ou seja, o vínculo com o médico não mudava nada de perceptível, e o
 * bônus virava enfeite. Com 200 a diferença é de cinco dias (14 contra 19), que
 * é o que faz valer a pena pedir o código a ele.
 */
export const BONUS_VINCULO_MEDICO = 200;

/**
 * A mesada do médico: quantas Sementinhas ele pode distribuir por mês.
 *
 * `mensagens contratadas × 3`. A razão não é arbitrária — ela se calibra
 * sozinha: uma paciente ativa consome ~15 mensagens por mês, então × 3 dá
 * ~45 🌱 por paciente por mês. O médico consegue presentear TODAS as pacientes
 * dele, todo mês, sem ter de escolher entre elas — e escolher entre pacientes
 * é exatamente o tipo de decisão que ele não deve ser obrigado a tomar.
 */
export const SEMENTINHAS_POR_MENSAGEM = 3;

export function mesadaDoMedico(mensagensContratadas: number): number {
  return Math.max(0, Math.floor(mensagensContratadas)) * SEMENTINHAS_POR_MENSAGEM;
}

/** O presente sugerido para UMA paciente — o botão de um clique no painel. */
export const PRESENTE_SUGERIDO = 50;

/**
 * AS TRÊS CLASSES DE PRESENTE.
 *
 * ─── POR QUE TRÊS, E NÃO UM CAMPO DE DIGITAR ────────────────────────────────
 *
 * Um campo livre obriga o médico a inventar um número, e ele não tem como saber
 * se 50 é muito ou pouco — o valor só significa alguma coisa contra a LOJA, que
 * ele nunca viu. Três classes com nome e efeito declarado transformam a escolha
 * em "o que eu quero que aconteça com ela", que é a decisão que ele sabe tomar.
 *
 * ─── OS VALORES SAEM DA LOJA, NÃO DO GOSTO ──────────────────────────────────
 *
 * A loja grátis inteira custa `CUSTO_LOJA_GRATIS` (704 🌱) e o item mais caro
 * dela é o troféu de 200 🌱.
 *
 *   · Semente (50)  — um item barato na hora, ou meio dia de ganho típico.
 *   · Buquê (150)   — o suficiente para um item de faixa média sem esperar.
 *   · Jardim (300)  — passa do troféu da loja grátis: é o presente que a leva a
 *                     olhar a prateleira premium, que é o ponto do desenho.
 *
 * Nenhum deles chega perto da loja inteira, de propósito: presente do médico
 * ACELERA a caminhada até a parede dos quinze dias, nunca a substitui.
 */
export const CLASSES_DE_PRESENTE = [
  {
    chave: "semente",
    nome: "Semente",
    emoji: "🌱",
    quantidade: PRESENTE_SUGERIDO,
    efeito: "Um item barato do Cantinho, hoje mesmo",
  },
  {
    chave: "buque",
    nome: "Buquê",
    emoji: "💐",
    quantidade: 150,
    efeito: "Um item de faixa média, sem esperar dias",
  },
  {
    chave: "jardim",
    nome: "Jardim",
    emoji: "🌷",
    quantidade: 300,
    efeito: "Passa do troféu da loja grátis — ela vai olhar o Premium",
  },
] as const;

export type ClasseDePresente = (typeof CLASSES_DE_PRESENTE)[number];

/**
 * Quantos dias até ela ter comprado TODOS os itens grátis.
 *
 * Devolve `Infinity` se o ganho for zero — nunca um número enganosamente
 * grande, porque "1.000 dias" e "nunca" são coisas diferentes para quem lê.
 */
export function diasParaZerarLoja(opts: {
  comMedico: boolean;
  /** Sementinhas que o médico presenteia por mês, se presentear. */
  presenteMensal?: number;
  /** Quanto ela ganha por dia. O padrão é o TÍPICO — ver o bloco acima. */
  ganhoDiario?: number;
}): number {
  const alvo = CUSTO_LOJA_GRATIS - (opts.comMedico ? BONUS_VINCULO_MEDICO : 0);
  if (alvo <= 0) return 0;

  const porDia =
    (opts.ganhoDiario ?? GANHO_DIA_TIPICO) +
    GANHO_SEMANAL / 7 +
    (opts.comMedico ? (opts.presenteMensal ?? 0) / 30 : 0);

  if (porDia <= 0) return Infinity;
  return Math.ceil(alvo / porDia);
}

/**
 * O saldo parado no dia N — a moeda que ela tem e não pode gastar.
 *
 * É o número que mede a pressão do desenho. Zero significa que a loja grátis
 * ainda tem o que vender e a parede não chegou.
 */
export function saldoParado(
  dia: number,
  opts: { comMedico: boolean; presenteMensal?: number; ganhoDiario?: number },
): number {
  const ganho =
    (opts.comMedico ? BONUS_VINCULO_MEDICO : 0) +
    dia * (opts.ganhoDiario ?? GANHO_DIA_TIPICO) +
    Math.floor(dia / 7) * GANHO_SEMANAL +
    (opts.comMedico ? Math.floor(dia / 30) * (opts.presenteMensal ?? 0) : 0);
  return Math.max(0, Math.round(ganho - CUSTO_LOJA_GRATIS));
}
