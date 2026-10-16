import {
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/nunito";
import * as Notifications from "expo-notifications";
import { router, Stack, useSegments, type Href } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
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
        {Platform.OS !== "web" ? <ToqueNaNotificacao /> : null}
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cor.fundo } }}>
          {/* Folha (pageSheet), como a Central de Emergência do site: a tela
              de trás aparece escurecida em cima, e arrastar para baixo fecha. */}
          <Stack.Screen name="sos" options={{ presentation: "modal" }} />
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

/**
 * Tocar numa notificação do app (o lembrete da meditação) abre a tela dela —
 * também com o app fechado, que é o caso comum às nove da noite.
 */
function ToqueNaNotificacao() {
  const resposta = Notifications.useLastNotificationResponse();
  const { sessao } = useSessao();
  const tratada = useRef<string | null>(null);
  useEffect(() => {
    if (!resposta || !sessao) return;
    const id = resposta.notification.request.identifier;
    if (tratada.current === id) return;
    tratada.current = id;
    const rota = resposta.notification.request.content.data?.rota;
    if (typeof rota === "string" && rota.startsWith("/")) router.push(rota as Href);
  }, [resposta, sessao]);
  return null;
}
