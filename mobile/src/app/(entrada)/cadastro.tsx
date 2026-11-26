import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking, Platform, ScrollView, View, type TextInput } from "react-native";
import { Botao, sucesso } from "~/componentes/base";
import { CaixaDeMarcar } from "~/componentes/caixa";
import {
  BotaoDeVidroNoVeu,
  CampoNoVeu,
  ErroNoVeu,
  FundoDaEntrada,
  LinkNoVeu,
  LinksDosDocumentos,
  MolduraDoPasso,
  TextoNoVeu,
  TituloNoVeu,
  TopoDoPasso,
} from "~/componentes/entrada";
import { BolhaViva, Entrada } from "~/componentes/movimento";
import { SITE } from "~/config";
import { parametroDaBancada } from "~/lib/bancada";
import { metadadosDoAceite } from "~/lib/juridico/aceite";
import { TEXTO_DO_CONSENTIMENTO_DE_SAUDE, TEXTO_DOS_TERMOS } from "~/lib/juridico/textos-do-aceite";
import { supabase } from "~/servidor/supabase";
import { espaco } from "~/tema";

type Onde = "email" | "senha" | "maior" | "aceite" | "saude" | "geral";
type Erro = { onde: Onde; texto: string; vez: number };

/** Quanto ela espera para pedir o link de novo (o Supabase recusa antes). */
const ESPERA_DO_REENVIO = 30;

/**
 * O cadastro pede o ACEITE de forma explícita, e não "ao criar a conta você
 * concorda": a Apple exige (1.2) que a pessoa concorde com as regras ANTES de
 * poder publicar, e o dado de saúde tem a sua caixa separada e destacada
 * (LGPD, art. 11, I).
 *
 * Desde a fase 4 os Termos e a Privacidade são os do APP (telas próprias,
 * `lib/juridico`), e o aceite grava a VERSÃO (`metadadosDoAceite`).
 *
 * 17/11/2026: sem a folha branca, sobre o céu, com o véu inteiro e os campos
 * de vidro escuro (o dono: "esse fundo branco aí no cadastro do e-mail [...]
 * não gosto disso").
 *
 * 18/11/2026: o nome saiu daqui (o ritual pergunta logo depois, e é ele quem
 * o grava); o "Criar conta" fica preso ao pé, acima do teclado; a regra da
 * senha ganha o visto ao vivo; e o recado de cada erro aparece embaixo do que
 * faltou, que treme, com a tela rolando até lá. A espera do e-mail tem
 * "Abrir o Mail", "Reenviar o link" e "Já confirmei", que leva o e-mail junto.
 *
 * Bancada: /cadastro?bancada=1 · com `&enviado=1`, a espera do e-mail.
 */
export default function Cadastro() {
  const [email, setEmail] = useState(parametroDaBancada("enviado") ? "marina@exemplo.com" : "");
  const [senha, setSenha] = useState("");
  const [aceite, setAceite] = useState(false);
  const [maior, setMaior] = useState(false);
  const [saude, setSaude] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<Erro | null>(null);
  const [enviado, setEnviado] = useState(parametroDaBancada("enviado") === "1");
  const vezes = useRef(0);
  const rolagem = useRef<ScrollView>(null);
  const campoDaSenha = useRef<TextInput>(null);
  /* Onde cada caixa ficou na rolagem, para ir até a que faltou. */
  const ondeEsta = useRef<Partial<Record<Onde, number>>>({});

  function errar(onde: Onde, texto: string) {
    vezes.current += 1;
    setErro({ onde, texto, vez: vezes.current });
    const y = ondeEsta.current[onde];
    rolagem.current?.scrollTo({ y: y == null ? 0 : Math.max(0, y - 96), animated: true });
  }

  function marcar(onde: Onde, trocar: (f: (v: boolean) => boolean) => void) {
    trocar((v) => !v);
    if (erro?.onde === onde) setErro(null);
  }

  async function criar() {
    setErro(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim()))
      return errar("email", "Esse e-mail não parece completo.");
    if (senha.length < 8) return errar("senha", "A senha precisa de 8 caracteres ou mais.");
    if (!maior) return errar("maior", "O app é para maiores de 18 anos.");
    if (!aceite)
      return errar(
        "aceite",
        "Marque que você leu e concorda com os Termos e a Política de privacidade.",
      );
    if (!saude)
      return errar(
        "saude",
        "Sem a data da gestação, o app não monta a sua trilha. Marque esta caixa para criar a conta.",
      );
    setCarregando(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        emailRedirectTo: `${SITE}/minha-conta`,
        data: {
          aceite_termos_em: new Date().toISOString(),
          ...metadadosDoAceite(new Date()),
          origem: "app-ios",
        },
      },
    });
    setCarregando(false);
    if (error) {
      if (/registered|already/i.test(error.message))
        return errar("email", "Este e-mail já tem conta. Toque em “Já tenho conta” para entrar.");
      return errar("geral", "Não deu para criar a conta agora. Tente de novo.");
    }
    sucesso();
    setEnviado(true);
  }

  if (enviado) return <ConfiraOEmail email={email.trim()} aoCorrigir={() => setEnviado(false)} />;

  const erroEm = (onde: Onde) => (erro?.onde === onde ? erro : null);
  const medir = (onde: Onde) => (y: number) => {
    ondeEsta.current[onde] = y;
  };

  return (
    <FundoDaEntrada veu="inteiro">
      <MolduraDoPasso
        refDaRolagem={rolagem}
        topo={
          <TopoDoPasso>
            <View style={{ flex: 1 }} />
            <BolhaViva humor="feliz" tamanho={72} />
          </TopoDoPasso>
        }
        pe={
          <>
            {erroEm("geral") ? <ErroNoVeu>{erro?.texto}</ErroNoVeu> : null}
            <Botao
              rotulo="Criar conta"
              tamanho="grande"
              aoTocar={() => void criar()}
              carregando={carregando}
              estilo={{ minHeight: 56 }}
            />
            <LinkNoVeu rotulo="Já tenho conta" apagado aoTocar={() => router.replace("/email")} />
          </>
        }
      >
        <View style={{ gap: espaco.sm }}>
          <TituloNoVeu>Crie a sua conta</TituloNoVeu>
          <TextoNoVeu>
            Use um e-mail que você abre sempre: mandamos um link para confirmar.
          </TextoNoVeu>
        </View>
        <CampoNoVeu
          rotulo="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="username"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => campoDaSenha.current?.focus()}
          placeholder="voce@email.com"
          erro={erroEm("email")?.texto}
          tremer={erroEm("email")?.vez}
        />
        <CampoNoVeu
          ref={campoDaSenha}
          rotulo="Senha"
          value={senha}
          onChangeText={setSenha}
          senha
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          placeholder="Crie uma senha"
          regra={{ texto: "8 caracteres ou mais", cumprida: senha.length >= 8 }}
          erro={erroEm("senha")?.texto}
          tremer={erroEm("senha")?.vez}
        />
        <CaixaDeMarcar
          noVeu
          marcada={maior}
          aoTocar={() => marcar("maior", setMaior)}
          rotulo="Tenho 18 anos ou mais."
          aviso={erroEm("maior")?.texto}
          tremer={erroEm("maior")?.vez}
          aoMedir={medir("maior")}
        />
        <CaixaDeMarcar
          noVeu
          marcada={aceite}
          aoTocar={() => marcar("aceite", setAceite)}
          rotulo={TEXTO_DOS_TERMOS}
          aviso={erroEm("aceite")?.texto}
          tremer={erroEm("aceite")?.vez}
          aoMedir={medir("aceite")}
        />
        <CaixaDeMarcar
          noVeu
          marcada={saude}
          aoTocar={() => marcar("saude", setSaude)}
          rotulo={TEXTO_DO_CONSENTIMENTO_DE_SAUDE}
          destaque
          aviso={erroEm("saude")?.texto}
          tremer={erroEm("saude")?.vez}
          aoMedir={medir("saude")}
        />
        <LinksDosDocumentos />
      </MolduraDoPasso>
    </FundoDaEntrada>
  );
}

