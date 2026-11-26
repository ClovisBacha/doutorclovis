import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import AlertCircle from "lucide-react-native/icons/circle-alert";
import Check from "lucide-react-native/icons/check";
import Info from "lucide-react-native/icons/info";
import X from "lucide-react-native/icons/x";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Botao, Sobrelinha, sucesso, toque } from "~/componentes/base";
import { CartaoDoPlano, EsqueletoDosPlanos } from "~/componentes/assinatura/cartao-do-plano";
import {
  ColunaDaEntrada,
  FundoDaEntrada,
  LinkNoVeu,
  TextoNoVeu,
  TituloNoVeu,
} from "~/componentes/entrada";
import { Vidro } from "~/componentes/vidro";
import { rota } from "~/componentes/jornada/bancada";
import { BolhaViva, useMovimentoReduzido } from "~/componentes/movimento";
import { ehBancada } from "~/lib/bancada";
import { produtosDaBancada } from "~/lib/assinatura/bancada";
import {
  FRASE_ESPERANDO_APROVACAO,
  FRASE_NADA_A_RESTAURAR,
  fraseDoErro,
} from "~/lib/assinatura/erros";
import {
  GERENCIAR_ASSINATURAS,
  itensDoPlano,
  subtituloDaVenda,
  tituloDaVenda,
  type Plano,
} from "~/lib/assinatura/plano";
import {
  emOrdem,
  faixaDoAnual,
  letraPequena,
  planoPadrao,
  textoDoBotao,
  type ProdutoDaLoja,
} from "~/lib/assinatura/precos";
import { guardarDireito, usePlano } from "~/lib/assinatura/usar-plano";
import { primeiroNome } from "~/lib/gestacao";
import { abrir } from "~/lib/links";
import { useSessao } from "~/lib/sessao";
import { ALVO_MINIMO, canto, cor, curva, escala, espaco, fonte, margem, raio, veu } from "~/tema";

/**
 * A TELA DE VENDA DO PLANO COMPLETO (20/11/2026).
 *
 * A referência do dono era a de um app de enxoval (foto do iPhone no alto,
 * título serifado com o nome do bebê, dois planos, um botão dourado). Aqui é
 * o nosso desenho: o céu da entrada com o véu (a mesma noite do funil que vem
 * antes), a Bolha flutuando no alto com profundidade (anda mais devagar que a
 * rolagem e estica ao puxar), os três planos como material — o escolhido
 * acende —, e o botão grande na cor de agir.
 *
 * ⚠️ O QUE NÃO ENTRA, de propósito (Apple 2.3.1, 3.1.2, 5.6; CDC):
 * - preço escrito à mão: todo preço é o do StoreKit (`ProdutoDaLoja`);
 * - número de usuárias, nota, avaliações ou depoimentos (o app não os tem);
 * - contagem regressiva, "só hoje", "últimas vagas";
 * - promessa de efeito de saúde.
 * A renovação automática, o preço e como cancelar ficam à vista ANTES do
 * botão (a letra pequena, no pé fixo). "Restaurar compras", Termos e
 * Privacidade no rodapé; "Agora não" sempre à mão.
 *
 * O contrato com quem abre (o funil, um portão, o Perfil):
 * `router.replace({ pathname: "/assinatura", params: { depois, origem } })`.
 * Fechar ou comprar → `router.replace(depois)`; sem `depois`, volta.
 */

type Aviso = { tipo: "erro" | "info"; texto: string } | null;
type Fim = "comprou" | "restaurou" | "esperando" | null;

/** Quanto a tela espera a App Store devolver os planos. */
const TETO_DOS_PRODUTOS_MS = 15_000;

/** Quanto tempo a festa da compra fica antes de seguir sozinha. */
const FESTA_MS = 2400;

