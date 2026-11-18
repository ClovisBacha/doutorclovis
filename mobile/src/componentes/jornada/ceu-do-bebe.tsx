import { trimesterForWeek } from "@/lib/gestacao";
import { Image } from "expo-image";
import { Flame, Hourglass, Ruler, Undo2, Weight } from "lucide-react-native";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { selecao, Tocavel, toque } from "~/componentes/base";
import { sombraDoTexto, type Ceu } from "~/componentes/ceu-vivo";
import { arteDoBebe } from "~/componentes/jornada/arte-do-bebe";
import { Brilho } from "~/componentes/jornada/atividade";
import { corJornada } from "~/componentes/jornada/cores";
import { Flutuar, useMovimentoReduzido } from "~/componentes/movimento";
import { bebeDaSemana } from "~/lib/bebe-da-semana";
import { comAlfa } from "~/lib/cor";
import { gravarChave } from "~/lib/jornada/loja";
import {
  ALVO_MINIMO,
  canto,
  cor,
  curva,
  escala,
  espaco,
  fonte,
  fonteDoNumero,
  luz,
  margem,
  ouro,
  sombra as sombraDoCartao,
  vidro,
} from "~/tema";

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
 *   acompanha), e cada semana dá um tique na mão. "Hoje" traz de volta. São
 *   os dados de `bebeDaSemana`, os mesmos do semana a semana;
 * - **o toque**: tocar no bebê faz ele dar um pulinho, com faíscas.
 *
 * O CÉU FICA COM A EMOÇÃO (18/11/2026, a vistoria: "três fatos ditos duas
 * vezes na primeira tela e meia"). Parado em hoje, ele diz o nome, "24 semanas
 * e 4 dias", a régua e um selo só ("faltam 109 dias"); o tamanho, o peso e a
 * fruta são do painel logo abaixo. Só quando ela VIAJA pelas semanas o céu
 * mostra o tamanho e a fruta, porque aí o painel não acompanha.
 *
 * O mesmo céu abre o semana a semana (`app/bebe.tsx`, `modo="semanas"`): uma
 * viagem pelas semanas, um controle só, um bebê só.
 *
 * Tudo o que a tela diz continua dito em texto: o número de trás é enfeite, e o
 * leitor de tela não o lê. A régua é um controle ajustável para ele.
 */

/** A altura do céu, fora a área do relógio do iPhone, numa tela alta (o máximo). */
export const ALTURA_DO_CEU = 590;
/** O mínimo: abaixo disso o bebê e o nome se encostam. */
const ALTURA_MINIMA_DO_CEU = 470;
/** O pedaço do painel seguinte que aparece na abertura: diz que a tela rola. */
const PONTA_DO_PAINEL = 56;

/**
 * A altura do céu numa janela (18/11/2026, a vistoria): era fixa em 590, e
 * num iPhone SE a régua e o selo ficavam embaixo da barra de abas, sem a ponta
 * do painel seguinte. Agora é o que sobra da janela sem o topo, sem o que cobre
 * o pé (a barra de abas) e sem a ponta do painel, entre 470 e 590.
 */
export function alturaDoCeu(janela: number, topo: number, embaixo: number): number {
  const livre = janela - topo - embaixo - PONTA_DO_PAINEL;
  return Math.round(Math.min(ALTURA_DO_CEU, Math.max(ALTURA_MINIMA_DO_CEU, livre)));
}

export function useAlturaDoCeu(topo: number, embaixo: number): number {
  return alturaDoCeu(useWindowDimensions().height, topo, embaixo);
}

/** Ela já arrastou a régua uma vez: a dica "arraste para…" não volta. */
export const CHAVE_REGUA_USADA = "dc-path-regua-usada";

/** O lado da arte do bebê, na semana 40 e no céu mais alto (antes disso ele é menor: ele cresce). */
const BEBE = 224;

/** As semanas da régua (as que `bebeDaSemana` conta, da 4 à 42). */
const PRIMEIRA = 4;
const ULTIMA = 42;
/** O bebê para de crescer na 40 (a arte da 40 é a última). */
const ULTIMA_DO_TAMANHO = 40;
/** A distância entre uma semana e a seguinte, na régua. */
const PASSO = 15;

const prender = (s: number) => Math.min(ULTIMA, Math.max(PRIMEIRA, s));

/** O bebê cresce com as semanas: de 70% do tamanho, na 4, a 100%, na 40. */
const escalaDoBebe = (s: number) =>
  0.7 +
  (0.3 * (Math.min(ULTIMA_DO_TAMANHO, Math.max(PRIMEIRA, s)) - PRIMEIRA)) /
    (ULTIMA_DO_TAMANHO - PRIMEIRA);

type ControleDaRegua = { irPara: (semana: number) => void };
type EstiloAnimado = Animated.WithAnimatedValue<ViewStyle>;
type TextoAnimado = Animated.WithAnimatedValue<TextStyle>;

/** O texto que fica direto sobre o céu, com o contraste medido (AA no céu da manhã). */
const tintaSecundaria = (ceu: Ceu) => (ceu.claro ? ceu.tinta : ceu.sec);

/**
 * A sombra do texto miúdo do pé do céu (a semana, a régua, a dica): ali o céu
 * da tarde e o da noite clareiam (o sol baixo, as colinas acesas), e a sombra
 * leve de `sombraDoTexto` não segura o texto claro. No céu claro, nenhuma.
 */
function sombraDoPe(ceu: Ceu) {
  return ceu.claro
    ? null
    : ({
        textShadowColor: comAlfa(cor.texto, 0.6),
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
      } as const);
}

export type PropsDoCeu = {
  topo: number;
  /** A altura do céu (`useAlturaDoCeu`), fora a área do relógio. */
  altura: number;
  ceu: Ceu;
  /** A semana dela: é para onde "Hoje" leva. */
  semana: number;
  /** Onde a régua abre (o semana a semana abre na semana pedida). */
  inicial?: number;
  dias: number;
  nomeDoBebe: string | null;
  faltam: number | null;
  /** Quanto a tela rolou (negativo quando ela puxa para baixo). */
  rolagem: Animated.Value;
  /** A inclinação do celular (`useParalaxe`). */
  x: Animated.Value;
  y: Animated.Value;
  /** Ela já arrastou a régua: a dica some. */
  reguaUsada: boolean;
  /** O alto do céu: a saudação no Bebê, o voltar no semana a semana. */
  cabecalho: ReactNode;
  /** "hoje": a tela do bebê; "semanas": o semana a semana (selos do trimestre e de quando). */
  modo?: "hoje" | "semanas";
  /** Sem a data da gestação, o semana a semana não diz "esta semana". */
  semData?: boolean;
  /** A semana que a régua mostra, a cada troca (o semana a semana acompanha embaixo). */
  aoVer?: (semana: number) => void;
};

export const CeuDoBebe = memo(function CeuDoBebe({
  topo,
  altura,
  ceu,
  semana,
  inicial,
  dias,
  nomeDoBebe,
  faltam,
  rolagem,
  x,
  y,
  reguaUsada,
  cabecalho,
  modo = "hoje",
  semData = false,
  aoVer,
}: PropsDoCeu) {
  const reduzido = useMovimentoReduzido();
  const total = altura + topo;
  /* O céu baixo (iPhone SE) encolhe o número e o bebê junto. */
  const k = altura / ALTURA_DO_CEU;
  const lado = Math.round(BEBE * k);
  const quem = nomeDoBebe ?? "o bebê";
  const abre = inicial ?? semana;

  /* A semana que a régua mostra. Parada em "hoje", é a semana dela de verdade. */
  const [vista, setVista] = useState(abre);
  const regua = useRef<ControleDaRegua | null>(null);
  useEffect(() => setVista(abre), [abre]);
  useEffect(() => aoVer?.(vista), [vista, aoVer]);
  const viajando = vista !== semana;
  const bebe = bebeDaSemana(vista);
  const aoGirar = useCallback(
    (s: number) => setVista(s === prender(semana) ? semana : s),
    [semana],
  );

  /* A dica "arraste para…" some no primeiro arrasto, e não volta. */
  const [arrastou, setArrastou] = useState(false);
  const aoArrastar = useCallback(() => {
    setArrastou((ja) => {
      if (!ja) gravarChave(CHAVE_REGUA_USADA, true);
      return true;
    });
  }, []);
  const mostrarDica = !reguaUsada && !arrastou;

  /* A CHEGADA: ao abrir a tela, o número sobe de trás e o bebê surge na
     frente com um leve salto — uma vez, e nada disso com "reduzir movimento". */
  const numeroChega = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  const bebeChega = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  useEffect(() => {
    if (reduzido) {
      numeroChega.setValue(1);
      bebeChega.setValue(1);
      return;
    }
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
  const tamanho = useRef(new Animated.Value(escalaDoBebe(abre))).current;
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
  const aoTocarNoBebe = useCallback(() => {
    toque();
    setFaiscas((n) => n + 1);
    if (reduzido) return;
    pulo.setValue(0);
    Animated.timing(pulo, {
      toValue: 1,
      duration: 620,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [reduzido, pulo]);

  /* As camadas, criadas UMA vez por tamanho de tela (18/11/2026): criadas no
     corpo do desenho, cada semana que a régua passava desligava e religava os
     nós de animação no lado nativo, um por um — o arrasto saía aos trancos. */
  const camadas = useMemo(() => {
    const anda = (v: Animated.Value, px: number) =>
      v.interpolate({ inputRange: [-1, 1], outputRange: [-px, px] });
    const gira = (v: Animated.Value, graus: number) =>
      v.interpolate({ inputRange: [-1, 1], outputRange: [`${-graus}deg`, `${graus}deg`] });
    const numero: EstiloAnimado = {
      position: "absolute",
      left: 0,
      right: 0,
      top: topo + Math.round(altura * 0.085),
      alignItems: "center",
      transform: [
        { translateX: anda(x, -5) },
        {
          translateY: rolagem.interpolate({
            inputRange: [0, total],
            outputRange: [0, total * 0.2],
            extrapolate: "clamp",
          }),
        },
      ],
    };
    const numeroChegando: TextoAnimado = {
      opacity: numeroChega,
      transform: [
        { translateY: numeroChega.interpolate({ inputRange: [0, 1], outputRange: [44, 0] }) },
      ],
    };
    const perto: EstiloAnimado = {
      position: "absolute",
      left: 0,
      right: 0,
      top: topo + Math.round(altura * 0.28),
      alignItems: "center",
      transform: [
        {
          translateY: rolagem.interpolate({
            inputRange: [0, total],
            outputRange: [0, -total * 0.06],
            extrapolate: "clamp",
          }),
        },
        {
          scale: rolagem.interpolate({
            inputRange: [-300, 0, total],
            outputRange: [1.14, 1, 0.82],
            extrapolate: "clamp",
          }),
        },
      ],
    };
    const sombra: EstiloAnimado = {
      position: "absolute",
      top: lado - Math.round(18 * k),
      transform: [{ translateX: anda(x, -12) }, { scale: tamanho }],
    };
    const bebeChegando: EstiloAnimado = {
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
    };
    const crescendo: EstiloAnimado = {
      transform: [
        { scale: tamanho },
        { translateY: pulo.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, -22, 0] }) },
        {
          rotate: pulo.interpolate({
            inputRange: [0, 0.25, 0.6, 1],
            outputRange: ["0deg", "-7deg", "6deg", "0deg"],
          }),
        },
      ],
    };
    return { numero, numeroChegando, perto, sombra, bebeChegando, crescendo };
  }, [x, y, rolagem, total, topo, altura, lado, k, numeroChega, bebeChega, tamanho, pulo]);

  const sombra = sombraDoTexto(ceu);
  const sec = tintaSecundaria(ceu);
  const tamanhoDoNumero = Math.round(250 * k);
  const voltarParaHoje = useCallback(() => regua.current?.irPara(semana), [semana]);

  return (
    <View style={{ height: total }}>
      {/* 1 · O número da semana, atrás do bebê. */}
      <Animated.View
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={camadas.numero}
      >
        <Animated.Text
          allowFontScaling={false}
          style={[
            camadas.numeroChegando,
            {
              ...fonteDoNumero,
              fontSize: tamanhoDoNumero,
              lineHeight: Math.round(258 * k),
              letterSpacing: -12 * k,
              fontVariant: ["tabular-nums"],
              color: ceu.numero,
              textShadowColor: comAlfa(cor.texto, 0.16),
              textShadowOffset: { width: 0, height: 8 },
              textShadowRadius: 22,
            },
          ]}
        >
          {vista}
        </Animated.Text>
      </Animated.View>

      {/* 2 · O bebê: perto. Vem na frente, gira de leve e encolhe ao rolar. */}
      <Animated.View pointerEvents="box-none" style={camadas.perto}>
        <Animated.View pointerEvents="none" style={camadas.sombra}>
          <SombraDeContato largura={Math.round(190 * k)} />
        </Animated.View>
        <Animated.View pointerEvents="box-none" style={camadas.bebeChegando}>
          <View pointerEvents="none">
            <Brilho tamanho={Math.round(320 * k)} />
          </View>
          <Faiscas gatilho={faiscas} lado={lado} />
          {/* O Flutuar dá três voltas ao aparecer e descansa (`vaivemQueDescansa`). */}
          <Flutuar>
            <Animated.View style={camadas.crescendo}>
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel={`${quem} com ${vista} semanas`}
                accessibilityHint="Toque para um carinho"
                onPress={aoTocarNoBebe}
              >
                <Image
                  source={arteDoBebe(vista)}
                  style={{ width: lado, height: lado }}
                  contentFit="contain"
                  transition={reduzido ? 0 : 180}
                />
              </Pressable>
            </Animated.View>
          </Flutuar>
        </Animated.View>
      </Animated.View>

      {/* O alto: a saudação (Bebê) ou o voltar (semana a semana). */}
      {cabecalho}

      {/* O nome, a semana, a régua do tempo e um selo. */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 12, alignItems: "center" }}>
        {nomeDoBebe ? (
          <Text
            numberOfLines={1}
            style={{
              ...fonte.display,
              ...escala.titulo1,
              letterSpacing: -0.2,
              paddingHorizontal: margem.tela,
              color: ceu.tinta,
              ...sombra,
            }}
          >
            {nomeDoBebe}
          </Text>
        ) : null}
        <Text
          style={{
            marginTop: 2,
            paddingHorizontal: margem.tela,
            textAlign: "center",
            ...fonte.media,
            ...escala.legenda,
            color: sec,
            ...sombraDoPe(ceu),
          }}
        >
          {modo === "semanas" || viajando
            ? `Semana ${vista} · tamanho de ${bebe.fruit.toLowerCase()}`
            : `${semana} semanas${dias > 0 ? ` e ${dias} ${dias === 1 ? "dia" : "dias"}` : ""}`}
        </Text>

        <ReguaDoTempo
          controle={regua}
          inicial={prender(abre)}
          vista={prender(vista)}
          ceu={ceu}
          quem={quem}
          dica={mostrarDica}
          aoGirar={aoGirar}
          aoArrastar={aoArrastar}
        />

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: espaco.sm,
            marginTop: 6,
            paddingHorizontal: margem.tela,
          }}
        >
          {modo === "semanas" ? (
            <>
              <Selo>{`${trimesterForWeek(vista)}º trimestre`}</Selo>
              {semData ? null : (
                <Selo>{vista === semana ? "Esta semana" : vista < semana ? "Já passou" : "Vem aí"}</Selo>
              )}
              {viajando && !semData ? <SeloDeHoje aoTocar={voltarParaHoje} /> : null}
            </>
          ) : viajando ? (
            <>
              <Selo icone={<Ruler size={14} color={cor.textoApagado} strokeWidth={2.2} />}>
                {bebe.size}
              </Selo>
              {bebe.weight !== "—" ? (
                <Selo icone={<Weight size={14} color={cor.textoApagado} strokeWidth={2.2} />}>
                  {bebe.weight}
                </Selo>
              ) : null}
              <SeloDeHoje aoTocar={voltarParaHoje} />
            </>
          ) : faltam != null && faltam > 0 ? (
            <Selo icone={<Hourglass size={14} color={cor.textoApagado} strokeWidth={2.2} />}>
              faltam {faltam} {faltam === 1 ? "dia" : "dias"}
            </Selo>
          ) : null}
        </View>
      </View>
    </View>
  );
});

