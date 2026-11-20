import { router } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import Download from "lucide-react-native/icons/download";
import Gamepad2 from "lucide-react-native/icons/gamepad-2";
import HeartPulse from "lucide-react-native/icons/heart-pulse";
import Users from "lucide-react-native/icons/users";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Botao } from "~/componentes/base";
import { PilulaSos } from "~/componentes/cabecalho";
import { CaixaDeMarcar } from "~/componentes/caixa";
import {
  CampoNoVeu,
  ErroNoVeu,
  FundoDaEntrada,
  LinkNoVeu,
  LinksDosDocumentos,
  MolduraDoPasso,
  TextoNoVeu,
  TituloNoVeu,
} from "~/componentes/entrada";
import { rota } from "~/componentes/jornada/bancada";
import { BolhaViva } from "~/componentes/movimento";
import { limparRastrosLocais } from "~/lib/armazem";
import { ehBancada } from "~/lib/bancada";
import { esquecerMeuPerfilSocial } from "~/lib/comunidade/meu-perfil";
import { metadadosDoAceite, VERSAO_DOS_TERMOS, versaoAceita } from "~/lib/juridico/aceite";
import { lembrarAceite } from "~/lib/juridico/aceite-da-sessao";
import {
  PONTOS_DO_ACEITE,
  TEXTO_DO_CONSENTIMENTO_DE_SAUDE,
  TEXTO_DOS_TERMOS,
} from "~/lib/juridico/textos-do-aceite";
import { zerarSelos } from "~/lib/selos";
import { useSessao } from "~/lib/sessao";
import { excluirMinhaConta, PALAVRA_DE_CONFIRMACAO } from "~/servidor/conta";
import { supabase } from "~/servidor/supabase";
import { canto, cor, curva, escala, espaco, fonte, margem, veu } from "~/tema";

type Caixa = "maior" | "termos" | "saude";

/* Um ícone para cada ponto do resumo, na ordem de `PONTOS_DO_ACEITE`: o jogo,
   o dado de saúde, as amigas e a cópia dos dados. */
const ICONES_DOS_PONTOS: readonly LucideIcon[] = [Gamepad2, HeartPulse, Users, Download];

/**
 * O ACEITE DOS TERMOS DO APP: a porta do app (`index.tsx`) traz para cá quem
 * ainda não aceitou a versão em vigor: quem entrou pela Apple (esse caminho
 * nunca passou por aceite nem pelos 18 anos), quem aceitou os termos antigos
 * do site, e todas, de novo, quando a versão muda.
 *
 * O essencial vem em linguagem simples antes das caixas; os documentos
 * inteiros abrem em telas do app. O dado de saúde tem a sua caixa, destacada.
 * Não concordar não prende ninguém: dá para sair ou excluir a conta, aqui
 * mesmo. O SOS fica no canto, como em toda tela (com a chave ligada).
 *
 * 18/11/2026 (a vistoria): era uma página clara que trocava o céu por um
 * clarão, com cara de contrato. Agora é o MESMO céu e véu da entrada, o
 * resumo em linhas com ícone (como o "O que há de novo" da Apple), o
 * "Concordo" preso ao pé, e a caixa que faltou treme, com o recado embaixo
 * dela. A saída é um rodapé discreto.
 *
 * Bancada: /aceite?bancada=1
 */
