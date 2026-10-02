import type { Turno } from "~/lib/nutricao/historico";
import { RESPOSTA_DO_SOCORRO_NO_APP } from "~/lib/nutricao/socorro";

/**
 * A conversa de exemplo da bancada (`/nutricao?bancada=1`). Entra nos MESMOS
 * estados da tela de produção; tem a forma do que o servidor devolveria —
 * respostas assinadas, uma delas em lista com negrito.
 */
export function conversaDeExemplo(): Turno[] {
  return [
    {
      id: "b1",
      role: "user",
      texto: "Posso comer sushi?",
      especie: "conversa",
    },
    {
      id: "b2",
      role: "assistant",
      texto:
        "Peixe **cru** fica fora da gestação: ele pode trazer bactérias e parasitas que fazem mal a você e ao bebê.\n\nDá para matar a vontade com as versões cozidas: hot roll, skin de salmão grelhado, sushi de kani ou de legumes. O arroz, a alga e o shoyu (com moderação) estão liberados.",
      especie: "conversa",
      assinatura: "bancada-1",
    },
    {
      id: "b3",
      role: "user",
      texto: "Tenho arroz, feijão e ovo — o que faço?",
      especie: "conversa",
    },
    {
      id: "b4",
      role: "assistant",
      texto:
        "Dá um prato completo! Uma ideia rápida:\n\n• **Arroz e feijão** como base — juntos eles formam uma proteína de qualidade.\n• **Ovo bem cozido** ou mexido até firmar: gema mole fica para depois do parto.\n• Se tiver, junte uma folha refogada (couve, espinafre) ou tomate.\n• De sobremesa, uma fruta com vitamina C, como laranja, ajuda a aproveitar o ferro do feijão.",
      especie: "conversa",
      assinatura: "bancada-2",
    },
  ];
}

/** O par do socorro, como a tela o monta (para `&estado=socorro`). */
export function socorroDeExemplo(): Turno[] {
  return [
    {
      id: "s1",
      role: "user",
      texto: "Estou com dor de cabeça forte e vendo pontinhos",
      especie: "socorro",
    },
    { id: "s2", role: "assistant", texto: RESPOSTA_DO_SOCORRO_NO_APP, especie: "socorro" },
  ];
}

/** O que a "nutricionista" da bancada responde a um envio (nada vai à rede). */
export const RESPOSTA_DA_BANCADA =
  "Esta é a bancada: nada foi enviado. No aparelho, a resposta da nutricionista aparece aqui enquanto chega.";
