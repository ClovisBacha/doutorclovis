import * as Haptics from "expo-haptics";
import { Check, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { gestChallenge } from "@/lib/daily-challenges";
import { carregarQuizDoDia, isMultiQuestion, type DailyQuiz } from "@/lib/daily-quizzes";
import { Botao, Cartao, Carregando, NaoConsegueLer, T, Tela, toque } from "~/componentes/base";
import { corJornada } from "~/componentes/jornada/cores";
import { concluirMomento, FimDoMomento, type Desfecho } from "~/componentes/jornada/fim";
import { pagarAula } from "~/componentes/jornada/economia";
import { BarraDoTopo, BolhaFalando, voltarParaJornada } from "~/componentes/jornada/pecas";
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
  verificar,
  type EstadoDaAula,
} from "~/lib/jornada/aula";
import { marcar } from "~/lib/jornada/loja";
import { sementesDaAula } from "~/lib/jornada/momentos";
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

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
      let x = verificar(escolher(comecarPerguntas(INICIO_DA_AULA), qs[0], Array.isArray(qs[0].a) ? qs[0].a[0] : qs[0].a), qs[0]);
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
      setDesfecho({ ganhou: sementesDaAula(Math.max(0, qs.length - 1)), fechou: false, bonus: null, semPagamento: false });
    }
  }, [quiz, bancadaAplicada]);

  /* O fim da aula: marca e paga uma vez só. */
  useEffect(() => {
    if (e.etapa !== "fim" || desfecho || !at.uid || (ehBancada() && parametroDaBancada("etapa") === "fim")) return;
    let vivo = true;
    void concluirMomento({ uid: at.uid, D, momento: "aula", cuidado: at.cuidado, pos: at.pos, acertos: e.acertos }).then(
      (d) => {
        if (vivo) setDesfecho(d);
      },
    );
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
        <T>A aula do dia acompanha as semanas da gestação. Os outros momentos da jornada continuam aqui para você.</T>
        <Botao rotulo="Voltar para a jornada" aoTocar={voltarParaJornada} corFundo={corJornada.roxo} />
      </Tela>
    );
  }

  if (at.jaFeita && e.etapa !== "fim") {
    return (
      <Tela bordas={["top", "bottom"]}>
        <BarraDoTopo titulo="Aula de hoje" />
        <BolhaFalando humor="estudiosa" fala="A aula de hoje já está feita. Amanhã tem outra esperando por você!" />
        {quiz && quiz !== "carregando" ? <Licao quiz={quiz} /> : null}
        <Botao rotulo="Voltar para a jornada" aoTocar={voltarParaJornada} corFundo={corJornada.roxo} />
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
            <T tipo="rotulo">
              Desafio do dia {desafio.emoji}
            </T>
            <T>{desafio.label}</T>
            <Botao
              rotulo="Fiz o desafio"
              corFundo={corJornada.roxo}
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
    return (
      <Tela bordas={["top", "bottom"]}>
        <FimDoMomento
          titulo="Aula feita!"
          fala={`Você acertou ${e.acertos} de ${total}. Cada pergunta é um passo a mais para chegar preparada.`}
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
        <BolhaFalando humor="estudiosa" fala={`Leia a lição com calma. Depois vêm ${total} perguntas, com uma tentativa em cada.`} />
        <Licao quiz={quiz} />
        <Botao
          rotulo={`Vamos às perguntas (${total})`}
          corFundo={corJornada.roxo}
          aoTocar={() => setE(comecarPerguntas(e))}
        />
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
      <ScrollView contentContainerStyle={{ padding: espaco.lg, gap: espaco.md, paddingBottom: espaco.xl }}>
        <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: corJornada.roxo, letterSpacing: 0.4 }}>
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
          backgroundColor: !e.verificada ? cor.fundo : e.acertou ? corJornada.feitoFundo : cor.urgenteFundo,
        }}
      >
        {e.verificada ? (
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
              {e.acertou ? (
                <Check size={24} color={corJornada.feito} strokeWidth={3} />
              ) : (
                <X size={24} color={cor.urgente} strokeWidth={3} />
              )}
              <T tipo="subtitulo" cor={e.acertou ? "#15803d" : cor.urgente}>
                {e.acertou ? "Isso mesmo!" : multi ? "Quase! Olhe as marcadas em verde" : "Não foi dessa vez"}
              </T>
            </View>
            <T tipo="corpo" cor={cor.texto}>
              {q.why}
            </T>
          </View>
        ) : null}
        {e.verificada ? (
          <Botao
            rotulo={e.indice + 1 >= total ? "Terminar" : "Continuar"}
            corFundo={e.acertou ? corJornada.feito : cor.urgente}
            aoTocar={() => setE(continuar(e, total))}
          />
        ) : (
          <Botao
            rotulo="Verificar"
            corFundo={corJornada.roxo}
            desabilitado={!podeVerificar(e)}
            aoTocar={() => {
              const x = verificar(e, q);
              if (Platform.OS !== "web") {
                void Haptics.notificationAsync(
                  x.acertou ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
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
        <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: corJornada.roxo, letterSpacing: 0.4 }}>
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
    escolhida: { borda: corJornada.roxo, fundo: corJornada.roxoFundo, selo: corJornada.roxo, letra: cor.branco },
    certa: { borda: corJornada.feito, fundo: corJornada.feitoFundo, selo: corJornada.feito, letra: cor.branco },
    faltou: { borda: corJornada.feito, fundo: cor.cartao, selo: corJornada.feitoFundo, letra: corJornada.feito },
    errada: { borda: cor.urgente, fundo: cor.urgenteFundo, selo: cor.urgente, letra: cor.branco },
  }[estado];
  return (
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
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        minHeight: ALVO_MINIMO + 12,
        paddingVertical: espaco.md,
        paddingHorizontal: espaco.md,
        borderRadius: raio.md,
        borderWidth: 2,
        borderStyle: estado === "faltou" ? "dashed" : "solid",
        borderColor: visual.borda,
        backgroundColor: visual.fundo,
        opacity: pressed ? 0.8 : 1,
      })}
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
          <Text style={{ fontFamily: fonte.titulo, fontSize: 15, color: visual.letra }}>{letra}</Text>
        )}
      </View>
      <Text style={{ flex: 1, fontFamily: fonte.media, fontSize: 16, lineHeight: 22, color: cor.texto }}>{texto}</Text>
    </Pressable>
  );
}
