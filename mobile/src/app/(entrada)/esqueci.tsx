import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Linking, Platform, View } from "react-native";
import { Botao, sucesso } from "~/componentes/base";
import {
  CampoNoVeu,
  FundoDaEntrada,
  LinkNoVeu,
  MolduraDoPasso,
  TextoNoVeu,
  TituloNoVeu,
  TopoDoPasso,
} from "~/componentes/entrada";
import { BolhaViva } from "~/componentes/movimento";
import { SITE } from "~/config";
import { parametroDaBancada } from "~/lib/bancada";
import { supabase } from "~/servidor/supabase";
import { espaco } from "~/tema";

/**
 * "Esqueci a senha", sobre o céu e o véu (17/11/2026: sem a folha branca).
 *
 * 18/11/2026: chega com o e-mail que ela já tinha digitado em "Entrar com
 * e-mail" (`?email=`); a nota de quem entrava com o Google no site mora aqui,
 * e não mais na primeira tela; e o "voltar" volta (`router.back()`), em vez
 * de abrir a tela de entrar de novo por cima.
 *
 * Bancada: /esqueci?bancada=1 · com `&enviado=1`, a espera do e-mail.
 */
export default function Esqueci() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(
    typeof params.email === "string"
      ? params.email
      : parametroDaBancada("enviado")
        ? "marina@exemplo.com"
        : "",
  );
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(parametroDaBancada("enviado") === "1");
  const [erro, setErro] = useState<{ texto: string; vez: number } | null>(null);
  const vezes = useRef(0);

  function errar(texto: string) {
    vezes.current += 1;
    setErro({ texto, vez: vezes.current });
  }

  function voltar() {
    if (router.canGoBack()) router.back();
    else router.replace("/email");
  }

  async function enviar() {
    setErro(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return errar("Digite o e-mail da sua conta.");
    setCarregando(true);
    /* O link abre a página do site, que já sabe trocar a senha. Depois ela
       volta ao app e entra com a senha nova. */
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${SITE}/auth`,
    });
    setCarregando(false);
    if (error) return errar("Não deu para enviar agora. Tente de novo daqui a pouco.");
    sucesso();
    setEnviado(true);
  }

  if (enviado) {
    return (
      <FundoDaEntrada veu="inteiro">
        <MolduraDoPasso
          centro
          topo={<TopoDoPasso aoVoltar={voltar} />}
          pe={
            <>
              {Platform.OS === "ios" ? (
                <Botao
                  rotulo="Abrir o Mail"
                  tamanho="grande"
                  aoTocar={() => void Linking.openURL("message://").catch(() => {})}
                  estilo={{ minHeight: 56 }}
                />
              ) : null}
              <LinkNoVeu rotulo="Voltar para entrar" apagado aoTocar={voltar} />
            </>
          }
        >
          <View style={{ alignItems: "center", gap: espaco.lg }}>
            <BolhaViva humor="comemorando" tamanho={140} />
            <TituloNoVeu centro nivel="titulo1">
              Confira o seu e-mail
            </TituloNoVeu>
            <TextoNoVeu centro>
              Se houver uma conta com {email.trim()}, chega um link para criar a senha nova. Depois,
              volte aqui e entre com ela.
            </TextoNoVeu>
            <TextoNoVeu centro nivel="legenda">
              Não chegou? Olhe o spam e a aba Promoções.
            </TextoNoVeu>
          </View>
        </MolduraDoPasso>
      </FundoDaEntrada>
    );
  }

  return (
    <FundoDaEntrada veu="inteiro">
      <MolduraDoPasso
        topo={
          <TopoDoPasso aoVoltar={voltar}>
            <View style={{ flex: 1 }} />
            <BolhaViva humor="estudiosa" tamanho={72} />
          </TopoDoPasso>
        }
        pe={
          <>
            <Botao
              rotulo="Enviar o link"
              tamanho="grande"
              aoTocar={() => void enviar()}
              carregando={carregando}
              estilo={{ minHeight: 56 }}
            />
            <LinkNoVeu rotulo="Lembrei a senha" apagado aoTocar={voltar} />
          </>
        }
      >
        <View style={{ gap: espaco.sm }}>
          <TituloNoVeu>Criar uma senha nova</TituloNoVeu>
          <TextoNoVeu>
            Digite o e-mail da sua conta. Mandamos um link para você escolher a senha nova.
          </TextoNoVeu>
        </View>
        <CampoNoVeu
          rotulo="E-mail da conta"
          value={email}
          onChangeText={setEmail}
          autoFocus={!email}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="username"
          returnKeyType="send"
          placeholder="voce@email.com"
          onSubmitEditing={() => void enviar()}
          erro={erro?.texto}
          tremer={erro?.vez}
        />
        <TextoNoVeu nivel="nota">
          Criou a conta com o Google, no site? Use o mesmo e-mail aqui para criar uma senha e entrar
          no app.
        </TextoNoVeu>
      </MolduraDoPasso>
    </FundoDaEntrada>
  );
}
