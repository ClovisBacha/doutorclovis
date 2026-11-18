import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AlertCircle, Check, ChevronLeft, Eye, EyeOff } from "lucide-react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { selecao, toque } from "~/componentes/base";
import { CEUS, CeuVivo, faseDeAgora, type Ceu } from "~/componentes/ceu-vivo";
import { useMolaDeToque, useMovimentoReduzido } from "~/componentes/movimento";
import { Vidro } from "~/componentes/vidro";
import { gravarJson } from "~/lib/armazem";
import { ALVO_MINIMO, cor, curva, escala, espaco, fonte, margem, raio, veu } from "~/tema";

/**
 * A CARA DA ENTRADA: boas-vindas, entrar, cadastro, "esqueci a senha", e
 * depois o aceite e o ritual, até a primeira aba (18/11/2026: um céu só, da
 * primeira tela ao bebê).
 *
 * 17/11/2026, o dono: "esse fundo branco aí no cadastro do e-mail [...] não
 * gosto disso. Gostaria que tivesse já um caminho que nem a gente está
 * fazendo do Marca Ponto [...] de slides para você entrar no aplicativo."
 *
 * Não há mais folha branca: a entrada escreve DIRETO sobre o céu vivo da hora
 * (o mesmo das abas), com um VÉU de ameixa-noite que escurece o pé da tela
 * (ou a tela inteira, nos formulários), e o texto é branco sobre ele. Os
 * campos são de vidro escuro, como no Marca Ponto.
 *
 * ⚠️ A entrada não sabe se quem volta está no Modo Cuidado (luto): o céu e a
 * bolha, sim; o bebê, nunca (`vidro-e-luz.test.ts`).
 */

/* ── O fundo ──────────────────────────────────────────────────────────── */

/** O céu sob a entrada (a fase da hora em que ela abriu). */
const CeuDaEntrada = createContext<Ceu>(CEUS.amanhecer);
export const useCeuDaEntrada = () => useContext(CeuDaEntrada);

/** A chave que diz que este aparelho já entrou numa conta (não é dado dela). */
export const CHAVE_JA_ENTROU = "me-ja-entrou";

/** Quem já entrou neste aparelho volta direto para "entrar", sem os slides. */
export function marcarQueJaEntrou() {
  void gravarJson(CHAVE_JA_ENTROU, true);
}

export function FundoDaEntrada({
  children,
  veu: forca = "baixo",
}: {
  children: ReactNode;
  /** "baixo": o pé da tela escurece (os slides). "inteiro": os formulários. */
  veu?: "baixo" | "inteiro";
}) {
  /* A hora é a de quando a tela abriu: o céu não troca no meio do login. */
  const [fase] = useState(faseDeAgora);
  const ceu = CEUS[fase];
  /* A barra de status acompanha o alto da tela: o relógio preto some sobre o
     céu escuro (era 1,3:1 à noite). Com o véu inteiro o alto é sempre escuro. */
  const barraClara = forca === "inteiro" || !ceu.claro;
  return (
    <View style={{ flex: 1, backgroundColor: ceu.chao }}>
      <StatusBar style={barraClara ? "light" : "dark"} animated />
      <CeuVivo fase={fase} />
      <LinearGradient
        pointerEvents="none"
        colors={
          forca === "inteiro"
            ? [veu.tinta(0.55), veu.tinta(0.66), veu.tinta(0.9)]
            : [veu.tinta(0), veu.tinta(0), veu.tinta(0.78), veu.tinta(0.95)]
        }
        locations={forca === "inteiro" ? [0, 0.45, 1] : [0, 0.3, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      <CeuDaEntrada.Provider value={ceu}>{children}</CeuDaEntrada.Provider>
    </View>
  );
}

/* ── O toque de erro e o tremor ───────────────────────────────────────── */

/** A notificação de erro do iPhone (o campo errado, a caixa que faltou). */
export function toqueDeErro() {
  if (Platform.OS === "web") return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

/**
 * O "não" do iPhone: o campo treme de lado (0 → 8 → −8 → 4 → 0, 280 ms, no
 * fio nativo) junto com o toque de erro. Com "reduzir movimento", só o toque.
 */
export function useTremor() {
  const x = useRef(new Animated.Value(0)).current;
  const reduzido = useMovimentoReduzido();
  const tremer = useCallback(() => {
    toqueDeErro();
    if (reduzido) return;
    x.stopAnimation();
    x.setValue(0);
    Animated.sequence(
      [8, -8, 4, 0].map((para) =>
        Animated.timing(x, { toValue: para, duration: 70, useNativeDriver: true }),
      ),
    ).start();
  }, [reduzido, x]);
  return { tremor: { transform: [{ translateX: x }] }, tremer };
}

/* ── A letra sobre o véu ──────────────────────────────────────────────── */

/**
 * O título: a serifada (New York), na escala. `grande` (34) é o nome do app e
 * a pergunta de cada passo; `titulo1` (28), o título sob uma vitrine.
 */
export function TituloNoVeu({
  children,
  centro,
  nivel = "grande",
}: {
  children: ReactNode;
  centro?: boolean;
  nivel?: "grande" | "titulo1";
}) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        ...fonte.display,
        ...escala[nivel],
        letterSpacing: -0.2,
        color: cor.branco,
        textAlign: centro ? "center" : "left",
      }}
    >
      {children}
    </Text>
  );
}

