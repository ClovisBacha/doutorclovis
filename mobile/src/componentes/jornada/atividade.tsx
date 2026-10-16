import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, Ellipse, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { toque } from "~/componentes/base";
import { BolhaViva, type HumorDaBolha } from "~/componentes/movimento";
import { ALVO_MINIMO, cor, espaco, fonte } from "~/tema";

/**
 * AS PEÇAS DAS ATIVIDADES DO APP ANTIGO — o Movimento (verde) e a Meditação
 * (violeta) do site tinham o mesmo esqueleto, cada um na sua cor: o degradê da
 * tela inteira, a bolha GRANDE falando num balão, os rótulos de seção em
 * maiúsculas, os botões que enchem de cor quando escolhidos e o rodapé fixo
 * com o botão de começar. Aqui o esqueleto é um só e a cor vem da paleta.
 */

export type PaletaDaAtividade = {
  /** O degradê de cima para baixo (`from-*-100 via-*-50 to-white`). */
  fundo: readonly [string, string, string];
  /** O botão cheio e o texto forte (`*-700`). */
  forte: string;
  /** Os títulos (`*-900`). */
  titulo: string;
  /** O rótulo de seção (`*-600` no Movimento, `*-500` na Meditação). */
  secao: string;
  /** A borda dos botões e cartões (`*-200`). */
  borda: string;
  /** O vidro claro dos botões (`bg-white/70`). */
  vidro: string;
  /** O texto discreto (`*-700/60`). */
  discreto: string;
  /** O texto secundário sobre o botão cheio (`text-white/75`). */
  brancoSuave: string;
};

/** O degradê da atividade, atrás de todas as telas dela. */
export function FundoDaAtividade({
  paleta,
  children,
}: {
  paleta: PaletaDaAtividade;
  children: ReactNode;
}) {
  return (
    <LinearGradient colors={[...paleta.fundo]} style={{ flex: 1 }}>
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}

/** A sombra no chão, embaixo da bolha: sem ela, a bolha parece um adesivo. */
function SombraDoChao() {
  return (
    <Svg width={150} height={18} style={{ marginTop: -6 }}>
      <Defs>
        <RadialGradient id="sombra-do-chao" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor="#000000" stopOpacity={0.16} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={75} cy={9} rx={75} ry={9} fill="url(#sombra-do-chao)" />
    </Svg>
  );
}

/* O balão da bolha (`BolhaComBalao` do site): âmbar, como a fala do porta-voz. */
const BALAO = { fundo: "rgba(255,255,255,0.85)", borda: "#fee685", texto: "#7b3306" } as const;

/**
 * O porta-voz, GRANDE e falando num balão — "ele que vai interagir com as
 * pessoas", nas palavras do dono no app antigo.
 */
export function BolhaComBalao({
  humor,
  fala,
  tamanho = 168,
}: {
  humor: HumorDaBolha;
  fala: string;
  tamanho?: number;
}) {
  return (
    <View style={{ alignItems: "center" }}>
      <BolhaViva humor={humor} tamanho={tamanho} moldura={false} />
      {tamanho >= 120 ? <SombraDoChao /> : null}
      <Text
        style={{
          marginTop: espaco.sm,
          maxWidth: 272,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: BALAO.borda,
          backgroundColor: BALAO.fundo,
          paddingHorizontal: 14,
          paddingVertical: espaco.sm,
          overflow: "hidden",
          fontFamily: fonte.normal,
          fontSize: 13,
          lineHeight: 18,
          color: BALAO.texto,
        }}
      >
        {fala}
      </Text>
    </View>
  );
}

/** O título grande da atividade, embaixo da bolha. */
export function TituloDaAtividade({
  paleta,
  children,
}: {
  paleta: PaletaDaAtividade;
  children: string;
}) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        marginTop: espaco.lg,
        textAlign: "center",
        fontFamily: fonte.media,
        fontSize: 26,
        lineHeight: 32,
        color: paleta.titulo,
      }}
    >
      {children}
    </Text>
  );
}

/** O rótulo de seção, em maiúsculas espaçadas. */
export function Secao({
  paleta,
  children,
  cor: tinta,
  topo = espaco.xl,
}: {
  paleta: PaletaDaAtividade;
  children: string;
  cor?: string;
  topo?: number;
}) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        marginTop: topo,
        marginBottom: espaco.sm,
        fontFamily: fonte.forte,
        fontSize: 13,
        letterSpacing: 0.65,
        textTransform: "uppercase",
        color: tinta ?? paleta.secao,
      }}
    >
      {children}
    </Text>
  );
}

