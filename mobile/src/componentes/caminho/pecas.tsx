import { Image } from "expo-image";
import { memo, useEffect, useId, useMemo, useRef, type ReactNode } from "react";
import { Animated, Easing, Text, View } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient as GradienteLinear,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { corCaminho } from "~/componentes/caminho/cores";
import { useMovimentoReduzido, lacoQueDescansa } from "~/componentes/movimento";
import { comAlfa } from "~/lib/cor";
import { degradeDaMoeda, type Tom } from "~/lib/jornada/caminho";
import { cor, ouro } from "~/tema";

/**
 * AS PEÇAS DESENHADAS DO CAMINHO — portadas do site (gestacao-path.tsx,
 * styles.css), em SVG para o React Native desenhar o mesmo volume que o CSS
 * desenha lá: a moeda 3D (degradê radial + brilho + pílula de luz + lábio
 * sólido embaixo), o anel de tarefas, a estrela do dia e os ícones da faixa.
 *
 * 18/11/2026 (a vistoria, "o jogo com cara de jogo e sem soluço"): as peças
 * são `memo` (a trilha tem centenas delas montadas), a moeda AFUNDA no toque
 * até o lábio, o reflexo virou luz (um degradê, e não um adesivo branco), e o
 * nó de hoje chama o dedo com um halo atrás — a moeda fica parada e o anel
 * sempre à vista.
 */

