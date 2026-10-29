import { Redirect, router, Tabs } from "expo-router";
import { Baby, House, MessageCircleHeart, Sun, Users } from "lucide-react-native";
import { useCallback, useEffect, useRef } from "react";
import { Animated, AppState, Easing, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { contarParaOSelo } from "~/componentes/amigas/economia";
import { toque } from "~/componentes/base";
import { useDiaDaJornada } from "~/componentes/jornada/usarJornada";
import { Pulso, useMovimentoReduzido } from "~/componentes/movimento";
import { api } from "~/lib/comunidade/api";
import { mudarSelos, rotuloDaAba, textoDoSelo, useSelos, zerarSelos } from "~/lib/selos";
import { useSessao } from "~/lib/sessao";
import { ALVO_MINIMO, cor, fonte } from "~/tema";

/**
 * A BARRA: Hoje · Comunidade · SOS · Amigas · Bebê (21/10/2026, decisão do
 * dono: o app é rede social + gamificação). O cuidado do dia abre o app; as
 * duas abas da rede ficam uma de cada lado do SOS; o bebê, na ponta.
 *
 * A aba Saúde saiu: depois da fase 1 ela só guardava os Movimentos do bebê
 * (que moram no Bebê) e a agenda (que mora no Hoje e no Bebê).
 *
 * O SOS não é uma aba: é um botão que abre a folha de emergência por cima de
 * qualquer tela, em qualquer estado — inclusive no Modo Cuidado, porque quem
 * perdeu a gestação continua podendo passar mal.
 */
export default function LayoutDasAbas() {
  const { sessao, carregandoSessao, cuidado } = useSessao();
  /* O pós-parto pela mesma régua da aba das Amigas (a da jornada), para o
     selo e a tela nunca contarem diferente. */
  const pos = useDiaDaJornada().modo === "pos";
  useSelosDaBarra(!!sessao && !cuidado, pos);
  if (!carregandoSessao && !sessao) return <Redirect href="/entrar" />;
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: cor.fundo } }}
      tabBar={(props) => <BarraDeBaixo {...props} />}
    >
      {/* "Hoje": o cuidado do dia é a porta do app (a trilha abre dali). */}
      <Tabs.Screen name="jornada" options={{ title: "Hoje" }} />
      <Tabs.Screen name="comunidade" options={{ title: "Comunidade" }} />
      <Tabs.Screen name="amigas" options={{ title: "Amigas" }} />
      {/* No Modo Cuidado a aba não fala do bebê: vira "Início", com uma casa. */}
      <Tabs.Screen name="inicio" options={{ title: cuidado ? "Início" : "Bebê" }} />
    </Tabs>
  );
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
    const [atividade, amigas] = await Promise.all([api.minhaAtividade(), contarParaOSelo(pos)]);
    mudarSelos({
      ...(atividade.ok ? { comunidade: atividade.novas } : {}),
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

const ICONES = {
  jornada: Sun,
  comunidade: MessageCircleHeart,
  amigas: Users,
  inicio: Baby,
} as const;

function BarraDeBaixo({ state, navigation, descriptors }: any) {
  const baixo = useSafeAreaInsets().bottom;
  const selos = useSelos();
  const rotas = state.routes as { key: string; name: keyof typeof ICONES }[];
  const item = (rota: (typeof rotas)[number], i: number) => {
    const ativo = state.index === i;
    const titulo = descriptors[rota.key]?.options?.title ?? rota.name;
    const Icone = rota.name === "inicio" && titulo === "Início" ? House : ICONES[rota.name];
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
          toque();
          navigation.navigate(rota.name);
        }}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          minHeight: ALVO_MINIMO + 8,
          gap: 2,
        }}
      >
        {Icone ? (
          <View>
            <Pulso chave={ativo ? "ativo" : "inativo"}>
              <Icone
                size={26}
                color={ativo ? cor.primaria : cor.textoApagado}
                strokeWidth={ativo ? 2.4 : 1.8}
              />
            </Pulso>
            {selo ? <SeloDaAba texto={selo} /> : null}
          </View>
        ) : null}
        <Text
          style={{
            fontFamily: ativo ? fonte.forte : fonte.media,
            fontSize: 13,
            color: ativo ? cor.primaria : cor.textoApagado,
          }}
        >
          {titulo}
        </Text>
      </Pressable>
    );
  };
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: cor.cartao,
        borderTopWidth: 1,
        borderTopColor: cor.borda,
        paddingBottom: Math.max(baixo, 8),
        paddingTop: 6,
        paddingHorizontal: 4,
      }}
    >
      {rotas.slice(0, 2).map((r, i) => item(r, i))}
      <View style={{ flex: 1, alignItems: "center" }}>
        <HaloDoSos />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="SOS — emergência"
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
              fontFamily: fonte.titulo,
              fontSize: 18,
              color: cor.branco,
              letterSpacing: 0.5,
            }}
          >
            SOS
          </Text>
        </Pressable>
      </View>
      {rotas.slice(2, 4).map((r, i) => item(r, i + 2))}
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
      <Text style={{ fontFamily: fonte.titulo, fontSize: 13, lineHeight: 16, color: cor.branco }}>
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
