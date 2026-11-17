import {
  BookOpen,
  HeartHandshake,
  Siren,
  Sparkles,
  Sprout,
  type LucideIcon,
} from "lucide-react-native";
import { SOS_NO_APP } from "~/config";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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
import { CEUS, CeuVivo, faseDeAgora, type Ceu } from "~/componentes/ceu-vivo";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { cor, espaco, fonte, raio, sombra } from "~/tema";
import { Vidro } from "~/componentes/vidro";

/**
 * A CARA DA ENTRADA — login, cadastro e "esqueci a senha".
 *
 * É a primeira tela de quem baixa o app, e ela abre no MESMO céu vivo da tela
 * do bebê (16/11/2026): o céu da hora em que ela abriu, na tela inteira — de
 * manhã o amanhecer com nuvens, à noite as estrelas piscando e a estrela
 * cadente. Por cima, as bolhas translúcidas que sobem e descem devagar (a
 * bolha é o personagem do app) e o formulário numa folha branca.
 *
 * Tudo decorativo: fora da acessibilidade, sem toque, só opacidade e
 * transform no motor nativo. Com "Reduzir movimento", a mesma cena, parada.
 */

/* ── O fundo ──────────────────────────────────────────────────────────── */

/** O céu sob a entrada: quem escreve direto no fundo lê a tinta dele. */
const CeuDaEntrada = createContext<Ceu>(CEUS.amanhecer);
export const useCeuDaEntrada = () => useContext(CeuDaEntrada);

type Bolha = { x: number; y: number; d: number; periodo: number; sobe: number };

/* Posições em fração da tela; tamanhos em pt. Poucas e perto das bordas, para
   não disputar com o formulário no meio. */
const BOLHAS: Bolha[] = [
  { x: -0.1, y: 0.05, d: 130, periodo: 7000, sobe: 14 },
  { x: 0.86, y: 0.44, d: 48, periodo: 5200, sobe: 12 },
  { x: 0.03, y: 0.4, d: 40, periodo: 4800, sobe: 16 },
  { x: -0.08, y: 0.74, d: 110, periodo: 7600, sobe: 20 },
  { x: 0.74, y: 0.84, d: 130, periodo: 8200, sobe: 16 },
];

export function FundoDaEntrada({ children }: { children: ReactNode }) {
  /* A hora é a de quando a tela abriu: o céu não troca no meio do login. */
  const [fase] = useState(faseDeAgora);
  const ceu = CEUS[fase];
  return (
    <View style={{ flex: 1, backgroundColor: ceu.chao }}>
      <CeuVivo fase={fase} />
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
      </View>
      <CeuDaEntrada.Provider value={ceu}>{children}</CeuDaEntrada.Provider>
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
        backgroundColor: "rgba(255,255,255,0.16)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.65)",
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
          opacity: 0.85,
          transform: [{ rotate: "-30deg" }],
        }}
      />
    </Animated.View>
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
  { icone: HeartHandshake, texto: "Amigas jogando junto com você" },
  SOS_NO_APP
    ? { icone: Siren, texto: "SOS que funciona até sem internet" }
    : { icone: Sprout, texto: "Sementinhas para cada passo da trilha" },
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
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
        }}
      >
        {/* Uma pílula de vidro sobre as bolhas do degradê (16/11/2026). */}
        <Vidro
          flutua={false}
          estilo={{
            flexDirection: "row",
            alignItems: "center",
            gap: espaco.sm,
            paddingHorizontal: espaco.md,
            paddingVertical: espaco.sm,
          }}
        >
          <Icone size={16} color={cor.primaria} />
          <Text style={{ ...fonte.forte, fontSize: 14, color: cor.textoDestaque }}>{texto}</Text>
        </Vidro>
      </Animated.View>
    </View>
  );
}
