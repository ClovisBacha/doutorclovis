import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { router } from "expo-router";
import { Pause, Play, SkipForward, TriangleAlert } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import {
  ajustarNotas,
  SINAIS_DE_PARADA,
  SINTOMAS,
  type Movimento,
  type NotasDoCorpo,
  type Sintoma,
} from "@/lib/exercicios";
import { Botao, Cartao, Carregando, T, Tela } from "~/componentes/base";
import { corJornada } from "~/componentes/jornada/cores";
import { concluirMomento, FimDoMomento, type Desfecho } from "~/componentes/jornada/fim";
import { BarraDoTopo, BolhaFalando, BotaoRedondo, Ficha } from "~/componentes/jornada/pecas";
import { useAtividade } from "~/componentes/jornada/usarJornada";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { estadoAtual, gravarChave } from "~/lib/jornada/loja";
import {
  DURACOES_MEXER,
  inicioDoProximo,
  linhaDoTempo,
  minutosAproximados,
  montarSessao,
  posicaoNoTempo,
  type DuracaoMexer,
} from "~/lib/jornada/mexer";
import { CHAVE_NOTAS_EXERCICIO } from "~/lib/jornada/momentos";
import { relogio } from "~/lib/jornada/respiracao";
import { cor, espaco, fonte } from "~/tema";

/**
 * MEXER — uma sessão curta (2 ou 5 minutos) montada pela régua do site
 * (`sessaoDoDia`): pela fase da gestação, pelo que está incomodando hoje e
 * numa descida só de posições. Os sinais de parada vêm ANTES de começar, com
 * o SOS a um toque. Passo a passo e relógio em cada movimento.
 *
 * Bancada: /jornada/mexer?bancada=1 [&etapa=sinais|sessao|fim|feita] [&luto=1] [&semana=38]
 */

/* No luto, os sinais que só existem numa gestação em curso saem da lista. */
const SO_NA_GESTACAO = new Set(["Perda de líquido", "Contrações que se repetem"]);

