import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Award from "lucide-react-native/icons/award";
import BookOpen from "lucide-react-native/icons/book-open";
import CalendarHeart from "lucide-react-native/icons/calendar-heart";
import Check from "lucide-react-native/icons/check";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Flame from "lucide-react-native/icons/flame";
import House from "lucide-react-native/icons/house";
import Moon from "lucide-react-native/icons/moon";
import Sparkles from "lucide-react-native/icons/sparkles";
import { Fragment, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, Text, View, type ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Botao, selecao, TituloDaSecao, toque, useFimDaRolagem } from "~/componentes/base";
import {
  CEUS,
  ceuDaHora,
  CeuVivo,
  sombraDoTexto,
  useCeuDasAbas,
  type Ceu,
} from "~/componentes/ceu-vivo";
import { Brilho } from "~/componentes/jornada/atividade";
import { rota } from "~/componentes/jornada/bancada";
import { Selo } from "~/componentes/jornada/ceu-do-bebe";
import { AjudaAgora } from "~/componentes/jornada/cuidado";
import type { LeituraDasConquistas } from "~/componentes/jornada/economia";
import { AnelDoDia, ARTE, FICHA, useMomentoDoDia } from "~/componentes/jornada/hoje";
import { RECEM_NASCIDO } from "~/componentes/jornada/nascimento";
import { Confete, Folha } from "~/componentes/jornada/pecas";
import { ArteDaBolha, Flutuar, useParalaxe, type HumorDaArte } from "~/componentes/movimento";
import { Painel, RAIO_DENTRO_DO_PAINEL } from "~/componentes/painel";
import { Vidro } from "~/componentes/vidro";
import { clarear, comAlfa } from "~/lib/cor";
import { montarGrade, paraResgatar, placar } from "~/lib/jornada/conquistas";
import type { FlagsDoDia } from "~/lib/jornada/momentos";
import {
  arrumarODiaDoPos,
  diasDeVoces,
  faseDoPos,
  figurinhaDoPos,
  HUMORES_DO_POS,
  humorPedeApoio,
  nestaSemanaDoPos,
  TAREFAS_DO_POS,
  tarefasFeitas,
  type TarefaDoPos,
} from "~/lib/jornada/pos-parto";
import {
  brilhoDe,
  cor,
  curva,
  escala,
  espaco,
  fonte,
  fonteDoNumero,
  luz,
  ouro,
  sombra,
} from "~/tema";

/**
 * HOJE, NO 4º TRIMESTRE — a mesma tela do cuidado diário, agora com o bebê no
 * colo: o céu da hora, o recém-nascido enrolado na manta (e não mais o feto da
 * semana), e o dia do `PosPartoJourney` do site — TRÊS tarefas que fecham o
 * dia (como você está, o desafio, a leitura da semana) e ganham a figurinha da
 * semana de vida. Respirar, o momento com o bebê e a gratidão ficam "para
 * quando sobrar um minuto": acendem a chama e não cobram nada.
 *
 * 18/11/2026 (a vistoria de design): o pós-parto tinha parado numa versão
 * antiga da tela do bebê — azul-céu do Tailwind, as tintas do creme e vinho,
 * "›" e "✓" escritos, quatro cartões soltos e um botão 3D só para "Ler". Agora
 * segue o desenho da gestação: o número da semana de vida atrás do bebê (com a
 * rolagem em camadas), a próxima tarefa em destaque, o resto numa lista só, a
 * barra que nasce ao rolar, e tudo nas cores do tema.
 *
 * "Triste" no check-in abre o apoio: o CVV (188) e o 192, tocáveis. Sem "fale
 * com o seu médico": o app não encaminha (decisão do dono, 21/10/2026).
 */

export type AtividadeDoPos = "meditation" | "bonding" | "gratitude";

/**
 * Respirar, o bebê e a gratidão. O "Mexer devagar" saiu: no site ele vinha "só
 * se o médico já liberou", e o app não tem médico para liberar exercício no
 * pós-parto (decisão do dono, 21/10/2026).
 */
const ATIVIDADES_DO_POS: readonly AtividadeDoPos[] = ["meditation", "bonding", "gratitude"];

const TEXTO_DA_ATIVIDADE: Record<
  AtividadeDoPos,
  (quem: string) => { titulo: string; sub: string }
> = {
  meditation: () => ({ titulo: "Respirar devagar", sub: "3 minutos para desacelerar" }),
  bonding: (quem) => ({
    titulo: `Um momento com ${quem}`,
    sub: "Conversar baixinho, olho no olho",
  }),
  gratitude: () => ({ titulo: "Guardar uma coisa boa", sub: "Um minuto, e vira lembrança" }),
};

type Icone = ComponentType<{ size?: number; color?: string; strokeWidth?: number; fill?: string }>;