function SeloDeHoje({ aoTocar }: { aoTocar: () => void }) {
  return (
    <Tocavel
      rotulo="Voltar para a semana de hoje"
      aoTocar={aoTocar}
      estilo={{ minHeight: ALVO_MINIMO, justifyContent: "center" }}
    >
      <Selo
        cor={cor.primariaEscura}
        icone={<Undo2 size={14} color={cor.primariaEscura} strokeWidth={2.4} />}
      >
        Hoje
      </Selo>
    </Tocavel>
  );
}

/**
 * O ALTO DO CÉU NO BEBÊ: a data, a chama e a foto dela numa linha, e o
 * bom-dia embaixo, grande, na serifada (o título da aba: 34/41, margem 16).
 */
export const SaudacaoNoCeu = memo(function SaudacaoNoCeu({
  topo,
  ceu,
  data,
  saudacao,
  chama,
  aoVerTrilha,
  direita,
}: {
  topo: number;
  ceu: Ceu;
  data: string;
  saudacao: string;
  chama: number;
  aoVerTrilha: () => void;
  direita?: ReactNode;
}) {
  const sombra = sombraDoTexto(ceu);
  return (
    <View style={{ paddingTop: topo + espaco.xs, paddingHorizontal: margem.tela }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            ...fonte.forte,
            ...escala.nota,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            color: tintaSecundaria(ceu),
            ...sombra,
          }}
        >
          {data}
        </Text>
        <SeloDaChama chama={chama} aoTocar={aoVerTrilha} />
        {direita}
      </View>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={{
          ...fonte.display,
          ...escala.grande,
          letterSpacing: -0.2,
          color: ceu.tinta,
          ...sombra,
        }}
      >
        {saudacao}
      </Text>
    </View>
  );
});

