import { Image } from "expo-image";
import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sucesso } from "~/componentes/base";
import { useCeuDaEntrada } from "~/componentes/entrada";
import { arteDoBebe } from "~/componentes/jornada/arte-do-bebe";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { bebeDaSemana } from "~/lib/bebe-da-semana";
import { canto, cor, curva, escala, espaco, fonte, fonteDoNumero, margem } from "~/tema";

/** Quanto a revelação fica na tela antes da primeira aba. */
const DURACAO = 2000;

/**
 * A REVELAÇÃO (18/11/2026, a vistoria: "falta o momento-WOW de quem acaba de
 * se cadastrar"). No fim do PRIMEIRO ritual, antes da primeira aba, o bebê
 * da semana dela entra no mesmo céu da entrada: o número da semana sobe por
 * trás, o bebê chega com mola e o toque de sucesso, e depois de uns dois
 * segundos o app abre no Bebê. Um toque adianta.
 *
 * ⚠️ Quem decide se ela vê isto é `revelaOBebe` (`lib/ritual.ts`): nunca
 * corrigindo a data, nunca depois do parto, nunca no Modo Cuidado. Este é o
 * único arquivo da entrada que mostra o bebê.
 */
export function RevelacaoDoBebe({
  semana,
  aoTerminar,
}: {
  semana: number;
  aoTerminar: () => void;
}) {
  const { width } = useWindowDimensions();
  const fora = useSafeAreaInsets();
  const ceu = useCeuDaEntrada();
  const reduzido = useMovimentoReduzido();
  const numero = useRef(new Animated.Value(0)).current;
  const bebe = useRef(new Animated.Value(0)).current;
  const fim = useRef(aoTerminar);
  fim.current = aoTerminar;
  const dados = bebeDaSemana(semana);
  const arte = Math.min(230, width * 0.58);
  const tamanhoDoNumero = Math.round(Math.min(250, width * 0.62));

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`Você está na semana ${semana}.`);
    let chegada: ReturnType<typeof setTimeout> | undefined;
    if (reduzido) {
      numero.setValue(1);
      bebe.setValue(1);
      sucesso();
    } else {
      Animated.timing(numero, {
        toValue: 1,
        duration: 640,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      chegada = setTimeout(() => {
        sucesso();
        Animated.spring(bebe, {
          toValue: 1,
          speed: 9,
          bounciness: 11,
          useNativeDriver: true,
        }).start();
      }, 260);
    }
    const saida = setTimeout(() => fim.current(), DURACAO);
    return () => {
      if (chegada) clearTimeout(chegada);
      clearTimeout(saida);
    };
    // A revelação acontece uma vez, ao aparecer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Você está na semana ${semana}. Toque para abrir o app.`}
      onPress={() => fim.current()}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: espaco.xl,
        paddingTop: fora.top,
        paddingBottom: fora.bottom + espaco.xl,
        paddingHorizontal: margem.foco,
      }}
    >
      <View
        style={{
          width: "100%",
          height: arte * 1.12,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* O número da semana atrás do bebê, como no céu da aba do Bebê. */}
        <Animated.Text
          allowFontScaling={false}
          style={{
            position: "absolute",
            ...fonteDoNumero,
            fontSize: tamanhoDoNumero,
            lineHeight: Math.round(tamanhoDoNumero * 1.08),
            letterSpacing: -tamanhoDoNumero * 0.04,
            color: ceu.numero,
            opacity: numero,
            transform: [
              { translateY: numero.interpolate({ inputRange: [0, 1], outputRange: [72, 0] }) },
            ],
          }}
        >
          {semana}
        </Animated.Text>
        <Animated.View
          style={{
            opacity: bebe.interpolate({
              inputRange: [0, 0.35, 1],
              outputRange: [0, 1, 1],
              extrapolate: "clamp",
            }),
            transform: [{ scale: bebe.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          }}
        >
          <Image
            source={arteDoBebe(semana)}
            style={{ width: arte, height: arte }}
            contentFit="contain"
            accessible={false}
          />
        </Animated.View>
      </View>
      <Animated.View
        style={{
          alignItems: "center",
          gap: espaco.md,
          opacity: numero,
          transform: [
            { translateY: numero.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
          ],
        }}
      >
        <Text
          style={{
            ...fonte.display,
            ...escala.grande,
            letterSpacing: -0.2,
            color: cor.branco,
            textAlign: "center",
          }}
        >
          Você está na semana {semana}
        </Text>
        <View
          style={{
            paddingHorizontal: espaco.lg,
            paddingVertical: espaco.sm,
            borderRadius: canto.pilula,
            ...curva,
            backgroundColor: "rgba(255,255,255,0.94)",
          }}
        >
          <Text style={{ ...fonte.forte, ...escala.chamada, color: cor.texto }}>
            Tamanho de {dados.fruit.toLowerCase()}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}
