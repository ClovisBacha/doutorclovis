import { veuDoPost } from "@/lib/conteudo-sensivel";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Ban, EyeOff, Flag, Images, MoreHorizontal } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Botao, Cartao, Carregando, NaoConsegueLer, Pilula, T, toque } from "~/componentes/base";
import { BotaoIcone, Cabecalho, voltar } from "~/componentes/comunidade/cabecalho";
import { Folha, FolhaDeOpcoes, useAviso } from "~/componentes/comunidade/folha";
import { Avatar, fonteDaImagem } from "~/componentes/comunidade/imagem";
import { FolhaDeBloqueio, FolhaDeDenuncia } from "~/componentes/comunidade/regras";
import { api } from "~/lib/comunidade/api";
import {
  contagemCurta,
  corDaInicial,
  fotosDoPost,
  juntarPaginas,
  mensagemDoErro,
  rotuloDoBotaoSeguir,
  temMais,
  type Vinculo,
} from "~/lib/comunidade/regras";
import { useSessao } from "~/lib/sessao";
import type { PerfilNaTela, PostNaTela } from "~/servidor/rede";
import { cor, espaco, fonte } from "~/tema";

const COLUNAS = 3;
const VAO = 2;

/**
 * O PERFIL DE ALGUÉM: cabeçalho, seguir, a grade de publicações e o ⋯.
 *
 * ⚠️ "indisponivel" é UM silêncio só — perfil que não existe, bloqueio,
 * luto, pausa e suspensão dão a mesma frase, de propósito.
 */
