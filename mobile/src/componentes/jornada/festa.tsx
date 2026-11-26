import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, Text, View, type TextStyle } from "react-native";
import Svg, { Defs, Path, RadialGradient, Stop } from "react-native-svg";
import { useMovimentoReduzido, lacoQueDescansa } from "~/componentes/movimento";
import { cor, curva, escala, fonte, fonteDoNumero, luz, ouro, sombra } from "~/tema";

/**
 * AS PEÇAS DA FESTA do fim de cada atividade (16/11/2026, a revisão do ciclo
 * do jogo: "a festa mais importante do jogo estava quase vazia").
 */

/**
 * OS RAIOS: um sol de raios suaves girando devagar atrás da bolha — o "você
 * conseguiu" dos jogos. Os raios saem dourados do centro e somem antes da
 * borda (o degradê é um só, no espaço do desenho, e não um por raio). Com
 * "reduzir movimento", parados.
 */
export const Raios = memo(function Raios({
  tamanho,
  tom = ouro.claro,
  forca = 0.55,
  atraso = 0,
}: {
  tamanho: number;
  tom?: string;
  forca?: number;
  /** Em ms: na festa do fim, os raios abrem logo depois de a bolha chegar. */
  atraso?: number;
}) {
  const reduzido = useMovimentoReduzido();
  const gira = useRef(new Animated.Value(0)).current;
  const chega = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  useEffect(() => {
    if (reduzido) return;
    Animated.timing(chega, {
      toValue: 1,
      duration: 700,
      delay: atraso,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const laco = lacoQueDescansa(
      Animated.timing(gira, {
        toValue: 1,
        duration: 24000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      1,
    );
    laco.start();
    return () => laco.stop();
  }, [reduzido, gira, chega, atraso]);
  const c = tamanho / 2;
  const raios = 14;
  const abre = Math.PI / raios / 1.6;
  const d = Array.from({ length: raios }, (_, i) => {
    const a = (i / raios) * Math.PI * 2;
    const x1 = c + Math.cos(a - abre) * c;
    const y1 = c + Math.sin(a - abre) * c;
    const x2 = c + Math.cos(a + abre) * c;
    const y2 = c + Math.sin(a + abre) * c;
    return `M${c},${c} L${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} Z`;
  }).join(" ");
  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      style={{
        position: "absolute",
        width: tamanho,
        height: tamanho,
        opacity: chega.interpolate({ inputRange: [0, 1], outputRange: [0, forca] }),
        transform: [
          { scale: chega.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
          { rotate: gira.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) },
        ],
      }}
    >
      <Svg width={tamanho} height={tamanho}>
        <Defs>
          <RadialGradient
            id="raios-da-festa"
            cx={c}
            cy={c}
            r={c}
            fx={c}
            fy={c}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={tom} stopOpacity={1} />
            <Stop offset="0.45" stopColor={tom} stopOpacity={0.55} />
            <Stop offset="1" stopColor={tom} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Path d={d} fill="url(#raios-da-festa)" />
      </Svg>
    </Animated.View>
  );
});

/**
 * O número do ganho. Até 25, ele chega PRONTO, num pulo de mola no fio nativo
 * (contar de 0 a 17 é ruído, e o pulo é o "ganhei"). Acima disso, conta em no
 * máximo 12 passos — antes era um `setState` por quadro durante um segundo,
 * no ápice da festa, junto com o confete e as sementes. Com "reduzir
 * movimento", o valor final, parado.
 */
export function NumeroQueConta({
  valor,
  prefixo = "",
  atraso = 350,
  estilo,
}: {
  valor: number;
  prefixo?: string;
  atraso?: number;
  estilo?: object;
}) {
  const reduzido = useMovimentoReduzido();
  const pula = valor <= PULO_ATE;
  const [agora, setAgora] = useState(reduzido || pula ? valor : 0);
  const v = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  useEffect(() => {
    if (reduzido) {
      setAgora(valor);
      v.setValue(1);
      return;
    }
    if (pula) {
      setAgora(valor);
      v.setValue(0);
      const anim = Animated.spring(v, {
        toValue: 1,
        delay: atraso,
        speed: 14,
        bounciness: 14,
        useNativeDriver: true,
      });
      anim.start();
      return () => anim.stop();
    }
    v.setValue(1);
    setAgora(0);
    const duracao = Math.min(1100, 260 + valor * 30);
    const relogios = Array.from({ length: PASSOS }, (_, i) => {
      const t = (i + 1) / PASSOS;
      const n = i + 1 === PASSOS ? valor : Math.round(valor * (1 - (1 - t) ** 3));
      return setTimeout(() => setAgora(n), atraso + duracao * t);
    });
    return () => relogios.forEach(clearTimeout);
  }, [valor, atraso, reduzido, pula, v]);
  return (
    <Animated.Text
      allowFontScaling={false}
      style={[
        estilo,
        pula && !reduzido
          ? {
              opacity: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
              transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
            }
          : null,
      ]}
    >
      {prefixo}
      {agora}
    </Animated.Text>
  );
}

const PULO_ATE = 25;
const PASSOS = 12;

/**
 * Uma pedra do placar da festa ("+17 sementinhas", "4 de 5 acertos"): material
 * branco, o número grande na cor do assunto, o rótulo embaixo. Entra subindo,
 * uma depois da outra (`ordem`).
 */
export function PedraDoPlacar({
  rotulo,
  acessivel,
  icone,
  ordem = 0,
  children,
}: {
  /** O que vai embaixo do número ("sementinhas", "acertos"). */
  rotulo: string;
  /** A frase inteira para o leitor de tela ("17 sementinhas ganhas"). */
  acessivel: string;
  icone?: ReactNode;
  ordem?: number;
  children: ReactNode;
}) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  useEffect(() => {
    if (reduzido) return;
    Animated.spring(v, {
      toValue: 1,
      delay: 350 + ordem * 140,
      useNativeDriver: true,
      speed: 12,
      bounciness: 9,
    }).start();
  }, [reduzido, v, ordem]);
  return (
    <Animated.View
      accessible
      accessibilityLabel={acessivel}
      style={{
        flex: 1,
        maxWidth: 170,
        opacity: v,
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
        ],
      }}
    >
      <View
        style={{
          alignItems: "center",
          gap: 2,
          paddingVertical: 14,
          paddingHorizontal: 8,
          borderRadius: 22,
          ...curva,
          backgroundColor: luz.cartao,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: cor.branco,
          ...sombra,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {icone}
          <View>{children}</View>
        </View>
        <Text
          numberOfLines={1}
          style={{ ...fonte.media, ...escala.nota, color: cor.textoApagado, textAlign: "center" }}
        >
          {rotulo}
        </Text>
      </View>
    </Animated.View>
  );
}

/** O estilo do número de uma pedra do placar. */
export const numeroDaPedra = (tinta: string): TextStyle => ({
  ...fonteDoNumero,
  fontSize: 30,
  lineHeight: 34,
  letterSpacing: -0.6,
  fontVariant: ["tabular-nums"],
  color: tinta,
});
