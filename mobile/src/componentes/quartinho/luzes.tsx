import { Fragment, memo, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient as Degrade,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { TOQUE_DA_LUZ } from "~/lib/quartinho/coisas";
import type { IdDoItem, ItemDoQuarto } from "~/lib/quartinho/quarto";

/**
 * AS LUZES DESENHADAS POR CÓDIGO (26/11/2026, o dono: "vamos adicionar outros
 * tipos de luzes para cada ambiente", sem crédito). Seis itens da bandeja
 * (`desenhado: true` em `lib/quartinho/quarto.ts`), cada um desenhado ao vivo
 * no cômodo e aceso ou apagado com um toque:
 * - no quarto: o varal de luzinhas, o neon de lua e o projetor de estrelas;
 * - na cozinha: o pisca-pisca na janela, a fita de LED na bancada e os
 *   pendentes de vidro.
 *
 * As medidas são frações da pintura do cômodo (como os lugares dos itens),
 * tiradas dela em tamanho real. A luz soma (`screen`): nunca escurece nada.
 * ⚠️ Nada anda em laço (o que travava o app): só a transição de acender.
 */

type Props = {
  item: ItemDoQuarto;
  acesa: boolean;
  noite: boolean;
  novo: boolean;
  largura: number;
  altura: number;
  aoTocar: (id: IdDoItem) => void;
};

/* As cores das lâmpadas: o miolo e o halo. */
const LAMPADAS = {
  ouro: ["#fff1c2", "#ffc85a"],
  rosa: ["#ffe0ea", "#ff8fb4"],
  lilas: ["#ece4ff", "#b39bff"],
  menta: ["#dcfaec", "#6fdcaa"],
  pessego: ["#ffe6d4", "#ffa772"],
  vermelho: ["#ffd6d6", "#ff6b6b"],
  azul: ["#dcefff", "#6cb6ff"],
} as const;
type CorDaLampada = keyof typeof LAMPADAS;

function useAcesa(acesa: boolean, novo: boolean) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(acesa ? 1 : 0)).current;
  const chega = useRef(new Animated.Value(novo && !reduzido ? 0 : 1)).current;
  useEffect(() => {
    if (reduzido) {
      v.setValue(acesa ? 1 : 0);
      return;
    }
    const a = Animated.timing(v, {
      toValue: acesa ? 1 : 0,
      duration: 320,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [acesa, reduzido, v]);
  useEffect(() => {
    if (!novo || reduzido) return;
    chega.setValue(0);
    Animated.timing(chega, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [novo, reduzido, chega]);
  return { v, chega };
}

export const LuzDesenhada = memo(function LuzDesenhada(p: Props) {
  const { v, chega } = useAcesa(p.acesa, p.novo);
  const toque = TOQUE_DA_LUZ[p.item.id];
  const L = p.largura;
  const A = p.altura;
  const forca = p.noite ? 1 : 0.5;
  const desenho = (() => {
    switch (p.item.id) {
      case "varal":
        return (
          <Varal
            ancoras={[0.262, 0.395, 0.525, 0.655, 0.79]}
            y={0.281}
            caida={0.02}
            raio={0.0068}
            cores={["ouro", "rosa", "lilas", "menta", "pessego"]}
            porArco={5}
            v={v}
            forca={forca}
            L={L}
            A={A}
            id="varal"
          />
        );
      case "pisca-pisca":
        return (
          <Varal
            ancoras={[0.335, 0.5, 0.665]}
            y={0.337}
            caida={0.024}
            raio={0.0056}
            cores={["vermelho", "ouro", "menta", "azul", "rosa"]}
            porArco={7}
            v={v}
            forca={forca}
            L={L}
            A={A}
            id="pisca"
          />
        );
      case "neon-lua":
        return <NeonDeLua v={v} forca={forca} L={L} A={A} />;
      case "projetor":
        return <Projetor v={v} forca={forca} noite={p.noite} L={L} A={A} />;
      case "fita-led":
        return <FitaDeLed v={v} forca={forca} L={L} A={A} />;
      case "pendentes":
        return <Pendentes v={v} forca={forca} L={L} A={A} />;
      default:
        return null;
    }
  })();
  if (!toque) return null;
  const [x0, y0, x1, y1] = toque;
  const w = (x1 - x0) * L;
  const h = Math.max(44, (y1 - y0) * A);
  return (
    <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { opacity: chega }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {desenho}
      </View>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: p.acesa }}
        accessibilityLabel={`${p.item.nome}, ${p.acesa ? "acesa" : "apagada"}`}
        accessibilityHint="Toque para acender ou apagar"
        onPress={() => p.aoTocar(p.item.id)}
        style={{
          position: "absolute",
          left: x0 * L,
          top: ((y0 + y1) / 2) * A - h / 2,
          width: w,
          height: h,
        }}
      />
    </Animated.View>
  );
});

/* ── O varal (de luzinhas e o pisca-pisca) ─────────────────────────────── */

function Varal({
  ancoras,
  y,
  caida,
  raio,
  cores,
  porArco,
  v,
  forca,
  L,
  A,
  id,
}: {
  ancoras: readonly number[];
  y: number;
  caida: number;
  raio: number;
  cores: readonly CorDaLampada[];
  porArco: number;
  v: Animated.Value;
  forca: number;
  L: number;
  A: number;
  id: string;
}) {
  /* Os arcos do fio (uma parábola entre cada par de âncoras) e as lâmpadas
     penduradas ao longo dele. */
  const { fio, lampadas } = useMemo(() => {
    const ponto = (a: number, b: number, t: number) =>
      [(a + (b - a) * t) * L, (y + caida * 4 * t * (1 - t)) * A] as const;
    let d = "";
    const lampadas: { x: number; y: number; cor: CorDaLampada }[] = [];
    let k = 0;
    for (let i = 0; i + 1 < ancoras.length; i++) {
      const [a, b] = [ancoras[i]!, ancoras[i + 1]!];
      for (let j = 0; j <= 16; j++) {
        const [px, py] = ponto(a, b, j / 16);
        d += `${i === 0 && j === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)} `;
      }
      for (let j = 0; j < porArco; j++) {
        const [px, py] = ponto(a, b, (j + 0.5) / porArco);
        lampadas.push({ x: px, y: py + raio * L * 1.1, cor: cores[k++ % cores.length]! });
      }
    }
    return { fio: d, lampadas };
  }, [ancoras, y, caida, raio, cores, porArco, L, A]);
  const r = raio * L;
  return (
    <>
      <Svg width={L} height={A} style={StyleSheet.absoluteFill}>
        <Path d={fio} stroke="#6b4f3a" strokeWidth={1.1} fill="none" strokeOpacity={0.85} />
        {/* Apagadas: o vidro colorido, sem luz. */}
        {lampadas.map((l, i) => (
          <Fragment key={i}>
            <Rect
              x={l.x - r * 0.4}
              y={l.y - r * 1.55}
              width={r * 0.8}
              height={r * 0.6}
              fill="#5a4636"
            />
            <Ellipse
              cx={l.x}
              cy={l.y}
              rx={r * 0.82}
              ry={r}
              fill={LAMPADAS[l.cor][1]}
              fillOpacity={0.55}
            />
          </Fragment>
        ))}
      </Svg>
      {/* Acesas: o miolo claro e o halo, somados. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: v, mixBlendMode: "screen" }]}>
        <Svg width={L} height={A}>
          <Defs>
            {(Object.keys(LAMPADAS) as CorDaLampada[]).map((c) => (
              <RadialGradient key={c} id={`${id}-${c}`} cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0" stopColor={LAMPADAS[c][1]} stopOpacity={0.85 * forca} />
                <Stop offset="0.4" stopColor={LAMPADAS[c][1]} stopOpacity={0.3 * forca} />
                <Stop offset="1" stopColor={LAMPADAS[c][1]} stopOpacity={0} />
              </RadialGradient>
            ))}
          </Defs>
          {lampadas.map((l, i) => (
            <Circle key={`h${i}`} cx={l.x} cy={l.y} r={r * 4.2} fill={`url(#${id}-${l.cor})`} />
          ))}
          {lampadas.map((l, i) => (
            <Ellipse
              key={`m${i}`}
              cx={l.x}
              cy={l.y}
              rx={r * 0.7}
              ry={r * 0.88}
              fill={LAMPADAS[l.cor][0]}
            />
          ))}
        </Svg>
      </Animated.View>
    </>
  );
}

/* ── O neon de lua, na parede da direita ───────────────────────────────── */

/* A lua crescente e a estrelinha, numa caixa de 100 × 100. */
const LUA = "M60,12 A40,40 0 1,0 86,74 A31,31 0 1,1 60,12 Z";
/* Com folga em volta: o brilho do tubo passa da lua. */
const CAIXA_DO_NEON = "-14 -14 128 128";
const ESTRELINHA = "M84,16 L87,25 L96,26 L89,32 L91,41 L84,36 L77,41 L79,32 L72,26 L81,25 Z";

function NeonDeLua({ v, forca, L, A }: { v: Animated.Value; forca: number; L: number; A: number }) {
  const lado = 0.09 * L;
  const cx = 0.862 * L;
  const cy = 0.352 * A;
  const caixa = {
    position: "absolute" as const,
    left: cx - lado / 2,
    top: cy - lado / 2,
    width: lado,
    height: lado,
    /* A parede da direita foge para o fundo: o neon a acompanha. */
    transform: [{ skewY: "-24deg" }],
  };
  return (
    <>
      <View style={caixa}>
        <Svg width={lado} height={lado} viewBox={CAIXA_DO_NEON}>
          {/* Apagado: o tubo de vidro, rosado e opaco. */}
          <Path d={LUA} stroke="#e9cfdc" strokeWidth={4} fill="none" strokeLinejoin="round" />
          <Path
            d={ESTRELINHA}
            stroke="#efe0c6"
            strokeWidth={3.2}
            fill="none"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <Animated.View style={[caixa, { opacity: v }]}>
        <Svg width={lado} height={lado} viewBox={CAIXA_DO_NEON}>
          {[
            [18, "#ff6fbf", 0.18 * forca],
            [11, "#ff8fd0", 0.4 * forca],
            [5.5, "#ff9fd6", 1],
            [2.4, "#fff0f8", 1],
          ].map(([w, c, o], i) => (
            <Path
              key={i}
              d={LUA}
              stroke={c as string}
              strokeOpacity={o as number}
              strokeWidth={w as number}
              fill="none"
              strokeLinejoin="round"
            />
          ))}
          {[
            [12, "#ffc85a", 0.3 * forca],
            [4.5, "#ffd27a", 1],
            [1.8, "#fff6dc", 1],
          ].map(([w, c, o], i) => (
            <Path
              key={`e${i}`}
              d={ESTRELINHA}
              stroke={c as string}
              strokeOpacity={o as number}
              strokeWidth={w as number}
              fill="none"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
      </Animated.View>
      {/* O rosa que o neon joga na parede. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: v, mixBlendMode: "screen" }]}>
        <Svg width={L} height={A}>
          <Defs>
            <RadialGradient id="neon-parede" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#ff7fc4" stopOpacity={0.32 * forca} />
              <Stop offset="1" stopColor="#ff7fc4" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={cx} cy={cy} rx={lado * 1.4} ry={lado * 1.7} fill="url(#neon-parede)" />
        </Svg>
      </Animated.View>
    </>
  );
}

/* ── O projetor de estrelas, na cômoda ─────────────────────────────────── */

/** As estrelas que ele joga no teto e no alto das paredes: fixas (a foto sai igual). */
const ESTRELAS_DO_PROJETOR: readonly (readonly [number, number, number, 0 | 1 | 2])[] = (() => {
  const lista: [number, number, number, 0 | 1 | 2][] = [];
  let s = 7;
  const sorteio = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 0; i < 46; i++) {
    const y = 0.03 + sorteio() * 0.36;
    /* O teto se estreita para o fundo: no alto vai de ponta a ponta. */
    const meia = y < 0.27 ? 0.46 - (y / 0.27) * 0.18 : 0.3;
    const x = 0.5 + (sorteio() * 2 - 1) * meia;
    lista.push([x, y, 0.6 + sorteio() * 1.2, (i % 3) as 0 | 1 | 2]);
  }
  return lista;
})();
const COR_DAS_ESTRELAS = ["#fff4cf", "#cfe2ff", "#e4d6ff"] as const;

function Projetor({
  v,
  forca,
  noite,
  L,
  A,
}: {
  v: Animated.Value;
  forca: number;
  noite: boolean;
  L: number;
  A: number;
}) {
  const cx = 0.665 * L;
  const base = 0.463 * A;
  const r = 0.019 * L;
  return (
    <>
      {/* As estrelas no teto: só de noite (de dia o sol as apaga; ficavam
          pontinhos soltos no teto claro). De dia ele só brilha de leve. */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: noite ? v : 0, mixBlendMode: "screen" }]}
      >
        <Svg width={L} height={A}>
          <Defs>
            <RadialGradient id="nebulosa" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#9d8cff" stopOpacity={0.22 * forca} />
              <Stop offset="1" stopColor="#9d8cff" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="estrela-projetada" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#fff6d8" stopOpacity={noite ? 0.9 : 0.35} />
              <Stop offset="1" stopColor="#fff6d8" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={0.5 * L} cy={0.17 * A} rx={0.5 * L} ry={0.16 * A} fill="url(#nebulosa)" />
          <Ellipse cx={0.62 * L} cy={0.33 * A} rx={0.26 * L} ry={0.08 * A} fill="url(#nebulosa)" />
          {ESTRELAS_DO_PROJETOR.map(([x, y, t, c], i) => (
            <G key={i}>
              <Circle cx={x * L} cy={y * A} r={t * 3.2} fill="url(#estrela-projetada)" />
              <Circle
                cx={x * L}
                cy={y * A}
                r={t * 0.9}
                fill={COR_DAS_ESTRELAS[c]}
                fillOpacity={noite ? 1 : 0.45}
              />
            </G>
          ))}
        </Svg>
      </Animated.View>
      {/* O aparelho: a cúpula lilás com as estrelas vazadas, na base. */}
      <Svg width={L} height={A} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="cupula" cx="38%" cy="30%" rx="70%" ry="80%">
            <Stop offset="0" stopColor="#efe6ff" />
            <Stop offset="0.6" stopColor="#b39cf2" />
            <Stop offset="1" stopColor="#7c60d2" />
          </RadialGradient>
        </Defs>
        <Ellipse cx={cx} cy={base - r * 0.12} rx={r * 1.12} ry={r * 0.3} fill="#b6a6e2" />
        <Path
          d={`M${cx - r},${base - r * 0.2} A${r},${r} 0 0,1 ${cx + r},${base - r * 0.2} Z`}
          fill="url(#cupula)"
        />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: v }]}>
        <Svg width={L} height={A}>
          {[
            [-0.4, -0.55],
            [0.15, -0.75],
            [0.5, -0.4],
            [-0.05, -0.38],
          ].map(([dx, dy], i) => (
            <Circle key={i} cx={cx + dx! * r} cy={base + dy! * r} r={r * 0.11} fill="#fff4c8" />
          ))}
        </Svg>
      </Animated.View>
    </>
  );
}

/* ── A fita de LED, embaixo do tampo da bancada ────────────────────────── */

/* Os dois trechos de bancada (a pia fica no meio) e a borda do tampo. */
const TRECHOS_DA_FITA: readonly (readonly [number, number])[] = [
  [0.122, 0.413],
  [0.592, 0.699],
];
const BORDA_DO_TAMPO = 0.5175;

function FitaDeLed({ v, forca, L, A }: { v: Animated.Value; forca: number; L: number; A: number }) {
  const y = BORDA_DO_TAMPO * A;
  const desce = 0.07 * A;
  return (
    <>
      <Svg width={L} height={A} style={StyleSheet.absoluteFill}>
        {TRECHOS_DA_FITA.map(([a, b], i) => (
          <Rect
            key={i}
            x={a * L}
            y={y - 0.6}
            width={(b - a) * L}
            height={1.4}
            fill="#e8d2b4"
            fillOpacity={0.7}
          />
        ))}
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: v, mixBlendMode: "screen" }]}>
        <Svg width={L} height={A}>
          <Defs>
            <Degrade
              id="fita-cai"
              x1="0"
              y1={y}
              x2="0"
              y2={y + desce}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor="#ffc98a" stopOpacity={0.55 * forca} />
              <Stop offset="0.5" stopColor="#ffc98a" stopOpacity={0.18 * forca} />
              <Stop offset="1" stopColor="#ffc98a" stopOpacity={0} />
            </Degrade>
          </Defs>
          {TRECHOS_DA_FITA.map(([a, b], i) => (
            <Fragment key={i}>
              <Polygon
                points={`${a * L},${y} ${b * L},${y} ${b * L + 4},${y + desce} ${a * L - 4},${y + desce}`}
                fill="url(#fita-cai)"
              />
              <Rect x={a * L} y={y - 0.8} width={(b - a) * L} height={1.8} fill="#fff4dc" />
            </Fragment>
          ))}
        </Svg>
      </Animated.View>
    </>
  );
}

/* ── Os pendentes de vidro, pendurados do teto ─────────────────────────── */

const PENDENTES: readonly number[] = [0.42, 0.58];
const ALTURA_DO_GLOBO = 0.238;

function Pendentes({ v, forca, L, A }: { v: Animated.Value; forca: number; L: number; A: number }) {
  const r = 0.021 * L;
  const gy = ALTURA_DO_GLOBO * A;
  return (
    <>
      <Svg width={L} height={A} style={StyleSheet.absoluteFill}>
        <Defs>
          <Degrade id="latao" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#a87d3e" />
            <Stop offset="0.5" stopColor="#f0cf8a" />
            <Stop offset="1" stopColor="#a87d3e" />
          </Degrade>
          <RadialGradient id="vidro-apagado" cx="38%" cy="35%" rx="65%" ry="65%">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0.85} />
            <Stop offset="0.7" stopColor="#f3e6dc" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#d9c2b4" stopOpacity={0.65} />
          </RadialGradient>
        </Defs>
        {PENDENTES.map((x, i) => (
          <G key={i}>
            <Rect x={x * L - 0.5} y={0} width={1} height={gy - r * 1.15} fill="#4a3a2e" />
            <Polygon
              points={`${x * L - r * 0.28},${gy - r * 1.2} ${x * L + r * 0.28},${gy - r * 1.2} ${x * L + r * 0.42},${gy - r * 0.86} ${x * L - r * 0.42},${gy - r * 0.86}`}
              fill="url(#latao)"
            />
            <Circle cx={x * L} cy={gy} r={r} fill="url(#vidro-apagado)" />
          </G>
        ))}
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: v }]}>
        <Svg width={L} height={A}>
          <Defs>
            <RadialGradient id="vidro-aceso" cx="42%" cy="40%" rx="60%" ry="60%">
              <Stop offset="0" stopColor="#ffffff" />
              <Stop offset="0.5" stopColor="#fff0cf" />
              <Stop offset="1" stopColor="#ffbe6e" />
            </RadialGradient>
          </Defs>
          {PENDENTES.map((x, i) => (
            <Circle key={i} cx={x * L} cy={gy} r={r} fill="url(#vidro-aceso)" />
          ))}
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: v, mixBlendMode: "screen" }]}>
        <Svg width={L} height={A}>
          <Defs>
            <RadialGradient id="pendente-halo" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#ffc98a" stopOpacity={0.6 * forca} />
              <Stop offset="0.4" stopColor="#ffc98a" stopOpacity={0.22 * forca} />
              <Stop offset="1" stopColor="#ffc98a" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="pendente-poca" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#ffd9a0" stopOpacity={0.4 * forca} />
              <Stop offset="1" stopColor="#ffd9a0" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {PENDENTES.map((x, i) => (
            <Fragment key={i}>
              <Circle cx={x * L} cy={gy} r={r * 5} fill="url(#pendente-halo)" />
              {/* A luz que cai na bancada, embaixo de cada um. */}
              <Ellipse
                cx={x * L}
                cy={0.506 * A}
                rx={0.1 * L}
                ry={0.012 * A}
                fill="url(#pendente-poca)"
              />
            </Fragment>
          ))}
        </Svg>
      </Animated.View>
    </>
  );
}
