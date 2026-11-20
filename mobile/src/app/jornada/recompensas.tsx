import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CantinhoItem } from "@/lib/cantinho";
import { useAviso } from "~/componentes/aviso";
import { selecao, toque, useFimDaRolagem } from "~/componentes/base";
import { CabecalhoDaPilha, voltarOu } from "~/componentes/cabecalho";
import { rota } from "~/componentes/jornada/bancada";
import {
  lerCarteiraDoDia,
  lerConquistas,
  resgatar as resgatarNoServidor,
  type LeituraDasConquistas,
} from "~/componentes/jornada/economia";
import { Confete } from "~/componentes/jornada/pecas";
import { FundoDeLuz } from "~/componentes/luz";
import { useMolaDeToque, useMovimentoReduzido } from "~/componentes/movimento";
import { AbaDoCantinho, useLeituraDoCantinho } from "~/componentes/recompensas/cantinho";
import { AbaDasConquistas } from "~/componentes/recompensas/conquistas";
import { Broto, SeloDeContagem } from "~/componentes/recompensas/pecas";
import { montarGrade, paraResgatar } from "~/lib/jornada/conquistas";
import { useSessao } from "~/lib/sessao";
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
  vidro,
} from "~/tema";

type Aba = "cantinho" | "conquistas";
const ABAS: readonly Aba[] = ["cantinho", "conquistas"];

/**
 * AS RECOMPENSAS — o `RecompensasHub` do site: duas abas, "Meu Cantinho" (a
 * lojinha de sementinhas: enfeites, peles das bolinhas e cenários para a
 * trilha) e "Conquistas" (as medalhas, com o número das que esperam o toque
 * dela ao lado do nome). Abre no Cantinho, como no site; `?aba=conquistas`
 * abre direto nas conquistas.
 *
 * Desenho (18/11/2026, a vistoria): a luz do app atrás de tudo (antes, um
 * fundo chapado), o controle segmentado do iOS no lugar de duas pílulas
 * soltas, e o saldo numa pílula só no alto (antes, um cartão-herói em cada
 * aba, repetindo o número). A pílula abre o "Ganhe mais".
 *
 * ⚠️ DESEMPENHO: as duas abas ficam MONTADAS, lado a lado numa rolagem
 * horizontal por páginas (dá para deslizar entre elas, como no iOS), cada uma
 * com a sua rolagem. Antes um ternário desmontava a outra a cada toque: o
 * Cantinho relia o servidor, o esqueleto piscava e a grade inteira nascia de
 * novo. A leitura do Cantinho mora aqui (`useLeituraDoCantinho`).
 *
 * ⚠️ O SALDO TEM UM DONO SÓ: esta tela. Resgatar uma conquista sobe o número
 * que o Cantinho mostra, e comprar no Cantinho desce o das Conquistas — duas
 * abas com dois saldos discordariam na frente dela.
 */
