import { Redirect, router, Tabs, useIsFocused } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Baby, House, MessageCircleHeart, Route, Sun, Users } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, AppState, Easing, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { contarParaOSelo } from "~/componentes/amigas/economia";
import { FolgaDaBarra, selecao, toque } from "~/componentes/base";
import { CEUS, CeuCompartilhado, CeuVivo, useFaseDoCeu } from "~/componentes/ceu-vivo";
import { useDiaDaJornada } from "~/componentes/jornada/usarJornada";
import { FundoDeLuz } from "~/componentes/luz";
import { Pulso, useMovimentoReduzido, useParalaxe } from "~/componentes/movimento";
import { Vidro } from "~/componentes/vidro";
import { api } from "~/lib/comunidade/api";
import { mudarSelos, rotuloDaAba, textoDoSelo, useSelos, zerarSelos } from "~/lib/selos";
import { useSessao } from "~/lib/sessao";
import { COMUNIDADE_NO_APP, SOS_NO_APP } from "~/config";
import { ALVO_MINIMO, cor, curva, fonte, luz, raio, vidro } from "~/tema";

/** O app abre na aba do bebê, a do meio — inclusive quando outra aba é a
 * primeira da lista (as Amigas, à esquerda). */
export const unstable_settings = { initialRouteName: "jornada" };

/**
 * A BARRA: Amigas · Bebê · Trilha (13/11/2026, decisão do dono: "o bebê é o
 * centro [...] ele realmente deve ficar no meio. O jogo deve ficar na direita
 * e a questão das amigas [...] na esquerda"). A aba do meio é a tela do bebê
 * (o céu com o bebê da semana, o acompanhamento e o cuidado do dia — a "Hoje"
 * de 19/10), e o app abre nela; a trilha do jogo fica à direita.
 *
 * No Modo Cuidado a barra não fala do bebê nem do jogo: o meio vira "Hoje"
 * (os cuidados com ela) e o "Início" (o acolhimento e a agenda) entra à
 * direita. A trilha sai, e as Amigas também (18/11/2026): no luto a aba era
 * só uma frase solta sobre o céu, uma porta para lugar nenhum. Sobrando uma
 * aba só, a barra some (`BarraDeBaixo`).
 *
 * Com as chaves de `config.ts` ligadas, voltam a aba Comunidade
 * (`COMUNIDADE_NO_APP`) e o botão do SOS no meio (`SOS_NO_APP`): o SOS não é
 * uma aba, é um botão que abre a folha de emergência por cima de qualquer
 * tela, inclusive no Modo Cuidado.
 */
export default function LayoutDasAbas() {
  const { sessao, carregandoSessao, cuidado } = useSessao();
  /* O pós-parto pela mesma régua da aba das Amigas (a da jornada), para o
     selo e a tela nunca contarem diferente. */
  const pos = useDiaDaJornada().modo === "pos";
  useSelosDaBarra(!!sessao && !cuidado, pos);
  /* A barra flutua: as telas recebem quanto ela ocupa embaixo (a estimativa
     até ela se medir) para a rolagem terminar acima do vidro. */
  const baixo = useSafeAreaInsets().bottom;
  const [folga, setFolga] = useState(() => ALTURA_DA_BARRA + distanciaDaBorda(baixo));
  if (!carregandoSessao && !sessao) return <Redirect href="/entrar" />;
  /* `freezeOnBlur`: a aba escondida (a trilha, com semanas de moedas) não
     redesenha quando ela conclui algo noutra tela; desenha uma vez ao voltar,
     já com o estado novo. Os laços dela já param fora de foco
     (`useMovimentoReduzido`), e o congelamento vem um quadro depois, quando
     eles já pararam. */
  const abas = (
    <FolgaDaBarra.Provider value={folga}>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: "transparent" },
          freezeOnBlur: true,
        }}
        tabBar={(props) => <BarraDeBaixo {...props} aoMedir={setFolga} />}
      >
        {/* As Amigas à esquerda; no Modo Cuidado elas descansam (está tudo
            guardado, e voltam quando ela desligar). */}
        <Tabs.Screen
          name="amigas"
          options={{ title: "Amigas", ...(cuidado ? { href: null } : {}) }}
        />
        {/* O bebê no meio, e o app abre nele. No Modo Cuidado a aba não fala do
            bebê: vira "Hoje", com um sol. */}
        <Tabs.Screen name="jornada" options={{ title: cuidado ? "Hoje" : "Bebê" }} />
        {/* O jogo à direita; no Modo Cuidado não há trilha nem placar. */}
        <Tabs.Screen
          name="trilha"
          options={{ title: "Trilha", ...(cuidado ? { href: null } : {}) }}
        />
        {/* O acolhimento e a agenda do Modo Cuidado; fora dele, leva à aba do bebê. */}
        <Tabs.Screen
          name="inicio"
          options={{ title: "Início", ...(cuidado ? {} : { href: null }) }}
        />
        <Tabs.Screen
          name="comunidade"
          options={{ title: "Comunidade", ...(COMUNIDADE_NO_APP ? {} : { href: null }) }}
        />
      </Tabs>
    </FolgaDaBarra.Provider>
  );
  /* Ligar ou desligar o Modo Cuidado troca o fundo inteiro, e as abas
     remontam na do meio: ela cai em "Hoje" (ou no Bebê), nunca numa aba que
     acabou de sumir. */
  return cuidado ? <LuzDasAbas>{abas}</LuzDasAbas> : <CeuDasAbas>{abas}</CeuDasAbas>;
}

