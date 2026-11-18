import { useLocalSearchParams } from "expo-router";
import { Volume2, VolumeX } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  AppState,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  cartaComNome,
  fraseDeUltimaLeitura,
  registrarLeitura,
  ultimaLeitura,
  type Carta,
  type LeiturasDeCartas,
} from "@/lib/cartas-do-bebe";
import { periodoDaHora } from "@/lib/frases-do-mascote";
import {
  cartaDasGratidoes,
  ehGratidao,
  PREFIXO_GRATIDAO,
  textoDaGratidao,
  type Gratidao,
} from "@/lib/gratidao";
import { paraLike } from "@/lib/like-seguro";
import { haQuantoTempo } from "@/lib/quando-foi";
import { toque } from "~/componentes/base";
import {
  BolhaComBalao,
  BotaoDaAtividade,
  BotaoRedondo,
  Brilho,
  CarregandoAtividade,
  fecharAtividade,
  FundoDaAtividade,
  LinhaDaAtividade,
  Segmentos,
  SobrelinhaDaAtividade,
  Superficie,
  TopoDaAtividade,
  TrocaDeEtapa,
} from "~/componentes/jornada/atividade";
import { corDaAtividade } from "~/componentes/jornada/cores";
import { concluirMomento, FimDoMomento, type Desfecho } from "~/componentes/jornada/fim";
import { FolhaDeSons, type SomEscolhido } from "~/componentes/jornada/folha-de-sons";
import { useAtividade } from "~/componentes/jornada/usarJornada";
import { lacoQueDescansa, useMovimentoReduzido } from "~/componentes/movimento";
import { tocarSomDeFundo, type SomDeFundo } from "~/lib/audio/som-de-fundo";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { cartaDoDiaNoApp, falaDaBolhaNaCartaNoApp, poolDeHojeNoApp } from "~/lib/jornada/cartas";
import { gravarChave, useLoja } from "~/lib/jornada/loja";
import { CHAVE_CARTAS_LIDAS } from "~/lib/jornada/momentos";
import { supabase } from "~/servidor/supabase";
import { ALVO_MINIMO, cor, escala, espaco, fonte, margem } from "~/tema";

/**
 * A CARTA PARA O BEBÊ — o `BondingBlock` do app antigo: ela lê em voz alta,
 * linha a linha, no ritmo dela (quem para para chorar, ou para repetir o nome
 * do bebê, não perde o lugar), com um som calmo de fundo e corações subindo.
 * No fim, "Beijo entregue".
 *
 * A leitura tem o gesto dos Stories (18/11/2026): um toque à direita segue, um
 * toque no terço esquerdo volta uma linha (antes ela só andava para a frente,
 * e um toque duplo sem querer pulava a linha que ela ia ler). A linha velha sai
 * antes de a nova entrar.
 *
 * As cartas e a régua (por fase, nunca cruzando gestação com pós-parto) são do
 * site (`@/lib/cartas-do-bebe`); a do dia não repete a de ontem
 * (`cartaDoDiaNoApp`). O álbum reabre qualquer carta da fase, e com oito ou
 * mais gratidões guardadas existe a carta feita das coisas boas que ELA anotou.
 * O rastro de leitura viaja na jornada (`dc-path-cartas-lidas`).
 *
 * ⚠️ NÃO EXISTE NO MODO CUIDADO: não há versão suavizada de um convite para
 * falar com o bebê. A tela, se aberta por algum caminho, não fala dele.
 *
 * Bancada: /jornada/bebe?bancada=1 [&etapa=leitura|lista|fim|feita] [&linha=N]
 *          [&gratidoes=1] [&folha=1] [&fechou=1]
 */

const PALETA = corDaAtividade.carta;

/** O envelope com coração, nas artes 3D do app: a carta é um objeto, e não um texto solto. */
const ARTE_DA_CARTA = require("../../../../src/assets/bebe/carta.webp");

/* As gratidões de exemplo da bancada: o bastante para a carta delas existir. */
const GRATIDOES_DA_BANCADA: Gratidao[] = [
  "O Rafael fez um chá e ficou comigo no sofá.",
  "As amigas do grupo mandaram um áudio cantando.",
  "Consegui ler um livro inteiro na tarde de domingo.",
  "Minha mãe veio almoçar.",
  "Escolhemos a primeira roupinha da mala.",
  "Pendurei as fotos da barriga no corredor.",
  "Uma amiga do app comentou a minha foto.",
  "Ganhei um macacãozinho da vizinha.",
  "Rimos muito no jantar com a família.",
].map((texto, i) => ({ texto, quando: `2026-0${(i % 9) + 1}-10T12:00:00Z` }));

