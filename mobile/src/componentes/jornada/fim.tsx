import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import Sprout from "lucide-react-native/icons/sprout";
import Target from "lucide-react-native/icons/target";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Botao, Cartao, sucesso, T } from "~/componentes/base";
import { Entrada, useMovimentoReduzido } from "~/componentes/movimento";
import { pagarAula, pagarDiaFechado, pagarMomento } from "~/componentes/jornada/economia";
import { corJornada } from "~/componentes/jornada/cores";
import { marcarLivre } from "~/componentes/jornada/livres";
import { Constelacao, SementesSubindo } from "~/componentes/jornada/efeitos";
import { NumeroQueConta, numeroDaPedra, PedraDoPlacar, Raios } from "~/componentes/jornada/festa";
import { BolhaComBalao, BotaoDaAtividade } from "~/componentes/jornada/atividade";
import { Bolha, Confete, Estrela, Estrelas, voltarParaJornada } from "~/componentes/jornada/pecas";
import { TrofeuSeConstruindo } from "~/componentes/caminho/pecas";
import { FALA_DO_DIA_COMPLETO } from "~/lib/bolha/falas-do-jogo";
import { contarMomentos, feito, flagsDoDia, type Momento } from "~/lib/jornada/momentos";
import { marcar, useLoja } from "~/lib/jornada/loja";
import { comAlfa } from "~/lib/cor";
import { canto, cor, curva, escala, espaco, fonte, sombra, veu } from "~/tema";

/**
 * O FIM DE UM MOMENTO — marca, paga, e celebra quando fecha o dia.
 *
 * A ordem importa:
 *  1. Marca no aparelho ANTES do servidor: ela fez, e rede caída não pode
 *     apagar o que ela fez (é o que o site faz com a estrela).
 *  2. Paga o momento.
 *  3. Se esta marca fechou os cinco, pede o bônus DEPOIS do pagamento: o
 *     servidor confere as quatro atividades no ledger, e pedir antes de a
 *     quarta chegar devolveria zero.
 *
 * No Modo Cuidado não há jornada, estrela nem placar (a régua do site): nada é
 * marcado nem pago. No pós-parto marca (a trilha do pós-parto é local) mas não
 * paga — o servidor não paga fora da gestação.
 */
export type Desfecho = {
  /** Sementinhas do momento; `null` = não conseguimos confirmar. */
  ganhou: number | null;
  fechou: boolean;
  bonus: number | null;
  semPagamento: boolean;
};