/**
 * "Confira o seu e-mail": a espera do link de confirmação, no mesmo céu. O
 * Mail abre num toque (só no iPhone), o link pode ser pedido de novo depois
 * de 30 s, e o "Já confirmei" leva o e-mail para a tela de entrar.
 */
function ConfiraOEmail({ email, aoCorrigir }: { email: string; aoCorrigir: () => void }) {
  const [espera, setEspera] = useState(ESPERA_DO_REENVIO);
  const [reenviado, setReenviado] = useState<"sim" | "falhou" | null>(null);
  const [reenviando, setReenviando] = useState(false);
  const comMail = Platform.OS === "ios";

  /* Um passo por segundo, só enquanto conta: estado na fronteira, sem laço. */
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((e) => e - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function reenviar() {
    setReenviado(null);
    setReenviando(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${SITE}/minha-conta` },
    });
    setReenviando(false);
    setReenviado(error ? "falhou" : "sim");
    setEspera(ESPERA_DO_REENVIO);
  }

  const jaConfirmei = () => router.replace({ pathname: "/email", params: { email } });

  return (
    <FundoDaEntrada veu="inteiro">
      <MolduraDoPasso
        centro
        topo={<TopoDoPasso aoVoltar={aoCorrigir} />}
        pe={
          <>
            {comMail ? (
              <Botao
                rotulo="Abrir o Mail"
                tamanho="grande"
                aoTocar={() => void Linking.openURL("message://").catch(() => {})}
                estilo={{ minHeight: 56 }}
              />
            ) : null}
            {comMail ? (
              <BotaoDeVidroNoVeu rotulo="Já confirmei" aoTocar={jaConfirmei} />
            ) : (
              <Botao
                rotulo="Já confirmei"
                tamanho="grande"
                aoTocar={jaConfirmei}
                estilo={{ minHeight: 56 }}
              />
            )}
            <LinkNoVeu
              rotulo={
                reenviando
                  ? "Reenviando…"
                  : espera > 0
                    ? `Reenviar o link em ${espera} s`
                    : "Reenviar o link"
              }
              apagado
              desabilitado={espera > 0 || reenviando}
              aoTocar={() => void reenviar()}
            />
          </>
        }
      >
        <Entrada>
          <View style={{ alignItems: "center", gap: espaco.lg }}>
            <BolhaViva humor="comemorando" tamanho={140} />
            <TituloNoVeu centro nivel="titulo1">
              Confira o seu e-mail
            </TituloNoVeu>
            <TextoNoVeu centro>
              Mandamos um link para {email}. Toque nele para confirmar a conta e volte aqui para
              entrar.
            </TextoNoVeu>
            <TextoNoVeu centro nivel="legenda">
              {reenviado === "sim"
                ? "Mandamos de novo. Olhe também o spam e a aba Promoções."
                : reenviado === "falhou"
                  ? "Não deu para reenviar agora. Tente de novo daqui a pouco."
                  : "Não chegou? Olhe o spam e a aba Promoções."}
            </TextoNoVeu>
          </View>
        </Entrada>
      </MolduraDoPasso>
    </FundoDaEntrada>
  );
}
