import { Image } from "expo-image";
import { useScrollToTop } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronRight, Flame, Play } from "lucide-react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import {
  Sobrelinha,
  sucesso,
  TituloDaSecao,
  Tocavel,
  toque,
  useFimDaRolagem,
  useFolgaDaBarra,
} from "~/componentes/base";
import { Vidro } from "~/componentes/vidro";
import { Brilho } from "~/componentes/jornada/atividade";
import { CEUS, ceuDaHora, CeuVivo, useCeuDasAbas, type Ceu } from "~/componentes/ceu-vivo";
import { Painel, RAIO_DENTRO_DO_PAINEL } from "~/componentes/painel";
import { CeuDoBebe, SaudacaoNoCeu, useAlturaDoCeu } from "~/componentes/jornada/ceu-do-bebe";
import { GrupoDeAtalhos } from "~/componentes/jornada/atalhos";
import { corJornada, corDaAtividade } from "~/componentes/jornada/cores";
import {
  ArteDaBolha,
  useMovimentoReduzido,
  useParalaxe,
  type HumorDaArte,
} from "~/componentes/movimento";
import { CompartilharASemana, type DadosDoCartao } from "~/componentes/jornada/cartao-da-semana";
import { Confete } from "~/componentes/jornada/pecas";
import { parametroDaBancada } from "~/lib/bancada";
import { arteDoBebe } from "~/componentes/jornada/arte-do-bebe";
import { clarear, comAlfa, escurecer } from "~/lib/cor";
import type { ChaveDoCuidado, Cuidado } from "~/lib/jornada/hoje";
import { cor, curva, escala, espaco, fonte, luz, margem, ouro, sombra } from "~/tema";

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
 * um anel de cinco partes se fecha ao longo do dia.
 *
 * 18/11/2026 (a vistoria): um produto só do começo ao fim. O céu fica com a
 * emoção e a chama (que abre a Trilha); o acompanhamento e o cuidado do dia
 * vêm em painéis; e a metade de baixo, que eram cinco cartões soltos de cinco
 * cores, vira UM grupo de atalhos no material do app (`atalhos.tsx`).
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

/**
 * A ficha de cada cuidado, na cor da atividade (`cores.ts`). A aula é do
 * violeta do jogo, por fora e por dentro (18/11/2026: era laranja aqui e
 * violeta ao abrir, e o toque parecia levar a outro lugar).
 */
export const FICHA: Record<ChaveDoCuidado, string> = {
  aula: corJornada.roxoFundo,
  movement: corDaAtividade.mexer.luz,
  meditation: corDaAtividade.meditar.luz,
  bonding: corDaAtividade.carta.luz,
  gratitude: corDaAtividade.gratidao.luz,
};

/* O destaque do "próximo cuidado", na cor da atividade — lida de `cores.ts`
   (`corDaAtividade`, a paleta do Amanhecer das atividades), e não repetida à
   mão: a névoa clara da atividade em cima, a cor de agir no botão. */
function destaqueDa(p: { luz: string; acao: string }) {
  return { de: clarear(p.luz, 0.55), ate: p.luz, forte: p.acao, tinta: escurecer(p.acao, 0.3) };
}
const DESTAQUE: Record<ChaveDoCuidado, { de: string; ate: string; forte: string; tinta: string }> =
  {
    aula: {
      de: corJornada.roxoNevoa,
      ate: corJornada.roxoFundo,
      forte: corJornada.roxo,
      tinta: corJornada.roxoEscuro,
    },
    movement: destaqueDa(corDaAtividade.mexer),
    meditation: destaqueDa(corDaAtividade.meditar),
    bonding: destaqueDa(corDaAtividade.carta),
    gratitude: destaqueDa(corDaAtividade.gratidao),
  };

/** A névoa da paleta: o fundo do pós-parto, que ainda tem a folha sobre o céu. */
export const FUNDO = cor.fundo;

const FIO = StyleSheet.hairlineWidth;

/** O material dos blocos dentro de um painel: branco, com o fio de luz e a sombra em camadas. */
const MATERIAL = {
  backgroundColor: luz.cartao,
  borderWidth: FIO,
  borderColor: comAlfa(cor.branco, 0.9),
  ...curva,
  ...sombra,
} as const;

/** Quantos cuidados a tela já mostrou feitos, por dia — neste processo. */
const vistosPorDia = new Map<string, number>();

