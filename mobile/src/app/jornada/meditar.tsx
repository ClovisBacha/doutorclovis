import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ChevronRight, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";
import {
  CHAVE_DO_PROGRAMA,
  diaDoPrograma,
  PROGRAMA,
  type DiaDoPrograma,
} from "@/lib/meditacao-programa";
import { DENSIDADES, falaNoCiclo, type Densidade, type Plano } from "@/lib/meditacao-sessao";
import { sequenciaDeDatas } from "@/lib/sequencia";
import { familiasDeSom, ROTULO_DO_SOM, type SomKey } from "@/lib/som-receitas";
import { Botao, Carregando, Tela, toque } from "~/componentes/base";
import {
  BolhaComBalao,
  BotaoDaVoz,
  Escolha,
  EscolhaComLegenda,
  FundoDaAtividade,
  RodapeDaAtividade,
  Secao,
  TituloDaAtividade,
  type PaletaDaAtividade,
} from "~/componentes/jornada/atividade";
import { corMeditacao } from "~/componentes/jornada/cores";
import { concluirMomento, FimDoMomento, type Desfecho } from "~/componentes/jornada/fim";
import { FolhaDeSons } from "~/componentes/jornada/folha-de-sons";
import { BarraDoTopo } from "~/componentes/jornada/pecas";
import { useAtividade } from "~/componentes/jornada/usarJornada";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { tocarAmostra, tocarSomDeFundo, type SomDeFundo } from "~/lib/audio/som-de-fundo";
import { ARTE_DO_SOM } from "~/lib/audio/sons-de-fundo";
import { pararVozes, tocarVoz } from "~/lib/audio/voz";
import { VOZ_DA_MEDITACAO, VOZ_DA_RESPIRACAO } from "~/lib/audio/vozes";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { ymdLocal } from "~/lib/gestacao";
import { anotarNoDiario } from "~/lib/jornada/diario";
import { gravarChave, useLoja } from "~/lib/jornada/loja";
import {
  CICLOS_DE_UM_MINUTO,
  comoEstouPara,
  DURACAO_PADRAO_MEDITAR,
  DURACOES_MEDITAR,
  ESCALA_RESPIRO,
  FALA_DO_FECHAMENTO,
  falaDoBalao,
  FECHAMENTO,
  formatarRestante,
  indiceDoTemaDoDia,
  lerRegistro,
  minutosAoEncerrar,
  planoDaSessao,
  registrar,
  temasDisponiveis,
  type DuracaoMeditar,
} from "~/lib/jornada/meditacao";
import { CHAVE_LOG_MEDITACAO } from "~/lib/jornada/momentos";
import { CICLO, DURACAO_DA_FASE, instanteNoTempo, ROTULO_DA_FASE } from "~/lib/jornada/respiracao";
import { ALVO_MINIMO, cor, espaco, fonte } from "~/tema";

/**
 * MEDITAR — a meditação guiada do app antigo (`MeditationBlock` do site).
 *
 * Ela escolhe o tempo, o que está precisando e o som de fundo (tocar num som
 * deixa ouvir cinco segundos), e quanta voz quer. Nos sete primeiros dias, um
 * programa curto abre a tela no lugar das perguntas. A sessão é a respiração
 * 4-4-8 desenhada por um círculo que respira com a bolha dormindo dentro, com
 * as falas GRAVADAS do site (191 trechos) nos ciclos que o plano marca e as
 * palavras "inspire, segure, solte" no começo. No fim, "Como você está agora?"
 * — e a última fala responde ao que ela disse.
 *
 * Bancada: /jornada/meditar?bancada=1 [&menu=1] [&programa=<dias feitos>] [&luto=1]
 *          [&etapa=sessao|reflexo|fim|feita] [&t=<segundos>] [&pausa=toque|fundo] [&folha=1]
 */

const PALETA: PaletaDaAtividade = {
  fundo: [corMeditacao.fundoTopo, corMeditacao.fundoMeio, corMeditacao.fundoBase],
  forte: corMeditacao.forte,
  titulo: corMeditacao.titulo,
  secao: corMeditacao.secao,
  borda: corMeditacao.borda,
  vidro: corMeditacao.vidro,
  discreto: corMeditacao.discreto,
  brancoSuave: corMeditacao.brancoSuave,
};

const BOLHA_DORMINDO = require("../../../../src/assets/bolha/dormindo.webp");

type Som = SomKey | "silencio";
type Etapa = "escolha" | "sessao" | "reflexo" | "fim";
type SessaoEmCurso = { plano: Plano; minutos: number; programa: DiaDoPrograma | null };

