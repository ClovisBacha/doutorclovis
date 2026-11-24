import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Check from "lucide-react-native/icons/check";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import Dices from "lucide-react-native/icons/dices";
import Gift from "lucide-react-native/icons/gift";
import Heart from "lucide-react-native/icons/heart";
import Lock from "lucide-react-native/icons/lock";
import Undo2 from "lucide-react-native/icons/undo-2";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Defs,
  Ellipse,
  LinearGradient as Degrade,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { selecao, sucesso, toque } from "~/componentes/base";
import { corJornada } from "~/componentes/jornada/cores";
import { useJornada } from "~/componentes/jornada/usarJornada";
import { ArteDaBolha, useMovimentoReduzido, type HumorDaArte } from "~/componentes/movimento";
import {
  comprarItem,
  lerALojaPorFase,
  lerOCantinho,
  type CantinhoOk,
} from "~/componentes/recompensas/economia-do-cantinho";
import { TEM_VIDRO_DO_SISTEMA, Vidro } from "~/componentes/vidro";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { clarear } from "~/lib/cor";
import { ymdLocal } from "~/lib/gestacao";
import { gravarChave } from "~/lib/jornada/loja";
import { semanaDaLoja, type ItemPorFase } from "~/lib/jornada/loja-por-fase";
import {
  alternar,
  APOIO,
  CATEGORIAS,
  CHAVE_DO_QUARTINHO,
  contaDaCompra,
  cumprirSePronta,
  decorarAoAcaso,
  ehNoiteNoQuarto,
  emOrdemDeDesenho,
  falaDoEmBreve,
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
  type VitrineDoQuarto,
} from "~/lib/quartinho/quarto";
import { useSessao } from "~/lib/sessao";
import { ALVO_MINIMO, cor, curva, espaco, fonte } from "~/tema";

/**
 * O QUARTINHO DO BEBÊ (23/11/2026) — a tela que abre ao tocar na Bolha do céu.
 *
 * O dono mandou dois mockups de dia ("Seu quarto, do seu jeito!"), um de noite
 * e as ideias que pediu ao ChatGPT: "vamos fazer ficar o mais próximo dessas
 * imagens". Depois da primeira versão: "o fundo dos escritos não ser
 * totalmente branco, e sim nesses degradês meio Liquid Glass [...] o quarto
 * com um pouco mais de profundidade [...] bastante ênfase na iluminação, que
 * é algo que faltou". As regras moram em `~/lib/quartinho/quarto.ts`.
 *
 * ARTE e DADO separados (a skill `/tela`): o quarto (de dia e de noite) e
 * cada item são arte do Higgsfield, no estilo dos mockups
 * (`assets/quartinho/`); o saldo, os preços, a posse, a missão e a hora são
 * dado.
 *
 * O VIDRO: tudo o que flutua sobre o quarto (o voltar, a fala da Bolha, o
 * saldo, o presente, a bandeja) é vidro LILÁS em degradê (`VidroLilas`): o
 * Liquid Glass do sistema com a tinta lilás por cima, e nunca um bloco branco.
 *
 * A PROFUNDIDADE: cada item projeta sombra (de contato, no chão; projetada, na
 * parede), e os cantos do quarto escurecem de leve.
 *
 * A LUZ é o centro da tela. De dia: o sol que entra pela janela, quente, e a
 * poeira dourada no ar. De noite, o quarto é uma pintura da noite (o luar
 * desenhando a vidraça no chão, as estrelinhas da parede acesas); os itens
 * escurecem cada um na sua forma, a luminária acende de verdade, o luar passa
 * por cima deles, as estrelinhas piscam e vaga-lumes sobem devagar.
 * ⚠️ Não use `filter: brightness` nos itens: no iOS ele pintou uma névoa
 * cinza sobre o quarto inteiro (medido no simulador, 23/11/2026).
 *
 * ⚠️ Diferenças deliberadas dos mockups, e o porquê:
 * - a moeda é a sementinha do app (e não "estrelinhas"), e não há "+" para
 *   comprar moeda: sementinha só se ganha;
 * - sem mover nem zoom: cada item tem o seu lugar, e o quarto sai sempre
 *   bonito ("eu não deixaria a experiência cheia de botões");
 * - a missão não paga sementinhas (quem paga é o servidor do site, que não
 *   muda): ela dá um item de presente.
 *
 * Modo Cuidado: o quarto não abre (as telas param de falar do bebê).
 *
 * Bancada: rota=/quartinho [&hora=21] [&postos=berco,poltrona…] [&missao=1]
 *          [&missoes=ursinho,parede (cumpridas ontem)] [&itens=objeto-berco,… (da lojinha)]
 *          [&comprar=luminaria (abre a compra)] [&saldo=N] [&semana=N]
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
const QUARTO_DIA = require("../../assets/quartinho/quarto-dia.webp");
const QUARTO_NOITE = require("../../assets/quartinho/quarto-noite.webp");
/** O brilho das estrelinhas da parede (as mesmas da arte), para elas piscarem. */
const ESTRELAS_DA_NOITE = require("../../assets/quartinho/estrelas-noite.webp");
/** A arte do quarto tem 1536 × 2752. */
const PROPORCAO_DO_QUARTO = 2752 / 1536;
/** O chão que aparece embaixo da arte, se a tela for mais alta que ela. */
const CHAO = { dia: "#e7ae73", noite: "#2a1f3d" } as const;

