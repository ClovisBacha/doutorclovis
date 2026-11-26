import * as Notifications from "expo-notifications";
import { router, Stack, useSegments, type Href } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CEUS } from "~/componentes/ceu-vivo";
import { ASSINATURA_NO_APP } from "~/config";
import { VigiaDoPlano } from "~/lib/assinatura/usar-plano";
import { ProvedorDeSessao, usePerfilConfirmado, useSessao } from "~/lib/sessao";
import { cor } from "~/tema";

void SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * A COR DA ABERTURA: o chão do céu da noite. É a cor da splash (`app.json`,
 * com a bolha feliz por cima) e da porta enquanto ela decide para onde ir —
 * a abertura vai do céu ao céu, sem clarão creme nem rosa no meio.
 * `abertura.test.ts` cobra que o `app.json` diz a mesma cor.
 */
const COR_DA_ABERTURA = CEUS.noite.chao;

/**
 * As telas que são TAREFA (começo, meio e fim) sobem de baixo e cobrem tudo,
 * como no Fitness e no Duolingo; as que são documento abrem em folha, por
 * cima de quem chamou. O que é navegação (o dia, a semana, o perfil) continua
 * entrando pela direita.
 */
const ATIVIDADE = { presentation: "fullScreenModal", animation: "slide_from_bottom" } as const;

export default function Raiz() {
  return (
    <SafeAreaProvider>
      <ProvedorDeSessao>
        <SegurarAbertura />
        <GuardaDaSessao />
        {Platform.OS !== "web" ? <ToqueNaNotificacao /> : null}
        {Platform.OS !== "web" ? <VigiaDosLembretes /> : null}
        {/* A App Store só é chamada com a assinatura ligada (`ASSINATURA_NO_APP`). */}
        {ASSINATURA_NO_APP && Platform.OS === "ios" ? <VigiaDoPlano /> : null}
        {/* A barra de status das telas claras. As que ficam sobre um céu
            escuro (as abas, a entrada, as telas da noite) põem a delas por
            cima, e ao sair esta volta sozinha. */}
        <StatusBar style="dark" />
        {/* `freezeOnBlur`: a tela que ficou embaixo da pilha não redesenha a
            cada mudança da loja ou da sessão. Ela volta a desenhar uma vez,
            já com o estado novo, quando volta à vista. (No iPhone, a tela logo
            abaixo da de cima nunca congela: é ela que aparece no gesto de
            voltar e atrás das folhas.) */}
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: cor.fundo },
            freezeOnBlur: true,
          }}
        >
          <Stack.Screen
            name="index"
            options={{ contentStyle: { backgroundColor: COR_DA_ABERTURA } }}
          />
          {/* Entrar no app é um corte suave, não um empurrão. */}
          <Stack.Screen name="(abas)" options={{ animation: "fade" }} />
          <Stack.Screen name="aceite" options={{ animation: "fade" }} />
          <Stack.Screen name="ritual" options={{ animation: "fade" }} />
          {/* A aula não fecha com um arrasto sem querer: as respostas de hoje
              estão nela. Sai pelo X. */}
          <Stack.Screen
            name="jornada/aula"
            options={{ presentation: "fullScreenModal", gestureEnabled: false }}
          />
          <Stack.Screen name="jornada/mexer" options={ATIVIDADE} />
          <Stack.Screen name="jornada/meditar" options={ATIVIDADE} />
          <Stack.Screen name="jornada/bebe" options={ATIVIDADE} />
          <Stack.Screen name="jornada/gratidao" options={ATIVIDADE} />
          <Stack.Screen name="jornada/casal" options={ATIVIDADE} />
          <Stack.Screen name="jornada/dormir" options={ATIVIDADE} />
          {/* Os documentos em folha: arrastar para baixo fecha, e quem estava
              no meio do cadastro continua com o formulário embaixo. */}
          <Stack.Screen name="termos" options={{ presentation: "modal" }} />
          <Stack.Screen name="privacidade" options={{ presentation: "modal" }} />
          <Stack.Screen
            name="perfil/editar"
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: [0.55],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen name="agenda/marcar" options={{ presentation: "modal" }} />
          {/* Folha (pageSheet), como a Central de Emergência do site: a tela
              de trás aparece escurecida em cima, e arrastar para baixo fecha. */}
          <Stack.Screen name="sos" options={{ presentation: "modal" }} />
          {/* O plano completo sobe de baixo e só sai pelos botões dele (o
              voltar e o "Agora não" levam ao destino combinado, `depois`). */}
          <Stack.Screen
            name="assinatura"
            options={{ animation: "slide_from_bottom", gestureEnabled: false }}
          />
        </Stack>
      </ProvedorDeSessao>
    </SafeAreaProvider>
  );
}