/**
 * UM CÉU SÓ atrás das três abas: a aba que quer o céu fica transparente, e
 * trocar de aba é trocar o que flutua sobre o mesmo lugar. Fica num filho
 * próprio para o Modo Cuidado nem ligar o sensor da paralaxe nem animar um céu
 * que nenhuma tela dele mostra.
 */
function CeuDasAbas({ children }: { children: ReactNode }) {
  const fase = useFaseDoCeu();
  const { x, y } = useParalaxe();
  const ceuDasAbas = useMemo(() => ({ fase, x, y }), [fase, x, y]);
  return (
    <View style={{ flex: 1, backgroundColor: CEUS[fase].chao }}>
      <CeuVivo fase={fase} x={x} y={y} />
      <BarraDeStatusDoCeu claro={CEUS[fase].claro} />
      <CeuCompartilhado.Provider value={ceuDasAbas}>{children}</CeuCompartilhado.Provider>
    </View>
  );
}

/** O fundo do Modo Cuidado: a luz clara, PARADA, e nenhum céu para as abas lerem. */
function LuzDasAbas({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: luz.base }}>
      <FundoDeLuz />
      <CeuCompartilhado.Provider value={null}>{children}</CeuCompartilhado.Provider>
    </View>
  );
}

/**
 * O relógio e a bateria do iPhone pela cor do céu: escuros no amanhecer,
 * claros no azul do dia, na tarde e na noite (pretos sobre o índigo da noite
 * ficavam com 1,3:1, invisíveis). Só enquanto as abas estão à vista: a tela
 * que entra por cima (clara) volta à barra escura da raiz sozinha.
 */
function BarraDeStatusDoCeu({ claro }: { claro: boolean }) {
  const aVista = useIsFocused();
  return aVista ? <StatusBar style={claro ? "dark" : "light"} animated /> : null;
}

/** O vão entre uma aba e outra, dentro da cápsula. */
const VAO = 2;

/** A altura da cápsula de vidro da barra. */
const ALTURA_DA_BARRA = 66;

/** Da borda de baixo da tela até a cápsula: acima do traço do iPhone, como a barra do iOS 26. */
function distanciaDaBorda(baixo: number): number {
  return baixo > 0 ? Math.max(baixo - 10, 12) : 12;
}

/** De quanto em quanto tempo a barra relê os selos com o app aberto. */
const RELEITURA_MS = 3 * 60_000;

/**
 * Lê os selos ao abrir, ao voltar para o app e a cada 3 minutos com ele
 * aberto. As telas da Comunidade e das Amigas também os acertam quando leem
 * (o coração do topo, a Atividade vista, um pedido respondido). Sem sessão ou
 * no Modo Cuidado, a barra não conta nada — e não lê.
 */
