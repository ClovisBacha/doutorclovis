import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Botao, selecao, toque } from "~/componentes/base";
import {
  VitrineDaAula,
  VitrineDaBolha,
  VitrineDasAmigas,
  VitrineDaTrilha,
  VitrineDoFim,
} from "~/componentes/boas-vindas";
import {
  CHAVE_JA_ENTROU,
  ColunaDaEntrada,
  ErroNoVeu,
  FundoDaEntrada,
  LinkNoVeu,
  marcarQueJaEntrou,
  TextoNoVeu,
  TituloNoVeu,
} from "~/componentes/entrada";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { Vidro } from "~/componentes/vidro";
import { appleDisponivel, entrarComApple } from "~/lib/apple";
import { lerJson } from "~/lib/armazem";
import { parametroDaBancada } from "~/lib/bancada";
import { cor, escala, espaco, fonte } from "~/tema";

/**
 * AS BOAS-VINDAS (17/11/2026, o dono: "um caminho que nem a gente está
 * fazendo do Marca Ponto, de slides para você entrar no aplicativo").
 *
 * Como no Marca Ponto: o produto ANTES de pedir qualquer coisa. Cinco slides
 * que deslizam com o dedo (ou com "Continuar"), sobre o céu vivo da hora. A
 * vitrine anda mais devagar que o slide (a profundidade das apresentações da
 * Apple); com "reduzir movimento", ela só esmaece.
 *
 *   0. a bolha e o nome — "Começar" ou "Já tenho conta";
 *   1. a aula do dia · 2. a trilha que vira jogo · 3. as amigas;
 *   4. a conta: Apple, e-mail, ou "já tenho conta".
 *
 * Quem já entrou neste aparelho (`CHAVE_JA_ENTROU`) abre direto no último
 * slide, no modo "que bom te ver de novo" — sem refazer a apresentação.
 *
 * ⚠️ Nenhum slide fala do bebê (a entrada não sabe se quem abre está no Modo
 * Cuidado). Na bancada, `&passo=` abre num slide e `&voltou=1` no modo de
 * quem volta.
 */

const TOTAL = 5;
const FIM = TOTAL - 1;

type Modo = "nova" | "voltou";

