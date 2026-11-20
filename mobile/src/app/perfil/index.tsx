import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import Ban from "lucide-react-native/icons/ban";
import Bell from "lucide-react-native/icons/bell";
import Download from "lucide-react-native/icons/download";
import FileText from "lucide-react-native/icons/file-text";
import Feather from "lucide-react-native/icons/feather";
import HeartPulse from "lucide-react-native/icons/heart-pulse";
import Lock from "lucide-react-native/icons/lock";
import Mail from "lucide-react-native/icons/mail";
import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Text, View } from "react-native";
import { LinhaDeAjuste, SecaoDeAjustes } from "~/componentes/ajustes";
import { AvisoMedico } from "~/componentes/aviso-medico";
import {
  Botao,
  Campo,
  Cartao,
  Linha,
  NaoConsegueLer,
  Pilula,
  T,
  Tocavel,
} from "~/componentes/base";
import { SecaoDoPlano } from "~/componentes/assinatura/no-perfil";
import { TelaDaPilha } from "~/componentes/cabecalho";
import { useAviso } from "~/componentes/comunidade/folha";
import { Avatar } from "~/componentes/comunidade/imagem";
import { rota } from "~/componentes/jornada/bancada";
import { usePreferenciaDosLembretes } from "~/componentes/jornada/lembretes";
import {
  ASSINATURA_NO_APP,
  COMUNIDADE_NO_APP,
  CONTATO_EMAIL,
  IA_NO_APP,
  SOS_NO_APP,
} from "~/config";
import { limparRastrosLocais } from "~/lib/armazem";
import { ehBancada } from "~/lib/bancada";
import { api } from "~/lib/comunidade/api";
import { esquecerMeuPerfilSocial, guardarMeuPerfilSocial } from "~/lib/comunidade/meu-perfil";
import { CartaoDaPermissaoDeIA } from "~/lib/ia/PermissaoDeIA";
import { compartilharCopia } from "~/lib/juridico/arquivo-da-copia";
import { recadoDaCopia } from "~/lib/juridico/copia-dos-dados";
import { abrir } from "~/lib/links";
import { zerarSelos } from "~/lib/selos";
import { useSessao } from "~/lib/sessao";
import {
  excluirMinhaConta,
  exportarMeusDados,
  ligarModoCuidado,
  PALAVRA_DE_CONFIRMACAO,
} from "~/servidor/conta";
import type { PerfilNaTela } from "~/servidor/rede";
import { supabase } from "~/servidor/supabase";
import { cor, escala, espaco, fonte, sombra } from "~/tema";

/**
 * O PERFIL — um só (fase 3, a rede social no centro).
 *
 * 18/11/2026 (a vistoria: "a tela mais 'formulário genérico' do grupo"): a
 * lista agrupada dos Ajustes do iPhone. No alto, ela (a foto, o nome e
 * "Editar perfil"); embaixo, três grupos: a conta (Seus dados, Lembretes,
 * Modo Cuidado), a ajuda e os documentos, e as duas ações de sair, em
 * vermelho. O aviso médico e a versão do app ficam no pé, como nota.
 *
 * O Modo Cuidado não explica mais, na vista de todo dia, que é "para quando a
 * gestação não seguiu": a explicação vem no aviso, na hora de ligar.
 * Excluir a conta DENTRO do app é exigência da Apple; a cópia dos dados é a
 * LGPD (art. 18).
 *
 * Bancada: /perfil?bancada=1 [&luto=1] [&lembrete-jornada=20:00]
 */
