import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { Animated, Easing, Platform, Pressable, Text, View } from "react-native";
import { fruitEmojiForWeek } from "@/lib/gestacao";
import { Emoji, Moeda3D } from "~/componentes/caminho/pecas";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { comBranco, coresDaSemana } from "~/lib/jornada/caminho";
import { cor, fonte } from "~/tema";

/**
 * A ABERTURA DA AULA — 1,5 s na cor da semana antes da lição, o `QuizIntro`
 * do site: a moeda salta, dois anéis se abrem, "Semana 24 · Aula de hoje" e
 * "2 minutinhos por Helena 💛" sobem, e a tela se desfaz. Um toque pula.
 *
 * É o "agora é a aula" que a trilha do site dava (o Duolingo faz o mesmo): o
 * banco de aulas desce por baixo dela, e a lição aparece pronta.
 *
 * Na moeda, a fruta da SEMANA, e não o emoji que gira pelo dia da semana: as
 * aulas não seguem esse ritmo, e um 🥗 numa aula sobre o TOTG diria outra coisa.
 * Com "Reduzir movimento", nada salta nem pulsa — a tela aparece e se vai.
 */

const SAI_EM = 1250;
const TERMINA_EM = 1500;

export function AberturaDaAula({
  semana,
  nomeDoBebe,
  aoTerminar,
}: {
  semana: number;
  nomeDoBebe: string | null;
  aoTerminar: () => void;
}) {
  const reduzido = useMovimentoReduzido();
  const tom = coresDaSemana(semana);
  const moeda = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  const anel1 = useRef(new Animated.Value(0)).current;
  const anel2 = useRef(new Animated.Value(0)).current;
  const texto = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  const sub = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  const tela = useRef(new Animated.Value(1)).current;
  const terminou = useRef(false);
  const saindo = useRef(false);

  const terminar = () => {
    if (terminou.current) return;
    terminou.current = true;
    aoTerminar();
  };

  const sair = (duracao: number) => {
    if (saindo.current) return;
    saindo.current = true;
    Animated.timing(tela, {
      toValue: 0,
      duration: duracao,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => terminar());
  };

  useEffect(() => {
    if (!reduzido) {
      Animated.sequence([
        Animated.timing(moeda, {
          toValue: 0.6,
          duration: 370,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(moeda, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      ]).start();
      const anel = (v: Animated.Value, atraso: number) =>
        Animated.timing(v, {
          toValue: 1,
          duration: 900,
          delay: atraso,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      anel(anel1, 0);
      anel(anel2, 220);
      const subir = (v: Animated.Value, atraso: number) =>
        Animated.timing(v, {
          toValue: 1,
          duration: 480,
          delay: atraso,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }).start();
      subir(texto, 260);
      subir(sub, 420);
    }
    const vibra =
      Platform.OS !== "web" && !reduzido
        ? setTimeout(
            () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
            380,
          )
        : null;
    const t1 = setTimeout(() => sair(TERMINA_EM - SAI_EM), SAI_EM);
    const t2 = setTimeout(terminar, TERMINA_EM + 200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (vibra) clearTimeout(vibra);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* A moeda: de 20 % a 118 % (com o giro de −14° a 4°) e assenta em 100 %. */
  const escala = moeda.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.2, 1.18, 1] });
  const giro = moeda.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: ["-14deg", "4deg", "0deg"],
  });
  const estiloDoAnel = (v: Animated.Value, alfa: number) => ({
    position: "absolute" as const,
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 4,
    borderColor: `rgba(255,255,255,${alfa})`,
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [reduzido ? 0 : 0.75, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.1] }) }],
  });
  const subindo = (v: Animated.Value) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  });

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 50,
        opacity: tela,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrindo a aula de hoje. Toque para começar"
        onPress={() => sair(180)}
        style={{ flex: 1 }}
      >
        <LinearGradient
          colors={[comBranco(tom, 0.3), comBranco(tom, 0.72), tom.main]}
          locations={[0, 0.45, 1]}
          style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}
        >
          <View style={{ alignItems: "center", justifyContent: "center", width: 140, height: 140 }}>
            <Animated.View pointerEvents="none" style={estiloDoAnel(anel1, 0.5)} />
            <Animated.View pointerEvents="none" style={estiloDoAnel(anel2, 0.3)} />
            <Animated.View style={{ transform: [{ scale: escala }, { rotate: giro }] }}>
              <Moeda3D tamanho={112} tom={tom} labio={10} claro={0.45} escuro={0.8} meio={0.6}>
                <Emoji tamanho={50}>{fruitEmojiForWeek(semana)}</Emoji>
              </Moeda3D>
            </Animated.View>
          </View>
          <Animated.Text
            style={[
              {
                marginTop: 32,
                fontFamily: fonte.titulo,
                fontSize: 12,
                letterSpacing: 3.6,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.85)",
              },
              subindo(texto),
            ]}
          >
            Semana {semana} · Aula de hoje
          </Animated.Text>
          <Animated.Text
            style={[
              {
                marginTop: 8,
                maxWidth: 260,
                textAlign: "center",
                fontFamily: fonte.titulo,
                fontSize: 26,
                lineHeight: 32,
                color: cor.branco,
              },
              subindo(sub),
            ]}
          >
            {nomeDoBebe ? `2 minutinhos por ${nomeDoBebe} 💛` : "2 minutinhos pelo bebê 💛"}
          </Animated.Text>
          <Animated.View style={[{ marginTop: 12 }, subindo(sub)]}>
            <Text
              style={{ fontFamily: fonte.forte, fontSize: 13, color: "rgba(255,255,255,0.75)" }}
            >
              toque para começar
            </Text>
          </Animated.View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}
