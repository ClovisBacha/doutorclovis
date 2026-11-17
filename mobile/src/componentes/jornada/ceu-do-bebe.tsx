import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { Hourglass, Ruler, Undo2, Weight } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { sombraDoTexto, type Ceu } from "~/componentes/ceu-vivo";
import { arteDoBebe } from "~/componentes/jornada/arte-do-bebe";
import { Brilho } from "~/componentes/jornada/atividade";
import { Flutuar, useMovimentoReduzido } from "~/componentes/movimento";
import { Vidro } from "~/componentes/vidro";
import { bebeDaSemana } from "~/lib/bebe-da-semana";
import { ALVO_MINIMO, aperto, cor, espaco, fonte, fonteDoNumero } from "~/tema";

/**
 * O BEBÊ NO CÉU — o topo da tela do bebê, em CAMADAS (16/11/2026, o dono:
 * "efeito Apple 3D caro [...] algo ainda melhor e imersivo").
 *
 * A profundidade é a da tela de bloqueio do iPhone, em que o relógio fica
 * ATRÁS da pessoa da foto: aqui o número da semana, gigante, fica atrás do
 * bebê. O céu é o fundo da tela inteira (`CeuVivo`, fora daqui); o número, a
 * sombra e o bebê andam distâncias diferentes quando ela inclina o celular e
 * quando rola a tela.
 *
 * E o bebê RESPONDE:
 * - **a régua do tempo**: arrastando a régua sob o nome, ela viaja pelas
 *   semanas — o número gira atrás, o bebê cresce (a arte troca e o tamanho
 *   acompanha), a fruta e as medidas mudam, e cada semana dá um toque na mão.
 *   "Hoje" traz de volta. São os dados de `bebeDaSemana`, os mesmos do
 *   "semana a semana";
 * - **o toque**: tocar no bebê faz ele dar um pulinho, com faíscas.
 *
 * Tudo o que a tela dizia continua dito em texto (a semana e os dias, a fruta,
 * "faltam N dias", o tamanho): o número de trás é enfeite, e o leitor de tela
 * não o lê. A régua é um controle ajustável para ele.
 */

/** A altura do topo, fora a área do relógio do iPhone. */
export const ALTURA_DO_CEU = 590;

/** O lado da arte do bebê, na semana 40 (antes disso ele é menor: ele cresce). */
const BEBE = 224;

/** As semanas da régua (as que `bebeDaSemana` conta, da 4 em diante). */
const PRIMEIRA = 4;
const ULTIMA = 40;
/** A distância entre uma semana e a seguinte, na régua. */
const PASSO = 15;

const prender = (s: number) => Math.min(ULTIMA, Math.max(PRIMEIRA, s));

/** O bebê cresce com as semanas: de 70% do tamanho, na 4, a 100%, na 40. */
const escalaDoBebe = (s: number) => 0.7 + (0.3 * (prender(s) - PRIMEIRA)) / (ULTIMA - PRIMEIRA);

type ControleDaRegua = { irPara: (semana: number) => void };

