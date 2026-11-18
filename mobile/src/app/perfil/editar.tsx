import { HANDLE_MAX, normalizarHandle, recusaDoHandle } from "@/lib/mencoes";
import { LIMITE_DA_BIO, PERFIL_PUBLICO_PADRAO } from "@/lib/rede-social";
import { Camera, Image as ImageIcon, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Switch, Text, TextInput, View } from "react-native";
import {
  CampoLivre,
  LinhaDeCampo,
  RECUO_SEM_ICONE,
  SecaoDeAjustes,
} from "~/componentes/ajustes";
import {
  Botao,
  Cartao,
  Carregando,
  Linha,
  NaoConsegueLer,
  sucesso,
  T,
  Tocavel,
} from "~/componentes/base";
import { AcaoDoTopo, TelaDaPilha, voltarOu } from "~/componentes/cabecalho";
import { FolhaDeOpcoes, useAviso } from "~/componentes/comunidade/folha";
import { Avatar } from "~/componentes/comunidade/imagem";
import { api } from "~/lib/comunidade/api";
import { escolherAvatar } from "~/lib/comunidade/fotos";
import { guardarMeuPerfilSocial } from "~/lib/comunidade/meu-perfil";
import { ehOfensivo, mensagemDoErro, recadoDaOfensa } from "~/lib/comunidade/regras";
import { useSessao } from "~/lib/sessao";
import type { PerfilNaTela } from "~/servidor/rede";
import { ALVO_MINIMO, canto, cor, escala, espaco, fonte, sombra } from "~/tema";
import { COMUNIDADE_NO_APP } from "~/config";

/**
 * EDITAR PERFIL — o que a rede vê dela: a foto, o nome, a bio, o @, se o
 * perfil é aberto ou fechado, e o que aparece nele (a semana e o nome do bebê).
 *
 * 18/11/2026 (a vistoria): uma FOLHA, como a de editar um contato no iPhone:
 * "Cancelar" e "Salvar" no alto (o Salvar só acende quando algo muda e fecha a
 * folha), a foto com o selo da câmera (uma porta só) e o nome num campo em
 * linha. A casca a apresenta como folha (`formSheet`); empilhada, funciona
 * igual.
 *
 * Era o "Meu perfil" da Comunidade (`/comunidade/eu`). Na fase 3 o Perfil virou
 * um só, e o NOME dela se grava só aqui, pelas regras da Comunidade
 * (obrigatório, até 60, sem ofensa) — antes, o Perfil o gravava também, sem
 * regra nenhuma. Depois de salvar, a saudação do Hoje e do Bebê já diz o nome
 * novo, e a foto do topo das abas já é a nova.
 *
 * ⚠️ O perfil NASCE FECHADO (`PERFIL_PUBLICO_PADRAO`), e a chave explica o
 * que muda antes de ela mudar. A semana e o nome do bebê nascem escondidos
 * (o servidor), e no Modo Cuidado essas duas chaves nem aparecem.
 * ⚠️ `parcial: true` quer dizer que o servidor gravou só uma parte (banco sem
 * a coluna nova): a tela não afirma que a chave pegou.
 *
 * Bancada: /perfil/editar?bancada=1 [&luto=1]
 */
