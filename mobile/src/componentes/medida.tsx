import { View } from "react-native";
import { T } from "~/componentes/base";
import { cor, espaco, raio } from "~/tema";

/** O quadradinho de medida do bebê (tamanho, peso, "como"): Início e Bebê. */
export function Medida({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: cor.cartao,
        borderRadius: raio.md,
        padding: espaco.sm,
        gap: 2,
      }}
    >
      <T tipo="apagado" estilo={{ fontSize: 13 }}>
        {titulo}
      </T>
      <T tipo="rotulo" linhas={2} estilo={{ fontSize: 14 }}>
        {valor}
      </T>
    </View>
  );
}