export default function Mexer() {
  const at = useAtividade("movement");
  const [minutos, setMinutos] = useState<DuracaoMexer>(3);
  const [sintoma, setSintoma] = useState<Sintoma | null>(null);
  const [etapa, setEtapa] = useState<"escolha" | "sinais" | "sessao" | "fim">("escolha");
  const [desfecho, setDesfecho] = useState<Desfecho | null>(null);
  const [avaliou, setAvaliou] = useState<string | null>(null);
  const [aplicouBancada, setAplicouBancada] = useState(false);
  const notas = (estadoAtual().blob[CHAVE_NOTAS_EXERCICIO] ?? {}) as NotasDoCorpo;

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
            notas,
          })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [at.pronto, at.D, minutos, at.semana, at.pos, at.cuidado, sintoma],
  );
  const { total } = linhaDoTempo(seq);

  useEffect(() => {
    if (aplicouBancada || !at.pronto || !ehBancada()) return;
    setAplicouBancada(true);
    const e = parametroDaBancada("etapa");
    if (e === "sinais" || e === "sessao") setEtapa(e);
    if (e === "fim") {
      setSintoma("lombar");
      setEtapa("fim");
      setDesfecho({ ganhou: at.cuidado ? null : 5, fechou: false, bonus: null, semPagamento: at.cuidado });
    }
  }, [at.pronto, at.cuidado, aplicouBancada]);

  async function terminar() {
    setEtapa("fim");
    if (!at.uid) return;
    setDesfecho(await concluirMomento({ uid: at.uid, D: at.D, momento: "movement", cuidado: at.cuidado, pos: at.pos }));
  }

  if (!at.pronto) {
    return (
      <Tela bordas={["top", "bottom"]}>
        <Carregando />
      </Tela>
    );
  }

  if (etapa === "sessao") return <Sessao seq={seq} aoTerminar={() => void terminar()} aoSair={() => setEtapa("escolha")} />;

  if (etapa === "fim") {
    return (
      <Tela bordas={["top", "bottom"]}>
        <FimDoMomento
          titulo="Corpo em movimento!"
          fala={at.cuidado ? "Obrigada por cuidar do seu corpo hoje." : "Mexer um pouco todo dia alivia o corpo e ajuda o sono."}
          desfecho={desfecho}
          D={at.D}
          cuidado={at.cuidado}
          pos={at.pos}
          extra={
            sintoma ? (
              <Cartao>
                <T tipo="rotulo">
                  E o incômodo de hoje ({SINTOMAS.find((s) => s.chave === sintoma)?.rotulo.toLowerCase()})?
                </T>
                {avaliou ? (
                  <T tipo="apagado">Anotado. A próxima sessão começa pelo que funciona melhor para você.</T>
                ) : (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.sm }}>
                    {(["Melhorou", "Igual", "Piorou"] as const).map((d) => (
                      <Ficha
                        key={d}
                        rotulo={d}
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
                    Se a dor continuar forte ou vier com algum sinal de alerta, procure atendimento — o SOS fica sempre aqui embaixo.
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
    const sinais = at.cuidado ? SINAIS_DE_PARADA.filter((s) => !SO_NA_GESTACAO.has(s)) : SINAIS_DE_PARADA;
    return (
      <Tela bordas={["top", "bottom"]}>
        <BarraDoTopo titulo="Antes de começar" aoSair={() => setEtapa("escolha")} />
        <Cartao fundo={cor.atencaoFundo}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
            <TriangleAlert size={22} color={cor.atencao} />
            <T tipo="subtitulo" cor={cor.atencao}>
              Hoje não é dia de exercício se você tiver:
            </T>
          </View>
          <View style={{ gap: 6, marginTop: 4 }}>
            {sinais.map((s) => (
              <View key={s} style={{ flexDirection: "row", gap: espaco.sm, alignItems: "flex-start" }}>
                <Text style={{ fontFamily: fonte.titulo, fontSize: 16, color: cor.atencao }}>•</Text>
                <T estilo={{ flex: 1 }}>{s}</T>
              </View>
            ))}
          </View>
          <T tipo="apagado">Nesses casos, procure atendimento. E se algo assim aparecer no meio, pare na hora.</T>
        </Cartao>
        <Botao rotulo="Estou com um desses — abrir o SOS" tipo="perigo" aoTocar={() => router.push("/sos")} />
        <Botao rotulo="Estou bem, começar" corFundo={corJornada.roxo} aoTocar={() => setEtapa("sessao")} />
      </Tela>
    );
  }

  return (
    <Tela bordas={["top", "bottom"]}>
      <BarraDoTopo titulo={at.cuidado ? "Mexer devagar" : "Mexer"} />
      <BolhaFalando
        humor="exercicio"
        fala={
          at.jaFeita
            ? "Você já se mexeu hoje! Pode fazer de novo, se o corpo pedir."
            : at.cuidado
              ? "Movimentos leves, sem ir ao chão. No seu ritmo."
              : "Bora mexer um pouquinho? É curto, e o corpo agradece."
        }
      />
      <T tipo="rotulo">Algo incomodando hoje?</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.sm }}>
        {SINTOMAS.map((s) => (
          <Ficha
            key={s.chave}
            rotulo={`${s.emoji} ${s.rotulo}`}
            ativa={sintoma === s.chave}
            aoTocar={() => setSintoma((x) => (x === s.chave ? null : s.chave))}
          />
        ))}
      </View>
      <T tipo="rotulo" estilo={{ marginTop: espaco.sm }}>
        Quanto tempo?
      </T>
      <View style={{ flexDirection: "row", gap: espaco.sm }}>
        {DURACOES_MEXER.map((m) => (
          <Ficha key={m} rotulo={`${m} min`} ativa={minutos === m} aoTocar={() => setMinutos(m)} />
        ))}
      </View>
      <Cartao>
        <T tipo="rotulo">
          Sua sessão: {seq.length} {seq.length === 1 ? "movimento" : "movimentos"} · {minutosAproximados(total)}
        </T>
        {seq.map((m, i) => (
          <View key={m.id} style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm, minHeight: 32 }}>
            <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: corJornada.roxoClaro, width: 18 }}>{i + 1}</Text>
            <Text style={{ fontSize: 20 }}>{m.emoji}</Text>
            <Text style={{ flex: 1, fontFamily: fonte.media, fontSize: 15, color: cor.texto }}>{m.name}</Text>
            <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: cor.textoApagado }}>{m.secs}s</Text>
          </View>
        ))}
      </Cartao>
      <Botao rotulo="Continuar" corFundo={corJornada.roxo} aoTocar={() => setEtapa("sinais")} desabilitado={!seq.length} />
    </Tela>
  );
}

function MantemAcesa() {
  useKeepAwake("dc-mexer");
  return null;
}

function Anel({ fracao, tamanho = 120 }: { fracao: number; tamanho?: number }) {
  const r = tamanho / 2 - 8;
  const c = 2 * Math.PI * r;
  return (
    <Svg width={tamanho} height={tamanho}>
      <Circle cx={tamanho / 2} cy={tamanho / 2} r={r} stroke={corJornada.estrelaApagada} strokeWidth={10} fill="none" />
      <Circle
        cx={tamanho / 2}
        cy={tamanho / 2}
        r={r}
        stroke={corJornada.roxoMedio}
        strokeWidth={10}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={c * (1 - Math.min(1, Math.max(0, fracao)))}
        transform={`rotate(-90 ${tamanho / 2} ${tamanho / 2})`}
      />
    </Svg>
  );
}

