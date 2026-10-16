/**
 * A RESPIRAÇÃO 4-4-8 no tempo — em que fase ela está no segundo t.
 *
 * O compasso NÃO mora aqui: vem de `RESPIRO` em `@/lib/meditacao-sessao`, o
 * único lugar onde ele existe (o site e o app respiram no mesmo ritmo).
 * Sem react-native aqui: é testado pelo bun.
 */

import { CICLO, RESPIRO } from "@/lib/meditacao-sessao";

export type Fase = "inspire" | "segure" | "solte";

export const ROTULO_DA_FASE: Record<Fase, string> = {
  inspire: "Inspire",
  segure: "Segure",
  solte: "Solte",
};

export const DURACAO_DA_FASE: Record<Fase, number> = {
  inspire: RESPIRO.in,
  segure: RESPIRO.hold,
  solte: RESPIRO.out,
};

export type Instante = {
  ciclo: number;
  fase: Fase;
  /** Segundos inteiros que faltam na fase (4, 3, 2, 1). */
  restante: number;
  /** 0 → 1 dentro da fase. */
  progresso: number;
};

export function instanteNoTempo(segundos: number): Instante {
  const t = Math.max(0, segundos);
  const ciclo = Math.floor(t / CICLO);
  const dentro = t - ciclo * CICLO;
  let fase: Fase;
  let inicio: number;
  if (dentro < RESPIRO.in) {
    fase = "inspire";
    inicio = 0;
  } else if (dentro < RESPIRO.in + RESPIRO.hold) {
    fase = "segure";
    inicio = RESPIRO.in;
  } else {
    fase = "solte";
    inicio = RESPIRO.in + RESPIRO.hold;
  }
  const dur = DURACAO_DA_FASE[fase];
  const passado = dentro - inicio;
  return {
    ciclo,
    fase,
    restante: Math.max(1, Math.ceil(dur - passado - 1e-9)),
    progresso: Math.min(1, Math.max(0, passado / dur)),
  };
}

/** A sessão inteira, em segundos: ciclos inteiros, nunca cortada no meio. */
export function segundosDaSessao(totalCiclos: number): number {
  return Math.max(1, totalCiclos) * CICLO;
}

/** O mínimo que conta como meditação feita. */
export const MINIMO_SEGUNDOS = 60;

export function contaComoFeita(segundosFeitos: number): boolean {
  return segundosFeitos >= MINIMO_SEGUNDOS;
}

/** "1:05" */
export function relogio(segundos: number): string {
  const s = Math.max(0, Math.ceil(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export { CICLO, RESPIRO };
