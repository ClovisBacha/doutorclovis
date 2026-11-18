import { trimesterForWeek } from "@/lib/gestacao";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { CalendarHeart, HeartHandshake, Ruler, Weight } from "lucide-react-native";
import { memo, useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Circle, Defs, LinearGradient as Degrade, Stop } from "react-native-svg";
import { Sobrelinha, TituloDaSecao } from "~/componentes/base";
import { FichaDoAtalho, GrupoDeAtalhos, LinhaDoAtalho } from "~/componentes/jornada/atalhos";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { RAIO_DENTRO_DO_PAINEL } from "~/componentes/painel";
import { bebeDaSemana, emojiDaFrutaNoApp, retaFinalNoApp } from "~/lib/bebe-da-semana";
import { clarear, comAlfa } from "~/lib/cor";
import { ferramentasDaGestacao, NOME_DOS_MOVIMENTOS } from "~/lib/ferramentas";
import { dataCurta, dataProvavel, fracaoDaGestacao } from "~/lib/inicio";
import { semGeneroDoBebe } from "~/lib/nutricao/frase-do-topo";
import {
  amanhecer,
  canto,
  cor,
  curva,
  escala,
  fonte,
  fonteDoNumero,
  luz,
  sombra,
  vidro,
} from "~/tema";

/**
 * O BEBÊ NESTA SEMANA — o acompanhamento, na tela do bebê (a aba do meio, que
 * abre o app; decisão do dono, 13/11/2026: "o bebê é o centro [...] esse
 * acompanhamento que é a alma do aplicativo").
 *
 * O céu do topo diz o nome, a semana e quantos dias faltam; aqui ficam os
 * dados: o tamanho, o peso, a fruta e a frase da semana, a data provável com o
 * quanto da gestação já passou, a reta final, o semana a semana e os
 * movimentos. Nada se repete entre os dois (18/11/2026, a vistoria).
 *
 * O desenho é um MOSAICO (16/11/2026): o anel da gestação grande à esquerda,
 * o tamanho e o peso ao lado, a fruta numa faixa larga. O semana a semana
 * (`app/bebe.tsx`) usa este mesmo painel para a semana que a régua mostra.
 */
