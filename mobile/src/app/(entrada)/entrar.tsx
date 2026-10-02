import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { Botao, Campo, Cartao, T, Tela } from "~/componentes/base";
import { CabecalhoDaMarca } from "~/componentes/marca";
import { appleDisponivel, entrarComApple } from "~/lib/apple";
import { supabase } from "~/servidor/supabase";
import { cor, espaco, raio } from "~/tema";

export default function Entrar() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [comApple, setComApple] = useState(false);

  useEffect(() => {
    void appleDisponivel().then(setComApple);
  }, []);

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
    router.replace("/");
  }

  async function apple() {
    setErro(null);
    const r = await entrarComApple();
    if (r.ok) router.replace("/");
    else if (!r.cancelado) setErro(r.mensagem);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Tela bordas={["top", "bottom"]}>
        <CabecalhoDaMarca subtitulo="Sua gestação, um dia de cada vez — com aulas, cuidado e outras gestantes do seu lado." />
        <View style={{ gap: espaco.md, marginTop: espaco.lg }}>
          <Campo
            rotulo="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="voce@email.com"
          />
          <Campo
            rotulo="Senha"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            placeholder="Sua senha"
            onSubmitEditing={entrar}
          />
          {erro ? (
            <T tipo="apagado" cor={cor.urgente}>
              {erro}
            </T>
          ) : null}
          <Botao rotulo="Entrar" aoTocar={entrar} carregando={carregando} />
          {comApple ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={raio.pilula}
              style={{ height: 48 }}
              onPress={apple}
            />
          ) : null}
          <Botao rotulo="Esqueci a senha" tipo="texto" aoTocar={() => router.push("/esqueci")} />
        </View>
        <Cartao fundo={cor.apagado} estilo={{ marginTop: espaco.md }}>
          <T tipo="apagado">
            Entrou com o Google no site? Toque em "Esqueci a senha" com o mesmo e-mail para criar
            uma senha e entrar aqui.
          </T>
        </Cartao>
        <View style={{ marginTop: espaco.lg, gap: espaco.sm }}>
          <T tipo="apagado" centro>
            Primeira vez por aqui?
          </T>
          <Botao
            rotulo="Criar minha conta"
            tipo="secundario"
            aoTocar={() => router.push("/cadastro")}
          />
        </View>
      </Tela>
    </KeyboardAvoidingView>
  );
}
