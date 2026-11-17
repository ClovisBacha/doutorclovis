import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { createContext, useContext, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { FundoDeLuz } from "~/componentes/luz";
import { useMolaDeToque } from "~/componentes/movimento";
import { clarear, comAlfa, escurecer } from "~/lib/cor";
import { ALVO_MINIMO, aperto, cor, curva, espaco, fonte, luz, raio, sombra } from "~/tema";

export function toque(leve = true) {
  if (Platform.OS === "web") return;
  void Haptics.impactAsync(
    leve ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
  ).catch(() => {});
}

/**
 * A FOLGA DA BARRA: a barra de abas FLUTUA sobre o conteúdo (o vidro de
 * 16/11/2026), então quem rola dentro de uma aba precisa terminar acima dela.
 * A barra mede a própria altura (com a distância até a borda de baixo) e a
 * entrega aqui; fora das abas (as telas empilhadas) a folga é zero.
 */
export const FolgaDaBarra = createContext(0);
export const useFolgaDaBarra = () => useContext(FolgaDaBarra);

/** O espaço que sobra embaixo de uma rolagem: o de sempre, ou mais, se a barra flutua por cima. */
export function useFimDaRolagem(minimo = 120): number {
  return Math.max(minimo, useFolgaDaBarra() + espaco.xl);
}

/**
 * A tela. Sem `fundo`, o fundo é a LUZ (`FundoDeLuz`); com ele, a cor pedida
 * (a entrada usa "transparent", por cima do degradê dela).
 */
export function Tela({
  children,
  rolar = true,
  bordas = ["top"],
  estilo,
  fundo,
}: {
  children: ReactNode;
  rolar?: boolean;
  bordas?: Edge[];
  estilo?: StyleProp<ViewStyle>;
  fundo?: string;
}) {
  const fim = useFimDaRolagem();
  return (
    <SafeAreaView edges={bordas} style={{ flex: 1, backgroundColor: fundo ?? luz.base }}>
      {fundo ? null : <FundoDeLuz />}
      {rolar ? (
        <ScrollView
          contentContainerStyle={[
            { padding: espaco.lg, paddingBottom: fim, gap: espaco.md },
            estilo,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, padding: espaco.lg, gap: espaco.md }, estilo]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type TipoTexto = "titulo" | "subtitulo" | "corpo" | "apagado" | "rotulo" | "numero";

export function T({
  children,
  tipo = "corpo",
  estilo,
  cor: corTexto,
  linhas,
  centro,
}: {
  children: ReactNode;
  tipo?: TipoTexto;
  estilo?: StyleProp<TextStyle>;
  cor?: string;
  linhas?: number;
  centro?: boolean;
}) {
  return (
    <Text
      numberOfLines={linhas}
      style={[
        estilosTexto[tipo],
        corTexto ? { color: corTexto } : null,
        centro ? { textAlign: "center" } : null,
        estilo,
      ]}
    >
      {children}
    </Text>
  );
}

const estilosTexto = StyleSheet.create({
  titulo: { ...fonte.titulo, fontSize: 28, color: cor.texto, letterSpacing: aperto.titulo },
  subtitulo: { ...fonte.forte, fontSize: 19, color: cor.texto, letterSpacing: aperto.subtitulo },
  corpo: { ...fonte.normal, fontSize: 16, lineHeight: 24, color: cor.texto },
  apagado: { ...fonte.normal, fontSize: 14, lineHeight: 20, color: cor.textoApagado },
  rotulo: { ...fonte.forte, fontSize: 15, color: cor.texto },
  numero: {
    ...fonte.titulo,
    fontSize: 40,
    color: cor.texto,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
});

/**
 * O CARTÃO: material, e não vidro (o vidro é da camada que flutua). Branco com
 * um tico da luz do fundo passando, o canto contínuo do iPhone, um fio de luz
 * na borda e a sombra em três camadas do tema.
 */
export function Cartao({
  children,
  estilo,
  fundo = luz.cartao,
  aoTocar,
  rotuloAcessivel,
}: {
  children: ReactNode;
  estilo?: StyleProp<ViewStyle>;
  fundo?: string;
  aoTocar?: () => void;
  rotuloAcessivel?: string;
}) {
  const base = [
    {
      backgroundColor: fundo,
      borderRadius: raio.lg,
      ...curva,
      padding: espaco.lg,
      gap: espaco.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.9)",
    },
    sombra,
    estilo,
  ];
  if (!aoTocar) return <View style={base}>{children}</View>;
  return (
    <CartaoTocavel base={base} aoTocar={aoTocar} rotuloAcessivel={rotuloAcessivel}>
      {children}
    </CartaoTocavel>
  );
}

/* Layout fica no Pressable de fora (para flex/margens valerem na linha do
   pai); o visual vai na camada animada de dentro, que afunda com a mola. */
const CHAVES_DE_LAYOUT = [
  "flex",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "width",
  "minWidth",
  "maxWidth",
  "alignSelf",
  "margin",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginHorizontal",
  "marginVertical",
  "position",
  "top",
  "left",
  "right",
  "bottom",
] as const;

function separarLayout(estilo: StyleProp<ViewStyle>): [ViewStyle, ViewStyle] {
  const plano = { ...(StyleSheet.flatten(estilo) ?? {}) } as Record<string, unknown>;
  const fora: Record<string, unknown> = {};
  for (const k of CHAVES_DE_LAYOUT) {
    if (k in plano) {
      fora[k] = plano[k];
      delete plano[k];
    }
  }
  return [fora as ViewStyle, plano as ViewStyle];
}

function CartaoTocavel({
  base,
  aoTocar,
  rotuloAcessivel,
  children,
}: {
  base: StyleProp<ViewStyle>;
  aoTocar: () => void;
  rotuloAcessivel?: string;
  children: ReactNode;
}) {
  const { escala, aoPressionar, aoSoltar } = useMolaDeToque(0.975);
  const [fora, dentro] = separarLayout(base);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel}
      onPressIn={aoPressionar}
      onPressOut={aoSoltar}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={fora}
    >
      <Animated.View style={[dentro, { transform: [{ scale: escala }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Botao({
  rotulo,
  aoTocar,
  tipo = "primario",
  carregando,
  desabilitado,
  estilo,
  corFundo,
  icone,
}: {
  rotulo: string;
  aoTocar: () => void;
  tipo?: "primario" | "secundario" | "perigo" | "texto";
  carregando?: boolean;
  desabilitado?: boolean;
  estilo?: StyleProp<ViewStyle>;
  corFundo?: string;
  icone?: ReactNode;
}) {
  const fundo =
    tipo === "primario"
      ? (corFundo ?? cor.primaria)
      : tipo === "perigo"
        ? cor.urgente
        : tipo === "secundario"
          ? cor.cartao
          : "transparent";
  const corTexto =
    tipo === "secundario" ? cor.primariaEscura : tipo === "texto" ? cor.primariaEscura : cor.branco;
  const off = desabilitado || carregando;
  /* A LUZ do botão cheio: o degradê de cima (mais claro) para baixo (mais
     escuro) e o brilho colorido embaixo — o relevo de um botão da Apple, e
     não um retângulo chapado. */
  const cheio = tipo === "primario" || tipo === "perigo";
  const { escala, aoPressionar, aoSoltar } = useMolaDeToque(0.96);
  const [fora, dentro] = separarLayout(estilo);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: !!off, busy: !!carregando }}
      disabled={off}
      onPressIn={aoPressionar}
      onPressOut={aoSoltar}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={fora}
    >
      <Animated.View
        style={[
          {
            minHeight: ALVO_MINIMO + 4,
            borderRadius: raio.pilula,
            ...curva,
            backgroundColor: fundo,
            paddingHorizontal: espaco.xl,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: espaco.sm,
            opacity: off ? 0.5 : 1,
          },
          tipo === "secundario" && { borderWidth: 1, borderColor: cor.borda },
          cheio && !off ? { boxShadow: `0px 10px 22px -10px ${comAlfa(fundo, 0.75)}` } : null,
          dentro,
          { transform: [{ scale: escala }] },
        ]}
      >
        {cheio ? (
          <LinearGradient
            pointerEvents="none"
            colors={[clarear(fundo, 0.16), fundo, escurecer(fundo, 0.1)]}
            locations={[0, 0.5, 1]}
            style={[StyleSheet.absoluteFill, { borderRadius: raio.pilula, ...curva }]}
          />
        ) : null}
        {carregando ? <ActivityIndicator color={corTexto} /> : icone}
        <Text style={{ ...fonte.forte, fontSize: 16, color: corTexto }}>{rotulo}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** Campo de texto. Letra de 16: abaixo disso o iOS dá zoom ao focar. */
export function Campo({
  rotulo,
  dica,
  ...props
}: TextInputProps & { rotulo: string; dica?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={estilosTexto.rotulo}>{rotulo}</Text>
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor={cor.textoApagado}
        {...props}
        style={[
          {
            minHeight: ALVO_MINIMO + 4,
            borderRadius: raio.md,
            ...curva,
            borderWidth: 1,
            borderColor: cor.borda,
            backgroundColor: cor.cartao,
            paddingHorizontal: espaco.lg,
            paddingVertical: espaco.md,
            ...fonte.normal,
            fontSize: 16,
            color: cor.texto,
          },
          props.multiline && { minHeight: 96, textAlignVertical: "top" },
          props.style,
        ]}
      />
      {dica ? <Text style={estilosTexto.apagado}>{dica}</Text> : null}
    </View>
  );
}

export function Pilula({
  texto,
  fundo = cor.destaque,
  corTexto = cor.textoDestaque,
}: {
  texto: string;
  fundo?: string;
  corTexto?: string;
}) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: fundo,
        borderRadius: raio.pilula,
        ...curva,
        paddingHorizontal: 12,
        paddingVertical: 4,
      }}
    >
      <Text style={{ ...fonte.forte, fontSize: 13, color: corTexto }}>{texto}</Text>
    </View>
  );
}

/**
 * "Não consegui ler" NUNCA tem a cara de "não há nada". Uma lista vazia afirma
 * um fato; uma leitura que falhou não afirma nada — e a frase de sossego diz
 * o que continua valendo.
 */
export function NaoConsegueLer({ sossego, aoTentar }: { sossego: string; aoTentar?: () => void }) {
  return (
    <Cartao fundo={cor.atencaoFundo}>
      <T tipo="rotulo" cor={cor.atencao}>
        Não conseguimos carregar agora
      </T>
      <T tipo="apagado">Isso é a nossa conexão, não algo que você fez. {sossego}</T>
      {aoTentar ? <Botao rotulo="Tentar de novo" tipo="secundario" aoTocar={aoTentar} /> : null}
    </Cartao>
  );
}

export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <View style={{ padding: espaco.xl, alignItems: "center", gap: espaco.sm }}>
      <ActivityIndicator color={cor.primaria} />
      <T tipo="apagado">{texto}</T>
    </View>
  );
}

export function Linha({
  children,
  estilo,
}: {
  children: ReactNode;
  estilo?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: espaco.sm }, estilo]}>
      {children}
    </View>
  );
}