export default function Recompensas() {
  const { aba: pedida } = useLocalSearchParams<{ aba?: string }>();
  const inicial: Aba = pedida === "conquistas" ? "conquistas" : "cantinho";
  const [aba, setAba] = useState<Aba>(inicial);
  const abaAgora = useRef(aba);
  abaAgora.current = aba;
  const { cuidado } = useSessao();
  const { avisar, aviso } = useAviso();
  const { width: largura, height: altura } = useWindowDimensions();
  const fim = useFimDaRolagem(64);

  /* `null` = ainda não sei (ou não consegui ler): a tela mostra "—", nunca 0. */
  const [saldo, setSaldo] = useState<number | null>(null);
  const [conquistas, setConquistas] = useState<LeituraDasConquistas | null | "carregando">(
    "carregando",
  );
  const [ganheAberto, setGanheAberto] = useState(false);
  const [festa, setFesta] = useState(0);
  const listaDoCantinho = useRef<FlatList<CantinhoItem> | null>(null);

  const recarregar = useCallback(() => {
    setConquistas((c) => (c && c !== "carregando" ? c : "carregando"));
    /* A carteira credita o check-in do dia: é a leitura mais nova do saldo, e
       por isso ela vence a do Cantinho. */
    void lerCarteiraDoDia().then((c) => {
      if (c && !c.careMode) setSaldo(c.balance);
    });
    void lerConquistas().then(setConquistas);
  }, []);
  useFocusEffect(
    useCallback(() => {
      recarregar();
    }, [recarregar]),
  );
  /* A leitura do Cantinho só preenche o saldo que a carteira ainda não trouxe. */
  const aoLerSaldo = useCallback((n: number) => setSaldo((s) => s ?? n), []);
  const cantinho = useLeituraDoCantinho(aoLerSaldo);
  const aoFesta = useCallback(() => setFesta((n) => n + 1), []);

  const aResgatar = useMemo(() => {
    if (!conquistas || conquistas === "carregando" || conquistas.careMode || cuidado) return null;
    if (conquistas.resgatadas === null) return null;
    const n = paraResgatar(montarGrade(conquistas.unlocked, conquistas.resgatadas));
    return n > 0 ? n : null;
  }, [conquistas, cuidado]);

  async function resgatar(key: string) {
    const r = await resgatarNoServidor(key);
    if (r) {
      /* Sobre o estado MAIS NOVO, e não o do toque: duas conquistas
         resgatadas em seguida não podem desfazer a primeira. */
      setConquistas((c) =>
        c && c !== "carregando"
          ? { ...c, resgatadas: Array.from(new Set([...(c.resgatadas ?? []), key])) }
          : c,
      );
      if (r.granted > 0) setSaldo((s) => (s == null ? s : s + r.granted));
    }
    return r;
  }

  /* ── As páginas: o segmentado e a rolagem horizontal andam juntos ── */
  const paginas = useRef<ScrollView>(null);
  /* Para onde um toque no segmentado mandou a rolagem: enquanto ela anda, as
     páginas do meio do caminho não mudam a aba de volta. */
  const indoPara = useRef<number | null>(null);
  const irPara = useCallback(
    (a: Aba, animado = true) => {
      const i = ABAS.indexOf(a);
      indoPara.current = animado ? i : null;
      setAba(a);
      paginas.current?.scrollTo({ x: i * largura, animated: animado });
    },
    [largura],
  );
  /* A primeira posição (e a de depois de girar a tela) sem animação. */
  const posicionou = useRef(false);
  const aoMedirPaginas = useCallback(() => {
    if (posicionou.current) return;
    posicionou.current = true;
    if (inicial !== "cantinho") irPara(inicial, false);
  }, [inicial, irPara]);
  useEffect(() => {
    paginas.current?.scrollTo({ x: ABAS.indexOf(aba) * largura, animated: false });
    // Só quando a largura muda (girar o aparelho); a aba já move a rolagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [largura]);
  const aoRolarPaginas = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, largura));
      if (indoPara.current != null) {
        if (i === indoPara.current) indoPara.current = null;
        return;
      }
      const a = ABAS[Math.min(ABAS.length - 1, Math.max(0, i))]!;
      if (abaAgora.current === a) return;
      selecao();
      setAba(a);
    },
    [largura],
  );

  /* A pílula do saldo: leva ao Cantinho, abre o "Ganhe mais" e rola até ele. */
  const abrirGanheMais = useCallback(() => {
    irPara("cantinho");
    setGanheAberto(true);
    setTimeout(() => listaDoCantinho.current?.scrollToEnd({ animated: true }), 350);
  }, [irPara]);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: luz.base }}>
      <FundoDeLuz />
      <View style={{ paddingHorizontal: margem.tela, paddingTop: espaco.sm, gap: espaco.md }}>
        <CabecalhoDaPilha
          titulo="Recompensas"
          voltarPara="/jornada"
          direita={cuidado ? null : <PilulaDoSaldo saldo={saldo} aoTocar={abrirGanheMais} />}
        />
        <Segmentos
          aba={aba}
          aoEscolher={(a) => {
            if (a === aba) return;
            selecao();
            irPara(a);
          }}
          selo={aResgatar}
        />
      </View>
      <ScrollView
        ref={paginas}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={aoRolarPaginas}
        scrollEventThrottle={32}
        onLayout={aoMedirPaginas}
        contentOffset={{ x: ABAS.indexOf(inicial) * largura, y: 0 }}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, marginTop: espaco.sm }}
      >
        <View style={{ width: largura, flex: 1 }}>
          <AbaDoCantinho
            cantinho={cantinho}
            saldo={saldo}
            cuidado={cuidado}
            aoMudarSaldo={setSaldo}
            aoVerTrilha={() => voltarOu(rota("/jornada") as never)}
            avisar={avisar}
            ganheAberto={ganheAberto}
            aoAlternarGanhe={() => setGanheAberto((v) => !v)}
            aoFesta={aoFesta}
            refDaLista={listaDoCantinho}
            largura={largura}
            fim={fim}
          />
        </View>
        <ScrollView
          style={{ width: largura }}
          contentContainerStyle={{ padding: margem.tela, paddingBottom: fim }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <AbaDasConquistas
            leitura={conquistas}
            cuidado={cuidado}
            ativa={aba === "conquistas"}
            resgatar={resgatar}
            recarregar={recarregar}
            aoFesta={aoFesta}
            avisar={avisar}
          />
        </ScrollView>
      </ScrollView>
      {/* A festa da compra (e das conquistas novas): por cima de tudo, fora
          da rolagem — quem comprou lá embaixo também vê. */}
      {festa > 0 ? <Confete key={festa} pecas={40} altura={altura} /> : null}
      {aviso}
    </SafeAreaView>
  );
}

