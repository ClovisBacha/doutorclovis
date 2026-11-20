import { Image } from "expo-image";
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { luz } from "~/tema";

/**
 * O FUNDO DE LUZ (16/11/2026): no lugar do creme chapado, três brilhos largos
 * e fracos — pêssego no alto à esquerda, lilás no alto à direita, rosé
 * embaixo —, como a luz de estúdio de uma página da Apple. Fica PARADO atrás
 * da rolagem: o conteúdo passa por cima da luz, e o vidro da barra e do placar
 * tem cor para refratar (vidro sobre creme liso não mostra nada).
 *
 * ── Imagem, e não SVG (18/11/2026, "o app está travado") ──
 * Eram três degradês radiais em SVG de tela cheia: o react-native-svg pintava
 * 1179×2556 px três vezes, no fio principal, a cada tela que montava — no meio
 * da animação de empurrar a tela (a aula tem oito estados, todos com a luz).
 * Agora é `assets/luz.webp`: os mesmos três brilhos, desenhados uma vez com
 * as cores de `luz` do tema. A imagem é pequena (195×422, sem perda) e a GPU a
 * estica: os brilhos não têm detalhe, e o webp com perda, no tamanho cheio,
 * desenhava anéis nos degradês. Decodificada uma vez, fica no cache de memória.
 *
 * ⚠️ Mudou uma cor de `luz` no tema? Refaça a imagem: sobre `luz.base`, três
 * degradês radiais do tamanho da tela (centro x/y e raio em % dela; a cor some
 * até a borda do raio) — pêssego em 5%/0%, raio 62%, opacidade 0,9; lilás em
 * 100%/10%, raio 55%, 0,85; rosé em 25%/100%, raio 60%, 0,7. Os brilhos são
 * fracos de propósito: o texto escuro em cima mantém o contraste do creme.
 */
const LUZ = require("../../assets/luz.webp");

export const FundoDeLuz = memo(function FundoDeLuz() {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: luz.base }]}>
      <Image
        source={LUZ}
        style={StyleSheet.absoluteFill}
        contentFit="fill"
        cachePolicy="memory"
        transition={0}
        accessible={false}
      />
    </View>
  );
});
