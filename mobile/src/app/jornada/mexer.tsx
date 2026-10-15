import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pause, Play, TriangleAlert, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import {
  ajustarNotas,
  SINAIS_DE_PARADA,
  SINTOMAS,
  type Movimento,
  type NotasDoCorpo,
  type Sintoma,
} from "@/lib/exercicios";
import { Botao, Cartao, Carregando, T, Tela, toque } from "~/componentes/base";
import { corMovimento } from "~/componentes/jornada/cores";
import { FiguraMovimento } from "~/componentes/jornada/figura-movimento";
import { concluirMomento, FimDoMomento, type Desfecho } from "~/componentes/jornada/fim";
import { BarraDoTopo, Ficha } from "~/componentes/jornada/pecas";
import { BolhaViva } from "~/componentes/movimento";
import { useAtividade } from "~/componentes/jornada/usarJornada";
import { pararVozes, tocarVoz } from "~/lib/audio/voz";
import { VOZ_DO_MOVIMENTO } from "~/lib/audio/vozes";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { estadoAtual, gravarChave } from "~/lib/jornada/loja";
import {
  DURACAO_PADRAO,
  DURACOES_MEXER,
  inicioDoProximo,
  linhaDoTempo,
  minutosAproximados,
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

/* No luto, os sinais que só existem numa gestação em curso saem da lista. */
const SO_NA_GESTACAO = new Set(["Perda de líquido", "Contrações que se repetem"]);

const ehUmaDuracao = (n: number): n is DuracaoMexer =>
  (DURACOES_MEXER as readonly number[]).includes(n);

export default function Mexer() {
  const at = useAtividade("movement");
  const [minutos, setMinutos] = useState<DuracaoMexer>(DURACAO_PADRAO);
  const [sintoma, setSintoma] = useState<Sintoma | null>(null);
  const [semChao, setSemChao] = useState(false);
  const [etapa, setEtapa] = useState<"escolha" | "sinais" | "sessao" | "fim">("escolha");
  const [desfecho, setDesfecho] = useState<Desfecho | null>(null);
  const [avaliou, setAvaliou] = useState<string | null>(null);
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
  const { total } = linhaDoTempo(seq);

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
    if (e === "sinais" || e === "sessao") setEtapa(e);
    if (e === "fim") {
      setSintoma("lombar");
      setEtapa("fim");
      setDesfecho({
        ganhou: at.cuidado ? null : 5,
        fechou: false,
        bonus: null,
        semPagamento: at.cuidado,
      });
    }
  }, [at.pronto, at.cuidado, aplicouBancada]);

  async function terminar() {
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
  }

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
        seq={seq}
        inicio={inicioDaBancada}
        aoTerminar={() => void terminar()}
        aoSair={() => setEtapa("escolha")}
      />
    );

  if (etapa === "fim") {
    return (
      <Tela bordas={["top", "bottom"]}>
        <FimDoMomento
          titulo="Corpo em movimento!"
          fala={
            at.cuidado
              ? "Obrigada por cuidar do seu corpo hoje."
              : "Mexer um pouco todo dia alivia o corpo e ajuda o sono."
          }
          desfecho={desfecho}
          D={at.D}
          cuidado={at.cuidado}
          pos={at.pos}
          extra={
            sintoma ? (
              <Cartao>
                <T tipo="rotulo">
                  E o incômodo de hoje (
                  {SINTOMAS.find((s) => s.chave === sintoma)?.rotulo.toLowerCase()})?
                </T>
                {avaliou ? (
                  <T tipo="apagado">
                    Anotado. A próxima sessão começa pelo que funciona melhor para você.
                  </T>
                ) : (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.sm }}>
                    {(["Melhorou", "Igual", "Piorou"] as const).map((d) => (
                      <Ficha
                        key={d}
                        rotulo={d}
                        corAtiva={corMovimento.forte}
                        fundoAtivo={corMovimento.forteFundo}
                        textoAtivo={corMovimento.titulo}
                        aoTocar={() => {
                          gravarChave(CHAVE_NOTAS_EXERCICIO, ajustarNotas(notas, seq, sintoma, d));
                          setAvaliou(d);
                        }}
                      />
                    ))}
                  </View>
                )}
                {avaliou === "Piorou" ? (
                  <T tipo="apagado">
                    Se a dor continuar forte ou vier com algum sinal de alerta, procure atendimento
                    — o SOS fica sempre aqui embaixo.
                  </T>
                ) : null}
              </Cartao>
            ) : null
          }
        />
      </Tela>
    );
  }

  if (etapa === "sinais") {
    const sinais = at.cuidado
      ? SINAIS_DE_PARADA.filter((s) => !SO_NA_GESTACAO.has(s))
      : SINAIS_DE_PARADA;
    return (
      <FundoVerde>
        <View style={{ paddingHorizontal: espaco.lg }}>
          <BarraDoTopo titulo="Antes de começar" aoSair={() => setEtapa("escolha")} />
        </View>
        <ScrollView
          contentContainerStyle={{ padding: espaco.lg, paddingBottom: 120, gap: espaco.md }}
        >
          <Cartao fundo={cor.atencaoFundo}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
              <TriangleAlert size={22} color={cor.atencao} />
              <T tipo="subtitulo" cor={cor.atencao}>
                Hoje não é dia de exercício se você tiver:
              </T>
            </View>
            <View style={{ gap: 6, marginTop: 4 }}>
              {sinais.map((s) => (
                <View
                  key={s}
                  style={{ flexDirection: "row", gap: espaco.sm, alignItems: "flex-start" }}
                >
                  <Text style={{ fontFamily: fonte.titulo, fontSize: 16, color: cor.atencao }}>
                    •
                  </Text>
                  <T estilo={{ flex: 1 }}>{s}</T>
                </View>
              ))}
            </View>
            <T tipo="apagado">
              Nesses casos, procure atendimento. E se algo assim aparecer no meio, pare na hora.
            </T>
          </Cartao>
          <Botao
            rotulo="Estou com um desses — abrir o SOS"
            tipo="perigo"
            aoTocar={() => router.push("/sos")}
          />
          <Botao
            rotulo={`Estou bem, começar · ${minutos} min`}
            corFundo={corMovimento.forte}
            aoTocar={() => setEtapa("sessao")}
          />
        </ScrollView>
      </FundoVerde>
    );
  }

  const fala = at.jaFeita
    ? "Você já se mexeu hoje! Pode fazer de novo, se o corpo pedir."
    : at.cuidado
      ? "Movimentos leves, sem ir ao chão. No seu ritmo."
      : "Diga o que está incomodando, que eu monto a sequência pra você.";

  return (
    <FundoVerde>
      <View style={{ paddingHorizontal: espaco.lg }}>
        <BarraDoTopo />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: espaco.xl, paddingBottom: espaco.xxl }}
      >
        {/* O porta-voz, GRANDE e falando num balão — "ele que vai interagir
            com as pessoas", nas palavras do dono no app antigo. */}
        <View style={{ alignItems: "center" }}>
          <BolhaViva humor="exercicio" tamanho={168} moldura={false} />
          <SombraDoChao />
          <Text
            style={{
              marginTop: espaco.sm,
              maxWidth: 272,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: corMovimento.balaoBorda,
              backgroundColor: corMovimento.balaoFundo,
              paddingHorizontal: 14,
              paddingVertical: espaco.sm,
              overflow: "hidden",
              fontFamily: fonte.normal,
              fontSize: 13,
              lineHeight: 18,
              color: corMovimento.balaoTexto,
            }}
          >
            {fala}
          </Text>
        </View>
        <Text
          style={{
            marginTop: espaco.lg,
            textAlign: "center",
            fontFamily: fonte.media,
            fontSize: 26,
            lineHeight: 32,
            color: corMovimento.titulo,
          }}
        >
          {at.cuidado ? "Mexer devagar" : "Mexer o corpo"}
        </Text>

        <Secao>O que está incomodando?</Secao>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.sm }}>
          {SINTOMAS.map((s) => (
            <Escolha
              key={s.chave}
              ativa={sintoma === s.chave}
              aoTocar={() => setSintoma((x) => (x === s.chave ? null : s.chave))}
              rotulo={s.rotulo}
              estilo={{ width: "48.7%" }}
            >
              <Text style={{ fontSize: 18 }}>{s.emoji}</Text>
            </Escolha>
          ))}
        </View>

        <Secao>De quanto tempo você tem?</Secao>
        <View style={{ flexDirection: "row", gap: espaco.sm }}>
          {DURACOES_MEXER.map((m) => (
            <Escolha
              key={m}
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

        <View
          style={{
            marginTop: espaco.xl,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: corMovimento.borda,
            backgroundColor: corMovimento.vidro,
            paddingHorizontal: espaco.lg,
            paddingVertical: espaco.md,
            gap: 2,
          }}
        >
          <Text style={{ fontFamily: fonte.titulo, fontSize: 13, color: corMovimento.titulo }}>
            Sua sessão: {seq.length} {seq.length === 1 ? "movimento" : "movimentos"} ·{" "}
            {minutosAproximados(total)}
          </Text>
          {seq.map((m, i) => (
            <View
              key={m.id}
              style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm, minHeight: 30 }}
            >
              <Text
                style={{
                  fontFamily: fonte.titulo,
                  fontSize: 13,
                  color: corMovimento.contagem,
                  width: 16,
                }}
              >
                {i + 1}
              </Text>
              <Text style={{ fontSize: 17 }}>{m.emoji}</Text>
              <Text
                style={{
                  flex: 1,
                  fontFamily: fonte.media,
                  fontSize: 14,
                  color: corMovimento.titulo,
                }}
              >
                {m.name}
              </Text>
              <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: corMovimento.aviso }}>
                {m.secs}s
              </Text>
            </View>
          ))}
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
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: corMovimento.borda,
          backgroundColor: corMovimento.vidro,
          paddingHorizontal: espaco.xl,
          paddingTop: espaco.md,
          paddingBottom: espaco.md,
        }}
      >
        <Botao
          rotulo={`Começar · ${minutos} min`}
          corFundo={corMovimento.forte}
          aoTocar={() => setEtapa("sinais")}
          desabilitado={!seq.length}
        />
      </View>
    </FundoVerde>
  );
}

