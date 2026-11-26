import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { createContext, memo, useContext, useEffect, useRef, useState } from "react";
import { Animated, AppState, Easing, StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { useMovimentoReduzido, vaivemQueDescansa } from "~/componentes/movimento";
import { parametroDaBancada } from "~/lib/bancada";

/**
 * O CÉU VIVO (16/11/2026, o dono: "mais criatividade e ousadia [...] algo
 * ainda melhor e imersivo [...] um app que as pessoas vão baixar e ficar
 * impressionadas").
 *
 * As artes do céu foram pintadas do tamanho da tela inteira do iPhone
 * (1440×3113), com horizonte, colinas, sol e lua — e o app mostrava só a
 * metade de cima, com uma folha branca por baixo. Agora o céu da hora é o
 * LUGAR: ocupa a tela toda, parado atrás da rolagem (como o fundo do app
 * Tempo da Apple), e os painéis flutuam sobre ele.
 *
 * E ele está VIVO, conforme a hora: de noite as estrelas piscam, uma estrela
 * cadente passa e vaga-lumes sobem das colinas; de dia nuvens atravessam
 * devagar. Tudo é enfeite — fora da acessibilidade, sem toque, só opacidade e
 * transform no fio nativo — e com "reduzir movimento" fica a mesma cena,
 * parada.
 *
 * ⚠️ SÃO DOIS CÉUS, O DO DIA E O DA NOITE (decisão do dono, 23/11/2026,
 * cobrada em 26/11): "tirar as 4 artes e deixar somente duas, de dia e noite;
 * a de noite já sabemos qual é, a do dia [...] essa que está nas imagens que
 * te mandei" — o LILÁS (`amanhecer.webp`), que é a paleta do app e o único em
 * que o texto escuro se lê sem sombra. O azul do meio-dia (`dia.webp`) e o
 * pôr do sol (`por-do-sol.webp`) saíram do app (os arquivos são do site, que
 * não muda). A fase continua se chamando "amanhecer" no código, mas é o céu
 * do DIA inteiro, das 5h às 19h. `ceu-vivo.test.ts` cobra.
 */

export type FaseDoCeu = "amanhecer" | "noite";

export type Ceu = {
  arte: number;
  /** A tinta do que se escreve direto sobre este céu. */
  tinta: string;
  sec: string;
  /** A cor do número de trás: branco, mais ou menos presente conforme o céu. */
  numero: string;
  /** A cor do alto do céu (onde o que rola se desfaz, sob o relógio do iPhone). */
  topo: string;
  /** A cor do pé da arte: o fundo de quem ainda não carregou a imagem. */
  chao: string;
  /** O céu é claro (a tinta é escura)? Nos outros, o texto ganha uma sombra leve. */
  claro: boolean;
};

export const CEUS: Record<FaseDoCeu, Ceu> = {
  amanhecer: {
    arte: require("../../../src/assets/ceu/amanhecer.webp"),
    tinta: "#2e2348",
    /* 4,5:1 sobre o lilás claro do pé do céu (era #55487e, 3,8:1). */
    sec: "#3b3064",
    numero: "rgba(255,255,255,0.6)",
    topo: "#8f90df",
    chao: "#b3a4e6",
    claro: true,
  },
  noite: {
    arte: require("../../../src/assets/ceu/anoitecer.webp"),
    tinta: "#ffffff",
    sec: "#dcd6ff",
    numero: "rgba(255,255,255,0.24)",
    topo: "#10126b",
    chao: "#2a1f9a",
    claro: false,
  },
};

/** O céu da hora: o lilás de dia (das 5h às 19h) e o da noite (as mesmas horas do quartinho). */
export function ceuDaHora(hora: number): FaseDoCeu {
  return hora >= 5 && hora < 19 ? "amanhecer" : "noite";
}

/** O céu de agora, pela hora do aparelho (na bancada, `&hora=`). */
export function faseDeAgora(): FaseDoCeu {
  const hora = Number(parametroDaBancada("hora") ?? new Date().getHours());
  return ceuDaHora(Number.isFinite(hora) ? hora : 8);
}

/** O céu de agora, que acompanha o relógio com o app aberto e ao voltar para ele. */
export function useFaseDoCeu(): FaseDoCeu {
  const [fase, setFase] = useState(faseDeAgora);
  useEffect(() => {
    const acertar = () => setFase(faseDeAgora());
    const relogio = setInterval(acertar, 60_000);
    const sub = AppState.addEventListener("change", (s) => s === "active" && acertar());
    return () => {
      clearInterval(relogio);
      sub.remove();
    };
  }, []);
  return fase;
}

/**
 * O CÉU DAS ABAS: um céu só, atrás das três abas (`(abas)/_layout.tsx`). Cada
 * aba que quer o céu fica transparente e lê daqui a fase (para a tinta) e a
 * inclinação do celular (para as camadas dela andarem junto). Trocar de aba é
 * trocar o que flutua sobre o MESMO lugar: as nuvens não pulam, e o aparelho
 * anima um céu, e não três. Fora das abas (ou numa tela que cobre o fundo),
 * `null`.
 */
export type CeuDasAbas = { fase: FaseDoCeu; x: Animated.Value; y: Animated.Value };
export const CeuCompartilhado = createContext<CeuDasAbas | null>(null);
export const useCeuDasAbas = () => useContext(CeuCompartilhado);

/** A sombra que deixa o texto branco legível sobre um céu claro em algum ponto. */
export function sombraDoTexto(ceu: Ceu) {
  return ceu.claro
    ? null
    : ({
        textShadowColor: "rgba(20,10,60,0.32)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 8,
      } as const);
}

/* A arte é um pouco maior que a tela, para ter para onde andar com o celular e
   com a rolagem — pouco, porque a lua e o sol ficam perto da borda. */
const ESCALA = 1.08;

export const CeuVivo = memo(function CeuVivo({
  fase,
  rolagem,
  x,
  y,
}: {
  fase: FaseDoCeu;
  /** Quanto a tela rolou: o céu sobe bem devagar, e estica quando ela puxa. */
  rolagem?: Animated.Value;
  /** A inclinação do celular (`useParalaxe`): o céu anda pouco, e ao contrário. */
  x?: Animated.Value;
  y?: Animated.Value;
}) {
  const ceu = CEUS[fase];
  const transform = [
    ...(rolagem
      ? [
          {
            translateY: rolagem.interpolate({
              inputRange: [-300, 0, 1400],
              outputRange: [40, 0, -26],
              extrapolate: "clamp" as const,
            }),
          },
          {
            scale: rolagem.interpolate({
              inputRange: [-300, 0],
              outputRange: [1.3, ESCALA],
              extrapolateRight: "clamp" as const,
            }),
          },
        ]
      : [{ scale: ESCALA }]),
    ...(x ? [{ translateX: x.interpolate({ inputRange: [-1, 1], outputRange: [9, -9] }) }] : []),
    ...(y ? [{ translateY: y.interpolate({ inputRange: [-1, 1], outputRange: [6, -6] }) }] : []),
  ];
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[StyleSheet.absoluteFill, { overflow: "hidden", backgroundColor: ceu.chao }]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { transform }]}>
        <Image
          source={ceu.arte}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
        {fase === "noite" ? (
          <>
            {/* Um terço das estrelas parado; dois terços piscam ao chegar e
                descansam acesos (ver `CamadaDeEstrelas`). */}
            <EstrelasParadas qual={1} />
            <CamadaDeEstrelas qual={0} periodo={3200} atraso={0} />
            <CamadaDeEstrelas qual={2} periodo={4300} atraso={900} />
            <CamadaDeVagalumes qual={0} tom="#e3d4ff" periodo={5200} atraso={300} />
            <EstrelaCadente />
          </>
        ) : null}
        {fase === "amanhecer" ? (
          <>
            <CamadaDeEstrelas qual={0} periodo={3000} atraso={0} fraca />
            <Nuvem y={0.2} largura={230} segundos={95} fase={0.15} forca={0.5} />
            <Nuvem y={0.43} largura={300} segundos={130} fase={0.6} forca={0.42} />
            <CamadaDeVagalumes qual={0} tom="#ffffff" periodo={5200} atraso={600} />
          </>
        ) : null}
      </Animated.View>
    </View>
  );
});

