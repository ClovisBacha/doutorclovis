import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Bell, ChevronDown, ChevronRight, Play, Volume2, VolumeX, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import {
  CHAVE_DO_PROGRAMA,
  diaDoPrograma,
  PROGRAMA,
  type DiaDoPrograma,
} from "@/lib/meditacao-programa";
import { DENSIDADES, falaNoCiclo, type Densidade, type Plano } from "@/lib/meditacao-sessao";
import { sequenciaDeDatas } from "@/lib/sequencia";
import type { SomKey } from "@/lib/som-receitas";
import { ROTULO_DO_SOM_NO_APP } from "~/lib/jornada/sons";
import { casalAberto } from "~/lib/jornada/casal";
import { toque } from "~/componentes/base";
import {
  ArteDaLinha,
  BolhaComBalao,
  BotaoDaAtividade,
  BotaoDaVoz,
  BotaoDoControle,
  Brilho,
  CarregandoAtividade,
  ControlesDaSessao,
  Escolha,
  EscolhaComLegenda,
  fecharAtividade,
  Ficha,
  FOLGA_DO_RODAPE,
  FolhaDaAtividade,
  FundoDaAtividade,
  GrupoDaFolha,
  LinhaDaAtividade,
  LinhaDaFolha,
  materialDe,
  PilulaComRelevo,
  RodapeDaAtividade,
  Secao,
  TituloDaAtividade,
  TopoDaAtividade,
  TrocaDeEtapa,
} from "~/componentes/jornada/atividade";
import { clarear, comAlfa, escurecer, misturar } from "~/lib/cor";
import { corDaAtividade } from "~/componentes/jornada/cores";
import { concluirMomento, FimDoMomento, type Desfecho } from "~/componentes/jornada/fim";
import { FolhaDeSons } from "~/componentes/jornada/folha-de-sons";
import { useAtividade } from "~/componentes/jornada/usarJornada";
import { tocarAmostra, tocarSomDeFundo, type SomDeFundo } from "~/lib/audio/som-de-fundo";
import { pararVozes, tocarVoz } from "~/lib/audio/voz";
import {
  definirLembreteDaMeditacao,
  lerLembreteDaMeditacao,
  reagendarLembreteDaMeditacao,
} from "~/lib/lembrete-da-meditacao";
import { HORA_PADRAO, HORARIOS, horaValida } from "~/lib/jornada/lembrete";
import { VOZ_REGRAVADA } from "~/lib/audio/regravadas";
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
  falaDoBalao,
  falaDoFechamento,
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
import {
  ALVO_MINIMO,
  brilhoDe,
  canto,
  cor,
  curva,
  escala,
  espaco,
  fonte,
  luz,
  margem,
  sombra,
} from "~/tema";

/**
 * MEDITAR — a meditação guiada do app antigo (`MeditationBlock` do site).
 *
 * Nos sete primeiros dias, um programa curto abre a tela: é a porta. Fora
 * dele (ou em "Escolher outra"), ela escolhe o tempo e o que está precisando;
 * o som de fundo e quanta voz quer ficam em duas linhas que abrem a folha
 * (tocar num som deixa ouvir cinco segundos). A sessão é a respiração 4-4-8
 * desenhada por um círculo que respira com a bolha dormindo dentro, com as
 * falas GRAVADAS do site nos ciclos que o plano marca e as palavras "inspire,
 * segure, solte" no começo. No fim, "Como você está agora?" — e a última fala
 * responde ao que ela disse.
 *
 * SEM RELÓGIO NO JS (18/11/2026, a vistoria): a sessão redesenhava a tela
 * inteira cinco vezes por segundo, a barra pulava de degrau em degrau e a
 * troca de fase atrasava até 200 ms. Agora o estado muda só na troca de fase
 * (um `setTimeout` para o fim dela), a barra anda no motor nativo e só o
 * tempo que falta se redesenha, quando o número muda.
 *
 * Bancada: /jornada/meditar?bancada=1 [&menu=1] [&programa=<dias feitos>] [&luto=1]
 *          [&etapa=sessao|tocando|reflexo|fim|feita] [&t=<segundos>] [&pausa=toque|fundo] [&folha=1]
 */

const PALETA = corDaAtividade.meditar;
const MATERIAL = materialDe(PALETA);

const BOLHA_DORMINDO = require("../../../../src/assets/bolha/dormindo.webp");