export default function Meditar() {
  const at = useAtividade("meditation");
  const loja = useLoja();
  const temas = useMemo(
    () => temasDisponiveis({ cuidado: at.cuidado, posParto: at.pos }),
    [at.cuidado, at.pos],
  );
  const sugerida = indiceDoTemaDoDia(at.D ?? new Date().getDate(), temas.length);
  const [temaIdx, setTemaIdx] = useState<number | null>(null);
  const tema = temas[Math.min(temaIdx ?? sugerida, temas.length - 1)];
  const [minutos, setMinutos] = useState<DuracaoMeditar>(DURACAO_PADRAO_MEDITAR);
  const [som, setSom] = useState<Som>("pad");
  const [voz, setVoz] = useState(true);
  const [densidade, setDensidade] = useState<Densidade>("guiada");
  const [menuAberto, setMenuAberto] = useState(false);
  const [progFeitos, setProgFeitos] = useState<number | null>(null);
  const [etapa, setEtapa] = useState<Etapa>("escolha");
  const [sessao, setSessao] = useState<SessaoEmCurso | null>(null);
  const [minutosFeitos, setMinutosFeitos] = useState(0);
  const [humor, setHumor] = useState<string | null>(null);
  const [desfecho, setDesfecho] = useState<Desfecho | null>(null);
  const [amostrando, setAmostrando] = useState<SomKey | null>(null);
  const [inicioDaBancada, setInicioDaBancada] = useState({
    t: 0,
    pausa: null as Pausa,
    folha: false,
  });
  const [aplicouBancada, setAplicouBancada] = useState(false);
  const pararAmostraAtual = useRef<(() => void) | null>(null);
  const fundo = useRef<SomDeFundo | null>(null);
  const somAtual = useRef<Som>(som);

  const registro = lerRegistro(loja.blob[CHAVE_LOG_MEDITACAO]);
  const feitosDoPrograma = progFeitos ?? (Number(loja.blob[CHAVE_DO_PROGRAMA] ?? 0) || 0);
  const diaAtual = at.cuidado ? null : diaDoPrograma(feitosDoPrograma);

  /* Sair da tela cala tudo: o som de fundo, a amostra e a voz. */
  useEffect(
    () => () => {
      fundo.current?.parar();
      pararAmostraAtual.current?.();
      pararVozes();
    },
    [],
  );

  useEffect(() => {
    if (aplicouBancada || !at.pronto || !ehBancada()) return;
    setAplicouBancada(true);
    if (parametroDaBancada("menu") === "1") setMenuAberto(true);
    const p = parametroDaBancada("programa");
    if (p != null) setProgFeitos(Number(p) || 0);
    const pausa = parametroDaBancada("pausa");
    setInicioDaBancada({
      t: Math.max(0, Number(parametroDaBancada("t") ?? 0) || 0),
      pausa: pausa === "toque" || pausa === "fundo" ? pausa : null,
      folha: parametroDaBancada("folha") === "1",
    });
    const e = parametroDaBancada("etapa");
    if (e === "sessao" || e === "reflexo" || e === "fim") {
      setSessao({
        plano: planoDaSessao({
          minutos: DURACAO_PADRAO_MEDITAR,
          tema: tema.tema,
          semanas: at.semana,
          cuidado: at.cuidado,
          densidade: "guiada",
          registro,
        }),
        minutos: DURACAO_PADRAO_MEDITAR,
        programa: null,
      });
      setMinutosFeitos(DURACAO_PADRAO_MEDITAR);
      setEtapa(e);
    }
    if (e === "fim") {
      setHumor("Mais calma");
      setDesfecho({
        ganhou: at.cuidado || at.pos ? null : 5,
        fechou: false,
        bonus: null,
        semPagamento: at.cuidado || at.pos,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at.pronto, aplicouBancada]);

  function pararAmostra() {
    pararAmostraAtual.current?.();
    pararAmostraAtual.current = null;
    setAmostrando(null);
  }

  function escolherSom(k: Som) {
    setSom(k);
    somAtual.current = k;
    if (etapa === "sessao") {
      fundo.current?.parar();
      fundo.current = pausadaRef.current ? null : tocarSomDeFundo(k);
      return;
    }
    /* Na escolha: tocar no som que já toca a amostra a desliga. */
    const eraEste = amostrando === k;
    pararAmostra();
    if (eraEste || k === "silencio") return;
    setAmostrando(k);
    pararAmostraAtual.current = tocarAmostra(k, () => setAmostrando((a) => (a === k ? null : a)));
  }

  function comecar(prog?: DiaDoPrograma) {
    pararAmostra();
    /* O dia do programa manda na própria duração e na voz; o tema, o som e o
       resto do menu ficam onde estavam para quando ela quiser. */
    const mins = prog?.minutos ?? minutos;
    const plano = planoDaSessao({
      minutos: mins,
      tema: prog?.tema ?? tema.tema,
      semanas: at.semana,
      cuidado: at.cuidado,
      densidade: prog?.densidade ?? densidade,
      registro,
    });
    fundo.current?.parar();
    fundo.current = tocarSomDeFundo(som);
    setSessao({ plano, minutos: mins, programa: prog ?? null });
    setMinutosFeitos(mins);
    setHumor(null);
    setDesfecho(null);
    setEtapa("sessao");
  }

  /** `completa`: chegou ao fim (só assim o dia do programa conta, como no site). */
  async function concluir(mins: number, completa: boolean) {
    setMinutosFeitos(mins);
    setEtapa("reflexo");
    gravarChave(CHAVE_LOG_MEDITACAO, registrar(registro, { hoje: ymdLocal(), minutos: mins }));
    if (completa && sessao?.programa) {
      const novo = Math.max(feitosDoPrograma, sessao.programa.dia);
      setProgFeitos(novo);
      gravarChave(CHAVE_DO_PROGRAMA, novo);
    }
    if (!at.uid) return;
    setDesfecho(
      await concluirMomento({
        uid: at.uid,
        D: at.D,
        momento: "meditation",
        cuidado: at.cuidado,
        pos: at.pos,
      }),
    );
  }

  function responder(c: { emoji: string; label: string }) {
    setHumor(c.label);
    if (voz) tocarVoz(VOZ_DA_MEDITACAO[FALA_DO_FECHAMENTO[c.label] ?? ""], { canal: "guia" });
    gravarChave(
      CHAVE_LOG_MEDITACAO,
      registrar(lerRegistro(loja.blob[CHAVE_LOG_MEDITACAO]), {
        hoje: ymdLocal(),
        minutos: 0,
        humor: c.label,
      }),
    );
    void anotarNoDiario(
      at.uid,
      `Meditação de ${minutosFeitos || minutos} min · ${c.label}`,
      c.emoji,
    );
    setEtapa("fim");
  }

  function sairDaSessao() {
    fundo.current?.parar();
    fundo.current = null;
    pararVozes();
    setEtapa("escolha");
  }

  /* A pausa vive na sessão; o som de fundo, aqui (ele atravessa as etapas). */
  const pausadaRef = useRef(false);
  function aoPausar(p: boolean) {
    pausadaRef.current = p;
    if (p) fundo.current?.pausar();
    else if (fundo.current) fundo.current.retomar();
    else fundo.current = tocarSomDeFundo(somAtual.current);
  }

  if (!at.pronto) {
    return (
      <Tela bordas={["top", "bottom"]}>
        <Carregando />
      </Tela>
    );
  }

  if (etapa === "sessao" && sessao) {
    return (
      <Sessao
        plano={sessao.plano}
        voz={voz}
        aoTrocarVoz={() => setVoz((v) => !v)}
        som={som}
        aoEscolherSom={escolherSom}
        cuidado={at.cuidado}
        inicio={inicioDaBancada}
        aoPausar={aoPausar}
        aoTerminar={(mins) => void concluir(mins, true)}
        aoEncerrar={(ciclo) => {
          if (ciclo >= CICLOS_DE_UM_MINUTO) void concluir(minutosAoEncerrar(ciclo), false);
          else sairDaSessao();
        }}
      />
    );
  }

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
          <Text style={{ fontSize: 48 }}>🧘</Text>
          <Text
            accessibilityRole="header"
            style={{
              marginTop: espaco.lg,
              textAlign: "center",
              fontFamily: fonte.media,
              fontSize: 26,
              lineHeight: 32,
              color: corMeditacao.titulo,
            }}
          >
            Como você está agora?
          </Text>
          <Text
            style={{
              marginTop: 6,
              textAlign: "center",
              fontFamily: fonte.normal,
              fontSize: 13,
              lineHeight: 18,
              color: corMeditacao.texto,
            }}
          >
            Sem resposta certa — é só pra você notar a diferença.
          </Text>
          <View style={{ marginTop: espaco.xl, width: "100%", maxWidth: 320, gap: espaco.sm }}>
            {comoEstouPara(at.cuidado).map((c) => (
              <Pressable
                key={c.label}
                accessibilityRole="button"
                onPress={() => {
                  toque();
                  responder(c);
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: espaco.md,
                  minHeight: ALVO_MINIMO + 4,
                  paddingHorizontal: espaco.lg,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: corMeditacao.borda,
                  backgroundColor: corMeditacao.vidroForte,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Text style={{ fontSize: 20 }}>{c.emoji}</Text>
                <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: corMeditacao.titulo }}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setEtapa("fim")}
            hitSlop={8}
            style={{ marginTop: espaco.lg, minHeight: ALVO_MINIMO, justifyContent: "center" }}
          >
            <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: corMeditacao.secao }}>
              Pular
            </Text>
          </Pressable>
        </ScrollView>
      </FundoDaAtividade>
    );
  }

  if (etapa === "fim") {
    const m = minutosFeitos || minutos;
    const seqDepois = sequenciaDeDatas(lerRegistro(loja.blob[CHAVE_LOG_MEDITACAO]).dias);
    return (
      <Tela bordas={["top", "bottom"]}>
        <FimDoMomento
          titulo={`${m} ${m === 1 ? "minuto" : "minutos"} só seus 💜`}
          fala={
            (humor && FECHAMENTO[humor]) ||
            "Você tirou um tempinho só pra você. Leve essa calma com você."
          }
          desfecho={desfecho}
          D={at.D}
          cuidado={at.cuidado}
          pos={at.pos}
          extra={
            seqDepois > 0 ? (
              <Text
                style={{
                  textAlign: "center",
                  fontFamily: fonte.forte,
                  fontSize: 13,
                  color: corMeditacao.icone,
                }}
              >
                🔥 {seqDepois} {seqDepois === 1 ? "dia seguido" : "dias seguidos"}
              </Text>
            ) : null
          }
        />
      </Tela>
    );
  }

  const mostrarMenu = !diaAtual || menuAberto;
  return (
    <FundoDaAtividade paleta={PALETA}>
      <View style={{ paddingHorizontal: espaco.lg }}>
        <BarraDoTopo />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: espaco.xl, paddingBottom: espaco.xxl }}
      >
        <BolhaComBalao humor="feliz" fala={falaDoBalao(registro)} />
        <TituloDaAtividade paleta={PALETA}>Meditar</TituloDaAtividade>

        {diaAtual && !menuAberto ? (
          <CartaoDoPrograma
            dia={diaAtual}
            feitos={feitosDoPrograma}
            aoComecar={() => comecar(diaAtual)}
            aoAbrirMenu={() => setMenuAberto(true)}
          />
        ) : null}

        {mostrarMenu ? (
          <>
            <Secao paleta={PALETA}>De quanto tempo você tem?</Secao>
            <View style={{ flexDirection: "row", gap: espaco.sm }}>
              {DURACOES_MEDITAR.map((m) => (
                <Escolha
                  key={m}
                  paleta={PALETA}
                  rotulo={`${m} min`}
                  ativa={minutos === m}
                  aoTocar={() => setMinutos(m)}
                  centro
                  estilo={{ flex: 1 }}
                />
              ))}
            </View>

            <Secao paleta={PALETA}>O que você precisa agora?</Secao>
            <View style={{ gap: espaco.sm }}>
              {temas.map((t, i) => {
                const ativa = t === tema;
                return (
                  <EscolhaComLegenda
                    key={t.tema}
                    paleta={PALETA}
                    titulo={t.precisa}
                    legenda={t.tema}
                    ativa={ativa}
                    aoTocar={() => setTemaIdx(i)}
                    antes={<Text style={{ fontSize: 24 }}>{t.emoji}</Text>}
                    depois={
                      i === sugerida ? (
                        <View
                          style={{
                            borderRadius: 999,
                            paddingHorizontal: espaco.sm,
                            paddingVertical: 3,
                            backgroundColor: ativa
                              ? corMeditacao.seloDoDiaAtivo
                              : corMeditacao.seloDoDia,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: fonte.forte,
                              fontSize: 13,
                              color: ativa ? cor.branco : corMeditacao.forte,
                            }}
                          >
                            Do dia
                          </Text>
                        </View>
                      ) : null
                    }
                  />
                );
              })}
            </View>

            <Secao paleta={PALETA}>Som de fundo</Secao>
            <SonsDeFundo
              som={som}
              amostrando={amostrando}
              cuidado={at.cuidado}
              aoEscolher={escolherSom}
            />
            <Text
              style={{
                marginTop: 6,
                fontFamily: fonte.normal,
                fontSize: 13,
                color: corMeditacao.dica,
              }}
            >
              Toque para ouvir 5 segundos antes de escolher.
            </Text>

            <Secao paleta={PALETA}>Quanta voz você quer?</Secao>
            <View style={{ gap: espaco.sm }}>
              {DENSIDADES.map((d) => (
                <EscolhaComLegenda
                  key={d.chave}
                  paleta={PALETA}
                  titulo={d.rotulo}
                  legenda={d.sub}
                  ativa={densidade === d.chave}
                  aoTocar={() => {
                    setDensidade(d.chave);
                    /* Escolher a quantidade é querer a voz: ela volta a ligar.
                       Só o botão da sessão cala tudo. */
                    setVoz(true);
                  }}
                />
              ))}
            </View>
          </>
        ) : null}

        {/* Coisas que ela pode querer EM VEZ da sessão de hoje — não são
            escolhas desta meditação. "Para vocês dois" é preparação para o
            parto: some no Modo Cuidado e no pós-parto. */}
        <View style={{ marginTop: espaco.xxl, gap: espaco.md }}>
          {!at.cuidado && !at.pos ? (
            <EscolhaComLegenda
              paleta={PALETA}
              titulo="Para vocês dois"
              legenda="10 min com quem vai estar com você no parto"
              ativa={false}
              aoTocar={() => {
                pararAmostra();
                router.push("/jornada/casal");
              }}
              antes={<Text style={{ fontSize: 24 }}>🤲</Text>}
              depois={<ChevronRight size={18} color={corMeditacao.familia} />}
            />
          ) : null}
          <EscolhaComLegenda
            paleta={PALETA}
            titulo="Só sons, para dormir"
            legenda="Chuva, mar ou o coração — com a tela apagada"
            ativa={false}
            aoTocar={() => {
              pararAmostra();
              router.push("/jornada/dormir");
            }}
            antes={<Text style={{ fontSize: 24 }}>🌙</Text>}
            depois={<ChevronRight size={18} color={corMeditacao.familia} />}
          />
        </View>
      </ScrollView>
      {mostrarMenu ? (
        <RodapeDaAtividade paleta={PALETA}>
          <Botao
            rotulo={`Começar · ${minutos} min`}
            corFundo={corMeditacao.forte}
            aoTocar={() => comecar()}
          />
        </RodapeDaAtividade>
      ) : null}
    </FundoDaAtividade>
  );
}

