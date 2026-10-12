import { HANDLE_MAX, normalizarHandle, recusaDoHandle } from "@/lib/mencoes";
import { LIMITE_DA_BIO, PERFIL_PUBLICO_PADRAO } from "@/lib/rede-social";
import { router } from "expo-router";
import { Ban, Camera, ChevronRight, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Botao, Campo, Cartao, Carregando, Linha, NaoConsegueLer, T, toque } from "~/componentes/base";
import { Cabecalho } from "~/componentes/comunidade/cabecalho";
import { FolhaDeOpcoes, useAviso } from "~/componentes/comunidade/folha";
import { Avatar } from "~/componentes/comunidade/imagem";
import { api } from "~/lib/comunidade/api";
import { escolherAvatar } from "~/lib/comunidade/fotos";
import { mensagemDoErro } from "~/lib/comunidade/regras";
import type { PerfilNaTela } from "~/servidor/rede";
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

type Pedido = { id: string; nome: string; avatarUrl: string | null };

/**
 * MEU PERFIL NA COMUNIDADE: ver, editar (nome, bio, foto, @), abrir ou fechar
 * o perfil, responder aos pedidos para seguir, e chegar aos bloqueados.
 *
 * ⚠️ O perfil NASCE FECHADO (`PERFIL_PUBLICO_PADRAO`), e a chave explica o
 * que muda antes de ela mudar.
 * ⚠️ `parcial: true` quer dizer que o servidor gravou só uma parte (banco sem
 * a coluna nova): a tela não afirma que a chave pegou.
 */