/**
 * O instante em que um cuidado se acende: ela volta da atividade e a tela
 * reage — o anel pulsa, o celular vibra, e o quinto solta o confete, uma vez.
 * Ao ABRIR o app nada festeja: o que já estava feito é estado, não
 * acontecimento — e "abrir" inclui o instante em que a jornada ainda não foi
 * lida do aparelho (`pronto`): contar com o blob vazio fazia a abertura
 * festejar o que já estava feito. (`&animar=1` na bancada finge o último.)
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
    if (fechou) sucesso();
    else toque(false);
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

/** O que cobre o pé da tela nas abas (a barra flutuante), no mínimo. */
const PE_DAS_ABAS = 96;

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
  reguaUsada = false,
  avisos,
  nascimento,
  acompanhamento,
  lembrete,
  amigas,
  agenda,
  aoAbrir,
  aoVerTrilha,
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
  /** Ela já arrastou a régua do céu: a dica não aparece mais. */
  reguaUsada?: boolean;
  /** Os avisos do momento (presente, conquista nova, carteira que falhou). */
  avisos?: ReactNode;
  /** A partir da semana 37: a porta para contar o nascimento (a primeira linha do grupo). */
  nascimento?: ReactNode;
  /** O acompanhamento da semana (peso, frase, data provável, semana a semana,
   * movimentos), logo abaixo do céu: o bebê é o centro da tela (13/11/2026). */
  acompanhamento?: ReactNode;
  /** O convite para o lembrete do cuidado (um cartão, acima do grupo). */
  lembrete?: ReactNode;
  /** As amigas: uma LINHA do grupo de atalhos. */
  amigas?: ReactNode;
  /** A próxima consulta da agenda: uma LINHA do grupo de atalhos. */
  agenda?: ReactNode;
  /** Abre um cuidado (estável: as linhas não se redesenham à toa). */
  aoAbrir: (c: ChaveDoCuidado) => void;
  /** A chama do céu abre a Trilha (estável). */
  aoVerTrilha: () => void;
  /** O canto direito do topo: a foto dela, que abre o Perfil (estável). */
  direita?: ReactNode;
}) {
  const topo = useSafeAreaInsets().top;
  const altura = useAlturaDoCeu(topo, Math.max(PE_DAS_ABAS, useFolgaDaBarra()));
  /* Dentro das abas o céu é o delas (um só, atrás de todas): a tela fica
     transparente e lê dele a fase e a inclinação do celular. Fora, o seu. */
  const dasAbas = useCeuDasAbas();
  const fase = dasAbas?.fase ?? ceuDaHora(hora);
  const ceu = CEUS[fase];
  const quem = nomeDoBebe ?? "o bebê";
  const feitos = cuidados.filter((c) => c.feito).length;
  const proximo = cuidados.find((c) => !c.feito) ?? null;
  /* O que falta primeiro, o feito depois: o olho lê antes o que ainda pede. */
  const resto = [
    ...cuidados.filter((c) => !c.feito && c !== proximo),
    ...cuidados.filter((c) => c.feito),
  ];
  const { pulso, festa } = useMomentoDoDia(D, feitos, 5, "gestacao", pronto);
  const fim = useFimDaRolagem(espaco.xxl);
  /* A rolagem e a inclinação do celular movem as camadas (o céu, o número, o
     bebê) e fazem nascer a barra de vidro do topo: tudo no fio nativo, sem
     passar pelo JavaScript a cada quadro. */
  const rolagem = useRef(new Animated.Value(0)).current;
  const propria = useParalaxe();
  const { x, y } = dasAbas ?? propria;
  const lista = useRef<ScrollView>(null);
  /* Tocar de novo na aba já aberta volta ao topo (a barra emite o `tabPress`). */
  useScrollToTop(lista);
  const aoRolar = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: rolagem } } }], {
        useNativeDriver: true,
      }),
    [rolagem],
  );

  /* Onde começa "O cuidado de hoje": a barra que nasce leva até ele. */
  const yDosPaineis = useRef(0);
  const yDoCuidado = useRef(0);
  const irAoCuidado = useCallback(
    () =>
      lista.current?.scrollTo({
        y: Math.max(0, yDosPaineis.current + yDoCuidado.current - topo - 64),
        animated: true,
      }),
    [topo],
  );

  /* O alto do céu não muda a cada leitura que chega: o herói não se redesenha. */
  const cabecalho = useMemo(
    () => (
      <SaudacaoNoCeu
        topo={topo}
        ceu={ceu}
        data={data}
        saudacao={saudacao}
        chama={chama}
        aoVerTrilha={aoVerTrilha}
        direita={direita}
      />
    ),
    [topo, ceu, data, saudacao, chama, aoVerTrilha, direita],
  );

  return (
    <View style={{ flex: 1, backgroundColor: dasAbas ? "transparent" : ceu.chao }}>
      {/* O CÉU DA HORA É A TELA INTEIRA: fica parado atrás da rolagem, vivo, e
          tudo o mais flutua sobre ele (16/11/2026). */}
      {dasAbas ? null : <CeuVivo fase={fase} rolagem={rolagem} x={x} y={y} />}

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
          altura={altura}
          ceu={ceu}
          semana={semana}
          dias={dias}
          nomeDoBebe={nomeDoBebe}
          faltam={faltam}
          rolagem={rolagem}
          x={x}
          y={y}
          reguaUsada={reguaUsada}
          cabecalho={cabecalho}
        />

        {/* Os painéis, soltos sobre o céu, na margem da saudação. */}
        <View
          onLayout={(e: LayoutChangeEvent) => {
            yDosPaineis.current = e.nativeEvent.layout.y;
          }}
          style={{ paddingHorizontal: margem.tela, paddingTop: 6, gap: 14 }}
        >
          {avisos}
          {acompanhamento ? (
            <Entrar atraso={80}>
              <Painel>{acompanhamento}</Painel>
            </Entrar>
          ) : null}

          <View
            onLayout={(e: LayoutChangeEvent) => {
              yDoCuidado.current = e.nativeEvent.layout.y;
            }}
          >
            <Entrar atraso={160}>
              <Painel>
                <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <TituloDaSecao>O cuidado de hoje</TituloDaSecao>
                    <Text style={{ ...fonte.media, ...escala.legenda, color: cor.textoCorpo }}>
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
                      borderRadius: RAIO_DENTRO_DO_PAINEL,
                      borderTopLeftRadius: 6,
                      paddingHorizontal: 14,
                      paddingVertical: 11,
                      ...MATERIAL,
                    }}
                  >
                    <Text style={{ ...fonte.media, ...escala.legenda, color: cor.textoCorpo }}>
                      {recado}
                    </Text>
                  </View>
                </View>

                <Entrar key={proximo?.chave ?? "cheio"}>
                  {proximo ? <ProximoCuidado c={proximo} aoAbrir={aoAbrir} /> : <DiaCheio />}
                </Entrar>

                {/* Os outros cuidados, numa lista só (e não quatro cartões soltos). */}
                {resto.length ? (
                  <View
                    style={{ borderRadius: RAIO_DENTRO_DO_PAINEL, paddingVertical: 4, ...MATERIAL }}
                  >
                    {resto.map((c, i) => (
                      <View key={c.chave}>
                        {i > 0 ? (
                          <View
                            style={{ height: FIO, marginLeft: 82, backgroundColor: cor.borda }}
                          />
                        ) : null}
                        <LinhaDoCuidado c={c} aoAbrir={aoAbrir} />
                      </View>
                    ))}
                  </View>
                ) : null}
              </Painel>
            </Entrar>
          </View>

          {/* A metade de baixo num grupo só: o convite do lembrete e as portas. */}
          <Entrar atraso={240}>
            <Painel>
              {lembrete}
              <GrupoDeAtalhos>
                {nascimento}
                {amigas}
                {agenda}
                <CompartilharASemana d={cartao} />
              </GrupoDeAtalhos>
            </Painel>
          </Entrar>
        </View>
      </Animated.ScrollView>

      <BarraQueNasce
        topo={topo}
        altura={altura}
        ceu={ceu}
        rolagem={rolagem}
        semana={semana}
        nomeDoBebe={nomeDoBebe}
        feitos={feitos}
        chama={chama}
        aoTocar={irAoCuidado}
      />
      {festa ? <Confete pecas={60} /> : null}
    </View>
  );
}

