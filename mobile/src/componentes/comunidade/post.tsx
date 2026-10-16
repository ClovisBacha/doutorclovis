import { rotuloDoMotivo } from "@/lib/conteudo-sensivel";
import { veuDoPost } from "@/lib/conteudo-sensivel";
import {
  emojiDaReacao,
  haQuantoPublicou,
  principaisReacoes,
  REACOES,
  totalDeReacoes,
  type TipoDeReacao,
} from "@/lib/rede-social";
import { Bookmark, EyeOff, Globe, Heart, Lock, MessageCircle, MoreHorizontal, Users } from "lucide-react-native";
import { memo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { toque } from "~/componentes/base";
import { Carrossel, PROPORCAO_DA_FOTO } from "~/componentes/comunidade/carrossel";
import { Avatar } from "~/componentes/comunidade/imagem";
import { fotosDoPost, reacaoDoToque, reacaoDoToqueDuplo } from "~/lib/comunidade/regras";
import type { PostNaTela } from "~/servidor/rede";
import { ALVO_MINIMO, cor, espaco, fonte, raio, sombra } from "~/tema";

const ICONE_DA_VISIBILIDADE = { publico: Globe, seguidores: Users, amigas: Lock } as const;
const ROTULO_DA_VISIBILIDADE = {
  publico: "Visível para todo mundo",
  seguidores: "Visível para quem segue",
  amigas: "Visível só para as amigas",
} as const;

export type AcoesDoPost = {
  aoReagir: (post: PostNaTela, tipo: TipoDeReacao | null) => void;
  aoSalvar: (post: PostNaTela) => void;
  aoMenu: (post: PostNaTela) => void;
  aoComentarios?: (post: PostNaTela) => void;
  aoPerfil: (autorId: string) => void;
};

/**
 * UM POST NO FEED: autor, há quanto tempo, texto, fotos (ou o véu), reações,
 * comentários, salvar e o ⋯.
 */
export const CartaoDoPost = memo(function CartaoDoPost({
  post,
  agora,
  sugerido,
  acoes,
  textoInteiro,
}: {
  post: PostNaTela;
  agora: number;
  sugerido?: boolean;
  acoes: AcoesDoPost;
  textoInteiro?: boolean;
}) {
  /* ⚠️ "Revelado" é POR LEITURA, nunca gravado (conteudo-sensivel.ts): o
     segundo encontro com o mesmo post, numa noite pior, chega com o véu. */
  const [revelado, setRevelado] = useState(false);
  const [escolhendo, setEscolhendo] = useState(false);
  const [aberto, setAberto] = useState(!!textoInteiro);
  const veu = veuDoPost({
    sensivel: !!post.sensivel,
    batePalavra: !!post.batePalavraMinha,
    souAAutora: post.souAAutora,
    revelado,
  });
  const fotos = fotosDoPost(post);
  const total = totalDeReacoes(post.reacoes);
  const principais = principaisReacoes(post.reacoes);
  const IconeVis = ICONE_DA_VISIBILIDADE[post.visibilidade] ?? Globe;
  const texto = post.texto?.trim() ?? "";
  const longo = texto.length > 220 || texto.split("\n").length > 5;

  return (
    <View
      style={[
        { backgroundColor: cor.cartao, borderRadius: raio.lg, marginHorizontal: espaco.lg, overflow: "hidden" },
        sombra,
      ]}
    >
      {sugerido ? (
        <View style={{ paddingHorizontal: espaco.lg, paddingTop: espaco.md }}>
          <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: cor.primaria }}>
            Sugerido para você
          </Text>
        </View>
      ) : null}

      {/* Autor */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingLeft: espaco.md, paddingRight: espaco.xs, paddingVertical: espaco.sm, gap: espaco.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Abrir o perfil de ${post.autorNome}`}
          onPress={() => acoes.aoPerfil(post.autorId)}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: espaco.sm, minHeight: ALVO_MINIMO }}
        >
          <Avatar id={post.autorId} nome={post.autorNome} url={post.autorAvatar} tamanho={38} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: fonte.forte, fontSize: 15, color: cor.texto }}>
              {post.autorNome}
              {post.autorOficial ? <Text style={{ color: cor.primaria }}> ✓</Text> : null}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado }}>
                {haQuantoPublicou(post.criadoEm, agora)}
              </Text>
              <Text style={{ fontSize: 13, color: cor.textoApagado }}>·</Text>
              <View accessible accessibilityLabel={ROTULO_DA_VISIBILIDADE[post.visibilidade]}>
                <IconeVis size={13} color={cor.textoApagado} />
              </View>
            </View>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mais opções"
          onPress={() => {
            toque();
            acoes.aoMenu(post);
          }}
          style={{ width: ALVO_MINIMO, height: ALVO_MINIMO, alignItems: "center", justifyContent: "center" }}
        >
          <MoreHorizontal size={22} color={cor.textoApagado} />
        </Pressable>
      </View>

      {veu ? (
        <Veu
          razao={veu}
          motivo={post.motivoSensivel ?? null}
          temFoto={fotos.length > 0}
          aoRevelar={() => {
            toque();
            setRevelado(true);
          }}
        />
      ) : (
        <>
          {texto ? (
            <Pressable
              disabled={!longo || aberto}
              onPress={() => setAberto(true)}
              accessibilityRole={longo && !aberto ? "button" : "text"}
              accessibilityHint={longo && !aberto ? "Mostra o texto inteiro" : undefined}
              style={{ paddingHorizontal: espaco.lg, paddingBottom: espaco.md }}
            >
              <Text
                numberOfLines={longo && !aberto ? 5 : undefined}
                style={{ fontFamily: fonte.normal, fontSize: 16, lineHeight: 23, color: cor.texto }}
              >
                {texto}
              </Text>
              {longo && !aberto ? (
                <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: cor.textoApagado, marginTop: 2 }}>
                  ver mais
                </Text>
              ) : null}
            </Pressable>
          ) : null}
          {fotos.length > 0 ? (
            <Carrossel
              urls={fotos}
              altTexto={post.altTexto}
              autorNome={post.autorNome}
              aoToqueDuplo={() => {
                toque(false);
                const nova = reacaoDoToqueDuplo(post.minhaReacao);
                if (nova) acoes.aoReagir(post, nova);
              }}
            />
          ) : null}
        </>
      )}

      {/* Ações */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: espaco.xs, paddingTop: espaco.xs }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={post.minhaReacao ? "Trocar a reação" : "Reagir"}
          accessibilityState={{ expanded: escolhendo }}
          onPress={() => {
            toque();
            setEscolhendo((v) => !v);
          }}
          onLongPress={() => {
            toque(false);
            setEscolhendo(true);
          }}
          style={{ width: ALVO_MINIMO + 4, height: ALVO_MINIMO + 4, alignItems: "center", justifyContent: "center" }}
        >
          {post.minhaReacao ? (
            <Text style={{ fontSize: 25 }}>{emojiDaReacao(post.minhaReacao)}</Text>
          ) : (
            <Heart size={26} color={cor.texto} strokeWidth={1.9} />
          )}
        </Pressable>
        {acoes.aoComentarios ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Comentários"
            onPress={() => {
              toque();
              acoes.aoComentarios?.(post);
            }}
            style={{ width: ALVO_MINIMO + 4, height: ALVO_MINIMO + 4, alignItems: "center", justifyContent: "center" }}
          >
            <MessageCircle size={25} color={cor.texto} strokeWidth={1.9} />
          </Pressable>
        ) : null}
        {total > 0 ? (
          <View
            accessible
            accessibilityLabel={`${total} ${total === 1 ? "reação" : "reações"}`}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, marginLeft: espaco.xs }}
          >
            <View style={{ flexDirection: "row" }}>
              {principais.map((t, i) => (
                <View
                  key={t}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: cor.cartao,
                    borderWidth: 1.5,
                    borderColor: cor.borda,
                    alignItems: "center",
                    justifyContent: "center",
                    marginLeft: i === 0 ? 0 : -7,
                  }}
                >
                  <Text style={{ fontSize: 14 }}>{emojiDaReacao(t)}</Text>
                </View>
              ))}
            </View>
            <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: cor.texto, fontVariant: ["tabular-nums"] }}>
              {total}
            </Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={post.salvo ? "Tirar dos salvos" : "Salvar"}
          accessibilityState={{ selected: post.salvo }}
          onPress={() => {
            toque();
            acoes.aoSalvar(post);
          }}
          style={{ width: ALVO_MINIMO + 4, height: ALVO_MINIMO + 4, alignItems: "center", justifyContent: "center" }}
        >
          <Bookmark
            size={24}
            color={post.salvo ? cor.primaria : cor.texto}
            fill={post.salvo ? cor.primaria : "transparent"}
            strokeWidth={1.9}
          />
        </Pressable>
      </View>

      {escolhendo ? (
        <FileiraDeReacoes
          atual={post.minhaReacao}
          aoEscolher={(t) => {
            setEscolhendo(false);
            acoes.aoReagir(post, reacaoDoToque(post.minhaReacao, t));
          }}
        />
      ) : null}

      {acoes.aoComentarios ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => acoes.aoComentarios?.(post)}
          style={{ paddingHorizontal: espaco.lg, minHeight: ALVO_MINIMO, justifyContent: "center", marginBottom: espaco.xs }}
        >
          <Text style={{ fontFamily: fonte.media, fontSize: 14, color: cor.textoApagado }}>
            Ver comentários
          </Text>
        </Pressable>
      ) : (
        <View style={{ height: espaco.sm }} />
      )}
    </View>
  );
});

/** A fileira das 13 reações, na ordem da barra do site. */
export function FileiraDeReacoes({
  atual,
  aoEscolher,
}: {
  atual: TipoDeReacao | null;
  aoEscolher: (t: TipoDeReacao) => void;
}) {
  return (
    <View
      accessibilityRole="menu"
      style={{
        marginHorizontal: espaco.md,
        marginTop: espaco.xs,
        padding: espaco.xs,
        borderRadius: raio.lg,
        backgroundColor: cor.fundo,
        borderWidth: 1,
        borderColor: cor.borda,
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
      }}
    >
      {REACOES.map((r) => {
        const minha = r.tipo === atual;
        return (
          <Pressable
            key={r.tipo}
            accessibilityRole="menuitem"
            accessibilityLabel={minha ? `${r.rotulo} — tocar tira a reação` : r.rotulo}
            accessibilityState={{ selected: minha }}
            onPress={() => {
              toque();
              aoEscolher(r.tipo);
            }}
            style={({ pressed }) => ({
              width: ALVO_MINIMO,
              height: ALVO_MINIMO,
              borderRadius: ALVO_MINIMO / 2,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: minha ? cor.destaque : pressed ? cor.apagado : "transparent",
              transform: [{ scale: pressed ? 1.25 : 1 }],
            })}
          >
            <Text style={{ fontSize: 26 }}>{r.emoji}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * O VÉU: uma caixa do tamanho da foto, SEM a mídia nem o texto na árvore,
 * com o rótulo do assunto (sem contar a história) e um toque para decidir.
 */
function Veu({
  razao,
  motivo,
  temFoto,
  aoRevelar,
}: {
  razao: "sensivel" | "palavra";
  motivo: string | null;
  temFoto: boolean;
  aoRevelar: () => void;
}) {
  const rotulo = razao === "sensivel" ? rotuloDoMotivo(motivo) : "Tem uma palavra que você escondeu";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Conteúdo recolhido: ${rotulo}. Tocar para ver`}
      onPress={aoRevelar}
      style={{
        width: "100%",
        aspectRatio: temFoto ? 1 / PROPORCAO_DA_FOTO : undefined,
        minHeight: temFoto ? undefined : 150,
        backgroundColor: cor.apagado,
        alignItems: "center",
        justifyContent: "center",
        padding: espaco.xl,
        gap: espaco.sm,
      }}
    >
      <EyeOff size={30} color={cor.textoApagado} />
      <Text style={{ fontFamily: fonte.forte, fontSize: 16, color: cor.texto, textAlign: "center" }}>
        {rotulo}
      </Text>
      <Text style={{ fontFamily: fonte.normal, fontSize: 14, color: cor.textoApagado, textAlign: "center" }}>
        {razao === "sensivel"
          ? "Quem publicou avisou que este conteúdo pode ser difícil."
          : "Esta publicação contém uma palavra da sua lista."}
      </Text>
      <View
        style={{
          marginTop: espaco.xs,
          minHeight: ALVO_MINIMO,
          paddingHorizontal: espaco.lg,
          borderRadius: raio.pilula,
          borderWidth: 1,
          borderColor: cor.borda,
          backgroundColor: cor.cartao,
          justifyContent: "center",
        }}
      >
        <Text style={{ fontFamily: fonte.forte, fontSize: 15, color: cor.primariaEscura }}>Ver mesmo assim</Text>
      </View>
    </Pressable>
  );
}
