import { Image } from "expo-image";
import { useEffect, useId, useRef, type ReactNode } from "react";
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
import { useMovimentoReduzido } from "~/componentes/movimento";
import { degradeDaMoeda, type Tom } from "~/lib/jornada/caminho";

/**
 * AS PEÇAS DESENHADAS DO CAMINHO — portadas do site (gestacao-path.tsx,
 * styles.css), em SVG para o React Native desenhar o mesmo volume que o CSS
 * desenha lá: a moeda 3D (degradê radial + brilho + pílula de luz + lábio
 * sólido embaixo), o anel de tarefas, a estrela do dia e os ícones da faixa.
 */

/** Um id de SVG sem os dois-pontos do `useId` (o `url(#…)` da web não os aceita). */
function useIdSvg(prefixo: string): string {
  return `${prefixo}${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
}

/* ── A moeda 3D ─────────────────────────────────────────────────────────── */

/**
 * A bolinha do dia e a moeda da semana — `.duo3d` + `.dc-coin-shine` do site.
 *
 * - corpo: `radial-gradient(120% 120% at 32% 24%, brilho 0%, corpo, borda 100%)`;
 * - lábio: uma moeda da cor do lábio, `labio` px abaixo (o `0 7px 0 var(--lip)`);
 * - brilho: dois radiais brancos (`.dc-coin-shine`) e a pílula de luz no alto
 *   (`.duo3d::before`: topo 14 %, laterais 24 %, altura 24 %, branco a 42 %).
 */
export function Moeda3D({
  tamanho,
  tom,
  labio = 7,
  claro = 0.55,
  escuro = 0.82,
  meio = 0.58,
  children,
}: {
  tamanho: number;
  tom: Tom;
  labio?: number;
  claro?: number;
  escuro?: number;
  /** Onde o corpo da cor fica cheio no degradê (58 % na bolinha, 62 % na moeda). */
  meio?: number;
  children?: ReactNode;
}) {
  const id = useIdSvg("moeda");
  const g = degradeDaMoeda(tom, claro, escuro);
  const r = tamanho / 2;
  /* ⚠️ `r` e não `rx`/`ry` no degradê do corpo: com objectBoundingBox o raio
     de 1,2 é o "120% 120%" do CSS. Os brilhos são elípticos (62% × 48%), e
     para isso eles viram ELIPSES com o degradê circular por cima — no
     objectBoundingBox de uma elipse, o círculo do degradê vira elipse sozinho
     —, recortadas pela moeda. */
  return (
    /* O lábio fica FORA da caixa, como a sombra do CSS: não empurra o que vem
       embaixo (as estrelas do dia encostam nele, como no site). */
    <View style={{ width: tamanho, height: tamanho }}>
      <Svg
        width={tamanho}
        height={tamanho + labio}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
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
            <Stop offset="0" stopColor={corCaminho.branco} stopOpacity="0.62" />
            <Stop offset="0.55" stopColor={corCaminho.branco} stopOpacity="0.1" />
            <Stop offset="0.72" stopColor={corCaminho.branco} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient
            id={`${id}b2`}
            cx="0.5"
            cy="0.5"
            r="0.5"
            gradientUnits="objectBoundingBox"
          >
            <Stop offset="0" stopColor={corCaminho.branco} stopOpacity="0.2" />
            <Stop offset="0.6" stopColor={corCaminho.branco} stopOpacity="0" />
          </RadialGradient>
          <ClipPath id={`${id}k`}>
            <Circle cx={r} cy={r} r={r} />
          </ClipPath>
        </Defs>
        <Circle cx={r} cy={r + labio} r={r} fill={tom.lip} />
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
          x={tamanho * 0.24}
          y={tamanho * 0.14}
          width={tamanho * 0.52}
          height={tamanho * 0.24}
          rx={tamanho * 0.12}
          fill={corCaminho.branco}
          fillOpacity={0.42}
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
    </View>
  );
}

/* ── O anel de tarefas de hoje ──────────────────────────────────────────── */

function polar(r: number, graus: number) {
  const rad = ((graus - 90) * Math.PI) / 180;
  return { x: 50 + r * Math.cos(rad), y: 50 + r * Math.sin(rad) };
}

function arco(inicio: number, fim: number) {
  const s = polar(46, inicio);
  const e = polar(46, fim);
  return `M ${s.x.toFixed(3)} ${s.y.toFixed(3)} A 46 46 0 0 1 ${e.x.toFixed(3)} ${e.y.toFixed(3)}`;
}

/** Cinco arcos em volta da bolinha de hoje, um por momento (`TaskRing` do site). */
export function AnelDeTarefas({
  tamanho,
  feitos,
  total = 5,
  cor,
}: {
  /** O tamanho da BOLINHA; o anel passa 9 px de cada lado. */
  tamanho: number;
  feitos: number;
  total?: number;
  cor: string;
}) {
  const passo = 360 / total;
  const folga = total > 4 ? 5 : 8;
  const lado = tamanho + 18;
  return (
    <Svg
      viewBox="0 0 100 100"
      width={lado}
      height={lado}
      style={{ position: "absolute", left: -9, top: -9 }}
      pointerEvents="none"
    >
      {Array.from({ length: total }, (_, i) => {
        const ini = i * passo + folga;
        return (
          <Path
            key={i}
            d={arco(ini, ini + passo - folga * 2)}
            fill="none"
            stroke={i < feitos ? cor : corCaminho.anelVazio}
            strokeWidth={7}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
}

/* ── A estrela do dia ───────────────────────────────────────────────────── */

const PONTOS_DA_ESTRELA = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 === 0 ? 48 : 19.5;
  const a = (Math.PI / 5) * i - Math.PI / 2;
  return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`;
}).join(" ");