function Sessao({ seq, aoTerminar, aoSair }: { seq: Movimento[]; aoTerminar: () => void; aoSair: () => void }) {
  const { trechos, total } = useMemo(() => linhaDoTempo(seq), [seq]);
  const [t, setT] = useState(0);
  const [pausada, setPausada] = useState(false);
  const base = useRef({ inicio: Date.now(), acumulado: 0 });
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

  useEffect(() => {
    if (pos.tipo === "movimento" && pos.trecho.indice !== ultimoIndice.current) {
      ultimoIndice.current = pos.trecho.indice;
      if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    if (pos.tipo === "fim" && !terminou.current) {
      terminou.current = true;
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      aoTerminar();
    }
  }, [pos, aoTerminar]);

  function pular() {
    const alvo = inicioDoProximo(trechos, t);
    base.current.acumulado += alvo - t;
    setT(alvo);
  }

  const m = pos.tipo === "movimento" ? pos.trecho.movimento : pos.tipo === "troca" ? pos.proximo.movimento : null;
  const indice = pos.tipo === "movimento" ? pos.trecho.indice : pos.tipo === "troca" ? pos.proximo.indice : seq.length - 1;

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: cor.fundo }}>
      {Platform.OS !== "web" ? <MantemAcesa /> : null}
      <View style={{ paddingHorizontal: espaco.lg, paddingTop: espaco.sm }}>
        <BarraDoTopo fechar progresso={t / Math.max(1, total)} aoSair={aoSair} />
      </View>
      <ScrollView contentContainerStyle={{ padding: espaco.lg, gap: espaco.md }}>
        {m ? (
          <>
            <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: corJornada.roxo, letterSpacing: 0.4 }}>
              {pos.tipo === "troca" ? "PREPARE-SE · " : ""}MOVIMENTO {indice + 1} DE {seq.length}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.lg }}>
              <View style={{ width: 120, height: 120, alignItems: "center", justifyContent: "center" }}>
                <Anel
                  fracao={
                    pos.tipo === "movimento"
                      ? 1 - pos.restante / pos.trecho.movimento.secs
                      : 0
                  }
                />
                <View style={{ position: "absolute", alignItems: "center" }}>
                  <Text style={{ fontSize: 30 }}>{m.emoji}</Text>
                  <Text style={{ fontFamily: fonte.titulo, fontSize: 20, color: corJornada.roxoEscuro, fontVariant: ["tabular-nums"] }}>
                    {pos.tipo === "movimento" || pos.tipo === "troca" ? `${pos.restante}s` : ""}
                  </Text>
                </View>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <T tipo="subtitulo" estilo={{ fontSize: 21 }}>
                  {m.name}
                </T>
                <T tipo="apagado">{m.cue}</T>
              </View>
            </View>
            <Cartao>
              <T tipo="rotulo">Passo a passo</T>
              {m.passos.map((p, i) => (
                <View key={i} style={{ flexDirection: "row", gap: espaco.sm, alignItems: "flex-start" }}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: corJornada.roxoFundo,
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 1,
                    }}
                  >
                    <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: corJornada.roxo }}>{i + 1}</Text>
                  </View>
                  <T estilo={{ flex: 1 }}>{p}</T>
                </View>
              ))}
            </Cartao>
            <View style={{ flexDirection: "row", gap: espaco.sm }}>
              <Cartao estilo={{ flex: 1 }} fundo={corJornada.feitoFundo}>
                <T tipo="rotulo" cor="#15803d">
                  O que sentir
                </T>
                <T tipo="apagado">{m.sentir}</T>
              </Cartao>
              <Cartao estilo={{ flex: 1 }} fundo={cor.atencaoFundo}>
                <T tipo="rotulo" cor={cor.atencao}>
                  Pare se
                </T>
                <T tipo="apagado">{m.parar}</T>
              </Cartao>
            </View>
          </>
        ) : (
          <Carregando texto="Terminando…" />
        )}
      </ScrollView>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: espaco.lg,
          paddingVertical: espaco.md,
          borderTopWidth: 1,
          borderTopColor: cor.borda,
        }}
      >
        <Text style={{ fontFamily: fonte.forte, fontSize: 16, color: cor.textoApagado, fontVariant: ["tabular-nums"] }}>
          faltam {relogio(total - t)}
        </Text>
        <View style={{ flexDirection: "row", gap: espaco.md }}>
          <BotaoRedondo rotulo={pausada ? "Continuar" : "Pausar"} aoTocar={() => setPausada((p) => !p)} fundo={corJornada.roxoFundo}>
            {pausada ? <Play size={20} color={corJornada.roxo} /> : <Pause size={20} color={corJornada.roxo} />}
          </BotaoRedondo>
          <BotaoRedondo rotulo="Pular para o próximo" aoTocar={pular} fundo={corJornada.roxoFundo}>
            <SkipForward size={20} color={corJornada.roxo} />
          </BotaoRedondo>
        </View>
      </View>
    </SafeAreaView>
  );
}
