import { useLocalSearchParams } from "expo-router";
import { Flag, Send, Trash2, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Cartao, Carregando, NaoConsegueLer, T, toque } from "~/componentes/base";
import { useAcoesDosPosts } from "~/componentes/comunidade/acoes";
import { Cabecalho, voltar } from "~/componentes/comunidade/cabecalho";
import { ConversaNaTela, type AcoesDoComentario } from "~/componentes/comunidade/comentarios";
import { FolhaDeOpcoes, useAviso, type Opcao } from "~/componentes/comunidade/folha";
import { CartaoDoPost } from "~/componentes/comunidade/post";
import { FolhaDasRegras, FolhaDeDenuncia } from "~/componentes/comunidade/regras";
import { api } from "~/lib/comunidade/api";
import {
  comCurtida,
  LIMITE_DO_COMENTARIO,
  mensagemDoErro,
  montarConversas,
  mostraCampoDeComentar,
} from "~/lib/comunidade/regras";
import { useRegrasDaComunidade } from "~/lib/comunidade/usar-regras";
import { useSessao } from "~/lib/sessao";
import type { ComentarioNaTela, PostNaTela } from "~/servidor/rede";
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

type Comentarios = {
  lista: ComentarioNaTela[];
  abertos: boolean;
  possoComentar: boolean;
};

/**
 * UM POST E A CONVERSA DELE.
 *
 * ⚠️ O campo de comentar só existe com `abertos && possoComentar` — campo que
 * aceita o texto e o servidor recusa depois é botão que promete e não cumpre.
 * ⚠️ Comentar com sucesso não devolve o comentário: a lista é lida de novo.
 */
