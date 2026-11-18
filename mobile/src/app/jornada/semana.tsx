import { router, useLocalSearchParams } from "expo-router";
import { Check, ChevronLeft, ChevronRight, Lock } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { fruitEmojiForWeek } from "@/lib/gestacao";
import { bebeDaSemana } from "~/lib/bebe-da-semana";
import { Botao, Cartao, Carregando, Sobrelinha, T, Tela, toque, Tocavel } from "~/componentes/base";
import { AnelPequeno } from "~/componentes/caminho/pecas";
import { rota } from "~/componentes/jornada/bancada";
import { Descolar } from "~/componentes/jornada/efeitos";
import { BarraDoTopo, voltarParaJornada } from "~/componentes/jornada/pecas";
import { useJornada } from "~/componentes/jornada/usarJornada";
import {
  D_MINIMO,
  dataDoDia,
  diaCurto,
  diaNaSemana,
  diasDaSemana,
  quandoAbre,
  SEMANA_MINIMA,
} from "~/lib/jornada/dia";
import { carregarAulaDoDia } from "~/lib/jornada/aulas-do-app";
import { tituloCurtoDaAula } from "~/lib/jornada/aula";
import { estadoAtual, gravarChave } from "~/lib/jornada/loja";
import { CHAVE_FIGURINHAS, listaDeNumeros, type Blob } from "~/lib/jornada/momentos";
import { estadoDoNo } from "~/lib/jornada/trilha";
import { MARCOS } from "~/lib/jornada/caminho";
import { ALVO_MINIMO, canto, cor, curva, escala, espaco, fonte, margem, sombra } from "~/tema";

/**
 * A SEMANA — o álbum de uma semana: o que acontece com o bebê, os sete dias
 * com o assunto da aula de cada um e o que foi feito, e a figurinha. As
 * semanas se trocam pelas setas ao lado do título ou deslizando para o lado.
 *
 * O dia que já chegou abre a folha do dia (rever o que foi feito, ou fazer o
 * de hoje); o dia que vem mostra quando abre, com o cadeado.
 *
 * Bancada: /jornada/semana?bancada=1 [&semana=38]
 */
