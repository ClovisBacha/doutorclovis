import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { Pause, Play } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { falaNoCiclo, type Plano } from "@/lib/meditacao-sessao";
import { Botao, Carregando, T, Tela } from "~/componentes/base";
import { corJornada } from "~/componentes/jornada/cores";
import { concluirMomento, FimDoMomento, type Desfecho } from "~/componentes/jornada/fim";
import { BarraDoTopo, BolhaFalando, BotaoRedondo, Ficha } from "~/componentes/jornada/pecas";
import { useAtividade } from "~/componentes/jornada/usarJornada";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { ymdLocal } from "~/lib/gestacao";
import { gravarChave, estadoAtual } from "~/lib/jornada/loja";
import {
  DURACOES_MEDITAR,
  planoDoDia,
  temasDisponiveis,
  type DuracaoMeditar,
} from "~/lib/jornada/meditacao";
import { CHAVE_LOG_MEDITACAO } from "~/lib/jornada/momentos";
import {
  contaComoFeita,
  DURACAO_DA_FASE,
  instanteNoTempo,
  relogio,
  ROTULO_DA_FASE,
  segundosDaSessao,
  type Fase,
} from "~/lib/jornada/respiracao";
import { cor, espaco, fonte, raio } from "~/tema";

/**
 * MEDITAR — respiração guiada 4-4-8 (inspire 4, segure 4, solte 8).
 *
 * O compasso é o do site (`RESPIRO`); as frases são as do roteiro do site
 * (`planejarSessao`), que no Modo Cuidado limpa fala a fala o que citaria o
 * bebê. Um toque leve a cada fase, para quem fecha os olhos. A tela não apaga
 * durante a sessão. Conta como feita a partir de um minuto.
 *
 * Bancada: /jornada/meditar?bancada=1 [&etapa=sessao|fim|feita] [&luto=1]
 */
