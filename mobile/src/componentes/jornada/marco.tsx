import { Image } from "expo-image";
import Sprout from "lucide-react-native/icons/sprout";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { Botao, Sobrelinha, sucesso } from "~/componentes/base";
import { CEUS, faseDeAgora } from "~/componentes/ceu-vivo";
import { CompartilharNaFesta } from "~/componentes/jornada/cartao-da-semana";
import { CompartilharConquista } from "~/componentes/jornada/cartao-de-conquista";
import { Confete } from "~/componentes/jornada/pecas";
import { BolhaViva, useMovimentoReduzido } from "~/componentes/movimento";
import { festaDaBolha } from "~/lib/bolha/festa";
import { comAlfa } from "~/lib/cor";
import { cartaoDoMarco } from "~/lib/jornada/cartoes";
import type { Festa } from "~/lib/jornada/marcos";
import { canto, cor, curva, escala, espaco, fonte, fonteDoNumero, sombras, veu } from "~/tema";

/** A altura da vitrine: o céu da hora com a Bolha na frente do número. */
const VITRINE = 228;
/** O lado da Bolha na vitrine. */
const BOLHA = 184;
/**
 * Um número de um algarismo (a semana 8, o 1º mês) some inteiro atrás da
 * Bolha: os dois se afastam, como o relógio e a pessoa da tela de bloqueio.
 */
const AFASTA = 48;

/**
 * "SEMANA NOVA" — a festa da semana nova, do fim de um trimestre, do
 * nascimento e de cada mês do bebê (`~/lib/jornada/marcos`). O servidor paga
 * esses marcos sozinho; o app passava o crédito em silêncio, e o site abria
 * esta tela com o bebê da semana. Só abre sobre um crédito que o extrato
 * mostra — a soma dita aqui é a que entrou.
 *
 * É o "uau" de toda semana. 19/11/2026, decisão do dono ("nosso principal
 * personagem agora será o bebê bolha. Eu quero tirar as imagens dos bebês
 * [...] o número 24 ali estava muito bacana"): a mesma cena do céu da aba, em
 * miniatura, com a BOLHA comemorando na frente do número gigante, no lugar
 * do bebê ilustrado (e do recém-nascido enrolado, no nascimento e nos meses).
 * Nada atrás dela, nem o brilho. E é ela que fala, num balão: a semana nova
 * ligada ao que o app tem para ela (a aula nova, um tempo para respirar),
 * sem conduta (`~/lib/bolha/festa`).
 */
export function FestaDoMarco({
  festa,
  nomeDoBebe,
  aoFechar,
}: {
  festa: Festa | null;
  nomeDoBebe: string | null;
  aoFechar: () => void;
}) {
  if (!festa) return null;
  return <ConteudoDaFesta festa={festa} nomeDoBebe={nomeDoBebe} aoFechar={aoFechar} />;
}

