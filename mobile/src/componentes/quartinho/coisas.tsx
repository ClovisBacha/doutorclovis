import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Fragment, memo, useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, {
  ClipPath,
  Defs,
  Ellipse,
  Image as ImagemSvg,
  LinearGradient as Degrade,
  Mask,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { clarear, escurecer } from "~/lib/cor";
import {
  chaveDaCoisa,
  coisasDoComodo,
  ligada,
  luzesAcesas,
  type Caixa,
  type Coisa,
  type EstadoDasCoisas,
} from "~/lib/quartinho/coisas";
import type { Comodo } from "~/lib/quartinho/quarto";

/**
 * AS COISAS QUE SE TOCAM NO QUARTINHO (25/11/2026) — a luz do teto, a
 * geladeira, o forno e a cortina. As regras e as medidas estão em
 * `lib/quartinho/coisas.ts`; aqui elas viram movimento, SEM arte nova: a
 * porta é o pedaço da própria pintura girando na dobradiça, o miolo é
 * desenhado, e a cortina é o tecido pintado esticado sobre a janela.
 *
 * Três camadas, na ordem em que a tela as põe:
 * - `PortasECortinas`: por cima da pintura e POR BAIXO dos itens (um vaso no
 *   peitoril fica na frente da cortina fechada);
 * - `ToquesDasCoisas`: também por baixo dos itens, para o item tocado ganhar
 *   do toque na parede atrás dele;
 * - `LuzesDasCoisas`: por cima de tudo (a luz cai sobre os itens também).
 *
 * ⚠️ O que travava o app (ver o CLAUDE.md) vale aqui: nada anda em laço, só
 * a transição de abrir e fechar, no fio nativo; e sem `shadowColor` em vista
 * sem fundo.
 */

/** A transição de uma coisa: 0 em repouso, 1 ligada (acesa, aberta, fechada). */
function useTransicao(ligado: boolean, ms: number): Animated.Value {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(ligado ? 1 : 0)).current;
  useEffect(() => {
    if (reduzido) {
      v.setValue(ligado ? 1 : 0);
      return;
    }
    const a = Animated.timing(v, {
      toValue: ligado ? 1 : 0,
      duration: ms,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [ligado, ms, reduzido, v]);
  return v;
}

/** As camadas do remendo, da borda (`ate`) até um pouco dentro da mancha. */
function camadasDaBorda(ate: number): number[] {
  const n = 6;
  return Array.from({ length: n }, (_, i) => ate - ((ate - 0.94) * i) / (n - 1));
}

/** O quadrilátero ampliado (ou encolhido) em volta do meio dele. */
function ampliar(pontos: readonly (readonly [number, number])[], k: number) {
  const mx = pontos.reduce((t, p) => t + p[0], 0) / pontos.length;
  const my = pontos.reduce((t, p) => t + p[1], 0) / pontos.length;
  return pontos.map(([x, y]) => [mx + (x - mx) * k, my + (y - my) * k] as const);
}

const caixaEmPx = ([x0, y0, x1, y1]: Caixa, L: number, A: number) => ({
  left: x0 * L,
  top: y0 * A,
  width: (x1 - x0) * L,
  height: (y1 - y0) * A,
});

/* ── As portas e as cortinas ──────────────────────────────────────────── */

export const PortasECortinas = memo(function PortasECortinas({
  comodo,
  estado,
  pintura,
  noite,
  largura: L,
  altura: A,
}: {
  comodo: Comodo;
  estado: EstadoDasCoisas;
  /** A pintura que está na tela (a de dia ou a de noite): a porta é ela. */
  pintura: number;
  noite: boolean;
  largura: number;
  altura: number;
}) {
  return (
    <>
      {coisasDoComodo(comodo).map((c) =>
        c.tipo === "porta" ? (
          <Porta
            key={c.id}
            coisa={c}
            aberta={ligada(estado, chaveDaCoisa(c))}
            pintura={pintura}
            noite={noite}
            L={L}
            A={A}
          />
        ) : c.tipo === "cortina" ? (
          <Cortina
            key={c.id}
            coisa={c}
            fechada={ligada(estado, chaveDaCoisa(c))}
            pintura={pintura}
            noite={noite}
            L={L}
            A={A}
          />
        ) : null,
      )}
    </>
  );
});

function Porta({
  coisa,
  aberta,
  pintura,
  noite,
  L,
  A,
}: {
  coisa: Extract<Coisa, { tipo: "porta" }>;
  aberta: boolean;
  pintura: number;
  noite: boolean;
  L: number;
  A: number;
}) {
  const v = useTransicao(aberta, 520);
  /* O miolo só existe enquanto a porta não está fechada (nada a desenhar atrás
     de uma porta fechada). */
  const miolo = v.interpolate({ inputRange: [0, 0.04, 1], outputRange: [0, 1, 1] });
  return (
    <>
      {coisa.folhas.map((f, i) => (
        <Animated.View
          key={`miolo-${i}`}
          pointerEvents="none"
          style={[{ position: "absolute", opacity: miolo }, caixaEmPx(f.caixa, L, A)]}
        >
          {coisa.miolo === "geladeira" ? (
            <MioloDaGeladeira congelador={i === 0} noite={noite} />
          ) : (
            <MioloDoForno noite={noite} />
          )}
        </Animated.View>
      ))}
      {coisa.folhas.map((f, i) => {
        const caixa = caixaEmPx(f.caixa, L, A);
        /* A geladeira abre para o lado (a dobradiça à direita: a borda do
           puxador vem na direção dela); o forno abre para baixo (a borda de
           cima vem na direção dela). A porta da geladeira para em 64°: a dobradiça
           fica quase na beirada da tela, e mais aberta ela sumia ali. */
        const giro =
          f.dobradica === "direita"
            ? { rotateY: v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "64deg"] }) }
            : { rotateX: v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-74deg"] }) };
        return (
          <Animated.View
            key={`folha-${i}`}
            pointerEvents="none"
            style={[
              { position: "absolute", overflow: "hidden" },
              caixa,
              {
                transformOrigin: f.dobradica === "direita" ? "right" : "bottom",
                transform: [{ perspective: 520 }, giro],
              },
            ]}
          >
            <Image
              source={pintura}
              allowDownscaling={false}
              contentFit="fill"
              style={{
                position: "absolute",
                left: -caixa.left,
                top: -caixa.top,
                width: L,
                height: A,
              }}
            />
            {/* A porta virando escurece de leve (ela deixa de olhar para a luz). */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: "#2a1a14",
                  opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }),
                },
              ]}
            />
          </Animated.View>
        );
      })}
    </>
  );
}

