import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
  type AccessibilityActionEvent,
} from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { CANTINHO_BY_ID, escalaDaArvore, faseDoDiaNoite, type CantinhoType } from "@/lib/cantinho";
import { climasAtivos, particulasDe, type Particula } from "@/lib/clima-do-cantinho";
import { toque } from "~/componentes/base";
import { corCaminho } from "~/componentes/caminho/cores";
import {
  DECOR_MAX,
  ESCALA_MAX,
  ESCALA_MIN,
  escalaArrastada,
  fatiaDoDegrade,
  hashStr,
  Y_INICIAL_DO_SITE,
  type EnfeitePosto,
  type Parada,
} from "~/lib/jornada/enfeites";
import { cor, espaco, fonte } from "~/tema";

/**
 * O QUE ELA COMPROU NO CANTINHO, NA TRILHA — as peças nativas do site
 * (`DecorSprite`, `ClimaNoAr`, o cenário e o modo Arrumar de
 * src/components/gestacao-path.tsx).
 *
 * As animações são as MESMAS keyframes do CSS do site (`dcHover`, `dcSway`,
 * `dcWander`, `dcTwinkle`, `dcRipple`, `dcGlow`), cada trecho com a curva
 * `ease-in-out` do CSS, no motor nativo. Com "Reduzir movimento" ligado, e
 * enquanto ela arruma, nada se mexe — como no site.
 */

/* ══════════════════════════════════════════════════════════════════════════
   O laço de quadros-chave
   ══════════════════════════════════════════════════════════════════════════ */

/** A curva `ease-in-out` do CSS — o site anima cada trecho entre quadros com ela. */
const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1);

/**
 * Um valor que percorre os quadros (`pontos`, de 0 a 1) com a curva do CSS em
 * cada trecho, e recomeça. O `atraso` é o `animation-delay` do site: até ele
 * passar, o enfeite fica no primeiro quadro.
 */
function useLaco(pontos: readonly number[], duracaoMs: number, atrasoMs: number, parado: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  const chave = pontos.join(",");
  useEffect(() => {
    v.setValue(0);
    if (parado) return;
    const marcos = chave.split(",").map(Number);
    const trechos: Animated.CompositeAnimation[] = [];
    for (let i = 1; i < marcos.length; i++) {
      trechos.push(
        Animated.timing(v, {
          toValue: marcos[i],
          duration: (marcos[i] - marcos[i - 1]) * duracaoMs,
          easing: EASE_IN_OUT,
          useNativeDriver: true,
        }),
      );
    }
    const laco = Animated.loop(Animated.sequence(trechos));
    const t = setTimeout(() => laco.start(), atrasoMs);
    return () => {
      clearTimeout(t);
      laco.stop();
    };
  }, [v, chave, duracaoMs, atrasoMs, parado]);
  return v;
}

/** O jeito de cada tipo se mexer — o `anim` do `DecorSprite`. */
type Jeito = "hover" | "sway" | "wander" | "twinkle" | "ripple";
function jeitoDoTipo(t: CantinhoType): Jeito {
  if (t === "bicho") return "wander";
  if (t === "planta") return "sway";
  if (t === "luz") return "twinkle";
  if (t === "agua") return "ripple";
  return "hover";
}

const QUADROS: Record<Jeito, { pontos: number[]; ms: number }> = {
  hover: { pontos: [0, 0.5, 1], ms: 4000 },
  sway: { pontos: [0, 0.5, 1], ms: 5500 },
  wander: { pontos: [0, 0.25, 0.5, 0.75, 1], ms: 7000 },
  twinkle: { pontos: [0, 0.45, 0.7, 1], ms: 5300 },
  ripple: { pontos: [0, 0.3, 0.6, 1], ms: 4700 },
};

