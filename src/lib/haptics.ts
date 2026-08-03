/**
 * Microtoque tátil — vibração curtíssima pra dar feedback de toque, estilo app
 * nativo.
 *
 * Passa por `tocarPadrao` (`nativo.ts`), e é essa a diferença que importa: no
 * app nativo do iPhone o `navigator.vibrate` não existe, e não vai passar a
 * existir — a Apple nunca implementou a Vibration API. A ponte traduz o padrão
 * em impactos do Haptics do Capacitor. Chamando `navigator.vibrate` direto,
 * como era antes, o iPhone ficava mudo e ninguém percebia, porque o no-op é
 * silencioso por definição.
 *
 * No Android e no navegador, `tocarPadrao` cai no próprio `navigator.vibrate`.
 * Onde não há suporte, segue no-op — nunca lança.
 */
import { tocarPadrao } from "@/lib/nativo";

export function hapticTap(): void {
  tocarPadrao([8]);
}

/**
 * Padrão de "chute" — um toque macio que cresce, como o bebê chutando de volta.
 * Usado no contador de chutes pra dar vínculo tátil mãe-bebê.
 *
 * O `0` inicial é uma vibração de duração zero, não uma pausa:
 * `navigator.vibrate` lê índice par como vibração e ímpar como pausa, então
 * `[0,25,40,55]` é "vibra 0, espera 25, vibra 40, espera 55" — um pulso só,
 * atrasado em 25 ms. Mantido como estava para não mudar o que a paciente já
 * conhece; a ponte ignora o pulso de zero e agenda o de 40 no tempo certo.
 */
export function hapticKick(): void {
  tocarPadrao([0, 25, 40, 55]);
}