/** A fase com um ícone de traço (o emoji da tabela do site repetia a mamadeira). */
const ICONE_DA_FASE: Record<number, Icone> = { 1: House, 2: Moon, 3: Sparkles };

const FIO = StyleSheet.hairlineWidth;

/** O material dos blocos dentro de um painel: branco com a luz, o fio e a sombra. */
const MATERIAL = {
  borderRadius: RAIO_DENTRO_DO_PAINEL,
  ...curva,
  backgroundColor: luz.cartao,
  borderWidth: FIO,
  borderColor: "rgba(255,255,255,0.9)",
  ...sombra,
} as const;

/** A divisória da lista, alinhada ao texto (14 de margem + 44 da ficha + 12 de vão). */
const RECUO_DA_DIVISORIA = 70;

export function TelaDoQuartoTrimestre({
  D,
  pronto,
  idadeDias,
  semana,
  formou,
  saudacao,
  data,
  hora,
  nomeDoBebe,
  flags,
  humorDeHoje,
  desafio,
  recado,
  chama,
  figurinhas,
  avisos,
  amigas,
  agenda,
  conquistas,
  aoMarcarHumor,
  aoFazerDesafio,
  aoLerASemana,
  aoAbrir,
  aoVerTrilha,
  aoVerAlbum,
  direita,
}: {
  D: number;
  /** A jornada já foi lida do aparelho (`loja.pronto`). */
  pronto: boolean;
  idadeDias: number;
  /** A semana de vida (1–12). */
  semana: number;
  /** Passou das 12 semanas: a jornada do 4º trimestre terminou. */
  formou: boolean;
  saudacao: string;
  data: string;
  hora: number;
  nomeDoBebe: string | null;
  /** As flags do dia de hoje (`dc-path-pos-day-<D>`). */
  flags: FlagsDoDia;
  /** O humor marcado hoje, se já foi. */
  humorDeHoje: string | null;
  desafio: { emoji: string; label: string } | null;
  recado: string;
  chama: number;
  /** Todas as figurinhas: as da gestação e as do 4º trimestre. */
  figurinhas: number;
  avisos?: ReactNode;
  /** As amigas (sem a dupla, que não existe no pós-parto), logo depois das tarefas. */
  amigas?: ReactNode;
  agenda?: ReactNode;
  /** A conferência das conquistas (`useConquistas`): o placar da linha "Conquistas". */
  conquistas?: LeituraDasConquistas | null | "carregando";
  /**
   * @deprecated As conquistas moram na lista "Guardado" (18/11/2026): passe
   * `conquistas`. O que vier aqui não é mais desenhado — era o botão solto das
   * conquistas, o terceiro estilo seguido para três links.
   */
  extra?: ReactNode;
  aoMarcarHumor: (humor: string) => void;
  aoFazerDesafio: () => void;
  aoLerASemana: () => void;
  aoAbrir: (a: AtividadeDoPos) => void;
  aoVerTrilha: () => void;
  aoVerAlbum: () => void;
  /** O canto direito do topo: a foto dela, que abre o Perfil. */
  direita?: ReactNode;
}) {
  const topo = useSafeAreaInsets().top;
  /* Dentro das abas, o céu é o delas (um só, atrás de todas); fora, o seu. */
  const dasAbas = useCeuDasAbas();
  const faseDoCeu = dasAbas?.fase ?? ceuDaHora(hora);
  const ceu = CEUS[faseDoCeu];
  const propria = useParalaxe();
  const quem = nomeDoBebe ?? "o bebê";
  const feitos = tarefasFeitas(flags);
  const total = TAREFAS_DO_POS.length;
  const { pulso, brilho, festa } = useMomentoDoDia(D, feitos, total, "pos", pronto);
  const [semanaAberta, setSemanaAberta] = useState(false);
  const fim = useFimDaRolagem(espaco.xxl);
  const dia = arrumarODiaDoPos(flags, !!desafio);
  const humorDaBolha: HumorDaArte =
    feitos >= total ? "orgulhosa" : humorPedeApoio(humorDeHoje) ? "apaixonado" : "feliz";

  /* A rolagem move as camadas do céu (o número, o bebê) e faz nascer a barra
     de vidro: tudo no fio nativo, sem passar pelo JavaScript a cada quadro. */
  const rolagem = useRef(new Animated.Value(0)).current;
  const lista = useRef<ScrollView>(null);
  const aoRolar = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: rolagem } } }], {
        useNativeDriver: true,
      }),
    [rolagem],
  );
  const [alturaDoCeu, setAlturaDoCeu] = useState(topo + 440);

  return (
    <View style={{ flex: 1, backgroundColor: dasAbas ? "transparent" : ceu.chao }}>
      {/* O céu da hora na tela inteira, como na gestação: o bebê no colo flutua
          sobre ele, e os blocos são painéis soltos. */}
      {dasAbas ? null : <CeuVivo fase={faseDoCeu} rolagem={rolagem} x={propria.x} y={propria.y} />}
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
        <View onLayout={(e) => setAlturaDoCeu(Math.round(e.nativeEvent.layout.height))}>
          <CeuDoColo
            topo={topo}
            ceu={ceu}
            data={data}
            saudacao={saudacao}
            direita={direita}
            nomeDoBebe={nomeDoBebe}
            quem={quem}
            semana={semana}
            idadeDias={idadeDias}
            formou={formou}
            rolagem={rolagem}
          />
        </View>

        {/* Os blocos, soltos sobre o céu. */}
        <View style={{ paddingHorizontal: 12, gap: 14 }}>
          {avisos}

          {formou ? (
            <Formatura quem={quem} />
          ) : (
            <Painel>
              <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
                <View style={{ flex: 1, paddingLeft: 4 }}>
                  <Text
                    accessibilityRole="header"
                    style={{
                      ...fonte.display,
                      ...escala.titulo2,
                      letterSpacing: -0.2,
                      color: cor.texto,
                    }}
                  >
                    O cuidado de hoje
                  </Text>
                  <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}>
                    Três gestos, no seu tempo.
                  </Text>
                </View>
                <Animated.View style={{ transform: [{ scale: pulso }] }}>
                  <AnelDoDia feitos={feitos} total={total} />
                </Animated.View>
              </View>

              {/* A bolha, pequena: a personagem que acompanha. */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
                <ArteDaBolha humor={humorDaBolha} tamanho={58} />
                <View
                  style={{
                    flex: 1,
                    ...MATERIAL,
                    borderTopLeftRadius: 6,
                    paddingHorizontal: 14,
                    paddingVertical: 11,
                  }}
                >
                  <Text style={{ ...fonte.media, ...escala.legenda, color: cor.textoCorpo }}>
                    {recado}
                  </Text>
                </View>
              </View>

              {feitos >= total ? <DiaCompleto semana={semana} /> : null}
              {dia.perguntarHumor ? <ComoVoceEsta aoMarcar={aoMarcarHumor} /> : null}
              {humorPedeApoio(humorDeHoje) ? <Apoio /> : null}

              {dia.destaque === "desafio" && desafio ? (
                <Destaque
                  arte={
                    <Text allowFontScaling={false} style={{ fontSize: 64, lineHeight: 78 }}>
                      {desafio.emoji}
                    </Text>
                  }
                  sobrelinha="O desafio de hoje"
                  titulo={desafio.label}
                  rotulo="Fiz"
                  icone={<Check size={18} color={cor.branco} strokeWidth={3} />}
                  aoTocar={aoFazerDesafio}
                />
              ) : dia.destaque === "leitura" ? (
                <Destaque
                  arte={
                    <Image
                      source={require("../../../../src/assets/grades/timeline.webp")}
                      style={{ width: 104, height: 104 }}
                      contentFit="contain"
                    />
                  }
                  sobrelinha={`Semana ${semana} de vida`}
                  titulo="O que esperar com o bebê"
                  rotulo="Ler"
                  icone={<BookOpen size={18} color={cor.branco} strokeWidth={2.4} />}
                  aoTocar={() => setSemanaAberta(true)}
                />
              ) : null}

              {/* As outras tarefas, numa lista só (e não cartões soltos). */}
              {dia.lista.length ? (
                <View style={{ ...MATERIAL, paddingVertical: 4 }}>
                  {dia.lista.map(({ tarefa, feita }, i) => (
                    <Fragment key={tarefa}>
                      {i > 0 ? <Divisoria /> : null}
                      <LinhaDaTarefa
                        tarefa={tarefa}
                        feita={feita}
                        semana={semana}
                        humorDeHoje={humorDeHoje}
                        desafio={desafio}
                        aoLer={() => setSemanaAberta(true)}
                      />
                    </Fragment>
                  ))}
                </View>
              ) : null}
            </Painel>
          )}

          {amigas}

          <Painel>
            <View style={{ paddingHorizontal: 4 }}>
              <TituloDaSecao>Quando sobrar um minuto</TituloDaSecao>
            </View>
            <View style={{ ...MATERIAL, paddingVertical: 4 }}>
              {ATIVIDADES_DO_POS.map((a, i) => {
                const t = TEXTO_DA_ATIVIDADE[a](quem);
                const feito = !!flags[`w_${a}`];
                return (
                  <Fragment key={a}>
                    {i > 0 ? <Divisoria /> : null}
                    <LinhaDaLista
                      ficha={FICHA[a]}
                      arte={
                        <Image
                          source={ARTE[a]}
                          style={{ width: 38, height: 38 }}
                          contentFit="contain"
                        />
                      }
                      titulo={t.titulo}
                      sub={feito ? "Feito hoje" : t.sub}
                      feito={feito}
                      aoTocar={() => aoAbrir(a)}
                    />
                  </Fragment>
                );
              })}
            </View>
          </Painel>

          {agenda}

          <Guardado
            figurinhas={figurinhas}
            chama={chama}
            conquistas={conquistas}
            aoVerAlbum={aoVerAlbum}
            aoVerTrilha={aoVerTrilha}
          />
        </View>
      </Animated.ScrollView>

      <BarraDoColo
        topo={topo}
        ceu={ceu}
        rolagem={rolagem}
        some={alturaDoCeu - 150}
        semana={semana}
        formou={formou}
        nomeDoBebe={nomeDoBebe}
        feitos={feitos}
        total={total}
        aoTocar={() => lista.current?.scrollTo({ y: 0, animated: true })}
      />
      {festa ? <Confete pecas={60} /> : null}
      <FolhaDaSemana
        aberta={semanaAberta}
        semana={semana}
        lida={!!flags.leitura}
        aoFechar={() => setSemanaAberta(false)}
        aoLer={() => {
          aoLerASemana();
          setSemanaAberta(false);
        }}
      />
    </View>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   O céu: o recém-nascido e o número da semana de vida
   ══════════════════════════════════════════════════════════════════════════ */

/** O lado da arte do recém-nascido. */
const BEBE = 214;
/** O número fica no alto e o bebê embaixo, por cima dele: a parte de cima do
 *  número aparece acima da manta, como o da gestação. */
const ALTURA_DAS_CAMADAS = BEBE + 84;

/**
 * O HERÓI: o bom-dia, o número da semana de vida atrás do bebê e o bebê na
 * manta, em camadas que a rolagem separa — o número anda a 0,4 da rolagem e o
 * bebê a 0,2 (os dois ficam para trás do texto, que anda inteiro). Embaixo, a
 * semana em texto (o número é enfeite: o leitor de tela não o lê) e as duas
 * etiquetas: os dias de vocês e a fase.
 */
function CeuDoColo({
  topo,
  ceu,
  data,
  saudacao,
  direita,
  nomeDoBebe,
  quem,
  semana,
  idadeDias,
  formou,
  rolagem,
}: {
  topo: number;
  ceu: Ceu;
  data: string;
  saudacao: string;
  direita?: ReactNode;
  nomeDoBebe: string | null;
  quem: string;
  semana: number;
  idadeDias: number;
  formou: boolean;
  rolagem: Animated.Value;
}) {
  const sombraDoCeu = sombraDoTexto(ceu);
  const fase = faseDoPos(semana);
  const IconeDaFase = ICONE_DA_FASE[fase.n] ?? Sparkles;
  const camada = (fator: number) =>
    rolagem.interpolate({
      inputRange: [0, 800],
      outputRange: [0, 800 * fator],
      extrapolate: "clamp",
    });
  return (
    <View style={{ paddingBottom: espaco.lg }}>
      <View
        style={{
          paddingTop: topo + espaco.md,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: espaco.sm,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              ...fonte.forte,
              ...escala.nota,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: ceu.sec,
              ...sombraDoCeu,
            }}
          >
            {data}
          </Text>
          <Text
            accessibilityRole="header"
            style={{
              marginTop: 2,
              ...fonte.display,
              ...escala.titulo1,
              letterSpacing: -0.2,
              color: ceu.tinta,
              ...sombraDoCeu,
            }}
          >
            {saudacao}
          </Text>
        </View>
        {direita}
      </View>

      <View style={{ height: ALTURA_DAS_CAMADAS, marginTop: espaco.xs }}>
        {/* 1 · O número da semana de vida, atrás do bebê. */}
        <Animated.View
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: -30,
            alignItems: "center",
            transform: [{ translateY: camada(0.4) }],
          }}
        >
          <Text
            allowFontScaling={false}
            style={{
              ...fonteDoNumero,
              fontSize: 220,
              lineHeight: 228,
              letterSpacing: -10,
              fontVariant: ["tabular-nums"],
              color: ceu.numero,
              textShadowColor: "rgba(70,50,130,0.16)",
              textShadowOffset: { width: 0, height: 8 },
              textShadowRadius: 22,
            }}
          >
            {semana}
          </Text>
        </Animated.View>

        {/* 2 · O bebê na manta, na frente. */}
        <Animated.View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: ALTURA_DAS_CAMADAS - BEBE,
            alignItems: "center",
            justifyContent: "center",
            transform: [{ translateY: camada(0.2) }],
          }}
        >
          <Brilho tamanho={280} />
          <Flutuar>
            <Image
              source={RECEM_NASCIDO}
              style={{ width: BEBE, height: BEBE }}
              contentFit="contain"
              accessibilityLabel={`${quem} numa manta quentinha, nos primeiros dias`}
            />
          </Flutuar>
        </Animated.View>
      </View>

      <View style={{ alignItems: "center", marginTop: espaco.xs }}>
        {nomeDoBebe ? (
          <Text
            style={{
              ...fonte.display,
              ...escala.titulo1,
              letterSpacing: -0.2,
              color: ceu.tinta,
              ...sombraDoCeu,
            }}
          >
            {nomeDoBebe}
          </Text>
        ) : null}
        <Text
          style={{
            paddingHorizontal: espaco.lg,
            textAlign: "center",
            ...fonte.media,
            ...escala.legenda,
            color: ceu.sec,
            ...sombraDoCeu,
          }}
        >
          {formou ? "12 semanas completas" : `Semana ${semana} de vida`}
        </Text>
        <View style={{ flexDirection: "row", gap: espaco.sm, marginTop: 10 }}>
          <Selo icone={<CalendarHeart size={14} color={cor.textoApagado} strokeWidth={2.2} />}>
            {diasDeVoces(idadeDias)}
          </Selo>
          <Selo icone={<IconeDaFase size={14} color={cor.textoApagado} strokeWidth={2.2} />}>
            {fase.name}
          </Selo>
        </View>
      </View>
    </View>
  );
}

