import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Botao, sucesso } from "~/componentes/base";
import { BalaoQueFala } from "~/componentes/bolha/na-entrada";
import { ColunaDaEntrada, useCeuDaEntrada } from "~/componentes/entrada";
import { BolhaViva, useMovimentoReduzido } from "~/componentes/movimento";
import { comAlfa } from "~/lib/cor";
import { falaDaRevelacao } from "~/lib/ritual";
import { cor, espaco, fonteDoNumero, margem } from "~/tema";

/** Quando a fala da Bolha chega, e quando o botão aparece (depois de ela falar). */
const FALA_EM = 700;
const BOTAO_EM = 1500;

/**
 * A REVELAÇÃO DA SEMANA (18/11/2026, a vistoria: "falta o momento-WOW de quem
 * acaba de se cadastrar").
 *
 * 19/11/2026, o dono: "eu quero tirar as imagens dos bebês [...] o número 24
 * ali estava muito bacana [...] o bebê bolha vai ser aquele personagem que vai
 * conversar com a mãe". No fim do PRIMEIRO ritual, o número da semana dela
 * sobe por trás, a Bolha chega comemorando na frente dele (como no céu da aba
 * do Bebê) e, num balão, dá as boas-vindas ao cuidado de todo dia. O botão
 * aparece depois da fala: ela lê no tempo dela (antes, a tela fechava sozinha
 * em dois segundos, cedo demais para ler e sem aviso para o leitor de tela).
 *
 * ⚠️ Quem decide se ela vê isto é `revelaASemana` (`lib/ritual.ts`): nunca
 * corrigindo a data, nunca depois do parto, nunca no Modo Cuidado. E nenhuma
 * ilustração de bebê: a Bolha é a personagem.
 */
export function RevelacaoDaSemana({
  semana,
  nome,
  aoTerminar,
}: {
  semana: number;
  nome?: string | null;
  aoTerminar: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const fora = useSafeAreaInsets();
  const ceu = useCeuDaEntrada();
  const reduzido = useMovimentoReduzido();
  const numero = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  const bolha = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  const botao = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  const [falou, setFalou] = useState(reduzido);
  const [pronto, setPronto] = useState(reduzido);
  const fala = falaDaRevelacao(semana, nome);
  const lado = Math.round(Math.min(210, width * 0.52, height * 0.26));
  const tamanhoDoNumero = Math.round(Math.min(250, width * 0.62));

  useEffect(() => {
    if (reduzido) {
      sucesso();
      AccessibilityInfo.announceForAccessibility(fala);
      return;
    }
    Animated.timing(numero, {
      toValue: 1,
      duration: 640,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const chegada = setTimeout(() => {
      sucesso();
      Animated.spring(bolha, {
        toValue: 1,
        speed: 9,
        bounciness: 11,
        useNativeDriver: true,
      }).start();
    }, 260);
    /* A fala chega com os três pontinhos (o balão anuncia a fala no iPhone). */
    const conversa = setTimeout(() => setFalou(true), FALA_EM);
    const pe = setTimeout(() => {
      setPronto(true);
      Animated.timing(botao, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, BOTAO_EM);
    return () => {
      clearTimeout(chegada);
      clearTimeout(conversa);
      clearTimeout(pe);
    };
    // A revelação acontece uma vez, ao aparecer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      style={{
        flex: 1,
        paddingTop: fora.top + espaco.xl,
        paddingBottom: Math.max(fora.bottom, espaco.lg),
        paddingHorizontal: margem.foco,
      }}
    >
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: espaco.lg }}>
        <View
          style={{
            width: "100%",
            height: Math.max(lado, tamanhoDoNumero) * 1.04,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* O número da semana atrás da Bolha, como no céu da aba do Bebê. */}
          <Animated.Text
            allowFontScaling={false}
            accessible={false}
            style={{
              position: "absolute",
              ...fonteDoNumero,
              fontSize: tamanhoDoNumero,
              lineHeight: Math.round(tamanhoDoNumero * 1.04),
              letterSpacing: -tamanhoDoNumero * 0.048,
              fontVariant: ["tabular-nums"],
              color: ceu.numero,
              textShadowColor: comAlfa(cor.texto, 0.16),
              textShadowOffset: { width: 0, height: 8 },
              textShadowRadius: 22,
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
              opacity: bolha.interpolate({
                inputRange: [0, 0.35, 1],
                outputRange: [0, 1, 1],
                extrapolate: "clamp",
              }),
              transform: [
                { scale: bolha.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
              ],
            }}
          >
            <BolhaViva humor="comemorando" tamanho={lado} />
          </Animated.View>
        </View>
        {/* O lugar do balão fica reservado: a fala chegando não empurra o número. */}
        <ColunaDaEntrada estilo={{ minHeight: 116, maxWidth: 360 }}>
          {falou ? (
            <BalaoQueFala texto={fala} ponta="cima" nivel="titulo3" centro escrever={!reduzido} />
          ) : null}
        </ColunaDaEntrada>
      </View>
      <Animated.View
        pointerEvents={pronto ? "auto" : "none"}
        accessibilityElementsHidden={!pronto}
        importantForAccessibility={pronto ? "auto" : "no-hide-descendants"}
        style={{
          opacity: botao,
          transform: [
            { translateY: botao.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          ],
        }}
      >
        <ColunaDaEntrada>
          <Botao
            rotulo="Vamos lá"
            tamanho="grande"
            aoTocar={aoTerminar}
            estilo={{ minHeight: 56 }}
          />
        </ColunaDaEntrada>
      </Animated.View>
    </View>
  );
}
