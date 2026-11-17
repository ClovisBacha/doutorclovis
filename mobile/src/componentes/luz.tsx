import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { luz } from "~/tema";

/**
 * O FUNDO DE LUZ (16/11/2026): no lugar do creme chapado, três brilhos largos
 * e fracos — pêssego no alto à esquerda, lilás no alto à direita, rosé
 * embaixo —, como a luz de estúdio de uma página da Apple. Fica PARADO atrás
 * da rolagem: o conteúdo passa por cima da luz, e o vidro da barra e do placar
 * tem cor para refratar (vidro sobre creme liso não mostra nada).
 *
 * É SVG, e não imagem: não pesa no pacote, não serrilha e acompanha qualquer
 * tamanho de tela. Os brilhos são fracos de propósito — o texto preto em cima
 * continua com o contraste do creme.
 */
export const FundoDeLuz = memo(function FundoDeLuz() {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: luz.base }]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="luz-pessego" cx="5%" cy="0%" r="62%">
            <Stop offset="0" stopColor={luz.pessego} stopOpacity={0.9} />
            <Stop offset="1" stopColor={luz.pessego} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="luz-lilas" cx="100%" cy="10%" r="55%">
            <Stop offset="0" stopColor={luz.lilas} stopOpacity={0.85} />
            <Stop offset="1" stopColor={luz.lilas} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="luz-rose" cx="25%" cy="100%" r="60%">
            <Stop offset="0" stopColor={luz.rose} stopOpacity={0.7} />
            <Stop offset="1" stopColor={luz.rose} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#luz-pessego)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#luz-lilas)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#luz-rose)" />
      </Svg>
    </View>
  );
});
