import { createContext, memo, useContext, useEffect, useId, useMemo, useRef } from "react";
import { Animated, Easing, View, type ViewStyle } from "react-native";
import Svg, { Defs, G, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import type { PoseKey } from "@/lib/exercicios";
import { useMovimentoReduzido, useParalaxe } from "~/componentes/movimento";
import { quadroNoTempo, RESPIRO, USOS, type Uso } from "~/lib/jornada/figura";
import { coresDaFigura, paradaEmCor } from "~/lib/jornada/figura-cores";
import {
  degradesDe,
  escalaNoDisco,
  type Camada,
  type Desenho,
  type Forma,
  type Gradiente,
  type Tom,
} from "~/lib/jornada/figura-desenho";
import { desenhoDoMovimento } from "~/lib/jornada/figura-poses";

/**
 * A FIGURA DEMONSTRANDO O MOVIMENTO (refeita em 21/11/2026: "essa imagem do
 * exercício está muito ruim [...] deixar mais profissional", o dono).
 *
 * Era o boneco de palito do site. Agora é uma personagem — pele, cabelo
 * preso, a blusa na cor da atividade, a legging, o tênis, a barriga com
 * volume — numa pose desenhada para cada exercício, com o apoio de verdade (a
 * cadeira, a parede, o tapete, o travesseiro, a bola). O desenho e as poses
 * moram em `~/lib/jornada/figura-desenho` e `figura-poses`, sem react-native;
 * aqui eles viram SVG.
 *
 * AS ANIMAÇÕES NO FIO NATIVO (18/11/2026, a vistoria: "30 commits de caminhos
 * SVG por segundo durante toda a sessão"). Cada pedaço que se mexe é uma
 * CAMADA: um SVG parado dentro de uma `Animated.View`, e quem anda é a
 * transformação dela (girar, deslocar, esticar, a opacidade), no motor
 * nativo, sem o JS. Os números saem da tabela (`~/lib/jornada/figura`): o
 * ciclo é amostrado em pontos e vira uma interpolação — a curva `ease-in-out`
 * fica nos pontos, já que a interpolação nativa não leva curva.
 *
 * O desenho fica dentro de um disco (o vão do anel do tempo): a parede, o
 * tapete e o chão terminam na borda dele, sem quina. As cores moram em
 * `~/lib/jornada/figura-cores` (a prévia usa as mesmas).
 *
 * O VOLUME (a terceira volta, 21/11/2026: "dar mais movimento e refinar ainda
 * mais para parecer realmente uma arte 3D"). Cada peça é pintada com a luz de
 * estúdio dos objetos 3D do app (`gradiente`, no kit), atrás dela há a luz do
 * palco, a figura respira o tempo todo por baixo do exercício (`RESPIRO`) e
 * anda um pouco com a inclinação do celular, enquanto a luz do palco anda ao
 * contrário (a paralaxe da aba do bebê): é essa diferença que dá profundidade.
 *
 * Com "Reduzir movimento" ela fica na primeira pose, sem respirar e sem
 * paralaxe, e nada se perde: os passos estão escritos embaixo.
 */

/** Quantos pontos por ciclo: a curva fica lisa e a tabela, pequena. */
const PONTOS = 48;

/** O vão do anel do Mexer: o disco onde a figura mora. */
const DISCO = 176;

/** A sobra de cada lado das folhas: a paralaxe e a respiração não descobrem a borda. */
const FOLGA = 8;

/** Quanto a figura anda com a inclinação do celular (pt), e a luz do palco, ao contrário. */
const PARALAXE = { figura: [2.6, 1.8], palco: [-4, -3] } as const;

/** O palco: o tamanho na tela, a caixa do desenho e o relógio da figura. */
type Palco = {
  anim: string;
  cores: Record<Tom, string>;
  fase: Animated.Value;
  /** O relógio da respiração de fundo (mais lento, e só dela). */
  folego: Animated.Value;
  largura: number;
  altura: number;
  caixa: readonly [number, number, number, number];
  /** A escala do desenho na tela. */
  s: number;
};

const PalcoDaFigura = createContext<Palco | null>(null);
const usePalco = () => useContext(PalcoDaFigura)!;

export const FiguraMovimento = memo(function FiguraMovimento({
  pose,
  anim,
  tinta,
}: {
  pose: PoseKey;
  /** A `id` do movimento: é ela que escolhe o desenho e o que se mexe. */
  anim: string;
  tinta: string;
}) {
  const reduzido = useMovimentoReduzido();
  const fase = useRef(new Animated.Value(0)).current;
  const folego = useRef(new Animated.Value(0)).current;
  const paralaxe = useParalaxe();
  /* A respiração de fundo: o tempo todo, por baixo do exercício. */
  useEffect(() => {
    folego.setValue(0);
    if (reduzido) return;
    const laco = Animated.loop(
      Animated.timing(folego, {
        toValue: 1,
        duration: RESPIRO.duracao * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    laco.start();
    return () => laco.stop();
  }, [reduzido, folego]);
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

  const desenho = useMemo(() => desenhoDoMovimento(anim, pose), [anim, pose]);
  const palco = useMemo<Palco>(() => {
    const [, , w, h] = desenho.caixa;
    /* Cabe no disco com folga: a figura não chega às quinas da caixa, e o que
       chega (a parede, o tapete) é cortado pela borda redonda. */
    const s = escalaNoDisco(desenho.caixa, DISCO);
    /* A folha de cada camada é o disco inteiro (e a folga), com a caixa no
       meio: o que passa da caixa (a parede, o tapete) vai até a borda redonda. */
    const lado = (DISCO + 2 * FOLGA) / s;
    const [x, y] = desenho.caixa;
    return {
      anim,
      cores: coresDaFigura(tinta),
      fase,
      folego,
      largura: DISCO + 2 * FOLGA,
      altura: DISCO + 2 * FOLGA,
      caixa: [x + w / 2 - lado / 2, y + h / 2 - lado / 2, lado, lado] as const,
      s,
    };
  }, [anim, tinta, fase, folego, desenho]);

  /* A respiração, ancorada no chão: o pé da caixa do desenho, no meio. */
  const respiro = useMemo(() => {
    if (reduzido) return null;
    const [x, y, w, h] = desenho.caixa;
    const uso: Uso = { parte: "corpo", ...RESPIRO, origem: [x + w / 2, y + h] };
    return animacaoDaParte(uso, palco, palco.folego);
  }, [reduzido, desenho, palco]);

  const anda = (k: readonly [number, number]) => ({
    transform: [
      { translateX: paralaxe.x.interpolate({ inputRange: [-1, 1], outputRange: [-k[0], k[0]] }) },
      { translateY: paralaxe.y.interpolate({ inputRange: [-1, 1], outputRange: [-k[1], k[1]] }) },
    ],
  });
  const folha = {
    position: "absolute" as const,
    left: -FOLGA,
    top: -FOLGA,
    width: palco.largura,
    height: palco.altura,
  };

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Demonstração do movimento"
      style={{
        width: DISCO,
        height: DISCO,
        borderRadius: DISCO / 2,
        overflow: "hidden",
      }}
    >
      {/* A luz do palco: a mesma luz de estúdio dos objetos 3D, atrás dela. */}
      <Animated.View pointerEvents="none" style={[folha, anda(PARALAXE.palco)]}>
        <LuzDoPalco cor={palco.cores.tapete} lado={palco.largura} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[folha, anda(PARALAXE.figura)]}>
        <Animated.View pointerEvents="none" style={[folha, { left: 0, top: 0 }, respiro]}>
          <PalcoDaFigura.Provider value={palco}>
            {desenho.camadas.map((c, i) => (
              <CamadaDaFigura key={i} camada={c} />
            ))}
          </PalcoDaFigura.Provider>
        </Animated.View>
      </Animated.View>
    </View>
  );
});

/** A luz do palco: um foco suave, um pouco acima do meio, que some na borda. */
function LuzDoPalco({ cor, lado }: { cor: string; lado: number }) {
  const id = `palco${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <Svg width={lado} height={lado} viewBox="0 0 100 100" pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50" cy="44" r="48" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={cor} stopOpacity={1} />
          <Stop offset="0.6" stopColor={cor} stopOpacity={0.55} />
          <Stop offset="1" stopColor={cor} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Path d="M0 0H100V100H0Z" fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * Um desenho parado da personagem (as figuras do "Para vocês dois"), no
 * tamanho pedido, com as cores pedidas.
 */
export const FiguraParada = memo(function FiguraParada({
  desenho,
  cores,
  largura,
  altura,
}: {
  desenho: Desenho;
  cores: Record<Tom, string>;
  largura: number;
  altura: number;
}) {
  const fase = useRef(new Animated.Value(0)).current;
  const palco = useMemo<Palco>(() => {
    const [, , w, h] = desenho.caixa;
    const s = Math.min(largura / w, altura / h);
    return {
      anim: "",
      cores,
      fase,
      folego: fase,
      largura: w * s,
      altura: h * s,
      caixa: desenho.caixa,
      s,
    };
  }, [desenho, cores, fase, largura, altura]);
  return (
    <View
      style={{ width: largura, height: altura, alignItems: "center", justifyContent: "center" }}
    >
      <View style={{ width: palco.largura, height: palco.altura }}>
        <PalcoDaFigura.Provider value={palco}>
          {desenho.camadas.map((c, i) => (
            <CamadaDaFigura key={i} camada={c} />
          ))}
        </PalcoDaFigura.Provider>
      </View>
    </View>
  );
});

/** Uma forma do desenho, em SVG. Com degradê, a tinta é o `url(#id)` dele. */
function FormaSvg({ forma, ids }: { forma: Forma; ids: Map<Forma, string> }) {
  const { cores } = usePalco();
  if ("grupo" in forma)
    return (
      <G transform={forma.transform}>
        {forma.grupo.map((f, i) => (
          <FormaSvg key={i} forma={f} ids={ids} />
        ))}
      </G>
    );
  const id = ids.get(forma);
  return (
    <Path
      d={forma.d}
      fill={id ? `url(#${id})` : forma.cor ? cores[forma.cor] : "none"}
      {...(forma.traco
        ? {
            stroke: cores[forma.traco],
            strokeWidth: forma.espessura ?? 1,
            strokeLinecap: "round" as const,
            strokeLinejoin: "round" as const,
          }
        : {})}
      {...(forma.opacidade != null ? { opacity: forma.opacidade } : {})}
    />
  );
}

/** Um degradê do kit em SVG: as coordenadas da forma, ou frações da caixa dela. */
function DegradeSvg({ id, g }: { id: string; g: Gradiente }) {
  const { cores } = usePalco();
  const unidades = g.naCaixa ? "objectBoundingBox" : "userSpaceOnUse";
  const paradas = g.paradas.map((pa, i) => {
    const { cor, opacidade } = paradaEmCor(cores, pa);
    return <Stop key={i} offset={pa[0]} stopColor={cor} stopOpacity={opacidade} />;
  });
  return g.tipo === "linear" ? (
    <LinearGradient
      id={id}
      x1={g.de[0]}
      y1={g.de[1]}
      x2={g.ate[0]}
      y2={g.ate[1]}
      gradientUnits={unidades}
    >
      {paradas}
    </LinearGradient>
  ) : (
    <RadialGradient
      id={id}
      cx={g.centro[0]}
      cy={g.centro[1]}
      fx={g.centro[0]}
      fy={g.centro[1]}
      r={g.raio}
      gradientUnits={unidades}
    >
      {paradas}
    </RadialGradient>
  );
}

/** As formas de uma camada: um SVG do tamanho do palco, por cima do anterior. */
function Folha({ formas }: { formas: readonly Forma[] }) {
  const p = usePalco();
  const prefixo = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { lista, idDe } = useMemo(() => degradesDe(formas, prefixo), [formas, prefixo]);
  return (
    <Svg
      width={p.largura}
      height={p.altura}
      viewBox={p.caixa.join(" ")}
      style={{ position: "absolute", left: 0, top: 0 }}
      pointerEvents="none"
    >
      {lista.length ? (
        <Defs>
          {lista.map(({ id, gradiente }) => (
            <DegradeSvg key={id} id={id} g={gradiente} />
          ))}
        </Defs>
      ) : null}
      {formas.map((f, i) => (
        <FormaSvg key={i} forma={f} ids={idDe} />
      ))}
    </Svg>
  );
}

/**
 * Uma camada: as formas dela e as camadas de dentro. Se o movimento de agora
 * anima esta parte, tudo vai numa vista que se mexe; senão, fica parado.
 */
function CamadaDaFigura({ camada }: { camada: Camada }) {
  const p = usePalco();
  const estilo = useMemo(() => {
    const uso = camada.parte ? USOS[p.anim]?.find((u) => u.parte === camada.parte) : undefined;
    return uso ? animacaoDaParte(uso, p, p.fase) : null;
  }, [p, camada.parte]);
  const miolo = (
    <>
      {camada.formas?.length ? <Folha formas={camada.formas} /> : null}
      {camada.dentro?.map((c, i) => (
        <CamadaDaFigura key={i} camada={c} />
      ))}
    </>
  );
  if (!estilo) return miolo;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: "absolute", left: 0, top: 0, width: p.largura, height: p.altura },
        estilo,
      ]}
    >
      {miolo}
    </Animated.View>
  );
}