export default function Perfil() {
  const { sessao, perfil, recarregarPerfil, cuidado: cuidadoDaSessao } = useSessao();
  const uid = sessao?.user.id ?? null;
  const [social, setSocial] = useState<PerfilNaTela | null>(null);
  const [leitura, setLeitura] = useState<"carregando" | "pronto" | "falhou">("carregando");
  const [cuidado, setCuidado] = useState(perfil?.care_mode === true);
  /* O perfil pode chegar depois da tela: a linha mostra o que está gravado. */
  useEffect(() => {
    setCuidado(perfil?.care_mode === true);
  }, [perfil?.care_mode]);
  const [trocandoCuidado, setTrocandoCuidado] = useState(false);
  const [excluindo, setExcluindo] = useState<"fechado" | "aberto" | "enviando">("fechado");
  const [palavra, setPalavra] = useState("");
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);
  const [pref] = usePreferenciaDosLembretes(uid);
  const aviso = useAviso();

  /* Relê ao voltar de "Editar perfil": o topo mostra o que ficou gravado. */
  const carregar = useCallback(async () => {
    const r = await api.meuPerfilSocial();
    if (!r.ok) {
      setLeitura((l) => (l === "pronto" ? l : "falhou"));
      return;
    }
    setSocial(r.perfil);
    setLeitura("pronto");
    if (uid) guardarMeuPerfilSocial(uid, { nome: r.perfil.nome, avatarUrl: r.perfil.avatarUrl });
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  async function trocarCuidado(on: boolean) {
    if (ehBancada()) return setCuidado(on);
    setTrocandoCuidado(true);
    try {
      const r = await ligarModoCuidado({ on });
      if (r.ok) {
        setCuidado(r.careMode);
        await recarregarPerfil();
      } else {
        aviso.mostrar("Não conseguimos mudar o Modo Cuidado agora. Tente de novo.", true);
      }
    } catch {
      aviso.mostrar("Sem conexão. O Modo Cuidado ficou como estava.", true);
    } finally {
      setTrocandoCuidado(false);
    }
  }

  /** Ligar ou desligar passa sempre por uma pergunta: a troca muda o app inteiro. */
  function pedirCuidado(on: boolean) {
    if (Platform.OS === "web") return void trocarCuidado(on);
    if (on) {
      Alert.alert(
        "Ligar o Modo Cuidado?",
        `O app para de mostrar o bebê, a semana e as contagens. ${SOS_NO_APP ? "O SOS e o acolhimento continuam." : "O acolhimento continua."} Você pode desligar quando quiser.`,
        [
          { text: "Agora não", style: "cancel" },
          { text: "Ligar", onPress: () => void trocarCuidado(true) },
        ],
      );
      return;
    }
    Alert.alert(
      "Desligar o Modo Cuidado?",
      "O app volta a mostrar o bebê, a semana e as contagens.",
      [
        { text: "Agora não", style: "cancel" },
        { text: "Desligar", onPress: () => void trocarCuidado(false) },
      ],
    );
  }

  /** A conta sai do aparelho: os rastros locais, o perfil e os selos da memória. */
  async function esquecerAConta() {
    await limparRastrosLocais();
    esquecerMeuPerfilSocial();
    zerarSelos();
    await supabase.auth.signOut().catch(() => {});
    router.replace("/entrar");
  }

  /* A cópia dos dados: o servidor monta o arquivo; o app o entrega à folha de
     compartilhar do iPhone e o apaga do aparelho em seguida. */
  async function baixarCopia() {
    if (ehBancada() || Platform.OS === "web") {
      return aviso.mostrar("Na bancada nenhum arquivo é gerado.");
    }
    setBaixando(true);
    try {
      let r: Awaited<ReturnType<typeof exportarMeusDados>>;
      try {
        r = await exportarMeusDados();
      } catch {
        return aviso.mostrar("Sem conexão. Tente de novo com internet.", true);
      }
      if (r.ok) {
        try {
          const fim = await compartilharCopia(JSON.stringify(r.arquivo, null, 2));
          if (fim === "fechou" && !recadoDaCopia(r).erro) return;
        } catch {
          return aviso.mostrar("Não conseguimos abrir o arquivo no aparelho. Tente de novo.", true);
        }
      }
      const recado = recadoDaCopia(r);
      aviso.mostrar(recado.texto, recado.erro);
    } finally {
      setBaixando(false);
    }
  }

  async function excluir() {
    setErroExcluir(null);
    if (palavra.trim().toUpperCase() !== PALAVRA_DE_CONFIRMACAO) {
      return setErroExcluir(`Digite ${PALAVRA_DE_CONFIRMACAO} para confirmar.`);
    }
    if (ehBancada()) return setErroExcluir("Na bancada nada é apagado.");
    setExcluindo("enviando");
    try {
      const r = await excluirMinhaConta({ confirmacao: PALAVRA_DE_CONFIRMACAO });
      if (r.ok) {
        await esquecerAConta();
        return;
      }
      setErroExcluir(
        r.motivo === "sessao"
          ? "Sua sessão expirou. Entre de novo e repita."
          : r.motivo === "medico"
            ? "Esta é uma conta de médico. A exclusão passa pelo suporte."
            : "Não conseguimos excluir agora. Nada foi apagado. Tente de novo.",
      );
    } catch {
      setErroExcluir("Sem conexão. Nada foi apagado. Tente de novo com internet.");
    }
    setExcluindo("aberto");
  }

  const nome = social?.nome ?? perfil?.display_name ?? perfil?.full_name ?? "Você";
  const editar = () => router.push(rota("/perfil/editar") as never);
  const valorDosLembretes = pref
    ? (pref.hora ?? (pref.semanaNova && !cuidadoDaSessao ? "Semana nova" : "Desligados"))
    : null;
  const versao = Constants.expoConfig?.version;
  const build = Constants.expoConfig?.ios?.buildNumber;

  return (
    <TelaDaPilha titulo="Perfil" grande voltarPara="/jornada" sobre={aviso.elemento}>
      {/* ── Ela ── */}
      <View style={{ alignItems: "center", gap: espaco.sm }}>
        <Tocavel rotulo="Editar a foto e o perfil" aoTocar={editar} profundidade={0.95}>
          <View style={[{ padding: 3, borderRadius: 50, backgroundColor: cor.branco }, sombra]}>
            <Avatar id={uid ?? "eu"} nome={nome} url={social?.avatarUrl ?? null} tamanho={88} />
          </View>
        </Tocavel>
        <Text
          numberOfLines={2}
          style={{
            ...fonte.display,
            ...escala.titulo1,
            letterSpacing: -0.2,
            color: cor.texto,
            textAlign: "center",
            marginTop: espaco.xs,
          }}
        >
          {nome}
        </Text>
        {social?.handle && COMUNIDADE_NO_APP ? <T tipo="apagado">@{social.handle}</T> : null}
        {social && !cuidadoDaSessao && COMUNIDADE_NO_APP ? (
          <Linha estilo={{ gap: espaco.lg }}>
            <Contagem valor={social.seguidores} rotulo="seguidores" />
            <Contagem valor={social.seguindo} rotulo="seguindo" />
          </Linha>
        ) : null}
        {social?.bio && COMUNIDADE_NO_APP ? <T centro>{social.bio}</T> : null}
        {social && !cuidadoDaSessao && COMUNIDADE_NO_APP ? (
          <Pilula
            texto={social.publico ? "Perfil público" : "Perfil fechado"}
            fundo={cor.apagado}
            corTexto={cor.texto}
          />
        ) : null}
        <Linha estilo={{ gap: espaco.sm, marginTop: espaco.xs }}>
          <Botao rotulo="Editar perfil" tipo="suave" tamanho="compacto" aoTocar={editar} />
          {/* O espelho: no Modo Cuidado ninguém a vê na rede, então não há o que mostrar. */}
          {uid && !cuidadoDaSessao && COMUNIDADE_NO_APP ? (
            <Botao
              rotulo="Ver como os outros veem"
              tipo="suave"
              tamanho="compacto"
              aoTocar={() => router.push(rota(`/comunidade/perfil/${uid}?como=estranha`) as never)}
            />
          ) : null}
        </Linha>
      </View>
      {leitura === "falhou" ? (
        <NaoConsegueLer
          sossego="O seu perfil continua guardado."
          aoTentar={() => {
            setLeitura("carregando");
            void carregar();
          }}
        />
      ) : null}

      {/* ── A conta ── */}
      <SecaoDeAjustes>
        <LinhaDeAjuste
          Icone={HeartPulse}
          tinta={cor.primaria}
          titulo={SOS_NO_APP ? "Seus dados e o SOS" : "Seus dados"}
          aoTocar={() => router.push(rota("/perfil/dados") as never)}
        />
        <LinhaDeAjuste
          Icone={Bell}
          tinta={cor.atencao}
          titulo="Lembretes"
          valor={valorDosLembretes}
          aoTocar={() => router.push(rota("/lembretes") as never)}
        />
        <LinhaDeAjuste
          Icone={Feather}
          tinta={cor.textoApagado}
          titulo="Modo Cuidado"
          valor={cuidado ? "Ligado" : "Desligado"}
          carregando={trocandoCuidado}
          rotulo={`Modo Cuidado, ${cuidado ? "ligado" : "desligado"}`}
          dica={cuidado ? "Toque para desligar" : "Toque para ligar"}
          aoTocar={() => pedirCuidado(!cuidado)}
        />
        {COMUNIDADE_NO_APP ? (
          <LinhaDeAjuste
            Icone={Ban}
            tinta={cor.urgente}
            titulo="Pessoas bloqueadas"
            aoTocar={() => router.push(rota("/comunidade/bloqueados") as never)}
          />
        ) : null}
      </SecaoDeAjustes>

      {/* O plano completo: só com a assinatura ligada, e nunca no Modo Cuidado. */}
      {ASSINATURA_NO_APP && !cuidadoDaSessao ? <SecaoDoPlano /> : null}

      {IA_NO_APP ? <CartaoDaPermissaoDeIA /> : null}

      {/* O contato publicado (Apple 1.2: um jeito fácil de falar com quem cuida
          do app) e os documentos do APP (fase 4), em telas próprias. */}
      <SecaoDeAjustes
        titulo="Ajuda e documentos"
        rodape={`Dúvidas sobre o app ou a sua conta: ${CONTATO_EMAIL}`}
      >
        <LinhaDeAjuste
          Icone={Mail}
          tinta={cor.chutes}
          titulo="Fale com a gente"
          aoTocar={() => abrir(`mailto:${CONTATO_EMAIL}`)}
        />
        <LinhaDeAjuste
          Icone={FileText}
          tinta={cor.agenda}
          titulo="Termos de uso"
          aoTocar={() => router.push(rota("/termos") as never)}
        />
        <LinhaDeAjuste
          Icone={Lock}
          tinta={cor.saude}
          titulo="Política de privacidade"
          aoTocar={() => router.push(rota("/privacidade") as never)}
        />
        <LinhaDeAjuste
          Icone={Download}
          tinta={cor.jogo}
          titulo="Baixar uma cópia dos meus dados"
          carregando={baixando}
          seta={false}
          aoTocar={() => void baixarCopia()}
        />
      </SecaoDeAjustes>

      <SecaoDeAjustes>
        <LinhaDeAjuste titulo="Sair da conta" perigo centro aoTocar={() => void esquecerAConta()} />
      </SecaoDeAjustes>

      {excluindo === "fechado" ? (
        <SecaoDeAjustes>
          <LinhaDeAjuste
            titulo="Excluir minha conta"
            perigo
            centro
            aoTocar={() => setExcluindo("aberto")}
          />
        </SecaoDeAjustes>
      ) : (
        <Cartao estilo={{ gap: espaco.md }}>
          <T tipo="subtitulo" cor={cor.urgente}>
            Excluir a conta
          </T>
          <T tipo="corpo" cor={cor.textoCorpo}>
            Apaga para sempre o seu perfil, a jornada, os registros de saúde, as publicações e as
            conversas. Não dá para desfazer.
          </T>
          <Campo
            rotulo={`Digite ${PALAVRA_DE_CONFIRMACAO} para confirmar`}
            value={palavra}
            onChangeText={setPalavra}
            autoCapitalize="characters"
          />
          {erroExcluir ? (
            <T tipo="apagado" cor={cor.urgente}>
              {erroExcluir}
            </T>
          ) : null}
          <Botao
            rotulo="Excluir para sempre"
            tipo="perigo"
            carregando={excluindo === "enviando"}
            aoTocar={() => void excluir()}
          />
          <Botao rotulo="Cancelar" tipo="texto" aoTocar={() => setExcluindo("fechado")} />
        </Cartao>
      )}

      {/* ── O pé ── */}
      <View style={{ gap: espaco.md, marginTop: espaco.sm }}>
        <AvisoMedico />
        {versao ? (
          <Text
            style={{
              ...fonte.normal,
              ...escala.nota,
              color: cor.textoApagado,
              textAlign: "center",
            }}
          >
            Mãe Esperta · versão {versao}
            {build ? ` (${build})` : ""}
          </Text>
        ) : null}
      </View>
    </TelaDaPilha>
  );
}

function Contagem({ valor, rotulo }: { valor: number | null; rotulo: string }) {
  if (valor == null) return null;
  return (
    <T tipo="apagado">
      <Text style={{ ...fonte.forte, color: cor.texto }}>{valor}</Text> {rotulo}
    </T>
  );
}