export function TelaDaAssinatura({ aoSair }: { aoSair: () => void }) {
  const { perfil } = useSessao();
  const plano = usePlano();
  const fora = useSafeAreaInsets();
  const reduzido = useMovimentoReduzido();
  const rolagem = useRef(new Animated.Value(0)).current;

  const [produtos, setProdutos] = useState<ProdutoDaLoja[] | null>(null);
  const [escolhido, setEscolhido] = useState<Plano | null>(null);
  const [acao, setAcao] = useState<"parado" | "comprando" | "restaurando">("parado");
  const [aviso, setAviso] = useState<Aviso>(null);
  const [fim, setFim] = useState<Fim>(null);

  const nomeDoBebe = perfil?.care_mode ? null : (perfil?.baby_name ?? null);
  const nomeDela = primeiroNome(perfil?.display_name ?? perfil?.full_name ?? null);

  /* Os produtos: da Apple, ou os de exemplo da bancada. */
  const carregar = useCallback(async () => {
    setProdutos(null);
    setAviso(null);
    const lista = ehBancada()
      ? produtosDaBancada()
      : await Promise.race([
          import("~/lib/assinatura/loja")
            .then((m) => m.buscarProdutos())
            .catch((): ProdutoDaLoja[] => []),
          /* A App Store que não responde não prende o esqueleto: vira a frase
             calma de "os planos não carregaram", com o tentar de novo. */
          new Promise<ProdutoDaLoja[]>((r) => setTimeout(() => r([]), TETO_DOS_PRODUTOS_MS)),
        ]);
    if (lista == null) return; /* a bancada parada no esqueleto */
    const ordem = emOrdem(lista);
    setProdutos(ordem);
    setEscolhido((atual) =>
      atual && ordem.some((p) => p.plano === atual) ? atual : planoPadrao(ordem),
    );
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);

  /* Comprou (ou restaurou): a festa, e segue sozinha para o destino. */
  useEffect(() => {
    if (fim !== "comprou" && fim !== "restaurou") return;
    const t = setTimeout(aoSair, FESTA_MS);
    return () => clearTimeout(t);
  }, [fim, aoSair]);

  const produto = produtos?.find((p) => p.plano === escolhido) ?? null;

  async function comprar() {
    if (!produto || acao !== "parado") return;
    setAviso(null);
    setAcao("comprando");
    try {
      if (ehBancada()) {
        await new Promise((r) => setTimeout(r, 600));
        guardarDireito(true);
        sucesso();
        setFim("comprou");
        return;
      }
      const loja = await import("~/lib/assinatura/loja");
      const r = await loja.comprar(produto.plano);
      if (r.tipo === "comprou") {
        guardarDireito(true);
        sucesso();
        setFim("comprou");
      } else if (r.tipo === "esperando") setFim("esperando");
      else if (r.tipo === "erro") setAviso({ tipo: "erro", texto: r.frase });
      /* cancelou: ela só mudou de ideia; a tela fica como estava. */
    } catch {
      setAviso({ tipo: "erro", texto: fraseDoErro(null) ?? "" });
    } finally {
      setAcao("parado");
    }
  }

  async function restaurar() {
    if (acao !== "parado") return;
    setAviso(null);
    setAcao("restaurando");
    try {
      if (ehBancada()) {
        await new Promise((r) => setTimeout(r, 600));
        setAviso({ tipo: "info", texto: FRASE_NADA_A_RESTAURAR });
        return;
      }
      const loja = await import("~/lib/assinatura/loja");
      const r = await loja.restaurar();
      if (r.tipo === "restaurou") {
        guardarDireito(true);
        sucesso();
        setFim("restaurou");
      } else if (r.tipo === "nada") setAviso({ tipo: "info", texto: FRASE_NADA_A_RESTAURAR });
      else setAviso({ tipo: "erro", texto: r.frase });
    } catch {
      setAviso({ tipo: "erro", texto: fraseDoErro(null) ?? "" });
    } finally {
      setAcao("parado");
    }
  }

  const gerenciar = () => abrir(GERENCIAR_ASSINATURAS);

  /* O que a tela mostra: a festa, a espera da aprovação, "já é seu" ou a venda. */
  const estado: "venda" | "ja-tem" | "festa" | "esperando" =
    fim === "comprou" || fim === "restaurou"
      ? "festa"
      : fim === "esperando"
        ? "esperando"
        : plano.conhecido && plano.temPlano
          ? "ja-tem"
          : "venda";

  /* A profundidade: a Bolha sobe mais devagar que o texto e some; puxando
     para baixo, ela cresce. Com "reduzir movimento", parada. */
  const hero = reduzido
    ? null
    : {
        opacity: rolagem.interpolate({
          inputRange: [0, 240],
          outputRange: [1, 0],
          extrapolate: "clamp",
        }),
        transform: [
          {
            translateY: rolagem.interpolate({
              inputRange: [-200, 0, 400],
              outputRange: [-60, 0, 180],
              extrapolateRight: "clamp",
            }),
          },
          {
            scale: rolagem.interpolate({
              inputRange: [-200, 0],
              outputRange: [1.3, 1],
              extrapolate: "clamp",
            }),
          },
        ],
      };

  const pe =
    estado === "venda" ? (
      <>
        {aviso ? <AvisoNoVeu aviso={aviso} /> : null}
        {produto ? (
          <TextoNoVeu centro nivel="nota" estilo={{ minHeight: 54 }}>
            {letraPequena(produto)}
          </TextoNoVeu>
        ) : null}
        {/* Sem os planos da Apple não há botão de comprar: só a frase calma lá
          em cima e o "Agora não". */}
        {produtos != null && produtos.length === 0 ? null : (
          <Botao
            rotulo={
              produtos == null
                ? "Carregando os planos…"
                : escolhido
                  ? textoDoBotao(escolhido)
                  : "Escolha um plano"
            }
            tamanho="grande"
            carregando={acao === "comprando"}
            desabilitado={!produto || acao === "restaurando"}
            aoTocar={() => void comprar()}
          />
        )}
        <LinkNoVeu rotulo="Agora não" apagado aoTocar={aoSair} />
      </>
    ) : (
      <Botao rotulo="Continuar" tamanho="grande" aoTocar={aoSair} />
    );

  return (
    <FundoDaEntrada veu="inteiro">
      <Animated.ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: rolagem } } }], {
          useNativeDriver: Platform.OS !== "web",
        })}
        contentContainerStyle={{
          flexGrow: 1,
          width: "100%",
          maxWidth: 480 + margem.foco * 2,
          alignSelf: "center",
          paddingHorizontal: margem.foco,
          paddingTop: fora.top + espaco.xl,
          paddingBottom: espaco.xl,
          gap: espaco.lg + 4,
        }}
      >
        {estado === "venda" ? (
          <>
            <Animated.View style={[{ alignItems: "center" }, hero]}>
              <BolhaViva humor="apaixonado" tamanho={124} />
            </Animated.View>
            <Cabeca
              sobre="Plano completo"
              titulo={tituloDaVenda(nomeDoBebe)}
              texto={subtituloDaVenda(nomeDela)}
            />
            <OQueTraz itens={itensDoPlano(nomeDoBebe)} />
            <View accessibilityRole="radiogroup" style={{ gap: espaco.md }}>
              {produtos == null ? (
                <EsqueletoDosPlanos />
              ) : produtos.length === 0 ? (
                <SemPlanos aoTentar={() => void carregar()} />
              ) : (
                produtos.map((p) => (
                  <CartaoDoPlano
                    key={p.plano}
                    produto={p}
                    marcado={p.plano === escolhido}
                    faixa={p.plano === "anual" ? faixaDoAnual(produtos) : null}
                    aoEscolher={() => {
                      setAviso(null);
                      setEscolhido(p.plano);
                    }}
                  />
                ))
              )}
            </View>
          </>
        ) : (
          /* A festa, a espera e o "já é seu": no meio da tela, com a Bolha
             comemorando (ou esperando junto). */
          <View style={{ flex: 1, justifyContent: "center", gap: espaco.xl }}>
            <View style={{ alignItems: "center" }}>
              <BolhaViva humor={estado === "esperando" ? "feliz" : "comemorando"} tamanho={168} />
            </View>
            {estado === "esperando" ? (
              <Cabeca
                sobre="Quase lá"
                titulo="A compra está esperando aprovação"
                texto={FRASE_ESPERANDO_APROVACAO}
              />
            ) : estado === "festa" ? (
              <Cabeca
                sobre="Plano completo"
                titulo="Pronto, está tudo liberado"
                texto={
                  nomeDela
                    ? `${nomeDela}, o plano completo é seu. A Bolha já está esperando por você.`
                    : "O plano completo é seu. A Bolha já está esperando por você."
                }
              />
            ) : (
              <Cabeca
                sobre="Plano completo"
                titulo="O plano completo já é seu"
                texto="Está tudo liberado neste iPhone. Para trocar de plano ou cancelar, toque em Gerenciar assinatura."
              />
            )}
          </View>
        )}

        <Rodape
          restaurando={acao === "restaurando"}
          aoRestaurar={estado === "venda" ? () => void restaurar() : undefined}
          aoGerenciar={gerenciar}
        />
      </Animated.ScrollView>

      {/* O alto parado: o que rola some de leve embaixo do voltar de vidro. */}
      <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
        <LinearGradient
          pointerEvents="none"
          colors={[veu.tinta(0.85), veu.tinta(0)]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: fora.top + 64 }}
        />
        <View style={{ paddingTop: fora.top + espaco.sm, paddingHorizontal: margem.foco }}>
          <ColunaDaEntrada>
            <FecharDeVidro aoTocar={aoSair} />
          </ColunaDaEntrada>
        </View>
      </View>

      {/* O pé fixo: a letra pequena ANTES do botão, o botão, e o "Agora não". */}
      <View>
        <LinearGradient
          pointerEvents="none"
          colors={[veu.tinta(0), veu.tinta(0.85)]}
          style={{ position: "absolute", left: 0, right: 0, top: -espaco.xl, height: espaco.xl }}
        />
        <View
          style={{
            paddingTop: espaco.sm,
            paddingHorizontal: margem.foco,
            paddingBottom: Math.max(fora.bottom, espaco.lg),
            backgroundColor: veu.tinta(0.85),
          }}
        >
          <ColunaDaEntrada estilo={{ gap: espaco.sm }}>{pe}</ColunaDaEntrada>
        </View>
      </View>
    </FundoDaEntrada>
  );
}