export default function Meditar() {
  const at = useAtividade("meditation");
  const temas = useMemo(
    () => temasDisponiveis({ cuidado: at.cuidado, posParto: at.pos }),
    [at.cuidado, at.pos],
  );
  const [tema, setTema] = useState<string>("Calma");
  const [minutos, setMinutos] = useState<DuracaoMeditar>(1);
  const [etapa, setEtapa] = useState<"escolha" | "sessao" | "fim">("escolha");
  const [desfecho, setDesfecho] = useState<Desfecho | null>(null);
  const [aplicouBancada, setAplicouBancada] = useState(false);

  useEffect(() => {
    if (aplicouBancada || !at.pronto || !ehBancada()) return;
    setAplicouBancada(true);
    const e = parametroDaBancada("etapa");
    if (e === "sessao") setEtapa("sessao");
    if (e === "fim") {
      setEtapa("fim");
      setDesfecho({ ganhou: at.cuidado || at.pos ? null : 5, fechou: false, bonus: null, semPagamento: at.cuidado || at.pos });
    }
  }, [at.pronto, at.cuidado, at.pos, aplicouBancada]);

  const plano = useMemo(
    () =>
      planoDoDia({
        minutos,
        tema,
        semanas: at.semana,
        cuidado: at.cuidado,
        D: at.D ?? new Date().getDate(),
      }),
    [minutos, tema, at.semana, at.cuidado, at.D],
  );

  async function terminar(segundos: number) {
    setEtapa("fim");
    if (!at.uid) return;
    if (!at.cuidado) {
      const log = (estadoAtual().blob[CHAVE_LOG_MEDITACAO] ?? {}) as {
        dias?: string[];
        minutos?: number;
        humores?: string[];
      };
      const hoje = ymdLocal();
      const dias = Array.isArray(log.dias) ? log.dias : [];
      gravarChave(CHAVE_LOG_MEDITACAO, {
        dias: dias.includes(hoje) ? dias : [...dias, hoje].slice(-400),
        minutos: (typeof log.minutos === "number" ? log.minutos : 0) + Math.max(1, Math.round(segundos / 60)),
        humores: Array.isArray(log.humores) ? log.humores : [],
      });
    }
    const d = await concluirMomento({ uid: at.uid, D: at.D, momento: "meditation", cuidado: at.cuidado, pos: at.pos });
    setDesfecho(d);
  }

  if (!at.pronto) {
    return (
      <Tela bordas={["top", "bottom"]}>
        <Carregando />
      </Tela>
    );
  }

  if (etapa === "sessao") {
    return (
      <Sessao
        plano={plano}
        aoTerminar={(s) => void terminar(s)}
        aoSairCedo={() => setEtapa("escolha")}
      />
    );
  }

  if (etapa === "fim") {
    return (
      <Tela bordas={["top", "bottom"]}>
        <FimDoMomento
          titulo={at.cuidado ? "Respiração feita" : "Meditação feita!"}
          fala={
            at.cuidado
              ? "Obrigada por esse minuto com você. Volte quando precisar."
              : "Esse minuto de calma também chega no seu corpo inteiro."
          }
          desfecho={desfecho}
          D={at.D}
          cuidado={at.cuidado}
          pos={at.pos}
        />
      </Tela>
    );
  }

  return (
    <Tela bordas={["top", "bottom"]}>
      <BarraDoTopo titulo={at.cuidado ? "Respirar" : "Meditar"} />
      <BolhaFalando
        humor="feliz"
        fala={
          at.jaFeita
            ? "Você já meditou hoje. Pode respirar de novo sempre que quiser."
            : "Vamos respirar juntas? Inspire contando 4, segure 4 e solte devagar em 8."
        }
      />
      <T tipo="rotulo">O que você está precisando?</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.sm }}>
        {temas.map((t) => (
          <Ficha key={t.tema} rotulo={`${t.emoji} ${t.precisa}`} ativa={tema === t.tema} aoTocar={() => setTema(t.tema)} />
        ))}
      </View>
      <T tipo="rotulo" estilo={{ marginTop: espaco.sm }}>
        Quanto tempo?
      </T>
      <View style={{ flexDirection: "row", gap: espaco.sm }}>
        {DURACOES_MEDITAR.map((m) => (
          <Ficha key={m} rotulo={`${m} min`} ativa={minutos === m} aoTocar={() => setMinutos(m)} />
        ))}
      </View>
      <T tipo="apagado">
        {relogio(segundosDaSessao(plano.totalCiclos))} · {plano.totalCiclos} respirações. Se puder, fique num lugar
        tranquilo. A tela fica acesa até o fim.
      </T>
      <Botao rotulo="Começar" corFundo={corJornada.roxo} aoTocar={() => setEtapa("sessao")} estilo={{ marginTop: espaco.sm }} />
    </Tela>
  );
}

function MantemAcesa() {
  useKeepAwake("dc-meditar");
  return null;
}