type Transformacao = NonNullable<ViewStyle["transform"]>;

/**
 * O que a vista de uma parte recebe: as transformações e a opacidade, como
 * interpolações de um relógio (o do exercício, ou o da respiração). A origem
 * (em coordenadas do desenho) vira um deslocamento em volta do centro da vista.
 */
function animacaoDaParte(
  uso: Uso,
  p: Palco,
  relogio: Animated.Value,
): { transform?: Transformacao; opacity?: Animated.AnimatedInterpolation<number> } {
  const amostras = Array.from({ length: PONTOS + 1 }, (_, k) =>
    quadroNoTempo(
      uso.quadros,
      uso.duracao,
      uso.curva,
      /* O último ponto é o fim do ciclo, e não o começo do próximo. */
      Math.min((k / PONTOS) * uso.duracao, uso.duracao - 1e-4),
    ),
  );
  const entrada = amostras.map((_, k) => k / PONTOS);
  const serie = (valores: number[], unidade?: "deg") => {
    if (valores.every((v) => v === valores[0]))
      return unidade ? `${valores[0]}${unidade}` : valores[0]!;
    return relogio.interpolate({
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
    const cx = (ox - p.caixa[0]) * p.s - p.largura / 2;
    const cy = (oy - p.caixa[1]) * p.s - p.altura / 2;
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
      else if (funcao === "scaleY") meio.push({ scaleY: serie(arg(0)) });
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
    fora.opacity = relogio.interpolate({
      inputRange: entrada,
      outputRange: amostras.map((a) => a.opacidade ?? 1),
    });
  }
  return fora;
}