export function CeuDoBebe({
  topo,
  ceu,
  data,
  saudacao,
  direita,
  semana,
  dias,
  nomeDoBebe,
  faltam,
  rolagem,
  x,
  y,
}: {
  topo: number;
  ceu: Ceu;
  data: string;
  saudacao: string;
  direita?: ReactNode;
  semana: number;
  dias: number;
  nomeDoBebe: string | null;
  faltam: number | null;
  /** Quanto a tela rolou (negativo quando ela puxa para baixo). */
  rolagem: Animated.Value;
  /** A inclinação do celular (`useParalaxe`). */
  x: Animated.Value;
  y: Animated.Value;
}) {
  const reduzido = useMovimentoReduzido();
  const altura = ALTURA_DO_CEU + topo;
  const quem = nomeDoBebe ?? "o bebê";

  /* A semana que a régua mostra. Parada em "hoje", é a semana dela de verdade
     (que pode passar da última da régua). */
  const [vista, setVista] = useState(semana);
  const regua = useRef<ControleDaRegua | null>(null);
  useEffect(() => setVista(semana), [semana]);
  const viajando = vista !== semana;
  const bebe = bebeDaSemana(vista);
  const aoGirar = useCallback(
    (s: number) => setVista(s === prender(semana) ? semana : s),
    [semana],
  );

  /* A CHEGADA: ao abrir a tela, o número sobe de trás e o bebê surge na
     frente com um leve salto — uma vez, e nada disso com "reduzir movimento". */
  const numeroChega = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  const bebeChega = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  useEffect(() => {
    if (reduzido) return;
    Animated.parallel([
      Animated.timing(numeroChega, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(bebeChega, {
        toValue: 1,
        duration: 760,
        delay: 140,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
    ]).start();
  }, [reduzido, numeroChega, bebeChega]);

  /* O bebê cresce (ou encolhe) até o tamanho da semana que a régua mostra. */
  const tamanho = useRef(new Animated.Value(escalaDoBebe(semana))).current;
  useEffect(() => {
    const para = escalaDoBebe(vista);
    if (reduzido) {
      tamanho.setValue(para);
      return;
    }
    Animated.spring(tamanho, {
      toValue: para,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [vista, reduzido, tamanho]);

  /* O TOQUE: um pulinho, um balanço e as faíscas. */
  const pulo = useRef(new Animated.Value(0)).current;
  const [faiscas, setFaiscas] = useState(0);
  const aoTocarNoBebe = () => {
    if (Platform.OS !== "web")
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
    setFaiscas((n) => n + 1);
    if (reduzido) return;
    pulo.setValue(0);
    Animated.timing(pulo, {
      toValue: 1,
      duration: 620,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const anda = (v: Animated.Value, px: number) =>
    v.interpolate({ inputRange: [-1, 1], outputRange: [-px, px] });
  const gira = (v: Animated.Value, graus: number) =>
    v.interpolate({ inputRange: [-1, 1], outputRange: [`${-graus}deg`, `${graus}deg`] });
  const sombra = sombraDoTexto(ceu);

  return (
    <View style={{ height: altura }}>
      {/* 1 · O número da semana, atrás do bebê. */}
      <Animated.View
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: topo + 50,
          alignItems: "center",
          transform: [
            { translateX: anda(x, -5) },
            {
              translateY: rolagem.interpolate({
                inputRange: [0, altura],
                outputRange: [0, altura * 0.2],
                extrapolate: "clamp",
              }),
            },
          ],
        }}
      >
        <Animated.Text
          allowFontScaling={false}
          style={{
            opacity: numeroChega,
            transform: [
              { translateY: numeroChega.interpolate({ inputRange: [0, 1], outputRange: [44, 0] }) },
            ],
            ...fonteDoNumero,
            fontSize: 250,
            lineHeight: 258,
            letterSpacing: -12,
            fontVariant: ["tabular-nums"],
            color: ceu.numero,
            textShadowColor: "rgba(70,50,130,0.16)",
            textShadowOffset: { width: 0, height: 8 },
            textShadowRadius: 22,
          }}
        >
          {vista}
        </Animated.Text>
      </Animated.View>

      {/* 2 · O bebê: perto. Vem na frente, gira de leve e encolhe ao rolar. */}
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: topo + 164,
          alignItems: "center",
          transform: [
            {
              translateY: rolagem.interpolate({
                inputRange: [0, altura],
                outputRange: [0, -altura * 0.06],
                extrapolate: "clamp",
              }),
            },
            {
              scale: rolagem.interpolate({
                inputRange: [-300, 0, altura],
                outputRange: [1.14, 1, 0.82],
                extrapolate: "clamp",
              }),
            },
          ],
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: BEBE - 18,
            transform: [{ translateX: anda(x, -12) }, { scale: tamanho }],
          }}
        >
          <SombraDeContato />
        </Animated.View>
        <Animated.View
          pointerEvents="box-none"
          style={{
            opacity: bebeChega.interpolate({
              inputRange: [0, 0.35, 1],
              outputRange: [0, 1, 1],
              extrapolate: "clamp",
            }),
            transform: [
              { perspective: 700 },
              { scale: bebeChega.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }) },
              { translateX: anda(x, 14) },
              { translateY: anda(y, 9) },
              { rotateY: gira(x, 9) },
              { rotateX: gira(y, -6) },
            ],
          }}
        >
          <View pointerEvents="none">
            <Brilho tamanho={320} />
          </View>
          <Faiscas gatilho={faiscas} />
          <Flutuar>
            <Animated.View
              style={{
                transform: [
                  { scale: tamanho },
                  {
                    translateY: pulo.interpolate({
                      inputRange: [0, 0.35, 1],
                      outputRange: [0, -22, 0],
                    }),
                  },
                  {
                    rotate: pulo.interpolate({
                      inputRange: [0, 0.25, 0.6, 1],
                      outputRange: ["0deg", "-7deg", "6deg", "0deg"],
                    }),
                  },
                ],
              }}
            >
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel={`${quem} com ${vista} semanas`}
                accessibilityHint="Toque para um carinho"
                onPress={aoTocarNoBebe}
              >
                <Image
                  source={arteDoBebe(vista)}
                  style={{ width: BEBE, height: BEBE }}
                  contentFit="contain"
                  transition={reduzido ? 0 : 180}
                />
              </Pressable>
            </Animated.View>
          </Flutuar>
        </Animated.View>
      </Animated.View>

      {/* O bom-dia e a foto dela. */}
      <View
        style={{
          paddingTop: topo + espaco.md,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              ...fonte.forte,
              fontSize: 12,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              color: ceu.sec,
              ...sombra,
            }}
          >
            {data}
          </Text>
          <Text
            accessibilityRole="header"
            style={{
              marginTop: 1,
              ...fonte.titulo,
              fontSize: 32,
              lineHeight: 38,
              letterSpacing: aperto.titulo,
              color: ceu.tinta,
              ...sombra,
            }}
          >
            {saudacao}
          </Text>
        </View>
        {direita}
      </View>

      {/* O nome, a semana, a régua do tempo e as etiquetas de vidro. */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 12, alignItems: "center" }}>
        {nomeDoBebe ? (
          <Text
            style={{
              ...fonte.titulo,
              fontSize: 28,
              lineHeight: 32,
              letterSpacing: aperto.subtitulo,
              color: ceu.tinta,
              ...sombra,
            }}
          >
            {nomeDoBebe}
          </Text>
        ) : null}
        <Text
          style={{
            marginTop: 1,
            paddingHorizontal: espaco.lg,
            textAlign: "center",
            ...fonte.media,
            fontSize: 15,
            lineHeight: 20,
            color: ceu.sec,
            ...sombra,
          }}
        >
          {viajando
            ? `Semana ${vista}`
            : `${semana} semanas${dias > 0 ? ` e ${dias} ${dias === 1 ? "dia" : "dias"}` : ""}`}{" "}
          · tamanho de {bebe.fruit.toLowerCase()}
        </Text>

        <ReguaDoTempo
          controle={regua}
          hoje={prender(semana)}
          vista={prender(vista)}
          ceu={ceu}
          quem={quem}
          aoGirar={aoGirar}
        />

        <View style={{ flexDirection: "row", gap: espaco.sm, marginTop: 8 }}>
          {viajando ? (
            <>
              <Selo icone={<Ruler size={14} color="#6a5a92" strokeWidth={2.2} />}>{bebe.size}</Selo>
              <Selo icone={<Weight size={14} color="#6a5a92" strokeWidth={2.2} />}>
                {bebe.weight}
              </Selo>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Voltar para a semana de hoje"
                hitSlop={8}
                onPress={() => regua.current?.irPara(semana)}
              >
                <Selo
                  cor={cor.primariaEscura}
                  icone={<Undo2 size={14} color={cor.primariaEscura} strokeWidth={2.4} />}
                >
                  Hoje
                </Selo>
              </Pressable>
            </>
          ) : (
            <>
              {faltam != null && faltam > 0 ? (
                <Selo icone={<Hourglass size={14} color="#6a5a92" strokeWidth={2.2} />}>
                  faltam {faltam} {faltam === 1 ? "dia" : "dias"}
                </Selo>
              ) : null}
              <Selo icone={<Ruler size={14} color="#6a5a92" strokeWidth={2.2} />}>{bebe.size}</Selo>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

/** A sombra do bebê no ar: é ela que diz que ele é um objeto, e não um adesivo. */
function SombraDeContato() {
  return (
    <Svg width={190} height={34}>
      <Defs>
        <RadialGradient id="sombra-do-bebe" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#2a1c5e" stopOpacity={0.34} />
          <Stop offset="0.6" stopColor="#2a1c5e" stopOpacity={0.12} />
          <Stop offset="1" stopColor="#2a1c5e" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={95} cy={17} rx={95} ry={17} fill="url(#sombra-do-bebe)" />
    </Svg>
  );
}

/* ── As faíscas do toque ──────────────────────────────────────────────── */

const RAIOS = [0, 40, 85, 130, 170, 215, 260, 305];

/** Oito faíscas que saem do bebê e somem, a cada toque. */
function Faiscas({ gatilho }: { gatilho: number }) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!gatilho || reduzido) return;
    v.setValue(0);
    Animated.timing(v, {
      toValue: 1,
      duration: 780,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [gatilho, reduzido, v]);
  if (!gatilho || reduzido) return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: BEBE / 2, top: BEBE / 2, width: 0, height: 0 }}
    >
      {RAIOS.map((graus, i) => {
        const rad = (graus * Math.PI) / 180;
        const longe = 92 + (i % 3) * 22;
        return (
          <Animated.Text
            key={graus}
            allowFontScaling={false}
            style={{
              position: "absolute",
              left: -9,
              top: -11,
              fontSize: 14 + (i % 3) * 5,
              color: i % 2 ? "#fff4c2" : "#ffffff",
              textShadowColor: "rgba(255,220,140,0.9)",
              textShadowRadius: 8,
              opacity: v.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                {
                  translateX: v.interpolate({
                    inputRange: [0, 1],
                    outputRange: [Math.cos(rad) * 34, Math.cos(rad) * longe],
                  }),
                },
                {
                  translateY: v.interpolate({
                    inputRange: [0, 1],
                    outputRange: [Math.sin(rad) * 34, Math.sin(rad) * longe],
                  }),
                },
                {
                  scale: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.3, 1.15, 0.5] }),
                },
              ],
            }}
          >
            ✦
          </Animated.Text>
        );
      })}
    </View>
  );
}