/**
 * A CHAMA NO CÉU (18/11/2026, a vistoria: "num Duolingo para gestantes a
 * chama é o motor do hábito"): ficava na última linha da tela, depois de tudo.
 * Agora mora ao lado da foto dela, e abre a Trilha.
 */
export function SeloDaChama({ chama, aoTocar }: { chama: number; aoTocar: () => void }) {
  const acesa = chama > 0;
  return (
    <Tocavel
      rotulo={
        acesa
          ? `${chama} ${chama === 1 ? "dia seguido" : "dias seguidos"} cuidando de vocês. Abrir a trilha`
          : "Abrir a trilha"
      }
      aoTocar={aoTocar}
      estilo={{ minHeight: ALVO_MINIMO, justifyContent: "center" }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          minHeight: 36,
          paddingLeft: 10,
          paddingRight: 13,
          borderRadius: canto.pilula,
          ...MATERIAL_DO_SELO,
        }}
      >
        <Flame
          size={18}
          color={acesa ? corJornada.chama : cor.textoApagado}
          fill={acesa ? ouro.medio : "transparent"}
          strokeWidth={2.2}
        />
        <Text
          style={{
            ...fonte.titulo,
            fontSize: 15,
            lineHeight: 20,
            fontVariant: ["tabular-nums"],
            color: acesa ? cor.texto : cor.textoApagado,
          }}
        >
          {chama}
        </Text>
      </View>
    </Tocavel>
  );
}