function Sessao({
  plano,
  aoTerminar,
  aoSairCedo,
}: {
  plano: Plano;
  aoTerminar: (segundos: number) => void;
  aoSairCedo: () => void;
}) {
  const total = segundosDaSessao(plano.totalCiclos);
  const [t, setT] = useState(0);
  const [pausada, setPausada] = useState(false);
  const base = useRef({ inicio: Date.now(), acumulado: 0 });
  const terminou = useRef(false);
  const escala = useRef(new Animated.Value(0.55)).current;
  const faseAnterior = useRef<Fase | null>(null);

  useEffect(() => {
    if (pausada) return;
    base.current.inicio = Date.now();
    const id = setInterval(() => {
      const agora = base.current.acumulado + (Date.now() - base.current.inicio) / 1000;
      setT(agora);
    }, 200);
    return () => {
      clearInterval(id);
      base.current.acumulado += (Date.now() - base.current.inicio) / 1000;
    };
  }, [pausada]);

  const inst = instanteNoTempo(Math.min(t, total - 0.001));

  /* A cada troca de fase: o círculo anda até o alvo no tempo que resta, e um toque leve. */
  useEffect(() => {
    if (pausada) {
      escala.stopAnimation();
      /* Ao continuar, a fase atual recomeça o desenho de onde está. */
      faseAnterior.current = null;
      return;
    }
    if (faseAnterior.current === inst.fase && t > 0.3) return;
    faseAnterior.current = inst.fase;
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const restante = DURACAO_DA_FASE[inst.fase] * (1 - inst.progresso) * 1000;
    if (inst.fase === "segure") return;
    Animated.timing(escala, {
      toValue: inst.fase === "inspire" ? 1 : 0.55,
      duration: Math.max(200, restante),
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: true,
    }).start();
  }, [inst.fase, inst.ciclo, pausada, escala, t, inst.progresso]);

  useEffect(() => {
    if (t >= total && !terminou.current) {
      terminou.current = true;
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      aoTerminar(total);
    }
  }, [t, total, aoTerminar]);

  /* A fala mais recente até este ciclo — ela fica na tela até a próxima. */
  const fala = useMemo(() => {
    for (let c = inst.ciclo; c >= 0; c--) {
      const f = falaNoCiclo(plano, c);
      if (f) return f.texto;
    }
    return null;
  }, [plano, inst.ciclo]);

  const podeContar = contaComoFeita(t);

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: corJornada.roxoNevoa }}>
      {Platform.OS !== "web" ? <MantemAcesa /> : null}
      <View style={{ paddingHorizontal: espaco.lg, paddingTop: espaco.sm }}>
        <BarraDoTopo fechar progresso={t / total} aoSair={aoSairCedo} />
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: espaco.xl, paddingHorizontal: espaco.xl }}>
        <View style={{ width: 270, height: 270, alignItems: "center", justifyContent: "center" }}>
          <View
            style={{
              position: "absolute",
              width: 270,
              height: 270,
              borderRadius: 135,
              borderWidth: 2,
              borderColor: corJornada.roxoClaro,
              borderStyle: "dashed",
            }}
          />
          <Animated.View
            style={{
              position: "absolute",
              width: 250,
              height: 250,
              borderRadius: 125,
              backgroundColor: corJornada.roxoClaro,
              opacity: 0.55,
              transform: [{ scale: escala }],
            }}
          />
          <Animated.View
            style={{
              position: "absolute",
              width: 190,
              height: 190,
              borderRadius: 95,
              backgroundColor: corJornada.roxoMedio,
              transform: [{ scale: escala }],
            }}
          />
          <Text style={{ fontFamily: fonte.titulo, fontSize: 30, color: cor.branco }}>{ROTULO_DA_FASE[inst.fase]}</Text>
          <Text style={{ fontFamily: fonte.titulo, fontSize: 22, color: "#ede9fe", fontVariant: ["tabular-nums"] }}>
            {inst.restante}
          </Text>
        </View>
        <View style={{ minHeight: 96, justifyContent: "center" }}>
          {fala ? (
            <Text style={{ fontFamily: fonte.media, fontSize: 18, lineHeight: 27, color: corJornada.roxoEscuro, textAlign: "center" }}>
              {fala}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={{ padding: espaco.lg, gap: espaco.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: espaco.lg }}>
          <Text style={{ fontFamily: fonte.forte, fontSize: 16, color: cor.textoApagado, fontVariant: ["tabular-nums"] }}>
            faltam {relogio(total - t)}
          </Text>
          <BotaoRedondo rotulo={pausada ? "Continuar" : "Pausar"} aoTocar={() => setPausada((p) => !p)} fundo={cor.cartao}>
            {pausada ? <Play size={20} color={corJornada.roxo} /> : <Pause size={20} color={corJornada.roxo} />}
          </BotaoRedondo>
        </View>
        <Botao
          rotulo={podeContar ? "Terminar agora" : "Sair"}
          tipo="secundario"
          aoTocar={() => {
            if (podeContar && !terminou.current) {
              terminou.current = true;
              aoTerminar(t);
            } else aoSairCedo();
          }}
          estilo={{ borderRadius: raio.pilula }}
        />
      </View>
    </SafeAreaView>
  );
}
