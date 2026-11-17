import { DeviceMotion } from "expo-sensors";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Flame } from "lucide-react-native";
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
import { parametroDaBancada } from "~/lib/bancada";

/**
 * O MOVIMENTO DO APP — um lugar só para tudo que se mexe.
 *
 * Regras de desenho:
 * - Movimento serve a um sentido (entrou, foi tocado, celebrou, respira).
 *   Nada gira sem motivo.
 * - "Reduzir movimento" do iOS desliga tudo aqui: a tela fica parada e
 *   completa, nunca vazia (useMovimentoReduzido).
 * - Só o motor nativo (useNativeDriver): opacidade e transform, nunca layout.
 * - A bolha viva é a ARTE dela (fundo transparente, nítida), animada aqui:
 *   flutua e balança de leve. Até 16/11/2026 era um vídeo
 *   em laço com fundo rosa — vinha num disco rosa e ficava desfocado quando
 *   ampliado ("vamos tirar esse fundo rosa que veio acompanhando", o dono).
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

const ARTES = {
  feliz: require("../../../src/assets/bolha/feliz.webp"),
  comemorando: require("../../../src/assets/bolha/comemorando.webp"),
  dormindo: require("../../../src/assets/bolha/dormindo.webp"),
  estudiosa: require("../../../src/assets/bolha/estudiosa.webp"),
  exercicio: require("../../../src/assets/bolha/exercicio.webp"),
  apaixonado: require("../../../src/assets/bolha/apaixonado.webp"),
  orgulhosa: require("../../../src/assets/bolha/orgulhosa.webp"),
  /* Os três da gamificação usam a arte mais próxima, com o enfeite por cima
     (as estrelas em órbita, o presente, a chama): ver `EnfeiteDoHumor`. */
  estrelas: require("../../../src/assets/bolha/comemorando.webp"),
  presente: require("../../../src/assets/bolha/feliz.webp"),
  chama: require("../../../src/assets/bolha/orgulhosa.webp"),
} as const;

export type HumorDaBolha = keyof typeof ARTES;

/** A arte parada também tem a SURPRESA (a visita de madrugada, o dia cheio). */
export type HumorDaArte = HumorDaBolha | "surpresa";

/**
 * A bolha pequena, só flutuando devagar (ao lado de uma fala, num cartão).
 */
export function ArteDaBolha({ humor, tamanho }: { humor: HumorDaArte; tamanho: number }) {
  const fonte = humor === "surpresa" ? ARTE_SURPRESA : ARTES[humor];
  return (
    <Flutuar>
      <Image
        source={fonte}
        style={{ width: tamanho, height: tamanho }}
        contentFit="contain"
        accessible={false}
      />
    </Flutuar>
  );
}

const ARTE_SURPRESA = require("../../../src/assets/bolha/surpresa.webp");

/**
 * A BOLHA VIVA: a arte da bolha, solta sobre qualquer fundo (o céu, um cartão,
 * uma folha), sem moldura, disco nem brilho atrás — NADA acompanha a bolha
 * (uma aura clara que testei virava um quadrado sobre o céu escuro, no
 * iPhone). Ela flutua e balança de leve; nos humores da gamificação, o
 * enfeite por cima. Com "reduzir movimento", a mesma bolha, parada.
 *
 * `moldura` ficou no contrato por quem ainda a passa: não faz mais nada (era o
 * círculo rosa do vídeo).
 */
export function BolhaViva({
  humor,
  tamanho = 120,
}: {
  humor: HumorDaBolha;
  tamanho?: number;
  moldura?: boolean;
}) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduzido) return;
    const passo = (para: number) =>
      Animated.timing(v, {
        toValue: para,
        duration: 2600,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      });
    const laco = Animated.loop(Animated.sequence([passo(1), passo(0)]));
    laco.start();
    return () => laco.stop();
  }, [reduzido, v]);
  return (
    <View
      accessible={false}
      pointerEvents="none"
      style={{ width: tamanho, height: tamanho, alignItems: "center", justifyContent: "center" }}
    >
      <Flutuar desligado={reduzido} amplitude={Math.max(3, tamanho * 0.035)} periodo={3600}>
        <Animated.View
          style={{
            transform: [
              {
                rotate: v.interpolate({ inputRange: [0, 1], outputRange: ["-3deg", "3deg"] }),
              },
            ],
          }}
        >
          <Image
            source={ARTES[humor]}
            style={{ width: tamanho * 0.94, height: tamanho * 0.94 }}
            contentFit="contain"
          />
        </Animated.View>
      </Flutuar>
      <EnfeiteDoHumor humor={humor} tamanho={tamanho} v={v} parado={reduzido} />
    </View>
  );
}