/** A flor de lótus, nas artes 3D do app: no cartão do programa e no fim da sessão. */
const ARTE_LOTUS = require("../../../../src/assets/grades/meditacoes.webp");
/** As portas para as outras atividades: os fones com a lua, o coração na almofada. */
const ARTE_SONS = require("../../../../src/assets/grades/sons.webp");
const ARTE_APOIO = require("../../../../src/assets/grades/apoio.webp");
/** A chama da sequência (6 × 6 quadros; aqui, o primeiro, parado). */
const CHAMA = require("../../../../src/assets/chama-sequencia.webp");

type Som = SomKey | "silencio";
type Etapa = "escolha" | "sessao" | "reflexo" | "fim";
type SessaoEmCurso = { plano: Plano; minutos: number; programa: DiaDoPrograma | null };

const rotuloDoSom = (k: Som) => (k === "silencio" ? "Sem som" : ROTULO_DO_SOM_NO_APP[k].label);

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
  const [folhaDoSom, setFolhaDoSom] = useState(false);
  const [folhaDaVoz, setFolhaDaVoz] = useState(false);
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
    const e0 = parametroDaBancada("etapa");
    const e = e0 === "tocando" ? "sessao" : e0;
    if (e === "sessao" || e === "reflexo" || e === "fim") {
      setSessao({
        plano: planoDaSessao({
          minutos: DURACAO_PADRAO_MEDITAR,
          tema: tema.tema,
          semanas: at.semana,
          cuidado: at.cuidado,
          posParto: at.pos,
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
      posParto: at.pos,
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
    const novoRegistro = registrar(registro, { hoje: ymdLocal(), minutos: mins });
    gravarChave(CHAVE_LOG_MEDITACAO, novoRegistro);
    /* Meditou hoje: o lembrete de hoje fica quieto ("e fico quieto se você já
       tiver meditado", como no site). */
    if (at.uid) void reagendarLembreteDaMeditacao(at.uid, novoRegistro.dias);
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
    /* A regravada da resposta trocada (`docs/regravacao`), ou a do site. */
    const fala = falaDoFechamento(c.label);
    if (voz && fala) tocarVoz(VOZ_REGRAVADA[fala] ?? VOZ_DA_MEDITACAO[fala], { canal: "guia" });
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

  /* Antes de um minuto não houve sessão para guardar: o ✕ fecha a atividade, como no site. */
  function sairDaSessao() {
    fundo.current?.parar();
    fundo.current = null;
    pararVozes();
    fecharAtividade();
  }

  /* A pausa vive na sessão; o som de fundo, aqui (ele atravessa as etapas). */
  const pausadaRef = useRef(false);
  function aoPausar(p: boolean) {
    pausadaRef.current = p;
    if (p) fundo.current?.pausar();
    else if (fundo.current) fundo.current.retomar();
    else fundo.current = tocarSomDeFundo(somAtual.current);
  }

  if (!at.pronto) return <CarregandoAtividade paleta={PALETA} />;

  const mostrarMenu = !diaAtual || menuAberto;
  const naSessao = etapa === "sessao" && !!sessao;
  const chave = naSessao ? "sessao" : etapa === "sessao" ? "escolha" : etapa;

  let miolo: ReactNode;
  if (naSessao) {
    miolo = (
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
          /* O ✕ cala tudo (o som e a fala) — e a partir de um minuto ele GUARDA a
             sessão, que é o que o dedo quer dizer quando decide que já basta. */
          fundo.current?.parar();
          fundo.current = null;
          pararVozes();
          if (ciclo >= CICLOS_DE_UM_MINUTO) void concluir(minutosAoEncerrar(ciclo), false);
          else sairDaSessao();
        }}
      />
    );
  } else if (etapa === "reflexo") {
    miolo = (
      <>
        <TopoDaAtividade />
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: margem.foco,
            paddingBottom: espaco.xxl,
          }}
        >
          <View style={{ alignItems: "center", justifyContent: "center" }}>
            <Brilho tamanho={180} tinta={PALETA.luz} />
            <Image
              source={ARTE_LOTUS}
              style={{ width: 112, height: 112 }}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
          </View>
          <TituloDaAtividade centro>Como você está agora?</TituloDaAtividade>
          <Text
            style={{
              marginTop: espaco.sm,
              textAlign: "center",
              ...fonte.normal,
              ...escala.legenda,
              color: cor.textoApagado,
            }}
          >
            Não tem resposta certa. É só para você notar a diferença.
          </Text>
          <View style={{ marginTop: espaco.xl, width: "100%", maxWidth: 340, gap: espaco.md }}>
            {comoEstouPara(at.cuidado).map((c) => (
              <Escolha
                key={c.label}
                paleta={PALETA}
                rotulo={c.label}
                ativa={false}
                aoTocar={() => responder(c)}
              >
                <Text style={{ fontSize: 20 }}>{c.emoji}</Text>
              </Escolha>
            ))}
          </View>
          <BotaoDeTexto rotulo="Pular" aoTocar={() => setEtapa("fim")} />
        </ScrollView>
      </>
    );
  } else if (etapa === "fim") {
    const m = minutosFeitos || minutos;
    const seqDepois = sequenciaDeDatas(lerRegistro(loja.blob[CHAVE_LOG_MEDITACAO]).dias);
    miolo = (
      <>
        <TopoDaAtividade />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: margem.tela, paddingBottom: espaco.xxl }}
        >
          <FimDoMomento
            momento="meditation"
            cor={PALETA.acao}
            titulo={`${m} ${m === 1 ? "minuto" : "minutos"} só seus`}
            fala={
              (humor && FECHAMENTO[humor]) ||
              "Você tirou um tempinho só pra você. Leve essa calma com você."
            }
            desfecho={desfecho}
            D={at.D}
            cuidado={at.cuidado}
            pos={at.pos}
            arte={
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                <Brilho tamanho={200} tinta={PALETA.luz} />
                <Image
                  source={ARTE_LOTUS}
                  style={{ width: 132, height: 132 }}
                  contentFit="contain"
                  accessibilityIgnoresInvertColors
                />
              </View>
            }
            confete
            extra={seqDepois > 0 ? <Sequencia dias={seqDepois} /> : null}
          />
        </ScrollView>
      </>
    );
  } else {
    miolo = (
      <>
        <TopoDaAtividade />
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: margem.foco,
            paddingTop: espaco.xs,
            paddingBottom: mostrarMenu ? FOLGA_DO_RODAPE + espaco.lg : espaco.xxl,
          }}
        >
          <BolhaComBalao lado humor="feliz" fala={falaDoBalao(registro)} />
          <TituloDaAtividade>Meditar</TituloDaAtividade>

          {/* O programa é a porta da tela: vem primeiro. */}
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
              <Secao topo={espaco.xl}>De quanto tempo você tem?</Secao>
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

              <Secao>O que você precisa agora?</Secao>
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
                      depois={i === sugerida ? <SeloDoDia ativa={ativa} /> : null}
                    />
                  );
                })}
              </View>

              {/* O som e a voz são ajustes, e não perguntas: duas linhas que
                  abrem a folha (eram 32 pílulas de som e 3 linhas de voz). */}
              <View style={{ marginTop: 28 }}>
                <GrupoDeResumo>
                  <LinhaDeResumo
                    primeira
                    rotulo="Som de fundo"
                    valor={rotuloDoSom(som)}
                    aoTocar={() => setFolhaDoSom(true)}
                  />
                  <LinhaDeResumo
                    rotulo="Voz"
                    valor={DENSIDADES.find((d) => d.chave === densidade)?.rotulo ?? ""}
                    aoTocar={() => setFolhaDaVoz(true)}
                  />
                </GrupoDeResumo>
              </View>
            </>
          ) : null}

          {/* O lembrete: uma linha discreta, e não um segundo botão cheio
              disputando com o programa. Fora do Modo Cuidado, como no site. */}
          {at.uid && !at.cuidado ? <LembreteDiario uid={at.uid} dias={registro.dias} /> : null}

          {/* Coisas que ela pode querer EM VEZ da sessão de hoje — não são
              escolhas desta meditação, e por isso têm a cara de navegar.
              "Para vocês dois" é preparação para o parto: só na gestação,
              fora do Modo Cuidado, da 28ª semana em diante (`casalAberto`). */}
          <View style={{ marginTop: espaco.xl, gap: espaco.md }}>
            {casalAberto({ cuidado: at.cuidado, posParto: at.pos, semana: at.semana }) ? (
              <LinhaDaAtividade
                arte={<ArteDaLinha fonte={ARTE_APOIO} />}
                titulo="Para vocês dois"
                legenda="10 min com quem vai estar com você no parto"
                aoTocar={() => {
                  pararAmostra();
                  router.push("/jornada/casal");
                }}
              />
            ) : null}
            <LinhaDaAtividade
              arte={<ArteDaLinha fonte={ARTE_SONS} />}
              titulo="Só sons, para dormir"
              legenda="Chuva, mar ou vento, com a tela apagada"
              aoTocar={() => {
                pararAmostra();
                router.push("/jornada/dormir");
              }}
            />
          </View>
        </ScrollView>
      </>
    );
  }

  return (
    <FundoDaAtividade paleta={PALETA}>
      <TrocaDeEtapa chave={chave}>{miolo}</TrocaDeEtapa>
      {chave === "escolha" && mostrarMenu ? (
        <RodapeDaAtividade>
          <BotaoDaAtividade
            cor={PALETA.acao}
            luz={PALETA.luz}
            rotulo={`Começar · ${minutos} min`}
            icone={<Play size={18} color={cor.branco} fill={cor.branco} />}
            aoTocar={() => comecar()}
          />
        </RodapeDaAtividade>
      ) : null}
      {/* As folhas do menu. Tocar num som deixa ouvir cinco segundos; a folha
          fica aberta para ela comparar. */}
      <FolhaDeSons
        aberta={folhaDoSom && chave === "escolha"}
        som={som}
        cuidado={at.cuidado}
        paleta={PALETA}
        amostrando={amostrando}
        nota="Toque num som para ouvir 5 segundos."
        aoFechar={() => {
          pararAmostra();
          setFolhaDoSom(false);
        }}
        aoEscolher={escolherSom}
      />
      <FolhaDaAtividade
        aberta={folhaDaVoz && chave === "escolha"}
        titulo="Quanta voz você quer?"
        paleta={PALETA}
        aoFechar={() => setFolhaDaVoz(false)}
      >
        <GrupoDaFolha>
          {DENSIDADES.map((d, i) => (
            <LinhaDaFolha
              key={d.chave}
              paleta={PALETA}
              primeira={i === 0}
              titulo={d.rotulo}
              legenda={d.sub}
              marcada={densidade === d.chave}
              aoTocar={() => {
                setDensidade(d.chave);
                /* Escolher a quantidade é querer a voz: ela volta a ligar.
                   Só o botão da sessão cala tudo. */
                setVoz(true);
                setFolhaDaVoz(false);
              }}
            />
          ))}
        </GrupoDaFolha>
      </FolhaDaAtividade>
    </FundoDaAtividade>
  );
}

