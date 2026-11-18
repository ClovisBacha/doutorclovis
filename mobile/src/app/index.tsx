import { Redirect, router } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Botao, NaoConsegueLer, Tela } from "~/componentes/base";
import { CEUS } from "~/componentes/ceu-vivo";
import { ehBancada } from "~/lib/bancada";
import { precisaAceitar, VERSAO_DOS_TERMOS } from "~/lib/juridico/aceite";
import { aceitouNestaSessao } from "~/lib/juridico/aceite-da-sessao";
import { useSessao } from "~/lib/sessao";
import { SOS_NO_APP } from "~/config";
import { escala, fonte } from "~/tema";

/** A porta do app: decide para onde cada estado vai, num lugar só. */
export default function Porta() {
  const { sessao, carregandoSessao, perfil, estadoDoPerfil, recarregarPerfil } = useSessao();
  if (carregandoSessao) return <Abrindo />;
  if (!sessao) return <Redirect href="/entrar" />;
  /* Os Termos e a Privacidade do app, na versão em vigor (fase 4): quem entrou
     pela Apple, quem aceitou os do site e todas, quando a versão muda. */
  if (
    !ehBancada() &&
    precisaAceitar(sessao.user.user_metadata) &&
    !aceitouNestaSessao(VERSAO_DOS_TERMOS)
  )
    return <Redirect href="/aceite" />;
  if (estadoDoPerfil === "carregando") return <Abrindo />;
  if (estadoDoPerfil === "falhou")
    return (
      <Tela>
        <NaoConsegueLer
          sossego={
            SOS_NO_APP
              ? "Os seus dados continuam guardados. O SOS funciona sem internet."
              : "Os seus dados continuam guardados."
          }
          aoTentar={() => void recarregarPerfil()}
        />
        {SOS_NO_APP ? (
          <Botao rotulo="Abrir o SOS" tipo="perigo" aoTocar={() => router.push("/sos")} />
        ) : null}
      </Tela>
    );
  /* Sem perfil, ou sem nenhuma âncora da gestação (e sem parto), o ritual
     de boas-vindas pede o que falta. */
  const temAncora = !!(perfil?.lmp_date || perfil?.reference_date || perfil?.birth_date);
  if (!perfil || !temAncora) return <Redirect href="/ritual" />;
  /* O app abre na tela do bebê, a aba do meio (decisão do dono, 13/11/2026:
     "quando o aplicativo abrir, deve estar naquela aba"). */
  return <Redirect href="/jornada" />;
}

/**
 * Enquanto a porta decide (a rede lenta passou do teto da splash, ou ela
 * acabou de entrar e o perfil ainda vem): a mesma cor da splash, com o
 * indicador no meio da tela — nunca uma folha clara com um spinner embaixo
 * da ilha do iPhone.
 */
function Abrindo() {
  return (
    <View style={{ flex: 1, backgroundColor: CEUS.noite.chao }}>
      <SafeAreaView
        style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Abrindo o app"
      >
        <ActivityIndicator color={CEUS.noite.tinta} />
        <Text style={{ ...fonte.media, ...escala.legenda, color: CEUS.noite.sec }}>Abrindo…</Text>
      </SafeAreaView>
    </View>
  );
}
