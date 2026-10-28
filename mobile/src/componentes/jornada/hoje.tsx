import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { bebeDaSemana } from "~/lib/bebe-da-semana";
import { toque } from "~/componentes/base";
import { BotaoDaAtividade, Brilho, sombraDe } from "~/componentes/jornada/atividade";
import {
  ArteDaBolha,
  Flutuar,
  useMovimentoReduzido,
  type HumorDaArte,
} from "~/componentes/movimento";
import { CompartilharASemana, type DadosDoCartao } from "~/componentes/jornada/cartao-da-semana";
import { Confete } from "~/componentes/jornada/pecas";
import { parametroDaBancada } from "~/lib/bancada";
import { arteDoBebe } from "~/componentes/jornada/arte-do-bebe";
import type { ChaveDoCuidado, Cuidado } from "~/lib/jornada/hoje";
import { cor, espaco, fonte } from "~/tema";

/**
 * HOJE — "o cuidado de hoje": a primeira tela do app (out/2026, aprovada pelo
 * dono a partir da imagem da proposta).
 *
 * A ideia numa frase: todo dia, 5 minutinhos de cuidado com você e com o bebê
 * — e você vê ele crescer. O HERÓI é o bebê ilustrado da semana, no céu
 * pintado da hora do dia; a bolha entra pequena, como personagem que ajuda
 * (pedido do dono: "o bebê bolha só entra como auxiliador personagem"). Os
 * cinco momentos viram gestos com tempo e porquê, o próximo vem em destaque, e
 * um anel de cinco partes se fecha ao longo do dia. A trilha, o Cantinho e os
 * troféus ficam a um toque ("Ver minha jornada").
 *
 * ⚠️ Nunca "a Helena"/"o Theo": o nome do bebê vai sem artigo, para a tela não
 * supor o sexo. Sem nome, "o bebê".
 */

export const ARTE: Record<ChaveDoCuidado, number> = {
  aula: require("../../../../src/assets/grades/perguntas.webp"),
  movement: require("../../../../src/assets/grades/exercicios.webp"),
  meditation: require("../../../../src/assets/grades/meditacoes.webp"),
  bonding: require("../../../../src/assets/bebe/carta.webp"),
  gratitude: require("../../../../src/assets/grades/diario.webp"),
};

export const FICHA: Record<ChaveDoCuidado, string> = {
  aula: "#fff1df",
  movement: "#e3f7ee",
  meditation: "#ffe9ef",
  bonding: "#fff1e3",
  gratitude: "#efe9ff",
};

/* O destaque do "próximo cuidado", na cor da atividade. */
const DESTAQUE: Record<
  ChaveDoCuidado,
  { de: string; ate: string; labio: string; forte: string; tinta: string }
> = {
  aula: { de: "#fff6e8", ate: "#ffe9cc", labio: "#f7d29f", forte: "#c26a00", tinta: "#6b3a00" },
  movement: { de: "#e9fbf2", ate: "#d4f5e6", labio: "#b5e9d1", forte: "#007a55", tinta: "#0b4a35" },
  meditation: {
    de: "#f6efff",
    ate: "#ebe0ff",
    labio: "#d8c6ff",
    forte: "#7008e7",
    tinta: "#3f1585",
  },
  bonding: { de: "#fff0f3", ate: "#ffe0e7", labio: "#ffc3d0", forte: "#c70036", tinta: "#7d0b2c" },
  gratitude: {
    de: "#fffbe8",
    ate: "#fff1c2",
    labio: "#fbe08a",
    forte: "#bb4d00",
    tinta: "#6e3203",
  },
};

/** O céu pintado da hora do dia, e a tinta que se lê em cima dele. */
export const CEUS = {
  amanhecer: {
    arte: require("../../../../src/assets/ceu/amanhecer.webp"),
    tinta: "#2e2348",
    sec: "#5d4d84",
  },
  dia: { arte: require("../../../../src/assets/ceu/dia.webp"), tinta: "#ffffff", sec: "#eaf4ff" },
  tarde: {
    arte: require("../../../../src/assets/ceu/por-do-sol.webp"),
    tinta: "#ffffff",
    sec: "#ffe9de",
  },
  noite: {
    arte: require("../../../../src/assets/ceu/anoitecer.webp"),
    tinta: "#ffffff",
    sec: "#dcd6ff",
  },
} as const;