type Etapa = "intro" | "lista" | "leitura" | "fim";

export default function Bebe() {
  const at = useAtividade("bonding");
  const loja = useLoja();
  const [etapa, setEtapa] = useState<Etapa>("intro");
  const [linha, setLinha] = useState(0);
  const [cartaEscolhida, setCartaEscolhida] = useState<Carta | null>(null);
  const [lendoAsDelas, setLendoAsDelas] = useState(false);
  const [gratidoes, setGratidoes] = useState<Gratidao[] | null>(null);
  const [som, setSom] = useState<SomEscolhido>("pad");
  const [folha, setFolha] = useState(false);
  const [desfecho, setDesfecho] = useState<Desfecho | null>(null);
  const [aplicouBancada, setAplicouBancada] = useState(false);
  const fundo = useRef<SomDeFundo | null>(null);

  const nome = at.perfil?.baby_name ?? null;
  const cartaHoje = useMemo(() => {
    if (!at.pronto || at.cuidado) return null;
    /* A carta do dia sem repetir a de ontem (a troca de fase repetia). */
    const c = cartaDoDiaNoApp({
      dia: at.D ?? new Date().getDate(),
      semanas: at.semana,
      posParto: at.pos,
    });
    return cartaComNome(c, nome);
  }, [at.pronto, at.cuidado, at.D, at.semana, at.pos, nome]);
  const album = useMemo(
    () =>
      poolDeHojeNoApp({ semanas: at.semana, posParto: at.pos }).map((c) => cartaComNome(c, nome)),
    [at.semana, at.pos, nome],
  );
  const cartaDelas = useMemo(
    () => (at.cuidado || !gratidoes ? null : cartaDasGratidoes(gratidoes, { nomeDoBebe: nome })),
    [at.cuidado, gratidoes, nome],
  );
  const cartaAtiva = cartaEscolhida ?? cartaHoje;
  const carta = lendoAsDelas && cartaDelas ? cartaDelas : cartaAtiva;

  /* Vindo do "Ver a carta" da Gratidão: abre já na carta das gratidões dela,
     assim que as gratidões chegam (a carta só existe com oito ou mais). */
  const { delas } = useLocalSearchParams<{ delas?: string }>();
  const abriuDelas = useRef(false);
  useEffect(() => {
    if (delas !== "1" || abriuDelas.current || !cartaDelas) return;
    abriuDelas.current = true;
    setLendoAsDelas(true);
  }, [delas, cartaDelas]);

  const leituras = (loja.blob[CHAVE_CARTAS_LIDAS] ?? {}) as LeiturasDeCartas;
  const fraseDeLeitura = cartaHoje
    ? fraseDeUltimaLeitura(ultimaLeitura(leituras, cartaHoje.id), new Date())
    : null;

  /* Sair da tela cala o som. */
  useEffect(() => () => fundo.current?.parar(), []);

  /* As gratidões dela, para a carta feita das coisas boas que ela anotou. */
  useEffect(() => {
    if (!at.uid || at.cuidado || ehBancada()) return;
    let vivo = true;
    void (async () => {
      try {
        const { data } = await supabase
          .from("journal_entries")
          .select("content, created_at")
          .eq("user_id", at.uid)
          .ilike("content", `${paraLike(PREFIXO_GRATIDAO)}%`)
          .order("created_at", { ascending: true })
          .limit(300);
        if (!vivo) return;
        setGratidoes(
          ((data ?? []) as { content: string; created_at: string }[])
            .filter((l) => ehGratidao(l.content))
            .map((l) => ({ texto: textoDaGratidao(l.content), quando: l.created_at })),
        );
      } catch {
        /* sem a carta delas: a carta do dia é a que a tela sempre prometeu */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [at.uid, at.cuidado]);

  useEffect(() => {
    if (aplicouBancada || !at.pronto || !ehBancada()) return;
    setAplicouBancada(true);
    if (parametroDaBancada("gratidoes") === "1") setGratidoes(GRATIDOES_DA_BANCADA);
    if (parametroDaBancada("folha") === "1") setFolha(true);
    const e = parametroDaBancada("etapa");
    if (e === "leitura") {
      setEtapa("leitura");
      setLinha(Math.max(0, Number(parametroDaBancada("linha") ?? 2) || 0));
    }
    if (e === "lista") setEtapa("lista");
    if (e === "fim") {
      /* `&fechou=1`: o dia de cinco estrelas, em que a festa toma o título. */
      const fechou = parametroDaBancada("fechou") === "1";
      setEtapa("fim");
      setDesfecho({ ganhou: 5, fechou, bonus: fechou ? 20 : null, semPagamento: false });
    }
  }, [at.pronto, aplicouBancada]);

  function comecarSom() {
    fundo.current?.parar();
    fundo.current = tocarSomDeFundo(som);
  }

  function comecar() {
    setLinha(0);
    setDesfecho(null);
    comecarSom();
    setEtapa("leitura");
  }

  function abrirDoAlbum(c: Carta) {
    setCartaEscolhida(c);
    setLendoAsDelas(false);
    comecar();
  }

  /* O fechar sai da atividade, de qualquer etapa, como no site — sair da
     leitura não pode custar dois toques. */
  function sair() {
    fundo.current?.parar();
    fundo.current = null;
    fecharAtividade();
  }

  function trocarSom(k: SomEscolhido) {
    setSom(k);
    fundo.current?.parar();
    fundo.current = tocarSomDeFundo(k);
  }

  async function terminar() {
    setEtapa("fim");
    /* O rastro é da carta do dia ou da do álbum — nunca da das gratidões dela,
       que não tem um id estável. É informação, não recompensa. */
    if (!lendoAsDelas && cartaAtiva)
      gravarChave(CHAVE_CARTAS_LIDAS, registrarLeitura(leituras, cartaAtiva.id, new Date()));
    if (!at.uid) return;
    setDesfecho(
      await concluirMomento({
        uid: at.uid,
        D: at.D,
        momento: "bonding",
        cuidado: at.cuidado,
        pos: at.pos,
      }),
    );
  }

  if (!at.pronto) return <CarregandoAtividade paleta={PALETA} />;

  if (at.cuidado || !carta || !cartaHoje) {
    return (
      <FundoDaAtividade paleta={PALETA}>
        <TopoDaAtividade />
        <View style={{ paddingHorizontal: margem.foco, paddingTop: espaco.xl, gap: espaco.xl }}>
          <Text style={{ ...fonte.normal, ...escala.corpo, color: cor.textoCorpo }}>
            Hoje a trilha é sobre cuidar de você. Respirar e escrever continuam aqui.
          </Text>
          <BotaoDaAtividade cor={PALETA.acao} rotulo="Voltar" aoTocar={fecharAtividade} />
        </View>
      </FundoDaAtividade>
    );
  }

  const dia = at.D ?? 0;
  let miolo: ReactNode;

  if (etapa === "fim") {
    miolo = (
      <>
        <TopoDaAtividade aoFechar={sair} />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: margem.tela, paddingBottom: espaco.xxl }}
        >
          <FimDoMomento
            titulo="Beijo entregue"
            fala="Esse minuto com a sua voz ficou guardado, só de vocês."
            desfecho={desfecho}
            D={at.D}
            cuidado={false}
            pos={at.pos}
            /* O fim do site: o 💋 grande, o confete a cada carta e a bolha
               acompanhando ("Guardei esse minuto com você") — ela é o
               acompanhamento, não o clímax. */
            arte={
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                <Brilho tamanho={200} tinta={PALETA.luz} />
                <Image
                  source={ARTE_DA_CARTA}
                  accessibilityIgnoresInvertColors
                  style={{ width: 128, height: 128 }}
                />
              </View>
            }
            confete
            balao={falaDaBolhaNaCartaNoApp({ tela: "done" })}
          />
        </ScrollView>
      </>
    );
  } else if (etapa === "leitura") {
    const total = carta.lines.length;
    const ultima = linha >= total - 1;
    const voltar = () => {
      if (linha <= 0) return;
      toque();
      setLinha((l) => Math.max(0, l - 1));
    };
    const avancar = () => {
      if (ultima) return;
      toque();
      setLinha((l) => Math.min(total - 1, l + 1));
    };
    miolo = (
      <>
        <TopoDaAtividade
          aoFechar={sair}
          meio={
            <Segmentos
              paleta={PALETA}
              total={total}
              atual={linha}
              altura={3}
              rotulo={`Linha ${linha + 1} de ${total}`}
            />
          }
          direita={
            <BotaoRedondo rotulo="Trocar o som de fundo" aoTocar={() => setFolha(true)}>
              {som === "silencio" ? (
                <VolumeX size={20} color={cor.textoApagado} strokeWidth={2.2} />
              ) : (
                <Volume2 size={20} color={cor.texto} strokeWidth={2.2} />
              )}
            </BotaoRedondo>
          }
        />
        <View style={{ flex: 1 }}>
          {/* O gesto dos Stories: o terço esquerdo volta, o resto segue. */}
          <View
            style={[StyleSheet.absoluteFill, { flexDirection: "row" }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Pressable style={{ flex: 1 }} onPress={voltar} />
            <Pressable style={{ flex: 2 }} onPress={avancar} />
          </View>
          <View
            pointerEvents="none"
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: margem.foco + espaco.sm,
            }}
          >
            <LinhaQueTroca chave={`${carta.title}-${linha}`} texto={carta.lines[linha] ?? ""} />
            <Text
              style={{
                marginTop: espaco.xxl,
                textAlign: "center",
                ...fonte.normal,
                ...escala.nota,
                color: cor.textoApagado,
              }}
            >
              Leia em voz alta, no seu ritmo.{"\n"}Toque à esquerda para voltar uma linha.
            </Text>
          </View>
        </View>
        {/* A última linha não é "próxima": é o fim da carta — e vira o botão
            cheio, porque é ali que a leitura termina. */}
        <View style={{ paddingHorizontal: margem.foco, paddingBottom: espaco.md }}>
          <BotaoComAcoes
            aoAnterior={voltar}
            aoProxima={avancar}
            podeVoltar={linha > 0}
            podeSeguir={!ultima}
          >
            <BotaoDaAtividade
              claro={!ultima}
              cor={PALETA.acao}
              rotulo={ultima ? "Terminei de ler" : "Próxima linha"}
              aoTocar={() => {
                if (ultima) void terminar();
                else setLinha((l) => l + 1);
              }}
            />
          </BotaoComAcoes>
        </View>
      </>
    );
  } else if (etapa === "lista") {
    miolo = (
      <>
        <TopoDaAtividade voltar aoFechar={() => setEtapa("intro")} />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: margem.foco, paddingBottom: espaco.xxl }}
        >
          <SobrelinhaDaAtividade paleta={PALETA}>Suas cartas</SobrelinhaDaAtividade>
          <Text
            accessibilityRole="header"
            style={{
              marginTop: 4,
              ...fonte.display,
              ...escala.titulo1,
              letterSpacing: -0.2,
              color: cor.texto,
            }}
          >
            {album.length} {album.length === 1 ? "carta" : "cartas"} nesta fase
          </Text>
          <Text
            style={{
              marginTop: 4,
              ...fonte.normal,
              ...escala.legenda,
              color: cor.textoApagado,
            }}
          >
            Toque numa carta para ler de novo, no seu ritmo.
          </Text>
          <View style={{ marginTop: espaco.xl, gap: espaco.md }}>
            {album.map((c) => {
              const quando = ultimaLeitura(leituras, c.id);
              return (
                <LinhaDaAtividade
                  key={c.id}
                  arte={<Text style={{ fontSize: 24 }}>{c.emoji}</Text>}
                  titulo={c.title}
                  legenda={quando ? `Lida ${haQuantoTempo(quando, new Date())}` : "Ainda não lida"}
                  aoTocar={() => abrirDoAlbum(c)}
                />
              );
            })}
          </View>
        </ScrollView>
      </>
    );
  } else {
    miolo = (
      <>
        <TopoDaAtividade aoFechar={sair} />
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: margem.foco,
            paddingTop: espaco.xs,
            paddingBottom: espaco.xxl,
          }}
        >
          <BolhaComBalao
            lado
            humor="apaixonado"
            fala={falaDaBolhaNaCartaNoApp({
              tela: "intro",
              fraseDeLeitura,
              lendoAsDelas,
              periodo: periodoDaHora(new Date().getHours()),
            })}
          />
          {/* A CARTA, como objeto: o papel claro com o envelope 3D por cima. Era
              um título solto no degradê — e uma carta é algo que se segura. */}
          <Superficie
            tinta={PALETA.acao}
            estilo={{
              marginTop: 60,
              alignItems: "center",
              paddingTop: 50,
              paddingBottom: espaco.xl,
              paddingHorizontal: espaco.xl,
            }}
          >
            <View
              pointerEvents="none"
              style={{ position: "absolute", top: -42, alignItems: "center" }}
            >
              <Brilho tamanho={130} tinta={PALETA.luz} />
              <Image
                source={ARTE_DA_CARTA}
                accessibilityIgnoresInvertColors
                style={{ width: 84, height: 84 }}
              />
            </View>
            <SobrelinhaDaAtividade paleta={PALETA}>
              {lendoAsDelas ? "Escrita por você" : "Carta de hoje"}
            </SobrelinhaDaAtividade>
            <Text
              accessibilityRole="header"
              style={{
                marginTop: 6,
                textAlign: "center",
                ...fonte.display,
                ...escala.titulo1,
                letterSpacing: -0.2,
                color: cor.texto,
              }}
            >
              {carta.title} {carta.emoji}
            </Text>
            <Text
              style={{
                marginTop: espaco.md,
                textAlign: "center",
                ...fonte.normal,
                ...escala.legenda,
                lineHeight: 22,
                color: cor.textoCorpo,
              }}
            >
              {lendoAsDelas ? (
                <>
                  Esta carta é feita das coisas boas que{" "}
                  <Text style={{ ...fonte.forte }}>você mesma anotou</Text> na Gratidão, na ordem em
                  que aconteceram. Leia em voz alta, devagar.
                </>
              ) : (
                <>
                  Ache um lugar calmo, ponha a mão na barriga e leia{" "}
                  <Text style={{ ...fonte.forte }}>em voz alta</Text>, devagar. A sua voz é o som
                  preferido do bebê.
                </>
              )}
            </Text>
          </Superficie>
          <View style={{ marginTop: espaco.xl }}>
            <BotaoDaAtividade cor={PALETA.acao} rotulo="Começar a ler" aoTocar={comecar} />
          </View>
          {/* Só existe com oito ou mais gratidões: uma carta de três linhas seria
              pior que não ter. */}
          {cartaDelas ? (
            <Link
              texto={
                lendoAsDelas
                  ? "Ler a carta de hoje"
                  : `Ler as ${gratidoes?.length ?? 0} coisas boas que você anotou`
              }
              aoTocar={() => {
                setLendoAsDelas((v) => !v);
                setLinha(0);
              }}
            />
          ) : null}
          {/* O álbum: sem ele, cada carta some no dia seguinte. */}
          {!lendoAsDelas ? (
            <Link texto="Ver todas as cartas" aoTocar={() => setEtapa("lista")} />
          ) : null}
        </ScrollView>
      </>
    );
  }

  const comCoracoes = etapa === "leitura" || etapa === "fim";
  return (
    <FundoDaAtividade paleta={PALETA}>
      {comCoracoes ? <CoracoesSubindo dia={dia} parados={folha} /> : null}
      <TrocaDeEtapa chave={etapa}>{miolo}</TrocaDeEtapa>
      <FolhaDeSons
        aberta={folha && etapa === "leitura"}
        som={som}
        cuidado={false}
        paleta={PALETA}
        aoFechar={() => setFolha(false)}
        aoEscolher={(k) => {
          trocarSom(k);
          setFolha(false);
        }}
      />
    </FundoDaAtividade>
  );
}

