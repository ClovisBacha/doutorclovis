import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { ArteDaBolha, useMovimentoReduzido, type HumorDaArte } from "~/componentes/movimento";
import { canto, cor, curva, escala, espaco, fonte, sombra } from "~/tema";

/**
 * A BOLHA QUE CONVERSA NA ENTRADA (19/11/2026): os slides, o ritual e a
 * revelação falam pela Bolha, com as mesmas peças da conversa da aba do Bebê
 * (`componentes/bolha/conversa.tsx`): o balão branco dela, a resposta da mãe
 * do lado direito, em framboesa clara, e os três pontinhos antes da fala.
 *
 * Aqui elas moram sobre o céu da entrada (o véu de ameixa-noite), e não num
 * painel: o balão é material branco cheio, e não vidro (o vidro claro sobre a
 * noite fica lilás e apaga a letra).
 */

/** Quanto a Bolha "escreve" antes de falar (o ritmo da conversa da aba). */
const ESCREVENDO_MS = 600;

/**
 * `true` enquanto a Bolha escreve: um instante a cada fala nova, e nunca com
 * "reduzir movimento". Estado só nas fronteiras (um `setTimeout`).
 */
function useEscrevendo(fala: string, ligado: boolean): boolean {
  const reduzido = useMovimentoReduzido();
  const [escrevendo, setEscrevendo] = useState(ligado && !reduzido);
  useEffect(() => {
    if (!ligado || reduzido) {
      setEscrevendo(false);
      return;
    }
    setEscrevendo(true);
    const t = setTimeout(() => setEscrevendo(false), ESCREVENDO_MS);
    return () => clearTimeout(t);
  }, [fala, ligado, reduzido]);
  return escrevendo;
}

/**
 * O balão da Bolha. A ponta mostra de onde vem a fala:
 * - `esquerda`: a Bolha ao lado (o canto de baixo fica fechado, como na
 *   conversa da aba);
 * - `baixo` / `cima`: a Bolha embaixo ou em cima, no centro (a vitrine e a
 *   revelação).
 */
export function Balao({
  children,
  ponta,
  estilo,
}: {
  children: ReactNode;
  ponta: "esquerda" | "baixo" | "cima";
  estilo?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={estilo}>
      <View
        style={{
          borderRadius: canto.dentro,
          ...(ponta === "esquerda" ? { borderBottomLeftRadius: 6 } : null),
          ...curva,
          paddingHorizontal: espaco.lg,
          paddingVertical: espaco.md,
          backgroundColor: cor.cartao,
          ...sombra,
        }}
      >
        {children}
      </View>
      {ponta === "esquerda" ? null : (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: "50%",
            marginLeft: -8,
            ...(ponta === "baixo" ? { bottom: -6 } : { top: -6 }),
            width: 16,
            height: 16,
            borderRadius: 3,
            backgroundColor: cor.cartao,
            transform: [{ rotate: "45deg" }],
          }}
        />
      )}
    </View>
  );
}

/** O que a Bolha diz, na letra da conversa (a de 20 para a pergunta do passo). */
export function TextoDaBolha({
  children,
  nivel = "corpo",
  centro,
  pergunta,
}: {
  children: string;
  nivel?: "corpo" | "titulo3";
  centro?: boolean;
  /** A pergunta do passo é o cabeçalho da tela para o leitor de tela. */
  pergunta?: boolean;
}) {
  return (
    <Text
      accessibilityRole={pergunta ? "header" : "text"}
      style={{
        ...fonte.media,
        ...escala[nivel],
        color: cor.texto,
        textAlign: centro ? "center" : "left",
      }}
    >
      {children}
    </Text>
  );
}

/**
 * O balão que FALA: com `escrever`, os três pontinhos chegam antes de cada
 * fala nova, e no iPhone a fala é lida na hora em que aparece. Com
 * `esperando`, os pontinhos ficam até a fala ser chamada (o slide que ainda
 * não chegou).
 *
 * O balão já nasce do tamanho da fala (o texto fica guardado, invisível, sob
 * os pontinhos): a fala chegando não empurra o que vem embaixo.
 */
