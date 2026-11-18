import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Botao } from "~/componentes/base";
import {
  CampoNoVeu,
  ColunaDaEntrada,
  ErroNoVeu,
  FundoDaEntrada,
  LinkNoVeu,
  TextoNoVeu,
  TituloNoVeu,
  VoltarNoVeu,
} from "~/componentes/entrada";
import { BolhaViva, Entrada } from "~/componentes/movimento";
import { SITE } from "~/config";
import { supabase } from "~/servidor/supabase";
import { espaco } from "~/tema";

/** "Esqueci a senha", sobre o céu e o véu (17/11/2026: sem a folha branca). */
export default function Esqueci() {
  const fora = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    setErro(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErro("Digite o e-mail da sua conta.");
    setCarregando(true);
    /* O link abre a página do site, que já sabe trocar a senha. Depois ela
       volta ao app e entra com a senha nova. */
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${SITE}/auth`,
    });
    setCarregando(false);
    if (error) return setErro("Não foi possível enviar agora. Tente de novo em instantes.");
    setEnviado(true);
  }

  return (
    <FundoDaEntrada veu="inteiro">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: fora.top + espaco.sm,
            paddingBottom: fora.bottom + espaco.xl,
            paddingHorizontal: espaco.xl,
          }}
        >
          <ColunaDaEntrada estilo={{ flex: 1 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
              }}
            >
              <VoltarNoVeu />
              <BolhaViva humor={enviado ? "comemorando" : "estudiosa"} tamanho={92} />
            </View>
            <Entrada>
              <View style={{ gap: 6, marginBottom: espaco.sm }}>
                <TituloNoVeu>{enviado ? "Confira seu e-mail" : "Criar uma senha nova"}</TituloNoVeu>
                <TextoNoVeu>
                  {enviado
                    ? `Se houver conta com ${email.trim()}, chega um link para definir a senha. Depois, volte aqui e entre.`
                    : "Digite o e-mail da sua conta. Mandamos um link para você escolher uma senha nova."}
                </TextoNoVeu>
              </View>
            </Entrada>
            {enviado ? (
              <Botao
                rotulo="Voltar para entrar"
                aoTocar={() => router.replace("/email")}
                estilo={{ minHeight: 56, marginTop: espaco.sm }}
              />
            ) : (
              <Entrada atraso={80}>
                <View style={{ gap: espaco.md }}>
                  <CampoNoVeu
                    rotulo="E-mail da conta"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="send"
                    placeholder="voce@email.com"
                    onSubmitEditing={enviar}
                  />
                  {erro ? <ErroNoVeu>{erro}</ErroNoVeu> : null}
                  <Botao
                    rotulo="Enviar link"
                    aoTocar={enviar}
                    carregando={carregando}
                    estilo={{ minHeight: 56, marginTop: espaco.sm }}
                  />
                  <LinkNoVeu rotulo="Lembrei a senha" apagado aoTocar={() => router.back()} />
                </View>
              </Entrada>
            )}
          </ColunaDaEntrada>
        </ScrollView>
      </KeyboardAvoidingView>
    </FundoDaEntrada>
  );
}
