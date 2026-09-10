/**
 * A RÉGUA DA SAÚDE DA FILA CLÍNICA — pura, e separada do servidor de propósito.
 *
 * ⚠️ **Enterrada dentro do handler, esta decisão não teria como ser
 * exercitada.** `saude-clinica.functions.ts` abre com `createServerFn`, pede
 * `supabaseAdmin` e exige token de super-admin: um teste dela só poderia
 * afirmar coisas sobre o TEXTO do arquivo — e este repositório já registrou
 * doze vezes que teste de texto fica verde exatamente sobre o defeito que ele
 * existe para pegar. Aqui as duas réguas são funções puras, e o teste RODA cada
 * desfecho.
 *
 * Quem faz as sondas continua sendo o servidor; quem decide o que cada resposta
 * QUER DIZER é este arquivo.
 */

/**
 * As doze fontes que a view deve unir, com o que cada uma carrega.
 *
 * ⚠️ **A ordem é de GRAVIDADE, e não alfabética.** Quem abre esta tela precisa
 * ver primeiro o que dói mais se estiver faltando — e a EPDS é a primeira
 * porque é a única que pode carregar ideação de autolesão.
 */
export const FONTES_CLINICAS = [
  { tabela: "epds_logs", nome: "EPDS (rastreio de depressão)", peso: "ideação de autolesão" },
  { tabela: "triage_logs", nome: "Triagem de sintomas", peso: "sintomas vermelhos" },
  { tabela: "panic_events", nome: "SOS", peso: "emergência" },
  { tabela: "health_logs", nome: "Pressão, glicemia, peso", peso: "pré-eclâmpsia" },
  { tabela: "contraction_sessions", nome: "Contrações", peso: "trabalho de parto prematuro" },
  { tabela: "kick_sessions", nome: "Movimentos do bebê", peso: "redução de movimento" },
  { tabela: "exam_files", nome: "Exames enviados", peso: "histórico" },
  { tabela: "journal_entries", nome: "Diário (só o rótulo de humor)", peso: "humor" },
  { tabela: "consultations", nome: "Consultas registradas", peso: "linha do tempo" },
  { tabela: "doctor_questions", nome: "Perguntas ao médico", peso: "dúvida clínica" },
  { tabela: "preconsulta_forms", nome: "Pré-consulta", peso: "preparo da consulta" },
  { tabela: "appointment_requests", nome: "Pedidos de consulta", peso: "agenda" },
] as const;

/**
 * OS CAMPOS QUE A VIEW PRECISA PROJETAR, e o que se perde quando ela não os
 * projeta.
 *
 * ⚠️ **`colunaDaTabela` é a coluna que PODE produzir o campo, e nunca o campo
 * em si.** `duracao_min` não existe em `kick_sessions`: ele é calculado na view
 * a partir de `ended_at - started_at`. Perguntar "a tabela tem `duracao_min`?"
 * seria perguntar por uma coluna que nunca existiu; o que se pergunta é
 * "existe sessão ENCERRADA?", porque é dela que o campo nasce.
 *
 * ⚠️ **E `sqlDaColuna` é OUTRO arquivo, de propósito.** `strength` nasce em
 * `APLICAR_FORCA_DO_MOVIMENTO.sql`; a projeção dela nasce no da view. São duas
 * pendências diferentes, com dois consertos diferentes, e juntá-las numa
 * mensagem só mandaria o dono rodar o arquivo errado.
 */
export const CAMPOS_CLINICOS = [
  {
    fonte: "kick_sessions",
    campo: "duracao_min",
    nome: "Duração da contagem de movimentos",
    peso: "duas horas sem chegar a 10 é o alarme vermelho",
    colunaDaTabela: "ended_at",
    sqlDaColuna: null,
  },
  {
    fonte: "kick_sessions",
    campo: "forca",
    nome: "Força do movimento",
    peso: "movimento mais fraco — aOR 2,53 (Heazell 2017)",
    colunaDaTabela: "strength",
    sqlDaColuna: "APLICAR_FORCA_DO_MOVIMENTO.sql",
  },
] as const;

/**
 * O que uma sonda devolveu.
 *
 * ⚠️ **TRÊS desfechos que não podem virar a mesma resposta:** `ausente` é
 * "falta rodar o APLICAR_ da tabela", `semColuna` é "falta rodar o APLICAR_ da
 * COLUNA", e `n === null` sem nenhum dos dois é "tente de novo". Juntar os dois
 * primeiros mandaria o dono rodar o arquivo errado; juntar com o terceiro faria
 * uma oscilação de rede virar uma pendência inventada.
 */
export type Sonda = { n: number | null; ausente: boolean; semColuna: boolean };

