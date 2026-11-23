import { router, useFocusEffect } from "expo-router";
import Award from "lucide-react-native/icons/award";
import PenLine from "lucide-react-native/icons/pen-line";
import Wind from "lucide-react-native/icons/wind";
import X from "lucide-react-native/icons/x";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Botao,
  Cartao,
  Carregando,
  NaoConsegueLer,
  T,
  Tela,
  toque,
  useFimDaRolagem,
} from "~/componentes/base";
import { AmigasNoHoje } from "~/componentes/amigas/faixa-do-hoje";
import { BotaoDoPerfil } from "~/componentes/botao-do-perfil";
import { irParaAba } from "~/componentes/cabecalho";
import { rota } from "~/componentes/jornada/bancada";
import { SementesSubindo } from "~/componentes/jornada/efeitos";
import { BolhaViva } from "~/componentes/movimento";
import { corJornada } from "~/componentes/jornada/cores";
import { CartaoDoDia } from "~/componentes/jornada/dia-de-hoje";
import {
  lerCarteiraDoDia,
  lerContagemDeAmigas,
  lerConquistas,
  lerProgressoDoDia,
  pagarDiaFechado,
  pagarMomento,
  type CarteiraOk,
  type LeituraDasConquistas,
} from "~/componentes/jornada/economia";
import { useLivresDeHoje } from "~/componentes/jornada/livres";
import { lerOCantinho, type CantinhoOk } from "~/componentes/recompensas/economia-do-cantinho";
import { fundoBgFor } from "@/lib/cantinho";
import { SKIN_KEY, TRILHA_SKINS } from "@/lib/trilha-skins";
import { CHAVE_DECOR, lerDecoracao, type Decoracao } from "~/lib/jornada/enfeites";

import { FolhasDoPlacar, type FolhaDoPlacar } from "~/componentes/jornada/placar";
import { FestaDoMarco } from "~/componentes/jornada/marco";
import { CHAVE_MARCOS_VISTOS, festaDoExtrato, lerVistos, marcarVistos } from "~/lib/jornada/marcos";
import { Caminho } from "~/componentes/caminho/caminho";
import { useJornada, type DiaDaJornada } from "~/componentes/jornada/usarJornada";
import { ehBancada, parametroDaBancada, recarregarNaBancada } from "~/lib/bancada";
import { depoisDaVolta } from "~/lib/depois-da-volta";
import { TelaDeHoje } from "~/componentes/jornada/hoje";
import { CHAVE_REGUA_USADA } from "~/componentes/jornada/ceu-do-bebe";
import { BebeNestaSemana } from "~/componentes/jornada/bebe-nesta-semana";
import { tituloDaAulaDoApp } from "~/lib/jornada/aulas-do-app";
import { TelaDoQuartoTrimestre } from "~/componentes/jornada/hoje-pos";
import { TelaDoCuidado } from "~/componentes/jornada/cuidado";
import { FestaDoNascimento, PortaDoNascimento } from "~/componentes/jornada/nascimento";
import { TrilhaDoPosParto } from "~/componentes/caminho/caminho-pos";
import { gravarPerfil } from "~/lib/gravar-perfil";
import { CHAVE_NASCIMENTO } from "~/lib/jornada/nascimento";
import {
  abreFestaDoNascimento,
  CHAVE_NASCIMENTO_FESTEJADO,
  desafioDoPos,
  diaNaTrilhaDoPos,
  figurinhasDoPos,
  formou,
  lerNascimento,
  resumoDaGestacao,
  semanaDeVida,
  tarefasFeitas,
  type DadosDoNascimento,
} from "~/lib/jornada/pos-parto";
import { AgendaNaHoje } from "~/componentes/agenda/pecas";
import { carimbarPresenca } from "~/componentes/amigas/economia";
import {
  ConviteDosLembretes,
  contextoDoLembrete,
  useLembretesDaJornada,
} from "~/componentes/jornada/lembretes";
import {
  cuidadosDoDia,
  dataDeHoje,
  diasQueFaltam,
  saudacao,
  type ChaveDoCuidado,
} from "~/lib/jornada/hoje";
import { primeiroNome } from "~/lib/gestacao";
import { ConversaComABolha } from "~/componentes/bolha/conversa";
import type { ContextoDaBolha, Destino } from "~/lib/bolha/conversa";
import { BarraDoTopo, voltarParaJornada } from "~/componentes/jornada/pecas";
import { FundoDeLuz } from "~/componentes/luz";
import { CEUS, sombraDoTexto, useCeuDasAbas, type Ceu } from "~/componentes/ceu-vivo";
import { useSessao } from "~/lib/sessao";
import { conquistaNoApp, montarGrade, paraResgatar } from "~/lib/jornada/conquistas";
import { type ConquistaDef } from "@/lib/conquistas";
import { diaLongo } from "~/lib/jornada/dia";
import {
  estadoAtual,
  gravarChave,
  marcar,
  marcarFlagDoDia,
  marcarNoPos,
  type EstadoDaLoja,
} from "~/lib/jornada/loja";
import {
  CHAVE_CHECKIN,
  fasesDaGestacao,
  lerCheckin,
  marcouHumorHoje,
  novoCheckin,
} from "~/lib/jornada/caminho";
import {
  CHAVE_FIGURINHAS,
  chaveDoPresente,
  diasFechados,
  listaDeNumeros,
  flagsDoDia,
} from "~/lib/jornada/momentos";
import {
  atividadesSemRecibo,
  bonusResolvido,
  diasDaReconciliacao,
} from "~/lib/jornada/reconciliacao";
import type { Atividade } from "~/servidor/economia";
import { chama as calcularChama } from "~/lib/jornada/trilha";
import {
  ALVO_MINIMO,
  canto,
  cor,
  curva,
  escala,
  espaco,
  fonte,
  luz,
  margem,
  sombra,
  vidro,
} from "~/tema";

