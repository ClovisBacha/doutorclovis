import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { Animated, Easing, Platform, Pressable } from "react-native";
import { Bolha } from "~/componentes/jornada/pecas";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { ABERTURA_DA_AULA } from "~/lib/bolha/falas-do-jogo";
import { corJornada } from "~/componentes/jornada/cores";
import { comAlfa } from "~/lib/cor";
import { cor, escala, fonte } from "~/tema";

/**
 * A ABERTURA DA AULA — 1,5 s no roxo da aula antes da lição, o `QuizIntro`
 * do site: a Bolha estudiosa salta, "Semana 24 · Aula de hoje" e o convite
 * dela ("Dois minutinhos comigo?") sobem, e a tela se desfaz. Um toque pula.
 *
 * É o "agora é a aula" que a trilha do site dava (o Duolingo faz o mesmo): o
 * banco de aulas desce por baixo dela, e a lição aparece pronta.
 *
 * Com "Reduzir movimento", nada salta nem pulsa — a tela aparece e se vai.
 *
 * 18/11/2026 (a vistoria): o degradê ia do pálido à cor, e o branco no meio
 * dava 2,2:1. Agora vai da cor da semana ao lábio dela (o branco no lábio dá
 * 5,8:1 ou mais, semanas 4 a 42). Saiu o "toque para começar" — a tela some
 * sozinha, e o toque só pula — e o emoji do título.
 *
 * 19/11/2026 (a Bolha guia): no lugar da moeda com a fruta da semana, a Bolha
 * estudiosa, que é quem dá a aula; os dois anéis que se abriam em volta da
 * moeda saíram com ela (nada atrás da Bolha). O título é a fala dela.
 */

/**
 * O ROXO DA AULA (25/11/2026, o dono: "abre uma tela verde muito feia, que
 * não tem nada a ver. A do aprendizado, ela é roxa"). A cor da semana mudava
 * a cada semana (a 24 é verde-água, a 29 é verde): a abertura passa a ter a
 * cor da própria aula, o violeta do jogo (o do botão e da barra da lição),
 * do médio ao escuro. O branco no meio dele passa de 7:1.
 */
const ROXO_DA_AULA = [corJornada.roxoMedio, corJornada.roxo, corJornada.roxoEscuro] as const;

const SAI_EM = 1250;
const TERMINA_EM = 1500;

export function AberturaDaAula({
  semana,
  parada = false,
  aoComecarASair,
  aoTerminar,
}: {
  semana: number;
  /** Na bancada: a abertura não sai sozinha (para a foto). */
  parada?: boolean;
  /** A cortina começou a se desfazer: a lição embaixo já pode entrar. */
  aoComecarASair?: () => void;
  aoTerminar: () => void;
}) {
  const reduzido = useMovimentoReduzido();
  const pulo = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
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
    aoComecarASair?.();
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
        Animated.timing(pulo, {
          toValue: 0.6,
          duration: 370,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(pulo, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      ]).start();
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
    const t1 = parada ? undefined : setTimeout(() => sair(TERMINA_EM - SAI_EM), SAI_EM);
    const t2 = parada ? undefined : setTimeout(terminar, TERMINA_EM + 200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (vibra) clearTimeout(vibra);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* A Bolha: de 20 % a 118 % (com o giro de −14° a 4°) e assenta em 100 %. */
  const escalaDaBolha = pulo.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.2, 1.18, 1] });
  const giro = pulo.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: ["-14deg", "4deg", "0deg"],
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
        accessibilityLabel={`Semana ${semana}. A Bolha abre a aula de hoje`}
        accessibilityHint="Toque para pular"
        onPress={() => sair(180)}
        style={{ flex: 1 }}
      >
        <LinearGradient
          colors={ROXO_DA_AULA}
          locations={[0, 0.55, 1]}
          style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}
        >
          <Animated.View style={{ transform: [{ scale: escalaDaBolha }, { rotate: giro }] }}>
            <Bolha humor="estudiosa" tamanho={168} />
          </Animated.View>
          <Animated.Text
            style={[
              {
                marginTop: 20,
                ...fonte.forte,
                ...escala.nota,
                letterSpacing: 1.6,
                textTransform: "uppercase",
                color: comAlfa(cor.branco, 0.92),
              },
              subindo(texto),
            ]}
          >
            Semana {semana} · Aula de hoje
          </Animated.Text>
          <Animated.Text
            style={[
              {
                marginTop: 10,
                maxWidth: 280,
                textAlign: "center",
                ...fonte.display,
                ...escala.titulo1,
                letterSpacing: -0.2,
                color: cor.branco,
              },
              subindo(sub),
            ]}
          >
            {ABERTURA_DA_AULA}
          </Animated.Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}
