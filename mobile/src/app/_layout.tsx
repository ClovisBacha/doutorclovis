import {
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/nunito";
import { router, Stack, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ProvedorDeSessao, useSessao } from "~/lib/sessao";
import { cor } from "~/tema";

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Raiz() {
  const [fontesProntas, erroFonte] = useFonts({
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  /* Fonte que falhou não pode prender a splash para sempre: o app abre com a
     letra do sistema. */
  const pronto = fontesProntas || !!erroFonte;
  useEffect(() => {
    if (pronto) void SplashScreen.hideAsync().catch(() => {});
  }, [pronto]);
  if (!pronto) return null;

  return (
    <SafeAreaProvider>
      <ProvedorDeSessao>
        <GuardaDaSessao />
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cor.fundo } }}>
          <Stack.Screen
            name="sos"
            options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
          />
        </Stack>
      </ProvedorDeSessao>
    </SafeAreaProvider>
  );
}

/**
 * Sem sessão, só a entrada, a porta e o SOS ficam abertos. As abas já se
 * guardavam sozinhas; as telas empilhadas (bebê, perfil, jornada/*, saude/*,
 * comunidade/*, nutrição) abriam vazias — e quebradas — sem login. O SOS fica
 * fora de propósito: ele funciona sem conta e sem rede.
 */
const ABERTAS = new Set(["(entrada)", "sos"]);

function GuardaDaSessao() {
  const { sessao, carregandoSessao } = useSessao();
  const segmentos = useSegments();
  const primeiro = segmentos[0] as string | undefined;
  useEffect(() => {
    if (carregandoSessao || sessao) return;
    if (!primeiro || ABERTAS.has(primeiro)) return;
    router.replace("/entrar");
  }, [carregandoSessao, sessao, primeiro]);
  return null;
}
