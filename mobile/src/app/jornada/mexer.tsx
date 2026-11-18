import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import {
  BatteryLow,
  BedDouble,
  Hand,
  Phone,
  Play,
  SkipForward,
  Sparkles,
  Zap,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  AppState,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { Movimento } from "@/lib/exercicios";
import { toque } from "~/componentes/base";
import {
  BolhaComBalao,
  BotaoDaAtividade,
  BotaoDaVoz,
  BotaoDoControle,
  Brilho,
  CarregandoAtividade,
  ControlesDaSessao,
  Escolha,
  fecharAtividade,
  Ficha,
  FOLGA_DO_RODAPE,
  FOLGA_DOS_CONTROLES,
  FundoDaAtividade,
  materialDe,
  RodapeDaAtividade,
  Secao,
  Segmentos,
  SobrelinhaDaAtividade,
  sombraDe,
  Superficie,
  TituloDaAtividade,
  TopoDaAtividade,
  TrocaDeEtapa,
} from "~/componentes/jornada/atividade";
import { corDaAtividade } from "~/componentes/jornada/cores";
import { FiguraMovimento } from "~/componentes/jornada/figura-movimento";
import { concluirMomento, FimDoMomento, type Desfecho } from "~/componentes/jornada/fim";
import { useAtividade } from "~/componentes/jornada/usarJornada";
import { pararVozes, tocarVoz } from "~/lib/audio/voz";
import { VOZ_REGRAVADA } from "~/lib/audio/regravadas";
import { VOZ_DO_MOVIMENTO } from "~/lib/audio/vozes";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import {
  DURACAO_PADRAO,
  DURACOES_MEXER,
  inicioDoProximo,
  linhaDoTempo,
  montarSessao,
  narracaoNoApp,
  posicaoNoTempo,
  temChaoParaTirar,
  type DuracaoMexer,
  type Trecho,
} from "~/lib/jornada/mexer";
import { ALVO_MINIMO, canto, cor, curva, escala, espaco, fonte, luz, margem, sombra } from "~/tema";
import { pedirSocorro, ROTULO_DO_SOCORRO } from "~/lib/socorro";
import { SOS_NO_APP } from "~/config";

/**
 * MEXER — a sessão montada pela régua do site (`sessaoDoDia`): pela fase da
 * gestação, pela energia de hoje e pelo tempo que ela tem, numa descida só de
 * posições.
 *
 * ⚠️ 21/10/2026, decisão do dono (rede social + gamificação, não conselho
 * médico): o Mexer escolhe por HUMOR e TEMPO, não por queixa. Antes ela
 * marcava a dor ("Dor nas costas", "Azia", "Mão dormente"), a sessão virava
 * tratamento, e o "Melhorou / Piorou" ia para o diário "para o médico ver".
 * Agora ela diz se está com energia ou cansada — "cansada" puxa os movimentos
 * mais leves do catálogo, o mesmo que o site chama de "Só cansaço" — e nada
 * vai para o diário. A lista de sinais de parada virou uma linha que abre o
 * SOS, o único lugar com sinais de alerta.
 *
 * A sessão é a do app antigo: a FIGURA demonstrando cada movimento dentro do
 * anel que conta o tempo, e a VOZ gravada lendo o nome e a dica ao entrar em
 * cada um — ela olha para o próprio corpo, não para o celular. Movimento sem
 * gravação anda em silêncio (os passos estão escritos), nunca com a voz errada.
 *
 * SEM RELÓGIO NO JS (18/11/2026, a vistoria): a sessão redesenhava a tela
 * inteira quatro vezes por segundo, e o anel andava aos trancos. Agora o
 * estado só muda nas FRONTEIRAS (um `setTimeout` para o fim de cada
 * movimento), o anel esvazia no motor nativo e só o número dos segundos se
 * redesenha, uma vez por segundo.
 *
 * Bancada: /jornada/mexer?bancada=1 [&etapa=sessao|fazendo|fim|feita] [&luto=1]
 *          [&semana=38] [&energia=cansada] [&minutos=2|5|10] [&semchao=1] [&t=<segundos da sessão>]
 */

const PALETA = corDaAtividade.mexer;
const MATERIAL = materialDe(PALETA);

/** O tapete de yoga, nas artes 3D do app — no lugar do 💪 no fim da sessão. */
const ARTE_DO_FIM = require("../../../../src/assets/grades/exercicios.webp");

/** A energia de hoje — e só ela, nunca uma queixa. */
type Energia = "com-energia" | "cansada";
const ENERGIAS: readonly { chave: Energia; icone: typeof Zap; rotulo: string }[] = [
  { chave: "com-energia", icone: Zap, rotulo: "Com energia" },
  { chave: "cansada", icone: BatteryLow, rotulo: "Cansada" },
];

const ehUmaDuracao = (n: number): n is DuracaoMexer =>
  (DURACOES_MEXER as readonly number[]).includes(n);

type Etapa = "escolha" | "sessao" | "fim";

export default function Mexer() {
  const at = useAtividade("movement");
  const [minutos, setMinutos] = useState<DuracaoMexer>(DURACAO_PADRAO);
  const [energia, setEnergia] = useState<Energia | null>(null);
  const [semChao, setSemChao] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>("escolha");
  /* A sequência nasce no "Começar", e não do desenho: derivada, ela mudaria
     debaixo dela se o dia virasse no meio da sessão. */
  const [seqDaSessao, setSeqDaSessao] = useState<Movimento[]>([]);
  const [desfecho, setDesfecho] = useState<Desfecho | null>(null);
  const [aplicouBancada, setAplicouBancada] = useState(false);
  const [inicioDaBancada, setInicioDaBancada] = useState(0);

  const temChao = at.pronto
    ? temChaoParaTirar({ semana: at.semana, posParto: at.pos, cuidado: at.cuidado })
    : false;

  const seq = useMemo(
    () =>
      at.pronto
        ? montarSessao({
            D: at.D ?? new Date().getDate(),
            minutos,
            semana: at.semana,
            posParto: at.pos,
            cuidado: at.cuidado,
            /* "Cansada" é o "Só cansaço" do catálogo: puxa os movimentos mais
               leves. Com energia, a sessão do dia, girando pelo dia. */
            sintoma: energia === "cansada" ? "cansaco" : null,
            semChao: temChao && semChao,
          })
        : [],
    [at.pronto, at.D, minutos, at.semana, at.pos, at.cuidado, energia, semChao, temChao],
  );

  useEffect(() => {
    if (aplicouBancada || !at.pronto || !ehBancada()) return;
    setAplicouBancada(true);
    const e0 = parametroDaBancada("energia");
    if (e0 === "cansada" || e0 === "com-energia") setEnergia(e0);
    const m = Number(parametroDaBancada("minutos"));
    if (ehUmaDuracao(m)) setMinutos(m);
    if (parametroDaBancada("semchao") === "1") setSemChao(true);
    setInicioDaBancada(Math.max(0, Number(parametroDaBancada("t") ?? 0) || 0));
    const e = parametroDaBancada("etapa");
    if (e === "sessao" || e === "fazendo") {
      setSeqDaSessao(seq);
      setEtapa("sessao");
    }
    if (e === "fim") {
      setEtapa("fim");
      setDesfecho({
        ganhou: at.cuidado ? null : 5,
        fechou: false,
        bonus: null,
        semPagamento: at.cuidado,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at.pronto, at.cuidado, aplicouBancada]);

  function comecar() {
    if (!seq.length) return;
    setSeqDaSessao(seq);
    setDesfecho(null);
    setEtapa("sessao");
  }

  /* Do fim do último movimento direto para a festa: a tela-ponte "Terminou!",
     só com a bolha e um "Continuar", era sobra do "Melhorou / Piorou" que saiu
     em 21/10. O fim já diz "Somando as suas sementinhas…" enquanto paga. */
  const terminar = useCallback(async () => {
    setEtapa("fim");
    if (!at.uid) return;
    setDesfecho(
      await concluirMomento({
        uid: at.uid,
        D: at.D,
        momento: "movement",
        cuidado: at.cuidado,
        pos: at.pos,
      }),
    );
  }, [at.uid, at.D, at.cuidado, at.pos]);

  if (!at.pronto) return <CarregandoAtividade paleta={PALETA} />;

  return (
    <FundoDaAtividade paleta={PALETA}>
      <TrocaDeEtapa chave={etapa}>
        {etapa === "sessao" ? (
          <Sessao seq={seqDaSessao} inicio={inicioDaBancada} aoTerminar={terminar} />
        ) : etapa === "fim" ? (
          <>
            <TopoDaAtividade />
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: margem.tela, paddingBottom: espaco.xxl }}
            >
              <FimDoMomento
                titulo="Corpo soltinho"
                fala={
                  at.cuidado ? "Você cuidou de você hoje." : "Você cuidou de você e do bebê hoje."
                }
                desfecho={desfecho}
                D={at.D}
                cuidado={at.cuidado}
                pos={at.pos}
                arte={
                  <View style={{ alignItems: "center", justifyContent: "center" }}>
                    <Brilho tamanho={200} tinta={PALETA.luz} />
                    <Image
                      source={ARTE_DO_FIM}
                      accessibilityIgnoresInvertColors
                      style={{ width: 132, height: 132 }}
                    />
                  </View>
                }
                confete
              />
            </ScrollView>
          </>
        ) : (
          <Abertura
            fala={
              at.jaFeita
                ? "Você já se mexeu hoje! Pode fazer de novo, se o corpo pedir."
                : at.cuidado
                  ? "Movimentos leves, sem ir ao chão. No seu ritmo."
                  : "Me diga como está a sua energia e quanto tempo você tem, que eu monto a sequência."
            }
            titulo={at.cuidado ? "Mexer devagar" : "Mexer o corpo"}
            energia={energia}
            aoEscolherEnergia={(e) => setEnergia((x) => (x === e ? null : e))}
            minutos={minutos}
            aoEscolherMinutos={setMinutos}
            temChao={temChao}
            semChao={semChao}
            aoTrocarChao={() => setSemChao((v) => !v)}
          />
        )}
      </TrocaDeEtapa>
      {etapa === "escolha" ? (
        <RodapeDaAtividade>
          <BotaoDaAtividade
            cor={PALETA.acao}
            luz={PALETA.luz}
            rotulo={`Começar · ${minutos} min`}
            icone={<Play size={18} color={cor.branco} fill={cor.branco} />}
            aoTocar={comecar}
            desabilitado={!seq.length}
          />
        </RodapeDaAtividade>
      ) : null}
    </FundoDaAtividade>
  );
}

function Abertura({
  fala,
  titulo,
  energia,
  aoEscolherEnergia,
  minutos,
  aoEscolherMinutos,
  temChao,
  semChao,
  aoTrocarChao,
}: {
  fala: string;
  titulo: string;
  energia: Energia | null;
  aoEscolherEnergia: (e: Energia) => void;
  minutos: DuracaoMexer;
  aoEscolherMinutos: (m: DuracaoMexer) => void;
  temChao: boolean;
  semChao: boolean;
  aoTrocarChao: () => void;
}) {
  return (
    <>
      <TopoDaAtividade />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: margem.foco,
          paddingTop: espaco.xs,
          paddingBottom: FOLGA_DO_RODAPE + espaco.lg,
        }}
      >
        <BolhaComBalao lado humor="exercicio" fala={fala} />
        <TituloDaAtividade>{titulo}</TituloDaAtividade>

        <Secao topo={espaco.xl}>Como está a sua energia?</Secao>
        <View style={{ flexDirection: "row", gap: espaco.sm }}>
          {ENERGIAS.map((e) => {
            const ativa = energia === e.chave;
            const Icone = e.icone;
            return (
              <Escolha
                key={e.chave}
                paleta={PALETA}
                ativa={ativa}
                aoTocar={() => aoEscolherEnergia(e.chave)}
                rotulo={e.rotulo}
                estilo={{ flex: 1 }}
              >
                <Icone size={18} color={ativa ? cor.branco : PALETA.acao} strokeWidth={2.2} />
              </Escolha>
            );
          })}
        </View>

        <Secao>De quanto tempo você tem?</Secao>
        <View style={{ flexDirection: "row", gap: espaco.sm }}>
          {DURACOES_MEXER.map((m) => (
            <Escolha
              key={m}
              paleta={PALETA}
              ativa={minutos === m}
              aoTocar={() => aoEscolherMinutos(m)}
              rotulo={`${m} min`}
              centro
              estilo={{ flex: 1 }}
            />
          ))}
        </View>
        {/* Só aparece quando há chão a tirar: a partir da 37ª semana, no
            pós-parto e no Modo Cuidado a régua já o tirou sozinha. */}
        {temChao ? <SemChao ligado={semChao} aoTocar={aoTrocarChao} /> : null}

        {/* Sinal de alerta mora num lugar só: o SOS (21/10/2026). Aqui, uma
            linha que leva até ele — ou ao 192, com o SOS desligado. Ela LIGA,
            e por isso tem o telefone, e não a seta de quem navega. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sentiu algo estranho? Pare. ${ROTULO_DO_SOCORRO}`}
          onPress={() => {
            toque();
            pedirSocorro();
          }}
          style={({ pressed }) => ({
            marginTop: 28,
            minHeight: ALVO_MINIMO + 8,
            flexDirection: "row",
            alignItems: "center",
            gap: espaco.md,
            borderRadius: canto.dentro,
            ...curva,
            backgroundColor: cor.atencaoClaro,
            paddingHorizontal: espaco.lg,
            paddingVertical: espaco.sm,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ flex: 1, ...fonte.normal, ...escala.legenda, color: cor.atencaoTexto }}>
            Sentiu algo estranho?{" "}
            <Text style={{ ...fonte.forte }}>
              {SOS_NO_APP ? "Pare e abra o SOS." : "Pare e, se precisar, ligue 192."}
            </Text>
          </Text>
          <Ficha fundo={cor.atencaoFundo} tamanho={34}>
            <Phone size={17} color={cor.atencaoTexto} strokeWidth={2.2} />
          </Ficha>
        </Pressable>

        <Text
          style={{
            marginTop: espaco.lg,
            ...fonte.normal,
            ...escala.nota,
            color: cor.textoApagado,
          }}
        >
          Vá no seu ritmo e pule o que não for confortável para você.
        </Text>
      </ScrollView>
    </>
  );
}

/**
 * "Hoje eu não desço ao chão" — cama de hospital, repouso, o tapete que não
 * existe. É um liga-desliga, e por isso tem a cara de um: o interruptor do
 * iPhone, e não um botão que muda de cor.
 */
function SemChao({ ligado, aoTocar }: { ligado: boolean; aoTocar: () => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: ligado }}
      accessibilityLabel="Hoje eu não desço ao chão"
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        marginTop: espaco.lg,
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        minHeight: 64,
        paddingHorizontal: espaco.md,
        paddingVertical: espaco.sm,
        borderRadius: canto.dentro,
        ...curva,
        backgroundColor: luz.cartao,
        opacity: pressed ? 0.85 : 1,
        ...sombra,
      })}
    >
      <Ficha fundo={MATERIAL.ficha}>
        <BedDouble size={18} color={PALETA.acao} strokeWidth={2.2} />
      </Ficha>
      <View style={{ flex: 1 }}>
        <Text style={{ ...fonte.forte, ...escala.legenda, color: cor.texto }}>
          Hoje eu não desço ao chão
        </Text>
        <Text style={{ ...fonte.normal, ...escala.nota, color: cor.textoApagado }}>
          Na cama, no sofá ou de pé, sem tapete
        </Text>
      </View>
      {/* O toque é da linha inteira; o interruptor só mostra o estado. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Switch
          value={ligado}
          trackColor={{ false: cor.trilho, true: PALETA.acao }}
          thumbColor={cor.branco}
          ios_backgroundColor={cor.trilho}
        />
      </View>
    </Pressable>
  );
}

function MantemAcesa() {
  useKeepAwake("dc-mexer");
  return null;
}

/* ── O anel que conta o tempo, no motor nativo ────────────────────────── */

const ANEL = 208;
/** O palco claro em volta do anel. */
const PALCO = 240;
const GROSSURA = 12;
const RAIO = ANEL / 2 - 4 - GROSSURA / 2;
const C = ANEL / 2;

/**
 * O ANEL do app antigo: começa cheio e esvazia com o tempo do movimento. Era
 * um traço SVG redesenhado pelo relógio do JS (aos trancos, a cada 250 ms).
 * Agora são duas meias-luas que GIRAM dentro de duas metades recortadas — giro
 * é transformação, e transformação anda no motor nativo, liso, sem o JS. As
 * pontas redondas são dois pingos: um parado no alto, um que anda com a ponta.
 */
function Anel({ resta }: { resta: Animated.Value }) {
  const giroDireita = resta.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["0deg", "180deg", "180deg"],
  });
  const giroEsquerda = resta.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["0deg", "0deg", "180deg"],
  });
  /* Vazio é vazio: no zero, nem o pingo do alto aparece. */
  const temAlgo = resta.interpolate({
    inputRange: [0, 0.004, 1],
    outputRange: [0, 1, 1],
    extrapolate: "clamp",
  });
  /* A metade esquerda só existe da metade do tempo para cima (o pingo dela
     ficaria parado embaixo, sozinho). */
  const passouDaMetade = resta.interpolate({
    inputRange: [0, 0.5, 0.505, 1],
    outputRange: [0, 0, 1, 1],
    extrapolate: "clamp",
  });
  const meia = (lado: "esquerda" | "direita") => (
    <Svg width={ANEL} height={ANEL}>
      <Path
        d={`M${C} ${C - RAIO} A${RAIO} ${RAIO} 0 0 ${lado === "esquerda" ? 0 : 1} ${C} ${C + RAIO}`}
        stroke={PALETA.acao}
        strokeWidth={GROSSURA}
        fill="none"
      />
      <Circle
        cx={C}
        cy={lado === "esquerda" ? C - RAIO : C + RAIO}
        r={GROSSURA / 2}
        fill={PALETA.acao}
      />
    </Svg>
  );
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={{ position: "absolute", width: ANEL, height: ANEL }}
    >
      <Svg width={ANEL} height={ANEL} style={{ position: "absolute" }}>
        <Circle cx={C} cy={C} r={RAIO} stroke={PALETA.luz} strokeWidth={GROSSURA} fill="none" />
      </Svg>
      <Animated.View style={{ position: "absolute", width: ANEL, height: ANEL, opacity: temAlgo }}>
        {/* A metade direita (do alto até embaixo): a meia-lua da esquerda girando para dentro dela. */}
        <View
          style={{
            position: "absolute",
            left: C,
            top: 0,
            width: C,
            height: ANEL,
            overflow: "hidden",
          }}
        >
          <Animated.View
            style={{
              position: "absolute",
              left: -C,
              top: 0,
              width: ANEL,
              height: ANEL,
              transform: [{ rotate: giroDireita }],
            }}
          >
            {meia("esquerda")}
          </Animated.View>
        </View>
        <Animated.View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: C,
            height: ANEL,
            overflow: "hidden",
            opacity: passouDaMetade,
          }}
        >
          <Animated.View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: ANEL,
              height: ANEL,
              transform: [{ rotate: giroEsquerda }],
            }}
          >
            {meia("direita")}
          </Animated.View>
        </Animated.View>
        {/* O pingo do começo, parado no alto. */}
        <Svg width={ANEL} height={ANEL} style={{ position: "absolute" }}>
          <Circle cx={C} cy={C - RAIO} r={GROSSURA / 2} fill={PALETA.acao} />
        </Svg>
      </Animated.View>
    </View>
  );
}