/* ── As peças vivas ───────────────────────────────────────────────────── */

/**
 * Vai e volta entre 0 e 1 algumas vezes quando o céu aparece, e descansa em
 * 0,5 (`vaivemQueDescansa`: um laço eterno aqui custava a cada quadro, para
 * sempre). Parado em 0,5 com "reduzir movimento" ou com a tela fora de vista.
 */
function useVaivem(periodo: number, atraso = 0): Animated.Value {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (reduzido) return;
    const laco = vaivemQueDescansa(v, periodo);
    const t = setTimeout(() => laco.start(), atraso);
    return () => {
      clearTimeout(t);
      laco.stop();
      v.setValue(0.5);
    };
  }, [atraso, periodo, reduzido, v]);
  return v;
}

/* [x, y, tamanho] em fração da tela: no alto, onde o céu é escuro. */
const ESTRELAS: readonly (readonly [number, number, number])[] = [
  [0.07, 0.05, 2.4],
  [0.19, 0.11, 1.8],
  [0.33, 0.035, 2],
  [0.46, 0.14, 1.6],
  [0.58, 0.06, 2.6],
  [0.71, 0.115, 1.8],
  [0.9, 0.05, 2.2],
  [0.12, 0.21, 1.8],
  [0.27, 0.27, 2.4],
  [0.52, 0.24, 1.6],
  [0.66, 0.3, 2.2],
  [0.95, 0.19, 1.6],
  [0.05, 0.36, 2],
  [0.4, 0.38, 1.8],
  [0.8, 0.4, 2.4],
  [0.22, 0.45, 1.6],
];

