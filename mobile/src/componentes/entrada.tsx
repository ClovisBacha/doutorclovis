import { LinearGradient } from "expo-linear-gradient";
import { BookOpen, HeartHandshake, Siren, Sparkles, type LucideIcon } from "lucide-react-native";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { T } from "~/componentes/base";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { cor, espaco, fonte, raio, sombra } from "~/tema";

/**
 * A CARA DA ENTRADA — login, cadastro e "esqueci a senha".
 *
 * É a primeira tela que a gestante vê, e antes era um formulário solto no
 * creme. Agora: um degradê do rosa da marca ao creme, bolhas translúcidas que
 * sobem e descem devagar atrás de tudo (a bolha é o personagem do app), umas
 * faíscas que piscam, e o formulário numa folha branca por cima.
 *
 * Tudo decorativo: fora da acessibilidade, sem toque, só opacidade e
 * transform no motor nativo. Com "Reduzir movimento", a mesma cena, parada.
 */

/* ── O fundo ──────────────────────────────────────────────────────────── */

type Bolha = { x: number; y: number; d: number; tom: string; periodo: number; sobe: number };

/* Posições em fração da tela; tamanhos em pt. Poucas e grandes perto das
   bordas, para não disputar com o formulário no meio. */
const BOLHAS: Bolha[] = [
  { x: -0.12, y: 0.04, d: 150, tom: cor.branco, periodo: 7000, sobe: 14 },
  { x: 0.78, y: 0.1, d: 96, tom: cor.entradaLilas, periodo: 6200, sobe: 18 },
  { x: 0.84, y: 0.27, d: 50, tom: cor.rosaMarca, periodo: 5200, sobe: 12 },
  { x: 0.04, y: 0.42, d: 40, tom: cor.entradaLilas, periodo: 4800, sobe: 16 },
  { x: -0.08, y: 0.72, d: 120, tom: cor.rosaMarca, periodo: 7600, sobe: 20 },
  { x: 0.72, y: 0.82, d: 140, tom: cor.entradaLilas, periodo: 8200, sobe: 16 },
];

const FAISCAS = [
  { x: 0.2, y: 0.07, t: 14, atraso: 0 },
  { x: 0.7, y: 0.05, t: 10, atraso: 900 },
  { x: 0.9, y: 0.24, t: 12, atraso: 1700 },
  { x: 0.1, y: 0.3, t: 9, atraso: 2400 },
];

export function FundoDaEntrada({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: cor.fundo }}>
      <LinearGradient
        colors={[cor.rosaMarca, cor.entradaPessego, cor.fundo]}
        locations={[0, 0.42, 0.85]}
        style={StyleSheet.absoluteFill}
      />
      {/* overflow: as bolhas das bordas saem da tela de propósito, e sem o
          corte a web ganha rolagem lateral. */}
      <View
        style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}
        pointerEvents="none"
        accessible={false}
      >
        {BOLHAS.map((b, i) => (
          <BolhaQueFlutua key={i} bolha={b} />
        ))}
        {FAISCAS.map((f, i) => (
          <Faisca key={i} {...f} />
        ))}
      </View>
      {children}
    </View>
  );
}

function useLaco(periodo: number, atraso = 0) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduzido) return;
    const meia = periodo / 2;
    const laco = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: meia,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: meia,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const t = setTimeout(() => laco.start(), atraso);
    return () => {
      clearTimeout(t);
      laco.stop();
    };
  }, [atraso, periodo, reduzido, v]);
  return v;
}

function BolhaQueFlutua({ bolha }: { bolha: Bolha }) {
  const { width, height } = useWindowDimensions();
  const v = useLaco(bolha.periodo, (bolha.periodo % 1300) * 0.5);
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: bolha.x * width,
        top: bolha.y * height,
        width: bolha.d,
        height: bolha.d,
        borderRadius: bolha.d / 2,
        backgroundColor: bolha.tom,
        opacity: 0.55,
        borderWidth: 1,
        borderColor: cor.branco,
        transform: [
          {
            translateY: v.interpolate({
              inputRange: [0, 1],
              outputRange: [bolha.sobe, -bolha.sobe],
            }),
          },
          { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-4, 4] }) },
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) },
        ],
      }}
    >
      {/* O brilho no alto, que faz o círculo ler como bolha de sabão. */}
      <View
        style={{
          position: "absolute",
          top: bolha.d * 0.16,
          left: bolha.d * 0.2,
          width: bolha.d * 0.22,
          height: bolha.d * 0.12,
          borderRadius: bolha.d,
          backgroundColor: cor.branco,
          opacity: 0.9,
          transform: [{ rotate: "-30deg" }],
        }}
      />
    </Animated.View>
  );
}

function Faisca({ x, y, t, atraso }: { x: number; y: number; t: number; atraso: number }) {
  const { width, height } = useWindowDimensions();
  const v = useLaco(2600, atraso);
  return (
    <Animated.Text
      style={{
        position: "absolute",
        left: x * width,
        top: y * height,
        fontSize: t,
        color: cor.primariaSuave,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.95] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.15] }) }],
      }}
    >
      ✦
    </Animated.Text>
  );
}

/* ── A folha branca do formulário ─────────────────────────────────────── */

export function FolhaDaEntrada({
  children,
  estilo,
}: {
  children: ReactNode;
  estilo?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: cor.cartao,
          borderRadius: raio.lg,
          padding: espaco.lg,
          gap: espaco.md,
          borderWidth: 1,
          borderColor: cor.borda,
          ...sombra,
          shadowOpacity: 0.12,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
        },
        estilo,
      ]}
    >
      {children}
    </View>
  );
}

/** "──── ou com o seu e-mail ────" */
export function DivisorDaEntrada({ texto }: { texto: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
      <View style={{ flex: 1, height: 1, backgroundColor: cor.borda }} />
      <T tipo="apagado" estilo={{ fontSize: 13 }}>
        {texto}
      </T>
      <View style={{ flex: 1, height: 1, backgroundColor: cor.borda }} />
    </View>
  );
}

/* ── O que o app faz, uma frase de cada vez ───────────────────────────── */

/* Nenhuma fala do bebê: a tela de entrada não sabe se quem volta está no
   Modo Cuidado. */
const FRASES: { icone: LucideIcon; texto: string }[] = [
  { icone: BookOpen, texto: "Uma aula curtinha por dia" },
  { icone: Sparkles, texto: "Estrelas e conquistas a cada passo" },
  { icone: HeartHandshake, texto: "Outras gestantes do seu lado" },
  { icone: Siren, texto: "SOS que funciona até sem internet" },
];

export function FrasesQueGiram() {
  const reduzido = useMovimentoReduzido();
  const [i, setI] = useState(0);
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduzido) return;
    const id = setInterval(() => {
      Animated.timing(v, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        setI((n) => (n + 1) % FRASES.length);
        Animated.timing(v, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    }, 3000);
    return () => clearInterval(id);
  }, [reduzido, v]);
  const { icone: Icone, texto } = FRASES[i];
  return (
    <View
      accessible
      accessibilityLabel={FRASES.map((f) => f.texto).join(". ")}
      style={{ alignItems: "center" }}
    >
      <Animated.View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.sm,
          paddingHorizontal: espaco.md,
          paddingVertical: espaco.sm,
          borderRadius: raio.pilula,
          backgroundColor: cor.entradaVidro,
          borderWidth: 1,
          borderColor: cor.branco,
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
        }}
      >
        <Icone size={16} color={cor.primaria} />
        <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: cor.textoDestaque }}>
          {texto}
        </Text>
      </Animated.View>
    </View>
  );
}
