import { Image } from "expo-image";
import ShieldCheck from "lucide-react-native/icons/shield-check";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Pressable,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextStyle,
} from "react-native";
import { estadoDoNo as estadoDaPele, type TrilhaSkin } from "@/lib/trilha-skins";
import { BOLHA } from "~/componentes/artes";
import { useAviso } from "~/componentes/aviso";
import { NaoConsegueLer, selecao, toque, Tocavel, useFolgaDaBarra } from "~/componentes/base";
import {
  BarraDaSemana,
  corDaFaseDaGestacao,
  FaixaDaFase,
  NoDaTrilha,
  tonsDaSemana,
  TracadoDoBloco,
} from "~/componentes/caminho/blocos";
import { corCaminho } from "~/componentes/caminho/cores";
import {
  ChamaDaSequencia,
  Emoji,
  IconeAmigas,
  IconeSementinha,
  TrofeuParado,
} from "~/componentes/caminho/pecas";
import {
  BarraDeArrumar,
  BotaoDeArrumar,
  EnfeiteNaTrilha,
  FundoEAr,
  type ArrumarEnfeite,
} from "~/componentes/caminho/enfeites";
import { CEUS, useCeuDasAbas } from "~/componentes/ceu-vivo";
import { Folha } from "~/componentes/jornada/pecas";
import { useMovimentoReduzido } from "~/componentes/movimento";
import {
  DegradeDoTopo,
  PilulaDeHoje,
  useAbrirEmHoje,
  useEstavel,
} from "~/componentes/caminho/rolagem";
import { Vidro } from "~/componentes/vidro";
import { parametroDaBancada } from "~/lib/bancada";
import { falaDoNoDeHoje, PERGUNTA_DO_HUMOR, reacaoAoHumor } from "~/lib/bolha/falas-do-jogo";
import { misturar } from "~/lib/cor";
import {
  HUMORES,
  ligacoesDaTrilha,
  MARCOS,
  montarCaminho,
  TOM_TRAVADO,
  type Bloco,
  type Fase,
  type PontoDaTrilha,
} from "~/lib/jornada/caminho";
import {
  alturaNoSite,
  bandeja as bandejaDe,
  climasDela,
  DECOR_MAX,
  enfeitesPorBloco,
  enfeitesVisiveis,
  iniciosDasSemanas,
  moverEnfeite,
  novoEnfeite,
  paradasDoDegrade,
  semearNovos,
  Y_INICIAL_DO_SITE,
  type Decoracao,
  type EnfeiteNoBloco,
  type EnfeitePosto,
} from "~/lib/jornada/enfeites";
import type { Blob } from "~/lib/jornada/momentos";
import { resumirSemanas, type EstadoDoNo, type ResumoDaSemana } from "~/lib/jornada/trilha";
import { ALVO_MINIMO, canto, cor, escala, espaco, fonte, luz, margem } from "~/tema";

/**
 * O CAMINHO — a trilha da gestação inteira numa tela só, o desenho aprovado
 * do site (src/components/gestacao-path.tsx) em peças nativas.
 *
 * Em cima, numa camada que FLUTUA sobre a trilha: o cabeçalho da aba (quando
 * a tela o passa), o placar (chama, amigas, troféus, sementinhas) com o lápis
 * do Arrumar ao lado, e a Bolha perguntando "como você está hoje?" enquanto
 * ela não responde (o MESMO check-in da conversa da aba do bebê). A
 * trilha passa por baixo e se desfaz num degradê do céu, como no iOS.
 *
 * Embaixo, a trilha: uma faixa por fase, uma barra por semana e um nó por
 * dia, em zigue-zague, ligados por um traço — cheio até hoje, pontilhado
 * depois. Hoje é o nó maior, com o anel dos cinco cuidados, o halo e o balão
 * em que a Bolha fala ("Vamos começar?").
 *
 * A trilha é uma lista VIRTUALIZADA de blocos (uma fase, ou uma semana com os
 * sete dias): são ~300 nós. Cada bloco tem altura fixa (`montarCaminho`), e o
 * cabeçalho da lista também (só o espaço da camada de cima): a posição de hoje
 * sai de uma soma, e a lista NASCE nela (`contentOffset`), sem salto.
 *
 * O que ela compra no Cantinho mora aqui: os enfeites espalhados pela trilha
 * (nas posições do SITE — o layout é o mesmo nos dois, no blob da jornada), o
 * cenário e o ar atrás dela, e a pele das bolinhas. O lápis abre o Arrumar.
 *
 * Bancada: `&topo=1` abre no alto da trilha; `&arrumar=1`, no modo Arrumar.
 */