/** Estrelas sem animação nenhuma (uma em cada três da lista): custo zero. */
function EstrelasParadas({ qual }: { qual: number }) {
  const { width, height } = useWindowDimensions();
  return (
    <View style={[StyleSheet.absoluteFill, { opacity: 0.75 }]}>
      {ESTRELAS.filter((_, i) => i % 3 === qual).map(([x, y, t], i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: x * width,
            top: y * height,
            width: t,
            height: t,
            borderRadius: t,
            backgroundColor: "#ffffff",
          }}
        />
      ))}
    </View>
  );
}

/**
 * Uma camada de estrelas: um valor só, e CADA ESTRELA pisca na sua vista
 * pequena. ⚠️ Não ponha a opacidade numa vista que cobre a tela inteira: o iOS
 * desenha a vista inteira fora da tela a cada quadro para aplicar a
 * opacidade ao grupo — medido em 17/11/2026, as duas camadas assim custavam
 * ~15% de processador do servidor de desenho, com o app parado. A camada
 * `qual` leva uma em cada três estrelas da lista. Sem sombra de brilho (a
 * sombra borrada é cara de desenhar): o ponto e um halo claro.
 */
function CamadaDeEstrelas({
  qual,
  periodo,
  atraso,
  fraca,
}: {
  qual: number;
  periodo: number;
  atraso: number;
  fraca?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const v = useVaivem(periodo, atraso);
  const opacity = v.interpolate({
    inputRange: [0, 1],
    outputRange: fraca ? [0.12, 0.55] : [0.3, 1],
  });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {ESTRELAS.filter((_, i) => i % 3 === qual).map(([x, y, t], i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            left: x * width - t,
            top: (fraca ? y * 0.7 : y) * height - t,
            width: t * 3,
            height: t * 3,
            borderRadius: t * 1.5,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.16)",
            opacity,
          }}
        >
          <View style={{ width: t, height: t, borderRadius: t, backgroundColor: "#ffffff" }} />
        </Animated.View>
      ))}
    </View>
  );
}

/** De tempos em tempos, um risco de luz atravessa o alto do céu. */
function EstrelaCadente() {
  const { width, height } = useWindowDimensions();
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduzido) return;
    /* Disparada de tempos em tempos (a cada 12 s), e não um laço com espera:
       entre uma passagem e outra não há animação nenhuma rodando. */
    let anim: Animated.CompositeAnimation | null = null;
    const passar = () => {
      v.setValue(0);
      anim = Animated.timing(v, {
        toValue: 1,
        duration: 1100,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      });
      anim.start(() => v.setValue(0));
    };
    const primeira = setTimeout(passar, 5200);
    const relogio = setInterval(passar, 12000);
    return () => {
      clearTimeout(primeira);
      clearInterval(relogio);
      anim?.stop();
    };
  }, [reduzido, v]);
  if (reduzido) return null;
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: width * 0.12,
        top: height * 0.07,
        width: 110,
        height: 2,
        opacity: v.interpolate({ inputRange: [0, 0.12, 0.75, 1], outputRange: [0, 1, 0.9, 0] }),
        transform: [
          { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, width * 0.62] }) },
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.16] }) },
          { rotate: "24deg" },
        ],
      }}
    >
      <LinearGradient
        colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.95)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ flex: 1, borderRadius: 2 }}
      />
    </Animated.View>
  );
}