export default function MeuPerfil() {
  const [perfil, setPerfil] = useState<PerfilNaTela | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "falhou">("carregando");
  const [nome, setNome] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null | undefined>(undefined);
  const [handle, setHandle] = useState("");
  const [publico, setPublico] = useState(PERFIL_PUBLICO_PADRAO);
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
    setPedidos(r.pedidos);
    setNome(r.perfil.nome ?? "");
    setBio(r.perfil.bio ?? "");
    setHandle(r.perfil.handle ?? "");
    setPublico(r.perfil.publico ?? PERFIL_PUBLICO_PADRAO);
    setAvatar(undefined);
    setEstado("pronto");
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const fotoNaTela = avatar === undefined ? (perfil?.avatarUrl ?? null) : avatar;
  const mudou =
    !!perfil &&
    (nome.trim() !== (perfil.nome ?? "") || bio.trim() !== (perfil.bio ?? "") || avatar !== undefined);

  const salvar = async () => {
    if (!perfil || salvando) return;
    if (!nome.trim()) {
      aviso.mostrar("O nome não pode ficar vazio.", true);
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
    toque(false);
    aviso.mostrar(r.parcial ? "Salvo em parte. Uma das mudanças não pegou — tente de novo mais tarde." : "Perfil salvo.");
    setPerfil({ ...perfil, nome: nome.trim(), bio: bio.trim() || null, avatarUrl: fotoNaTela });
    setAvatar(undefined);
  };

  const trocarPublico = async (v: boolean) => {
    const antes = publico;
    setPublico(v);
    const r = await api.salvarPerfilSocial({ publico: v });
    if (!r.ok || r.parcial) {
      setPublico(antes);
      aviso.mostrar(r.ok ? "Não deu para mudar essa opção agora. Tente mais tarde." : mensagemDoErro(r.motivo, r.recado), true);
      return;
    }
    aviso.mostrar(v ? "Seu perfil agora é público." : "Seu perfil agora é fechado.");
  };

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

  const responder = (p: Pedido, aceitar: boolean) => {
    setPedidos((x) => x.filter((k) => k.id !== p.id));
    void api.responderPedido(p.id, aceitar).then((r) => {
      if (!r.ok) {
        setPedidos((x) => [p, ...x]);
        aviso.mostrar(mensagemDoErro(r.motivo, r.recado), true);
        return;
      }
      aviso.mostrar(aceitar ? `${p.nome} agora te acompanha.` : "Pedido recusado.");
    });
  };

  const handleMudou = !!perfil && normalizarHandle(handle.replace(/^@/, "")) !== (perfil.handle ?? "");

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: cor.fundo }}>
      <Cabecalho titulo="Meu perfil" />
      {estado === "carregando" ? <Carregando /> : null}
      {estado === "falhou" ? (
        <View style={{ padding: espaco.lg }}>
          <NaoConsegueLer sossego="Seu perfil e o que você publicou continuam guardados." aoTentar={() => void carregar()} />
        </View>
      ) : null}
      {estado === "pronto" && perfil ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={{ padding: espaco.lg, gap: espaco.lg, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
            {/* Quem sou */}
            <Cartao>
              <Linha estilo={{ gap: espaco.lg }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Trocar a foto de perfil"
                  onPress={() => setMenuFoto(true)}
                >
                  <Avatar id={perfil.id} nome={nome || perfil.nome} url={fotoNaTela} tamanho={76} />
                  <View style={{ position: "absolute", right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: cor.primaria, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: cor.cartao }}>
                    <Camera size={14} color={cor.branco} />
                  </View>
                </Pressable>
                <View style={{ flex: 1, gap: 2 }}>
                  <T tipo="subtitulo">{perfil.nome}</T>
                  {perfil.handle ? <T tipo="apagado">@{perfil.handle}</T> : null}
                  <Linha estilo={{ gap: espaco.lg, marginTop: 4 }}>
                    {perfil.seguidores != null ? <T tipo="apagado"><Text style={{ fontFamily: fonte.forte, color: cor.texto }}>{perfil.seguidores}</Text> seguidores</T> : null}
                    {perfil.seguindo != null ? <T tipo="apagado"><Text style={{ fontFamily: fonte.forte, color: cor.texto }}>{perfil.seguindo}</Text> seguindo</T> : null}
                  </Linha>
                </View>
              </Linha>
              <Botao rotulo="Ver como os outros veem" tipo="secundario" aoTocar={() => router.push(`/comunidade/perfil/${perfil.id}`)} />
            </Cartao>

            {/* Pedidos */}
            {pedidos.length > 0 ? (
              <View style={{ gap: espaco.sm }}>
                <T tipo="subtitulo">Pedidos para te acompanhar</T>
                {pedidos.map((p) => (
                  <Cartao key={p.id} estilo={{ paddingVertical: espaco.md }}>
                    <Linha>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Abrir o perfil de ${p.nome}`}
                        onPress={() => router.push(`/comunidade/perfil/${p.id}`)}
                        style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: espaco.sm, minHeight: ALVO_MINIMO }}
                      >
                        <Avatar id={p.id} nome={p.nome} url={p.avatarUrl} tamanho={40} />
                        <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonte.forte, fontSize: 15, color: cor.texto }}>{p.nome}</Text>
                      </Pressable>
                    </Linha>
                    <Linha>
                      <Botao rotulo="Aceitar" aoTocar={() => responder(p, true)} estilo={{ flex: 1 }} />
                      <Botao rotulo="Recusar" tipo="secundario" aoTocar={() => responder(p, false)} estilo={{ flex: 1 }} />
                    </Linha>
                  </Cartao>
                ))}
              </View>
            ) : null}

            {/* Público */}
            <Cartao>
              <Linha>
                <View style={{ flex: 1 }}>
                  <T tipo="rotulo">Perfil público</T>
                  <T tipo="apagado">{publico ? "Ligado" : "Desligado"}</T>
                </View>
                <Switch
                  value={publico}
                  onValueChange={(v) => void trocarPublico(v)}
                  trackColor={{ true: cor.primaria, false: cor.borda }}
                  accessibilityLabel="Perfil público"
                />
              </Linha>
              <T tipo="apagado" cor={cor.texto}>
                {publico
                  ? "Qualquer pessoa no app pode abrir o seu perfil e ver as publicações marcadas para todo mundo, e a busca encontra você. Seguir não precisa de aprovação."
                  : "Fechado: só quem você aceitou vê o seu perfil, e a busca não encontra você. Quem quiser te acompanhar manda um pedido, e você decide."}
              </T>
            </Cartao>

            {/* Editar */}
            <View style={{ gap: espaco.md }}>
              <T tipo="subtitulo">Editar</T>
              <Campo rotulo="Nome" value={nome} onChangeText={setNome} maxLength={60} autoCapitalize="words" />
              <View style={{ gap: 6 }}>
                <Campo
                  rotulo="Bio"
                  value={bio}
                  onChangeText={(t) => {
                    setBio(t);
                    if (erroBio) setErroBio(null);
                  }}
                  maxLength={LIMITE_DA_BIO}
                  multiline
                  placeholder="Uma frase sobre você"
                  style={{ minHeight: 80 }}
                />
                <Text style={{ alignSelf: "flex-end", fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado }}>
                  {bio.length}/{LIMITE_DA_BIO}
                </Text>
                {erroBio ? (
                  <View style={{ backgroundColor: cor.atencaoFundo, borderRadius: raio.md, padding: espaco.md }}>
                    <Text style={{ fontFamily: fonte.media, fontSize: 14, lineHeight: 20, color: cor.texto }}>{erroBio}</Text>
                  </View>
                ) : null}
              </View>
              <Botao rotulo="Salvar" aoTocar={() => void salvar()} carregando={salvando} desabilitado={!mudou} />
            </View>

            {/* @ */}
            <View style={{ gap: 6 }}>
              <T tipo="rotulo">Seu @</T>
              <Linha>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", minHeight: ALVO_MINIMO + 4, borderRadius: raio.md, borderWidth: 1, borderColor: erroHandle ? cor.atencao : cor.borda, backgroundColor: cor.cartao, paddingLeft: espaco.md }}>
                  <Text style={{ fontFamily: fonte.forte, fontSize: 16, color: cor.textoApagado }}>@</Text>
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
                    placeholderTextColor={cor.textoApagado}
                    style={{ flex: 1, minHeight: ALVO_MINIMO, paddingHorizontal: 4, fontFamily: fonte.normal, fontSize: 16, color: cor.texto }}
                  />
                </View>
                <Botao rotulo="Salvar @" tipo="secundario" aoTocar={() => void salvarHandle()} carregando={salvandoHandle} desabilitado={!handleMudou} estilo={{ paddingHorizontal: espaco.lg }} />
              </Linha>
              <T tipo="apagado">Letras sem acento, números, ponto e sublinhado. Dá para trocar duas vezes a cada 14 dias.</T>
              {erroHandle ? <T tipo="apagado" cor={cor.atencao}>{erroHandle}</T> : null}
              {okHandle ? <T tipo="apagado" cor={cor.ok}>{okHandle}</T> : null}
            </View>

            {/* Bloqueados */}
            <Cartao aoTocar={() => router.push("/comunidade/bloqueados")} rotuloAcessivel="Pessoas bloqueadas">
              <Linha>
                <Ban size={20} color={cor.textoApagado} />
                <T tipo="rotulo" estilo={{ flex: 1 }}>
                  Pessoas bloqueadas
                </T>
                <ChevronRight size={20} color={cor.textoApagado} />
              </Linha>
            </Cartao>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : null}

      <FolhaDeOpcoes
        aberta={menuFoto}
        aoFechar={() => setMenuFoto(false)}
        titulo="Foto de perfil"
        opcoes={[
          {
            rotulo: "Escolher da galeria",
            sub: "A foto fica quadrada. Toque em Salvar depois.",
            icone: <Camera size={22} color={cor.texto} />,
            aoTocar: () =>
              setTimeout(() => {
                void escolherAvatar().then((r) => {
                  if (r.ok) setAvatar(r.foto);
                  else if (r.motivo === "falhou") aviso.mostrar("Não conseguimos preparar essa foto. Tente outra.", true);
                });
              }, 500),
          },
          ...(fotoNaTela
            ? [
                {
                  rotulo: "Remover a foto",
                  sub: "Volta a inicial do seu nome. Toque em Salvar depois.",
                  icone: <Trash2 size={22} color={cor.urgente} />,
                  perigo: true,
                  aoTocar: () => setAvatar(null),
                },
              ]
            : []),
        ]}
      />
      {aviso.elemento}
    </SafeAreaView>
  );
}