const ROXO = corJornada.roxo;
/** A tinta sobre o vidro lilás (11:1 sobre ele). */
const TINTA = corJornada.roxoEscuro;
const OURO = "#f5c451";
/** A sombra de cada item à noite: a forma dele, em azul-noite, por cima. */
const SOMBRA_DA_NOITE = "#1c1466";

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
  const { dia, loja } = useJornada();
  const hoje = hojeDaTela();
  const noite = ehNoiteNoQuarto(horaDaTela());

  const [quarto, setQuarto] = useState<Quartinho | null>(null);
  const [categoria, setCategoria] = useState<Categoria>("moveis");
  const [cantinho, setCantinho] = useState<CantinhoOk | null | "lendo">("lendo");
  /* A loja por fase do banco: `undefined` lendo, `null` sem a tabela. */
  const [porFase, setPorFase] = useState<ReadonlyMap<string, ItemPorFase> | null | undefined>();
  /* O item que ela está comprando ali mesmo (a folha de compra aberta). */
  const [aComprar, setAComprar] = useState<IdDoItem | null>(() => {
    const id = parametroDaBancada("comprar");
    return id && id in ITEM_POR_ID ? (id as IdDoItem) : null;
  });
  const [comprando, setComprando] = useState(false);
  const [fala, setFala] = useState(
    noite ? "Boa noite! Que quartinho gostoso." : "Seu quarto, do seu jeito!",
  );
  const [pose, setPose] = useState<HumorDaArte>(noite ? "dormindo" : "feliz");
  const [novo, setNovo] = useState<IdDoItem | null>(null);
  const [cumprida, setCumprida] = useState<IdDaMissao | null>(null);
  /* O cartão da missão abre no presente (o mockup 2): fechado, ele não cobre
     a parede. Na bancada, `&missao=1` o abre. */
  const [missaoAberta, setMissaoAberta] = useState(() => parametroDaBancada("missao") === "1");
  /* O que o "Desfazer" devolve: os quartos de antes, do mais velho ao mais novo. */
  const [antes, setAntes] = useState<IdDoItem[][]>([]);
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
    void lerALojaPorFase().then((f) => vivo && setPorFase(f));
    return () => {
      vivo = false;
    };
  }, []);

  const semana = semanaDaLoja({
    semanaDaGestacao: dia.modo === "gestacao" ? dia.semana : null,
    nasceu: dia.modo === "pos",
  });
  const vitrine = useMemo<VitrineDoQuarto>(
    () => ({
      posse: cantinho && cantinho !== "lendo" ? new Set(cantinho.owned) : null,
      porFase: porFase ?? null,
      semana,
    }),
    [cantinho, porFase, semana],
  );
  /* Enquanto a posse ou a loja por fase chegam, o item da lojinha não diz nada. */
  const lendo = cantinho === "lendo" || porFase === undefined;
  const saldo = cantinho && cantinho !== "lendo" ? cantinho.balance : null;

  const mudar = useCallback(
    (proximo: Quartinho, de: Quartinho) => {
      const { quarto: q, cumprida: m } = cumprirSePronta(proximo, hoje);
      setAntes((h) => [...h.slice(-19), de.postos]);
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
        /* A leitura da lojinha falhou: sem o saldo e a posse, não vende (a
           vitrine faz o mesmo: o "não consegui ler" vem antes da venda). */
        if (cantinho === null) {
          setPose("surpresa");
          setFala("Não consegui ver as suas sementinhas agora. Tenta de novo daqui a pouco?");
          return;
        }
        setAComprar(item.id);
        return;
      }
      if (s.tipo === "em-breve") {
        toque();
        setPose("feliz");
        setFala(falaDoEmBreve(s.quando));
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
      const m = mudar(alternar(quarto, item.id), quarto);
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
    [quarto, mudar, noite, cantinho],
  );

  /**
   * A COMPRA ALI MESMO (24/11/2026): a mesma compra da lojinha
   * (`comprarItem`, com as mesmas recusas), e o item entra no quarto na hora.
   */
  const comprar = useCallback(async () => {
    if (!aComprar || comprando || !quarto) return;
    const item = ITEM_POR_ID[aComprar];
    const s = situacaoDoItem(item, quarto, vitrine);
    if (s.tipo !== "comprar") return;
    setComprando(true);
    const r = await comprarItem(s.lojinha, s.daFase);
    setComprando(false);
    if (!r) {
      setPose("surpresa");
      setFala("Não deu para comprar agora. Tenta de novo daqui a pouco?");
      return;
    }
    /* Comprado noutro aparelho conta como dela: só falta pôr no quarto. */
    if (!r.ok && r.motivo !== "ja_possui") {
      /* Só a recusa por saldo traz o saldo de verdade (o mesmo cuidado da lojinha). */
      if (r.motivo === "saldo_insuficiente" && typeof r.balance === "number") {
        const b = r.balance;
        setCantinho((c) => (c && c !== "lendo" ? { ...c, balance: b } : c));
      }
      setPose("surpresa");
      setFala(r.error || "Não deu para comprar agora.");
      return;
    }
    setCantinho((c) =>
      c && c !== "lendo"
        ? {
            ...c,
            balance: r.ok ? r.balance : c.balance,
            owned: c.owned.includes(s.lojinha) ? c.owned : [...c.owned, s.lojinha],
          }
        : c,
    );
    setAComprar(null);
    sucesso();
    const bonus = r.ok && r.bonusNovo ? ` E fechou um conjunto: +${r.bonusNovo} sementinhas!` : "";
    if (faltaOBerco(quarto, item.id)) {
      setPose("comemorando");
      setFala(`O móbile é seu! Ele vai no berço.${bonus}`);
      return;
    }
    const m = quarto.postos.includes(item.id) ? null : mudar(alternar(quarto, item.id), quarto);
    setNovo(item.id);
    if (!m) {
      setPose("comemorando");
      setFala(`É seu! Já pus no quarto.${bonus}`);
    }
  }, [aComprar, comprando, quarto, vitrine, mudar]);

  const salvar = useCallback(() => {
    if (!quarto) return;
    const q = guardarMemoria(quarto, hoje);
    setQuarto(q);
    gravarChave(CHAVE_DO_QUARTINHO, q);
    sucesso();
    setPose("comemorando");
    setFala("Guardei o seu quarto. Ficou a sua cara!");
  }, [quarto, hoje]);

  const desfazer = useCallback(() => {
    if (!quarto || !antes.length) return;
    const postos = antes[antes.length - 1]!;
    setAntes((h) => h.slice(0, -1));
    const q = { ...quarto, postos };
    setQuarto(q);
    gravarChave(CHAVE_DO_QUARTINHO, q);
    setNovo(null);
    setPose(noite ? "dormindo" : "feliz");
    setFala("Voltei como estava.");
  }, [quarto, antes, noite]);

  const aoAcaso = useCallback(() => {
    if (!quarto) return;
    const livres = ITENS.filter((i) => situacaoDoItem(i, quarto, vitrine).tipo === "livre").map(
      (i) => i.id,
    );
    const m = mudar(decorarAoAcaso(quarto, livres, Math.random), quarto);
    setNovo(null);
    if (!m) {
      setPose(noite ? "dormindo" : "apaixonado");
      setFala("Arrumei do meu jeito. Gostou?");
    }
  }, [quarto, vitrine, mudar, noite]);

  const alturaDoQuarto = L * PROPORCAO_DO_QUARTO;

  return (
    <View style={{ flex: 1, backgroundColor: noite ? CHAO.noite : CHAO.dia }}>
      <StatusBar style={noite ? "light" : "dark"} animated />
      {/* O QUARTO: a arte, na largura da tela, e os itens nos lugares dela. */}
      <View style={{ position: "absolute", left: 0, top: 0, width: L, height: alturaDoQuarto }}>
        <Image
          source={noite ? QUARTO_NOITE : QUARTO_DIA}
          style={StyleSheet.absoluteFill}
          contentFit="fill"
          accessible
          accessibilityLabel={noite ? "O quartinho do bebê, à noite" : "O quartinho do bebê"}
        />
        <Cena
          postos={quarto?.postos ?? []}
          novo={novo}
          noite={noite}
          largura={L}
          altura={alturaDoQuarto}
          aoTocar={(id) => setCategoria(ITEM_POR_ID[id].categoria)}
        />
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
            <ChevronLeft size={24} color={TINTA} strokeWidth={2.6} />
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

      {/* A bandeja: as abas, os itens e, embaixo, desfazer, salvar e o dado. */}
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
        <VidroLilas raio={30} estilo={{ paddingVertical: espaco.sm }}>
          <Abas ativa={categoria} aoEscolher={setCategoria} />
          {quarto ? (
            <Bandeja
              categoria={categoria}
              quarto={quarto}
              vitrine={vitrine}
              lendo={lendo}
              aoTocar={aoTocarNoItem}
            />
          ) : (
            <View style={{ height: 116 }} />
          )}
        </VidroLilas>
        <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
          <BotaoRedondo rotulo="Desfazer" aoTocar={desfazer} apagado={!antes.length}>
            <Undo2 size={22} color={TINTA} strokeWidth={2.6} />
          </BotaoRedondo>
          <BotaoDeSalvar aoTocar={salvar} desabilitado={!quarto} />
          <BotaoRedondo rotulo="Decorar aleatoriamente" aoTocar={aoAcaso} apagado={!quarto}>
            <Dices size={22} color={TINTA} strokeWidth={2.4} />
          </BotaoRedondo>
        </View>
      </View>

      {aComprar && quarto ? (
        <FolhaDeCompra
          item={ITEM_POR_ID[aComprar]}
          situacao={situacaoDoItem(ITEM_POR_ID[aComprar], quarto, vitrine)}
          saldo={saldo}
          comprando={comprando}
          vaiProQuarto={!faltaOBerco(quarto, aComprar)}
          noite={noite}
          aoComprar={() => void comprar()}
          aoFechar={() => !comprando && setAComprar(null)}
          fundo={area.bottom}
        />
      ) : null}
    </View>
  );
}