export async function concluirMomento(o: {
  uid: string;
  D: number | null;
  momento: Momento;
  cuidado: boolean;
  pos: boolean;
  acertos?: number;
}): Promise<Desfecho> {
  if (o.cuidado || o.D == null) {
    await marcarLivre(o.uid, o.momento);
    return { ganhou: null, fechou: false, bonus: null, semPagamento: true };
  }
  const { fechouAgora } = marcar(o.D, o.momento, o.pos);
  if (o.pos) return { ganhou: null, fechou: false, bonus: null, semPagamento: true };
  const ganhou =
    o.momento === "aula"
      ? await pagarAula(o.D, o.acertos ?? 0)
      : await pagarMomento(o.D, o.momento);
  const bonus = fechouAgora ? await pagarDiaFechado(o.D) : null;
  if (fechouAgora && Platform.OS !== "web") {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
  return { ganhou, fechou: fechouAgora, bonus, semPagamento: false };
}

/** A frase das sementinhas — nunca afirma um crédito que não foi confirmado. */
function fraseDoGanho(d: Desfecho): { texto: string; ok: boolean } | null {
  if (d.semPagamento) return null;
  if (d.ganhou == null) {
    return {
      texto:
        "Seu momento ficou guardado. As sementinhas ainda não foram confirmadas, e o app tenta de novo quando você voltar.",
      ok: false,
    };
  }
  if (d.ganhou > 0) return { texto: `+${d.ganhou} sementinhas`, ok: true };
  return { texto: "Este momento já tinha sido contado hoje.", ok: true };
}

/**
 * A FESTA DO FIM (18/11/2026, a vistoria: "o herói é tímido", o placar pulava
 * e as estrelas pareciam nota). Uma coreografia só, do primeiro quadro:
 *   0 ms a bolha chega numa mola (0,4 → 1) · 120 os raios abrem · 220 o título
 *   · ~300 o toque de sucesso · 350 e 490 as pedras do placar · 700 a estrela
 *   deste momento acende.
 * O placar fica no lugar desde o começo: a pedra das sementinhas espera com
 * "+…" e só mostra NÚMERO quando o servidor confirmou o crédito. As estrelas
 * têm nome ("Cuidados de hoje") e ficam longe dos acertos, para não lerem
 * como nota.
 *
 * 19/11/2026 (a Bolha guia): a Bolha da festa FALA, num balão logo abaixo
 * dela (`falaDaBolha`; no dia fechado, "Os cinco cuidados de hoje, feitos.
 * Cuidar de você é cuidar de vocês dois."). O brilho que ficava atrás da
 * bolha padrão saiu: nada atrás dela (os raios são a festa, e não um disco).
 */
export function FimDoMomento({
  titulo,
  fala,
  falaDaBolha,
  desfecho,
  D,
  cuidado,
  pos,
  aoTentarPagar,
  extra,
  arte,
  confete,
  balao,
  acertos,
  momento,
  cor: corDoBotao,
}: {
  titulo: string;
  fala?: string;
  /**
   * O que a Bolha da festa diz, num balão logo abaixo dela. Só quando o herói
   * é a Bolha (a aula, ou a festa do dia fechado); nunca no Modo Cuidado.
   */
  falaDaBolha?: string;
  /** `null` enquanto o servidor responde. */
  desfecho: Desfecho | null;
  D: number | null;
  cuidado: boolean;
  pos: boolean;
  /** Só a aula oferece: as atividades são reconciliadas ao abrir a aba. */
  aoTentarPagar?: () => void;
  extra?: React.ReactNode;
  /** A arte no lugar da bolha (o 💋 do Bebê). A festa das cinco estrelas continua por cima. */
  arte?: React.ReactNode;
  /** Confete ao abrir mesmo sem fechar o dia (a carta lida; "grande" no número redondo). */
  confete?: boolean | "grande";
  /** A fala da bolha, num balão com a bolha pequena (como no fim do Bebê no site). */
  balao?: string;
  /** Só a aula: quantas acertou de quantas (vira uma pedra do placar). */
  acertos?: { feitos: number; total: number };
  /**
   * O momento que esta tela fecha. Com ele, a fileira de estrelas abre com as
   * de ANTES e só a deste momento acende — mesmo que a tela monte antes ou
   * depois de o momento ser marcado.
   */
  momento?: Momento;
  /** A cor do botão final (a da atividade); sem ela, o roxo do jogo. */
  cor?: string;
}) {
  const loja = useLoja();
  const reduzido = useMovimentoReduzido();
  const flags = D != null && !pos ? flagsDoDia(loja.blob, D) : null;
  const feitos = flags ? contarMomentos(flags) : 0;
  const ganho = desfecho ? fraseDoGanho(desfecho) : null;
  const festa = !!desfecho?.fechou && !cuidado;

  /* As estrelas: o ponto de partida fica preso na montagem (as de antes). */
  const [inicial] = useState(() => {
    if (!flags) return 0;
    if (momento) return Math.max(0, feitos - (feito(flags, momento) ? 1 : 0));
    return Math.max(0, feitos - 1);
  });
  const alvo = festa ? 5 : Math.max(inicial, feitos);
  const [estrelasVisiveis, setEstrelasVisiveis] = useState(inicial);
  useEffect(() => {
    const t = setTimeout(() => setEstrelasVisiveis(alvo), 700);
    return () => clearTimeout(t);
  }, [alvo]);

  /* A chegada da bolha e o toque de sucesso (não no Modo Cuidado, que não
     festeja desempenho, nem na aula sem acerto). */
  const chegada = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  useEffect(() => {
    if (!reduzido) {
      Animated.spring(chegada, {
        toValue: 1,
        speed: 10,
        bounciness: 12,
        useNativeDriver: true,
      }).start();
    }
    const comemora = !cuidado && (acertos ? acertos.feitos > 0 : true);
    const t = comemora ? setTimeout(sucesso, 300) : null;
    return () => {
      if (t) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [mostrarConfete, setConfete] = useState(false);
  const jaFestejou = useRef(false);
  /* O dia fechou agora: o troféu se constrói por cima da festa, uma vez. */
  const [trofeu, setTrofeu] = useState(false);
  useEffect(() => {
    if ((festa || (confete && !cuidado)) && !jaFestejou.current) {
      jaFestejou.current = true;
      setConfete(true);
      if (festa) setTrofeu(true);
    }
  }, [festa, confete, cuidado]);

  /* A festa ocupa a tela: o herói no meio, o botão firme no pé. A altura vem
     da janela, porque quem a mostra rola. */
  const janela = useWindowDimensions();
  const area = useSafeAreaInsets();
  const altura = janela.height - area.top - area.bottom - espaco.lg * 2;
  /* O confete cai da borda de CIMA da tela, e não de dentro do conteúdo: a
     camada dele se mede na janela e se estica até as bordas. */
  const raiz = useRef<View>(null);
  const [origem, setOrigem] = useState<{ x: number; y: number } | null>(null);

  const ganhouConfirmado = !!ganho?.ok && !!desfecho?.ganhou && desfecho.ganhou > 0;
  /* Há pagamento a esperar (fora do luto, do pós-parto e sem dia). */
  const pagavel = !cuidado && !pos && D != null && !desfecho?.semPagamento;
  const bonus = festa && desfecho?.bonus && desfecho.bonus > 0 ? desfecho.bonus : null;
  const comPlacar = pagavel || !!acertos || !!bonus;

  const heroi = festa ? (
    /* No aparelho, a bolha da festa traz as cinco estrelas em órbita; na web,
       a constelação é desenhada em volta da arte parada. */
    Platform.OS === "web" ? (
      <Constelacao tamanho={170} estrela={(i) => <Estrela key={i} acesa tamanho={30} />}>
        <Bolha humor="comemorando" tamanho={170} />
      </Constelacao>
    ) : (
      <Bolha humor="estrelas" tamanho={210} />
    )
  ) : (
    (arte ?? <Bolha humor={cuidado ? "feliz" : "comemorando"} tamanho={210} />)
  );
  /* A fala da Bolha: a do dia fechado vence a do momento. */
  const falaDela = cuidado ? null : festa ? FALA_DO_DIA_COMPLETO : (falaDaBolha ?? null);

  return (
    <View
      ref={raiz}
      onLayout={() =>
        raiz.current?.measureInWindow((x, y) => setOrigem((o) => (o?.y === y ? o : { x, y })))
      }
      style={{ flexGrow: 1, minHeight: altura }}
    >
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: espaco.md }}>
        <View style={{ alignItems: "center", justifyContent: "center", minHeight: 236 }}>
          {/* O sol de raios atrás da bolha: o "você conseguiu" (não no Modo
              Cuidado, que não festeja desempenho). */}
          {cuidado ? null : <Raios tamanho={340} forca={festa ? 0.75 : 0.55} atraso={120} />}
          <Animated.View
            style={{
              opacity: chegada.interpolate({
                inputRange: [0, 0.3],
                outputRange: [0, 1],
                extrapolate: "clamp",
              }),
              transform: [
                { scale: chegada.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
              ],
            }}
          >
            {heroi}
          </Animated.View>
        </View>
        {falaDela ? <FalaDaBolha texto={falaDela} /> : null}
        <Entrada atraso={220} deslocamento={12}>
          <Text
            accessibilityRole="header"
            style={{
              textAlign: "center",
              ...fonte.display,
              ...escala.grande,
              letterSpacing: -0.3,
              color: cor.texto,
            }}
          >
            {festa ? "Cinco estrelas!" : titulo}
          </Text>
        </Entrada>
        {festa ? null : fala ? (
          <T tipo="corpo" centro cor={cor.textoApagado}>
            {fala}
          </T>
        ) : null}
        {balao && !festa ? (
          <BolhaComBalao humor={cuidado ? "feliz" : "comemorando"} fala={balao} tamanho={72} />
        ) : null}

        {/* O PLACAR: o que ela levou deste momento, em pedras que entram uma
            depois da outra, todas no lugar desde o primeiro quadro. As
            sementinhas só viram NÚMERO quando o servidor confirmou o crédito. */}
        {comPlacar ? (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              gap: espaco.md,
              alignSelf: "stretch",
              marginTop: 6,
            }}
          >
            {ganhouConfirmado ? (
              <PedraDoPlacar
                ordem={0}
                rotulo="sementinhas"
                acessivel={`${desfecho!.ganhou} sementinhas ganhas`}
                icone={<Sprout size={22} color={cor.sementinha} strokeWidth={2.4} />}
              >
                <NumeroQueConta
                  valor={desfecho!.ganhou!}
                  prefixo="+"
                  estilo={numeroDaPedra(cor.sementinha)}
                />
                <SementesSubindo quantidade={desfecho!.ganhou!} disparo={desfecho!.ganhou!} />
              </PedraDoPlacar>
            ) : pagavel ? (
              <PedraDoPlacar
                ordem={0}
                rotulo="sementinhas"
                acessivel={
                  desfecho == null
                    ? "Somando as sementinhas"
                    : "Nenhuma sementinha confirmada agora"
                }
                icone={<Sprout size={22} color={cor.textoApagado} strokeWidth={2.4} />}
              >
                <Text allowFontScaling={false} style={numeroDaPedra(cor.textoApagado)}>
                  {desfecho == null ? "+…" : "—"}
                </Text>
              </PedraDoPlacar>
            ) : null}
            {acertos ? (
              <PedraDoPlacar
                ordem={1}
                rotulo="acertos"
                acessivel={`${acertos.feitos} de ${acertos.total} acertos`}
                icone={<Target size={20} color={corJornada.roxo} strokeWidth={2.4} />}
              >
                <Text allowFontScaling={false} style={numeroDaPedra(corJornada.roxo)}>
                  {acertos.feitos}/{acertos.total}
                </Text>
              </PedraDoPlacar>
            ) : null}
            {bonus ? (
              <PedraDoPlacar
                ordem={2}
                rotulo="bônus do dia"
                acessivel={`${bonus} sementinhas de bônus pelo dia completo`}
                icone={<Estrela acesa tamanho={20} />}
              >
                <NumeroQueConta valor={bonus} prefixo="+" estilo={numeroDaPedra(cor.sementinha)} />
              </PedraDoPlacar>
            ) : null}
          </View>
        ) : null}
        {flags && !cuidado ? (
          <View style={{ alignItems: "center", gap: espaco.sm, marginTop: espaco.xl }}>
            <Text
              importantForAccessibility="no"
              accessibilityElementsHidden
              style={{
                ...fonte.forte,
                ...escala.nota,
                letterSpacing: 0.3,
                color: cor.textoApagado,
              }}
            >
              Cuidados de hoje
            </Text>
            <Estrelas
              feitos={estrelasVisiveis}
              tamanho={28}
              rotuloAcessivel={`${alvo} de 5 cuidados de hoje`}
            />
          </View>
        ) : null}
      </View>

      <View style={{ gap: espaco.md, marginTop: espaco.lg }}>
        {extra}
        {/* O que NÃO virou número no placar: o "não conseguimos confirmar" e o
            "já estava contado", ditos por inteiro, nunca escondidos. */}
        {ganho && !ganhouConfirmado ? (
          <Cartao fundo={ganho.ok ? cor.sementinhaFundo : cor.atencaoFundo}>
            <T tipo="rotulo" cor={ganho.ok ? cor.sementinha : cor.atencao} centro>
              {ganho.texto}
            </T>
            {!ganho.ok && aoTentarPagar ? (
              <Botao rotulo="Tentar de novo" tipo="secundario" aoTocar={aoTentarPagar} />
            ) : null}
          </Cartao>
        ) : null}
        <BotaoDaAtividade
          cor={corDoBotao ?? corJornada.roxo}
          rotulo="Continuar"
          aoTocar={voltarParaJornada}
        />
      </View>
      {mostrarConfete && origem ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: -origem.x,
            top: -origem.y,
            width: janela.width,
            height: janela.height,
            zIndex: 10,
          }}
        >
          <Confete pecas={confete === "grande" && !festa ? 72 : 36} altura={janela.height + 40} />
        </View>
      ) : null}
      {trofeu ? <TrofeuConquistado aoFechar={() => setTrofeu(false)} /> : null}
    </View>
  );
}