/** Um id de SVG sem os dois-pontos do `useId` (o `url(#…)` da web não os aceita). */
function useIdSvg(prefixo: string): string {
  return `${prefixo}${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
}

/* ── O toque que afunda ──────────────────────────────────────────────────── */

/**
 * A moeda com lábio promete um botão físico: no toque, o corpo DESCE até o
 * lábio e volta com um quique (mola, no fio nativo). O valor vai de 0 (em
 * cima) a 1 (no fundo); quem usa traduz em pontos (`descida`).
 */
export function useAfundar() {
  const valor = useRef(new Animated.Value(0)).current;
  const reduzido = useMovimentoReduzido();
  return useMemo(() => {
    const ir = (para: number) => {
      if (reduzido) {
        valor.setValue(para);
        return;
      }
      Animated.spring(valor, {
        toValue: para,
        useNativeDriver: true,
        speed: 40,
        bounciness: para === 0 ? 8 : 0,
      }).start();
    };
    return { valor, aoPressionar: () => ir(1), aoSoltar: () => ir(0) };
  }, [valor, reduzido]);
}

/* ── A moeda 3D ─────────────────────────────────────────────────────────── */

/**
 * A bolinha do dia e a moeda da semana — `.duo3d` + `.dc-coin-shine` do site.
 *
 * - corpo: `radial-gradient(120% 120% at 32% 24%, brilho 0%, corpo, borda 100%)`;
 * - lábio: um disco da cor do lábio, `labio` px abaixo (o `0 7px 0 var(--lip)`),
 *   PARADO — no toque é o corpo que desce até ele (`descida`);
 * - brilho: dois radiais brancos (`.dc-coin-shine`) e a luz no alto, um degradê
 *   branco que some para baixo (era uma pílula chapada, que lia como adesivo).
 */
export const Moeda3D = memo(function Moeda3D({
  tamanho,
  tom,
  labio = 7,
  claro = 0.55,
  escuro = 0.82,
  meio = 0.58,
  descida,
  children,
}: {
  tamanho: number;
  tom: Tom;
  labio?: number;
  claro?: number;
  escuro?: number;
  /** Onde o corpo da cor fica cheio no degradê (58 % na bolinha, 62 % na moeda). */
  meio?: number;
  /** O quanto o corpo desce (no toque), em pontos. */
  descida?: Animated.AnimatedInterpolation<number> | Animated.Value;
  children?: ReactNode;
}) {
  const id = useIdSvg("moeda");
  const g = useMemo(() => degradeDaMoeda(tom, claro, escuro), [tom, claro, escuro]);
  const r = tamanho / 2;
  /* ⚠️ `r` e não `rx`/`ry` no degradê do corpo: com objectBoundingBox o raio
     de 1,2 é o "120% 120%" do CSS. Os brilhos são elípticos (62% × 48%), e
     para isso eles viram ELIPSES com o degradê circular por cima — no
     objectBoundingBox de uma elipse, o círculo do degradê vira elipse sozinho
     —, recortadas pela moeda. */
  return (
    /* O lábio fica FORA da caixa, como a sombra do CSS: não empurra nada. */
    <View style={{ width: tamanho, height: tamanho }}>
      <View
        style={{
          position: "absolute",
          left: 0,
          top: labio,
          width: tamanho,
          height: tamanho,
          borderRadius: r,
          backgroundColor: tom.lip,
        }}
      />
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: tamanho,
          height: tamanho,
          transform: descida ? [{ translateY: descida }] : [],
        }}
      >
        <Svg width={tamanho} height={tamanho}>
          <Defs>
            <RadialGradient
              id={`${id}c`}
              cx="0.32"
              cy="0.24"
              r="1.2"
              fx="0.32"
              fy="0.24"
              gradientUnits="objectBoundingBox"
            >
              <Stop offset="0" stopColor={g.brilho} />
              <Stop offset={String(meio)} stopColor={g.corpo} />
              <Stop offset="1" stopColor={g.borda} />
            </RadialGradient>
            <RadialGradient
              id={`${id}b1`}
              cx="0.5"
              cy="0.5"
              r="0.5"
              gradientUnits="objectBoundingBox"
            >
              <Stop offset="0" stopColor={cor.branco} stopOpacity="0.62" />
              <Stop offset="0.55" stopColor={cor.branco} stopOpacity="0.1" />
              <Stop offset="0.72" stopColor={cor.branco} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient
              id={`${id}b2`}
              cx="0.5"
              cy="0.5"
              r="0.5"
              gradientUnits="objectBoundingBox"
            >
              <Stop offset="0" stopColor={cor.branco} stopOpacity="0.2" />
              <Stop offset="0.6" stopColor={cor.branco} stopOpacity="0" />
            </RadialGradient>
            <GradienteLinear id={`${id}l`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={cor.branco} stopOpacity="0.7" />
              <Stop offset="1" stopColor={cor.branco} stopOpacity="0" />
            </GradienteLinear>
            <ClipPath id={`${id}k`}>
              <Circle cx={r} cy={r} r={r} />
            </ClipPath>
          </Defs>
          <Circle cx={r} cy={r} r={r} fill={`url(#${id}c)`} />
          <G clipPath={`url(#${id}k)`}>
            <Ellipse
              cx={tamanho * 0.3}
              cy={tamanho * 0.2}
              rx={tamanho * 0.62}
              ry={tamanho * 0.48}
              fill={`url(#${id}b1)`}
            />
            <Ellipse
              cx={tamanho * 0.5}
              cy={tamanho * 1.08}
              rx={tamanho * 0.8}
              ry={tamanho * 0.45}
              fill={`url(#${id}b2)`}
            />
          </G>
          <Rect
            x={tamanho * 0.27}
            y={tamanho * 0.1}
            width={tamanho * 0.46}
            height={tamanho * 0.2}
            rx={tamanho * 0.1}
            fill={`url(#${id}l)`}
          />
        </Svg>
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: tamanho,
            height: tamanho,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
});

/* ── O anel de tarefas de hoje ──────────────────────────────────────────── */

function polar(r: number, graus: number) {
  const rad = ((graus - 90) * Math.PI) / 180;
  return { x: 50 + r * Math.cos(rad), y: 50 + r * Math.sin(rad) };
}

function arco(r: number, inicio: number, fim: number) {
  const s = polar(r, inicio);
  const e = polar(r, fim);
  return `M ${s.x.toFixed(3)} ${s.y.toFixed(3)} A ${r} ${r} 0 0 1 ${e.x.toFixed(3)} ${e.y.toFixed(3)}`;
}

/** O branco dos arcos que faltam: aparece sobre qualquer céu, sem competir com o ouro. */
const ANEL_VAZIO = "rgba(255,255,255,0.55)";

/**
 * Cinco arcos em volta da bolinha de hoje, um por momento (`TaskRing` do
 * site). Cada arco feito é uma estrela: OURO, e não a cor da moeda (o anel
 * sumia contra ela). O anel passa 15 pt de cada lado da moeda, com ar entre
 * os dois — nunca coberto por ela.
 */
