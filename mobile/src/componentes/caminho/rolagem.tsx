import { useNavigation } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import ArrowDown from "lucide-react-native/icons/arrow-down";
import ArrowUp from "lucide-react-native/icons/arrow-up";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Text,
  View,
  type FlatList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Tocavel } from "~/componentes/base";
import { Vidro } from "~/componentes/vidro";
import { parametroDaBancada } from "~/lib/bancada";
import { comAlfa } from "~/lib/cor";
import { ALVO_MINIMO, cor, escala, espaco, fonte } from "~/tema";

/**
 * A ROLAGEM DA TRILHA — o que a gestação e o 4º trimestre fazem igual: abrir
 * em hoje sem salto, a pílula de voltar a hoje, o toque na aba já aberta e o
 * degradê onde a trilha se desfaz sob a camada de cima.
 *
 * Antes a lista abria em duas etapas (o `initialScrollIndex` punha o topo da
 * semana no alto, e 60 ms depois uma rolagem centrava hoje, refeita a cada
 * medida por dois segundos): a tela abria e saltava. Agora a posição de hoje é
 * uma soma — blocos de altura fixa e um cabeçalho de altura fixa —, a lista só
 * monta depois de a caixa e a camada de cima se medirem, e NASCE na posição
 * (`contentOffset`), invisível até se medir.
 */

/** Uma função de identidade fixa que sempre chama a versão mais nova (a tela passa setas novas a cada render). */
export function useEstavel<A extends unknown[], R>(f: (...a: A) => R): (...a: A) => R {
  const ref = useRef(f);
  useLayoutEffect(() => {
    ref.current = f;
  });
  return useCallback((...a: A) => ref.current(...a), []);
}

/** O espaço entre o pé da camada de cima e o primeiro bloco da trilha. */
export const RESPIRO_DO_TOPO = espaco.sm;