/** O degradê verde do app antigo, atrás de todas as telas do Movimento. */
function FundoVerde({ children }: { children: ReactNode }) {
  return (
    <LinearGradient
      colors={[corMovimento.fundoTopo, corMovimento.fundoMeio, corMovimento.fundoBase]}
      style={{ flex: 1 }}
    >
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}

/** A sombra no chão, embaixo da bolha: sem ela, a bolha parece um adesivo. */
function SombraDoChao() {
  return (
    <Svg width={150} height={18} style={{ marginTop: -6 }}>
      <Defs>
        <RadialGradient id="sombra-do-chao" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor="#000000" stopOpacity={0.16} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={75} cy={9} rx={75} ry={9} fill="url(#sombra-do-chao)" />
    </Svg>
  );
}

function Secao({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        marginTop: espaco.xl,
        marginBottom: espaco.sm,
        fontFamily: fonte.forte,
        fontSize: 13,
        letterSpacing: 0.65,
        textTransform: "uppercase",
        color: corMovimento.secao,
      }}
    >
      {children}
    </Text>
  );
}

/** Os botões de escolha do app antigo: verde cheio quando escolhido. */
function Escolha({
  rotulo,
  ativa,
  aoTocar,
  centro,
  estilo,
  children,
}: {
  rotulo: string;
  ativa: boolean;
  aoTocar: () => void;
  centro?: boolean;
  estilo?: { width?: `${number}%`; flex?: number };
  children?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: ativa }}
      accessibilityLabel={rotulo}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        ...estilo,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: centro ? "center" : "flex-start",
        gap: espaco.sm,
        minHeight: centro ? 48 : ALVO_MINIMO + 8,
        paddingHorizontal: espaco.md,
        paddingVertical: 10,
        borderRadius: 16,
        borderWidth: ativa ? 0 : 1,
        borderColor: corMovimento.borda,
        backgroundColor: ativa ? corMovimento.forte : corMovimento.vidro,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {children}
      <Text
        style={{
          flexShrink: 1,
          fontFamily: centro ? fonte.titulo : fonte.forte,
          fontSize: centro ? 14 : 13,
          lineHeight: centro ? 20 : 17,
          color: ativa ? cor.branco : centro ? corMovimento.forte : corMovimento.titulo,
        }}
      >
        {rotulo}
      </Text>
    </Pressable>
  );
}

