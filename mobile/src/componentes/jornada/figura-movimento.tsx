import { createContext, memo, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Animated, Easing, View, type ViewStyle } from "react-native";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";
import type { PoseKey } from "@/lib/exercicios";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { clarear } from "~/lib/cor";
import { quadroNoTempo, USOS, type Parte, type Uso } from "~/lib/jornada/figura";

/**
 * A FIGURA DEMONSTRANDO O MOVIMENTO — o desenho de `figura-movimento.tsx` do
 * site, traço por traço, com as mesmas coordenadas. Ela ensina o que o emoji
 * não ensinava: como o corpo entra na posição.
 *
 * AS ANIMAÇÕES NO FIO NATIVO (18/11/2026, a vistoria: "30 commits de caminhos
 * SVG por segundo durante toda a sessão"). Antes um relógio no JS
 * (`requestAnimationFrame` + `setState`) redesenhava a figura inteira a 30
 * quadros por segundo. Agora cada pedaço que se mexe é uma CAMADA: um SVG
 * parado dentro de uma `Animated.View`, e quem anda é a transformação dela
 * (girar, deslocar, esticar, a opacidade), no motor nativo, sem o JS. Os
 * números saem da mesma tabela (`~/lib/jornada/figura`, os `@keyframes` do
 * site): o ciclo de cada movimento é amostrado em pontos e vira uma
 * interpolação — a curva `ease-in-out` do CSS fica nos pontos, já que a
 * interpolação nativa não leva curva.
 *
 * Com "Reduzir movimento" ela fica na primeira pose — o mesmo `animation: none`
 * do site, e nada se perde: os passos estão escritos embaixo.
 */

/** Quantos pontos por ciclo: a curva fica lisa e a tabela, pequena. */
const PONTOS = 48;