export function TextoNoVeu({
  children,
  centro,
  nivel = "corpo",
  estilo,
}: {
  children: ReactNode;
  centro?: boolean;
  /** `corpo` (17) o apoio do título; `legenda` (15) uma nota; `nota` (13) o rodapé. */
  nivel?: "corpo" | "legenda" | "nota";
  estilo?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      style={[
        {
          ...fonte.normal,
          ...escala[nivel],
          color: veu.textoNoVeu,
          textAlign: centro ? "center" : "left",
        },
        estilo,
      ]}
    >
      {children}
    </Text>
  );
}

/**
 * O erro sobre o céu: uma cápsula branca com o ícone, logo embaixo do que
 * falhou (o vermelho direto no céu escuro não se lê). Lido na hora pelo leitor
 * de tela.
 */
export function ErroNoVeu({ children }: { children: ReactNode }) {
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        alignSelf: "flex-start",
        maxWidth: "100%",
        flexDirection: "row",
        alignItems: "flex-start",
        gap: espaco.sm,
        paddingVertical: espaco.sm,
        paddingLeft: espaco.md,
        paddingRight: espaco.lg,
        borderRadius: raio.md,
        ...curva,
        backgroundColor: "rgba(255,255,255,0.94)",
      }}
    >
      <AlertCircle size={18} color={cor.urgente} strokeWidth={2.4} style={{ marginTop: 1 }} />
      <Text style={{ ...fonte.media, ...escala.legenda, color: cor.texto, flexShrink: 1 }}>
        {children}
      </Text>
    </View>
  );
}

/* ── Os controles sobre o véu ─────────────────────────────────────────── */

/**
 * O campo de vidro escuro. Letra de 17: abaixo de 16 o iOS dá zoom ao focar.
 * - `senha`: o olho de mostrar e esconder, dentro da cápsula;
 * - `regra`: a regra que ganha o visto verde ao vivo ("8 caracteres ou mais");
 * - `erro`: o aviso embaixo do campo, e o aro na cor do erro;
 * - `tremer`: um contador; a cada vez que sobe, o campo treme com o toque de erro.
 */
