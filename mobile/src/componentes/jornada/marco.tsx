import { Image } from "expo-image";
import { Sprout } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, Modal, StyleSheet, Text, View } from "react-native";
import { Botao, Sobrelinha, sucesso } from "~/componentes/base";
import { CEUS, faseDeAgora } from "~/componentes/ceu-vivo";
import { arteDoBebe } from "~/componentes/jornada/arte-do-bebe";
import { Brilho } from "~/componentes/jornada/atividade";
import { CompartilharConquista } from "~/componentes/jornada/cartao-de-conquista";
import { Confete } from "~/componentes/jornada/pecas";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { bebeDaSemana } from "~/lib/bebe-da-semana";
import { cartaoDoMarco } from "~/lib/jornada/cartoes";
import type { Festa, Marco } from "~/lib/jornada/marcos";
import {
  canto,
  cor,
  curva,
  escala,
  espaco,
  fonte,
  fonteDoNumero,
  sombras,
  veu,
} from "~/tema";

/** O recém-nascido (o mesmo da festa e da porta do nascimento). */
const RECEM_NASCIDO = require("../../../../src/assets/bebe/semana.webp");

/** A altura da vitrine: o céu da hora com o bebê na frente do número. */
const VITRINE = 236;

/**
 * "CHEGOU UM NOVO MARCO" — a festa da semana nova, do fim de um trimestre, do
 * nascimento e de cada mês do bebê (`~/lib/jornada/marcos`). O servidor paga
 * esses marcos sozinho; o app passava o crédito em silêncio, e o site abria
 * esta tela com o bebê da semana. Só abre sobre um crédito que o extrato
 * mostra — a soma dita aqui é a que entrou.
 *
 * É o "uau" de toda semana (18/11/2026, a vistoria: "ninguém a abriu"). Era um
 * emoji de fruta num cartão branco solto (às vezes a fruta errada). Agora é a
 * mesma cena da tela do bebê, em miniatura: o céu da hora, o número da semana
 * atrás e o bebê da semana na frente, chegando numa mola só, com o toque de
 * sucesso na mão.
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

/** O que a vitrine mostra: a arte e o número que fica atrás dela. */
function vitrineDo(m: Marco): { arte: number; numero: string | null } {
  if (m.tipo === "semana") return { arte: arteDoBebe(m.semana), numero: String(m.semana) };
  if (m.tipo === "trimestre") {
    const ultima = m.trimestre === 1 ? 13 : 27;
    return { arte: arteDoBebe(ultima), numero: String(ultima) };
  }
  if (m.tipo === "mes") return { arte: RECEM_NASCIDO, numero: String(m.meses) };
  return { arte: RECEM_NASCIDO, numero: null };
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
  const bebe = nomeDoBebe ?? "O bebê";
  const reduzido = useMovimentoReduzido();
  /* O céu de quando a festa abriu (a mesma hora da tela de trás). */
  const [ceu] = useState(() => CEUS[faseDeAgora()]);
  const { arte, numero } = vitrineDo(m);

  /* A chegada: a arte numa mola só, e o toque de sucesso na mão. */
  const chega = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  useEffect(() => {
    sucesso();
    if (reduzido) {
      chega.setValue(1);
      return;
    }
    Animated.spring(chega, {
      toValue: 1,
      useNativeDriver: true,
      speed: 9,
      bounciness: 11,
      delay: 120,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [festa.chaves.join("|")]);

  const semana = m.tipo === "semana" ? bebeDaSemana(m.semana) : null;
  const titulo =
    m.tipo === "semana"
      ? `Semana ${m.semana}`
      : m.tipo === "trimestre"
        ? `Fim do ${m.trimestre}º trimestre`
        : m.tipo === "nascimento"
          ? "Boas-vindas ao mundo"
          : `${bebe} com ${m.meses} ${m.meses === 1 ? "mês" : "meses"}`;
  const texto =
    m.tipo === "semana"
      ? `${semana!.desc} Do tamanho de ${semana!.fruit.toLowerCase()}, ${semana!.size}.`
      : m.tipo === "trimestre"
        ? `Uma fase inteira de cuidado ficou para trás. O ${m.trimestre + 1}º trimestre começa agora.`
        : m.tipo === "nascimento"
          ? `${bebe} chegou. Agora a jornada é de vocês dois.`
          : "Mais um mês de vocês dois juntos.";

  return (
    <Modal transparent animationType="fade" visible onRequestClose={aoFechar}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: espaco.xl,
          backgroundColor: veu.tinta(0.55),
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 360,
            borderRadius: canto.painel,
            ...curva,
            backgroundColor: cor.cartao,
            ...sombras.flutuante,
          }}
        >
          {/* A vitrine: o céu da hora, o número atrás, o bebê na frente. */}
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
            {numero ? (
              <Text
                allowFontScaling={false}
                style={{
                  position: "absolute",
                  top: 8,
                  ...fonteDoNumero,
                  fontSize: 180,
                  lineHeight: 190,
                  letterSpacing: -8,
                  fontVariant: ["tabular-nums"],
                  color: ceu.numero,
                }}
              >
                {numero}
              </Text>
            ) : null}
            <Animated.View
              style={{
                marginTop: 34,
                alignItems: "center",
                justifyContent: "center",
                opacity: chega.interpolate({
                  inputRange: [0, 0.3, 1],
                  outputRange: [0, 1, 1],
                  extrapolate: "clamp",
                }),
                transform: [
                  { scale: chega.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
                  { translateY: chega.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
                ],
              }}
            >
              <Brilho tamanho={230} />
              <Image source={arte} style={{ width: 160, height: 160 }} contentFit="contain" />
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
            <Sobrelinha tinta={cor.primariaEscura}>Chegou um novo marco</Sobrelinha>
            <Text
              accessibilityRole="header"
              style={{
                marginTop: -4,
                textAlign: "center",
                ...fonte.display,
                ...escala.titulo1,
                letterSpacing: -0.2,
                color: cor.texto,
              }}
            >
              {titulo}
            </Text>
            <Text
              style={{
                textAlign: "center",
                ...fonte.normal,
                ...escala.legenda,
                color: cor.textoCorpo,
              }}
            >
              {texto}
            </Text>
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
                paddingVertical: espaco.sm,
              }}
            >
              <Sprout size={18} color={cor.sementinha} strokeWidth={2.4} />
              <Text style={{ ...fonte.titulo, ...escala.chamada, color: cor.sementinha }}>
                +{festa.sementinhas} sementinhas
              </Text>
            </View>
            <View style={{ alignSelf: "stretch", marginTop: espaco.xs, gap: espaco.sm }}>
              <Botao rotulo="Que bom!" tamanho="grande" aoTocar={aoFechar} />
              <CompartilharConquista
                d={cartaoDoMarco(m, nomeDoBebe)}
                tinta={cor.primaria}
                fundoDoBotao={cor.destaque}
              />
            </View>
          </View>
        </View>
        <Confete pecas={48} />
      </View>
    </Modal>
  );
}
