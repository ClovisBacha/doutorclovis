/**
 * OS RASTROS LOCAIS DE UMA CONTA, E A VASSOURA QUE OS TIRA.
 *
 * Num aparelho compartilhado (num consultório é o caso comum), a próxima conta
 * a entrar não pode encontrar nada da anterior: nem a jornada local
 * (`dc-path-*`, que ainda por cima seria RE-SUBIDA para a nuvem), nem o
 * marcador de sincronia, nem o retrato da home (que é a linha do perfil dela).
 *
 * ⚠️ A vassoura passa em DOIS lugares, e é por isso que ela é uma função e não
 * um laço copiado: no `signOut` da conta e na EXCLUSÃO da conta
 * (`excluir-conta.tsx`), que também sai da sessão e antes deixava tudo isto no
 * aparelho. Um laço copiado teria que ser lembrado nos dois — e não foi.
 */
import { PREFIXO_RETRATO_DA_HOME } from "@/lib/retrato-da-home";

export const PREFIXOS_DA_CONTA = ["dc-path-", PREFIXO_RETRATO_DA_HOME] as const;
export const CHAVES_DA_CONTA = ["dc-journey-synced-at"] as const;

/** É uma chave que pertence à conta que está saindo? */
export function ehRastroDaConta(chave: string): boolean {
  return (
    PREFIXOS_DA_CONTA.some((p) => chave.startsWith(p)) ||
    (CHAVES_DA_CONTA as readonly string[]).includes(chave)
  );
}

type Armazem = Pick<Storage, "length" | "key" | "removeItem">;

function armazem(): Armazem | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Tira do aparelho tudo o que é da conta. Devolve quantas chaves saíram. */
export function limparRastrosLocaisDaConta(storage: Armazem | null = armazem()): number {
  if (!storage) return 0;
  let tiradas = 0;
  try {
    for (let i = storage.length - 1; i >= 0; i--) {
      const k = storage.key(i);
      if (k && ehRastroDaConta(k)) {
        storage.removeItem(k);
        tiradas++;
      }
    }
  } catch {
    /* modo privado/quota: sem cache local a limpar */
  }
  return tiradas;
}