export function CampoNoVeu({
  rotulo,
  dica,
  senha,
  regra,
  erro,
  tremer: vezes = 0,
  ref,
  ...props
}: TextInputProps & {
  rotulo: string;
  dica?: string;
  senha?: boolean;
  regra?: { texto: string; cumprida: boolean };
  erro?: string | null;
  tremer?: number;
  ref?: Ref<TextInput>;
}) {
  const [foco, setFoco] = useState(false);
  const [mostrar, setMostrar] = useState(false);
  const { tremor, tremer } = useTremor();
  useEffect(() => {
    if (vezes > 0) tremer();
  }, [vezes, tremer]);
  return (
    <View style={{ gap: espaco.sm }}>
      <Text style={{ ...fonte.forte, ...escala.legenda, color: veu.textoNoVeu }}>{rotulo}</Text>
      <Animated.View style={tremor}>
        <TextInput
          ref={ref}
          accessibilityLabel={rotulo}
          accessibilityHint={dica}
          placeholderTextColor={veu.placeholder}
          keyboardAppearance="dark"
          selectionColor={veu.linkNoVeu}
          cursorColor={veu.linkNoVeu}
          {...props}
          secureTextEntry={senha ? !mostrar : props.secureTextEntry}
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
              minHeight: 56,
              borderRadius: raio.md,
              ...curva,
              borderWidth: 1,
              borderColor: erro ? veu.erroNoVeu : foco ? veu.campoFoco : veu.campoBorda,
              backgroundColor: veu.campo,
              paddingLeft: espaco.lg,
              paddingRight: senha ? ALVO_MINIMO + espaco.sm : espaco.lg,
              paddingVertical: espaco.md,
              ...fonte.normal,
              fontSize: 17,
              color: cor.branco,
            },
            props.style,
          ]}
        />
        {senha ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mostrar ? "Esconder a senha" : "Mostrar a senha"}
            onPress={() => {
              selecao();
              setMostrar((m) => !m);
            }}
            style={{
              position: "absolute",
              right: 4,
              top: 0,
              bottom: 0,
              width: ALVO_MINIMO,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {mostrar ? (
              <EyeOff size={20} color={veu.textoNoVeu} strokeWidth={2} />
            ) : (
              <Eye size={20} color={veu.textoNoVeu} strokeWidth={2} />
            )}
          </Pressable>
        ) : null}
      </Animated.View>
      {regra ? <RegraDoCampo {...regra} /> : null}
      {dica && !regra ? <TextoNoVeu nivel="legenda">{dica}</TextoNoVeu> : null}
      {erro ? <ErroNoVeu>{erro}</ErroNoVeu> : null}
    </View>
  );
}

/** "8 caracteres ou mais", com o visto que acende quando a regra se cumpre. */
function RegraDoCampo({ texto, cumprida }: { texto: string; cumprida: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel={`${texto}${cumprida ? ": ok" : ""}`}
      style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: cumprida ? 0 : 1.5,
          borderColor: veu.campoBorda,
          backgroundColor: cumprida ? cor.ok : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {cumprida ? <Check size={13} color={cor.branco} strokeWidth={3} /> : null}
      </View>
      <TextoNoVeu nivel="legenda">{texto}</TextoNoVeu>
    </View>
  );
}

/** Um link sobre o véu (rosa claro), com o alvo de 44 pt. */
export function LinkNoVeu({
  rotulo,
  aoTocar,
  alinhar = "centro",
  apagado,
  desabilitado,
  pequeno,
}: {
  rotulo: string;
  aoTocar: () => void;
  alinhar?: "centro" | "esquerda" | "direita";
  /** Branco de apoio, em vez do rosa (o link de menos peso). */
  apagado?: boolean;
  desabilitado?: boolean;
  /** 15 pt (o "Esqueceu a senha?" sob o campo), em vez de 16. */
  pequeno?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: !!desabilitado }}
      disabled={desabilitado}
      hitSlop={6}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        minHeight: ALVO_MINIMO,
        justifyContent: "center",
        alignSelf:
          alinhar === "centro" ? "center" : alinhar === "direita" ? "flex-end" : "flex-start",
        paddingHorizontal: alinhar === "centro" ? espaco.sm : 0,
        opacity: desabilitado ? 0.55 : pressed ? 0.6 : 1,
      })}
    >
      <Text
        style={{
          ...fonte.forte,
          ...(pequeno ? escala.legenda : escala.chamada),
          color: apagado ? veu.textoNoVeu : veu.linkNoVeu,
          textAlign: "center",
        }}
      >
        {rotulo}
      </Text>
    </Pressable>
  );
}