export type PropsDoCaminho = {
  hojeD: number;
  semanaAtual: number;
  fases: readonly Fase[];
  blob: Blob;
  saldo: number | null;
  trofeus: number | null;
  carregandoCarteira: boolean;
  chama: number;
  /** Perdões guardados: o escudinho ao lado da chama (um dia em branco não a apaga). */
  perdoes?: number;
  amigas: number | null;
  /** O cabeçalho da aba (o título e o perfil): flutua junto com o placar. */
  cabecalho?: ReactNode;
  /** O humor já foi marcado hoje (a faixa some). */
  humorFeito: boolean;
  aoMarcarHumor: (humor: string) => void;
  aoAbrirDia: (D: number) => void;
  aoAbrirSemana: (semana: number) => void;
  /** As sementinhas do placar abrem as Recompensas (a cestinha que flutuava saiu). */
  aoAbrirLoja: () => void;
  /** Conquistas desbloqueadas esperando o toque que paga: o selo nas sementinhas. */
  aResgatar?: number;
  aoAbrirAmigas: () => void;
  aoAbrirFolha: (qual: "chama" | "sementes" | "trofeus") => void;
  /** Ler a carteira de novo (a folha de "não conseguimos carregar" das sementinhas). */
  aoRecarregarCarteira?: () => void;
  /**
   * O que a tela mostrava no alto da lista (a carteira que falhou, o presente).
   * A trilha não o desenha mais no alto (ninguém rolava 23 semanas para vê-lo):
   * com a carteira em falha e sem `aoRecarregarCarteira`, ele vai para a folha
   * das sementinhas.
   */
  topo?: ReactNode;
  /** @deprecated O nascimento tem porta na aba do bebê; a trilha não o mostra mais. */
  nomeDoBebe?: string | null;
  /** @deprecated Idem. */
  aoContarNascimento?: () => void;
  /** O layout dos enfeites (`dc-path-decor`), como está gravado. */
  decoracao: Decoracao | null;
  /** O que ela tem no Cantinho (`null` = ainda não sei: vale o layout gravado). */
  possuidos: readonly string[] | null;
  /** O cenário equipado (o degradê do catálogo), ou nenhum. */
  cenario: string | null;
  /** A pele das bolinhas, se ela equipou uma. */
  pele: TrilhaSkin | null;
  /** O blob da nuvem já chegou: só então se espalha enfeite novo. */
  podeSemear: boolean;
  aoGravarDecoracao: (d: Decoracao) => void;
};

