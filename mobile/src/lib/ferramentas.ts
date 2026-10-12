/**
 * QUANDO as ferramentas da gestação aparecem — uma régua só, para o Início,
 * o hub da Saúde e as próprias telas não discordarem.
 *
 * - Movimentos do bebê: da 24ª semana em diante (antes disso os movimentos
 *   ainda não são regulares o bastante para contar). Nunca no Modo Cuidado,
 *   nunca depois do parto.
 * - Contrações: da 20ª semana em diante. FICA no Modo Cuidado (é socorro, não
 *   é conteúdo sobre o bebê); sai depois do parto.
 * - Semana desconhecida (sem DUM nem ultrassom): mostra — melhor oferecer a
 *   ferramenta que escondê-la de quem pode precisar.
 */
export const NOME_DOS_MOVIMENTOS = "Movimentos do bebê";

export function ferramentasDaGestacao(o: {
  semanas: number | null;
  cuidado: boolean;
  nasceu: boolean;
}): { movimentos: boolean; contracoes: boolean } {
  if (o.nasceu) return { movimentos: false, contracoes: false };
  const s = o.semanas;
  return {
    movimentos: !o.cuidado && (s == null || s >= 24),
    contracoes: s == null || s >= 20,
  };
}
