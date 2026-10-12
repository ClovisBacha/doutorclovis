import { Image } from "expo-image";
import { ActivityIndicator, Text, View } from "react-native";
import { T } from "~/componentes/base";
import { TextoLeve } from "~/componentes/nutricao/TextoLeve";
import type { Turno } from "~/lib/nutricao/historico";
import { cor, espaco, fonte, raio, sombra } from "~/tema";

/** Uma bolha da conversa: ela à direita (vinho), a nutricionista à esquerda. */
export function Bolha({ turno }: { turno: Turno }) {
  const dela = turno.role === "user";
  if (dela) {
    return (
      <View style={{ alignSelf: "flex-end", maxWidth: "86%", gap: 6, alignItems: "flex-end" }}>
        {turno.foto ? (
          <Image
            source={{ uri: turno.foto }}
            accessibilityLabel="A foto que você mandou"
            style={{ width: 200, height: 200, borderRadius: raio.md, backgroundColor: cor.apagado }}
            contentFit="cover"
          />
        ) : null}
        <View
          style={{
            backgroundColor: cor.primaria,
            borderRadius: raio.lg,
            borderBottomRightRadius: 6,
            paddingHorizontal: espaco.lg,
            paddingVertical: espaco.md,
          }}
        >
          <Text style={{ fontFamily: fonte.media, fontSize: 16, lineHeight: 22, color: cor.branco }}>
            {turno.texto}
          </Text>
        </View>
      </View>
    );
  }
  const recado = turno.especie === "recado";
  return (
    <View
      style={[
        {
          alignSelf: "flex-start",
          maxWidth: "92%",
          backgroundColor: recado ? cor.atencaoFundo : cor.cartao,
          borderRadius: raio.lg,
          borderBottomLeftRadius: 6,
          paddingHorizontal: espaco.lg,
          paddingVertical: espaco.md,
        },
        recado ? null : sombra,
      ]}
    >
      <TextoLeve texto={turno.texto} />
    </View>
  );
}

/** A resposta enquanto chega; vazia, é o "escrevendo…". */
export function BolhaChegando({ texto }: { texto: string }) {
  return (
    <View
      style={[
        {
          alignSelf: "flex-start",
          maxWidth: "92%",
          backgroundColor: cor.cartao,
          borderRadius: raio.lg,
          borderBottomLeftRadius: 6,
          paddingHorizontal: espaco.lg,
          paddingVertical: espaco.md,
        },
        sombra,
      ]}
      accessibilityLiveRegion="polite"
    >
      {texto ? (
        <TextoLeve texto={texto} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
          <ActivityIndicator color={cor.nutricao} />
          <T tipo="apagado">A nutricionista está escrevendo…</T>
        </View>
      )}
    </View>
  );
}
