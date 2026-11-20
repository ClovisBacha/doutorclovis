import { ROTULO_DO_SOM, type SomKey } from "@/lib/som-receitas";

/**
 * OS RÓTULOS DOS SONS COMO O APP OS ESCREVE — os do site (`ROTULO_DO_SOM`,
 * congelado), com três legendas trocadas (21/10/2026: o app não é conselho
 * médico, e nunca dá gênero ao bebê).
 *
 * - O "Secador" era "o som que acalma recém-nascido" — um jeito de acalmar o
 *   bebê, e oferecido também no Modo Cuidado, a quem perdeu o bebê.
 * - O "Ventre" dizia "o que ELE ouve aí dentro" (no pós-parto, nem é verdade).
 * - O "Ritmo de ninar" dizia "140 por minuto": é o batimento que ela conhece do
 *   pré-natal, e o som é um oscilador — o próprio site já tinha tirado "do
 *   doppler" pelo mesmo motivo.
 *
 * A catraca do teste confere que o site ainda diz a legenda trocada.
 */
export const LEGENDA_DO_SOM_NO_APP: Readonly<
  Partial<Record<SomKey, { site: string; app: string }>>
> = {
  coracao: { site: "batida regular, 140 por minuto", app: "batida regular, de ninar" },
  ventre: {
    site: "o seu, é o que ele ouve aí dentro",
    app: "batida lenta, como se ouve por dentro",
  },
  secador: { site: "o som que acalma recém-nascido", app: "sopro constante, morno, sem pausa" },
};

export const ROTULO_DO_SOM_NO_APP = Object.fromEntries(
  Object.entries(ROTULO_DO_SOM).map(([k, r]) => {
    const t = LEGENDA_DO_SOM_NO_APP[k as SomKey];
    return [k, t && t.site === r.sub ? { ...r, sub: t.app } : r];
  }),
) as typeof ROTULO_DO_SOM;
