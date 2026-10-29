import { RED_SYMPTOMS } from "@/lib/triage";

/**
 * Os sinais que a tela do SOS lista — o ÚNICO lugar do app com sinais de
 * alerta (decisão do dono, 21/10/2026: o app não faz triagem nem dá conduta).
 *
 * Os da GESTAÇÃO (movimentos do bebê, bolsa rompida, contrações antes de 37
 * semanas) não valem para quem já teve o bebê nem para quem está no Modo
 * Cuidado — listar "redução dos movimentos do bebê" a quem o perdeu é a pior
 * frase possível nesta tela.
 */
export function sinaisDeSocorro(o: { cuidado: boolean; nasceu: boolean }) {
  const daGestacao = new Set(["movimentos", "perda_liquido", "contracoes"]);
  if (!o.cuidado && !o.nasceu) return RED_SYMPTOMS;
  return RED_SYMPTOMS.filter((s) => !daGestacao.has(s.id));
}