export const AnelDeTarefas = memo(function AnelDeTarefas({
  tamanho,
  feitos,
  total = 5,
  corFeito = ouro.medio,
  corVazio = ANEL_VAZIO,
}: {
  /** O tamanho da BOLINHA; o anel passa 15 pt de cada lado. */
  tamanho: number;
  feitos: number;
  total?: number;
  corFeito?: string;
  corVazio?: string;
}) {
  const passo = 360 / total;
  const folga = total > 4 ? 7 : 9;
  const lado = tamanho + 30;
  return (
    <Svg
      viewBox="0 0 100 100"
      width={lado}
      height={lado}
      style={{ position: "absolute", left: -15, top: -15 }}
      pointerEvents="none"
    >
      {Array.from({ length: total }, (_, i) => {
        const ini = i * passo + folga;
        return (
          <Path
            key={i}
            d={arco(46, ini, ini + passo - folga * 2)}
            fill="none"
            stroke={i < feitos ? corFeito : corVazio}
            strokeWidth={5}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
});

/**
 * O anel pequeno (28 pt) de uma linha de lista: os cinco momentos de um dia,
 * em ouro sobre o trilho. É o mesmo anel do nó de hoje, sem a moeda.
 */
export const AnelPequeno = memo(function AnelPequeno({
  feitos,
  total = 5,
  lado = 28,
}: {
  feitos: number;
  total?: number;
  lado?: number;
}) {
  const passo = 360 / total;
  const folga = 9;
  return (
    <Svg viewBox="0 0 100 100" width={lado} height={lado} pointerEvents="none">
      {Array.from({ length: total }, (_, i) => {
        const ini = i * passo + folga;
        return (
          <Path
            key={i}
            d={arco(42, ini, ini + passo - folga * 2)}
            fill="none"
            stroke={i < feitos ? ouro.medio : cor.trilho}
            strokeWidth={13}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
});

/* ── A estrela do dia ───────────────────────────────────────────────────── */

const PONTOS_DA_ESTRELA = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 === 0 ? 48 : 19.5;
  const a = (Math.PI / 5) * i - Math.PI / 2;
  return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`;
}).join(" ");

/** A apagada: um vidro claro com o contorno do trilho — lê no céu e no branco. */
const ESTRELA_APAGADA = comAlfa(cor.trilho, 0.55);

/**
 * A ESTRELA DO JOGO — uma só no app (a da trilha, do dia, da semana e do fim):
 * acesa, o degradê de ouro; apagada, o vidro claro com contorno.
 */
export const EstrelaDoDia = memo(function EstrelaDoDia({
  acesa,
  tamanho = 34,
}: {
  acesa: boolean;
  tamanho?: number;
}) {
  const id = useIdSvg("ouro");
  return (
    <Svg viewBox="0 0 100 100" width={tamanho} height={tamanho}>
      {acesa ? (
        <Defs>
          <GradienteLinear id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={ouro.claro} />
            <Stop offset="0.52" stopColor={ouro.medio} />
            <Stop offset="1" stopColor={ouro.escuro} />
          </GradienteLinear>
        </Defs>
      ) : null}
      <Polygon
        points={PONTOS_DA_ESTRELA}
        fill={acesa ? `url(#${id})` : ESTRELA_APAGADA}
        stroke={acesa ? ouro.escuro : cor.chevron}
        strokeWidth={acesa ? 3 : 4}
        strokeLinejoin="round"
      />
    </Svg>
  );
});

/**
 * A fileira de estrelas de um dia — UM desenho só, com um degradê só (eram
 * cinco `<Svg>`, cada um com o seu degradê: a peça mais repetida da trilha).
 */
export const EstrelasDoDia = memo(function EstrelasDoDia({
  feitos,
  total = 5,
  tamanho = 13,
  folga = 2,
}: {
  feitos: number;
  total?: number;
  tamanho?: number;
  folga?: number;
}) {
  const id = useIdSvg("fileira");
  const passo = 100 + (folga / tamanho) * 100;
  const larguraDaCaixa = 100 + passo * (total - 1);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${feitos} de ${total} estrelas`}
    >
      <Svg
        viewBox={`0 0 ${larguraDaCaixa} 100`}
        width={tamanho * total + folga * (total - 1)}
        height={tamanho}
      >
        <Defs>
          <GradienteLinear id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={ouro.claro} />
            <Stop offset="0.52" stopColor={ouro.medio} />
            <Stop offset="1" stopColor={ouro.escuro} />
          </GradienteLinear>
        </Defs>
        {Array.from({ length: total }, (_, i) => (
          <G key={i} transform={`translate(${i * passo}, 0)`}>
            <Polygon
              points={PONTOS_DA_ESTRELA}
              fill={i < feitos ? `url(#${id})` : ESTRELA_APAGADA}
              stroke={i < feitos ? ouro.escuro : cor.chevron}
              strokeWidth={i < feitos ? 3 : 4}
              strokeLinejoin="round"
            />
          </G>
        ))}
      </Svg>
    </View>
  );
});

/* ── Movimentos do nó de hoje ───────────────────────────────────────────── */

/**
 * O HALO do nó de hoje: um disco na cor da semana que nasce atrás da moeda e
 * se abre até sumir (0,35 → 0, 1 → 1,35, 1,8 s), três vezes quando a trilha
 * aparece, e descansa. Antes a moeda inteira inchava (1 → 1,12) e, no pico,
 * cobria o anel das tarefas; agora a moeda fica parada e o anel à vista.
 */
export function Halo({
  tamanho,
  cor: tinta,
  parado = false,
}: {
  tamanho: number;
  cor: string;
  parado?: boolean;
}) {
  const reduzido = useMovimentoReduzido();
  const quieto = reduzido || parado;
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (quieto) {
      v.setValue(1);
      return;
    }
    v.setValue(0);
    const laco = lacoQueDescansa(
      Animated.timing(v, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      3,
    );
    laco.start();
    return () => laco.stop();
  }, [quieto, v]);
  const lado = tamanho + 20;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: -10,
        top: -10,
        width: lado,
        height: lado,
        borderRadius: lado / 2,
        backgroundColor: tinta,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
      }}
    />
  );
}

/**
 * `.duo-bubble`: o balão de hoje boia (0 → −6 px, 1,8 s) três vezes quando a
 * trilha aparece, e descansa. Boiando a cada 9 s ainda custava ~10% de
 * processador parado: cada quadro animado faz o vidro da barra e do placar se
 * redesenhar.
 */
export function Boiar({ children, parado = false }: { children: ReactNode; parado?: boolean }) {
  const reduzido = useMovimentoReduzido();
  const quieto = reduzido || parado;
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (quieto) {
      v.setValue(0);
      return;
    }
    const laco = lacoQueDescansa(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
      3,
    );
    laco.start();
    return () => laco.stop();
  }, [quieto, v]);
  return (
    <Animated.View
      style={{
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/* ── Os ícones da faixa do topo ─────────────────────────────────────────── */

const CHAMA_SPRITE = require("../../../../src/assets/chama-sequencia.webp");
const TROFEU_SPRITE = require("../../../../src/assets/trofeu.webp");

/**
 * A chama da sequência. Apagada: o contorno do site. Acesa: a folha de 6 × 6
 * quadros (`.dc-chama`: 0,5 s por fileira, 3 s o ciclo inteiro), andando
 * quadro a quadro no motor nativo — duas voltas quando aparece, e descansa.
 */
export function ChamaDaSequencia({
  acesa,
  tamanho = 26,
  parado = false,
}: {
  acesa: boolean;
  tamanho?: number;
  parado?: boolean;
}) {
  const reduzido = useMovimentoReduzido();
  const quieto = reduzido || parado;
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!acesa || quieto) return;
    const laco = lacoQueDescansa(
      Animated.timing(v, {
        toValue: 36,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      2,
    );
    laco.start();
    return () => laco.stop();
  }, [acesa, quieto, v]);
  /* Degraus: o valor anda de 0 a 36, e cada quadro ocupa [i, i+1). Montadas
     uma vez por tamanho: refazer os dois `interpolate` de 72 pontos a cada
     render obrigava o motor nativo a religar o grafo da animação. */
  const passos = useMemo(() => {
    const entrada: number[] = [];
    const colunas: number[] = [];
    const linhas: number[] = [];
    for (let i = 0; i < 36; i++) {
      entrada.push(i, i + 0.999);
      colunas.push(-(i % 6) * tamanho, -(i % 6) * tamanho);
      linhas.push(-Math.floor(i / 6) * tamanho, -Math.floor(i / 6) * tamanho);
    }
    return {
      x: v.interpolate({ inputRange: entrada, outputRange: colunas }),
      y: v.interpolate({ inputRange: entrada, outputRange: linhas }),
    };
  }, [tamanho, v]);
  if (!acesa) {
    return (
      <Svg
        width={tamanho}
        height={tamanho}
        viewBox="0 0 24 24"
        style={{ transform: [{ translateY: -2 }] }}
      >
        <Path
          d="M12 2.5c.6 3.2-1.2 4.4-2.6 5.8C8 9.7 7 11 7 13.4a5 5 0 0 0 10 0c0-2-.8-3.4-1.8-4.7-.5 1-1.2 1.6-2 1.9.6-2.6-.2-5.6-1.2-8.1Z"
          fill="none"
          stroke={corCaminho.chamaApagada}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  return (
    <View
      style={{
        width: tamanho,
        height: tamanho,
        overflow: "hidden",
        transform: [{ translateY: -2 }],
      }}
    >
      <Animated.View
        style={{
          width: tamanho * 6,
          height: tamanho * 6,
          transform: [{ translateX: passos.x }, { translateY: passos.y }],
        }}
      >
        <Image source={CHAMA_SPRITE} style={{ width: tamanho * 6, height: tamanho * 6 }} />
      </Animated.View>
    </View>
  );
}

/** O troféu da faixa: o ÚLTIMO quadro da folha de 10 × 6 (o troféu pousado). */
export function TrofeuParado({ largura = 34 }: { largura?: number }) {
  const altura = Math.round(largura * 0.8);
  return (
    <View
      style={{
        width: largura,
        height: altura,
        overflow: "hidden",
        transform: [{ translateY: -6 }],
      }}
    >
      <Image
        source={TROFEU_SPRITE}
        style={{
          width: largura * 10,
          height: altura * 6,
          position: "absolute",
          left: -largura * 9,
          top: -altura * 5,
        }}
      />
    </View>
  );
}

/**
 * O TROFÉU SE CONSTRUINDO — a folha inteira (10 × 6, 60 quadros, 12 fps), uma
 * vez, do quadro vazio ao troféu pousado. É a animação do site
 * (`TrofeuConquistado`): no app ficava só o último quadro, e o clímax do dia
 * fechado passava parado. Com "Reduzir movimento", o troféu já vem pronto.
 */
export function TrofeuSeConstruindo({
  largura = 200,
  aoTerminar,
}: {
  largura?: number;
  aoTerminar?: () => void;
}) {
  const reduzido = useMovimentoReduzido();
  const altura = Math.round(largura * 0.8);
  const v = useRef(new Animated.Value(reduzido ? 59 : 0)).current;
  useEffect(() => {
    if (reduzido) {
      aoTerminar?.();
      return;
    }
    const a = Animated.timing(v, {
      toValue: 59,
      duration: 5000,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    a.start(({ finished }) => {
      if (finished) aoTerminar?.();
    });
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduzido, v]);
  const entrada: number[] = [];
  const colunas: number[] = [];
  const linhas: number[] = [];
  for (let i = 0; i < 60; i++) {
    entrada.push(i, i + 0.999);
    colunas.push(-(i % 10) * largura, -(i % 10) * largura);
    linhas.push(-Math.floor(i / 10) * altura, -Math.floor(i / 10) * altura);
  }
  return (
    <View style={{ width: largura, height: altura, overflow: "hidden" }}>
      <Animated.View
        style={{
          width: largura * 10,
          height: altura * 6,
          transform: [
            { translateX: v.interpolate({ inputRange: entrada, outputRange: colunas }) },
            { translateY: v.interpolate({ inputRange: entrada, outputRange: linhas }) },
          ],
        }}
      >
        <Image source={TROFEU_SPRITE} style={{ width: largura * 10, height: altura * 6 }} />
      </Animated.View>
    </View>
  );
}

/** Duas amigas e um "+" — sem emoji de pessoa (que imporia um tom de pele). */
export function IconeAmigas({ cor: tinta, tamanho = 22 }: { cor: string; tamanho?: number }) {
  return (
    <Svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      style={{ transform: [{ translateY: -3 }] }}
    >
      <Circle cx={16.1} cy={7.4} r={3.1} fill={tinta} opacity={0.55} />
      <Path
        d="M16.1 11.6c2.7 0 5 1.7 5.6 4.1.2.7-.4 1.4-1.1 1.4h-3.2c0-2.2-1.2-4.1-3-5.2.6-.2 1.1-.3 1.7-.3z"
        fill={tinta}
        opacity={0.55}
      />
      <Circle cx={9.4} cy={6.9} r={3.9} fill={tinta} />
      <Path
        d="M9.4 12c3.4 0 6.3 2.2 7.1 5.2.3 1-.5 1.9-1.5 1.9H3.8c-1 0-1.8-.9-1.5-1.9.8-3 3.7-5.2 7.1-5.2z"
        fill={tinta}
      />
      <Circle cx={18.2} cy={18} r={4.1} fill={tinta} />
      <Path
        d="M18.2 15.6c.4 0 .7.3.7.7v1h1c.4 0 .7.3.7.7s-.3.7-.7.7h-1v1c0 .4-.3.7-.7.7s-.7-.3-.7-.7v-1h-1c-.4 0-.7-.3-.7-.7s.3-.7.7-.7h1v-1c0-.4.3-.7.7-.7z"
        fill={cor.branco}
      />
    </Svg>
  );
}

/**
 * A SEMENTINHA do placar, no mesmo desenho das amigas (cheio, em dois tons):
 * o 🌱 de emoji era o único ícone de outra família na faixa.
 */
export function IconeSementinha({ cor: tinta, tamanho = 22 }: { cor: string; tamanho?: number }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
      <Ellipse cx={12} cy={21.4} rx={6} ry={1.5} fill={tinta} opacity={0.3} />
      <Rect x={11} y={10.2} width={2} height={11.4} rx={1} fill={tinta} />
      <Path
        d="M11.6 13.2C7.4 13.5 4.1 11.2 3.2 6.9c4.3-.4 8 1.8 8.4 6.3z"
        fill={tinta}
        opacity={0.55}
      />
      <Path d="M12.3 11.4c.1-4.8 3.5-8.3 8.6-8.5.2 5-3.3 8.5-8.6 8.5z" fill={tinta} />
    </Svg>
  );
}

export function IconeCadeado({ cor: tinta, tamanho = 20 }: { cor: string; tamanho?: number }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
      <Path
        d="M12 1.8c2.9 0 5.2 2.3 5.2 5.2v2.6h-2.4V7c0-1.5-1.3-2.8-2.8-2.8S9.2 5.5 9.2 7v2.6H6.8V7c0-2.9 2.3-5.2 5.2-5.2z"
        fill={tinta}
      />
      <Rect x={4.4} y={9.6} width={15.2} height={12.6} rx={2.6} fill={tinta} />
      <Path
        d="M6.6 12.2h10.8c.3 0 .5.2.5.5v6.9c0 .3-.2.5-.5.5H6.6a.5.5 0 0 1-.5-.5v-6.9c0-.3.2-.5.5-.5z"
        fill={cor.branco}
        opacity={0.3}
      />
      <Circle cx={12} cy={15.2} r={1.7} fill={cor.branco} opacity={0.85} />
      <Rect x={11.2} y={15.9} width={1.6} height={3.2} rx={0.8} fill={cor.branco} opacity={0.85} />
    </Svg>
  );
}

/** Texto de emoji num tamanho fixo (a linha do emoji varia entre sistemas). */
export function Emoji({ children, tamanho }: { children: string; tamanho: number }) {
  return (
    <Text style={{ fontSize: tamanho, lineHeight: Math.round(tamanho * 1.15) }}>{children}</Text>
  );
}
