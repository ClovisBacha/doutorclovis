import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { createContext, useContext, useState, type ReactNode, type Ref } from "react";
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
import {
  ALVO_MINIMO,
  aperto,
  canto,
  cor,
  curva,
  escala,
  espaco,
  fonte,
  luz,
  raio,
  sombra,
} from "~/tema";

/**
 * O TOQUE E O SOM DO APP — uma regra só (18/11/2026, a vistoria: "cada revisor
 * propôs a sua"):
 * - `toque()`: o impacto leve de um botão ou cartão tocado;
 * - `selecao()`: o tique de ESCOLHER (uma opção, uma aba, um slide, a régua);
 * - `sucesso()`: a notificação de sucesso (acertou, ganhou, concluiu).
 * Nada de vibração forte: o app é calmo.
 */
export function toque(leve = true) {
  if (Platform.OS === "web") return;
  void Haptics.impactAsync(
    leve ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
  ).catch(() => {});
}

export function selecao() {
  if (Platform.OS === "web") return;
  void Haptics.selectionAsync().catch(() => {});
}

export function sucesso() {
  if (Platform.OS === "web") return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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
  topo,
  refDaRolagem,
}: {
  children: ReactNode;
  rolar?: boolean;
  bordas?: Edge[];
  estilo?: StyleProp<ViewStyle>;
  fundo?: string;
  /** O que fica PARADO no alto, fora da rolagem (o cabeçalho de uma pilha). */
  topo?: ReactNode;
  /** Para quem precisa rolar até um ponto (o índice dos Termos). */
  refDaRolagem?: Ref<ScrollView>;
}) {
  const fim = useFimDaRolagem();
  return (
    <SafeAreaView edges={bordas} style={{ flex: 1, backgroundColor: fundo ?? luz.base }}>
      {fundo ? null : <FundoDeLuz />}
      {topo}
      {rolar ? (
        <ScrollView
          ref={refDaRolagem}
          contentContainerStyle={[
            { padding: espaco.lg, paddingBottom: fim, gap: espaco.md },
            estilo,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, padding: espaco.lg, gap: espaco.md }, estilo]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type TipoTexto = "titulo" | "subtitulo" | "corpo" | "apagado" | "rotulo" | "numero" | "nota";

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

/* A escala do tema (`escala`): o título grande na serifada, o resto na SF Pro. */
const estilosTexto = StyleSheet.create({
  titulo: { ...fonte.display, ...escala.titulo1, color: cor.texto, letterSpacing: -0.2 },
  subtitulo: {
    ...fonte.forte,
    ...escala.titulo3,
    color: cor.texto,
    letterSpacing: aperto.subtitulo,
  },
  corpo: { ...fonte.normal, ...escala.corpo, color: cor.texto },
  apagado: { ...fonte.normal, ...escala.legenda, color: cor.textoApagado },
  rotulo: { ...fonte.forte, ...escala.legenda, color: cor.texto },
  nota: { ...fonte.normal, ...escala.nota, color: cor.textoApagado },
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
  tamanho = "medio",
  carregando,
  desabilitado,
  estilo,
  corFundo,
  icone,
}: {
  rotulo: string;
  aoTocar: () => void;
  /** `suave`: a ficha rosada, para a segunda ação de uma fila. */
  tipo?: "primario" | "secundario" | "suave" | "perigo" | "texto";
  /** grande 54 · médio 48 · compacto 36 (o alvo de toque continua 44). */
  tamanho?: "grande" | "medio" | "compacto";
  carregando?: boolean;
  desabilitado?: boolean;
  estilo?: StyleProp<ViewStyle>;
  corFundo?: string;
  icone?: ReactNode;
}) {
  const cheio = tipo === "primario" || tipo === "perigo";
  const corCheia = tipo === "perigo" ? cor.urgente : (corFundo ?? cor.primaria);
  /* Desabilitado é a FACE CLARA da própria cor, e não a cor cheia esmaecida
     (que parece um botão quebrado). Carregando continua inteiro, com o
     indicador no lugar do rótulo. */
  const off = !!desabilitado && !carregando;
  const fundo = cheio
    ? off
      ? clarear(corCheia, 0.84)
      : corCheia
    : tipo === "secundario"
      ? cor.cartao
      : tipo === "suave"
        ? cor.destaque
        : "transparent";
  const corTexto = cheio
    ? off
      ? clarear(corCheia, 0.4)
      : cor.branco
    : off
      ? cor.textoApagado
      : tipo === "suave"
        ? cor.textoDestaque
        : cor.primariaEscura;
  const altura = tamanho === "grande" ? 54 : tamanho === "compacto" ? 36 : 48;
  const folga = Math.max(0, (ALVO_MINIMO - altura) / 2);
  const mola = useMolaDeToque(0.96);
  const [fora, dentro] = separarLayout(estilo);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: !!desabilitado, busy: !!carregando }}
      disabled={!!desabilitado || !!carregando}
      hitSlop={folga ? { top: folga, bottom: folga } : undefined}
      onPressIn={mola.aoPressionar}
      onPressOut={mola.aoSoltar}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={fora}
    >
      <Animated.View
        style={[
          {
            minHeight: altura,
            borderRadius: raio.pilula,
            ...curva,
            backgroundColor: fundo,
            paddingHorizontal: tamanho === "compacto" ? espaco.md + 2 : espaco.xl,
            alignItems: "center",
            justifyContent: "center",
          },
          tipo === "secundario" && { borderWidth: 1, borderColor: cor.borda },
          cheio && !off ? { boxShadow: `0px 10px 22px -10px ${comAlfa(corCheia, 0.75)}` } : null,
          dentro,
          { transform: [{ scale: mola.escala }] },
        ]}
      >
        {cheio && !off ? (
          <LinearGradient
            pointerEvents="none"
            colors={[clarear(corCheia, 0.16), corCheia, escurecer(corCheia, 0.1)]}
            locations={[0, 0.5, 1]}
            style={[StyleSheet.absoluteFill, { borderRadius: raio.pilula, ...curva }]}
          />
        ) : null}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: espaco.sm,
            opacity: carregando ? 0 : 1,
          }}
        >
          {icone}
          <Text
            style={{
              ...fonte.forte,
              fontSize: tamanho === "compacto" ? 15 : 17,
              lineHeight: tamanho === "compacto" ? 20 : 22,
              color: corTexto,
              textAlign: "center",
              flexShrink: 1,
            }}
          >
            {rotulo}
          </Text>
        </View>
        {carregando ? (
          <View
            style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}
          >
            <ActivityIndicator color={corTexto} />
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

/**
 * O TOCÁVEL: qualquer coisa que se toca com a mola, o toque e o papel certo
 * para o leitor de tela — no lugar de um Pressable cru em cada tela.
 */
export function Tocavel({
  children,
  aoTocar,
  rotulo,
  papel = "button",
  estilo,
  profundidade = 0.97,
  desabilitado,
  folga,
  aberto,
  marcado,
}: {
  children: ReactNode;
  aoTocar: () => void;
  rotulo?: string;
  papel?: "button" | "link" | "tab" | "radio" | "checkbox";
  estilo?: StyleProp<ViewStyle>;
  profundidade?: number;
  desabilitado?: boolean;
  /** O alvo de toque a mais em volta (para o que é menor que 44 pt). */
  folga?: number;
  /** Uma sanfona: aberta ou fechada, para o leitor de tela. */
  aberto?: boolean;
  /** Uma escolha (rádio, caixa, aba): marcada ou não. */
  marcado?: boolean;
}) {
  const mola = useMolaDeToque(profundidade);
  const [fora, dentro] = separarLayout(estilo);
  return (
    <Pressable
      accessibilityRole={papel}
      accessibilityLabel={rotulo}
      accessibilityState={{
        disabled: !!desabilitado,
        ...(aberto === undefined ? null : { expanded: aberto }),
        ...(marcado === undefined ? null : { selected: marcado, checked: marcado }),
      }}
      disabled={desabilitado}
      hitSlop={folga}
      onPressIn={mola.aoPressionar}
      onPressOut={mola.aoSoltar}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={fora}
    >
      <Animated.View style={[dentro, { transform: [{ scale: mola.escala }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/**
 * Campo de texto (18/11/2026, o dono: "essas caixas de texto [...] esse fundo
 * dessas caixas de texto"). Era uma caixa branca de borda cinza — o campo de
 * formulário de site. Agora é o campo PREENCHIDO do iOS: um tom da névoa, sem
 * borda, canto de 14; ao focar, acende branco com o aro framboesa. O rótulo
 * fica em cima, pequeno. Letra de 17: abaixo de 16 o iOS dá zoom ao focar.
 */
export function Campo({
  rotulo,
  dica,
  ...props
}: TextInputProps & { rotulo: string; dica?: string }) {
  const [foco, setFoco] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ ...fonte.forte, ...escala.nota, color: cor.textoApagado }}>{rotulo}</Text>
      <TextInput
        accessibilityLabel={rotulo}
        accessibilityHint={dica}
        placeholderTextColor={cor.placeholder}
        selectionColor={cor.primaria}
        cursorColor={cor.primaria}
        {...props}
        onFocus={(e) => {
          setFoco(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFoco(false);
          props.onBlur?.(e);
        }}
        style={[
          {
            minHeight: 50,
            borderRadius: canto.campo,
            ...curva,
            borderWidth: 2,
            borderColor: foco ? cor.primaria : "transparent",
            backgroundColor: foco ? cor.branco : cor.apagado,
            paddingHorizontal: 14,
            paddingVertical: 12,
            ...fonte.normal,
            fontSize: 17,
            color: cor.texto,
          },
          props.multiline && { minHeight: 104, textAlignVertical: "top" },
          props.style,
        ]}
      />
      {dica ? (
        <Text style={{ ...fonte.normal, ...escala.nota, color: cor.textoApagado }}>{dica}</Text>
      ) : null}
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
    <View
      style={{
        flex: 1,
        minHeight: 200,
        padding: espaco.xl,
        alignItems: "center",
        justifyContent: "center",
        gap: espaco.sm,
      }}
    >
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

/**
 * O título de uma seção (dentro de um painel, ou entre blocos): a serifada em
 * 22, como o título de um capítulo. `direita` leva um "Ver tudo" ou um selo.
 */
export function TituloDaSecao({
  children,
  direita,
  tinta = cor.texto,
}: {
  children: ReactNode;
  direita?: ReactNode;
  tinta?: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
      <Text
        accessibilityRole="header"
        style={{ ...fonte.display, ...escala.titulo2, letterSpacing: -0.2, color: tinta, flex: 1 }}
      >
        {children}
      </Text>
      {direita}
    </View>
  );
}

/** A sobrelinha (o "eyebrow"): 13 pt, firme, em maiúsculas, com respiro entre as letras. */
export function Sobrelinha({
  children,
  tinta = cor.textoApagado,
}: {
  children: ReactNode;
  tinta?: string;
}) {
  return (
    <Text
      style={{
        ...fonte.forte,
        ...escala.nota,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        color: tinta,
      }}
    >
      {children}
    </Text>
  );
}
