import { Minus, Plus } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { toque } from "~/componentes/base";
import { ALVO_MINIMO, cor, fonte, raio } from "~/tema";

/**
 * O PASSO — um número grande com + em cima e − embaixo: a hora e os minutos da
 * agenda e a hora do nascimento. Em JavaScript, sem seletor nativo (funciona
 * na bancada e não pede módulo novo).
 */
export function Passo({
  valor,
  rotulo,
  aoMenos,
  aoMais,
}: {
  valor: string;
  rotulo: string;
  aoMenos: () => void;
  aoMais: () => void;
}) {
  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <BotaoDoPasso rotulo={`Mais ${rotulo}`} aoTocar={aoMais}>
        <Plus size={20} color={cor.agenda} />
      </BotaoDoPasso>
      <Text
        accessibilityLabel={`${valor} ${rotulo}`}
        style={{
          minWidth: 72,
          textAlign: "center",
          fontFamily: fonte.titulo,
          fontSize: 40,
          color: cor.texto,
          fontVariant: ["tabular-nums"],
        }}
      >
        {valor}
      </Text>
      <BotaoDoPasso rotulo={`Menos ${rotulo}`} aoTocar={aoMenos}>
        <Minus size={20} color={cor.agenda} />
      </BotaoDoPasso>
    </View>
  );
}

function BotaoDoPasso({
  rotulo,
  aoTocar,
  children,
}: {
  rotulo: string;
  aoTocar: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        width: ALVO_MINIMO + 8,
        height: ALVO_MINIMO,
        borderRadius: raio.pilula,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? cor.agenda : cor.agendaFundo,
      })}
    >
      {children}
    </Pressable>
  );
}