/** O que se vê dentro da geladeira: o congelador gelado e as prateleiras. */
function MioloDaGeladeira({ congelador, noite }: { congelador: boolean; noite: boolean }) {
  return (
    <View style={{ flex: 1, borderRadius: 5, overflow: "hidden" }}>
      <LinearGradient
        colors={congelador ? ["#e9f6fb", "#cfe7f1"] : ["#f7fcfe", "#d6eaf2"]}
        style={StyleSheet.absoluteFill}
      />
      {/* A luzinha de dentro, no alto. */}
      <LinearGradient
        colors={["rgba(255,255,255,0.95)", "rgba(255,255,255,0)"]}
        locations={[0, 0.55]}
        style={StyleSheet.absoluteFill}
      />
      {/* O fundo fundo: a borda de dentro, mais escura. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderWidth: 2.5, borderColor: "rgba(70,110,125,0.32)", borderRadius: 5 },
        ]}
      />
      {congelador ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 2 }}>
          <Linha emojis={["🧊", "🍦"]} />
          <Linha emojis={["🧊"]} />
        </View>
      ) : (
        <View style={{ flex: 1, justifyContent: "space-evenly", paddingVertical: 2 }}>
          <Prateleira emojis={["🥛", "🧀"]} />
          <Prateleira emojis={["🍓", "🥕"]} />
          <Prateleira emojis={["🍎", "🍐"]} ultima />
        </View>
      )}
      {noite ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.08)" }]}
        />
      ) : null}
    </View>
  );
}

function Linha({ emojis }: { emojis: string[] }) {
  return (
    <Text allowFontScaling={false} style={{ fontSize: 12, lineHeight: 15, textAlign: "center" }}>
      {emojis.join(" ")}
    </Text>
  );
}

function Prateleira({ emojis, ultima = false }: { emojis: string[]; ultima?: boolean }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Linha emojis={emojis} />
      {ultima ? null : (
        <View
          style={{
            alignSelf: "stretch",
            marginHorizontal: 3,
            height: 2,
            borderRadius: 1,
            backgroundColor: "rgba(120,170,190,0.55)",
          }}
        />
      )}
    </View>
  );
}

/** O que se vê dentro do forno: a luz alaranjada e a bandeja de biscoitos. */
function MioloDoForno({ noite }: { noite: boolean }) {
  return (
    <View style={{ flex: 1, borderRadius: 4, overflow: "hidden" }}>
      <LinearGradient
        colors={noite ? ["#ff9a3c", "#7a2e12", "#2a120a"] : ["#ff9f45", "#8a3a16", "#3a1a0e"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* A bandeja no meio: embaixo, a porta aberta a cobria. */}
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 4 }}>
        <Text allowFontScaling={false} style={{ fontSize: 11, lineHeight: 13 }}>
          🍪🍪
        </Text>
        {/* A grade. */}
        <View
          style={{
            alignSelf: "stretch",
            marginHorizontal: 3,
            height: 2,
            borderRadius: 1,
            backgroundColor: "rgba(40,20,12,0.7)",
          }}
        />
      </View>
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderWidth: 2, borderColor: "rgba(30,12,6,0.55)", borderRadius: 4 },
        ]}
      />
    </View>
  );
}

