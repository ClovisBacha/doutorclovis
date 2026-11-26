import { ActivityIndicator, Text, View } from "react-native";
import { ArteDaBolha } from "~/componentes/movimento";
import type { PoseDaBolha } from "~/lib/bolha/conversa";
import { cor, escala, espaco, fonte } from "~/tema";

/**
 * A BOLHA NA ESPERA (19/11/2026) — o "carregando" das telas do jogo, dito
 * por ela ("Estou abrindo a sua trilha…"), no lugar da rodinha sozinha com
 * "Carregando…". A rodinha continua, pequena, embaixo: a Bolha flutua
 * algumas voltas e descansa (`ArteDaBolha`), e sem a rodinha a tela parada
 * pareceria travada. Nada atrás dela.
 *
 * Só para a espera: a leitura que FALHOU continua sendo `NaoConsegueLer`
 * (vazio não é falha). No Modo Cuidado não há Bolha guia: lá, `Carregando`.
 */
export function BolhaNaEspera({
  texto,
  pose = "feliz",
}: {
  /** O que ela diz, com reticência ("Estou abrindo a aula…"). */
  texto: string;
  pose?: PoseDaBolha;
}) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={texto}
      style={{
        flex: 1,
        minHeight: 240,
        padding: espaco.xl,
        alignItems: "center",
        justifyContent: "center",
        gap: espaco.sm,
      }}
    >
      <ArteDaBolha humor={pose} tamanho={96} />
      <Text
        style={{
          textAlign: "center",
          ...fonte.media,
          ...escala.chamada,
          color: cor.textoCorpo,
        }}
      >
        {texto}
      </Text>
      <ActivityIndicator color={cor.primaria} style={{ marginTop: espaco.xs }} />
    </View>
  );
}
