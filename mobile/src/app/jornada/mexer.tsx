import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { router } from "expo-router";
import { Hand, Pause, Play, Sparkles, TriangleAlert, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Image, Platform, Pressable, ScrollView, Switch, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import {
  ajustarNotas,
  SINAIS_DE_PARADA,
  SINTOMAS,
  type Movimento,
  type NotasDoCorpo,
  type Sintoma,
} from "@/lib/exercicios";
import { Carregando, Tela, toque } from "~/componentes/base";
import {
  BolhaComBalao,
  BotaoDaAtividade,
  BotaoDaVoz,
  Brilho,
  Escolha,
  Ficha,
  FundoDaAtividade,
  materialDe,
  RodapeDaAtividade,
  Secao,
  sombraDe,
  Superficie,
  TituloDaAtividade,
  type PaletaDaAtividade,
} from "~/componentes/jornada/atividade";
import { corMovimento } from "~/componentes/jornada/cores";
import { FiguraMovimento } from "~/componentes/jornada/figura-movimento";
import { concluirMomento, FimDoMomento, type Desfecho } from "~/componentes/jornada/fim";
import { BarraDoTopo, voltarParaJornada } from "~/componentes/jornada/pecas";
import { BolhaViva } from "~/componentes/movimento";
import { useAtividade } from "~/componentes/jornada/usarJornada";
import { pararVozes, tocarVoz } from "~/lib/audio/voz";
import { VOZ_DO_MOVIMENTO } from "~/lib/audio/vozes";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { anotarNoDiario } from "~/lib/jornada/diario";
import { estadoAtual, gravarChave } from "~/lib/jornada/loja";
import {
  DURACAO_PADRAO,
  DURACOES_MEXER,
  inicioDoProximo,
  linhaDoTempo,
  montarSessao,
  posicaoNoTempo,
  temChaoParaTirar,
  type DuracaoMexer,
} from "~/lib/jornada/mexer";
import { CHAVE_NOTAS_EXERCICIO } from "~/lib/jornada/momentos";
import { ALVO_MINIMO, cor, espaco, fonte } from "~/tema";

/**
 * MEXER — a sessão montada pela régua do site (`sessaoDoDia`): pela fase da
 * gestação, pelo que está incomodando hoje e numa descida só de posições. Os
 * sinais de parada vêm ANTES de começar, com o SOS a um toque.
 *
 * A sessão é a do app antigo: a FIGURA demonstrando cada movimento dentro do
 * anel que conta o tempo, e a VOZ gravada lendo o nome e a dica ao entrar em
 * cada um — ela olha para o próprio corpo, não para o celular. Movimento sem
 * gravação anda em silêncio (os passos estão escritos), nunca com a voz errada.
 *
 * Bancada: /jornada/mexer?bancada=1 [&etapa=sinais|sessao|fim|feita] [&luto=1]
 *          [&semana=38] [&sintoma=lombar] [&minutos=2|5|10] [&semchao=1] [&t=<segundos da sessão>]
 */

const PALETA: PaletaDaAtividade = {
  fundo: [corMovimento.fundoTopo, corMovimento.fundoMeio, corMovimento.fundoBase],
  forte: corMovimento.forte,
  titulo: corMovimento.titulo,
  secao: corMovimento.secao,
  borda: corMovimento.borda,
  vidro: corMovimento.vidro,
  discreto: corMovimento.discreto,
  brancoSuave: corMovimento.branco80,
};

const MATERIAL = materialDe(PALETA);

/** O tapete de yoga, nas artes 3D do app — no lugar do 💪 no fim da sessão. */
const ARTE_DO_FIM = require("../../../../src/assets/grades/exercicios.webp");

/* No luto, os sinais que só existem numa gestação em curso saem da lista. */
const SO_NA_GESTACAO = new Set(["Perda de líquido", "Contrações que se repetem"]);

const ehUmaDuracao = (n: number): n is DuracaoMexer =>
  (DURACOES_MEXER as readonly number[]).includes(n);

export default function Mexer() {
  const at = useAtividade("movement");
  const [minutos, setMinutos] = useState<DuracaoMexer>(DURACAO_PADRAO);
  const [sintoma, setSintoma] = useState<Sintoma | null>(null);
  const [semChao, setSemChao] = useState(false);
  const [etapa, setEtapa] = useState<"escolha" | "sessao" | "reflexo" | "fim">("escolha");
  /* A sequência nasce no "Começar", e não do desenho: derivada, ela mudaria
     debaixo dela se o dia virasse no meio da sessão. */
  const [seqDaSessao, setSeqDaSessao] = useState<Movimento[]>([]);
  const [desfecho, setDesfecho] = useState<Desfecho | null>(null);
  const [melhorou, setMelhorou] = useState<"Melhorou" | "Igual" | "Piorou" | null>(null);
  const [aplicouBancada, setAplicouBancada] = useState(false);
  const [inicioDaBancada, setInicioDaBancada] = useState(0);
  const notas = (estadoAtual().blob[CHAVE_NOTAS_EXERCICIO] ?? {}) as NotasDoCorpo;

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
            sintoma,
            semChao: temChao && semChao,
            notas,
          })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [at.pronto, at.D, minutos, at.semana, at.pos, at.cuidado, sintoma, semChao, temChao],
  );

  useEffect(() => {
    if (aplicouBancada || !at.pronto || !ehBancada()) return;
    setAplicouBancada(true);
    const s = parametroDaBancada("sintoma");
    if (s && SINTOMAS.some((x) => x.chave === s)) setSintoma(s as Sintoma);
    const m = Number(parametroDaBancada("minutos"));
    if (ehUmaDuracao(m)) setMinutos(m);
    if (parametroDaBancada("semchao") === "1") setSemChao(true);
    setInicioDaBancada(Math.max(0, Number(parametroDaBancada("t") ?? 0) || 0));
    const e = parametroDaBancada("etapa");
    if (e === "sessao") {
      setSeqDaSessao(seq);
      setEtapa("sessao");
    }
    if (e === "reflexo") setEtapa("reflexo");
    if (e === "fim") {
      const d = parametroDaBancada("desfecho");
      if (d === "Melhorou" || d === "Igual" || d === "Piorou") setMelhorou(d);
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
    setMelhorou(null);
    setDesfecho(null);
    setEtapa("sessao");
  }

  async function terminar() {
    setEtapa("reflexo");
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
  }

  /* "Melhorou?" vira informação: a nota reordena a próxima sessão desta
     queixa, e a resposta vai para o diário — o médico vê "lombar: melhorou"
     oito vezes seguidas, ou "não mudou" oito vezes. */
  function responder(d: "Melhorou" | "Igual" | "Piorou") {
    setMelhorou(d);
    if (sintoma) {
      gravarChave(CHAVE_NOTAS_EXERCICIO, ajustarNotas(notas, seqDaSessao, sintoma, d));
      const rotulo = SINTOMAS.find((x) => x.chave === sintoma)?.rotulo ?? sintoma;
      void anotarNoDiario(at.uid, `Exercício de ${minutos} min · ${rotulo}: ${d.toLowerCase()}`);
    }
    setEtapa("fim");
  }

  const sair = () => (router.canGoBack() ? router.back() : voltarParaJornada());

  if (!at.pronto) {
    return (
      <Tela bordas={["top", "bottom"]}>
        <Carregando />
      </Tela>
    );
  }

  if (etapa === "sessao")
    return (
      <Sessao
        seq={seqDaSessao}
        inicio={inicioDaBancada}
        aoTerminar={() => void terminar()}
        aoSair={sair}
      />
    );

  if (etapa === "reflexo") {
    return (
      <FundoDaAtividade paleta={PALETA}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: espaco.xxl,
            paddingVertical: espaco.xl,
          }}
        >
          {/* A bolha de faixa e halteres, e não o 🤸: a arte que já abre a
              tela de escolha, agora perguntando. */}
          <View style={{ alignItems: "center", justifyContent: "center" }}>
            <Brilho tamanho={190} />
            <BolhaViva humor="exercicio" tamanho={132} moldura={false} />
          </View>
          <Text
            accessibilityRole="header"
            style={{
              marginTop: espaco.lg,
              textAlign: "center",
              fontFamily: fonte.titulo,
              fontSize: 28,
              lineHeight: 34,
              letterSpacing: -0.3,
              color: corMovimento.titulo,
            }}
          >
            {sintoma ? "E agora, como está?" : "Terminou!"}
          </Text>
          {sintoma ? (
            <>
              <Text
                style={{
                  marginTop: 6,
                  textAlign: "center",
                  fontFamily: fonte.media,
                  fontSize: 15,
                  lineHeight: 21,
                  color: corMovimento.dica,
                }}
              >
                Sobre o que você marcou no começo.
              </Text>
              <View style={{ marginTop: espaco.xl, width: "100%", maxWidth: 340, gap: espaco.md }}>
                {(
                  [
                    { e: "😌", r: "Melhorou" },
                    { e: "😐", r: "Igual" },
                    { e: "😖", r: "Piorou" },
                  ] as const
                ).map((o) => (
                  <Escolha
                    key={o.r}
                    paleta={PALETA}
                    rotulo={o.r}
                    ativa={false}
                    aoTocar={() => responder(o.r)}
                  >
                    <Text style={{ fontSize: 20 }}>{o.e}</Text>
                  </Escolha>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setEtapa("fim")}
                hitSlop={8}
                style={{ marginTop: espaco.lg, minHeight: ALVO_MINIMO, justifyContent: "center" }}
              >
                <Text style={{ fontFamily: fonte.forte, fontSize: 15, color: corMovimento.secao }}>
                  Pular
                </Text>
              </Pressable>
            </>
          ) : (
            <View style={{ marginTop: espaco.xxl, width: "100%", maxWidth: 340 }}>
              <BotaoDaAtividade
                cor={corMovimento.forte}
                rotulo="Continuar"
                aoTocar={() => setEtapa("fim")}
              />
            </View>
          )}
        </ScrollView>
      </FundoDaAtividade>
    );
  }

  if (etapa === "fim") {
    return (
      <FundoDaAtividade paleta={PALETA}>
        <ScrollView
          contentContainerStyle={{ padding: espaco.lg, paddingBottom: 120, gap: espaco.md }}
        >
          <FimDoMomento
            /* O site festejava até o "Piorou". Aqui a festa é de quem melhorou
               ou não disse: com dor pior, o fim agradece e anota — confete em
               cima de "piorou" diz que ela não foi ouvida. */
            titulo={melhorou === "Piorou" ? "Obrigado por contar" : "Corpo soltinho! 🎉"}
            fala={
              melhorou === "Piorou"
                ? "Anotei. Se piorar de novo, conte na próxima consulta — isso é informação, não frescura."
                : melhorou === "Melhorou"
                  ? "Anotei que melhorou. Repetir nos próximos dias costuma segurar o alívio."
                  : at.cuidado
                    ? "Você cuidou de você hoje."
                    : "Você cuidou de você e do bebê hoje."
            }
            desfecho={desfecho}
            D={at.D}
            cuidado={at.cuidado}
            pos={at.pos}
            arte={
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                <Brilho tamanho={200} />
                <Image
                  source={ARTE_DO_FIM}
                  accessibilityIgnoresInvertColors
                  style={{ width: 132, height: 132 }}
                />
              </View>
            }
            confete={melhorou !== "Piorou"}
          />
        </ScrollView>
      </FundoDaAtividade>
    );
  }

  const fala = at.jaFeita
    ? "Você já se mexeu hoje! Pode fazer de novo, se o corpo pedir."
    : at.cuidado
      ? "Movimentos leves, sem ir ao chão. No seu ritmo."
      : "Diga o que está incomodando, que eu monto a sequência pra você.";
  const sinais = at.cuidado
    ? SINAIS_DE_PARADA.filter((s) => !SO_NA_GESTACAO.has(s))
    : SINAIS_DE_PARADA;

  return (
    <FundoDaAtividade paleta={PALETA}>
      <View style={{ paddingHorizontal: espaco.lg }}>
        <BarraDoTopo />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: espaco.xl, paddingBottom: espaco.xxl }}
      >
        <BolhaComBalao humor="exercicio" fala={fala} paleta={PALETA} />
        <TituloDaAtividade paleta={PALETA}>
          {at.cuidado ? "Mexer devagar" : "Mexer o corpo"}
        </TituloDaAtividade>

        <Secao paleta={PALETA}>O que está incomodando?</Secao>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.sm }}>
          {SINTOMAS.map((s) => (
            <Escolha
              key={s.chave}
              paleta={PALETA}
              ativa={sintoma === s.chave}
              aoTocar={() => setSintoma((x) => (x === s.chave ? null : s.chave))}
              rotulo={s.rotulo}
              estilo={{ width: "48.7%" }}
            >
              <Text style={{ fontSize: 18 }}>{s.emoji}</Text>
            </Escolha>
          ))}
        </View>

        <Secao paleta={PALETA}>De quanto tempo você tem?</Secao>
        <View style={{ flexDirection: "row", gap: espaco.sm }}>
          {DURACOES_MEXER.map((m) => (
            <Escolha
              key={m}
              paleta={PALETA}
              ativa={minutos === m}
              aoTocar={() => setMinutos(m)}
              rotulo={`${m} min`}
              centro
              estilo={{ flex: 1 }}
            />
          ))}
        </View>
        {/* Só aparece quando há chão a tirar: a partir da 37ª semana, no
            pós-parto e no Modo Cuidado a régua já o tirou sozinha. */}
        {temChao ? <SemChao ligado={semChao} aoTocar={() => setSemChao((v) => !v)} /> : null}

        {/* ⚠️ OS SINAIS DE PARADA, antes de começar — não é "li e aceito": são
            os motivos pelos quais ela NÃO deve se exercitar hoje, e todos pedem
            o médico em vez de alongamento. O SOS fica a um toque, no alto. */}
        <View
          style={{
            marginTop: 28,
            borderRadius: 22,
            backgroundColor: corMovimento.pararFundo,
            padding: espaco.lg,
            gap: espaco.sm,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
            <Ficha fundo={corMovimento.alertaBorda} tamanho={34}>
              <TriangleAlert size={17} color={corMovimento.alertaTexto} strokeWidth={2.4} />
            </Ficha>
            <Text
              accessibilityRole="header"
              style={{
                flex: 1,
                fontFamily: fonte.titulo,
                fontSize: 15,
                lineHeight: 20,
                color: corMovimento.alertaTexto,
              }}
            >
              Hoje não é dia de exercício se você tiver:
            </Text>
          </View>
          <View style={{ gap: 6, paddingLeft: 46 }}>
            {sinais.map((sinal) => (
              <View key={sinal} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: corMovimento.alertaTexto70,
                  }}
                />
                <Text
                  style={{
                    flex: 1,
                    fontFamily: fonte.media,
                    fontSize: 14,
                    lineHeight: 19,
                    color: corMovimento.alertaTexto85,
                  }}
                >
                  {sinal}
                </Text>
              </View>
            ))}
          </View>
          <Text
            style={{
              marginTop: 4,
              paddingLeft: 46,
              fontFamily: fonte.forte,
              fontSize: 14,
              lineHeight: 19,
              color: corMovimento.alertaTexto,
            }}
          >
            Qualquer um deles: fale com seu médico agora, pelo SOS.
          </Text>
        </View>

        <Text
          style={{
            marginTop: espaco.lg,
            fontFamily: fonte.normal,
            fontSize: 13,
            lineHeight: 21,
            color: corMovimento.discreto,
          }}
        >
          Nada aqui substitui a orientação do seu obstetra. Se ele já disse que algum movimento não
          serve pra você, pule esse.
        </Text>
      </ScrollView>
      <RodapeDaAtividade paleta={PALETA}>
        <BotaoDaAtividade
          cor={corMovimento.forte}
          rotulo={`Começar · ${minutos} min`}
          icone={<Play size={18} color={cor.branco} fill={cor.branco} />}
          aoTocar={comecar}
          desabilitado={!seq.length}
        />
      </RodapeDaAtividade>
    </FundoDaAtividade>
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
        marginTop: espaco.md,
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        minHeight: 64,
        paddingHorizontal: espaco.md,
        paddingVertical: espaco.sm,
        borderRadius: 20,
        backgroundColor: cor.branco,
        opacity: pressed ? 0.85 : 1,
        ...sombraDe(corMovimento.forte, 0.8),
      })}
    >
      <Ficha fundo={MATERIAL.ficha}>
        <Text style={{ fontSize: 18 }}>🛏️</Text>
      </Ficha>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: fonte.titulo,
            fontSize: 14,
            lineHeight: 19,
            color: corMovimento.titulo,
          }}
        >
          Hoje eu não desço ao chão
        </Text>
        <Text
          style={{
            fontFamily: fonte.normal,
            fontSize: 13,
            lineHeight: 18,
            color: corMovimento.discreto,
          }}
        >
          Cama, sofá ou de pé — sem tapete
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
          trackColor={{ false: "#e2e8f0", true: corMovimento.forte }}
          thumbColor={cor.branco}
          ios_backgroundColor="#e2e8f0"
        />
      </View>
    </Pressable>
  );
}