export default function EditarPerfil() {
  const { sessao, recarregarPerfil, cuidado } = useSessao();
  const uid = sessao?.user.id ?? null;
  const [perfil, setPerfil] = useState<PerfilNaTela | null>(null);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "falhou">("carregando");
  const [nome, setNome] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null | undefined>(undefined);
  const [handle, setHandle] = useState("");
  const [publico, setPublico] = useState(PERFIL_PUBLICO_PADRAO);
  const [mostrarSemana, setMostrarSemana] = useState(false);
  const [mostrarBebe, setMostrarBebe] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvandoHandle, setSalvandoHandle] = useState(false);
  const [erroBio, setErroBio] = useState<string | null>(null);
  const [erroHandle, setErroHandle] = useState<string | null>(null);
  const [okHandle, setOkHandle] = useState<string | null>(null);
  const [menuFoto, setMenuFoto] = useState(false);
  const aviso = useAviso();

  const carregar = useCallback(async () => {
    setEstado("carregando");
    const r = await api.meuPerfilSocial();
    if (!r.ok) {
      setEstado("falhou");
      return;
    }
    setPerfil(r.perfil);
    setNome(r.perfil.nome ?? "");
    setBio(r.perfil.bio ?? "");
    setHandle(r.perfil.handle ?? "");
    setPublico(r.perfil.publico ?? PERFIL_PUBLICO_PADRAO);
    setMostrarSemana(r.perfil.mostrarSemana === true);
    setMostrarBebe(r.perfil.mostrarBebe === true);
    setAvatar(undefined);
    setEstado("pronto");
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const fotoNaTela = avatar === undefined ? (perfil?.avatarUrl ?? null) : avatar;
  const mudou =
    !!perfil &&
    (nome.trim() !== (perfil.nome ?? "") ||
      bio.trim() !== (perfil.bio ?? "") ||
      avatar !== undefined);

  const salvar = async () => {
    if (!perfil || salvando) return;
    if (!nome.trim()) {
      aviso.mostrar("O nome não pode ficar vazio.", true);
      return;
    }
    /* O filtro de ofensa antes de sair do aparelho (Apple 1.2). */
    if (ehOfensivo(nome)) {
      aviso.mostrar(
        "O nome não pode ser salvo assim: ele tem palavras que as regras do app não permitem.",
        true,
      );
      return;
    }
    if (ehOfensivo(bio)) {
      setErroBio(recadoDaOfensa("bio"));
      return;
    }
    setSalvando(true);
    setErroBio(null);
    const r = await api.salvarPerfilSocial({
      nome: nome.trim(),
      bio: bio.trim() || null,
      ...(avatar !== undefined ? { avatar } : {}),
    });
    setSalvando(false);
    if (!r.ok) {
      const m = mensagemDoErro(r.motivo, r.recado);
      if (r.motivo === "bio_clinica") setErroBio(m);
      else aviso.mostrar(m, true);
      return;
    }
    sucesso();
    setPerfil({ ...perfil, nome: nome.trim(), bio: bio.trim() || null, avatarUrl: fotoNaTela });
    setAvatar(undefined);
    /* O nome é o `display_name` do perfil: a saudação do Hoje e do Bebê o lê
       da sessão; a foto do topo das abas, da memória do perfil social. */
    if (uid) guardarMeuPerfilSocial(uid, { nome: nome.trim(), avatarUrl: fotoNaTela });
    void recarregarPerfil();
    /* Salvar fecha a folha, como nos apps da Apple: o Perfil relê ao voltar.
       Fica aberta se algo não pegou, ou se há mais a mexer (a Comunidade). */
    if (r.parcial) {
      aviso.mostrar("Salvo em parte. Uma das mudanças não pegou. Tente de novo mais tarde.", true);
      return;
    }
    if (COMUNIDADE_NO_APP) aviso.mostrar("Perfil salvo.");
    else voltarOu("/perfil");
  };

  /** Uma chave que grava na hora: volta atrás se o servidor não aceitou. */
  const trocarChave = async (
    campo: "publico" | "mostrarSemana" | "mostrarBebe",
    v: boolean,
    antes: boolean,
    mudar: (x: boolean) => void,
    feito: string,
  ) => {
    mudar(v);
    const r = await api.salvarPerfilSocial({ [campo]: v });
    if (!r.ok || r.parcial) {
      mudar(antes);
      aviso.mostrar(
        r.ok
          ? "Não deu para mudar essa opção agora. Tente mais tarde."
          : mensagemDoErro(r.motivo, r.recado),
        true,
      );
      return;
    }
    aviso.mostrar(feito);
  };

  const trocarPublico = (v: boolean) =>
    trocarChave(
      "publico",
      v,
      publico,
      setPublico,
      v ? "Seu perfil agora é público." : "Seu perfil agora é fechado.",
    );

  const salvarHandle = async () => {
    const h = normalizarHandle(handle.replace(/^@/, ""));
    setOkHandle(null);
    const local = recusaDoHandle(h);
    if (local) {
      setErroHandle(mensagemDoErro(local));
      return;
    }
    setErroHandle(null);
    setSalvandoHandle(true);
    const r = await api.escolherHandle(h);
    setSalvandoHandle(false);
    if (!r.ok) {
      setErroHandle(mensagemDoErro(r.motivo, r.recado));
      return;
    }
    /* O servidor normaliza: mostra o @ que FICOU, não o que ela digitou. */
    setHandle(r.handle);
    setOkHandle(`Pronto: seu @ agora é @${r.handle}`);
    if (perfil) setPerfil({ ...perfil, handle: r.handle });
  };

  const handleMudou =
    !!perfil && normalizarHandle(handle.replace(/^@/, "")) !== (perfil.handle ?? "");

  const fechar = () => voltarOu("/perfil");

  return (
    <TelaDaPilha
      titulo="Editar perfil"
      voltarPara="/perfil"
      sobre={aviso.elemento}
      esquerda={<AcaoDoTopo rotulo="Cancelar" aoTocar={fechar} />}
      direita={
        <AcaoDoTopo
          rotulo="Salvar"
          principal
          aoTocar={() => void salvar()}
          carregando={salvando}
          desabilitado={!mudou}
        />
      }
    >
      {estado === "carregando" ? <Carregando /> : null}
      {estado === "falhou" ? (
        <NaoConsegueLer
          sossego="Seu perfil e o que você publicou continuam guardados."
          aoTentar={() => void carregar()}
        />
      ) : null}
      {estado === "pronto" && perfil ? (
        <>
          {/* A foto: o selo da câmera é a porta (uma só). */}
          <View style={{ alignItems: "center", paddingTop: espaco.sm }}>
            <Tocavel
              rotulo="Trocar a foto de perfil"
              aoTocar={() => setMenuFoto(true)}
              profundidade={0.95}
            >
              <View style={[{ padding: 3, borderRadius: 51, backgroundColor: cor.branco }, sombra]}>
                <Avatar id={perfil.id} nome={nome || perfil.nome} url={fotoNaTela} tamanho={96} />
              </View>
              <View
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: 0,
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: cor.primaria,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 3,
                  borderColor: cor.branco,
                }}
              >
                <Camera size={16} strokeWidth={2.2} color={cor.branco} />
              </View>
            </Tocavel>
          </View>

          {/* O nome e, com a Comunidade (`COMUNIDADE_NO_APP`), a bio: um Salvar
              para os três, no alto. */}
          <SecaoDeAjustes
            recuo={RECUO_SEM_ICONE}
            rodape={
              COMUNIDADE_NO_APP
                ? undefined
                : "A foto e o nome aparecem para as suas amigas no app."
            }
          >
            <LinhaDeCampo
              rotulo="Nome"
              value={nome}
              onChangeText={setNome}
              maxLength={60}
              autoCapitalize="words"
              placeholder="Seu nome"
              returnKeyType="done"
            />
            {COMUNIDADE_NO_APP ? (
              <CampoLivre
                rotulo="Bio"
                value={bio}
                onChangeText={(t) => {
                  setBio(t);
                  if (erroBio) setErroBio(null);
                }}
                maxLength={LIMITE_DA_BIO}
                placeholder="Uma frase sobre você"
              />
            ) : null}
          </SecaoDeAjustes>
          {COMUNIDADE_NO_APP ? (
            <View style={{ gap: espaco.sm, marginTop: -espaco.md }}>
              <Text
                style={{
                  alignSelf: "flex-end",
                  ...fonte.normal,
                  ...escala.nota,
                  color: cor.textoApagado,
                  paddingHorizontal: espaco.lg,
                }}
              >
                {bio.length}/{LIMITE_DA_BIO}
              </Text>
              {erroBio ? (
                <View
                  style={{
                    backgroundColor: cor.atencaoFundo,
                    borderRadius: canto.campo,
                    padding: espaco.md,
                  }}
                >
                  <Text style={{ ...fonte.media, ...escala.legenda, color: cor.texto }}>
                    {erroBio}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {COMUNIDADE_NO_APP ? (
            <>
              {/* O @: tem limite de troca no servidor, então se salva à parte. */}
              <Cartao>
                <T tipo="rotulo">Seu @</T>
                <Linha>
                  <View
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      minHeight: ALVO_MINIMO + 4,
                      borderRadius: canto.campo,
                      backgroundColor: cor.apagado,
                      borderWidth: 1,
                      borderColor: erroHandle ? cor.atencao : "transparent",
                      paddingLeft: espaco.md,
                    }}
                  >
                    <Text style={{ ...fonte.forte, fontSize: 17, color: cor.textoApagado }}>@</Text>
                    <TextInput
                      value={handle}
                      onChangeText={(t) => {
                        setHandle(t.replace(/^@/, ""));
                        setErroHandle(null);
                        setOkHandle(null);
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={HANDLE_MAX}
                      accessibilityLabel="Seu @"
                      placeholder="seunome"
                      placeholderTextColor={cor.placeholder}
                      style={{
                        flex: 1,
                        minHeight: ALVO_MINIMO,
                        paddingHorizontal: 4,
                        ...fonte.normal,
                        fontSize: 17,
                        color: cor.texto,
                      }}
                    />
                  </View>
                  <Botao
                    rotulo="Salvar @"
                    tipo="suave"
                    tamanho="compacto"
                    aoTocar={() => void salvarHandle()}
                    carregando={salvandoHandle}
                    desabilitado={!handleMudou}
                  />
                </Linha>
                <T tipo="apagado">
                  Letras sem acento, números, ponto e sublinhado. Dá para trocar duas vezes a cada
                  14 dias.
                </T>
                {erroHandle ? (
                  <T tipo="apagado" cor={cor.atencao}>
                    {erroHandle}
                  </T>
                ) : null}
                {okHandle ? (
                  <T tipo="apagado" cor={cor.ok}>
                    {okHandle}
                  </T>
                ) : null}
              </Cartao>

              {/* Quem vê, e o que aparece: cada chave grava na hora. */}
              <Cartao estilo={{ gap: espaco.md }}>
                <T tipo="subtitulo">Quem vê o seu perfil</T>
                <Chave
                  rotulo="Perfil público"
                  valor={publico}
                  aoMudar={(v) => void trocarPublico(v)}
                />
                <T tipo="apagado" cor={cor.texto}>
                  {publico
                    ? "Qualquer pessoa no app pode abrir o seu perfil e ver as publicações marcadas para todo mundo, e a busca encontra você. Seguir não precisa de aprovação."
                    : "Fechado: só quem você aceitou vê o seu perfil, e a busca não encontra você. Quem quiser te acompanhar manda um pedido, e você decide."}
                </T>
                {/* No Modo Cuidado o perfil não fala do bebê: as duas chaves somem. */}
                {!cuidado ? (
                  <>
                    <Chave
                      rotulo="Mostrar a semana da gestação"
                      valor={mostrarSemana}
                      aoMudar={(v) =>
                        void trocarChave(
                          "mostrarSemana",
                          v,
                          mostrarSemana,
                          setMostrarSemana,
                          v ? "A semana aparece no seu perfil." : "A semana saiu do seu perfil.",
                        )
                      }
                    />
                    <Chave
                      rotulo="Mostrar o nome do bebê"
                      valor={mostrarBebe}
                      aoMudar={(v) =>
                        void trocarChave(
                          "mostrarBebe",
                          v,
                          mostrarBebe,
                          setMostrarBebe,
                          v
                            ? "O nome do bebê aparece no seu perfil."
                            : "O nome do bebê saiu do seu perfil.",
                        )
                      }
                    />
                    {/* As amigas recebem o nome do bebê do servidor com a chave ligada ou
                    não (amigas.functions.ts): a tela não pode prometer o contrário. */}
                    <T tipo="apagado">
                      Aparecem como um selo embaixo do seu nome, para quem pode abrir o seu perfil
                      na Comunidade. As suas amigas veem o nome do bebê de qualquer jeito, na
                      página de amiga.
                    </T>
                  </>
                ) : null}
              </Cartao>
            </>
          ) : null}
        </>
      ) : null}

      <FolhaDeOpcoes
        aberta={menuFoto}
        aoFechar={() => setMenuFoto(false)}
        titulo="Foto de perfil"
        opcoes={[
          {
            rotulo: "Escolher da galeria",
            sub: "A foto fica quadrada. Depois, toque em Salvar.",
            icone: <ImageIcon size={22} color={cor.texto} />,
            aoTocar: () =>
              setTimeout(() => {
                void escolherAvatar().then((r) => {
                  if (r.ok) setAvatar(r.foto);
                  else if (r.motivo === "falhou")
                    aviso.mostrar("Não conseguimos preparar essa foto. Tente outra.", true);
                });
              }, 500),
          },
          ...(fotoNaTela
            ? [
                {
                  rotulo: "Remover a foto",
                  sub: "Volta a inicial do seu nome. Depois, toque em Salvar.",
                  icone: <Trash2 size={22} color={cor.urgente} />,
                  perigo: true,
                  aoTocar: () => setAvatar(null),
                },
              ]
            : []),
        ]}
      />
    </TelaDaPilha>
  );
}

/** Uma chave com o rótulo ao lado (o alvo inteiro tem 44 pt). */
function Chave({
  rotulo,
  valor,
  aoMudar,
}: {
  rotulo: string;
  valor: boolean;
  aoMudar: (v: boolean) => void;
}) {
  return (
    <Linha estilo={{ minHeight: ALVO_MINIMO }}>
      <T tipo="rotulo" estilo={{ flex: 1 }}>
        {rotulo}
      </T>
      <Switch
        value={valor}
        onValueChange={aoMudar}
        trackColor={{ true: cor.primaria }}
        accessibilityLabel={rotulo}
      />
    </Linha>
  );
}
