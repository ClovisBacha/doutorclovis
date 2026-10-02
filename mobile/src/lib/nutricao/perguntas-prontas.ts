/**
 * As perguntas tocáveis do topo. Mostram o que a nutricionista FAZ — comida
 * de verdade, o que dá para comer, o que fazer com o que tem em casa.
 *
 * ⚠️ No Modo Cuidado a do enjoo sai: enjoo aqui é da gestação, e a pergunta
 * pronta seria o app lembrando a gestação a quem a perdeu. Entra uma de
 * recuperação, que é o assunto legítimo depois de uma perda.
 */
export function perguntasProntas(cuidado: boolean): string[] {
  return cuidado
    ? [
        "O que comer para recuperar as forças?",
        "Tenho arroz, feijão e ovo — o que faço?",
        "Quais comidas têm mais ferro?",
      ]
    : [
        "Posso comer sushi?",
        "O que comer para enjoo?",
        "Tenho arroz, feijão e ovo — o que faço?",
      ];
}
