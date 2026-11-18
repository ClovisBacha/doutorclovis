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
  marcarQueJaEntrou,
  TextoNoVeu,
  TituloNoVeu,
  VoltarNoVeu,
} from "~/componentes/entrada";
import { BolhaViva, Entrada } from "~/componentes/movimento";
import { supabase } from "~/servidor/supabase";
import { espaco } from "~/tema";

/**
 * Entrar com e-mail e senha (17/11/2026): o formulário que morava na folha
 * branca da primeira tela, agora sobre o céu, com o véu inteiro e os campos
 * de vidro escuro.
 */
export default function EntrarComEmail() {
  const fora = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar() {
    setErro(null);
    if (!email.trim() || !senha) {
      setErro("Preencha o e-mail e a senha.");
      return;
    }
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    setCarregando(false);
    if (error) {
      setErro(
        /confirm/i.test(error.message)
          ? "Falta confirmar o seu e-mail. Abra o link que enviamos e tente de novo."
          : "E-mail ou senha não conferem.",
      );
      return;
    }
    marcarQueJaEntrou();
    router.replace("/");
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
              <BolhaViva humor="feliz" tamanho={92} />
            </View>
            <Entrada>
              <View style={{ gap: 6, marginBottom: espaco.sm }}>
                <TituloNoVeu>Entrar com e-mail</TituloNoVeu>
                <TextoNoVeu>Use o e-mail e a senha da sua conta.</TextoNoVeu>
              </View>
            </Entrada>
            <Entrada atraso={80}>
              <View style={{ gap: espaco.md }}>
                <CampoNoVeu
                  rotulo="E-mail"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  placeholder="voce@email.com"
                />
                <CampoNoVeu
                  rotulo="Senha"
                  value={senha}
                  onChangeText={setSenha}
                  secureTextEntry
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="go"
                  placeholder="Sua senha"
                  onSubmitEditing={entrar}
                />
                {erro ? <ErroNoVeu>{erro}</ErroNoVeu> : null}
                <Botao
                  rotulo="Entrar"
                  aoTocar={entrar}
                  carregando={carregando}
                  estilo={{ minHeight: 56, marginTop: espaco.sm }}
                />
                <LinkNoVeu rotulo="Esqueci a senha" aoTocar={() => router.push("/esqueci")} />
                <TextoNoVeu centro pequeno>
                  Entrou com o Google no site? Toque em “Esqueci a senha” com o mesmo e-mail para
                  criar uma senha e entrar aqui.
                </TextoNoVeu>
              </View>
            </Entrada>
            <View style={{ flex: 1, minHeight: espaco.xl }} />
            <LinkNoVeu
              rotulo="Ainda não tenho conta"
              apagado
              aoTocar={() => router.replace("/cadastro")}
            />
          </ColunaDaEntrada>
        </ScrollView>
      </KeyboardAvoidingView>
    </FundoDaEntrada>
  );
}
