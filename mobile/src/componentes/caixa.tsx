import { Check } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import { selecao } from "~/componentes/base";
import { ErroNoVeu, useTremor } from "~/componentes/entrada";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { ALVO_MINIMO, cor, curva, escala, espaco, fonte, raio, veu } from "~/tema";

/**
 * A caixa de marcar dos aceites (o cadastro e a tela de aceite dos termos):
 * o alvo inteiro é a linha, com 44 pt, e o leitor de tela diz se está marcada.
 *
 * 18/11/2026 (a vistoria): era um quadrado rosa-claro de aro fraco (1,9:1, o
 * enfeite que ninguém via como coisa de tocar) com um "✓" de texto. Agora é o
 * círculo de 28 pt dos Lembretes do iOS: o aro na cor do texto de apoio e,
 * marcada, cheia de framboesa com o visto desenhado, num "pop" de mola.
 */
export function CaixaDeMarcar({
  marcada,
  aoTocar,
  rotulo,
  destaque = false,
  noVeu = false,
  aviso,
  tremer: vezes = 0,
  aoMedir,
}: {
  marcada: boolean;
  aoTocar: () => void;
  rotulo: string;
  /** O consentimento do dado de saúde vai DESTACADO (LGPD, art. 11, I). */
  destaque?: boolean;
  /** Sobre o véu escuro da entrada (17/11/2026): letra clara, aro claro. */
  noVeu?: boolean;
  /** O recado de quando ela tentou seguir sem esta caixa (logo embaixo dela). */
  aviso?: string | null;
  /** Um contador: a cada vez que sobe, a caixa treme com o toque de erro. */
  tremer?: number;
  /** Onde a caixa ficou na rolagem (para a tela rolar até ela). */
  aoMedir?: (y: number) => void;
}) {
  const reduzido = useMovimentoReduzido();
  const pop = useRef(new Animated.Value(1)).current;
  const { tremor, tremer } = useTremor();
  useEffect(() => {
    if (vezes > 0) tremer();
  }, [vezes, tremer]);

  function tocar() {
    selecao();
    if (!marcada && !reduzido) {
      pop.setValue(0.85);
      Animated.spring(pop, {
        toValue: 1,
        speed: 28,
        bounciness: 12,
        useNativeDriver: true,
      }).start();
    }
    aoTocar();
  }

  const aro = noVeu ? "rgba(255,255,255,0.72)" : cor.textoApagado;
  return (
    <View
      style={{ gap: espaco.sm }}
      onLayout={aoMedir ? (e: LayoutChangeEvent) => aoMedir(e.nativeEvent.layout.y) : undefined}
    >
      <Animated.View style={tremor}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: marcada }}
          accessibilityLabel={rotulo}
          onPress={tocar}
          style={({ pressed }) => ({
            flexDirection: "row",
            gap: espaco.md,
            alignItems: "flex-start",
            minHeight: ALVO_MINIMO,
            paddingVertical: destaque ? espaco.md : espaco.xs,
            paddingLeft: destaque ? espaco.md + 3 : 0,
            paddingRight: destaque ? espaco.md : 0,
            borderRadius: destaque ? raio.md : 0,
            ...curva,
            overflow: "hidden",
            backgroundColor: destaque
              ? noVeu
                ? "rgba(255,255,255,0.08)"
                : cor.destaque
              : "transparent",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          {/* O destaque do consentimento de saúde: uma faixa framboesa à esquerda. */}
          {destaque ? (
            <View
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 3,
                backgroundColor: noVeu ? veu.linkNoVeu : cor.primaria,
              }}
            />
          ) : null}
          <Animated.View
            style={{
              width: 28,
              height: 28,
              borderRadius: raio.pilula,
              borderWidth: marcada ? 0 : 2,
              borderColor: aro,
              backgroundColor: marcada ? cor.primaria : "transparent",
              alignItems: "center",
              justifyContent: "center",
              transform: [{ scale: pop }],
            }}
          >
            {marcada ? <Check size={16} color={cor.branco} strokeWidth={3} /> : null}
          </Animated.View>
          <Text
            style={{
              ...fonte.normal,
              ...escala.legenda,
              flex: 1,
              color: noVeu ? veu.textoNoVeu : cor.texto,
              marginTop: 4,
            }}
          >
            {rotulo}
          </Text>
        </Pressable>
      </Animated.View>
      {aviso ? <ErroNoVeu>{aviso}</ErroNoVeu> : null}
    </View>
  );
}