/**
 * A ABA JORNADA — o coração do app: um dia de cada vez, cinco momentos por dia.
 *
 * Quatro caras, pela situação dela:
 *   · gestação: o CAMINHO (componentes/caminho) — o desenho aprovado do site:
 *     a faixa do topo, o humor do dia, e a trilha inteira com fases, semanas
 *     e um nó por dia. Tocar num dia abre a folha do dia (/jornada/dia), com
 *     os cinco momentos; a cesta abre as Recompensas (Meu Cantinho e
 *     Conquistas);
 *   · pós-parto: o desafio do dia, a respiração e a gratidão (sem aula, sem
 *     pagamento — o servidor só paga na gestação);
 *   · Modo Cuidado: três cuidados com ela, sem placar, sem bebê, sem festa;
 *   · sem DUM nem ultrassom: a jornada explica o que falta e oferece o que
 *     não depende da semana.
 */
export default function AbaJornada() {
  const { dia, loja } = useJornada();
  /* Os lembretes acompanham o estado do dia (a chama, o que já foi feito). */
  useLembretesDaJornada(dia, loja);
  /* "Vista há 2h" na lista das amigas: uma vez por abertura do app. */
  const comConta = dia.modo !== "carregando" && dia.modo !== "falhou";
  useEffect(() => {
    if (comConta) carimbarPresenca();
  }, [comConta]);

  if (dia.modo === "carregando") {
    return (
      <Tela>
        <Carregando texto="Abrindo a sua jornada…" />
      </Tela>
    );
  }
  if (dia.modo === "falhou") {
    return (
      <Tela>
        <T tipo="titulo">Sua jornada</T>
        <NaoConsegueLer
          sossego="Tudo o que você já fez na jornada continua guardado."
          aoTentar={dia.tentar}
        />
      </Tela>
    );
  }
  if (dia.cuidado) return <TelaDoCuidado uid={dia.uid} direita={<BotaoDoPerfil />} />;
  /* A aba do meio é a tela do bebê, e o app abre nela (decisão do dono,
     13/11/2026: "o bebê é o centro"). A trilha mora na aba da direita. */
  if (dia.modo === "gestacao") return <JornadaDaGestacao dia={dia} loja={loja} vista="hoje" />;
  if (dia.modo === "pos") return <JornadaDoPosParto dia={dia} loja={loja} />;
  return <JornadaSemData uid={dia.uid} />;
}

const ir = (caminho: string) => router.push(rota(caminho) as never);

const ROTA_DO_CUIDADO: Record<ChaveDoCuidado, string> = {
  aula: "/jornada/aula",
  movement: "/jornada/mexer",
  meditation: "/jornada/meditar",
  bonding: "/jornada/bebe",
  gratitude: "/jornada/gratidao",
};

/** A hora que escolhe o céu e a saudação (`&hora=` na bancada). */
function horaDaTela(): number {
  const h = Number(parametroDaBancada("hora"));
  return Number.isFinite(h) && h >= 0 && h < 24 && parametroDaBancada("hora") != null
    ? h
    : new Date().getHours();
}

/* ══════════════════════════════════════════════════════════════════════════
   Carteira, conquistas e reconciliação — o que a aba lê ao ganhar foco
   ══════════════════════════════════════════════════════════════════════════ */

type EstadoDaCarteira =
  | { estado: "carregando" }
  | { estado: "falhou" }
  | { estado: "ok"; dados: CarteiraOk };

type LeituraDeConquistas = LeituraDasConquistas | null | "carregando";

/**
 * O intervalo mínimo entre duas releituras na tela do bebê (18/11/2026). Ela
 * não mostra o saldo, e cada volta de atividade relia tudo; a trilha, que
 * mostra o saldo, relê a cada foco.
 */
const INTERVALO_DO_BEBE_MS = 45_000;

/**
 * As leituras do foco da aba (18/11/2026, a vistoria: "cada vez que a aba ganha
 * foco saem umas oito leituras do servidor"):
 * - as conquistas PRIMEIRO — é a conferência delas que DESBLOQUEIA no servidor
 *   as que ela acabou de ganhar e paga a semana nova e o trimestre;
 * - a carteira DEPOIS, uma vez só: ela já traz o marco que a conferência
 *   pagou (antes era lida duas vezes a cada foco, a segunda depois das
 *   conquistas, para a festa do marco);
 * - depois da animação de volta (`depoisDaVolta`), e não no meio dela;
 * - com um intervalo mínimo entre releituras, quando pedido;
 * - e o estado só muda quando o dado mudou: a mesma resposta não redesenha a
 *   tela.
 */
function useLeiturasDoFoco(intervaloMinimo = 0) {
  const [carteira, setCarteira] = useState<EstadoDaCarteira>({ estado: "carregando" });
  const [conquistas, setConquistas] = useState<LeituraDeConquistas>("carregando");
  const atual = useRef<{
    carteira: string;
    conquistas: string;
    estado: EstadoDaCarteira["estado"];
  }>({ carteira: "", conquistas: "", estado: "carregando" });
  const ultima = useRef(0);
  const primeira = useRef(true);
  const viva = useRef(true);
  useEffect(
    () => () => {
      viva.current = false;
    },
    [],
  );

  const porCarteira = useCallback((novo: EstadoDaCarteira) => {
    const s = JSON.stringify(novo);
    if (s === atual.current.carteira) return;
    atual.current.carteira = s;
    atual.current.estado = novo.estado;
    setCarteira(novo);
  }, []);

  const recarregar = useCallback(async () => {
    /* Tentar de novo depois de uma falha mostra que está tentando. */
    if (atual.current.estado === "falhou") porCarteira({ estado: "carregando" });
    const r = await lerCarteiraDoDia();
    if (!viva.current) return;
    porCarteira(r ? { estado: "ok", dados: r } : { estado: "falhou" });
  }, [porCarteira]);

  const ler = useCallback(async () => {
    const c = await lerConquistas();
    if (!viva.current) return;
    const s = JSON.stringify(c);
    if (s !== atual.current.conquistas) {
      atual.current.conquistas = s;
      setConquistas(c);
    }
    await recarregar();
  }, [recarregar]);

  useFocusEffect(
    useCallback(() => {
      if (intervaloMinimo > 0 && Date.now() - ultima.current < intervaloMinimo) return;
      /* Na abertura do app não há volta a esperar: lê na hora. */
      const cancelar = depoisDaVolta(() => {
        ultima.current = Date.now();
        void ler();
      }, primeira.current);
      primeira.current = false;
      return cancelar;
    }, [intervaloMinimo, ler]),
  );
  return { carteira, conquistas, recarregar };
}