const TRACO = {
  fill: "none",
  strokeWidth: 3.2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/**
 * O recheio da cabeça e da barriga: o traço sozinho era um boneco de palito, e
 * com o tom claro por dentro a figura ganha corpo — sem mudar uma coordenada
 * nem um movimento. Braços e pernas são desenhados DEPOIS, por cima dele.
 */
const recheio = (tinta: string) => clarear(tinta, 0.86);

/** O palco: o tamanho na tela, a caixa do desenho e o relógio da figura. */
type Palco = {
  anim: string;
  tinta: string;
  fase: Animated.Value;
  largura: number;
  altura: number;
  caixa: readonly [number, number, number, number];
  /** A escala do desenho na tela e o deslocamento do "meet" do SVG. */
  s: number;
  dx: number;
  dy: number;
};

const PalcoDaFigura = createContext<Palco | null>(null);

function montarPalco(anim: string, tinta: string, fase: Animated.Value, deitada: boolean): Palco {
  const largura = deitada ? 160 : 128;
  const altura = deitada ? 112 : 160;
  const caixa: readonly [number, number, number, number] = deitada
    ? [12, 20, 130, 90]
    : [0, 0, 120, 150];
  const s = Math.min(largura / caixa[2], altura / caixa[3]);
  return {
    anim,
    tinta,
    fase,
    largura,
    altura,
    caixa,
    s,
    dx: (largura - caixa[2] * s) / 2,
    dy: (altura - caixa[3] * s) / 2,
  };
}

export const FiguraMovimento = memo(function FiguraMovimento({
  pose,
  anim,
  tinta,
}: {
  pose: PoseKey;
  /** A `id` do movimento: é ela que diz qual pedaço se mexe. */
  anim: string;
  tinta: string;
}) {
  const reduzido = useMovimentoReduzido();
  const fase = useRef(new Animated.Value(0)).current;
  /* O ciclo do movimento (os pedaços de um movimento andam no mesmo tempo). */
  const duracao = Math.max(0, ...(USOS[anim] ?? []).map((u) => u.duracao));
  useEffect(() => {
    fase.setValue(0);
    if (reduzido || duracao <= 0) return;
    /* Um laço só, inteiro no motor nativo: é a demonstração, enquanto ela
       faz o movimento (função, e não enfeite). */
    const laco = Animated.loop(
      Animated.timing(fase, {
        toValue: 1,
        duration: duracao * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    laco.start();
    return () => laco.stop();
  }, [anim, duracao, reduzido, fase]);

  /* Deitada e de quatro são largas e baixas: no quadro alto sobraria espaço em
     cima e embaixo, e o desenho encolheria pela metade. */
  const deitada = pose === "quatro" || pose === "deitada";
  const palco = useMemo(
    () => montarPalco(anim, tinta, fase, deitada),
    [anim, tinta, fase, deitada],
  );
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Demonstração do movimento"
      style={{ width: palco.largura, height: palco.altura }}
    >
      <PalcoDaFigura.Provider value={palco}>
        {pose === "quatro" ? <Quatro /> : null}
        {pose === "pe" ? <EmPe /> : null}
        {pose === "sentada" ? <Sentada /> : null}
        {pose === "borboleta" ? <Borboleta /> : null}
        {pose === "deitada" ? <Deitada /> : null}
        {pose === "parede" ? <Parede /> : null}
      </PalcoDaFigura.Provider>
    </View>
  );
});

const usePalco = () => useContext(PalcoDaFigura)!;

/** Uma camada parada do desenho: um SVG do tamanho do palco, por cima do anterior. */
function Camada({ children }: { children: ReactNode }) {
  const p = usePalco();
  return (
    <Svg
      width={p.largura}
      height={p.altura}
      viewBox={p.caixa.join(" ")}
      style={{ position: "absolute", left: 0, top: 0 }}
      pointerEvents="none"
    >
      {children}
    </Svg>
  );
}

type Transformacao = NonNullable<ViewStyle["transform"]>;

/**
 * O que a vista de uma parte recebe: as transformações e a opacidade, como
 * interpolações do relógio da figura. A origem do site (em coordenadas do
 * desenho) vira um deslocamento em volta do centro da vista.
 */
function animacaoDaParte(
  uso: Uso,
  p: Palco,
): { transform?: Transformacao; opacity?: Animated.AnimatedInterpolation<number> } {
  const amostras = Array.from({ length: PONTOS + 1 }, (_, k) =>
    quadroNoTempo(
      uso.quadros,
      uso.duracao,
      uso.curva,
      /* O último ponto é o fim do ciclo, e não o começo do próximo: o
         tornozelo gira até 360°, e não volta de 352° para 0°. */
      Math.min((k / PONTOS) * uso.duracao, uso.duracao - 1e-4),
    ),
  );
  const entrada = amostras.map((_, k) => k / PONTOS);
  const serie = (valores: number[], unidade?: "deg") => {
    if (valores.every((v) => v === valores[0]))
      return unidade ? `${valores[0]}${unidade}` : valores[0]!;
    return p.fase.interpolate({
      inputRange: entrada,
      outputRange: unidade ? valores.map((v) => `${v}${unidade}`) : valores,
    });
  };
  const fora: {
    transform?: Transformacao;
    opacity?: Animated.AnimatedInterpolation<number>;
  } = {};
  const primeiro = amostras[0]!;
  if (primeiro.transform) {
    const [ox, oy] = uso.origem ?? [0, 0];
    /* A origem na tela, medida do centro da vista (a origem do RN). */
    const cx = (ox - p.caixa[0]) * p.s + p.dx - p.largura / 2;
    const cy = (oy - p.caixa[1]) * p.s + p.dy - p.altura / 2;
    const meio: Record<string, unknown>[] = [];
    primeiro.transform.forEach(([funcao], j) => {
      const arg = (n: number) => amostras.map((a) => (a.transform![j]![n + 1] as number) ?? 0);
      const px = (n: number) => arg(n).map((v) => v * p.s);
      if (funcao === "translate") {
        meio.push({ translateX: serie(px(0)) }, { translateY: serie(px(1)) });
      } else if (funcao === "translateX") meio.push({ translateX: serie(px(0)) });
      else if (funcao === "translateY") meio.push({ translateY: serie(px(0)) });
      else if (funcao === "rotate") meio.push({ rotate: serie(arg(0), "deg") });
      else if (funcao === "scale") meio.push({ scale: serie(arg(0)) });
      else if (funcao === "scaleX") meio.push({ scaleX: serie(arg(0)) });
      else meio.push({ skewX: serie(arg(0), "deg") });
    });
    fora.transform = [
      { translateX: cx },
      { translateY: cy },
      ...meio,
      { translateX: -cx },
      { translateY: -cy },
    ] as unknown as Transformacao;
  }
  if (primeiro.opacidade != null) {
    fora.opacity = p.fase.interpolate({
      inputRange: entrada,
      outputRange: amostras.map((a) => a.opacidade ?? 1),
    });
  }
  return fora;
}

/**
 * Um pedaço que se mexe neste movimento (um `<g>` do site). Se o movimento de
 * agora não o anima, é uma vista parada — o desenho fica igual.
 */
function Mexe({ parte, children }: { parte: Parte; children: ReactNode }) {
  const p = usePalco();
  const estilo = useMemo(() => {
    const uso = USOS[p.anim]?.find((u) => u.parte === parte);
    return uso ? animacaoDaParte(uso, p) : null;
  }, [p, parte]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: "absolute", left: 0, top: 0, width: p.largura, height: p.altura },
        estilo,
      ]}
    >
      {children}
    </Animated.View>
  );
}

