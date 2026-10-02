import { DeviceMotion } from "expo-sensors";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Platform,
  Pressable,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";

/**
 * O MOVIMENTO DO APP — um lugar só para tudo que se mexe.
 *
 * Regras de desenho:
 * - Movimento serve a um sentido (entrou, foi tocado, celebrou, respira).
 *   Nada gira sem motivo.
 * - "Reduzir movimento" do iOS desliga tudo aqui: a tela fica parada e
 *   completa, nunca vazia (useMovimentoReduzido).
 * - Só o motor nativo (useNativeDriver): opacidade e transform, nunca layout.
 * - A bolha viva é um vídeo curto em laço (gerado a partir da arte da
 *   própria bolha, fundo rosa da marca). Na web e com movimento reduzido,
 *   fica a arte parada — que é o primeiro quadro do vídeo.
 */

/* Cópia do `toque` de base.tsx: base importa este arquivo (a mola do
   Botao), então importar de lá daria um ciclo. */
function toque() {
  if (Platform.OS === "web") return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function useMovimentoReduzido(): boolean {
  const [reduzido, setReduzido] = useState(false);
  useEffect(() => {
    let vivo = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => vivo && setReduzido(r))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduzido);
    return () => {
      vivo = false;
      sub.remove();
    };
  }, []);
  return reduzido;
}

/* ── A bolha viva ─────────────────────────────────────────────────────── */

const VIDEOS = {
  feliz: require("../../assets/animacoes/bolha-ola.mp4"),
  comemorando: require("../../assets/animacoes/bolha-festa.mp4"),
  dormindo: require("../../assets/animacoes/bolha-sono.mp4"),
  estudiosa: require("../../assets/animacoes/bolha-estudiosa.mp4"),
  exercicio: require("../../assets/animacoes/bolha-exercicio.mp4"),
  apaixonado: require("../../assets/animacoes/bolha-apaixonado.mp4"),
  orgulhosa: require("../../assets/animacoes/bolha-orgulhosa.mp4"),
} as const;

const ARTES = {
  feliz: require("../../../src/assets/bolha/feliz.webp"),
  comemorando: require("../../../src/assets/bolha/comemorando.webp"),
  dormindo: require("../../../src/assets/bolha/dormindo.webp"),
  estudiosa: require("../../../src/assets/bolha/estudiosa.webp"),
  exercicio: require("../../../src/assets/bolha/exercicio.webp"),
  apaixonado: require("../../../src/assets/bolha/apaixonado.webp"),
  orgulhosa: require("../../../src/assets/bolha/orgulhosa.webp"),
} as const;

export type HumorDaBolha = keyof typeof VIDEOS;

/** O rosa do fundo dos vídeos (medido nos quadros), para o recorte sumir. */
export const ROSA_DO_VIDEO = "#FDDFE7";

/**
 * A bolha em movimento. `moldura` põe o vídeo num círculo rosa (para fundos
 * que não são rosa); sem moldura, o vídeo ocupa o quadrado, para cartões que
 * já são rosa da marca.
 */
export function BolhaViva({
  humor,
  tamanho = 120,
  moldura = true,
}: {
  humor: HumorDaBolha;
  tamanho?: number;
  moldura?: boolean;
}) {
  const reduzido = useMovimentoReduzido();
  const parada = reduzido || Platform.OS === "web";
  const forma: ViewStyle = {
    width: tamanho,
    height: tamanho,
    borderRadius: moldura ? tamanho / 2 : 0,
    overflow: "hidden",
    backgroundColor: moldura ? ROSA_DO_VIDEO : "transparent",
    alignItems: "center",
    justifyContent: "center",
  };
  if (parada) {
    return (
      <View style={forma} accessible={false}>
        <Flutuar desligado={reduzido}>
          <Image
            source={ARTES[humor]}
            style={{
              width: tamanho * (moldura ? 0.72 : 1),
              height: tamanho * (moldura ? 0.72 : 1),
            }}
            contentFit="contain"
          />
        </Flutuar>
      </View>
    );
  }
  return <VideoDaBolha humor={humor} forma={forma} tamanho={tamanho} moldura={moldura} />;
}

