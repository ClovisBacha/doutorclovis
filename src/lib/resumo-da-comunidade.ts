/**
 * O RESUMO SEMANAL DA COMUNIDADE — a régua.
 *
 * ─── O QUE ISTO LIGA ────────────────────────────────────────────────────────
 *
 * A rede social manda **um** push, e um só: o pedido para seguir. Foi uma
 * decisão deliberada e continua valendo — reação não empurra ninguém, porque
 * este é o mesmo canal por onde chega o aviso de emergência, e quem desliga as
 * notificações por causa de um coraçãozinho de madrugada desliga o resto junto.
 *
 * O que faltava não era mais push: era UM, semanal, dizendo que a rede dela
 * andou. Sem ele, quem publica uma vez e não volta nunca descobre que três
 * amigas publicaram na quarta.
 *
 * ⚠️ **Um por semana, aos domingos** — o mesmo dia do resumo da Gratidão e da
 * retrospectiva dentro do app, e nunca um dia próprio: dois pushes do mesmo app
 * em dias diferentes ensinam que este app fala demais.
 */

/** O que a paciente precisa ter para valer um resumo. */
export type FatosDaSemana = {
  /** Quantas publicações NOVAS de quem ela segue, nos últimos 7 dias. */
  publicacoes: number;
  /** De quantas pessoas diferentes. */
  pessoas: number;
  emCuidado: boolean;
};

/**
 * O mínimo para o push sair.
 *
 * ⚠️ **DUAS publicações, e não uma.** Um push semanal por uma única publicação
 * é o app pedindo atenção em nome de quase nada — e o custo não é o incômodo:
 * é a próxima notificação, que ela vai ignorar. Com duas, a frase já promete
 * uma volta que vale a pena.
 */
export const MINIMO_DE_PUBLICACOES = 2;

/**
 * Vale mandar?
 *
 * ⚠️ **NUNCA em Modo Cuidado.** Um resumo animado sobre a rede de gestantes é
 * exatamente o que quem perdeu a gestação não pode receber — e este é o único
 * dos três portões que a tela não tem como aplicar depois, porque o push chega
 * fora do app.
 */
export function valeResumoDaComunidade(f: FatosDaSemana): boolean {
  if (f.emCuidado) return false;
  return f.publicacoes >= MINIMO_DE_PUBLICACOES;
}

/**
 * O texto.
 *
 * ⚠️ **NÚMERO, e nunca nome.** "Marina e Carol publicaram" chega na tela de
 * bloqueio do celular dela, e quem estiver ao lado lê — o nome de duas
 * gestantes e a informação de que as três se conhecem. É a mesma razão pela
 * qual a lista de seguidores deste app não é pública.
 *
 * ⚠️ **E NÃO COBRA.** "Você está sumida" e "não perca o que rolou" são o texto
 * de todo app de rede social, e aqui cairiam numa gestante que pode estar
 * internada. A frase conta um fato e convida — há teste com regex.
 *
 * ⚠️ **Nem promete conteúdo clínico.** O que as amigas publicaram é o que elas
 * publicaram; um push dizendo "veja as novidades sobre a sua gestação" seria o
 * app prometendo, em nome de terceiros, o que não pode entregar.
 */
export function textoDoResumo(f: FatosDaSemana): { titulo: string; corpo: string } {
  const p = f.publicacoes;
  const titulo =
    f.pessoas === 1
      ? "Alguém que você acompanha publicou 💛"
      : `${f.pessoas} pessoas que você acompanha publicaram 💛`;
  return {
    titulo,
    corpo: p === 1 ? "1 publicação nova esta semana." : `${p} publicações novas esta semana.`,
  };
}

/**
 * O dia do disparo (0 = domingo, no fuso de São Paulo).
 *
 * ⚠️ Constante exportada e não um `0` solto no cron: é a mesma decisão do
 * resumo da Gratidão, e as duas precisam continuar caindo no MESMO dia.
 */
export const DIA_DO_RESUMO = 0;