/** A sombra do bebê no ar: é ela que diz que ele é um objeto, e não um adesivo. */
const SombraDeContato = memo(function SombraDeContato({ largura }: { largura: number }) {
  const altura = Math.round((largura * 34) / 190);
  return (
    <Svg width={largura} height={altura} viewBox="0 0 190 34">
      <Defs>
        <RadialGradient id="sombra-do-bebe" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={cor.texto} stopOpacity={0.34} />
          <Stop offset="0.6" stopColor={cor.texto} stopOpacity={0.12} />
          <Stop offset="1" stopColor={cor.texto} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={95} cy={17} rx={95} ry={17} fill="url(#sombra-do-bebe)" />
    </Svg>
  );
});

/* ── As faíscas do toque ──────────────────────────────────────────────── */

const RAIOS = [0, 40, 85, 130, 170, 215, 260, 305];

/** Oito faíscas que saem do bebê e somem, a cada toque. */
const Faiscas = memo(function Faiscas({ gatilho, lado }: { gatilho: number; lado: number }) {
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
      style={{ position: "absolute", left: lado / 2, top: lado / 2, width: 0, height: 0 }}
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
              color: i % 2 ? ouro.claro : cor.branco,
              textShadowColor: comAlfa(ouro.claro, 0.9),
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
});