export default function BoasVindas() {
  const { width, height } = useWindowDimensions();
  const fora = useSafeAreaInsets();
  const reduzido = useMovimentoReduzido();
  const x = useRef(new Animated.Value(0)).current;
  const lista = useRef<ScrollView>(null);
  const [pagina, setPagina] = useState(0);
  /* Onde a lista começa (lido uma vez): o `contentOffset` não pode seguir a
     página a cada troca, senão o "Continuar" pularia sem deslizar. */
  const inicio = useRef(0);
  /* `null` enquanto lê se este aparelho já entrou (uma leitura local, rápida):
     sem isso, quem volta veria o primeiro slide piscar antes do último. */
  const [modo, setModo] = useState<Modo | null>(null);
  /* No iPhone a Apple está sempre lá (iOS 13 ou mais): o botão nasce no lugar
     e só sai se a resposta for não. Começar sem ele empurrava o resto da tela
     uns 70 pt para baixo no meio da entrada. */
  const [comApple, setComApple] = useState(Platform.OS === "ios");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void appleDisponivel().then((ok) => {
      if (!ok) setComApple(false);
    });
    let vivo = true;
    void lerJson(CHAVE_JA_ENTROU, false).then((ja) => {
      if (!vivo) return;
      const voltou = ja === true || parametroDaBancada("voltou") === "1";
      const passo = Number(parametroDaBancada("passo") ?? (voltou ? FIM : 0));
      inicio.current = Number.isFinite(passo) ? Math.max(0, Math.min(FIM, passo)) : 0;
      setModo(voltou ? "voltou" : "nova");
      setPagina(inicio.current);
      x.setValue(inicio.current * width);
    });
    return () => {
      vivo = false;
    };
    // A leitura é uma vez só, ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* A web (a bancada) não conhece `contentOffset`: lá a lista vai ao slide
     pedido depois de montar. No iPhone é a mesma posição, sem efeito. */
  const pronto = modo !== null;
  useEffect(() => {
    if (!pronto || !inicio.current) return;
    const id = requestAnimationFrame(() =>
      lista.current?.scrollTo({ x: inicio.current * width, animated: false }),
    );
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto]);

  function ir(n: number) {
    const alvo = Math.max(0, Math.min(FIM, n));
    setPagina(alvo);
    lista.current?.scrollTo({ x: alvo * width, animated: !reduzido });
  }

  function aoParar(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const nova = Math.round(e.nativeEvent.contentOffset.x / width);
    if (nova !== pagina) selecao();
    setPagina(nova);
  }

  async function apple() {
    setErro(null);
    const r = await entrarComApple();
    if (r.ok) {
      marcarQueJaEntrou();
      router.replace("/");
    } else if (!r.cancelado) setErro(r.mensagem);
  }

  if (modo === null) return <FundoDaEntrada>{null}</FundoDaEntrada>;

  const voltou = modo === "voltou";
  const slides: { vitrine: ReactNode; titulo: string; texto: string; acoes: ReactNode }[] = [
    {
      vitrine: <VitrineDaBolha largura={width} />,
      titulo: "Mãe Esperta",
      texto: "Aprenda sobre a sua gravidez jogando.",
      acoes: (
        <>
          <Botao rotulo="Começar" aoTocar={() => ir(1)} estilo={{ minHeight: 56 }} />
          <LinkNoVeu
            rotulo="Já tenho conta"
            aoTocar={() => {
              setModo("voltou");
              ir(FIM);
            }}
          />
        </>
      ),
    },
    {
      vitrine: <VitrineDaAula largura={width} />,
      titulo: "Uma aula de 2 minutos por dia",
      texto: "Perguntas rápidas sobre a semana em que você está. Cada acerto vale sementinhas.",
      acoes: <Botao rotulo="Continuar" aoTocar={() => ir(2)} estilo={{ minHeight: 56 }} />,
    },
    {
      vitrine: <VitrineDaTrilha largura={width} />,
      titulo: "Cada dia é um passo na trilha",
      texto: "Faça a aula e ganhe estrelas. Volte amanhã e a chama cresce.",
      acoes: <Botao rotulo="Continuar" aoTocar={() => ir(3)} estilo={{ minHeight: 56 }} />,
    },
    {
      vitrine: <VitrineDasAmigas largura={width} />,
      titulo: "Jogue junto com uma amiga",
      texto: "Formem uma dupla. Quando as duas fecham o dia, cada uma ganha sementinhas.",
      acoes: <Botao rotulo="Continuar" aoTocar={() => ir(4)} estilo={{ minHeight: 56 }} />,
    },
    {
      vitrine: <VitrineDoFim largura={width} ativa={pagina === FIM} />,
      titulo: voltou ? "Que bom te ver de novo" : "Crie a sua conta",
      texto: voltou
        ? "Entre e continue a trilha de onde parou."
        : "Leva um minuto. Depois, é só dizer em que semana você está.",
      acoes: (
        <>
          {erro ? <ErroNoVeu>{erro}</ErroNoVeu> : null}
          {/* A Apple pede o botão dela com o mesmo destaque das outras formas
              de entrar: ele vem primeiro, do mesmo tamanho. */}
          {comApple ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={
                voltou
                  ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                  : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
              }
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={28}
              style={{ height: 56 }}
              onPress={apple}
            />
          ) : null}
          {voltou ? (
            <>
              <Botao
                rotulo="Entrar com e-mail"
                aoTocar={() => router.push("/email")}
                estilo={{ minHeight: 56 }}
              />
              <LinkNoVeu rotulo="Criar uma conta" aoTocar={() => router.push("/cadastro")} />
            </>
          ) : (
            <>
              <Botao
                rotulo={comApple ? "Criar conta com e-mail" : "Criar minha conta"}
                aoTocar={() => router.push("/cadastro")}
                estilo={{ minHeight: 56 }}
              />
              <LinkNoVeu rotulo="Já tenho conta" aoTocar={() => setModo("voltou")} />
            </>
          )}
        </>
      ),
    },
  ];

  return (
    <FundoDaEntrada>
      <Animated.ScrollView
        ref={lista as never}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentOffset={{ x: inicio.current * width, y: 0 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x } } }], {
          useNativeDriver: true,
        })}
        onMomentumScrollEnd={aoParar}
      >
        {slides.map((s, i) => {
          const perto = [(i - 1) * width, i * width, (i + 1) * width];
          return (
            <View
              key={i}
              /* O leitor de tela lê só o slide à vista. */
              accessibilityElementsHidden={pagina !== i}
              importantForAccessibility={pagina === i ? "auto" : "no-hide-descendants"}
              /* A altura é a da tela: a lista deitada não estica os filhos na
                 altura, e o pé (título, texto, botões) ficava no meio. */
              style={{
                width,
                height,
                paddingTop: fora.top + 64,
                paddingBottom: fora.bottom + espaco.md,
              }}
            >
              {/* A vitrine anda mais devagar que o slide e encolhe ao sair: a
                  profundidade das telas de apresentação da Apple. */}
              <Animated.View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  opacity: x.interpolate({
                    inputRange: perto,
                    outputRange: [0, 1, 0],
                    extrapolate: "clamp",
                  }),
                  transform: reduzido
                    ? []
                    : [
                        {
                          translateX: x.interpolate({
                            inputRange: perto,
                            outputRange: [-width * 0.35, 0, width * 0.35],
                            extrapolate: "clamp",
                          }),
                        },
                        {
                          scale: x.interpolate({
                            inputRange: perto,
                            outputRange: [0.86, 1, 0.86],
                            extrapolate: "clamp",
                          }),
                        },
                      ],
                }}
              >
                {s.vitrine}
              </Animated.View>
              <ColunaDaEntrada estilo={{ paddingHorizontal: espaco.xl, gap: espaco.sm }}>
                <TituloNoVeu centro nivel={i === 0 ? "grande" : "titulo1"}>
                  {s.titulo}
                </TituloNoVeu>
                <TextoNoVeu centro>{s.texto}</TextoNoVeu>
                <View style={{ gap: espaco.sm, marginTop: espaco.lg }}>{s.acoes}</View>
              </ColunaDaEntrada>
            </View>
          );
        })}
      </Animated.ScrollView>
      <BarraDoAlto x={x} largura={width} topo={fora.top} pagina={pagina} aoPular={() => ir(FIM)} />
    </FundoDaEntrada>
  );
}

