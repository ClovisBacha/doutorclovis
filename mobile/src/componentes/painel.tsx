import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Vidro } from "~/componentes/vidro";
import { espaco } from "~/tema";

/**
 * O PAINEL: um bloco de vidro solto sobre o céu, com o título dentro — como os
 * cartões do app Tempo da Apple. O céu aparece entre um painel e outro, e
 * através deles. Dentro, os cartões de conteúdo seguem sendo material branco:
 * é neles que se lê. É o bloco das três abas (o bebê, as amigas, a trilha).
 */
export function Painel({
  children,
  estilo,
}: {
  children: ReactNode;
  estilo?: StyleProp<ViewStyle>;
}) {
  return (
    <Vidro
      forma={34}
      flutua={false}
      tinta="rgba(255,255,255,0.62)"
      estilo={[
        {
          padding: 14,
          gap: espaco.md,
          boxShadow: "0px 20px 44px -20px rgba(20,12,60,0.5)",
        },
        estilo,
      ]}
    >
      {children}
    </Vidro>
  );
}