export function Caminho(p: PropsDoCaminho) {
  const blocos = useMemo(() => montarCaminho(p.fases, p.hojeD), [p.fases, p.hojeD]);
  const deslocamentos = useMemo(() => {
    const d: number[] = [];
    let soma = 0;
    for (const b of blocos) {
      d.push(soma);
      soma += b.altura;
    }
    return d;
  }, [blocos]);
  const indiceDeHoje = blocos.findIndex((b) => b.tipo === "semana" && b.dias.some((d) => d.hoje));
  const yDeHoje =
    indiceDeHoje >= 0
      ? (() => {
          const b = blocos[indiceDeHoje]!;
          return (
            deslocamentos[indiceDeHoje]! + (b.tipo === "semana" ? b.dias.find((d) => d.hoje)!.y : 0)
          );
        })()
      : 0;
  const proximos = useMemo(() => ligacoesDaTrilha(blocos), [blocos]);

  /* ── O blob lido UMA vez: o resumo de cada semana ──
     A semana que não mudou devolve o mesmo objeto, e o bloco dela (`memo`)
     não se redesenha: marcar um momento hoje redesenha só a semana de hoje. */
  const semanas = useMemo(
    () => blocos.flatMap((b) => (b.tipo === "semana" ? [b.semana] : [])),
    [blocos],
  );
  const resumosAntes = useRef<Map<number, ResumoDaSemana> | undefined>(undefined);
  const resumos = useMemo(() => {
    const r = resumirSemanas(p.blob, semanas, p.hojeD, resumosAntes.current);
    resumosAntes.current = r;
    return r;
  }, [p.blob, semanas, p.hojeD]);

  /* ── As setas da tela, estáveis ── */
  const aoAbrirDia = useEstavel(p.aoAbrirDia);
  const aoAbrirSemana = useEstavel(p.aoAbrirSemana);
  const aoMarcarHumor = useEstavel(p.aoMarcarHumor);
  const aoAbrirLoja = useEstavel(p.aoAbrirLoja);
  const aoAbrirAmigas = useEstavel(p.aoAbrirAmigas);
  const aoAbrirFolha = useEstavel(p.aoAbrirFolha);
  const aoGravarDecoracao = useEstavel(p.aoGravarDecoracao);

  /* ── O movimento: parado com "reduzir movimento", fora de foco (as duas
     coisas o `useMovimentoReduzido` já sabe) e enquanto ela arruma. ── */
  const reduzido = useMovimentoReduzido();
  const [arrumando, setArrumando] = useState(() => parametroDaBancada("arrumar") === "1");
  const parado = reduzido || arrumando;

  /* ── Abrir em HOJE, sem salto (e voltar a ele): ver `rolagem.tsx` ── */
  const folga = useFolgaDaBarra();
  const {
    lista,
    caixa,
    alturaDaCamada,
    espacador,
    pronto,
    aoMedirCaixa,
    aoMedirCamada,
    contentOffset,
    indiceInicial,
    aVista,
    aoMedirALista,
    longe,
    aoParar: avaliarAoParar,
    irParaHoje,
    rolagemAgora,
  } = useAbrirEmHoje<Bloco>({ yDeHoje, indiceDeHoje, folga, reduzido });
  const largura = caixa?.largura ?? 0;

  /* ── O Cantinho na trilha ── */
  const alturas = useMemo(() => blocos.map((b) => b.altura), [blocos]);
  const ehSemana = useMemo(() => blocos.map((b) => b.tipo === "semana"), [blocos]);
  const alturaDaTrilha = useMemo(() => alturaNoSite(alturas), [alturas]);
  const inicios = useMemo(() => iniciosDasSemanas(alturas, ehSemana), [alturas, ehSemana]);
  const visiveis = useMemo(
    () => enfeitesVisiveis(p.decoracao, p.possuidos),
    [p.decoracao, p.possuidos],
  );
  /* No Arrumar, cada enfeite fica onde ela pôs; fora dele, o que cairia atrás
     da barra da semana desce para baixo dela. A lista de um bloco que não
     mudou continua a MESMA (o Cantinho é relido a cada foco da aba). */
  const porBlocoAntes = useRef<EnfeiteNoBloco[][]>([]);
  const porBloco = useMemo(() => {
    const novo = enfeitesPorBloco(visiveis, alturas, arrumando ? undefined : ehSemana);
    const antes = porBlocoAntes.current;
    const fora = novo.map((lista, i) => {
      const velha = antes[i];
      return velha &&
        velha.length === lista.length &&
        velha.every((e, j) => e.p === lista[j]!.p && e.y === lista[j]!.y)
        ? velha
        : lista;
    });
    porBlocoAntes.current = fora;
    return fora;
  }, [visiveis, alturas, ehSemana, arrumando]);
  const paradas = useMemo(() => (p.cenario ? paradasDoDegrade(p.cenario) : null), [p.cenario]);
  /* O clima vem do que ela POSSUI, nunca de onde ele está: ele é o ar da
     trilha, e não tem lugar (o defeito da Poeira de estrelas no site). */
  const climas = useMemo(() => climasDela(p.possuidos ?? []), [p.possuidos]);
  const bandeja = useMemo(() => bandejaDe(p.possuidos ?? []), [p.possuidos]);

  /* ── O céu atrás do topo: o degradê onde a trilha se desfaz ── */
  const dasAbas = useCeuDasAbas();
  const corDoTopo = paradas?.length
    ? misturar(luz.base, paradas[0]!.cor, 0.55)
    : dasAbas
      ? CEUS[dasAbas.fase].topo
      : luz.base;

  /* ── O aviso do dia que ainda não abriu ── */
  const { avisar, aviso } = useAviso();

  /* ── Espalhar o que ela comprou e a trilha ainda não viu ──
     PERTO DE HOJE, onde o Caminho abre (a régua do app — `semearPertoDeHoje`):
     ela compra no Cantinho, volta e encontra o enfeite na primeira tela. Só
     depois do pull da nuvem, para não semear sobre um blob atrasado. */
  const avisouCheia = useRef(false);
  const { podeSemear, possuidos, decoracao } = p;
  useEffect(() => {
    if (!podeSemear || !possuidos) return;
    const r = semearNovos(
      decoracao,
      possuidos,
      alturaDaTrilha,
      Y_INICIAL_DO_SITE + yDeHoje,
      inicios,
    );
    if (r.esperando > 0 && !avisouCheia.current) {
      avisouCheia.current = true;
      avisar(`A trilha está cheia: são ${DECOR_MAX} enfeites. Os novos esperam no Arrumar.`);
    }
    if (r.decoracao) aoGravarDecoracao(r.decoracao);
  }, [
    podeSemear,
    possuidos,
    decoracao,
    alturaDaTrilha,
    yDeHoje,
    inicios,
    aoGravarDecoracao,
    avisar,
  ]);

  /* ── O modo Arrumar ── */
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const historico = useRef<EnfeitePosto[][]>([]);
  const [passos, setPassos] = useState(0);
  const rolagem = useRef(new Animated.Value(0)).current;

  /* As mudanças valem sobre o layout INTEIRO gravado (inclusive o que não está
     à vista), e cada uma guarda o estado anterior para o Desfazer. */
  const gravar = useCallback(
    (items: EnfeitePosto[]) => {
      const atual = decoracao ?? { v: 1 as const, items: [], seen: [] };
      historico.current = [...historico.current.slice(-39), atual.items];
      setPassos(historico.current.length);
      aoGravarDecoracao({ v: 1, items, seen: atual.seen });
    },
    [decoracao, aoGravarDecoracao],
  );
  const todos = useMemo(() => decoracao?.items ?? [], [decoracao]);

  const arrumar = useMemo<Omit<ArrumarEnfeite, "selecionado"> | null>(
    () =>
      arrumando
        ? {
            aoSelecionar: setSelecionado,
            aoArrastar: setArrastando,
            aoMover: (k, dx, dy) =>
              gravar(
                todos.map((q) =>
                  q.k === k
                    ? moverEnfeite(q, (dx / Math.max(1, largura)) * 100, dy, alturaDaTrilha)
                    : q,
                ),
              ),
            aoRedimensionar: (k, s) => gravar(todos.map((q) => (q.k === k ? { ...q, s } : q))),
            aoTirar: (k) => {
              setSelecionado(null);
              gravar(todos.filter((q) => q.k !== k));
            },
          }
        : null,
    [arrumando, gravar, todos, largura, alturaDaTrilha],
  );

  function porDaBandeja(id: string) {
    if (todos.length >= DECOR_MAX) {
      avisar(`A trilha já tem ${DECOR_MAX} enfeites. Tire um antes de pôr outro.`);
      return;
    }
    /* Nasce no meio do que está à vista, para ela ver o item aparecer. */
    const meio = rolagemAgora.current + (caixa?.altura ?? 0) / 2 - espacador + Y_INICIAL_DO_SITE;
    const k = `u${Date.now().toString(36)}-${id}`;
    gravar([...todos, novoEnfeite(id, meio, alturaDaTrilha, k)]);
    setSelecionado(k);
  }

  function desfazer() {
    const antes = historico.current.pop();
    setPassos(historico.current.length);
    if (!antes) return;
    setSelecionado(null);
    aoGravarDecoracao({ v: 1, items: antes, seen: decoracao?.seen ?? [] });
  }

  const comecarAArrumar = useCallback(() => {
    /* Cada sessão de Arrumar começa com o Desfazer zerado: ele desfaz o que
       ela acabou de fazer, nunca uma visita antiga. */
    historico.current = [];
    setPassos(0);
    setArrumando(true);
  }, []);

  /* ── O toque num nó: hoje e o que passou abrem a folha do dia; o que vem
     diz quando abre. ── */
  const hojeD = p.hojeD;
  const tocarNoDia = useCallback(
    (D: number) => {
      if (D > hojeD) {
        const emDias = D - hojeD;
        avisar(emDias === 1 ? "Esse dia abre amanhã." : `Esse dia abre em ${emDias} dias.`);
        return;
      }
      toque();
      aoAbrirDia(D);
    },
    [hojeD, avisar, aoAbrirDia],
  );

  const pele = p.pele;
  const renderItem = useCallback(
    ({ item, index }: { item: Bloco; index: number }) => {
      /* Só dados (nada de elemento pronto) para os blocos `memo` compararem. */
      const enfeites = {
        enfeites: porBloco[index] ?? SEM_ENFEITES,
        semanaAtual: p.semanaAtual,
        arrumar,
        selecionado,
        parado,
        arrumando,
      };
      if (item.tipo === "fase") return <BlocoDaFase bloco={item} {...enfeites} />;
      return (
        <BlocoDaSemana
          bloco={item}
          resumo={resumos.get(item.semana)!}
          proximo={proximos[index] ?? null}
          largura={largura}
          hojeD={hojeD}
          tocarNoDia={tocarNoDia}
          aoAbrirSemana={aoAbrirSemana}
          pele={pele}
          {...enfeites}
        />
      );
    },
    [
      porBloco,
      p.semanaAtual,
      parado,
      arrumar,
      selecionado,
      arrumando,
      resumos,
      proximos,
      largura,
      hojeD,
      tocarNoDia,
      aoAbrirSemana,
      pele,
    ],
  );

  /* ── A rolagem ──
     O `rolagem` anda no fio nativo (o cenário desce com o começo da trilha).
     O JS só fica sabendo da posição nas FRONTEIRAS (soltou o dedo, a rolagem
     parou) — a não ser no Arrumar, que precisa do meio da tela para pôr um
     enfeite da bandeja. */
  const aoRolar = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: rolagem } } }], {
        useNativeDriver: true,
      }),
    [rolagem],
  );
  const aoRolarArrumando = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: rolagem } } }], {
        useNativeDriver: true,
        listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
          rolagemAgora.current = e.nativeEvent.contentOffset.y;
        },
      }),
    [rolagem],
  );
  const [passoDoCenario, setPassoDoCenario] = useState(0);
  const temCenario = !!paradas?.length;
  const aoParar = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      avaliarAoParar(e);
      if (temCenario)
        setPassoDoCenario(Math.round(e.nativeEvent.contentOffset.y / PASSO_DO_CENARIO));
    },
    [avaliarAoParar, temCenario],
  );

  const getItemLayout = useCallback(
    (_: unknown, i: number) => ({
      length: blocos[i]!.altura,
      offset: espacador + deslocamentos[i]!,
      index: i,
    }),
    [blocos, espacador, deslocamentos],
  );
  const cabecalhoDaLista = useMemo(() => <View style={{ height: espacador }} />, [espacador]);
  const peDaLista = useMemo(
    () => <View style={{ height: folga + espaco.xxl + (arrumando ? 150 : 0) }} />,
    [folga, arrumando],
  );
  /* ── A carteira que não carregou: a folha das sementinhas ── */
  const carteiraFalhou = !p.carregandoCarteira && p.saldo == null;
  const [folhaDaCarteira, setFolhaDaCarteira] = useState(false);
  const aoTocarSementinhas = useCallback(() => {
    if (carteiraFalhou) setFolhaDaCarteira(true);
    else aoAbrirLoja();
  }, [carteiraFalhou, aoAbrirLoja]);

  /* ── O humor: a faixa fica até sair com a animação dela ── */
  const [humorNaTela, setHumorNaTela] = useState(!p.humorFeito);
  const respondeuAqui = useRef(false);
  useEffect(() => {
    if (!p.humorFeito) {
      respondeuAqui.current = false;
      setHumorNaTela(true);
    } else if (!respondeuAqui.current) setHumorNaTela(false);
  }, [p.humorFeito]);
  const marcarHumor = useCallback(
    (h: string) => {
      respondeuAqui.current = true;
      aoMarcarHumor(h);
    },
    [aoMarcarHumor],
  );
  const humorSumiu = useCallback(() => setHumorNaTela(false), []);

  const mostrarLapis = !arrumando && bandeja.length > 0;

  return (
    <View style={{ flex: 1 }} onLayout={aoMedirCaixa}>
      <FundoEAr
        paradas={paradas}
        climas={climas}
        rolagem={rolagem}
        passoDoCenario={passoDoCenario}
        alturaDoTopo={espacador}
        alturaDaLista={caixa?.altura ?? 0}
        alturaDaTrilha={alturaDaTrilha}
        largura={largura}
        parado={parado}
      />
      {pronto ? (
        <Animated.FlatList
          ref={lista as never}
          style={{ opacity: aVista ? 1 : 0 }}
          data={blocos}
          onScroll={arrumando ? aoRolarArrumando : aoRolar}
          scrollEventThrottle={16}
          onScrollEndDrag={aoParar}
          onMomentumScrollEnd={aoParar}
          scrollEnabled={!arrastando}
          keyExtractor={chaveDoBloco}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          contentOffset={contentOffset}
          initialScrollIndex={indiceInicial}
          initialNumToRender={3}
          maxToRenderPerBatch={2}
          updateCellsBatchingPeriod={50}
          windowSize={5}
          onLayout={aoMedirALista}
          onScrollToIndexFailed={nada}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={cabecalhoDaLista}
          ListFooterComponent={peDaLista}
        />
      ) : null}
      {alturaDaCamada != null ? (
        <DegradeDoTopo cor={corDoTopo} altura={alturaDaCamada + 24} />
      ) : null}
      <View
        pointerEvents="box-none"
        onLayout={aoMedirCamada}
        style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: 4 }}
      >
        {p.cabecalho ? (
          <View style={{ paddingHorizontal: margem.tela, paddingBottom: espaco.xs }}>
            {p.cabecalho}
          </View>
        ) : null}
        <View
          pointerEvents="box-none"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: espaco.sm,
            paddingHorizontal: margem.tela - 4,
          }}
        >
          <View style={{ flex: 1 }}>
            <FaixaDoTopo
              chama={p.chama}
              perdoes={p.perdoes ?? 0}
              amigas={p.amigas}
              trofeus={p.trofeus}
              saldo={p.saldo}
              carregando={p.carregandoCarteira}
              falhou={carteiraFalhou}
              aResgatar={p.aResgatar ?? 0}
              aoAbrirFolha={aoAbrirFolha}
              aoAbrirAmigas={aoAbrirAmigas}
              aoTocarSementinhas={aoTocarSementinhas}
              parado={parado}
            />
          </View>
          {mostrarLapis ? <BotaoDeArrumar aoTocar={comecarAArrumar} /> : null}
        </View>
      </View>
      {humorNaTela && alturaDaCamada != null && !arrumando ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: alturaDaCamada + espaco.xs,
            left: margem.tela - 4,
            right: margem.tela - 4,
          }}
        >
          <FaixaDoHumor aoMarcar={marcarHumor} aoSumir={humorSumiu} />
        </View>
      ) : null}
      {arrumando ? null : (
        <PilulaDeHoje
          visivel={longe.visivel && aVista}
          acima={longe.acima}
          baixo={folga + espaco.md}
          aoTocar={irParaHoje}
        />
      )}
      {arrumando ? (
        <BarraDeArrumar
          quantos={visiveis.length}
          podeDesfazer={passos > 0}
          aoDesfazer={desfazer}
          aoTerminar={() => {
            setArrumando(false);
            setSelecionado(null);
          }}
          bandeja={bandeja}
          aoPor={porDaBandeja}
        />
      ) : null}
      {aviso}
      <Folha
        aberta={folhaDaCarteira}
        aoFechar={() => setFolhaDaCarteira(false)}
        titulo="Sementinhas"
      >
        {p.aoRecarregarCarteira ? (
          <NaoConsegueLer
            sossego={SOSSEGO_DA_CARTEIRA}
            aoTentar={() => {
              setFolhaDaCarteira(false);
              p.aoRecarregarCarteira?.();
            }}
          />
        ) : (
          (p.topo ?? <NaoConsegueLer sossego={SOSSEGO_DA_CARTEIRA} />)
        )}
      </Folha>
    </View>
  );
}

