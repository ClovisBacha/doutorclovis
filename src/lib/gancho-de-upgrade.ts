import { ENTRADA_MENSAGENS, precoDe } from "@/lib/planos-medico";

/**
 * O GANCHO — a frase que aparece quando o médico esbarra numa função paga.
 *
 * ─── POR QUE ELA MORA NUM LUGAR SÓ ──────────────────────────────────────────
 *
 * Pedido do dono: "essa função só está disponível no plano de R$ 29,90 — ofereça
 * a ele ali o plano mais barato; esse gancho tem que estar no site."
 *
 * Escrever isso à mão em cada tela é como o preço da paciente acabou em cinco
 * lugares com três valores diferentes. Aqui o número vem de `precoDe`, então
 * mexer na escada muda a frase inteira e ninguém precisa lembrar de nada.
 *
 * ─── E POR QUE ELA NÃO DIZ "PREMIUM" ────────────────────────────────────────
 *
 * "Premium" é o nome da assinatura da PACIENTE (R$ 19,90). Usar a mesma palavra
 * para o plano do médico faria as duas conversas colidirem no suporte — e é o
 * tipo de confusão que só aparece quando alguém já pagou a coisa errada.
 */

/** O preço de entrada, formatado — "R$ 29,90". */
export function precoDeEntrada(): string {
  return `R$ ${(precoDe(ENTRADA_MENSAGENS) / 100).toFixed(2).replace(".", ",")}`;
}

/** As funções que só existem no plano pago. A chave é o que a tela conhece. */
export const FUNCOES_PAGAS = {
  cerebro: {
    nome: "Segundo Cérebro",
    /* O que ele PERDE hoje, não o que ele ganharia — a diferença entre uma
       frase que converte e uma que soa a propaganda. */
    oQueFaz: "responder as suas pacientes 24h com as suas palavras",
  },
  transcricao: {
    nome: "Transcrição de consulta",
    oQueFaz: "virar o áudio da consulta em texto e ensinar a IA com a sua voz",
  },
  whatsapp: {
    nome: "IA no WhatsApp",
    oQueFaz: "atender e agendar no WhatsApp do consultório",
  },
} as const;

export type FuncaoPaga = keyof typeof FUNCOES_PAGAS;

/**
 * A frase completa, pronta para um toast ou um cartão.
 *
 * Diz três coisas, nesta ordem, e a ordem importa: o que ele não tem, o que
 * aquilo faz, e quanto custa. Começar pelo preço faz o texto soar como cobrança;
 * terminar sem ele faz o médico ter de procurar.
 */
export function fraseDoGancho(qual: FuncaoPaga): string {
  const f = FUNCOES_PAGAS[qual];
  return `${f.nome} faz parte dos planos com IA — é o que ${f.oQueFaz}. A partir de ${precoDeEntrada()}/mês.`;
}

/** O rótulo curto do selo, para um canto de tela. */
export const SELO_PAGO = "Plano com IA";
