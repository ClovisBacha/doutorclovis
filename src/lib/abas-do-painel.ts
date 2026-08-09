/**
 * AS ABAS DO PAINEL DO MÉDICO — de quinze para cinco.
 *
 * ─── O DEFEITO ──────────────────────────────────────────────────────────────
 *
 * Quinze abas numa fita rolável de uma linha só. Num monitor, a nona já
 * aparece cortada; num celular, a última fica uns mil pixels à direita. O
 * médico não descobre o que existe — ele precisa lembrar de rolar.
 *
 * Pedido do dono (ago/2026): no máximo cinco abas.
 *
 * ─── COMO AGRUPEI ───────────────────────────────────────────────────────────
 *
 * Por PERGUNTA QUE ELE ESTÁ FAZENDO, não por tela:
 *
 *  · Cérebro     — "o que a IA aprendeu e o que ela não soube?"
 *  · Pacientes   — "o que esta pessoa mandou?"  (pré-consulta e exame só
 *                  existem grudados a uma paciente)
 *  · Agenda      — "quem tem hora marcada?"
 *  · Painel      — "como vai o consultório?" (e o alcance: Engajamento, Lives)
 *
 * "Ferramentas" (receituário e pedido de exame) deixou de ser aba em ago/2026:
 * ela obrigava o médico a escolher a paciente DE NOVO, no fim do fluxo, depois
 * de já ter estado na ficha dela. Os modelos moram dentro do cartão da
 * paciente, onde ele já sabe de quem se trata.
 *
 * "Perguntas" entra em Cérebro porque é o mesmo ciclo: ela pergunta, ele
 * responde, o cérebro aprende. Era a alternativa que eu tinha levantado como
 * discutível; ficou aqui porque separá-la deixaria a fila de aprendizado
 * dividida em dois lugares que se olham.
 *
 * "Clínica" e "Meu Perfil" saem da fita e vão para o menu do perfil (a bolinha
 * do canto). Clínica só aparece num plano — não merece um quinto do espaço de
 * todo mundo.
 *
 * ─── A DECISÃO QUE FAZ ISTO NÃO QUEBRAR NADA ────────────────────────────────
 *
 * O estado continua sendo a aba FOLHA (`tab`), exatamente como era. O grupo é
 * DERIVADO dela por `grupoDe`.
 *
 * Isso não é elegância: é o que faz as dezenas de `setTab("Teleconsultas")`
 * espalhadas pelo painel — em cartões, em callbacks, no resumo do app —
 * continuarem funcionando sem serem tocadas, cada uma selecionando o grupo
 * certo sozinha.
 * Um segundo estado "grupo atual" precisaria ser sincronizado em cada um
 * desses pontos, e o primeiro esquecido deixaria a fita mostrando um grupo e o
 * corpo mostrando outro.
 */

/**
 * A lista de abas mora AQUI, e o painel a importa.
 *
 * Estava dentro de `painel.tsx`, que tem 11 mil linhas. Trazê-la para um
 * módulo sem JSX é o que permite testar o agrupamento sem montar a tela — e
 * impede a lista de virar duas, que é como quatro telas deste produto já
 * ficaram implementadas e inalcançáveis.
 */
export const PANEL_TABS = [
  "Painel 📊",
  "Calendário",
  "Perguntas",
  "Cérebro 🧠",
  "Lives",
  "Engajamento",
  "Pacientes 👩‍🍼",
  "Clínica 🏥",
  "Meu Perfil",
] as const;

export type PanelTab = (typeof PANEL_TABS)[number];

export type ChaveDeGrupo = "cerebro" | "pacientes" | "agenda" | "painel";

export type GrupoDeAbas = {
  chave: ChaveDeGrupo;
  rotulo: string;
  /** As abas que moram dentro. A PRIMEIRA é onde o grupo abre. */
  filhas: readonly PanelTab[];
};