export default function TelaDoPerfil() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const alvoId = String(id ?? "");
  const { cuidado } = useSessao();
  const [perfil, setPerfil] = useState<PerfilNaTela | null>(null);
  const [posts, setPosts] = useState<PostNaTela[]>([]);
  const [proximo, setProximo] = useState<string | null>(null);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "indisponivel" | "falhou">("carregando");
  const [vinculo, setVinculo] = useState<Vinculo>(null);
  const [seguindoAgora, setSeguindoAgora] = useState(false);
  const [menu, setMenu] = useState(false);
  const [denunciando, setDenunciando] = useState(false);
  const [bloqueando, setBloqueando] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);
  const [maisCarregando, setMaisCarregando] = useState(false);
  const buscando = useRef(false);
  const aviso = useAviso();
  const largura = useWindowDimensions().width;
  const lado = (Math.min(largura, 600) - VAO * (COLUNAS - 1)) / COLUNAS;

  const carregar = useCallback(async () => {
    setEstado("carregando");
    const r = await api.verPerfil(alvoId);
    if (!r.ok) {
      setEstado(r.motivo === "indisponivel" || r.motivo === "trancado" ? "indisponivel" : "falhou");
      return;
    }
    setPerfil(r.perfil);
    setVinculo(r.perfil.meuVinculo);
    setPosts(r.posts);
    setProximo(r.proximo);
    setEstado("pronto");
  }, [alvoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const carregarMais = useCallback(async () => {
    if (buscando.current || !temMais(proximo)) return;
    buscando.current = true;
    setMaisCarregando(true);
    let cursor: string | null = proximo;
    let vazias = 0;
    while (temMais(cursor) && vazias < 4) {
      const r = await api.verPerfil(alvoId, cursor);
      if (!r.ok) break;
      setPosts((ps) => juntarPaginas(ps, r.posts));
      cursor = r.proximo;
      if (r.posts.length) break;
      vazias++;
    }
    setProximo(cursor);
    setMaisCarregando(false);
    buscando.current = false;
  }, [alvoId, proximo]);

  const seguirOuNao = () => {
    if (!perfil || seguindoAgora) return;
    if (vinculo) {
      setDesfazendo(true);
      return;
    }
    setSeguindoAgora(true);
    void api.seguir(perfil.id).then((r) => {
      setSeguindoAgora(false);
      if (!r.ok) return aviso.mostrar(mensagemDoErro(r.motivo, r.recado, "perfil"), true);
      toque(false);
      setVinculo(r.estado);
      if (r.estado === "pendente") aviso.mostrar("Pedido enviado. O perfil é fechado: a pessoa decide se aceita.");
    });
  };

  const desfazer = () => {
    if (!perfil) return;
    const antes = vinculo;
    setDesfazendo(false);
    setVinculo(null);
    void api.deixarDeSeguir(perfil.id).then((r) => {
      if (!r.ok) {
        setVinculo(antes);
        aviso.mostrar(mensagemDoErro(r.motivo, r.recado, "perfil"), true);
      }
    });
  };

  const cabecalho = perfil ? (
    <View style={{ padding: espaco.lg, gap: espaco.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.lg }}>
        <Avatar id={perfil.id} nome={perfil.nome} url={perfil.avatarUrl} tamanho={84} />
        <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-around" }}>
          <Numero valor={posts.length} rotulo={posts.length === 1 ? "publicação" : "publicações"} mais={temMais(proximo)} />
          {perfil.seguidores != null ? <Numero valor={perfil.seguidores} rotulo="seguidores" /> : null}
          {perfil.seguindo != null ? <Numero valor={perfil.seguindo} rotulo="seguindo" /> : null}
        </View>
      </View>
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: fonte.titulo, fontSize: 20, color: cor.texto }}>
          {perfil.nome}
          {perfil.oficial ? <Text style={{ color: cor.primaria }}> ✓</Text> : null}
        </Text>
        {perfil.handle ? (
          <Text style={{ fontFamily: fonte.media, fontSize: 14, color: cor.textoApagado }}>@{perfil.handle}</Text>
        ) : null}
        {perfil.bio ? (
          <Text style={{ fontFamily: fonte.normal, fontSize: 15, lineHeight: 21, color: cor.texto, marginTop: 4 }}>
            {perfil.bio}
          </Text>
        ) : null}
      </View>
      {!cuidado && (perfil.seloSemana || perfil.seloBebe) ? (
        <View style={{ flexDirection: "row", gap: espaco.sm, flexWrap: "wrap" }}>
          {perfil.seloSemana ? <Pilula texto={`🤰 ${perfil.seloSemana}`} /> : null}
          {perfil.seloBebe ? <Pilula texto={`👶 ${perfil.seloBebe}`} fundo={cor.chutesFundo} corTexto={cor.chutes} /> : null}
        </View>
      ) : null}
      {perfil.souEu ? (
        <Botao rotulo="Editar perfil" tipo="secundario" aoTocar={() => router.push("/comunidade/eu")} />
      ) : (
        <Botao
          rotulo={rotuloDoBotaoSeguir(vinculo)}
          tipo={vinculo ? "secundario" : "primario"}
          carregando={seguindoAgora}
          aoTocar={seguirOuNao}
        />
      )}
    </View>
  ) : null;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: cor.fundo }}>
      <Cabecalho
        titulo={perfil?.handle ? `@${perfil.handle}` : (perfil?.nome ?? "Perfil")}
        direita={
          perfil && !perfil.souEu ? (
            <BotaoIcone rotulo="Mais opções do perfil" aoTocar={() => setMenu(true)}>
              <MoreHorizontal size={22} color={cor.texto} />
            </BotaoIcone>
          ) : null
        }
      />
      {estado === "carregando" ? <Carregando /> : null}
      {estado === "indisponivel" ? (
        <View style={{ padding: espaco.lg }}>
          <Cartao>
            <T tipo="subtitulo">Este perfil não está disponível</T>
            <Botao rotulo="Voltar" tipo="secundario" aoTocar={voltar} />
          </Cartao>
        </View>
      ) : null}
      {estado === "falhou" ? (
        <View style={{ padding: espaco.lg }}>
          <NaoConsegueLer sossego="O perfil continua lá." aoTentar={() => void carregar()} />
        </View>
      ) : null}
      {estado === "pronto" && perfil ? (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          numColumns={COLUNAS}
          ListHeaderComponent={cabecalho}
          columnWrapperStyle={{ gap: VAO }}
          ItemSeparatorComponent={() => <View style={{ height: VAO }} />}
          renderItem={({ item }) => <Ladrilho post={item} lado={lado} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", padding: espaco.xl, gap: espaco.sm }}>
              <Images size={36} color={cor.textoApagado} />
              <T tipo="apagado" centro>
                {perfil.souEu ? "Você ainda não publicou nada." : "Nenhuma publicação para mostrar."}
              </T>
            </View>
          }
          ListFooterComponent={
            maisCarregando ? (
              <View style={{ padding: espaco.xl }}>
                <ActivityIndicator color={cor.primaria} />
              </View>
            ) : (
              <View style={{ height: 80 }} />
            )
          }
          onEndReached={() => void carregarMais()}
          onEndReachedThreshold={0.5}
        />
      ) : null}

      <FolhaDeOpcoes
        aberta={menu}
        aoFechar={() => setMenu(false)}
        opcoes={[
          {
            rotulo: "Denunciar perfil",
            sub: "A equipe revê em até 24 horas.",
            icone: <Flag size={22} color={cor.urgente} />,
            perigo: true,
            aoTocar: () => setTimeout(() => setDenunciando(true), 300),
          },
          {
            rotulo: "Bloquear",
            sub: "Vocês deixam de se ver na Comunidade.",
            icone: <Ban size={22} color={cor.urgente} />,
            perigo: true,
            aoTocar: () => setTimeout(() => setBloqueando(true), 300),
          },
        ]}
      />
      <FolhaDeDenuncia
        aberta={denunciando}
        aoFechar={() => setDenunciando(false)}
        oQue="perfil"
        aoEnviar={(motivo) => {
          void api.denunciarPerfil(alvoId, motivo).then((r) => {
            if (!r.ok) return aviso.mostrar(mensagemDoErro(r.motivo, r.recado, "perfil"), true);
            aviso.mostrar("Denúncia enviada. A equipe revê em até 24 horas.");
          });
        }}
      />
      <FolhaDeBloqueio
        aberta={bloqueando}
        aoFechar={() => setBloqueando(false)}
        nome={perfil?.nome ?? ""}
        aoConfirmar={() => {
          void api.bloquear(alvoId, true).then((r) => {
            if (!r.ok) return aviso.mostrar(mensagemDoErro(r.motivo, r.recado, "perfil"), true);
            aviso.mostrar("Perfil bloqueado.");
            setTimeout(voltar, 700);
          });
        }}
      />
      <Folha aberta={desfazendo} aoFechar={() => setDesfazendo(false)} titulo={vinculo === "pendente" ? "Cancelar o pedido?" : `Deixar de seguir ${perfil?.nome ?? ""}?`}>
        <T tipo="apagado">
          {vinculo === "pendente"
            ? "O pedido para seguir é retirado. Dá para pedir de novo depois."
            : perfil?.publico
              ? "As publicações saem do seu feed. Dá para seguir de novo quando quiser."
              : "O perfil é fechado: para voltar a seguir, você vai precisar pedir de novo."}
        </T>
        <Botao rotulo={vinculo === "pendente" ? "Cancelar o pedido" : "Deixar de seguir"} tipo="perigo" aoTocar={desfazer} />
        <Botao rotulo="Voltar" tipo="texto" aoTocar={() => setDesfazendo(false)} />
      </Folha>
      {aviso.elemento}
    </SafeAreaView>
  );
}

