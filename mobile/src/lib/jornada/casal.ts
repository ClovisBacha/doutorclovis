/**
 * QUANDO "PARA VOCÊS DOIS" ABRE — só na gestação, fora do Modo Cuidado, a partir
 * da 28ª semana.
 *
 * ⚠️ Decisão do dono, 26/10/2026. A sessão é preparação para o parto por
 * desenho (respirar junto, a mão na base das costas, a palavra combinada) e tem
 * voz gravada — o texto não muda sem regravar. Uma das falas diz que "o bebê já
 * reconhece a sua voz há semanas", o que não vale no 1º trimestre, e a sessão
 * abria desde ele. Na reta final, a preparação faz sentido e a frase é verdade.
 * As falas que prometem eficácia ("a coisa mais útil que existe no trabalho de
 * parto") ficam até uma regravação.
 *
 * Sem react-native aqui: é testado pelo bun.
 */

import { SESSAO_DO_CASAL, type BlocoDoCasal } from "@/lib/sessao-do-casal";
import { TEXTO_REGRAVADO } from "~/lib/audio/regravadas-texto";

export const SEMANA_DO_CASAL = 28;

export function casalAberto(o: {
  cuidado: boolean;
  posParto: boolean;
  semana: number | null | undefined;
}): boolean {
  return !o.cuidado && !o.posParto && typeof o.semana === "number" && o.semana >= SEMANA_DO_CASAL;
}

/**
 * Os blocos da sessão como o app os diz: o texto da fala regravada
 * (`docs/regravacao`) no lugar do do site — sem a promessa de eficácia. A voz
 * nova vem junto, de `VOZ_REGRAVADA`; sem a regravação, é o bloco do site.
 */
export function blocosDoCasalNoApp(
  regravadas: Readonly<Record<string, string>> = TEXTO_REGRAVADO,
): readonly BlocoDoCasal[] {
  return SESSAO_DO_CASAL.blocos.map((b) => {
    const texto = regravadas[b.id];
    return texto ? { ...b, texto } : b;
  });
}
