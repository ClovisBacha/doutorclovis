import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Animated, LayoutAnimation, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAviso } from "~/componentes/aviso";
import { NaoConsegueLer, sucesso, useFimDaRolagem, useFolgaDaBarra } from "~/componentes/base";
import { BolhaNaEspera } from "~/componentes/bolha/na-espera";
import { BotaoDoPerfil } from "~/componentes/botao-do-perfil";
import { CEUS, sombraDoTexto, useCeuDasAbas } from "~/componentes/ceu-vivo";
import { FundoDeLuz } from "~/componentes/luz";
import { BolhaViva } from "~/componentes/movimento";
import { Painel } from "~/componentes/painel";
import {
  cobrarOBonusDoDia,
  depoisDaTransicao,
  lerAmigas,
  lerPedidos,
  mudancasNasAmigas,
  responderPedido,
  type LeituraDasAmigas,
  type Pedido,
} from "~/componentes/amigas/economia";
import {
  CabecalhoDaSecao,
  CartaoDaDupla,
  CartaoDoPedido,
  ChamarUmaAmiga,
  ListaDeAmigas,
  useConfirmar,
} from "~/componentes/amigas/pecas";
import { rota } from "~/componentes/jornada/bancada";
import { useJornada } from "~/componentes/jornada/usarJornada";
import { comAlfa } from "~/lib/cor";
import { BONUS_DA_DUPLA, primeiroNomeDaAmiga } from "~/lib/jornada/amigas";
import { mudarSelos, seloDasAmigas } from "~/lib/selos";
import { cor, escala, espaco, fonte, luz, margem } from "~/tema";

/**
 * AS AMIGAS — a única parte social do app ("a comunidade da gamificação"): os
 * pedidos de amizade, a DUPLA de sequência, a lista das amigas (o que cada uma
 * construiu, nunca placar e nada clínico) e chamar uma amiga, pelo link ou
 * pelo código. O selo da aba conta os pedidos e o convite da dupla.
 *
 * O grafo é o do convite e dos pedidos entre contas: sem busca por nome e sem
 * estranhos, não há o que moderar. No Modo Cuidado a aba se cala (o servidor
 * já devolve vazio). No pós-parto a dupla some: ela conta os dias que o
 * servidor paga, e ele só paga atividade na gestação — uma chama que nunca
 * acende é pior que nenhuma (decisão do dono).
 *
 * O desenho (18/11/2026, a vistoria): a aba abre direto no que pede ação (o
 * pedido, depois a dupla, depois a lista). A bolha apaixonada só aparece no
 * estado vazio, onde convida; com amigas, ela sai (era um texto de vitrine no
 * melhor lugar de uma aba de uso diário). O título rola junto, e o alto da
 * tela se desfaz na cor do céu, como na aba do bebê.
 *
 * 19/11/2026 (a Bolha guia): no vazio e na espera, quem fala é a Bolha
 * ("Me apresenta as suas amigas?", "Chamando as suas amigas…"). A leitura
 * que falha continua sendo `NaoConsegueLer`; no luto, nem Bolha nem convite.
 *
 * Desempenho: a aba relê no foco só se a última leitura tiver mais de 60 s, e
 * depois da transição; uma leitura igual à anterior não redesenha nada; o
 * bônus da dupla sai uma vez por dia; o campo de digitar mora no próprio
 * painel (`ChamarUmaAmiga`).
 *
 * Bancada: /amigas?bancada=1 [&amigas=0] [&dupla=sem|enviado|recebido|ativa|pausa]
 * [&pedidos=0|2] [&falha=1] [&pos=1] [&luto=1] [&hora=8|12|17|21]
 */

/**
 * Releitura no foco: no máximo uma a cada minuto (a ida e volta entre abas não
 * relê), a não ser que algo tenha mudado nas amigas desde a última.
 */
const RELER_DEPOIS_DE_MS = 60_000;

/** Quando a forma da tela muda (um pedido sai, uma amiga entra), as peças se acomodam. */
function acomodar() {
  if (Platform.OS === "web") return;
  LayoutAnimation.configureNext(
    LayoutAnimation.create(
      240,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity,
    ),
  );
}