function MantemAcesa() {
  useKeepAwake("dc-mexer");
  return null;
}

const ANEL = 208;
/** O palco branco em volta do anel. */
const PALCO = 240;
const RAIO = 45;
const VOLTA = 2 * Math.PI * RAIO;

/** O anel do app antigo: começa cheio e esvazia com o tempo do movimento. */
function Anel({ resta }: { resta: number }) {
  return (
    <Svg
      width={ANEL}
      height={ANEL}
      viewBox="0 0 100 100"
      style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}
    >
      <Circle
        cx={50}
        cy={50}
        r={RAIO}
        fill="none"
        stroke={corMovimento.anelTrilho}
        strokeWidth={6}
      />
      <Circle
        cx={50}
        cy={50}
        r={RAIO}
        fill="none"
        stroke={corMovimento.anel}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={`${VOLTA} ${VOLTA}`}
        strokeDashoffset={(1 - Math.min(1, Math.max(0, resta))) * VOLTA}
      />
    </Svg>
  );
}

/** Os botões redondos do cabeçalho (pausa, voz): 36 de desenho, 44 de dedo. */
function BotaoDoTopo({
  rotulo,
  aoTocar,
  children,
}: {
  rotulo: string;
  aoTocar: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      hitSlop={4}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: cor.branco,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
        ...sombraDe(corMovimento.forte, 0.6),
      })}
    >
      {children}
    </Pressable>
  );
}

