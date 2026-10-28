import { router, useFocusEffect } from "expo-router";
import { Ban, Bell, ChevronRight, HeartPulse } from "lucide-react-native";
import { useCallback, useState, type ComponentType } from "react";
import { Alert, Platform, Pressable, Switch, Text, View } from "react-native";
import { AvisoMedico } from "~/componentes/aviso-medico";
import {
  Botao,
  Campo,
  Cartao,
  Linha,
  NaoConsegueLer,
  Pilula,
  T,
  Tela,
  toque,
} from "~/componentes/base";
import { CabecalhoDaPilha } from "~/componentes/cabecalho";
import { Avatar } from "~/componentes/comunidade/imagem";
import { rota } from "~/componentes/jornada/bancada";
import { CONTATO_EMAIL, IA_NO_APP } from "~/config";
import { limparRastrosLocais } from "~/lib/armazem";
import { ehBancada } from "~/lib/bancada";
import { api } from "~/lib/comunidade/api";
import { esquecerMeuPerfilSocial, guardarMeuPerfilSocial } from "~/lib/comunidade/meu-perfil";
import { CartaoDaPermissaoDeIA } from "~/lib/ia/PermissaoDeIA";
import { abrir, PRIVACIDADE, TERMOS } from "~/lib/links";
import { zerarSelos } from "~/lib/selos";
import { useSessao } from "~/lib/sessao";
import { excluirMinhaConta, ligarModoCuidado, PALAVRA_DE_CONFIRMACAO } from "~/servidor/conta";
import type { PerfilNaTela } from "~/servidor/rede";
import { supabase } from "~/servidor/supabase";
import { cor, espaco, fonte } from "~/tema";

/**
 * O PERFIL — um só (fase 3, a rede social no centro).
 *
 * No topo, ela como a rede a vê: a foto, o nome, o @, a bio, quem segue e é
 * seguida, e se o perfil é aberto ou fechado — com "Editar perfil" e "Ver como
 * os outros veem" (o espelho do servidor). Embaixo, a conta: os dados do bebê e
 * do SOS, o Modo Cuidado, os lembretes, as bloqueadas, os documentos, sair e
 * excluir a conta (exigência da Apple: excluir DENTRO do app).
 *
 * Antes eram dois "meu perfil" — este, com os dados, e o "Meu perfil" da
 * Comunidade, com a foto e a bio — e o mesmo nome se gravava pelos dois, com
 * regras diferentes. O `/comunidade/eu` antigo agora cai aqui.
 *
 * Bancada: /perfil?bancada=1 [&luto=1]
 */