/* ── As peças ─────────────────────────────────────────────────────────── */

/**
 * O FECHAR: um botão de vidro solto no alto (Liquid Glass, a camada que
 * flutua), com o X — a tela sobe de baixo, e fecha como as folhas do iPhone.
 */
export function FecharDeVidro({ aoTocar }: { aoTocar: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Fechar"
      hitSlop={8}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={{ alignSelf: "flex-start" }}
    >
      <Vidro
        interativo
        estilo={{
          width: ALVO_MINIMO,
          height: ALVO_MINIMO,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <X size={22} color={cor.texto} strokeWidth={2.4} />
      </Vidro>
    </Pressable>
  );
}

function Cabeca({ sobre, titulo, texto }: { sobre: string; titulo: string; texto: string }) {
  return (
    <View style={{ alignItems: "center", gap: espaco.sm }}>
      <Sobrelinha tinta={veu.textoNoVeu}>{sobre}</Sobrelinha>
      <TituloNoVeu centro nivel="titulo1">
        {titulo}
      </TituloNoVeu>
      <TextoNoVeu centro>{texto}</TextoNoVeu>
    </View>
  );
}

/** "O que o plano completo traz": a lista com o visto, num material escuro do véu. */
function OQueTraz({ itens }: { itens: string[] }) {
  return (
    <View
      style={{
        borderRadius: canto.cartao,
        ...curva,
        borderWidth: 1,
        borderColor: veu.campoBorda,
        backgroundColor: veu.campo,
        paddingVertical: espaco.md + 2,
        paddingHorizontal: espaco.lg,
        gap: espaco.sm + 2,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ ...fonte.forte, ...escala.chamada, color: cor.branco }}
      >
        O que o plano completo traz
      </Text>
      {itens.map((item) => (
        <View key={item} style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: canto.pilula,
              backgroundColor: cor.primaria,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Check size={12} color={cor.branco} strokeWidth={3.2} />
          </View>
          <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.branco, flex: 1 }}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A App Store não devolveu os planos: uma frase calma, sem preço inventado. */
function SemPlanos({ aoTentar }: { aoTentar: () => void }) {
  return (
    <View
      accessibilityRole="alert"
      style={{
        borderRadius: canto.cartao,
        ...curva,
        borderWidth: 1,
        borderColor: veu.campoBorda,
        backgroundColor: veu.campo,
        padding: espaco.lg,
        gap: espaco.sm,
        alignItems: "center",
      }}
    >
      <Text style={{ ...fonte.forte, ...escala.manchete, color: cor.branco, textAlign: "center" }}>
        Os planos não carregaram agora
      </Text>
      <TextoNoVeu centro nivel="legenda">
        Não conseguimos falar com a App Store. Confira a internet e tente de novo daqui a pouco. O
        que você já usa no app continua aqui.
      </TextoNoVeu>
      <LinkNoVeu rotulo="Tentar de novo" aoTocar={aoTentar} />
    </View>
  );
}

/** O aviso sobre o céu: uma cápsula clara (o vermelho direto no escuro não se lê). */
function AvisoNoVeu({ aviso }: { aviso: NonNullable<Aviso> }) {
  const Icone = aviso.tipo === "erro" ? AlertCircle : Info;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: espaco.sm,
        paddingVertical: espaco.sm,
        paddingHorizontal: espaco.md,
        borderRadius: raio.md,
        ...curva,
        backgroundColor: "rgba(255,255,255,0.94)",
      }}
    >
      <Icone
        size={18}
        color={aviso.tipo === "erro" ? cor.urgente : cor.agenda}
        strokeWidth={2.4}
        style={{ marginTop: 1 }}
      />
      <Text style={{ ...fonte.media, ...escala.nota, color: cor.texto, flex: 1 }}>
        {aviso.texto}
      </Text>
    </View>
  );
}

/** "Restaurar compras · Gerenciar assinatura", e embaixo "Termos · Privacidade". */
function Rodape({
  restaurando,
  aoRestaurar,
  aoGerenciar,
}: {
  restaurando: boolean;
  aoRestaurar?: () => void;
  aoGerenciar: () => void;
}) {
  const primeira: ReactNode[] = [];
  if (aoRestaurar) {
    primeira.push(
      <LinkNoVeu
        key="restaurar"
        pequeno
        apagado
        rotulo={restaurando ? "Restaurando…" : "Restaurar compras"}
        desabilitado={restaurando}
        aoTocar={aoRestaurar}
      />,
    );
  }
  primeira.push(
    <LinkNoVeu
      key="gerenciar"
      pequeno
      apagado
      rotulo="Gerenciar assinatura"
      aoTocar={aoGerenciar}
    />,
  );
  const segunda = [
    <LinkNoVeu
      key="termos"
      pequeno
      apagado
      rotulo="Termos"
      aoTocar={() => router.push(rota("/termos") as never)}
    />,
    <LinkNoVeu
      key="privacidade"
      pequeno
      apagado
      rotulo="Privacidade"
      aoTocar={() => router.push(rota("/privacidade") as never)}
    />,
  ];
  return (
    <View style={{ marginTop: "auto", alignItems: "center" }}>
      <LinhaDoRodape itens={primeira} />
      <LinhaDoRodape itens={segunda} />
    </View>
  );
}

function LinhaDoRodape({ itens }: { itens: ReactNode[] }) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        columnGap: espaco.xs,
      }}
    >
      {itens.flatMap((item, i) =>
        i === 0
          ? [item]
          : [
              <Text
                key={`p${i}`}
                style={{ ...fonte.forte, ...escala.legenda, color: veu.textoNoVeu }}
              >
                ·
              </Text>,
              item,
            ],
      )}
    </View>
  );
}