/**
 * A festa dos marcos (`~/lib/jornada/marcos`). A conferência das conquistas é
 * quando o servidor paga a semana nova e o trimestre, e a carteira é lida
 * logo depois dela (`useLeiturasDoFoco`): o marco novo do extrato vira festa
 * uma vez (os vistos sobem com a jornada, e a festa não se repete noutro
 * aparelho).
 */
function useFestaDoMarco(o: { carteira: EstadoDaCarteira; loja: EstadoDaLoja; cuidado: boolean }) {
  const { carteira, loja, cuidado } = o;
  const vistos = lerVistos(loja.blob[CHAVE_MARCOS_VISTOS]);
  const pronta = loja.pronto && (loja.nuvem === "ok" || loja.bancada);
  const festa =
    !cuidado && pronta && carteira.estado === "ok" && !carteira.dados.careMode
      ? festaDoExtrato(carteira.dados.recent, vistos, new Date())
      : null;
  const fechar = () => {
    if (festa) gravarChave(CHAVE_MARCOS_VISTOS, marcarVistos(vistos, festa.chaves));
  };
  return { festa, fechar };
}

/** Os dias cujo bônus das cinco estrelas o servidor já resolveu, neste processo. */
const bonusResolvidos = new Set<number>();

/**
 * Ao abrir a aba (`~/lib/jornada/reconciliacao`), para hoje e ontem: o que o
 * servidor já registrou (feito no site ou noutro aparelho) acende aqui; o que
 * está aceso aqui mas o servidor não registrou (rede caiu no fim da
 * atividade) é pago agora; e o bônus das cinco estrelas é pedido de novo
 * SEMPRE que o dia está fechado aqui — e não só quando a reconciliação o
 * fecha. Antes, a resposta engolida no fim da quinta atividade era a única
 * tentativa: os 20 🌱 sumiam sem rastro (o site já tentava de novo; out/2026).
 * O servidor não paga duas vezes a mesma atividade nem o mesmo bônus, e
 * reconfere as quatro atividades antes de pagá-lo: repetir é seguro. Começa
 * depois da animação de volta (`depoisDaVolta`).
 */
function useReconciliacao(D: number, pronta: boolean, aoMudarSaldo: () => void) {
  const emVoo = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!pronta || ehBancada() || emVoo.current) return;
      return depoisDaVolta(() => {
        if (emVoo.current) return;
        emVoo.current = true;
        void (async () => {
          try {
            let pagou = false;
            for (const dia of diasDaReconciliacao(D)) {
              const noServidor = await lerProgressoDoDia(dia);
              if (!noServidor) continue;
              for (const a of noServidor) marcar(dia, a);
              const pagas: Atividade[] = [];
              for (const a of atividadesSemRecibo(
                flagsDoDia(estadoAtual().blob, dia),
                noServidor,
              )) {
                const g = await pagarMomento(dia, a);
                if (g != null) pagas.push(a);
                if (g && g > 0) pagou = true;
              }
              if (bonusResolvidos.has(dia) || !diasFechados(estadoAtual().blob).includes(dia))
                continue;
              const b = await pagarDiaFechado(dia);
              if (b && b > 0) pagou = true;
              if (b != null && (b > 0 || bonusResolvido(noServidor, pagas)))
                bonusResolvidos.add(dia);
            }
            if (pagou) aoMudarSaldo();
          } finally {
            emVoo.current = false;
          }
        })();
      });
    }, [D, pronta, aoMudarSaldo]),
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Gestação
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * A gestação em três vistas: "hoje" (a aba do meio — a tela do bebê: o céu
 * com o bebê da semana, o acompanhamento e o cuidado do dia; é ela que abre o
 * app, com os avisos, a festa dos marcos e a reconciliação da abertura do
 * dia — decisão do dono, 13/11/2026), "aba" (a aba da direita — a trilha
 * inteira do jogo, como no Duolingo) e "trilha" (a rota /jornada/trilha, que
 * leva à aba da trilha). Uma função só para todas lerem a mesma carteira e o
 * mesmo Cantinho; o que é da abertura do dia roda só na tela do bebê, para
 * não festejar nem cobrar duas vezes.
 */