/* ── O vidro lilás ────────────────────────────────────────────────────── */

/**
 * O VIDRO LILÁS dos mockups: o `Vidro` do app (o Liquid Glass do sistema,
 * quando há; só ele o chama, `vidro-e-luz.test.ts`) com um degradê lilás por
 * cima, o fio de luz na borda e o brilho no alto. Sem o
 * vidro do sistema, o degradê fica quase opaco, para o texto se ler igual.
 */
function VidroLilas({
  children,
  estilo,
  raio = 999,
}: {
  children?: ReactNode;
  estilo?: StyleProp<ViewStyle>;
  raio?: number;
}) {
  return (
    <Vidro
      forma={raio}
      tinta="#d9ccff"
      flutua={false}
      estilo={[
        {
          overflow: "hidden",
          borderWidth: 1.5,
          borderColor: "rgba(255,255,255,0.72)",
          boxShadow: "0px 10px 26px -10px rgba(76,29,149,0.55), 0px 2px 6px rgba(76,29,149,0.14)",
        },
        estilo,
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={
          TEM_VIDRO_DO_SISTEMA
            ? ["rgba(250,246,255,0.74)", "rgba(226,214,255,0.6)", "rgba(206,190,250,0.62)"]
            : ["rgba(251,248,255,0.96)", "rgba(232,222,255,0.93)", "rgba(214,200,250,0.93)"]
        }
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* O brilho do alto: a luz que o vidro pega em cima. */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,255,255,0.7)", "rgba(255,255,255,0)"]}
        style={{ position: "absolute", left: 0, right: 0, top: 0, height: "46%" }}
      />
      {children}
    </Vidro>
  );
}

function BotaoRedondo({
  rotulo,
  aoTocar,
  apagado,
  children,
}: {
  rotulo: string;
  aoTocar: () => void;
  apagado?: boolean;
  children: ReactNode;
}) {
  const lado = ALVO_MINIMO + 6;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: !!apagado }}
      disabled={apagado}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        opacity: apagado ? 0.55 : 1,
        transform: [{ scale: pressed ? 0.93 : 1 }],
      })}
    >
      <VidroLilas
        estilo={{ width: lado, height: lado, alignItems: "center", justifyContent: "center" }}
      >
        {children}
      </VidroLilas>
    </Pressable>
  );
}

