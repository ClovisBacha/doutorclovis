import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import X from "lucide-react-native/icons/x";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toque, Tocavel } from "~/componentes/base";
import {
  BolhaViva,
  rajada,
  useMovimentoReduzido,
  type HumorDaBolha,
} from "~/componentes/movimento";
import { PilulaSos } from "~/componentes/cabecalho";
import { Vidro } from "~/componentes/vidro";
import { EstrelaDoDia } from "~/componentes/caminho/pecas";
import { Estouro } from "~/componentes/jornada/efeitos";
import { corJornada } from "~/componentes/jornada/cores";
import {
  ALVO_MINIMO,
  amanhecer,
  cor,
  curva,
  escala,
  espaco,
  fonte,
  luz,
  ouro,
  raio,
  sombra,
} from "~/tema";

/* ── A bolha, porta-voz do app ─────────────────────────────────────────── */

export type Humor = HumorDaBolha;

export function Bolha({ humor, tamanho = 132 }: { humor: Humor; tamanho?: number }) {
  /* A bolha viva: o vídeo curto em laço de cada humor (movimento.tsx). A arte
     parada continua sendo o primeiro quadro e o que aparece com
     "reduzir movimento" ou na web. */
  return <BolhaViva humor={humor} tamanho={tamanho} />;
}

/**
 * A bolha com um balão de fala ao lado. O balão é MATERIAL, como o
 * `BolhaComBalao` das atividades deitado: branco, canto contínuo, a sombra em
 * camadas e a ponta virada para a bolha. Antes era uma caixa de borda lilás
 * de 1 pt, com cara de campo de formulário.
 */
export function BolhaFalando({
  humor,
  fala,
  tamanho = 96,
}: {
  humor: Humor;
  fala: string;
  tamanho?: number;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
      <Bolha humor={humor} tamanho={tamanho} />
      <View style={{ flex: 1, justifyContent: "center" }}>
        <View
          style={{
            backgroundColor: cor.cartao,
            borderRadius: canto20,
            ...curva,
            paddingHorizontal: 14,
            paddingVertical: 10,
            ...sombra,
          }}
        >
          <Text style={{ ...fonte.media, ...escala.legenda, color: cor.texto }}>{fala}</Text>
        </View>
        {/* A ponta, por CIMA do balão (a sombra dele não a corta), virada para a bolha. */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: -5,
            top: "50%",
            marginTop: -6,
            width: 12,
            height: 12,
            borderRadius: 2,
            backgroundColor: cor.cartao,
            transform: [{ rotate: "45deg" }],
          }}
        />
      </View>
    </View>
  );
}

const canto20 = 20;

/* ── Estrelas do dia ───────────────────────────────────────────────────── */

/**
 * UMA estrela só no app (18/11/2026, a vistoria: a trilha, a semana e a folha
 * do dia desenhavam três estrelas diferentes). Esta é a `EstrelaDoDia` da
 * trilha, o polígono com o degradê de ouro; o nome fica para quem já a usa.
 */
export function Estrela({ acesa, tamanho = 18 }: { acesa: boolean; tamanho?: number }) {
  return <EstrelaDoDia acesa={acesa} tamanho={tamanho} />;
}

export function Estrelas({
  feitos,
  total = 5,
  tamanho = 18,
  rotuloAcessivel,
}: {
  feitos: number;
  total?: number;
  tamanho?: number;
  /** O que o leitor de tela diz ("2 de 5 momentos de hoje"). */
  rotuloAcessivel?: string;
}) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={rotuloAcessivel ?? `${feitos} de ${total} estrelas`}
      style={{ flexDirection: "row", gap: Math.max(2, Math.round(tamanho / 8)) }}
    >
      {/* Cada estrela que acende estoura (infla + faíscas) — em qualquer tela. */}
      {Array.from({ length: total }, (_, i) => (
        <Estouro key={i} ativo={i < feitos}>
          <Estrela acesa={i < feitos} tamanho={tamanho} />
        </Estouro>
      ))}
    </View>
  );
}

/* ── Confete (Animated puro) ───────────────────────────────────────────── */

/**
 * As cores do confete são as do AMANHECER (o coral, o rosa, o violeta), a luz
 * de rosé e lilás do fundo e o ouro das estrelas: a festa na paleta do app.
 * Antes era o arco-íris do Tailwind (azul-céu, verde, laranja), que não é de
 * lugar nenhum daqui. As cores fortes aparecem mais vezes que as claras, que
 * somem sobre a luz do fundo.
 */
