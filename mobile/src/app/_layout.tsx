import {
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/nunito";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ProvedorDeSessao } from "~/lib/sessao";
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