/**
 * Os segundos que faltam: o ÚNICO pedaço da sessão que se redesenha durante
 * o movimento, e só quando o número muda (um `setTimeout` para o próximo
 * segundo, e não um relógio que dispara à toa).
 */
function SegundosQueFaltam({
  ate,
  agora,
  parado,
}: {
  /** O segundo da sessão em que o trecho acaba. */
  ate: number;
  agora: () => number;
  parado: boolean;
}) {
  const contar = useCallback(() => Math.max(0, Math.ceil(ate - agora() - 1e-6)), [ate, agora]);
  const [n, setN] = useState(contar);
  useEffect(() => {
    setN(contar());
    if (parado) return;
    let id: ReturnType<typeof setTimeout> | undefined;
    const proximo = () => {
      const resta = ate - agora();
      const agoraN = Math.max(0, Math.ceil(resta - 1e-6));
      setN(agoraN);
      if (agoraN <= 0) return;
      id = setTimeout(proximo, Math.max(16, (resta - (agoraN - 1)) * 1000 + 8));
    };
    proximo();
    return () => clearTimeout(id);
  }, [ate, parado, contar, agora]);
  return (
    <Text
      accessibilityLabel={`${n} segundos`}
      style={{
        ...fonte.titulo,
        fontSize: 17,
        lineHeight: 22,
        color: cor.branco,
        fontVariant: ["tabular-nums"],
      }}
    >
      {n}s
    </Text>
  );
}