/**
 * O BALÃO DA BOLHA DA FESTA: material branco com a ponta virada PARA CIMA,
 * para a Bolha logo acima dele (é ela quem fala). Entra junto com o título.
 */
function FalaDaBolha({ texto }: { texto: string }) {
  return (
    <Entrada atraso={160} deslocamento={10} estilo={{ alignSelf: "stretch", alignItems: "center" }}>
      <View
        accessibilityRole="text"
        accessibilityLabel={`A Bolha: ${texto}`}
        style={{
          maxWidth: 330,
          marginTop: -espaco.sm,
          paddingHorizontal: espaco.lg,
          paddingVertical: espaco.md,
          borderRadius: canto.dentro,
          ...curva,
          backgroundColor: cor.cartao,
          ...sombra,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -6,
            left: "50%",
            marginLeft: -7,
            width: 14,
            height: 14,
            borderRadius: 3,
            backgroundColor: cor.cartao,
            transform: [{ rotate: "45deg" }],
          }}
        />
        <Text
          style={{
            textAlign: "center",
            ...fonte.media,
            ...escala.corpo,
            color: cor.texto,
          }}
        >
          {texto}
        </Text>
      </View>
    </Entrada>
  );
}

/**
 * O TROFÉU DO DIA FECHADO — a animação do site (`TrofeuConquistado`): o troféu
 * se constrói do nada em 5 s, fica meio segundo pronto, e a tela some. Um
 * toque pula. Antes o app mostrava só uma linha de texto no fim da atividade.
 */
function TrofeuConquistado({ aoFechar }: { aoFechar: () => void }) {
  const fechado = useRef(false);
  const fechar = () => {
    if (fechado.current) return;
    fechado.current = true;
    aoFechar();
  };
  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent onRequestClose={fechar}>
      {/* Sobre o véu escuro, o relógio e a bateria em branco. */}
      <StatusBar style="light" animated />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Troféu conquistado. Toque para continuar"
        onPress={fechar}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: espaco.lg,
          paddingHorizontal: espaco.xl,
          /* Escuro o bastante para a festa de trás não disputar com o troféu. */
          backgroundColor: veu.tinta(0.86),
        }}
      >
        <TrofeuSeConstruindo largura={200} aoTerminar={() => setTimeout(fechar, 600)} />
        <Text
          style={{
            textAlign: "center",
            ...fonte.display,
            ...escala.titulo1,
            letterSpacing: -0.2,
            color: cor.branco,
          }}
        >
          Troféu conquistado
        </Text>
        <Text
          style={{
            textAlign: "center",
            ...fonte.media,
            ...escala.legenda,
            color: comAlfa(cor.branco, 0.85),
          }}
        >
          Mais um troféu no seu placar.
        </Text>
      </Pressable>
    </Modal>
  );
}