function BotaoDeSalvar({ aoTocar, desabilitado }: { aoTocar: () => void; desabilitado: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Salvar meu quarto"
      accessibilityState={{ disabled: desabilitado }}
      disabled={desabilitado}
      onPress={aoTocar}
      style={({ pressed }) => ({
        flex: 1,
        opacity: desabilitado ? 0.6 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <LinearGradient
        colors={["#a487fb", "#7c4fe8", "#6431d6"]}
        locations={[0, 0.55, 1]}
        style={{
          height: ALVO_MINIMO + 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          borderRadius: 999,
          ...curva,
          borderWidth: 2,
          borderColor: "rgba(226,214,255,0.85)",
          boxShadow: "0px 10px 24px -8px rgba(100,49,214,0.8), 0px 0px 14px rgba(164,135,251,0.45)",
        }}
      >
        <Text style={{ ...fonte.forte, fontSize: 17, color: cor.branco }}>Salvar meu quarto</Text>
        <Heart size={18} color={cor.branco} fill={cor.branco} strokeWidth={2} />
      </LinearGradient>
    </Pressable>
  );
}

/* ── A compra ali mesmo ───────────────────────────────────────────────── */

/**
 * A FOLHA DE COMPRA (24/11/2026): tocar num item que ela ainda não tem abre
 * esta folha de vidro lilás sobre o quarto, com o item, o preço e a conta
 * (quanto fica, ou quanto falta). Comprar põe o item no quarto na hora. Antes
 * era um alerta que mandava à lojinha.
 */
function FolhaDeCompra({
  item,
  situacao: s,
  saldo,
  comprando,
  vaiProQuarto,
  noite,
  aoComprar,
  aoFechar,
  fundo,
}: {
  item: ItemDoQuarto;
  situacao: Situacao;
  saldo: number | null;
  comprando: boolean;
  /** `false`: o móbile sem o berço (compra, mas ainda não entra no quarto). */
  vaiProQuarto: boolean;
  noite: boolean;
  aoComprar: () => void;
  aoFechar: () => void;
  fundo: number;
}) {
  const reduzido = useMovimentoReduzido();
  const sobe = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  useEffect(() => {
    if (reduzido) return;
    Animated.spring(sobe, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 6 }).start();
  }, [sobe, reduzido]);

  if (s.tipo !== "comprar") return null;
  const conta = contaDaCompra(s.preco, saldo);
  const rotulo = comprando ? "Comprando…" : vaiProQuarto ? "Comprar e pôr no quarto" : "Comprar";

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fechar a compra"
        onPress={aoFechar}
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: noite ? "rgba(10,6,30,0.45)" : "rgba(40,24,90,0.28)" },
        ]}
      />
      <Animated.View
        accessibilityViewIsModal
        style={{
          position: "absolute",
          left: espaco.sm,
          right: espaco.sm,
          bottom: fundo + espaco.sm,
          opacity: sobe,
          transform: [
            { translateY: sobe.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) },
          ],
        }}
      >
        <VidroLilas raio={32} estilo={{ padding: espaco.md, gap: espaco.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
            <LinearGradient
              colors={["#ffffff", "#efe6ff"]}
              style={{
                width: 92,
                height: 92,
                borderRadius: 28,
                ...curva,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1.5,
                borderColor: "rgba(255,255,255,0.95)",
                boxShadow: "0px 8px 18px -8px rgba(76,29,149,0.45)",
              }}
            >
              <Image
                source={ARTE[item.id]}
                style={{ width: 72, height: 68 }}
                contentFit="contain"
                accessible={false}
              />
            </LinearGradient>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ ...fonte.display, fontSize: 22, lineHeight: 26, color: TINTA }}>
                {item.nome}
              </Text>
              <View
                accessible
                accessibilityLabel={`${s.preco} sementinhas`}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Text allowFontScaling={false} style={{ fontSize: 16 }}>
                  🌱
                </Text>
                <Text
                  style={{
                    ...fonte.titulo,
                    fontSize: 20,
                    color: TINTA,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {s.preco}
                </Text>
              </View>
              <Text style={{ ...fonte.media, fontSize: 15, lineHeight: 19, color: TINTA }}>
                {conta.pode
                  ? conta.fica == null
                    ? vaiProQuarto
                      ? "Ele entra no quarto na hora."
                      : "Depois é só pôr o berço."
                    : `Você fica com ${conta.fica} sementinhas.`
                  : `Faltam ${conta.faltam} sementinhas.`}
              </Text>
            </View>
          </View>
          {!conta.pode ? (
            <Text style={{ ...fonte.normal, fontSize: 15, lineHeight: 20, color: TINTA }}>
              Você ganha sementinhas nas aulas e nas atividades do dia.
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Agora não"
              disabled={comprando}
              onPress={() => {
                toque();
                aoFechar();
              }}
              style={({ pressed }) => ({
                minHeight: ALVO_MINIMO + 6,
                paddingHorizontal: espaco.md,
                justifyContent: "center",
                opacity: comprando ? 0.5 : 1,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              })}
            >
              <Text style={{ ...fonte.forte, fontSize: 17, color: TINTA }}>Agora não</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${rotulo}, ${s.preco} sementinhas`}
              accessibilityState={{ disabled: !conta.pode || comprando, busy: comprando }}
              disabled={!conta.pode || comprando}
              onPress={() => {
                toque(false);
                aoComprar();
              }}
              style={({ pressed }) => ({
                flex: 1,
                opacity: conta.pode ? 1 : 0.5,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              <LinearGradient
                colors={["#a487fb", "#7c4fe8", "#6431d6"]}
                locations={[0, 0.55, 1]}
                style={{
                  height: ALVO_MINIMO + 8,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 999,
                  ...curva,
                  borderWidth: 2,
                  borderColor: "rgba(226,214,255,0.85)",
                  boxShadow:
                    "0px 10px 24px -8px rgba(100,49,214,0.8), 0px 0px 14px rgba(164,135,251,0.45)",
                }}
              >
                <Text style={{ ...fonte.forte, fontSize: 17, color: cor.branco }}>{rotulo}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </VidroLilas>
      </Animated.View>
    </View>
  );
}

/* ── O quarto: os itens, as sombras e a luz ───────────────────────────── */

const Cena = memo(function Cena({
  postos,
  novo,
  noite,
  largura: L,
  altura: A,
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
  return (
    <>
      {/* As estrelinhas da parede piscam (por baixo dos itens: estão na parede). */}
      {noite ? <EstrelasQuePiscam /> : null}

      {/* As sombras de contato: é o que põe cada coisa NO chão. */}
      {itens
        .filter((i) => APOIO[i.id] === "chao")
        .map((item) => (
          <SombraNoChao key={item.id} item={item} noite={noite} largura={L} altura={A} />
        ))}

      {itens.map((item) => (
        <ItemNoQuarto
          key={item.id}
          item={item}
          novo={novo === item.id}
          noite={noite}
          largura={L}
          altura={A}
          aoTocar={aoTocar}
        />
      ))}

      {noite ? (
        <>
          {/* O LUAR passa por cima dos itens: a faixa fria que vem da janela
              e a poça de luz onde a vidraça cai no chão. */}
          <Feixe
            id="luar"
            largura={L}
            altura={A}
            janela={JANELA}
            chao={MANCHA_NO_CHAO}
            tom="#b9c8ff"
            forca={0.075}
          />
          <Brilho
            cx={0.46 * L}
            cy={0.59 * A}
            raio={0.4 * L}
            achatar={0.4}
            tom="#b4c4ff"
            forca={0.3}
          />
          {/* A LUZ DOS ITENS: cada um acende pelo que a ficha dele diz
              (`luz`, na `REGUA_DA_LUZ`): o abajur ilumina o quarto, o móbile
              que brilha no escuro só acende de leve. */}
          {itens.map((item) =>
            item.luz ? <LuzDoItem key={item.id} item={item} largura={L} altura={A} /> : null,
          )}
          <Cantos largura={L} altura={A} tom="#070824" forca={0.5} />
          <Cintilas noite largura={L} altura={A} />
        </>
      ) : (
        <>
          {/* O SOL: o clarão na janela, a faixa quente que entra e a poeira
              dourada no ar. */}
          <Brilho cx={0.15 * L} cy={0.245 * A} raio={0.36 * L} tom="#fff3cf" forca={0.6} />
          {/* O dourado da manhã, que toma o quarto inteiro a partir da janela. */}
          <Brilho cx={0.3 * L} cy={0.36 * A} raio={0.95 * L} tom="#ffc98a" forca={0.22} />
          <Feixe
            id="sol"
            largura={L}
            altura={A}
            janela={JANELA}
            chao={MANCHA_NO_CHAO}
            tom="#ffe6ad"
            forca={0.07}
          />
          <Brilho
            cx={0.46 * L}
            cy={0.59 * A}
            raio={0.4 * L}
            achatar={0.4}
            tom="#ffd99a"
            forca={0.26}
          />
          <Cantos largura={L} altura={A} tom="#5a2a14" forca={0.2} />
          <Cintilas largura={L} altura={A} />
        </>
      )}
    </>
  );
});

/** A diagonal do vidro da janela e a mancha da vidraça no chão, em frações da arte. */
const JANELA = [
  [0.27, 0.15],
  [0.1, 0.33],
] as const;
const MANCHA_NO_CHAO = [
  [0.2, 0.64],
  [0.74, 0.55],
] as const;

function caixaDoItem(item: ItemDoQuarto, L: number, A: number) {
  const { x, base, largura, achatar } = item.lugar;
  const w = largura * L;
  const h = w * item.proporcao * (achatar ?? 1);
  return { left: x * L - w / 2, top: base * A - h, width: w, height: h };
}

function SombraNoChao({
  item,
  noite,
  largura,
  altura,
}: {
  item: ItemDoQuarto;
  noite: boolean;
  largura: number;
  altura: number;
}) {
  const c = caixaDoItem(item, largura, altura);
  const w = c.width * 1.12;
  const h = Math.max(12, c.width * 0.24);
  const id = `sombra-${item.id}`;
  const tom = noite ? "#05061c" : "#4a2412";
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: c.left + c.width / 2 - w / 2 + c.width * 0.04,
        top: c.top + c.height - h * 0.58,
        width: w,
        height: h,
      }}
    >
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={tom} stopOpacity={noite ? 0.66 : 0.5} />
            <Stop offset="0.6" stopColor={tom} stopOpacity={noite ? 0.3 : 0.2} />
            <Stop offset="1" stopColor={tom} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

function ItemNoQuarto({
  item,
  novo,
  noite,
  largura,
  altura,
  aoTocar,
}: {
  item: ItemDoQuarto;
  novo: boolean;
  noite: boolean;
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
  const naParede = APOIO[item.id] === "parede";
  /* À noite cada item escurece na SUA forma (a mesma arte, tingida, por
     cima), e menos quanto mais luz ele tem: a luminária quase nada. */
  const escuro = noite ? 0.34 * (1 - 0.78 * (item.luz?.potencia ?? 0)) : 0;
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
        /* A sombra projetada segue a forma da arte: o que está na parede a
           lança para baixo e para o lado; o resto, só um contorno macio. */
        shadowColor: noite ? "#03041a" : "#3b1c10",
        shadowOffset: naParede ? { width: 4, height: 7 } : { width: 2, height: 3 },
        shadowOpacity: noite ? 0.55 : naParede ? 0.3 : 0.2,
        shadowRadius: naParede ? 7 : 5,
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
        {escuro ? (
          <Image
            source={ARTE[item.id]}
            tintColor={SOMBRA_DA_NOITE}
            style={[StyleSheet.absoluteFill, { opacity: escuro }]}
            contentFit="fill"
            accessible={false}
          />
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

/**
 * A LUZ DE UM ITEM, tirada da ficha dele (`item.luz`): o miolo aceso, o
 * clarão em volta e, para quem ilumina de verdade, a luz larga na parede e a
 * poça no chão. Tudo sai da `potencia` (a lâmpada é o 1): um item novo só
 * precisa da ficha no catálogo, e nada aqui muda.
 */
function LuzDoItem({
  item,
  largura: L,
  altura,
}: {
  item: ItemDoQuarto;
  largura: number;
  altura: number;
}) {
  const luz = item.luz;
  if (!luz) return null;
  const p = luz.potencia;
  const c = caixaDoItem(item, L, altura);
  const cx = c.left + c.width * luz.de[0];
  const cy = c.top + c.height * luz.de[1];
  return (
    <>
      {/* A luz larga, na parede e nos objetos em volta: só de luz noturna para cima. */}
      {p >= 0.5 ? (
        <Brilho
          cx={cx}
          cy={cy + c.height * 0.3}
          raio={L * (0.12 + 0.44 * p)}
          tom={luz.tom}
          forca={0.5 * p}
        />
      ) : null}
      <Brilho cx={cx} cy={cy} raio={L * (0.06 + 0.18 * p)} tom={luz.tom} forca={0.15 + 0.55 * p} />
      <Brilho
        cx={cx}
        cy={cy}
        raio={L * (0.03 + 0.055 * p)}
        tom={clarear(luz.tom, 0.55)}
        forca={0.3 + 0.7 * p}
      />
      {luz.chao ? (
        <Brilho
          cx={cx}
          cy={c.top + c.height}
          raio={L * 0.3 * p}
          achatar={0.36}
          tom={luz.tom}
          forca={0.5 * p}
        />
      ) : null}
    </>
  );
}

/** Uma luz redonda (ou achatada), somada ao quarto (`screen`). */
function Brilho({
  cx,
  cy,
  raio,
  tom,
  forca,
  achatar = 1,
}: {
  cx: number;
  cy: number;
  raio: number;
  tom: string;
  forca: number;
  achatar?: number;
}) {
  const w = raio * 2;
  const h = w * achatar;
  const id = `brilho-${tom.slice(1)}-${Math.round(raio)}-${Math.round(cy)}`;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: cx - w / 2,
        top: cy - h / 2,
        width: w,
        height: h,
        mixBlendMode: "screen",
      }}
    >
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={tom} stopOpacity={forca} />
            <Stop offset="0.42" stopColor={tom} stopOpacity={forca * 0.42} />
            <Stop offset="1" stopColor={tom} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * O feixe de luz da janela (o sol ou o luar): da diagonal do vidro até a
 * mancha no chão, somado ao quarto. As bordas são CINCO camadas, cada uma
 * mais estreita: a luz some aos poucos, sem a quina dura de um triângulo.
 */
function Feixe({
  id,
  largura: L,
  altura: A,
  janela,
  chao,
  tom,
  forca,
}: {
  id: string;
  largura: number;
  altura: number;
  janela: readonly (readonly [number, number])[];
  chao: readonly (readonly [number, number])[];
  tom: string;
  forca: number;
}) {
  const camadas = [0, 0.12, 0.24, 0.36, 0.48];
  const ponto = (a: readonly number[], b: readonly number[], t: number) =>
    `${(a[0]! + (b[0]! - a[0]!) * t) * L},${(a[1]! + (b[1]! - a[1]!) * t) * A}`;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { mixBlendMode: "screen" }]}>
      <Svg width={L} height={A}>
        <Defs>
          <Degrade id={`feixe-${id}`} x1="0.16" y1="0.24" x2="0.5" y2="0.62">
            <Stop offset="0" stopColor={tom} stopOpacity={forca} />
            <Stop offset="0.7" stopColor={tom} stopOpacity={forca * 0.55} />
            <Stop offset="1" stopColor={tom} stopOpacity={0} />
          </Degrade>
        </Defs>
        {camadas.map((t) => (
          <Polygon
            key={t}
            points={[
              ponto(janela[0]!, janela[1]!, t / 2),
              ponto(janela[0]!, janela[1]!, 1 - t / 2),
              ponto(chao[0]!, chao[1]!, t / 2),
              ponto(chao[0]!, chao[1]!, 1 - t / 2),
            ].join(" ")}
            fill={`url(#feixe-${id})`}
          />
        ))}
      </Svg>
    </View>
  );
}

