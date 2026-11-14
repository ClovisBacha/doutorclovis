import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { toque } from "~/componentes/base";
import { BotaoVoltar, PilulaSos, voltarOu } from "~/componentes/cabecalho";
import { ALVO_MINIMO, cor, espaco, fonte } from "~/tema";

/** Volta; sem histórico (link aberto direto), cai no feed. */
export function voltar() {
  voltarOu("/comunidade");
}

/** A barra de cima das telas empilhadas da Comunidade: voltar, título, ação. */
export function Cabecalho({ titulo, direita }: { titulo: string; direita?: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: espaco.lg,
        gap: espaco.sm,
        minHeight: ALVO_MINIMO + 8,
        borderBottomWidth: 1,
        borderBottomColor: cor.borda,
        backgroundColor: cor.fundo,
      }}
    >
      <BotaoVoltar voltarPara="/comunidade" />
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        style={{
          flex: 1,
          fontFamily: fonte.titulo,
          fontSize: 18,
          color: cor.texto,
          textAlign: "center",
        }}
      >
        {titulo}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.xs }}>
        {direita}
        <PilulaSos />
      </View>
    </View>
  );
}

/** Botão redondo de ícone com 44 pt de alvo. */
export function BotaoIcone({
  rotulo,
  aoTocar,
  children,
  selo,
}: {
  rotulo: string;
  aoTocar: () => void;
  children: ReactNode;
  selo?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={selo ? `${rotulo} — ${selo} ${selo === 1 ? "nova" : "novas"}` : rotulo}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        width: ALVO_MINIMO,
        height: ALVO_MINIMO,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: ALVO_MINIMO / 2,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {children}
      {selo ? (
        <View
          style={{
            position: "absolute",
            top: 1,
            right: -2,
            minWidth: 22,
            height: 22,
            borderRadius: 11,
            paddingHorizontal: 5,
            backgroundColor: cor.urgente,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: cor.fundo,
          }}
        >
          <Text
            style={{ fontFamily: fonte.titulo, fontSize: 13, lineHeight: 16, color: cor.branco }}
          >
            {selo > 9 ? "9+" : selo}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
