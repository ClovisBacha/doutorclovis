import { useSyncExternalStore } from "react";

/**
 * Sinal global "o header está sobre um fundo escuro?" — usado para a troca
 * inteligente da logo (branca sobre o hero escuro/noite; rosa nos demais
 * casos). O hero da home publica o estado (sky.isDark); o header consome.
 * Store externo simples para evitar provider/context no shell raiz.
 */
let darkHero = false;
const listeners = new Set<() => void>();

export function setHeroDark(value: boolean) {
  if (darkHero === value) return;
  darkHero = value;
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useHeroDark(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => darkHero,
    () => false, // SSR: assume claro (logo rosa) até hidratar
  );
}