/** O que cada humor da gamificação traz por cima da bolha. */
function EnfeiteDoHumor({
  humor,
  tamanho,
  v,
  parado,
}: {
  humor: HumorDaBolha;
  tamanho: number;
  v: Animated.Value;
  parado: boolean;
}) {
  const gira = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (parado || humor !== "estrelas") return;
    const laco = Animated.loop(
      Animated.timing(gira, {
        toValue: 1,
        duration: 7000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    laco.start();
    return () => laco.stop();
  }, [parado, humor, gira]);
  const canto = { position: "absolute", right: 0, bottom: 0 } as const;
  const pulsa = { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] }) };
  if (humor === "estrelas") {
    const raio = tamanho * 0.5;
    return (
      <Animated.View
        style={{
          position: "absolute",
          width: tamanho,
          height: tamanho,
          transform: [
            { rotate: gira.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) },
          ],
        }}
      >
        {[0, 120, 240].map((graus) => {
          const rad = (graus * Math.PI) / 180;
          return (
            <Animated.Text
              key={graus}
              allowFontScaling={false}
              style={{
                position: "absolute",
                left: tamanho / 2 + Math.cos(rad) * raio - tamanho * 0.08,
                top: tamanho / 2 + Math.sin(rad) * raio - tamanho * 0.1,
                fontSize: tamanho * 0.16,
                color: "#ffd24a",
                textShadowColor: "rgba(255,190,60,0.9)",
                textShadowRadius: 6,
                transform: [pulsa],
              }}
            >
              ★
            </Animated.Text>
          );
        })}
      </Animated.View>
    );
  }
  if (humor === "presente")
    return (
      <Animated.Text
        allowFontScaling={false}
        style={{ ...canto, fontSize: tamanho * 0.3, transform: [pulsa] }}
      >
        🎁
      </Animated.Text>
    );
  if (humor === "chama")
    return (
      <Animated.View style={{ ...canto, transform: [pulsa] }}>
        <Flame size={tamanho * 0.34} color="#e2560f" fill="#ff9d4d" strokeWidth={2} />
      </Animated.View>
    );
  return null;
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
 * A PARALAXE do topo do bebê (16/11/2026): dois valores de -1 a 1 que seguem a
 * inclinação do celular — `x` de um lado para o outro, `y` para frente e para
 * trás. Cada camada do céu os multiplica por uma distância diferente (o fundo
 * anda pouco e ao contrário, o bebê anda mais), e é isso que dá a profundidade
 * da tela de bloqueio do iPhone.
 *
 * Sem sensor (o simulador, a web), uma deriva lenta no lugar: o céu continua
 * vivo. Com "reduzir movimento", os dois ficam em zero. Tudo no fio nativo
 * (`useNativeDriver`), para andar junto da rolagem sem engasgar.
 */
export function useParalaxe(): { x: Animated.Value; y: Animated.Value } {
  const reduzido = useMovimentoReduzido();
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduzido) return;
    let deriva: Animated.CompositeAnimation | null = null;
    const ate = (v: Animated.Value, para: number, ms: number) =>
      Animated.timing(v, {
        toValue: para,
        duration: ms,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      });
    const derivar = () => {
      deriva = Animated.parallel([
        Animated.loop(Animated.sequence([ate(x, 0.7, 3400), ate(x, -0.7, 6800), ate(x, 0, 3400)])),
        Animated.loop(Animated.sequence([ate(y, -0.5, 2600), ate(y, 0.5, 5200), ate(y, 0, 2600)])),
      ]);
      deriva.start();
    };
    if (Platform.OS === "web") {
      /* Na bancada as fotos precisam sair iguais: parado. `&mover=1` liga a deriva. */
      if (parametroDaBancada("mover") === "1") derivar();
      return () => deriva?.stop();
    }
    let vivo = true;
    let soltar: (() => void) | null = null;
    const seguir = (v: Animated.Value, para: number) =>
      Animated.timing(v, {
        toValue: para,
        duration: 90,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();
    void DeviceMotion.isAvailableAsync()
      .then((ok) => {
        if (!vivo) return;
        if (!ok) return derivar();
        soltar = assinarInclinacao((frente, lado) => {
          seguir(x, lado);
          seguir(y, frente);
        });
      })
      .catch(() => vivo && derivar());
    return () => {
      vivo = false;
      soltar?.();
      deriva?.stop();
    };
  }, [reduzido, x, y]);
  return { x, y };
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
  estiloDeFora,
}: {
  children: ReactNode;
  aoTocar?: () => void;
  rotuloAcessivel?: string;
  estilo?: StyleProp<ViewStyle>;
  raio?: number;
  brilho?: boolean;
  /** Layout no pai (flexBasis, largura numa grade): vai no invólucro tocável. */
  estiloDeFora?: StyleProp<ViewStyle>;
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
  if (!aoTocar) return estiloDeFora ? <View style={estiloDeFora}>{corpo}</View> : corpo;
  return (
    <Pressable
      style={estiloDeFora}
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