/** "Hoje eu não desço ao chão" — cama de hospital, repouso, o tapete que não existe. */
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
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        minHeight: ALVO_MINIMO + 8,
        paddingHorizontal: espaco.lg,
        paddingVertical: espaco.sm,
        borderRadius: 16,
        marginTop: espaco.md,
        borderWidth: ligado ? 0 : 1,
        borderColor: corMovimento.borda,
        backgroundColor: ligado ? corMovimento.forte : corMovimento.vidro,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ fontSize: 18 }}>🛏️</Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: fonte.forte,
            fontSize: 13,
            lineHeight: 17,
            color: ligado ? cor.branco : corMovimento.titulo,
          }}
        >
          Hoje eu não desço ao chão
        </Text>
        <Text
          style={{
            fontFamily: fonte.normal,
            fontSize: 13,
            lineHeight: 18,
            color: ligado ? corMovimento.branco80 : corMovimento.discreto,
          }}
        >
          Cama, sofá ou de pé — sem tapete
        </Text>
      </View>
    </Pressable>
  );
}

function MantemAcesa() {
  useKeepAwake("dc-mexer");
  return null;
}

const ANEL = 208;
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
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: corMovimento.borda,
        backgroundColor: corMovimento.vidro,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
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
    <LinearGradient
      colors={[corMovimento.fundoTopo, corMovimento.fundoMeio, corMovimento.fundoBase]}
      style={{ flex: 1 }}
    >
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
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
            {/* A voz é o 🗣️ do app antigo — apagado quando desligada. */}
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="Voz"
              accessibilityState={{ checked: voz }}
              hitSlop={8}
              onPress={() => {
                toque();
                setVoz((v) => !v);
              }}
              style={({ pressed }) => ({
                minWidth: 28,
                minHeight: 36,
                alignItems: "center",
                justifyContent: "center",
                opacity: (voz ? 1 : 0.4) * (pressed ? 0.7 : 1),
              })}
            >
              <Text style={{ fontSize: 18, lineHeight: 24 }}>🗣️</Text>
            </Pressable>
          </View>
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
            {/* A figura DEMONSTRANDO, dentro do anel que conta o tempo. */}
            <View
              style={{
                width: ANEL,
                height: ANEL,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Anel resta={troca ? 1 : resta / m.secs} />
              <FiguraMovimento pose={m.pose} anim={m.id} tinta={corMovimento.forte} />
              {/* O relógio fica no TOPO do anel: embaixo ele cobria os pés, e o
                  pé é justamente o que se mexe em metade dos exercícios. */}
              <View
                style={{
                  position: "absolute",
                  top: -4,
                  borderRadius: 999,
                  backgroundColor: troca ? corMovimento.contagem : corMovimento.forte,
                  paddingHorizontal: 10,
                  paddingVertical: 2,
                }}
              >
                <Text
                  accessibilityLabel={troca ? `Prepare-se, ${resta} segundos` : `${resta} segundos`}
                  style={{
                    fontFamily: fonte.titulo,
                    fontSize: 14,
                    lineHeight: 20,
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
                marginTop: espaco.lg,
                textAlign: "center",
                fontFamily: fonte.titulo,
                fontSize: 24,
                lineHeight: 30,
                color: corMovimento.titulo,
              }}
            >
              {m.name}
            </Text>
            <Text
              style={{
                marginTop: 4,
                maxWidth: 320,
                textAlign: "center",
                fontFamily: fonte.normal,
                fontSize: 14,
                lineHeight: 22,
                color: corMovimento.dica,
              }}
            >
              {m.cue}
            </Text>
            {/* Como montar a posição, na ordem em que o corpo entra nela. */}
            <View style={{ marginTop: espaco.lg, width: "100%", maxWidth: 384, gap: espaco.sm }}>
              {m.passos.map((p, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 10 }}>
                  <View
                    style={{
                      marginTop: 1,
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: corMovimento.passoFundo,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{ fontFamily: fonte.titulo, fontSize: 12, color: corMovimento.forte }}
                    >
                      {i + 1}
                    </Text>
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: fonte.normal,
                      fontSize: 13,
                      lineHeight: 18,
                      color: corMovimento.passoTexto,
                    }}
                  >
                    {p}
                  </Text>
                </View>
              ))}
            </View>
            <View style={{ marginTop: espaco.lg, width: "100%", maxWidth: 384, gap: espaco.sm }}>
              <Caixa
                fundo={corMovimento.sentirFundo}
                tinta={corMovimento.sentirTexto}
                titulo="Você deve sentir:"
              >
                {m.sentir}
              </Caixa>
              <Caixa
                fundo={corMovimento.pararFundo}
                tinta={corMovimento.pararTexto}
                titulo="Pare se:"
              >
                {m.parar}
              </Caixa>
            </View>
            <View
              accessibilityLabel={`Movimento ${indice + 1} de ${seq.length}`}
              style={{ marginTop: 20, flexDirection: "row", justifyContent: "center", gap: 6 }}
            >
              {seq.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: 24,
                    height: 8,
                    borderRadius: 4,
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pular para o próximo"
              hitSlop={4}
              onPress={() => {
                toque();
                pular();
              }}
              style={({ pressed }) => ({
                marginTop: espaco.lg,
                minHeight: 36,
                paddingHorizontal: espaco.xl,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: corMovimento.bordaForte,
                backgroundColor: corMovimento.vidro,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: corMovimento.forte }}>
                Próximo →
              </Text>
            </Pressable>
          </ScrollView>
        ) : (
          <Carregando texto="Terminando…" />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

function Caixa({
  fundo,
  tinta,
  titulo,
  children,
}: {
  fundo: string;
  tinta: string;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        borderRadius: 16,
        backgroundColor: fundo,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
    >
      <Text style={{ fontFamily: fonte.normal, fontSize: 13, lineHeight: 18, color: tinta }}>
        <Text style={{ fontFamily: fonte.titulo }}>{titulo}</Text> {children}
      </Text>
    </View>
  );
}