function Cortina({
  coisa,
  fechada,
  pintura,
  noite,
  L,
  A,
}: {
  coisa: Extract<Coisa, { tipo: "cortina" }>;
  fechada: boolean;
  pintura: number;
  noite: boolean;
  L: number;
  A: number;
}) {
  const v = useTransicao(fechada, 620);
  const [tx0, ty0, tx1, ty1] = coisa.tecido;
  const remendos = coisa.remendos[noite ? "noite" : "dia"];
  return (
    <>
      {remendos.length ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: v }]}>
          <Svg width={L} height={A}>
            <Defs>
              {remendos.map((r, i) => (
                <Mask key={i} id={`remendo-${coisa.comodo}-${i}`}>
                  {/* Cinco camadas da mancha, da maior à menor, somadas: o
                      miolo cobre inteiro e a borda some aos poucos. */}
                  {camadasDaBorda(r.borda ?? 1.36).map((k) => (
                    <Polygon
                      key={k}
                      points={ampliar(r.mancha, k)
                        .map(([x, y]) => `${x * L},${y * A}`)
                        .join(" ")}
                      fill="#ffffff"
                      fillOpacity={0.42}
                    />
                  ))}
                </Mask>
              ))}
            </Defs>
            {remendos.map((r, i) =>
              r.tinta ? (
                <Rect
                  key={i}
                  x={0}
                  y={0}
                  width={L}
                  height={A}
                  fill={r.tinta}
                  mask={`url(#remendo-${coisa.comodo}-${i})`}
                />
              ) : (
                <ImagemSvg
                  key={i}
                  href={pintura}
                  x={-(r.de?.[0] ?? 0) * L}
                  y={-(r.de?.[1] ?? 0) * A}
                  width={L}
                  height={A}
                  preserveAspectRatio="none"
                  mask={`url(#remendo-${coisa.comodo}-${i})`}
                />
              ),
            )}
          </Svg>
        </Animated.View>
      ) : null}
      {coisa.panos.map((pano, i) => {
        const xs = pano.map((p) => p[0] * L);
        const ys = pano.map((p) => p[1] * A);
        const bx = Math.min(...xs);
        const by = Math.min(...ys);
        const bw = Math.max(...xs) - bx;
        const bh = Math.max(...ys) - by;
        /* O pano cresce do lado de fora (onde a cortina estava presa). */
        const deFora = pano[0]![0] < pano[1]![0] ? "left" : "right";
        /* O tecido liso da pintura, esticado para cobrir o pano inteiro. */
        const iw = bw / (tx1 - tx0);
        const ih = bh / (ty1 - ty0);
        const id = `pano-${coisa.comodo}-${i}`;
        return (
          <Animated.View
            key={id}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: bx,
              top: by,
              width: bw,
              height: bh,
              opacity: v.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 1, 1] }),
              transformOrigin: deFora,
              transform: [{ scaleX: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
            }}
          >
            <Svg width={bw} height={bh}>
              <Defs>
                <ClipPath id={id}>
                  <Polygon
                    points={pano.map((p) => `${p[0] * L - bx},${p[1] * A - by}`).join(" ")}
                  />
                </ClipPath>
                {/* A dobra do meio, onde os dois panos se encontram, na sombra. */}
                <Degrade
                  id={`${id}-dobra`}
                  x1={deFora === "left" ? "0" : "1"}
                  y1="0"
                  x2={deFora === "left" ? "1" : "0"}
                  y2="0"
                >
                  <Stop offset="0.72" stopColor="#3a2016" stopOpacity={0} />
                  <Stop offset="1" stopColor="#3a2016" stopOpacity={noite ? 0.3 : 0.16} />
                </Degrade>
              </Defs>
              <ImagemSvg
                href={pintura}
                x={-tx0 * iw}
                y={-ty0 * ih}
                width={iw}
                height={ih}
                preserveAspectRatio="none"
                clipPath={`url(#${id})`}
              />
              <Polygon
                points={pano.map((p) => `${p[0] * L - bx},${p[1] * A - by}`).join(" ")}
                fill={`url(#${id}-dobra)`}
              />
            </Svg>
          </Animated.View>
        );
      })}
    </>
  );
}

