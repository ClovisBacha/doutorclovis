import { deveVerOnboarding } from "@/lib/onboarding-da-comunidade";
import { router, useFocusEffect } from "expo-router";
import { Heart, ImagePlus, Search } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Botao, Cartao, Carregando, NaoConsegueLer, T, toque } from "~/componentes/base";
import { useAcoesDosPosts } from "~/componentes/comunidade/acoes";
import { BotaoIcone } from "~/componentes/comunidade/cabecalho";
import { useAviso } from "~/componentes/comunidade/folha";
import { Avatar } from "~/componentes/comunidade/imagem";
import { CartaoDoPost } from "~/componentes/comunidade/post";
import { BoasVindas, FolhaDasRegras } from "~/componentes/comunidade/regras";
import { lerJson, gravarJson } from "~/lib/armazem";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { api } from "~/lib/comunidade/api";
import {
  cartoesDoApp,
  chaveDasBoasVindas,
  juntarPaginas,
  mensagemDoErro,
  rotuloDoBotaoSeguir,
  temMais,
} from "~/lib/comunidade/regras";
import { consumirFeedSujo } from "~/lib/comunidade/sinal";
import { useRegrasDaComunidade } from "~/lib/comunidade/usar-regras";
import { useSessao } from "~/lib/sessao";
import type { PerfilNaTela, PessoaNaLista, PostNaTela } from "~/servidor/rede";
import { ALVO_MINIMO, cor, espaco, fonte, raio, sombra } from "~/tema";

type Item =
  | { tipo: "post"; post: PostNaTela; sugerido: boolean }
  | { tipo: "fim" }
  | { tipo: "pessoas"; pessoas: PessoaNaLista[] };

/** Páginas vazias seguidas que o feed atravessa sozinho antes de parar. */
const PAGINAS_VAZIAS_MAX = 4;

/**
 * O FEED DA COMUNIDADE.
 *
 * ⚠️ "instavel" (a leitura falhou) mostra "tentar de novo", NUNCA a tela de
 * vazio — vazio afirma que não há nada, e não é verdade.
 * ⚠️ Modo Cuidado: o servidor devolve o feed vazio de propósito; a tela diz
 * uma frase acolhedora que não fala do bebê, e não oferece publicar.
 */
