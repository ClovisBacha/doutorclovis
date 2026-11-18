import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { createContext, useContext, useState, type ReactNode } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { toque } from "~/componentes/base";
import { CEUS, CeuVivo, faseDeAgora, type Ceu } from "~/componentes/ceu-vivo";
import { useMolaDeToque } from "~/componentes/movimento";
import { Vidro } from "~/componentes/vidro";
import { gravarJson } from "~/lib/armazem";
import { ALVO_MINIMO, aperto, cor, curva, espaco, fonte, raio, veu } from "~/tema";

/**
 * A CARA DA ENTRADA — boas-vindas, entrar, cadastro e "esqueci a senha".
 *
 * 17/11/2026, o dono: "esse fundo branco aí no cadastro do e-mail [...] não
 * gosto disso. Gostaria que tivesse já um caminho que nem a gente está
 * fazendo do Marca Ponto [...] de slides para você entrar no aplicativo."
 *
 * Não há mais folha branca: a entrada escreve DIRETO sobre o céu vivo da hora
 * (o mesmo das abas), com um VÉU de ameixa-noite que escurece o pé da tela —
 * ou a tela inteira, nos formulários —, e o texto é branco sobre ele. Os
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
  return (
    <View style={{ flex: 1, backgroundColor: ceu.chao }}>
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

/* ── A letra sobre o véu ──────────────────────────────────────────────── */

export function TituloNoVeu({
  children,
  centro,
  tamanho = 34,
}: {
  children: ReactNode;
  centro?: boolean;
  tamanho?: number;
}) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        ...fonte.display,
        fontSize: tamanho,
        lineHeight: Math.round(tamanho * 1.14),
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
  pequeno,
  estilo,
}: {
  children: ReactNode;
  centro?: boolean;
  pequeno?: boolean;
  estilo?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      style={[
        {
          ...fonte.normal,
          fontSize: pequeno ? 14 : 17,
          lineHeight: pequeno ? 20 : 24,
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

/** O erro sobre o véu: lido na hora pelo leitor de tela. */
export function ErroNoVeu({ children }: { children: ReactNode }) {
  return (
    <Text
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ ...fonte.media, fontSize: 15, lineHeight: 21, color: veu.erroNoVeu }}
    >
      {children}
    </Text>
  );
}

/* ── Os controles sobre o véu ─────────────────────────────────────────── */

/** Campo de vidro escuro. Letra de 17: abaixo de 16 o iOS dá zoom ao focar. */
export function CampoNoVeu({
  rotulo,
  dica,
  ...props
}: TextInputProps & { rotulo: string; dica?: string }) {
  const [foco, setFoco] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ ...fonte.forte, fontSize: 14, color: veu.textoNoVeu }}>{rotulo}</Text>
      <TextInput
        accessibilityLabel={rotulo}
        accessibilityHint={dica}
        placeholderTextColor={veu.placeholder}
        keyboardAppearance="dark"
        selectionColor={veu.linkNoVeu}
        cursorColor={veu.linkNoVeu}
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
            minHeight: 54,
            borderRadius: raio.md,
            ...curva,
            borderWidth: 1,
            borderColor: foco ? veu.campoFoco : veu.campoBorda,
            backgroundColor: veu.campo,
            paddingHorizontal: espaco.lg,
            paddingVertical: espaco.md,
            ...fonte.normal,
            fontSize: 17,
            color: cor.branco,
          },
          props.style,
        ]}
      />
      {dica ? <TextoNoVeu pequeno>{dica}</TextoNoVeu> : null}
    </View>
  );
}

/** Um link sobre o véu (rosa claro), com o alvo de 44 pt. */
export function LinkNoVeu({
  rotulo,
  aoTocar,
  centro = true,
  apagado,
}: {
  rotulo: string;
  aoTocar: () => void;
  centro?: boolean;
  /** Branco de apoio, em vez do rosa (o link de menos peso). */
  apagado?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      hitSlop={6}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        minHeight: ALVO_MINIMO,
        justifyContent: "center",
        alignSelf: centro ? "center" : "flex-start",
        paddingHorizontal: espaco.sm,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text
        style={{
          ...fonte.forte,
          fontSize: 16,
          color: apagado ? veu.textoNoVeu : veu.linkNoVeu,
          textAlign: "center",
        }}
      >
        {rotulo}
      </Text>
    </Pressable>
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
  const { escala, aoPressionar, aoSoltar } = useMolaDeToque(0.96);
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
          minHeight: 54,
          borderRadius: raio.pilula,
          ...curva,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.42)",
          backgroundColor: "rgba(255,255,255,0.14)",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: espaco.sm,
          paddingHorizontal: espaco.xl,
          transform: [{ scale: escala }],
        }}
      >
        {icone}
        <Text style={{ ...fonte.forte, fontSize: 17, color: cor.branco }}>{rotulo}</Text>
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
      <TextoNoVeu pequeno>{texto}</TextoNoVeu>
      <View
        style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: veu.campoBorda }}
      />
    </View>
  );
}

/** O voltar dos formulários: um botão de vidro solto no alto (Liquid Glass). */
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