/**
 * O alto dos slides 1 a 4: os tracinhos do progresso (cada um enche enquanto
 * o dedo arrasta) e o "Pular", de vidro (ele flutua sobre o céu, que de manhã
 * é claro). Some no slide 0, onde só há a bolha e o nome.
 */
function BarraDoAlto({
  x,
  largura,
  topo,
  pagina,
  aoPular,
}: {
  x: Animated.Value;
  largura: number;
  topo: number;
  pagina: number;
  aoPular: () => void;
}) {
  const pular = pagina >= 1 && pagina < FIM;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: topo + espaco.sm,
        left: espaco.lg,
        right: espaco.lg,
        height: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        opacity: x.interpolate({
          inputRange: [0, largura * 0.7],
          outputRange: [0, 1],
          extrapolate: "clamp",
        }),
      }}
    >
      <View
        accessible
        accessibilityLabel={`Passo ${Math.max(1, pagina)} de ${FIM}`}
        style={{ flex: 1, flexDirection: "row", gap: 6 }}
      >
        {Array.from({ length: FIM }, (_, k) => (
          <View
            key={k}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              overflow: "hidden",
              backgroundColor: "rgba(255,255,255,0.24)",
            }}
          >
            <Animated.View
              style={{
                height: "100%",
                width: "100%",
                borderRadius: 2,
                backgroundColor: cor.branco,
                transform: [
                  {
                    translateX: x.interpolate({
                      inputRange: [k * largura, (k + 1) * largura],
                      outputRange: [-largura, 0],
                      extrapolate: "clamp",
                    }),
                  },
                ],
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ width: 84, alignItems: "flex-end" }} pointerEvents={pular ? "auto" : "none"}>
        <Animated.View
          style={{
            opacity: x.interpolate({
              inputRange: [largura * 0.5, largura, largura * 3, largura * 3.5],
              outputRange: [0, 1, 1, 0],
              extrapolate: "clamp",
            }),
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pular a apresentação"
            onPress={() => {
              toque();
              aoPular();
            }}
            hitSlop={6}
          >
            <Vidro
              interativo
              estilo={{ minHeight: 44, paddingHorizontal: 18, justifyContent: "center" }}
            >
              <Text style={{ ...fonte.forte, ...escala.legenda, color: cor.texto }}>Pular</Text>
            </Vidro>
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