/* ── Os toques ────────────────────────────────────────────────────────── */

export const ToquesDasCoisas = memo(function ToquesDasCoisas({
  comodo,
  estado,
  largura: L,
  altura: A,
  aoTocar,
}: {
  comodo: Comodo;
  estado: EstadoDasCoisas;
  largura: number;
  altura: number;
  aoTocar: (c: Coisa) => void;
}) {
  return (
    <>
      {coisasDoComodo(comodo).map((c) => {
        const ligado = ligada(estado, chaveDaCoisa(c));
        const rotulo =
          c.tipo === "luz"
            ? `${ligado ? "Apagar" : "Acender"} ${c.nome}`
            : c.tipo === "cortina"
              ? `${ligado ? "Abrir" : "Fechar"} ${c.nome}`
              : `${ligado ? "Fechar" : "Abrir"} ${c.nome}`;
        const caixa = caixaEmPx(c.toque, L, A);
        /* O alvo nunca menor que 44 pt (a luz do teto é um ponto). */
        const w = Math.max(44, caixa.width);
        const h = Math.max(44, caixa.height);
        return (
          <Pressable
            key={chaveDaCoisa(c)}
            accessibilityRole={c.tipo === "luz" ? "switch" : "button"}
            accessibilityState={c.tipo === "luz" ? { checked: ligado } : undefined}
            accessibilityLabel={rotulo}
            onPress={() => aoTocar(c)}
            style={{
              position: "absolute",
              left: caixa.left + caixa.width / 2 - w / 2,
              top: caixa.top + caixa.height / 2 - h / 2,
              width: w,
              height: h,
            }}
          />
        );
      })}
    </>
  );
});

/* ── As luzes ─────────────────────────────────────────────────────────── */

