import { View } from "react-native";
import { T } from "~/componentes/base";
import { BolhaViva } from "~/componentes/movimento";
import { cor, espaco } from "~/tema";

export function CabecalhoDaMarca({ subtitulo }: { subtitulo?: string }) {
  return (
    <View style={{ alignItems: "center", gap: espaco.sm, paddingTop: espaco.xl }}>
      <BolhaViva humor="feliz" tamanho={128} />
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
