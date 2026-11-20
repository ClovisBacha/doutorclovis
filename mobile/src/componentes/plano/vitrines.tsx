import ArrowRight from "lucide-react-native/icons/arrow-right";
import Check from "lucide-react-native/icons/check";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient as Gradiente, Path, Stop } from "react-native-svg";
import { sucesso } from "~/componentes/base";
import { ArteDaBolha, BolhaViva, Entrada, useMovimentoReduzido } from "~/componentes/movimento";
import { IconeDoPlano, Sobretitulo, Superficie } from "~/componentes/plano/pecas";
import { rotuloDoTempo, type LinhaDoTempo, type MarcoDaCurva } from "~/lib/plano/numeros";
import { MOMENTO_NA_FRASE } from "~/lib/plano/passos";
import type { Momento } from "~/lib/plano/respostas";
import { cor, curva, escala, espaco, fonte, fonteDoNumero, raio, veu } from "~/tema";

/**
 * AS VITRINES DO FUNIL (20/11/2026): os passos que não perguntam — mostram.
 * A referência do dono vendia por acúmulo: "o aplicativo demonstra
 * informações ali, validando que o aplicativo é bom". Aqui cada vitrine mostra
 * o que é DELA (a semana, o tempo que escolheu, o que a preocupa) e o que o
 * app TEM, contado; nenhuma promete efeito, nenhuma inventa número.
 *
 * O DESENHO (21/11/2026, o dono: "mais clean [...] numa avaliação de um outro
 * nível"): o céu inteiro, uma SUPERFÍCIE só e discreta para agrupar (nunca
 * mais o bloco branco, que cortava o céu em retângulos), o pêssego para o
 * número e o nome que importam, a framboesa só para agir e marcar, e a
 * serifada só no título. Uma ideia por tela, com ar em volta.
 */

const PESSEGO = veu.destaqueNoVeu;
const LINHA = "rgba(255,255,255,0.1)";

function Titulo({ children, centro }: { children: ReactNode; centro?: boolean }) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        ...fonte.display,
        ...escala.titulo1,
        letterSpacing: -0.3,
        color: cor.branco,
        textAlign: centro ? "center" : "left",
      }}
    >
      {children}
    </Text>
  );
}

function Apoio({ children, centro }: { children: ReactNode; centro?: boolean }) {
  return (
    <Text
      style={{
        ...fonte.normal,
        ...escala.chamada,
        color: veu.textoNoVeu,
        textAlign: centro ? "center" : "left",
      }}
    >
      {children}
    </Text>
  );
}

/** O visto redondo das listas (framboesa, como o das opções). */
function Visto({ apagado }: { apagado?: boolean }) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: apagado ? 1.5 : 0,
        borderColor: "rgba(255,255,255,0.3)",
        backgroundColor: apagado ? "transparent" : cor.primaria,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {apagado ? null : <Check size={13} color={cor.branco} strokeWidth={3} />}
    </View>
  );
}

/* ── O prazer ──────────────────────────────────────────────────────────── */

export function VitrineDoPrazer({ nome }: { nome: string }) {
  return (
    <View style={{ alignItems: "center", gap: espaco.lg, paddingTop: espaco.xl }}>
      <Entrada>
        <BolhaViva humor="comemorando" tamanho={180} />
      </Entrada>
      <Titulo centro>
        {"Prazer em te conhecer"}
        {nome ? (
          <>
            {", "}
            <Text style={{ color: PESSEGO }}>{nome}</Text>
          </>
        ) : null}
        {"!"}
      </Titulo>
      <Apoio centro>
        Algumas perguntas rápidas, e o seu plano fica pronto. Leva uns dois minutos.
      </Apoio>
    </View>
  );
}

/* ── A semana revelada ─────────────────────────────────────────────────── */

/**
 * A SEMANA DELA, em letras grandes, cedo no funil: o "momento-WOW" da
 * referência ("SEMANA 38 · Parabéns, Clovis!"). O número na letra
 * arredondada, a Bolha comemorando ao lado (como no céu da aba do Bebê) e a
 * régua do tempo, com o trecho de agora aceso.
 */
