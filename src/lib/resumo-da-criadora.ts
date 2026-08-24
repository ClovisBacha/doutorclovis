/**
 * O RESUMO SEMANAL DA CRIADORA — a régua, longe da rede.
 *
 * ─── POR QUE ELE EXISTE ─────────────────────────────────────────────────────
 *
 * `/influenciadora` mostra faturamento, e ela precisa ABRIR a tela para ver. O
 * que faz uma criadora postar de novo não é o extrato: é saber que o link dela
 * funcionou esta semana. Hoje nada — nem cron, nem e-mail, nem push — toca em
 * `affiliates` (conferido: o único chamador é o webhook da Stripe).
 *
 * ─── ⚠️ E-MAIL, E NÃO PUSH ─────────────────────────────────────────────────
 *
 * A criadora pode não ter o app instalado — ela é parceira, não paciente. Push
 * exige `push_subscriptions`, que ela provavelmente não tem. E o push deste app
 * é o canal do aviso de EMERGÊNCIA: gastá-lo com um relatório semanal de
 * marketing é exatamente o que faz alguém desligar as notificações e deixar de
 * receber o que importa.
 *
 * ─── ⚠️ NÚMEROS, E NUNCA NOMES ─────────────────────────────────────────────
 *
 * Dentro do app, `minhasIndicadas` mostra os primeiros nomes — ela está logada,
 * na tela dela, e o vínculo é dela. **E-mail é outro canal**: ele fica na caixa
 * de entrada, é encaminhado, aparece na tela do celular no meio de uma reunião.
 * Nome de gestante não vai por aí. O resumo diz QUANTAS, e mais nada.
 */

export type NumerosDaSemana = {
  /** Quantas contas nasceram com o código dela nos últimos 7 dias. */
  novas: number;
  /** Quantas ao todo, desde sempre. */
  total: number;
  /** Comissão acumulada, em centavos. */
  centavos: number;
};

/**
 * Vale mandar?
 *
 * ⚠️ **Só quando há o que comemorar.** Um e-mail semanal dizendo "ninguém
 * entrou esta semana" é desânimo assinado pela plataforma, e ensina a criadora
 * a arquivar o remetente sem abrir — perdendo junto a semana em que ele traria
 * boa notícia. O silêncio é a mensagem certa para a semana vazia.
 */
export function valeMandarResumo(n: NumerosDaSemana): boolean {
  return n.novas > 0;
}

/** "R$ 1.234,56" a partir de centavos INTEIROS — dinheiro nunca em float. */
function brl(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function plural(n: number, um: string, muitos: string): string {
  return n === 1 ? um : muitos;
}

export function assuntoDoResumo(n: NumerosDaSemana): string {
  return n.novas === 1
    ? "Uma pessoa entrou pelo seu link esta semana 💛"
    : `${n.novas} pessoas entraram pelo seu link esta semana 💛`;
}

/**
 * O corpo, em texto puro.
 *
 * ⚠️ **Sem promessa e sem cobrança.** Nada de "poste mais", nada de "sua
 * audiência está esfriando" — ela é parceira, não funcionária, e a única coisa
 * que este e-mail tem para dizer é o que aconteceu.
 *
 * ⚠️ **E ele não cita gestação de ninguém.** Ver o cabeçalho: números, nunca
 * nomes, e nunca nada que descreva a situação de uma paciente.
 */
export function corpoDoResumo(n: NumerosDaSemana, nome: string | null): string {
  const ola = nome ? `Oi, ${nome}!` : "Oi!";
  const linhas = [
    ola,
    "",
    n.novas === 1
      ? "Uma pessoa criou conta pelo seu link nos últimos sete dias."
      : `${n.novas} pessoas criaram conta pelo seu link nos últimos sete dias.`,
    "",
    `No total, já são ${n.total} ${plural(n.total, "pessoa", "pessoas")}.`,
  ];
  /* A comissão só aparece quando existe: "R$ 0,00" num e-mail de boa notícia
     lê como se o trabalho dela não valesse nada. */
  if (n.centavos > 0) {
    linhas.push(`Comissão acumulada: ${brl(n.centavos)}.`);
  }
  linhas.push("", "Seu painel completo está em https://www.obstetrica.com.br/influenciadora");
  return linhas.join("\n");
}

/**
 * O dia da semana em que ele sai.
 *
 * ⚠️ **Segunda-feira**, e não domingo: é quando ela planeja o conteúdo da
 * semana. Domingo à noite é o dia do resumo da PACIENTE (a Gratidão), e são
 * públicos e propósitos diferentes — juntar os dois no mesmo dia só faria os
 * dois trabalhos disputarem o mesmo cron.
 */
export const DIA_DO_RESUMO = 1;
