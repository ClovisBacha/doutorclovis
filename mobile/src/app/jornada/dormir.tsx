import { Image } from "expo-image";
import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Pause from "lucide-react-native/icons/pause";
import Play from "lucide-react-native/icons/play";
import Square from "lucide-react-native/icons/square";
import Timer from "lucide-react-native/icons/timer";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import {
  duracaoAproximada,
  HISTORIAS,
  pausaDepoisDo,
  type Historia,
} from "@/lib/historias-para-dormir";
import {
  CAUDA_SEGS,
  faltando,
  quandoDesligar,
  rotuloDoTempo,
  TEMPOS,
  type Tempo,
} from "@/lib/som-continuo";
import { familiasDeSom, type SomKey } from "@/lib/som-receitas";
import { ROTULO_DO_SOM_NO_APP } from "~/lib/jornada/sons";
import { toque } from "~/componentes/base";
import {
  BolhaComBalao,
  BotaoRedondo,
  fecharAtividade,
  FundoDaNoite,
  Secao,
  TopoDaAtividade,
  VidroDaNoite,
} from "~/componentes/jornada/atividade";
import { corNoite } from "~/componentes/jornada/cores";
import { Onda } from "~/componentes/jornada/folha-de-sons";
import { useDiaDaJornada } from "~/componentes/jornada/usarJornada";
import { tocarSomDeFundo, type SomDeFundo } from "~/lib/audio/som-de-fundo";
import { ARTE_DO_SOM } from "~/lib/audio/sons-de-fundo";
import { pararCanal, tocarVoz } from "~/lib/audio/voz";
import { VOZ_REGRAVADA } from "~/lib/audio/regravadas";
import { VOZ_DA_NOITE } from "~/lib/audio/vozes";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { FALA_DOS_SONS } from "~/lib/jornada/bolha-nos-cuidados";
import { ALVO_MINIMO, canto, curva, escala, espaco, fonte, margem } from "~/tema";
import { PortaoDoPlano } from "~/componentes/assinatura/portao";

/**
 * SÓ SONS, PARA DORMIR — o `SonsParaDormir` do app antigo, para quem acorda às
 * três da manhã e não vai abrir uma sessão de dez minutos para chegar ao som.
 *
 * Os sons são os da meditação, na altura do tocador de dormir do site (cheia:
 * foi ela quem tocou no botão), e continuam com a TELA APAGADA — o app declara
 * o modo de áudio em segundo plano por causa desta tela. Desligam sozinhos no
 * tempo escolhido, descendo em 15 s (`CAUDA_SEGS`), para o fim não acordar
 * ninguém. As histórias vêm antes dos sons: som acalma quem já está quase
 * dormindo, história ocupa a cabeça de quem está a mil. Elas são narradas
 * pela mesma voz, a 0,92×, com silêncios que crescem, e no fim a chuva segue
 * sozinha — o quarto não fica mudo de repente.
 *
 * O "TOCANDO AGORA" (18/11/2026): com um som tocando, um tocador flutua no pé
 * (a arte, o nome, quando desliga, pausar e parar) — antes o estado, o tempo
 * e o "Parar agora" moravam no fim da lista, depois de uns vinte cartões, e de
 * olho semiaberto ela precisava rolar até eles. E a tela não se redesenha mais
 * a cada segundo: só a contagem do tocador (`ContagemDoSom`) tem relógio.
 *
 * A BOLHA GUIA (19/11/2026): de olhos fechados, ela abre a tela dizendo o
 * que a tela faz (escolher, apagar a tela, o som desliga sozinho), no balão
 * escuro da noite. A história continua com a voz gravada, sem texto na tela.
 *
 * Bancada: /jornada/dormir?bancada=1 [&som=chuva] [&pausado=1] [&historia=casa-do-mar|trem-da-noite] [&escuro=1]
 */

/* A arte das duas histórias (a do cartão no site, `arte-dos-sons.tsx`). */
const ARTE_DA_HISTORIA: Record<string, number> = {
  "casa-do-mar": require("../../../../src/assets/sons/historia-mar.webp"),
  "trem-da-noite": require("../../../../src/assets/sons/historia-trem.webp"),
};

