import { Image } from "expo-image";
import Check from "lucide-react-native/icons/check";
import Lock from "lucide-react-native/icons/lock";
import Sparkles from "lucide-react-native/icons/sparkles";
import Trophy from "lucide-react-native/icons/trophy";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Animated, FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { ARTE_DO_CONJUNTO, ARTE_DO_ITEM } from "@/components/arte-do-cantinho";
import {
  CANTINHO_COMPLETION_MIN,
  CANTINHO_COMPLETIONIST_ID,
  cantinhoCategoriasCompletas,
  isCantinhoCollectionComplete,
  type CantinhoItem,
  type CantinhoType,
} from "@/lib/cantinho";
import { CONJUNTO_POR_ID } from "@/lib/conjuntos";
import { SKIN_KEY } from "@/lib/trilha-skins";
import { faltamTrofeus } from "@/lib/trofeus";
import { Botao, Cartao, NaoConsegueLer, TituloDaSecao, selecao } from "~/componentes/base";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { useJornada } from "~/componentes/jornada/usarJornada";
import {
  comprarItem,
  equiparOCenario,
  lerALojaPorFase,
  lerOCantinho,
  type CantinhoOk,
} from "~/componentes/recompensas/economia-do-cantinho";
import { GanheMais } from "~/componentes/recompensas/ganhe-mais";
import {
  Broto,
  Contagem,
  Esqueleto,
  PilulaDeAcao,
  SilencioDoCuidado,
  vibrar,
} from "~/componentes/recompensas/pecas";
import {
  categoriasDaLoja,
  conjuntosDaLoja,
  itensDaLoja,
  situacaoNaLoja,
  type LojaPorFase,
} from "~/lib/jornada/enfeites";
import { quandoAbre, semanaDaLoja, type ItemPorFase } from "~/lib/jornada/loja-por-fase";
import { gravarChave } from "~/lib/jornada/loja";
import { canto, cor, curva, escala, espaco, fonte, luz, margem, ouro, sombra } from "~/tema";

/**
 * O MEU CANTINHO — a lojinha de sementinhas (o `CantinhoTab` do site, em
 * src/components/cantinho-tab.tsx), redesenhada em 18/11/2026: a VITRINE
 * primeiro. Logo abaixo do topo vêm as fichas de categoria e a grade (três
 * colunas, cada enfeite num pedestal); depois dela, quando chegam os
 * próximos, os conjuntos e, por último, "Ganhe mais sementinhas". O saldo
 * mora no topo da tela (a pílula do cabeçalho), e não num cartão por aba.
 *
 * ⚠️ DESEMPENHO: a grade é uma `FlatList` virtualizada (o catálogo tem ~110
 * itens; antes montava todos de uma vez, cada um com degradê e duas sombras),
 * o ladrilho é `memo` e recebe um `aoAgir(id)` estável — um toque em "Usar"
 * não recalcula a prateleira inteira. A leitura do Cantinho mora na tela das
 * Recompensas (`useLeituraDoCantinho`): trocar de aba não relê nem pisca.
 *
 * O que é diferente do site, e por quê:
 *  · Sem nenhuma porta de compra com dinheiro (a pílula do saldo abre o
 *    "Ganhe mais", e não a loja paga do site). Dos itens pagos do site, só a
 *    parte que a LOJA POR FASE vende por sementinhas, abrindo com a gestação
 *    — ver `itensDaLoja` e `~/lib/jornada/loja-por-fase`.
 *  · Sem o "Céu do app": ele veste a tela inicial do SITE.
 *
 * O cantinho em si mora na trilha: o que ela compra aqui aparece lá.
 */

/* ── A leitura (mora na tela das Recompensas) ──────────────────────────── */