export default function Semana() {
  const { dia, loja } = useJornada();
  const atual = dia.modo === "gestacao" ? dia.semana : null;
  /* `?semana=N` — a barra da semana, na trilha, abre ESTA semana. */
  const { semana: pedida } = useLocalSearchParams<{ semana?: string }>();
  const inicial = (a: number | null) => {
    if (a == null) return null;
    const n = Number(pedida);
    return Number.isFinite(n) && n >= SEMANA_MINIMA ? Math.min(a, Math.floor(n)) : a;
  };
  const [semana, setSemana] = useState<number | null>(() => inicial(atual));
  /* O assunto de cada dia sai da PRÓPRIA aula (as aulas não seguem o ritmo de
     temas por dia da semana). A semana à vista e as vizinhas, guardadas pela
     sessão. */
  const [titulos, setTitulos] = useState<Record<number, string>>({});
  useEffect(() => {
    if (semana == null) return;
    let vivo = true;
    const dias = [semana - 1, semana, semana + 1]
      .filter((s) => s >= SEMANA_MINIMA && (atual == null || s <= atual))
      .flatMap((s) => diasDaSemana(s))
      .filter((D) => D >= D_MINIMO);
    void Promise.all(
      dias.map(async (D) => {
        const q = await carregarAulaDoDia(D);
        return [D, q ? tituloCurtoDaAula(q.teach) : null] as const;
      }),
    ).then((pares) => {
      if (!vivo) return;
      const novos: Record<number, string> = {};
      for (const [D, t] of pares) if (t) novos[D] = t;
      setTitulos((antes) => ({ ...antes, ...novos }));
    });
    return () => {
      vivo = false;
    };
  }, [semana, atual]);
  /* Depois do parto, a semana é uma LEMBRANÇA do álbum da gestação (1–42). */
  const [semanaDaMemoria, setSemanaDaMemoria] = useState(() => {
    const n = Number(pedida);
    return Number.isFinite(n) && n >= SEMANA_MINIMA && n <= 42 ? Math.floor(n) : 40;
  });
  useEffect(() => {
    if (semana == null && atual != null) setSemana(inicial(atual));
  }, [atual, semana]);

  /* Abrir o álbum de uma semana que já chegou guarda a figurinha dela, como no
     site (`collectSticker`). A figurinha DESCOLA só nessa primeira vez (antes
     a animação de "conquistada" se repetia a cada visita). */
  const figurinhas = listaDeNumeros(loja.blob[CHAVE_FIGURINHAS]);
  const [guardadaAgora, setGuardadaAgora] = useState<number | null>(null);
  const precisaGuardar =
    loja.pronto &&
    dia.modo === "gestacao" &&
    !dia.cuidado &&
    semana != null &&
    atual != null &&
    semana <= atual &&
    !figurinhas.includes(semana);
  useEffect(() => {
    if (!precisaGuardar || semana == null) return;
    const lista = listaDeNumeros(estadoAtual().blob[CHAVE_FIGURINHAS]);
    if (!lista.includes(semana)) {
      gravarChave(
        CHAVE_FIGURINHAS,
        [...lista, semana].sort((a, b) => a - b),
      );
      setGuardadaAgora(semana);
    }
  }, [precisaGuardar, semana]);

  if (dia.modo === "carregando") {
    return (
      <Tela bordas={["top", "bottom"]}>
        <Carregando />
      </Tela>
    );
  }
  if (dia.modo === "pos" && !dia.cuidado) {
    return (
      <MemoriaDaSemana
        semana={semanaDaMemoria}
        aoMudar={setSemanaDaMemoria}
        figurinha={figurinhas.includes(semanaDaMemoria)}
      />
    );
  }
  if (dia.modo !== "gestacao" || dia.cuidado || semana == null || atual == null) {
    return (
      <Tela bordas={["top", "bottom"]}>
        <BarraDoTopo />
        <T>As semanas acompanham a gestação. O que você fez hoje continua guardado.</T>
        <Botao rotulo="Voltar" aoTocar={voltarParaJornada} />
      </Tela>
    );
  }

  return (
    <SemanasDaGestacao
      semana={semana}
      atual={atual}
      aoMudar={setSemana}
      hojeD={dia.D}
      hoje={dia.hoje}
      blob={loja.blob}
      titulos={titulos}
      guardadaAgora={guardadaAgora}
    />
  );
}

/**
 * As semanas lado a lado, uma página por semana: desliza para trocar (como
 * as fotos do iPhone), ou usa as setas pequenas ao lado do título.
 */
function SemanasDaGestacao({
  semana,
  atual,
  aoMudar,
  hojeD,
  hoje,
  blob,
  titulos,
  guardadaAgora,
}: {
  semana: number;
  atual: number;
  aoMudar: (s: number) => void;
  hojeD: number;
  hoje: Date;
  blob: Blob;
  titulos: Record<number, string>;
  guardadaAgora: number | null;
}) {
  const { width: largura } = useWindowDimensions();
  const lista = useRef<FlatList<number>>(null);
  const semanas = useMemo(
    () => Array.from({ length: atual - SEMANA_MINIMA + 1 }, (_, i) => SEMANA_MINIMA + i),
    [atual],
  );
  const [indiceInicial] = useState(() => Math.max(0, semana - SEMANA_MINIMA));
  const irPara = useCallback(
    (s: number) => {
      const alvo = Math.max(SEMANA_MINIMA, Math.min(atual, s));
      lista.current?.scrollToIndex({ index: alvo - SEMANA_MINIMA, animated: true });
      aoMudar(alvo);
    },
    [atual, aoMudar],
  );
  const aoParar = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, largura));
      const s = Math.max(SEMANA_MINIMA, Math.min(atual, SEMANA_MINIMA + i));
      if (s !== semana) aoMudar(s);
    },
    [largura, atual, semana, aoMudar],
  );
  const figurinhas = useMemo(() => new Set(listaDeNumeros(blob[CHAVE_FIGURINHAS])), [blob]);
  const renderItem = useCallback(
    ({ item }: { item: number }) => (
      <PaginaDaSemana
        semana={item}
        atual={atual}
        largura={largura}
        hojeD={hojeD}
        hoje={hoje}
        blob={blob}
        titulos={titulos}
        figurinha={figurinhas.has(item)}
        descolar={guardadaAgora === item}
        irPara={irPara}
      />
    ),
    [atual, largura, hojeD, hoje, blob, titulos, figurinhas, guardadaAgora, irPara],
  );
  return (
    <Tela bordas={["top", "bottom"]} rolar={false} estilo={{ padding: 0, gap: 0 }}>
      <View style={{ paddingHorizontal: margem.tela, paddingTop: espaco.sm }}>
        <BarraDoTopo />
      </View>
      <FlatList
        ref={lista}
        data={semanas}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => String(s)}
        renderItem={renderItem}
        getItemLayout={(_, i) => ({ length: largura, offset: largura * i, index: i })}
        initialScrollIndex={indiceInicial}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        windowSize={3}
        onMomentumScrollEnd={aoParar}
        onScrollToIndexFailed={() => {}}
      />
    </Tela>
  );
}