/** Muitas cópias na fila: a de dormir pode tocar a noite inteira, e a fila só soluça ao se refazer. */
const COPIAS_DA_NOITE = 120;

/** O portão do plano completo (com a chave da assinatura desligada, abre direto). */
export default function TelaDosSons() {
  return (
    <PortaoDoPlano recurso="sons">
      <Dormir />
    </PortaoDoPlano>
  );
}

function Dormir() {
  const dia = useDiaDaJornada();
  const cuidado = dia.modo !== "carregando" && dia.modo !== "falhou" && dia.cuidado;
  const [som, setSom] = useState<SomKey | null>(null);
  const [pausado, setPausado] = useState(false);
  const [tempo, setTempo] = useState<Tempo>(30);
  const [alvo, setAlvo] = useState<number | null>(null);
  const [historia, setHistoria] = useState<Historia | null>(null);
  const [largura, setLargura] = useState(0);
  const [aplicouBancada, setAplicouBancada] = useState(false);
  const fundo = useRef<SomDeFundo | null>(null);
  /* O que faltava quando ela pausou: volta a contar de onde parou. */
  const guardado = useRef<number | null>(null);

  const familias = useMemo(() => familiasDeSom(cuidado), [cuidado]);
  const historias = HISTORIAS.filter((h) => !cuidado || h.noLuto);

  useEffect(() => () => fundo.current?.parar(150), []);

  useEffect(() => {
    if (aplicouBancada || !ehBancada()) return;
    setAplicouBancada(true);
    const k = parametroDaBancada("som");
    if (k && k in ROTULO_DO_SOM_NO_APP) {
      setSom(k as SomKey);
      if (parametroDaBancada("pausado") === "1") setPausado(true);
      else setAlvo(quandoDesligar(30, Date.now()));
    }
    const h = HISTORIAS.find((x) => x.chave === parametroDaBancada("historia"));
    if (h) setHistoria(h);
  }, [aplicouBancada]);

  const tocar = useCallback((k: SomKey) => {
    fundo.current?.parar(150);
    fundo.current = tocarSomDeFundo(k, {
      volume: 1,
      fundo: true,
      copias: COPIAS_DA_NOITE,
      entradaMs: 150,
    });
  }, []);

  function pausarOuVoltar() {
    if (!som) return;
    if (pausado) {
      fundo.current?.retomar();
      setPausado(false);
      if (guardado.current != null) setAlvo(Date.now() + guardado.current);
      guardado.current = null;
    } else {
      fundo.current?.pausar();
      setPausado(true);
      guardado.current = alvo ? Math.max(0, alvo - Date.now()) : null;
      setAlvo(null);
    }
  }

  function escolher(k: SomKey) {
    /* Tocar no som que toca pausa; tocar de novo, volta — e o rótulo diz isso. */
    if (som === k) {
      pausarOuVoltar();
      return;
    }
    tocar(k);
    setSom(k);
    setPausado(false);
    guardado.current = null;
    setAlvo(quandoDesligar(tempo, Date.now()));
  }
  /* Os cartões são `memo`: recebem um toque que não muda de identidade. */
  const escolherAgora = useRef(escolher);
  escolherAgora.current = escolher;
  const aoEscolher = useCallback((k: SomKey) => escolherAgora.current(k), []);

  function trocarTempo(t: Tempo) {
    setTempo(t);
    if (!som) return;
    const novo = quandoDesligar(t, Date.now());
    if (pausado) guardado.current = novo == null ? null : novo - Date.now();
    else setAlvo(novo);
  }

  function parar() {
    fundo.current?.parar(150);
    fundo.current = null;
    setSom(null);
    setPausado(false);
    setAlvo(null);
    guardado.current = null;
  }

  /* No fim do tempo, o som desce em 15 s e para — corte seco acorda. Um
     `setTimeout` só, para a hora marcada (era um relógio que redesenhava a
     tela inteira, com uns vinte cartões, a cada segundo). */
  useEffect(() => {
    if (!alvo || !som) return;
    const id = setTimeout(
      () => {
        fundo.current?.parar(CAUDA_SEGS * 1000);
        fundo.current = null;
        setSom(null);
        setAlvo(null);
      },
      Math.max(0, alvo - Date.now()),
    );
    return () => clearTimeout(id);
  }, [alvo, som]);

  /* A história acabou: a chuva continua sozinha, com o tempo escolhido. */
  function entregarAChuva() {
    setHistoria(null);
    tocar("chuva");
    setSom("chuva");
    setPausado(false);
    setAlvo(quandoDesligar(tempo, Date.now()));
  }

  if (historia) {
    return (
      <HistoriaDaNoite
        historia={historia}
        escuroNaBancada={ehBancada() && parametroDaBancada("escuro") === "1"}
        aoTerminar={entregarAChuva}
        aoSair={() => setHistoria(null)}
      />
    );
  }

  /* Duas colunas, medidas na tela (era `47.8%`, um número mágico). */
  const coluna = largura > 0 ? Math.floor((largura - espaco.md) / 2) : 0;

  return (
    <FundoDaNoite>
      <StatusBar style="light" animated />
      <TopoDaAtividade
        escuro
        aoFechar={() => {
          parar();
          fecharAtividade();
        }}
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: margem.tela + 4,
          paddingBottom: som ? 150 : espaco.xxl,
        }}
      >
        {/* A Bolha no lugar dos fones: é ela quem explica a tela, de olhos fechados. */}
        <BolhaComBalao lado escuro humor="dormindo" fala={FALA_DOS_SONS} />
        <Text
          accessibilityRole="header"
          style={{
            marginTop: espaco.xl,
            ...fonte.display,
            ...escala.titulo1,
            letterSpacing: -0.2,
            color: corNoite.texto,
          }}
        >
          Para dormir
        </Text>

        <Secao escuro>Histórias</Secao>
        <View style={{ gap: espaco.sm }}>
          {historias.map((h) => (
            <Pressable
              key={h.chave}
              accessibilityRole="button"
              accessibilityLabel={`${h.titulo}. ${h.sub}. ${duracaoAproximada(h)} minutos`}
              onPress={() => {
                toque();
                parar();
                setHistoria(h);
              }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: espaco.md,
                minHeight: 68,
                paddingHorizontal: espaco.lg,
                paddingVertical: espaco.md,
                borderRadius: canto.dentro + 2,
                ...curva,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: corNoite.cartaoBorda,
                backgroundColor: corNoite.cartao,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Arte fonte={ARTE_DA_HISTORIA[h.chave]} emoji={h.emoji} tamanho={44} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...fonte.forte, ...escala.legenda, color: corNoite.texto }}>
                  {h.titulo}
                </Text>
                <Text style={{ ...fonte.normal, ...escala.nota, color: corNoite.textoApagado }}>
                  {h.sub} · {duracaoAproximada(h)} min
                </Text>
              </View>
              <ChevronRight size={18} color={corNoite.icone} strokeWidth={2.4} />
            </Pressable>
          ))}
        </View>
        <Text
          style={{
            marginTop: espaco.sm,
            ...fonte.normal,
            ...escala.nota,
            color: corNoite.textoApagado,
          }}
        >
          Quando a história acaba, a chuva continua sozinha. O quarto não fica mudo de repente.
        </Text>

        <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
          {familias.map(({ familia, sons }) => (
            <View key={familia}>
              <Secao escuro>{familia}</Secao>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.md }}>
                {sons.map((k) => (
                  <CartaoDeSom
                    key={k}
                    som={k}
                    largura={coluna}
                    ativo={som === k}
                    tocando={som === k && !pausado}
                    aoEscolher={aoEscolher}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* O volume é o do aparelho: dito, para ninguém procurar um controle que não existe. */}
        <Text
          style={{
            marginTop: espaco.xxl,
            ...fonte.normal,
            ...escala.nota,
            color: corNoite.textoApagado,
          }}
        >
          O volume é o do próprio celular: use os botões da lateral. Com fone, o som fica mais
          fechado e costuma incomodar menos quem dorme do lado.
        </Text>
      </ScrollView>
      {som ? (
        <MiniTocador
          som={som}
          pausado={pausado}
          alvo={alvo}
          tempo={tempo}
          aoTrocarTempo={trocarTempo}
          aoPausar={pausarOuVoltar}
          aoParar={parar}
        />
      ) : null}
    </FundoDaNoite>
  );
}

/** Um som da grade: a arte, o nome e a legenda; o escolhido, mais claro e com a onda. */
const CartaoDeSom = memo(function CartaoDeSom({
  som,
  largura,
  ativo,
  tocando,
  aoEscolher,
}: {
  som: SomKey;
  largura: number;
  ativo: boolean;
  tocando: boolean;
  aoEscolher: (k: SomKey) => void;
}) {
  const r = ROTULO_DO_SOM_NO_APP[som];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: ativo }}
      accessibilityLabel={`${r.label}${ativo ? (tocando ? ", tocando" : ", pausado") : ""}`}
      onPress={() => {
        toque();
        aoEscolher(som);
      }}
      style={({ pressed }) => ({
        width: largura || "47%",
        padding: espaco.lg,
        borderRadius: canto.dentro + 2,
        ...curva,
        borderWidth: ativo ? 1 : StyleSheet.hairlineWidth,
        borderColor: ativo ? corNoite.escolhidoBorda : corNoite.cartaoBorda,
        backgroundColor: ativo ? corNoite.escolhidoFundo : corNoite.cartao,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm, minHeight: 44 }}>
        <Arte fonte={ARTE_DO_SOM[som]} emoji={r.emoji} tamanho={44} />
        {tocando ? <Onda tinta={corNoite.onda} altura={20} voltas={6} /> : null}
      </View>
      <Text
        style={{ marginTop: espaco.sm, ...fonte.forte, ...escala.legenda, color: corNoite.texto }}
      >
        {r.label}
      </Text>
      <Text style={{ marginTop: 2, ...fonte.normal, ...escala.nota, color: corNoite.textoApagado }}>
        {r.sub}
      </Text>
    </Pressable>
  );
});