function Sessao({
  seq,
  inicio,
  aoTerminar,
  aoSair,
}: {
  seq: Movimento[];
  /** Na bancada, o segundo da sessão em que ela abre. */
  inicio: number;
  aoTerminar: () => void;
  aoSair: () => void;
}) {
  const { trechos } = useMemo(() => linhaDoTempo(seq), [seq]);
  const [t, setT] = useState(inicio);
  const [pausada, setPausada] = useState(false);
  /* O app saiu da tela (bloqueou, atendeu o telefone): a sessão para ali. Sem
     isto, o relógio de parede seguiria contando e ela voltaria com movimentos
     pulados — ou com a sessão já terminada e paga sem ter acontecido. */
  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado === "background") setPausada(true);
    });
    return () => sub.remove();
  }, []);
  /* A voz desta tela é gravação nossa, então o botão aparece sempre — e ela
     começa ligada, como no app antigo. */
  const [voz, setVoz] = useState(true);
  const base = useRef({ inicio: Date.now(), acumulado: inicio });
  const terminou = useRef(false);
  const ultimoIndice = useRef(-1);

  useEffect(() => {
    if (pausada) return;
    base.current.inicio = Date.now();
    const id = setInterval(() => {
      setT(base.current.acumulado + (Date.now() - base.current.inicio) / 1000);
    }, 250);
    return () => {
      clearInterval(id);
      base.current.acumulado += (Date.now() - base.current.inicio) / 1000;
    };
  }, [pausada]);

  const pos = posicaoNoTempo(trechos, t);
  /* O movimento que está NA TELA: na troca, já é o próximo. */
  const indice =
    pos.tipo === "movimento" ? pos.trecho.indice : pos.tipo === "troca" ? pos.proximo.indice : -1;

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
    tocarVoz(VOZ_DO_MOVIMENTO[seq[indice]!.id], { canal: "guia" });
  }, [indice, voz, pausada, seq]);
  useEffect(() => () => pararVozes(), []);

  function pular() {
    const alvo = inicioDoProximo(trechos, t);
    base.current.acumulado += alvo - t;
    setT(alvo);
  }

  const m = indice >= 0 ? seq[indice]! : null;
  const troca = pos.tipo === "troca";
  const resta = pos.tipo === "movimento" || pos.tipo === "troca" ? pos.restante : 0;

  return (
    <FundoDaAtividade paleta={PALETA}>
      <View style={{ flex: 1 }}>
        {Platform.OS !== "web" ? <MantemAcesa /> : null}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: espaco.lg,
            paddingVertical: espaco.sm,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            onPress={aoSair}
            style={({ pressed }) => ({
              width: ALVO_MINIMO,
              height: ALVO_MINIMO,
              marginLeft: -espaco.sm,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <X size={24} color={corMovimento.fechar} />
          </Pressable>
          <Text
            style={{
              flex: 1,
              textAlign: "center",
              fontFamily: fonte.forte,
              fontSize: 13,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              color: corMovimento.contagem,
            }}
          >
            {m ? `${troca ? "Prepare-se · " : ""}${indice + 1} de ${seq.length}` : ""}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
            {/* ⏸ desenhado, e não emoji: emoji tem cor própria em cada sistema. */}
            <BotaoDoTopo
              rotulo={pausada ? "Continuar" : "Pausar"}
              aoTocar={() => setPausada((p) => !p)}
            >
              {pausada ? (
                <Play size={15} color={corMovimento.forte} fill={corMovimento.forte} />
              ) : (
                <Pause size={15} color={corMovimento.forte} fill={corMovimento.forte} />
              )}
            </BotaoDoTopo>
            <BotaoDaVoz
              ligada={voz}
              aoTocar={() => setVoz((v) => !v)}
              corLigada={corMovimento.secao}
              corDesligada={corMovimento.bordaForte}
            />
          </View>
        </View>
        {/* O caminho da sessão, de ponta a ponta: um trecho por movimento. */}
        <View
          accessibilityLabel={m ? `Movimento ${indice + 1} de ${seq.length}` : undefined}
          style={{
            flexDirection: "row",
            gap: 4,
            paddingHorizontal: espaco.xl,
            paddingTop: 2,
            paddingBottom: espaco.sm,
          }}
        >
          {seq.map((_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                backgroundColor:
                  i < indice
                    ? corMovimento.feito
                    : i === indice
                      ? corMovimento.atual
                      : corMovimento.porVir,
              }}
            />
          ))}
        </View>
        {/* O aviso médico fica fixo, discreto, na tela do exercício. */}
        <Text
          style={{
            paddingHorizontal: espaco.xl,
            paddingBottom: 4,
            textAlign: "center",
            fontFamily: fonte.normal,
            fontSize: 13,
            lineHeight: 18,
            color: corMovimento.aviso,
          }}
        >
          Vá no seu ritmo. Confirme com seu médico se algum movimento não é indicado pra você.
        </Text>
        {m ? (
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: espaco.xl,
              paddingBottom: espaco.xxl,
              alignItems: "center",
            }}
          >
            {/* A figura DEMONSTRANDO, dentro do anel que conta o tempo, num
                palco branco: a figura de traço precisa de chão claro, e o
                degradê atrás dela a apagava. */}
            <View
              style={{
                marginTop: espaco.md,
                width: PALCO,
                height: PALCO,
                borderRadius: PALCO / 2,
                backgroundColor: cor.branco,
                alignItems: "center",
                justifyContent: "center",
                ...sombraDe(corMovimento.forte, 1.4),
              }}
            >
              <Anel resta={troca ? 1 : resta / m.secs} />
              <FiguraMovimento pose={m.pose} anim={m.id} tinta={corMovimento.forte} />
              {/* O relógio fica no TOPO do anel: embaixo ele cobria os pés, e o
                  pé é justamente o que se mexe em metade dos exercícios. */}
              <View
                style={{
                  position: "absolute",
                  top: -10,
                  borderRadius: 999,
                  backgroundColor: troca ? corMovimento.contagem : corMovimento.forte,
                  borderBottomWidth: 3,
                  borderBottomColor: MATERIAL.labioCheio,
                  paddingHorizontal: 14,
                  paddingVertical: 3,
                }}
              >
                <Text
                  accessibilityLabel={troca ? `Prepare-se, ${resta} segundos` : `${resta} segundos`}
                  style={{
                    fontFamily: fonte.titulo,
                    fontSize: 16,
                    lineHeight: 22,
                    color: cor.branco,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {troca ? `Prepare-se ${resta}s` : `${resta}s`}
                </Text>
              </View>
            </View>
            <Text
              style={{
                marginTop: espaco.xl,
                textAlign: "center",
                fontFamily: fonte.titulo,
                fontSize: 26,
                lineHeight: 32,
                letterSpacing: -0.3,
                color: corMovimento.titulo,
              }}
            >
              {m.name}
            </Text>
            <Text
              style={{
                marginTop: 6,
                maxWidth: 320,
                textAlign: "center",
                fontFamily: fonte.media,
                fontSize: 15,
                lineHeight: 22,
                color: corMovimento.dica,
              }}
            >
              {m.cue}
            </Text>
            {/* Como montar a posição, na ordem em que o corpo entra nela. */}
            <Superficie
              tinta={corMovimento.forte}
              estilo={{ marginTop: espaco.xl, width: "100%", maxWidth: 384, gap: espaco.md }}
            >
              <Text
                accessibilityRole="header"
                style={{ fontFamily: fonte.titulo, fontSize: 15, color: corMovimento.titulo }}
              >
                Como fazer
              </Text>
              {m.passos.map((p, i) => (
                <View key={i} style={{ flexDirection: "row", gap: espaco.md }}>
                  <Ficha fundo={MATERIAL.ficha} tamanho={26}>
                    <Text
                      style={{ fontFamily: fonte.titulo, fontSize: 13, color: corMovimento.forte }}
                    >
                      {i + 1}
                    </Text>
                  </Ficha>
                  <Text
                    style={{
                      flex: 1,
                      paddingTop: 3,
                      fontFamily: fonte.normal,
                      fontSize: 14,
                      lineHeight: 20,
                      color: corMovimento.passoTexto,
                    }}
                  >
                    {p}
                  </Text>
                </View>
              ))}
            </Superficie>
            <View style={{ marginTop: espaco.md, width: "100%", maxWidth: 384, gap: espaco.md }}>
              <Caixa
                fundo={corMovimento.sentirFundo}
                tinta={corMovimento.sentirTexto}
                titulo="Você deve sentir"
                icone={<Sparkles size={16} color={corMovimento.forte} strokeWidth={2.4} />}
                ficha={corMovimento.passoFundo}
              >
                {m.sentir}
              </Caixa>
              <Caixa
                fundo={corMovimento.pararFundo}
                tinta={corMovimento.pararTexto}
                titulo="Pare se"
                icone={<Hand size={16} color={corMovimento.alertaTexto} strokeWidth={2.4} />}
                ficha={corMovimento.alertaBorda}
              >
                {m.parar}
              </Caixa>
            </View>
            <View style={{ marginTop: espaco.xl, width: "100%", maxWidth: 384 }}>
              <BotaoDaAtividade
                claro
                cor={corMovimento.forte}
                rotulo={indice + 1 >= seq.length ? "Terminar" : "Próximo movimento"}
                rotuloAcessivel="Pular para o próximo"
                aoTocar={pular}
              />
            </View>
          </ScrollView>
        ) : (
          <Carregando texto="Terminando…" />
        )}
      </View>
    </FundoDaAtividade>
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
        borderRadius: 20,
        backgroundColor: fundo,
        padding: 14,
      }}
    >
      <Ficha fundo={ficha} tamanho={30}>
        {icone}
      </Ficha>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonte.titulo, fontSize: 14, lineHeight: 19, color: tinta }}>
          {titulo}
        </Text>
        <Text style={{ fontFamily: fonte.normal, fontSize: 14, lineHeight: 20, color: tinta }}>
          {children}
        </Text>
      </View>
    </View>
  );
}