export function ceuDaHora(hora: number): keyof typeof CEUS {
  if (hora >= 5 && hora < 11) return "amanhecer";
  if (hora >= 11 && hora < 16) return "dia";
  if (hora >= 16 && hora < 19) return "tarde";
  return "noite";
}

export const FUNDO = "#fff8f5";

/** Quantos cuidados a tela já mostrou feitos, por dia — neste processo. */
const vistosPorDia = new Map<string, number>();

/**
 * O instante em que um cuidado se acende: ela volta da atividade e a tela
 * reage — o anel pulsa, o celular vibra, e o quinto acende o céu e solta o
 * confete, uma vez. Ao ABRIR o app nada festeja: o que já estava feito é
 * estado, não acontecimento — e "abrir" inclui o instante em que a jornada
 * ainda não foi lida do aparelho (`pronto`): contar com o blob vazio fazia a
 * abertura festejar o que já estava feito. (`&animar=1` na bancada finge o
 * último.)
 */
export function useMomentoDoDia(
  D: number,
  feitos: number,
  total = 5,
  escopo = "gestacao",
  /** A jornada já foi lida do aparelho: antes disso o blob é vazio, e contar
      com ele faria a abertura do app "festejar" o que já estava feito. */
  pronto = true,
) {
  const reduzido = useMovimentoReduzido();
  const pulso = useRef(new Animated.Value(1)).current;
  const brilho = useRef(new Animated.Value(0)).current;
  const [festa, setFesta] = useState(false);
  useEffect(() => {
    if (!pronto) return;
    /* O D do pós-parto (7–90) repete números da gestação: o escopo separa. */
    const chave = `${escopo}:${D}`;
    let anterior = vistosPorDia.get(chave);
    if (anterior === undefined && parametroDaBancada("animar") === "1") anterior = feitos - 1;
    vistosPorDia.set(chave, feitos);
    if (anterior === undefined || feitos <= anterior) return;
    const fechou = feitos >= total && anterior < total;
    if (Platform.OS !== "web") {
      void (
        fechou
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      ).catch(() => {});
    }
    if (!reduzido) {
      Animated.sequence([
        Animated.timing(pulso, {
          toValue: 1.18,
          duration: 220,
          easing: Easing.out(Easing.back(2)),
          useNativeDriver: true,
        }),
        Animated.spring(pulso, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
    }
    if (fechou) {
      setFesta(true);
      if (!reduzido) {
        Animated.sequence([
          Animated.timing(brilho, { toValue: 0.6, duration: 500, useNativeDriver: true }),
          Animated.timing(brilho, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ]).start();
      }
      const t = setTimeout(() => setFesta(false), 4000);
      return () => clearTimeout(t);
    }
  }, [D, feitos, total, escopo, pronto, pulso, brilho, reduzido]);
  return { pulso, brilho, festa };
}

/** Entra subindo de leve (sem "Reduzir movimento"). */
export function Entrar({ atraso = 0, children }: { atraso?: number; children: ReactNode }) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  useEffect(() => {
    if (reduzido) return;
    Animated.timing(v, {
      toValue: 1,
      duration: 420,
      delay: atraso,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, atraso, reduzido]);
  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

export function TelaDeHoje({
  D,
  pronto = true,
  cartao,
  saudacao,
  data,
  nomeDoBebe,
  semana,
  dias,
  faltam,
  hora,
  cuidados,
  recado,
  humor,
  chama,
  avisos,
  nascimento,
  agenda,
  aoAbrir,
  aoVerJornada,
  direita,
}: {
  D: number;
  /** A jornada já foi lida do aparelho (`loja.pronto`). */
  pronto?: boolean;
  /** O cartão da semana para os Stories. */
  cartao: DadosDoCartao;
  saudacao: string;
  data: string;
  nomeDoBebe: string | null;
  semana: number;
  dias: number;
  faltam: number | null;
  hora: number;
  cuidados: readonly Cuidado[];
  /** A fala da bolha (`recadoDaBolha`). */
  recado: string;
  humor: HumorDaArte;
  chama: number;
  /** Os avisos do momento (presente, conquista nova, carteira que falhou). */
  avisos?: ReactNode;
  /** A partir da semana 37: a porta para contar o nascimento. */
  nascimento?: ReactNode;
  /** A próxima consulta da agenda (ou o convite para marcar). */
  agenda?: ReactNode;
  aoAbrir: (c: ChaveDoCuidado) => void;
  aoVerJornada: () => void;
  /** O canto direito do topo: a foto dela, que abre o Perfil. */
  direita?: ReactNode;
}) {
  const topo = useSafeAreaInsets().top;
  const ceu = CEUS[ceuDaHora(hora)];
  const bebe = bebeDaSemana(semana);
  const quem = nomeDoBebe ?? "o bebê";
  const feitos = cuidados.filter((c) => c.feito).length;
  const proximo = cuidados.find((c) => !c.feito) ?? null;
  const resto = cuidados.filter((c) => c !== proximo);
  const { pulso, brilho, festa } = useMomentoDoDia(D, feitos, 5, "gestacao", pronto);

  return (
    <View style={{ flex: 1, backgroundColor: FUNDO }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: FUNDO }}
        contentContainerStyle={{ paddingBottom: espaco.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {/* O céu da hora, com o bebê da semana — o herói da tela. */}
        <View style={{ height: 430 + topo, overflow: "hidden" }}>
          <Image
            source={ceu.arte}
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
          <LinearGradient
            colors={["rgba(255,248,245,0)", FUNDO]}
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 120 }}
          />
          {/* O céu se ilumina quando o quinto cuidado se acende. */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              backgroundColor: "#fff7e0",
              opacity: brilho,
            }}
          />
          <View
            style={{
              paddingTop: topo + espaco.lg,
              paddingHorizontal: 20,
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: fonte.titulo,
                  fontSize: 12,
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                  color: ceu.sec,
                }}
              >
                {data}
              </Text>
              <Text
                accessibilityRole="header"
                style={{
                  marginTop: 2,
                  fontFamily: fonte.titulo,
                  fontSize: 31,
                  lineHeight: 37,
                  letterSpacing: -0.5,
                  color: ceu.tinta,
                }}
              >
                {saudacao}
              </Text>
            </View>
            {direita}
          </View>
          <View style={{ alignItems: "center", marginTop: 2 }}>
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <Brilho tamanho={240} />
              <Flutuar>
                <Image
                  source={arteDoBebe(semana)}
                  style={{ width: 186, height: 186 }}
                  contentFit="contain"
                  accessibilityLabel={`${quem} com ${semana} semanas`}
                />
              </Flutuar>
            </View>
            {nomeDoBebe ? (
              <Text style={{ fontFamily: fonte.titulo, fontSize: 22, color: "#2e2348" }}>
                {nomeDoBebe}
              </Text>
            ) : null}
            <Text
              style={{
                marginTop: 2,
                paddingHorizontal: espaco.lg,
                textAlign: "center",
                fontFamily: fonte.forte,
                fontSize: 14,
                color: "#5d4d84",
              }}
            >
              {semana} semanas{dias > 0 ? ` e ${dias} ${dias === 1 ? "dia" : "dias"}` : ""} ·
              tamanho de {bebe.fruit.toLowerCase()}
            </Text>
            <View style={{ flexDirection: "row", gap: espaco.sm, marginTop: 10 }}>
              {faltam != null && faltam > 0 ? (
                <Selo>
                  ⏳ faltam {faltam} {faltam === 1 ? "dia" : "dias"}
                </Selo>
              ) : null}
              <Selo>📏 {bebe.size}</Selo>
            </View>
          </View>
        </View>

        {/* A folha que sobe sobre o céu. */}
        <View
          style={{
            marginTop: -34,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            backgroundColor: FUNDO,
            paddingHorizontal: 18,
            paddingTop: 22,
            gap: espaco.md,
          }}
        >
          {avisos}
          {nascimento}
          <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
            <View style={{ flex: 1 }}>
              <Text
                accessibilityRole="header"
                style={{
                  fontFamily: fonte.titulo,
                  fontSize: 24,
                  letterSpacing: -0.3,
                  color: "#3a2230",
                }}
              >
                O cuidado de hoje
              </Text>
              <Text
                style={{ marginTop: 2, fontFamily: fonte.media, fontSize: 14, color: "#9a7486" }}
              >
                5 minutinhos para você e {quem}
              </Text>
            </View>
            <Animated.View style={{ transform: [{ scale: pulso }] }}>
              <AnelDoDia feitos={feitos} />
            </Animated.View>
          </View>

          {/* A bolha, pequena: a personagem que acompanha, e não a dona da tela. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
            <ArteDaBolha humor={humor} tamanho={58} />
            <View
              style={{
                flex: 1,
                borderRadius: 18,
                borderTopLeftRadius: 6,
                backgroundColor: cor.branco,
                paddingHorizontal: 14,
                paddingVertical: 10,
                ...sombraDe("#b0708d", 0.6),
              }}
            >
              <Text
                style={{ fontFamily: fonte.media, fontSize: 14, lineHeight: 20, color: "#5b3a4a" }}
              >
                {recado}
              </Text>
            </View>
          </View>

          <Entrar key={proximo?.chave ?? "cheio"}>
            {proximo ? (
              <ProximoCuidado c={proximo} aoAbrir={() => aoAbrir(proximo.chave)} />
            ) : (
              <DiaCheio quem={quem} />
            )}
          </Entrar>

          <View style={{ gap: 10 }}>
            {resto.map((c) => (
              <LinhaDoCuidado key={c.chave} c={c} aoAbrir={() => aoAbrir(c.chave)} />
            ))}
          </View>

          {agenda}

          <CompartilharASemana d={cartao} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${chama} dias seguidos. Ver minha jornada`}
            onPress={() => {
              toque();
              aoVerJornada();
            }}
            style={({ pressed }) => ({
              marginTop: espaco.xs,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderRadius: 18,
              backgroundColor: "#fff1e6",
              paddingHorizontal: 14,
              paddingVertical: 13,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: "#8a4d2a" }}>
              {chama > 0 ? (
                <>
                  <Text style={{ fontFamily: fonte.titulo, color: "#c2571a" }}>
                    🔥 {chama} {chama === 1 ? "dia" : "dias"}
                  </Text>{" "}
                  cuidando de vocês
                </>
              ) : (
                "🌱 Sua jornada começa hoje"
              )}
            </Text>
            <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: "#7a3fd1" }}>
              Ver minha jornada ›
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      {festa ? <Confete pecas={60} /> : null}
    </View>
  );
}

export function Selo({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.84)",
        paddingHorizontal: 12,
        paddingVertical: 6,
        ...sombraDe("#504078", 0.5),
      }}
    >
      <Text style={{ fontFamily: fonte.titulo, fontSize: 13, color: "#4a3a6e" }}>{children}</Text>
    </View>
  );
}

/** O anel do dia: uma parte por cuidado (cinco na gestação, três no pós-parto). */
export function AnelDoDia({
  feitos,
  total = 5,
  cor: tinta = "#e8578f",
  vazio = "#f6dbe6",
}: {
  feitos: number;
  total?: number;
  cor?: string;
  vazio?: string;
}) {
  const R = 30;
  const C = 2 * Math.PI * R;
  const seg = C / total;
  const folga = total > 4 ? 5 : 7;
  return (
    <View accessible accessibilityLabel={`${feitos} de ${total} cuidados feitos hoje`}>
      <Svg width={80} height={80}>
        {Array.from({ length: total }, (_, i) => (
          <Circle
            key={i}
            cx={40}
            cy={40}
            r={R}
            fill="none"
            stroke={i < feitos ? tinta : vazio}
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray={`${seg - folga} ${C - seg + folga}`}
            strokeDashoffset={-i * seg}
            transform="rotate(-90 40 40)"
          />
        ))}
        <SvgText
          x={40}
          y={39}
          textAnchor="middle"
          fontFamily={fonte.titulo}
          fontSize={19}
          fill="#4a1f33"
        >
          {`${feitos}/${total}`}
        </SvgText>
        <SvgText
          x={40}
          y={54}
          textAnchor="middle"
          fontFamily={fonte.forte}
          fontSize={9.5}
          fill="#b0708d"
        >
          cuidados
        </SvgText>
      </Svg>
    </View>
  );
}

function ProximoCuidado({ c, aoAbrir }: { c: Cuidado; aoAbrir: () => void }) {
  const d = DESTAQUE[c.chave];
  return (
    <LinearGradient
      colors={[d.de, d.ate]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        borderRadius: 26,
        padding: 16,
        borderBottomWidth: 5,
        borderBottomColor: d.labio,
        ...sombraDe(d.forte, 1),
      }}
    >
      <Image source={ARTE[c.chave]} style={{ width: 84, height: 84 }} contentFit="contain" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            fontFamily: fonte.titulo,
            fontSize: 11,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: d.forte,
          }}
        >
          Próximo cuidado
        </Text>
        <Text style={{ fontFamily: fonte.titulo, fontSize: 19, lineHeight: 24, color: d.tinta }}>
          {c.titulo}
        </Text>
        <Text
          style={{
            fontFamily: fonte.media,
            fontSize: 13,
            lineHeight: 18,
            color: d.tinta,
            opacity: 0.8,
          }}
        >
          {c.sub}
        </Text>
        <View style={{ marginTop: espaco.sm, alignSelf: "flex-start" }}>
          <BotaoDaAtividade cor={d.forte} rotulo="▶  Começar" aoTocar={aoAbrir} />
        </View>
      </View>
    </LinearGradient>
  );
}

function DiaCheio({ quem }: { quem: string }) {
  return (
    <LinearGradient
      colors={["#fff0f6", "#ffe3ee"]}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        borderRadius: 26,
        padding: 16,
        borderBottomWidth: 5,
        borderBottomColor: "#f9c6da",
      }}
    >
      <ArteDaBolha humor="comemorando" tamanho={84} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonte.titulo, fontSize: 20, color: "#7d1d45" }}>
          Dia cheio 💛
        </Text>
        <Text style={{ fontFamily: fonte.media, fontSize: 14, lineHeight: 20, color: "#8a3a5c" }}>
          Os cinco cuidados de hoje estão feitos. {primeiraMaiuscula(quem)} sentiu cada minuto.
        </Text>
      </View>
    </LinearGradient>
  );
}

