import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import type { ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { curva, raio, sombraFlutuante, vidro } from "~/tema";

/**
 * O VIDRO (16/11/2026, pedido do dono: "efeito Apple [...] vidro e luz").
 *
 * No iPhone com iOS 26 ou mais, é o Liquid Glass do sistema (`GlassView`, que
 * o expo-router já traz compilado): refrata o que passa por baixo, reage ao
 * toque e respeita "Reduzir transparência" sozinho. Antes do iOS 26 e na web
 * (a bancada), uma reserva desenhada: na web o desfoque é de verdade
 * (`backdropFilter`); no iOS antigo não há desfoque, então o vidro fica quase
 * opaco — texto sobre conteúdo em movimento precisa continuar legível.
 *
 * ⚠️ Regra da Apple para o Liquid Glass: ele é a camada que FLUTUA (a barra,
 * o placar, os botões soltos, as etiquetas sobre a arte). Cartão de conteúdo
 * não é vidro — é material com luz e sombra (`Cartao`, em base.tsx).
 *
 * O esquema de cor é sempre o claro: o app não tem modo escuro
 * (`userInterfaceStyle: light`), e o vidro escuro do sistema deixaria o texto
 * vinho ilegível num iPhone em modo escuro.
 */
export const TEM_VIDRO_DO_SISTEMA: boolean = (() => {
  if (Platform.OS !== "ios") return false;
  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
})();

export function Vidro({
  children,
  estilo,
  forma = raio.pilula,
  tinta,
  interativo = false,
  flutua = true,
}: {
  children?: ReactNode;
  estilo?: StyleProp<ViewStyle>;
  /** O raio do canto (o padrão é a pílula). */
  forma?: number;
  /** Um tom por cima do vidro (a cor de um assunto), bem fraco. */
  tinta?: string;
  /** O brilho que segue o dedo (só no vidro do sistema). */
  interativo?: boolean;
  /** Com a sombra de quem flutua (a barra, os botões soltos). */
  flutua?: boolean;
}) {
  const base: ViewStyle = { borderRadius: forma, ...curva };
  if (TEM_VIDRO_DO_SISTEMA) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme="light"
        tintColor={tinta}
        isInteractive={interativo}
        style={[base, flutua ? sombraFlutuante : null, estilo]}
      >
        {children}
      </GlassView>
    );
  }
  return (
    <View
      style={[
        base,
        {
          backgroundColor: Platform.OS === "web" ? vidro.reservaWeb : vidro.reserva,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: vidro.borda,
        },
        Platform.OS === "web"
          ? ({ backdropFilter: "blur(22px) saturate(180%)" } as unknown as ViewStyle)
          : null,
        flutua ? sombraFlutuante : null,
        estilo,
      ]}
    >
      {children}
    </View>
  );
}
