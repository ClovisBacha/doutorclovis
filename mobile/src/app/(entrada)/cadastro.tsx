import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Botao } from "~/componentes/base";
import { CaixaDeMarcar } from "~/componentes/caixa";
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
import { metadadosDoAceite } from "~/lib/juridico/aceite";
import { TEXTO_DO_CONSENTIMENTO_DE_SAUDE, TEXTO_DOS_TERMOS } from "~/lib/juridico/textos-do-aceite";
import { supabase } from "~/servidor/supabase";
import { espaco } from "~/tema";

/**
 * O cadastro pede o ACEITE de forma explícita, e não "ao criar a conta você
 * concorda": a Apple exige (1.2) que a pessoa concorde com as regras ANTES de
 * poder publicar, e o dado de saúde tem a sua caixa separada e destacada
 * (LGPD, art. 11, I).
 *
 * Desde a fase 4 os Termos e a Privacidade são os do APP (telas próprias,
 * `lib/juridico`), e o aceite grava a VERSÃO (`metadadosDoAceite`).
 *
 * 17/11/2026: sem a folha branca — sobre o céu, com o véu inteiro e os
 * campos de vidro escuro (o dono: "esse fundo branco aí no cadastro do
 * e-mail [...] não gosto disso").
 */
export default function Cadastro() {
  const fora = useSafeAreaInsets();
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
        "Para criar a conta, confirme que leu e concorda com os Termos e a Política de privacidade.",
      );
    if (!saude)
      return setErro(
        "Sem guardar a datação da gestação, o app não consegue montar a sua trilha. Para criar a conta, marque a última caixa.",
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

  const rolagem = {
    flexGrow: 1,
    paddingTop: fora.top + espaco.sm,
    paddingBottom: fora.bottom + espaco.xl,
    paddingHorizontal: espaco.xl,
  } as const;

  if (enviado) {
    return (
      <FundoDaEntrada veu="inteiro">
        <ScrollView contentContainerStyle={rolagem}>
          <ColunaDaEntrada estilo={{ flex: 1, justifyContent: "center", gap: espaco.lg }}>
            <View style={{ alignItems: "center" }}>
              <BolhaViva humor="comemorando" tamanho={150} />
            </View>
            <TituloNoVeu centro>Falta um passo</TituloNoVeu>
            <TextoNoVeu centro>
              Mandamos um link para {email.trim()}. Abra o e-mail, toque no link para confirmar e
              volte aqui para entrar.
            </TextoNoVeu>
            <TextoNoVeu centro pequeno>
              Não chegou? Olhe a caixa de spam ou promoções.
            </TextoNoVeu>
            <Botao
              rotulo="Já confirmei — entrar"
              aoTocar={() => router.replace("/email")}
              estilo={{ minHeight: 56, marginTop: espaco.sm }}
            />
          </ColunaDaEntrada>
        </ScrollView>
      </FundoDaEntrada>
    );
  }

  return (
    <FundoDaEntrada veu="inteiro">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={rolagem}>
          <ColunaDaEntrada>
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
                <TituloNoVeu>Criar sua conta</TituloNoVeu>
                <TextoNoVeu>Leva um minuto. Depois, a gente monta a sua trilha.</TextoNoVeu>
              </View>
            </Entrada>
            <Entrada atraso={80}>
              <View style={{ gap: espaco.md }}>
                <CampoNoVeu
                  rotulo="Seu nome"
                  value={nome}
                  onChangeText={setNome}
                  autoComplete="name"
                  textContentType="name"
                  placeholder="Como quer ser chamada"
                />
                <CampoNoVeu
                  rotulo="E-mail"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  placeholder="voce@email.com"
                />
                <CampoNoVeu
                  rotulo="Senha"
                  value={senha}
                  onChangeText={setSenha}
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  dica="Pelo menos 8 caracteres."
                />
                <View style={{ gap: espaco.sm, marginTop: espaco.sm }}>
                  <CaixaDeMarcar
                    noVeu
                    marcada={maior}
                    aoTocar={() => setMaior((v) => !v)}
                    rotulo="Tenho 18 anos ou mais."
                  />
                  <CaixaDeMarcar
                    noVeu
                    marcada={aceite}
                    aoTocar={() => setAceite((v) => !v)}
                    rotulo={TEXTO_DOS_TERMOS}
                  />
                  <CaixaDeMarcar
                    noVeu
                    marcada={saude}
                    aoTocar={() => setSaude((v) => !v)}
                    rotulo={TEXTO_DO_CONSENTIMENTO_DE_SAUDE}
                    destaque
                  />
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center" }}>
                  <LinkNoVeu rotulo="Ler os Termos" aoTocar={() => router.push("/termos")} />
                  <LinkNoVeu
                    rotulo="Ler a Privacidade"
                    aoTocar={() => router.push("/privacidade")}
                  />
                </View>
                {erro ? <ErroNoVeu>{erro}</ErroNoVeu> : null}
                <Botao
                  rotulo="Criar conta"
                  aoTocar={criar}
                  carregando={carregando}
                  estilo={{ minHeight: 56 }}
                />
                <LinkNoVeu
                  rotulo="Já tenho conta"
                  apagado
                  aoTocar={() => router.replace("/email")}
                />
              </View>
            </Entrada>
          </ColunaDaEntrada>
        </ScrollView>
      </KeyboardAvoidingView>
    </FundoDaEntrada>
  );
}
