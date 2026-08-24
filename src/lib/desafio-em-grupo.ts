/**
 * O DESAFIO DA SEMANA EM GRUPO — a régua, longe do JSX e do banco.
 *
 * Pedido do dono: "a gente vai ter a aba que você consegue chamar as amigas pra
 * uma ofensiva, e dentro dessa ofensiva, se estiver completando, vocês ganham
 * mais sementinhas juntas" — agora do lado da criadora, com as seguidoras dela.
 *
 * ─── ⚠️ OPT-IN, E É ELE QUE IMPEDE O GRUPO COMPULSÓRIO ─────────────────────
 *
 * A tentação óbvia é juntar automaticamente todo mundo que tem o `ref_code` da
 * criadora. Não dá, e a razão está escrita em `influenciadora.functions.ts`: o
 * código foi TIRADO do grafo de amizade justamente para uma criadora não virar
 * amiga de três mil gestantes. Agrupar por `ref_code` recria o mesmo grupo por
 * fora — e `ref_code` é fixado UMA VEZ, então não haveria como sair.
 *
 * Aqui a paciente ENTRA, e pode SAIR. `desafio_participantes` guarda
 * CONSENTIMENTO, não contagem.
 *
 * ─── ⚠️ O CONTADOR É NÚMERO ABSOLUTO, NUNCA FRAÇÃO ─────────────────────────
 *
 * "3 de 300 fecharam" diz ao grupo inteiro que quase ninguém veio, e numa
 * comunidade de gestação de alto risco isso é a informação menos útil que a
 * tela poderia dar. E NUNCA a lista de quem fechou: seria a lista de seguidoras
 * da criadora, que este app decidiu não ter — nem a de quem NÃO fechou, que
 * seria pior ainda.
 *
 * ─── ⚠️ E O TÍTULO É DE CATÁLOGO FECHADO ───────────────────────────────────
 *
 * Campo livre aqui é conselho de saúde de leiga distribuído em massa com o nome
 * do consultório em volta. As opções são as quatro atividades de bem-estar que
 * o app já tem, e mais nenhuma.
 */

/** As atividades que o Caminho já grava no ledger (`wellness:<atividade>:…`). */
export const ATIVIDADES_DO_DESAFIO = [
  { chave: "movement", rotulo: "Mexer o corpo", emoji: "🤸" },
  { chave: "meditation", rotulo: "Meditar", emoji: "🌬️" },
  { chave: "bonding", rotulo: "Momento com o bebê", emoji: "💛" },
  { chave: "gratitude", rotulo: "Gratidão", emoji: "✨" },
] as const;

export type AtividadeDoDesafio = (typeof ATIVIDADES_DO_DESAFIO)[number]["chave"];

export function atividadeConhecida(c: string): c is AtividadeDoDesafio {
  return ATIVIDADES_DO_DESAFIO.some((a) => a.chave === c);
}

/**
 * Quantos dias da semana o desafio pede.
 *
 * ⚠️ Três, e não sete. Sete significa "não faltar um dia", e numa gestação de
 * alto risco a semana da internação existe — um desafio que quebra na primeira
 * noite no pronto-socorro é um desafio que ensina a não participar. Três dias
 * cabem numa semana difícil e ainda são hábito.
 */
export const DIAS_ALVO_PADRAO = 3;
export const DIAS_ALVO_MIN = 1;
export const DIAS_ALVO_MAX = 7;

/** Segunda-feira da semana de uma data `YYYY-MM-DD`. */
export function segundaDaSemana(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  /* `getUTCDay()`: 0 = domingo. A semana começa na segunda, então domingo
     recua seis dias, e não zero — foi o off-by-one que eu quase escrevi. */
  const diaDaSemana = t.getUTCDay();
  const recuo = diaDaSemana === 0 ? 6 : diaDaSemana - 1;
  const seg = new Date(t.getTime() - recuo * 86400000);
  return iso(seg);
}

/** Domingo da mesma semana. */
export function domingoDaSemana(dia: string): string {
  const seg = segundaDaSemana(dia);
  const [a, m, d] = seg.split("-").map(Number);
  return iso(new Date(Date.UTC(a, m - 1, d) + 6 * 86400000));
}

function iso(t: Date): string {
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(
    t.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** O desafio ainda está valendo nesta data? */
export function vigente(
  d: { inicio: string; fim: string; arquivadoEm?: string | null },
  hoje: string,
): boolean {
  if (d.arquivadoEm) return false;
  return hoje >= d.inicio && hoje <= d.fim;
}

/**
 * Quantos dias DELA contam para o desafio.
 *
 * Recebe os dias de calendário em que ela fez alguma atividade (de
 * `diasDeAtividade`, a mesma função que a dupla das Amigas usa — uma segunda
 * régua faria a dupla e o desafio discordarem sobre o mesmo dia) e devolve
 * quantos caem dentro da janela.
 */
export function diasNaJanela(dias: Iterable<string>, inicio: string, fim: string): number {
  let n = 0;
  for (const d of dias) if (d >= inicio && d <= fim) n += 1;
  return n;
}

/** Ela fechou o desafio? */
export function fechou(diasFeitos: number, diasAlvo: number): boolean {
  return diasFeitos >= diasAlvo;
}

/**
 * O que a tela mostra do grupo.
 *
 * ⚠️ **Número absoluto, e só quando há pelo menos duas.** Com uma pessoa só, o
 * "1 fechou" é ela mesma se olhando no espelho — e num desafio em GRUPO isso lê
 * como "ninguém veio". Abaixo de dois, a tela fala do esforço dela, não do
 * grupo.
 */
export const MINIMO_PARA_CONTAR = 2;

export function fraseDoGrupo(quantasFecharam: number): string | null {
  if (quantasFecharam < MINIMO_PARA_CONTAR) return null;
  return `${quantasFecharam} pessoas já fecharam esta semana`;
}

/**
 * A chave que paga o desafio, uma vez por pessoa por semana.
 *
 * ⚠️ Carrega o ID DO DESAFIO e a pessoa — nunca só a semana: duas criadoras
 * podem propor desafios na mesma semana, e uma chave por semana faria a
 * segunda ser engolida como duplicata.
 */
export function chaveDoDesafio(desafioId: string, userId: string): string {
  return `desafio:${desafioId}:${userId}`;
}