export default function Amigas() {
  const { dia } = useJornada();
  const pos = dia.modo === "pos";
  const cuidadoDoDia = "cuidado" in dia && !!dia.cuidado;
  const [leitura, setLeitura] = useState<LeituraDasAmigas | null | "carregando">("carregando");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [respondendo, setRespondendo] = useState<Record<string, "sim" | "nao">>({});
  const fim = useFimDaRolagem(60);
  /* O aviso sobe acima da barra de vidro, que flutua sobre o pé da tela. */
  const { avisar, aviso } = useAviso({ baixo: useFolgaDaBarra() + espaco.sm });
  const { confirmar, folha } = useConfirmar();
  /* O céu das abas, atrás de tudo; fora das abas (ou no luto), a luz parada. */
  const dasAbas = useCeuDasAbas();
  const ceu = dasAbas ? CEUS[dasAbas.fase] : null;
  const topo = useSafeAreaInsets().top;
  const rolagem = useRef(new Animated.Value(0)).current;
  const aoRolar = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: rolagem } } }], {
        useNativeDriver: true,
      }),
    [rolagem],
  );

  const lidoEm = useRef(0);
  const versaoLida = useRef(-1);
  const ultimaLeitura = useRef<string | null>(null);
  const formaDaTela = useRef<string | null>(null);
  const tocados = useRef(new Set<string>());

  const carregar = useCallback(async () => {
    lidoEm.current = Date.now();
    versaoLida.current = mudancasNasAmigas();
    const [l, p] = await Promise.all([lerAmigas(), lerPedidos()]);
    /* A mesma resposta de antes não redesenha a aba. */
    const assinatura = JSON.stringify([l, p]);
    if (assinatura === ultimaLeitura.current) return;
    ultimaLeitura.current = assinatura;
    const forma = l
      ? `${l.careMode}|${l.amigas.length}|${l.dupla?.estado ?? "sem"}|${p.length}`
      : "falhou";
    if (formaDaTela.current !== null && formaDaTela.current !== forma) acomodar();
    formaDaTela.current = forma;
    setLeitura(l);
    setPedidos(p);
    if (!l) return;
    /* A tela acabou de ler: o selo da barra passa a dizer o que ela mostra. */
    mudarSelos({ amigas: l.careMode ? 0 : seloDasAmigas(p.length, l.dupla, pos) });
    /* O bônus da dupla: cada uma cobra o seu (o servidor confere que as DUAS
       fecharam o dia, e não paga duas vezes), uma vez por dia. Nunca no
       pós-parto nem no Modo Cuidado. */
    if (!pos && !l.careMode && l.dupla?.estado === "ativa") {
      const ela = primeiroNomeDaAmiga(l.dupla.nome);
      void cobrarOBonusDoDia().then((ganho) => {
        if (ganho <= 0) return;
        sucesso();
        avisar(`+${ganho} sementinhas: você e ${ela} apareceram juntas.`);
      });
    }
  }, [pos, avisar]);

  useFocusEffect(
    useCallback(() => {
      const recente = Date.now() - lidoEm.current < RELER_DEPOIS_DE_MS;
      if (recente && versaoLida.current === mudancasNasAmigas()) return;
      /* Depois da transição: a troca de aba anima primeiro, e lê depois. */
      const tarefa = depoisDaTransicao(() => void carregar());
      return () => tarefa.cancel();
    }, [carregar]),
  );

  const recarregar = useCallback(() => void carregar(), [carregar]);
  const abrirAmiga = useCallback((id: string) => router.push(rota(`/amigas/${id}`) as never), []);

  /* Responder um pedido: ele sai da tela na hora, e volta se o servidor não
     aceitar. Um toque só por pedido. */
  const responder = useCallback(
    async (p: Pedido, aceitar: boolean) => {
      if (tocados.current.has(p.id)) return;
      tocados.current.add(p.id);
      setRespondendo((r) => ({ ...r, [p.id]: aceitar ? "sim" : "nao" }));
      acomodar();
      setPedidos((lista) => lista.filter((x) => x.id !== p.id));
      const r = await responderPedido(p.id, aceitar);
      tocados.current.delete(p.id);
      setRespondendo(({ [p.id]: _feito, ...resto }) => resto);
      if (!r.ok) {
        acomodar();
        setPedidos((lista) => (lista.some((x) => x.id === p.id) ? lista : [p, ...lista]));
        avisar("Não deu agora. Tente de novo em instantes.");
        return;
      }
      if (aceitar) {
        sucesso();
        avisar(`Você e ${primeiroNomeDaAmiga(p.nome)} agora são amigas.`);
      }
      void carregar();
    },
    [avisar, carregar],
  );

  const corpo = (() => {
    if (leitura === "carregando")
      return (
        <Painel>
          <BolhaNaEspera pose="apaixonado" texto="Chamando as suas amigas…" />
        </Painel>
      );
    if (!leitura)
      return (
        <NaoConsegueLer
          sossego="As suas amigas continuam aqui. Só a leitura não veio agora, e eu tento de novo quando você tocar."
          aoTentar={recarregar}
        />
      );
    /* No luto, a aba fica quieta: nem bolha, nem convite. */
    if (leitura.careMode || cuidadoDoDia)
      return (
        <Painel estilo={{ padding: espaco.xl }}>
          <Text
            style={{
              textAlign: "center",
              ...fonte.normal,
              ...escala.legenda,
              color: cor.textoCorpo,
            }}
          >
            As Amigas voltam quando você quiser. Está tudo guardado.
          </Text>
        </Painel>
      );
    const { amigas, dupla } = leitura;
    const vazio = amigas.length === 0 && pedidos.length === 0;
    return (
      <>
        {vazio ? <EstadoVazio pos={pos} /> : null}

        {pedidos.length > 0 ? (
          <Painel>
            <CabecalhoDaSecao
              titulo={
                pedidos.length === 1
                  ? "Um pedido de amizade"
                  : `${pedidos.length} pedidos de amizade`
              }
            />
            {pedidos.map((p) => (
              <CartaoDoPedido
                key={p.id}
                p={p}
                respondendo={respondendo[p.id] ?? null}
                aoResponder={responder}
              />
            ))}
          </Painel>
        ) : null}

        {pos || amigas.length === 0 ? null : (
          <Painel>
            <CabecalhoDaSecao titulo="Sua dupla" />
            <CartaoDaDupla
              dupla={dupla}
              amigas={amigas}
              aoMudar={recarregar}
              avisar={avisar}
              confirmar={confirmar}
            />
          </Painel>
        )}

        {amigas.length > 0 ? (
          <Painel>
            <CabecalhoDaSecao titulo="Suas amigas" />
            <ListaDeAmigas amigas={amigas} aoAbrir={abrirAmiga} />
          </Painel>
        ) : null}

        <ChamarUmaAmiga avisar={avisar} />
      </>
    );
  })();

  const veu = ceu?.topo ?? luz.base;
  return (
    <View style={{ flex: 1, backgroundColor: ceu ? "transparent" : luz.base }}>
      {ceu ? null : <FundoDeLuz />}
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: topo, paddingBottom: fim }}
        onScroll={aoRolar}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            minHeight: 52,
            paddingLeft: margem.tela,
            paddingRight: margem.tela - 4,
            paddingTop: espaco.sm,
            paddingBottom: espaco.sm,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              flex: 1,
              ...fonte.display,
              ...escala.grande,
              letterSpacing: -0.2,
              color: ceu?.tinta ?? cor.texto,
              ...(ceu ? sombraDoTexto(ceu) : null),
            }}
          >
            Amigas
          </Text>
          <BotaoDoPerfil />
        </View>
        <View style={{ paddingHorizontal: margem.tela, gap: 14 }}>{corpo}</View>
      </Animated.ScrollView>
      {/* O alto da tela se desfaz na cor do céu quando a página sobe: o que
          rola não passa duro por baixo do relógio do iPhone. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: topo + 44,
          opacity: rolagem.interpolate({
            inputRange: [0, 60],
            outputRange: [0, 1],
            extrapolate: "clamp",
          }),
        }}
      >
        <LinearGradient
          colors={[veu, comAlfa(veu, 0.85), comAlfa(veu, 0)]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {folha}
      {aviso}
    </View>
  );
}

/**
 * O ESTADO VAZIO (sem amigas e sem pedidos): a bolha apaixonada convida, num
 * painel (o texto sai de cima do céu, onde não segurava contraste). Logo
 * abaixo vem o painel de chamar uma amiga. No pós-parto, sem a frase da
 * dupla, que lá não existe. O título é a Bolha pedindo (19/11/2026).
 */
function EstadoVazio({ pos }: { pos: boolean }) {
  return (
    <Painel estilo={{ alignItems: "center", paddingTop: espaco.lg, paddingBottom: espaco.xl }}>
      <BolhaViva humor="apaixonado" tamanho={120} />
      <Text
        accessibilityRole="header"
        style={{
          marginTop: -espaco.md,
          textAlign: "center",
          ...fonte.display,
          ...escala.titulo2,
          letterSpacing: -0.2,
          color: cor.texto,
        }}
      >
        Me apresenta as suas amigas?
      </Text>
      <Text
        style={{
          textAlign: "center",
          paddingHorizontal: espaco.md,
          ...fonte.normal,
          ...escala.legenda,
          color: cor.textoCorpo,
        }}
      >
        {pos
          ? "Quem entrar pelo seu convite aparece aqui comigo, e vocês visitam o Cantinho uma da outra."
          : `Quem entrar pelo seu convite aparece aqui comigo. Juntas, vocês formam uma dupla: cada dia em que as duas aparecem vale ${BONUS_DA_DUPLA} sementinhas para cada uma.`}
      </Text>
    </Painel>
  );
}
