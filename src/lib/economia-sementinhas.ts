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
 * Catorze degraus curtos e um salto. Somam 330 🌱 — calibrado para que a
 * paciente COM médico zere tudo no 15º dia, que é o alvo que o dono pediu.
 * Sem médico ela leva 24 dias, e essa diferença é de propósito: é o que faz o
 * vínculo com o médico valer alguma coisa no primeiro minuto.
 */
export const CURVA_GRATIS = [
  5, 5, 5, 5, 8, 8, 10, 10, 10, 10, 12, 12, 15, 15,
  /* O troféu — mediana EXATA dos itens premium, de propósito. Ver o cabeçalho:
     é âncora de preço, não enfeite. Os catorze de cima somam 130, e o total de
     330 é calibrado para a paciente COM médico zerar a loja no 15º dia. */
  200,
] as const;

/** O que custa comprar a loja grátis inteira. */
export const CUSTO_LOJA_GRATIS = CURVA_GRATIS.reduce((s, p) => s + p, 0);

/**
 * O que ela ganha por dia sem nenhum evento especial.
 *
 * Só o check-in (5 🌱). Os marcos e conquistas entram por fora porque não
 * acontecem todo dia — e uma média diluída esconderia que a primeira semana é
 * mais generosa que a terceira, que é justamente onde o desenho age.
 */
export const GANHO_DIARIO_BASE = 5;

/** Marco de semana: 25 🌱 a cada sete dias. */
export const GANHO_SEMANAL = 25;

/**
 * Conquistas nos primeiros quinze dias, estimado.
 *
 * ESTIMATIVA, e marcada como tal: depende de quanto ela usa o app. Vinte por
 * conquista é o valor real (`SEMENTINHAS.achievementDefault`); quatro em quinze
 * dias é o meu chute para uso normal. Se a projeção abaixo passar a decidir
 * preço de verdade, este número tem de virar medição.
 */
export const CONQUISTAS_EM_15_DIAS = 4;
export const GANHO_POR_CONQUISTA = 20;

/** Bônus de vincular um médico — pago uma vez, na hora do vínculo. */
export const BONUS_VINCULO_MEDICO = 100;

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
 * Quantos dias até ela ter comprado TODOS os itens grátis.
 *
 * Devolve `Infinity` se o ganho for zero — nunca um número enganosamente
 * grande, porque "1.000 dias" e "nunca" são coisas diferentes para quem lê.
 */
export function diasParaZerarLoja(opts: {
  comMedico: boolean;
  /** Sementinhas que o médico presenteia por mês, se presentear. */
  presenteMensal?: number;
}): number {
  const alvo = CUSTO_LOJA_GRATIS - (opts.comMedico ? BONUS_VINCULO_MEDICO : 0);
  if (alvo <= 0) return 0;

  const porDia =
    GANHO_DIARIO_BASE +
    GANHO_SEMANAL / 7 +
    (CONQUISTAS_EM_15_DIAS * GANHO_POR_CONQUISTA) / 15 +
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
  opts: { comMedico: boolean; presenteMensal?: number },
): number {
  const ganho =
    (opts.comMedico ? BONUS_VINCULO_MEDICO : 0) +
    dia * GANHO_DIARIO_BASE +
    Math.floor(dia / 7) * GANHO_SEMANAL +
    Math.min(dia, 15) * ((CONQUISTAS_EM_15_DIAS * GANHO_POR_CONQUISTA) / 15) +
    (opts.comMedico ? Math.floor(dia / 30) * (opts.presenteMensal ?? 0) : 0);
  return Math.max(0, Math.round(ganho - CUSTO_LOJA_GRATIS));
}