function ConteudoDaFesta({
  festa,
  nomeDoBebe,
  aoFechar,
}: {
  festa: Festa;
  nomeDoBebe: string | null;
  aoFechar: () => void;
}) {
  const m = festa.principal;
  const reduzido = useMovimentoReduzido();
  /* O céu de quando a festa abriu (a mesma hora da tela de trás). */
  const [ceu] = useState(() => CEUS[faseDeAgora()]);
  const v = useMemo(() => festaDaBolha(m, nomeDoBebe), [m, nomeDoBebe]);
  const afasta = v.numero != null && v.numero < 10 ? AFASTA : 0;

  /* A chegada: o número sobe de trás, a Bolha chega numa mola, e o toque de
     sucesso na mão. Uma vez, e nada disso com "reduzir movimento". */
  const chega = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  const numeroChega = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  useEffect(() => {
    sucesso();
    if (reduzido) {
      chega.setValue(1);
      numeroChega.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.timing(numeroChega, {
        toValue: 1,
        duration: 520,
        useNativeDriver: true,
      }),
      Animated.spring(chega, {
        toValue: 1,
        useNativeDriver: true,
        speed: 9,
        bounciness: 11,
        delay: 160,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [festa.chaves.join("|")]);

  return (
    <Modal transparent animationType="fade" visible onRequestClose={aoFechar}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: espaco.xl,
          paddingVertical: espaco.lg,
          backgroundColor: veu.tinta(0.55),
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 360,
            maxHeight: "100%",
            borderRadius: canto.painel,
            ...curva,
            backgroundColor: cor.cartao,
            ...sombras.flutuante,
          }}
        >
          {/* Num iPhone baixo (ou com a letra grande), a festa rola dentro do cartão. */}
          <ScrollView
            style={{ flexShrink: 1 }}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {/* A vitrine: o céu da hora, o número atrás, a Bolha na frente. */}
            <View
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              style={{
                height: VITRINE,
                borderTopLeftRadius: canto.painel,
                borderTopRightRadius: canto.painel,
                ...curva,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: ceu.chao,
              }}
            >
              <Image
                source={ceu.arte}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                contentPosition="top"
              />
              {v.numero != null ? (
                <Animated.Text
                  allowFontScaling={false}
                  style={{
                    position: "absolute",
                    top: 4,
                    ...fonteDoNumero,
                    fontSize: v.numero >= 10 ? 184 : 200,
                    lineHeight: 200,
                    letterSpacing: -8,
                    fontVariant: ["tabular-nums"],
                    color: ceu.numero,
                    textShadowColor: comAlfa(cor.texto, 0.16),
                    textShadowOffset: { width: 0, height: 6 },
                    textShadowRadius: 18,
                    opacity: numeroChega,
                    transform: [
                      { translateX: -afasta },
                      {
                        translateY: numeroChega.interpolate({
                          inputRange: [0, 1],
                          outputRange: [30, 0],
                        }),
                      },
                    ],
                  }}
                >
                  {v.numero}
                </Animated.Text>
              ) : null}
              <Animated.View
                style={{
                  marginTop: v.numero != null ? 48 : 60,
                  opacity: chega.interpolate({
                    inputRange: [0, 0.3, 1],
                    outputRange: [0, 1, 1],
                    extrapolate: "clamp",
                  }),
                  transform: [
                    { translateX: afasta },
                    { scale: chega.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
                    { translateY: chega.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
                  ],
                }}
              >
                <BolhaViva humor={v.pose} tamanho={v.numero != null ? BOLHA : BOLHA + 12} />
              </Animated.View>
            </View>

            <View
              style={{
                alignItems: "center",
                gap: espaco.md,
                paddingHorizontal: espaco.xl,
                paddingTop: espaco.lg,
                paddingBottom: espaco.lg,
              }}
            >
              <View style={{ alignItems: "center", gap: 2 }}>
                <Sobrelinha tinta={cor.primariaEscura}>{v.sobrelinha}</Sobrelinha>
                <Text
                  accessibilityRole="header"
                  style={{
                    textAlign: "center",
                    ...fonte.display,
                    ...escala.titulo1,
                    letterSpacing: -0.2,
                    color: cor.texto,
                  }}
                >
                  {v.titulo}
                </Text>
                {v.dado ? (
                  <Text
                    style={{
                      textAlign: "center",
                      ...fonte.media,
                      ...escala.legenda,
                      color: cor.textoApagado,
                    }}
                  >
                    {v.dado}
                  </Text>
                ) : null}
              </View>
              <BalaoDaBolha texto={v.fala} />
              <View
                accessible
                accessibilityLabel={`Mais ${festa.sementinhas} sementinhas`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  borderRadius: canto.pilula,
                  backgroundColor: cor.sementinhaFundo,
                  paddingHorizontal: espaco.lg,
                  paddingVertical: 7,
                }}
              >
                <Sprout size={18} color={cor.sementinha} strokeWidth={2.4} />
                <Text style={{ ...fonte.titulo, ...escala.chamada, color: cor.sementinha }}>
                  +{festa.sementinhas} sementinhas
                </Text>
              </View>
              <View style={{ alignSelf: "stretch", marginTop: espaco.xs, gap: espaco.sm }}>
                <Botao rotulo="Que bom!" tamanho="grande" aoTocar={aoFechar} />
                {m.tipo === "semana" ? (
                  <CompartilharNaFesta semana={m.semana} nomeDoBebe={nomeDoBebe} />
                ) : (
                  <CompartilharConquista
                    d={cartaoDoMarco(m, nomeDoBebe)}
                    tinta={cor.primaria}
                    fundoDoBotao={cor.destaque}
                  />
                )}
              </View>
            </View>
          </ScrollView>
        </View>
        <Confete pecas={48} />
      </View>
    </Modal>
  );
}

/**
 * O BALÃO DA BOLHA: o que ela diz na festa. A ponta sobe para a vitrine, onde
 * ela está; a névoa lilás do app, e não um cartão branco sobre o branco.
 */
function BalaoDaBolha({ texto }: { texto: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`A Bolha diz: ${texto}`}
      style={{ alignSelf: "stretch", marginTop: espaco.xs }}
    >
      <View
        style={{
          position: "absolute",
          top: -6,
          left: "50%",
          marginLeft: -7,
          width: 14,
          height: 14,
          borderRadius: 3,
          backgroundColor: cor.apagado,
          transform: [{ rotate: "45deg" }],
        }}
      />
      <View
        style={{
          borderRadius: canto.dentro,
          ...curva,
          backgroundColor: cor.apagado,
          paddingHorizontal: espaco.lg,
          paddingVertical: espaco.md,
        }}
      >
        <Text
          style={{
            textAlign: "center",
            ...fonte.media,
            ...escala.legenda,
            color: cor.textoCorpo,
          }}
        >
          {texto}
        </Text>
      </View>
    </View>
  );
}