/** O escuro dos cantos: dá fundo ao quarto, e a luz aparece contra ele. */
function Cantos({
  largura,
  altura,
  tom,
  forca,
}: {
  largura: number;
  altura: number;
  tom: string;
  forca: number;
}) {
  return (
    <Svg width={largura} height={altura} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="cantos-do-quarto" cx="46%" cy="42%" rx="74%" ry="56%">
          <Stop offset="0.5" stopColor={tom} stopOpacity={0} />
          <Stop offset="1" stopColor={tom} stopOpacity={forca} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={largura} height={altura} fill="url(#cantos-do-quarto)" />
    </Svg>
  );
}

/** As estrelinhas da parede acendem e apagam devagar, como as que brilham no escuro. */
function EstrelasQuePiscam() {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (reduzido) return;
    const ir = (para: number, ms: number) =>
      Animated.timing(v, {
        toValue: para,
        duration: ms,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      });
    const laco = Animated.loop(Animated.sequence([ir(1, 1700), ir(0.15, 2100)]));
    laco.start();
    return () => laco.stop();
  }, [reduzido, v]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { mixBlendMode: "screen" }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: v }]}>
        <Image
          source={ESTRELAS_DA_NOITE}
          style={StyleSheet.absoluteFill}
          contentFit="fill"
          accessible={false}
        />
      </Animated.View>
    </View>
  );
}