export function BalaoQueFala({
  texto,
  ponta,
  nivel = "corpo",
  centro,
  escrever = false,
  esperando = false,
  pergunta,
  estilo,
}: {
  texto: string;
  ponta: "esquerda" | "baixo" | "cima";
  nivel?: "corpo" | "titulo3";
  centro?: boolean;
  escrever?: boolean;
  esperando?: boolean;
  pergunta?: boolean;
  estilo?: StyleProp<ViewStyle>;
}) {
  const reduzido = useMovimentoReduzido();
  const escrevendo = useEscrevendo(texto, escrever) || (esperando && !reduzido);
  const anunciou = useRef<string | null>(null);
  useEffect(() => {
    if (!escrever || escrevendo || anunciou.current === texto) return;
    anunciou.current = texto;
    if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(texto);
  }, [escrever, escrevendo, texto]);
  return (
    <Balao ponta={ponta} estilo={estilo}>
      {/* Um invólucro sem respiro: os pontinhos se apoiam na primeira linha. */}
      <View>
        <View
          style={{ opacity: escrevendo ? 0 : 1 }}
          accessibilityElementsHidden={escrevendo}
          importantForAccessibility={escrevendo ? "no-hide-descendants" : "auto"}
        >
          <TextoDaBolha nivel={nivel} centro={centro} pergunta={pergunta}>
            {texto}
          </TextoDaBolha>
        </View>
        {escrevendo ? (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              alignItems: centro ? "center" : "flex-start",
            }}
          >
            <Pontinhos />
          </View>
        ) : null}
      </View>
    </Balao>
  );
}

/**
 * A FALA DA BOLHA, como na conversa da aba: ela à esquerda, o balão do lado,
 * e (com `escrever`) os três pontinhos antes de cada fala nova.
 */
export function FalaDaBolha({
  texto,
  pose,
  tamanho = 72,
  nivel = "titulo3",
  escrever = false,
  pergunta,
}: {
  texto: string;
  pose: HumorDaArte;
  tamanho?: number;
  /** `titulo3` (20) a pergunta do passo; `corpo` (17) uma resposta dela. */
  nivel?: "corpo" | "titulo3";
  escrever?: boolean;
  pergunta?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: espaco.sm }}>
      <View accessible={false} importantForAccessibility="no-hide-descendants">
        <ArteDaBolha humor={pose} tamanho={tamanho} />
      </View>
      <BalaoQueFala
        texto={texto}
        ponta="esquerda"
        nivel={nivel}
        escrever={escrever}
        pergunta={pergunta}
        estilo={{ flex: 1 }}
      />
    </View>
  );
}

/** A resposta dela, do lado direito (a framboesa clara da conversa da aba). */
export function RespostaDela({ texto }: { texto: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`Você respondeu: ${texto}`}
      style={{
        alignSelf: "flex-end",
        maxWidth: "78%",
        borderRadius: canto.dentro,
        borderBottomRightRadius: 6,
        ...curva,
        paddingHorizontal: 14,
        paddingVertical: 9,
        backgroundColor: cor.destaque,
      }}
    >
      <Text style={{ ...fonte.forte, ...escala.chamada, color: cor.textoDestaque }}>{texto}</Text>
    </View>
  );
}

/** Os três pontinhos de quem está escrevendo: uma vez, e param. */
function Pontinhos() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(v, {
      toValue: 1,
      duration: ESCREVENDO_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [v]);
  const pontos = useMemo(
    () =>
      [0, 1, 2].map((i) =>
        v.interpolate({
          inputRange: [0, 0.2 + i * 0.2, 0.4 + i * 0.2, 1],
          outputRange: [0.3, 1, 0.3, 0.3],
          extrapolate: "clamp",
        }),
      ),
    [v],
  );
  return (
    <View
      accessibilityLabel="A Bolha está escrevendo"
      style={{ flexDirection: "row", gap: 5, paddingVertical: 8 }}
    >
      {pontos.map((o, i) => (
        <Animated.View
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: cor.textoApagado,
            opacity: o,
          }}
        />
      ))}
    </View>
  );
}
