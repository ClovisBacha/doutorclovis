import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import { Botao, Campo, Cartao, Linha, T, Tela, toque } from "~/componentes/base";
import { FolhaDaEntrada, FundoDaEntrada } from "~/componentes/entrada";
import { CabecalhoDaMarca } from "~/componentes/marca";
import { SITE } from "~/config";
import { abrir, PRIVACIDADE, TERMOS } from "~/lib/links";
import { supabase } from "~/servidor/supabase";
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

/**
 * O cadastro pede o ACEITE de forma explícita, e não "ao criar a conta você
 * concorda": a Comunidade tem conteúdo de outras gestantes, e a Apple exige
 * (1.2) que a pessoa concorde com as regras — tolerância zero com conteúdo
 * ofensivo — ANTES de poder publicar.
 */
export default function Cadastro() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [aceite, setAceite] = useState(false);
  const [maior, setMaior] = useState(false);
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
    setCarregando(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        emailRedirectTo: `${SITE}/minha-conta`,
        data: {
          display_name: nome.trim(),
          aceite_termos_em: new Date().toISOString(),
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
            <Caixa
              marcada={maior}
              aoTocar={() => setMaior((v) => !v)}
              rotulo="Tenho 18 anos ou mais."
            />
            <Caixa
              marcada={aceite}
              aoTocar={() => setAceite((v) => !v)}
              rotulo="Li e concordo com os Termos de uso, a Política de privacidade e as regras da Comunidade (tolerância zero com conteúdo ofensivo ou abusivo)."
            />
            <Linha estilo={{ flexWrap: "wrap" }}>
              <Botao rotulo="Ler os Termos" tipo="texto" aoTocar={() => abrir(TERMOS)} />
              <Botao rotulo="Ler a Privacidade" tipo="texto" aoTocar={() => abrir(PRIVACIDADE)} />
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

function Caixa({
  marcada,
  aoTocar,
  rotulo,
}: {
  marcada: boolean;
  aoTocar: () => void;
  rotulo: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada }}
      accessibilityLabel={rotulo}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={{
        flexDirection: "row",
        gap: espaco.md,
        alignItems: "flex-start",
        minHeight: ALVO_MINIMO,
        paddingVertical: 4,
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: raio.sm,
          borderWidth: 2,
          borderColor: marcada ? cor.primaria : cor.primariaSuave,
          backgroundColor: marcada ? cor.primaria : cor.cartao,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 2,
        }}
      >
        {marcada ? (
          <T estilo={{ color: cor.branco, fontFamily: fonte.titulo, fontSize: 15, lineHeight: 18 }}>
            ✓
          </T>
        ) : null}
      </View>
      <T estilo={{ flex: 1, fontSize: 15, lineHeight: 22 }}>{rotulo}</T>
    </Pressable>
  );
}