/* [x, y, tamanho, atraso em ms]: de dia, a poeira dourada na faixa do sol; de
   noite, os vaga-lumes pelo quarto. */
type Ponto = readonly [number, number, number, number];
const CINTILAS_DO_DIA: readonly Ponto[] = [
  [0.24, 0.27, 4, 0],
  [0.33, 0.34, 3, 900],
  [0.41, 0.42, 5, 1700],
  [0.3, 0.46, 3, 2600],
  [0.5, 0.5, 4, 400],
  [0.57, 0.38, 3, 3100],
  [0.2, 0.37, 3, 2100],
  [0.46, 0.31, 3, 1300],
];
const CINTILAS_DA_NOITE: readonly Ponto[] = [
  [0.14, 0.44, 4, 0],
  [0.36, 0.3, 3, 1200],
  [0.62, 0.47, 4, 2300],
  [0.82, 0.3, 3, 700],
  [0.9, 0.5, 4, 3000],
  [0.5, 0.62, 3, 1800],
  [0.27, 0.58, 3, 2700],
  [0.72, 0.6, 4, 400],
];

function Cintilas({
  noite,
  largura,
  altura,
}: {
  noite?: boolean;
  largura: number;
  altura: number;
}) {
  const reduzido = useMovimentoReduzido();
  if (reduzido) return null;
  return (
    <>
      {(noite ? CINTILAS_DA_NOITE : CINTILAS_DO_DIA).map(([x, y, t, atraso], i) => (
        <Cintila
          key={i}
          x={x * largura}
          y={y * altura}
          tamanho={t}
          atraso={atraso}
          tom={noite ? "#ffe9a6" : "#fff6d6"}
        />
      ))}
    </>
  );
}