export function JornadaDaGestacao({
  dia,
  loja,
  vista = "hoje",
}: {
  dia: Extract<DiaDaJornada, { modo: "gestacao" }>;
  loja: EstadoDaLoja;
  vista?: "aba" | "hoje" | "trilha";
}) {
  const ehHoje = vista === "hoje";
  /* O que é da abertura do dia (festa, reconciliação, avisos) roda na tela
     do bebê, que abre o app. */
  const abre = ehHoje;
  /* O que só a trilha mostra (o Cantinho, o número de amigas) só a trilha lê. */
  const trilha = !ehHoje;
  const { D, semana, perfil, hoje } = dia;
  /* As conquistas primeiro, a carteira depois, uma vez só. Os hooks ficam
     todos antes do retorno das 42 semanas. As conquistas moram nas
     Recompensas, mas a leitura delas é o que DESBLOQUEIA no servidor as que
     ela acabou de ganhar — por isso a aba confere ao ganhar foco. E o que a
     conferência traz agora aparece aqui: o aviso da conquista nova e, na
     cestinha da loja, quantas esperam o toque que paga. */
  const { carteira, conquistas, recarregar } = useLeiturasDoFoco(ehHoje ? INTERVALO_DO_BEBE_MS : 0);
  /* O servidor sabe do Modo Cuidado antes do aparelho (ligado noutro lugar):
     a carteira volta com `careMode`, e a trilha relê o perfil na hora em vez
     de seguir mostrando o bebê e as estrelas a quem acabou de perdê-lo. */
  const { recarregarPerfil } = useSessao();
  const servidorDizCuidado = carteira.estado === "ok" && carteira.dados.careMode === true;
  useEffect(() => {
    if (servidorDizCuidado) void recarregarPerfil();
  }, [servidorDizCuidado, recarregarPerfil]);
  const marco = useFestaDoMarco({ carteira, loja, cuidado: dia.cuidado || !abre });
  const aResgatar = useMemo(() => {
    if (!conquistas || conquistas === "carregando" || conquistas.careMode) return 0;
    if (conquistas.resgatadas === null) return 0;
    return paraResgatar(montarGrade(conquistas.unlocked, conquistas.resgatadas));
  }, [conquistas]);
  useReconciliacao(D, loja.pronto && abre, recarregar);
  const amigas = useContagemDeAmigas(trilha);
  const [folha, setFolha] = useState<FolhaDoPlacar>(null);

  const { dias: diasDeChama, perdoes } = calcularChama(loja.blob, D);
  const nomeDoBebe = (perfil.baby_name ?? "").trim() || null;
  const checkin = lerCheckin(loja.blob[CHAVE_CHECKIN]);
  const fases = useMemo(() => fasesDaGestacao(D), [D]);

  const avisos = useAvisosDoDia({ carteira, recarregar, conquistas, loja, ehHoje: abre });

  /* ── O Cantinho na trilha: o que ela tem, o cenário e a pele ── */
  const cantinho = useCantinhoDaTrilha(trilha);
  /* O céu das abas, atrás da trilha (se ela não equipou um cenário da lojinha). */
  const dasAbas = useCeuDasAbas();
  const decorGravada = loja.blob[CHAVE_DECOR];
  const decoracao = useMemo(() => lerDecoracao(decorGravada), [decorGravada]);
  const possuidos = cantinho ? (cantinho.careMode ? [] : cantinho.owned) : null;
  const cenario =
    cantinho && !cantinho.careMode ? fundoBgFor(cantinho.equippedFundo, semana) : null;
  const skin = loja.blob[SKIN_KEY];
  const pele = typeof skin === "string" ? (TRILHA_SKINS[skin] ?? null) : null;
  const aoGravarDecoracao = useCallback((d: Decoracao) => gravarChave(CHAVE_DECOR, d), []);

  /* ── O que a tela do bebê recebe, ESTÁVEL entre um desenho e outro: o
     herói (memo) não se redesenha a cada leitura que chega (18/11/2026). ── */
  const direita = useMemo(() => <BotaoDoPerfil />, []);
  const diasCheios = diasFechados(loja.blob).filter((d) => Math.floor(d / 7) === semana).length;
  const faltam = diasQueFaltam(D);
  const cartao = useMemo(
    () => ({ semana, nomeDoBebe, diasCheios, chama: diasDeChama, faltam }),
    [semana, nomeDoBebe, diasCheios, diasDeChama, faltam],
  );
  const flags = flagsDoDia(loja.blob, D);
  const assinaturaDosFeitos = JSON.stringify(flags);
  const assuntoDaAula = tituloDaAulaDoApp(D);
  const cuidados = useMemo(
    () =>
      cuidadosDoDia({
        flags,
        semana,
        nomeDoBebe,
        /* "Você está na semana 24; hoje você aprende…": o assunto da aula do dia. */
        assuntoDaAula,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assinaturaDosFeitos, semana, nomeDoBebe, assuntoDaAula],
  );

  /* ── As ações da trilha, estáveis ── */
  const aoMarcarHumor = useCallback(
    (humor: string) => {
      gravarChave(
        CHAVE_CHECKIN,
        novoCheckin(lerCheckin(estadoAtual().blob[CHAVE_CHECKIN]), humor, hoje),
      );
      marcarFlagDoDia(D, "humor");
    },
    [D, hoje],
  );
  /* ── A Bolha guia (19/11/2026): o contexto do momento e para onde ela leva ── */
  const humorDeHoje = marcouHumorHoje(checkin, hoje) ? (checkin.mood ?? null) : null;
  const feitosDeHoje = cuidados.filter((c) => c.feito).map((c) => c.chave);
  const contextoDaBolha = useMemo<ContextoDaBolha>(
    () => ({
      hora: horaDaTela(),
      D,
      modo: "gestacao",
      nomeDela: primeiroNome(perfil.display_name),
      nomeDoBebe,
      semana,
      feitos: feitosDeHoje,
      humor: humorDeHoje,
      chama: diasDeChama,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [D, perfil.display_name, nomeDoBebe, semana, feitosDeHoje.join(","), humorDeHoje, diasDeChama],
  );
  const aoAbrirDaBolha = useCallback((d: Destino) => {
    if (d === "dormir") ir("/jornada/dormir");
    else if (d === "trilha") irParaAba("/trilha");
    else ir(ROTA_DO_CUIDADO[d]);
  }, []);
  const aoAbrirDia = useCallback((d: number) => ir(`/jornada/dia?D=${d}`), []);
  /* A figurinha da semana é guardada pela tela da semana (`semana.tsx`), e
     não aqui antes de navegar: guardada aqui, a semana nunca via a primeira
     coleta, e a figurinha não DESCOLAVA (18/11/2026). */
  const aoAbrirSemana = useCallback((s: number) => ir(`/jornada/semana?semana=${s}`), []);
  const aoAbrirLoja = useCallback(
    () => ir(aResgatar > 0 ? "/jornada/recompensas?aba=conquistas" : "/jornada/recompensas"),
    [aResgatar],
  );
  const aoAbrirAmigas = useCallback(() => irParaAba(rota("/amigas") as never), []);
  const aoContarNascimento = useCallback(() => ir("/jornada/nascimento"), []);
  const aoFecharFolha = useCallback(() => setFolha(null), []);

  /* A trilha no céu: só como aba, e só sem cenário da lojinha (ele cobre). */
  const noCeu = vista === "aba" && !!dasAbas && !cenario;

  /* Passou de 42 semanas: a trilha (presa no dia 300) dá lugar à tela da reta final. */
  if (dia.passouDe42) return <AlertaDas42Semanas nomeDoBebe={nomeDoBebe} />;

  if (ehHoje) {
    const hora = horaDaTela();
    const feitos = cuidados.filter((c) => c.feito).length;
    return (
      <View style={{ flex: 1, backgroundColor: dasAbas ? "transparent" : cor.fundo }}>
        <TelaDeHoje
          D={D}
          pronto={loja.pronto}
          cartao={cartao}
          saudacao={saudacao(hora, primeiroNome(perfil.display_name))}
          data={dataDeHoje(hoje)}
          nomeDoBebe={nomeDoBebe}
          semana={semana}
          dias={dia.diaNaSemana}
          faltam={faltam}
          hora={hora}
          cuidados={cuidados}
          bolha={
            <ConversaComABolha
              key={feitosDeHoje.length}
              contexto={contextoDaBolha}
              aoAbrir={aoAbrirDaBolha}
              aoMarcarHumor={aoMarcarHumor}
            />
          }
          chama={diasDeChama}
          reguaUsada={loja.blob[CHAVE_REGUA_USADA] === true}
          avisos={avisos}
          nascimento={
            semana >= 37 ? (
              <PortaDoNascimento nome={nomeDoBebe} aoTocar={aoContarNascimento} />
            ) : null
          }
          amigas={<AmigasNoHoje pos={false} />}
          lembrete={
            <ConviteDosLembretes
              uid={dia.uid}
              contexto={contextoDoLembrete(dia, loja.blob)}
              mostrar={feitos > 0 || diasDeChama > 0}
            />
          }
          agenda={<AgendaNaHoje loja={loja} />}
          aoAbrir={abrirCuidado}
          acompanhamento={<BebeNestaSemana semana={semana} totalDias={D} nomeDoBebe={nomeDoBebe} />}
          aoVerTrilha={verTrilha}
          direita={direita}
        />
        <FestaDoMarco festa={marco.festa} nomeDoBebe={nomeDoBebe} aoFechar={marco.fechar} />
      </View>
    );
  }

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: noCeu ? "transparent" : cor.fundo }}
    >
      {/* Na aba, a trilha sobe pelo céu da hora (o das três abas). Com um
          cenário da lojinha equipado, ou aberta fora das abas, a luz de fundo
          (e o cenário, por cima). */}
      {noCeu ? null : <FundoDeLuz />}
      <Caminho
        /* O cabeçalho vai na camada de cima da trilha, junto do placar: a
           lista passa por baixo dos dois (pacote da trilha, 18/11/2026). */
        cabecalho={
          <View style={{ paddingHorizontal: margem.tela }}>
            {vista === "aba" ? (
              <CabecalhoDaTrilha
                sub={`Semana ${semana}${nomeDoBebe ? ` · ${nomeDoBebe}` : ""}`}
                ceu={noCeu && dasAbas ? CEUS[dasAbas.fase] : null}
              />
            ) : (
              <BarraDoTopo titulo="Trilha" />
            )}
          </View>
        }
        aoRecarregarCarteira={() => void recarregar()}
        hojeD={D}
        semanaAtual={semana}
        fases={fases}
        blob={loja.blob}
        saldo={carteira.estado === "ok" ? carteira.dados.balance : null}
        trofeus={carteira.estado === "ok" ? carteira.dados.trofeus : null}
        carregandoCarteira={carteira.estado === "carregando"}
        chama={diasDeChama}
        perdoes={perdoes}
        amigas={amigas}
        nomeDoBebe={nomeDoBebe}
        humorFeito={marcouHumorHoje(checkin, hoje)}
        aoMarcarHumor={aoMarcarHumor}
        aoAbrirDia={aoAbrirDia}
        aoAbrirSemana={aoAbrirSemana}
        aResgatar={aResgatar}
        aoAbrirLoja={aoAbrirLoja}
        aoAbrirAmigas={aoAbrirAmigas}
        aoAbrirFolha={setFolha}
        aoContarNascimento={aoContarNascimento}
        decoracao={decoracao}
        possuidos={possuidos}
        cenario={cenario}
        pele={pele}
        podeSemear={loja.pronto && loja.nuvem === "ok"}
        aoGravarDecoracao={aoGravarDecoracao}
        topo={avisos}
      />
      <FolhasDoPlacar
        aberta={folha}
        aoFechar={aoFecharFolha}
        chama={diasDeChama}
        perdoes={perdoes}
        trofeus={carteira.estado === "ok" ? carteira.dados.trofeus : null}
      />
      <FestaDoMarco festa={marco.festa} nomeDoBebe={nomeDoBebe} aoFechar={marco.fechar} />
    </SafeAreaView>
  );
}

