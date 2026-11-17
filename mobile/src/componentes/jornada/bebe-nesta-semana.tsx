import { fruitEmojiForWeek, trimesterForWeek } from "@/lib/gestacao";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { CalendarHeart, ChevronRight, HeartHandshake, Ruler, Weight } from "lucide-react-native";
import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Circle, Defs, LinearGradient as Degrade, Stop } from "react-native-svg";
import { toque } from "~/componentes/base";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { bebeDaSemana, retaFinalNoApp } from "~/lib/bebe-da-semana";
import { ferramentasDaGestacao, NOME_DOS_MOVIMENTOS } from "~/lib/ferramentas";
import { dataCurta, dataProvavel, diasAteADpp, fracaoDaGestacao } from "~/lib/inicio";
import { semGeneroDoBebe } from "~/lib/nutricao/frase-do-topo";
import {
  ALVO_MINIMO,
  amanhecer,
  aperto,
  cor,
  curva,
  espaco,
  fonte,
  fonteDoNumero,
  luz,
  sombra,
} from "~/tema";

const TEXTO = cor.texto;
const CORPO = "#463d63";
const APAGADO = cor.textoApagado;
const LINK = cor.primariaEscura;

/**
 * O BEBÊ NESTA SEMANA — o acompanhamento, na tela do bebê (a aba do meio, que
 * abre o app; decisão do dono, 13/11/2026: "o bebê é o centro [...] esse
 * acompanhamento que é a alma do aplicativo").
 *
 * O céu do topo já diz a semana, a fruta, o tamanho e quantos dias faltam;
 * aqui fica o resto: o peso, a frase da semana, a data provável com o quanto
 * da gestação já passou, a reta final, o semana a semana e os movimentos.
 *
 * O desenho é um MOSAICO (16/11/2026), e não mais uma pilha de linhas iguais:
 * o anel da gestação grande à esquerda, com o degradê do amanhecer se fechando
 * ao abrir a tela; o tamanho e o peso ao lado; a fruta numa faixa larga. Nada
 * do que a tela dizia saiu — mudou de lugar e de peso.
 */