/** A carteira que não veio: o que ela fez hoje continua valendo (na voz da Bolha). */
const SOSSEGO_DA_CARTEIRA =
  "Os seus cuidados de hoje continuam valendo, e eu guardo tudo aqui no aparelho.";

const chaveDoBloco = (b: Bloco) => (b.tipo === "fase" ? `f${b.fase.n}` : `s${b.semana}`);
const nada = () => {};
const SEM_ENFEITES: EnfeiteNoBloco[] = [];

/** Quanto a tela anda antes de o cenário recalcular a cor (o degradê é de ~27.000 px). */
const PASSO_DO_CENARIO = 120;

/** Os enfeites de um bloco — desenhados ANTES do resto, para a trilha ficar por cima. */
const EnfeitesDoBloco = memo(function EnfeitesDoBloco({
  enfeites,
  semana,
  parado,
  arrumar,
  selecionado,
}: {
  enfeites: EnfeiteNoBloco[];
  semana: number;
  parado: boolean;
  arrumar: Omit<ArrumarEnfeite, "selecionado"> | null;
  selecionado: string | null;
}) {
  if (!arrumar && enfeites.length === 0) return null;
  return (
    <>
      {/* No modo Arrumar, um toque fora dos enfeites tira a seleção — e a
          trilha embaixo não abre dia nenhum. */}
      {arrumar ? (
        <Pressable
          accessible={false}
          onPress={() => arrumar.aoSelecionar(null)}
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        />
      ) : null}
      {enfeites.map((e) => (
        <EnfeiteNaTrilha
          key={e.p.k}
          p={e.p}
          y={e.y}
          semana={semana}
          parado={parado}
          arrumar={arrumar ? { ...arrumar, selecionado: selecionado === e.p.k } : undefined}
        />
      ))}
    </>
  );
});