const PaginaDaSemana = memo(function PaginaDaSemana({
  semana,
  atual,
  largura,
  hojeD,
  hoje,
  blob,
  titulos,
  figurinha,
  descolar,
  irPara,
}: {
  semana: number;
  atual: number;
  largura: number;
  hojeD: number;
  hoje: Date;
  blob: Blob;
  titulos: Record<number, string>;
  figurinha: boolean;
  descolar: boolean;
  irPara: (s: number) => void;
}) {
  const dias = diasDaSemana(semana).filter((D) => D >= D_MINIMO);
  const bebe = bebeDaSemana(semana);
  const estados = dias.map((D) => estadoDoNo(blob, D, hojeD));
  const fechadosNaSemana = estados.filter((n) => n.tipo !== "futuro" && n.fechado).length;
  return (
    <ScrollView
      style={{ width: largura }}
      contentContainerStyle={{
        paddingHorizontal: margem.tela,
        paddingTop: espaco.sm,
        paddingBottom: espaco.xxl,
        gap: espaco.md,
      }}
      showsVerticalScrollIndicator={false}
    >
      <CabecalhoDaSemana
        semana={semana}
        estaSemana={semana === atual}
        anterior={semana > SEMANA_MINIMA ? () => irPara(semana - 1) : undefined}
        proxima={semana < atual ? () => irPara(semana + 1) : undefined}
      />

      {/* O que acontece com o bebê nesta semana (o `AlbumSheet` do site). */}
      <Cartao>
        <Sobrelinha tinta={cor.jogo}>Nesta semana</Sobrelinha>
        <Text style={{ ...fonte.normal, ...escala.corpo, color: cor.textoCorpo }}>{bebe.desc}</Text>
        <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}>
          Tamanho de {bebe.fruit.toLowerCase()} · {bebe.size}
          {bebe.weight && bebe.weight !== "—" ? ` · ${bebe.weight}` : ""}
        </Text>
      </Cartao>

      <Cartao estilo={{ padding: 0, gap: 0, overflow: "hidden" }}>
        {dias.map((D, i) => (
          <LinhaDoDia
            key={D}
            D={D}
            hojeD={hojeD}
            hoje={hoje}
            estado={estados[i]!}
            assunto={titulos[D] ?? "Aula do dia"}
            primeira={i === 0}
          />
        ))}
      </Cartao>

      <Cartao estilo={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
        <Descolar ativo={figurinha && descolar}>
          <Text style={{ fontSize: 44, lineHeight: 52, opacity: figurinha ? 1 : 0.35 }}>
            {fruitEmojiForWeek(semana)}
          </Text>
        </Descolar>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ ...fonte.forte, ...escala.manchete, color: cor.texto }}>
            {figurinha ? "Figurinha guardada no álbum" : "Figurinha da semana"}
          </Text>
          <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}>
            {figurinha
              ? fechadosNaSemana === 0
                ? "Ela chegou junto com a semana."
                : `${fechadosNaSemana} ${fechadosNaSemana === 1 ? "dia completo" : "dias completos"} nesta semana.`
              : "Ela chega junto com a semana."}
          </Text>
        </View>
      </Cartao>
    </ScrollView>
  );
});