/** Abre um cuidado da tela do bebê (estável: fora do componente). */
const abrirCuidado = (c: ChaveDoCuidado) => ir(ROTA_DO_CUIDADO[c]);

/** A chama do céu abre a Trilha: troca de aba, sem empurrar outra barra. */
const verTrilha = () => irParaAba("/trilha");

/**
 * O topo da trilha quando ela é a aba da direita: o nome da trilha e a semana
 * à esquerda, o perfil à direita — sem voltar (é uma aba). O título é o de
 * aba do app: a serifada em 34/41, na margem de 16 (18/11/2026).
 */
function CabecalhoDaTrilha({ sub, ceu }: { sub: string; ceu: Ceu | null }) {
  const sombra = ceu ? sombraDoTexto(ceu) : null;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        minHeight: ALVO_MINIMO + 4,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={{
            ...fonte.display,
            ...escala.grande,
            letterSpacing: -0.2,
            color: ceu?.tinta ?? cor.texto,
            ...sombra,
          }}
        >
          Sua trilha
        </Text>
        <Text
          numberOfLines={1}
          style={{
            ...fonte.media,
            ...escala.legenda,
            color: ceu ? (ceu.claro ? ceu.tinta : ceu.sec) : cor.textoApagado,
            ...sombra,
          }}
        >
          {sub}
        </Text>
      </View>
      <BotaoDoPerfil />
    </View>
  );
}

/**
 * Os avisos do topo da tela Hoje — a carteira que não carregou, a conquista
 * nova (com o "pegar") e o presente que chegou —, iguais na gestação e no
 * pós-parto.
 */
