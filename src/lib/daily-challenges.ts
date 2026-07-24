/**
 * Desafio diário — um texto próprio para CADA dia da jornada.
 *
 * Antes o desafio saía de uma listinha de 6 a 8 itens indexada por `D % n`: a
 * paciente reencontrava a mesma tarefa toda semana ("Beber 8 copos de água
 * hoje" aparecia 40 vezes na gestação). Agora cada dia tem redação própria,
 * ancorada no marco daquele dia — exame da janela, sintoma da fase, marco do
 * bebê — seguindo o mesmo ritmo pedagógico da aula da professora:
 *
 *   D%7 → 0 bebê · 1 corpo · 2 nutrição · 3 sinais · 4 exames · 5 vínculo · 6 revisão
 *
 * Cobertura: gestação D 7..300 (semanas 1 a 42) e pós-parto D 7..90 (as 12
 * semanas do 4º trimestre). Fora dessa faixa — DUM corrigida, jornada que
 * passa das 42 semanas — a listinha antiga segue como rede de segurança.
 */
import data from "./daily-challenges.data.json";

export type Challenge = { id: string; label: string; emoji: string };

type Table = Record<string, { label: string; emoji: string }>;
const GEST = data.gest as Table;
const POS = data.pos as Table;

/** Desafio da gestação no dia D, ou null se o dia estiver fora da faixa. */
export function gestChallenge(D: number): Challenge | null {
  const it = GEST[String(D)];
  return it ? { id: `g${D}`, label: it.label, emoji: it.emoji } : null;
}

/** Desafio do pós-parto no pseudo-dia D (idade do bebê + 7). */
export function posChallenge(D: number): Challenge | null {
  const it = POS[String(D)];
  return it ? { id: `p${D}`, label: it.label, emoji: it.emoji } : null;
}

/** Quantos dias de cada jornada têm desafio próprio (usado nos testes). */
export const CHALLENGE_COVERAGE = {
  gest: Object.keys(GEST).length,
  pos: Object.keys(POS).length,
};