export function useAbrirEmHoje<T>({
  yDeHoje,
  indiceDeHoje,
  folga,
  reduzido,
}: {
  /** O centro do nó de hoje, desde o primeiro bloco. */
  yDeHoje: number;
  indiceDeHoje: number;
  /** A barra de abas que flutua por cima, embaixo. */
  folga: number;
  reduzido: boolean;
}) {
  const lista = useRef<FlatList<T>>(null);
  const [caixa, setCaixa] = useState<{ largura: number; altura: number } | null>(null);
  const [alturaDaCamada, setAlturaDaCamada] = useState<number | null>(null);
  const espacador = (alturaDaCamada ?? 0) + RESPIRO_DO_TOPO;
  const pronto = caixa != null && alturaDaCamada != null;
  const rolagemAgora = useRef(0);

  const aoMedirCaixa = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCaixa((c) =>
      c && c.largura === width && c.altura === height ? c : { largura: width, altura: height },
    );
  }, []);
  const aoMedirCamada = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setAlturaDaCamada((a) => (a === h ? a : h));
  }, []);

  /* "O meio" é o meio do que se vê ENTRE a camada de cima e a barra de abas. */
  const centroDeHoje = useCallback(() => {
    if (!caixa || alturaDaCamada == null || indiceDeHoje < 0) return 0;
    const meio = (alturaDaCamada + caixa.altura - folga) / 2;
    return Math.max(0, espacador + yDeHoje - meio);
  }, [caixa, alturaDaCamada, indiceDeHoje, folga, espacador, yDeHoje]);

  /* Na bancada, `&topo=1` deixa a lista no alto. */
  const [noAlto] = useState(() => parametroDaBancada("topo") === "1");
  /* Calculado UMA vez, quando as duas medidas chegam (`pronto` só vai de
     falso a verdadeiro). */
  const offsetInicial = useMemo(
    () => (pronto ? (noAlto ? 0 : centroDeHoje()) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pronto],
  );
  const contentOffset = useMemo(() => ({ x: 0, y: offsetInicial }), [offsetInicial]);
  /* Por onde a lista começa a desenhar: a semana de antes de hoje (o
     `contentOffset` dado, ela não rola sozinha até o índice). */
  const indiceInicial = noAlto || indiceDeHoje < 0 ? undefined : Math.max(0, indiceDeHoje - 1);

  const [aVista, setAVista] = useState(false);
  const aoMedirALista = useCallback(() => {
    if (aVista) return;
    /* A web (a bancada) não conhece o `contentOffset`: lá, e como garantia no
       iPhone, uma rolagem sem animação ANTES de a lista aparecer — invisível. */
    if (offsetInicial > 0)
      lista.current?.scrollToOffset({ offset: offsetInicial, animated: false });
    rolagemAgora.current = offsetInicial;
    setAVista(true);
  }, [aVista, offsetInicial]);

  /* A pílula "Hoje": hoje saiu da tela quando a rolagem andou mais que metade
     do que se vê, mais o raio do nó. Avaliada só quando a rolagem PARA. */
  const [longe, setLonge] = useState({ visivel: false, acima: true });
  const avaliar = useCallback(
    (y: number) => {
      rolagemAgora.current = y;
      if (!caixa || alturaDaCamada == null || indiceDeHoje < 0) return;
      const alvo = centroDeHoje();
      const limite = (caixa.altura - folga - alturaDaCamada) / 2 + 42;
      const visivel = Math.abs(y - alvo) > limite;
      const acima = y > alvo;
      setLonge((l) => (l.visivel === visivel && l.acima === acima ? l : { visivel, acima }));
    },
    [caixa, alturaDaCamada, folga, indiceDeHoje, centroDeHoje],
  );
  const aoParar = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => avaliar(e.nativeEvent.contentOffset.y),
    [avaliar],
  );
  const irParaHoje = useCallback(() => {
    const alvo = centroDeHoje();
    lista.current?.scrollToOffset({ offset: alvo, animated: !reduzido });
    rolagemAgora.current = alvo;
    setLonge((l) => (l.visivel ? { ...l, visivel: false } : l));
  }, [centroDeHoje, reduzido]);

  /* Tocar de novo na aba da trilha (já aberta) volta para hoje, como o iOS
     rola ao topo. A barra de abas emite o `tabPress` antes de navegar. */
  const navegacao = useNavigation();
  useEffect(() => {
    const nav = navegacao as unknown as {
      addListener?: (evento: string, f: () => void) => () => void;
      isFocused?: () => boolean;
    };
    if (!nav?.addListener) return;
    return nav.addListener("tabPress", () => {
      if (nav.isFocused?.()) irParaHoje();
    });
  }, [navegacao, irParaHoje]);

  return {
    lista,
    caixa,
    alturaDaCamada,
    espacador,
    pronto,
    aoMedirCaixa,
    aoMedirCamada,
    contentOffset,
    indiceInicial,
    aVista,
    aoMedirALista,
    longe,
    aoParar,
    irParaHoje,
    rolagemAgora,
  };
}

/**
 * O "scroll edge" do iOS: a trilha se desfaz sob a camada de cima (o placar,
 * o cabeçalho), em vez de ser cortada a seco — do tom do céu ao transparente.
 */
export function DegradeDoTopo({ cor: tinta, altura }: { cor: string; altura: number }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[tinta, comAlfa(tinta, 0.85), comAlfa(tinta, 0)]}
      locations={[0, 0.5, 1]}
      style={{ position: "absolute", top: 0, left: 0, right: 0, height: altura }}
    />
  );
}

/**
 * A PÍLULA "HOJE": quando hoje sai da tela, uma gota de vidro no pé (com a
 * seta para o lado em que ele ficou) leva de volta. Num jogo de 300 nós, o
 * atalho para o agora é básico (o Duolingo tem a seta flutuante).
 */
export function PilulaDeHoje({
  visivel,
  acima,
  baixo,
  aoTocar,
}: {
  visivel: boolean;
  acima: boolean;
  baixo: number;
  aoTocar: () => void;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: visivel ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [visivel, v]);
  const Seta = acima ? ArrowUp : ArrowDown;
  return (
    <Animated.View
      pointerEvents={visivel ? "box-none" : "none"}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: baixo,
        alignItems: "center",
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      <Tocavel aoTocar={aoTocar} rotulo="Voltar para hoje na trilha">
        <Vidro
          interativo
          tinta="rgba(255,255,255,0.72)"
          estilo={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            height: ALVO_MINIMO,
            paddingHorizontal: 18,
          }}
        >
          <Seta size={18} color={cor.primaria} strokeWidth={2.6} />
          <Text style={{ ...fonte.forte, ...escala.chamada, color: cor.texto }}>Hoje</Text>
        </Vidro>
      </Tocavel>
    </Animated.View>
  );
}