export function BebeNestaSemana({
  semana,
  totalDias,
  nomeDoBebe,
}: {
  semana: number;
  totalDias: number;
  nomeDoBebe: string | null;
}) {
  const bebe = bebeDaSemana(semana);
  const faltam = diasAteADpp(totalDias);
  const reta = retaFinalNoApp(semana);
  const { movimentos } = ferramentasDaGestacao({ semanas: semana, cuidado: false, nasceu: false });
  const dpp = dataCurta(dataProvavel(totalDias));
  const fracao = Math.min(1, Math.max(0, fracaoDaGestacao(totalDias)));

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          style={{
            flex: 1,
            ...fonte.titulo,
            fontSize: 24,
            lineHeight: 30,
            letterSpacing: aperto.titulo,
            color: TEXTO,
          }}
        >
          {nomeDoBebe ? `${nomeDoBebe} nesta semana` : "O bebê nesta semana"}
        </Text>
        <View
          style={{
            borderRadius: 999,
            backgroundColor: cor.destaque,
            paddingHorizontal: 11,
            paddingVertical: 5,
          }}
        >
          <Text style={{ ...fonte.forte, fontSize: 13, color: LINK }}>
            {trimesterForWeek(semana)}º trimestre
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        {/* O anel: quanto da gestação já passou, e a data provável. */}
        <Ladrilho
          estilo={{ flex: 1.12, alignItems: "center", paddingVertical: 16 }}
          rotulo={
            faltam > 0
              ? `Data provável ${dpp}. Faltam ${faltam} ${faltam === 1 ? "dia" : "dias"}.`
              : `Data provável ${dpp}.`
          }
        >
          <AnelDaGestacao fracao={fracao} />
          <View style={{ alignItems: "center", marginTop: 10 }}>
            <Text style={{ ...fonte.media, fontSize: 13, color: APAGADO }}>Data provável</Text>
            <Text style={{ marginTop: 1, ...fonte.forte, fontSize: 15, color: TEXTO }}>{dpp}</Text>
            {faltam > 0 ? (
              <Text style={{ marginTop: 1, ...fonte.media, fontSize: 13, color: APAGADO }}>
                faltam {faltam} {faltam === 1 ? "dia" : "dias"}
              </Text>
            ) : null}
          </View>
        </Ladrilho>
        <View style={{ flex: 1, gap: 10 }}>
          <Medida
            titulo="Tamanho"
            valor={bebe.size}
            icone={<Ruler size={16} color={amanhecer[2]} strokeWidth={2.3} />}
            ficha="#efe9ff"
          />
          <Medida
            titulo="Peso"
            valor={bebe.weight}
            icone={<Weight size={16} color="#e8672d" strokeWidth={2.3} />}
            ficha="#ffeadc"
          />
        </View>
      </View>

      {/* A fruta e a frase da semana, numa faixa larga com a luz do amanhecer. */}
      <LinearGradient
        colors={["#fff3ea", "#ffeaf2", "#f1ebff"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          borderRadius: 24,
          ...curva,
          padding: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: "rgba(255,255,255,0.95)",
          ...sombra,
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            ...curva,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.8)",
            boxShadow: "0px 8px 18px -8px rgba(35,25,66,0.25)",
          }}
        >
          <Text allowFontScaling={false} style={{ fontSize: 36, lineHeight: 44 }}>
            {fruitEmojiForWeek(semana)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...fonte.media, fontSize: 13, color: APAGADO }}>Como</Text>
          <Text
            style={{
              ...fonte.titulo,
              fontSize: 19,
              lineHeight: 23,
              letterSpacing: aperto.subtitulo,
              color: TEXTO,
            }}
          >
            {bebe.fruit}
          </Text>
          <Text
            style={{ marginTop: 3, ...fonte.media, fontSize: 14, lineHeight: 20, color: CORPO }}
          >
            {semGeneroDoBebe(bebe.desc)}
          </Text>
        </View>
      </LinearGradient>

      {reta ? (
        <View
          style={{ borderRadius: 20, ...curva, backgroundColor: "#fff1e6", padding: 14, gap: 2 }}
        >
          <Text style={{ ...fonte.forte, fontSize: 15, color: "#8a4d2a" }}>{reta.titulo}</Text>
          <Text style={{ ...fonte.media, fontSize: 14, lineHeight: 20, color: "#8a5a3c" }}>
            {reta.corpo}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Porta
          titulo="Ver semana a semana"
          rotulo={`Ver ${nomeDoBebe ?? "o bebê"} semana a semana`}
          icone={<CalendarHeart size={18} color={LINK} strokeWidth={2.2} />}
          aoTocar={() => router.push("/bebe")}
        />
        {movimentos ? (
          <Porta
            titulo={NOME_DOS_MOVIMENTOS}
            rotulo={`${NOME_DOS_MOVIMENTOS}: conte as mexidinhas, no seu tempo`}
            icone={<HeartHandshake size={18} color={LINK} strokeWidth={2.2} />}
            aoTocar={() => router.push("/saude/chutes")}
          />
        ) : null}
      </View>
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
          borderRadius: 24,
          ...curva,
          padding: 14,
          backgroundColor: luz.cartao,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: "rgba(255,255,255,0.9)",
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
    <Ladrilho estilo={{ flex: 1, justifyContent: "space-between", gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            ...curva,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: ficha,
          }}
        >
          {icone}
        </View>
        <Text style={{ ...fonte.media, fontSize: 14, color: APAGADO }}>{titulo}</Text>
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          ...fonteDoNumero,
          fontSize: 28,
          lineHeight: 32,
          letterSpacing: -0.6,
          color: TEXTO,
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

/**
 * O anel da gestação: o degradê do amanhecer se fecha, ao abrir a tela, até o
 * ponto em que ela está. É o mesmo dado da barra antiga (`fracaoDaGestacao`),
 * agora com o tamanho que ele merece.
 */
function AnelDaGestacao({ fracao }: { fracao: number }) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(reduzido ? fracao : 0)).current;
  useEffect(() => {
    if (reduzido) {
      v.setValue(fracao);
      return;
    }
    Animated.timing(v, {
      toValue: fracao,
      duration: 1300,
      delay: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fracao, reduzido, v]);
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
          stroke={cor.apagado}
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
          allowFontScaling={false}
          style={{
            ...fonteDoNumero,
            fontSize: 38,
            lineHeight: 42,
            letterSpacing: -1.2,
            color: TEXTO,
          }}
        >
          {Math.round(fracao * 100)}
        </Text>
        <Text
          allowFontScaling={false}
          style={{ marginTop: 6, ...fonte.titulo, fontSize: 16, color: APAGADO }}
        >
          %
        </Text>
      </View>
      <Text allowFontScaling={false} style={{ ...fonte.media, fontSize: 11.5, color: APAGADO }}>
        da gestação
      </Text>
    </View>
  );
}

function Porta({
  titulo,
  rotulo,
  icone,
  aoTocar,
}: {
  titulo: string;
  rotulo: string;
  icone: ReactNode;
  aoTocar: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: ALVO_MINIMO + 12,
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.sm,
        borderRadius: 20,
        ...curva,
        paddingLeft: 14,
        paddingRight: 10,
        paddingVertical: 10,
        backgroundColor: luz.cartao,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.9)",
        ...sombra,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {icone}
      <Text style={{ flex: 1, ...fonte.forte, fontSize: 14, lineHeight: 18, color: LINK }}>
        {titulo}
      </Text>
      <ChevronRight size={18} color={LINK} strokeWidth={2.4} />
    </Pressable>
  );
}