/* ── A régua do tempo ─────────────────────────────────────────────────── */

const SEMANAS = Array.from({ length: ULTIMA - PRIMEIRA + 1 }, (_, i) => PRIMEIRA + i);

/**
 * A RÉGUA DO TEMPO: uma régua de semanas que ela arrasta, com a agulha parada
 * no meio. Cada risco é uma semana; os de quatro em quatro levam o número. Os
 * riscos se apagam para os lados (é um disco, não uma fita), e cada semana que
 * passa pela agulha dá um tique na mão.
 *
 * A semana VISTA só serve ao leitor de tela (o valor do controle ajustável): a
 * fita com os riscos não depende dela e não se redesenha no arrasto.
 */
export const ReguaDoTempo = memo(function ReguaDoTempo({
  controle,
  inicial,
  vista,
  ceu,
  quem,
  dica,
  aoGirar,
  aoArrastar,
}: {
  /** Por onde o "Hoje" manda a régua de volta. */
  controle: RefObject<ControleDaRegua | null>;
  /** A semana em que a régua abre. */
  inicial: number;
  vista: number;
  ceu: Ceu;
  quem: string;
  /** A dica "arraste para…", até o primeiro arrasto. */
  dica: boolean;
  aoGirar: (semana: number) => void;
  aoArrastar?: () => void;
}) {
  const lista = useRef<ScrollView>(null);
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
      style={{ alignSelf: "stretch", marginTop: 6 }}
    >
      <FitaDaRegua
        lista={lista}
        inicial={inicial}
        ceu={ceu}
        aoGirar={aoGirar}
        aoArrastar={aoArrastar}
      />
      {dica ? (
        <Text
          style={{
            textAlign: "center",
            ...fonte.media,
            ...escala.nota,
            color: tintaSecundaria(ceu),
            ...sombraDoPe(ceu),
          }}
        >
          arraste para ver {quem} crescer
        </Text>
      ) : null}
    </View>
  );
});