/** O teto da splash: nada de rede lenta prender o app fechado. */
const TETO_DA_SPLASH_MS = 2500;

let splashEscondida = false;
function esconderSplash() {
  if (splashEscondida) return;
  splashEscondida = true;
  SplashScreen.setOptions({ fade: true, duration: 250 });
  void SplashScreen.hideAsync().catch(() => {});
}

/**
 * A SPLASH ESPERA O APP (18/11/2026). Antes ela sumia assim que as fontes
 * ficavam prontas (e a letra é a do sistema: na hora), e o que vinha era uma
 * tela creme com "Abrindo…" embaixo da ilha até o perfil chegar da rede, e só
 * então o céu. Agora ela some quando já se sabe quem está aqui: sem conta, na
 * hora; com conta, quando o servidor respondeu sobre o perfil — enquanto isso
 * as abas já montam por trás dela com o perfil guardado no aparelho, e o Modo
 * Cuidado que vier do servidor vence antes de ela sumir. Com rede lenta, o
 * teto de 2,5 s abre o app no perfil do aparelho.
 */
function SegurarAbertura() {
  const { sessao, carregandoSessao } = useSessao();
  const confirmado = usePerfilConfirmado();
  const conhecida = !carregandoSessao && (!sessao || confirmado);
  useEffect(() => {
    const teto = setTimeout(esconderSplash, TETO_DA_SPLASH_MS);
    return () => clearTimeout(teto);
  }, []);
  useEffect(() => {
    if (conhecida) esconderSplash();
  }, [conhecida]);
  return null;
}

/**
 * Sem sessão, só a entrada, a porta, o SOS e os documentos ficam abertos. As
 * abas já se guardavam sozinhas; as telas empilhadas (bebê, perfil, jornada/*,
 * saude/*, comunidade/*, nutrição) abriam vazias — e quebradas — sem login. O
 * SOS fica fora de propósito: ele funciona sem conta e sem rede. Os Termos e a
 * Privacidade também: o cadastro pede que ela os leia ANTES de ter conta, e
 * mandá-la ao login no meio do cadastro apagava o que ela já tinha escrito.
 * E o plano completo (`/assinatura`): o funil de perguntas termina nele, antes
 * do cadastro — a compra é da conta da Apple, e não precisa da nossa.
 */
const ABERTAS = new Set(["(entrada)", "sos", "termos", "privacidade", "assinatura"]);

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

/**
 * Os lembretes da jornada são agendados com até duas semanas de antecedência,
 * com o texto do momento — o bebê, a semana nova. Se o Modo Cuidado liga (ou
 * o bebê nasce, ou ela volta para a gestação), os que já estão no iPhone
 * falariam da coisa errada: saem na hora, e a tela Hoje os refaz com o texto
 * certo na próxima abertura.
 */
function VigiaDosLembretes() {
  const { perfil } = useSessao();
  const chave = perfil ? `${perfil.care_mode === true}|${perfil.birth_date ?? ""}` : null;
  const anterior = useRef<string | null>(null);
  useEffect(() => {
    if (chave == null) return;
    if (anterior.current != null && anterior.current !== chave) {
      void import("~/lib/lembretes-da-jornada")
        .then((m) => m.cancelarLembretesDaJornada())
        .catch(() => {});
    }
    anterior.current = chave;
  }, [chave]);
  return null;
}
