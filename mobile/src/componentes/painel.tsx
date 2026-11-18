import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { curva, espaco } from "~/tema";

/**
 * O PAINEL: um bloco solto sobre o céu, com o título dentro — como os cartões
 * do app Tempo da Apple. É o bloco das três abas (o bebê, as amigas, a trilha).
 *
 * É MATERIAL translúcido, e não vidro (17/11/2026): com o Liquid Glass, o
 * iPhone refazia o desfoque a cada quadro em que algo se mexia atrás (o céu
 * vivo) — medido no Instruments, era a maior parte do desenho da aba do bebê.
 * O céu ainda aparece de leve através dele, e entre um painel e outro.
 */
export function Painel({
  children,
  estilo,
}: {
  children: ReactNode;
  estilo?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          borderRadius: 34,
          ...curva,
          padding: 14,
          gap: espaco.md,
          backgroundColor: "rgba(250,248,255,0.86)",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: "rgba(255,255,255,0.9)",
          boxShadow: "0px 20px 44px -20px rgba(20,12,60,0.5)",
        },
        estilo,
      ]}
    >
      {children}
    </View>
  );
}