function estiloDoJeito(j: Jeito, v: Animated.Value) {
  const q = QUADROS[j].pontos;
  const em = (saida: number[]) => v.interpolate({ inputRange: q, outputRange: saida });
  const graus = (saida: number[]) =>
    v.interpolate({ inputRange: q, outputRange: saida.map((g) => `${g}deg`) });
  switch (j) {
    case "hover":
      return { transform: [{ translateY: em([0, -8, 0]) }, { rotate: graus([-2, 3, -2]) }] };
    case "sway":
      return { transform: [{ rotate: graus([-5, 6, -5]) }], transformOrigin: "50% 90%" };
    case "wander":
      return {
        transform: [
          { translateX: em([-14, -4, 14, 4, -14]) },
          { translateY: em([0, -9, 0, -7, 0]) },
          { rotate: graus([0, 6, 0, -6, 0]) },
        ],
      };
    case "twinkle":
      return {
        opacity: em([0.55, 1, 0.8, 0.55]),
        transform: [{ scale: em([0.94, 1.06, 1, 0.94]) }],
      };
    case "ripple":
      return {
        transform: [
          { translateY: em([0, -6, -2, 0]) },
          { scaleX: em([1, 0.97, 1.03, 1]) },
          { scaleY: em([1, 1.04, 0.98, 1]) },
        ],
      };
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Um enfeite na trilha
   ══════════════════════════════════════════════════════════════════════════ */

export type ArrumarEnfeite = {
  selecionado: boolean;
  aoSelecionar: (k: string | null) => void;
  /** Soltou depois de arrastar: quanto andou, em px. */
  aoMover: (k: string, dx: number, dy: number) => void;
  aoRedimensionar: (k: string, s: number) => void;
  aoTirar: (k: string) => void;
  /** Um arrasto começou (`true`) ou acabou: a lista para de rolar enquanto isso. */
  aoArrastar: (ativo: boolean) => void;
};

/**
 * Um item do Cantinho na trilha, onde ela pôs e do tamanho que ela escolheu
 * (`x` em % da largura, `y` dentro do bloco, `s` a escala: 1 ≈ 32 px).
 *
 * Fora do modo Arrumar, só enfeita: não recebe toque nenhum (um enfeite que
 * rouba o dedo de quem ia abrir a aula do dia atrapalha). No modo Arrumar,
 * fica parado, por cima de tudo, e arrasta.
 */
export function EnfeiteNaTrilha({
  p,
  y,
  semana,
  parado,
  arrumar,
}: {
  p: EnfeitePosto;
  y: number;
  semana: number | null;
  parado: boolean;
  /** Presente só no modo Arrumar. */
  arrumar?: ArrumarEnfeite;
}) {
  const item = CANTINHO_BY_ID[p.id];
  const h = hashStr(p.k);
  const atraso = (h % 24) * 220;
  const jeito = item ? jeitoDoTipo(item.type) : "hover";
  const quieto = parado || !!arrumar;
  const v = useLaco(QUADROS[jeito].pontos, QUADROS[jeito].ms, atraso, quieto);
  const brilho = useLaco([0, 0.5, 1], 3600, atraso, quieto || item?.type !== "especial");

  /* O arrasto: o enfeite anda pelo `pan` (sem redesenhar a trilha) e só grava
     quando ela solta — gravar a cada pixel acordaria o blob da jornada 60
     vezes por segundo. */
  const pan = useRef(new Animated.ValueXY()).current;
  const escala = useRef(new Animated.Value(1)).current;
  const arrumarRef = useRef(arrumar);
  arrumarRef.current = arrumar;
  const sRef = useRef(p.s);
  sRef.current = p.s;
  const mexeu = useRef(false);

  const arrasto = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !!arrumarRef.current,
        onMoveShouldSetPanResponder: () => !!arrumarRef.current,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          mexeu.current = false;
          pan.setValue({ x: 0, y: 0 });
          arrumarRef.current?.aoSelecionar(p.k);
          arrumarRef.current?.aoArrastar(true);
        },
        onPanResponderMove: (_, g) => {
          /* Um toque que não arrastou nada não vira passo do Desfazer. */
          if (!mexeu.current && Math.abs(g.dx) + Math.abs(g.dy) < 4) return;
          mexeu.current = true;
          pan.setValue({ x: g.dx, y: g.dy });
        },
        onPanResponderRelease: (_, g) => {
          arrumarRef.current?.aoArrastar(false);
          if (mexeu.current) arrumarRef.current?.aoMover(p.k, g.dx, g.dy);
          pan.setValue({ x: 0, y: 0 });
        },
        onPanResponderTerminate: () => {
          arrumarRef.current?.aoArrastar(false);
          pan.setValue({ x: 0, y: 0 });
        },
      }),
    [p.k, pan],
  );

  const alca = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          escala.setValue(1);
          arrumarRef.current?.aoArrastar(true);
        },
        onPanResponderMove: (_, g) => {
          escala.setValue(escalaArrastada(sRef.current, g.dx, g.dy) / sRef.current);
        },
        onPanResponderRelease: (_, g) => {
          arrumarRef.current?.aoArrastar(false);
          arrumarRef.current?.aoRedimensionar(p.k, escalaArrastada(sRef.current, g.dx, g.dy));
          escala.setValue(1);
        },
        onPanResponderTerminate: () => {
          arrumarRef.current?.aoArrastar(false);
          escala.setValue(1);
        },
      }),
    [p.k, escala],
  );

  if (!item) return null;
  /* A Árvore que cresce MULTIPLICA o tamanho que ela escolheu (nunca o
     substitui); o Ciclo dia/noite mostra a face da hora dela. */
  const fonteDoEmoji = p.s * 32 * (item.id === "especial-arvore" ? escalaDaArvore(semana) : 1);
  const caixa = fonteDoEmoji * 1.3;
  const halo = p.s * 54.4;
  const sel = !!arrumar?.selecionado;

  return (
    <Animated.View
      {...(arrumar ? arrasto.panHandlers : {})}
      pointerEvents={arrumar ? "auto" : "none"}
      accessible={!!arrumar}
      accessibilityLabel={arrumar ? item.name : undefined}
      accessibilityHint={arrumar ? "Arraste para mover" : undefined}
      importantForAccessibility={arrumar ? "yes" : "no-hide-descendants"}
      style={{
        position: "absolute",
        left: `${p.x}%`,
        top: y,
        width: caixa,
        height: caixa,
        marginLeft: -caixa / 2,
        marginTop: -caixa / 2,
        alignItems: "center",
        justifyContent: "center",
        zIndex: arrumar ? 5 : 0,
        transform: [{ translateX: pan.x }, { translateY: pan.y }],
      }}
    >
      {sel ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: -16,
            right: -16,
            top: -16,
            bottom: -16,
            borderRadius: 16,
            borderWidth: 2,
            borderStyle: "dashed",
            borderColor: corCaminho.selecaoAro,
            backgroundColor: corCaminho.selecaoFundo,
          }}
        />
      ) : null}
      {item.type === "especial" ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: halo,
            height: halo,
            opacity: quieto
              ? 0.45
              : brilho.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.45, 0.85, 0.45] }),
            transform: [
              {
                scale: quieto
                  ? 1
                  : brilho.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.3, 1] }),
              },
            ],
          }}
        >
          <Svg width={halo} height={halo}>
            <Defs>
              <RadialGradient id={`halo-${p.k}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={corCaminho.haloOuro} stopOpacity={0.55} />
                <Stop offset="0.7" stopColor={corCaminho.haloOuro} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={halo / 2} cy={halo / 2} r={halo / 2} fill={`url(#halo-${p.k})`} />
          </Svg>
        </Animated.View>
      ) : null}
      {/* Duas camadas porque são dois `transform`: a escala da alça ⤢ por
          fora, o jeito de se mexer por dentro — no mesmo estilo, um apagaria
          o outro. */}
      <Animated.View style={{ transform: [{ scale: escala }] }}>
        <Animated.View style={quieto ? undefined : estiloDoJeito(jeito, v)}>
          <Text
            style={{
              fontSize: fonteDoEmoji,
              lineHeight: fonteDoEmoji * 1.18,
              textAlign: "center",
              textShadowColor: corCaminho.enfeiteSombra,
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 2,
            }}
          >
            {item.id === "especial-dianoite" ? faseDoDiaNoite(new Date().getHours()) : item.emoji}
          </Text>
        </Animated.View>
      </Animated.View>
      {sel && arrumar ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Tirar ${item.name} da trilha`}
            onPress={() => {
              toque();
              arrumar.aoTirar(p.k);
            }}
            hitSlop={6}
            style={[estilo.controle, { left: -24, top: -24, backgroundColor: corCaminho.tirar }]}
          >
            <Text style={estilo.controleTexto}>✕</Text>
          </Pressable>
          <View
            {...alca.panHandlers}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`Tamanho de ${item.name}`}
            accessibilityValue={{ min: ESCALA_MIN, max: ESCALA_MAX, now: Number(p.s.toFixed(2)) }}
            accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
            onAccessibilityAction={(e: AccessibilityActionEvent) => {
              const passo = e.nativeEvent.actionName === "increment" ? 0.2 : -0.2;
              arrumar.aoRedimensionar(p.k, Math.max(ESCALA_MIN, Math.min(ESCALA_MAX, p.s + passo)));
            }}
            hitSlop={6}
            style={[
              estilo.controle,
              { right: -24, bottom: -24, backgroundColor: corCaminho.redimensionar },
            ]}
          >
            <Text style={estilo.controleTexto}>⤢</Text>
          </View>
        </>
      ) : null}
    </Animated.View>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   O cenário e o ar — atrás da trilha
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * O CENÁRIO equipado e o AR (as partículas dos climas), na ordem do site:
 * papel de parede embaixo, o ar por cima dele, e a trilha por cima dos dois.
 *
 * Os dois moram ATRÁS da lista, presos à tela, e descem junto com o começo da
 * trilha enquanto o topo dela está à vista — no alto da tela, o cabeçalho
 * (faixa do topo, o humor do dia) não ganha cenário, como no site.
 */
export function FundoEAr({
  paradas,
  climas,
  rolagem,
  alturaDoTopo,
  alturaDaLista,
  alturaDaTrilha,
  largura,
  parado,
}: {
  paradas: readonly Parada[] | null;
  climas: readonly string[];
  rolagem: Animated.Value;
  alturaDoTopo: number;
  alturaDaLista: number;
  alturaDaTrilha: number;
  largura: number;
  parado: boolean;
}) {
  if ((!paradas || paradas.length === 0) && climas.length === 0) return null;
  if (alturaDaLista <= 0) return null;
  const desce = rolagem.interpolate({
    inputRange: [0, Math.max(1, alturaDoTopo)],
    outputRange: [alturaDoTopo, 0],
    extrapolate: "clamp",
  });
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, overflow: "hidden" }}
    >
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: alturaDaLista,
          transform: [{ translateY: desce }],
        }}
      >
        {paradas && paradas.length > 0 ? (
          <Cenario
            paradas={paradas}
            rolagem={rolagem}
            alturaDoTopo={alturaDoTopo}
            alturaDaLista={alturaDaLista}
            alturaDaTrilha={alturaDaTrilha}
          />
        ) : null}
        {climas.length > 0 ? (
          <NoAr ids={climas} altura={alturaDaLista} largura={largura} parado={parado} />
        ) : null}
      </Animated.View>
    </View>
  );
}

/** Quanto a tela anda antes de o cenário recalcular a cor (o degradê é de ~27.000 px). */
const PASSO_DO_CENARIO = 120;

/**
 * O papel de parede: a fatia do degradê que está à vista, a 55% (o
 * `opacity-55` do site). A cor anda com a rolagem em passos de 120 px — o
 * degradê inteiro tem a gestação toda, então a diferença entre dois passos é
 * menor que um tom.
 */
function Cenario({
  paradas,
  rolagem,
  alturaDoTopo,
  alturaDaLista,
  alturaDaTrilha,
}: {
  paradas: readonly Parada[];
  rolagem: Animated.Value;
  alturaDoTopo: number;
  alturaDaLista: number;
  alturaDaTrilha: number;
}) {
  const [passo, setPasso] = useState(0);
  useEffect(() => {
    const id = rolagem.addListener(({ value }) => {
      const n = Math.round(value / PASSO_DO_CENARIO);
      setPasso((p) => (p === n ? p : n));
    });
    return () => rolagem.removeListener(id);
  }, [rolagem]);
  const topo = Math.max(0, passo * PASSO_DO_CENARIO - alturaDoTopo) + Y_INICIAL_DO_SITE;
  const total = Math.max(1, alturaDaTrilha);
  const { cores, posicoes } = fatiaDoDegrade(paradas, topo / total, (topo + alturaDaLista) / total);
  return (
    <LinearGradient
      colors={cores as unknown as readonly [string, string, ...string[]]}
      locations={posicoes as unknown as readonly [number, number, ...number[]]}
      style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, opacity: 0.55 }}
    />
  );
}

/**
 * O AR: as partículas dos climas que ela tem (até três de uma vez, a régua de
 * `climasAtivos`), caindo ou subindo pela tela inteira. É ambiente: nunca
 * recebe toque.
 */
function NoAr({
  ids,
  altura,
  largura,
  parado,
}: {
  ids: readonly string[];
  altura: number;
  largura: number;
  parado: boolean;
}) {
  const chave = ids.join(",");
  const particulas = useMemo(
    () => climasAtivos(chave ? chave.split(",") : []).flatMap((id) => particulasDe(id)),
    [chave],
  );
  return (
    <>
      {particulas.map((q) => (
        <ParticulaNoAr key={q.k} q={q} altura={altura} largura={largura} parado={parado} />
      ))}
    </>
  );
}

function ParticulaNoAr({
  q,
  altura,
  largura,
  parado,
}: {
  q: Particula;
  altura: number;
  largura: number;
  parado: boolean;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (parado) return;
    let vivo = true;
    const dur = q.duracao * 1000;
    /* O atraso do site é NEGATIVO: a chuva já está caindo quando a tela abre.
       Aqui isso é começar a primeira volta do meio. */
    const inicio = (((-q.atraso % q.duracao) + q.duracao) % q.duracao) / q.duracao;
    const volta = (de: number) => {
      v.setValue(de);
      Animated.timing(v, {
        toValue: 1,
        duration: Math.max(1, (1 - de) * dur),
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && vivo) volta(0);
      });
    };
    volta(inicio);
    return () => {
      vivo = false;
      v.stopAnimation();
    };
  }, [parado, q, v]);

  const tamanho = q.tamanho * 16;
  const base = {
    position: "absolute" as const,
    left: `${q.esquerda}%` as const,
    top: 0,
    fontSize: tamanho,
    lineHeight: tamanho * 1.15,
  };
  if (parado) {
    /* PARA, não some: quem pediu menos movimento continua vendo o que comprou,
       espalhado e imóvel (`--dc-parada` do site). */
    return (
      <Text
        style={{
          ...base,
          opacity: q.opacidade,
          transform: [{ translateY: (((hashStr(q.k) % 88) + 6) / 100) * altura }],
        }}
      >
        {q.emoji}
      </Text>
    );
  }
  const fim = altura + 64;
  return (
    <Animated.Text
      style={{
        ...base,
        opacity: v.interpolate({
          inputRange: [0, 0.12, 0.86, 1],
          outputRange: [0, q.opacidade, q.opacidade, 0],
        }),
        transform: [
          {
            translateX: v.interpolate({
              inputRange: [0, 1],
              outputRange: [0, (q.deriva * largura) / 100],
            }),
          },
          {
            translateY: v.interpolate({
              inputRange: [0, 1],
              outputRange: q.sentido === "cai" ? [-48, fim] : [fim, -48],
            }),
          },
          { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${q.giro}deg`] }) },
        ],
      }}
    >
      {q.emoji}
    </Animated.Text>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   O modo Arrumar: o lápis e a barra de baixo
   ══════════════════════════════════════════════════════════════════════════ */

