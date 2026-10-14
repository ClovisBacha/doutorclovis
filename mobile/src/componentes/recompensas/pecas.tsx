import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Animated, Platform, Pressable, Text, View, type ViewStyle } from "react-native";
import { toque } from "~/componentes/base";
import { useMolaDeToque } from "~/componentes/movimento";
import { corRecompensas } from "~/componentes/recompensas/cores";
import { ALVO_MINIMO, cor, espaco, fonte } from "~/tema";

/**
 * As peças das duas abas das Recompensas (Meu Cantinho e Conquistas): o
 * material dos cartões e dos botões do site, o silêncio do Modo Cuidado e o
 * esqueleto da leitura.
 */

/** O desfecho no dedo — fora da web (lá não há motor, e o navegador reclama). */
export function vibrar(tipo: "sucesso" | "erro") {
  if (Platform.OS === "web") return;
  void Haptics.notificationAsync(
    tipo === "sucesso"
      ? Haptics.NotificationFeedbackType.Success
      : Haptics.NotificationFeedbackType.Error,
  ).catch(() => {});
}

export function pares<T>(lista: readonly T[]): T[][] {
  const fora: T[][] = [];
  for (let i = 0; i < lista.length; i += 2) fora.push(lista.slice(i, i + 2));
  return fora;
}

/** A sombra `--shadow-card` do site. */
export const sombraDeCartao = {
  shadowColor: corRecompensas.sombra,
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;

/** O `card-material` do site: cartão claro, borda fina, luz no alto e sombra macia. */
export function CartaoMaterial({ children, estilo }: { children: ReactNode; estilo?: ViewStyle }) {
  return (
    <View
      style={[
        {
          borderRadius: 28,
          backgroundColor: cor.cartao,
          borderWidth: 1,
          borderColor: cor.borda,
          ...sombraDeCartao,
        },
        estilo,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * O BOTÃO DE PREÇO E O "EM USO": o `.btn-3d` do site — cor cheia, brilho no
 * alto, um fio de luz em cima e de sombra embaixo. E a pílula clara, o
 * `.pill-3d` ("Usar", "No cantinho ✓"): superfície quase branca no lugar do
 * contorno. Os dois afundam ao toque, como o `.press`.
 *
 * O desenho é o do site (26 px de altura, letra pequena), mas o ALVO tem os
 * 44 pt da Apple: o `hitSlop` estende o toque para fora do desenho.
 */
export function Botao3D({
  rotulo,
  acessivel,
  aoTocar,
  tipo,
  fundo = corRecompensas.esmeralda700,
  tinta,
  desligado,
}: {
  rotulo: string;
  /** O que o leitor de tela diz (quando o rótulo visível tem emoji ou número solto). */
  acessivel?: string;
  aoTocar?: () => void;
  tipo: "cheio" | "claro" | "selo";
  fundo?: string;
  tinta?: string;
  desligado?: boolean;
}) {
  const { escala, aoPressionar, aoSoltar } = useMolaDeToque(0.96);
  const cheio = tipo === "cheio";
  const corDaLetra = tinta ?? (cheio ? cor.branco : corRecompensas.esmeralda700);
  const desenho = (
    <Animated.View
      style={{
        transform: [{ scale: escala }],
        minHeight: 26,
        paddingHorizontal: espaco.md,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        backgroundColor: cheio ? fundo : corRecompensas.branco86,
        ...(tipo === "selo" && { backgroundColor: fundo }),
        ...(tipo !== "selo" && sombraDeCartao),
      }}
    >
      {tipo !== "selo" ? (
        <LinearGradient
          pointerEvents="none"
          colors={
            cheio
              ? [corRecompensas.branco16, corRecompensas.branco0]
              : [corRecompensas.branco50, corRecompensas.branco0]
          }
          locations={[0, cheio ? 0.55 : 0.6]}
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        />
      ) : null}
      {tipo !== "selo" ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: 1,
            backgroundColor: cheio ? corRecompensas.branco42 : cor.branco,
          }}
        />
      ) : null}
      {cheio ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 1,
            backgroundColor: corRecompensas.preto10,
          }}
        />
      ) : null}
      <Text
        numberOfLines={1}
        style={{ fontFamily: fonte.forte, fontSize: 13, lineHeight: 17, color: corDaLetra }}
      >
        {rotulo}
      </Text>
    </Animated.View>
  );
  if (!aoTocar) {
    return (
      <View accessible accessibilityLabel={acessivel ?? rotulo}>
        {desenho}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={acessivel ?? rotulo}
      accessibilityState={{ disabled: !!desligado }}
      disabled={desligado}
      hitSlop={{ top: 9, bottom: 9, left: 6, right: 6 }}
      onPressIn={aoPressionar}
      onPressOut={aoSoltar}
      onPress={() => {
        toque();
        aoTocar();
      }}
    >
      {desenho}
    </Pressable>
  );
}

export function SilencioDoCuidado() {
  return (
    <CartaoMaterial estilo={{ padding: 32, alignItems: "center", gap: espaco.lg }}>
      <Text
        style={{
          fontFamily: fonte.normal,
          fontSize: 15,
          lineHeight: 22,
          textAlign: "center",
          color: cor.texto,
        }}
      >
        Esta parte do aplicativo está em pausa enquanto o Modo Cuidado estiver ligado.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/perfil")}
        style={({ pressed }) => ({
          minHeight: ALVO_MINIMO,
          paddingHorizontal: espaco.xl,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: cor.borda,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ fontFamily: fonte.media, fontSize: 14, color: cor.texto }}>
          Ajustes do Modo Cuidado
        </Text>
      </Pressable>
    </CartaoMaterial>
  );
}

/** O esqueleto enquanto lê (o `TabSkeleton` do site): blocos claros no lugar do conteúdo. */
export function Esqueleto({ rotulo }: { rotulo: string }) {
  const bloco = (h: number) => (
    <View style={{ height: h, borderRadius: 24, backgroundColor: cor.apagado }} />
  );
  return (
    <View style={{ gap: espaco.md }} accessibilityLabel={rotulo}>
      {bloco(120)}
      {bloco(96)}
      <View style={{ flexDirection: "row", gap: espaco.md }}>
        <View style={{ flex: 1 }}>{bloco(140)}</View>
        <View style={{ flex: 1 }}>{bloco(140)}</View>
      </View>
    </View>
  );
}
