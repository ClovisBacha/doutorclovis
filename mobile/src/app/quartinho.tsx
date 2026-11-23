import { Image } from "expo-image";
import { Redirect, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Check from "lucide-react-native/icons/check";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import Gift from "lucide-react-native/icons/gift";
import Heart from "lucide-react-native/icons/heart";
import Lock from "lucide-react-native/icons/lock";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { CANTINHO_BY_ID } from "@/lib/cantinho";
import { selecao, sucesso, toque } from "~/componentes/base";
import { BotaoDaAtividade } from "~/componentes/jornada/atividade";
import { corJornada } from "~/componentes/jornada/cores";
import { ArteDaBolha, useMovimentoReduzido, type HumorDaArte } from "~/componentes/movimento";
import { lerOCantinho, type CantinhoOk } from "~/componentes/recompensas/economia-do-cantinho";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { ymdLocal } from "~/lib/gestacao";
import { useJornada } from "~/componentes/jornada/usarJornada";
import { gravarChave } from "~/lib/jornada/loja";
import {
  alternar,
  CATEGORIAS,
  CHAVE_DO_QUARTINHO,
  cumprirSePronta,
  ehNoiteNoQuarto,
  emOrdemDeDesenho,
  faltaOBerco,
  guardarMemoria,
  ITEM_POR_ID,
  ITENS,
  lerQuartinho,
  missaoDoDia,
  MISSOES,
  presenteDaMissao,
  situacaoDoItem,
  type Categoria,
  type IdDaMissao,
  type IdDoItem,
  type ItemDoQuarto,
  type Quartinho,
  type Situacao,
} from "~/lib/quartinho/quarto";
import { useSessao } from "~/lib/sessao";
import {
  ALVO_MINIMO,
  canto,
  cor,
  curva,
  escala,
  espaco,
  fonte,
  sombra,
  sombraFlutuante,
} from "~/tema";

/**
 * O QUARTINHO DO BEBÊ (23/11/2026) — a tela que abre ao tocar na Bolha do céu.
 *
 * O dono mandou dois mockups ("Seu quarto, do seu jeito!") e as ideias que
 * pediu ao ChatGPT, e pediu: "vamos fazer ficar o mais próximo dessas
 * imagens". O desenho é o do segundo mockup (o mais limpo), com o cartão da
 * missão do primeiro. As regras moram em `~/lib/quartinho/quarto.ts`.
 *
 * ARTE e DADO separados (a skill `/tela`): o quarto e cada item são arte (do
 * Higgsfield, no estilo dos mockups, em `assets/quartinho/`); o saldo, os
 * preços, a posse, a missão e a hora são dado. ⚠️ Diferenças deliberadas dos
 * mockups, e o porquê:
 * - a moeda é a sementinha do app (e não "estrelinhas"), e não há "+" para
 *   comprar moeda: sementinha só se ganha;
 * - sem arrastar, girar nem zoom: cada item tem o seu lugar, e o quarto sai
 *   sempre bonito ("eu não deixaria a experiência cheia de botões");
 * - a missão não paga sementinhas (quem paga é o servidor do site, que não
 *   muda): ela dá um item de presente.
 *
 * Modo Cuidado: o quarto não abre (as telas param de falar do bebê).
 *
 * Bancada: rota=/quartinho [&hora=21] [&postos=berco,poltrona…]
 *          [&missoes=ursinho,parede (cumpridas ontem)] [&itens=objeto-berco,… (da lojinha)]
 */

const ARTE: Record<IdDoItem, number> = {
  berco: require("../../assets/quartinho/berco.webp"),
  poltrona: require("../../assets/quartinho/poltrona.webp"),
  comoda: require("../../assets/quartinho/comoda.webp"),
  luminaria: require("../../assets/quartinho/luminaria.webp"),
  prateleira: require("../../assets/quartinho/prateleira.webp"),
  "quadro-urso": require("../../assets/quartinho/quadro-urso.webp"),
  "quadro-lua": require("../../assets/quartinho/quadro-lua.webp"),
  mobile: require("../../assets/quartinho/mobile.webp"),
  ursinho: require("../../assets/quartinho/ursinho.webp"),
  coelhinho: require("../../assets/quartinho/coelhinho.webp"),
  cavalinho: require("../../assets/quartinho/cavalinho.webp"),
  argolas: require("../../assets/quartinho/argolas.webp"),
  cubos: require("../../assets/quartinho/cubos.webp"),
  cesto: require("../../assets/quartinho/cesto.webp"),
  tapete: require("../../assets/quartinho/tapete.webp"),
  planta: require("../../assets/quartinho/planta.webp"),
};
const QUARTO = require("../../assets/quartinho/quarto-dia.webp");
/**
 * A NOITE do quarto: o mesmo quarto (e os mesmos itens) sob um azul que
 * multiplica, igual para tudo; por cima, só o VIDRO da janela da noite (o céu
 * com estrelas e as árvores escuras), recortado da arte de dia por código.
 * ⚠️ Não use `filter: brightness` nos itens: no iOS ele pintou uma névoa
 * cinza sobre o quarto inteiro (medido no simulador, 23/11/2026).
 */
const JANELA_DA_NOITE = require("../../assets/quartinho/janela-noite.webp");
/** Onde o vidro da janela fica na arte (1536 × 2752), em pixels dela. */
const VIDRO = { x: 100, y: 400, largura: 262, altura: 505 } as const;
const AZUL_DA_NOITE = "#5c64a3";
/** A arte do quarto tem 1536 × 2752. */
const PROPORCAO_DO_QUARTO = 2752 / 1536;
/** O chão que aparece embaixo da arte, se a tela for mais alta que ela. */
const CHAO = { dia: "#e7ae73", noite: "#3c3355" } as const;

const ROXO = corJornada.roxo;
const LILAS_CLARO = "#f3eefc";

const FALAS_AO_POR = ["Ficou lindo!", "Que fofura!", "Combinou demais!", "Amei esse cantinho!"];

const hojeDaTela = () => ymdLocal();

function horaDaTela(): number {
  const h = Number(parametroDaBancada("hora"));
  return Number.isFinite(h) && parametroDaBancada("hora") != null ? h : new Date().getHours();
}

/** O que a bancada põe no quarto, nos MESMOS estados da produção. */
function quartoDaBancada(q: Quartinho): Quartinho {
  const postos = (parametroDaBancada("postos") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is IdDoItem => s in ITEM_POR_ID);
  const ontem = ymdLocal(new Date(Date.now() - 86_400_000));
  const missoes = { ...q.missoes };
  for (const id of (parametroDaBancada("missoes") ?? "").split(","))
    if (MISSOES.some((m) => m.id === id.trim())) missoes[id.trim() as IdDaMissao] = ontem;
  return { ...q, postos: postos.length ? postos : q.postos, missoes };
}

export default function TelaDoQuartinho() {
  const { cuidado, estadoDoPerfil } = useSessao();
  if (estadoDoPerfil === "pronto" && cuidado) return <Redirect href="/" />;
  return <Quartinho />;
}

function Quartinho() {
  const area = useSafeAreaInsets();
  const { width: L } = useWindowDimensions();
  /* Abre a jornada dela (o quarto mora no blob da jornada), como toda tela
     da Jornada: aberta direto, sem passar pela aba, ela também carrega. */
  const { loja } = useJornada();
  const hoje = hojeDaTela();
  const noite = ehNoiteNoQuarto(horaDaTela());

  const [quarto, setQuarto] = useState<Quartinho | null>(null);
  const [categoria, setCategoria] = useState<Categoria>("moveis");
  const [cantinho, setCantinho] = useState<CantinhoOk | null | "lendo">("lendo");
  const [fala, setFala] = useState(
    noite ? "Boa noite! O quartinho está quentinho." : "Seu quarto, do seu jeito!",
  );
  const [pose, setPose] = useState<HumorDaArte>(noite ? "dormindo" : "feliz");
  const [novo, setNovo] = useState<IdDoItem | null>(null);
  const [cumprida, setCumprida] = useState<IdDaMissao | null>(null);
  /* O cartão da missão abre no presente (o mockup 2): fechado, ele não cobre
     a parede. Na bancada, `&missao=1` o abre. */
  const [missaoAberta, setMissaoAberta] = useState(() => parametroDaBancada("missao") === "1");
  const falas = useRef(0);

  /* O quarto guardado chega com a loja; a bancada entra pelo mesmo estado. */
  useEffect(() => {
    if (quarto || !loja.pronto) return;
    const q = lerQuartinho(loja.blob[CHAVE_DO_QUARTINHO]);
    setQuarto(ehBancada() ? quartoDaBancada(q) : q);
  }, [loja.pronto, loja.blob, quarto]);

  /* A posse e o saldo são os da lojinha (o servidor; na bancada, os de exemplo). */
  useEffect(() => {
    let vivo = true;
    void lerOCantinho().then((c) => vivo && setCantinho(c));
    return () => {
      vivo = false;
    };
  }, []);

  const posse = useMemo(
    () => (cantinho && cantinho !== "lendo" ? new Set(cantinho.owned) : null),
    [cantinho],
  );
  const precoDaLojinha = useCallback((id: string) => CANTINHO_BY_ID[id]?.price, []);

  const mudar = useCallback(
    (proximo: Quartinho) => {
      const { quarto: q, cumprida: m } = cumprirSePronta(proximo, hoje);
      setQuarto(q);
      gravarChave(CHAVE_DO_QUARTINHO, q);
      if (m) {
        sucesso();
        setCumprida(m.id);
        setMissaoAberta(true);
        setPose("comemorando");
        const p = presenteDaMissao(m);
        setFala(
          p
            ? `Missão cumprida! De presente: ${p.nome.toLowerCase()}.`
            : "Missão cumprida! O quarto está ficando a sua cara.",
        );
      }
      return m;
    },
    [hoje],
  );

  const aoTocarNoItem = useCallback(
    (item: ItemDoQuarto, s: Situacao) => {
      if (!quarto) return;
      if (s.tipo === "comprar") {
        toque();
        Alert.alert(
          item.nome,
          `Está na lojinha por ${s.preco} sementinhas. Depois de comprar, é só voltar aqui e pôr no quarto.`,
          [
            { text: "Agora não", style: "cancel" },
            { text: "Ir à lojinha", onPress: () => router.push("/jornada/recompensas") },
          ],
        );
        return;
      }
      if (s.tipo === "missao") {
        toque();
        setPose("feliz");
        setFala(`Esse vem de presente na missão "${s.missao.texto.toLowerCase()}".`);
        return;
      }
      if (faltaOBerco(quarto, item.id)) {
        toque();
        setFala("O móbile vai no berço. Põe o berço primeiro?");
        return;
      }
      selecao();
      const tinha = quarto.postos.includes(item.id);
      const m = mudar(alternar(quarto, item.id));
      if (!tinha) setNovo(item.id);
      if (!m) {
        setPose(noite ? "dormindo" : tinha ? "feliz" : "apaixonado");
        setFala(
          tinha
            ? "Tirei. Quer pôr outra coisa?"
            : FALAS_AO_POR[falas.current++ % FALAS_AO_POR.length]!,
        );
      }
    },
    [quarto, mudar, noite],
  );

  const salvar = useCallback(() => {
    if (!quarto) return;
    const q = guardarMemoria(quarto, hoje);
    setQuarto(q);
    gravarChave(CHAVE_DO_QUARTINHO, q);
    sucesso();
    setPose("comemorando");
    setFala("Guardei o seu quarto. Ficou a sua cara!");
  }, [quarto, hoje]);

  const alturaDoQuarto = L * PROPORCAO_DO_QUARTO;

  return (
    <View style={{ flex: 1, backgroundColor: noite ? CHAO.noite : CHAO.dia }}>
      <StatusBar style={noite ? "light" : "dark"} animated />
      {/* O QUARTO: a arte, na largura da tela, e os itens nos lugares dela. */}
      <View style={{ position: "absolute", left: 0, top: 0, width: L, height: alturaDoQuarto }}>
        <Image
          source={QUARTO}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessible
          accessibilityLabel={noite ? "O quartinho do bebê, à noite" : "O quartinho do bebê"}
        />
        {quarto ? (
          <ItensNoQuarto
            postos={quarto.postos}
            novo={novo}
            noite={noite}
            largura={L}
            altura={alturaDoQuarto}
            aoTocar={(id) => setCategoria(ITEM_POR_ID[id].categoria)}
          />
        ) : null}
      </View>

      {/* O alto: voltar, a Bolha falando, o saldo e a missão de hoje. */}
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", top: area.top + espaco.xs, left: 0, right: 0 }}
      >
        <View
          pointerEvents="box-none"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: espaco.sm,
            paddingHorizontal: espaco.md,
          }}
        >
          <BotaoRedondo rotulo="Voltar" aoTocar={() => router.back()}>
            <ChevronLeft size={24} color={cor.texto} strokeWidth={2.4} />
          </BotaoRedondo>
          <FalaDaBolha fala={fala} pose={pose} />
          <Saldo cantinho={cantinho} />
        </View>
        {quarto ? (
          <View
            pointerEvents="box-none"
            style={{
              alignItems: "flex-end",
              gap: espaco.sm,
              marginTop: espaco.sm,
              paddingHorizontal: espaco.md,
            }}
          >
            <BotaoDaMissao
              quarto={quarto}
              hoje={hoje}
              aberta={missaoAberta}
              aoTocar={() => setMissaoAberta((a) => !a)}
            />
            {missaoAberta ? (
              <CartaoDaMissao quarto={quarto} hoje={hoje} acabouDeCumprir={cumprida} />
            ) : null}
          </View>
        ) : null}
      </View>

      {/* A bandeja: as abas, os itens e o salvar. */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom: area.bottom + espaco.xs,
          paddingHorizontal: espaco.sm,
          gap: espaco.sm,
        }}
      >
        <View
          style={{
            borderRadius: 30,
            ...curva,
            paddingVertical: espaco.sm,
            backgroundColor: "rgba(255,255,255,0.94)",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: "rgba(255,255,255,1)",
            ...sombraFlutuante,
          }}
        >
          <Abas ativa={categoria} aoEscolher={setCategoria} />
          {quarto ? (
            <Bandeja
              categoria={categoria}
              quarto={quarto}
              posse={posse}
              lendo={cantinho === "lendo"}
              precoDaLojinha={precoDaLojinha}
              aoTocar={aoTocarNoItem}
            />
          ) : (
            <View style={{ height: 104 }} />
          )}
        </View>
        <BotaoDaAtividade
          cor={ROXO}
          rotulo="Salvar meu quarto"
          icone={<Heart size={18} color={cor.branco} fill={cor.branco} strokeWidth={2} />}
          aoTocar={salvar}
          desabilitado={!quarto}
          vibrar={false}
        />
      </View>
    </View>
  );
}