/* ── Peças da tela ────────────────────────────────────────────────────── */

function BotaoDeTexto({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        toque();
        aoTocar();
      }}
      hitSlop={8}
      style={({ pressed }) => ({
        marginTop: espaco.lg,
        minHeight: ALVO_MINIMO,
        paddingHorizontal: espaco.md,
        justifyContent: "center",
        opacity: pressed ? 0.55 : 1,
      })}
    >
      <Text style={{ ...fonte.forte, ...escala.legenda, color: PALETA.acao }}>{rotulo}</Text>
    </Pressable>
  );
}

/** O selo "Do dia" no tema sugerido. */
function SeloDoDia({ ativa }: { ativa: boolean }) {
  return (
    <View
      style={{
        borderRadius: canto.pilula,
        paddingHorizontal: espaco.sm,
        paddingVertical: 3,
        backgroundColor: ativa ? "rgba(255,255,255,0.22)" : PALETA.luz,
      }}
    >
      <Text style={{ ...fonte.forte, ...escala.nota, color: ativa ? cor.branco : PALETA.acao }}>
        Do dia
      </Text>
    </View>
  );
}

/** A sequência no fim: a chama do app (o primeiro quadro do sprite) e os dias. */
function Sequencia({ dias }: { dias: number }) {
  const t = 22;
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
      accessible
      accessibilityLabel={`${dias} ${dias === 1 ? "dia seguido" : "dias seguidos"}`}
    >
      <View style={{ width: t, height: t, overflow: "hidden" }}>
        <Image source={CHAMA} style={{ width: t * 6, height: t * 6 }} contentFit="fill" />
      </View>
      <Text style={{ ...fonte.forte, ...escala.legenda, color: PALETA.acao }}>
        {dias} {dias === 1 ? "dia seguido" : "dias seguidos"}
      </Text>
    </View>
  );
}

