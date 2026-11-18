import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { View, type TextInput } from "react-native";
import { Botao, sucesso } from "~/componentes/base";
import {
  CampoNoVeu,
  FundoDaEntrada,
  LinkNoVeu,
  marcarQueJaEntrou,
  MolduraDoPasso,
  TextoNoVeu,
  TituloNoVeu,
  TopoDoPasso,
} from "~/componentes/entrada";
import { BolhaViva } from "~/componentes/movimento";
import { supabase } from "~/servidor/supabase";
import { espaco } from "~/tema";

type Erro = { campo: "email" | "senha"; texto: string; vez: number };

/**
 * Entrar com e-mail e senha (17/11/2026): o formulário que morava na folha
 * branca da primeira tela, agora sobre o céu, com o véu inteiro e os campos
 * de vidro escuro.
 *
 * 18/11/2026: o teclado anda sozinho (o "seguir" do e-mail leva à senha, o
 * "ir" da senha entra), o AutoFill de senhas do iOS acha o par (`username` +
 * `password`), a senha tem o olho, e o erro aparece embaixo do campo que
 * falhou, que treme. O botão fica preso acima do teclado. Quem volta do
 * "Já confirmei" do cadastro chega com o e-mail preenchido (`?email=`).
 */
export default function EntrarComEmail() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<Erro | null>(null);
  const campoDaSenha = useRef<TextInput>(null);
  /* Cada erro faz o campo tremer de novo, mesmo que seja o mesmo recado. */
  const vezes = useRef(0);

  function errar(campo: Erro["campo"], texto: string) {
    vezes.current += 1;
    setErro({ campo, texto, vez: vezes.current });
  }

  async function entrar() {
    setErro(null);
    if (!email.trim()) return errar("email", "Digite o e-mail da sua conta.");
    if (!senha) return errar("senha", "Digite a sua senha.");
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    setCarregando(false);
    if (error) {
      if (/confirm/i.test(error.message))
        return errar(
          "email",
          "Falta confirmar este e-mail. Abra o link que enviamos e tente de novo.",
        );
      return errar("senha", "O e-mail ou a senha não conferem.");
    }
    sucesso();
    marcarQueJaEntrou();
    router.replace("/");
  }

  const erroEm = (campo: Erro["campo"]) => (erro?.campo === campo ? erro : null);

  return (
    <FundoDaEntrada veu="inteiro">
      <MolduraDoPasso
        topo={
          <TopoDoPasso>
            <View style={{ flex: 1 }} />
            <BolhaViva humor="feliz" tamanho={72} />
          </TopoDoPasso>
        }
        pe={
          <>
            <Botao
              rotulo="Entrar"
              tamanho="grande"
              aoTocar={() => void entrar()}
              carregando={carregando}
              estilo={{ minHeight: 56 }}
            />
            <LinkNoVeu
              rotulo="Criar uma conta"
              apagado
              aoTocar={() => router.replace("/cadastro")}
            />
          </>
        }
      >
        <View style={{ gap: espaco.sm }}>
          <TituloNoVeu>Entrar com e-mail</TituloNoVeu>
          <TextoNoVeu>Use o e-mail e a senha que você cadastrou.</TextoNoVeu>
        </View>
        <CampoNoVeu
          rotulo="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => campoDaSenha.current?.focus()}
          placeholder="voce@email.com"
          erro={erroEm("email")?.texto}
          tremer={erroEm("email")?.vez}
        />
        <View>
          <CampoNoVeu
            ref={campoDaSenha}
            rotulo="Senha"
            value={senha}
            onChangeText={setSenha}
            senha
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            placeholder="A sua senha"
            onSubmitEditing={() => void entrar()}
            erro={erroEm("senha")?.texto}
            tremer={erroEm("senha")?.vez}
          />
          <LinkNoVeu
            rotulo="Esqueceu a senha?"
            alinhar="direita"
            pequeno
            aoTocar={() =>
              router.push({
                pathname: "/esqueci",
                params: email.trim() ? { email: email.trim() } : {},
              })
            }
          />
        </View>
      </MolduraDoPasso>
    </FundoDaEntrada>
  );
}