export default function Aceite() {
  const { sessao } = useSessao();
  const fora = useSafeAreaInsets();
  const primeiraVez = versaoAceita(sessao?.user.user_metadata) === null;
  const [maior, setMaior] = useState(false);
  const [termos, setTermos] = useState(false);
  const [saude, setSaude] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<{ onde: Caixa | "geral"; texto: string; vez: number } | null>(
    null,
  );
  const vezes = useRef(0);
  const rolagem = useRef<ScrollView>(null);
  const ondeEsta = useRef<Partial<Record<Caixa | "excluir", number>>>({});
  const [excluindo, setExcluindo] = useState<"fechado" | "aberto" | "enviando">("fechado");
  const [palavra, setPalavra] = useState("");
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);

  function errar(onde: Caixa | "geral", texto: string) {
    vezes.current += 1;
    setErro({ onde, texto, vez: vezes.current });
    const y = onde === "geral" ? undefined : ondeEsta.current[onde];
    if (y != null) rolagem.current?.scrollTo({ y: Math.max(0, y - 96), animated: true });
  }

  function marcar(onde: Caixa, trocar: (f: (v: boolean) => boolean) => void) {
    trocar((v) => !v);
    if (erro?.onde === onde) setErro(null);
  }

  async function aceitar() {
    setErro(null);
    if (!maior) return errar("maior", "O app é para maiores de 18 anos.");
    if (!termos)
      return errar("termos", "Para continuar, marque que você leu e concorda com os Termos.");
    if (!saude)
      return errar(
        "saude",
        "Sem a data da gestação, o app não monta a sua trilha. Marque esta caixa para continuar.",
      );
    if (ehBancada()) return router.replace(rota("/jornada") as never);
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ data: metadadosDoAceite(new Date()) });
    setEnviando(false);
    if (error) {
      errar("geral", "Não conseguimos registrar agora. Confira a internet e tente de novo.");
      return;
    }
    lembrarAceite(VERSAO_DOS_TERMOS);
    router.replace("/");
  }

  async function sair() {
    await limparRastrosLocais();
    esquecerMeuPerfilSocial();
    zerarSelos();
    await supabase.auth.signOut().catch(() => {});
    router.replace("/entrar");
  }

  async function excluir() {
    setErroExcluir(null);
    if (palavra.trim().toUpperCase() !== PALAVRA_DE_CONFIRMACAO)
      return setErroExcluir(`Digite ${PALAVRA_DE_CONFIRMACAO} para confirmar.`);
    if (ehBancada()) return setErroExcluir("Na bancada nada é apagado.");
    setExcluindo("enviando");
    try {
      const r = await excluirMinhaConta({ confirmacao: PALAVRA_DE_CONFIRMACAO });
      if (r.ok) return void (await sair());
      setErroExcluir(
        r.motivo === "sessao"
          ? "A sua sessão expirou. Entre de novo e repita."
          : r.motivo === "medico"
            ? "Esta é uma conta de médico: a exclusão passa pelo suporte."
            : "Não conseguimos excluir agora. Nada foi apagado. Tente de novo.",
      );
    } catch {
      setErroExcluir("Sem conexão. Nada foi apagado. Tente de novo com internet.");
    }
    setExcluindo("aberto");
  }

  const erroEm = (onde: Caixa) => (erro?.onde === onde ? erro : null);
  const medir = (onde: Caixa | "excluir") => (y: number) => {
    ondeEsta.current[onde] = y;
  };

  return (
    <FundoDaEntrada veu="inteiro">
      <MolduraDoPasso
        refDaRolagem={rolagem}
        pe={
          <>
            {erro?.onde === "geral" ? <ErroNoVeu>{erro.texto}</ErroNoVeu> : null}
            <Botao
              rotulo="Concordo e continuar"
              tamanho="grande"
              aoTocar={() => void aceitar()}
              carregando={enviando}
              estilo={{ minHeight: 56 }}
            />
          </>
        }
      >
        <View style={{ gap: espaco.md }}>
          <BolhaViva humor="feliz" tamanho={72} />
          <TituloNoVeu>
            {primeiraVez ? "Antes de começar" : "Atualizamos os Termos e a Privacidade"}
          </TituloNoVeu>
          <TextoNoVeu>
            {primeiraVez
              ? "Três confirmações rápidas, uma vez só."
              : "Reescrevemos os documentos para o app de hoje. Veja o resumo e confirme."}
          </TextoNoVeu>
        </View>

        <View
          style={{
            borderRadius: canto.cartao,
            ...curva,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: veu.campoBorda,
            backgroundColor: "rgba(255,255,255,0.08)",
            paddingHorizontal: espaco.lg,
          }}
        >
          {PONTOS_DO_ACEITE.map((p, i) => {
            const Icone = ICONES_DOS_PONTOS[i] ?? Gamepad2;
            return (
              <View
                key={p}
                style={{
                  flexDirection: "row",
                  gap: espaco.md,
                  paddingVertical: espaco.md,
                  borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: veu.campoBorda,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: "rgba(255,255,255,0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icone size={18} color={veu.linkNoVeu} strokeWidth={2.2} />
                </View>
                <Text
                  style={{ ...fonte.normal, ...escala.legenda, flex: 1, color: veu.textoNoVeu }}
                >
                  {p}
                </Text>
              </View>
            );
          })}
        </View>

        <LinksDosDocumentos />

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
          marcada={termos}
          aoTocar={() => marcar("termos", setTermos)}
          rotulo={TEXTO_DOS_TERMOS}
          aviso={erroEm("termos")?.texto}
          tremer={erroEm("termos")?.vez}
          aoMedir={medir("termos")}
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

        {/* A saída: discreta, mas sempre aqui. */}
        <View
          style={{ gap: espaco.xs, marginTop: espaco.lg, alignItems: "center" }}
          onLayout={(e) => medir("excluir")(e.nativeEvent.layout.y)}
        >
          <TextoNoVeu centro nivel="legenda">
            Prefere não concordar? Sem o aceite, o app não abre. Você pode sair e voltar quando
            quiser, ou excluir a conta e os seus dados.
          </TextoNoVeu>
          <View style={{ flexDirection: "row", alignItems: "center", columnGap: espaco.xs }}>
            <LinkNoVeu rotulo="Sair da conta" apagado pequeno aoTocar={() => void sair()} />
            <Text style={{ ...fonte.forte, ...escala.legenda, color: veu.textoNoVeu }}>·</Text>
            <LinkNoVeu
              rotulo="Excluir a minha conta"
              apagado
              pequeno
              aoTocar={() => {
                setExcluindo("aberto");
                const y = ondeEsta.current.excluir;
                if (y != null)
                  setTimeout(() => rolagem.current?.scrollTo({ y, animated: true }), 60);
              }}
            />
          </View>
        </View>

        {excluindo !== "fechado" ? (
          <View
            style={{
              gap: espaco.md,
              padding: espaco.lg,
              borderRadius: canto.cartao,
              ...curva,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: veu.campoBorda,
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          >
            <Text style={{ ...fonte.forte, ...escala.titulo3, color: cor.branco }}>
              Excluir a conta
            </Text>
            <TextoNoVeu nivel="legenda">
              Apaga para sempre a sua conta e tudo o que ela guarda. Não dá para desfazer.
            </TextoNoVeu>
            <CampoNoVeu
              rotulo={`Digite ${PALAVRA_DE_CONFIRMACAO} para confirmar`}
              value={palavra}
              onChangeText={setPalavra}
              autoCapitalize="characters"
              autoCorrect={false}
              erro={erroExcluir}
            />
            <Botao
              rotulo="Excluir para sempre"
              tipo="perigo"
              carregando={excluindo === "enviando"}
              aoTocar={() => void excluir()}
            />
            <LinkNoVeu
              rotulo="Cancelar"
              apagado
              aoTocar={() => {
                setExcluindo("fechado");
                setPalavra("");
                setErroExcluir(null);
              }}
            />
          </View>
        ) : null}
      </MolduraDoPasso>
      {/* O SOS no canto, fora da rolagem (com a chave desligada, não desenha nada). */}
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", top: fora.top + espaco.sm, right: margem.foco }}
      >
        <PilulaSos />
      </View>
    </FundoDaEntrada>
  );
}