function GrupoDeResumo({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        borderRadius: canto.dentro,
        ...curva,
        backgroundColor: luz.cartao,
        borderWidth: 0.5,
        borderColor: "rgba(255,255,255,0.9)",
        overflow: "hidden",
        ...sombra,
      }}
    >
      {children}
    </View>
  );
}

/** "Som de fundo · Chuva ›": o ajuste e o valor de agora, que abre a folha. */
function LinhaDeResumo({
  rotulo,
  valor,
  aoTocar,
  primeira,
}: {
  rotulo: string;
  valor: string;
  aoTocar: () => void;
  primeira?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${rotulo}: ${valor}. Toque para trocar`}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        minHeight: ALVO_MINIMO + 8,
        paddingHorizontal: espaco.lg,
        backgroundColor: pressed ? cor.apagado : "transparent",
      })}
    >
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.sm,
          borderTopWidth: primeira ? 0 : 0.5,
          borderTopColor: cor.borda,
          minHeight: ALVO_MINIMO + 8,
        }}
      >
        <Text style={{ flex: 1, ...fonte.forte, ...escala.legenda, color: cor.texto }}>
          {rotulo}
        </Text>
        <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}>{valor}</Text>
        <ChevronRight size={18} color={cor.chevron} strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}

/* ── O lembrete diário ────────────────────────────────────────────────────── */

function LembreteDiario({ uid, dias }: { uid: string; dias: readonly string[] }) {
  /* `undefined` enquanto lê o aparelho: a linha não pisca "Ativar" para quem já ligou. */
  const [hora, setHora] = useState<string | null | undefined>(undefined);
  const [escolhendo, setEscolhendo] = useState(false);
  const [semPermissao, setSemPermissao] = useState(false);
  const bancada = ehBancada();

  useEffect(() => {
    let vivo = true;
    if (bancada) {
      const h = parametroDaBancada("lembrete");
      setHora(h && horaValida(h) ? h : null);
      return;
    }
    void lerLembreteDaMeditacao(uid).then((h) => {
      if (vivo) setHora(h);
    });
    /* Ao abrir: a agenda é refeita (dias novos à frente; hoje sai se já meditou). */
    void reagendarLembreteDaMeditacao(uid, dias);
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  async function definir(nova: string | null) {
    const antes = hora;
    setHora(nova);
    setSemPermissao(false);
    if (bancada) return;
    const r = await definirLembreteDaMeditacao(uid, nova, dias);
    if (r === "sem-permissao") {
      setHora(antes ?? null);
      setSemPermissao(true);
    }
  }

  if (hora === undefined) return null;
  return (
    <View style={{ marginTop: espaco.xl }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.md,
          minHeight: ALVO_MINIMO + 8,
        }}
      >
        <Ficha fundo={MATERIAL.ficha} tamanho={34}>
          <Bell size={17} color={PALETA.acao} strokeWidth={2.2} />
        </Ficha>
        <View style={{ flex: 1 }}>
          <Text style={{ ...fonte.forte, ...escala.legenda, color: cor.texto }}>
            Lembrar todo dia
          </Text>
          <Text style={{ ...fonte.normal, ...escala.nota, color: cor.textoApagado }}>
            {hora
              ? "Não aviso nos dias em que você já meditou"
              : "Um aviso na hora que você escolher"}
          </Text>
        </View>
        {hora ? (
          <>
            <PilulaComRelevo
              paleta={PALETA}
              rotulo={hora}
              numero
              rotuloAcessivel={`Horário do lembrete: ${hora}. Toque para trocar`}
              aoTocar={() => setEscolhendo(true)}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Desligar lembrete"
              onPress={() => {
                toque();
                void definir(null);
              }}
              hitSlop={6}
              style={({ pressed }) => ({
                width: 32,
                minHeight: ALVO_MINIMO,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.55 : 1,
              })}
            >
              <X size={18} color={cor.textoApagado} strokeWidth={2.2} />
            </Pressable>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ativar o lembrete"
            onPress={() => {
              toque();
              void definir(HORA_PADRAO);
            }}
            hitSlop={8}
            style={({ pressed }) => ({
              minHeight: ALVO_MINIMO,
              paddingHorizontal: espaco.sm,
              justifyContent: "center",
              opacity: pressed ? 0.55 : 1,
            })}
          >
            <Text style={{ ...fonte.forte, ...escala.legenda, color: PALETA.acao }}>Ativar</Text>
          </Pressable>
        )}
      </View>
      {semPermissao ? (
        <Text
          style={{
            marginTop: 6,
            ...fonte.normal,
            ...escala.nota,
            color: cor.textoApagado,
          }}
        >
          Ative as notificações do app nos Ajustes do iPhone para o lembrete chegar.
        </Text>
      ) : null}
      <FolhaDaAtividade
        aberta={escolhendo}
        titulo="Horário do lembrete"
        paleta={PALETA}
        aoFechar={() => setEscolhendo(false)}
      >
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: espaco.sm,
          }}
        >
          {HORARIOS.map((h) => (
            <PilulaComRelevo
              key={h}
              paleta={PALETA}
              rotulo={h}
              numero
              cheia={h === hora}
              aoTocar={() => {
                setEscolhendo(false);
                void definir(h);
              }}
            />
          ))}
        </View>
      </FolhaDaAtividade>
    </View>
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
      {/* O cartão do programa é a porta principal da tela: a cor cheia da
          meditação e a flor de lótus 3D INTEIRA no canto (cortada na quina,
          parecia erro). */}
      <View
        style={{
          marginTop: espaco.xl,
          borderRadius: canto.cartao,
          ...curva,
          overflow: "hidden",
          ...brilhoDe(PALETA.acao, 0.5),
        }}
      >
        <LinearGradient
          colors={[clarear(PALETA.acao, 0.12), PALETA.acao, escurecer(PALETA.acao, 0.12)]}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 20 }}
        >
          <View pointerEvents="none" style={{ position: "absolute", right: 12, top: 12 }}>
            <Brilho tamanho={150} tinta={clarear(PALETA.acao, 0.4)} />
            <Image
              source={ARTE_LOTUS}
              style={{ width: 96, height: 96 }}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
          </View>
          <Text
            style={{
              ...fonte.forte,
              ...escala.nota,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.82)",
            }}
          >
            Dia {dia.dia} de {PROGRAMA.length}
          </Text>
          <Text
            style={{
              marginTop: 6,
              maxWidth: "62%",
              ...fonte.display,
              ...escala.titulo2,
              letterSpacing: -0.2,
              color: cor.branco,
            }}
          >
            {dia.titulo}
          </Text>
          <Text
            style={{
              marginTop: 4,
              maxWidth: "62%",
              ...fonte.normal,
              ...escala.legenda,
              color: "rgba(255,255,255,0.86)",
            }}
          >
            {dia.sub}
          </Text>
          <View
            style={{ marginTop: espaco.lg, flexDirection: "row", gap: 4 }}
            accessible
            accessibilityLabel={`${feitos} de ${PROGRAMA.length} dias feitos`}
          >
            {PROGRAMA.map((d) => (
              <View
                key={d.dia}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: d.dia <= feitos ? cor.branco : "rgba(255,255,255,0.3)",
                }}
              />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Começar"
            onPress={() => {
              toque();
              aoComecar();
            }}
            style={({ pressed }) => ({
              marginTop: espaco.lg,
              borderRadius: 22,
              ...curva,
              backgroundColor: escurecer(PALETA.acao, 0.38),
              paddingBottom: pressed ? 1 : 5,
              transform: [{ translateY: pressed ? 4 : 0 }],
            })}
          >
            <View
              style={{
                minHeight: 52,
                borderRadius: 22,
                ...curva,
                backgroundColor: cor.branco,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: espaco.sm,
              }}
            >
              <Play size={17} color={PALETA.acao} fill={PALETA.acao} />
              <Text style={{ ...fonte.forte, fontSize: 17, lineHeight: 22, color: PALETA.acao }}>
                Começar
              </Text>
            </View>
          </Pressable>
        </LinearGradient>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Escolher outra meditação"
        onPress={() => {
          toque();
          aoAbrirMenu();
        }}
        hitSlop={6}
        style={({ pressed }) => ({
          marginTop: espaco.sm,
          alignSelf: "center",
          minHeight: ALVO_MINIMO,
          paddingHorizontal: espaco.md,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          opacity: pressed ? 0.55 : 1,
        })}
      >
        <Text style={{ ...fonte.forte, ...escala.legenda, color: PALETA.acao }}>
          Escolher outra
        </Text>
        <ChevronDown size={18} color={PALETA.acao} strokeWidth={2.4} />
      </Pressable>
    </>
  );
}

/* ── A sessão: o círculo que respira ─────────────────────────────────────── */

type Pausa = null | "toque" | "fundo";

function MantemAcesa() {
  useKeepAwake("dc-meditar");
  return null;
}

/**
 * O tempo que falta ("3m", e "45s" no último minuto): só ele se redesenha
 * enquanto ela respira, e só quando o número muda.
 */
function TempoQueFalta({
  total,
  agora,
  parado,
}: {
  total: number;
  agora: () => number;
  parado: boolean;
}) {
  const texto = useCallback(() => formatarRestante(total - agora()), [total, agora]);
  const [rotulo, setRotulo] = useState(texto);
  useEffect(() => {
    setRotulo(texto());
    if (parado) return;
    let id: ReturnType<typeof setTimeout> | undefined;
    const proximo = () => {
      const resta = total - agora();
      setRotulo(formatarRestante(resta));
      if (resta <= 0) return;
      /* No último minuto o número muda a cada segundo; antes, a cada minuto. */
      const ate = resta <= 60 ? (resta + 0.5) % 1 || 1 : resta % 60 || 60;
      id = setTimeout(proximo, Math.max(50, ate * 1000 + 20));
    };
    proximo();
    return () => clearTimeout(id);
  }, [total, parado, texto, agora]);
  return (
    <Text
      style={{
        minWidth: 30,
        textAlign: "right",
        ...fonte.forte,
        ...escala.nota,
        color: cor.textoApagado,
        fontVariant: ["tabular-nums"],
      }}
    >
      {rotulo}
    </Text>
  );
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
  /* O segundo da sessão — reescrito só na troca de fase, na pausa e na volta. */
  const [t, setT] = useState(inicio.t);
  const [pausa, setPausa] = useState<Pausa>(inicio.pausa);
  const pausada = pausa !== null;
  /* Volta da pausa: a fala do ciclo é dita de novo do começo (a pausa a cortou
     no meio, e o texto dela continua na tela). */
  const [retomada, setRetomada] = useState(0);
  const [folha, setFolha] = useState(inicio.folha);
  const relogio = useRef({ desde: Date.now(), acumulado: inicio.t, rodando: false });
  const terminou = useRef(false);
  const respiro = useRef(new Animated.Value(ESCALA_RESPIRO.solte)).current;
  const barra = useRef(new Animated.Value(Math.min(1, inicio.t / total))).current;

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

  const inst = instanteNoTempo(Math.min(t, total - 0.001));
  const falaAgora = falaNoCiclo(plano, inst.ciclo);

  /* A próxima troca de fase: um `setTimeout`, e um render por fase. */
  useEffect(() => {
    if (pausada || t >= total) return;
    const prox = Math.min(total, t + (1 - inst.progresso) * DURACAO_DA_FASE[inst.fase]);
    const id = setTimeout(
      () => setT(Math.max(prox + 1e-3, agora())),
      Math.max(0, (prox - agora()) * 1000),
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, pausada, total, agora]);

  /* A barra da sessão anda sozinha no motor nativo, do ponto de agora ao fim. */
  useEffect(() => {
    const ja = Math.min(1, agora() / total);
    barra.setValue(ja);
    if (pausada) return;
    const a = Animated.timing(barra, {
      toValue: 1,
      duration: Math.max(0, (total - agora()) * 1000),
      easing: Easing.linear,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pausada, retomada]);

  function pausar(motivo: "toque" | "fundo") {
    if (pausada || terminou.current) return;
    setT(agora());
    setPausa(motivo);
    pararVozes();
    aoPausar(true);
  }
  function retomar() {
    if (!pausada) return;
    /* A respiração recomeça na inspiração do MESMO ciclo — como no site. */
    const recomeco = instanteNoTempo(Math.min(agora(), total - 0.001)).ciclo * CICLO;
    relogio.current.acumulado = recomeco;
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
      respiro.stopAnimation();
      respiro.setValue(ESCALA_RESPIRO.solte);
      return;
    }
    if (Platform.OS !== "web")
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.timing(respiro, {
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
    tocarVoz(VOZ_REGRAVADA[falaAgora.id] ?? VOZ_DA_MEDITACAO[falaAgora.id], { canal: "guia" });
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
    <View style={{ flex: 1 }}>
      {Platform.OS !== "web" && !pausada ? <MantemAcesa /> : null}
      <TopoDaAtividade
        aoFechar={() => aoEncerrar(inst.ciclo)}
        meio={
          <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
            <BarraQueAnda valor={barra} />
            <TempoQueFalta total={total} agora={agora} parado={pausada} />
          </View>
        }
      />

      <View style={{ flex: 1 }}>
        <View
          importantForAccessibility={pausada ? "no-hide-descendants" : "auto"}
          accessibilityElementsHidden={pausada}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: margem.foco,
            paddingBottom: 96,
          }}
        >
          <Circulo escala={respiro} rotulo={ROTULO_DA_FASE[inst.fase]} oculto={pausada} />
          <Text
            key={inst.ciclo}
            style={{
              marginTop: 36,
              minHeight: 90,
              maxWidth: 360,
              textAlign: "center",
              ...fonte.display,
              ...escala.titulo2,
              lineHeight: 30,
              fontWeight: "400",
              letterSpacing: -0.2,
              color: falaAgora ? cor.texto : cor.textoApagado,
            }}
          >
            {falaAgora?.texto ?? "Só respire."}
          </Text>
        </View>
      </View>
      {/* O véu cobre a tela inteira (até atrás da barra de status), por baixo
          do fechar e dos controles: sem faixa cortada no alto. */}
      {pausada ? <VeuDaPausa motivo={pausa} /> : null}

      <ControlesDaSessao
        paleta={PALETA}
        pausada={pausada}
        aoAlternar={() => (pausada ? retomar() : pausar("toque"))}
        esquerda={<BotaoDaVoz ligada={voz} aoTocar={aoTrocarVoz} />}
        direita={
          <BotaoDoControle rotulo="Trocar o som de fundo" aoTocar={() => setFolha(true)}>
            {som === "silencio" ? (
              <VolumeX size={22} color={cor.textoApagado} strokeWidth={2.2} />
            ) : (
              <Volume2 size={22} color={cor.texto} strokeWidth={2.2} />
            )}
          </BotaoDoControle>
        }
      />
      <FolhaDeSons
        aberta={folha}
        som={som}
        cuidado={cuidado}
        paleta={PALETA}
        aoFechar={() => setFolha(false)}
        aoEscolher={(k) => {
          aoEscolherSom(k);
          setFolha(false);
        }}
      />
    </View>
  );
}

/** A barra da sessão: enche no motor nativo, do ponto de agora até o fim. */
function BarraQueAnda({ valor }: { valor: Animated.Value }) {
  /* A barra cheia desliza da esquerda para dentro do trilho (deslocamento é
     transformação: anda no motor nativo, sem depender da origem do `scale`). */
  const [largura, setLargura] = useState(0);
  return (
    <View
      onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
      style={{
        flex: 1,
        height: 4,
        borderRadius: 2,
        backgroundColor: cor.trilho,
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={{
          height: 4,
          width: "100%",
          borderRadius: 2,
          backgroundColor: PALETA.acao,
          opacity: largura > 0 ? 1 : 0,
          transform: [
            { translateX: valor.interpolate({ inputRange: [0, 1], outputRange: [-largura, 0] }) },
          ],
        }}
      />
    </View>
  );
}

/* O círculo: a luz da meditação por dentro, com um aro da ação. */
const CIRCULO = {
  halo: misturar(PALETA.luz, PALETA.acao, 0.12),
  claro: "rgba(255,255,255,0.95)",
  escuro: comAlfa(misturar(PALETA.luz, PALETA.acao, 0.28), 0.85),
  aro: comAlfa(PALETA.acao, 0.22),
} as const;

/** O halo, o círculo e a bolha dormindo, respirando juntos na mesma escala. */
function Circulo({
  escala: s,
  rotulo,
  oculto,
}: {
  escala: Animated.Value;
  rotulo: string;
  oculto: boolean;
}) {
  return (
    <View style={{ width: 224, height: 224, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ position: "absolute", transform: [{ scale: s }] }} accessible={false}>
        <Svg width={224} height={224}>
          <Defs>
            <RadialGradient id="halo-da-meditacao" cx="50%" cy="50%" r="50%">
              <Stop offset="0.35" stopColor={CIRCULO.halo} stopOpacity={0.55} />
              <Stop offset="1" stopColor={CIRCULO.halo} stopOpacity={0} />
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
          borderColor: CIRCULO.aro,
          overflow: "hidden",
          transform: [{ scale: s }],
        }}
      >
        <LinearGradient
          colors={[CIRCULO.claro, CIRCULO.escuro]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
      <View style={{ alignItems: "center", gap: espaco.sm }}>
        <Animated.View style={{ transform: [{ scale: s }] }}>
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
            /* Pausada, a palavra da fase some: ela vazaria por trás do "Pausado". */
            opacity: oculto ? 0 : 1,
            ...fonte.forte,
            fontSize: 15,
            lineHeight: 20,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: PALETA.acao,
          }}
        >
          {rotulo}
        </Text>
      </View>
    </View>
  );
}

/**
 * O véu da pausa: cobre o círculo, nunca os controles — o botão de continuar
 * é o grande, no pé, onde o polegar já está.
 */
function VeuDaPausa({ motivo }: { motivo: Pausa }) {
  const area = useSafeAreaInsets();
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: -area.top,
        bottom: -area.bottom,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: margem.foco + espaco.sm,
        paddingBottom: 96,
        backgroundColor: comAlfa(luz.base, 0.9),
      }}
    >
      <Text
        accessibilityRole="header"
        accessibilityLiveRegion="assertive"
        style={{
          ...fonte.display,
          ...escala.titulo1,
          letterSpacing: -0.2,
          color: cor.texto,
        }}
      >
        Pausado
      </Text>
      <Text
        style={{
          marginTop: espaco.sm,
          maxWidth: 320,
          textAlign: "center",
          ...fonte.normal,
          ...escala.legenda,
          color: cor.textoApagado,
        }}
      >
        {motivo === "fundo"
          ? "O app saiu da tela e a sessão parou aqui. Está tudo guardado."
          : "Sem pressa. A respiração espera por você."}
      </Text>
    </View>
  );
}
