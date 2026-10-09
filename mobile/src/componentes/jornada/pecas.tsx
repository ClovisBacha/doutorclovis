import { router } from "expo-router";
import { X } from "lucide-react-native";
import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { toque } from "~/componentes/base";
import { BolhaViva, type HumorDaBolha } from "~/componentes/movimento";
import { BotaoVoltar, PilulaSos } from "~/componentes/cabecalho";
import { Estouro } from "~/componentes/jornada/efeitos";
import { CORES_DO_CONFETE, corJornada } from "~/componentes/jornada/cores";
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

/* ── A bolha, porta-voz do app ─────────────────────────────────────────── */

export type Humor = HumorDaBolha;

export function Bolha({ humor, tamanho = 132 }: { humor: Humor; tamanho?: number }) {
  /* A bolha viva: o vídeo curto em laço de cada humor (movimento.tsx). A arte
     parada continua sendo o primeiro quadro e o que aparece com
     "reduzir movimento" ou na web. */
  return <BolhaViva humor={humor} tamanho={tamanho} />;
}

/** A bolha com um balão de fala ao lado. */
export function BolhaFalando({
  humor,
  fala,
  tamanho = 96,
}: {
  humor: Humor;
  fala: string;
  tamanho?: number;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
      <Bolha humor={humor} tamanho={tamanho} />
      <View
        style={{
          flex: 1,
          backgroundColor: cor.cartao,
          borderRadius: raio.md,
          borderWidth: 1,
          borderColor: corJornada.roxoClaro,
          paddingHorizontal: espaco.md,
          paddingVertical: espaco.sm,
        }}
      >
        <Text style={{ fontFamily: fonte.media, fontSize: 15, lineHeight: 21, color: cor.texto }}>
          {fala}
        </Text>
      </View>
    </View>
  );
}

/* ── Estrelas do dia ───────────────────────────────────────────────────── */

const CAMINHO_ESTRELA =
  "M12 2.6l2.83 5.74 6.33.92-4.58 4.47 1.08 6.3L12 17.06l-5.66 2.97 1.08-6.3L2.84 9.26l6.33-.92L12 2.6z";

