import { Image } from "expo-image";
import { memo, useMemo } from "react";
import { Animated, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { BOLHA } from "~/componentes/artes";
import { useMovimentoReduzido, useParalaxe } from "~/componentes/movimento";
import { ESCALA_RESPIRO } from "~/lib/jornada/meditacao";
import { florDoRespiro } from "~/tema";

/**
 * A FLOR DE BOLHAS (23/11/2026, o dono: "nessa aba de respirar vamos
 * modernizar [...] uma outra arte mais 3D, com movimentos, assim como a Apple
 * faz"). No lugar do círculo claro com a Bolha dentro: seis bolhas de sabão
 * furta-cor, as pétalas, que se ABREM em flor quando ela inspira (saem do
 * centro, crescem e giram um pouco), ficam abertas enquanto ela segura e se
 * RECOLHEM na Bolha quando ela solta. Onde duas se cruzam, a luz soma
 * (`mixBlendMode: "screen"`), como na flor do Respirar da Apple — mas aqui
 * cada pétala é uma bolha, com o brilho e a borda acesa de uma bolha de
 * verdade. No meio, a Bolha dormindo respira junto.
 *
 * Tudo anda pelo MESMO valor da respiração (`respiro`, de 0,9 a 1,16, no fio
 * nativo): a flor nunca sai do compasso da voz. A inclinação do celular dá a
 * profundidade (a flor vira de leve, como a Bolha no céu), e com "reduzir
 * movimento" a flor ainda respira — é ela que guia —, só sem inclinar.
 */

const ABERTA = ESCALA_RESPIRO.inspire;
const FECHADA = ESCALA_RESPIRO.solte;

/** Uma pétala: a bolha de sabão, desenhada uma vez (o movimento é da vista). */
const Petala = memo(function Petala({
  id,
  lado,
  tom,
  brilho,
}: {
  id: number;
  lado: number;
  tom: string;
  brilho: string;
}) {
  const r = lado / 2;
  return (
    <Svg width={lado} height={lado}>
      <Defs>
        <RadialGradient id={`petala-corpo-${id}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={brilho} stopOpacity={0.2} />
          <Stop offset="0.55" stopColor={tom} stopOpacity={0.3} />
          <Stop offset="0.86" stopColor={tom} stopOpacity={0.62} />
          <Stop offset="0.96" stopColor={brilho} stopOpacity={0.9} />
          <Stop offset="1" stopColor={brilho} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`petala-luz-${id}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#ffffff" stopOpacity={0.95} />
          <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={r} cy={r} r={r} fill={`url(#petala-corpo-${id})`} />
      {/* O brilho de cima (a janela que a bolha reflete) e o de baixo, menor. */}
      <Ellipse
        cx={r * 0.62}
        cy={r * 0.56}
        rx={r * 0.3}
        ry={r * 0.17}
        fill={`url(#petala-luz-${id})`}
        transform={`rotate(-38 ${r * 0.62} ${r * 0.56})`}
      />
      <Ellipse
        cx={r * 1.42}
        cy={r * 1.44}
        rx={r * 0.13}
        ry={r * 0.07}
        fill={`url(#petala-luz-${id})`}
        opacity={0.55}
        transform={`rotate(-38 ${r * 1.42} ${r * 1.44})`}
      />
    </Svg>
  );
});

export const FlorDeBolhas = memo(function FlorDeBolhas({
  respiro,
  lado = 300,
  apagada = false,
}: {
  /** O valor da respiração da sessão (`ESCALA_RESPIRO`: 0,9 solta, 1,16 cheia). */
  respiro: Animated.Value;
  lado?: number;
  /** Pausada: a flor inteira some (a Bolha vai para o véu da pausa, e a flor
   * fechada atrás do véu virava um disco atrás dela). */
  apagada?: boolean;
}) {
  const reduzido = useMovimentoReduzido();
  const { x, y } = useParalaxe();
  const petala = lado / 2;
  const raio = lado / 4;
  const bolha = Math.round(lado * 0.3);

  const vistas = useMemo(() => {
    const abre = respiro.interpolate({
      inputRange: [FECHADA, ABERTA],
      outputRange: [0, 1],
      extrapolate: "clamp",
    });
    const petalas = florDoRespiro.petalas.map((_, i) => {
      const base = i * 60;
      return {
        transform: [
          {
            rotate: abre.interpolate({
              inputRange: [0, 1],
              outputRange: [`${base}deg`, `${base + 30}deg`],
            }),
          },
          { translateY: abre.interpolate({ inputRange: [0, 1], outputRange: [0, -raio] }) },
          {
            rotate: abre.interpolate({
              inputRange: [0, 1],
              outputRange: [`${-base}deg`, `${-(base + 30)}deg`],
            }),
          },
          { scale: abre.interpolate({ inputRange: [0, 1], outputRange: [0.46, 1] }) },
        ],
      };
    });
    const halo = {
      opacity: abre.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.85] }),
      transform: [{ scale: abre.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1.08] }) }],
    };
    const meio = {
      transform: [{ scale: abre.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.06] }) }],
    };
    const inclina = {
      transform: [
        { perspective: 900 },
        { rotateY: x.interpolate({ inputRange: [-1, 1], outputRange: ["-10deg", "10deg"] }) },
        { rotateX: y.interpolate({ inputRange: [-1, 1], outputRange: ["8deg", "-8deg"] }) },
      ],
    };
    return { petalas, halo, meio, inclina };
  }, [respiro, raio, x, y]);

  const halo = lado * 1.5;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{
        width: lado,
        height: lado,
        alignItems: "center",
        justifyContent: "center",
        opacity: apagada ? 0 : 1,
      }}
    >
      {/* O halo: a luz atrás da flor, que acende quando ela enche o peito. */}
      <Animated.View
        pointerEvents="none"
        style={[{ position: "absolute", width: halo, height: halo }, vistas.halo]}
      >
        <Svg width={halo} height={halo}>
          <Defs>
            <RadialGradient id="flor-halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={florDoRespiro.halo} stopOpacity={0.55} />
              <Stop offset="0.45" stopColor={florDoRespiro.halo} stopOpacity={0.22} />
              <Stop offset="1" stopColor={florDoRespiro.halo} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={halo / 2} cy={halo / 2} r={halo / 2} fill="url(#flor-halo)" />
        </Svg>
      </Animated.View>

      {/* As pétalas, num grupo isolado: a luz soma entre elas, e não com o céu. */}
      <Animated.View
        style={[
          { width: lado, height: lado, isolation: "isolate" },
          reduzido ? null : vistas.inclina,
        ]}
      >
        {florDoRespiro.petalas.map((p, i) => (
          <Animated.View
            key={i}
            style={[
              {
                position: "absolute",
                left: (lado - petala) / 2,
                top: (lado - petala) / 2,
                width: petala,
                height: petala,
                mixBlendMode: "screen",
              },
              vistas.petalas[i],
            ]}
          >
            <Petala id={i} lado={petala} tom={p.tom} brilho={p.brilho} />
          </Animated.View>
        ))}
      </Animated.View>

      {/* A Bolha, dormindo no meio, respira junto. */}
      <Animated.View style={[{ position: "absolute" }, vistas.meio]} pointerEvents="none">
        <Image
          source={BOLHA.dormindo}
          allowDownscaling={false}
          style={{ width: bolha, height: bolha }}
          contentFit="contain"
          accessible={false}
        />
      </Animated.View>
    </View>
  );
});
