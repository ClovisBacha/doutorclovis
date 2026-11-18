import { LinearGradient } from "expo-linear-gradient";
import { Share as IconeDeCompartilhar } from "lucide-react-native";
import { useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { toque } from "~/componentes/base";
import { Brilho } from "~/componentes/jornada/atividade";
import { FolhaDeCompartilhar } from "~/componentes/jornada/compartilhar";
import { useMolaDeToque } from "~/componentes/movimento";
import { legendaDoCartao } from "~/lib/jornada/cartoes";
import { amanhecer, canto, cor, curva, escala, espaco, fonte, veu } from "~/tema";

/**
 * O CARTÃO DA CONQUISTA — o que ela posta quando desbloqueia uma conquista,
 * chega a um marco (a semana nova, o fim do trimestre, mais um mês do bebê)
 * ou quer mostrar a chama. Em 9:16, no mesmo desenho do cartão da semana e do
 * cartão da chegada: a arte grande, o título, uma linha de detalhe e a
 * assinatura do app. Nada íntimo entra — nem humor, nem sintoma, nem saúde.
 *
 * É a cara do app FORA dele (18/11/2026): os fundos saem dos degradês do
 * Tailwind (violeta-fúcsia, azul-céu, laranja) e passam ao céu do Amanhecer —
 * a noite ameixa no alto, a luz embaixo —, o título vai na serifada, e a
 * assinatura é o nome do app e o @ dele, sem emoji.
 */

export type Fundo = "violeta" | "aurora" | "chama";

/** Do alto (a noite) para baixo (a luz), sempre com a tinta do tema. */
const FUNDOS: Record<
  Fundo,
  { cores: readonly [string, string, ...string[]]; paradas: readonly [number, number, ...number[]] }
> = {
  /* A conquista: a noite que vira violeta. */
  violeta: { cores: [veu.fundoDoVeu, cor.jogo, amanhecer[2]], paradas: [0, 0.55, 1] },
  /* O marco: o amanhecer inteiro, da noite ao coral do horizonte. */
  aurora: {
    cores: [veu.fundoDoVeu, amanhecer[2], amanhecer[1], amanhecer[0]],
    paradas: [0, 0.42, 0.78, 1],
  },
  /* A chama: da ameixa à framboesa e ao coral. */
  chama: { cores: [cor.texto, cor.primaria, amanhecer[0]], paradas: [0, 0.6, 1] },
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
  const f = FUNDOS[d.fundo];
  return (
    <View
      style={{
        width: LARGURA,
        height: ALTURA,
        borderRadius: canto.cartao,
        ...curva,
        overflow: "hidden",
        backgroundColor: veu.fundoDoVeu,
      }}
    >
      <LinearGradient
        colors={f.cores}
        locations={f.paradas}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />
      {/* Um véu no pé do cartão: a assinatura se lê também sobre o coral. */}
      <LinearGradient
        colors={[veu.tinta(0), veu.tinta(0.42)]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 150 }}
      />
      <View style={{ flex: 1, alignItems: "center", paddingTop: 44, paddingHorizontal: 24 }}>
        <Text
          style={{
            ...fonte.forte,
            ...escala.nota,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: veu.textoNoVeu,
          }}
        >
          {d.eyebrow}
        </Text>
        <View
          style={{ marginTop: 22, alignItems: "center", justifyContent: "center", height: 196 }}
        >
          <Brilho tamanho={240} tinta={cor.branco} />
          <Text allowFontScaling={false} style={{ fontSize: 108, lineHeight: 128 }}>
            {d.arte}
          </Text>
        </View>
        {d.selo ? (
          <View
            style={{
              marginTop: 6,
              borderRadius: canto.pilula,
              borderWidth: 1,
              borderColor: veu.campoBorda,
              backgroundColor: veu.campo,
              paddingHorizontal: 12,
              paddingVertical: 3,
            }}
          >
            <Text
              style={{
                ...fonte.forte,
                ...escala.nota,
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
            ...fonte.display,
            ...escala.grande,
            letterSpacing: -0.2,
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
              ...fonte.media,
              ...escala.legenda,
              color: cor.branco,
            }}
          >
            {d.detalhe}
          </Text>
        ) : null}
        <View style={{ flex: 1 }} />
        {/* A assinatura: o nome do app e onde achá-lo. */}
        <View style={{ marginBottom: 22, alignItems: "center", gap: 1 }}>
          <Text
            style={{
              ...fonte.display,
              ...escala.manchete,
              letterSpacing: -0.2,
              color: cor.branco,
            }}
          >
            Mãe Esperta
          </Text>
          <Text style={{ ...fonte.forte, ...escala.nota, color: veu.textoNoVeu }}>
            @maeesperta.app
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * O botão "Compartilhar" e a prévia que ele abre. Vai DENTRO da janela da
 * comemoração (a festa do marco, a conquista, a folha da chama): no iPhone, a
 * folha do cartão precisa nascer da janela que já está aberta.
 *
 * É o botão SEGUNDO da janela (a tinta framboesa sobre o rosado), com o
 * ícone de compartilhar do sistema — sem o 💌 no rótulo.
 */
export function CompartilharConquista({
  d,
  tinta = cor.primaria,
  fundoDoBotao = cor.destaque,
}: {
  d: DadosDoCartaoDeConquista;
  tinta?: string;
  fundoDoBotao?: string;
}) {
  const [aberta, setAberta] = useState(false);
  const mola = useMolaDeToque(0.96);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Compartilhar"
        onPressIn={mola.aoPressionar}
        onPressOut={mola.aoSoltar}
        onPress={() => {
          toque();
          setAberta(true);
        }}
        style={{ alignSelf: "stretch" }}
      >
        <Animated.View
          style={{
            minHeight: 48,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: espaco.sm,
            borderRadius: canto.pilula,
            ...curva,
            backgroundColor: fundoDoBotao,
            paddingHorizontal: espaco.lg,
            transform: [{ scale: mola.escala }],
          }}
        >
          <IconeDeCompartilhar size={18} color={tinta} strokeWidth={2.4} />
          <Text style={{ ...fonte.forte, ...escala.manchete, color: tinta }}>Compartilhar</Text>
        </Animated.View>
      </Pressable>
      <FolhaDeCompartilhar
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        largura={LARGURA}
        corDoBotao={cor.primaria}
        legenda={legendaDoCartao(d)}
      >
        <CartaoDeConquista d={d} />
      </FolhaDeCompartilhar>
    </>
  );
}