/**
 * O TÍTULO DA SEMANA: um só, em 28, com a fruta numa ficha e, na semana
 * atual, a pílula "esta semana". As setas pequenas ao lado trocam a semana
 * (a da frente some na semana atual, em vez de ficar apagada). Antes havia
 * dois cabeçalhos, com dois "‹" colados e funções diferentes.
 */
function CabecalhoDaSemana({
  semana,
  estaSemana,
  anterior,
  proxima,
}: {
  semana: number;
  estaSemana: boolean;
  anterior?: () => void;
  proxima?: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md, minHeight: 56 }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: canto.icone,
          ...curva,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: cor.cartao,
          ...sombra,
        }}
      >
        <Text style={{ fontSize: 22, lineHeight: 26 }}>{fruitEmojiForWeek(semana)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={{ ...fonte.display, ...escala.titulo1, letterSpacing: -0.2, color: cor.texto }}
        >
          Semana {semana}
        </Text>
        {estaSemana ? (
          <View
            style={{
              alignSelf: "flex-start",
              height: 22,
              justifyContent: "center",
              borderRadius: canto.pilula,
              paddingHorizontal: 8,
              backgroundColor: cor.primaria,
            }}
          >
            <Text style={{ ...fonte.forte, ...escala.nota, lineHeight: 16, color: cor.branco }}>
              esta semana
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: "row" }}>
        {anterior ? <SetaDaSemana lado="anterior" aoTocar={anterior} /> : null}
        {proxima ? <SetaDaSemana lado="proxima" aoTocar={proxima} /> : null}
      </View>
    </View>
  );
}

