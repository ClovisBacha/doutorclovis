import { funcaoDoServidor } from "~/servidor/ponte";

/**
 * As amigas — src/lib/amigas.functions.ts. Por ora só o NÚMERO que a faixa do
 * Caminho mostra (a lista e o perfil das amigas ainda não moram no app). Conta
 * o mesmo conjunto que a lista do site: as em Modo Cuidado ficam de fora, e no
 * luto da própria paciente o número é 0.
 */
export const contarAmigas = funcaoDoServidor<
  Record<string, never>,
  { ok: true; amigas: number } | { ok: false; amigas: number }
>("src/lib/amigas.functions.ts", "contarAmigas");