export type EstadoDaFonte = {
  tabela: string;
  nome: string;
  peso: string;
  /**
   * `ausente`      — a tabela não existe (falta rodar o APLICAR_ dela)
   * `fora_da_view` — a tabela TEM linhas e a view não devolve nenhuma: view velha
   * `ok`           — a tabela tem linhas e a view as devolve
   * `indeterminado`— a tabela existe e está vazia: não dá para concluir nada
   * `ilegivel`     — a leitura falhou
   */
  estado: "ausente" | "fora_da_view" | "ok" | "indeterminado" | "ilegivel";
  linhasNaTabela: number | null;
  linhasNaView: number | null;
};

export type EstadoDoCampo = {
  fonte: string;
  campo: string;
  nome: string;
  peso: string;
  /** O SQL que cria a coluna de origem, quando ela vem de um `APLICAR_` próprio. */
  sqlDaColuna: string | null;
  /**
   * `tabela_ausente` — a fonte não existe (falta o APLICAR_ dela)
   * `coluna_ausente` — a coluna de origem não existe: falta rodar `sqlDaColuna`
   * `fora_da_view`   — a tabela TEM linha que produz o campo e a view não o traz:
   *                    **a view está velha**
   * `ok`             — a view traz o campo
   * `indeterminado`  — nenhuma linha ainda pode produzir o campo
   * `ilegivel`       — a leitura falhou
   */
  estado:
    | "tabela_ausente"
    | "coluna_ausente"
    | "fora_da_view"
    | "ok"
    | "indeterminado"
    | "ilegivel";
  /** Linhas da tabela que PODEM produzir o campo (não o total da tabela). */
  linhasQuePodem: number | null;
  /** Linhas da view, daquela fonte, com o campo preenchido. */
  linhasComOCampo: number | null;
};

export type SaudeClinica = {
  ok: true;
  /** ⚠️ `false` quando a própria view não responde — aí nada abaixo vale. */
  viewExiste: boolean;
  fontes: EstadoDaFonte[];
  foraDaView: number;
  ausentes: number;
  campos: EstadoDoCampo[];
  /** Campos com dado na tabela que a view não projeta — ou seja, view velha. */
  camposForaDaView: number;
};

/** A fonte está na view? */
export function estadoDaFonte(
  tabela: Sonda,
  naView: Sonda,
  viewExiste: boolean,
): EstadoDaFonte["estado"] {
  if (tabela.ausente) return "ausente";
  if (tabela.n === null) return "ilegivel";
  /* ⚠️ Tabela vazia não prova nada sobre a view — e responder "ok" aqui seria
     exatamente a mentira que este controle existe para pegar. */
  if (tabela.n === 0) return "indeterminado";
  if (!viewExiste || naView.n === null) return "ilegivel";
  if (naView.n === 0) return "fora_da_view";
  return "ok";
}

/**
 * A view projeta o campo?
 *
 * ⚠️ **A ORDEM É A DO CONSERTO, e não a da gravidade:** sem a tabela não
 * adianta falar da coluna, e sem a coluna não adianta falar da view.
 */
export function estadoDoCampo(
  naTabela: Sonda,
  naView: Sonda,
  viewExiste: boolean,
): EstadoDoCampo["estado"] {
  if (naTabela.ausente) return "tabela_ausente";
  if (naTabela.semColuna) return "coluna_ausente";
  if (naTabela.n === null) return "ilegivel";
  /* Ninguém encerrou uma contagem ainda: a view pode estar certa ou velha, e
     esta tela não tem como saber. NUNCA "ok". */
  if (naTabela.n === 0) return "indeterminado";
  if (!viewExiste || naView.n === null) return "ilegivel";
  if (naView.n === 0) return "fora_da_view";
  return "ok";
}

/**
 * Quantas comparações de fato PROVARAM alguma coisa.
 *
 * ⚠️ Só `ok` e `fora_da_view` provam: as outras quatro são "não deu para
 * concluir". Contar `indeterminado` como conferido é como uma base vazia vira
 * um "está tudo certo".
 */
export function conferidas(d: Pick<SaudeClinica, "fontes" | "campos">): {
  fontes: number;
  campos: number;
} {
  const provou = (e: string) => e === "ok" || e === "fora_da_view";
  return {
    fontes: d.fontes.filter((f) => provou(f.estado)).length,
    campos: d.campos.filter((c) => provou(c.estado)).length,
  };
}

/**
 * A tela pode dizer que está tudo certo?
 *
 * ⚠️ **AS DUAS COMPARAÇÕES, e nunca uma.** Com um campo fora da view a caixa
 * verde apareceria a um centímetro de um alarme vermelho dizendo o contrário —
 * a contradição na mesma tela que este repositório já pagou uma vez. E ela é
 * PURA porque, escrita dentro do JSX, a única forma de cobrá-la seria procurar
 * a condição no texto do arquivo.
 */
export function podeDizerQueEstaCerto(
  d: Pick<SaudeClinica, "viewExiste" | "foraDaView" | "camposForaDaView">,
): boolean {
  return d.viewExiste && d.foraDaView === 0 && d.camposForaDaView === 0;
}