/** A estrela do placar do dia — acesa (ouro) ou apagada (só o contorno leve). */
export function EstrelaDoDia({ acesa, tamanho = 34 }: { acesa: boolean; tamanho?: number }) {
  const id = useIdSvg("ouro");
  return (
    <Svg viewBox="0 0 100 100" width={tamanho} height={tamanho}>
      {acesa ? (
        <Defs>
          <GradienteLinear id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={corCaminho.ouroClaro} />
            <Stop offset="0.52" stopColor={corCaminho.ouro} />
            <Stop offset="1" stopColor={corCaminho.ouroEscuro} />
          </GradienteLinear>
        </Defs>
      ) : null}
      <Polygon
        points={PONTOS_DA_ESTRELA}
        fill={acesa ? `url(#${id})` : corCaminho.estrelaApagada}
        stroke={acesa ? corCaminho.ouroContorno : corCaminho.estrelaContorno}
        strokeWidth={acesa ? 3 : 3.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function EstrelasDoDia({
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
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${feitos} de ${total} estrelas`}
      style={{ flexDirection: "row", alignItems: "center", gap: folga }}
    >
      {Array.from({ length: total }, (_, i) => (
        <EstrelaDoDia key={i} acesa={i < feitos} tamanho={tamanho} />
      ))}
    </View>
  );
}

/* ── Movimentos do nó de hoje ───────────────────────────────────────────── */

/** `.dc-chest`: a bolinha de hoje pulsa (1 → 1,12) até o dia fechar. */
export function Pulsar({ ativo, children }: { ativo: boolean; children: ReactNode }) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ativo || reduzido) {
      v.setValue(0);
      return;
    }
    const laco = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    laco.start();
    return () => laco.stop();
  }, [ativo, reduzido, v]);
  return (
    <Animated.View
      style={{
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** `.duo-bubble`: o balão de hoje boia (0 → −6 px, 1,8 s). */
export function Boiar({ children }: { children: ReactNode }) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduzido) return;
    const laco = Animated.loop(
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
    );
    laco.start();
    return () => laco.stop();
  }, [reduzido, v]);
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
 * A chama da sequência. Apagada: o contorno cinza do site. Acesa: a folha de
 * 6 × 6 quadros (`.dc-chama`: 0,5 s por fileira, 3 s o ciclo inteiro), andando
 * quadro a quadro no motor nativo.
 */
export function ChamaDaSequencia({ acesa, tamanho = 26 }: { acesa: boolean; tamanho?: number }) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!acesa || reduzido) return;
    const laco = Animated.loop(
      Animated.timing(v, {
        toValue: 36,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    laco.start();
    return () => laco.stop();
  }, [acesa, reduzido, v]);
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
  /* Degraus: o valor anda de 0 a 36, e cada quadro ocupa [i, i+1). */
  const entrada: number[] = [];
  const colunas: number[] = [];
  const linhas: number[] = [];
  for (let i = 0; i < 36; i++) {
    entrada.push(i, i + 0.999);
    colunas.push(-(i % 6) * tamanho, -(i % 6) * tamanho);
    linhas.push(-Math.floor(i / 6) * tamanho, -Math.floor(i / 6) * tamanho);
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
          transform: [
            { translateX: v.interpolate({ inputRange: entrada, outputRange: colunas }) },
            { translateY: v.interpolate({ inputRange: entrada, outputRange: linhas }) },
          ],
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

/** Duas amigas e um "+" — sem emoji de pessoa (que imporia um tom de pele). */
export function IconeAmigas({ cor, tamanho = 22 }: { cor: string; tamanho?: number }) {
  return (
    <Svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      style={{ transform: [{ translateY: -3 }] }}
    >
      <Circle cx={16.1} cy={7.4} r={3.1} fill={cor} opacity={0.55} />
      <Path
        d="M16.1 11.6c2.7 0 5 1.7 5.6 4.1.2.7-.4 1.4-1.1 1.4h-3.2c0-2.2-1.2-4.1-3-5.2.6-.2 1.1-.3 1.7-.3z"
        fill={cor}
        opacity={0.55}
      />
      <Circle cx={9.4} cy={6.9} r={3.9} fill={cor} />
      <Path
        d="M9.4 12c3.4 0 6.3 2.2 7.1 5.2.3 1-.5 1.9-1.5 1.9H3.8c-1 0-1.8-.9-1.5-1.9.8-3 3.7-5.2 7.1-5.2z"
        fill={cor}
      />
      <Circle cx={18.2} cy={18} r={4.1} fill={cor} />
      <Path
        d="M18.2 15.6c.4 0 .7.3.7.7v1h1c.4 0 .7.3.7.7s-.3.7-.7.7h-1v1c0 .4-.3.7-.7.7s-.7-.3-.7-.7v-1h-1c-.4 0-.7-.3-.7-.7s.3-.7.7-.7h1v-1c0-.4.3-.7.7-.7z"
        fill={corCaminho.branco}
      />
    </Svg>
  );
}

export function IconeLoja({ cor, tamanho = 24 }: { cor: string; tamanho?: number }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
      <Path
        d="M4.6 7.6h14.8c.7 0 1.2.6 1.1 1.3l-1.3 11a2.2 2.2 0 0 1-2.2 1.9H7c-1.1 0-2.1-.8-2.2-1.9l-1.3-11c-.1-.7.4-1.3 1.1-1.3z"
        fill={cor}
      />
      <Path
        d="M6.2 10.4h11.6l-1 8.6c0 .2-.2.3-.4.3H7.6a.4.4 0 0 1-.4-.3l-1-8.6z"
        fill={corCaminho.branco}
        opacity={0.38}
      />
      <Path
        d="M12 1.6c2.4 0 4.3 1.9 4.3 4.3v1.7h-2.2V5.9c0-1.2-.9-2.1-2.1-2.1s-2.1.9-2.1 2.1v1.7H7.7V5.9c0-2.4 1.9-4.3 4.3-4.3z"
        fill={cor}
      />
    </Svg>
  );
}

export function IconeCadeado({ cor, tamanho = 20 }: { cor: string; tamanho?: number }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
      <Path
        d="M12 1.8c2.9 0 5.2 2.3 5.2 5.2v2.6h-2.4V7c0-1.5-1.3-2.8-2.8-2.8S9.2 5.5 9.2 7v2.6H6.8V7c0-2.9 2.3-5.2 5.2-5.2z"
        fill={cor}
      />
      <Rect x={4.4} y={9.6} width={15.2} height={12.6} rx={2.6} fill={cor} />
      <Path
        d="M6.6 12.2h10.8c.3 0 .5.2.5.5v6.9c0 .3-.2.5-.5.5H6.6a.5.5 0 0 1-.5-.5v-6.9c0-.3.2-.5.5-.5z"
        fill={corCaminho.branco}
        opacity={0.3}
      />
      <Circle cx={12} cy={15.2} r={1.7} fill={corCaminho.branco} opacity={0.85} />
      <Rect
        x={11.2}
        y={15.9}
        width={1.6}
        height={3.2}
        rx={0.8}
        fill={corCaminho.branco}
        opacity={0.85}
      />
    </Svg>
  );
}

/** Os glifos das cinco atividades (`AtividadeIcone` do site), preenchidos. */
export function IconeDaAtividade({
  chave,
  cor,
  tamanho = 22,
}: {
  chave: string;
  cor: string;
  tamanho?: number;
}) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
      {chave === "movement" ? (
        <>
          <Circle cx={12} cy={4.3} r={2.4} fill={cor} />
          <Path
            d="M12 7.3c-.5 0-.9.3-1.1.7L6.6 12l1.5 1.5 2.4-2.3v2.3l-2.8 5.6 1.8.9L12 15.2l2.5 4.8 1.8-.9-2.8-5.6v-2.3l2.4 2.3 1.5-1.5-4.3-4c-.2-.4-.6-.7-1.1-.7z"
            fill={cor}
          />
        </>
      ) : chave === "meditation" ? (
        <>
          <Circle cx={12} cy={4.6} r={2.4} fill={cor} />
          <Path d="M12 8c-1.9 0-3.4 1.5-3.4 3.4v2.2h6.8v-2.2C15.4 9.5 13.9 8 12 8z" fill={cor} />
          <Path
            d="M8.3 13.9C5.6 14.6 3.4 16 2.4 17.6c2 1.8 5.5 2.9 9.6 2.9s7.6-1.1 9.6-2.9c-1-1.6-3.2-3-5.9-3.7l-.5 1.9H8.8l-.5-1.9z"
            fill={cor}
          />
        </>
      ) : chave === "bonding" ? (
        <Path
          d="M12 20.4s-7.8-4.8-7.8-10.1A4.7 4.7 0 0 1 12 7.2a4.7 4.7 0 0 1 7.8 3.1c0 5.3-7.8 10.1-7.8 10.1z"
          fill={cor}
        />
      ) : chave === "aula" ? (
        <>
          <Path
            d="M11.2 6.4C9.6 5.2 7.6 4.6 5.2 4.6c-.7 0-1.2.5-1.2 1.2v11c0 .7.5 1.2 1.2 1.2 2.2 0 4 .5 5.4 1.5.3.2.6 0 .6-.3V6.4z"
            fill={cor}
          />
          <Path
            d="M12.8 6.4c1.6-1.2 3.6-1.8 6-1.8.7 0 1.2.5 1.2 1.2v11c0 .7-.5 1.2-1.2 1.2-2.2 0-4 .5-5.4 1.5-.3.2-.6 0-.6-.3V6.4z"
            fill={cor}
          />
        </>
      ) : (
        <>
          <Path d="M11 2.6l1.8 5 5 1.8-5 1.8-1.8 5-1.8-5-5-1.8 5-1.8 1.8-5z" fill={cor} />
          <Path
            d="M18.2 13.8l.95 2.6 2.6.95-2.6.95-.95 2.6-.95-2.6-2.6-.95 2.6-.95.95-2.6z"
            fill={cor}
          />
        </>
      )}
    </Svg>
  );
}

/** Texto de emoji num tamanho fixo (a linha do emoji varia entre sistemas). */
export function Emoji({ children, tamanho }: { children: string; tamanho: number }) {
  return (
    <Text style={{ fontSize: tamanho, lineHeight: Math.round(tamanho * 1.15) }}>{children}</Text>
  );
}