function VideoDaBolha({
  humor,
  forma,
  tamanho,
  moldura,
}: {
  humor: HumorDaBolha;
  forma: ViewStyle;
  tamanho: number;
  moldura: boolean;
}) {
  const player = useVideoPlayer(VIDEOS[humor], (p) => {
    p.loop = true;
    p.muted = true;
    p.audioMixingMode = "mixWithOthers";
    p.play();
  });
  /* Volta do segundo plano: o iOS pausa o vídeo; aqui ele volta a correr. */
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") player.play();
    });
    return () => sub.remove();
  }, [player]);
  /* O vídeo é 1:1 com a bolha ocupando ~62% do quadro: na moldura ele é
     ampliado para a bolha preencher o círculo como a arte parada preenche. */
  const escala = moldura ? 1.18 : 1;
  return (
    <View style={forma} accessible={false} pointerEvents="none">
      <VideoView
        player={player}
        style={{ width: tamanho * escala, height: tamanho * escala }}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
}

/* ── Entrada: o que chega na tela chega subindo ───────────────────────── */

export function Entrada({
  children,
  atraso = 0,
  deslocamento = 16,
  estilo,
}: {
  children: ReactNode;
  /** Em ms. Use passos de ~60 ms para uma lista entrar em cascata. */
  atraso?: number;
  deslocamento?: number;
  estilo?: StyleProp<ViewStyle>;
}) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduzido) {
      v.setValue(1);
      return;
    }
    Animated.timing(v, {
      toValue: 1,
      duration: 420,
      delay: atraso,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [atraso, reduzido, v]);
  return (
    <Animated.View
      style={[
        {
          opacity: v,
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [deslocamento, 0] }) },
          ],
        },
        estilo,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/* ── Flutuar: respiração lenta para artes ─────────────────────────────── */

