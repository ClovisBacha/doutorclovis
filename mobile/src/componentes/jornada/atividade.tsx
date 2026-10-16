import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { toque } from "~/componentes/base";
import { BolhaViva, type HumorDaBolha } from "~/componentes/movimento";
import { clarear, comAlfa, escurecer, misturar } from "~/lib/cor";
import { ALVO_MINIMO, cor, espaco, fonte } from "~/tema";

/**
 * AS PEÇAS DAS ATIVIDADES DO APP ANTIGO — o Movimento (verde) e a Meditação
 * (violeta) do site tinham o mesmo esqueleto, cada um na sua cor: o degradê da
 * tela inteira, a bolha GRANDE falando num balão, os rótulos de seção em
 * maiúsculas, os botões que enchem de cor quando escolhidos e o rodapé fixo
 * com o botão de começar. Aqui o esqueleto é um só e a cor vem da paleta.
 *
 * O MATERIAL (out/2026, "o design ainda está muito básico"): os botões e as
 * escolhas têm RELEVO — a face em cima de um "lábio" mais escuro, que afunda
 * quando o dedo aperta. É a linguagem da trilha da Jornada, e é ela que tira
 * a cara de formulário de site (borda de 1 px em vidro claro). As superfícies
 * brancas levam sombra na cor da atividade, nunca cinza.
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

/** A altura do lábio: o quanto o botão afunda quando o dedo aperta. */
const LABIO = 4;

/** As cores do material, tiradas da cor forte da atividade. */
export function materialDe(p: PaletaDaAtividade) {
  return {
    /** Embaixo da face cheia (a escolhida, o botão de começar). */
    labioCheio: escurecer(p.forte, 0.28),
    /** Embaixo da face branca. */
    labioClaro: misturar(p.borda, p.forte, 0.16),
    /** O círculo claro atrás de um ícone. */
    ficha: clarear(p.forte, 0.88),
  };
}

/** A sombra das superfícies brancas: na cor da atividade, e não cinza. */
export function sombraDe(tinta: string, forca = 1) {
  return {
    shadowColor: tinta,
    shadowOpacity: 0.12 * forca,
    shadowRadius: 14 * forca,
    shadowOffset: { width: 0, height: 5 * forca },
    elevation: Math.round(2 * forca),
  } as const;
}

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

/**
 * O BRILHO atrás da arte: a luz de estúdio em que as artes 3D foram pintadas.
 * Sem ele, a arte flutua num degradê chapado e parece recortada.
 */
export function Brilho({ tamanho, tinta = "#ffffff" }: { tamanho: number; tinta?: string }) {
  return (
    <Svg
      width={tamanho}
      height={tamanho}
      pointerEvents="none"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        marginLeft: -tamanho / 2,
        marginTop: -tamanho / 2,
      }}
    >
      <Defs>
        <RadialGradient id="brilho-da-arte" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={tinta} stopOpacity={0.95} />
          <Stop offset="0.55" stopColor={tinta} stopOpacity={0.5} />
          <Stop offset="1" stopColor={tinta} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={tamanho / 2} cy={tamanho / 2} r={tamanho / 2} fill="url(#brilho-da-arte)" />
    </Svg>
  );
}

/* O balão sem paleta (o fim do Bebê): âmbar, como a fala do porta-voz no site. */
const BALAO = { texto: "#7b3306", sombra: "#bb4d00" } as const;

/**
 * O porta-voz, GRANDE e falando num balão — "ele que vai interagir com as
 * pessoas", nas palavras do dono no app antigo. O balão é branco, com a ponta
 * virada para a bolha: é ela quem fala, e não uma etiqueta embaixo dela.
 */
export function BolhaComBalao({
  humor,
  fala,
  tamanho = 168,
  paleta,
}: {
  humor: HumorDaBolha;
  fala: string;
  tamanho?: number;
  paleta?: PaletaDaAtividade;
}) {
  const grande = tamanho >= 120;
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        {grande ? <Brilho tamanho={tamanho * 1.45} /> : null}
        <BolhaViva humor={humor} tamanho={tamanho} moldura={false} />
      </View>
      {grande ? <SombraDoChao /> : null}
      <View
        style={{ marginTop: grande ? espaco.sm : espaco.md, maxWidth: 296, alignItems: "center" }}
      >
        <View
          style={{
            borderRadius: 18,
            backgroundColor: cor.branco,
            paddingHorizontal: espaco.lg,
            paddingVertical: 10,
            ...sombraDe(paleta?.forte ?? BALAO.sombra),
          }}
        >
          <Text
            style={{
              textAlign: "center",
              fontFamily: fonte.media,
              fontSize: 14,
              lineHeight: 20,
              color: paleta?.titulo ?? BALAO.texto,
            }}
          >
            {fala}
          </Text>
        </View>
        {/* A ponta, por CIMA do balão: assim a sombra dele não a corta. */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -6,
            width: 14,
            height: 14,
            borderRadius: 3,
            backgroundColor: cor.branco,
            transform: [{ rotate: "45deg" }],
          }}
        />
      </View>
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
        fontFamily: fonte.titulo,
        fontSize: 30,
        lineHeight: 36,
        letterSpacing: -0.3,
        color: paleta.titulo,
      }}
    >
      {children}
    </Text>
  );
}

/**
 * O título de seção. Era em maiúsculas espaçadas, na cor clara — o rótulo de
 * formulário do site. Agora é frase, forte e escura: é a pergunta que a tela
 * faz a ela, e pergunta se lê, não se soletra.
 */