/* ── O quarto ─────────────────────────────────────────────────────────── */

const ItensNoQuarto = memo(function ItensNoQuarto({
  postos,
  novo,
  noite,
  largura,
  altura,
  aoTocar,
}: {
  postos: readonly IdDoItem[];
  novo: IdDoItem | null;
  noite: boolean;
  largura: number;
  altura: number;
  aoTocar: (id: IdDoItem) => void;
}) {
  const itens = emOrdemDeDesenho(postos);
  const luminaria = postos.includes("luminaria") ? ITEM_POR_ID.luminaria : null;
  const k = largura / 1536;
  return (
    <>
      {itens.map((item) => (
        <ItemNoQuarto
          key={item.id}
          item={item}
          novo={novo === item.id}
          largura={largura}
          altura={altura}
          aoTocar={aoTocar}
        />
      ))}
      {noite ? (
        <>
          {/* A noite: o mesmo azul multiplica o quarto e os itens. */}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: AZUL_DA_NOITE, mixBlendMode: "multiply" },
            ]}
          />
          {/* O céu da noite na janela (por cima do azul: ele já é a noite). */}
          <Image
            source={JANELA_DA_NOITE}
            style={{
              position: "absolute",
              left: VIDRO.x * k,
              top: VIDRO.y * k,
              width: VIDRO.largura * k,
              height: VIDRO.altura * k,
            }}
            contentFit="fill"
            accessible={false}
          />
          {/* A luminária acesa espalha uma luz quente em volta. */}
          {luminaria ? <LuzDaLuminaria item={luminaria} largura={largura} altura={altura} /> : null}
        </>
      ) : null}
    </>
  );
});

