/**
 * AS BANDEIRAS VERMELHAS DO PARTO — a régua de IR À MATERNIDADE AGORA.
 *
 * São os quatro sinais da ACOG que NÃO dependem do cronômetro: a bolsa rota
 * sem contração, o sangramento vivo, a dor constante sem alívio, e o bebê se
 * mexendo menos. O cronômetro de contrações as mostra em todo estado, acima do
 * histórico — um cronômetro que só fala de intervalo ensina a esperar o padrão
 * fechar enquanto sangra.
 *
 * ⚠️ NO MODO CUIDADO A QUARTA SAI. O cronômetro FICA para quem perdeu a
 * gestação, porque ela pode estar em trabalho de parto — e era justamente essa
 * tela que dizia "o bebê estiver se mexendo menos que o normal" para quem já
 * não tem bebê para sentir. As três primeiras falam do corpo dela e valem
 * igual. Nada entra no lugar da quarta: um sinal clínico novo aqui é decisão
 * do médico, não deste arquivo.
 */
export const BANDEIRAS_DO_CORPO = [
  "a bolsa rompeu, mesmo sem contração nenhuma",
  "houver sangramento vermelho-vivo",
  "a dor for constante e forte, sem alívio entre as contrações",
] as const;

export const BANDEIRA_DO_BEBE = "o bebê estiver se mexendo menos que o normal";

/** As bandeiras que a tela desenha, na ordem, sem pontuação. */
export function bandeirasDoParto(careMode: boolean): string[] {
  return careMode ? [...BANDEIRAS_DO_CORPO] : [...BANDEIRAS_DO_CORPO, BANDEIRA_DO_BEBE];
}
