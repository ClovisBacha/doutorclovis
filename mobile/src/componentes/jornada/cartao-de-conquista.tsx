import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { toque } from "~/componentes/base";
import { Brilho } from "~/componentes/jornada/atividade";
import { FolhaDeCompartilhar } from "~/componentes/jornada/compartilhar";
import { cor, espaco, fonte } from "~/tema";

/**
 * O CARTÃO DA CONQUISTA — o que ela posta quando desbloqueia uma conquista,
 * chega a um marco (a semana nova, o fim do trimestre, mais um mês do bebê)
 * ou quer mostrar a chama. Em 9:16, no mesmo desenho do cartão da semana e do
 * cartão da chegada: a arte grande, o título, uma linha de detalhe e o
 * rodapé do app. Nada íntimo entra — nem humor, nem sintoma, nem saúde.
 */

export type Fundo = "violeta" | "aurora" | "chama";

const FUNDOS: Record<Fundo, readonly [string, string, string]> = {
  violeta: ["#3b1f6e", "#7c3aed", "#f0abfc"],
  aurora: ["#0e7490", "#38bdf8", "#fde68a"],
  chama: ["#7c2d12", "#ea580c", "#fcd34d"],
};

export type DadosDoCartaoDeConquista = {
  /** A linha de cima, em maiúsculas: "Conquista desbloqueada", "Novo marco"… */
  eyebrow: string;
  titulo: string;
  /** Um emoji: a arte do cartão. */
  arte: string;
  detalhe?: string | null;
  /** A raridade, quando é uma conquista ("Épico"). */
  selo?: string | null;
  fundo: Fundo;
};

const LARGURA = 300;
const ALTURA = Math.round((LARGURA * 16) / 9);

export function CartaoDeConquista({ d }: { d: DadosDoCartaoDeConquista }) {
  return (
    <View style={{ width: LARGURA, height: ALTURA, borderRadius: 28, overflow: "hidden" }}>
      <LinearGradient
        colors={FUNDOS[d.fundo]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <View style={{ flex: 1, alignItems: "center", paddingTop: 44, paddingHorizontal: 24 }}>
        <Text
          style={{
            fontFamily: fonte.titulo,
            fontSize: 13,
            letterSpacing: 2.2,
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.85)",
          }}
        >
          {d.eyebrow}
        </Text>
        <View
          style={{ marginTop: 26, alignItems: "center", justifyContent: "center", height: 200 }}
        >
          <Brilho tamanho={240} tinta="rgba(255,255,255,0.35)" />
          <Text style={{ fontSize: 110, lineHeight: 130 }}>{d.arte}</Text>
        </View>
        {d.selo ? (
          <View
            style={{
              marginTop: 6,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.22)",
              paddingHorizontal: 12,
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                fontFamily: fonte.titulo,
                fontSize: 12,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: cor.branco,
              }}
            >
              {d.selo}
            </Text>
          </View>
        ) : null}
        <Text
          numberOfLines={3}
          style={{
            marginTop: 14,
            textAlign: "center",
            fontFamily: fonte.titulo,
            fontSize: 32,
            lineHeight: 38,
            letterSpacing: -0.6,
            color: cor.branco,
          }}
        >
          {d.titulo}
        </Text>
        {d.detalhe ? (
          <Text
            numberOfLines={4}
            style={{
              marginTop: 10,
              textAlign: "center",
              fontFamily: fonte.media,
              fontSize: 15,
              lineHeight: 21,
              color: "rgba(255,255,255,0.9)",
            }}
          >
            {d.detalhe}
          </Text>
        ) : null}
        <View style={{ flex: 1 }} />
        <Text
          style={{
            marginBottom: 22,
            fontFamily: fonte.forte,
            fontSize: 12,
            letterSpacing: 0.5,
            color: "rgba(255,255,255,0.85)",
          }}
        >
          feito com carinho no app Obstétrica 💛
        </Text>
      </View>
    </View>
  );
}

/**
 * O botão "Compartilhar 💌" e a prévia que ele abre. Vai DENTRO da janela da
 * comemoração (a festa do marco, a conquista, a folha da chama): no iPhone, a
 * folha do cartão precisa nascer da janela que já está aberta.
 */
export function CompartilharConquista({
  d,
  tinta = "#7c3aed",
  fundoDoBotao = "#f3e8ff",
}: {
  d: DadosDoCartaoDeConquista;
  tinta?: string;
  fundoDoBotao?: string;
}) {
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Compartilhar"
        onPress={() => {
          toque();
          setAberta(true);
        }}
        style={({ pressed }) => ({
          alignSelf: "stretch",
          minHeight: 48,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
          backgroundColor: fundoDoBotao,
          paddingHorizontal: espaco.lg,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={{ fontFamily: fonte.titulo, fontSize: 15, color: tinta }}>
          Compartilhar 💌
        </Text>
      </Pressable>
      <FolhaDeCompartilhar
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        largura={LARGURA}
        corDoBotao={tinta}
      >
        <CartaoDeConquista d={d} />
      </FolhaDeCompartilhar>
    </>
  );
}
