import { Image } from "expo-image";
import { View } from "react-native";
import { T } from "~/componentes/base";
import { cor, espaco } from "~/tema";

const bolhaFeliz = require("../../../src/assets/bolha/feliz.webp");

export function CabecalhoDaMarca({ subtitulo }: { subtitulo?: string }) {
  return (
    <View style={{ alignItems: "center", gap: espaco.sm, paddingTop: espaco.xl }}>
      <Image
        source={bolhaFeliz}
        style={{ width: 120, height: 120 }}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
      <T tipo="titulo" centro>
        Obstétrica
      </T>
      {subtitulo ? (
        <T tipo="apagado" centro estilo={{ maxWidth: 300 }}>
          {subtitulo}
        </T>
      ) : null}
      <View
        style={{ height: 1, width: 48, backgroundColor: cor.primariaSuave, marginTop: espaco.sm }}
      />
    </View>
  );
}
