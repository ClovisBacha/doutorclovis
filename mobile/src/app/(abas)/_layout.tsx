import { Redirect, router, Tabs } from "expo-router";
import { Baby, Gamepad2, HeartPulse, Users } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toque } from "~/componentes/base";
import { useSessao } from "~/lib/sessao";
import { ALVO_MINIMO, cor, fonte } from "~/tema";

/**
 * Quatro destinos e o SOS no meio. O SOS não é uma aba: é um botão que abre a
 * folha de emergência por cima de qualquer tela, em qualquer estado — inclusive
 * no Modo Cuidado, porque quem perdeu a gestação continua podendo passar mal.
 */
export default function LayoutDasAbas() {
  const { sessao, carregandoSessao } = useSessao();
  if (!carregandoSessao && !sessao) return <Redirect href="/entrar" />;
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: cor.fundo } }}
      tabBar={(props) => <BarraDeBaixo {...props} />}
    >
      <Tabs.Screen name="inicio" options={{ title: "Bebê" }} />
      <Tabs.Screen name="jornada" options={{ title: "Jornada" }} />
      <Tabs.Screen name="comunidade" options={{ title: "Comunidade" }} />
      <Tabs.Screen name="saude" options={{ title: "Saúde" }} />
    </Tabs>
  );
}

const ICONES = { inicio: Baby, jornada: Gamepad2, comunidade: Users, saude: HeartPulse } as const;

function BarraDeBaixo({ state, navigation, descriptors }: any) {
  const baixo = useSafeAreaInsets().bottom;
  const rotas = state.routes as { key: string; name: keyof typeof ICONES }[];
  const item = (rota: (typeof rotas)[number], i: number) => {
    const ativo = state.index === i;
    const Icone = ICONES[rota.name];
    const titulo = descriptors[rota.key]?.options?.title ?? rota.name;
    return (
      <Pressable
        key={rota.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: ativo }}
        accessibilityLabel={titulo}
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
          <Icone
            size={26}
            color={ativo ? cor.primaria : cor.textoApagado}
            strokeWidth={ativo ? 2.4 : 1.8}
          />
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="SOS — emergência"
          accessibilityHint="Abre o 192 e avisa o seu contato de emergência"
          onPress={() => {
            toque(false);
            router.push("/sos");
          }}
          style={({ pressed }) => ({
            width: 64,
            height: 64,
            marginTop: -26,
            borderRadius: 32,
            backgroundColor: pressed ? "#991b1b" : cor.urgente,
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