function useSelosDaBarra(ligado: boolean, pos: boolean) {
  const atualizar = useCallback(async () => {
    const [atividade, amigas] = await Promise.all([
      COMUNIDADE_NO_APP ? api.minhaAtividade() : Promise.resolve(null),
      contarParaOSelo(pos),
    ]);
    mudarSelos({
      ...(atividade?.ok ? { comunidade: atividade.novas } : {}),
      ...(amigas !== null ? { amigas } : {}),
    });
  }, [pos]);
  useEffect(() => {
    if (!ligado) {
      zerarSelos();
      return;
    }
    void atualizar();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void atualizar();
    });
    const relogio = setInterval(() => {
      if (AppState.currentState === "active") void atualizar();
    }, RELEITURA_MS);
    return () => {
      sub.remove();
      clearInterval(relogio);
    };
  }, [ligado, atualizar]);
}

/* A Trilha é um caminho (Route), e não o broto: o broto é a sementinha, a
   moeda do jogo. */
const ICONES = {
  amigas: Users,
  jornada: Baby,
  trilha: Route,
  inicio: House,
  comunidade: MessageCircleHeart,
} as const;

/**
 * A BARRA DE VIDRO (16/11/2026): uma cápsula de Liquid Glass solta do rodapé,
 * como a do iOS 26 — o conteúdo rola por baixo e aparece através dela. A aba
 * escolhida ganha a "lente", uma pílula clara por baixo do ícone.
 */
function BarraDeBaixo({
  state,
  navigation,
  descriptors,
  aoMedir,
}: any & { aoMedir: (folga: number) => void }) {
  const baixo = useSafeAreaInsets().bottom;
  const distancia = distanciaDaBorda(baixo);
  const selos = useSelos();
  /* As abas escondidas por uma chave (`href: null`, que o expo-router troca
     por `tabBarItemStyle: { display: "none" }`) ficam fora da barra. */
  const rotas = (state.routes as { key: string; name: keyof typeof ICONES }[]).filter(
    (r) => descriptors[r.key]?.options?.tabBarItemStyle?.display !== "none",
  );
  /* Uma aba só não é barra: some, e a rolagem guarda só a folga do traço do
     iPhone. */
  const semBarra = rotas.length <= 1;
  useEffect(() => {
    if (semBarra) aoMedir(baixo + 16);
  }, [semBarra, baixo, aoMedir]);
  /* A LENTE: a gota clara da aba escolhida DESLIZA de uma aba para a outra,
     com mola — não pula. (Com o SOS no meio da barra as abas não têm a mesma
     largura, e a lente volta a ser o fundo de cada uma.) */
  const comLente = !SOS_NO_APP;
  const reduzido = useMovimentoReduzido();
  const qual = Math.max(
    0,
    rotas.findIndex((r) => r.key === state.routes[state.index]?.key),
  );
  const [fila, setFila] = useState(0);
  const passo = rotas.length ? (fila + VAO) / rotas.length : 0;
  const lente = useRef(new Animated.Value(qual)).current;
  useEffect(() => {
    if (reduzido) {
      lente.setValue(qual);
      return;
    }
    Animated.spring(lente, {
      toValue: qual,
      useNativeDriver: true,
      speed: 14,
      bounciness: 9,
    }).start();
  }, [qual, reduzido, lente]);
  const item = (rota: (typeof rotas)[number]) => {
    const ativo = state.routes[state.index]?.key === rota.key;
    const titulo = descriptors[rota.key]?.options?.title ?? rota.name;
    const Icone = rota.name === "jornada" && titulo === "Hoje" ? Sun : ICONES[rota.name];
    const n =
      rota.name === "comunidade" ? selos.comunidade : rota.name === "amigas" ? selos.amigas : 0;
    const selo = textoDoSelo(n);
    return (
      <Pressable
        key={rota.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: ativo }}
        accessibilityLabel={rotuloDaAba(titulo, n)}
        onPress={() => {
          /* O `tabPress` sai SEMPRE, também na aba que já está aberta: é o
             que deixa a tela rolar ao topo (ou voltar a hoje) no segundo
             toque, como em todo app do iPhone (`useScrollToTop`). */
          const evento = navigation.emit({
            type: "tabPress",
            target: rota.key,
            canPreventDefault: true,
          });
          if (ativo || evento.defaultPrevented) return;
          selecao();
          navigation.navigate(rota.name);
        }}
        onLongPress={() => navigation.emit({ type: "tabLongPress", target: rota.key })}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          minHeight: ALVO_MINIMO + 10,
          gap: 2,
          borderRadius: raio.pilula,
          ...curva,
          backgroundColor: ativo && !comLente ? vidro.lente : "transparent",
          boxShadow: ativo && !comLente ? vidro.lenteSombra : undefined,
        }}
      >
        {Icone ? (
          <View>
            <Pulso chave={ativo ? "ativo" : "inativo"}>
              <Icone
                size={24}
                color={ativo ? cor.primariaEscura : cor.textoApagado}
                strokeWidth={ativo ? 2.3 : 1.8}
              />
            </Pulso>
            {selo ? <SeloDaAba texto={selo} /> : null}
          </View>
        ) : null}
        <Text
          style={{
            ...(ativo ? fonte.forte : fonte.media),
            fontSize: 13,
            color: ativo ? cor.primariaEscura : cor.textoApagado,
          }}
        >
          {titulo}
        </Text>
      </Pressable>
    );
  };
  if (semBarra) return null;
  return (
    <View
      pointerEvents="box-none"
      onLayout={(e) => aoMedir(Math.round(e.nativeEvent.layout.height))}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 20,
        paddingBottom: distancia,
      }}
    >
      {/* Um tom de branco no vidro: o texto que passa por baixo não briga com
          os nomes das abas. */}
      <Vidro
        tinta="rgba(255,255,255,0.55)"
        estilo={{ minHeight: ALTURA_DA_BARRA, padding: 5, justifyContent: "center" }}
      >
        <View
          accessibilityRole="tablist"
          onLayout={(e) => setFila(e.nativeEvent.layout.width)}
          style={{ flexDirection: "row", alignItems: "center", gap: VAO }}
        >
          {comLente && passo > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: passo - VAO,
                borderRadius: raio.pilula,
                ...curva,
                backgroundColor: vidro.lente,
                boxShadow: vidro.lenteSombra,
                transform: [{ translateX: Animated.multiply(lente, passo) }],
              }}
            />
          ) : null}
          {rotas.slice(0, SOS_NO_APP ? 2 : rotas.length).map((r) => item(r))}
          {SOS_NO_APP ? <BotaoDoSos /> : null}
          {SOS_NO_APP ? rotas.slice(2).map((r) => item(r)) : null}
        </View>
      </Vidro>
    </View>
  );
}