function Numero({ valor, rotulo, mais }: { valor: number; rotulo: string; mais?: boolean }) {
  return (
    <View accessible accessibilityLabel={`${valor}${mais ? " ou mais" : ""} ${rotulo}`} style={{ alignItems: "center", minWidth: 64 }}>
      <Text style={{ fontFamily: fonte.titulo, fontSize: 19, color: cor.texto, fontVariant: ["tabular-nums"] }}>
        {contagemCurta(valor)}
        {mais ? "+" : ""}
      </Text>
      <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado }}>{rotulo}</Text>
    </View>
  );
}

/** Um quadrado 3:4 da grade. Post sensível aparece sem a imagem. */
function Ladrilho({ post, lado }: { post: PostNaTela; lado: number }) {
  const fotos = fotosDoPost(post);
  const veu = veuDoPost({ sensivel: !!post.sensivel, batePalavra: !!post.batePalavraMinha, souAAutora: post.souAAutora, revelado: false });
  const altura = (lado * 4) / 3;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={veu ? "Publicação com aviso de conteúdo sensível" : post.texto ? `Publicação: ${post.texto.slice(0, 80)}` : "Publicação com foto"}
      onPress={() => router.push(`/comunidade/post/${post.id}`)}
      style={({ pressed }) => ({ width: lado, height: altura, opacity: pressed ? 0.8 : 1, backgroundColor: cor.apagado, overflow: "hidden" })}
    >
      {veu ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 4 }}>
          <EyeOff size={22} color={cor.textoApagado} />
          <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: cor.textoApagado }}>Sensível</Text>
        </View>
      ) : fotos[0] ? (
        <>
          <Image source={fonteDaImagem(post.miniaturaUrl ?? fotos[0])} style={{ width: lado, height: altura }} contentFit="cover" />
          {fotos.length > 1 ? (
            <View style={{ position: "absolute", top: 6, right: 6 }}>
              <Images size={16} color={cor.branco} />
            </View>
          ) : null}
        </>
      ) : (
        <View style={{ flex: 1, padding: espaco.sm, justifyContent: "center", backgroundColor: corDaInicial(post.id) + "22" }}>
          <Text numberOfLines={6} style={{ fontFamily: fonte.media, fontSize: 13, lineHeight: 17, color: cor.texto }}>
            {post.texto}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