/* ── Os sete primeiros dias ──────────────────────────────────────────────── */

function CartaoDoPrograma({
  dia,
  feitos,
  aoComecar,
  aoAbrirMenu,
}: {
  dia: DiaDoPrograma;
  feitos: number;
  aoComecar: () => void;
  aoAbrirMenu: () => void;
}) {
  return (
    <>
      <View
        style={{
          marginTop: espaco.xl,
          borderRadius: 24,
          backgroundColor: corMeditacao.forte,
          padding: 20,
        }}
      >
        <Text
          style={{
            fontFamily: fonte.titulo,
            fontSize: 13,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: corMeditacao.branco80,
          }}
        >
          Dia {dia.dia} de {PROGRAMA.length}
        </Text>
        <Text
          style={{
            marginTop: 6,
            fontFamily: fonte.titulo,
            fontSize: 21,
            lineHeight: 26,
            letterSpacing: -0.21,
            color: cor.branco,
          }}
        >
          {dia.titulo}
        </Text>
        <Text
          style={{
            marginTop: 4,
            fontFamily: fonte.normal,
            fontSize: 13,
            lineHeight: 18,
            color: corMeditacao.branco85,
          }}
        >
          {dia.sub}
        </Text>
        <View
          style={{ marginTop: 14, flexDirection: "row", gap: 6 }}
          accessibilityLabel={`${feitos} de ${PROGRAMA.length} dias feitos`}
        >
          {PROGRAMA.map((d) => (
            <View
              key={d.dia}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                backgroundColor: d.dia <= feitos ? cor.branco : corMeditacao.branco30,
              }}
            />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            toque();
            aoComecar();
          }}
          style={({ pressed }) => ({
            marginTop: espaco.lg,
            minHeight: 48,
            borderRadius: 999,
            backgroundColor: cor.branco,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: corMeditacao.icone }}>
            Começar
          </Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={aoAbrirMenu}
        style={({ pressed }) => ({
          marginTop: espaco.md,
          minHeight: ALVO_MINIMO,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderTopWidth: 1,
          borderStyle: "dashed",
          borderTopColor: corMeditacao.borda,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: corMeditacao.discreto }}>
          Ou escolha você mesma
        </Text>
        <Text style={{ fontFamily: fonte.forte, fontSize: 15, color: corMeditacao.discreto }}>
          ⌄
        </Text>
      </Pressable>
    </>
  );
}

/* ── O som de fundo: as famílias do site, com a amostra de cinco segundos ── */

function IconeDoSom({ som, tamanho = 22 }: { som: Som; tamanho?: number }) {
  const arte = som !== "silencio" ? ARTE_DO_SOM[som] : undefined;
  if (arte)
    return <Image source={arte} style={{ width: tamanho, height: tamanho }} contentFit="contain" />;
  return (
    <Text style={{ fontSize: tamanho * 0.86 }}>
      {som === "silencio" ? "🔇" : ROTULO_DO_SOM[som].emoji}
    </Text>
  );
}

const rotuloDoSom = (k: Som) => (k === "silencio" ? "Silêncio" : ROTULO_DO_SOM[k].label);

function SonsDeFundo({
  som,
  amostrando,
  cuidado,
  aoEscolher,
}: {
  som: Som;
  amostrando: SomKey | null;
  cuidado: boolean;
  aoEscolher: (k: Som) => void;
}) {
  /* Agrupado por família: trinta e duas pílulas numa fita lisa é um muro que
     ninguém lê. A "Música" do site (composta ao vivo para a duração da
     sessão) não veio: não há como gravá-la em arquivo sem perder o que ela é. */
  const grupos: { familia: string; sons: Som[] }[] = [
    { familia: "", sons: ["silencio"] },
    ...familiasDeSom(cuidado).map((g) => ({ familia: g.familia as string, sons: g.sons as Som[] })),
  ];
  return (
    <View style={{ gap: espaco.sm }}>
      {grupos.map((g) => (
        <View key={g.familia || "especiais"}>
          {g.familia ? (
            <Text
              style={{
                marginBottom: 6,
                fontFamily: fonte.forte,
                fontSize: 13,
                letterSpacing: 0.65,
                textTransform: "uppercase",
                color: corMeditacao.familia,
              }}
            >
              {g.familia}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.sm }}>
            {g.sons.map((k) => {
              const ativo = som === k;
              return (
                <Pressable
                  key={k}
                  accessibilityRole="button"
                  accessibilityState={{ selected: ativo }}
                  accessibilityLabel={`${rotuloDoSom(k)}${amostrando === k ? ", tocando a amostra" : ""}`}
                  onPress={() => {
                    toque();
                    aoEscolher(k);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    minHeight: 40,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    borderWidth: ativo ? 0 : 1,
                    borderColor: corMeditacao.borda,
                    backgroundColor: ativo ? corMeditacao.forte : corMeditacao.vidro,
                    opacity: pressed ? 0.8 : 1,
                  })}
                  hitSlop={{ top: 2, bottom: 2 }}
                >
                  <IconeDoSom som={k} />
                  <Text
                    style={{
                      fontFamily: fonte.forte,
                      fontSize: 13,
                      color: ativo ? cor.branco : corMeditacao.forte,
                    }}
                  >
                    {rotuloDoSom(k)}
                  </Text>
                  {amostrando === k ? (
                    <Onda tinta={ativo ? cor.branco : corMeditacao.familia} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

/** As três barrinhas que sobem e descem enquanto a amostra toca. */
function Onda({ tinta }: { tinta: string }) {
  const reduzido = useMovimentoReduzido();
  const barras = useRef([0, 1, 2].map(() => new Animated.Value(0.4))).current;
  useEffect(() => {
    if (reduzido) return;
    const laços = barras.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(b, {
            toValue: 1,
            duration: 300,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(b, {
            toValue: 0.4,
            duration: 300,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    laços.forEach((l) => l.start());
    return () => laços.forEach((l) => l.stop());
  }, [barras, reduzido]);
  return (
    <View
      style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: 12 }}
      accessible={false}
    >
      {barras.map((b, i) => (
        <Animated.View
          key={i}
          style={{
            width: 2,
            height: 12,
            borderRadius: 1,
            backgroundColor: tinta,
            transform: [{ scaleY: b }],
          }}
        />
      ))}
    </View>
  );
}

/* ── A sessão: o círculo que respira ─────────────────────────────────────── */

type Pausa = null | "toque" | "fundo";

function MantemAcesa() {
  useKeepAwake("dc-meditar");
  return null;
}

function Sessao({
  plano,
  voz,
  aoTrocarVoz,
  som,
  aoEscolherSom,
  cuidado,
  inicio,
  aoPausar,
  aoTerminar,
  aoEncerrar,
}: {
  plano: Plano;
  voz: boolean;
  aoTrocarVoz: () => void;
  som: Som;
  aoEscolherSom: (k: Som) => void;
  cuidado: boolean;
  /** Na bancada: o segundo em que abre, a pausa e a folha de sons. */
  inicio: { t: number; pausa: Pausa; folha: boolean };
  aoPausar: (pausada: boolean) => void;
  aoTerminar: (minutos: number) => void;
  aoEncerrar: (ciclo: number) => void;
}) {
  const total = plano.totalCiclos * CICLO;
  const [t, setT] = useState(inicio.t);
  const [pausa, setPausa] = useState<Pausa>(inicio.pausa);
  const pausada = pausa !== null;
  /* Volta da pausa: a fala do ciclo é dita de novo do começo (a pausa a cortou
     no meio, e o texto dela continua na tela). */
  const [retomada, setRetomada] = useState(0);
  const [folha, setFolha] = useState(inicio.folha);
  const base = useRef({ inicio: Date.now(), acumulado: inicio.t });
  const terminou = useRef(false);
  const escala = useRef(new Animated.Value(ESCALA_RESPIRO.solte)).current;

  useEffect(() => {
    if (pausada) return;
    base.current.inicio = Date.now();
    const id = setInterval(() => {
      setT(base.current.acumulado + (Date.now() - base.current.inicio) / 1000);
    }, 200);
    return () => {
      clearInterval(id);
      base.current.acumulado += (Date.now() - base.current.inicio) / 1000;
    };
  }, [pausada]);

  const inst = instanteNoTempo(Math.min(t, total - 0.001));
  const falaAgora = falaNoCiclo(plano, inst.ciclo);

  function pausar(motivo: "toque" | "fundo") {
    if (pausada || terminou.current) return;
    setPausa(motivo);
    pararVozes();
    aoPausar(true);
  }
  function retomar() {
    if (!pausada) return;
    /* A respiração recomeça na inspiração do MESMO ciclo — como no site. */
    const recomeco = inst.ciclo * CICLO;
    base.current.acumulado = recomeco;
    setT(recomeco);
    setPausa(null);
    setRetomada((n) => n + 1);
    aoPausar(false);
  }

  /* O app saiu da tela: a sessão para ali, e o véu diz por quê ao voltar. */
  const pausarAgora = useRef(pausar);
  pausarAgora.current = pausar;
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "background") pausarAgora.current("fundo");
    });
    return () => sub.remove();
  }, []);

  /* O círculo e a bolha andam até a escala da fase no tempo que resta dela. */
  useEffect(() => {
    if (pausada) {
      /* Pausada, a bolha volta ao repouso (a expiração), de onde a próxima
         inspiração tem para onde crescer. */
      escala.stopAnimation();
      escala.setValue(ESCALA_RESPIRO.solte);
      return;
    }
    if (Platform.OS !== "web")
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.timing(escala, {
      toValue: ESCALA_RESPIRO[inst.fase],
      duration: Math.max(150, DURACAO_DA_FASE[inst.fase] * (1 - inst.progresso) * 1000),
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inst.fase, inst.ciclo, pausada, retomada]);

  /* A fala gravada do ciclo, no canal da guia. */
  useEffect(() => {
    if (pausada || !voz || !falaAgora) return;
    tocarVoz(VOZ_DA_MEDITACAO[falaAgora.id], { canal: "guia" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [falaAgora?.id, inst.ciclo, voz, pausada, retomada]);

  /* As palavras da respiração no começo, só nos ciclos sem fala (duas vozes
     ao mesmo tempo viram ruído), no canal do pulso, um pouco mais baixas. */
  useEffect(() => {
    if (pausada || !voz || falaAgora || inst.ciclo >= plano.palavrasAte) return;
    tocarVoz(VOZ_DA_RESPIRACAO[inst.fase], { canal: "pulso", volume: 0.85 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inst.fase, inst.ciclo, voz, pausada, retomada]);

  useEffect(() => {
    if (!voz) pararVozes();
  }, [voz]);

  useEffect(() => {
    if (t >= total && !terminou.current) {
      terminou.current = true;
      if (Platform.OS !== "web")
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      aoTerminar(Math.round(total / 60));
    }
  }, [t, total, aoTerminar]);

  return (
    <FundoDaAtividade paleta={PALETA}>
      {Platform.OS !== "web" && !pausada ? <MantemAcesa /> : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: espaco.lg,
          paddingVertical: espaco.sm,
          zIndex: 3,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={() => aoEncerrar(inst.ciclo)}
          style={({ pressed }) => ({
            width: ALVO_MINIMO,
            height: ALVO_MINIMO,
            marginLeft: -espaco.sm,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <X size={24} color={corMeditacao.fechar} />
        </Pressable>
        <View
          style={{
            flex: 1,
            height: 6,
            marginHorizontal: espaco.md,
            borderRadius: 3,
            backgroundColor: corMeditacao.barraTrilho,
            overflow: "hidden",
          }}
          accessibilityLabel={`${Math.round((t / total) * 100)}% da sessão`}
        >
          <View
            style={{
              width: `${Math.min(100, (t / total) * 100)}%`,
              height: "100%",
              borderRadius: 3,
              backgroundColor: corMeditacao.barra,
            }}
          />
        </View>
        <Text
          style={{
            marginRight: espaco.sm,
            minWidth: 28,
            fontFamily: fonte.forte,
            fontSize: 13,
            color: corMeditacao.restante,
            fontVariant: ["tabular-nums"],
          }}
        >
          {formatarRestante(total - t)}
        </Text>
        {/* ⏸ desenhado, e não emoji: emoji tem cor própria em cada sistema. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={pausada ? "Continuar" : "Pausar"}
          hitSlop={4}
          onPress={() => {
            toque();
            if (pausada) retomar();
            else pausar("toque");
          }}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: corMeditacao.borda,
            backgroundColor: corMeditacao.vidro,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Svg width={15} height={15} viewBox="0 0 24 24">
            <Path
              d={pausada ? "M8 5.2v13.6L19 12z" : "M6.6 4.8h3.7v14.4H6.6zM13.7 4.8h3.7v14.4h-3.7z"}
              fill={corMeditacao.icone}
            />
          </Svg>
        </Pressable>
        <BotaoDaVoz
          ligada={voz}
          aoTocar={aoTrocarVoz}
          corLigada={corMeditacao.icone}
          corDesligada={corMeditacao.iconeApagado}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Trocar o som de fundo"
          onPress={() => {
            toque();
            setFolha(true);
          }}
          style={({ pressed }) => ({
            width: ALVO_MINIMO,
            height: ALVO_MINIMO,
            marginRight: -espaco.sm,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontSize: 20 }}>{som === "silencio" ? "🔇" : "🔊"}</Text>
        </Pressable>
      </View>

      <View
        importantForAccessibility={pausada ? "no-hide-descendants" : "auto"}
        accessibilityElementsHidden={pausada}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: espaco.xxl,
        }}
      >
        <Circulo escala={escala} rotulo={ROTULO_DA_FASE[inst.fase]} oculto={pausada} />
        <Text
          key={inst.ciclo}
          style={{
            marginTop: 40,
            minHeight: 84,
            maxWidth: 384,
            textAlign: "center",
            fontFamily: fonte.titulo,
            fontSize: 22,
            lineHeight: 36,
            letterSpacing: -0.22,
            color: falaAgora ? corMeditacao.frase : corMeditacao.fraseApagada,
          }}
        >
          {falaAgora?.texto ?? "Só respire."}
        </Text>
      </View>

      {pausada ? <VeuDaPausa motivo={pausa} aoContinuar={retomar} /> : null}
      <FolhaDeSons
        aberta={folha}
        som={som}
        cuidado={cuidado}
        paleta={PALETA}
        veu={corMeditacao.folhaVeu}
        tinta={corMeditacao.icone}
        aoFechar={() => setFolha(false)}
        aoEscolher={(k) => {
          aoEscolherSom(k);
          setFolha(false);
        }}
      />
    </FundoDaAtividade>
  );
}

/** O halo, o círculo e a bolha dormindo, respirando juntos na mesma escala. */
function Circulo({
  escala,
  rotulo,
  oculto,
}: {
  escala: Animated.Value;
  rotulo: string;
  oculto: boolean;
}) {
  return (
    <View style={{ width: 224, height: 224, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{ position: "absolute", transform: [{ scale: escala }] }}
        accessible={false}
      >
        <Svg width={224} height={224}>
          <Defs>
            <RadialGradient id="halo-da-meditacao" cx="50%" cy="50%" r="50%">
              <Stop offset="0.35" stopColor={corMeditacao.halo} stopOpacity={0.4} />
              <Stop offset="1" stopColor={corMeditacao.halo} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={112} cy={112} r={112} fill="url(#halo-da-meditacao)" />
        </Svg>
      </Animated.View>
      <Animated.View
        accessible={false}
        style={{
          position: "absolute",
          width: 160,
          height: 160,
          borderRadius: 80,
          borderWidth: 2,
          borderColor: corMeditacao.circuloBorda,
          overflow: "hidden",
          transform: [{ scale: escala }],
        }}
      >
        <LinearGradient
          colors={[corMeditacao.circuloClaro, corMeditacao.circuloEscuro]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
      <View style={{ alignItems: "center", gap: espaco.sm }}>
        <Animated.View style={{ transform: [{ scale: escala }] }}>
          <Image
            source={BOLHA_DORMINDO}
            style={{ width: 96, height: 96 }}
            contentFit="contain"
            accessible={false}
          />
        </Animated.View>
        <Text
          accessibilityLiveRegion="polite"
          style={{
            /* Pausada, a palavra da fase some: no site o véu a desfocava, e
               aqui ela vazaria por trás do "Pausado". */
            opacity: oculto ? 0 : 1,
            fontFamily: fonte.forte,
            fontSize: 15,
            letterSpacing: 2.7,
            textTransform: "uppercase",
            color: corMeditacao.fase,
          }}
        >
          {rotulo}
        </Text>
      </View>
    </View>
  );
}

/** O véu da pausa: cobre a sessão, nunca a troca — a bolha continua por baixo. */
function VeuDaPausa({ motivo, aoContinuar }: { motivo: Pausa; aoContinuar: () => void }) {
  return (
    <View
      accessibilityViewIsModal
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 2,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: espaco.xxl,
        backgroundColor: corMeditacao.veu,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: corMeditacao.pausaFundo,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path d="M6.6 4.8h3.7v14.4H6.6zM13.7 4.8h3.7v14.4h-3.7z" fill={corMeditacao.secao} />
        </Svg>
      </View>
      <Text
        accessibilityRole="header"
        accessibilityLiveRegion="assertive"
        style={{
          marginTop: espaco.lg,
          fontFamily: fonte.media,
          fontSize: 24,
          lineHeight: 30,
          color: corMeditacao.titulo,
        }}
      >
        Pausado
      </Text>
      <Text
        style={{
          marginTop: 6,
          maxWidth: 320,
          textAlign: "center",
          fontFamily: fonte.normal,
          fontSize: 13,
          lineHeight: 21,
          color: corMeditacao.texto,
        }}
      >
        {motivo === "fundo"
          ? "O app saiu da tela e a sessão parou aqui. Está tudo guardado."
          : "Sem pressa. Sua respiração espera por você."}
      </Text>
      <View style={{ marginTop: 28, width: "100%", maxWidth: 320 }}>
        <Botao rotulo="Continuar" corFundo={corMeditacao.forte} aoTocar={aoContinuar} />
      </View>
    </View>
  );
}