function useAvisosDoDia({
  carteira,
  recarregar,
  conquistas,
  loja,
  ehHoje,
}: {
  carteira: EstadoDaCarteira;
  recarregar: () => Promise<void>;
  conquistas: LeituraDasConquistas | null | "carregando";
  loja: EstadoDaLoja;
  ehHoje: boolean;
}) {
  const [novasVistas, setNovasVistas] = useState<string | null>(null);
  const novas = useMemo(() => {
    if (!conquistas || conquistas === "carregando" || conquistas.careMode) return [];
    return conquistas.novas.map((k) => conquistaNoApp(k)).filter((d): d is ConquistaDef => !!d);
  }, [conquistas]);
  const chaveDasNovas = novas.map((d) => d.key).join(",");
  const mostrarNovas = novas.length > 0 && novasVistas !== chaveDasNovas;
  const presente = carteira.estado === "ok" ? carteira.dados.presente : null;
  const presenteNovo = presente && !loja.blob[chaveDoPresente(presente.quando)] ? presente : null;
  return (
    <>
      {carteira.estado === "falhou" ? (
        <NaoConsegueLer
          sossego="Os seus momentos de hoje continuam valendo e ficam guardados neste aparelho."
          aoTentar={() => void recarregar()}
        />
      ) : null}
      {ehHoje && mostrarNovas ? (
        <AvisoDeConquista
          conquistas={novas}
          aoPegar={() => {
            setNovasVistas(chaveDasNovas);
            ir("/jornada/recompensas?aba=conquistas");
          }}
          aoFechar={() => setNovasVistas(chaveDasNovas)}
        />
      ) : null}
      {ehHoje && presenteNovo ? (
        <AvisoDePresente
          quantidade={presenteNovo.quantidade}
          de={presenteNovo.de}
          nome={presenteNovo.nome}
          aoFechar={() => gravarChave(chaveDoPresente(presenteNovo.quando), true)}
        />
      ) : null}
    </>
  );
}

/**
 * O Cantinho dela, relido a cada foco da aba: quem compra um enfeite nas
 * Recompensas e volta ao Caminho já o encontra espalhado. Falha de leitura
 * guarda a última leitura boa (e, sem nenhuma, `null`: a trilha mostra o
 * layout gravado, como o site enquanto a lista não chega).
 */
function useCantinhoDaTrilha(ativa: boolean): CantinhoOk | null {
  const [c, setC] = useState<CantinhoOk | null>(null);
  const assinatura = useRef("");
  useFocusEffect(
    useCallback(() => {
      /* Só a trilha usa o Cantinho: a tela do bebê não lê. */
      if (!ativa) return;
      let vivo = true;
      const cancelar = depoisDaVolta(() => {
        void lerOCantinho().then((r) => {
          if (!vivo || !r) return;
          const s = JSON.stringify(r);
          if (s === assinatura.current) return;
          assinatura.current = s;
          setC(r);
        });
      });
      return () => {
        vivo = false;
        cancelar();
      };
    }, [ativa]),
  );
  return c;
}

/** O número de amigas da faixa do Caminho, relido a cada foco da aba (só na trilha). */
function useContagemDeAmigas(ativa: boolean): number | null {
  const [n, setN] = useState<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!ativa) return;
      let vivo = true;
      const cancelar = depoisDaVolta(() => {
        void lerContagemDeAmigas().then((r) => {
          if (vivo && r != null) setN(r);
        });
      });
      return () => {
        vivo = false;
        cancelar();
      };
    }, [ativa]),
  );
  return n;
}

/* ══════════════════════════════════════════════════════════════════════════
   Pós-parto
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * O 4º TRIMESTRE — a tela Hoje com o bebê no colo (`TelaDoQuartoTrimestre`) e
 * a trilha das 12 semanas de vida (`TrilhaDoPosParto`), o `PosPartoJourney`
 * do site. Na primeira abertura depois de ela contar o nascimento, a festa da
 * chegada (uma vez; nunca no Modo Cuidado, que nem chega aqui). Sem pagamento:
 * o servidor só paga as atividades na gestação — e os marcos (o "Bem-vindo ao
 * mundo" e cada mês do bebê) chegam pela festa dos marcos.
 */