export function Flutuar({
  children,
  amplitude = 5,
  periodo = 3200,
  desligado,
}: {
  children: ReactNode;
  amplitude?: number;
  periodo?: number;
  desligado?: boolean;
}) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduzido || desligado) return;
    const laco = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: periodo / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: periodo / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    laco.start();
    return () => laco.stop();
  }, [desligado, periodo, reduzido, v]);
  return (
    <Animated.View
      style={{
        transform: [
          {
            translateY: v.interpolate({ inputRange: [0, 1], outputRange: [amplitude, -amplitude] }),
          },
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/* ── Toque com mola: o que se toca afunda e volta ─────────────────────── */

export function useMolaDeToque(profundidade = 0.965) {
  const escala = useRef(new Animated.Value(1)).current;
  const reduzido = useMovimentoReduzido();
  const ir = (para: number) =>
    reduzido
      ? undefined
      : Animated.spring(escala, {
          toValue: para,
          useNativeDriver: true,
          speed: 40,
          bounciness: para === 1 ? 10 : 0,
        }).start();
  return {
    escala,
    aoPressionar: () => ir(profundidade),
    aoSoltar: () => ir(1),
  };
}

/* ── Inclinação 3D: o cartão que acompanha o celular e o dedo ─────────── */

const GRAUS_MAX = 7;

/* UMA assinatura do giroscópio para o app inteiro: a grade de conquistas tem
   dezenas de cartões, e cada um abrir o seu sensor seria bateria jogada fora.
   O primeiro cartão liga; o último que sai desliga; o app em segundo plano
   desliga também. */
type Ouvinte = (x: number, y: number) => void;
const ouvintes = new Set<Ouvinte>();
let assinatura: { remove: () => void } | null = null;
let assinaturaDoApp: { remove: () => void } | null = null;

function ligarSensor() {
  if (assinatura) return;
  let base: { b: number; g: number } | null = null;
  let suave = { x: 0, y: 0 };
  DeviceMotion.setUpdateInterval(60);
  assinatura = DeviceMotion.addListener(({ rotation }) => {
    if (!rotation) return;
    /* A posição em que ela segura o celular vira o "reto": o cartão inclina
       pela DIFERENÇA, e a base anda devagar atrás da mão — se ela muda de
       posição no sofá, o cartão volta a ficar reto em poucos segundos. */
    if (!base) base = { b: rotation.beta, g: rotation.gamma };
    const alvoX = Math.max(-1, Math.min(1, (rotation.beta - base.b) / 0.5));
    const alvoY = Math.max(-1, Math.min(1, (rotation.gamma - base.g) / 0.5));
    suave = { x: suave.x * 0.8 + alvoX * 0.2, y: suave.y * 0.8 + alvoY * 0.2 };
    base = {
      b: base.b * 0.995 + rotation.beta * 0.005,
      g: base.g * 0.995 + rotation.gamma * 0.005,
    };
    for (const o of ouvintes) o(suave.x, suave.y);
  });
}

function desligarSensor() {
  assinatura?.remove();
  assinatura = null;
}

function assinarInclinacao(o: Ouvinte): () => void {
  ouvintes.add(o);
  if (ouvintes.size === 1) {
    void DeviceMotion.isAvailableAsync()
      .then((ok) => ok && ouvintes.size > 0 && ligarSensor())
      .catch(() => {});
    assinaturaDoApp = AppState.addEventListener("change", (estado) =>
      estado === "active" && ouvintes.size > 0 ? ligarSensor() : desligarSensor(),
    );
  }
  return () => {
    ouvintes.delete(o);
    if (ouvintes.size === 0) {
      desligarSensor();
      assinaturaDoApp?.remove();
      assinaturaDoApp = null;
    }
  };
}

/**
 * Um cartão com profundidade: inclina com o movimento do celular (giroscópio,
 * suavizado) e afunda na direção do dedo ao tocar, com um brilho que corre
 * pela superfície. Desliga com "reduzir movimento" e quando o app sai da
 * tela (o sensor só escuta com o cartão montado e o app ativo).
 */
export function Inclinacao3D({
  children,
  aoTocar,
  rotuloAcessivel,
  estilo,
  raio = 24,
  brilho = true,
}: {
  children: ReactNode;
  aoTocar?: () => void;
  rotuloAcessivel?: string;
  estilo?: StyleProp<ViewStyle>;
  raio?: number;
  brilho?: boolean;
}) {
  const reduzido = useMovimentoReduzido();
  const rx = useRef(new Animated.Value(0)).current;
  const ry = useRef(new Animated.Value(0)).current;
  const escala = useRef(new Animated.Value(1)).current;
  const tamanho = useRef({ w: 1, h: 1 });
  const tocando = useRef(false);

  useEffect(() => {
    if (reduzido || Platform.OS === "web") return;
    return assinarInclinacao((x, y) => {
      if (tocando.current) return;
      rx.setValue(-x * GRAUS_MAX);
      ry.setValue(y * GRAUS_MAX);
    });
  }, [reduzido, rx, ry]);

  const mola = (v: Animated.Value, para: number) =>
    Animated.spring(v, { toValue: para, useNativeDriver: true, speed: 18, bounciness: 8 });

  const aoPressionar = (e: GestureResponderEvent) => {
    if (reduzido) return;
    tocando.current = true;
    const { locationX, locationY } = e.nativeEvent;
    const nx = (locationX / tamanho.current.w) * 2 - 1;
    const ny = (locationY / tamanho.current.h) * 2 - 1;
    Animated.parallel([
      mola(rx, ny * GRAUS_MAX),
      mola(ry, -nx * GRAUS_MAX),
      mola(escala, 0.975),
    ]).start();
  };
  const aoSoltar = () => {
    tocando.current = false;
    if (reduzido) return;
    Animated.parallel([mola(rx, 0), mola(ry, 0), mola(escala, 1)]).start();
  };

  const transform = [
    { perspective: 900 },
    { rotateX: rx.interpolate({ inputRange: [-90, 90], outputRange: ["-90deg", "90deg"] }) },
    { rotateY: ry.interpolate({ inputRange: [-90, 90], outputRange: ["-90deg", "90deg"] }) },
    { scale: escala },
  ];
  const corpo = (
    <Animated.View
      onLayout={(e) => {
        tamanho.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
      }}
      style={[{ borderRadius: raio, transform }, estilo]}
    >
      {children}
      {brilho && !reduzido ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            borderRadius: raio,
            overflow: "hidden",
            opacity: ry.interpolate({
              inputRange: [-GRAUS_MAX, 0, GRAUS_MAX],
              outputRange: [0.5, 0, 0.5],
            }),
          }}
        >
          <Animated.View
            style={{
              position: "absolute",
              top: -40,
              bottom: -40,
              width: "60%",
              transform: [
                {
                  translateX: ry.interpolate({
                    inputRange: [-GRAUS_MAX, GRAUS_MAX],
                    outputRange: [260, -120],
                  }),
                },
                { rotate: "18deg" },
              ],
            }}
          >
            <LinearGradient
              colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.55)", "rgba(255,255,255,0)"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
  if (!aoTocar) return corpo;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel}
      onPressIn={aoPressionar}
      onPressOut={aoSoltar}
      onPress={() => {
        toque();
        aoTocar();
      }}
    >
      {corpo}
    </Pressable>
  );
}

/* ── Pulso: o número que acabou de mudar ──────────────────────────────── */

export function Pulso({ children, chave }: { children: ReactNode; chave: string | number }) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(1)).current;
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    if (reduzido) return;
    v.setValue(1.25);
    Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 14 }).start();
  }, [chave, reduzido, v]);
  return <Animated.View style={{ transform: [{ scale: v }] }}>{children}</Animated.View>;
}