export type LeituraDoCantinho = {
  leitura: CantinhoOk | null | "carregando";
  owned: string[];
  setOwned: (f: (o: string[]) => string[]) => void;
  equipado: string | null;
  setEquipado: (id: string | null) => void;
  colecao: { tem: number; total: number };
  setColecao: (f: (c: { tem: number; total: number }) => { tem: number; total: number }) => void;
  trofeus: number;
  /** `null` = o banco ainda sem a loja por fase (ou leitura falha): a vitrine de antes. */
  porFase: Map<string, ItemPorFase> | null;
  ler: () => void;
};

export function useLeituraDoCantinho(aoLerSaldo: (n: number) => void): LeituraDoCantinho {
  const [leitura, setLeitura] = useState<CantinhoOk | null | "carregando">("carregando");
  const [owned, setOwned] = useState<string[]>([]);
  const [equipado, setEquipado] = useState<string | null>(null);
  const [colecao, setColecao] = useState({ tem: 0, total: CANTINHO_COMPLETION_MIN });
  const [trofeus, setTrofeus] = useState(0);
  const [porFase, setPorFase] = useState<Map<string, ItemPorFase> | null>(null);

  const ler = useCallback(() => {
    setLeitura("carregando");
    void lerOCantinho().then((r) => {
      setLeitura(r);
      if (!r) return;
      setOwned(r.owned);
      setEquipado(r.equippedFundo);
      setColecao({ tem: r.collectionOwned, total: r.collectionTotal || CANTINHO_COMPLETION_MIN });
      setTrofeus(r.trofeus);
      if (!r.careMode) aoLerSaldo(r.balance);
    });
  }, [aoLerSaldo]);
  useEffect(() => {
    ler();
    void lerALojaPorFase().then(setPorFase);
  }, [ler]);

  return {
    leitura,
    owned,
    setOwned,
    equipado,
    setEquipado,
    colecao,
    setColecao,
    trofeus,
    porFase,
    ler,
  };
}

/* ── A aba ─────────────────────────────────────────────────────────────── */

/** O ladrilho tem altura fixa: é o que deixa a lista saber onde cada fileira está. */
const ALTURA_DO_LADRILHO = 190;
const VAO = espaco.md;
const COLUNAS = 3;

type EstadoDoLadrilho =
  | "comprar"
  | "longe"
  | "fase"
  | "trofeus"
  | "coroa"
  | "usar"
  | "em-uso"
  | "tem"
  | "coroa-tem";

