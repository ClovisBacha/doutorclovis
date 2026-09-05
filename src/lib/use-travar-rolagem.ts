import { useEffect } from "react";

/**
 * ENQUANTO A FOLHA ESTÁ ABERTA, A PÁGINA DE TRÁS NÃO ANDA.
 *
 * Medido no app da paciente: das folhas que cobrem a tela inteira, só a Loja
 * de Sementinhas travava o fundo. Nas outras, arrastar sobre o menu, sobre a
 * central de recados ou sobre a Central de Emergência rolava a página por
 * baixo — e ao fechar a folha ela estava noutro ponto da tela, sem ter pedido.
 * Nenhum app nativo faz isso: uma folha modal congela o que está atrás dela.
 *
 * ⚠️ **NÃO substitui o `overscroll-behavior` das listas.** São dois problemas:
 * aquele impede o ENCADEAMENTO quando a lista de dentro acaba; este impede a
 * página de trás de rolar por um arrasto que nem tocou na lista. Uma folha
 * sem lista rolável precisa só deste; uma com lista precisa dos dois.
 *
 * ⚠️ **GUARDA E RESTAURA o valor anterior, nunca `= ""`.** As folhas deste app
 * se empilham (a Loja abre sobre o Cantinho; a folha de motivo abre sobre a
 * conversa): com `""` no fim, a de cima ao fechar DESTRAVA a página com a de
 * baixo ainda aberta — e aí o fundo volta a correr, que é o defeito de volta
 * pela porta que veio consertá-lo.
 *
 * ⚠️ **O `finally` é o `return` do efeito**, e ele é obrigatório: uma folha
 * desmontada sem destravar deixa a página inteira do app congelada, e o
 * sintoma ("o app parou de rolar") não aponta para nada.
 */
export function useTravarRolagemDeFundo(ativo: boolean): void {
  useEffect(() => {
    if (!ativo) return;
    if (typeof document === "undefined") return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, [ativo]);
}
