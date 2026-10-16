import { router, useLocalSearchParams } from "expo-router";
import { Volume2, VolumeX, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
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
  falaDaBolhaNaCarta,
  fraseDeUltimaLeitura,
  poolDeHoje,
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
import { Carregando, T, Tela, toque } from "~/componentes/base";
import {
  BolhaComBalao,
  BotaoDaAtividade,
  Brilho,
  FundoDaAtividade,
  sombraDe,
  Superficie,
  type PaletaDaAtividade,
} from "~/componentes/jornada/atividade";
import { corBebe, corJornada } from "~/componentes/jornada/cores";
import { concluirMomento, FimDoMomento, type Desfecho } from "~/componentes/jornada/fim";
import { FolhaDeSons, type SomEscolhido } from "~/componentes/jornada/folha-de-sons";
import { BarraDoTopo, voltarParaJornada } from "~/componentes/jornada/pecas";
import { useAtividade } from "~/componentes/jornada/usarJornada";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { tocarSomDeFundo, type SomDeFundo } from "~/lib/audio/som-de-fundo";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { cartaDoDiaNoApp } from "~/lib/jornada/cartas";
import { gravarChave, useLoja } from "~/lib/jornada/loja";
import { CHAVE_CARTAS_LIDAS } from "~/lib/jornada/momentos";
import { supabase } from "~/servidor/supabase";
import { ALVO_MINIMO, cor, espaco, fonte } from "~/tema";

/**
 * A CARTA PARA O BEBÊ — o `BondingBlock` do app antigo: ela lê em voz alta,
 * linha a linha, no ritmo dela (só o botão avança — quem para para chorar, ou
 * para repetir o nome do bebê, não perde o lugar), com um som calmo de fundo e
 * corações subindo. No fim, "Beijo entregue".
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

const PALETA: PaletaDaAtividade = {
  fundo: [corBebe.fundoTopo, corBebe.fundoMeio, corBebe.fundoBase],
  forte: corBebe.forte,
  titulo: corBebe.titulo,
  secao: corBebe.secao,
  borda: corBebe.borda,
  vidro: corBebe.vidro,
  discreto: corBebe.discreto,
  brancoSuave: corBebe.brancoSuave,
};

/** O envelope com coração, nas artes 3D do app: a carta é um objeto, e não um texto solto. */
const ARTE_DA_CARTA = require("../../../../src/assets/bebe/carta.webp");

/* As gratidões de exemplo da bancada: o bastante para a carta delas existir. */
const GRATIDOES_DA_BANCADA: Gratidao[] = [
  "O Rafael fez um chá e ficou comigo no sofá.",
  "Ouvi o coração dele no ultrassom.",
  "Consegui dormir a tarde inteira.",
  "Minha mãe veio almoçar.",
  "O enjoo deu uma trégua.",
  "Montamos o berço juntos.",
  "Senti o primeiro chute.",
  "A consulta foi tranquila.",
  "Ganhei um macacãozinho da vizinha.",
  "Caminhei no parque no fim da tarde.",
].map((texto, i) => ({ texto, quando: `2026-0${(i % 9) + 1}-10T12:00:00Z` }));

export default function Bebe() {
  const at = useAtividade("bonding");
  const loja = useLoja();
  const [etapa, setEtapa] = useState<"intro" | "lista" | "leitura" | "fim">("intro");
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
    () => poolDeHoje({ semanas: at.semana, posParto: at.pos }).map((c) => cartaComNome(c, nome)),
    [at.semana, at.pos, nome],
  );
  const cartaDelas = useMemo(
    () => (at.cuidado || !gratidoes ? null : cartaDasGratidoes(gratidoes, { nomeDoBebe: nome })),
    [at.cuidado, gratidoes, nome],
  );
  const cartaAtiva = cartaEscolhida ?? cartaHoje;
  const carta = lendoAsDelas && cartaDelas ? cartaDelas : cartaAtiva;

  /* Vindo do "Ver carta 💌" da Gratidão: abre já na carta das gratidões dela,
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

  /* O ✕ fecha a atividade, de qualquer fase, como no site — sair da leitura
     não pode custar dois toques. */
  function sair() {
    fundo.current?.parar();
    fundo.current = null;
    if (router.canGoBack()) router.back();
    else voltarParaJornada();
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

  if (!at.pronto) {
    return (
      <Tela bordas={["top", "bottom"]}>
        <Carregando />
      </Tela>
    );
  }

  if (at.cuidado || !carta || !cartaHoje) {
    return (
      <Tela bordas={["top", "bottom"]}>
        <BarraDoTopo titulo="Jornada" />
        <T>
          Hoje a jornada é sobre cuidar de você. Respirar, mexer devagar e escrever continuam aqui.
        </T>
        <BotaoDaAtividade cor={corJornada.roxo} rotulo="Voltar" aoTocar={voltarParaJornada} />
      </Tela>
    );
  }

  const dia = at.D ?? 0;

  if (etapa === "fim") {
    return (
      <FundoDaAtividade paleta={PALETA}>
        <CoracoesSubindo dia={dia} />
        <ScrollView
          contentContainerStyle={{ padding: espaco.lg, paddingBottom: 120, gap: espaco.md }}
        >
          <FimDoMomento
            titulo="Beijo entregue"
            fala="Ele ouviu a sua voz — e, do jeitinho dele, guardou cada palavra. 💛"
            desfecho={desfecho}
            D={at.D}
            cuidado={false}
            pos={at.pos}
            /* O fim do site: o 💋 grande, o confete a cada carta e a bolha
               acompanhando ("Guardei esse minuto com você") — ela é o
               acompanhamento, não o clímax. */
            arte={
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                <Brilho tamanho={200} />
                <Image
                  source={ARTE_DA_CARTA}
                  accessibilityIgnoresInvertColors
                  style={{ width: 128, height: 128 }}
                />
              </View>
            }
            confete
            balao={falaDaBolhaNaCarta({ tela: "done" })}
          />
        </ScrollView>
      </FundoDaAtividade>
    );
  }

  if (etapa === "leitura") {
    const ultima = linha >= carta.lines.length - 1;
    return (
      <FundoDaAtividade paleta={PALETA}>
        <CoracoesSubindo dia={dia} />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: espaco.lg,
            paddingVertical: espaco.sm,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            onPress={sair}
            style={({ pressed }) => ({
              width: ALVO_MINIMO,
              height: ALVO_MINIMO,
              marginLeft: -espaco.sm,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <X size={24} color={corBebe.fechar} />
          </Pressable>
          <View
            accessibilityLabel={`Linha ${linha + 1} de ${carta.lines.length}`}
            style={{
              flex: 1,
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 4,
            }}
          >
            {/* As que faltam ficam cinza, como no site (lá, `grayscale`; aqui, o
                coração branco apagado, que é o que o filtro desenhava). */}
            {carta.lines.map((_, i) => (
              <Text key={i} style={{ fontSize: 14, opacity: i <= linha ? 1 : 0.55 }}>
                {i <= linha ? "💗" : "🤍"}
              </Text>
            ))}
          </View>
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
              marginRight: -espaco.xs,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: cor.branco,
                alignItems: "center",
                justifyContent: "center",
                ...sombraDe(corBebe.forte, 0.6),
              }}
            >
              {som === "silencio" ? (
                <VolumeX size={18} color={corBebe.secao} strokeWidth={2.3} />
              ) : (
                <Volume2 size={18} color={corBebe.forte} strokeWidth={2.3} />
              )}
            </View>
          </Pressable>
        </View>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: espaco.xxl,
          }}
        >
          <LinhaQueEntra key={`${carta.title}-${linha}`} texto={carta.lines[linha] ?? ""} />
          <Text
            style={{
              marginTop: espaco.xxl,
              fontFamily: fonte.media,
              fontSize: 13,
              letterSpacing: 0.65,
              textTransform: "uppercase",
              color: corBebe.leiaEmVoz,
            }}
          >
            leia em voz alta, no seu ritmo
          </Text>
          {/* A última linha não é "próxima": é o fim da carta — e vira o botão
              cheio, porque é ali que a leitura termina. */}
          <View style={{ marginTop: espaco.lg, width: "100%", maxWidth: 300 }}>
            <BotaoDaAtividade
              claro={!ultima}
              cor={corBebe.forte}
              rotulo={ultima ? "Terminei de ler 💛" : "Próxima linha"}
              aoTocar={() => {
                if (ultima) void terminar();
                else setLinha((l) => l + 1);
              }}
            />
          </View>
        </View>
        <FolhaDeSons
          aberta={folha}
          som={som}
          cuidado={false}
          paleta={PALETA}
          veu={corBebe.veu}
          tinta={corBebe.link}
          aoFechar={() => setFolha(false)}
          aoEscolher={(k) => {
            trocarSom(k);
            setFolha(false);
          }}
        />
      </FundoDaAtividade>
    );
  }

  if (etapa === "lista") {
    return (
      <FundoDaAtividade paleta={PALETA}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: espaco.xl, paddingBottom: espaco.xxl }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => setEtapa("intro")}
            style={{ alignSelf: "flex-start", minHeight: ALVO_MINIMO, justifyContent: "center" }}
          >
            <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: corBebe.link }}>
              ‹ Voltar
            </Text>
          </Pressable>
          <View style={{ alignItems: "center" }}>
            <Text style={estilos.rotulo}>Suas cartas</Text>
            <Text
              accessibilityRole="header"
              style={{
                marginTop: 4,
                fontFamily: fonte.titulo,
                fontSize: 24,
                lineHeight: 30,
                letterSpacing: -0.24,
                color: corBebe.titulo,
              }}
            >
              {album.length} {album.length === 1 ? "carta" : "cartas"} nesta fase
            </Text>
            <Text
              style={{
                marginTop: 4,
                maxWidth: 320,
                textAlign: "center",
                fontFamily: fonte.normal,
                fontSize: 13,
                lineHeight: 18,
                color: corBebe.discreto,
              }}
            >
              Toque numa carta pra ler de novo, no seu ritmo. 💛
            </Text>
          </View>
          <View style={{ marginTop: 20, gap: espaco.md }}>
            {album.map((c) => {
              const quando = ultimaLeitura(leituras, c.id);
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  onPress={() => {
                    toque();
                    abrirDoAlbum(c);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: espaco.md,
                    minHeight: ALVO_MINIMO + 16,
                    paddingHorizontal: espaco.lg,
                    paddingVertical: espaco.md,
                    borderRadius: 20,
                    backgroundColor: cor.branco,
                    opacity: pressed ? 0.8 : 1,
                    ...sombraDe(corBebe.forte, 0.7),
                  })}
                >
                  <Text style={{ fontSize: 24 }}>{c.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: fonte.forte,
                        fontSize: 14,
                        lineHeight: 19,
                        color: corBebe.titulo,
                      }}
                    >
                      {c.title}
                    </Text>
                    <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: corBebe.lida }}>
                      {quando ? `Lida ${haQuantoTempo(quando, new Date())}` : "Ainda não lida"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </FundoDaAtividade>
    );
  }

  return (
    <FundoDaAtividade paleta={PALETA}>
      <View style={{ paddingHorizontal: espaco.lg }}>
        <BarraDoTopo />
      </View>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: espaco.xxl,
          paddingBottom: espaco.xxl,
        }}
      >
        <BolhaComBalao
          humor="apaixonado"
          paleta={PALETA}
          fala={falaDaBolhaNaCarta({
            tela: "intro",
            fraseDeLeitura,
            lendoAsDelas,
            periodo: periodoDaHora(new Date().getHours()),
          })}
        />
        {/* A CARTA, como objeto: o papel branco com o envelope 3D por cima. Era
            um título solto no degradê — e uma carta é algo que se segura. */}
        <Superficie
          tinta={corBebe.forte}
          estilo={{
            marginTop: 52,
            width: "100%",
            maxWidth: 360,
            alignItems: "center",
            paddingTop: 50,
            paddingBottom: espaco.xl,
            paddingHorizontal: espaco.xl,
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -42,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image
              source={ARTE_DA_CARTA}
              accessibilityIgnoresInvertColors
              style={{ width: 84, height: 84 }}
            />
          </View>
          <Text style={estilos.rotulo}>{lendoAsDelas ? "Escrita por você" : "Carta de hoje"}</Text>
          <Text
            accessibilityRole="header"
            style={{
              marginTop: 4,
              textAlign: "center",
              fontFamily: fonte.titulo,
              fontSize: 28,
              lineHeight: 34,
              letterSpacing: -0.3,
              color: corBebe.titulo,
            }}
          >
            {carta.title} {carta.emoji}
          </Text>
          <Text
            style={{
              marginTop: espaco.md,
              textAlign: "center",
              fontFamily: fonte.normal,
              fontSize: 15,
              lineHeight: 23,
              color: corBebe.texto,
            }}
          >
            {lendoAsDelas ? (
              <>
                Esta carta é feita das coisas boas que{" "}
                <Text style={{ fontFamily: fonte.titulo }}>você mesma anotou</Text> na Gratidão, na
                ordem em que aconteceram. Leia em voz alta, devagar. 💛
              </>
            ) : (
              <>
                Encontre um lugar calmo, mão na barriga… e leia{" "}
                <Text style={{ fontFamily: fonte.titulo }}>em voz alta</Text>, devagar. A sua voz é
                o som preferido do bebê. 💛
              </>
            )}
          </Text>
        </Superficie>
        <View style={{ marginTop: espaco.xl, width: "100%", maxWidth: 360 }}>
          <BotaoDaAtividade cor={corBebe.forte} rotulo="Começar a ler 💗" aoTocar={comecar} />
        </View>
        {/* Só existe com oito ou mais gratidões: uma carta de três linhas seria
            pior que não ter. */}
        {cartaDelas ? (
          <Link
            texto={
              lendoAsDelas
                ? "Ler a carta de hoje 💌"
                : `Ler as ${gratidoes?.length ?? 0} coisas boas que você anotou ✨`
            }
            aoTocar={() => {
              setLendoAsDelas((v) => !v);
              setLinha(0);
            }}
          />
        ) : null}
        {/* O álbum: sem ele, cada carta some no dia seguinte. */}
        {!lendoAsDelas ? (
          <Link texto="📖 Ver todas as cartas" aoTocar={() => setEtapa("lista")} />
        ) : null}
      </ScrollView>
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
        minHeight: ALVO_MINIMO,
        justifyContent: "center",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: fonte.forte,
          fontSize: 13,
          color: corBebe.link,
          textDecorationLine: "underline",
          textDecorationColor: corBebe.sublinhado,
        }}
      >
        {texto}
      </Text>
    </Pressable>
  );
}