/** "Termos de uso · Política de privacidade", numa linha só, no centro. */
export function LinksDosDocumentos() {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        columnGap: espaco.xs,
      }}
    >
      <LinkNoVeu pequeno rotulo="Termos de uso" aoTocar={() => router.push("/termos")} />
      <Text style={{ ...fonte.forte, ...escala.legenda, color: veu.textoNoVeu }}>·</Text>
      <LinkNoVeu
        pequeno
        rotulo="Política de privacidade"
        aoTocar={() => router.push("/privacidade")}
      />
    </View>
  );
}

/** O botão de vidro claro sobre o véu (a outra escolha, ao lado do cheio). */
export function BotaoDeVidroNoVeu({
  rotulo,
  aoTocar,
  icone,
}: {
  rotulo: string;
  aoTocar: () => void;
  icone?: ReactNode;
}) {
  const { escala: mola, aoPressionar, aoSoltar } = useMolaDeToque(0.96);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPressIn={aoPressionar}
      onPressOut={aoSoltar}
      onPress={() => {
        toque();
        aoTocar();
      }}
    >
      <Animated.View
        style={{
          minHeight: 56,
          borderRadius: raio.pilula,
          ...curva,
          borderWidth: 1,
          borderColor: veu.campoBorda,
          backgroundColor: veu.campo,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: espaco.sm,
          paddingHorizontal: espaco.xl,
          transform: [{ scale: mola }],
        }}
      >
        {icone}
        <Text style={{ ...fonte.forte, ...escala.manchete, color: cor.branco }}>{rotulo}</Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Uma escolha em cápsula (o "Em que fase você está?" do ritual): vidro escuro
 * apagada; escolhida, ela acende em branco com o visto framboesa.
 */
export function EscolhaNoVeu({
  rotulo,
  marcada,
  aoTocar,
}: {
  rotulo: string;
  marcada: boolean;
  aoTocar: () => void;
}) {
  const { escala: mola, aoPressionar, aoSoltar } = useMolaDeToque(0.97);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={rotulo}
      accessibilityState={{ checked: marcada }}
      onPressIn={aoPressionar}
      onPressOut={aoSoltar}
      onPress={() => {
        selecao();
        aoTocar();
      }}
    >
      <Animated.View
        style={{
          minHeight: 56,
          borderRadius: raio.pilula,
          ...curva,
          borderWidth: 1,
          borderColor: marcada ? cor.branco : veu.campoBorda,
          backgroundColor: marcada ? "rgba(255,255,255,0.94)" : veu.campo,
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.md,
          paddingLeft: espaco.xl,
          paddingRight: espaco.md,
          transform: [{ scale: mola }],
        }}
      >
        <Text
          style={{
            ...fonte.forte,
            ...escala.manchete,
            flex: 1,
            color: marcada ? cor.texto : cor.branco,
          }}
        >
          {rotulo}
        </Text>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: raio.pilula,
            borderWidth: marcada ? 0 : 2,
            borderColor: "rgba(255,255,255,0.6)",
            backgroundColor: marcada ? cor.primaria : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {marcada ? <Check size={16} color={cor.branco} strokeWidth={3} /> : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

/** "──── ou ────", sobre o véu. */
export function DivisorDaEntrada({ texto }: { texto: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
      <View
        style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: veu.campoBorda }}
      />
      <TextoNoVeu nivel="legenda">{texto}</TextoNoVeu>
      <View
        style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: veu.campoBorda }}
      />
    </View>
  );
}