/* ── A régua do tempo ─────────────────────────────────────────────────── */

const SEMANAS = Array.from({ length: ULTIMA - PRIMEIRA + 1 }, (_, i) => PRIMEIRA + i);

/**
 * A RÉGUA DO TEMPO: uma régua de semanas que ela arrasta, com a agulha parada
 * no meio. Cada risco é uma semana; os de quatro em quatro levam o número. Os
 * riscos se apagam para os lados (é um disco, não uma fita), e cada semana que
 * passa pela agulha dá um toque na mão.
 */
function ReguaDoTempo({
  controle,
  hoje,
  vista,
  ceu,
  quem,
  aoGirar,
}: {
  /** Por onde o "Hoje" manda a régua de volta. */
  controle: React.RefObject<ControleDaRegua | null>;
  hoje: number;
  vista: number;
  ceu: Ceu;
  quem: string;
  aoGirar: (semana: number) => void;
}) {
  const { width } = useWindowDimensions();
  const lista = useRef<ScrollView>(null);
  const ultima = useRef(hoje);
  const pos = useRef(new Animated.Value((hoje - PRIMEIRA) * PASSO)).current;
  const margem = width / 2 - PASSO / 2;
  const tinta = ceu.claro ? "#3b2f66" : "#ffffff";

  const irPara = useCallback(
    (s: number) =>
      lista.current?.scrollTo({ x: (prender(s) - PRIMEIRA) * PASSO, y: 0, animated: true }),
    [],
  );
  useEffect(() => {
    controle.current = { irPara };
    return () => {
      controle.current = null;
    };
  }, [controle, irPara]);
  /* A web ignora `contentOffset`: lá a régua precisa ser levada até hoje. */
  useEffect(() => {
    if (Platform.OS !== "web") return;
    lista.current?.scrollTo({ x: (hoje - PRIMEIRA) * PASSO, y: 0, animated: false });
  }, [hoje]);

  const aoRolar = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: pos } } }], {
        useNativeDriver: true,
        listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const s = prender(Math.round(e.nativeEvent.contentOffset.x / PASSO) + PRIMEIRA);
          if (s === ultima.current) return;
          ultima.current = s;
          if (Platform.OS !== "web") void Haptics.selectionAsync().catch(() => {});
          aoGirar(s);
        },
      }),
    [pos, aoGirar],
  );

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`Semana da gestação: arraste para ver ${quem} crescer`}
      accessibilityValue={{ min: PRIMEIRA, max: ULTIMA, now: vista, text: `Semana ${vista}` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) =>
        irPara(vista + (e.nativeEvent.actionName === "increment" ? 1 : -1))
      }
      style={{ alignSelf: "stretch", marginTop: 8, height: 60 }}
    >
      <Animated.ScrollView
        ref={lista}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={PASSO}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={aoRolar}
        contentOffset={{ x: (hoje - PRIMEIRA) * PASSO, y: 0 }}
        contentContainerStyle={{ paddingHorizontal: margem, alignItems: "flex-start" }}
        style={{ height: ALVO_MINIMO }}
      >
        {SEMANAS.map((s, i) => {
          const c = i * PASSO;
          const cheia = s % 4 === 0;
          return (
            <View key={s} style={{ width: PASSO, alignItems: "center" }}>
              <Animated.View
                style={{
                  alignItems: "center",
                  opacity: pos.interpolate({
                    inputRange: [c - PASSO * 9, c - PASSO * 2, c, c + PASSO * 2, c + PASSO * 9],
                    outputRange: [0, 0.6, 1, 0.6, 0],
                    extrapolate: "clamp",
                  }),
                }}
              >
                <Animated.View
                  style={{
                    marginTop: 6,
                    width: cheia ? 2.5 : 1.5,
                    height: cheia ? 16 : 10,
                    borderRadius: 2,
                    backgroundColor: tinta,
                    opacity: cheia ? 0.95 : 0.6,
                    transform: [
                      {
                        scaleY: pos.interpolate({
                          inputRange: [c - PASSO, c, c + PASSO],
                          outputRange: [1, 1.5, 1],
                          extrapolate: "clamp",
                        }),
                      },
                    ],
                  }}
                />
                {cheia ? (
                  <Text
                    allowFontScaling={false}
                    style={{
                      position: "absolute",
                      top: 26,
                      width: 30,
                      textAlign: "center",
                      ...fonte.forte,
                      fontSize: 12,
                      fontVariant: ["tabular-nums"],
                      color: tinta,
                      ...sombraDoTexto(ceu),
                    }}
                  >
                    {s}
                  </Text>
                ) : null}
              </Animated.View>
            </View>
          );
        })}
      </Animated.ScrollView>
      {/* A agulha, parada no meio. */}
      <View
        pointerEvents="none"
        style={{ position: "absolute", left: 0, right: 0, top: 0, alignItems: "center" }}
      >
        <View
          style={{
            width: 4,
            height: 26,
            borderRadius: 2,
            backgroundColor: ceu.claro ? cor.primaria : "#ffffff",
            boxShadow: ceu.claro
              ? "0px 2px 6px rgba(207,36,104,0.45)"
              : "0px 0px 10px rgba(255,255,255,0.9)",
          }}
        />
      </View>
      <Text
        allowFontScaling={false}
        style={{
          textAlign: "center",
          ...fonte.media,
          fontSize: 12,
          color: ceu.sec,
          ...sombraDoTexto(ceu),
        }}
      >
        arraste para ver {quem} crescer
      </Text>
    </View>
  );
}

/**
 * A etiqueta sobre o céu ("faltam 109 dias", "30 cm"): uma pílula de VIDRO
 * em cima da arte — a arte passa através dela —, com o ícone de traço fino no
 * lugar do emoji.
 */
export function Selo({
  children,
  icone,
  cor: tinta = "#4a3a6e",
}: {
  children: ReactNode;
  icone?: ReactNode;
  cor?: string;
}) {
  return (
    <Vidro
      flutua={false}
      tinta="rgba(255,255,255,0.5)"
      estilo={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 13,
        paddingVertical: 7,
        boxShadow: "0px 6px 16px -8px rgba(40,24,90,0.5)",
      }}
    >
      {icone}
      <Text style={{ ...fonte.forte, fontSize: 13, color: tinta }}>{children}</Text>
    </Vidro>
  );
}