/** O que todo bloco recebe para desenhar os enfeites do Cantinho que moram nele. */
type EnfeitesDoBlocoProps = {
  enfeites: EnfeiteNoBloco[];
  semanaAtual: number;
  arrumar: Omit<ArrumarEnfeite, "selecionado"> | null;
  selecionado: string | null;
  parado: boolean;
  arrumando: boolean;
};

const BlocoDaFase = memo(function BlocoDaFase({
  bloco,
  enfeites,
  semanaAtual,
  arrumar,
  selecionado,
  parado,
  arrumando,
}: EnfeitesDoBlocoProps & { bloco: Extract<Bloco, { tipo: "fase" }> }) {
  return (
    <FaixaDaFase
      nome={bloco.fase.name}
      sub={`Fase ${bloco.fase.n} · semanas ${bloco.fase.from}–${bloco.fase.to}`}
      emoji={bloco.fase.emoji}
      corDaFase={corDaFaseDaGestacao(bloco.fase.from)}
      travada={bloco.travada}
      altura={bloco.altura}
      arrumando={arrumando}
    >
      <EnfeitesDoBloco
        enfeites={enfeites}
        semana={semanaAtual}
        parado={parado}
        arrumar={arrumar}
        selecionado={selecionado}
      />
    </FaixaDaFase>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   A semana: o traço, a barra e os sete dias
   ══════════════════════════════════════════════════════════════════════════ */

const BlocoDaSemana = memo(function BlocoDaSemana({
  bloco,
  resumo,
  proximo,
  largura,
  hojeD,
  tocarNoDia,
  aoAbrirSemana,
  pele,
  enfeites,
  semanaAtual,
  arrumar,
  selecionado,
  parado,
  arrumando,
}: EnfeitesDoBlocoProps & {
  bloco: Extract<Bloco, { tipo: "semana" }>;
  resumo: ResumoDaSemana;
  proximo: PontoDaTrilha | null;
  largura: number;
  hojeD: number;
  tocarNoDia: (D: number) => void;
  aoAbrirSemana: (semana: number) => void;
  pele: TrilhaSkin | null;
}) {
  const inicio = bloco.semana * 7;
  const porVir = inicio > hojeD;
  const atual = hojeD >= inicio && hojeD <= inicio + 6;
  const tons = tonsDaSemana(bloco.semana);
  const feitosNaSemana = resumo.feitos.filter(Boolean).length;
  const sub = MARCOS[bloco.semana]?.label ?? `${feitosNaSemana} de 7 dias`;
  const titulo = `Semana ${bloco.semana}`;
  const dias = bloco.dias.map((d, i) => ({
    feito: resumo.feitos[i] ?? false,
    hoje: d.D === hojeD,
    futuro: d.D > hojeD,
  }));
  return (
    <View style={{ height: bloco.altura }}>
      <TracadoDoBloco
        nos={bloco.dias}
        proximo={proximo}
        hojeD={hojeD}
        largura={largura}
        altura={bloco.altura}
      />
      <EnfeitesDoBloco
        enfeites={enfeites}
        semana={semanaAtual}
        parado={parado}
        arrumar={arrumar}
        selecionado={selecionado}
      />
      <View
        pointerEvents={arrumando ? "none" : "box-none"}
        style={{ position: "absolute", left: margem.tela, right: margem.tela, top: 8 }}
      >
        <BarraDaSemana
          titulo={titulo}
          sub={sub}
          estado={atual ? "atual" : porVir ? "futura" : "passada"}
          tom={porVir ? TOM_TRAVADO : tons.cheia}
          dias={dias}
          figurinha={resumo.figurinha}
          rotulo={`${titulo}${atual ? ", agora" : ""}. ${sub}${resumo.figurinha ? ". Figurinha no álbum" : ""}`}
          aoAbrir={porVir ? undefined : () => aoAbrirSemana(bloco.semana)}
        />
      </View>
      {bloco.dias.map((d, i) => (
        <NoDoDia
          key={d.D}
          D={d.D}
          x={d.x}
          y={d.y}
          semana={bloco.semana}
          estado={resumo.estados[i]!}
          tocarNoDia={tocarNoDia}
          pele={pele}
          parado={parado}
          arrumando={arrumando}
        />
      ))}
    </View>
  );
});

function NoDoDia({
  D,
  x,
  y,
  semana,
  estado: e,
  tocarNoDia,
  pele,
  parado,
  arrumando,
}: {
  D: number;
  x: number;
  y: number;
  semana: number;
  estado: EstadoDoNo;
  tocarNoDia: (D: number) => void;
  pele: TrilhaSkin | null;
  parado: boolean;
  arrumando: boolean;
}) {
  const hoje = e.tipo === "hoje";
  const fechado = e.tipo !== "futuro" && e.fechado;
  const momentos = e.tipo === "futuro" ? 0 : e.momentos;
  const tons = tonsDaSemana(semana);
  const tom = fechado || hoje ? tons.cheia : e.tipo === "passado" ? tons.perdido : tons.futuro;
  const diaDaSemana = (D % 7) + 1;
  const fala = hoje ? falaDoNoDeHoje({ feitos: momentos, total: 5, fechado }) : null;
  const rotulo =
    `Dia ${diaDaSemana} da semana ${semana}` +
    (hoje
      ? `, hoje: ${momentos} de 5 cuidados`
      : fechado
        ? ", dia completo"
        : e.tipo === "futuro"
          ? ", ainda não abriu"
          : ", não concluído");
  return (
    <NoDaTrilha
      D={D}
      x={x}
      y={y}
      tamanho={hoje ? 84 : 64}
      tom={tom}
      hoje={hoje}
      fechado={fechado}
      futuro={e.tipo === "futuro"}
      anel={hoje ? (fechado ? CINCO_DE_CINCO : ANEIS[momentos]) : null}
      balao={fala?.texto ?? null}
      poseDoBalao={fala?.pose}
      selo
      rotulo={rotulo}
      aoTocar={tocarNoDia}
      arte={pele ? (pele.arte[estadoDaPele(fechado, hoje)] as never) : null}
      corDoBrilho={tons.cheia.main}
      arrumando={arrumando}
      parado={parado}
    />
  );
}

/* O anel de hoje com a mesma identidade para a mesma conta (o nó é `memo`). */
const ANEIS = [0, 1, 2, 3, 4, 5].map((feitos) => ({ feitos, total: 5 }));
const CINCO_DE_CINCO = ANEIS[5]!;

/* ══════════════════════════════════════════════════════════════════════════
   A faixa do topo (o placar)
   ══════════════════════════════════════════════════════════════════════════ */

const FaixaDoTopo = memo(function FaixaDoTopo({
  chama,
  perdoes,
  amigas,
  trofeus,
  saldo,
  carregando,
  falhou,
  aResgatar,
  aoAbrirFolha,
  aoAbrirAmigas,
  aoTocarSementinhas,
  parado,
}: {
  chama: number;
  perdoes: number;
  amigas: number | null;
  trofeus: number | null;
  saldo: number | null;
  carregando: boolean;
  falhou: boolean;
  aResgatar: number;
  aoAbrirFolha: PropsDoCaminho["aoAbrirFolha"];
  aoAbrirAmigas: () => void;
  aoTocarSementinhas: () => void;
  parado: boolean;
}) {
  const acesa = chama > 0;
  /* Desconhecido é "—", nunca 0: zero afirma; o traço admite que não sabemos. */
  const fmt = (n: number | null) => (carregando ? "…" : n == null ? "—" : String(n));
  const amigasTexto = amigas == null ? "—" : amigas > 99 ? "99+" : String(amigas);
  /* O placar é uma cápsula de VIDRO solta sobre a trilha (16/11/2026). */
  return (
    <Vidro
      tinta="rgba(255,255,255,0.72)"
      estilo={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        paddingHorizontal: espaco.sm,
        paddingVertical: 4,
      }}
    >
      <ItemDaFaixa
        rotulo={`${chama} ${chama === 1 ? "dia seguido" : "dias seguidos"}. Ver como a chama funciona`}
        aoTocar={() => aoAbrirFolha("chama")}
      >
        <View>
          <ChamaDaSequencia acesa={acesa} parado={parado} />
          {/* O escudinho: há perdão guardado, e um dia em branco não apaga a chama. */}
          {acesa && perdoes > 0 ? (
            <View
              style={{
                position: "absolute",
                left: -7,
                bottom: -4,
                backgroundColor: cor.cartao,
                borderRadius: 8,
                padding: 1,
              }}
            >
              <ShieldCheck size={11} color={corCaminho.chamaAcesa} strokeWidth={2.6} />
            </View>
          ) : null}
        </View>
        <Text
          style={[
            estilo.numero,
            { color: acesa ? corCaminho.chamaAcesa : corCaminho.numeroApagado },
          ]}
        >
          {chama}
        </Text>
        <Text style={estilo.rotuloDaFaixa}>{chama === 1 ? "dia" : "dias"}</Text>
      </ItemDaFaixa>
      <Divisor />
      <ItemDaFaixa rotulo="Abrir as amigas" aoTocar={aoAbrirAmigas}>
        <IconeAmigas cor={corCaminho.amigas} />
        <Text
          style={[estilo.numero, { color: corCaminho.amigas, minWidth: 18, textAlign: "center" }]}
        >
          {amigasTexto}
        </Text>
      </ItemDaFaixa>
      <Divisor />
      <ItemDaFaixa
        rotulo={`${fmt(trofeus)} troféus. Ver o que eles abrem`}
        aoTocar={() => aoAbrirFolha("trofeus")}
      >
        <TrofeuParado largura={30} />
        <Text style={[estilo.numero, { color: corCaminho.trofeus }]}>{fmt(trofeus)}</Text>
      </ItemDaFaixa>
      <Divisor />
      <ItemDaFaixa
        rotulo={
          falhou
            ? "Sementinhas: não conseguimos carregar. Ver o que aconteceu"
            : `${fmt(saldo)} sementinhas. Abrir as Recompensas${
                aResgatar > 0
                  ? `, ${aResgatar} ${aResgatar === 1 ? "conquista" : "conquistas"} para resgatar`
                  : ""
              }`
        }
        aoTocar={aoTocarSementinhas}
      >
        <View>
          <IconeSementinha cor={corCaminho.sementinhas} />
          {falhou ? (
            <View
              style={{
                position: "absolute",
                right: -3,
                top: -2,
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: corCaminho.falhou,
                borderWidth: 1.5,
                borderColor: cor.branco,
              }}
            />
          ) : aResgatar > 0 ? (
            <View
              style={{
                position: "absolute",
                right: -2,
                top: -10,
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                paddingHorizontal: 4,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: corCaminho.resgatar,
              }}
            >
              <Text style={{ ...fonte.titulo, fontSize: 13, lineHeight: 16, color: cor.branco }}>
                {aResgatar > 9 ? "9+" : aResgatar}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[estilo.numero, { color: corCaminho.sementinhas }]}>{fmt(saldo)}</Text>
      </ItemDaFaixa>
    </Vidro>
  );
});

function ItemDaFaixa({
  children,
  rotulo,
  aoTocar,
}: {
  children: ReactNode;
  rotulo: string;
  aoTocar: () => void;
}) {
  return (
    <Tocavel
      rotulo={rotulo}
      aoTocar={aoTocar}
      profundidade={0.94}
      estilo={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        minHeight: ALVO_MINIMO,
        paddingHorizontal: 3,
      }}
    >
      {children}
    </Tocavel>
  );
}

function Divisor() {
  return <View style={{ width: 1, height: 24, backgroundColor: corCaminho.divisor }} />;
}

/* ══════════════════════════════════════════════════════════════════════════
   O humor do dia
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * "COMO VOCÊ ESTÁ HOJE?" — uma faixa compacta presa logo abaixo do placar
 * (antes era um cartão no alto da lista, e a lista abre na semana de hoje:
 * ninguém o via).
 *
 * 19/11/2026 (a Bolha guia): quem pergunta é a Bolha ("Me conta: como você
 * está hoje?"), com a arte dela ao lado da pergunta. É o MESMO check-in da
 * conversa da aba do bebê (`CHAVE_CHECKIN`): respondido lá, a faixa nem
 * aparece aqui; respondido aqui, a conversa de lá já sabe. Ao responder, ela
 * diz uma frase curta (`reacaoAoHumor`), e a faixa sobe e some depois de um
 * instante (uma sequência só no fio nativo, sem relógio na tela).
 */
const FaixaDoHumor = memo(function FaixaDoHumor({
  aoMarcar,
  aoSumir,
}: {
  aoMarcar: (humor: string) => void;
  aoSumir: () => void;
}) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(1)).current;
  const respondeu = useRef(false);
  const [resposta, setResposta] = useState<string | null>(null);
  const reacao = resposta ? reacaoAoHumor(resposta) : null;
  const marcar = (h: string) => {
    if (respondeu.current) return;
    respondeu.current = true;
    selecao();
    setResposta(h);
    aoMarcar(h);
    /* A frase dela fica um instante à vista, e a faixa sai. */
    Animated.sequence([
      Animated.delay(TEMPO_DA_REACAO),
      Animated.timing(v, {
        toValue: 0,
        duration: reduzido ? 1 : 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => aoSumir());
  };
  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
      }}
    >
      <Vidro
        tinta="rgba(255,255,255,0.72)"
        forma={canto.cartao}
        estilo={{ paddingHorizontal: espaco.md, paddingTop: 8, paddingBottom: reacao ? 8 : 2 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
          <Image
            source={BOLHA[reacao?.pose ?? "feliz"]}
            allowDownscaling={false}
            accessible={false}
            contentFit="contain"
            style={{ width: 44, height: 44, marginVertical: -4 }}
          />
          <Text
            accessibilityRole={reacao ? undefined : "header"}
            accessibilityLiveRegion="polite"
            style={{ flex: 1, ...fonte.forte, ...escala.legenda, color: cor.texto }}
          >
            {reacao ? reacao.texto : PERGUNTA_DO_HUMOR}
          </Text>
        </View>
        {reacao ? null : (
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {HUMORES.map((h) => (
              <Pressable
                key={h.label}
                accessibilityRole="button"
                accessibilityLabel={`Estou ${h.label.toLowerCase()}`}
                onPress={() => marcar(h.label)}
                hitSlop={4}
                style={({ pressed }) => ({
                  width: ALVO_MINIMO,
                  height: ALVO_MINIMO,
                  alignItems: "center",
                  justifyContent: "center",
                  transform: [{ scale: pressed ? 0.88 : 1 }],
                })}
              >
                <Emoji tamanho={28}>{h.emoji}</Emoji>
              </Pressable>
            ))}
          </View>
        )}
      </Vidro>
    </Animated.View>
  );
});

/** Quanto a resposta da Bolha fica à vista antes de a faixa sair. */
const TEMPO_DA_REACAO = 1600;

const estilo: { numero: TextStyle; rotuloDaFaixa: TextStyle } = {
  numero: { ...fonte.titulo, ...escala.manchete, fontVariant: ["tabular-nums"] },
  rotuloDaFaixa: { ...fonte.normal, ...escala.nota, color: cor.textoApagado },
};