function caixaDoItem(item: ItemDoQuarto, L: number, A: number) {
  const { x, base, largura, achatar } = item.lugar;
  const w = largura * L;
  const h = w * item.proporcao * (achatar ?? 1);
  return { left: x * L - w / 2, top: base * A - h, width: w, height: h };
}

function ItemNoQuarto({
  item,
  novo,
  largura,
  altura,
  aoTocar,
}: {
  item: ItemDoQuarto;
  novo: boolean;
  largura: number;
  altura: number;
  aoTocar: (id: IdDoItem) => void;
}) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(novo && !reduzido ? 0 : 1)).current;
  useEffect(() => {
    if (!novo || reduzido) return;
    v.setValue(0);
    Animated.spring(v, { toValue: 1, speed: 14, bounciness: 12, useNativeDriver: true }).start();
  }, [novo, reduzido, v]);
  const caixa = caixaDoItem(item, largura, altura);
  return (
    <Animated.View
      style={{
        position: "absolute",
        ...caixa,
        opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) },
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
        ],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.nome}, no quarto`}
        accessibilityHint="Mostra na bandeja, para trocar ou tirar"
        onPress={() => aoTocar(item.id)}
        style={{ flex: 1 }}
      >
        <Image source={ARTE[item.id]} style={{ flex: 1 }} contentFit="fill" accessible={false} />
      </Pressable>
    </Animated.View>
  );
}

function LuzDaLuminaria({
  item,
  largura,
  altura,
}: {
  item: ItemDoQuarto;
  largura: number;
  altura: number;
}) {
  const c = caixaDoItem(item, largura, altura);
  const lado = largura * 0.62;
  /* A cúpula fica no alto da arte da luminária. */
  const cx = c.left + c.width / 2;
  const cy = c.top + c.height * 0.12;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: cx - lado / 2,
        top: cy - lado / 2,
        width: lado,
        height: lado,
        mixBlendMode: "screen",
      }}
    >
      <Svg width={lado} height={lado}>
        <Defs>
          <RadialGradient id="luz-da-luminaria" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#ffd59a" stopOpacity={0.75} />
            <Stop offset="0.4" stopColor="#ffb870" stopOpacity={0.28} />
            <Stop offset="1" stopColor="#ffb870" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={lado / 2} cy={lado / 2} r={lado / 2} fill="url(#luz-da-luminaria)" />
      </Svg>
    </View>
  );
}

/* ── O alto ───────────────────────────────────────────────────────────── */

function BotaoRedondo({
  rotulo,
  aoTocar,
  children,
}: {
  rotulo: string;
  aoTocar: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        width: ALVO_MINIMO + 4,
        height: ALVO_MINIMO + 4,
        borderRadius: (ALVO_MINIMO + 4) / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.95)",
        transform: [{ scale: pressed ? 0.94 : 1 }],
        ...sombra,
      })}
    >
      {children}
    </Pressable>
  );
}

function FalaDaBolha({ fala, pose }: { fala: string; pose: HumorDaArte }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        flex: 1,
        minHeight: ALVO_MINIMO + 4,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingLeft: 4,
        paddingRight: 12,
        borderRadius: canto.pilula,
        ...curva,
        backgroundColor: "rgba(255,255,255,0.95)",
        ...sombra,
      }}
    >
      <View accessible={false} importantForAccessibility="no-hide-descendants">
        <ArteDaBolha humor={pose} tamanho={36} />
      </View>
      <Text
        numberOfLines={2}
        style={{
          flex: 1,
          ...fonte.forte,
          fontSize: 13,
          lineHeight: 17,
          color: corJornada.roxoEscuro,
        }}
      >
        {fala}
      </Text>
      <Heart size={14} color={ROXO} fill={ROXO} strokeWidth={2} />
    </View>
  );
}

function Saldo({ cantinho }: { cantinho: CantinhoOk | null | "lendo" }) {
  if (!cantinho || cantinho === "lendo") return null;
  return (
    <View
      accessible
      accessibilityLabel={`${cantinho.balance} sementinhas`}
      style={{
        minHeight: ALVO_MINIMO,
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 10,
        borderRadius: canto.pilula,
        ...curva,
        backgroundColor: "rgba(255,255,255,0.95)",
        ...sombra,
      }}
    >
      <Text allowFontScaling={false} style={{ fontSize: 16 }}>
        🌱
      </Text>
      <Text
        style={{ ...fonte.forte, fontSize: 16, color: cor.texto, fontVariant: ["tabular-nums"] }}
      >
        {cantinho.balance}
      </Text>
    </View>
  );
}

/** O presente do canto (o mockup 2): o ponto vermelho quando a missão de hoje espera. */
function BotaoDaMissao({
  quarto,
  hoje,
  aberta,
  aoTocar,
}: {
  quarto: Quartinho;
  hoje: string;
  aberta: boolean;
  aoTocar: () => void;
}) {
  const d = missaoDoDia(quarto, hoje);
  if (d.estado === "todas") return null;
  const espera = d.estado === "aberta";
  return (
    <BotaoRedondo
      rotulo={
        aberta
          ? "Fechar a missão de hoje"
          : espera
            ? "Missão de hoje, esperando"
            : "Missão de hoje, cumprida"
      }
      aoTocar={aoTocar}
    >
      <Gift size={24} color={ROXO} strokeWidth={2.2} />
      {espera && !aberta ? (
        <View
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 11,
            height: 11,
            borderRadius: 6,
            backgroundColor: "#ef4444",
            borderWidth: 2,
            borderColor: cor.branco,
          }}
        />
      ) : null}
    </BotaoRedondo>
  );
}

function CartaoDaMissao({
  quarto,
  hoje,
  acabouDeCumprir,
}: {
  quarto: Quartinho;
  hoje: string;
  acabouDeCumprir: IdDaMissao | null;
}) {
  const d = missaoDoDia(quarto, hoje);
  if (d.estado === "todas") return null;
  const missao = d.missao;
  const feita = d.estado === "cumprida-hoje";
  const feitos = feita ? missao.precisa.length : d.feitos;
  const total = missao.precisa.length;
  const icone = missao.precisa[0]![0]!;
  return (
    <View
      accessible
      accessibilityLabel={
        feita
          ? `Missão de hoje cumprida: ${missao.texto}. Amanhã tem outra.`
          : `Sua missão de hoje: ${missao.texto}. ${feitos} de ${total}.`
      }
      style={{
        width: 208,
        borderRadius: 18,
        ...curva,
        padding: 10,
        gap: 6,
        backgroundColor: "rgba(255,251,245,0.95)",
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: acabouDeCumprir === missao.id ? "#f5c451" : "#efd9c3",
        ...sombra,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ flex: 1, ...fonte.forte, fontSize: 13, color: cor.texto }}>
          {feita ? "Missão cumprida!" : "Sua missão de hoje:"}
        </Text>
        <Gift size={20} color={ROXO} strokeWidth={2.2} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Image source={ARTE[icone]} style={{ width: 34, height: 34 }} contentFit="contain" />
        <Text
          style={{ flex: 1, ...fonte.media, fontSize: 13, lineHeight: 17, color: cor.textoCorpo }}
        >
          {feita ? "Amanhã tem outra." : missao.texto}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            flex: 1,
            height: 6,
            borderRadius: 3,
            backgroundColor: "#efe6f8",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${Math.round((feitos / total) * 100)}%`,
              height: 6,
              borderRadius: 3,
              backgroundColor: feita ? cor.sementinha : ROXO,
            }}
          />
        </View>
        <Text
          style={{ ...fonte.forte, fontSize: 13, color: cor.texto, fontVariant: ["tabular-nums"] }}
        >
          {feitos} / {total}
        </Text>
      </View>
    </View>
  );
}