export const LuzesDasCoisas = memo(function LuzesDasCoisas({
  comodo,
  estado,
  noite,
  largura: L,
  altura: A,
}: {
  comodo: Comodo;
  estado: EstadoDasCoisas;
  noite: boolean;
  largura: number;
  altura: number;
}) {
  const acesas = luzesAcesas(estado, comodo);
  /* De noite, cada luz acesa clareia o cômodo inteiro um pouco (o quarto
     escuro "acende"); de dia a luz do sol já está lá. */
  const clareia = useTransicao(noite && acesas > 0, 420);
  /* A cortina fechada tira a luz da janela: o cômodo fica um pouco mais na
     sombra (a tela também apaga o sol e o luar que entravam por ela). */
  const fechada = coisasDoComodo(comodo).some(
    (c) => c.tipo === "cortina" && ligada(estado, chaveDaCoisa(c)),
  );
  const sombra = useTransicao(fechada, 620);
  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: noite ? "#06071c" : "#3b2230",
            opacity: sombra.interpolate({
              inputRange: [0, 1],
              outputRange: [0, noite ? 0.2 : 0.14],
            }),
          },
        ]}
      />
      {noite ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: clareia }]}>
          <Clarao
            cx={0.5 * L}
            cy={0.5 * A}
            raio={0.95 * L}
            achatar={1.5}
            tom="#ffd2a1"
            forca={acesas > 1 ? 0.34 : 0.22}
          />
        </Animated.View>
      ) : null}
      {coisasDoComodo(comodo).map((c) =>
        c.tipo === "luz" ? (
          <LuzDoTeto
            key={c.id}
            coisa={c}
            acesa={ligada(estado, chaveDaCoisa(c))}
            noite={noite}
            L={L}
            A={A}
          />
        ) : c.tipo === "porta" ? (
          <LuzDaPorta
            key={c.id}
            coisa={c}
            aberta={ligada(estado, chaveDaCoisa(c))}
            noite={noite}
            L={L}
            A={A}
          />
        ) : null,
      )}
    </>
  );
});

