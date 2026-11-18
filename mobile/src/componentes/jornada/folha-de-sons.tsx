import { Image } from "expo-image";
import VolumeX from "lucide-react-native/icons/volume-x";
import { useEffect, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";
import { familiasDeSom, type SomKey } from "@/lib/som-receitas";
import { ROTULO_DO_SOM_NO_APP } from "~/lib/jornada/sons";
import { ARTE_DO_SOM } from "~/lib/audio/sons-de-fundo";
import {
  Ficha,
  FolhaDaAtividade,
  GrupoDaFolha,
  LinhaDaFolha,
  type PaletaDaAtividade,
} from "~/componentes/jornada/atividade";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { cor } from "~/tema";

export type SomEscolhido = SomKey | "silencio";

/**
 * A FOLHA DE SONS — a mesma da Meditação e da Carta: troca o som NA HORA, sem
 * sair do exercício. A legenda de cada som não é enfeite: "Drone grave" e "Pad
 * calmo" são a mesma coisa para quem nunca ouviu os dois.
 *
 * É a folha NATIVA do iOS (`pageSheet`, 18/11/2026): sobe com o véu e o
 * arrastar para baixo do sistema. Os sons vêm com a ARTE de cada um (a mesma
 * do menu, e não um emoji ao lado dela), agrupados por família, com o ✓ no
 * marcado. "Desligar som" fica no fim, separado, para não parecer mais uma
 * faixa.
 */
export function FolhaDeSons({
  aberta,
  som,
  cuidado,
  paleta,
  aoFechar,
  aoEscolher,
  amostrando,
  nota,
}: {
  aberta: boolean;
  som: SomEscolhido;
  cuidado: boolean;
  paleta: PaletaDaAtividade;
  aoFechar: () => void;
  aoEscolher: (k: SomEscolhido) => void;
  /** O som que está tocando a amostra de cinco segundos (no menu da Meditação). */
  amostrando?: SomKey | null;
  nota?: string;
}) {
  return (
    <FolhaDaAtividade
      aberta={aberta}
      titulo="Som de fundo"
      paleta={paleta}
      aoFechar={aoFechar}
      nota={nota}
    >
      {familiasDeSom(cuidado).map(({ familia, sons }) => (
        <GrupoDaFolha key={familia} titulo={familia}>
          {sons.map((k, i) => (
            <LinhaDaFolha
              key={k}
              paleta={paleta}
              primeira={i === 0}
              arte={<ArteDoSom som={k} />}
              titulo={ROTULO_DO_SOM_NO_APP[k].label}
              legenda={ROTULO_DO_SOM_NO_APP[k].sub}
              marcada={som === k}
              aoTocar={() => aoEscolher(k)}
              depois={amostrando === k ? <Onda tinta={paleta.acao} /> : null}
            />
          ))}
        </GrupoDaFolha>
      ))}
      <GrupoDaFolha>
        <LinhaDaFolha
          paleta={paleta}
          primeira
          arte={
            <Ficha fundo={cor.apagado} tamanho={28}>
              <VolumeX size={16} color={cor.textoApagado} strokeWidth={2.2} />
            </Ficha>
          }
          titulo="Desligar som"
          marcada={som === "silencio"}
          aoTocar={() => aoEscolher("silencio")}
        />
      </GrupoDaFolha>
    </FolhaDaAtividade>
  );
}

/** A arte do som, 28 pt (o emoji só para o som que ainda não tem arte). */
export function ArteDoSom({ som, tamanho = 28 }: { som: SomEscolhido; tamanho?: number }) {
  const arte = som !== "silencio" ? ARTE_DO_SOM[som] : undefined;
  if (arte)
    return (
      <Image
        source={arte}
        style={{ width: tamanho, height: tamanho }}
        contentFit="contain"
        accessible={false}
      />
    );
  if (som === "silencio")
    return <VolumeX size={tamanho * 0.7} color={cor.textoApagado} strokeWidth={2.2} />;
  return (
    <View style={{ width: tamanho, alignItems: "center" }}>
      <Text style={{ fontSize: tamanho * 0.78 }}>{ROTULO_DO_SOM_NO_APP[som].emoji}</Text>
    </View>
  );
}

/**
 * As três barrinhas que sobem e descem enquanto o som toca. A amostra dura
 * cinco segundos; o que toca a noite inteira passa `voltas` e descansa (o
 * enfeite não fica girando para sempre atrás de quem dorme).
 */
export function Onda({
  tinta,
  altura = 14,
  voltas,
}: {
  tinta: string;
  altura?: number;
  voltas?: number;
}) {
  const reduzido = useMovimentoReduzido();
  const barras = useRef([0, 1, 2].map(() => new Animated.Value(0.4))).current;
  useEffect(() => {
    if (reduzido) return;
    const lacos = barras.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(b, {
            toValue: 1,
            duration: 300,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(b, {
            toValue: 0.4,
            duration: 300,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        { iterations: voltas ?? -1 },
      ),
    );
    lacos.forEach((l) => l.start());
    return () => lacos.forEach((l) => l.stop());
  }, [barras, reduzido, voltas]);
  return (
    <View
      style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: altura }}
      accessible={false}
    >
      {barras.map((b, i) => (
        <Animated.View
          key={i}
          style={{
            width: 3,
            height: altura,
            borderRadius: 2,
            backgroundColor: tinta,
            transform: [{ scaleY: b }],
          }}
        />
      ))}
    </View>
  );
}
