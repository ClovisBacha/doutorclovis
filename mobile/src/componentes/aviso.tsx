import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Text } from "react-native";
import { cor, espaco, fonte } from "~/tema";

/**
 * O AVISO QUE SOME SOZINHO — o `toast` do site, para o app (que não tem
 * biblioteca de toast). Um por vez: um aviso novo substitui o anterior.
 *
 *   const { avisar, aviso } = useAviso();
 *   …
 *   avisar("🔒 Esse dia abre amanhã");
 *   return <View>{…}{aviso}</View>;
 */
export function useAviso(o: { baixo?: number; direita?: number } = {}) {
  const [atual, setAtual] = useState<{ texto: string; n: number } | null>(null);
  const avisar = useCallback(
    (texto: string) => setAtual((a) => ({ texto, n: (a?.n ?? 0) + 1 })),
    [],
  );
  const aoSumir = useCallback(() => setAtual(null), []);
  const aviso = atual ? (
    <Aviso
      key={atual.n}
      texto={atual.texto}
      aoSumir={aoSumir}
      baixo={o.baixo ?? espaco.lg}
      direita={o.direita ?? espaco.lg}
    />
  ) : null;
  return { avisar, aviso };
}

function Aviso({
  texto,
  aoSumir,
  baixo,
  direita,
}: {
  texto: string;
  aoSumir: () => void;
  baixo: number;
  direita: number;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const seq = Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2600),
      Animated.timing(v, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]);
    seq.start(({ finished }) => finished && aoSumir());
    return () => seq.stop();
  }, [v, aoSumir]);
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={{
        position: "absolute",
        left: espaco.lg,
        right: direita,
        bottom: baixo,
        borderRadius: 16,
        backgroundColor: cor.cartao,
        borderWidth: 1,
        borderColor: cor.borda,
        paddingHorizontal: espaco.md,
        paddingVertical: espaco.md,
        shadowColor: cor.texto,
        shadowOpacity: 0.14,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      <Text style={{ fontFamily: fonte.media, fontSize: 14, lineHeight: 20, color: cor.texto }}>
        {texto}
      </Text>
    </Animated.View>
  );
}
