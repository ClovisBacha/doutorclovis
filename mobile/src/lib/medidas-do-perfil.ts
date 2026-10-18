/**
 * A ALTURA E O PESO DE ANTES DA GESTAÇÃO, digitados no perfil — a régua da
 * curva de ganho de peso (`imcPreGestacional`, em `@/lib/curva-de-ganho`) e da
 * nutrição, e o que faltava para a conquista "Perfil Completo" existir no app
 * (o servidor a dá com os dois preenchidos, e o app não os pedia).
 *
 * As faixas são as do IMC do site (altura 100–250 cm, peso a partir de 25 kg):
 * fora delas a conta não vale, e gravar um número que a curva recusa é pior
 * que deixar em branco.
 * Sem react-native aqui: é testado pelo bun.
 */

export type Leitura = { ok: true; valor: number | null } | { ok: false };

function numero(t: string): number | null {
  const limpo = t.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(limpo)) return null;
  return Number(limpo);
}

/** Altura em centímetros. Aceita "1,65" (metros) e devolve 165. Vazio = sem altura. */
export function lerAltura(t: string): Leitura {
  if (!t.trim()) return { ok: true, valor: null };
  const n = numero(t);
  if (n == null) return { ok: false };
  const cm = n > 0 && n < 3 ? Math.round(n * 100) : Math.round(n);
  return cm >= 100 && cm <= 250 ? { ok: true, valor: cm } : { ok: false };
}

/** Peso em quilos, com uma casa decimal. Vazio = sem peso. */
export function lerPeso(t: string): Leitura {
  if (!t.trim()) return { ok: true, valor: null };
  const n = numero(t);
  if (n == null) return { ok: false };
  const kg = Math.round(n * 10) / 10;
  return kg >= 25 && kg <= 300 ? { ok: true, valor: kg } : { ok: false };
}

/** Como o número volta ao campo: com vírgula, sem ".0". */
export function mostrarMedida(v: unknown): string {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.round(n * 10) / 10).replace(".", ",");
}
