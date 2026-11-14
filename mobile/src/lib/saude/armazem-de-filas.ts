import type { PacoteLocal } from "@/lib/fila-local";
import { apagar, gravarJson, lerJson } from "~/lib/armazem";
import { ehBancada } from "~/lib/bancada";
import { filaDoBruto } from "./fila";

/**
 * O disco das filas: AsyncStorage, chave com o uid e prefixo "dc-" (apagada
 * ao sair da conta). Na bancada nada é lido nem gravado.
 */
export async function lerFila<T extends PacoteLocal>(
  chave: string,
  eh: (x: unknown) => x is T,
): Promise<T[]> {
  if (ehBancada()) return [];
  return filaDoBruto(await lerJson<unknown>(chave, []), eh, Date.now());
}

export async function gravarFila<T extends PacoteLocal>(chave: string, fila: readonly T[]) {
  if (ehBancada()) return;
  if (!fila.length) await apagar(chave);
  else await gravarJson(chave, fila);
}