/** O voltar: um botão de vidro solto no alto (Liquid Glass). */
export function VoltarNoVeu({ aoTocar }: { aoTocar?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      hitSlop={8}
      onPress={() => {
        toque();
        if (aoTocar) aoTocar();
        else if (router.canGoBack()) router.back();
        else router.replace("/entrar");
      }}
      style={{ alignSelf: "flex-start" }}
    >
      <Vidro
        interativo
        estilo={{
          width: ALVO_MINIMO,
          height: ALVO_MINIMO,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ChevronLeft size={24} color={cor.texto} strokeWidth={2.4} />
      </Vidro>
    </Pressable>
  );
}

/** Os tracinhos do progresso de um fluxo em passos (4 pt, como os da Saúde). */
export function SegmentosDoPasso({ total, atual }: { total: number; atual: number }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Passo ${atual + 1} de ${total}`}
      style={{ flex: 1, flexDirection: "row", gap: 6 }}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            backgroundColor: i <= atual ? cor.branco : "rgba(255,255,255,0.24)",
          }}
        />
      ))}
    </View>
  );
}

/** O conteúdo de um formulário sobre o véu: uma coluna legível no meio. */
export function ColunaDaEntrada({
  children,
  estilo,
}: {
  children: ReactNode;
  estilo?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ width: "100%", maxWidth: 480, alignSelf: "center", gap: espaco.md }, estilo]}>
      {children}
    </View>
  );
}

/* ── A moldura de um passo ────────────────────────────────────────────── */

/**
 * A MOLDURA DE UM PASSO da entrada, do "Entrar com e-mail" ao ritual: o alto
 * parado (o voltar de vidro, os tracinhos, a bolha), o meio que rola, e o pé
 * preso acima do teclado com o botão do passo. Assim o botão nunca cai abaixo
 * da dobra, nem com a letra grande do iOS.
 *
 * Com `chave`, o meio troca de passo DESLIZANDO (ver `TrocaDePasso`), e cada
 * passo começa rolado no alto.
 */
export function MolduraDoPasso({
  topo,
  children,
  pe,
  chave,
  direcao = 1,
  refDaRolagem,
  centro,
}: {
  topo?: ReactNode;
  children: ReactNode;
  pe?: ReactNode;
  chave?: string | number;
  direcao?: 1 | -1;
  refDaRolagem?: Ref<ScrollView>;
  /** O meio centrado na altura (uma tela de aviso, sem formulário). */
  centro?: boolean;
}) {
  const fora = useSafeAreaInsets();
  const meio = (
    <ScrollView
      ref={refDaRolagem}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        flexGrow: 1,
        width: "100%",
        maxWidth: 480 + margem.foco * 2,
        alignSelf: "center",
        justifyContent: centro ? "center" : "flex-start",
        paddingHorizontal: margem.foco,
        paddingTop: espaco.lg,
        paddingBottom: espaco.xl,
        gap: espaco.lg,
      }}
    >
      {children}
    </ScrollView>
  );
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {topo ? (
        <View style={{ paddingTop: fora.top + espaco.sm, paddingHorizontal: margem.foco }}>
          <ColunaDaEntrada>{topo}</ColunaDaEntrada>
        </View>
      ) : (
        <View style={{ height: fora.top }} />
      )}
      <View style={{ flex: 1 }}>
        {chave === undefined ? (
          meio
        ) : (
          <TrocaDePasso chave={chave} direcao={direcao}>
            {meio}
          </TrocaDePasso>
        )}
        {/* O que rola some de leve ao chegar no pé, em vez de um corte seco. */}
        {pe ? (
          <LinearGradient
            pointerEvents="none"
            colors={[veu.tinta(0), veu.tinta(0.6)]}
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: espaco.xl }}
          />
        ) : null}
      </View>
      {pe ? (
        <View
          style={{
            paddingTop: espaco.sm,
            paddingHorizontal: margem.foco,
            paddingBottom: Math.max(fora.bottom, espaco.lg),
            /* O mesmo tom em que o degradê de cima termina: sem emenda. */
            backgroundColor: veu.tinta(0.6),
          }}
        >
          <ColunaDaEntrada estilo={{ gap: espaco.xs }}>{pe}</ColunaDaEntrada>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** O alto de um passo: o voltar (ou o vão dele), e à direita o que vier. */
export function TopoDoPasso({
  aoVoltar,
  semVoltar,
  children,
}: {
  aoVoltar?: () => void;
  semVoltar?: boolean;
  children?: ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md, minHeight: 44 }}>
      {semVoltar ? <View style={{ width: ALVO_MINIMO }} /> : <VoltarNoVeu aoTocar={aoVoltar} />}
      {children}
    </View>
  );
}

/**
 * A TROCA DE PASSO: o passo novo entra pela direita (+0,35 da largura, a
 * opacidade de 0 a 1) e o anterior sai para a esquerda (−0,25), em 340 ms, no
 * fio nativo; voltando, ao contrário. Com "reduzir movimento", só o esmaecer.
 *
 * O passo que sai continua MONTADO (a mesma chave, no mesmo lugar) até o fim
 * da troca: remontá-lo traria de volta o foco do campo dele.
 */
export function TrocaDePasso({
  chave,
  direcao = 1,
  children,
}: {
  chave: string | number;
  direcao?: 1 | -1;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(1)).current;
  /* O que o passo de agora desenhou por último (atualizado depois de cada desenho). */
  const ultimo = useRef<ReactNode>(children);
  const [vista, setVista] = useState(chave);
  const [saindo, setSaindo] = useState<{
    chave: string | number;
    no: ReactNode;
    direcao: 1 | -1;
  } | null>(null);
  let sai = saindo;
  if (chave !== vista) {
    /* Estado derivado durante o desenho: o React refaz este componente antes de
       mostrar, e o passo anterior nunca chega a sair da árvore. */
    sai = { chave: vista, no: ultimo.current, direcao };
    setVista(chave);
    setSaindo(sai);
  }
  useLayoutEffect(() => {
    ultimo.current = children;
  });
  const primeira = useRef(true);
  useLayoutEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    v.stopAnimation();
    v.setValue(0);
    const anim = Animated.timing(v, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished) setSaindo(null);
    });
    return () => anim.stop();
  }, [vista, v]);
  const lado = reduzido ? 0 : width * (sai?.direcao ?? direcao);
  const camadas = sai
    ? [
        { chave: sai.chave, no: sai.no, saindo: true },
        { chave: vista, no: children, saindo: false },
      ]
    : [{ chave: vista, no: children, saindo: false }];
  return (
    <View style={{ flex: 1 }}>
      {camadas.map((c) => (
        <Animated.View
          key={String(c.chave)}
          pointerEvents={c.saindo ? "none" : "auto"}
          accessibilityElementsHidden={c.saindo}
          importantForAccessibility={c.saindo ? "no-hide-descendants" : "auto"}
          style={
            c.saindo
              ? [
                  StyleSheet.absoluteFill,
                  {
                    /* O que sai some na primeira metade: os dois passos não se
                       misturam no meio da troca. */
                    opacity: v.interpolate({
                      inputRange: [0, 0.5],
                      outputRange: [1, 0],
                      extrapolate: "clamp",
                    }),
                    transform: [
                      {
                        translateX: v.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -0.25 * lado],
                        }),
                      },
                    ],
                  },
                ]
              : {
                  flex: 1,
                  opacity: v,
                  transform: [
                    {
                      translateX: v.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.35 * lado, 0],
                      }),
                    },
                  ],
                }
          }
        >
          {c.no}
        </Animated.View>
      ))}
    </View>
  );
}