/**
 * Quanto falta para desligar: o ÚNICO relógio desta tela, e só ele se
 * redesenha (era a tela inteira, a cada segundo).
 */
function ContagemDoSom({ alvo }: { alvo: number }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    setAgora(Date.now());
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [alvo]);
  return <>{`Desliga em ${faltando(alvo + CAUDA_SEGS * 1000 - agora)}`}</>;
}

/**
 * O TOCANDO AGORA: flutua no pé enquanto há um som. A arte e o nome, quando
 * ele desliga, a pílula do tempo (que abre os tempos), pausar e parar — tudo
 * a um toque, sem rolar, de olho semiaberto.
 */
function MiniTocador({
  som,
  pausado,
  alvo,
  tempo,
  aoTrocarTempo,
  aoPausar,
  aoParar,
}: {
  som: SomKey;
  pausado: boolean;
  alvo: number | null;
  tempo: Tempo;
  aoTrocarTempo: (t: Tempo) => void;
  aoPausar: () => void;
  aoParar: () => void;
}) {
  const [tempos, setTempos] = useState(false);
  const r = ROTULO_DO_SOM_NO_APP[som];
  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: margem.tela, right: margem.tela, bottom: espaco.sm }}
    >
      <VidroDaNoite forma={canto.cartao} estilo={{ padding: espaco.md, gap: espaco.md }}>
        {tempos ? (
          <View style={{ gap: espaco.sm }}>
            <Text style={{ ...fonte.forte, ...escala.nota, color: corNoite.textoApagado }}>
              Desligar sozinho em
            </Text>
            <View style={{ flexDirection: "row", gap: espaco.sm }}>
              {TEMPOS.map((t) => {
                const ativo = tempo === t;
                return (
                  <Pressable
                    key={t}
                    accessibilityRole="button"
                    accessibilityState={{ selected: ativo }}
                    onPress={() => {
                      toque();
                      aoTrocarTempo(t);
                      setTempos(false);
                    }}
                    style={({ pressed }) => ({
                      flex: 1,
                      minHeight: ALVO_MINIMO,
                      borderRadius: canto.pilula,
                      ...curva,
                      backgroundColor: ativo ? corNoite.tempo : corNoite.cartao,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text
                      style={{
                        ...fonte.forte,
                        ...escala.nota,
                        color: ativo ? corNoite.tempoTexto : corNoite.textoForte,
                      }}
                    >
                      {rotuloDoTempo(t)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
          <Arte fonte={ARTE_DO_SOM[som]} emoji={r.emoji} tamanho={36} />
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{ ...fonte.forte, ...escala.legenda, color: corNoite.texto }}
            >
              {r.label}
            </Text>
            <Text
              accessibilityLiveRegion="polite"
              numberOfLines={1}
              style={{ ...fonte.normal, ...escala.nota, color: corNoite.textoApagado }}
            >
              {pausado ? "Pausado" : alvo ? <ContagemDoSom alvo={alvo} /> : "Toca sem limite"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <BotaoDoTocador
              rotulo={`Desligar sozinho: ${rotuloDoTempo(tempo)}. Toque para trocar`}
              aoTocar={() => setTempos((v) => !v)}
              aceso={tempos}
            >
              <Timer size={20} color={corNoite.texto} strokeWidth={2.2} />
            </BotaoDoTocador>
            <BotaoDoTocador rotulo={pausado ? "Continuar" : "Pausar"} aoTocar={aoPausar}>
              {pausado ? (
                <Play size={20} color={corNoite.texto} fill={corNoite.texto} />
              ) : (
                <Pause size={20} color={corNoite.texto} fill={corNoite.texto} />
              )}
            </BotaoDoTocador>
            <BotaoDoTocador rotulo="Parar o som" aoTocar={aoParar}>
              <Square size={16} color={corNoite.texto} fill={corNoite.texto} />
            </BotaoDoTocador>
          </View>
        </View>
      </VidroDaNoite>
    </View>
  );
}

function BotaoDoTocador({
  rotulo,
  aoTocar,
  aceso,
  children,
}: {
  rotulo: string;
  aoTocar: () => void;
  aceso?: boolean;
  children: ReactNode;
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
        width: ALVO_MINIMO,
        height: ALVO_MINIMO,
        borderRadius: ALVO_MINIMO / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: aceso ? corNoite.escolhidoFundo : corNoite.cartao,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

function Arte({ fonte: arte, emoji, tamanho }: { fonte?: number; emoji: string; tamanho: number }) {
  if (arte)
    return (
      <Image
        source={arte}
        style={{ width: tamanho, height: tamanho }}
        contentFit="contain"
        accessible={false}
      />
    );
  return <Text style={{ fontSize: tamanho * 0.86 }}>{emoji}</Text>;
}

/* ── A história da noite ──────────────────────────────────────────────────── */

/** O ritmo da narração: um pouco mais arrastado que o gravado, como no site. */
const RITMO = 0.92;

/* As estrelas do site: o mesmo sorteio, para o céu ser sempre o mesmo. */
const ESTRELAS = (() => {
  let s = 20260813;
  const r = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  return Array.from({ length: 40 }, () => ({
    x: +(r() * 100).toFixed(2),
    y: +(r() * 60).toFixed(2),
    o: +(0.15 + r() * 0.5).toFixed(2),
  }));
})();

/** O quanto a tela escurece: o véu chega a 91% (a tela fica com 9% da luz). */
const ESCURO = 0.91;

function MantemAcesa() {
  useKeepAwake("dc-historia");
  return null;
}

/**
 * A história: uma fala por vez, e entre elas um silêncio que cresce (de 3 a
 * 16 s, `pausaDepoisDo`). O texto NÃO aparece — ler acorda; o que se vê é só
 * quanto já andou. A tela escurece sozinha depois de 20 s sem toque (e a barra
 * do relógio some junto), e fica acesa (escura) até o fim: os silêncios entre
 * as falas não podem ser o momento em que o aparelho se tranca e a história
 * para no meio.
 *
 * O escurecer é um VÉU da cor do fundo por cima, e não a opacidade da tela
 * inteira: animar a opacidade de uma vista com filhos obriga o iOS a desenhá-la
 * fora da tela a cada quadro.
 */
function HistoriaDaNoite({
  historia,
  escuroNaBancada,
  aoTerminar,
  aoSair,
}: {
  historia: Historia;
  escuroNaBancada: boolean;
  aoTerminar: () => void;
  aoSair: () => void;
}) {
  const total = historia.blocos.length;
  const [i, setI] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [escuro, setEscuro] = useState(escuroNaBancada);
  const veu = useRef(new Animated.Value(escuroNaBancada ? ESCURO : 0)).current;
  const apagar = useRef<ReturnType<typeof setTimeout> | null>(null);

  const acender = useCallback(() => {
    if (escuroNaBancada) return;
    setEscuro(false);
    Animated.timing(veu, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    if (apagar.current) clearTimeout(apagar.current);
    apagar.current = setTimeout(() => {
      setEscuro(true);
      Animated.timing(veu, { toValue: ESCURO, duration: 2500, useNativeDriver: true }).start();
    }, 20_000);
  }, [veu, escuroNaBancada]);

  useEffect(() => {
    acender();
    return () => {
      if (apagar.current) clearTimeout(apagar.current);
    };
  }, [acender]);

  useEffect(() => {
    if (pausado || ehBancada()) return;
    const bloco = historia.blocos[i]!;
    let espera: ReturnType<typeof setTimeout> | null = null;
    const seguir = () => {
      espera = setTimeout(
        () => {
          if (i + 1 >= total) aoTerminar();
          else setI(i + 1);
        },
        pausaDepoisDo(i, total) * 1000,
      );
    };
    const fonte = VOZ_REGRAVADA[bloco.id] ?? VOZ_DA_NOITE[bloco.id];
    if (!fonte || Platform.OS === "web") espera = setTimeout(seguir, 1000);
    else tocarVoz(fonte, { canal: "guia", fundo: true, velocidade: RITMO, aoAcabar: seguir });
    return () => {
      if (espera) clearTimeout(espera);
      pararCanal("guia");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, pausado]);

  useEffect(() => () => pararCanal("guia"), []);

  const estrelas = useMemo(
    () =>
      ESTRELAS.map((e, n) => (
        <Circle key={n} cx={e.x} cy={e.y} r={0.18} fill={corNoite.estrela} fillOpacity={e.o} />
      )),
    [],
  );

  return (
    <View style={{ flex: 1, backgroundColor: corNoite.historia }} onTouchStart={acender}>
      <StatusBar style="light" hidden={escuro} animated />
      {Platform.OS !== "web" ? <MantemAcesa /> : null}
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <TopoDaAtividade
          escuro
          aoFechar={() => {
            pararCanal("guia");
            aoSair();
          }}
          direita={
            <BotaoRedondo
              escuro
              rotulo={pausado ? "Continuar" : "Pausar"}
              aoTocar={() => setPausado((p) => !p)}
            >
              {pausado ? (
                <Play size={18} color={corNoite.texto} fill={corNoite.texto} />
              ) : (
                <Pause size={18} color={corNoite.texto} fill={corNoite.texto} />
              )}
            </BotaoRedondo>
          }
        />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: margem.foco,
          }}
        >
          <Arte fonte={ARTE_DA_HISTORIA[historia.chave]} emoji={historia.emoji} tamanho={96} />
          <Text
            accessibilityRole="header"
            style={{
              marginTop: 20,
              textAlign: "center",
              ...fonte.display,
              ...escala.titulo2,
              letterSpacing: -0.2,
              color: corNoite.texto,
            }}
          >
            {historia.titulo}
          </Text>
          <View
            accessible
            accessibilityLabel={`Parte ${i + 1} de ${total}`}
            style={{
              marginTop: espaco.xxl,
              width: 160,
              height: 3,
              borderRadius: 2,
              backgroundColor: corNoite.trilho,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${((i + 1) / total) * 100}%`,
                height: "100%",
                borderRadius: 2,
                backgroundColor: corNoite.icone,
              }}
            />
          </View>
          <Text
            style={{
              marginTop: espaco.lg,
              ...fonte.normal,
              ...escala.nota,
              color: corNoite.textoApagado,
            }}
          >
            {pausado ? "Pausado" : "A tela vai escurecer sozinha"}
          </Text>
        </View>
      </SafeAreaView>
      {/* O véu que escurece: uma vista da cor do fundo, sem filhos. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: corNoite.historia, opacity: veu }]}
      />
      {/* As estrelas por cima do véu: o céu continua lá quando a tela apaga. */}
      <Svg
        style={StyleSheet.absoluteFill}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        pointerEvents="none"
        accessible={false}
      >
        {estrelas}
      </Svg>
    </View>
  );
}
