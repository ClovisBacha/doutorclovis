import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { Botao, Campo, Cartao, Linha, T, Tela } from "~/componentes/base";
import { CaixaDeMarcar } from "~/componentes/caixa";
import { FolhaDaEntrada, FundoDaEntrada } from "~/componentes/entrada";
import { CabecalhoDaMarca } from "~/componentes/marca";
import { SITE } from "~/config";
import { metadadosDoAceite } from "~/lib/juridico/aceite";
import { TEXTO_DO_CONSENTIMENTO_DE_SAUDE } from "~/lib/juridico/textos-do-aceite";
import { supabase } from "~/servidor/supabase";
import { cor, espaco } from "~/tema";

/**
 * O cadastro pede o ACEITE de forma explícita, e não "ao criar a conta você
 * concorda": a Comunidade tem conteúdo de outras gestantes, e a Apple exige
 * (1.2) que a pessoa concorde com as regras — tolerância zero com conteúdo
 * ofensivo — ANTES de poder publicar.
 *
 * Desde a fase 4 os Termos e a Privacidade são os do APP (telas próprias,
 * `lib/juridico`), o aceite grava a VERSÃO (`metadadosDoAceite`), e o dado de
 * saúde tem a sua caixa separada e destacada (LGPD, art. 11, I).
 */
export default function Cadastro() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [aceite, setAceite] = useState(false);
  const [maior, setMaior] = useState(false);
  const [saude, setSaude] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function criar() {
    setErro(null);
    if (nome.trim().length < 2) return setErro("Como você gostaria de ser chamada?");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErro("Esse e-mail não parece completo.");
    if (senha.length < 8) return setErro("A senha precisa de pelo menos 8 caracteres.");
    if (!maior) return setErro("O app é para maiores de 18 anos.");
    if (!aceite)
      return setErro(
        "Para criar a conta, confirme que leu e concorda com os Termos e as regras da Comunidade.",
      );
    if (!saude)
      return setErro(
        "Sem guardar a datação da gestação e o cartão do SOS, o app não consegue acompanhar você. Para criar a conta, marque a última caixa.",
      );
    setCarregando(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        emailRedirectTo: `${SITE}/minha-conta`,
        data: {
          display_name: nome.trim(),
          aceite_termos_em: new Date().toISOString(),
          ...metadadosDoAceite(new Date()),
          origem: "app-ios",
        },
      },
    });
    setCarregando(false);
    if (error) {
      setErro(
        /registered|already/i.test(error.message)
          ? "Esse e-mail já tem conta. Volte e entre."
          : "Não foi possível criar a conta agora. Tente de novo.",
      );
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <FundoDaEntrada>
        <Tela bordas={["top", "bottom"]} fundo="transparent">
          <CabecalhoDaMarca compacto />
          <Cartao>
            <T tipo="subtitulo">Falta um passo</T>
            <T>
              Mandamos um link para {email.trim()}. Abra o e-mail, toque no link para confirmar e
              volte aqui para entrar.
            </T>
            <T tipo="apagado">Não chegou? Olhe a caixa de spam ou promoções.</T>
          </Cartao>
          <Botao rotulo="Já confirmei — entrar" aoTocar={() => router.replace("/entrar")} />
        </Tela>
      </FundoDaEntrada>
    );
  }

  return (
    <FundoDaEntrada>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Tela bordas={["top", "bottom"]} fundo="transparent">
          <CabecalhoDaMarca compacto subtitulo="Crie sua conta." />
          <FolhaDaEntrada estilo={{ marginTop: espaco.sm }}>
            <Campo
              rotulo="Seu nome"
              value={nome}
              onChangeText={setNome}
              autoComplete="name"
              textContentType="name"
              placeholder="Como quer ser chamada"
            />
            <Campo
              rotulo="E-mail"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />
            <Campo
              rotulo="Senha"
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              dica="Pelo menos 8 caracteres."
            />
            <CaixaDeMarcar
              marcada={maior}
              aoTocar={() => setMaior((v) => !v)}
              rotulo="Tenho 18 anos ou mais."
            />
            <CaixaDeMarcar
              marcada={aceite}
              aoTocar={() => setAceite((v) => !v)}
              rotulo="Li e concordo com os Termos de uso, a Política de privacidade e as regras da Comunidade (tolerância zero com conteúdo ofensivo ou abusivo)."
            />
            <CaixaDeMarcar
              marcada={saude}
              aoTocar={() => setSaude((v) => !v)}
              rotulo={TEXTO_DO_CONSENTIMENTO_DE_SAUDE}
              destaque
            />
            <Linha estilo={{ flexWrap: "wrap" }}>
              <Botao rotulo="Ler os Termos" tipo="texto" aoTocar={() => router.push("/termos")} />
              <Botao
                rotulo="Ler a Privacidade"
                tipo="texto"
                aoTocar={() => router.push("/privacidade")}
              />
            </Linha>
            {erro ? (
              <T tipo="apagado" cor={cor.urgente}>
                {erro}
              </T>
            ) : null}
            <Botao rotulo="Criar conta" aoTocar={criar} carregando={carregando} />
            <Botao rotulo="Já tenho conta" tipo="texto" aoTocar={() => router.back()} />
          </FolhaDaEntrada>
        </Tela>
      </KeyboardAvoidingView>
    </FundoDaEntrada>
  );
}
