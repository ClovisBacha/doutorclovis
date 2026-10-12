import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { Botao, Campo, T, Tela } from "~/componentes/base";
import {
  DivisorDaEntrada,
  FolhaDaEntrada,
  FrasesQueGiram,
  FundoDaEntrada,
} from "~/componentes/entrada";
import { CabecalhoDaMarca } from "~/componentes/marca";
import { Entrada } from "~/componentes/movimento";
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
    <FundoDaEntrada>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Tela bordas={["top", "bottom"]} fundo="transparent" estilo={{ gap: espaco.lg }}>
          <Entrada>
            <CabecalhoDaMarca subtitulo="Sua gestação, um dia de cada vez — com aulas, cuidado e outras gestantes do seu lado." />
          </Entrada>
          <Entrada atraso={120}>
            <FrasesQueGiram />
          </Entrada>
          <Entrada atraso={220}>
            <FolhaDaEntrada>
              {/* A Apple pede o botão dela com o mesmo destaque das outras
                  formas de entrar; no alto, ele é o caminho de um toque. */}
              {comApple ? (
                <>
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={raio.pilula}
                    style={{ height: 50 }}
                    onPress={apple}
                  />
                  <DivisorDaEntrada texto="ou com o seu e-mail" />
                </>
              ) : null}
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
              <Botao
                rotulo="Esqueci a senha"
                tipo="texto"
                aoTocar={() => router.push("/esqueci")}
              />
              <T tipo="apagado" centro estilo={{ fontSize: 13, lineHeight: 18 }}>
                Entrou com o Google no site? Toque em “Esqueci a senha” com o mesmo e-mail para
                criar uma senha e entrar aqui.
              </T>
            </FolhaDaEntrada>
          </Entrada>
          <Entrada atraso={320}>
            <View style={{ gap: espaco.sm }}>
              <T tipo="apagado" centro>
                Primeira vez por aqui?
              </T>
              <Botao
                rotulo="Criar minha conta"
                tipo="secundario"
                aoTocar={() => router.push("/cadastro")}
              />
            </View>
          </Entrada>
        </Tela>
      </KeyboardAvoidingView>
    </FundoDaEntrada>
  );
}