function SetaDaSemana({ lado, aoTocar }: { lado: "anterior" | "proxima"; aoTocar: () => void }) {
  const Icone = lado === "anterior" ? ChevronLeft : ChevronRight;
  return (
    <Tocavel
      rotulo={lado === "anterior" ? "Semana anterior" : "Próxima semana"}
      aoTocar={aoTocar}
      profundidade={0.9}
      estilo={{
        width: ALVO_MINIMO,
        height: ALVO_MINIMO,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icone size={20} color={cor.primaria} strokeWidth={2.6} />
    </Tocavel>
  );
}

/** Um dia da semana: o que já chegou abre a folha do dia; o que vem mostra quando abre. */
function LinhaDoDia({
  D,
  hojeD,
  hoje,
  estado: no,
  assunto,
  primeira,
}: {
  D: number;
  hojeD: number;
  hoje: Date;
  estado: ReturnType<typeof estadoDoNo>;
  assunto: string;
  primeira: boolean;
}) {
  const data = dataDoDia(D, hojeD, hoje);
  const ehHoje = no.tipo === "hoje";
  const futuro = no.tipo === "futuro";
  const momentos = no.tipo === "futuro" ? 0 : no.momentos;
  const fechado = no.tipo !== "futuro" && no.fechado;
  const status = futuro
    ? `Abre ${quandoAbre(D, hojeD, hoje)}`
    : fechado
      ? "Dia completo"
      : momentos === 0
        ? ehHoje
          ? "Nenhum momento ainda"
          : "Sem momentos neste dia"
        : `${momentos} de 5 momentos`;
  const conteudo = (pressionado: boolean) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        paddingLeft: espaco.lg,
        paddingRight: espaco.md,
        paddingVertical: 10,
        minHeight: 64,
        borderTopWidth: primeira ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: cor.borda,
        opacity: pressionado ? 0.6 : 1,
      }}
    >
      <View style={{ width: 44, alignItems: "center", gap: 2 }}>
        <Text
          style={{
            ...fonte.titulo,
            ...escala.titulo3,
            fontVariant: ["tabular-nums"],
            color: futuro ? cor.textoApagado : cor.texto,
          }}
        >
          {String(data.getDate()).padStart(2, "0")}
        </Text>
        {ehHoje ? (
          <View
            style={{
              height: 22,
              justifyContent: "center",
              borderRadius: canto.pilula,
              paddingHorizontal: 8,
              backgroundColor: cor.primaria,
            }}
          >
            <Text style={{ ...fonte.forte, ...escala.nota, lineHeight: 16, color: cor.branco }}>
              Hoje
            </Text>
          </View>
        ) : (
          <Text style={{ ...fonte.media, ...escala.nota, color: cor.textoApagado }}>
            {diaCurto(data)}
          </Text>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          numberOfLines={2}
          style={{
            ...fonte.forte,
            ...escala.chamada,
            color: futuro ? cor.textoApagado : cor.texto,
          }}
        >
          {assunto}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {fechado ? <Check size={14} color={cor.ok} strokeWidth={3} /> : null}
          <Text
            style={{
              ...fonte.normal,
              ...escala.nota,
              color: fechado ? cor.ok : cor.textoApagado,
            }}
          >
            {status}
          </Text>
        </View>
      </View>
      {futuro ? (
        <Lock size={18} color={cor.textoApagado} strokeWidth={2.2} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <AnelPequeno feitos={momentos} />
          <ChevronRight size={18} color={cor.chevron} strokeWidth={2.6} />
        </View>
      )}
    </View>
  );
  const rotulo = `Dia ${diaNaSemana(D)}${ehHoje ? ", hoje" : ""}. ${assunto}. ${status}`;
  if (futuro)
    return (
      <View accessible accessibilityLabel={rotulo}>
        {conteudo(false)}
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityHint="Abre as atividades do dia"
      onPress={() => {
        toque();
        router.push(rota(`/jornada/dia?D=${D}`) as never);
      }}
    >
      {({ pressed }) => conteudo(pressed)}
    </Pressable>
  );
}

/**
 * A semana como LEMBRANÇA, depois do parto: a página do álbum da gestação (o
 * `AlbumSheet` do site) — o que acontecia com o bebê, o tamanho, o peso, o
 * marco e a figurinha —, sem a lista dos dias, que já passaram.
 */
function MemoriaDaSemana({
  semana,
  aoMudar,
  figurinha,
}: {
  semana: number;
  aoMudar: (s: number) => void;
  figurinha: boolean;
}) {
  const bebe = bebeDaSemana(semana);
  const marco = MARCOS[semana];
  return (
    <Tela bordas={["top", "bottom"]}>
      <BarraDoTopo />
      <CabecalhoDaSemana
        semana={semana}
        estaSemana={false}
        anterior={semana > SEMANA_MINIMA ? () => aoMudar(semana - 1) : undefined}
        proxima={semana < 42 ? () => aoMudar(semana + 1) : undefined}
      />
      <Cartao>
        <Sobrelinha tinta={cor.jogo}>Nessa semana</Sobrelinha>
        <Text style={{ ...fonte.normal, ...escala.corpo, color: cor.textoCorpo }}>{bebe.desc}</Text>
        <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}>
          Tamanho de {bebe.fruit.toLowerCase()} · {bebe.size}
          {bebe.weight && bebe.weight !== "—" ? ` · ${bebe.weight}` : ""}
        </Text>
      </Cartao>
      {marco ? (
        <Cartao estilo={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
          <Text style={{ fontSize: 28, lineHeight: 34 }}>{marco.emoji}</Text>
          <Text style={{ flex: 1, ...fonte.forte, ...escala.manchete, color: cor.texto }}>
            {marco.label}
          </Text>
        </Cartao>
      ) : null}
      <Cartao estilo={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
        <Text style={{ fontSize: 44, lineHeight: 52, opacity: figurinha ? 1 : 0.35 }}>
          {fruitEmojiForWeek(semana)}
        </Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ ...fonte.forte, ...escala.manchete, color: cor.texto }}>
            {figurinha ? "Figurinha guardada no álbum" : "Sem figurinha nessa semana"}
          </Text>
          <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}>
            O álbum da gestação fica guardado.
          </Text>
        </View>
      </Cartao>
    </Tela>
  );
}
