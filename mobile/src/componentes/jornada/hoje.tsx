import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronRight, Flame, Play, Sprout } from "lucide-react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { toque, useFimDaRolagem } from "~/componentes/base";
import { Vidro } from "~/componentes/vidro";
import { Brilho } from "~/componentes/jornada/atividade";
import { CEUS, ceuDaHora, CeuVivo, useCeuDasAbas, type Ceu } from "~/componentes/ceu-vivo";
import { Painel } from "~/componentes/painel";
import { ALTURA_DO_CEU, CeuDoBebe } from "~/componentes/jornada/ceu-do-bebe";
import {
  ArteDaBolha,
  Flutuar,
  Inclinacao3D,
  useMovimentoReduzido,
  useParalaxe,
  type HumorDaArte,
} from "~/componentes/movimento";
import { CompartilharASemana, type DadosDoCartao } from "~/componentes/jornada/cartao-da-semana";
import { Confete } from "~/componentes/jornada/pecas";
import { parametroDaBancada } from "~/lib/bancada";
import { arteDoBebe } from "~/componentes/jornada/arte-do-bebe";
import { clarear, comAlfa } from "~/lib/cor";
import type { ChaveDoCuidado, Cuidado } from "~/lib/jornada/hoje";
import { aperto, cor, curva, espaco, fonte, luz, sombra } from "~/tema";

export { Selo } from "~/componentes/jornada/ceu-do-bebe";
/* O céu da hora mora em `ceu-vivo.tsx` (é também o fundo da entrada); o
   pós-parto ainda o importa daqui. */
export { CEUS, ceuDaHora } from "~/componentes/ceu-vivo";

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
  meditation: "#f1eaff",
  bonding: "#ffe9ef",
  gratitude: "#fff6d6",
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

/** A névoa da paleta: o fundo do pós-parto, que ainda tem a folha sobre o céu. */
export const FUNDO = cor.fundo;

/* As tintas da folha: a ameixa da paleta, e um degrau mais suave para o texto corrido. */
const TINTA = {
  titulo: cor.texto,
  corpo: "#463d63",
  apagado: cor.textoApagado,
  link: cor.primariaEscura,
} as const;

const FIO = StyleSheet.hairlineWidth;