/**
 * Os botões de escolha do app antigo: cor cheia quando escolhido, vidro claro
 * com borda quando não. `centro` é o botão de tempo (texto no meio, mais
 * forte); sem ele, o conteúdo encosta à esquerda.
 */
export function Escolha({
  paleta,
  rotulo,
  ativa,
  aoTocar,
  centro,
  estilo,
  children,
}: {
  paleta: PaletaDaAtividade;
  rotulo: string;
  ativa: boolean;
  aoTocar: () => void;
  centro?: boolean;
  estilo?: { width?: `${number}%`; flex?: number };
  children?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: ativa }}
      accessibilityLabel={rotulo}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        ...estilo,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: centro ? "center" : "flex-start",
        gap: espaco.sm,
        minHeight: centro ? 48 : ALVO_MINIMO + 8,
        paddingHorizontal: espaco.md,
        paddingVertical: 10,
        borderRadius: 16,
        borderWidth: ativa ? 0 : 1,
        borderColor: paleta.borda,
        backgroundColor: ativa ? paleta.forte : paleta.vidro,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {children}
      <Text
        style={{
          flexShrink: 1,
          fontFamily: centro ? fonte.titulo : fonte.forte,
          fontSize: centro ? 14 : 13,
          lineHeight: centro ? 20 : 17,
          color: ativa ? cor.branco : centro ? paleta.forte : paleta.titulo,
        }}
      >
        {rotulo}
      </Text>
    </Pressable>
  );
}

/**
 * A linha de escolha com título e legenda (o tema da meditação, a quantidade
 * de voz): a legenda diz o que o título não diz sozinho.
 */
export function EscolhaComLegenda({
  paleta,
  titulo,
  legenda,
  ativa,
  aoTocar,
  antes,
  depois,
}: {
  paleta: PaletaDaAtividade;
  titulo: string;
  legenda: string;
  ativa: boolean;
  aoTocar: () => void;
  antes?: ReactNode;
  depois?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: ativa }}
      accessibilityLabel={`${titulo}. ${legenda}`}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        minHeight: ALVO_MINIMO + 12,
        paddingHorizontal: espaco.lg,
        paddingVertical: espaco.md,
        borderRadius: 16,
        borderWidth: ativa ? 0 : 1,
        borderColor: paleta.borda,
        backgroundColor: ativa ? paleta.forte : paleta.vidro,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {antes}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: fonte.titulo,
            fontSize: 14,
            lineHeight: 19,
            color: ativa ? cor.branco : paleta.titulo,
          }}
        >
          {titulo}
        </Text>
        <Text
          style={{
            fontFamily: fonte.normal,
            fontSize: 13,
            lineHeight: 17,
            color: ativa ? paleta.brancoSuave : paleta.discreto,
          }}
        >
          {legenda}
        </Text>
      </View>
      {depois}
    </Pressable>
  );
}

/** O rodapé fixo com o botão de começar: a lista não empurra o botão para fora da tela. */
export function RodapeDaAtividade({
  paleta,
  children,
}: {
  paleta: PaletaDaAtividade;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: paleta.borda,
        backgroundColor: paleta.vidro,
        paddingHorizontal: espaco.xl,
        paddingVertical: espaco.md,
      }}
    >
      {children}
    </View>
  );
}

/**
 * A VOZ, DESENHADA — um balão de fala com duas linhas por dentro. Pedido do
 * dono no app antigo, no lugar do emoji 🗣️ ("está muito feio"): a mesma ideia,
 * sem o emoji que cada sistema desenha de um jeito.
 */
export function IconeDaVoz({ cor: tinta, tamanho = 18 }: { cor: string; tamanho?: number }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={4} width={17} height={11} rx={3} stroke={tinta} strokeWidth={1.7} />
      <Path
        d="M7.5 15v3.6l3.6-3.6"
        stroke={tinta}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M8 8.3h8M8 11.3h5" stroke={tinta} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

/** O botão da voz: 44 de dedo, o ícone apagado quando desligada. */
export function BotaoDaVoz({
  ligada,
  aoTocar,
  corLigada,
  corDesligada,
}: {
  ligada: boolean;
  aoTocar: () => void;
  corLigada: string;
  corDesligada: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={ligada ? "Desligar voz" : "Ligar voz"}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        width: ALVO_MINIMO,
        height: ALVO_MINIMO,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <IconeDaVoz cor={ligada ? corLigada : corDesligada} />
    </Pressable>
  );
}