export const BebeNestaSemana = memo(function BebeNestaSemana({
  semana,
  totalDias,
  nomeDoBebe,
  titulo = "Nesta semana",
  mostrarDataProvavel = true,
  portas = true,
}: {
  semana: number;
  /** O dia da gestação HOJE (a data provável e o anel saem dele). */
  totalDias: number | null;
  nomeDoBebe: string | null;
  /** O título do painel (sem título no semana a semana, que tem o céu em cima). */
  titulo?: string | null;
  /** A data provável é de hoje: o semana a semana a esconde nas outras semanas. */
  mostrarDataProvavel?: boolean;
  /** As portas para o semana a semana e os movimentos (o semana a semana não abre a si mesmo). */
  portas?: boolean;
}) {
  const bebe = bebeDaSemana(semana);
  const reta = retaFinalNoApp(semana);
  const { movimentos } = ferramentasDaGestacao({ semanas: semana, cuidado: false, nasceu: false });
  const comData = mostrarDataProvavel && totalDias != null;
  const dpp = totalDias != null ? dataCurta(dataProvavel(totalDias)) : null;
  const fracao = totalDias != null ? Math.min(1, Math.max(0, fracaoDaGestacao(totalDias))) : 0;
  /* Nas semanas 4–7 o peso é "—": um travessão de 28 pt parece dado quebrado. */
  const temPeso = bebe.weight.trim() !== "—";

  const tamanho = (
    <Medida
      titulo="Tamanho"
      valor={bebe.size}
      icone={<Ruler size={16} color={cor.agenda} strokeWidth={2.3} />}
      ficha={cor.agendaFundo}
    />
  );
  const peso = temPeso ? (
    <Medida
      titulo="Peso"
      valor={bebe.weight}
      icone={<Weight size={16} color={cor.contracoes} strokeWidth={2.3} />}
      ficha={cor.contracoesFundo}
    />
  ) : null;

  return (
    <View style={{ gap: 10 }}>
      {titulo ? (
        <TituloDaSecao
          direita={
            <View
              style={{
                borderRadius: canto.pilula,
                backgroundColor: cor.destaque,
                paddingHorizontal: 11,
                paddingVertical: 5,
              }}
            >
              <Text style={{ ...fonte.forte, ...escala.nota, color: cor.textoDestaque }}>
                {trimesterForWeek(semana)}º trimestre
              </Text>
            </View>
          }
        >
          {titulo}
        </TituloDaSecao>
      ) : null}

      {comData && dpp ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          {/* O anel: quanto da gestação já passou, e a data provável. */}
          <Ladrilho
            estilo={{ flex: 1.12, alignItems: "center", paddingVertical: 16 }}
            rotulo={`${Math.round(fracao * 100)}% da gestação. Data provável ${dpp}.`}
          >
            <AnelDaGestacao fracao={fracao} />
            <View style={{ alignItems: "center", marginTop: 10 }}>
              <Text style={{ ...fonte.media, ...escala.nota, color: cor.textoApagado }}>
                Data provável
              </Text>
              <Text style={{ marginTop: 1, ...fonte.forte, ...escala.legenda, color: cor.texto }}>
                {dpp}
              </Text>
            </View>
          </Ladrilho>
          <View style={{ flex: 1, gap: 10 }}>
            {tamanho}
            {peso}
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: 10 }}>
          {tamanho}
          {peso}
        </View>
      )}

      {/* A fruta e a frase da semana, numa faixa larga com a luz do amanhecer. */}
      <LinearGradient
        colors={[clarear(luz.pessego, 0.55), clarear(luz.rose, 0.55), clarear(luz.lilas, 0.55)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          borderRadius: RAIO_DENTRO_DO_PAINEL,
          ...curva,
          padding: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: vidro.borda,
          ...sombra,
        }}
      >
        <FichaDaFruta semana={semana} />
        <View style={{ flex: 1 }}>
          <Text style={{ ...fonte.media, ...escala.nota, color: cor.textoApagado }}>
            Do tamanho de
          </Text>
          <Text style={{ ...fonte.forte, ...escala.titulo3, color: cor.texto }}>
            {bebe.fruit}
          </Text>
          <Text style={{ marginTop: 3, ...fonte.normal, ...escala.legenda, color: cor.textoCorpo }}>
            {semGeneroDoBebe(bebe.desc)}
          </Text>
        </View>
      </LinearGradient>

      {reta ? (
        <Ladrilho estilo={{ gap: 2 }}>
          <Sobrelinha tinta={cor.primariaEscura}>Reta final</Sobrelinha>
          <Text style={{ marginTop: 2, ...fonte.forte, ...escala.chamada, color: cor.texto }}>
            {reta.titulo}
          </Text>
          <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoCorpo }}>
            {reta.corpo}
          </Text>
        </Ladrilho>
      ) : null}

      {portas ? (
        <GrupoDeAtalhos recuo={14 + 32 + 12}>
          <LinhaDoAtalho
            altura={52}
            ficha={
              <FichaDoAtalho lado={32} fundo={cor.agendaFundo}>
                <CalendarHeart size={17} color={cor.agenda} strokeWidth={2.2} />
              </FichaDoAtalho>
            }
            titulo="Semana a semana"
            rotulo={`Ver ${nomeDoBebe ?? "o bebê"} semana a semana`}
            aoTocar={() => router.push("/bebe")}
          />
          {movimentos ? (
            <LinhaDoAtalho
              altura={52}
              ficha={
                <FichaDoAtalho lado={32} fundo={cor.destaque}>
                  <HeartHandshake size={17} color={cor.primaria} strokeWidth={2.2} />
                </FichaDoAtalho>
              }
              titulo={NOME_DOS_MOVIMENTOS}
              rotulo={`${NOME_DOS_MOVIMENTOS}: conte as mexidinhas, no seu tempo`}
              aoTocar={() => router.push("/saude/chutes")}
            />
          ) : null}
        </GrupoDeAtalhos>
      ) : null}
    </View>
  );
});

/**
 * A fruta da semana: o emoji só quando ele desenha a fruta escrita ao lado
 * (`EMOJI_DA_FRUTA_NO_APP`); sem par fiel, a régua — e nunca um parente.
 */
function FichaDaFruta({ semana }: { semana: number }) {
  const emoji = emojiDaFrutaNoApp(semana);
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 64,
        height: 64,
        borderRadius: canto.dentro,
        ...curva,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: luz.cartao,
        boxShadow: `0px 8px 18px -8px ${comAlfa(cor.texto, 0.25)}`,
      }}
    >
      {emoji ? (
        <Text allowFontScaling={false} style={{ fontSize: 36, lineHeight: 44 }}>
          {emoji}
        </Text>
      ) : (
        <Ruler size={28} color={cor.primaria} strokeWidth={2.2} />
      )}
    </View>
  );
}

