import { Image } from "expo-image";
import { useKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ChevronRight, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
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
import { corNoite } from "~/componentes/jornada/cores";
import { voltarParaJornada } from "~/componentes/jornada/pecas";
import { useDiaDaJornada } from "~/componentes/jornada/usarJornada";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { tocarSomDeFundo, type SomDeFundo } from "~/lib/audio/som-de-fundo";
import { ARTE_DO_SOM } from "~/lib/audio/sons-de-fundo";
import { pararCanal, tocarVoz } from "~/lib/audio/voz";
import { VOZ_REGRAVADA } from "~/lib/audio/regravadas";
import { VOZ_DA_NOITE } from "~/lib/audio/vozes";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { ALVO_MINIMO, espaco, fonte } from "~/tema";

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
 * Bancada: /jornada/dormir?bancada=1 [&som=chuva] [&pausado=1] [&historia=casa-do-mar|trem-da-noite] [&escuro=1]
 */

/* A arte das duas histórias (a do cartão no site, `arte-dos-sons.tsx`). */
const ARTE_DA_HISTORIA: Record<string, number> = {
  "casa-do-mar": require("../../../../src/assets/sons/historia-mar.webp"),
  "trem-da-noite": require("../../../../src/assets/sons/historia-trem.webp"),
};

/** Muitas cópias na fila: a de dormir pode tocar a noite inteira, e a fila só soluça ao se refazer. */
const COPIAS_DA_NOITE = 120;

export default function Dormir() {
  const dia = useDiaDaJornada();
  const cuidado = dia.modo !== "carregando" && dia.modo !== "falhou" && dia.cuidado;
  const [som, setSom] = useState<SomKey | null>(null);
  const [pausado, setPausado] = useState(false);
  const [tempo, setTempo] = useState<Tempo>(30);
  const [alvo, setAlvo] = useState<number | null>(null);
  const [restante, setRestante] = useState(0);
  const [historia, setHistoria] = useState<Historia | null>(null);
  const [aplicouBancada, setAplicouBancada] = useState(false);
  const fundo = useRef<SomDeFundo | null>(null);
  /* O que faltava quando ela pausou: volta a contar de onde parou. */
  const guardado = useRef<number | null>(null);

  const familias = familiasDeSom(cuidado);
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

  function escolher(k: SomKey) {
    /* Tocar no som que toca pausa; tocar de novo, volta — e o rótulo diz isso. */
    if (som === k) {
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
      return;
    }
    tocar(k);
    setSom(k);
    setPausado(false);
    guardado.current = null;
    setAlvo(quandoDesligar(tempo, Date.now()));
  }

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

  /* No fim do tempo, o som desce em 15 s e para — corte seco acorda. */
  useEffect(() => {
    if (!alvo || !som) return;
    const passo = () => {
      const falta = alvo - Date.now();
      setRestante(falta);
      if (falta <= 0) {
        fundo.current?.parar(CAUDA_SEGS * 1000);
        fundo.current = null;
        setSom(null);
        setAlvo(null);
      }
    };
    passo();
    const id = setInterval(passo, 1000);
    return () => clearInterval(id);
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

  const status = !som
    ? "Escolha um som."
    : pausado
      ? "Pausado — toque no som para voltar"
      : alvo
        ? `Tocando · desliga em ${faltando(restante)}`
        : "Tocando · sem limite";

  return (
    <LinearGradient colors={[...corNoite.dormir]} style={{ flex: 1 }}>
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <View
          style={{ flexDirection: "row", paddingHorizontal: espaco.lg, paddingVertical: espaco.sm }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            onPress={() => {
              parar();
              if (router.canGoBack()) router.back();
              else voltarParaJornada();
            }}
            style={({ pressed }) => ({
              width: ALVO_MINIMO,
              height: ALVO_MINIMO,
              marginLeft: -espaco.sm,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <X size={24} color={corNoite.branco45} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: espaco.xl, paddingBottom: 40 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: fonte.media,
              fontSize: 26,
              lineHeight: 32,
              color: corNoite.branco,
            }}
          >
            Para dormir
          </Text>
          <Text
            style={{
              marginTop: 4,
              fontFamily: fonte.normal,
              fontSize: 13,
              lineHeight: 21,
              color: corNoite.branco60,
            }}
          >
            Pode apagar a tela e deixar o celular de lado — o som continua tocando.
          </Text>

          <Secao>Histórias</Secao>
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
                  minHeight: 64,
                  paddingHorizontal: espaco.lg,
                  paddingVertical: espaco.md,
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: corNoite.branco10,
                  backgroundColor: corNoite.branco6,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Arte fonte={ARTE_DA_HISTORIA[h.chave]} emoji={h.emoji} tamanho={40} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: fonte.titulo,
                      fontSize: 14,
                      lineHeight: 19,
                      color: corNoite.branco,
                    }}
                  >
                    {h.titulo}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonte.normal,
                      fontSize: 13,
                      lineHeight: 17,
                      color: corNoite.branco50,
                    }}
                  >
                    {h.sub} · {duracaoAproximada(h)} min
                  </Text>
                </View>
                <ChevronRight size={18} color={corNoite.branco30} />
              </Pressable>
            ))}
          </View>
          <Text
            style={{
              marginTop: espaco.sm,
              fontFamily: fonte.normal,
              fontSize: 13,
              lineHeight: 20,
              color: corNoite.branco35,
            }}
          >
            Quando a história acaba, a chuva continua sozinha — o quarto não fica mudo de repente.
          </Text>

          {familias.map(({ familia, sons }) => (
            <View key={familia}>
              <Secao>{familia}</Secao>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.md }}>
                {sons.map((k) => {
                  const ativo = som === k;
                  return (
                    <Pressable
                      key={k}
                      accessibilityRole="button"
                      accessibilityState={{ selected: ativo }}
                      accessibilityLabel={`${ROTULO_DO_SOM_NO_APP[k].label}${ativo ? (pausado ? ", pausado" : ", tocando") : ""}`}
                      onPress={() => {
                        toque();
                        escolher(k);
                      }}
                      style={({ pressed }) => ({
                        width: "47.8%",
                        padding: espaco.lg,
                        borderRadius: 24,
                        borderWidth: 1,
                        borderColor: ativo ? corNoite.escolhidoBorda : corNoite.branco10,
                        backgroundColor: ativo ? corNoite.escolhidoFundo : corNoite.branco6,
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: espaco.sm,
                          minHeight: 44,
                        }}
                      >
                        <Arte
                          fonte={ARTE_DO_SOM[k]}
                          emoji={ROTULO_DO_SOM_NO_APP[k].emoji}
                          tamanho={44}
                        />
                        {ativo && !pausado ? <Onda /> : null}
                      </View>
                      <Text
                        style={{
                          marginTop: espaco.sm,
                          fontFamily: fonte.titulo,
                          fontSize: 14,
                          lineHeight: 19,
                          color: corNoite.branco,
                        }}
                      >
                        {ROTULO_DO_SOM_NO_APP[k].label}
                      </Text>
                      <Text
                        style={{
                          marginTop: 2,
                          fontFamily: fonte.normal,
                          fontSize: 13,
                          lineHeight: 17,
                          color: corNoite.branco50,
                        }}
                      >
                        {ROTULO_DO_SOM_NO_APP[k].sub}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          <Secao>Desligar sozinho em</Secao>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.sm }}>
            {TEMPOS.map((t) => {
              const ativo = tempo === t;
              return (
                <Pressable
                  key={t}
                  accessibilityRole="button"
                  accessibilityState={{ selected: ativo }}
                  onPress={() => {
                    toque();
                    trocarTempo(t);
                  }}
                  style={({ pressed }) => ({
                    minHeight: 40,
                    paddingHorizontal: espaco.lg,
                    borderRadius: 999,
                    borderWidth: ativo ? 0 : 1,
                    borderColor: corNoite.branco15,
                    backgroundColor: ativo ? corNoite.tempo : corNoite.branco6,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.8 : 1,
                  })}
                  hitSlop={{ top: 2, bottom: 2 }}
                >
                  <Text
                    style={{
                      fontFamily: fonte.forte,
                      fontSize: 13,
                      color: ativo ? corNoite.tempoTexto : corNoite.branco70,
                    }}
                  >
                    {rotuloDoTempo(t)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text
            accessibilityLiveRegion="polite"
            style={{
              marginTop: espaco.xl,
              minHeight: 20,
              fontFamily: fonte.normal,
              fontSize: 13,
              color: corNoite.branco60,
            }}
          >
            {status}
          </Text>
          {som ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                toque();
                parar();
              }}
              style={({ pressed }) => ({
                marginTop: 20,
                minHeight: 48,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: corNoite.branco15,
                backgroundColor: corNoite.branco6,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: corNoite.branco80 }}>
                Parar agora
              </Text>
            </Pressable>
          ) : null}
          {/* O volume é o do aparelho: dito, para ninguém procurar um controle que não existe. */}
          <Text
            style={{
              marginTop: espaco.xxl,
              fontFamily: fonte.normal,
              fontSize: 13,
              lineHeight: 20,
              color: corNoite.branco35,
            }}
          >
            O volume é o do próprio celular — use os botões da lateral. Com fone, o som fica mais
            fechado e costuma incomodar menos quem dorme do lado.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Secao({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        marginTop: 28,
        marginBottom: espaco.sm,
        fontFamily: fonte.forte,
        fontSize: 13,
        letterSpacing: 0.65,
        textTransform: "uppercase",
        color: corNoite.branco40,
      }}
    >
      {children}
    </Text>
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

/** As três barrinhas do som que toca. */
function Onda() {
  const reduzido = useMovimentoReduzido();
  const barras = useRef([0, 1, 2].map(() => new Animated.Value(0.4))).current;
  useEffect(() => {
    if (reduzido) return;
    const lacos = barras.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(b, {
            toValue: 1,
            duration: 300,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(b, {
            toValue: 0.4,
            duration: 300,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    lacos.forEach((l) => l.start());
    return () => lacos.forEach((l) => l.stop());
  }, [barras, reduzido]);
  return (
    <View
      style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 16 }}
      accessible={false}
    >
      {barras.map((b, i) => (
        <Animated.View
          key={i}
          style={{
            width: 3,
            height: 16,
            borderRadius: 2,
            backgroundColor: corNoite.onda,
            transform: [{ scaleY: b }],
          }}
        />
      ))}
    </View>
  );
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

function MantemAcesa() {
  useKeepAwake("dc-historia");
  return null;
}

/**
 * A história: uma fala por vez, e entre elas um silêncio que cresce (de 3 a
 * 16 s, `pausaDepoisDo`). O texto NÃO aparece — ler acorda; o que se vê é só
 * quanto já andou. A tela escurece sozinha depois de 20 s sem toque, e fica
 * acesa (escura) até o fim: os silêncios entre as falas não podem ser o
 * momento em que o aparelho se tranca e a história para no meio.
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
  const opacidade = useRef(new Animated.Value(escuroNaBancada ? 0.09 : 1)).current;
  const apagar = useRef<ReturnType<typeof setTimeout> | null>(null);

  const acender = useCallback(() => {
    if (escuroNaBancada) return;
    Animated.timing(opacidade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    if (apagar.current) clearTimeout(apagar.current);
    apagar.current = setTimeout(() => {
      Animated.timing(opacidade, { toValue: 0.09, duration: 2500, useNativeDriver: true }).start();
    }, 20_000);
  }, [opacidade, escuroNaBancada]);

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
      {Platform.OS !== "web" ? <MantemAcesa /> : null}
      <Svg
        style={StyleSheet.absoluteFill}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        accessible={false}
      >
        {estrelas}
      </Svg>
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, opacity: opacidade }}>
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
              onPress={() => {
                pararCanal("guia");
                aoSair();
              }}
              style={({ pressed }) => ({
                width: ALVO_MINIMO,
                height: ALVO_MINIMO,
                marginLeft: -espaco.sm,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <X size={24} color={corNoite.branco40} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={pausado ? "Continuar" : "Pausar"}
              hitSlop={4}
              onPress={() => setPausado((p) => !p)}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: corNoite.branco15,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Svg width={15} height={15} viewBox="0 0 24 24">
                <Path
                  d={
                    pausado
                      ? "M8 5.2v13.6L19 12z"
                      : "M6.6 4.8h3.7v14.4H6.6zM13.7 4.8h3.7v14.4h-3.7z"
                  }
                  fill={corNoite.branco70}
                />
              </Svg>
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
            <Arte fonte={ARTE_DA_HISTORIA[historia.chave]} emoji={historia.emoji} tamanho={96} />
            <Text
              accessibilityRole="header"
              style={{
                marginTop: 20,
                textAlign: "center",
                fontFamily: fonte.media,
                fontSize: 24,
                lineHeight: 30,
                color: corNoite.branco,
              }}
            >
              {historia.titulo}
            </Text>
            <View
              accessibilityLabel={`Parte ${i + 1} de ${total}`}
              style={{
                marginTop: espaco.xxl,
                width: 160,
                height: 3,
                borderRadius: 2,
                backgroundColor: corNoite.branco10,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${((i + 1) / total) * 100}%`,
                  height: "100%",
                  borderRadius: 2,
                  backgroundColor: corNoite.branco40,
                }}
              />
            </View>
            <Text
              style={{
                marginTop: espaco.lg,
                fontFamily: fonte.normal,
                fontSize: 13,
                color: corNoite.branco30,
              }}
            >
              {pausado ? "Pausado" : "A tela vai escurecer sozinha"}
            </Text>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}