export function JornadaDoPosParto({
  dia,
  loja,
  vista = "hoje",
}: {
  dia: Extract<DiaDaJornada, { modo: "pos" }>;
  loja: EstadoDaLoja;
  /** "hoje": a aba do meio (o 4º trimestre); "aba": a trilha das 12 semanas
   * na aba da direita; "trilha": a mesma trilha na rota empilhada. */
  vista?: "hoje" | "aba" | "trilha";
}) {
  const ehHoje = vista === "hoje";
  const { D, idadeDias, perfil, hoje } = dia;
  const { carteira, conquistas, recarregar } = useLeiturasDoFoco(ehHoje ? INTERVALO_DO_BEBE_MS : 0);
  const marco = useFestaDoMarco({ carteira, loja, cuidado: dia.cuidado || !ehHoje });
  const avisos = useAvisosDoDia({ carteira, recarregar, conquistas, loja, ehHoje });
  const { recarregarPerfil } = useSessao();
  /* O céu das abas, atrás do 4º trimestre também (16/11/2026). */
  const dasAbas = useCeuDasAbas();
  const posNoCeu = vista === "aba" && !!dasAbas;

  const flags = flagsDoDia(loja.blob, D, true);
  const { dias: diasDeChama } = calcularChama(loja.blob, D, true);
  const nomeDoBebe = (perfil.baby_name ?? "").trim() || null;
  const checkin = lerCheckin(loja.blob[CHAVE_CHECKIN]);
  const humorDeHoje = marcouHumorHoje(checkin, hoje) ? (checkin.mood ?? "Bem") : null;
  const terminou = formou(idadeDias);
  const hojeNaTrilha = diaNaTrilhaDoPos(idadeDias);
  const semana = semanaDeVida(hojeNaTrilha);
  const figurinhas =
    listaDeNumeros(loja.blob[CHAVE_FIGURINHAS]).length + figurinhasDoPos(loja.blob).length;

  /* O check-in feito ainda na gestação, no dia do parto, vale como o humor de
     hoje aqui também (a regra do site). */
  const humorPendente = ehHoje && loja.pronto && !terminou && !!humorDeHoje && !flags.humor;
  useEffect(() => {
    if (humorPendente) marcarNoPos(D, "humor");
  }, [humorPendente, D]);

  /* A festa da chegada: a data é a do perfil; hora, peso e comprimento, do blob. */
  const salvo = lerNascimento(loja.blob[CHAVE_NASCIMENTO]);
  const nascimento: DadosDoNascimento | null = perfil.birth_date
    ? salvo && salvo.date === perfil.birth_date
      ? salvo
      : { date: perfil.birth_date }
    : null;
  const abreFesta =
    ehHoje &&
    loja.pronto &&
    loja.nuvem !== "esperando" &&
    nascimento != null &&
    abreFestaDoNascimento({
      idadeDias,
      festejado: loja.blob[CHAVE_NASCIMENTO_FESTEJADO] === true,
      cuidado: dia.cuidado,
    });
  const sementesDaChegada =
    marco.festa?.principal.tipo === "nascimento" ? marco.festa.sementinhas : null;

  if (!ehHoje) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={{ flex: 1, backgroundColor: posNoCeu ? "transparent" : cor.fundo }}
      >
        <TrilhaDoPosParto
          cabecalho={
            <View style={{ paddingHorizontal: margem.tela }}>
              {vista === "aba" ? (
                <CabecalhoDaTrilha
                  sub={`O 4º trimestre${nomeDoBebe ? ` · ${nomeDoBebe}` : ""}`}
                  ceu={posNoCeu && dasAbas ? CEUS[dasAbas.fase] : null}
                />
              ) : (
                <BarraDoTopo titulo="O 4º trimestre" />
              )}
            </View>
          }
          hojeD={hojeNaTrilha}
          blob={loja.blob}
          chama={diasDeChama}
          figurinhas={figurinhas}
          formou={terminou}
          aoAbrirHoje={vista === "aba" ? () => irParaAba("/jornada") : voltarParaJornada}
        />
      </SafeAreaView>
    );
  }

  const hora = horaDaTela();
  const feitos = tarefasFeitas(flags);
  return (
    <View style={{ flex: 1, backgroundColor: dasAbas ? "transparent" : cor.fundo }}>
      <TelaDoQuartoTrimestre
        D={D}
        pronto={loja.pronto}
        idadeDias={idadeDias}
        semana={semana}
        formou={terminou}
        saudacao={saudacao(hora, primeiroNome(perfil.display_name))}
        data={dataDeHoje(hoje)}
        hora={hora}
        nomeDoBebe={nomeDoBebe}
        flags={flags}
        humorDeHoje={humorDeHoje}
        desafio={terminou ? null : desafioDoPos(D)}
        nomeDela={primeiroNome(perfil.display_name)}
        chama={diasDeChama}
        figurinhas={figurinhas}
        avisos={avisos}
        agenda={
          <>
            <ConviteDosLembretes
              uid={dia.uid}
              contexto={contextoDoLembrete(dia, loja.blob)}
              mostrar={feitos > 0 || diasDeChama > 0}
            />
            <AgendaNaHoje loja={loja} />
          </>
        }
        conquistas={conquistas}
        aoMarcarHumor={(humor) => {
          gravarChave(CHAVE_CHECKIN, novoCheckin(checkin, humor, hoje));
          marcarNoPos(D, "humor");
        }}
        aoFazerDesafio={() => marcarNoPos(D, "desafio")}
        aoLerASemana={() => marcarNoPos(D, "leitura")}
        aoAbrir={(a) => ir(ROTA_DO_CUIDADO[a])}
        aoVerTrilha={() => irParaAba("/trilha")}
        aoVerAlbum={() => ir("/jornada/album")}
        direita={<BotaoDoPerfil />}
        amigas={<AmigasNoHoje pos />}
      />
      {abreFesta && nascimento ? (
        <FestaDoNascimento
          nome={nomeDoBebe}
          dados={nascimento}
          {...resumoDaGestacao(loja.blob)}
          sementinhas={sementesDaChegada}
          aoComecar={() => {
            gravarChave(CHAVE_NASCIMENTO_FESTEJADO, true);
            if (sementesDaChegada != null) marco.fechar();
          }}
          aoDesfazer={async () => {
            if (ehBancada()) {
              recarregarNaBancada("/jornada?bancada=1&semana=39");
              return;
            }
            const r = await gravarPerfil(dia.uid, { birth_date: null });
            if (!r.ok) return;
            gravarChave(CHAVE_NASCIMENTO, null);
            gravarChave(CHAVE_NASCIMENTO_FESTEJADO, false);
            await recarregarPerfil();
          }}
        />
      ) : (
        <FestaDoMarco festa={marco.festa} nomeDoBebe={nomeDoBebe} aoFechar={marco.fechar} />
      )}
    </View>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Sem a semana da gestação
   ══════════════════════════════════════════════════════════════════════════ */

function JornadaSemData({ uid }: { uid: string }) {
  const feitos = useLivresDeHoje(uid);
  return (
    <Tela>
      <Saudacao titulo="Sua jornada" sub="Dois cuidados com você enquanto isso." />
      <Cartao fundo={corJornada.roxoNevoa}>
        <T tipo="rotulo" cor={corJornada.roxoEscuro}>
          Falta saber de quantas semanas você está
        </T>
        <T tipo="apagado">
          A aula de cada dia e a trilha seguem a sua gestação. Assim que o seu perfil tiver a data
          da última menstruação ou a do ultrassom, a jornada se monta sozinha.
        </T>
        <Botao
          rotulo="Informar a data"
          tipo="secundario"
          aoTocar={() => router.push("/ritual?editar=1")}
        />
      </Cartao>
      <CartaoDoDia
        sobre={dataPorExtenso(new Date())}
        titulo="Enquanto isso"
        feitos={0}
        total={2}
        mostrarEstrelas={false}
        itens={[
          {
            chave: "meditar",
            titulo: "Meditar",
            sub: "Respiração 4-4-8 guiada",
            Icone: Wind,
            feito: feitos.has("meditation"),
            rotuloDoFeito: "Feito hoje",
            aoTocar: () => ir("/jornada/meditar"),
          },
          {
            chave: "gratidao",
            titulo: "Gratidão",
            sub: "Uma coisa boa de hoje",
            Icone: PenLine,
            feito: feitos.has("gratitude"),
            rotuloDoFeito: "Feito hoje",
            aoTocar: () => ir("/jornada/gratidao"),
          },
        ]}
      />
    </Tela>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Peças da aba
   ══════════════════════════════════════════════════════════════════════════ */

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function dataPorExtenso(d: Date): string {
  return `${diaLongo(d)}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** O topo das telas Hoje sem céu (Modo Cuidado, sem data): o título e a foto dela. */
function Saudacao({ titulo, sub }: { titulo: string; sub: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: espaco.xs }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T tipo="titulo">{titulo}</T>
        <T tipo="apagado">{sub}</T>
      </View>
      <BotaoDoPerfil />
    </View>
  );
}

/** O material dos avisos sobre o céu: o mesmo dos cartões da tela (não vidro). */
const MATERIAL_DO_AVISO = {
  backgroundColor: luz.cartao,
  borderRadius: canto.cartao,
  ...curva,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: vidro.borda,
  padding: espaco.lg,
  gap: espaco.md,
  ...sombra,
} as const;

function FecharAviso({ aoFechar }: { aoFechar: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Fechar o aviso"
      onPress={() => {
        toque();
        aoFechar();
      }}
      style={({ pressed }) => ({
        width: ALVO_MINIMO,
        height: ALVO_MINIMO,
        marginTop: -10,
        marginRight: -10,
        alignSelf: "flex-start",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: canto.pilula,
        backgroundColor: pressed ? cor.apagado : "transparent",
      })}
    >
      <X size={18} color={cor.textoApagado} strokeWidth={2.4} />
    </Pressable>
  );
}

function AvisoDePresente({
  quantidade,
  de,
  nome,
  aoFechar,
}: {
  quantidade: number;
  de: "medico" | "amiga" | "criadora";
  nome: string | null;
  aoFechar: () => void;
}) {
  /* Sem nome, quem deu é dito pelo papel, como no site: um presente do médico
     dela não pode virar "da equipe do Mãe Esperta". */
  const deQuem = nome?.trim()
    ? `de ${nome.trim()}`
    : de === "medico"
      ? "do seu médico"
      : de === "amiga"
        ? "de uma amiga"
        : "de quem te trouxe para cá";
  return (
    <View style={MATERIAL_DO_AVISO}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
        {/* A bolha abre a caixa e brotam sementinhas. */}
        <BolhaViva humor="presente" tamanho={72} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ ...fonte.forte, ...escala.chamada, color: cor.texto }}>
            Você ganhou {quantidade} sementinhas
          </Text>
          <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoCorpo }}>
            Um presente {deQuem}.
          </Text>
        </View>
        <FecharAviso aoFechar={aoFechar} />
      </View>
      <SementesSubindo quantidade={quantidade} disparo={quantidade} />
    </View>
  );
}

/**
 * A CONQUISTA NOVA — a conferência da aba acabou de desbloquear. A conquista
 * espera o toque que paga (a régua do Duolingo, decisão do dono), e sem este
 * aviso ela nem sabia que havia o que tocar.
 */
function AvisoDeConquista({
  conquistas,
  aoPegar,
  aoFechar,
}: {
  conquistas: readonly ConquistaDef[];
  aoPegar: () => void;
  aoFechar: () => void;
}) {
  const uma = conquistas.length === 1 ? conquistas[0]! : null;
  return (
    <View style={MATERIAL_DO_AVISO}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: canto.pilula,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: corJornada.roxoFundo,
          }}
        >
          {uma ? (
            <Text style={{ fontSize: 30, lineHeight: 36 }}>{uma.emoji}</Text>
          ) : (
            <Award size={26} color={corJornada.roxo} strokeWidth={2.2} />
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ ...fonte.forte, ...escala.chamada, color: cor.texto }}>
            {uma ? `Conquista nova: ${uma.title}` : `${conquistas.length} conquistas novas`}
          </Text>
          <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoCorpo }}>
            {uma
              ? "Toque nela em Conquistas para pegar as sementinhas."
              : "Toque nelas em Conquistas para pegar as sementinhas."}
          </Text>
        </View>
        <FecharAviso aoFechar={aoFechar} />
      </View>
      <Botao rotulo="Ver as conquistas" aoTocar={aoPegar} />
    </View>
  );
}

/**
 * PASSOU DE 42 SEMANAS — o alerta do site, no lugar do Caminho: avaliação do
 * bem-estar do bebê HOJE, e direto para a maternidade com qualquer sinal. A
 * única ação de jornada que sobra é contar o nascimento. (O site mandava falar
 * com o consultório pela agenda DELE, que o app não tem; aqui o caminho é o SOS,
 * que traz o médico e os contatos dela.)
 */
/**
 * Passou das 42 semanas: a trilha (presa no dia 300) dá lugar a esta tela.
 *
 * ⚠️ 21/10/2026, decisão do dono (rede social + gamificação, não conselho
 * médico): ela era um alerta clínico — "entre em contato com o consultório
 * hoje… decisão sobre o parto… vá direto à maternidade se…". Ficou carinhosa,
 * com o SOS a um toque (é lá que moram os sinais de alerta) e a porta para
 * contar o nascimento.
 */
function AlertaDas42Semanas({ nomeDoBebe }: { nomeDoBebe: string | null }) {
  const fim = useFimDaRolagem();
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: cor.fundo }}>
      <ScrollView
        contentContainerStyle={{ padding: espaco.lg, gap: espaco.lg, paddingBottom: fim }}
      >
        <View
          style={{
            borderRadius: 24,
            backgroundColor: cor.rosaMarca,
            padding: espaco.xl,
            gap: espaco.sm,
          }}
        >
          <Text
            style={{
              ...fonte.media,
              fontSize: 13,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: cor.primariaEscura,
            }}
          >
            Reta final
          </Text>
          <Text
            accessibilityRole="header"
            style={{ ...fonte.forte, fontSize: 18, lineHeight: 24, color: cor.texto }}
          >
            {nomeDoBebe ?? "O bebê"} está chegando
          </Text>
          <Text style={{ ...fonte.normal, fontSize: 14, lineHeight: 22, color: cor.texto }}>
            Falta pouquíssimo para vocês se encontrarem. A trilha, as figurinhas e tudo o que vocês
            viveram até aqui estão guardados.
          </Text>
        </View>
        <View
          style={{
            borderRadius: 24,
            backgroundColor: cor.cartao,
            padding: 20,
            gap: 4,
            borderWidth: 1,
            borderColor: cor.borda,
          }}
        >
          <Text style={{ ...fonte.forte, fontSize: 14, color: cor.texto }}>
            {nomeDoBebe ?? "O bebê"} já nasceu?
          </Text>
          <Text
            style={{
              ...fonte.normal,
              fontSize: 13,
              lineHeight: 19,
              color: cor.textoApagado,
            }}
          >
            Conte a data e a jornada vira o 4º trimestre. A trilha e as figurinhas continuam
            guardadas.
          </Text>
          <View style={{ marginTop: espaco.sm }}>
            <Botao
              rotulo="Contar o nascimento"
              corFundo={corJornada.roxo}
              aoTocar={() => ir("/jornada/nascimento")}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