export function AbaDoCantinho({
  cantinho,
  saldo,
  cuidado,
  aoMudarSaldo,
  aoVerTrilha,
  avisar,
  ganheAberto,
  aoAlternarGanhe,
  aoFesta,
  refDaLista,
  largura,
  fim,
}: {
  cantinho: LeituraDoCantinho;
  /** O saldo da tela (dono: Recompensas), para as duas abas concordarem. */
  saldo: number | null;
  cuidado: boolean;
  /** O saldo depois de uma compra ou de um bônus: este vale sempre. */
  aoMudarSaldo: (n: number) => void;
  aoVerTrilha: () => void;
  avisar: (texto: string) => void;
  ganheAberto: boolean;
  aoAlternarGanhe: () => void;
  /** O confete da compra que fecha um conjunto: a tela o desenha, fora da rolagem. */
  aoFesta: () => void;
  refDaLista: RefObject<FlatList<CantinhoItem> | null>;
  /** A largura da página (a tela inteira). */
  largura: number;
  /** O espaço embaixo da rolagem. */
  fim: number;
}) {
  /* A jornada dela: a pele das bolinhas mora no blob (`dc-path-skin`), e a
     semana dela decide o que a loja por fase já abriu. */
  const { dia, loja } = useJornada();
  const skinAtiva =
    typeof loja.blob[SKIN_KEY] === "string" ? (loja.blob[SKIN_KEY] as string) : null;
  const { leitura, owned, setOwned, equipado, setEquipado, colecao, setColecao, trofeus, porFase } =
    cantinho;

  const [cat, setCat] = useState<CantinhoType | "all">("all");
  const [comprando, setComprando] = useState<string | null>(null);
  /* O ladrilho que acabou de ser comprado dá um pulo (o `n` reinicia o pulo). */
  const [pulo, setPulo] = useState<{ id: string; n: number } | null>(null);
  const alturaDaCabeca = useRef(0);

  const semana = semanaDaLoja({
    semanaDaGestacao: dia.modo === "gestacao" ? dia.semana : null,
    nasceu: dia.modo === "pos",
  });
  const fase = useMemo<LojaPorFase | null>(
    () => (porFase ? { porItem: porFase, semana } : null),
    [porFase, semana],
  );
  const itens = useMemo(() => itensDaLoja(owned, fase), [owned, fase]);
  const categorias = useMemo(() => categoriasDaLoja(itens), [itens]);
  const conjuntos = useMemo(() => conjuntosDaLoja(owned, fase), [owned, fase]);
  /* Quando chega o próximo lote — o que faz a loja ter futuro. */
  const proximaFase = useMemo(() => {
    if (!porFase) return null;
    const futuras = [...new Set([...porFase.values()].map((v) => v.semana))]
      .filter((s) => s > semana)
      .sort((a, b) => a - b);
    return futuras[0] ?? null;
  }, [porFase, semana]);
  const daCategoria = useMemo(
    () => (cat === "all" ? itens : itens.filter((i) => i.type === cat)),
    [itens, cat],
  );
  const possui = useMemo(() => new Set(owned), [owned]);

  const largDoLadrilho = Math.floor((largura - margem.tela * 2 - VAO * (COLUNAS - 1)) / COLUNAS);

  /* A ação do ladrilho lê o estado MAIS NOVO por uma referência: o
     `aoAgir(id)` que desce para a grade nunca muda, e o `memo` do ladrilho
     segura. */
  const agir = useRef<(id: string) => void>(() => {});
  agir.current = (id: string) => {
    const item = itens.find((i) => i.id === id);
    if (!item) return;
    if (!possui.has(id)) {
      void comprar(item);
      return;
    }
    if (item.type === "trilha") usarBolinhas(skinAtiva === id ? null : id);
    else if (item.type === "fundo") void usarCenario(equipado === id ? null : id);
  };
  const aoAgir = useCallback((id: string) => agir.current(id), []);

  const renderItem = useCallback(
    ({ item: i }: { item: CantinhoItem }) => {
      const tem = possui.has(i.id);
      const emBreve =
        situacaoNaLoja(i, owned, fase) === "em-breve"
          ? quandoAbre(porFase?.get(i.id)?.semana ?? 0)
          : null;
      const { estado, nota } = estadoDoLadrilho(i, {
        tem,
        emBreve,
        saldo,
        trofeus,
        colecao,
        emUso: i.type === "trilha" ? skinAtiva === i.id : equipado === i.id,
      });
      return (
        <Ladrilho
          item={i}
          largura={largDoLadrilho}
          estado={estado}
          nota={nota}
          comprando={comprando === i.id}
          pulo={pulo?.id === i.id ? pulo.n : 0}
          aoAgir={aoAgir}
        />
      );
    },
    [
      possui,
      owned,
      fase,
      porFase,
      saldo,
      trofeus,
      colecao,
      skinAtiva,
      equipado,
      largDoLadrilho,
      comprando,
      pulo,
      aoAgir,
    ],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<CantinhoItem> | null | undefined, indice: number) => ({
      length: ALTURA_DO_LADRILHO + VAO,
      offset: margem.tela + alturaDaCabeca.current + (ALTURA_DO_LADRILHO + VAO) * indice,
      index: indice,
    }),
    [],
  );

  /* Modo Cuidado: a prateleira inteira se cala, não só o saldo (o servidor já
     devolve nada possuído; a tela não mostra o catálogo à venda). */
  if (cuidado || (leitura && leitura !== "carregando" && leitura.careMode)) {
    return (
      <Pagina fim={fim}>
        <SilencioDoCuidado />
      </Pagina>
    );
  }
  if (leitura === "carregando") {
    return (
      <Pagina fim={fim}>
        <Esqueleto rotulo="Carregando o Meu Cantinho" />
      </Pagina>
    );
  }
  /* A falha vem ANTES da vitrine: com o saldo em zero por falha, todo preço
     viraria "faltam N" e todo item dela viraria comprável de novo. */
  if (!leitura) {
    return (
      <Pagina fim={fim}>
        <NaoConsegueLer
          sossego="As suas sementinhas e os seus enfeites continuam guardados."
          aoTentar={cantinho.ler}
        />
      </Pagina>
    );
  }

  const enfeitesDela = itens.filter(
    (i) => possui.has(i.id) && i.type !== "fundo" && i.type !== "tema",
  );

  async function comprar(item: CantinhoItem) {
    if (comprando) return;
    if (saldo != null && saldo < item.price) {
      avisar(`Faltam ${item.price - saldo} sementinhas para ${item.name}.`);
      return;
    }
    setComprando(item.id);
    const r = await comprarItem(item.id, !!porFase?.has(item.id) && !!item.premium);
    setComprando(null);
    if (!r) {
      vibrar("erro");
      avisar("Não deu para comprar agora. Tente de novo daqui a pouco.");
      return;
    }
    if (r.ok) {
      aoMudarSaldo(r.balance);
      /* A Coroa e a contagem de categorias pela MESMA régua do servidor. Lê o
         `owned` do fechamento: `comprando` impede duas compras ao mesmo tempo. */
      const comEle = owned.includes(item.id) ? owned : [...owned, item.id];
      const prox =
        isCantinhoCollectionComplete(comEle) && !comEle.includes(CANTINHO_COMPLETIONIST_ID)
          ? [...comEle, CANTINHO_COMPLETIONIST_ID]
          : comEle;
      setOwned(() => prox);
      setColecao((c) => ({ ...c, tem: cantinhoCategoriasCompletas(prox) }));
      vibrar("sucesso");
      setPulo((p) => ({ id: item.id, n: (p?.n ?? 0) + 1 }));
      if (r.conjuntosNovos?.length) {
        const nomes = r.conjuntosNovos
          .map((id) => CONJUNTO_POR_ID[id]?.nome)
          .filter(Boolean)
          .join(" · ");
        aoFesta();
        avisar(`Conjunto completo: ${nomes}. +${r.bonusNovo ?? 0} sementinhas`);
      } else {
        avisar(`${item.name} já está na sua trilha.`);
      }
      return;
    }
    vibrar("erro");
    avisar(r.error || "Não deu para comprar agora.");
    /* Só a recusa por saldo traz o saldo de verdade; nas outras o servidor
       devolve 0 por padrão, e zero sobre uma falha é uma afirmação falsa. */
    if (r.motivo === "saldo_insuficiente" && typeof r.balance === "number") aoMudarSaldo(r.balance);
    /* Comprado noutro aparelho: basta refletir (o código, nunca a frase). */
    if (r.motivo === "ja_possui") setOwned((o) => (o.includes(item.id) ? o : [...o, item.id]));
  }

  /* A pele das bolinhas NÃO vai ao servidor: mora no blob da jornada, que já
     sincroniza entre aparelhos — no site e no app, a mesma chave. */
  function usarBolinhas(id: string | null) {
    gravarChave(SKIN_KEY, id);
    avisar(id ? "Bolinhas trocadas na trilha." : "As bolinhas voltaram ao normal.");
  }

  async function usarCenario(id: string | null) {
    const antes = equipado;
    setEquipado(id);
    const ok = await equiparOCenario(id);
    if (!ok) {
      setEquipado(antes);
      vibrar("erro");
      avisar("Não deu para trocar o cenário agora.");
      return;
    }
    avisar(id ? "Cenário trocado na trilha." : "A trilha voltou ao cenário de sempre.");
  }

  const cabeca = (
    <View
      onLayout={(e) => {
        alturaDaCabeca.current = e.nativeEvent.layout.height;
      }}
      style={{ gap: espaco.md, paddingBottom: espaco.md }}
    >
      {/* Quem ainda não comprou nada: de onde vêm as sementinhas, e onde o
          que ela compra aparece. */}
      {enfeitesDela.length === 0 ? (
        <View style={{ gap: espaco.xs }}>
          <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoCorpo }}>
            Você ganha sementinhas nas aulas e nas atividades do dia. O que comprar aqui aparece na
            sua trilha.
          </Text>
          <Botao
            rotulo="Ver a minha trilha"
            tipo="texto"
            tamanho="compacto"
            aoTocar={aoVerTrilha}
            estilo={{ alignSelf: "flex-start", marginLeft: -espaco.md }}
          />
        </View>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -margem.tela }}
        contentContainerStyle={{ gap: espaco.sm, paddingHorizontal: margem.tela }}
        accessibilityRole="tablist"
      >
        {[{ key: "all" as const, label: "Tudo" }, ...categorias].map((c) => (
          <FichaDaCategoria
            key={c.key}
            rotulo={c.label}
            ativa={cat === c.key}
            aoTocar={() => {
              selecao();
              setCat(c.key);
            }}
          />
        ))}
      </ScrollView>
    </View>
  );

  const pe = (
    <View style={{ gap: espaco.xxl, paddingTop: espaco.sm }}>
      {/* A loja por fase: quando chega o próximo lote de enfeites. Uma linha
          calma, e não uma caixa de alerta: é uma boa notícia. */}
      {proximaFase != null ? (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: espaco.sm }}>
          <View style={{ paddingTop: 2 }}>
            <Sparkles size={16} color={cor.textoApagado} strokeWidth={2.2} />
          </View>
          <Text style={{ flex: 1, ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}>
            Enfeites novos chegam a cada fase. Os próximos chegam{" "}
            {quandoAbre(proximaFase).toLowerCase()}.
          </Text>
        </View>
      ) : null}

      {/* OS CONJUNTOS — os completos primeiro, e a contagem é "3 de 4", que é
          estado, nunca "falta 1!", que é dívida. Só os que dá para fechar aqui:
          todo conjunto tem um item pago no site, então para quem nunca comprou
          lá (e sem a loja por fase) a seção não aparece. */}
      {conjuntos.length > 0 ? (
        <View style={{ gap: espaco.md }}>
          <TituloDaSecao
            direita={
              <Contagem
                texto={`${conjuntos.filter((p) => p.completo).length} de ${conjuntos.length}`}
              />
            }
          >
            Conjuntos
          </TituloDaSecao>
          <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}>
            Feche um conjunto e ganhe sementinhas a mais.
          </Text>
          <Cartao estilo={{ padding: 0, gap: 0 }}>
            {conjuntos.map((p, i) => (
              <LinhaDoConjunto
                key={p.conjunto.id}
                arte={ARTE_DO_CONJUNTO[p.conjunto.id]}
                emoji={p.conjunto.emoji}
                nome={p.conjunto.nome}
                descricao={p.conjunto.descricao}
                tem={p.tem}
                total={p.total}
                completo={p.completo}
                primeira={i === 0}
              />
            ))}
          </Cartao>
        </View>
      ) : null}

      <GanheMais
        aberta={ganheAberto}
        aoAlternar={aoAlternarGanhe}
        aoGanhar={(n) => {
          if (saldo != null) aoMudarSaldo(saldo + n);
        }}
        avisar={avisar}
      />
    </View>
  );

  return (
    <FlatList
      ref={refDaLista}
      data={daCategoria}
      keyExtractor={(i) => i.id}
      numColumns={COLUNAS}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      initialNumToRender={8}
      maxToRenderPerBatch={6}
      windowSize={5}
      removeClippedSubviews
      columnWrapperStyle={{ gap: VAO, marginBottom: VAO }}
      contentContainerStyle={{ padding: margem.tela, paddingBottom: fim }}
      ListHeaderComponent={cabeca}
      ListFooterComponent={pe}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    />
  );
}