function LinhaDoCuidado({ c, aoAbrir }: { c: Cuidado; aoAbrir: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${c.titulo}. ${c.feito ? "Feito hoje" : c.sub}`}
      onPress={() => {
        toque();
        aoAbrir();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 13,
        borderRadius: 20,
        backgroundColor: cor.branco,
        paddingVertical: 11,
        paddingLeft: 11,
        paddingRight: 14,
        opacity: pressed ? 0.85 : 1,
        ...sombraDe("#b0708d", 0.6),
      })}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 17,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: FICHA[c.chave],
        }}
      >
        <Image source={ARTE[c.chave]} style={{ width: 44, height: 44 }} contentFit="contain" />
        {c.feito ? (
          <View
            style={{
              position: "absolute",
              right: -5,
              bottom: -5,
              width: 22,
              height: 22,
              borderRadius: 11,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#16a36f",
              borderWidth: 2,
              borderColor: cor.branco,
            }}
          >
            <Text style={{ fontFamily: fonte.titulo, fontSize: 12, color: cor.branco }}>✓</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: fonte.titulo,
            fontSize: 15.5,
            lineHeight: 20,
            color: c.feito ? "#8a7280" : "#3a2230",
          }}
        >
          {c.titulo}
        </Text>
        <Text
          style={{
            marginTop: 1,
            fontFamily: fonte.media,
            fontSize: 13,
            lineHeight: 18,
            color: "#9a7486",
          }}
        >
          {c.feito ? "Feito hoje 💛" : c.sub}
        </Text>
      </View>
      {c.feito ? null : (
        <Text style={{ fontFamily: fonte.titulo, fontSize: 24, color: "#d3b5c4" }}>›</Text>
      )}
    </Pressable>
  );
}

function primeiraMaiuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