/** Onde a sessão muda de novo depois do segundo t: o fim do movimento, ou o começo do próximo. */
function proximaFronteira(trechos: Trecho[], t: number): number | null {
  const pos = posicaoNoTempo(trechos, t);
  if (pos.tipo === "movimento") return pos.trecho.fim;
  if (pos.tipo === "troca") return pos.proximo.inicio;
  return null;
}

function Sessao({
  seq,
  inicio,
  aoTerminar,
}: {
  seq: Movimento[];
  /** Na bancada, o segundo da sessão em que ela abre. */
  inicio: number;
  aoTerminar: () => void;
}) {
  const { trechos } = useMemo(() => linhaDoTempo(seq), [seq]);
  /* O segundo da sessão — mas só reescrito nas fronteiras (o fim de um
     movimento, a pausa, o pulo), nunca de quadro em quadro. */
  const [t, setT] = useState(inicio);
  const [pausada, setPausada] = useState(false);
  /* A voz desta tela é gravação nossa, então o botão aparece sempre — e ela
     começa ligada, como no app antigo. */
  const [voz, setVoz] = useState(true);
  const relogio = useRef({ desde: Date.now(), acumulado: inicio, rodando: false });
  const terminou = useRef(false);
  const ultimoIndice = useRef(-1);
  const anel = useRef(new Animated.Value(1)).current;

  const agora = useCallback(() => {
    const r = relogio.current;
    return r.acumulado + (r.rodando ? (Date.now() - r.desde) / 1000 : 0);
  }, []);

  /* O relógio de parede anda só com a sessão rodando. */
  useEffect(() => {
    if (pausada) return;
    const r = relogio.current;
    r.desde = Date.now();
    r.rodando = true;
    return () => {
      r.acumulado += (Date.now() - r.desde) / 1000;
      r.rodando = false;
    };
  }, [pausada]);

  const pausar = useCallback(() => {
    setT(agora());
    setPausada(true);
  }, [agora]);

  /* O app saiu da tela (bloqueou, atendeu o telefone): a sessão para ali. Sem
     isto, o relógio de parede seguiria contando e ela voltaria com movimentos
     pulados — ou com a sessão já terminada e paga sem ter acontecido. */
  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado === "background") pausar();
    });
    return () => sub.remove();
  }, [pausar]);

  /* A próxima fronteira: um só `setTimeout`, e um render por troca. */
  useEffect(() => {
    if (pausada) return;
    const prox = proximaFronteira(trechos, t);
    if (prox == null) return;
    const id = setTimeout(
      () => setT(Math.max(prox, agora())),
      Math.max(0, (prox - agora()) * 1000),
    );
    return () => clearTimeout(id);
  }, [t, pausada, trechos, agora]);

  const pos = posicaoNoTempo(trechos, t);
  /* O movimento que está NA TELA: na troca, já é o próximo. */
  const indice =
    pos.tipo === "movimento" ? pos.trecho.indice : pos.tipo === "troca" ? pos.proximo.indice : -1;
  const troca = pos.tipo === "troca";
  const fimDoTrecho =
    pos.tipo === "movimento" ? pos.trecho.fim : pos.tipo === "troca" ? pos.proximo.inicio : 0;

  /* O anel: do que resta até o zero, no tempo que resta, no motor nativo. A
     pausa o congela onde está; o pulo e a troca de movimento o recomeçam. */
  useEffect(() => {
    if (pos.tipo === "fim") return;
    if (pos.tipo === "troca") {
      anel.setValue(1);
      return;
    }
    const resta = Math.max(0, pos.trecho.fim - agora());
    anel.setValue(Math.min(1, resta / pos.trecho.movimento.secs));
    if (pausada) return;
    const a = Animated.timing(anel, {
      toValue: 0,
      duration: resta * 1000,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, pausada]);

  useEffect(() => {
    if (pos.tipo === "movimento" && pos.trecho.indice !== ultimoIndice.current) {
      ultimoIndice.current = pos.trecho.indice;
      if (Platform.OS !== "web")
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    if (pos.tipo === "fim" && !terminou.current) {
      terminou.current = true;
      if (Platform.OS !== "web")
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      aoTerminar();
    }
  }, [pos, aoTerminar]);

  /* A voz lê o nome e a dica quando o movimento ENTRA na tela — na troca, para
     ela ouvir o que vem enquanto muda de posição. Pausar cala; continuar lê de
     novo do começo; desligar cala na hora. */
  useEffect(() => {
    if (pausada || !voz || indice < 0) {
      pararVozes();
      return;
    }
    const id = seq[indice]!.id;
    const narracao = narracaoNoApp(id);
    if (!narracao) return;
    tocarVoz(narracao === "regravada" ? VOZ_REGRAVADA[`mov-${id}`] : VOZ_DO_MOVIMENTO[id], {
      canal: "guia",
    });
  }, [indice, voz, pausada, seq]);
  useEffect(() => () => pararVozes(), []);

  function pular() {
    const alvo = inicioDoProximo(trechos, agora());
    relogio.current.acumulado = alvo;
    relogio.current.desde = Date.now();
    setT(alvo);
  }

  function sair() {
    pararVozes();
    fecharAtividade();
  }

  const m = indice >= 0 ? seq[indice]! : null;
  const ultimo = indice + 1 >= seq.length;

  return (
    <View style={{ flex: 1 }}>
      {Platform.OS !== "web" ? <MantemAcesa /> : null}
      {/* No alto, só o fechar e o caminho da sessão (um trecho por movimento). */}
      <TopoDaAtividade
        aoFechar={sair}
        meio={
          <Segmentos
            paleta={PALETA}
            total={seq.length}
            atual={Math.max(0, indice)}
            rotulo={m ? `Movimento ${indice + 1} de ${seq.length}` : undefined}
          />
        }
      />
      {m ? (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: margem.foco,
            paddingBottom: FOLGA_DOS_CONTROLES + espaco.lg,
            alignItems: "center",
          }}
        >
          {/* A figura DEMONSTRANDO, dentro do anel que conta o tempo, num
              palco claro: a figura de traço precisa de chão claro. */}
          <View
            style={{
              marginTop: espaco.lg,
              width: PALCO,
              height: PALCO,
              borderRadius: PALCO / 2,
              backgroundColor: cor.branco,
              alignItems: "center",
              justifyContent: "center",
              ...sombraDe(PALETA.acao, 1.4),
            }}
          >
            <Anel resta={anel} />
            <FiguraMovimento pose={m.pose} anim={m.id} tinta={PALETA.acao} />
            {/* O relógio fica no TOPO do anel: embaixo ele cobria os pés, e o
                pé é justamente o que se mexe em metade dos exercícios. */}
            <View
              style={{
                position: "absolute",
                top: -12,
                borderRadius: canto.pilula,
                ...curva,
                backgroundColor: MATERIAL.labioCheio,
                paddingBottom: 3,
              }}
            >
              <View
                style={{
                  minWidth: 64,
                  alignItems: "center",
                  borderRadius: canto.pilula,
                  ...curva,
                  backgroundColor: PALETA.acao,
                  paddingHorizontal: 14,
                  paddingVertical: 3,
                }}
              >
                <SegundosQueFaltam ate={fimDoTrecho} agora={agora} parado={pausada} />
              </View>
            </View>
          </View>
          <View style={{ marginTop: espaco.xl, alignItems: "center" }}>
            <SobrelinhaDaAtividade paleta={PALETA}>
              {troca ? "Prepare-se" : `Movimento ${indice + 1} de ${seq.length}`}
            </SobrelinhaDaAtividade>
          </View>
          <Text
            accessibilityRole="header"
            style={{
              marginTop: 6,
              textAlign: "center",
              ...fonte.display,
              ...escala.titulo1,
              letterSpacing: -0.2,
              color: cor.texto,
            }}
          >
            {m.name}
          </Text>
          <Text
            style={{
              marginTop: 6,
              maxWidth: 330,
              textAlign: "center",
              ...fonte.normal,
              ...escala.corpo,
              color: cor.textoCorpo,
            }}
          >
            {m.cue}
          </Text>
          {/* O aviso fica fixo, discreto, na tela do exercício. */}
          <Text
            style={{
              marginTop: espaco.md,
              maxWidth: 330,
              textAlign: "center",
              ...fonte.normal,
              ...escala.nota,
              color: cor.textoApagado,
            }}
          >
            Vá no seu ritmo e pule o que não for confortável para você.
          </Text>
          {/* Como montar a posição, na ordem em que o corpo entra nela. */}
          <Superficie
            tinta={PALETA.acao}
            estilo={{ marginTop: espaco.xl, width: "100%", maxWidth: 384, gap: espaco.md }}
          >
            <Text
              accessibilityRole="header"
              style={{ ...fonte.forte, ...escala.manchete, color: cor.texto }}
            >
              Como fazer
            </Text>
            {m.passos.map((p, i) => (
              <View key={i} style={{ flexDirection: "row", gap: espaco.md }}>
                <Ficha fundo={MATERIAL.ficha} tamanho={26}>
                  <Text style={{ ...fonte.titulo, fontSize: 13, color: PALETA.acao }}>{i + 1}</Text>
                </Ficha>
                <Text
                  style={{
                    flex: 1,
                    paddingTop: 2,
                    ...fonte.normal,
                    ...escala.legenda,
                    color: cor.textoCorpo,
                  }}
                >
                  {p}
                </Text>
              </View>
            ))}
          </Superficie>
          <View style={{ marginTop: espaco.md, width: "100%", maxWidth: 384, gap: espaco.md }}>
            <Caixa
              fundo={PALETA.luz}
              tinta={cor.texto}
              titulo="O que reparar"
              icone={<Sparkles size={16} color={PALETA.acao} strokeWidth={2.2} />}
              ficha={cor.branco}
            >
              {m.sentir}
            </Caixa>
            <Caixa
              fundo={cor.atencaoClaro}
              tinta={cor.atencaoTexto}
              titulo="Pare se"
              icone={<Hand size={16} color={cor.atencaoTexto} strokeWidth={2.2} />}
              ficha={cor.atencaoFundo}
            >
              {m.parar}
            </Caixa>
          </View>
        </ScrollView>
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}>
            Terminando…
          </Text>
        </View>
      )}
      <ControlesDaSessao
        paleta={PALETA}
        pausada={pausada}
        aoAlternar={() => (pausada ? setPausada(false) : pausar())}
        esquerda={<BotaoDaVoz ligada={voz} aoTocar={() => setVoz((v) => !v)} />}
        direita={
          <BotaoDoControle rotulo={ultimo ? "Terminar" : "Pular para o próximo"} aoTocar={pular}>
            <SkipForward size={22} color={cor.texto} strokeWidth={2.2} />
          </BotaoDoControle>
        }
      />
    </View>
  );
}

function Caixa({
  fundo,
  tinta,
  titulo,
  icone,
  ficha,
  children,
}: {
  fundo: string;
  tinta: string;
  titulo: string;
  icone: ReactNode;
  ficha: string;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: espaco.md,
        borderRadius: canto.dentro,
        ...curva,
        backgroundColor: fundo,
        padding: 14,
      }}
    >
      <Ficha fundo={ficha} tamanho={30}>
        {icone}
      </Ficha>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...fonte.forte, ...escala.legenda, color: tinta }}>{titulo}</Text>
        <Text style={{ ...fonte.normal, ...escala.legenda, color: tinta }}>{children}</Text>
      </View>
    </View>
  );
}