export function Secao({
  paleta,
  children,
  cor: tinta,
  topo = 28,
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
        marginBottom: espaco.md,
        fontFamily: fonte.titulo,
        fontSize: 17,
        lineHeight: 22,
        color: tinta ?? paleta.titulo,
      }}
    >
      {children}
    </Text>
  );
}

/** O círculo claro atrás de um ícone (o emoji de uma escolha, um ícone desenhado). */
export function Ficha({
  fundo,
  tamanho = 36,
  children,
}: {
  fundo: string;
  tamanho?: number;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: tamanho / 2,
        backgroundColor: fundo,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}

/** A superfície branca: o cartão do material, com a sombra na cor da atividade. */
export function Superficie({
  tinta,
  fundo = cor.branco,
  estilo,
  children,
}: {
  /** A cor da sombra (a forte da atividade). */
  tinta: string;
  fundo?: string;
  estilo?: ViewStyle;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        borderRadius: 22,
        backgroundColor: fundo,
        padding: espaco.lg,
        ...sombraDe(tinta),
        ...estilo,
      }}
    >
      {children}
    </View>
  );
}

/**
 * O BOTÃO COM RELEVO: a face em cima do lábio, que afunda quando o dedo aperta
 * (a altura total não muda, então nada embaixo dele pula). `claro` é o botão
 * secundário: face branca, letra na cor.
 */
export function BotaoDaAtividade({
  cor: tinta,
  rotulo,
  aoTocar,
  desabilitado,
  claro,
  icone,
  rotuloAcessivel,
  carregando,
  vibrar = true,
}: {
  cor: string;
  rotulo: string;
  aoTocar: () => void;
  desabilitado?: boolean;
  claro?: boolean;
  icone?: ReactNode;
  rotuloAcessivel?: string;
  /** Gravando: a roda gira no lugar do ícone e o botão não aceita outro toque. */
  carregando?: boolean;
  /** `false` quando a própria ação vibra do seu jeito (o acerto e o erro da aula). */
  vibrar?: boolean;
}) {
  const labio = claro ? clarear(tinta, 0.72) : escurecer(tinta, 0.28);
  const off = desabilitado || carregando;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel ?? rotulo}
      accessibilityState={{ disabled: !!off, busy: !!carregando }}
      disabled={off}
      onPress={() => {
        if (vibrar) toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        borderRadius: 20,
        backgroundColor: labio,
        paddingBottom: pressed ? 1 : LABIO + 1,
        marginTop: pressed ? LABIO : 0,
        opacity: desabilitado ? 0.45 : 1,
      })}
    >
      <View
        style={{
          minHeight: claro ? 48 : 54,
          borderRadius: 20,
          backgroundColor: claro ? cor.branco : tinta,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: espaco.sm,
          paddingHorizontal: espaco.xl,
        }}
      >
        {carregando ? <ActivityIndicator color={claro ? tinta : cor.branco} /> : icone}
        <Text
          style={{
            fontFamily: fonte.titulo,
            fontSize: claro ? 15 : 17,
            lineHeight: 22,
            letterSpacing: 0.2,
            color: claro ? tinta : cor.branco,
          }}
        >
          {rotulo}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * As escolhas, com relevo: face branca sobre o lábio claro; escolhida, a face
 * enche de cor sobre o lábio escuro. `centro` é o botão de tempo (texto no
 * meio, mais forte); sem ele, o ícone vai numa ficha à esquerda.
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
  const m = materialDe(paleta);
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
        borderRadius: 18,
        backgroundColor: ativa ? m.labioCheio : m.labioClaro,
        paddingBottom: pressed ? 1 : LABIO,
        marginTop: pressed ? LABIO - 1 : 0,
      })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: centro ? "center" : "flex-start",
          gap: 10,
          minHeight: centro ? 48 : 58,
          paddingHorizontal: centro ? espaco.md : 10,
          paddingVertical: espaco.sm,
          borderRadius: 18,
          backgroundColor: ativa ? paleta.forte : cor.branco,
        }}
      >
        {children ? (
          <Ficha fundo={ativa ? "rgba(255,255,255,0.22)" : m.ficha}>{children}</Ficha>
        ) : null}
        <Text
          style={{
            flexShrink: 1,
            fontFamily: centro ? fonte.titulo : fonte.forte,
            fontSize: centro ? 16 : 14,
            lineHeight: centro ? 20 : 18,
            color: ativa ? cor.branco : centro ? paleta.forte : paleta.titulo,
          }}
        >
          {rotulo}
        </Text>
      </View>
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
  const m = materialDe(paleta);
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
        borderRadius: 20,
        backgroundColor: ativa ? m.labioCheio : m.labioClaro,
        paddingBottom: pressed ? 1 : LABIO,
        marginTop: pressed ? LABIO - 1 : 0,
      })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.md,
          minHeight: ALVO_MINIMO + 12,
          paddingHorizontal: espaco.lg,
          paddingVertical: espaco.md,
          borderRadius: 20,
          backgroundColor: ativa ? paleta.forte : cor.branco,
        }}
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
      </View>
    </Pressable>
  );
}

/**
 * O rodapé fixo com o botão de começar: a lista não empurra o botão para fora
 * da tela. Sem linha divisória: a lista some num esfumado em cima dele.
 */
export function RodapeDaAtividade({
  paleta,
  children,
}: {
  paleta: PaletaDaAtividade;
  children: ReactNode;
}) {
  const base = paleta.fundo[2];
  return (
    <View
      style={{
        backgroundColor: base,
        paddingHorizontal: espaco.xl,
        paddingTop: espaco.sm,
        paddingBottom: espaco.md,
      }}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[comAlfa(base, 0), base]}
        style={{ position: "absolute", left: 0, right: 0, top: -28, height: 28 }}
      />
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
