import * as Haptics from "expo-haptics";
import { Check, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { gestChallenge } from "@/lib/daily-challenges";
import { carregarQuizDoDia, isMultiQuestion, type DailyQuiz } from "@/lib/daily-quizzes";
import { Cartao, Carregando, NaoConsegueLer, T, Tela, toque } from "~/componentes/base";
import { BotaoDaAtividade } from "~/componentes/jornada/atividade";
import { corJornada } from "~/componentes/jornada/cores";
import { concluirMomento, FimDoMomento, type Desfecho } from "~/componentes/jornada/fim";
import { pagarAula } from "~/componentes/jornada/economia";
import { useBalanco, useQuique } from "~/componentes/jornada/efeitos";
import { BarraDoTopo, Bolha, BolhaFalando, voltarParaJornada } from "~/componentes/jornada/pecas";
import { useAtividade } from "~/componentes/jornada/usarJornada";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import {
  comecarPerguntas,
  continuar,
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
import { marcar } from "~/lib/jornada/loja";
import { sementesDaAula } from "~/lib/jornada/momentos";
import { ALVO_MINIMO, cor, espaco, fonte } from "~/tema";
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
 * Bancada: /jornada/aula?bancada=1 [&etapa=pergunta|verificada|fim|feita]
 */
export default function Aula() {
  const at = useAtividade("aula");
  const [quiz, setQuiz] = useState<DailyQuiz | null | "carregando">("carregando");
  const [tentativa, setTentativa] = useState(0);
  const [e, setE] = useState<EstadoDaAula>(INICIO_DA_AULA);
  const [desfecho, setDesfecho] = useState<Desfecho | null>(null);
  const [bancadaAplicada, setBancadaAplicada] = useState(false);
  /* "Revisar as respostas": a aula de hoje já feita, de novo, com o gabarito. */
  const [revisando, setRevisando] = useState(false);
  const D = at.D;

  useEffect(() => {
    if (D == null || at.pos || at.cuidado) return;
    let vivo = true;
    setQuiz("carregando");
    void carregarQuizDoDia(D).then((q) => {
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
      const errada = q.o.findIndex((_, i) => !(Array.isArray(q.a) ? q.a : [q.a]).includes(i));
      const certa = Array.isArray(q.a) ? q.a[0] : q.a;
      x = escolher(x, q, certa);
      if (errada >= 0) x = escolher(x, q, errada);
      setE(verificar(x, q));
    }
    if (etapa === "fim") {
      setE({ ...INICIO_DA_AULA, etapa: "fim", acertos: Math.max(0, qs.length - 1) });
      setDesfecho({
        ganhou: sementesDaAula(Math.max(0, qs.length - 1)),
        fechou: false,
        bonus: null,
        semPagamento: false,
      });
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

  if (!at.pronto) {
    return (
      <Tela bordas={["top", "bottom"]}>
        <Carregando texto="Abrindo a aula…" />
      </Tela>
    );
  }

  /* A aula acompanha a gestação: no luto e no pós-parto ela não existe. */
  if (at.cuidado || at.pos || D == null) {
    return (
      <Tela bordas={["top", "bottom"]}>
        <BarraDoTopo titulo="Aula" />
        <T>
          A aula do dia acompanha as semanas da gestação. Os outros momentos da jornada continuam
          aqui para você.
        </T>
        <BotaoDaAtividade
          rotulo="Voltar para a jornada"
          aoTocar={voltarParaJornada}
          cor={corJornada.roxo}
        />
      </Tela>
    );
  }

  if (at.jaFeita && !revisando && e.etapa !== "fim") {
    const qs = quiz && quiz !== "carregando" ? quiz.questions : null;
    return (
      <Tela bordas={["top", "bottom"]}>
        <BarraDoTopo titulo="Aula de hoje" />
        <BolhaFalando
          humor="estudiosa"
          fala="A aula de hoje já está feita. Amanhã tem outra esperando por você!"
        />
        {quiz && quiz !== "carregando" ? <Licao quiz={quiz} /> : null}
        {qs && qs.length ? (
          <BotaoDaAtividade
            rotulo="Revisar as respostas"
            cor={corJornada.roxo}
            aoTocar={() => {
              setRevisando(true);
              setE(revisao(qs[0], 0));
            }}
          />
        ) : null}
        <BotaoDaAtividade
          claro
          rotulo="Voltar para a jornada"
          aoTocar={voltarParaJornada}
          cor={corJornada.roxo}
        />
      </Tela>
    );
  }

  if (quiz === "carregando") {
    return (
      <Tela bordas={["top", "bottom"]}>
        <BarraDoTopo fechar titulo="Aula de hoje" />
        <Carregando texto="Preparando a aula de hoje…" />
      </Tela>
    );
  }

  if (!quiz) {
    const desafio = gestChallenge(D);
    return (
      <Tela bordas={["top", "bottom"]}>
        <BarraDoTopo fechar titulo="Aula de hoje" />
        <NaoConsegueLer
          sossego="Enquanto a aula não desce, o desafio do dia vale como o momento de hoje."
          aoTentar={() => setTentativa((t) => t + 1)}
        />
        {desafio ? (
          <Cartao>
            <T tipo="rotulo">Desafio do dia {desafio.emoji}</T>
            <T>{desafio.label}</T>
            <BotaoDaAtividade
              rotulo="Fiz o desafio"
              cor={corJornada.roxo}
              aoTocar={() => {
                marcar(D, "aula");
                voltarParaJornada();
              }}
            />
          </Cartao>
        ) : null}
      </Tela>
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
          : "Anotado!";
    return (
      <Tela bordas={["top", "bottom"]}>
        <FimDoMomento
          titulo={titulo}
          fala={`${e.acertos} de ${total} acertos`}
          arte={
            <Bolha
              humor={perfeito ? "comemorando" : e.acertos > 0 ? "orgulhosa" : "feliz"}
              tamanho={150}
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
      </Tela>
    );
  }

  if (e.etapa === "licao") {
    return (
      <Tela bordas={["top", "bottom"]}>
        <BarraDoTopo fechar progresso={0} />
        <BolhaFalando
          humor="estudiosa"
          fala={`Leia a lição com calma. Depois vêm ${total} perguntas, com uma tentativa em cada.`}
        />
        <Licao quiz={quiz} />
        <BotaoDaAtividade
          rotulo={`Vamos às perguntas (${total})`}
          cor={corJornada.roxo}
          aoTocar={() => setE(comecarPerguntas(e))}
        />
        <AvisoMedico curto />
      </Tela>
    );
  }

  const q = quiz.questions[e.indice];
  const multi = isMultiQuestion(q);
  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: cor.fundo }}>
      <View style={{ paddingHorizontal: espaco.lg, paddingTop: espaco.sm }}>
        <BarraDoTopo fechar progresso={(e.indice + (e.verificada ? 1 : 0)) / total} />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: espaco.lg, gap: espaco.md, paddingBottom: espaco.xl }}
      >
        <Text
          style={{
            fontFamily: fonte.forte,
            fontSize: 14,
            color: corJornada.roxo,
            letterSpacing: 0.4,
          }}
        >
          PERGUNTA {e.indice + 1} DE {total}
          {multi ? " · MARQUE TODAS AS CERTAS" : ""}
        </Text>
        <T tipo="subtitulo" estilo={{ fontSize: 21, lineHeight: 28 }}>
          {q.q}
        </T>
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
      </ScrollView>
      <View
        style={{
          padding: espaco.lg,
          gap: espaco.md,
          borderTopWidth: 1,
          borderTopColor: e.verificada ? "transparent" : cor.borda,
          backgroundColor: !e.verificada
            ? cor.fundo
            : e.acertou
              ? corJornada.feitoFundo
              : AMBAR.fundo,
        }}
      >
        {e.verificada ? (
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
              {e.acertou ? (
                <Check size={24} color={corJornada.feito} strokeWidth={3} />
              ) : (
                <Text style={{ fontSize: 20 }}>💡</Text>
              )}
              <T tipo="subtitulo" cor={e.acertou ? cor.sementinha : AMBAR.texto}>
                {revisando
                  ? "A resposta certa"
                  : e.acertou
                    ? "Isso mesmo!"
                    : multi
                      ? "Quase! Olhe as marcadas em verde"
                      : "A certa está em verde"}
              </T>
            </View>
            <T tipo="corpo" cor={cor.texto}>
              {q.why}
            </T>
          </View>
        ) : null}
        {e.verificada ? (
          <BotaoDaAtividade
            rotulo={
              e.indice + 1 >= total ? (revisando ? "Terminar a revisão" : "Terminar") : "Continuar"
            }
            cor={e.acertou ? corJornada.feito : corJornada.roxo}
            aoTocar={() => {
              if (!revisando) return setE(continuar(e, total));
              /* Na revisão não há fim nem pagamento: volta para a aula feita. */
              if (e.indice + 1 >= total) {
                setRevisando(false);
                setE(INICIO_DA_AULA);
                return;
              }
              setE(revisao(quiz.questions[e.indice + 1], e.indice + 1));
            }}
          />
        ) : (
          <BotaoDaAtividade
            rotulo="Verificar"
            cor={corJornada.roxo}
            vibrar={false}
            desabilitado={!podeVerificar(e)}
            aoTocar={() => {
              const x = verificar(e, q);
              /* Acerto: um toque firme. Erro: um toque curto e leve — o corpo
                 diz "não" sem repreender (no site, 18 ms contra 10 ms). */
              if (Platform.OS !== "web") {
                void Haptics.impactAsync(
                  x.acertou
                    ? Haptics.ImpactFeedbackStyle.Medium
                    : Haptics.ImpactFeedbackStyle.Light,
                ).catch(() => {});
              }
              setE(x);
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function Licao({ quiz }: { quiz: DailyQuiz }) {
  const { titulo, corpo } = dividirLicao(quiz.teach);
  return (
    <>
      <Cartao>
        <Text
          style={{
            fontFamily: fonte.forte,
            fontSize: 13,
            color: corJornada.roxo,
            letterSpacing: 0.4,
          }}
        >
          📖 A LIÇÃO DE HOJE
        </Text>
        {titulo ? <T tipo="subtitulo">{titulo}</T> : null}
        <T>{corpo}</T>
      </Cartao>
      {quiz.funFact ? (
        <Cartao fundo={corJornada.trofeuFundo}>
          <T tipo="rotulo" cor={corJornada.trofeu}>
            💡 Você sabia?
          </T>
          <T>{quiz.funFact}</T>
        </Cartao>
      ) : null}
    </>
  );
}

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
  estado: ReturnType<typeof estadoDaOpcao>;
  travada: boolean;
  aoTocar: () => void;
}) {
  const visual = {
    neutra: { borda: cor.borda, fundo: cor.cartao, selo: cor.apagado, letra: cor.textoApagado },
    escolhida: {
      borda: corJornada.roxo,
      fundo: corJornada.roxoFundo,
      selo: corJornada.roxo,
      letra: cor.branco,
    },
    certa: {
      borda: corJornada.feito,
      fundo: corJornada.feitoFundo,
      selo: corJornada.feito,
      letra: cor.branco,
    },
    faltou: {
      borda: corJornada.feito,
      fundo: cor.cartao,
      selo: corJornada.feitoFundo,
      letra: corJornada.feito,
    },
    errada: {
      borda: AMBAR.erradaBorda,
      fundo: AMBAR.erradaFundo,
      selo: AMBAR.erradaBorda,
      letra: cor.branco,
    },
  }[estado];
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
  return (
    <Animated.View style={[estiloQuique, estiloBalanco]}>
      <Pressable
        accessibilityRole={multi ? "checkbox" : "radio"}
        accessibilityState={{
          checked: estado === "escolhida" || estado === "certa" || estado === "errada",
          disabled: travada,
        }}
        accessibilityLabel={`${texto}${estado === "certa" || estado === "faltou" ? ", resposta certa" : estado === "errada" ? ", resposta errada" : ""}`}
        disabled={travada}
        onPress={() => {
          toque();
          aoTocar();
        }}
        /* O relevo da opção é a borda de baixo mais grossa, na cor da borda —
           afunda quando o dedo aperta. A que faltou fica tracejada e plana:
           ela não foi tocada, e o relevo diria que foi. */
        style={({ pressed }) => {
          const plana = estado === "faltou" || travada;
          const funda = pressed && !plana;
          return {
            flexDirection: "row",
            alignItems: "center",
            gap: espaco.md,
            minHeight: ALVO_MINIMO + 12,
            paddingVertical: espaco.md,
            paddingHorizontal: espaco.md,
            borderRadius: 18,
            borderWidth: 2,
            borderBottomWidth: plana || funda ? 2 : 5,
            marginTop: funda ? 3 : 0,
            marginBottom: plana ? 3 : 0,
            borderStyle: estado === "faltou" ? "dashed" : "solid",
            borderColor: visual.borda,
            backgroundColor: visual.fundo,
          };
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: multi ? 8 : 16,
            backgroundColor: visual.selo,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {estado === "certa" || estado === "faltou" ? (
            <Check size={18} color={visual.letra} strokeWidth={3} />
          ) : estado === "errada" ? (
            <X size={18} color={visual.letra} strokeWidth={3} />
          ) : (
            <Text style={{ fontFamily: fonte.titulo, fontSize: 15, color: visual.letra }}>
              {letra}
            </Text>
          )}
        </View>
        <Text
          style={{
            flex: 1,
            fontFamily: fonte.media,
            fontSize: 16,
            lineHeight: 22,
            color: cor.texto,
          }}
        >
          {texto}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/* O erro da aula, como no site: âmbar e uma opção em rosa suave — o vermelho
   do tema é reservado à gravidade clínica, e errar uma pergunta não é isso. */
const AMBAR = {
  fundo: "#fef3c6",
  texto: "#973c00",
  erradaBorda: "#ff637e",
  erradaFundo: "#fff1f2",
} as const;