/**
 * O SALDO: uma pílula só, no alto (como o placar da trilha). O toque abre o
 * "Ganhe mais" — é onde ela toca querendo saber como se ganha.
 */
function PilulaDoSaldo({ saldo, aoTocar }: { saldo: number | null; aoTocar: () => void }) {
  const mola = useMolaDeToque(0.95);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        saldo == null ? "Ver como ganhar sementinhas" : `${saldo} sementinhas. Ver como ganhar mais`
      }
      onPressIn={mola.aoPressionar}
      onPressOut={mola.aoSoltar}
      onPress={() => {
        toque();
        aoTocar();
      }}
    >
      <Animated.View
        style={{
          minHeight: ALVO_MINIMO,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          borderRadius: canto.pilula,
          ...curva,
          paddingHorizontal: espaco.md + 2,
          backgroundColor: cor.sementinhaFundo,
          transform: [{ scale: mola.escala }],
        }}
      >
        <Broto tamanho={18} />
        <Text
          style={{
            ...fonteDoNumero,
            ...escala.manchete,
            color: cor.sementinha,
            fontVariant: ["tabular-nums"],
          }}
        >
          {saldo ?? "—"}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * O CONTROLE SEGMENTADO do iOS: o trilho na névoa, uma lente branca que
 * desliza com mola (no fio nativo) até a parte escolhida, e o selo framboesa
 * com o número de conquistas para resgatar.
 */
function Segmentos({
  aba,
  aoEscolher,
  selo,
}: {
  aba: Aba;
  aoEscolher: (a: Aba) => void;
  selo: number | null;
}) {
  const [largura, setLargura] = useState(0);
  const reduzido = useMovimentoReduzido();
  const x = useRef(new Animated.Value(0)).current;
  const larguraDaLente = largura > 0 ? (largura - 6) / ABAS.length : 0;
  useEffect(() => {
    const alvo = ABAS.indexOf(aba) * larguraDaLente;
    if (reduzido || larguraDaLente === 0) {
      x.setValue(alvo);
      return;
    }
    const a = Animated.spring(x, {
      toValue: alvo,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    });
    a.start();
    return () => a.stop();
  }, [aba, larguraDaLente, reduzido, x]);
  const rotulos: Record<Aba, string> = { cantinho: "Meu Cantinho", conquistas: "Conquistas" };
  return (
    <View
      accessibilityRole="tablist"
      onLayout={(e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width)}
      style={{
        height: ALVO_MINIMO,
        flexDirection: "row",
        padding: 3,
        borderRadius: canto.pilula,
        ...curva,
        backgroundColor: cor.apagado,
      }}
    >
      {larguraDaLente > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 3,
            bottom: 3,
            left: 3,
            width: larguraDaLente,
            borderRadius: canto.pilula,
            ...curva,
            backgroundColor: vidro.lente,
            boxShadow: vidro.lenteSombra,
            transform: [{ translateX: x }],
          }}
        />
      ) : null}
      {ABAS.map((a) => {
        const ativa = a === aba;
        const n = a === "conquistas" ? selo : null;
        return (
          <Pressable
            key={a}
            accessibilityRole="tab"
            accessibilityState={{ selected: ativa }}
            accessibilityLabel={n ? `${rotulos[a]}, ${n} para resgatar` : rotulos[a]}
            onPress={() => aoEscolher(a)}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                ...fonte.forte,
                ...escala.legenda,
                color: ativa ? cor.texto : cor.textoApagado,
              }}
            >
              {rotulos[a]}
            </Text>
            {n ? <SeloDeContagem n={n} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