function Link({ texto, aoTocar }: { texto: string; aoTocar: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        marginTop: espaco.sm,
        alignSelf: "center",
        minHeight: ALVO_MINIMO,
        paddingHorizontal: espaco.md,
        justifyContent: "center",
        opacity: pressed ? 0.55 : 1,
      })}
    >
      <Text style={{ ...fonte.forte, ...escala.legenda, color: PALETA.acao }}>{texto}</Text>
    </Pressable>
  );
}

/**
 * O botão da leitura, com as ações de "anterior" e "próxima" para o leitor de
 * tela (o gesto dos dois lados da tela não existe para quem não a vê).
 */
function BotaoComAcoes({
  aoAnterior,
  aoProxima,
  podeVoltar,
  podeSeguir,
  children,
}: {
  aoAnterior: () => void;
  aoProxima: () => void;
  podeVoltar: boolean;
  podeSeguir: boolean;
  children: ReactNode;
}) {
  return (
    <View
      accessibilityActions={[
        ...(podeVoltar ? [{ name: "anterior", label: "Linha anterior" }] : []),
        ...(podeSeguir ? [{ name: "proxima", label: "Próxima linha" }] : []),
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "anterior") aoAnterior();
        if (e.nativeEvent.actionName === "proxima") aoProxima();
      }}
    >
      {children}
    </View>
  );
}