/** Os riscos e a agulha: desenhados uma vez; o arrasto só move o nativo. */
const FitaDaRegua = memo(function FitaDaRegua({
  lista,
  inicial,
  ceu,
  aoGirar,
  aoArrastar,
}: {
  lista: RefObject<ScrollView | null>;
  inicial: number;
  ceu: Ceu;
  aoGirar: (semana: number) => void;
  aoArrastar?: () => void;
}) {
  const { width } = useWindowDimensions();
  const ultima = useRef(inicial);
  const pos = useRef(new Animated.Value((inicial - PRIMEIRA) * PASSO)).current;
  const margemDaFita = width / 2 - PASSO / 2;

  /* A web ignora `contentOffset`: lá a régua precisa ser levada até a semana. */
  useEffect(() => {
    if (Platform.OS !== "web") return;
    lista.current?.scrollTo({ x: (inicial - PRIMEIRA) * PASSO, y: 0, animated: false });
  }, [inicial, lista]);

  const aoRolar = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: pos } } }], {
        useNativeDriver: true,
        listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const s = prender(Math.round(e.nativeEvent.contentOffset.x / PASSO) + PRIMEIRA);
          if (s === ultima.current) return;
          ultima.current = s;
          selecao();
          aoGirar(s);
        },
      }),
    [pos, aoGirar],
  );

  const tinta = ceu.tinta;
  const tintaDoNumero = tintaSecundaria(ceu);
  const sombra = sombraDoPe(ceu);

  return (
    <View style={{ height: ALVO_MINIMO }}>
      <Animated.ScrollView
        ref={lista}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={PASSO}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={aoRolar}
        onScrollBeginDrag={aoArrastar}
        contentOffset={{ x: (inicial - PRIMEIRA) * PASSO, y: 0 }}
        contentContainerStyle={{ paddingHorizontal: margemDaFita, alignItems: "flex-start" }}
        style={{ height: ALVO_MINIMO }}
      >
        {SEMANAS.map((s, i) => (
          <MarcaDaSemana
            key={s}
            s={s}
            i={i}
            pos={pos}
            tinta={tinta}
            tintaDoNumero={tintaDoNumero}
            sombra={sombra}
          />
        ))}
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
            backgroundColor: ceu.claro ? cor.primaria : cor.branco,
            boxShadow: ceu.claro
              ? `0px 2px 6px ${comAlfa(cor.primaria, 0.45)}`
              : `0px 0px 10px ${comAlfa(cor.branco, 0.9)}`,
          }}
        />
      </View>
    </View>
  );
});