export function VitrineDaSemana({ t, nome }: { t: LinhaDoTempo; nome: string }) {
  const reduzido = useMovimentoReduzido();
  const sobe = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  useEffect(() => {
    sucesso();
    if (reduzido) return;
    Animated.timing(sobe, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  }, [reduzido, sobe]);
  const gravida = t.modo === "gravida";
  const numero = gravida ? t.semana : t.semanasDeVida;
  const fracao = gravida ? t.fracao : Math.min(1, t.idadeDias / 84);
  const faltam = gravida ? t.diasAteADpp : t.diasAte12Semanas;
  const marcas = gravida
    ? [
        { rotulo: "1º TRI", em: 0 },
        { rotulo: "2º TRI", em: 14 / 40 },
        { rotulo: "3º TRI", em: 28 / 40 },
      ]
    : [
        { rotulo: "1º MÊS", em: 0 },
        { rotulo: "2º MÊS", em: 1 / 3 },
        { rotulo: "3º MÊS", em: 2 / 3 },
      ];
  return (
    <View style={{ alignItems: "center", gap: espaco.md, paddingTop: espaco.xl }}>
      <Sobretitulo centro>
        {gravida ? "Semana" : numero === 1 ? "Semana de vida" : "Semanas de vida"}
      </Sobretitulo>
      <Animated.View
        style={{
          alignItems: "center",
          opacity: sobe,
          transform: [
            { translateY: sobe.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
            { scale: sobe.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
          ],
        }}
      >
        <Text
          accessibilityLabel={gravida ? `Semana ${numero}` : `${numero} semanas de vida`}
          style={{
            ...fonteDoNumero,
            fontSize: 150,
            lineHeight: 160,
            letterSpacing: -6,
            color: cor.branco,
          }}
        >
          {numero}
        </Text>
        {/* Com um algarismo só, a Bolha se afasta para o lado (como no céu da
            aba do Bebê): ela nunca cobre o número. */}
        <View style={{ position: "absolute", right: numero < 10 ? -104 : -64, bottom: -12 }}>
          <BolhaViva humor="comemorando" tamanho={96} />
        </View>
      </Animated.View>
      <View style={{ height: espaco.sm }} />
      <Titulo centro>
        {"Parabéns"}
        {nome ? (
          <>
            {", "}
            <Text style={{ color: PESSEGO }}>{nome}</Text>
          </>
        ) : null}
        {"!"}
      </Titulo>
      <Apoio centro>
        {gravida
          ? faltam > 0
            ? `Faltam ${faltam} ${faltam === 1 ? "dia" : "dias"} para a data provável. Vamos viver cada um deles com calma.`
            : "A data provável chegou. Vamos viver cada dia com calma."
          : faltam > 0
            ? "As primeiras semanas são um mundo novo para vocês dois. Eu vou junto."
            : "Que caminho vocês já fizeram juntos. Eu vou junto daqui para frente."}
      </Apoio>
      <ReguaDoTempo fracao={fracao} marcas={marcas} />
    </View>
  );
}

function ReguaDoTempo({
  fracao,
  marcas,
}: {
  fracao: number;
  marcas: { rotulo: string; em: number }[];
}) {
  const [largura, setLargura] = useState(0);
  const x = Math.max(12, Math.min(largura - 12, fracao * largura));
  const ETIQUETA = 150;
  const esquerda = Math.max(0, Math.min(largura - ETIQUETA, x - ETIQUETA / 2));
  /* O trecho de agora (o trimestre, ou o mês de vida) é o que a etiqueta aceso. */
  const atual = marcas.reduce((i, m, k) => (fracao >= m.em ? k : i), 0);
  return (
    <View
      style={{ width: "100%", paddingTop: 58, gap: espaco.sm, marginTop: espaco.md }}
      onLayout={(e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width)}
    >
      {largura > 0 ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: esquerda,
            width: ETIQUETA,
            alignItems: "center",
          }}
        >
          <View
            style={{
              borderRadius: raio.pilula,
              paddingHorizontal: espaco.md,
              paddingVertical: 7,
              backgroundColor: cor.branco,
            }}
          >
            <Text numberOfLines={1} style={{ ...fonte.forte, ...escala.legenda, color: cor.texto }}>
              Você está aqui
            </Text>
          </View>
          <View
            style={{
              width: 12,
              height: 12,
              marginTop: -6,
              backgroundColor: cor.branco,
              transform: [{ rotate: "45deg" }],
              /* A ponta segue o ponto quando a etiqueta encosta na borda. */
              marginLeft: 2 * (x - esquerda - ETIQUETA / 2),
            }}
          />
        </View>
      ) : null}
      <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.14)" }}>
        <View
          style={{
            width: `${Math.round(fracao * 100)}%`,
            height: 8,
            borderRadius: 4,
            backgroundColor: PESSEGO,
          }}
        />
        {largura > 0
          ? marcas.slice(1).map((m) => (
              <View
                key={m.rotulo}
                style={{
                  position: "absolute",
                  top: 0,
                  left: m.em * largura - 1,
                  width: 2,
                  height: 8,
                  backgroundColor: veu.fundoDoVeu,
                  opacity: 0.6,
                }}
              />
            ))
          : null}
        {largura > 0 ? (
          <View
            style={{
              position: "absolute",
              top: -7,
              left: x - 11,
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: cor.branco,
              borderWidth: 5,
              borderColor: cor.primaria,
            }}
          />
        ) : null}
      </View>
      <View style={{ height: 18 }}>
        {largura > 0
          ? marcas.map((m, i) => {
              const fimDoTrecho = marcas[i + 1]?.em ?? 1;
              const centro = ((m.em + fimDoTrecho) / 2) * largura;
              return (
                <Text
                  key={m.rotulo}
                  numberOfLines={1}
                  style={{
                    position: "absolute",
                    left: centro - 50,
                    width: 100,
                    textAlign: "center",
                    ...fonte.forte,
                    ...escala.nota,
                    letterSpacing: 1,
                    color: i === atual ? cor.branco : "rgba(221,214,247,0.6)",
                  }}
                >
                  {m.rotulo}
                </Text>
              );
            })
          : null}
      </View>
    </View>
  );
}