/** O SOS no meio da barra (só com `SOS_NO_APP`). */
function BotaoDoSos() {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <HaloDoSos />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="SOS, emergência"
        accessibilityHint="Abre a tela de emergência: ligar 192 e avisar quem você cadastrou"
        onPress={() => {
          toque(false);
          router.push("/sos");
        }}
        style={({ pressed }) => ({
          width: 64,
          height: 64,
          marginTop: -26,
          borderRadius: 32,
          backgroundColor: pressed ? cor.urgentePressionado : cor.urgente,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 4,
          borderColor: cor.cartao,
          shadowColor: "#b91c1c",
          shadowOpacity: 0.35,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        })}
      >
        <Text
          style={{
            ...fonte.titulo,
            fontSize: 18,
            color: cor.branco,
            letterSpacing: 0.5,
          }}
        >
          SOS
        </Text>
      </Pressable>
    </View>
  );
}

/** O número em cima do ícone: o mesmo desenho do coração da Comunidade. */
function SeloDaAba({ texto }: { texto: string }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: -7,
        right: -13,
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        paddingHorizontal: 5,
        backgroundColor: cor.urgente,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: cor.cartao,
      }}
    >
      <Text style={{ ...fonte.titulo, fontSize: 13, lineHeight: 16, color: cor.branco }}>
        {texto}
      </Text>
    </View>
  );
}

/**
 * Um anel que respira em volta do SOS, devagar: diz "estou aqui" sem
 * alarmar. Some com "reduzir movimento".
 */
function HaloDoSos() {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduzido) return;
    const laco = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 2200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(1400),
      ]),
    );
    laco.start();
    return () => laco.stop();
  }, [reduzido, v]);
  if (reduzido) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: -26,
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: cor.urgente,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
      }}
    />
  );
}