function Linha({ d: caminho, ...resto }: { d: string; strokeWidth?: number; opacity?: number }) {
  const { tinta } = usePalco();
  return <Path d={caminho} stroke={tinta} {...TRACO} {...resto} />;
}

function Chao({ d = "M24 144 L96 144" }: { d?: string }) {
  return <Linha d={d} strokeWidth={2.2} opacity={0.35} />;
}

function Cabeca() {
  const { tinta } = usePalco();
  return (
    <>
      <Circle cx={60} cy={24} r={12} stroke={tinta} {...TRACO} fill={recheio(tinta)} />
      <Linha d="M60 36 L60 46" />
    </>
  );
}

function TroncoFrente() {
  const { tinta } = usePalco();
  return (
    <>
      <Linha d="M60 46 L60 68" />
      <Ellipse cx={60} cy={78} rx={20} ry={17} stroke={tinta} {...TRACO} fill={recheio(tinta)} />
    </>
  );
}

function EmPe() {
  const { anim } = usePalco();
  const alonga = anim === "bracos";
  return (
    <>
      <Camada>
        <Cabeca />
        <TroncoFrente />
      </Camada>
      {/* Ombros e braços viajam juntos no rolar de ombros: é o conjunto que
          sobe e desce, não o braço solto. */}
      <Mexe parte="ombros">
        <Camada>
          <Linha d="M44 50 L76 50" />
        </Camada>
        {/* Braços para o alto trocam a POSE inteira, e não giram: duas poses
            cruzando a opacidade, o mesmo truque do gato-camelo. */}
        <Mexe parte="bracosBaixos">
          <Camada>
            <Linha d="M44 50 L32 74 L30 94" />
            <Linha d="M76 50 L88 74 L90 94" />
          </Camada>
        </Mexe>
        {alonga ? (
          <Mexe parte="bracosAltos">
            <Camada>
              <Linha d="M44 50 L48 28 L57 12" />
              <Linha d="M76 50 L72 28 L63 12" />
            </Camada>
          </Mexe>
        ) : null}
      </Mexe>
      <Mexe parte="quadril">
        <Camada>
          <Linha d="M48 96 L72 96" />
          <Linha d="M52 96 L50 120 L50 140" />
          <Linha d="M68 96 L70 120 L70 140" />
        </Camada>
      </Mexe>
      <Camada>
        <Chao />
      </Camada>
    </>
  );
}

function Sentada() {
  return (
    <>
      {/* A cadeira: sem ela a figura parece flutuar de joelhos dobrados. */}
      <Camada>
        <Linha d="M40 100 L88 100 L88 140" strokeWidth={2.4} opacity={0.35} />
      </Camada>
      <Mexe parte="tronco">
        <Mexe parte="cabeca">
          <Camada>
            <Cabeca />
          </Camada>
        </Mexe>
        <Camada>
          <TroncoFrente />
          <Linha d="M44 50 L76 50" />
          <Linha d="M44 50 L34 74 L40 96" />
          <Linha d="M76 50 L86 74 L80 96" />
        </Camada>
      </Mexe>
      <Camada>
        <Linha d="M48 98 L72 98" />
        <Linha d="M52 98 L48 122" />
        <Linha d="M68 98 L72 122" />
        <Linha d="M48 122 L48 140" />
      </Camada>
      <Mexe parte="pe">
        <Camada>
          <Linha d="M72 122 L72 138 L80 140" />
        </Camada>
      </Mexe>
      <Camada>
        <Chao />
      </Camada>
    </>
  );
}

function Borboleta() {
  return (
    <>
      <Camada>
        <Cabeca />
        <TroncoFrente />
        <Linha d="M44 50 L76 50" />
        <Linha d="M44 50 L34 76 L42 96" />
        <Linha d="M76 50 L86 76 L78 96" />
        <Linha d="M48 100 L72 100" />
      </Camada>
      {/* Cada perna gira em volta do próprio quadril, em espelho: é o que torna
          o "deixe os joelhos caírem" visível sem texto. */}
      <Mexe parte="pernaE">
        <Camada>
          <Linha d="M50 100 L30 118 L52 130" />
        </Camada>
      </Mexe>
      <Mexe parte="pernaD">
        <Camada>
          <Linha d="M70 100 L90 118 L68 130" />
        </Camada>
      </Mexe>
      <Camada>
        <Chao />
      </Camada>
    </>
  );
}

