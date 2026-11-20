/**
 * A TRILHA DA SEMANA e a CHAMA — o que cada nó mostra.
 *
 * A chama é a régua do site (`@/lib/sequencia`): dias seguidos com ALGUM
 * momento, terminando hoje ou ontem, com um perdão a cada sete dias.
 * Sem react-native aqui: é testado pelo bun.
 */

import { perdoesRestantes, sequenciaDeDias } from "@/lib/sequencia";
import {
  CHAVE_FIGURINHAS,
  contarMomentos,
  diasComAlgumMomento,
  diasFechados,
  flagsDoDia,
  listaDeNumeros,
  type Blob,
} from "~/lib/jornada/momentos";

export type EstadoDoNo =
  | { tipo: "hoje"; momentos: number; fechado: boolean }
  | { tipo: "passado"; momentos: number; fechado: boolean }
  | { tipo: "futuro" };

export function estadoDoNo(blob: Blob, D: number, hojeD: number): EstadoDoNo {
  return estadoComFechados(blob, D, hojeD, new Set(diasFechados(blob)));
}

/** O mesmo `estadoDoNo`, com os dias fechados já lidos (a trilha lê o blob UMA vez). */
function estadoComFechados(
  blob: Blob,
  D: number,
  hojeD: number,
  fechados: ReadonlySet<number>,
): EstadoDoNo {
  if (D > hojeD) return { tipo: "futuro" };
  const momentos = contarMomentos(flagsDoDia(blob, D));
  const fechado = fechados.has(D) || momentos >= 5;
  return { tipo: D === hojeD ? "hoje" : "passado", momentos: fechado ? 5 : momentos, fechado };
}

/**
 * O que a trilha desenha de UMA semana: o estado dos sete nós, os pontinhos
 * da barra e a figurinha.
 */
export type ResumoDaSemana = {
  estados: readonly EstadoDoNo[];
  /** Os pontinhos da barra: o dia fechado (pelo blob ou pela lista de feitos). */
  feitos: readonly boolean[];
  figurinha: boolean;
};

function mesmoEstado(a: EstadoDoNo, b: EstadoDoNo): boolean {
  if (a.tipo !== b.tipo) return false;
  if (a.tipo === "futuro" || b.tipo === "futuro") return true;
  return a.momentos === b.momentos && a.fechado === b.fechado;
}

export function mesmoResumo(a: ResumoDaSemana, b: ResumoDaSemana): boolean {
  return (
    a.figurinha === b.figurinha &&
    a.estados.length === b.estados.length &&
    a.estados.every((e, i) => mesmoEstado(e, b.estados[i]!)) &&
    a.feitos.every((f, i) => f === b.feitos[i])
  );
}

/**
 * AS SEMANAS DA TRILHA, lidas do blob uma vez só (18/11/2026, a vistoria:
 * cada nó chamava `estadoDoNo`, que filtra a lista inteira de dias fechados —
 * 14 vezes por semana, a cada gravação no blob, em toda semana montada).
 *
 * Com `anterior`, a semana que não mudou devolve o MESMO objeto: marcar um
 * momento hoje redesenha a semana de hoje, e não a trilha inteira.
 */
export function resumirSemanas(
  blob: Blob,
  semanas: readonly number[],
  hojeD: number,
  anterior?: ReadonlyMap<number, ResumoDaSemana>,
): Map<number, ResumoDaSemana> {
  const fechados = new Set(diasFechados(blob));
  const figurinhas = new Set(listaDeNumeros(blob[CHAVE_FIGURINHAS]));
  const fora = new Map<number, ResumoDaSemana>();
  for (const w of semanas) {
    const estados: EstadoDoNo[] = [];
    const feitos: boolean[] = [];
    for (let D = w * 7; D <= w * 7 + 6; D++) {
      const e = estadoComFechados(blob, D, hojeD, fechados);
      estados.push(e);
      feitos.push(fechados.has(D) || (e.tipo !== "futuro" && e.fechado));
    }
    const novo: ResumoDaSemana = { estados, feitos, figurinha: figurinhas.has(w) };
    const velho = anterior?.get(w);
    fora.set(w, velho && mesmoResumo(velho, novo) ? velho : novo);
  }
  return fora;
}

export function chama(blob: Blob, hojeD: number, pos = false): { dias: number; perdoes: number } {
  const dias = diasComAlgumMomento(blob, pos);
  return { dias: sequenciaDeDias(dias, hojeD), perdoes: perdoesRestantes(dias, hojeD) };
}

/** A frase da folha da chama — explica a regra do perdão sem cobrar nada. */
export function explicacaoDaChama(dias: number, perdoes: number): string[] {
  const linhas: string[] = [];
  if (dias <= 0) {
    linhas.push("A chama acende no primeiro dia em que você fizer um momento, qualquer um.");
  } else if (dias === 1) {
    linhas.push("Um dia aceso. Amanhã, um momento qualquer já faz a chama crescer.");
  } else {
    linhas.push(`${dias} dias seguidos cuidando de você e aprendendo.`);
  }
  linhas.push(
    "Um momento basta para o dia contar: a aula, um exercício, uma respiração, a carta ou uma gratidão.",
  );
  linhas.push(
    "Se um dia escapar, a chama perdoa: a cada 7 dias seguidos você ganha um perdão, que cobre um dia em branco. Dois dias seguidos em branco apagam a chama.",
  );
  if (dias > 0) {
    linhas.push(
      perdoes === 0
        ? "Agora você ainda não tem perdão guardado."
        : perdoes === 1
          ? "Agora você tem 1 perdão guardado."
          : `Agora você tem ${perdoes} perdões guardados.`,
    );
  }
  return linhas;
}