export function Estrela({ acesa, tamanho = 18 }: { acesa: boolean; tamanho?: number }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
      <Path
        d={CAMINHO_ESTRELA}
        fill={acesa ? corJornada.estrela : corJornada.estrelaApagada}
        stroke={acesa ? "#d97706" : "#d6cbef"}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function Estrelas({
  feitos,
  total = 5,
  tamanho = 18,
}: {
  feitos: number;
  total?: number;
  tamanho?: number;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${feitos} de ${total} estrelas`}
      style={{ flexDirection: "row", gap: 2 }}
    >
      {/* Cada estrela que acende estoura (infla + faíscas) — em qualquer tela. */}
      {Array.from({ length: total }, (_, i) => (
        <Estouro key={i} ativo={i < feitos}>
          <Estrela acesa={i < feitos} tamanho={tamanho} />
        </Estouro>
      ))}
    </View>
  );
}

/* ── Confete (Animated puro) ───────────────────────────────────────────── */

export function Confete({ pecas = 36, altura = 800 }: { pecas?: number; altura?: number }) {
  const itens = useRef(
    Array.from({ length: pecas }, (_, i) => ({
      x: Math.random() * 100,
      atraso: Math.random() * 500,
      dur: 2200 + Math.random() * 1400,
      gira: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
      deriva: (Math.random() - 0.5) * 80,
      cor: CORES_DO_CONFETE[i % CORES_DO_CONFETE.length],
      larg: 7 + Math.random() * 6,
      redondo: Math.random() > 0.6,
      v: new Animated.Value(0),
    })),
  ).current;
  useEffect(() => {
    const anims = itens.map((p) =>
      Animated.timing(p.v, {
        toValue: 1,
        duration: p.dur,
        delay: p.atraso,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    Animated.parallel(anims).start();
    return () => anims.forEach((a) => a.stop());
  }, [itens]);
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, overflow: "hidden" }}
    >
      {itens.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: -20,
            width: p.larg,
            height: p.redondo ? p.larg : p.larg * 1.6,
            borderRadius: p.redondo ? p.larg : 2,
            backgroundColor: p.cor,
            opacity: p.v.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, altura] }) },
              { translateX: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, p.deriva] }) },
              {
                rotate: p.v.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", `${p.gira}deg`],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

/* ── Pulso (para o que pede um toque) ──────────────────────────────────── */

export function Pulsando({
  children,
  ativo = true,
  estilo,
}: {
  children: ReactNode;
  ativo?: boolean;
  estilo?: StyleProp<ViewStyle>;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ativo) return;
    const laco = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    laco.start();
    return () => laco.stop();
  }, [ativo, v]);
  return (
    <Animated.View
      style={[
        estilo,
        ativo && {
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/* ── Folha (de baixo para cima) ────────────────────────────────────────── */

export function Folha({
  aberta,
  aoFechar,
  children,
  titulo,
}: {
  aberta: boolean;
  aoFechar: () => void;
  children: ReactNode;
  titulo?: string;
}) {
  const baixo = useSafeAreaInsets().bottom;
  return (
    <Modal visible={aberta} transparent animationType="slide" onRequestClose={aoFechar}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={aoFechar}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: "rgba(41,20,19,0.35)",
          }}
        />
        <View
          style={{
            backgroundColor: cor.fundo,
            borderTopLeftRadius: raio.lg,
            borderTopRightRadius: raio.lg,
            paddingHorizontal: espaco.lg,
            paddingTop: espaco.sm,
            paddingBottom: Math.max(baixo, espaco.lg) + espaco.sm,
            gap: espaco.md,
          }}
        >
          <View style={{ alignItems: "center", paddingVertical: 4 }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: cor.borda }} />
          </View>
          {titulo ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
              <Text style={{ flex: 1, fontFamily: fonte.titulo, fontSize: 20, color: cor.texto }}>
                {titulo}
              </Text>
              <BotaoRedondo rotulo="Fechar" aoTocar={aoFechar}>
                <X size={20} color={cor.textoApagado} />
              </BotaoRedondo>
            </View>
          ) : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

export function BotaoRedondo({
  rotulo,
  aoTocar,
  children,
  fundo = cor.apagado,
}: {
  rotulo: string;
  aoTocar: () => void;
  children: ReactNode;
  fundo?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      hitSlop={6}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        width: ALVO_MINIMO,
        height: ALVO_MINIMO,
        borderRadius: ALVO_MINIMO / 2,
        backgroundColor: fundo,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

/* ── A barra do topo das telas empilhadas ──────────────────────────────── */

/** Voltar para a Jornada — e, se a tela foi aberta direto, ir para ela. */
export function voltarParaJornada() {
  if (router.canGoBack()) router.back();
  else router.replace("/jornada");
}

export function BarraDoTopo({
  titulo,
  progresso,
  fechar = false,
  aoSair,
}: {
  titulo?: string;
  /** 0 → 1: a barra de progresso da atividade. */
  progresso?: number;
  /** X (sair da atividade) em vez de seta. */
  fechar?: boolean;
  aoSair?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        minHeight: ALVO_MINIMO + 4,
      }}
    >
      <BotaoVoltar fechar={fechar} aoTocar={aoSair ?? voltarParaJornada} />
      {progresso != null ? (
        <View
          style={{
            flex: 1,
            height: 12,
            borderRadius: 6,
            backgroundColor: corJornada.estrelaApagada,
            overflow: "hidden",
          }}
        >
          <BarraQueEnche fracao={Math.min(1, Math.max(0, progresso))} />
        </View>
      ) : (
        <Text
          numberOfLines={1}
          style={{ flex: 1, fontFamily: fonte.forte, fontSize: 17, color: cor.texto }}
        >
          {titulo}
        </Text>
      )}
      <PilulaSos />
    </View>
  );
}

/* ── Fichinha (chip) ───────────────────────────────────────────────────── */

export function Ficha({
  rotulo,
  ativa,
  aoTocar,
  corAtiva = corJornada.roxo,
}: {
  rotulo: string;
  ativa?: boolean;
  aoTocar: () => void;
  corAtiva?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!ativa }}
      accessibilityLabel={rotulo}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        minHeight: ALVO_MINIMO,
        paddingHorizontal: espaco.lg,
        borderRadius: raio.pilula,
        borderWidth: 1.5,
        borderColor: ativa ? corAtiva : cor.borda,
        backgroundColor: ativa ? corJornada.roxoFundo : cor.cartao,
        justifyContent: "center",
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: ativa ? fonte.forte : fonte.media,
          fontSize: 15,
          color: ativa ? corJornada.roxoEscuro : cor.texto,
        }}
      >
        {rotulo}
      </Text>
    </Pressable>
  );
}

/** O preenchimento da barra de progresso: anda com mola até a fração nova. */
function BarraQueEnche({ fracao }: { fracao: number }) {
  const v = useRef(new Animated.Value(fracao)).current;
  useEffect(() => {
    Animated.spring(v, {
      toValue: fracao,
      useNativeDriver: false,
      speed: 14,
      bounciness: 6,
    }).start();
  }, [fracao, v]);
  return (
    <Animated.View
      style={{
        width: v.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
        height: "100%",
        borderRadius: 6,
        backgroundColor: corJornada.roxoMedio,
      }}
    />
  );
}