/** Um risco da régua: as interpolações nascem uma vez, e não a cada semana que passa. */
const MarcaDaSemana = memo(function MarcaDaSemana({
  s,
  i,
  pos,
  tinta,
  tintaDoNumero,
  sombra,
}: {
  s: number;
  i: number;
  pos: Animated.Value;
  tinta: string;
  tintaDoNumero: string;
  sombra: ReturnType<typeof sombraDoPe>;
}) {
  const cheia = s % 4 === 0;
  const estilos = useMemo(() => {
    const c = i * PASSO;
    const apaga: EstiloAnimado = {
      alignItems: "center",
      opacity: pos.interpolate({
        inputRange: [c - PASSO * 9, c - PASSO * 2, c, c + PASSO * 2, c + PASSO * 9],
        outputRange: [0, 0.6, 1, 0.6, 0],
        extrapolate: "clamp",
      }),
    };
    const estica: EstiloAnimado = {
      transform: [
        {
          scaleY: pos.interpolate({
            inputRange: [c - PASSO, c, c + PASSO],
            outputRange: [1, 1.5, 1],
            extrapolate: "clamp",
          }),
        },
      ],
    };
    return { apaga, estica };
  }, [pos, i]);
  return (
    <View style={{ width: PASSO, alignItems: "center" }}>
      <Animated.View style={estilos.apaga}>
        <Animated.View
          style={[
            {
              marginTop: 6,
              width: cheia ? 2.5 : 1.5,
              height: cheia ? 16 : 10,
              borderRadius: 2,
              backgroundColor: tinta,
              opacity: cheia ? 0.95 : 0.6,
            },
            estilos.estica,
          ]}
        />
        {cheia ? (
          <Text
            maxFontSizeMultiplier={1.3}
            style={{
              position: "absolute",
              top: 25,
              width: 30,
              textAlign: "center",
              ...fonte.forte,
              ...escala.nota,
              fontVariant: ["tabular-nums"],
              color: tintaDoNumero,
              ...sombra,
            }}
          >
            {s}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
});

/** O material dos selos sobre o céu: claro, com o fio de luz (não é vidro: o céu se mexe). */
const MATERIAL_DO_SELO = {
  backgroundColor: luz.cartao,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: vidro.borda,
  ...curva,
  ...sombraDoCartao,
} as const;

/**
 * A etiqueta sobre o céu ("faltam 109 dias", "2º trimestre"): uma pílula clara
 * sobre a arte, com o ícone de traço fino no lugar do emoji. (Era vidro; sobre
 * o céu que se mexe, o desfoque era refeito a cada quadro — 17/11/2026.)
 */
export function Selo({
  children,
  icone,
  cor: tinta = cor.textoCorpo,
}: {
  children: ReactNode;
  icone?: ReactNode;
  cor?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 13,
        paddingVertical: 7,
        borderRadius: canto.pilula,
        ...MATERIAL_DO_SELO,
      }}
    >
      {icone}
      <Text style={{ ...fonte.forte, ...escala.nota, color: tinta }}>{children}</Text>
    </View>
  );
}