function Cintila({
  x,
  y,
  tamanho,
  atraso,
  tom,
}: {
  x: number;
  y: number;
  tamanho: number;
  atraso: number;
  tom: string;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const laco = Animated.loop(
      Animated.sequence([
        Animated.delay(atraso),
        Animated.timing(v, {
          toValue: 1,
          duration: 4200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );
    laco.start();
    return () => laco.stop();
  }, [atraso, v]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: tamanho,
        height: tamanho,
        borderRadius: tamanho,
        backgroundColor: tom,
        boxShadow: `0px 0px ${tamanho * 2}px ${tom}`,
        opacity: v.interpolate({ inputRange: [0, 0.25, 0.7, 1], outputRange: [0, 0.95, 0.7, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, -22] }) },
          { translateX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 5, -2] }) },
        ],
      }}
    />
  );
}

/* ── O alto ───────────────────────────────────────────────────────────── */

function FalaDaBolha({ fala, pose }: { fala: string; pose: HumorDaArte }) {
  return (
    <View accessibilityLiveRegion="polite" style={{ flex: 1 }}>
      <VidroLilas
        estilo={{
          minHeight: ALVO_MINIMO + 6,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingLeft: 5,
          paddingRight: 12,
        }}
      >
        <View accessible={false} importantForAccessibility="no-hide-descendants">
          <ArteDaBolha humor={pose} tamanho={40} />
        </View>
        <Text
          numberOfLines={2}
          style={{ flex: 1, ...fonte.forte, fontSize: 13, lineHeight: 17, color: TINTA }}
        >
          {fala}
        </Text>
        <Heart size={14} color={ROXO} fill={ROXO} strokeWidth={2} />
      </VidroLilas>
    </View>
  );
}