export default function TelaDoPost() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = String(id ?? "");
  const [posts, setPosts] = useState<PostNaTela[]>([]);
  const [estadoPost, setEstadoPost] = useState<"carregando" | "pronto" | "indisponivel" | "falhou">("carregando");
  const [comentarios, setComentarios] = useState<Comentarios | null>(null);
  const [estadoCom, setEstadoCom] = useState<"carregando" | "pronto" | "falhou">("carregando");
  const [texto, setTexto] = useState("");
  const [respondendo, setRespondendo] = useState<ComentarioNaTela | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [recusa, setRecusa] = useState<string | null>(null);
  const [menu, setMenu] = useState<ComentarioNaTela | null>(null);
  const [denunciando, setDenunciando] = useState<ComentarioNaTela | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const aviso = useAviso();
  const regras = useRegrasDaComunidade();
  const uid = useSessao().sessao?.user.id ?? null;

  const lerComentarios = useCallback(async () => {
    const r = await api.comentariosDoPost(postId);
    if (!r.ok) {
      setEstadoCom("falhou");
      return;
    }
    setComentarios({ lista: r.comentarios, abertos: r.abertos, possoComentar: r.possoComentar });
    setEstadoCom("pronto");
  }, [postId]);

  const carregar = useCallback(async () => {
    setAgora(Date.now());
    setEstadoPost("carregando");
    setEstadoCom("carregando");
    const [p] = await Promise.all([api.verPost(postId), lerComentarios()]);
    if (!p.ok) {
      setEstadoPost(p.motivo === "indisponivel" ? "indisponivel" : "falhou");
      return;
    }
    setPosts([p.post]);
    setEstadoPost("pronto");
  }, [postId, lerComentarios]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const { acoes, elementos } = useAcoesDosPosts({
    mudar: setPosts,
    aviso: aviso.mostrar,
    exigir: regras.exigir,
    aoArquivado: () => setTimeout(voltar, 600),
  });

  /* Bloqueou a autora pelo ⋯: o post sai da lista e a tela volta. */
  useEffect(() => {
    if (estadoPost === "pronto" && posts.length === 0) setTimeout(voltar, 600);
  }, [estadoPost, posts.length]);

  const conversas = useMemo(() => montarConversas(comentarios?.lista ?? []), [comentarios]);
  const campo = !!comentarios && mostraCampoDeComentar(comentarios);

  const trocarComentario = (cid: string, f: (c: ComentarioNaTela) => ComentarioNaTela) =>
    setComentarios((x) => (x ? { ...x, lista: x.lista.map((c) => (c.id === cid ? f(c) : c)) } : x));

  const acoesDoComentario: AcoesDoComentario = {
    aoResponder: campo ? (raiz) => setRespondendo(raiz) : undefined,
    aoCurtir: (c) =>
      regras.exigir(() => {
        const curtir = !c.euCurti;
        trocarComentario(c.id, (k) => comCurtida(k, curtir));
        void api.curtirComentario(c.id, curtir).then((r) => {
          if (!r.ok) {
            trocarComentario(c.id, (k) => comCurtida(k, !curtir));
            aviso.mostrar(mensagemDoErro(r.motivo, r.recado, "comentario"), true);
          }
        });
      }),
    aoMenu: setMenu,
  };

  const enviar = () => {
    const t = texto.trim();
    if (!t || enviando) return;
    regras.exigir(async () => {
      setEnviando(true);
      setRecusa(null);
      const r = await api.comentar(postId, t, respondendo?.id);
      setEnviando(false);
      if (!r.ok) {
        /* O recado da triagem é mostrado como chegou, junto do campo — e o
           texto fica, para ela reescrever em vez de começar do zero. */
        setRecusa(mensagemDoErro(r.motivo, r.recado, "comentario"));
        return;
      }
      setTexto("");
      setRespondendo(null);
      toque(false);
      await lerComentarios();
    });
  };

  const opcoesDoMenu: Opcao[] = menu
    ? [
        ...(menu.possoApagar
          ? [
              {
                rotulo: "Apagar comentário",
                icone: <Trash2 size={22} color={cor.urgente} />,
                perigo: true,
                aoTocar: () => {
                  const alvo = menu;
                  void api.apagarComentario(alvo.id).then(async (r) => {
                    if (!r.ok) return aviso.mostrar(mensagemDoErro(r.motivo, r.recado, "comentario"), true);
                    aviso.mostrar("Comentário apagado.");
                    await lerComentarios();
                  });
                },
              },
            ]
          : []),
        ...(menu.souOAutor || menu.autorId === uid
          ? []
          : [
              {
                rotulo: "Denunciar comentário",
                sub: "A equipe revê em até 24 horas.",
                icone: <Flag size={22} color={cor.urgente} />,
                perigo: true,
                aoTocar: () => {
                  const alvo = menu;
                  setTimeout(() => setDenunciando(alvo), 300);
                },
              },
            ]),
      ]
    : [];

  const post = posts[0];

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: cor.fundo }}>
      <Cabecalho titulo="Publicação" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ paddingVertical: espaco.lg, gap: espaco.lg }} keyboardShouldPersistTaps="handled">
          {estadoPost === "carregando" ? <Carregando /> : null}
          {estadoPost === "indisponivel" ? (
            <Cartao estilo={{ marginHorizontal: espaco.lg }}>
              <T tipo="subtitulo">Esta publicação não está disponível</T>
              <T tipo="apagado">Ela pode ter sido arquivada pela autora.</T>
            </Cartao>
          ) : null}
          {estadoPost === "falhou" ? (
            <View style={{ marginHorizontal: espaco.lg }}>
              <NaoConsegueLer sossego="A publicação continua lá." aoTentar={() => void carregar()} />
            </View>
          ) : null}
          {post ? <CartaoDoPost post={post} agora={agora} acoes={acoes} textoInteiro /> : null}

          {estadoPost === "pronto" && post ? (
            <View style={{ marginHorizontal: espaco.lg, gap: espaco.md }}>
              <T tipo="subtitulo">Comentários</T>
              {estadoCom === "carregando" ? <Carregando texto="Carregando os comentários…" /> : null}
              {estadoCom === "falhou" ? (
                <NaoConsegueLer sossego="Os comentários continuam lá." aoTentar={() => void lerComentarios()} />
              ) : null}
              {estadoCom === "pronto" && conversas.length === 0 ? (
                <T tipo="apagado">
                  {campo ? "Ninguém comentou ainda. Que tal ser a primeira?" : "Ninguém comentou ainda."}
                </T>
              ) : null}
              {conversas.map((c) => (
                <ConversaNaTela key={c.raiz.id} conversa={c} agora={agora} acoes={acoesDoComentario} />
              ))}
              {estadoCom === "pronto" && comentarios && !comentarios.abertos ? (
                <T tipo="apagado">A autora fechou os comentários desta publicação.</T>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {campo && post ? (
          <View style={{ borderTopWidth: 1, borderTopColor: cor.borda, backgroundColor: cor.cartao, paddingHorizontal: espaco.md, paddingVertical: espaco.sm, gap: espaco.xs }}>
            {recusa ? (
              <View style={{ backgroundColor: cor.atencaoFundo, borderRadius: raio.md, padding: espaco.md }}>
                <Text style={{ fontFamily: fonte.media, fontSize: 14, lineHeight: 20, color: cor.texto }}>{recusa}</Text>
              </View>
            ) : null}
            {respondendo ? (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ flex: 1, fontFamily: fonte.media, fontSize: 13, color: cor.textoApagado }}>
                  Respondendo a {respondendo.autorNome}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cancelar a resposta"
                  onPress={() => setRespondendo(null)}
                  style={{ width: ALVO_MINIMO, height: ALVO_MINIMO - 8, alignItems: "center", justifyContent: "center" }}
                >
                  <X size={18} color={cor.textoApagado} />
                </Pressable>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: espaco.sm }}>
              <TextInput
                value={texto}
                onChangeText={(t) => {
                  setTexto(t);
                  if (recusa) setRecusa(null);
                }}
                placeholder={respondendo ? "Escreva a sua resposta…" : "Escreva um comentário…"}
                placeholderTextColor={cor.textoApagado}
                accessibilityLabel="Comentário"
                multiline
                maxLength={LIMITE_DO_COMENTARIO}
                style={{
                  flex: 1,
                  minHeight: ALVO_MINIMO,
                  maxHeight: 120,
                  borderRadius: raio.md,
                  borderWidth: 1,
                  borderColor: cor.borda,
                  backgroundColor: cor.fundo,
                  paddingHorizontal: espaco.md,
                  paddingTop: 11,
                  paddingBottom: 11,
                  fontFamily: fonte.normal,
                  fontSize: 16,
                  color: cor.texto,
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Enviar comentário"
                accessibilityState={{ disabled: !texto.trim() || enviando, busy: enviando }}
                disabled={!texto.trim() || enviando}
                onPress={enviar}
                style={{
                  width: ALVO_MINIMO,
                  height: ALVO_MINIMO,
                  borderRadius: ALVO_MINIMO / 2,
                  backgroundColor: texto.trim() ? cor.primaria : cor.borda,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {enviando ? <ActivityIndicator color={cor.branco} /> : <Send size={20} color={cor.branco} />}
              </Pressable>
            </View>
            {texto.length > LIMITE_DO_COMENTARIO - 80 ? (
              <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado, textAlign: "right" }}>
                {texto.length}/{LIMITE_DO_COMENTARIO}
              </Text>
            ) : null}
          </View>
        ) : null}
      </KeyboardAvoidingView>

      {elementos}
      <FolhaDeOpcoes aberta={!!menu} aoFechar={() => setMenu(null)} opcoes={opcoesDoMenu} />
      <FolhaDeDenuncia
        aberta={!!denunciando}
        aoFechar={() => setDenunciando(null)}
        oQue="comentário"
        aoEnviar={(motivo) => {
          const alvo = denunciando;
          if (!alvo) return;
          void api.denunciarComentario(alvo.id, motivo).then((r) => {
            if (!r.ok) return aviso.mostrar(mensagemDoErro(r.motivo, r.recado, "comentario"), true);
            aviso.mostrar("Denúncia enviada. A equipe revê em até 24 horas.");
          });
        }}
      />
      <FolhaDasRegras {...regras.folha} />
      {aviso.elemento}
    </SafeAreaView>
  );
}
