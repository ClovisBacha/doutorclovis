/**
 * A TRILHA DA SEMANA e a CHAMA — o que cada nó mostra.
 *
 * A chama é a régua do site (`@/lib/sequencia`): dias seguidos com ALGUM
 * momento, terminando hoje ou ontem, com um perdão a cada sete dias.
 * Sem react-native aqui: é testado pelo bun.
 */

import { perdoesRestantes, sequenciaDeDias } from "@/lib/sequencia";
import {
  contarMomentos,
  diasComAlgumMomento,
  diasFechados,
  flagsDoDia,
  type Blob,
} from "~/lib/jornada/momentos";

export type EstadoDoNo =
  | { tipo: "hoje"; momentos: number; fechado: boolean }
  | { tipo: "passado"; momentos: number; fechado: boolean }
  | { tipo: "futuro" };

export function estadoDoNo(blob: Blob, D: number, hojeD: number): EstadoDoNo {
  if (D > hojeD) return { tipo: "futuro" };
  const momentos = contarMomentos(flagsDoDia(blob, D));
  const fechado = diasFechados(blob).includes(D) || momentos >= 5;
  return { tipo: D === hojeD ? "hoje" : "passado", momentos: fechado ? 5 : momentos, fechado };
}

export function chama(blob: Blob, hojeD: number, pos = false): { dias: number; perdoes: number } {
  const dias = diasComAlgumMomento(blob, pos);
  return { dias: sequenciaDeDias(dias, hojeD), perdoes: perdoesRestantes(dias, hojeD) };
}

/** A frase da folha da chama — explica a regra do perdão sem cobrar nada. */
export function explicacaoDaChama(dias: number, perdoes: number): string[] {
  const linhas: string[] = [];
  if (dias <= 0) {
    linhas.push("A chama acende no dia em que você faz qualquer um dos momentos da jornada.");
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
