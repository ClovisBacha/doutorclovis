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

/**
 * A VIBRAÇÃO DA RESPIRAÇÃO (23/11/2026, o dono: "deixar tremendo enquanto
 * respira, que nem a Apple faz no modo dela de respirar"). Como no Respirar
 * do Apple Watch, ela SENTE o ritmo e pode respirar de olhos fechados:
 *
 * - inspire: toques que vão apertando o passo (de 420 ms a 150 ms entre um e
 *   outro) e ganhando força — o peito enchendo;
 * - segure: nada (a pausa é o silêncio);
 * - solte: toques macios que vão espaçando (de 240 ms a 820 ms) — o ar saindo.
 *
 * `ms` conta do começo da fase. Sem react-native aqui: é testado pelo bun.
 */
export type ForcaDoToque = "macio" | "leve" | "medio";
export type ToqueDoRespiro = { ms: number; forca: ForcaDoToque };

const PASSO_DO_TOQUE: Record<Exclude<Fase, "segure">, readonly [number, number]> = {
  inspire: [420, 150],
  solte: [240, 820],
};

export function toquesDaFase(fase: Fase): ToqueDoRespiro[] {
  if (fase === "segure") return [];
  const dur = DURACAO_DA_FASE[fase] * 1000;
  const [de, ate] = PASSO_DO_TOQUE[fase];
  const fora: ToqueDoRespiro[] = [];
  /* O último toque cai antes do fim: a fase seguinte começa com o dela. */
  for (let t = 0; t < dur - 120; ) {
    const p = t / dur;
    const forca: ForcaDoToque =
      fase === "inspire"
        ? p < 0.45
          ? "macio"
          : p < 0.85
            ? "leve"
            : "medio"
        : p < 0.3
          ? "leve"
          : "macio";
    fora.push({ ms: Math.round(t), forca });
    t += de + (ate - de) * p;
  }
  return fora;
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
