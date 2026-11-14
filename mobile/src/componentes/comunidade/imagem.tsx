import { Image, type ImageSource } from "expo-image";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { corDaInicial, inicialDe } from "~/lib/comunidade/regras";
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

/** Avatar: a foto, ou a inicial sobre a cor da pessoa (estável pelo id). */
export function Avatar({
  id,
  nome,
  url,
  tamanho = 40,
  estilo,
}: {
  id: string;
  nome: string;
  url: string | null | undefined;
  tamanho?: number;
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
      backgroundColor: url ? cor.apagado : corDaInicial(id),
    },
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
  return (
    <View style={base} accessible={false}>
      <Text
        style={{
          fontFamily: fonte.titulo,
          fontSize: Math.max(13, Math.round(tamanho * 0.42)),
          color: cor.branco,
        }}
      >
        {inicialDe(nome)}
      </Text>
    </View>
  );
}
