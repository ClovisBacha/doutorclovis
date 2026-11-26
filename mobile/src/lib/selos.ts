import { useSyncExternalStore } from "react";

/**
 * OS SELOS DA BARRA — o número em cima da Comunidade e das Amigas.
 *
 * Cada aba avisa o que é DELA: a Comunidade, as novidades da Atividade (quem
 * seguiu, pediu para seguir, reagiu, comentou, mencionou — o mesmo `novas` do
 * coração do topo do feed); as Amigas, os pedidos de amizade e o convite da
 * dupla, que é lá que se responde. Um número só para tudo diria "tem algo" sem
 * dizer onde.
 *
 * ⚠️ O estado só troca de identidade quando um número muda: um
 * `useSyncExternalStore` que devolve um objeto novo a cada leitura entra em
 * laço — e já deixou este app sem abrir (CLAUDE.md).
 * ⚠️ Leitura que falhou não mexe no selo: zerar diria "nada novo" sem saber.
 */
export type Selos = { comunidade: number; amigas: number };

const ZERO: Selos = { comunidade: 0, amigas: 0 };
let selos: Selos = ZERO;
const ouvintes = new Set<() => void>();

export function mudarSelos(parcial: Partial<Selos>) {
  const novo = { ...selos, ...parcial };
  if (novo.comunidade === selos.comunidade && novo.amigas === selos.amigas) return;
  selos = novo;
  ouvintes.forEach((f) => f());
}

/** Sem sessão ou no Modo Cuidado, a barra não conta nada. */
export function zerarSelos() {
  mudarSelos(ZERO);
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

/** O `getSnapshot` do `useSelos` — o mesmo objeto enquanto nada mudar. */
export const lerSelos = () => selos;

export function useSelos(): Selos {
  return useSyncExternalStore(assinar, lerSelos, lerSelos);
}

/**
 * O número das Amigas: os pedidos de amizade que esperam resposta e o convite
 * da dupla. No pós-parto a dupla some da aba (decisão do dono) — um convite
 * que ela não tem onde ver não conta.
 */
export function seloDasAmigas(
  pedidos: number,
  dupla: { estado: string } | null | undefined,
  pos: boolean,
): number {
  return Math.max(0, pedidos) + (!pos && dupla?.estado === "convite-recebido" ? 1 : 0);
}

/** O que o selo escreve: nada no zero, e nunca mais de dois caracteres. */
export function textoDoSelo(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 9 ? "9+" : String(Math.floor(n));
}

/** O que o leitor de tela diz da aba com selo. */
export function rotuloDaAba(titulo: string, n: number): string {
  if (!textoDoSelo(n)) return titulo;
  return `${titulo}, ${n} ${n === 1 ? "novidade" : "novidades"}`;
}