export default function Perfil() {
  const { sessao, perfil, recarregarPerfil, cuidado: cuidadoDaSessao } = useSessao();
  const uid = sessao?.user.id ?? null;
  const [social, setSocial] = useState<PerfilNaTela | null>(null);
  const [leitura, setLeitura] = useState<"carregando" | "pronto" | "falhou">("carregando");
  const [recado, setRecado] = useState<{ texto: string; erro: boolean } | null>(null);
  const [cuidado, setCuidado] = useState(perfil?.care_mode === true);
  const [trocandoCuidado, setTrocandoCuidado] = useState(false);
  const [excluindo, setExcluindo] = useState<"fechado" | "aberto" | "enviando">("fechado");
  const [palavra, setPalavra] = useState("");
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);

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
        setRecado({
          texto: "Não conseguimos mudar o Modo Cuidado agora. Tente de novo.",
          erro: true,
        });
      }
    } catch {
      setRecado({ texto: "Sem conexão. O Modo Cuidado não foi alterado.", erro: true });
    } finally {
      setTrocandoCuidado(false);
    }
  }

  function pedirCuidado(on: boolean) {
    if (!on) return void trocarCuidado(false);
    const msg =
      "O app para de mostrar o bebê, a semana e as contagens. O SOS e o acolhimento continuam. Você pode desligar quando quiser.";
    if (Platform.OS === "web") return void trocarCuidado(true);
    Alert.alert("Ligar o Modo Cuidado?", msg, [
      { text: "Agora não", style: "cancel" },
      { text: "Ligar", onPress: () => void trocarCuidado(true) },
    ]);
  }

  /** A conta sai do aparelho: os rastros locais, o perfil e os selos da memória. */
  async function esquecerAConta() {
    await limparRastrosLocais();
    esquecerMeuPerfilSocial();
    zerarSelos();
    await supabase.auth.signOut().catch(() => {});
    router.replace("/entrar");
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
            ? "Esta é uma conta de médico — a exclusão passa pelo suporte."
            : "Não conseguimos excluir agora. Nada foi apagado; tente de novo.",
      );
    } catch {
      setErroExcluir("Sem conexão. Nada foi apagado; tente de novo com internet.");
    }
    setExcluindo("aberto");
  }

  const nome = social?.nome ?? perfil?.display_name ?? perfil?.full_name ?? "Você";

  return (
    <Tela bordas={["top", "bottom"]}>
      <CabecalhoDaPilha titulo="Perfil" voltarPara="/jornada" />

      {/* ── Ela, como a rede a vê ── */}
      <Cartao estilo={{ gap: espaco.md }}>
        <Linha estilo={{ gap: espaco.lg, alignItems: "center" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Editar a foto e o perfil"
            onPress={() => {
              toque();
              router.push(rota("/perfil/editar") as never);
            }}
          >
            <Avatar id={uid ?? "eu"} nome={nome} url={social?.avatarUrl ?? null} tamanho={76} />
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <T tipo="subtitulo" linhas={2}>
              {nome}
            </T>
            {social?.handle ? <T tipo="apagado">@{social.handle}</T> : null}
            {social && !cuidadoDaSessao ? (
              <Linha estilo={{ gap: espaco.lg, marginTop: 2 }}>
                <Contagem valor={social.seguidores} rotulo="seguidores" />
                <Contagem valor={social.seguindo} rotulo="seguindo" />
              </Linha>
            ) : null}
          </View>
        </Linha>
        {social?.bio ? <T>{social.bio}</T> : null}
        {social && !cuidadoDaSessao ? (
          <Pilula
            texto={social.publico ? "🌐 Perfil público" : "🔒 Perfil fechado"}
            fundo={cor.apagado}
            corTexto={cor.texto}
          />
        ) : null}
        {leitura === "falhou" ? (
          <NaoConsegueLer
            sossego="O seu perfil continua guardado."
            aoTentar={() => {
              setLeitura("carregando");
              void carregar();
            }}
          />
        ) : null}
        <Linha estilo={{ gap: espaco.sm }}>
          <Botao
            rotulo="Editar perfil"
            tipo="secundario"
            estilo={{ flex: 1 }}
            aoTocar={() => router.push(rota("/perfil/editar") as never)}
          />
          {/* O espelho: no Modo Cuidado ninguém a vê na rede, então não há o que mostrar. */}
          {uid && !cuidadoDaSessao ? (
            <Botao
              rotulo="Ver como os outros veem"
              tipo="secundario"
              estilo={{ flex: 1 }}
              aoTocar={() => router.push(rota(`/comunidade/perfil/${uid}?como=estranha`) as never)}
            />
          ) : null}
        </Linha>
      </Cartao>

      {/* ── A conta ── */}
      <LinhaDoPerfil
        Icone={HeartPulse}
        titulo="Seus dados e o SOS"
        texto={
          cuidadoDaSessao
            ? "O contato de emergência, a sua ficha e quem acompanha você."
            : "O bebê, o contato de emergência, a sua ficha e quem acompanha a sua gestação."
        }
        aoTocar={() => router.push(rota("/perfil/dados") as never)}
      />

      <Cartao>
        <Linha estilo={{ justifyContent: "space-between" }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T tipo="rotulo">Modo Cuidado</T>
            <T tipo="apagado" estilo={{ fontSize: 14 }}>
              Para quando a gestação não seguiu. O app para de falar do bebê; o SOS continua.
            </T>
          </View>
          <Switch
            accessibilityLabel="Modo Cuidado"
            value={cuidado}
            disabled={trocandoCuidado}
            onValueChange={pedirCuidado}
            trackColor={{ true: cor.primaria, false: cor.borda }}
          />
        </Linha>
      </Cartao>
      {recado ? (
        <T tipo="corpo" cor={recado.erro ? cor.urgente : cor.ok}>
          {recado.texto}
        </T>
      ) : null}

      <LinhaDoPerfil
        Icone={Bell}
        titulo="Lembretes"
        texto="O cuidado de hoje, a semana nova, a meditação e as consultas."
        aoTocar={() => router.push(rota("/lembretes") as never)}
      />
      <LinhaDoPerfil
        Icone={Ban}
        titulo="Pessoas bloqueadas"
        texto="Quem você bloqueou na Comunidade."
        aoTocar={() => router.push(rota("/comunidade/bloqueados") as never)}
      />

      {IA_NO_APP ? <CartaoDaPermissaoDeIA /> : null}

      <AvisoMedico />

      {/* O contato publicado (Apple 1.2: app com conteúdo de usuárias precisa
          de um jeito fácil de falar com quem cuida dele). */}
      <Cartao>
        <T tipo="rotulo">Fale com a gente</T>
        <T tipo="apagado">
          Dúvidas sobre o app, a sua conta ou a Comunidade: {CONTATO_EMAIL}. Assuntos de saúde são
          com o seu médico — em emergência, ligue 192.
        </T>
        <Botao
          rotulo="Escrever um e-mail"
          tipo="texto"
          aoTocar={() => abrir(`mailto:${CONTATO_EMAIL}`)}
        />
      </Cartao>

      <Cartao>
        <Botao rotulo="Termos de uso" tipo="texto" aoTocar={() => abrir(TERMOS)} />
        <Botao rotulo="Política de privacidade" tipo="texto" aoTocar={() => abrir(PRIVACIDADE)} />
        <Botao rotulo="Sair da conta" tipo="secundario" aoTocar={() => void esquecerAConta()} />
      </Cartao>

      <Cartao>
        {excluindo === "fechado" ? (
          <Botao rotulo="Excluir minha conta" tipo="texto" aoTocar={() => setExcluindo("aberto")} />
        ) : (
          <>
            <T tipo="subtitulo" cor={cor.urgente}>
              Excluir a conta
            </T>
            <T tipo="corpo">
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
              <T tipo="corpo" cor={cor.urgente}>
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
          </>
        )}
      </Cartao>
    </Tela>
  );
}

function Contagem({ valor, rotulo }: { valor: number | null; rotulo: string }) {
  if (valor == null) return null;
  return (
    <T tipo="apagado">
      <Text style={{ fontFamily: fonte.forte, color: cor.texto }}>{valor}</Text> {rotulo}
    </T>
  );
}

/** Uma linha da conta: ícone, título, o que tem lá e a seta. */
function LinhaDoPerfil({
  Icone,
  titulo,
  texto,
  aoTocar,
}: {
  Icone: ComponentType<{ size?: number; color?: string }>;
  titulo: string;
  texto: string;
  aoTocar: () => void;
}) {
  return (
    <Cartao aoTocar={aoTocar} rotuloAcessivel={titulo}>
      <Linha estilo={{ gap: espaco.md }}>
        <Icone size={22} color={cor.primariaEscura} />
        <View style={{ flex: 1, gap: 2 }}>
          <T tipo="rotulo">{titulo}</T>
          <T tipo="apagado" estilo={{ fontSize: 14 }}>
            {texto}
          </T>
        </View>
        <ChevronRight size={20} color={cor.textoApagado} />
      </Linha>
    </Cartao>
  );
}
