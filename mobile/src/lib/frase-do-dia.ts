import { fraseDoDia } from "@/lib/frases-do-mascote";

/**
 * As frases do mascote que o APP não diz (a lista é do site, congelada).
 *
 * ⚠️ 21/10/2026: o registro de peso saiu do app, e a v1 não tem médico que
 * "vê" o que ela anota. A frase prometia as duas coisas.
 */
export const FRASES_FORA_DO_APP: ReadonlySet<string> = new Set([
  "Anotar seu peso hoje leva dez segundos — e o seu médico vê ⚖️",
]);

/**
 * A frase de hoje, sem as de fora. Quando o dia cai numa delas, vale a do dia
 * seguinte — a rotação do site (`dia % n`) segue a mesma no resto dos dias.
 */
export function fraseDoDiaNoApp(o: Parameters<typeof fraseDoDia>[0]): string | null {
  for (let passo = 0; passo < 3; passo++) {
    const f = fraseDoDia({ ...o, dia: o.dia + passo });
    if (f == null || !FRASES_FORA_DO_APP.has(f)) return f;
  }
  return null;
}
