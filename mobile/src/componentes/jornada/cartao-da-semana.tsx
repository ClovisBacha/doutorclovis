import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { bebeDaSemana } from "~/lib/bebe-da-semana";
import { Brilho } from "~/componentes/jornada/atividade";
import { FolhaDeCompartilhar } from "~/componentes/jornada/compartilhar";
import { arteDoBebe } from "~/componentes/jornada/arte-do-bebe";
import { cor, espaco, fonte } from "~/tema";

/**
 * O CARTÃO DA SEMANA — o que ela posta nos Stories ("24 semanas! 💛", que toda
 * grávida já posta), pronto e bonito, feito da jornada dela: o bebê da semana,
 * o tamanho, os dias de cinco estrelas e a chama. É a gamificação virando
 * orgulho, e cada cartão postado mostra o app às amigas grávidas dela.
 *
 * Ela VÊ o cartão antes (a prévia abre numa folha) e decide compartilhar. A
 * imagem sai da própria vista (`react-native-view-shot`) em 9:16, e vai pela
 * folha de compartilhar do iPhone (Instagram, WhatsApp, Fotos…). Nada do que é
 * íntimo entra: nem gratidão, nem humor, nem sintoma.
 */

const CEU = require("../../../../src/assets/ceu/por-do-sol.webp");

export type DadosDoCartao = {
  semana: number;
  nomeDoBebe: string | null;
  diasCheios: number;
  chama: number;
  faltam: number | null;
};

const LARGURA = 300;
const ALTURA = Math.round((LARGURA * 16) / 9);

export function CartaoDaSemana({ d }: { d: DadosDoCartao }) {
  const bebe = bebeDaSemana(d.semana);
  return (
    <View style={{ width: LARGURA, height: ALTURA, borderRadius: 28, overflow: "hidden" }}>
      <Image
        source={CEU}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        contentFit="cover"
      />
      <LinearGradient
        colors={["rgba(40,20,60,0)", "rgba(40,20,60,0.55)"]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: ALTURA * 0.55 }}
      />
      <View style={{ flex: 1, alignItems: "center", paddingTop: 34, paddingHorizontal: 22 }}>
        <Text
          style={{
            fontFamily: fonte.titulo,
            fontSize: 13,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.85)",
          }}
        >
          {d.nomeDoBebe ? `${d.nomeDoBebe} está chegando` : "Esperando você"}
        </Text>
        <Text
          style={{
            marginTop: 4,
            fontFamily: fonte.titulo,
            fontSize: 46,
            lineHeight: 52,
            letterSpacing: -1,
            color: cor.branco,
          }}
        >
          Semana {d.semana}
        </Text>
        <View style={{ marginTop: 8, alignItems: "center", justifyContent: "center" }}>
          <Brilho tamanho={230} />
          <Image
            source={arteDoBebe(d.semana)}
            style={{ width: 176, height: 176 }}
            contentFit="contain"
          />
        </View>
        <Text
          style={{
            marginTop: 6,
            textAlign: "center",
            fontFamily: fonte.titulo,
            fontSize: 17,
            color: cor.branco,
          }}
        >
          Tamanho de {bebe.fruit.toLowerCase()} · {bebe.size}
        </Text>
        <View style={{ marginTop: 18, width: "100%", gap: 8 }}>
          {d.diasCheios > 0 ? (
            <Linha
              emoji="⭐"
              texto={`${d.diasCheios} ${d.diasCheios === 1 ? "dia" : "dias"} de cuidado completo nesta semana`}
            />
          ) : null}
          {d.chama > 1 ? (
            <Linha emoji="🔥" texto={`${d.chama} dias seguidos cuidando de nós`} />
          ) : null}
          {d.faltam != null ? (
            <Linha emoji="⏳" texto={`faltam ${d.faltam} ${d.faltam === 1 ? "dia" : "dias"}`} />
          ) : null}
        </View>
        <View style={{ flex: 1 }} />
        <Text
          style={{
            marginBottom: 22,
            fontFamily: fonte.forte,
            fontSize: 12,
            letterSpacing: 0.5,
            color: "rgba(255,255,255,0.8)",
          }}
        >
          feito com carinho no app Obstétrica 💛
        </Text>
      </View>
    </View>
  );
}

function Linha({ emoji, texto }: { emoji: string; texto: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.18)",
        paddingHorizontal: 14,
        paddingVertical: 9,
      }}
    >
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
      <Text
        style={{
          flex: 1,
          fontFamily: fonte.forte,
          fontSize: 14,
          lineHeight: 19,
          color: cor.branco,
        }}
      >
        {texto}
      </Text>
    </View>
  );
}

/** A linha da tela Hoje que abre a prévia, e a prévia com o compartilhar. */
export function CompartilharASemana({ d }: { d: DadosDoCartao }) {
  const [aberta, setAberta] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver o cartão da semana ${d.semana} para compartilhar`}
        onPress={() => setAberta(true)}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.md,
          borderRadius: 20,
          backgroundColor: "#fff",
          padding: 12,
          opacity: pressed ? 0.85 : 1,
          shadowColor: "#7a3fd1",
          shadowOpacity: 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 5 },
        })}
      >
        <LinearGradient
          colors={["#f9b17a", "#8f5bd6"]}
          style={{
            width: 46,
            height: 58,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: fonte.titulo, fontSize: 15, color: cor.branco }}>
            {d.semana}
          </Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonte.titulo, fontSize: 15, color: "#3a2230" }}>
            O cartão da semana {d.semana}
          </Text>
          <Text style={{ fontFamily: fonte.media, fontSize: 13, color: "#9a7486" }}>
            Pronto para os Stories e o WhatsApp
          </Text>
        </View>
        <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: "#7a3fd1" }}>Ver ›</Text>
      </Pressable>

      <FolhaDeCompartilhar aberta={aberta} aoFechar={() => setAberta(false)} largura={LARGURA}>
        <CartaoDaSemana d={d} />
      </FolhaDeCompartilhar>
    </>
  );
}
