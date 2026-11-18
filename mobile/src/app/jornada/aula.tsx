import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { BookOpen, Check, Lightbulb, ListChecks, X } from "lucide-react-native";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  findNodeHandle,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isMultiQuestion, type DailyQuiz } from "@/lib/daily-quizzes";
import { carregarAulaDoDia } from "~/lib/jornada/aulas-do-app";
import {
  Cartao,
  Carregando,
  NaoConsegueLer,
  selecao,
  Sobrelinha,
  sucesso,
  T,
} from "~/componentes/base";
import { BotaoDaAtividade } from "~/componentes/jornada/atividade";
import { FundoDeLuz } from "~/componentes/luz";
import {
  ArteDaBolha,
  Entrada,
  useMolaDeToque,
  useMovimentoReduzido,
} from "~/componentes/movimento";
import { corJornada } from "~/componentes/jornada/cores";
import { concluirMomento, FimDoMomento, type Desfecho } from "~/componentes/jornada/fim";
import { pagarAula } from "~/componentes/jornada/economia";
import { useBalanco, useQuique } from "~/componentes/jornada/efeitos";
import { BarraDoTopo, Bolha, BolhaFalando, voltarParaJornada } from "~/componentes/jornada/pecas";
import { AberturaDaAula } from "~/componentes/jornada/abertura-da-aula";
import { useAtividade, useJornada } from "~/componentes/jornada/usarJornada";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import {
  comecarPerguntas,
  continuar,
  corretas,
  escolher,
  estadoDaOpcao,
  INICIO_DA_AULA,
  podeVerificar,
  dividirLicao,
  revisao,
  verificar,
  type EstadoDaAula,
} from "~/lib/jornada/aula";
import { tocarConquista } from "~/lib/audio/som-de-conquista";
import { feito, flagsDoDia, sementesDaAula } from "~/lib/jornada/momentos";
import { clarear, comAlfa } from "~/lib/cor";
import {
  ALVO_MINIMO,
  canto,
  cor,
  curva,
  escala,
  espaco,
  fonte,
  luz,
  sombra,
  sombraFlutuante,
} from "~/tema";
import { AvisoMedico } from "~/componentes/aviso-medico";

/**
 * A AULA DO DIA — "a professora do app".
 *
 * Lição → perguntas (uma tentativa cada: Verificar mostra certo/errado e o
 * porquê; Continuar anda) → fim, que paga 5 + 3 por acerto.
 *
 * Só a aula de HOJE abre: dia passado mostra na trilha se foi feito, e não
 * reabre. Se o banco de aulas não descer, o desafio do dia (local) entra no
 * lugar — o momento do dia não fica refém da rede.
 *
 * Abre com a abertura de 1,5 s na cor da semana (`AberturaDaAula`, o
 * `QuizIntro` do site), que o banco de aulas aproveita para descer.
 *
 * 18/11/2026 (a vistoria: "três telas de site coladas, e não uma lição"): a
 * lição, as perguntas e a revisão moram numa CASCA só, que não desmonta — o
 * topo (o X de vidro e a barra que anda) e o pé (o botão) ficam parados, e só
 * o miolo troca. O veredito é uma folha que sobe por trás do botão, com a
 * bolha reagindo dentro dela, onde ela está olhando. Sair no meio pergunta
 * antes (pelo X, pelo gesto de voltar ou pelo voltar do Android).
 *
 * Bancada: /jornada/aula?bancada=1 (com a abertura)
 *   [&etapa=licao|pergunta|verificada|fim|feita]
 *   [&acertou=1 (o veredito certo)] [&acertos=0 (o fim com 0)] [&espera=1 (o fim somando)]
 *   [&fechou=1 (a aula fechou o dia: o troféu, as cinco estrelas e o bônus)]
 */