function LuzDoTeto({
  coisa,
  acesa,
  noite,
  L,
  A,
}: {
  coisa: Extract<Coisa, { tipo: "luz" }>;
  acesa: boolean;
  noite: boolean;
  L: number;
  A: number;
}) {
  const v = useTransicao(acesa, 260);
  const forca = noite ? 1 : 0.6;
  /* O cone: do ponto (estreito) até o chão (largo), sumindo para baixo, em
     QUATRO camadas cada vez mais estreitas (como o feixe da janela): a borda
     some aos poucos, sem a quina dura de um triângulo. */
  const camadas = [1, 0.78, 0.56, 0.34];
  return (
    <>
      {/* APAGADA, de dia: a pintura tem o ponto aceso (a lente branca e o
          halo); por cima dele, o halo some na cor do teto e a lente fica a
          de uma luz desligada. De noite a pintura já está apagada. */}
      {noite ? null : (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
          ]}
        >
          <Svg width={L} height={A}>
            <Defs>
              <RadialGradient
                id={`teto-${coisa.comodo}-${coisa.id}`}
                cx="50%"
                cy="50%"
                rx="50%"
                ry="50%"
              >
                <Stop offset="0" stopColor={coisa.teto} stopOpacity={0.95} />
                <Stop offset="0.55" stopColor={coisa.teto} stopOpacity={0.7} />
                <Stop offset="1" stopColor={coisa.teto} stopOpacity={0} />
              </RadialGradient>
              <Degrade id={`lente-${coisa.comodo}-${coisa.id}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={escurecer(coisa.teto, 0.2)} />
                <Stop offset="1" stopColor={escurecer(coisa.teto, 0.07)} />
              </Degrade>
            </Defs>
            {coisa.pontos.map((p, i) => (
              <Ellipse
                key={`h${i}`}
                cx={p.x * L}
                cy={p.y * A}
                rx={p.rx * L * 2.3}
                ry={p.ry * A * 3.2}
                fill={`url(#teto-${coisa.comodo}-${coisa.id})`}
              />
            ))}
            {coisa.pontos.map((p, i) => (
              <Ellipse
                key={`a${i}`}
                cx={p.x * L}
                cy={p.y * A}
                rx={p.rx * L}
                ry={p.ry * A}
                fill={clarear(coisa.teto, 0.32)}
                stroke={escurecer(coisa.teto, 0.12)}
                strokeWidth={0.6}
              />
            ))}
            {coisa.pontos.map((p, i) => (
              <Ellipse
                key={`l${i}`}
                cx={p.x * L}
                cy={p.y * A + p.ry * A * 0.06}
                rx={p.rx * L * 0.79}
                ry={p.ry * A * 0.7}
                fill={`url(#lente-${coisa.comodo}-${coisa.id})`}
              />
            ))}
          </Svg>
        </Animated.View>
      )}

      {/* ACESA: o cone, a poça, o halo e o ponto. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: v }]}>
        <View style={[StyleSheet.absoluteFill, { mixBlendMode: "screen" }]}>
          <Svg width={L} height={A}>
            {coisa.pontos.map((p, i) => {
              if (!p.chao) return null;
              const [px, py] = [p.x * L, p.y * A];
              const [cx, cy] = [p.chao[0] * L, p.chao[1] * A];
              const id = `cone-${coisa.comodo}-${coisa.id}-${i}`;
              return (
                <Fragment key={id}>
                  <Defs>
                    <Degrade id={id} x1="0" y1={py} x2="0" y2={cy} gradientUnits="userSpaceOnUse">
                      <Stop offset="0" stopColor="#fff1d6" stopOpacity={0.07 * forca} />
                      <Stop offset="0.6" stopColor="#ffe2b8" stopOpacity={0.035 * forca} />
                      <Stop offset="1" stopColor="#ffe2b8" stopOpacity={0} />
                    </Degrade>
                  </Defs>
                  {camadas.map((k) => {
                    const topo = p.rx * L * 0.7 * k;
                    const base = 0.19 * L * k;
                    return (
                      <Polygon
                        key={k}
                        points={`${px - topo},${py} ${px + topo},${py} ${cx + base},${cy} ${cx - base},${cy}`}
                        fill={`url(#${id})`}
                      />
                    );
                  })}
                </Fragment>
              );
            })}
          </Svg>
        </View>
        {coisa.pontos.map((p, i) => (
          <Fragment key={i}>
            {p.chao ? (
              <Clarao
                cx={p.chao[0] * L}
                cy={p.chao[1] * A}
                raio={0.22 * L}
                achatar={0.38}
                tom="#ffd9a0"
                forca={0.42 * forca}
              />
            ) : null}
            <Clarao
              cx={p.x * L}
              cy={p.y * A + 2}
              raio={p.rx * L * 4.6}
              tom="#ffe6bd"
              forca={0.75 * forca}
            />
            <Clarao
              cx={p.x * L}
              cy={p.y * A}
              raio={p.rx * L * 1.3}
              achatar={0.6}
              tom="#ffffff"
              forca={1}
            />
          </Fragment>
        ))}
      </Animated.View>
    </>
  );
}

/** A luz que sai da geladeira aberta (fria) e do forno aberto (quente). */
function LuzDaPorta({
  coisa,
  aberta,
  noite,
  L,
  A,
}: {
  coisa: Extract<Coisa, { tipo: "porta" }>;
  aberta: boolean;
  noite: boolean;
  L: number;
  A: number;
}) {
  const v = useTransicao(aberta, 520);
  const [x0, y0, x1, y1] = coisa.toque;
  const cx = ((x0 + x1) / 2) * L;
  const cy = ((y0 + y1) / 2) * A;
  const fria = coisa.miolo === "geladeira";
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: v }]}>
      <Clarao
        cx={cx}
        cy={cy}
        raio={(x1 - x0) * L * (fria ? 1.1 : 1.6)}
        achatar={fria ? 1.6 : 1}
        tom={fria ? "#dff4ff" : "#ffb35e"}
        forca={(noite ? 0.55 : 0.3) * (fria ? 1 : 1.2)}
      />
    </Animated.View>
  );
}

/** Um clarão redondo somado à pintura (`screen`): a luz nunca escurece nada. */
function Clarao({
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
  const id = `clarao-${tom.slice(1)}-${Math.round(cx)}-${Math.round(cy)}-${Math.round(raio)}`;
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
            <Stop offset="0" stopColor={tom} stopOpacity={Math.min(1, forca)} />
            <Stop offset="0.42" stopColor={tom} stopOpacity={Math.min(1, forca) * 0.42} />
            <Stop offset="1" stopColor={tom} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
