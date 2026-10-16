import { haQuantoPublicou, textoDoAviso } from "@/lib/rede-social";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Botao, Carregando, NaoConsegueLer, T } from "~/componentes/base";
import { Cabecalho } from "~/componentes/comunidade/cabecalho";
import { useAviso } from "~/componentes/comunidade/folha";
import { Avatar, fonteDaImagem } from "~/componentes/comunidade/imagem";
import { api } from "~/lib/comunidade/api";
import { mensagemDoErro } from "~/lib/comunidade/regras";
import type { AtividadeNaTela } from "~/servidor/rede";
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

/**
 * A ATIVIDADE (o ♡ do feed): quem seguiu, pediu, reagiu, comentou.
 *
 * ⚠️ O texto de cada aviso vem de `textoDoAviso` (site) — e ele NÃO traz o
 * comentário de propósito: ela toca e lê onde ele vive, com contexto.
 * ⚠️ Abrir marca tudo como visto (é o que zera o número do ♡).
 */
export default function Atividade() {
  const [itens, setItens] = useState<AtividadeNaTela[]>([]);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "falhou">("carregando");
  const [atualizando, setAtualizando] = useState(false);
  const [respondidos, setRespondidos] = useState<Record<string, "aceito" | "recusado">>({});
  const [agora, setAgora] = useState(() => Date.now());
  const aviso = useAviso();

  const carregar = useCallback(async () => {
    setAgora(Date.now());
    const r = await api.minhaAtividade();
    if (!r.ok) {
      setEstado("falhou");
      return;
    }
    setItens(r.itens);
    setEstado("pronto");
    void api.marcarAtividadeVista();
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const responder = (a: AtividadeNaTela, aceitar: boolean) => {
    setRespondidos((x) => ({ ...x, [a.id]: aceitar ? "aceito" : "recusado" }));
    void api.responderPedido(a.quemId, aceitar).then((r) => {
      if (!r.ok) {
        setRespondidos((x) => {
          const y = { ...x };
          delete y[a.id];
          return y;
        });
        aviso.mostrar(mensagemDoErro(r.motivo, r.recado), true);
      }
    });
  };

  const abrir = (a: AtividadeNaTela) => {
    if (a.postId) router.push(`/comunidade/post/${a.postId}`);
    else router.push(`/comunidade/perfil/${a.quemId}`);
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: cor.fundo }}>
      <Cabecalho titulo="Atividade" />
      {estado === "carregando" ? <Carregando /> : null}
      {estado === "falhou" ? (
        <View style={{ padding: espaco.lg }}>
          <NaoConsegueLer sossego="Nenhum aviso se perdeu." aoTentar={() => void carregar()} />
        </View>
      ) : null}
      {estado === "pronto" ? (
        <FlatList
          data={itens}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingVertical: espaco.sm }}
          refreshControl={
            <RefreshControl
              refreshing={atualizando}
              tintColor={cor.primaria}
              onRefresh={async () => {
                setAtualizando(true);
                await carregar();
                setAtualizando(false);
              }}
            />
          }
          ListEmptyComponent={
            <View style={{ padding: espaco.xl, alignItems: "center", gap: espaco.sm }}>
              <Text style={{ fontSize: 30 }} accessible={false}>
                🤍
              </Text>
              <T tipo="apagado" centro>
                Quando alguém seguir você, reagir ou comentar, aparece aqui.
              </T>
            </View>
          }
          renderItem={({ item }) => {
            const pedido = item.especie === "pediu_para_seguir" && item.pendente;
            const resposta = respondidos[item.id];
            return (
              <View
                style={{
                  paddingHorizontal: espaco.lg,
                  paddingVertical: espaco.sm,
                  backgroundColor: item.visto ? "transparent" : cor.rosaMarca + "66",
                  gap: espaco.sm,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() => abrir(item)}
                  style={{ flexDirection: "row", alignItems: "center", gap: espaco.md, minHeight: ALVO_MINIMO }}
                >
                  <Avatar id={item.quemId} nome={item.quemNome} url={item.quemAvatar} tamanho={44} />
                  <Text style={{ flex: 1, fontFamily: fonte.normal, fontSize: 15, lineHeight: 21, color: cor.texto }}>
                    {textoDoAviso(item.especie, item.quemNome)}
                    <Text style={{ color: cor.textoApagado }}>{` ·\u00a0${haQuantoPublicou(item.criadoEm, agora).replace(/ /g, "\u00a0")}`}</Text>
                  </Text>
                  {item.postCapa ? (
                    <Image source={fonteDaImagem(item.postCapa)} style={{ width: 44, height: 55, borderRadius: raio.sm }} contentFit="cover" />
                  ) : null}
                </Pressable>
                {pedido && !resposta ? (
                  <View style={{ flexDirection: "row", gap: espaco.sm, paddingLeft: 44 + espaco.md }}>
                    <Botao rotulo="Aceitar" aoTocar={() => responder(item, true)} estilo={{ flex: 1, minHeight: ALVO_MINIMO }} />
                    <Botao rotulo="Recusar" tipo="secundario" aoTocar={() => responder(item, false)} estilo={{ flex: 1, minHeight: ALVO_MINIMO }} />
                  </View>
                ) : null}
                {pedido && resposta ? (
                  <Text style={{ paddingLeft: 44 + espaco.md, fontFamily: fonte.media, fontSize: 14, color: cor.textoApagado }}>
                    {resposta === "aceito" ? "Pedido aceito." : "Pedido recusado."}
                  </Text>
                ) : null}
              </View>
            );
          }}
        />
      ) : null}
      {aviso.elemento}
    </SafeAreaView>
  );
}
