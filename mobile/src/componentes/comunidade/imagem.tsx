import { Image, type ImageSource } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { degradeDaInicial, inicialDe } from "~/lib/comunidade/regras";
import { cor, fonte } from "~/tema";

/**
 * As imagens de exemplo da bancada — arquivos do site, nunca URL externa. O
 * endereço "bancada:<nome>" só aparece nos dados de `lib/comunidade/bancada.ts`;
 * o servidor manda URL `https:` assinada ou `data:`.
 */
const DA_BANCADA: Record<string, number> = {
  hero: require("../../../../src/assets/hero-pregnancy.jpg"),
  bastidores: require("../../../../src/assets/bastidores.jpg"),
  bebe: require("../../../../src/assets/social/bebe.webp"),
  nutricao: require("../../../../src/assets/social/nutricao.webp"),
};

export function fonteDaImagem(url: string): ImageSource | number {
  if (url.startsWith("bancada:")) return DA_BANCADA[url.slice(8)] ?? DA_BANCADA.hero;
  return { uri: url };
}

/**
 * O AVATAR do app inteiro — o topo das abas, as amigas, os pedidos, a dupla e
 * o perfil de uma amiga (18/11/2026: as Amigas tinham um avatar próprio, com
 * os pastéis do site e a inicial branca a 1,7:1, e a mesma pessoa aparecia com
 * duas cores na mesma tela).
 *
 * A foto, ou a inicial sobre o degradê da pessoa (estável pelo id), como o
 * monograma dos Contatos. `anel` desenha o fio branco que separa dois rostos
 * sobrepostos.
 */
export function Avatar({
  id,
  nome,
  url,
  tamanho = 40,
  anel = 0,
  estilo,
}: {
  id: string;
  nome: string;
  url: string | null | undefined;
  tamanho?: number;
  /** A espessura do anel branco (0 = sem anel). */
  anel?: number;
  estilo?: StyleProp<ViewStyle>;
}) {
  const base: StyleProp<ViewStyle> = [
    {
      width: tamanho,
      height: tamanho,
      borderRadius: tamanho / 2,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: url ? cor.apagado : degradeDaInicial(id)[1],
    },
    anel ? { borderWidth: anel, borderColor: cor.branco } : null,
    estilo,
  ];
  if (url) {
    return (
      <View style={base} accessible={false}>
        <Image
          source={fonteDaImagem(url)}
          style={{ width: tamanho, height: tamanho }}
          contentFit="cover"
          transition={150}
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }
  const letra = Math.max(13, Math.round((tamanho - 2 * anel) * 0.42));
  return (
    <View style={base} accessible={false}>
      <LinearGradient
        pointerEvents="none"
        colors={degradeDaInicial(id)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text
        style={{
          ...fonte.titulo,
          fontSize: letra,
          lineHeight: Math.round(letra * 1.2),
          letterSpacing: -0.5,
          color: cor.branco,
        }}
      >
        {inicialDe(nome)}
      </Text>
    </View>
  );
}
