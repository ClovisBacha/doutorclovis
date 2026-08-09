/**
 * AS TRÊS ABAS DENTRO DO CARTÃO DA PACIENTE.
 *
 * ─── O DEFEITO ──────────────────────────────────────────────────────────────
 *
 * Abrir uma paciente entregava uma rolagem de ~440 linhas: bebê, ações,
 * prontuário com cinco seções, chips, emergências, ficha clínica e a conversa
 * com a IA. Tudo de uma vez, na mesma ordem, sempre. O médico que abre às 13h50
 * para decidir uma conduta rola por cima de meses de história para chegar no
 * que aconteceu esta semana.
 *
 * ─── COMO DIVIDI ────────────────────────────────────────────────────────────
 *
 * Pela PERGUNTA, e não pelo tipo de dado:
 *
 *  · Agora    — "o que eu faço com ela hoje?"  (o que pede olhar, o que mudou
 *               desde a última consulta, e os botões de agir)
 *  · História — "como ela chegou até aqui?"    (gráficos e linha do tempo)
 *  · Ficha    — "quem ela é?"                  (perfil clínico, alergias,
 *               medicações, e a conversa dela com a IA)
 *
 * ─── A REGRA QUE NÃO PODE SER ESQUECIDA ─────────────────────────────────────
 *
 * O contador SOBE PARA A ABA. É a mesma lição da fita principal do painel: ao
 * empurrar "registros fora de faixa sem desfecho" para dentro de uma aba, o
 * número que faz o médico olhar sumiria da tela — e a divisão que era para
 * organizar passaria a esconder trabalho clínico.
 *
 * Por isso este módulo existe separado do JSX: `contadorDaAba` é testável, e o
 * teste é o que impede alguém de "simplificar" tirando a soma.
 */

export const ABAS_DA_PACIENTE = ["Agora", "História", "Ficha"] as const;
export type AbaDaPaciente = (typeof ABAS_DA_PACIENTE)[number];

/** As cinco seções do prontuário, nomeadas. */
export type SecaoDoProntuario = "quem" | "mudou" | "pendentes" | "numeros" | "linha";

/**
 * Que seções do prontuário cada aba mostra.
 *
 * "quem" fica em Agora, e não em Ficha, de propósito: idade gestacional e
 * história de risco mudam a leitura de qualquer número da tela. Tirá-las da
 * primeira aba faria o médico ler "PA 135/88" sem saber que ela tem
 * pré-eclâmpsia prévia.
 */
export const SECOES_DA_ABA: Record<AbaDaPaciente, SecaoDoProntuario[]> = {
  Agora: ["quem", "pendentes", "mudou"],
  História: ["numeros", "linha"],
  Ficha: [],
};

/** Quanto trabalho espera em cada aba. */
export type ContagensDaPaciente = {
  /** Registros fora de faixa sem desfecho. */
  pendentes: number;
  /** Acionamentos de emergência sem desfecho. */
  sosAbertos: number;
};

/**
 * O número que a aba mostra.
 *
 * Soma pendentes e SOS em aba nenhuma além de "Agora": os dois são trabalho de
 * hoje, e é exatamente por isso que estão os dois na mesma aba. História e
 * Ficha não têm trabalho pendente — têm leitura.
 */
export function contadorDaAba(aba: AbaDaPaciente, c: ContagensDaPaciente): number {
  if (aba !== "Agora") return 0;
  /* Números negativos viriam de um `length` impossível ou de uma subtração
     errada lá em cima; somá-los esconderia trabalho de verdade. */
  return Math.max(0, c.pendentes) + Math.max(0, c.sosAbertos);
}

/**
 * Onde o cartão abre.
 *
 * Sempre em "Agora". Não é preferência: o cartão é aberto no meio de uma
 * consulta ou depois de um alerta, e nos dois casos a pergunta é "o que eu faço
 * com ela agora". História é para quando ele PROCURA a história.
 */
export const ABA_INICIAL_DA_PACIENTE: AbaDaPaciente = "Agora";