/**
 * A BARRA QUE NASCE: quando o céu sai da tela, desce do topo uma cápsula de
 * vidro com o recém-nascido, o nome, a semana de vida e as tarefas do dia; um
 * toque volta ao topo. Desliza (e não esmaece): vidro com transparência
 * animada perde o efeito no meio do caminho.
 */
function BarraDoColo({
  topo,
  ceu,
  rolagem,
  some,
  semana,
  formou,
  nomeDoBebe,
  feitos,
  total,
  aoTocar,
}: {
  topo: number;
  ceu: Ceu;
  rolagem: Animated.Value;
  /** A rolagem em que o céu sai e a barra começa a descer. */
  some: number;
  semana: number;
  formou: boolean;
  nomeDoBebe: string | null;
  feitos: number;
  total: number;
  aoTocar: () => void;
}) {
  const nasce = (de: number, ate: number) =>
    rolagem.interpolate({
      inputRange: [some, some + 90],
      outputRange: [de, ate],
      extrapolate: "clamp",
    });
  const quando = formou ? "12 semanas" : `Semana ${semana} de vida`;
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
          opacity: nasce(0, 1),
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
          transform: [{ translateY: nasce(-(topo + 80), 0) }],
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${nomeDoBebe ?? "O bebê"}, ${quando.toLowerCase()}. ${feitos} de ${total} feitos hoje. Voltar ao topo`}
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
            <Image source={RECEM_NASCIDO} style={{ width: 34, height: 34 }} contentFit="contain" />
            <Text style={{ ...fonte.forte, ...escala.legenda, color: cor.texto }}>
              {nomeDoBebe ?? "O bebê"}
            </Text>
            <Text style={{ ...fonte.media, ...escala.legenda, color: cor.textoApagado }}>
              {quando}
            </Text>
            <View style={{ width: 1, height: 16, backgroundColor: cor.borda }} />
            <Text style={{ ...fonte.titulo, ...escala.legenda, color: cor.primariaEscura }}>
              {feitos}/{total}
            </Text>
          </Vidro>
        </Pressable>
      </Animated.View>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   As peças do dia (no desenho da gestação)
   ══════════════════════════════════════════════════════════════════════════ */

function Divisoria() {
  return (
    <View style={{ height: FIO, marginLeft: RECUO_DA_DIVISORIA, backgroundColor: cor.borda }} />
  );
}

/** O visto de feito: o círculo verde com o traço do lucide (e não "✓" escrito). */
function Visto() {
  return (
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
      <Check size={14} color={cor.branco} strokeWidth={3} />
    </View>
  );
}

/**
 * Uma linha da lista: a ficha de 44 com a arte, o título, a linha de baixo e,
 * à direita, o visto (feito) ou a seta (abre). Sem `aoTocar`, é só leitura.
 */
function LinhaDaLista({
  ficha,
  arte,
  titulo,
  sub,
  feito = false,
  direita,
  rotulo,
  aoTocar,
}: {
  ficha: string;
  arte: ReactNode;
  titulo: string;
  sub: string;
  feito?: boolean;
  /** No lugar da seta (um selo "3 para resgatar"). */
  direita?: ReactNode;
  rotulo?: string;
  aoTocar?: () => void;
}) {
  const corpo = (
    <>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          ...curva,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: ficha,
        }}
      >
        {arte}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={2}
          style={{
            ...fonte.forte,
            ...escala.chamada,
            color: feito ? cor.textoApagado : cor.texto,
          }}
        >
          {titulo}
        </Text>
        <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}>{sub}</Text>
      </View>
      {feito ? (
        <Visto />
      ) : (
        (direita ??
        (aoTocar ? <ChevronRight size={20} color={cor.chevron} strokeWidth={2.4} /> : null))
      )}
    </>
  );
  const estilo = {
    flexDirection: "row",
    alignItems: "center",
    gap: espaco.md,
    minHeight: 64,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 14,
  } as const;
  const leitura = rotulo ?? `${titulo}. ${sub}`;
  if (!aoTocar)
    return (
      <View accessible accessibilityLabel={leitura} style={estilo}>
        {corpo}
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={leitura}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => [estilo, { opacity: pressed ? 0.6 : 1 }]}
    >
      {corpo}
    </Pressable>
  );
}

/** Uma das três tarefas, na lista (a feita, ou a que não é a da vez). */
function LinhaDaTarefa({
  tarefa,
  feita,
  semana,
  humorDeHoje,
  desafio,
  aoLer,
}: {
  tarefa: TarefaDoPos;
  feita: boolean;
  semana: number;
  humorDeHoje: string | null;
  desafio: { emoji: string; label: string } | null;
  aoLer: () => void;
}) {
  if (tarefa === "humor") {
    const h = HUMORES_DO_POS.find((x) => x.label === humorDeHoje);
    return (
      <LinhaDaLista
        ficha={cor.atencaoFundo}
        arte={<Text style={{ fontSize: 24, lineHeight: 30 }}>{h?.emoji ?? "🙂"}</Text>}
        titulo="Como você está hoje"
        sub={humorDeHoje ? `Você disse: ${humorDeHoje.toLowerCase()}` : "Respondido"}
        feito={feita}
      />
    );
  }
  if (tarefa === "desafio") {
    if (!desafio) return null;
    return (
      <LinhaDaLista
        ficha={cor.rosaMarca}
        arte={<Text style={{ fontSize: 24, lineHeight: 30 }}>{desafio.emoji}</Text>}
        titulo={desafio.label}
        sub={feita ? "O desafio de hoje, feito" : "O desafio de hoje"}
        feito={feita}
      />
    );
  }
  return (
    <LinhaDaLista
      ficha={cor.chutesFundo}
      arte={
        <Image
          source={require("../../../../src/assets/grades/timeline.webp")}
          style={{ width: 36, height: 36 }}
          contentFit="contain"
        />
      }
      titulo="O que esperar com o bebê"
      sub={feita ? `Semana ${semana} de vida, lida` : `Semana ${semana} de vida`}
      feito={feita}
      aoTocar={aoLer}
    />
  );
}

/**
 * A TAREFA DA VEZ, em destaque: a arte salta para fora do cartão (passa da
 * borda de cima, com o brilho por trás) e o botão é a framboesa do app.
 */
function Destaque({
  arte,
  sobrelinha,
  titulo,
  rotulo,
  icone,
  aoTocar,
}: {
  arte: ReactNode;
  sobrelinha: string;
  titulo: string;
  rotulo: string;
  icone: ReactNode;
  aoTocar: () => void;
}) {
  return (
    <View
      style={{
        marginTop: 28,
        borderRadius: RAIO_DENTRO_DO_PAINEL,
        ...curva,
        ...brilhoDe(cor.primaria, 0.4),
      }}
    >
      {/* O degradê é o FUNDO, e não o pai: no iPhone ele corta o que passa da
          borda, e a arte precisa passar. */}
      <LinearGradient
        pointerEvents="none"
        colors={[cor.branco, cor.destaque]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: RAIO_DENTRO_DO_PAINEL,
            ...curva,
            borderWidth: FIO,
            borderColor: "rgba(255,255,255,0.95)",
          },
        ]}
      />
      <View
        pointerEvents="none"
        accessible={false}
        style={{
          position: "absolute",
          left: -4,
          top: -34,
          width: 120,
          height: 128,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Brilho tamanho={156} />
        {arte}
      </View>
      <View
        style={{
          minHeight: 144,
          justifyContent: "center",
          gap: 2,
          paddingVertical: 16,
          paddingRight: 14,
          paddingLeft: 116,
        }}
      >
        <Text
          style={{
            ...fonte.forte,
            ...escala.nota,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: cor.primariaEscura,
          }}
        >
          {sobrelinha}
        </Text>
        <Text style={{ ...fonte.forte, ...escala.titulo3, color: cor.texto }}>{titulo}</Text>
        <Botao
          rotulo={rotulo}
          icone={icone}
          aoTocar={aoTocar}
          estilo={{ alignSelf: "flex-start", marginTop: espaco.md }}
        />
      </View>
    </View>
  );
}

/** O check-in de humor: a primeira das três tarefas. Respondido, vira uma linha. */
function ComoVoceEsta({ aoMarcar }: { aoMarcar: (humor: string) => void }) {
  return (
    <View style={{ ...MATERIAL, padding: espaco.md, gap: espaco.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
        <Image
          source={require("../../../../src/assets/grades/humor.webp")}
          style={{ width: 44, height: 44 }}
          contentFit="contain"
          accessible={false}
        />
        <View style={{ flex: 1 }}>
          <Text
            accessibilityRole="header"
            style={{ ...fonte.forte, ...escala.manchete, color: cor.texto }}
          >
            Como você está hoje?
          </Text>
          <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}>
            O seu bem-estar conta tanto quanto o do bebê.
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: espaco.xs }}>
        {HUMORES_DO_POS.map((h) => (
          <Pressable
            key={h.label}
            accessibilityRole="button"
            accessibilityLabel={`Estou ${h.label.toLowerCase()}`}
            onPress={() => {
              selecao();
              aoMarcar(h.label);
            }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 68,
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              borderRadius: 14,
              ...curva,
              backgroundColor: cor.apagado,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
          >
            <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 24, lineHeight: 30 }}>
              {h.emoji}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              maxFontSizeMultiplier={1.3}
              style={{ ...fonte.media, ...escala.nota, color: cor.texto }}
            >
              {h.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** O apoio: aparece quando ela diz que está triste. Sem alarme, com caminho. */
function Apoio() {
  return (
    <View
      style={{
        borderRadius: RAIO_DENTRO_DO_PAINEL,
        ...curva,
        backgroundColor: cor.rosaMarca,
        padding: 14,
        gap: 2,
      }}
    >
      <Text style={{ ...fonte.forte, ...escala.manchete, color: cor.textoDestaque }}>
        Você não está sozinha
      </Text>
      <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoCorpo }}>
        Dias assim acontecem. A qualquer hora, o CVV escuta, de graça.
      </Text>
      <View
        style={{
          marginTop: espaco.sm,
          borderRadius: 14,
          ...curva,
          backgroundColor: luz.cartao,
          paddingHorizontal: espaco.md,
        }}
      >
        <AjudaAgora />
      </View>
    </View>
  );
}

/** O dia cheio, no desenho do da gestação: a figurinha da semana de vida em destaque. */
function DiaCompleto({ semana }: { semana: number }) {
  return (
    <LinearGradient
      colors={[clarear(cor.rosaMarca, 0.55), cor.rosaMarca]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        borderRadius: RAIO_DENTRO_DO_PAINEL,
        ...curva,
        padding: 16,
        borderWidth: FIO,
        borderColor: "rgba(255,255,255,0.95)",
        ...brilhoDe(cor.primaria, 0.35),
      }}
    >
      <View style={{ width: 76, height: 76, alignItems: "center", justifyContent: "center" }}>
        <Brilho tamanho={110} />
        <Text allowFontScaling={false} style={{ fontSize: 52, lineHeight: 62 }}>
          {figurinhaDoPos(semana)}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            ...fonte.display,
            ...escala.titulo2,
            letterSpacing: -0.2,
            color: cor.textoDestaque,
          }}
        >
          Dia completo
        </Text>
        <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoDestaque }}>
          A figurinha da semana {semana} de vida é sua. Descanse quando der.
        </Text>
      </View>
    </LinearGradient>
  );
}

/** As 12 semanas completas: a trilha e o álbum ficam. */
function Formatura({ quem }: { quem: string }) {
  return (
    <Painel estilo={{ alignItems: "center", paddingVertical: espaco.xl, gap: espaco.sm }}>
      <Text allowFontScaling={false} style={{ fontSize: 52, lineHeight: 62 }}>
        {figurinhaDoPos(12)}
      </Text>
      <Text
        accessibilityRole="header"
        style={{
          textAlign: "center",
          ...fonte.display,
          ...escala.titulo2,
          letterSpacing: -0.2,
          color: cor.texto,
        }}
      >
        As 12 semanas estão completas
      </Text>
      <Text
        style={{
          textAlign: "center",
          paddingHorizontal: espaco.md,
          ...fonte.normal,
          ...escala.legenda,
          color: cor.textoCorpo,
        }}
      >
        Você e {quem} atravessaram as 12 primeiras semanas. A trilha e o álbum ficam guardados aqui.
      </Text>
    </Painel>
  );
}

/**
 * GUARDADO: o álbum, as conquistas e a trilha numa lista só. Antes eram três
 * estilos seguidos para três links (o cartão do álbum com "Ver ›" escrito, o
 * botão das conquistas e a faixa azul da trilha).
 */
function Guardado({
  figurinhas,
  chama,
  conquistas,
  aoVerAlbum,
  aoVerTrilha,
}: {
  figurinhas: number;
  chama: number;
  conquistas?: LeituraDasConquistas | null | "carregando";
  aoVerAlbum: () => void;
  aoVerTrilha: () => void;
}) {
  const resumo = useMemo(() => {
    if (!conquistas || conquistas === "carregando") return null;
    const g = montarGrade(conquistas.unlocked, conquistas.resgatadas);
    return { ...placar(g, true), resgatar: paraResgatar(g) };
  }, [conquistas]);
  const subDasConquistas =
    conquistas === "carregando"
      ? "Conferindo…"
      : resumo
        ? `${resumo.feitas} de ${resumo.total} desbloqueadas`
        : "Os emblemas de vocês";
  return (
    <Painel>
      <View style={{ paddingHorizontal: 4 }}>
        <TituloDaSecao>Guardado</TituloDaSecao>
      </View>
      <View style={{ ...MATERIAL, paddingVertical: 4 }}>
        <LinhaDaLista
          ficha={cor.rosaMarca}
          arte={
            <Image
              source={require("../../../../src/assets/bebe/album.webp")}
              style={{ width: 36, height: 36 }}
              contentFit="contain"
            />
          }
          titulo="O álbum de vocês"
          sub={`${figurinhas} ${figurinhas === 1 ? "figurinha" : "figurinhas"}, da gestação ao 4º trimestre`}
          rotulo={`Abrir o álbum de vocês. ${figurinhas} ${figurinhas === 1 ? "figurinha" : "figurinhas"}`}
          aoTocar={aoVerAlbum}
        />
        <Divisoria />
        <LinhaDaLista
          ficha={cor.jogoFundo}
          arte={<Award size={22} color={cor.jogo} strokeWidth={2.2} />}
          titulo="Conquistas"
          sub={subDasConquistas}
          rotulo={
            resumo
              ? `Conquistas: ${resumo.feitas} de ${resumo.total}${resumo.resgatar ? `, ${resumo.resgatar} para resgatar` : ""}`
              : "Conquistas"
          }
          direita={
            resumo && resumo.resgatar > 0 ? (
              <View
                style={{
                  borderRadius: 999,
                  backgroundColor: cor.primaria,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ ...fonte.forte, ...escala.nota, color: cor.branco }}>
                  {resumo.resgatar} para resgatar
                </Text>
              </View>
            ) : undefined
          }
          aoTocar={() => router.push(rota("/jornada/recompensas?aba=conquistas") as never)}
        />
        <Divisoria />
        <LinhaDaLista
          ficha={cor.atencaoFundo}
          arte={<Flame size={22} color={cor.atencao} fill={ouro.medio} strokeWidth={2} />}
          titulo="Trilha"
          sub={
            chama > 0
              ? `${chama} ${chama === 1 ? "dia" : "dias"} cuidando de vocês`
              : "As 12 semanas de vida, dia a dia"
          }
          rotulo={
            chama > 0
              ? `${chama} ${chama === 1 ? "dia" : "dias"} seguidos. Ver a trilha do 4º trimestre`
              : "Ver a trilha do 4º trimestre"
          }
          aoTocar={aoVerTrilha}
        />
      </View>
    </Painel>
  );
}

/** O texto da semana — a terceira tarefa. "Li" é o que a marca. */
function FolhaDaSemana({
  aberta,
  semana,
  lida,
  aoFechar,
  aoLer,
}: {
  aberta: boolean;
  semana: number;
  lida: boolean;
  aoFechar: () => void;
  aoLer: () => void;
}) {
  return (
    <Folha aberta={aberta} aoFechar={aoFechar}>
      <View style={{ gap: espaco.sm, paddingTop: espaco.xs }}>
        <Text
          style={{
            ...fonte.forte,
            ...escala.nota,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: cor.textoApagado,
          }}
        >
          Semana {semana} de vida
        </Text>
        <Text
          accessibilityRole="header"
          style={{ ...fonte.display, ...escala.titulo2, letterSpacing: -0.2, color: cor.texto }}
        >
          O que esperar com o bebê
        </Text>
        <Text style={{ ...fonte.normal, ...escala.corpo, color: cor.textoCorpo }}>
          {nestaSemanaDoPos(semana)}
        </Text>
      </View>
      {lida ? (
        <Botao rotulo="Fechar" tipo="secundario" tamanho="grande" aoTocar={aoFechar} />
      ) : (
        <Botao
          rotulo="Li"
          tamanho="grande"
          icone={<Check size={18} color={cor.branco} strokeWidth={3} />}
          aoTocar={aoLer}
        />
      )}
    </Folha>
  );
}