/** Uma peça do mosaico: branca, com o fio de luz e a sombra em camadas. */
function Ladrilho({
  children,
  estilo,
  rotulo,
}: {
  children: ReactNode;
  estilo?: StyleProp<ViewStyle>;
  rotulo?: string;
}) {
  return (
    <View
      accessible={!!rotulo}
      accessibilityLabel={rotulo}
      style={[
        {
          borderRadius: RAIO_DENTRO_DO_PAINEL,
          ...curva,
          padding: 14,
          backgroundColor: luz.cartao,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: vidro.borda,
          ...sombra,
        },
        estilo,
      ]}
    >
      {children}
    </View>
  );
}

function Medida({
  titulo,
  valor,
  icone,
  ficha,
}: {
  titulo: string;
  valor: string;
  icone: ReactNode;
  ficha: string;
}) {
  return (
    <Ladrilho
      estilo={{ flex: 1, justifyContent: "space-between", gap: 10 }}
      rotulo={`${titulo}: ${valor}`}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: canto.icone,
            ...curva,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: ficha,
          }}
        >
          {icone}
        </View>
        <Text style={{ ...fonte.media, ...escala.legenda, color: cor.textoApagado }}>{titulo}</Text>
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          ...fonteDoNumero,
          fontSize: 28,
          lineHeight: 32,
          letterSpacing: -0.6,
          color: cor.texto,
        }}
      >
        {valor}
      </Text>
    </Ladrilho>
  );
}

const LADO = 124;
const TRACO = 13;
const RAIO = (LADO - TRACO) / 2;
const VOLTA = 2 * Math.PI * RAIO;
const CirculoAnimado = Animated.createAnimatedComponent(Circle);

/** O último número inteiro que o anel mostrou, neste processo. */
let ultimoPorcento: number | null = null;

/**
 * O anel da gestação: o degradê do amanhecer até o ponto em que ela está.
 *
 * Abre JÁ DESENHADO (18/11/2026): a volta inteira se fechando a cada abertura
 * era pelo JavaScript, quadro a quadro, no instante mais carregado do app. Só
 * anda quando o número muda (um dia novo vira 62%), do último que ela viu.
 */
function AnelDaGestacao({ fracao }: { fracao: number }) {
  const reduzido = useMovimentoReduzido();
  const porcento = Math.round(fracao * 100);
  const de = useRef(
    ultimoPorcento != null && ultimoPorcento !== porcento ? ultimoPorcento / 100 : fracao,
  );
  const v = useRef(new Animated.Value(de.current)).current;
  useEffect(() => {
    const andou = Math.round(de.current * 100) !== porcento;
    de.current = fracao;
    ultimoPorcento = porcento;
    if (!andou || reduzido) {
      v.setValue(fracao);
      return;
    }
    Animated.timing(v, {
      toValue: fracao,
      duration: 900,
      delay: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fracao, porcento, reduzido, v]);
  return (
    <View style={{ width: LADO, height: LADO, alignItems: "center", justifyContent: "center" }}>
      <Svg width={LADO} height={LADO} style={{ position: "absolute" }}>
        <Defs>
          <Degrade id="anel-do-amanhecer" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={amanhecer[0]} />
            <Stop offset="0.5" stopColor={amanhecer[1]} />
            <Stop offset="1" stopColor={amanhecer[2]} />
          </Degrade>
        </Defs>
        <Circle
          cx={LADO / 2}
          cy={LADO / 2}
          r={RAIO}
          fill="none"
          stroke={cor.trilho}
          strokeWidth={TRACO}
        />
        <CirculoAnimado
          cx={LADO / 2}
          cy={LADO / 2}
          r={RAIO}
          fill="none"
          stroke="url(#anel-do-amanhecer)"
          strokeWidth={TRACO}
          strokeLinecap="round"
          strokeDasharray={`${VOLTA} ${VOLTA}`}
          strokeDashoffset={v.interpolate({ inputRange: [0, 1], outputRange: [VOLTA, 0] })}
          transform={`rotate(-90 ${LADO / 2} ${LADO / 2})`}
        />
      </Svg>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <Text
          maxFontSizeMultiplier={1.15}
          style={{
            ...fonteDoNumero,
            fontSize: 38,
            lineHeight: 42,
            letterSpacing: -1.2,
            color: cor.texto,
          }}
        >
          {porcento}
        </Text>
        <Text
          maxFontSizeMultiplier={1.15}
          style={{ marginTop: 6, ...fonte.titulo, fontSize: 16, color: cor.textoApagado }}
        >
          %
        </Text>
      </View>
      <Text
        maxFontSizeMultiplier={1.15}
        style={{ ...fonte.media, ...escala.nota, color: cor.textoApagado }}
      >
        da gestação
      </Text>
    </View>
  );
}