export default function Aula() {
  const { dia, loja } = useJornada();
  /* A abertura só vale para a aula de HOJE ainda por fazer (e nunca no luto
     nem no pós-parto, que não têm aula). Na bancada, `&etapa=` a dispensa. */
  const [abertura, setAbertura] = useState<"decidindo" | "mostrando" | "saindo" | "feita">(
    "decidindo",
  );
  useEffect(() => {
    if (abertura !== "decidindo" || dia.modo === "carregando") return;
    if (dia.modo !== "gestacao" || dia.cuidado) return setAbertura("feita");
    if (ehBancada()) return setAbertura(parametroDaBancada("etapa") ? "feita" : "mostrando");
    if (!loja.pronto) return;
    setAbertura(feito(flagsDoDia(loja.blob, dia.D), "aula") ? "feita" : "mostrando");
  }, [abertura, dia, loja.pronto, loja.blob]);
  return (
    <View style={{ flex: 1 }}>
      <AulaDoDia cortina={abertura === "decidindo" || abertura === "mostrando"} />
      {(abertura === "mostrando" || abertura === "saindo") && dia.modo === "gestacao" ? (
        <AberturaDaAula
          semana={dia.semana}
          nomeDoBebe={(dia.perfil.baby_name ?? "").trim() || null}
          aoComecarASair={() => setAbertura("saindo")}
          aoTerminar={() => setAbertura("feita")}
        />
      ) : null}
    </View>
  );
}

const TITULO_DA_SAIDA = "Sair da aula?";
const TEXTO_DA_SAIDA = "As respostas de hoje não ficam guardadas. Você pode recomeçar depois.";

