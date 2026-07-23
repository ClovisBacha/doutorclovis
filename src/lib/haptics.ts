/**
 * Microtoque tátil — vibração curtíssima pra dar feedback de toque, estilo app
 * nativo. Só funciona no Android (iOS PWA não tem Vibration API); onde não há
 * suporte, é no-op silencioso. Guardado pra nunca lançar.
 */
export function hapticTap(): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(8);
  } catch {
    /* sem vibração */
  }
}

/**
 * Padrão de "chute" — um toque macio que cresce, como o bebê chutando de volta.
 * Usado no contador de chutes pra dar vínculo tátil mãe-bebê (Android; no-op no
 * iOS PWA).
 */
export function hapticKick(): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate([0, 25, 40, 55]);
  } catch {
    /* sem vibração */
  }
}