/* ── A bandeja ────────────────────────────────────────────────────────── */

function Abas({ ativa, aoEscolher }: { ativa: Categoria; aoEscolher: (c: Categoria) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingHorizontal: espaco.sm }}
    >
      {CATEGORIAS.map((c) => {
        const sim = c.id === ativa;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: sim }}
            accessibilityLabel={c.nome}
            onPress={() => {
              selecao();
              aoEscolher(c.id);
            }}
            style={{
              minWidth: 74,
              minHeight: 52,
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              paddingHorizontal: 8,
              borderRadius: 16,
              ...curva,
              backgroundColor: sim ? ROXO : LILAS_CLARO,
            }}
          >
            <Image source={ARTE[c.icone]} style={{ width: 24, height: 24 }} contentFit="contain" />
            <Text style={{ ...fonte.forte, fontSize: 13, color: sim ? cor.branco : cor.texto }}>
              {c.nome}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Bandeja({
  categoria,
  quarto,
  posse,
  lendo,
  precoDaLojinha,
  aoTocar,
}: {
  categoria: Categoria;
  quarto: Quartinho;
  posse: ReadonlySet<string> | null;
  lendo: boolean;
  precoDaLojinha: (id: string) => number | undefined;
  aoTocar: (item: ItemDoQuarto, s: Situacao) => void;
}) {
  const itens = ITENS.filter((i) => i.categoria === categoria);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginTop: espaco.sm }}
      contentContainerStyle={{ gap: espaco.sm, paddingHorizontal: espaco.sm }}
    >
      {itens.map((item) => {
        const s = situacaoDoItem(item, quarto, posse, precoDaLojinha);
        return (
          <CartaoDoItem
            key={item.id}
            item={item}
            situacao={lendo && item.lojinha ? null : s}
            posto={quarto.postos.includes(item.id)}
            aoTocar={() => aoTocar(item, s)}
          />
        );
      })}
    </ScrollView>
  );
}