/* ── O acolhimento ─────────────────────────────────────────────────────── */

export function VitrineDoAcolhimento({ linhas }: { linhas: { de: string; app: string }[] }) {
  return (
    <View style={{ gap: espaco.lg, paddingTop: espaco.md }}>
      <View style={{ alignItems: "center" }}>
        <BolhaViva humor="apaixonado" tamanho={120} />
      </View>
      <Titulo centro>Você não está sozinha nisso</Titulo>
      <Apoio centro>Para cada coisa que você me contou, o seu plano tem um cuidado.</Apoio>
      <Superficie estilo={{ paddingHorizontal: espaco.lg }}>
        {linhas.map((l, i) => (
          <Entrada key={l.de} atraso={120 + i * 110}>
            <View
              style={{
                paddingVertical: espaco.lg,
                gap: 6,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: LINHA,
              }}
            >
              <Text style={{ ...fonte.media, ...escala.nota, color: veu.textoNoVeu }}>{l.de}</Text>
              <View style={{ flexDirection: "row", gap: espaco.md, alignItems: "flex-start" }}>
                <View style={{ marginTop: 1 }}>
                  <Visto />
                </View>
                <Text style={{ ...fonte.forte, ...escala.chamada, color: cor.branco, flex: 1 }}>
                  {l.app}
                </Text>
              </View>
            </View>
          </Entrada>
        ))}
      </Superficie>
    </View>
  );
}

/* ── As horas de cuidado (o gráfico) ───────────────────────────────────── */