export const GRUPOS: readonly GrupoDeAbas[] = [
  /* ─── PAINEL PRIMEIRO, E A RAZÃO MUDOU ────────────────────────────────────
     O Cérebro vinha na frente por uma regra que era verdadeira: "o painel de
     números diz o que ACONTECEU; o cérebro é onde ele MUDA o que vai
     acontecer". Abrir num relatório fazia o produto parecer um relatório.

     O que virou a regra do avesso não foi gosto: foi a FILA DE TRABALHO mudar
     de lugar (ago/2026). Ela vivia num cabeçalho repetido em todas as telas —
     emergências, pacientes esperando, pré-consultas por ler — e agora mora
     dentro do Painel. Com ela dentro, o Painel deixou de ser o que aconteceu e
     passou a ser o que AINDA PRECISA DELE. Aterrissar numa fila de trabalho é
     melhor que aterrissar em qualquer outra coisa.

     Pedido do dono: "tira esse painel aí de cima, que aparece em todas as
     telas, e transfere tudo pra esse painel unificado, que pode ser a nossa
     primeira aba". */
  /* "Lives" veio para cá quando o grupo Ferramentas acabou. Não é sobra: as
     três respondem a mesma pergunta — "como vai o consultório e o meu alcance?"
     — e nenhuma delas é sobre uma paciente específica. */
  { chave: "painel", rotulo: "Painel 📊", filhas: ["Painel 📊", "Engajamento", "Lives"] },
  { chave: "cerebro", rotulo: "Cérebro 🧠", filhas: ["Cérebro 🧠", "Perguntas"] },
  /* ─── UMA ABA SÓ DE PACIENTES (ago/2026) ──────────────────────────────────
     Eram três: Pacientes, Pré-consultas e Exames. As duas últimas listavam
     coisas que só existem GRUDADAS a uma paciente, e o médico chegava nelas por
     um caminho que não passava pela paciente — lia uma pré-consulta com 175/115
     sem ver o prontuário de quem a mandou.
     Agora é uma tela só: a grade das pacientes, as solicitações, e as duas
     caixas de entrada como SEÇÕES logo abaixo. Pedido do dono: "você vai
     eliminar aquela questão de pré-consultas e exames ali em cima, e vai ser
     somente uma única aba de paciente". */
  { chave: "pacientes", rotulo: "Pacientes 👩‍🍼", filhas: ["Pacientes 👩‍🍼"] },
  /* ─── UMA AGENDA SÓ, QUE É O CALENDÁRIO (ago/2026) ────────────────────────
     Eram quatro: Agendamentos, Calendário, Teleconsultas e Consultas Pagas. O
     médico via a consulta presencial numa aba e a teleconsulta do mesmo dia
     noutra, e nenhuma respondia "como está o meu dia".
     Agora o calendário é a tela, e as três listas são seções abaixo dele — cada
     uma continua inteira, com os botões que sempre teve. Pedido do dono: "não
     vai existir mais essa questão de agendamentos e teleconsultas em cima, vai
     ser tudo focado no calendário". */
  { chave: "agenda", rotulo: "Agenda 📅", filhas: ["Calendário"] },
] as const;

/**
 * As abas que existem mas NÃO estão na fita — alcançadas pelo menu do perfil.
 *
 * Declaradas aqui, e não esquecidas: é esta lista que o teste de "aba órfã"
 * consulta para saber que elas têm outro caminho. Uma tela que existe e não é
 * alcançável é pior que uma que não existe, porque ninguém a procura.
 */
export const FORA_DA_FITA: readonly PanelTab[] = ["Meu Perfil", "Clínica 🏥"] as const;

/** O grupo a que uma aba pertence. `null` para as que ficam fora da fita. */
export function grupoDe(aba: PanelTab): ChaveDeGrupo | null {
  for (const g of GRUPOS) {
    if (g.filhas.includes(aba)) return g.chave;
  }
  return null;
}

/** Onde um grupo abre quando o médico toca nele. */
export function abaDeEntradaDoGrupo(chave: ChaveDeGrupo): PanelTab {
  const g = GRUPOS.find((x) => x.chave === chave);
  /* Nunca acontece com as constantes acima; a alternativa seria `!` e um
     `undefined` silencioso virando `tab` — tela em branco sem erro. */
  if (!g) throw new Error(`grupo desconhecido: ${chave}`);
  return g.filhas[0];
}

/**
 * O contador que o GRUPO mostra: a soma dos contadores das filhas.
 *
 * ─── Por que isto é a parte mais importante deste arquivo ───────────────────
 *
 * Hoje o número em "Perguntas" é o que faz o médico ir até lá. Ao empurrar
 * Perguntas para dentro de Cérebro, o número sumiria da fita — e a fusão que
 * era para revelar as telas passaria a esconder justamente o sinal que faz
 * alguém abri-las. O contador sobe para o pai; a filha guarda o dela para
 * dizer, lá dentro, ONDE está o trabalho.
 */
export function somaDoGrupo(
  chave: ChaveDeGrupo,
  porAba: Partial<Record<PanelTab, number>>,
): number {
  const g = GRUPOS.find((x) => x.chave === chave);
  if (!g) return 0;
  return g.filhas.reduce((soma, f) => soma + (porAba[f] ?? 0), 0);
}

/** Todas as abas que a fita alcança, em ordem de leitura. */
export function abasNaFita(): PanelTab[] {
  return GRUPOS.flatMap((g) => [...g.filhas]);
}
