import { haQuantoPublicou } from "@/lib/rede-social";
import { router } from "expo-router";
import { Heart, MoreHorizontal } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { toque } from "~/componentes/base";
import { Avatar } from "~/componentes/comunidade/imagem";
import { respostasNaTela, type Conversa } from "~/lib/comunidade/regras";
import type { ComentarioNaTela } from "~/servidor/rede";
import { ALVO_MINIMO, cor, espaco, fonte } from "~/tema";

export type AcoesDoComentario = {
  aoResponder?: (raiz: ComentarioNaTela) => void;
  aoCurtir: (c: ComentarioNaTela) => void;
  aoMenu: (c: ComentarioNaTela) => void;
};

/** Uma conversa: a raiz e as respostas (três à vista, "ver mais" abre). */
export function ConversaNaTela({
  conversa,
  agora,
  acoes,
}: {
  conversa: Conversa;
  agora: number;
  acoes: AcoesDoComentario;
}) {
  const [abertas, setAbertas] = useState(false);
  const { visiveis, escondidas } = respostasNaTela(conversa.respostas, abertas);
  return (
    <View style={{ gap: espaco.xs }}>
      <LinhaDoComentario c={conversa.raiz} raiz={conversa.raiz} agora={agora} acoes={acoes} />
      {visiveis.length > 0 ? (
        <View style={{ marginLeft: 44, gap: espaco.xs }}>
          {visiveis.map((r) => (
            <LinhaDoComentario key={r.id} c={r} raiz={conversa.raiz} agora={agora} acoes={acoes} pequeno />
          ))}
          {escondidas > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                toque();
                setAbertas(true);
              }}
              style={{ minHeight: ALVO_MINIMO, justifyContent: "center" }}
            >
              <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: cor.textoApagado }}>
                ── Ver mais {escondidas} {escondidas === 1 ? "resposta" : "respostas"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function LinhaDoComentario({
  c,
  raiz,
  agora,
  acoes,
  pequeno,
}: {
  c: ComentarioNaTela;
  raiz: ComentarioNaTela;
  agora: number;
  acoes: AcoesDoComentario;
  pequeno?: boolean;
}) {
  /* Recolhido abre no toque, por linha, e não fica gravado. */
  const [revelado, setRevelado] = useState(false);
  const oculto = !!c.recolhido && !revelado;
  const tamanho = pequeno ? 28 : 34;
  const curtidas = c.curtidas ?? 0;

  return (
    <View style={{ flexDirection: "row", gap: espaco.sm, alignItems: "flex-start" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Abrir o perfil de ${c.autorNome}`}
        onPress={() => router.push(`/comunidade/perfil/${c.autorId}`)}
        style={{ width: ALVO_MINIMO - 8, minHeight: ALVO_MINIMO, alignItems: "center", paddingTop: 4 }}
      >
        <Avatar id={c.autorId} nome={c.autorNome} url={c.autorAvatar} tamanho={tamanho} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado, paddingTop: 4 }}>
          <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: cor.texto }}>{c.autorNome}</Text>
          {"  "}
          {haQuantoPublicou(c.criadoEm, agora)}
          {c.fixadoEm && !c.respondeA ? "  · Fixado" : ""}
        </Text>
        {oculto ? (
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Mostra o comentário"
            onPress={() => {
              toque();
              setRevelado(true);
            }}
            style={{ minHeight: ALVO_MINIMO, justifyContent: "center" }}
          >
            <Text style={{ fontFamily: fonte.media, fontSize: 15, color: cor.textoApagado, fontStyle: "italic" }}>
              Comentário recolhido · tocar para ver
            </Text>
          </Pressable>
        ) : (
          <>
            <Text style={{ fontFamily: fonte.normal, fontSize: 15, lineHeight: 21, color: cor.texto, marginTop: 1 }}>
              {c.texto}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginLeft: -espaco.sm }}>
              {acoes.aoResponder ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Responder a ${c.autorNome}`}
                  onPress={() => {
                    toque();
                    acoes.aoResponder?.(raiz);
                  }}
                  style={{ minHeight: ALVO_MINIMO, paddingHorizontal: espaco.sm, justifyContent: "center" }}
                >
                  <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: cor.textoApagado }}>Responder</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mais opções do comentário"
                onPress={() => {
                  toque();
                  acoes.aoMenu(c);
                }}
                style={{ width: ALVO_MINIMO, height: ALVO_MINIMO, alignItems: "center", justifyContent: "center" }}
              >
                <MoreHorizontal size={18} color={cor.textoApagado} />
              </Pressable>
            </View>
          </>
        )}
      </View>
      {!oculto ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={c.euCurti ? "Descurtir o comentário" : "Curtir o comentário"}
          accessibilityState={{ selected: !!c.euCurti }}
          onPress={() => {
            toque();
            acoes.aoCurtir(c);
          }}
          style={{ width: ALVO_MINIMO, minHeight: ALVO_MINIMO, alignItems: "center", justifyContent: "center", gap: 1 }}
        >
          <Heart
            size={17}
            color={c.euCurti ? cor.urgente : cor.textoApagado}
            fill={c.euCurti ? cor.urgente : "transparent"}
          />
          {curtidas > 0 ? (
            <Text style={{ fontFamily: fonte.media, fontSize: 13, color: cor.textoApagado }}>{curtidas}</Text>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}