/**
 * A BARRA QUE NASCE: quando o céu sai da tela, desce do topo uma cápsula de
 * vidro com o bebê, o nome, a semana, a chama e os cuidados do dia — o que o
 * céu dizia continua à vista, e um toque nela leva ao cuidado de hoje. Ela
 * desliza (e não aparece esmaecendo): vidro com transparência animada perde o
 * efeito no meio do caminho.
 */
function BarraQueNasce({
  topo,
  altura,
  ceu,
  rolagem,
  semana,
  nomeDoBebe,
  feitos,
  chama,
  aoTocar,
}: {
  topo: number;
  /** A altura do céu desta tela (`useAlturaDoCeu`). */
  altura: number;
  ceu: Ceu;
  rolagem: Animated.Value;
  semana: number;
  nomeDoBebe: string | null;
  feitos: number;
  chama: number;
  aoTocar: () => void;
}) {
  const some = altura + topo - 190;
  const estilos = useMemo(
    () => ({
      veu: {
        opacity: rolagem.interpolate({
          inputRange: [some, some + 90],
          outputRange: [0, 1],
          extrapolate: "clamp",
        }),
      },
      desce: {
        transform: [
          {
            translateY: rolagem.interpolate({
              inputRange: [some, some + 90],
              outputRange: [-(topo + 80), 0],
              extrapolate: "clamp",
            }),
          },
        ],
      },
    }),
    [rolagem, some, topo],
  );
  return (
    <>
      {/* Com o bebê fora da tela, o topo se desfaz na cor do alto do céu: o que
          rola não passa por baixo do relógio do iPhone. */}
      <Animated.View
        pointerEvents="none"
        style={[
          { position: "absolute", top: 0, left: 0, right: 0, height: topo + 64 },
          estilos.veu,
        ]}
      >
        <LinearGradient
          colors={[ceu.topo, comAlfa(ceu.topo, 0.85), comAlfa(ceu.topo, 0)]}
          locations={[0, 0.5, 1]}
          style={{ flex: 1 }}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="box-none"
        style={[
          { position: "absolute", top: topo + 4, left: 0, right: 0, alignItems: "center" },
          estilos.desce,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${nomeDoBebe ?? "O bebê"}, ${semana} semanas. ${chama} ${chama === 1 ? "dia seguido" : "dias seguidos"}. ${feitos} de 5 cuidados feitos hoje. Ir para o cuidado de hoje`}
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
              minHeight: 44,
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
            <Text style={{ ...fonte.forte, ...escala.legenda, color: cor.texto }}>
              {nomeDoBebe ?? "O bebê"}
            </Text>
            <Text style={{ ...fonte.media, ...escala.legenda, color: cor.textoApagado }}>
              {semana} semanas
            </Text>
            <View style={{ width: FIO * 2, height: 16, backgroundColor: cor.borda }} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Flame
                size={15}
                color={chama > 0 ? corJornada.chama : cor.textoApagado}
                fill={chama > 0 ? ouro.medio : "transparent"}
                strokeWidth={2.2}
              />
              <Text
                style={{
                  ...fonte.titulo,
                  ...escala.legenda,
                  fontVariant: ["tabular-nums"],
                  color: cor.texto,
                }}
              >
                {chama}
              </Text>
            </View>
            <View style={{ width: FIO * 2, height: 16, backgroundColor: cor.borda }} />
            <Text
              style={{
                ...fonte.titulo,
                ...escala.legenda,
                fontVariant: ["tabular-nums"],
                color: cor.primariaEscura,
              }}
            >
              {feitos}/5
            </Text>
          </Vidro>
        </Pressable>
      </Animated.View>
    </>
  );
}

/**
 * O anel do dia: uma parte por cuidado (cinco na gestação, três no pós-parto).
 * Dentro, só o "2/5" (a palavra "cuidados", em 9,5 pt, encostava no traço; ela
 * mora no rótulo do leitor de tela).
 */
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
          y={47}
          textAnchor="middle"
          fontFamily={fonte.titulo.fontFamily}
          fontWeight={fonte.titulo.fontWeight}
          fontSize={20}
          fill={cor.texto}
        >
          {`${feitos}/${total}`}
        </SvgText>
      </Svg>
    </View>
  );
}

/**
 * O PRÓXIMO CUIDADO, em destaque: o objeto da atividade SALTA para fora do
 * cartão (passa da borda de cima, com o brilho por trás). O cartão é o botão,
 * e afunda de leve com o dedo (a mola do `Tocavel`); o "Começar" é só o
 * desenho dele, para o leitor de tela não ler dois botões.
 *
 * Não inclina mais com o celular nem flutua (18/11/2026): a paralaxe é do
 * herói, e só dele — um cartão de lista que balança briga com a rolagem.
 */
const ProximoCuidado = memo(function ProximoCuidado({
  c,
  aoAbrir,
}: {
  c: Cuidado;
  aoAbrir: (c: ChaveDoCuidado) => void;
}) {
  const d = DESTAQUE[c.chave];
  return (
    <Tocavel
      aoTocar={() => aoAbrir(c.chave)}
      rotulo={`Próximo cuidado: ${c.titulo}. ${c.sub}. Começar`}
      estilo={{
        marginTop: 30,
        borderRadius: RAIO_DENTRO_DO_PAINEL,
        ...curva,
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
            borderRadius: RAIO_DENTRO_DO_PAINEL,
            ...curva,
            borderWidth: FIO,
            borderColor: comAlfa(cor.branco, 0.95),
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
        <Image source={ARTE[c.chave]} style={{ width: 134, height: 134 }} contentFit="contain" />
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
        <Sobrelinha tinta={d.forte}>Próximo cuidado</Sobrelinha>
        <Text
          style={{
            marginTop: 2,
            ...fonte.display,
            ...escala.titulo2,
            letterSpacing: -0.2,
            color: d.tinta,
          }}
        >
          {comEspacoFirme(c.titulo)}
        </Text>
        <Text
          style={{
            marginTop: 2,
            ...fonte.media,
            ...escala.legenda,
            color: d.tinta,
          }}
        >
          {comEspacoFirme(c.sub)}
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
            <Text style={{ ...fonte.forte, ...escala.chamada, color: cor.branco }}>Começar</Text>
          </LinearGradient>
        </View>
      </View>
    </Tocavel>
  );
});

function DiaCheio() {
  return (
    <LinearGradient
      colors={[clarear(cor.rosaMarca, 0.5), cor.rosaMarca]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        borderRadius: RAIO_DENTRO_DO_PAINEL,
        ...curva,
        padding: 18,
        borderWidth: FIO,
        borderColor: comAlfa(cor.branco, 0.95),
        boxShadow: `0px 22px 40px -18px ${comAlfa(cor.primaria, 0.45)}`,
      }}
    >
      <ArteDaBolha humor="comemorando" tamanho={88} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            ...fonte.display,
            ...escala.titulo2,
            letterSpacing: -0.2,
            color: cor.textoDestaque,
          }}
        >
          Dia cheio
        </Text>
        <Text style={{ ...fonte.media, ...escala.legenda, color: cor.textoDestaque }}>
          {comEspacoFirme("Você fez os cinco cuidados de hoje. Amanhã tem aula nova.")}
        </Text>
      </View>
    </LinearGradient>
  );
}

const LinhaDoCuidado = memo(function LinhaDoCuidado({
  c,
  aoAbrir,
}: {
  c: Cuidado;
  aoAbrir: (c: ChaveDoCuidado) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${c.titulo}. ${c.feito ? "Feito hoje" : c.sub}`}
      onPress={() => {
        toque();
        aoAbrir(c.chave);
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
            ...escala.chamada,
            color: c.feito ? cor.textoApagado : cor.texto,
          }}
        >
          {comEspacoFirme(c.titulo)}
        </Text>
        <Text
          style={{
            marginTop: 1,
            ...fonte.normal,
            ...escala.legenda,
            color: cor.textoApagado,
          }}
        >
          {c.feito ? "Feito hoje" : comEspacoFirme(c.sub)}
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
            backgroundColor: cor.ok,
          }}
        >
          <Check size={15} color={cor.branco} strokeWidth={3.2} />
        </View>
      ) : (
        <ChevronRight size={18} color={cor.chevron} strokeWidth={2.4} />
      )}
    </Pressable>
  );
});

/**
 * A última palavra não fica sozinha na linha de baixo ("Aprender sobre a
 * semana / 24"): o último espaço vira um espaço que não quebra. A frase de
 * `lib/jornada/hoje.ts` não muda; só o desenho dela.
 */
function comEspacoFirme(titulo: string): string {
  return titulo.replace(/ (\S+)$/, " $1");
}