const CORES_DA_FESTA = [
  amanhecer[0],
  amanhecer[1],
  amanhecer[2],
  ouro.medio,
  amanhecer[1],
  luz.rose,
  amanhecer[2],
  ouro.escuro,
  luz.lilas,
  amanhecer[0],
] as const;

export function Confete({ pecas = 36, altura = 800 }: { pecas?: number; altura?: number }) {
  const itens = useRef(
    Array.from({ length: pecas }, (_, i) => ({
      x: Math.random() * 100,
      atraso: Math.random() * 500,
      dur: 2200 + Math.random() * 1400,
      gira: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
      deriva: (Math.random() - 0.5) * 80,
      cor: CORES_DA_FESTA[i % CORES_DA_FESTA.length],
      larg: 7 + Math.random() * 6,
      redondo: Math.random() > 0.6,
      v: new Animated.Value(0),
    })),
  ).current;
  useEffect(() => {
    const anims = itens.map((p) =>
      Animated.timing(p.v, {
        toValue: 1,
        duration: p.dur,
        delay: p.atraso,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    Animated.parallel(anims).start();
    return () => anims.forEach((a) => a.stop());
  }, [itens]);
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, overflow: "hidden" }}
    >
      {itens.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: -20,
            width: p.larg,
            height: p.redondo ? p.larg : p.larg * 1.6,
            borderRadius: p.redondo ? p.larg : 2,
            backgroundColor: p.cor,
            opacity: p.v.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, altura] }) },
              { translateX: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, p.deriva] }) },
              {
                rotate: p.v.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", `${p.gira}deg`],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

/* ── Pulso (para o que pede um toque) ──────────────────────────────────── */

export function Pulsando({
  children,
  ativo = true,
  estilo,
}: {
  children: ReactNode;
  ativo?: boolean;
  estilo?: StyleProp<ViewStyle>;
}) {
  /* Parado com "reduzir movimento" e fora de vista, como todo laço do app. */
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ativo || reduzido) return;
    const laco = rajada(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      2,
      6000,
    );
    laco.start();
    return () => laco.stop();
  }, [ativo, v, reduzido]);
  return (
    <Animated.View
      style={[
        estilo,
        ativo && {
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/* ── Folha (de baixo para cima) ────────────────────────────────────────── */

/** O topo da folha: o canto que o iPhone dá às folhas do sistema. */
const CANTO_DA_FOLHA = 28;

/**
 * A FOLHA DE BAIXO — a única do app (18/11/2026, a vistoria: eram 18 janelas
 * desenhadas à mão, e nesta o véu subia junto com a folha, num castanho da
 * paleta antiga). Agora é como a do iPhone:
 * - o véu (`cor.veu`, a tinta ameixa) ESMAECE em 200 ms, parado no lugar;
 * - a folha sobe sozinha, numa mola no fio nativo;
 * - arrastar para baixo fecha (ou volta, se o arrasto foi curto);
 * - o topo tem o canto contínuo de 28 e a alça; o pé respeita a área segura.
 * Com "reduzir movimento", a folha aparece e some sem subir.
 *
 * A API é a mesma de antes (`aberta`, `aoFechar`, `titulo`, `children`): as
 * outras telas passam a usá-la sem mudar nada.
 */
export function Folha({
  aberta,
  aoFechar,
  children,
  titulo,
}: {
  aberta: boolean;
  aoFechar: () => void;
  children: ReactNode;
  titulo?: string;
}) {
  const baixo = useSafeAreaInsets().bottom;
  const { height: alturaDaJanela } = useWindowDimensions();
  const reduzido = useMovimentoReduzido();
  const [montada, setMontada] = useState(aberta);
  /* `sobe`: quanto a folha está abaixo do lugar dela (0 = no lugar). */
  const sobe = useRef(new Animated.Value(alturaDaJanela)).current;
  const arrasto = useRef(new Animated.Value(0)).current;
  const veu = useRef(new Animated.Value(0)).current;
  const altura = useRef(0);
  const dentro = useRef(false);
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;

  const entrar = () => {
    dentro.current = true;
    sobe.stopAnimation();
    veu.stopAnimation();
    arrasto.stopAnimation();
    arrasto.setValue(0);
    if (reduzido) {
      sobe.setValue(0);
      arrasto.setValue(0);
      Animated.timing(veu, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      return;
    }
    Animated.parallel([
      Animated.timing(veu, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(sobe, { toValue: 0, speed: 14, bounciness: 2, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    if (aberta) {
      if (!montada) setMontada(true);
      /* Já medida (reaberta no meio da saída): sobe de onde está. */ else if (altura.current > 0)
        entrar();
      return;
    }
    if (!montada) return;
    dentro.current = false;
    Animated.parallel([
      Animated.timing(veu, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(sobe, {
        toValue: reduzido ? 0 : altura.current || alturaDaJanela,
        duration: reduzido ? 1 : 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished || dentro.current) return;
      setMontada(false);
      arrasto.setValue(0);
      sobe.setValue(alturaDaJanela);
      altura.current = 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta]);

  const gesto = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx) * 1.2,
      onPanResponderMove: (_, g) => arrasto.setValue(g.dy > 0 ? g.dy : g.dy / 8),
      onPanResponderRelease: (_, g) => {
        const longe = g.dy > Math.min(140, altura.current * 0.3);
        if (longe || g.vy > 1.1) {
          Animated.timing(arrasto, {
            toValue: Math.max(altura.current, g.dy),
            duration: 180,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }).start();
          fechar.current();
          return;
        }
        Animated.spring(arrasto, {
          toValue: 0,
          speed: 18,
          bounciness: 4,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () =>
        Animated.spring(arrasto, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;

  if (!montada) return null;
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={aoFechar}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Animated.View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: cor.veu,
            opacity: Animated.multiply(
              veu,
              arrasto.interpolate({
                inputRange: [0, 400],
                outputRange: [1, 0.35],
                extrapolate: "clamp",
              }),
            ),
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            onPress={aoFechar}
            style={{ flex: 1 }}
          />
        </Animated.View>
        <Animated.View
          {...gesto.panHandlers}
          accessibilityViewIsModal
          onLayout={(ev) => {
            const h = ev.nativeEvent.layout.height;
            const primeira = altura.current === 0;
            altura.current = h;
            if (primeira && aberta) {
              sobe.setValue(reduzido ? 0 : h);
              entrar();
            }
          }}
          style={{
            backgroundColor: luz.base,
            borderTopLeftRadius: CANTO_DA_FOLHA,
            borderTopRightRadius: CANTO_DA_FOLHA,
            ...curva,
            paddingHorizontal: espaco.lg,
            paddingTop: espaco.sm,
            paddingBottom: baixo + espaco.lg,
            gap: espaco.md,
            transform: [{ translateY: Animated.add(sobe, arrasto) }],
          }}
        >
          <View style={{ alignItems: "center", paddingBottom: 2 }}>
            <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: cor.chevron }} />
          </View>
          {titulo ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
              <Text
                accessibilityRole="header"
                style={{
                  flex: 1,
                  ...fonte.display,
                  ...escala.titulo2,
                  letterSpacing: -0.2,
                  color: cor.texto,
                }}
              >
                {titulo}
              </Text>
              <FecharDaFolha aoTocar={aoFechar} />
            </View>
          ) : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

/** O X das folhas, como o do iPhone: um círculo cinza de 30, com o alvo de 44. */
function FecharDaFolha({ aoTocar }: { aoTocar: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Fechar"
      hitSlop={(ALVO_MINIMO - 30) / 2}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: cor.apagado,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <X size={17} color={cor.textoApagado} strokeWidth={2.6} />
    </Pressable>
  );
}

export function BotaoRedondo({
  rotulo,
  aoTocar,
  children,
  fundo = cor.apagado,
}: {
  rotulo: string;
  aoTocar: () => void;
  children: ReactNode;
  fundo?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      hitSlop={6}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        width: ALVO_MINIMO,
        height: ALVO_MINIMO,
        borderRadius: ALVO_MINIMO / 2,
        backgroundColor: fundo,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

/* ── A barra do topo das telas empilhadas ──────────────────────────────── */

/**
 * Sair de uma tela da jornada (a aula, uma atividade, a semana): FECHA a tela
 * por cima, de volta ao lugar de onde ela veio (o Bebê, a Trilha, o dia), seja
 * ela empilhada ou apresentada de baixo (`fullScreenModal`). Aberta direto
 * (um link, sem nada atrás), cai na aba do Bebê — trocando a tela, nunca
 * empilhando uma segunda barra de abas por cima.
 */
export function voltarParaJornada() {
  if (router.canDismiss()) router.dismiss();
  else if (router.canGoBack()) router.back();
  else router.replace("/jornada");
}

export function BarraDoTopo({
  titulo,
  progresso,
  fechar = false,
  aoSair,
}: {
  titulo?: string;
  /** 0 → 1: a barra de progresso da atividade. */
  progresso?: number;
  /** X (sair da atividade) em vez de seta. */
  fechar?: boolean;
  aoSair?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        minHeight: ALVO_MINIMO + 4,
      }}
    >
      <BotaoDeVidro fechar={fechar} aoTocar={aoSair ?? voltarParaJornada} />
      {progresso != null ? (
        <BarraDeProgresso fracao={Math.min(1, Math.max(0, progresso))} />
      ) : (
        <Text
          numberOfLines={1}
          accessibilityRole="header"
          style={{ flex: 1, ...fonte.forte, ...escala.manchete, color: cor.texto }}
        >
          {titulo}
        </Text>
      )}
      <PilulaSos />
    </View>
  );
}

/**
 * O X (ou a seta) que FLUTUA sobre o que rola: uma gota de vidro de 44, como o
 * voltar do iOS 26. Antes era um círculo branco de borda cinza de 1 pt.
 */
function BotaoDeVidro({ fechar, aoTocar }: { fechar: boolean; aoTocar: () => void }) {
  return (
    <Tocavel
      rotulo={fechar ? "Sair" : "Voltar"}
      aoTocar={aoTocar}
      profundidade={0.92}
      estilo={{ width: ALVO_MINIMO, height: ALVO_MINIMO }}
    >
      <Vidro
        interativo
        forma={ALVO_MINIMO / 2}
        estilo={{
          width: ALVO_MINIMO,
          height: ALVO_MINIMO,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {fechar ? (
          <X size={21} color={cor.texto} strokeWidth={2.4} />
        ) : (
          <ChevronLeft size={24} color={cor.texto} strokeWidth={2.4} />
        )}
      </Vidro>
    </Tocavel>
  );
}

/* ── Fichinha (chip) ───────────────────────────────────────────────────── */

export function Ficha({
  rotulo,
  ativa,
  aoTocar,
  corAtiva = corJornada.roxo,
  fundoAtivo = corJornada.roxoFundo,
  textoAtivo = corJornada.roxoEscuro,
}: {
  rotulo: string;
  ativa?: boolean;
  aoTocar: () => void;
  corAtiva?: string;
  fundoAtivo?: string;
  textoAtivo?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!ativa }}
      accessibilityLabel={rotulo}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        minHeight: ALVO_MINIMO,
        paddingHorizontal: espaco.lg,
        borderRadius: raio.pilula,
        borderWidth: 1.5,
        borderColor: ativa ? corAtiva : cor.borda,
        backgroundColor: ativa ? fundoAtivo : cor.cartao,
        justifyContent: "center",
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          ...(ativa ? fonte.forte : fonte.media),
          fontSize: 15,
          color: ativa ? textoAtivo : cor.texto,
        }}
      >
        {rotulo}
      </Text>
    </Pressable>
  );
}

/**
 * A barra de progresso: o trilho e a luz que anda nele. A luz anda por
 * TRANSFORM no fio nativo (antes a mola refazia a largura, o layout, quadro a
 * quadro no JS, justo quando a opção quicava e a folha subia). A luz tem a
 * largura inteira e desliza da esquerda; o degradê do amanhecer fica preso ao
 * trilho, então ela vai do violeta ao coral conforme chega ao fim.
 */
function BarraDeProgresso({ fracao }: { fracao: number }) {
  const [largura, setLargura] = useState(0);
  const v = useRef(new Animated.Value(fracao)).current;
  useEffect(() => {
    Animated.spring(v, {
      toValue: fracao,
      useNativeDriver: true,
      speed: 14,
      bounciness: 6,
    }).start();
  }, [fracao, v]);
  const desliza = v.interpolate({
    inputRange: [0, 1],
    outputRange: [-largura, 0],
    extrapolate: "clamp",
  });
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fracao * 100) }}
      onLayout={(ev) => setLargura(ev.nativeEvent.layout.width)}
      style={{
        flex: 1,
        height: 12,
        borderRadius: 6,
        ...curva,
        backgroundColor: cor.trilho,
        overflow: "hidden",
      }}
    >
      {largura > 0 ? (
        <Animated.View
          style={{
            width: largura,
            height: "100%",
            borderRadius: 6,
            overflow: "hidden",
            transform: [{ translateX: desliza }],
          }}
        >
          {/* O degradê fica parado em relação ao trilho: anda ao contrário. */}
          <Animated.View
            style={{
              width: largura,
              height: "100%",
              transform: [{ translateX: Animated.multiply(desliza, -1) }],
            }}
          >
            <LinearGradient
              colors={[amanhecer[2], amanhecer[1], amanhecer[0]]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}