export default function Comunidade() {
  const { sessao, perfil, estadoDoPerfil, cuidado } = useSessao();
  const uid = sessao?.user.id ?? null;
  const [posts, setPosts] = useState<PostNaTela[]>([]);
  const [sugeridos, setSugeridos] = useState<Set<string>>(new Set());
  const [pessoas, setPessoas] = useState<PessoaNaLista[]>([]);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "instavel">("carregando");
  const [proximo, setProximo] = useState<string | null>(null);
  const [fimDoFeed, setFimDoFeed] = useState(false);
  const [maisCarregando, setMaisCarregando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [novas, setNovas] = useState(0);
  const [eu, setEu] = useState<{ perfil: PerfilNaTela; pausada: boolean; suspensa: boolean } | null>(null);
  const [boasVindas, setBoasVindas] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const aviso = useAviso();
  const regras = useRegrasDaComunidade();
  const buscando = useRef(false);

  const carregarSugestoes = useCallback(async () => {
    const r = await api.sugestoesDoFeed();
    /* Sugestão que falhou só não aparece: é um extra no fim do feed, e o
       feed em si já carregou. */
    if (!r.ok) return;
    const ids = new Set(r.sugeridos ?? r.posts.map((p) => p.id));
    setPosts((ps) => juntarPaginas(ps, r.posts));
    setSugeridos(ids);
    setPessoas(r.pessoas.filter((p) => !p.souEu));
  }, []);

  const carregar = useCallback(async () => {
    setAgora(Date.now());
    const r = await api.meuFeed(null);
    if (!r.ok) {
      setEstado("instavel");
      return;
    }
    setPosts(r.posts);
    setSugeridos(new Set());
    setPessoas([]);
    setProximo(r.proximo);
    setEstado("pronto");
    const acabou = !temMais(r.proximo);
    setFimDoFeed(acabou);
    if (acabou) void carregarSugestoes();
  }, [carregarSugestoes]);

  const carregarMais = useCallback(async () => {
    if (buscando.current || !temMais(proximo)) return;
    buscando.current = true;
    setMaisCarregando(true);
    let cursor: string | null = proximo;
    let vazias = 0;
    /* ⚠️ Página vazia com `proximo` não nulo NÃO é o fim: o servidor filtra
       depois de ler. Atravessa algumas sozinho antes de esperar a próxima
       rolagem. */
    while (temMais(cursor) && vazias < PAGINAS_VAZIAS_MAX) {
      const r = await api.meuFeed(cursor);
      if (!r.ok) {
        aviso.mostrar("Não deu para carregar mais agora. Role de novo para tentar.", true);
        break;
      }
      setPosts((ps) => juntarPaginas(ps, r.posts));
      cursor = r.proximo;
      if (r.posts.length > 0) break;
      vazias++;
    }
    setProximo(cursor);
    if (!temMais(cursor)) {
      setFimDoFeed(true);
      void carregarSugestoes();
    }
    setMaisCarregando(false);
    buscando.current = false;
  }, [proximo, aviso, carregarSugestoes]);

  const carregarCabecalho = useCallback(async () => {
    const [a, m] = await Promise.all([api.minhaAtividade(), api.meuPerfilSocial()]);
    if (a.ok) setNovas(a.novas);
    if (m.ok) setEu({ perfil: m.perfil, pausada: m.pausada, suspensa: m.suspensa });
  }, []);

  useEffect(() => {
    if (estadoDoPerfil === "carregando") return;
    if (cuidado) {
      setEstado("pronto");
      return;
    }
    void carregar();
  }, [estadoDoPerfil, cuidado, carregar]);

  useFocusEffect(
    useCallback(() => {
      void carregarCabecalho();
      if (consumirFeedSujo() && !cuidado) void carregar();
    }, [carregarCabecalho, carregar, cuidado]),
  );

  /* Boas-vindas na primeira abertura — nunca em Modo Cuidado, e "não sei"
     (perfil ainda chegando) também não abre. Na bancada só com &boasvindas=1. */
  useEffect(() => {
    let vivo = true;
    const careMode = estadoDoPerfil === "pronto" ? perfil?.care_mode === true : undefined;
    if (ehBancada()) {
      setBoasVindas(
        parametroDaBancada("boasvindas") === "1" && deveVerOnboarding({ jaViu: false, careMode }),
      );
      return;
    }
    void lerJson<boolean>(chaveDasBoasVindas(uid), false).then((jaViu) => {
      if (vivo) setBoasVindas(deveVerOnboarding({ jaViu: jaViu === true, careMode }));
    });
    return () => {
      vivo = false;
    };
  }, [uid, estadoDoPerfil, perfil?.care_mode]);

  const terminarBoasVindas = useCallback(() => {
    setBoasVindas(false);
    void gravarJson(chaveDasBoasVindas(uid), true);
  }, [uid]);

  const atualizar = useCallback(async () => {
    setAtualizando(true);
    await Promise.all([carregar(), carregarCabecalho()]);
    setAtualizando(false);
  }, [carregar, carregarCabecalho]);

  const abrirComentarios = useCallback((p: PostNaTela) => router.push(`/comunidade/post/${p.id}`), []);
  const { acoes, elementos } = useAcoesDosPosts({
    mudar: setPosts,
    aviso: aviso.mostrar,
    exigir: regras.exigir,
    aoComentarios: abrirComentarios,
  });

  const publicar = useCallback(() => {
    regras.exigir(() => router.push("/comunidade/novo"));
  }, [regras]);

  const itens = useMemo<Item[]>(() => {
    const doFeed = posts.filter((p) => !sugeridos.has(p.id));
    const deFora = posts.filter((p) => sugeridos.has(p.id));
    const lista: Item[] = doFeed.map((post) => ({ tipo: "post", post, sugerido: false }));
    if (fimDoFeed && (deFora.length > 0 || pessoas.length > 0)) {
      lista.push({ tipo: "fim" });
      if (pessoas.length) lista.push({ tipo: "pessoas", pessoas });
      for (const post of deFora) lista.push({ tipo: "post", post, sugerido: true });
    }
    return lista;
  }, [posts, sugeridos, pessoas, fimDoFeed]);

  const meuNome = eu?.perfil.nome ?? perfil?.display_name ?? perfil?.full_name ?? "Você";
  const meuAvatar = eu?.perfil.avatarUrl ?? null;

  const topo = (
    <View style={{ gap: espaco.md, paddingBottom: espaco.md }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: espaco.lg,
          paddingRight: espaco.sm,
          paddingTop: espaco.sm,
        }}
      >
        <Text accessibilityRole="header" style={{ flex: 1, fontFamily: fonte.titulo, fontSize: 28, color: cor.texto, letterSpacing: -0.4 }}>
          Comunidade
        </Text>
        <BotaoIcone rotulo="Atividade" selo={novas} aoTocar={() => router.push("/comunidade/atividade")}>
          <Heart size={25} color={cor.texto} strokeWidth={1.9} />
        </BotaoIcone>
        <BotaoIcone rotulo="Buscar pessoas" aoTocar={() => router.push("/comunidade/busca")}>
          <Search size={24} color={cor.texto} strokeWidth={1.9} />
        </BotaoIcone>
        <BotaoIcone rotulo="Meu perfil" aoTocar={() => router.push("/comunidade/eu")}>
          <Avatar id={uid ?? "eu"} nome={meuNome} url={meuAvatar} tamanho={32} />
        </BotaoIcone>
      </View>

      {eu?.suspensa ? (
        <Cartao fundo={cor.urgenteFundo} estilo={{ marginHorizontal: espaco.lg }}>
          <T tipo="rotulo">Sua conta da Comunidade está indisponível</T>
          <T tipo="apagado">
            Você não aparece na Comunidade por enquanto, e o que você publicou não foi apagado. Isso
            vale só para esta aba: o resto do app continua normal.
          </T>
        </Cartao>
      ) : eu?.pausada ? (
        <Cartao fundo={cor.apagado} estilo={{ marginHorizontal: espaco.lg }}>
          <T tipo="rotulo">Sua conta está pausada</T>
          <T tipo="apagado">
            Ninguém te encontra e as suas publicações não aparecem para mais ninguém. Nada foi
            apagado.
          </T>
        </Cartao>
      ) : null}

      {boasVindas && !cuidado ? <BoasVindas cartoes={cartoesDoApp()} aoTerminar={terminarBoasVindas} /> : null}

      {!cuidado ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Publicar"
          accessibilityHint="Abre a tela para escrever e escolher fotos"
          onPress={() => {
            toque();
            publicar();
          }}
          style={({ pressed }) => [
            {
              marginHorizontal: espaco.lg,
              flexDirection: "row",
              alignItems: "center",
              gap: espaco.md,
              backgroundColor: cor.cartao,
              borderRadius: raio.lg,
              paddingHorizontal: espaco.md,
              paddingVertical: espaco.md,
              opacity: pressed ? 0.8 : 1,
            },
            sombra,
          ]}
        >
          <Avatar id={uid ?? "eu"} nome={meuNome} url={meuAvatar} tamanho={40} />
          <Text style={{ flex: 1, fontFamily: fonte.media, fontSize: 16, color: cor.textoApagado }}>
            Conte como você está hoje…
          </Text>
          <View
            style={{
              width: ALVO_MINIMO,
              height: ALVO_MINIMO,
              borderRadius: ALVO_MINIMO / 2,
              backgroundColor: cor.destaque,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ImagePlus size={22} color={cor.primariaEscura} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );

  const corpoVazio = () => {
    if (estado === "carregando" || estadoDoPerfil === "carregando") return <Carregando texto="Carregando o feed…" />;
    if (cuidado) {
      return (
        <Cartao fundo={cor.rosaMarca} estilo={{ marginHorizontal: espaco.lg }}>
          <Text style={{ fontSize: 30 }} accessible={false}>
            🤍
          </Text>
          <T tipo="subtitulo">Um espaço para quando você quiser</T>
          <T tipo="apagado" cor={cor.texto}>
            Por aqui está tudo quietinho, no seu tempo. Não há nada que você precise fazer agora. E
            se precisar de ajuda, o SOS continua na barra de baixo, a qualquer hora.
          </T>
        </Cartao>
      );
    }
    if (estado === "instavel") {
      return (
        <View style={{ marginHorizontal: espaco.lg }}>
          <NaoConsegueLer
            sossego="O que você publicou continua guardado."
            aoTentar={() => {
              setEstado("carregando");
              void carregar();
            }}
          />
        </View>
      );
    }
    return (
      <Cartao estilo={{ marginHorizontal: espaco.lg }}>
        <T tipo="subtitulo">Seu feed ainda está quietinho</T>
        <T tipo="apagado">
          Aqui aparecem as publicações de quem você segue. Encontre alguém pela busca ou conte como
          você está hoje.
        </T>
        <Botao rotulo="Buscar pessoas" tipo="secundario" aoTocar={() => router.push("/comunidade/busca")} />
      </Cartao>
    );
  };

  const renderizar = ({ item }: { item: Item }) => {
    if (item.tipo === "post") {
      return <CartaoDoPost post={item.post} agora={agora} sugerido={item.sugerido} acoes={acoes} />;
    }
    if (item.tipo === "fim") {
      return (
        <View style={{ alignItems: "center", paddingVertical: espaco.md, gap: 4 }}>
          <Text style={{ fontSize: 22 }} accessible={false}>
            ✨
          </Text>
          <T tipo="rotulo">Você está em dia</T>
          <T tipo="apagado">Daqui para baixo, sugestões da Comunidade.</T>
        </View>
      );
    }
    return <PessoasSugeridas pessoas={item.pessoas} aviso={aviso.mostrar} />;
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: cor.fundo }}>
      <FlatList
        data={estado === "pronto" && !cuidado ? itens : []}
        keyExtractor={(i, n) => (i.tipo === "post" ? `p-${i.post.id}` : `${i.tipo}-${n}`)}
        renderItem={renderizar}
        ListHeaderComponent={topo}
        ListEmptyComponent={corpoVazio()}
        ItemSeparatorComponent={() => <View style={{ height: espaco.lg }} />}
        ListFooterComponent={
          maisCarregando ? (
            <View style={{ padding: espaco.xl }}>
              <ActivityIndicator color={cor.primaria} />
            </View>
          ) : (
            <View style={{ height: 120 }} />
          )
        }
        onEndReached={() => void carregarMais()}
        onEndReachedThreshold={0.6}
        refreshControl={
          <RefreshControl refreshing={atualizando} onRefresh={() => void atualizar()} tintColor={cor.primaria} />
        }
        contentContainerStyle={{ paddingBottom: espaco.lg }}
      />
      {elementos}
      <FolhaDasRegras {...regras.folha} />
      {aviso.elemento}
    </SafeAreaView>
  );
}

/** "Pessoas para seguir" — fileira horizontal das sugestões. */
function PessoasSugeridas({
  pessoas,
  aviso,
}: {
  pessoas: PessoaNaLista[];
  aviso: (t: string, erro?: boolean) => void;
}) {
  const [vinculos, setVinculos] = useState<Record<string, PessoaNaLista["sigo"]>>({});
  return (
    <View style={{ gap: espaco.sm }}>
      <T tipo="rotulo" estilo={{ marginHorizontal: espaco.lg }}>
        Pessoas para seguir
      </T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: espaco.lg, gap: espaco.md }}>
        {pessoas.map((p) => {
          const v = p.id in vinculos ? vinculos[p.id] : p.sigo;
          return (
            <View
              key={p.id}
              style={[
                { width: 150, backgroundColor: cor.cartao, borderRadius: raio.lg, padding: espaco.md, alignItems: "center", gap: 6 },
                sombra,
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Abrir o perfil de ${p.nome}`}
                onPress={() => router.push(`/comunidade/perfil/${p.id}`)}
                style={{ alignItems: "center", gap: 6, minHeight: ALVO_MINIMO }}
              >
                <Avatar id={p.id} nome={p.nome} url={p.avatarUrl} tamanho={60} />
                <Text numberOfLines={1} style={{ fontFamily: fonte.forte, fontSize: 15, color: cor.texto }}>
                  {p.nome}
                </Text>
                <Text numberOfLines={2} style={{ fontFamily: fonte.normal, fontSize: 13, lineHeight: 17, color: cor.textoApagado, textAlign: "center", minHeight: 34 }}>
                  {p.bio ?? " "}
                </Text>
              </Pressable>
              <Botao
                rotulo={rotuloDoBotaoSeguir(v)}
                tipo={v ? "secundario" : "primario"}
                desabilitado={!!v}
                estilo={{ alignSelf: "stretch", paddingHorizontal: espaco.sm, minHeight: ALVO_MINIMO }}
                aoTocar={() => {
                  void api.seguir(p.id).then((r) => {
                    if (!r.ok) return aviso(mensagemDoErro(r.motivo, r.recado, "perfil"), true);
                    setVinculos((x) => ({ ...x, [p.id]: r.estado }));
                  });
                }}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