function Saldo({ cantinho }: { cantinho: CantinhoOk | null | "lendo" }) {
  if (!cantinho || cantinho === "lendo") return null;
  return (
    <View accessible accessibilityLabel={`${cantinho.balance} sementinhas`}>
      <VidroLilas
        estilo={{
          minHeight: ALVO_MINIMO + 6,
          flexDirection: "row",
          alignItems: "center",
          gap: 3,
          paddingHorizontal: 11,
        }}
      >
        <Text allowFontScaling={false} style={{ fontSize: 16 }}>
          🌱
        </Text>
        <Text style={{ ...fonte.forte, fontSize: 17, color: TINTA, fontVariant: ["tabular-nums"] }}>
          {cantinho.balance}
        </Text>
      </VidroLilas>
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
    <View>
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
      </BotaoRedondo>
      {espera && !aberta ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 3,
            right: 3,
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: "#ef4444",
            borderWidth: 2,
            borderColor: cor.branco,
          }}
        />
      ) : null}
    </View>
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
    >
      <LinearGradient
        colors={["rgba(255,250,243,0.97)", "rgba(255,236,220,0.95)"]}
        style={{
          width: 212,
          borderRadius: 20,
          ...curva,
          padding: 11,
          gap: 6,
          borderWidth: 1.5,
          borderStyle: "dashed",
          borderColor: acabouDeCumprir === missao.id ? OURO : "#f0c7a6",
          boxShadow: "0px 10px 24px -10px rgba(76,29,149,0.5)",
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
              backgroundColor: "#f3dccb",
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
            style={{
              ...fonte.forte,
              fontSize: 13,
              color: cor.texto,
              fontVariant: ["tabular-nums"],
            }}
          >
            {feitos} / {total}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

/* ── A bandeja ────────────────────────────────────────────────────────── */

function Abas({ ativa, aoEscolher }: { ativa: Categoria; aoEscolher: (c: Categoria) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingHorizontal: espaco.sm, paddingVertical: 4 }}
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
          >
            <LinearGradient
              colors={
                sim
                  ? ["#a487fb", "#7c4fe8", "#6431d6"]
                  : ["rgba(255,255,255,0.86)", "rgba(240,232,255,0.7)"]
              }
              style={{
                minWidth: 74,
                minHeight: 52,
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                paddingHorizontal: 8,
                borderRadius: 18,
                ...curva,
                borderWidth: 1.5,
                borderColor: sim ? "rgba(226,214,255,0.9)" : "rgba(255,255,255,0.9)",
                boxShadow: sim
                  ? "0px 6px 14px -4px rgba(100,49,214,0.7), 0px 0px 10px rgba(164,135,251,0.5)"
                  : "0px 3px 8px -4px rgba(76,29,149,0.25)",
              }}
            >
              <Image
                source={ARTE[c.icone]}
                style={{ width: 24, height: 24 }}
                contentFit="contain"
              />
              <Text style={{ ...fonte.forte, fontSize: 13, color: sim ? cor.branco : TINTA }}>
                {c.nome}
              </Text>
            </LinearGradient>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Bandeja({
  categoria,
  quarto,
  vitrine,
  lendo,
  aoTocar,
}: {
  categoria: Categoria;
  quarto: Quartinho;
  vitrine: VitrineDoQuarto;
  lendo: boolean;
  aoTocar: (item: ItemDoQuarto, s: Situacao) => void;
}) {
  const itens = ITENS.filter((i) => i.categoria === categoria);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      /* A folga em volta é para o brilho dourado do escolhido não ser cortado. */
      contentContainerStyle={{ gap: espaco.sm, paddingHorizontal: espaco.sm, paddingVertical: 10 }}
    >
      {itens.map((item) => {
        const s = situacaoDoItem(item, quarto, vitrine);
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
  const fechado = s?.tipo === "comprar" || s?.tipo === "missao" || s?.tipo === "em-breve";
  const rotulo =
    s === null
      ? ""
      : s.tipo === "comprar"
        ? `${s.preco}`
        : s.tipo === "em-breve"
          ? "Em breve"
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
          ? `${item.nome}, ${s.preco} sementinhas. Toque para comprar`
          : s?.tipo === "em-breve"
            ? `${item.nome}, ${s.quando.toLowerCase()} na lojinha`
            : s?.tipo === "missao"
              ? `${item.nome}, presente da missão ${s.missao.texto}`
              : `${item.nome}${posto ? ", no quarto. Toque para tirar" : ". Toque para pôr no quarto"}`
      }
      disabled={s === null}
      onPress={aoTocar}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.95 : 1 }] })}
    >
      <LinearGradient
        colors={posto ? ["#fffdf6", "#fff1d6"] : ["#ffffff", "#f1e9ff"]}
        style={{
          width: 86,
          height: 96,
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          borderRadius: 20,
          ...curva,
          borderWidth: posto ? 2.5 : 1.5,
          borderColor: posto ? OURO : "rgba(255,255,255,0.95)",
          boxShadow: posto
            ? "0px 0px 14px rgba(245,196,81,0.85), 0px 6px 12px -6px rgba(180,120,20,0.5)"
            : "0px 6px 12px -6px rgba(76,29,149,0.35)",
        }}
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
          {s?.tipo === "missao" || s?.tipo === "em-breve" ? (
            <Lock size={13} color={cor.textoApagado} strokeWidth={2.4} />
          ) : null}
          <Text
            style={{
              ...fonte.forte,
              fontSize: 13,
              color: posto ? "#8a4f00" : fechado ? cor.textoApagado : TINTA,
            }}
          >
            {rotulo}
          </Text>
        </View>
      </LinearGradient>
      {posto ? (
        <View
          style={{
            position: "absolute",
            top: -5,
            right: -5,
            width: 24,
            height: 24,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: OURO,
            borderWidth: 2,
            borderColor: cor.branco,
            boxShadow: "0px 2px 6px rgba(180,120,20,0.5)",
          }}
        >
          <Check size={14} color={TINTA} strokeWidth={3.2} />
        </View>
      ) : null}
    </Pressable>
  );
}