/** O ✏️ — do lado oposto ao da loja, como no site. */
export function BotaoDeArrumar({ aoTocar }: { aoTocar: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Arrumar os enfeites da trilha"
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        position: "absolute",
        left: espaco.lg,
        bottom: espaco.lg,
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: corCaminho.lapisFundo,
        borderWidth: 1,
        borderColor: corCaminho.lapisAro,
        shadowColor: corCaminho.sombra,
        shadowOpacity: 0.14,
        shadowRadius: 9,
        shadowOffset: { width: 0, height: 6 },
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Text style={{ fontSize: 20 }}>✏️</Text>
    </Pressable>
  );
}

/**
 * A barra do modo Arrumar: como se faz, quantos enfeites há, o Desfazer (um
 * passo — não existe "apagar tudo": um toque sem querer nunca leva embora o
 * que ela montou), o "Pronto ✓" e a bandeja com o que ela tem.
 */
export function BarraDeArrumar({
  quantos,
  podeDesfazer,
  aoDesfazer,
  aoTerminar,
  bandeja,
  aoPor,
}: {
  quantos: number;
  podeDesfazer: boolean;
  aoDesfazer: () => void;
  aoTerminar: () => void;
  bandeja: readonly string[];
  aoPor: (id: string) => void;
}) {
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        borderTopWidth: 1,
        borderTopColor: corCaminho.barraBorda,
        backgroundColor: corCaminho.barraFundo,
        paddingHorizontal: espaco.md,
        paddingTop: espaco.sm,
        paddingBottom: espaco.sm,
        shadowColor: corCaminho.sombra,
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -6 },
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
        <Text
          style={{
            flex: 1,
            fontFamily: fonte.normal,
            fontSize: 13,
            lineHeight: 17,
            color: cor.textoApagado,
          }}
        >
          Arraste pra mover ·{" "}
          <Text style={{ fontFamily: fonte.forte, color: corCaminho.barraTamanho }}>⤢</Text> pra
          mudar o tamanho ·{" "}
          <Text style={{ fontFamily: fonte.forte, color: corCaminho.barraTirar }}>✕</Text> pra tirar{" "}
          <Text style={{ fontVariant: ["tabular-nums"] }}>
            ({quantos}/{DECOR_MAX})
          </Text>
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Desfazer a última mudança"
          accessibilityState={{ disabled: !podeDesfazer }}
          disabled={!podeDesfazer}
          onPress={() => {
            toque();
            aoDesfazer();
          }}
          style={({ pressed }) => ({
            minHeight: 40,
            justifyContent: "center",
            borderRadius: 999,
            paddingHorizontal: espaco.md,
            backgroundColor: corCaminho.desfazerFundo,
            borderWidth: 1,
            borderColor: corCaminho.desfazerAro,
            opacity: !podeDesfazer ? 0.4 : pressed ? 0.8 : 1,
          })}
          hitSlop={2}
        >
          <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: corCaminho.desfazerTexto }}>
            ↩︎ Desfazer
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            toque();
            aoTerminar();
          }}
          style={({ pressed }) => ({
            minHeight: 40,
            justifyContent: "center",
            borderRadius: 999,
            paddingHorizontal: espaco.lg,
            backgroundColor: corCaminho.pronto,
            opacity: pressed ? 0.85 : 1,
          })}
          hitSlop={2}
        >
          <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: cor.branco }}>
            Pronto ✓
          </Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: espaco.sm, paddingTop: espaco.sm, paddingBottom: 4 }}
      >
        {bandeja.map((id) => {
          const item = CANTINHO_BY_ID[id];
          if (!item) return null;
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`Colocar ${item.name} na trilha`}
              onPress={() => {
                toque();
                aoPor(id);
              }}
              style={({ pressed }) => ({
                width: 48,
                height: 48,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: corCaminho.bandejaFundo,
                borderWidth: 1,
                borderColor: corCaminho.bandejaAro,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              })}
            >
              <Text style={{ fontSize: 24 }}>{item.emoji}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const estilo = {
  controle: {
    position: "absolute" as const,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 6,
  },
  controleTexto: { fontFamily: fonte.forte, fontSize: 14, color: cor.branco },
};