function Quatro() {
  const { anim, tinta } = usePalco();
  const gato = anim === "gatocamelo";
  return (
    <Mexe parte="tudo">
      {/* O gato-camelo é a única troca de FORMA da coluna: duas colunas
          desenhadas, uma neutra e outra arredondada, cruzando a opacidade. */}
      <Mexe parte="colunaNeutra">
        <Camada>
          <Circle cx={30} cy={46} r={13} stroke={tinta} {...TRACO} fill={recheio(tinta)} />
          <Linha d="M43 43 L50 42" />
          <Linha d="M50 42 C70 34 92 36 110 44" />
          <Linha d="M62 46 C68 76 96 76 104 50" />
        </Camada>
      </Mexe>
      {gato ? (
        <Mexe parte="colunaRedonda">
          <Camada>
            {/* Coluna arredondada: o queixo desce, o dorso sobe. */}
            <Circle cx={32} cy={60} r={13} stroke={tinta} {...TRACO} fill={recheio(tinta)} />
            <Linha d="M45 55 L52 51" />
            <Linha d="M52 51 C70 24 94 26 110 44" />
            <Linha d="M62 54 C70 82 96 80 104 52" />
          </Camada>
        </Mexe>
      ) : null}
      <Camada>
        <Linha d="M46 46 L42 74 L46 100" />
        <Linha d="M110 46 L116 74 L112 100" />
        <Linha d="M20 104 L134 104" strokeWidth={2.4} opacity={0.35} />
      </Camada>
    </Mexe>
  );
}

/* Deitada de lado: a posição em que se aprende o assoalho pélvico, e a única
   segura para deitar depois da 20ª semana. */
function Deitada() {
  const { anim, tinta } = usePalco();
  const respira = anim === "respiracao-diafragma" || anim === "assoalho-soltar";
  const joelho = anim === "joelho-ao-peito";
  const aperta = anim === "travesseiro-entre-joelhos";
  return (
    <>
      <Camada>
        {/* O travesseiro sob a cabeça: ela está apoiada, não caída. */}
        <Linha d="M18 52 L38 52" strokeWidth={2.4} opacity={0.35} />
        <Circle cx={30} cy={44} r={11} stroke={tinta} {...TRACO} fill={recheio(tinta)} />
        <Linha d="M41 46 L52 48" />
      </Camada>
      <Mexe parte="barriga">
        <Camada>
          <Linha d="M52 48 C68 44 88 46 100 52" />
          <Ellipse
            cx={74}
            cy={64}
            rx={19}
            ry={13}
            stroke={tinta}
            {...TRACO}
            fill={recheio(tinta)}
          />
        </Camada>
      </Mexe>
      {/* As pernas dobradas, uma sobre a outra. */}
      <Mexe parte="pernaDeCima">
        <Camada>
          <Linha d="M100 52 L118 62 L104 76" />
        </Camada>
      </Mexe>
      <Camada>
        <Linha d="M100 56 L120 70 L106 84" />
      </Camada>
      {/* O travesseiro entre os joelhos: some quando não é o assunto. */}
      {aperta || joelho || respira ? (
        <Mexe parte="travesseiro">
          <Camada>
            <Ellipse
              cx={117}
              cy={70}
              rx={7}
              ry={5}
              stroke={tinta}
              {...TRACO}
              strokeWidth={2.2}
              opacity={aperta ? 0.85 : 0.35}
            />
          </Camada>
        </Mexe>
      ) : null}
      <Camada>
        <Linha d="M14 92 L136 92" strokeWidth={2.4} opacity={0.35} />
      </Camada>
    </>
  );
}

/* Panturrilha, costelas e agachamento apoiado: os três precisam da parede
   desenhada, senão a figura parece empurrar o ar. */
function Parede() {
  return (
    <>
      <Camada>
        <Linha d="M18 8 L18 144" strokeWidth={3.6} opacity={0.4} />
      </Camada>
      <Mexe parte="corpo">
        <Camada>
          <Cabeca />
          <TroncoFrente />
          <Linha d="M44 50 L76 50" />
          {/* Os braços para a parede. */}
          <Linha d="M44 50 L30 40 L22 34" />
          <Linha d="M76 50 L58 38 L26 30" />
        </Camada>
      </Mexe>
      <Mexe parte="pernas">
        <Camada>
          <Linha d="M48 96 L72 96" />
          <Linha d="M52 96 L44 120 L44 140" />
          <Linha d="M68 96 L84 118 L92 140" />
        </Camada>
      </Mexe>
      <Camada>
        <Chao d="M24 144 L108 144" />
      </Camada>
    </>
  );
}
