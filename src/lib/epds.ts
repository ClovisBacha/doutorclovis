/**
 * A RÉGUA DA EPDS — o nível, num lugar só.
 *
 * A Escala de Edinburgh (EPDS) tem dez perguntas; a **décima é ideação de
 * autolesão** ("o pensamento de me machucar ocorreu a mim"). O nível que sai
 * daqui é o que decide se o obstetra recebe um e-mail urgente e se o evento
 * entra na fila de trabalho dele.
 *
 * ⚠️ **ESTE ARQUIVO EXISTE PORQUE A RÉGUA MORAVA NUMA ROTA.** Ela era a função
 * `interpret` dentro de `src/routes/epds.tsx` — a página PÚBLICA. A aba
 * Pós-parto do app da paciente, que faz o MESMO rastreio, não tinha como
 * importá-la (a catraca `rotas-sem-export-solto` proíbe export não-rota num
 * arquivo de rota, e com razão: ele entra no pedaço que toda página baixa).
 *
 * O resultado foi o pior defeito clínico que este repositório já teve: as duas
 * telas rodavam o mesmo questionário e só uma alertava o médico. Ver o
 * comentário de `saveEpdsLog`.
 *
 * ⚠️ **A questão 10 GANHA DO ESCORE TOTAL, sempre.** Uma paciente pode somar 8
 * (abaixo do corte de 13) e ainda assim ter respondido que pensou em se
 * machucar. O corte serve para depressão; a questão 10 serve para risco de
 * vida, e nenhum total a rebaixa.
 */

export type NivelDaEpds = "baixo" | "moderado" | "alto" | "urgente";

/**
 * ⚠️ **13 é o corte de rastreio positivo, e 10 o de atenção.** São os pontos
 * publicados da escala — não são gosto, e mexer neles muda quem o obstetra
 * recebe na fila. Qualquer mudança aqui é decisão clínica, não de código.
 */
export const CORTE_RASTREIO_POSITIVO = 13;
export const CORTE_ATENCAO = 10;

/**
 * O nível de um rastreio.
 *
 * @param score  soma das dez respostas (0–30)
 * @param q10    a resposta da questão 10 (0–3) — ideação de autolesão
 */
export function nivelDaEpds(score: number, q10: number): NivelDaEpds {
  /* ⚠️ Primeiro, e sem depender do total. */
  if (q10 > 0) return "urgente";
  if (score >= CORTE_RASTREIO_POSITIVO) return "alto";
  if (score >= CORTE_ATENCAO) return "moderado";
  return "baixo";
}

/**
 * ⚠️ **A questão 10 é a DÉCIMA — índice 9.** Escrito aqui porque os dois
 * chamadores liam `answers[9]` à mão, e um off-by-one silencioso trocaria
 * ideação de autolesão por "eu me senti triste": o alerta urgente sairia pela
 * pergunta errada, ou não sairia.
 */
export const INDICE_DA_QUESTAO_10 = 9;

/** A resposta da questão 10 a partir da lista, com 0 quando ela não existe. */
export function respostaDaQuestao10(respostas: readonly (number | null)[]): number {
  const v = respostas[INDICE_DA_QUESTAO_10];
  return typeof v === "number" && v > 0 ? v : 0;
}