/**
 * A linha da carta: a velha sai (some e sobe um pouco), e só então a nova
 * entra (aparece e assenta). Antes a velha sumia seca.
 */
function LinhaQueTroca({ texto, chave }: { texto: string; chave: string }) {
  const reduzido = useMovimentoReduzido();
  const [visivel, setVisivel] = useState({ texto, chave });
  const [saindo, setSaindo] = useState(false);
  const v = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  const pedida = useRef({ texto, chave });
  pedida.current = { texto, chave };

  useEffect(() => {
    if (chave === visivel.chave) return;
    if (reduzido) setVisivel({ texto, chave });
    else setSaindo(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  useEffect(() => {
    if (!saindo) return;
    const a = Animated.timing(v, {
      toValue: 0,
      duration: 110,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    a.start(() => {
      setVisivel(pedida.current);
      setSaindo(false);
    });
    return () => a.stop();
  }, [saindo, v]);

  useEffect(() => {
    if (reduzido) {
      v.setValue(1);
      return;
    }
    v.setValue(0);
    const a = Animated.timing(v, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [visivel.chave, reduzido, v]);

  return (
    <Animated.Text
      accessibilityLiveRegion="polite"
      style={{
        maxWidth: 384,
        textAlign: "center",
        ...fonte.display,
        ...escala.titulo1,
        lineHeight: 40,
        fontWeight: "500",
        letterSpacing: -0.2,
        color: cor.texto,
        opacity: v,
        transform: [
          {
            translateY: v.interpolate({
              inputRange: [0, 1],
              outputRange: [saindo ? -8 : 8, 0],
            }),
          },
        ],
      }}
    >
      {visivel.texto}
    </Animated.Text>
  );
}

/**
 * Os corações subindo (`dcHeartRise` do site): cinco, de 💗 💛 🤍, em colunas
 * que mudam com o dia, cada um no seu tempo. Eles sobem algumas vezes e
 * descansam; param com a folha de sons aberta e com o app fora da tela. Com
 * "Reduzir movimento", nenhum.
 */
function CoracoesSubindo({ dia, parados }: { dia: number; parados: boolean }) {
  const reduzido = useMovimentoReduzido();
  const [ativo, setAtivo] = useState(AppState.currentState === "active");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setAtivo(s === "active"));
    return () => sub.remove();
  }, []);
  const { height } = useWindowDimensions();
  const coracoes = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => ({
        esquerda: 8 + ((i * 17 + dia * 7) % 84),
        atraso: ((i * 1.3) % 5) * 1000,
        duracao: (6 + (i % 3) * 2) * 1000,
        emoji: i % 3 === 0 ? "💗" : i % 3 === 1 ? "💛" : "🤍",
        tamanho: i % 2 === 0 ? 24 : 18,
      })),
    [dia],
  );
  if (reduzido) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessible={false}>
      {coracoes.map((c, i) => (
        <Coracao key={i} {...c} subida={height * 0.64} parado={parados || !ativo} />
      ))}
    </View>
  );
}

function Coracao({
  esquerda,
  atraso,
  duracao,
  emoji,
  tamanho,
  subida,
  parado,
}: {
  esquerda: number;
  atraso: number;
  duracao: number;
  emoji: string;
  tamanho: number;
  subida: number;
  parado: boolean;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (parado) return;
    const anim = Animated.sequence([
      Animated.delay(atraso),
      lacoQueDescansa(
        Animated.timing(v, {
          toValue: 1,
          duration: duracao,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    ]);
    anim.start();
    return () => {
      anim.stop();
      v.setValue(0);
    };
  }, [v, atraso, duracao, parado]);
  return (
    <Animated.Text
      style={{
        position: "absolute",
        left: `${esquerda}%`,
        bottom: "6%",
        fontSize: tamanho,
        opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.85, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [30, -subida] }) },
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] }) },
        ],
      }}
    >
      {emoji}
    </Animated.Text>
  );
}