/**
 * "5 minutos por dia viram 8 horas de cuidado com você até a data provável":
 * a conta é dela (os minutos que escolheu × os dias que faltam), e o gráfico
 * só a desenha — uma reta, porque um pouco por dia SOMA em reta. Os marcos
 * dizem quanto já terá somado em cada semana redonda.
 */
export function VitrineDasHoras({
  minutos,
  total,
  fim,
  marcos,
  aulas,
  gravida,
}: {
  minutos: number;
  total: number;
  fim: string;
  marcos: MarcoDaCurva[];
  aulas: number;
  gravida: boolean;
}) {
  return (
    <View style={{ gap: espaco.lg, paddingTop: espaco.lg }}>
      <Text
        accessibilityRole="header"
        style={{ ...fonte.display, ...escala.titulo1, letterSpacing: -0.3, color: cor.branco }}
      >
        {`${minutos} minutos por dia viram `}
        <Text style={{ color: PESSEGO }}>{rotuloDoTempo(total)}</Text>
        {` de cuidado com você até ${fim}`}
      </Text>
      <GraficoDoCuidado marcos={marcos} aulas={aulas} gravida={gravida} />
      <Apoio>
        Um pouco por dia, sem pressa. Se um dia não der, tudo bem: a trilha espera você.
      </Apoio>
    </View>
  );
}