/** O material dos cartões da folha: branco, com o fio de luz e a sombra em camadas. */
const MATERIAL = {
  backgroundColor: luz.cartao,
  borderWidth: FIO,
  borderColor: "rgba(255,255,255,0.9)",
  ...curva,
  ...sombra,
} as const;

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
  acompanhamento,
  amigas,
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
  /** O acompanhamento da semana (peso, frase, data provável, semana a semana,
   * movimentos), logo abaixo do céu: o bebê é o centro da tela (13/11/2026). */
  acompanhamento?: ReactNode;
  /** As amigas e a dupla, logo depois do cuidado do dia (fase 3). */
  amigas?: ReactNode;
  /** A próxima consulta da agenda (ou o convite para marcar). */
  agenda?: ReactNode;
  aoAbrir: (c: ChaveDoCuidado) => void;
  aoVerJornada: () => void;
  /** O canto direito do topo: a foto dela, que abre o Perfil. */
  direita?: ReactNode;
}) {
  const topo = useSafeAreaInsets().top;
  /* Dentro das abas o céu é o delas (um só, atrás de todas): a tela fica
     transparente e lê dele a fase e a inclinação do celular. Fora, o seu. */
  const dasAbas = useCeuDasAbas();
  const fase = dasAbas?.fase ?? ceuDaHora(hora);
  const ceu = CEUS[fase];
  const quem = nomeDoBebe ?? "o bebê";
  const feitos = cuidados.filter((c) => c.feito).length;
  const proximo = cuidados.find((c) => !c.feito) ?? null;
  const resto = cuidados.filter((c) => c !== proximo);
  const { pulso, brilho, festa } = useMomentoDoDia(D, feitos, 5, "gestacao", pronto);
  const fim = useFimDaRolagem(espaco.xxl);
  /* A rolagem e a inclinação do celular movem as camadas (o céu, o número, o
     bebê) e fazem nascer a barra de vidro do topo: tudo no fio nativo, sem
     passar pelo JavaScript a cada quadro. */
  const rolagem = useRef(new Animated.Value(0)).current;
  const propria = useParalaxe();
  const { x, y } = dasAbas ?? propria;
  const lista = useRef<ScrollView>(null);
  const aoRolar = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: rolagem } } }], {
        useNativeDriver: true,
      }),
    [rolagem],
  );

  return (
    <View style={{ flex: 1, backgroundColor: dasAbas ? "transparent" : ceu.chao }}>
      {/* O CÉU DA HORA É A TELA INTEIRA: fica parado atrás da rolagem, vivo, e
          tudo o mais flutua sobre ele (16/11/2026). */}
      {dasAbas ? null : <CeuVivo fase={fase} rolagem={rolagem} x={x} y={y} />}
      {/* O céu se ilumina quando o quinto cuidado se acende. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: "#fff7e0", opacity: brilho }]}
      />

      <Animated.ScrollView
        ref={lista}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: fim }}
        showsVerticalScrollIndicator={false}
        onScroll={aoRolar}
        scrollEventThrottle={16}
      >
        {/* O bebê da semana no céu — o herói da tela. */}
        <CeuDoBebe
          topo={topo}
          ceu={ceu}
          data={data}
          saudacao={saudacao}
          direita={direita}
          semana={semana}
          dias={dias}
          nomeDoBebe={nomeDoBebe}
          faltam={faltam}
          rolagem={rolagem}
          x={x}
          y={y}
        />

        {/* Os painéis, soltos sobre o céu. */}
        <View style={{ paddingHorizontal: 12, paddingTop: 6, gap: 14 }}>
          {avisos}
          {nascimento}
          {acompanhamento ? (
            <Entrar atraso={80}>
              <Painel>{acompanhamento}</Painel>
            </Entrar>
          ) : null}

          <Entrar atraso={160}>
            <Painel>
              <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
                <View style={{ flex: 1 }}>
                  <Text
                    accessibilityRole="header"
                    style={{
                      ...fonte.titulo,
                      fontSize: 26,
                      lineHeight: 31,
                      letterSpacing: aperto.titulo,
                      color: TINTA.titulo,
                    }}
                  >
                    O cuidado de hoje
                  </Text>
                  <Text
                    style={{ marginTop: 2, ...fonte.media, fontSize: 15, color: TINTA.apagado }}
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
                    borderRadius: 20,
                    borderTopLeftRadius: 6,
                    paddingHorizontal: 14,
                    paddingVertical: 11,
                    ...MATERIAL,
                  }}
                >
                  <Text
                    style={{ ...fonte.media, fontSize: 15, lineHeight: 21, color: TINTA.corpo }}
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

              {/* Os outros cuidados, numa lista só (e não quatro cartões soltos). */}
              {resto.length ? (
                <View style={{ borderRadius: 26, paddingVertical: 4, ...MATERIAL }}>
                  {resto.map((c, i) => (
                    <View key={c.chave}>
                      {i > 0 ? (
                        <View style={{ height: FIO, marginLeft: 82, backgroundColor: cor.borda }} />
                      ) : null}
                      <LinhaDoCuidado c={c} aoAbrir={() => aoAbrir(c.chave)} />
                    </View>
                  ))}
                </View>
              ) : null}
            </Painel>
          </Entrar>

          {amigas}

          {agenda}

          <CompartilharASemana d={cartao} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${chama} dias seguidos. Ver a trilha`}
            onPress={() => {
              toque();
              aoVerJornada();
            }}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <LinearGradient
              colors={["#fff0e3", "#ffe6ef"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: espaco.sm,
                borderRadius: 22,
                ...curva,
                paddingHorizontal: 16,
                paddingVertical: 15,
              }}
            >
              {chama > 0 ? (
                <Flame size={20} color="#e2560f" fill="#ff9d4d" strokeWidth={2} />
              ) : (
                <Sprout size={20} color="#15803d" strokeWidth={2.2} />
              )}
              <Text style={{ flex: 1, ...fonte.media, fontSize: 15, color: "#7a4324" }}>
                {chama > 0 ? (
                  <>
                    <Text style={{ ...fonte.titulo, color: "#c2571a" }}>
                      {chama} {chama === 1 ? "dia" : "dias"}
                    </Text>{" "}
                    cuidando de vocês
                  </>
                ) : (
                  "Sua jornada começa hoje"
                )}
              </Text>
              <Text style={{ ...fonte.forte, fontSize: 15, color: TINTA.link }}>Ver a trilha</Text>
              <ChevronRight size={18} color={TINTA.link} strokeWidth={2.4} />
            </LinearGradient>
          </Pressable>
        </View>
      </Animated.ScrollView>

      <BarraQueNasce
        topo={topo}
        ceu={ceu}
        rolagem={rolagem}
        semana={semana}
        nomeDoBebe={nomeDoBebe}
        feitos={feitos}
        aoTocar={() => lista.current?.scrollTo({ y: 0, animated: true })}
      />
      {festa ? <Confete pecas={60} /> : null}
    </View>
  );
}

/**
 * A BARRA QUE NASCE: quando o céu sai da tela, desce do topo uma cápsula de
 * vidro com o bebê, o nome, a semana e os cuidados do dia — o que o céu dizia
 * continua à vista, e um toque nela volta ao topo. Ela desliza (e não aparece
 * esmaecendo): vidro com transparência animada perde o efeito no meio do caminho.
 */
function BarraQueNasce({
  topo,
  ceu,
  rolagem,
  semana,
  nomeDoBebe,
  feitos,
  aoTocar,
}: {
  topo: number;
  ceu: Ceu;
  rolagem: Animated.Value;
  semana: number;
  nomeDoBebe: string | null;
  feitos: number;
  aoTocar: () => void;
}) {
  const some = ALTURA_DO_CEU + topo - 190;
  return (
    <>
      {/* Com o bebê fora da tela, o topo se desfaz na cor do alto do céu: o que
          rola não passa por baixo do relógio do iPhone. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: topo + 64,
          opacity: rolagem.interpolate({
            inputRange: [some, some + 90],
            outputRange: [0, 1],
            extrapolate: "clamp",
          }),
        }}
      >
        <LinearGradient
          colors={[ceu.topo, comAlfa(ceu.topo, 0.85), comAlfa(ceu.topo, 0)]}
          locations={[0, 0.5, 1]}
          style={{ flex: 1 }}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: topo + 4,
          left: 0,
          right: 0,
          alignItems: "center",
          transform: [
            {
              translateY: rolagem.interpolate({
                inputRange: [some, some + 90],
                outputRange: [-(topo + 80), 0],
                extrapolate: "clamp",
              }),
            },
          ],
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${nomeDoBebe ?? "O bebê"}, ${semana} semanas. ${feitos} de 5 cuidados feitos hoje. Voltar ao topo`}
          onPress={() => {
            toque();
            aoTocar();
          }}
        >
          <Vidro
            interativo
            estilo={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingLeft: 6,
              paddingRight: 14,
              paddingVertical: 5,
            }}
          >
            <Image
              source={arteDoBebe(semana)}
              style={{ width: 34, height: 34 }}
              contentFit="contain"
            />
            <Text style={{ ...fonte.titulo, fontSize: 15, color: TINTA.titulo }}>
              {nomeDoBebe ?? "O bebê"}
            </Text>
            <Text style={{ ...fonte.media, fontSize: 14, color: TINTA.apagado }}>
              {semana} semanas
            </Text>
            <View style={{ width: 1, height: 16, backgroundColor: cor.borda }} />
            <Text style={{ ...fonte.titulo, fontSize: 14, color: TINTA.link }}>{feitos}/5</Text>
          </Vidro>
        </Pressable>
      </Animated.View>
    </>
  );
}