/* [x, y] em fração da tela: junto das colinas. */
const VAGALUMES: readonly (readonly [number, number])[] = [
  [0.1, 0.66],
  [0.26, 0.72],
  [0.44, 0.63],
  [0.6, 0.7],
  [0.78, 0.65],
  [0.9, 0.74],
  [0.36, 0.8],
  [0.68, 0.82],
];

/**
 * Uma camada de vaga-lumes: um valor só, e cada vaga-lume sobe e desce na sua
 * vista pequena (a camada `qual` leva um em cada dois da lista). Como nas
 * estrelas: nunca a opacidade numa vista do tamanho da tela.
 */
function CamadaDeVagalumes({
  qual,
  tom,
  periodo,
  atraso,
}: {
  qual: number;
  tom: string;
  periodo: number;
  atraso: number;
}) {
  const { width, height } = useWindowDimensions();
  const v = useVaivem(periodo, atraso);
  const opacity = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.15, 0.85, 0.25] });
  const transform = [
    { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, -16] }) },
    { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-5, 6] }) },
  ];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {VAGALUMES.filter((_, i) => i % 2 === qual).map(([x, y], i) => {
        const t = 3 + ((i + qual) % 3);
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: x * width - t,
              top: y * height - t,
              width: t * 3,
              height: t * 3,
              borderRadius: t * 1.5,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(227,212,255,0.22)",
              opacity,
              transform,
            }}
          >
            <View style={{ width: t, height: t, borderRadius: t, backgroundColor: tom }} />
          </Animated.View>
        );
      })}
    </View>
  );
}

/**
 * Uma nuvem macia que atravessa o céu, da esquerda para a direita, e volta a
 * entrar. `fase` (0–1) é de onde ela começa, para as nuvens não saírem juntas.
 */
function Nuvem({
  y,
  largura,
  segundos,
  fase,
  forca,
  tom = "#ffffff",
}: {
  y: number;
  largura: number;
  segundos: number;
  fase: number;
  forca: number;
  tom?: string;
}) {
  const { width, height } = useWindowDimensions();
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(0)).current;
  /* Aonde a nuvem já foi (soma a cada vez que a tela aparece). */
  const andou = useRef(0);
  useEffect(() => {
    if (reduzido) return;
    /* A nuvem DESLIZA um trecho quando o céu aparece e assenta devagar — e não
       um laço eterno (17/11/2026: tudo o que se mexe sem parar custa a cada
       quadro, para sempre; e nuvem parada é nuvem de verdade). */
    andou.current += 0.2;
    const anim = Animated.timing(v, {
      toValue: andou.current,
      duration: segundos * 280,
      easing: Easing.out(Easing.sin),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduzido, segundos, v]);
  const altura = largura * 0.36;
  const id = `nuvem-${Math.round(y * 100)}-${largura}`;
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: -largura,
        top: y * height,
        transform: [
          {
            translateX: Animated.modulo(Animated.add(v, fase), 1).interpolate({
              inputRange: [0, 1],
              outputRange: [0, width + largura],
            }),
          },
        ],
      }}
    >
      <Svg width={largura} height={altura}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            {/* A força vai no próprio degradê, e não numa opacidade da vista:
                vista com opacidade e filhos é desenhada fora da tela a cada
                quadro em que se move. */}
            <Stop offset="0" stopColor={tom} stopOpacity={0.95 * forca} />
            <Stop offset="0.6" stopColor={tom} stopOpacity={0.4 * forca} />
            <Stop offset="1" stopColor={tom} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={largura * 0.5}
          cy={altura * 0.62}
          rx={largura * 0.5}
          ry={altura * 0.36}
          fill={`url(#${id})`}
        />
        <Ellipse
          cx={largura * 0.36}
          cy={altura * 0.46}
          rx={largura * 0.24}
          ry={altura * 0.4}
          fill={`url(#${id})`}
        />
        <Ellipse
          cx={largura * 0.62}
          cy={altura * 0.4}
          rx={largura * 0.27}
          ry={altura * 0.4}
          fill={`url(#${id})`}
        />
      </Svg>
    </Animated.View>
  );
}