function GraficoDoCuidado({
  marcos,
  aulas,
  gravida,
}: {
  marcos: MarcoDaCurva[];
  aulas: number;
  gravida: boolean;
}) {
  const [largura, setLargura] = useState(0);
  const reduzido = useMovimentoReduzido();
  const desenha = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  useEffect(() => {
    if (reduzido || largura === 0) return;
    Animated.timing(desenha, {
      toValue: 1,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [desenha, largura, reduzido]);
  const altura = 180;
  const margemX = 20;
  const topo = 40;
  const base = altura - 28;
  const ultimo = marcos.at(-1);
  const maxDias = Math.max(1, ultimo?.dias ?? 1);
  const maxMin = Math.max(1, ultimo?.minutos ?? 1);
  const px = (d: number) => margemX + (d / maxDias) * (largura - margemX * 2);
  const py = (m: number) => base - (m / maxMin) * (base - topo);
  const reta = `M ${px(0)} ${py(0)} L ${px(maxDias)} ${py(maxMin)}`;
  const area = `${reta} L ${px(maxDias)} ${base} L ${px(0)} ${base} Z`;
  return (
    <Superficie estilo={{ paddingTop: espaco.lg, paddingBottom: espaco.md, overflow: "hidden" }}>
      <View
        accessible
        accessibilityLabel={`Gráfico: o tempo de cuidado somado de hoje até ${ultimo?.rotulo ?? "o fim"}, com ${aulas} ${gravida ? "aulas" : "desafios"} no caminho.`}
        onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
      >
        <Text
          style={{
            ...fonte.forte,
            ...escala.nota,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: veu.textoNoVeu,
            paddingHorizontal: espaco.lg,
          }}
        >
          Tempo de cuidado com você
        </Text>
        {largura > 0 ? (
          <Animated.View style={{ opacity: desenha }}>
            <Svg width={largura} height={altura}>
              <Defs>
                <Gradiente id="area" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={PESSEGO} stopOpacity={0.32} />
                  <Stop offset="1" stopColor={PESSEGO} stopOpacity={0} />
                </Gradiente>
              </Defs>
              {[topo, (topo + base) / 2, base].map((y) => (
                <Line
                  key={y}
                  x1={margemX}
                  x2={largura - margemX}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.1)"
                  strokeDasharray="3 6"
                />
              ))}
              <Path d={area} fill="url(#area)" />
              <Path d={reta} stroke={PESSEGO} strokeWidth={3} strokeLinecap="round" fill="none" />
              {marcos.map((m, i) => (
                <Circle
                  key={m.rotulo}
                  cx={px(m.dias)}
                  cy={py(m.minutos)}
                  r={i === marcos.length - 1 ? 7 : 5}
                  fill={i === marcos.length - 1 ? cor.branco : veu.fundoDoVeu}
                  stroke={i === marcos.length - 1 ? cor.primaria : PESSEGO}
                  strokeWidth={i === marcos.length - 1 ? 4 : 2.5}
                />
              ))}
            </Svg>
            {/* As etiquetas por cima do desenho: o tempo somado em cada marco. */}
            {marcos.slice(1).map((m) => {
              const fim = m === marcos.at(-1);
              return (
                <View
                  key={m.rotulo}
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: Math.max(4, Math.min(largura - 92, px(m.dias) - 46)),
                    top: py(m.minutos) - 34,
                    width: 92,
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      borderRadius: raio.pilula,
                      paddingHorizontal: 9,
                      paddingVertical: 3,
                      backgroundColor: fim ? cor.branco : "rgba(255,201,168,0.18)",
                    }}
                  >
                    <Text
                      style={{ ...fonte.forte, ...escala.nota, color: fim ? cor.texto : PESSEGO }}
                    >
                      {rotuloDoTempo(m.minutos)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Animated.View>
        ) : (
          <View style={{ height: altura }} />
        )}
        {/* O eixo: cada marco embaixo do seu ponto (Hoje, as semanas redondas, o fim). */}
        <View style={{ height: 18 }}>
          {largura > 0
            ? marcos.map((m, i) => {
                const primeiro = i === 0;
                const fim = i === marcos.length - 1;
                return (
                  <Text
                    key={m.rotulo}
                    numberOfLines={1}
                    style={{
                      position: "absolute",
                      width: 100,
                      left: primeiro ? margemX - 4 : fim ? largura - margemX - 96 : px(m.dias) - 50,
                      textAlign: primeiro ? "left" : fim ? "right" : "center",
                      ...fonte.media,
                      ...escala.nota,
                      color: fim ? cor.branco : veu.textoNoVeu,
                    }}
                  >
                    {m.rotulo}
                  </Text>
                );
              })
            : null}
        </View>
      </View>
    </Superficie>
  );
}

/** O "um pouco por dia" no fim do plano, sem a soma (ver `Horas`, no funil). */
export function VitrineDoRitmo({ minutos, momento }: { minutos: number; momento: Momento | null }) {
  return (
    <View style={{ alignItems: "center", gap: espaco.lg, paddingTop: espaco.xxl }}>
      <BolhaViva humor="feliz" tamanho={150} />
      <Titulo centro>
        {momento
          ? `${minutos} minutos por dia, ${MOMENTO_NA_FRASE[momento]}, só seus`
          : `${minutos} minutos por dia, só seus`}
      </Titulo>
      <Apoio centro>No seu ritmo: um pouco por dia, e a trilha guarda o caminho.</Apoio>
    </View>
  );
}

/* ── A montagem ────────────────────────────────────────────────────────── */

const FRASES_DA_MONTAGEM = [
  "Lendo as suas respostas",
  "Separando as aulas da sua semana",
  "Escolhendo as pausas para o seu momento",
  "Dando os últimos cuidados no seu plano",
];

/** A montagem dura isto (a referência fica uns sete segundos aqui). */
const MONTAGEM_MS = 6500;

/**
 * "Montando o plano de Marina": o número sobe de 0 a 100, as frases trocam e
 * os itens do plano ganham o visto um a um. Ao chegar a 100, `aoTerminar`.
 * Com "reduzir movimento", tudo já pronto.
 */
export function VitrineDaMontagem({
  nome,
  itens,
  aoTerminar,
}: {
  nome: string;
  itens: string[];
  aoTerminar: () => void;
}) {
  const reduzido = useMovimentoReduzido();
  const [pct, setPct] = useState(reduzido ? 100 : 0);
  const barra = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  const terminou = useRef(false);
  useEffect(() => {
    if (reduzido) {
      AccessibilityInfo.announceForAccessibility("O seu plano está pronto.");
      aoTerminar();
      return;
    }
    const inicio = Date.now();
    const relogio = setInterval(() => {
      const f = Math.min(1, (Date.now() - inicio) / MONTAGEM_MS);
      /* Começa ligeiro e desacelera no fim, como quem dá os últimos cuidados. */
      const suave = 1 - Math.pow(1 - f, 2.2);
      setPct(Math.round(suave * 100));
      barra.setValue(suave);
      if (f >= 1 && !terminou.current) {
        terminou.current = true;
        clearInterval(relogio);
        sucesso();
        AccessibilityInfo.announceForAccessibility("O seu plano está pronto.");
        aoTerminar();
      }
    }, 60);
    return () => clearInterval(relogio);
    // A montagem roda uma vez, ao abrir o passo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const frase = FRASES_DA_MONTAGEM[Math.min(FRASES_DA_MONTAGEM.length - 1, Math.floor(pct / 26))]!;
  return (
    <View style={{ alignItems: "center", gap: espaco.lg, paddingTop: espaco.lg }}>
      <BolhaViva humor="estudiosa" tamanho={140} />
      <Text
        accessibilityLabel={`${pct} por cento`}
        style={{
          ...fonteDoNumero,
          fontSize: 64,
          lineHeight: 70,
          color: cor.branco,
          letterSpacing: -2,
        }}
      >
        {pct}
        <Text style={{ color: PESSEGO }}>%</Text>
      </Text>
      <Titulo centro>
        {"Montando o plano"}
        {nome ? (
          <>
            {" de "}
            <Text style={{ color: PESSEGO }}>{nome}</Text>
          </>
        ) : null}
      </Titulo>
      <View
        style={{
          width: "100%",
          height: 6,
          borderRadius: 3,
          backgroundColor: "rgba(255,255,255,0.14)",
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={{
            height: 6,
            borderRadius: 3,
            backgroundColor: PESSEGO,
            width: barra.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
          }}
        />
      </View>
      <Apoio centro>{pct >= 100 ? "Tudo pronto." : `${frase}…`}</Apoio>
      <Superficie estilo={{ width: "100%", padding: espaco.lg, gap: espaco.md }}>
        <Text
          style={{
            ...fonte.forte,
            ...escala.nota,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: veu.textoNoVeu,
          }}
        >
          O seu plano vai ter
        </Text>
        {itens.map((item, i) => {
          const feito = pct >= ((i + 1) / (itens.length + 1)) * 100;
          return (
            <View key={item} style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
              <Visto apagado={!feito} />
              <Text
                style={{
                  ...fonte.media,
                  ...escala.chamada,
                  flex: 1,
                  color: feito ? cor.branco : "rgba(221,214,247,0.5)",
                }}
              >
                {item}
              </Text>
            </View>
          );
        })}
      </Superficie>
    </View>
  );
}

/* ── A diferença ───────────────────────────────────────────────────────── */

export function VitrineDaDiferenca({ linhas }: { linhas: { sem: string; com: string }[] }) {
  return (
    <View style={{ gap: espaco.lg, paddingTop: espaco.lg }}>
      <Titulo centro>A diferença de ter um plano</Titulo>
      <Superficie estilo={{ paddingHorizontal: espaco.lg, paddingBottom: espaco.xs }}>
        {/* O cabeçalho: a Bolha sem plano (apagada) e com o plano (feliz). */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingTop: espaco.lg,
            paddingBottom: espaco.md,
            borderBottomWidth: 1,
            borderBottomColor: LINHA,
          }}
        >
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
            <View style={{ opacity: 0.5 }}>
              <ArteDaBolha humor="surpresa" tamanho={40} />
            </View>
            <Text style={{ ...fonte.forte, ...escala.legenda, color: veu.textoNoVeu }}>
              Sem plano
            </Text>
          </View>
          <View style={{ width: 28 }} />
          <View style={{ flex: 1.15, flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
            <ArteDaBolha humor="feliz" tamanho={40} />
            <Text style={{ ...fonte.forte, ...escala.legenda, color: PESSEGO }}>Com o plano</Text>
          </View>
        </View>
        {linhas.map((l, i) => (
          <Entrada key={l.sem} atraso={100 + i * 90}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: espaco.md + 2,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: LINHA,
              }}
            >
              <Text style={{ ...fonte.media, ...escala.legenda, color: veu.textoNoVeu, flex: 1 }}>
                {l.sem}
              </Text>
              <View style={{ width: 28, alignItems: "center" }}>
                <ArrowRight size={15} color={PESSEGO} strokeWidth={2.4} />
              </View>
              <Text style={{ ...fonte.forte, ...escala.legenda, color: cor.branco, flex: 1.15 }}>
                {l.com}
              </Text>
            </View>
          </Entrada>
        ))}
      </Superficie>
    </View>
  );
}

/* ── O plano pronto ────────────────────────────────────────────────────── */

export type PecaDoPlano = { icone: string; titulo: string; quanto: string };

export function VitrineDoPlanoPronto({
  titulo,
  grandes,
  pecas,
}: {
  titulo: ReactNode;
  grandes: { numero: string; rotulo: string }[];
  pecas: PecaDoPlano[];
}) {
  return (
    <View style={{ gap: espaco.lg, paddingTop: espaco.md }}>
      <View style={{ alignItems: "center" }}>
        <BolhaViva humor="orgulhosa" tamanho={112} />
      </View>
      <Titulo centro>{titulo}</Titulo>
      <Superficie estilo={{ flexDirection: "row", paddingVertical: espaco.lg }}>
        {grandes.map((g, i) => (
          <View
            key={g.rotulo}
            style={{
              flex: 1,
              alignItems: "center",
              gap: 2,
              paddingHorizontal: espaco.sm,
              borderLeftWidth: i === 0 ? 0 : 1,
              borderLeftColor: LINHA,
            }}
          >
            <Text
              style={{
                ...fonteDoNumero,
                fontSize: 42,
                lineHeight: 48,
                letterSpacing: -1,
                color: i === 0 ? PESSEGO : cor.branco,
              }}
            >
              {g.numero}
            </Text>
            <Text
              style={{
                ...fonte.media,
                ...escala.legenda,
                color: veu.textoNoVeu,
                textAlign: "center",
              }}
            >
              {g.rotulo}
            </Text>
          </View>
        ))}
      </Superficie>
      <Sobretitulo>Montado com as suas respostas</Sobretitulo>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.sm }}>
        {pecas.map((p, i) => (
          <Entrada key={p.titulo} atraso={80 + i * 60} estilo={{ width: "48.6%" }}>
            <Superficie estilo={{ padding: espaco.md, gap: 6, minHeight: 112 }}>
              <IconeDoPlano nome={p.icone} corDoIcone={PESSEGO} tamanho={22} />
              <Text style={{ ...fonte.forte, ...escala.chamada, color: cor.branco }}>
                {p.titulo}
              </Text>
              <Text style={{ ...fonte.media, ...escala.nota, color: veu.textoNoVeu }}>
                {p.quanto}
              </Text>
            </Superficie>
          </Entrada>
        ))}
      </View>
    </View>
  );
}

/* ── O resumo do plano, na hora de salvar ──────────────────────────────── */

export function ResumoDoPlano({ linhas }: { linhas: { icone: string; texto: string }[] }) {
  return (
    <Superficie estilo={{ paddingHorizontal: espaco.lg, paddingVertical: espaco.sm }}>
      {linhas.map((l, i) => (
        <View
          key={l.texto}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: espaco.md,
            paddingVertical: espaco.md,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: LINHA,
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              ...curva,
              backgroundColor: "rgba(255,255,255,0.07)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconeDoPlano nome={l.icone} corDoIcone={PESSEGO} tamanho={17} />
          </View>
          <Text style={{ ...fonte.media, ...escala.chamada, color: cor.branco, flex: 1 }}>
            {l.texto}
          </Text>
        </View>
      ))}
    </Superficie>
  );
}