/** O "tem certeza?" do iPhone. Na web (a bancada), o `confirm` do navegador. */
function confirmarSaida(sair: () => void) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${TITULO_DA_SAIDA}\n\n${TEXTO_DA_SAIDA}`))
      sair();
    return;
  }
  Alert.alert(TITULO_DA_SAIDA, TEXTO_DA_SAIDA, [
    { text: "Continuar a aula", style: "cancel" },
    { text: "Sair", style: "destructive", onPress: sair },
  ]);
}

/** O "não" do corpo no erro: um toque macio, sem repreender. */
function toqueMacio() {
  if (Platform.OS === "web") return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
}

function AulaDoDia({ cortina }: { cortina: boolean }) {
  const at = useAtividade("aula");
  const navigation = useNavigation();
  const [quiz, setQuiz] = useState<DailyQuiz | null | "carregando">("carregando");
  const [tentativa, setTentativa] = useState(0);
  const [e, setE] = useState<EstadoDaAula>(INICIO_DA_AULA);
  const [desfecho, setDesfecho] = useState<Desfecho | null>(null);
  const [bancadaAplicada, setBancadaAplicada] = useState(false);
  /* "Revisar as respostas": a aula de hoje já feita, de novo, com o gabarito. */
  const [revisando, setRevisando] = useState(false);
  const rolagem = useRef<ScrollView>(null);
  const [alturaDoPe, setAlturaDoPe] = useState(0);
  const [alturaDaFolha, setAlturaDaFolha] = useState(0);
  const refDoVeredito = useRef<View>(null);

  /* SAIR NO MEIO: com uma resposta já verificada, qualquer saída (o X, o gesto
     de voltar pela borda, o voltar do Android) pergunta antes — as respostas
     vivem só nesta tela. Vale nos dois jeitos de abrir a aula (empilhada ou
     subindo de baixo): o gesto nativo também é barrado. Na lição, na revisão e
     no fim, sai direto. */
  const noMeio = e.etapa === "pergunta" && !revisando && (e.indice > 0 || e.verificada);
  const saidaLivre = useRef(false);
  usePreventRemove(noMeio, ({ data }) => {
    if (saidaLivre.current) return navigation.dispatch(data.action);
    confirmarSaida(() => {
      saidaLivre.current = true;
      navigation.dispatch(data.action);
    });
  });

  /* O DIA DA AULA fica preso ao dia em que a tela abriu. Quem começa às 23h58
     termina a aula de ONTEM (o servidor aceita ±1 dia) — antes, a virada da
     meia-noite trocava as perguntas no meio, misturava o placar de dois dias
     e travava a tela quando o dia novo tinha uma pergunta a menos. Uma tela
     esquecida aberta por mais de um dia volta para a jornada: aquela aula já
     não vale mais. */
  const [diaDaAula, setDiaDaAula] = useState<number | null>(null);
  useEffect(() => {
    if (at.D == null) return;
    if (diaDaAula == null) setDiaDaAula(at.D);
    else if (at.D - diaDaAula > 1) {
      saidaLivre.current = true;
      voltarParaJornada();
    }
  }, [at.D, diaDaAula]);
  const D = diaDaAula ?? at.D;

  useEffect(() => {
    if (D == null || at.pos || at.cuidado) return;
    let vivo = true;
    setQuiz("carregando");
    void carregarAulaDoDia(D).then((q) => {
      if (vivo) setQuiz(q);
    });
    return () => {
      vivo = false;
    };
  }, [D, at.pos, at.cuidado, tentativa]);

  /* Bancada: os estados intermediários entram pelo MESMO useState. */
  useEffect(() => {
    if (bancadaAplicada || !ehBancada() || !quiz || quiz === "carregando") return;
    setBancadaAplicada(true);
    const etapa = parametroDaBancada("etapa");
    const qs = quiz.questions;
    if (etapa === "pergunta") setE(comecarPerguntas(INICIO_DA_AULA));
    if (etapa === "verificada" && qs.length > 1) {
      let x = verificar(
        escolher(
          comecarPerguntas(INICIO_DA_AULA),
          qs[0],
          Array.isArray(qs[0].a) ? qs[0].a[0] : qs[0].a,
        ),
        qs[0],
      );
      x = continuar(x, qs.length);
      const q = qs[1];
      if (parametroDaBancada("acertou") === "1") {
        for (const i of corretas(q)) x = escolher(x, q, i);
      } else {
        const errada = q.o.findIndex((_, i) => !corretas(q).includes(i));
        x = escolher(x, q, corretas(q)[0]);
        if (errada >= 0) x = escolher(x, q, errada);
      }
      setE(verificar(x, q));
    }
    if (etapa === "fim") {
      const pedidos = parametroDaBancada("acertos");
      const acertos =
        pedidos != null && Number.isFinite(Number(pedidos))
          ? Math.max(0, Math.min(qs.length, Number(pedidos)))
          : Math.max(0, qs.length - 1);
      const fechou = parametroDaBancada("fechou") === "1";
      setE({ ...INICIO_DA_AULA, etapa: "fim", acertos });
      if (parametroDaBancada("espera") !== "1") {
        setDesfecho({
          ganhou: sementesDaAula(acertos),
          fechou,
          bonus: fechou ? 20 : null,
          semPagamento: false,
        });
      }
    }
  }, [quiz, bancadaAplicada]);

  /* O fim da aula: marca e paga uma vez só. */
  useEffect(() => {
    if (
      e.etapa !== "fim" ||
      desfecho ||
      !at.uid ||
      (ehBancada() && parametroDaBancada("etapa") === "fim")
    )
      return;
    let vivo = true;
    /* A comemoração do site, para quem acertou alguma (calada no luto, à
       noite e depois da terceira do dia). */
    if (e.acertos > 0) void tocarConquista({ cuidado: at.cuidado });
    void concluirMomento({
      uid: at.uid,
      D,
      momento: "aula",
      cuidado: at.cuidado,
      pos: at.pos,
      acertos: e.acertos,
    }).then((d) => {
      if (vivo) setDesfecho(d);
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e.etapa]);

  /* Pergunta nova: o miolo volta ao alto (e entra subindo, pela `Entrada`). */
  useEffect(() => {
    if (e.etapa === "pergunta") rolagem.current?.scrollTo({ y: 0, animated: false });
  }, [e.etapa, e.indice]);

  /* O veredito: a folha sobe, e o leitor de tela vai direto ao "Isso mesmo!"
     e ao porquê (no Android, o anúncio sai no toque do Verificar). */
  useEffect(() => {
    if (e.etapa !== "pergunta" || !e.verificada || Platform.OS !== "ios") return;
    const foco = setTimeout(() => {
      const no = findNodeHandle(refDoVeredito.current);
      if (no) AccessibilityInfo.setAccessibilityFocus(no);
    }, 450);
    return () => clearTimeout(foco);
  }, [e.etapa, e.indice, e.verificada]);
  /* O que ficou por baixo da folha rola para cima dela (depois de a folha se
     medir: é a altura dela que abre o espaço no fim do miolo). */
  useEffect(() => {
    if (e.etapa !== "pergunta" || !e.verificada || !alturaDaFolha) return;
    const rola = setTimeout(() => rolagem.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(rola);
  }, [e.etapa, e.indice, e.verificada, alturaDaFolha]);

  const aoMedirPe = (h: number) => setAlturaDoPe((a) => (Math.abs(a - h) < 1 ? a : h));
  const aoMedirFolha = (h: number) => setAlturaDaFolha((a) => (Math.abs(a - h) < 1 ? a : h));
  const topoSimples = <BarraDoTopo fechar titulo="Aula de hoje" />;

  if (!at.pronto) {
    return (
      <CascaDaAula refDaRolagem={rolagem} topo={topoSimples}>
        <Carregando texto="Abrindo a aula…" />
      </CascaDaAula>
    );
  }

  /* A aula acompanha a gestação: no luto e no pós-parto ela não existe. */
  if (at.cuidado || at.pos || D == null) {
    return (
      <CascaDaAula
        refDaRolagem={rolagem}
        topo={topoSimples}
        pe={<BotaoDaAtividade rotulo="Voltar" aoTocar={voltarParaJornada} cor={corJornada.roxo} />}
        aoMedirPe={aoMedirPe}
      >
        <T>
          A aula do dia acompanha as semanas da gestação. Os outros momentos do dia continuam
          abertos.
        </T>
      </CascaDaAula>
    );
  }

  if (at.jaFeita && !revisando && e.etapa !== "fim") {
    const qs = quiz && quiz !== "carregando" ? quiz.questions : null;
    return (
      <CascaDaAula
        refDaRolagem={rolagem}
        topo={topoSimples}
        pe={
          qs && qs.length ? (
            <BotaoDaAtividade
              rotulo="Revisar as respostas"
              cor={corJornada.roxo}
              aoTocar={() => {
                setRevisando(true);
                setE(revisao(qs[0], 0));
              }}
            />
          ) : null
        }
        aoMedirPe={aoMedirPe}
      >
        <BolhaFalando humor="estudiosa" fala="Você já fez a aula de hoje. Amanhã tem outra." />
        {quiz && quiz !== "carregando" ? <Licao quiz={quiz} /> : null}
      </CascaDaAula>
    );
  }

  if (quiz === "carregando") {
    return (
      <CascaDaAula refDaRolagem={rolagem} topo={topoSimples}>
        <Carregando texto="Preparando a aula de hoje…" />
      </CascaDaAula>
    );
  }

  if (!quiz) {
    return (
      <CascaDaAula refDaRolagem={rolagem} topo={topoSimples}>
        <NaoConsegueLer
          sossego="A aula deste dia não abriu. Tente de novo em instantes."
          aoTentar={() => setTentativa((t) => t + 1)}
        />
      </CascaDaAula>
    );
  }

  const total = quiz.questions.length;

  if (e.etapa === "fim") {
    /* Três caras para três resultados: a festa é de quem GABARITOU; no meio, a
       piscadinha orgulhosa; zerando, ela fica feliz e parada — qualquer reação
       ali viraria comentário sobre o desempenho dela. */
    const perfeito = e.acertos === total;
    const titulo = perfeito
      ? "Acertou tudo!"
      : e.acertos >= total - 1
        ? "Quase perfeito!"
        : e.acertos > 0
          ? "Muito bem!"
          : "Aula feita";
    return (
      <CascaDaFesta>
        <FimDoMomento
          titulo={titulo}
          momento="aula"
          acertos={{ feitos: e.acertos, total }}
          arte={
            <Bolha
              humor={perfeito ? "comemorando" : e.acertos > 0 ? "orgulhosa" : "feliz"}
              tamanho={210}
            />
          }
          confete={e.acertos > 0 ? (perfeito ? "grande" : true) : false}
          desfecho={desfecho}
          D={D}
          cuidado={false}
          pos={false}
          aoTentarPagar={async () => {
            const g = await pagarAula(D, e.acertos);
            setDesfecho((d) => (d ? { ...d, ganhou: g } : d));
          }}
        />
      </CascaDaFesta>
    );
  }

  const licao = e.etapa === "licao";
  const q = quiz.questions[Math.min(e.indice, total - 1)];
  const multi = isMultiQuestion(q);
  const ultima = e.indice + 1 >= total;
  /* A barra anda de verdade: a lição é o primeiro passo, e cada pergunta
     verificada é mais um. Nunca aparece vazia. */
  const passo = licao ? 1 : e.indice + 1 + (e.verificada ? 1 : 0);

  const tituloDoVeredito = revisando
    ? multi
      ? "As respostas certas"
      : "A resposta certa"
    : e.acertou
      ? "Isso mesmo!"
      : multi
        ? "As certas estão em verde"
        : "A certa está em verde";

  /* O pé: UM botão, que só troca de rótulo (e acende quando pode). */
  const botao = licao
    ? {
        rotulo: "Vamos às perguntas",
        aoTocar: () => setE(comecarPerguntas(e)),
        desabilitado: false,
        vibrar: true,
      }
    : !e.verificada
      ? {
          rotulo: "Verificar",
          desabilitado: !podeVerificar(e),
          vibrar: false,
          aoTocar: () => {
            const x = verificar(e, q);
            /* Acerto: a notificação de sucesso. Erro: um toque macio — o
               corpo diz "não" sem repreender. */
            if (x.acertou) sucesso();
            else toqueMacio();
            if (Platform.OS === "android") {
              AccessibilityInfo.announceForAccessibility(
                `${x.acertou ? "Isso mesmo!" : multi ? "As certas estão em verde" : "A certa está em verde"}. ${q.why}`,
              );
            }
            setE(x);
          },
        }
      : {
          rotulo: ultima ? (revisando ? "Terminar a revisão" : "Terminar") : "Continuar",
          desabilitado: false,
          vibrar: true,
          aoTocar: () => {
            if (!revisando) return setE(continuar(e, total));
            /* Na revisão não há fim nem pagamento: volta para a aula feita. */
            if (ultima) {
              setRevisando(false);
              setE(INICIO_DA_AULA);
              return;
            }
            setE(revisao(quiz.questions[e.indice + 1], e.indice + 1));
          },
        };

  return (
    <CascaDaAula
      refDaRolagem={rolagem}
      topo={<BarraDoTopo fechar progresso={passo / (total + 1)} />}
      aoMedirPe={aoMedirPe}
      pe={<BotaoDaAtividade cor={corJornada.roxo} {...botao} />}
      camada={
        licao ? null : (
          <FolhaDoVeredito
            visivel={e.verificada}
            acertou={!!e.acertou}
            titulo={tituloDoVeredito}
            porque={q.why}
            alturaDoPe={alturaDoPe}
            aoMedir={aoMedirFolha}
            refDoTexto={refDoVeredito}
          />
        )
      }
    >
      {licao ? (
        /* Quando a cortina da abertura se desfaz, a lição entra subindo (e não
           aparece parada por baixo dela). */
        <Entrada key={cortina ? "atras" : "licao"} deslocamento={16} estilo={{ gap: espaco.md }}>
          <BolhaFalando
            humor="estudiosa"
            fala={`Leia com calma. Depois vêm ${total} perguntas, e você tem uma chance em cada.`}
          />
          <Licao quiz={quiz} />
          <AvisoMedico curto />
        </Entrada>
      ) : (
        <Entrada key={`p${e.indice}`} deslocamento={14} estilo={{ gap: espaco.md }}>
          <Sobrelinha tinta={corJornada.roxo}>
            Pergunta {e.indice + 1} de {total}
          </Sobrelinha>
          <View style={{ gap: espaco.sm }}>
            <Text
              accessibilityRole="header"
              style={{ ...fonte.display, ...escala.titulo2, letterSpacing: -0.2, color: cor.texto }}
            >
              {q.q}
            </Text>
            {multi ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <ListChecks size={16} color={cor.textoApagado} strokeWidth={2.2} />
                <Text style={{ ...fonte.media, ...escala.legenda, color: cor.textoApagado }}>
                  Marque todas as certas
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ gap: espaco.sm, marginTop: espaco.xs }}>
            {q.o.map((texto, i) => (
              <Opcao
                key={i}
                letra={String.fromCharCode(65 + i)}
                texto={texto}
                multi={multi}
                estado={estadoDaOpcao(e, q, i)}
                travada={e.verificada}
                aoTocar={() => setE(escolher(e, q, i))}
              />
            ))}
          </View>
          {/* Com a folha do veredito em cima, o fim das opções ainda sobe
              acima dela. */}
          <View
            style={{
              height: e.verificada
                ? Math.max(0, alturaDaFolha - (espaco.xl + ESMAECER) + espaco.md)
                : 0,
            }}
          />
        </Entrada>
      )}
    </CascaDaAula>
  );
}

/* ── As cascas ─────────────────────────────────────────────────────────── */

/** O texto que some por baixo do pé, em vez de ser cortado nele. */
const ESMAECER = 28;

/**
 * A CASCA DA AULA: o topo fixo, o miolo que rola e o pé fixo. A luz do fundo
 * vai até o pé; o texto some por baixo dele num esmaecido de 28 pt. A
 * `camada` (a folha do veredito) fica entre o miolo e o pé: sobe por trás do
 * botão, que nunca sai do lugar.
 */
function CascaDaAula({
  topo,
  children,
  pe,
  camada,
  refDaRolagem,
  aoMedirPe,
}: {
  topo: ReactNode;
  children: ReactNode;
  pe?: ReactNode;
  camada?: ReactNode;
  refDaRolagem?: RefObject<ScrollView | null>;
  aoMedirPe?: (altura: number) => void;
}) {
  const area = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: luz.base, overflow: "hidden" }}>
      <View style={{ flex: 1 }}>
        <FundoDeLuz />
        <View style={{ paddingTop: area.top + espaco.sm, paddingHorizontal: espaco.lg }}>
          {topo}
        </View>
        <ScrollView
          ref={refDaRolagem}
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: espaco.lg,
            gap: espaco.md,
            paddingBottom: pe ? espaco.xl + ESMAECER : area.bottom + espaco.xl,
          }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {pe ? (
          <LinearGradient
            pointerEvents="none"
            colors={[comAlfa(luz.base, 0), luz.base]}
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: ESMAECER }}
          />
        ) : null}
      </View>
      {camada}
      {pe ? (
        <View
          onLayout={(ev) => aoMedirPe?.(ev.nativeEvent.layout.height)}
          style={{
            paddingHorizontal: espaco.lg,
            paddingTop: espaco.xs,
            paddingBottom: area.bottom + espaco.md,
          }}
        >
          {pe}
        </View>
      ) : null}
    </View>
  );
}

/**
 * A CASCA DA FESTA: a luz até as bordas e uma rolagem que só rola quando o
 * conteúdo não cabe (num iPhone pequeno, com o aviso de pagamento). O confete
 * do fim cai da borda de cima da tela, por cima de tudo.
 */
function CascaDaFesta({ children }: { children: ReactNode }) {
  const area = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: luz.base }}>
      <FundoDeLuz />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: area.top + espaco.lg,
          paddingBottom: area.bottom + espaco.lg,
          paddingHorizontal: espaco.lg,
        }}
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/* ── O veredito ────────────────────────────────────────────────────────── */

/**
 * A FOLHA DO VEREDITO: sobe de baixo (a altura dela inteira, numa mola no fio
 * nativo) por trás do botão, na cor do resultado — o verde do acerto ou o
 * "quase", âmbar e sem alarme. A bolha reage aqui dentro: festeja o acerto e,
 * no erro, só fica por perto, feliz, sem comentário.
 */
function FolhaDoVeredito({
  visivel,
  acertou,
  titulo,
  porque,
  alturaDoPe,
  aoMedir,
  refDoTexto,
}: {
  visivel: boolean;
  acertou: boolean;
  titulo: string;
  porque: string;
  alturaDoPe: number;
  /** A altura que a folha cobre do miolo (acima do pé). */
  aoMedir: (altura: number) => void;
  refDoTexto: RefObject<View | null>;
}) {
  const reduzido = useMovimentoReduzido();
  const [altura, setAltura] = useState(0);
  const v = useRef(new Animated.Value(0)).current;
  /* O que a folha mostra fica preso ao último veredito: ao descer, ela não
     troca para o porquê da pergunta seguinte. */
  const ultimo = useRef<{ acertou: boolean; titulo: string; porque: string } | null>(null);
  if (visivel) ultimo.current = { acertou, titulo, porque };
  useEffect(() => {
    if (visivel) {
      if (reduzido) return v.setValue(1);
      v.setValue(0);
      Animated.spring(v, { toValue: 1, speed: 14, bounciness: 4, useNativeDriver: true }).start();
      return;
    }
    Animated.timing(v, {
      toValue: 0,
      duration: reduzido ? 1 : 180,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [visivel, reduzido, v]);
  const c = ultimo.current;
  const fora = (altura || 480) + 24;
  return (
    <Animated.View
      pointerEvents={visivel ? "auto" : "none"}
      accessibilityElementsHidden={!visivel}
      importantForAccessibility={visivel ? "auto" : "no-hide-descendants"}
      onLayout={(ev) => setAltura(ev.nativeEvent.layout.height)}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: TOPO_DA_FOLHA,
        paddingHorizontal: espaco.lg,
        paddingBottom: alturaDoPe + espaco.xs,
        borderTopLeftRadius: CANTO_DA_FOLHA,
        borderTopRightRadius: CANTO_DA_FOLHA,
        ...curva,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: cor.branco,
        backgroundColor: c?.acertou ? cor.acertoFundo : cor.quaseFundo,
        ...sombraFlutuante,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [fora, 0] }) }],
      }}
    >
      {c ? (
        <View
          ref={refDoTexto}
          accessible
          accessibilityLabel={`${c.titulo}. ${c.porque}`}
          accessibilityLiveRegion="polite"
          /* O quanto a folha cobre do miolo: o texto dela, acima do pé. */
          onLayout={(ev) => aoMedir(TOPO_DA_FOLHA + ev.nativeEvent.layout.height + espaco.xs)}
          style={{ gap: espaco.sm }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
            <ArteDaBolha humor={c.acertou ? "comemorando" : "feliz"} tamanho={64} />
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
              {c.acertou ? (
                <Check size={22} color={cor.sementinha} strokeWidth={3} />
              ) : (
                <Lightbulb size={20} color={cor.quase} strokeWidth={2.4} />
              )}
              <Text
                style={{
                  flex: 1,
                  ...fonte.forte,
                  ...escala.titulo3,
                  color: c.acertou ? cor.sementinha : cor.quase,
                }}
              >
                {c.titulo}
              </Text>
            </View>
          </View>
          <Text style={{ ...fonte.normal, ...escala.corpo, color: cor.texto }}>{c.porque}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const CANTO_DA_FOLHA = 28;
const TOPO_DA_FOLHA = espaco.lg + 2;

/* ── A lição ───────────────────────────────────────────────────────────── */

function Licao({ quiz }: { quiz: DailyQuiz }) {
  const { titulo, corpo } = dividirLicao(quiz.teach);
  return (
    <>
      <Cartao>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <BookOpen size={15} color={corJornada.roxo} strokeWidth={2.4} />
          <Sobrelinha tinta={corJornada.roxo}>A lição de hoje</Sobrelinha>
        </View>
        {/* A lição se lê como um artigo: o título na serifada e o corpo com ar. */}
        {titulo ? (
          <Text
            accessibilityRole="header"
            style={{ ...fonte.display, ...escala.titulo2, letterSpacing: -0.2, color: cor.texto }}
          >
            {titulo}
          </Text>
        ) : null}
        <Text style={{ ...fonte.normal, ...escala.corpo, lineHeight: 26, color: cor.textoCorpo }}>
          {corpo}
        </Text>
      </Cartao>
      {quiz.funFact ? (
        /* A curiosidade é material neutro, com o selo da lâmpada no roxo da
           aula: o âmbar fica só para o "quase" do veredito. */
        <Cartao>
          <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: corJornada.roxoFundo,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Lightbulb size={16} color={corJornada.roxo} strokeWidth={2.4} />
            </View>
            <T tipo="rotulo">Você sabia?</T>
          </View>
          <Text
            style={{ ...fonte.normal, ...escala.chamada, lineHeight: 23, color: cor.textoCorpo }}
          >
            {quiz.funFact}
          </Text>
        </Cartao>
      ) : null}
    </>
  );
}

/* ── A opção ───────────────────────────────────────────────────────────── */

type EstadoDaOpcao = ReturnType<typeof estadoDaOpcao>;

/** O aro da errada: o "quase" um tom mais claro (o X fica na cor cheia). */
const ARO_DO_QUASE = clarear(cor.quase, 0.2);

const VISUAL: Record<EstadoDaOpcao, { borda: string; fundo: string; selo: string; marca: string }> =
  {
    neutra: { borda: cor.branco, fundo: luz.cartao, selo: cor.apagado, marca: cor.textoApagado },
    escolhida: {
      borda: corJornada.roxo,
      fundo: corJornada.roxoFundo,
      selo: corJornada.roxo,
      marca: cor.branco,
    },
    certa: {
      borda: cor.sementinha,
      fundo: cor.acertoFundo,
      selo: cor.sementinha,
      marca: cor.branco,
    },
    /* A certa que ela não marcou: o aro cheio e o check, sem tracejado. */
    faltou: {
      borda: cor.sementinha,
      fundo: luz.cartao,
      selo: cor.acertoFundo,
      marca: cor.sementinha,
    },
    errada: { borda: ARO_DO_QUASE, fundo: cor.quaseFundo, selo: cor.branco, marca: cor.quase },
  };

function Opcao({
  letra,
  texto,
  multi,
  estado,
  travada,
  aoTocar,
}: {
  letra: string;
  texto: string;
  multi: boolean;
  estado: EstadoDaOpcao;
  travada: boolean;
  aoTocar: () => void;
}) {
  const visual = VISUAL[estado];
  const mola = useMolaDeToque(0.975);
  /* A opção reage ao veredito: a certa quica, a errada balança de leve — sem
     vermelho gritando, só o "não" do corpo. */
  const { estilo: estiloQuique, quicar } = useQuique();
  const { estilo: estiloBalanco, balancar } = useBalanco();
  const antes = useRef(estado);
  useEffect(() => {
    if (antes.current === estado) return;
    antes.current = estado;
    if (estado === "certa") quicar();
    else if (estado === "errada") balancar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);
  const marcada = estado === "escolhida" || estado === "certa" || estado === "errada";
  return (
    <Animated.View style={[estiloQuique, estiloBalanco]}>
      <Pressable
        accessibilityRole={multi ? "checkbox" : "radio"}
        accessibilityState={{ checked: marcada, disabled: travada }}
        accessibilityLabel={`${texto}${estado === "certa" || estado === "faltou" ? ", resposta certa" : estado === "errada" ? ", resposta errada" : ""}`}
        disabled={travada}
        onPressIn={mola.aoPressionar}
        onPressOut={mola.aoSoltar}
        onPress={() => {
          selecao();
          aoTocar();
        }}
      >
        {/* A opção é um cartão do app: material branco com o canto do iPhone e
            a sombra em camadas. O aro tem SEMPRE 2 pt (branco na neutra):
            escolher troca só a cor, nunca a medida — as de baixo não pulam. */}
        <Animated.View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: espaco.md,
            minHeight: ALVO_MINIMO + 18,
            paddingVertical: espaco.md,
            paddingHorizontal: 14,
            borderRadius: canto.dentro,
            ...curva,
            borderWidth: 2,
            borderColor: visual.borda,
            backgroundColor: visual.fundo,
            ...sombra,
            transform: [{ scale: mola.escala }],
          }}
        >
          <Selo multi={multi} estado={estado} letra={letra} visual={visual} />
          <Text style={{ flex: 1, ...fonte.media, ...escala.corpo, color: cor.texto }}>
            {texto}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * O selo da opção. Escolha única: um círculo com a letra (o rádio). "Marque
 * todas": um quadrado de canto 9, vazio até ser marcado, e aí com o check
 * branco (a caixinha de marcar) — a forma já diz que dá para marcar várias.
 */
function Selo({
  multi,
  estado,
  letra,
  visual,
}: {
  multi: boolean;
  estado: EstadoDaOpcao;
  letra: string;
  visual: (typeof VISUAL)[EstadoDaOpcao];
}) {
  const caixaVazia = multi && estado === "neutra";
  const marca =
    estado === "certa" || estado === "faltou" || (multi && estado === "escolhida") ? (
      <Check size={18} color={visual.marca} strokeWidth={3} />
    ) : estado === "errada" ? (
      <X size={18} color={visual.marca} strokeWidth={3} />
    ) : multi ? null : (
      <Text style={{ ...fonte.titulo, ...escala.legenda, color: visual.marca }}>{letra}</Text>
    );
  return (
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: multi ? 9 : 17,
        ...curva,
        borderWidth: 2,
        borderColor: caixaVazia ? cor.chevron : estado === "errada" ? ARO_DO_QUASE : visual.selo,
        backgroundColor: caixaVazia ? cor.cartao : visual.selo,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {marca}
    </View>
  );
}