function CartaoDoItem({
  item,
  situacao: s,
  posto,
  aoTocar,
}: {
  item: ItemDoQuarto;
  /** `null`: ainda lendo a posse na lojinha. */
  situacao: Situacao | null;
  posto: boolean;
  aoTocar: () => void;
}) {
  const fechado = s?.tipo === "comprar" || s?.tipo === "missao";
  const rotulo =
    s === null
      ? ""
      : s.tipo === "comprar"
        ? `${s.preco}`
        : s.tipo === "missao"
          ? "Missão"
          : posto
            ? "No quarto"
            : item.lojinha
              ? "Seu"
              : "Grátis";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: posto, disabled: s === null }}
      accessibilityLabel={
        s?.tipo === "comprar"
          ? `${item.nome}, ${s.preco} sementinhas na lojinha`
          : s?.tipo === "missao"
            ? `${item.nome}, presente da missão ${s.missao.texto}`
            : `${item.nome}${posto ? ", no quarto. Toque para tirar" : ". Toque para pôr no quarto"}`
      }
      disabled={s === null}
      onPress={aoTocar}
      style={({ pressed }) => ({
        width: 86,
        height: 96,
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        borderRadius: 20,
        ...curva,
        backgroundColor: posto ? "#fbf6ff" : cor.branco,
        borderWidth: posto ? 2 : 1,
        borderColor: posto ? ROXO : "#efe9f6",
        transform: [{ scale: pressed ? 0.96 : 1 }],
        ...sombra,
      })}
    >
      <Image
        source={ARTE[item.id]}
        style={{ width: 60, height: 54, opacity: fechado ? 0.55 : 1 }}
        contentFit="contain"
        accessible={false}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3, minHeight: 18 }}>
        {s?.tipo === "comprar" ? (
          <Text allowFontScaling={false} style={{ fontSize: 13 }}>
            🌱
          </Text>
        ) : null}
        {s?.tipo === "missao" ? (
          <Lock size={13} color={cor.textoApagado} strokeWidth={2.4} />
        ) : null}
        <Text
          style={{
            ...fonte.forte,
            fontSize: 13,
            color: posto ? ROXO : fechado ? cor.textoApagado : cor.texto,
          }}
        >
          {rotulo}
        </Text>
      </View>
      {posto ? (
        <View
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            width: 24,
            height: 24,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f5c451",
            borderWidth: 2,
            borderColor: cor.branco,
          }}
        >
          <Check size={14} color={cor.branco} strokeWidth={3} />
        </View>
      ) : null}
    </Pressable>
  );
}