/** O anel do dia: uma parte por cuidado (cinco na gestação, três no pós-parto). */
export function AnelDoDia({
  feitos,
  total = 5,
  cor: tinta = cor.primaria,
  vazio = cor.destaque,
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
          fontFamily={fonte.titulo.fontFamily}
          fontWeight={fonte.titulo.fontWeight}
          fontSize={19}
          fill={TINTA.titulo}
        >
          {`${feitos}/${total}`}
        </SvgText>
        <SvgText
          x={40}
          y={54}
          textAnchor="middle"
          fontFamily={fonte.forte.fontFamily}
          fontWeight={fonte.forte.fontWeight}
          fontSize={9.5}
          fill={TINTA.apagado}
        >
          cuidados
        </SvgText>
      </Svg>
    </View>
  );
}

/**
 * O PRÓXIMO CUIDADO, em destaque: o objeto da atividade SALTA para fora do
 * cartão (passa da borda de cima, com o brilho por trás), e o cartão inteiro
 * inclina com o celular e com o dedo (`Inclinacao3D`). O cartão é o botão: o
 * "Começar" é só o desenho dele, para o leitor de tela não ler dois botões.
 */
function ProximoCuidado({ c, aoAbrir }: { c: Cuidado; aoAbrir: () => void }) {
  const d = DESTAQUE[c.chave];
  return (
    <Inclinacao3D
      raio={30}
      aoTocar={aoAbrir}
      rotuloAcessivel={`Próximo cuidado: ${c.titulo}. ${c.sub}. Começar`}
      estiloDeFora={{ marginTop: 30 }}
      estilo={{
        boxShadow: `0px 2px 4px ${comAlfa(d.forte, 0.06)}, 0px 22px 40px -18px ${comAlfa(d.forte, 0.5)}`,
      }}
    >
      {/* O degradê é o FUNDO, e não o pai: no iPhone ele corta o que passa da
          borda, e o objeto precisa passar. */}
      <LinearGradient
        pointerEvents="none"
        colors={[clarear(d.de, 0.35), d.ate]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: 30,
            ...curva,
            borderWidth: FIO,
            borderColor: "rgba(255,255,255,0.95)",
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: -4,
          top: -38,
          width: 132,
          height: 138,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Brilho tamanho={170} />
        <Flutuar amplitude={4} periodo={3800}>
          <Image source={ARTE[c.chave]} style={{ width: 134, height: 134 }} contentFit="contain" />
        </Flutuar>
      </View>
      <View
        style={{
          minHeight: 150,
          justifyContent: "center",
          paddingVertical: 18,
          paddingRight: 14,
          paddingLeft: 124,
        }}
      >
        <Text
          style={{
            ...fonte.titulo,
            fontSize: 11,
            letterSpacing: 1.3,
            textTransform: "uppercase",
            color: d.forte,
          }}
        >
          Próximo cuidado
        </Text>
        <Text
          style={{
            marginTop: 2,
            ...fonte.titulo,
            fontSize: 22,
            lineHeight: 26,
            letterSpacing: aperto.subtitulo,
            color: d.tinta,
          }}
        >
          {c.titulo}
        </Text>
        <Text
          style={{
            marginTop: 2,
            ...fonte.media,
            fontSize: 14,
            lineHeight: 19,
            color: d.tinta,
            opacity: 0.8,
          }}
        >
          {c.sub}
        </Text>
        <View
          style={{
            marginTop: espaco.md,
            alignSelf: "flex-start",
            borderRadius: 999,
            boxShadow: `0px 10px 20px -8px ${comAlfa(d.forte, 0.7)}`,
          }}
        >
          <LinearGradient
            colors={[clarear(d.forte, 0.14), d.forte]}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
              minHeight: 44,
              borderRadius: 999,
              ...curva,
              paddingLeft: 16,
              paddingRight: 20,
            }}
          >
            <Play size={15} color={cor.branco} fill={cor.branco} />
            <Text style={{ ...fonte.titulo, fontSize: 16, color: cor.branco }}>Começar</Text>
          </LinearGradient>
        </View>
      </View>
    </Inclinacao3D>
  );
}