/** A página sem a grade (o silêncio, o esqueleto, a falha): rola sozinha. */
function Pagina({ children, fim }: { children: ReactNode; fim: number }) {
  return (
    <ScrollView
      contentContainerStyle={{ padding: margem.tela, paddingBottom: fim }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

/**
 * O que o ladrilho mostra, numa regra só (puro): o estado (que pílula, ou
 * nenhuma) e a nota de baixo ("faltam 12", "3º trimestre"). O saldo
 * desconhecido (`null`) não tranca nada: quem decide é o servidor.
 */
function estadoDoLadrilho(
  i: CantinhoItem,
  o: {
    tem: boolean;
    emBreve: string | null;
    saldo: number | null;
    trofeus: number;
    colecao: { tem: number; total: number };
    emUso: boolean;
  },
): { estado: EstadoDoLadrilho; nota: string | null } {
  const coroa = i.id === CANTINHO_COMPLETIONIST_ID;
  if (o.tem) {
    if (coroa) return { estado: "coroa-tem", nota: null };
    if (i.type === "trilha" || i.type === "fundo")
      return { estado: o.emUso ? "em-uso" : "usar", nota: null };
    return { estado: "tem", nota: null };
  }
  if (o.emBreve != null) return { estado: "fase", nota: curtoDoQuando(o.emBreve) };
  if (coroa) return { estado: "coroa", nota: `${o.colecao.tem} de ${o.colecao.total}` };
  const faltam = faltamTrofeus(i.id, o.trofeus);
  if (faltam > 0) return { estado: "trofeus", nota: `faltam ${faltam}` };
  if (o.saldo != null && o.saldo < i.price)
    return { estado: "longe", nota: `faltam ${i.price - o.saldo}` };
  return { estado: "comprar", nota: null };
}

/** "No 3º trimestre" → "3º trimestre": cabe numa linha do ladrilho. */
function curtoDoQuando(q: string): string {
  const s = q.replace(/^(No|Na)\s+/, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ── O ladrilho ────────────────────────────────────────────────────────── */

/**
 * Um enfeite da prateleira: o pedestal (o mesmo atrás do emoji e da peça
 * 3D, para os dois estilos de arte conversarem), o nome e UMA ação. Comprar é
 * a pílula cheia; usar é a tingida; o que já está em uso ou no cantinho é só
 * um visto, sem pílula — estado não tem cara de botão.
 */
const Ladrilho = memo(function Ladrilho({
  item: i,
  largura,
  estado,
  nota,
  comprando,
  pulo,
  aoAgir,
}: {
  item: CantinhoItem;
  largura: number;
  estado: EstadoDoLadrilho;
  nota: string | null;
  comprando: boolean;
  /** Muda a cada compra deste item: o ladrilho dá um pulo. */
  pulo: number;
  aoAgir: (id: string) => void;
}) {
  const reduzido = useMovimentoReduzido();
  const escalaDoPulo = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!pulo || reduzido) return;
    const a = Animated.sequence([
      Animated.spring(escalaDoPulo, {
        toValue: 1.06,
        useNativeDriver: true,
        speed: 40,
        bounciness: 0,
      }),
      Animated.spring(escalaDoPulo, {
        toValue: 1,
        useNativeDriver: true,
        speed: 14,
        bounciness: 12,
      }),
    ]);
    a.start();
    return () => a.stop();
  }, [pulo, reduzido, escalaDoPulo]);

  const arte = ARTE_DO_ITEM[i.id];
  const coroa = estado === "coroa" || estado === "coroa-tem";
  const trancado = estado === "fase" || estado === "coroa" || estado === "trofeus";
  const agir = () => aoAgir(i.id);

  let acao: ReactNode;
  switch (estado) {
    case "comprar":
      acao = (
        <PilulaDeAcao
          tom="cheia"
          texto={String(i.price)}
          icone={<Broto tamanho={14} tinta={cor.branco} />}
          acessivel={`Comprar ${i.name} por ${i.price} sementinhas`}
          carregando={comprando}
          aoTocar={agir}
        />
      );
      break;
    case "usar":
      acao = (
        <PilulaDeAcao tom="tingida" texto="Usar" acessivel={`Usar ${i.name}`} aoTocar={agir} />
      );
      break;
    case "em-uso":
      acao = (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${i.name}: em uso. Tocar para tirar`}
          onPress={agir}
          hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
        >
          <Visto texto="Em uso" tinta={cor.sementinha} />
        </Pressable>
      );
      break;
    case "tem":
      acao = <Visto texto="No cantinho" tinta={cor.textoApagado} />;
      break;
    case "coroa-tem":
      acao = <Visto texto="Conquistada" tinta={cor.atencaoTexto} />;
      break;
    case "longe":
      acao = (
        <PilulaDeAcao
          tom="apagada"
          texto={String(i.price)}
          icone={<Broto tamanho={14} tinta={cor.textoApagado} />}
          acessivel={`${i.name}, ${i.price} sementinhas. ${nota ?? ""}`}
        />
      );
      break;
    case "coroa":
      /* A Coroa não se compra: abre sozinha com um enfeite de cada tipo. */
      acao = (
        <PilulaDeAcao
          tom="apagada"
          texto={nota ?? ""}
          icone={<Lock size={12} color={cor.textoApagado} strokeWidth={2.4} />}
          acessivel={`${i.name}: abre com um enfeite de cada tipo. Você tem ${nota ?? "0"}`}
        />
      );
      break;
    default:
      /* Trancado (a fase que ainda não chegou, os troféus): o preço vem com o
         cadeado, e a nota diz quando abre. */
      acao = (
        <PilulaDeAcao
          tom="apagada"
          texto={String(i.price)}
          icone={<Lock size={12} color={cor.textoApagado} strokeWidth={2.4} />}
          acessivel={
            estado === "fase"
              ? `${i.name}: chega ${(nota ?? "").toLowerCase()}, por ${i.price} sementinhas`
              : `${i.name}: ${nota} troféus para abrir, ${i.price} sementinhas`
          }
        />
      );
  }

  return (
    <Animated.View
      style={[
        {
          width: largura,
          height: ALTURA_DO_LADRILHO,
          alignItems: "center",
          paddingTop: espaco.md,
          paddingHorizontal: 6,
          borderRadius: canto.dentro,
          ...curva,
          backgroundColor: luz.cartao,
          borderWidth: 1,
          borderColor: cor.branco,
        },
        sombra,
        { transform: [{ scale: escalaDoPulo }] },
      ]}
    >
      <Pedestal coroa={coroa} trancado={trancado}>
        {arte ? (
          <Image
            source={arte as never}
            recyclingKey={i.id}
            style={{ width: 44, height: 44 }}
            contentFit="contain"
          />
        ) : (
          <Text allowFontScaling={false} style={{ fontSize: 32, lineHeight: 40 }}>
            {i.emoji}
          </Text>
        )}
      </Pedestal>
      <Text
        numberOfLines={2}
        style={{
          marginTop: espaco.sm,
          height: 36,
          ...fonte.media,
          ...escala.nota,
          textAlign: "center",
          color: cor.texto,
        }}
      >
        {i.name}
      </Text>
      <View style={{ marginTop: 6, height: 32, alignSelf: "stretch", justifyContent: "center" }}>
        {acao}
      </View>
      <View
        style={{ marginTop: 4, height: 18, flexDirection: "row", alignItems: "center", gap: 3 }}
      >
        {nota && estado === "trofeus" ? (
          <Trophy size={12} color={cor.textoApagado} strokeWidth={2.4} />
        ) : null}
        {nota ? (
          <Text
            numberOfLines={1}
            style={{ ...fonte.media, ...escala.nota, color: cor.textoApagado }}
          >
            {estado === "coroa" ? "um de cada tipo" : nota}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
});

/** O pedestal: um círculo só atrás de toda arte, emoji ou 3D. */
function Pedestal({
  children,
  coroa,
  trancado,
}: {
  children: ReactNode;
  coroa: boolean;
  trancado: boolean;
}) {
  return (
    <View style={{ width: 64, height: 64 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: coroa ? cor.atencaoClaro : cor.apagado,
          borderWidth: coroa ? 2 : 0,
          borderColor: ouro.medio,
        }}
      >
        <View style={{ opacity: trancado ? 0.35 : 1 }}>{children}</View>
      </View>
      {trancado ? (
        <View
          style={[
            {
              position: "absolute",
              right: -2,
              bottom: -2,
              width: 24,
              height: 24,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: cor.cartao,
            },
            sombra,
          ]}
        >
          <Lock size={12} color={cor.textoApagado} strokeWidth={2.4} />
        </View>
      ) : null}
    </View>
  );
}

/** O estado sem pílula: o visto e a palavra. */
function Visto({ texto, tinta }: { texto: string; tinta: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}>
      <Check size={14} color={tinta} strokeWidth={2.6} />
      <Text style={{ ...fonte.forte, ...escala.nota, color: tinta }}>{texto}</Text>
    </View>
  );
}

/** A ficha de categoria: a escolhida é cheia (ameixa); as outras, apagadas. */
function FichaDaCategoria({
  rotulo,
  ativa,
  aoTocar,
}: {
  rotulo: string;
  ativa: boolean;
  aoTocar: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: ativa }}
      accessibilityLabel={rotulo}
      onPress={aoTocar}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => ({
        minHeight: 36,
        justifyContent: "center",
        borderRadius: canto.pilula,
        ...curva,
        paddingHorizontal: espaco.lg,
        backgroundColor: ativa ? cor.texto : cor.apagado,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Text
        style={{
          ...fonte.forte,
          ...escala.legenda,
          color: ativa ? cor.branco : cor.texto,
        }}
      >
        {rotulo}
      </Text>
    </Pressable>
  );
}

/** Um conjunto: a arte, o nome, a descrição e a barra de peças (4 segmentos). */
function LinhaDoConjunto({
  arte,
  emoji,
  nome,
  descricao,
  tem,
  total,
  completo,
  primeira,
}: {
  arte: unknown;
  emoji: string;
  nome: string;
  descricao: string;
  tem: number;
  total: number;
  completo: boolean;
  primeira: boolean;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${nome}: ${completo ? "completo" : `${tem} de ${total}`}. ${descricao}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        paddingHorizontal: espaco.lg,
        paddingVertical: espaco.md,
        borderTopWidth: primeira ? 0 : 1,
        borderTopColor: cor.divisor,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: completo ? cor.sementinhaFundo : cor.apagado,
        }}
      >
        {arte ? (
          <Image source={arte as never} style={{ width: 44, height: 44 }} contentFit="contain" />
        ) : (
          <Text allowFontScaling={false} style={{ fontSize: 28, lineHeight: 34 }}>
            {emoji}
          </Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.xs }}>
          <Text
            numberOfLines={1}
            style={{ flexShrink: 1, ...fonte.forte, ...escala.legenda, color: cor.texto }}
          >
            {nome}
          </Text>
          {completo ? <Check size={16} color={cor.sementinha} strokeWidth={2.8} /> : null}
        </View>
        <Text
          numberOfLines={2}
          style={{ ...fonte.normal, ...escala.nota, color: cor.textoApagado }}
        >
          {descricao}
        </Text>
        <View style={{ flexDirection: "row", gap: 4, marginTop: 2 }}>
          {Array.from({ length: total }, (_, k) => (
            <View
              key={k}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: k < tem ? cor.sementinha : cor.trilho,
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