/** A linha da carta entra deslizando de leve (o `dc-q-slide` do site). */
function LinhaQueEntra({ texto }: { texto: string }) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  useEffect(() => {
    if (reduzido) return;
    Animated.timing(v, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, reduzido]);
  return (
    <Animated.Text
      accessibilityLiveRegion="polite"
      style={{
        maxWidth: 384,
        textAlign: "center",
        fontFamily: fonte.media,
        fontSize: 26,
        lineHeight: 42,
        color: corBebe.titulo,
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}
    >
      {texto}
    </Animated.Text>
  );
}

/**
 * Os corações subindo (`dcHeartRise` do site): sete, de 💗 💛 🤍, em colunas
 * que mudam com o dia, cada um no seu tempo. Com "Reduzir movimento", nenhum.
 */
function CoracoesSubindo({ dia }: { dia: number }) {
  const reduzido = useMovimentoReduzido();
  const { height } = useWindowDimensions();
  const coracoes = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        esquerda: 8 + ((i * 13 + dia * 7) % 84),
        atraso: ((i * 1.3) % 6) * 1000,
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
        <Coracao key={i} {...c} subida={height * 0.64} />
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
}: {
  esquerda: number;
  atraso: number;
  duracao: number;
  emoji: string;
  tamanho: number;
  subida: number;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.sequence([
      Animated.delay(atraso),
      Animated.loop(
        Animated.timing(v, {
          toValue: 1,
          duration: duracao,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    ]);
    anim.start();
    return () => anim.stop();
  }, [v, atraso, duracao]);
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

const estilos = StyleSheet.create({
  rotulo: {
    fontFamily: fonte.forte,
    fontSize: 13,
    letterSpacing: 2.3,
    textTransform: "uppercase",
    color: corBebe.rotulo,
  },
});