function DiaCheio({ quem }: { quem: string }) {
  return (
    <LinearGradient
      colors={["#fff3f8", "#ffe1ec"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        borderRadius: 30,
        ...curva,
        padding: 18,
        borderWidth: FIO,
        borderColor: "rgba(255,255,255,0.95)",
        boxShadow: `0px 22px 40px -18px ${comAlfa(cor.primaria, 0.45)}`,
      }}
    >
      <ArteDaBolha humor="comemorando" tamanho={88} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            ...fonte.titulo,
            fontSize: 22,
            letterSpacing: aperto.subtitulo,
            color: cor.textoDestaque,
          }}
        >
          Dia cheio 💛
        </Text>
        <Text style={{ ...fonte.media, fontSize: 15, lineHeight: 21, color: "#8a3a5c" }}>
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
        gap: 14,
        paddingVertical: 10,
        paddingLeft: 12,
        paddingRight: 14,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          ...curva,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: FICHA[c.chave],
        }}
      >
        <Image source={ARTE[c.chave]} style={{ width: 46, height: 46 }} contentFit="contain" />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            ...fonte.forte,
            fontSize: 16,
            lineHeight: 21,
            color: c.feito ? TINTA.apagado : TINTA.titulo,
          }}
        >
          {c.titulo}
        </Text>
        <Text
          style={{
            marginTop: 1,
            ...fonte.media,
            fontSize: 13.5,
            lineHeight: 18,
            color: TINTA.apagado,
          }}
        >
          {c.feito ? "Feito hoje 💛" : c.sub}
        </Text>
      </View>
      {c.feito ? (
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#12a06c",
          }}
        >
          <Check size={15} color={cor.branco} strokeWidth={3.2} />
        </View>
      ) : (
        <ChevronRight size={20} color="#c3bad6" strokeWidth={2.4} />
      )}
    </Pressable>
  );
}

function primeiraMaiuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
