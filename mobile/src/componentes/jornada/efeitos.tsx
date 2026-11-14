import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { corJornada } from "~/componentes/jornada/cores";
import { useMovimentoReduzido } from "~/componentes/movimento";

/**
 * OS EFEITOS DA GAMIFICAÇÃO — a Jornada responde a cada coisa que ela faz.
 *
 * Regra: toda animação daqui é RESPOSTA a uma conquista dela (ganhou, acendeu,
 * subiu, acertou). Nada se mexe sozinho sem motivo, e "reduzir movimento"
 * deixa tudo parado e completo — o número final, a estrela acesa.
 */

/* ── Odômetro: o número rola até o valor novo ─────────────────────────── */

export function Odometro({
  valor,
  estilo,
  duracao = 700,
}: {
  /** Número, ou um texto ("…", "—") que aparece como está. */
  valor: number | string;
  estilo?: StyleProp<TextStyle>;
  duracao?: number;
}) {
  const reduzido = useMovimentoReduzido();
  const alvo =
    typeof valor === "number"
      ? valor
      : Number.isFinite(Number(valor)) && valor !== ""
        ? Number(valor)
        : null;
  const [mostrado, setMostrado] = useState<number | null>(alvo);
  const anterior = useRef<number | null>(alvo);
  useEffect(() => {
    const de = anterior.current;
    anterior.current = alvo;
    if (alvo == null || de == null || reduzido || alvo === de) {
      setMostrado(alvo);
      return;
    }
    const v = new Animated.Value(de);
    const id = v.addListener(({ value }) => setMostrado(Math.round(value)));
    const a = Animated.timing(v, {
      toValue: alvo,
      duration: duracao,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    a.start(() => setMostrado(alvo));
    return () => {
      a.stop();
      v.removeListener(id);
    };
  }, [alvo, duracao, reduzido]);
  return <Text style={estilo}>{alvo == null ? String(valor) : String(mostrado ?? alvo)}</Text>;
}

/* ── Faíscas: o estouro em volta do que acendeu ───────────────────────── */

export function Faiscas({
  disparo,
  cor = corJornada.estrela,
  raio = 28,
  pecas = 8,
}: {
  /** Muda para disparar (um contador, uma chave). `0`/null não dispara. */
  disparo: number | string | null;
  cor?: string;
  raio?: number;
  pecas?: number;
}) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(0)).current;
  const [ativo, setAtivo] = useState(false);
  useEffect(() => {
    if (!disparo || reduzido) return;
    setAtivo(true);
    v.setValue(0);
    const a = Animated.timing(v, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    a.start(() => setAtivo(false));
    return () => a.stop();
  }, [disparo, reduzido, v]);
  if (!ativo) return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0 }}
    >
      {Array.from({ length: pecas }, (_, i) => {
        const ang = (i / pecas) * Math.PI * 2;
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: -3,
              top: -3,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: cor,
              opacity: v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.9, 0] }),
              transform: [
                {
                  translateX: v.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.cos(ang) * raio],
                  }),
                },
                {
                  translateY: v.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.sin(ang) * raio],
                  }),
                },
                { scale: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.4, 1.2, 0.3] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}

/* ── Estouro: o que acendeu infla e assenta ───────────────────────────── */

export function Estouro({ ativo, children }: { ativo: boolean; children: ReactNode }) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(1)).current;
  const antes = useRef(ativo);
  const [disparo, setDisparo] = useState(0);
  useEffect(() => {
    const acendeu = ativo && !antes.current;
    antes.current = ativo;
    if (!acendeu || reduzido) return;
    setDisparo((d) => d + 1);
    v.setValue(0.3);
    Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 16 }).start();
  }, [ativo, reduzido, v]);
  return (
    <View>
      <Animated.View style={{ transform: [{ scale: v }] }}>{children}</Animated.View>
      <Faiscas disparo={disparo} />
    </View>
  );
}

/* ── Sementinhas que sobem ────────────────────────────────────────────── */

/**
 * As 🌱 saem do cartão do ganho e sobem em leque até sumir — o "ganhei" que se
 * vê. `quantidade` só decide quantas (no máximo 8): o número de verdade é o do
 * texto, nunca o das sementinhas desenhadas.
 */
export function SementesSubindo({
  quantidade,
  disparo,
}: {
  quantidade: number;
  disparo: number | string | null;
}) {
  const reduzido = useMovimentoReduzido();
  const n = Math.max(3, Math.min(8, Math.ceil(quantidade / 3)));
  const itens = useRef(
    Array.from({ length: 8 }, (_, i) => ({
      v: new Animated.Value(0),
      dx: (i % 2 === 0 ? 1 : -1) * (20 + ((i * 37) % 70)),
      sobe: 140 + ((i * 53) % 90),
      atraso: i * 70,
      gira: (i % 2 === 0 ? 1 : -1) * (15 + ((i * 29) % 30)),
    })),
  ).current;
  const [ativo, setAtivo] = useState(false);
  useEffect(() => {
    if (!disparo || reduzido) return;
    setAtivo(true);
    const anims = itens.slice(0, n).map((p) => {
      p.v.setValue(0);
      return Animated.timing(p.v, {
        toValue: 1,
        duration: 1100,
        delay: p.atraso,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });
    });
    Animated.parallel(anims).start(() => setAtivo(false));
    return () => anims.forEach((a) => a.stop());
  }, [disparo, itens, n, reduzido]);
  if (!ativo) return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: "50%", top: "40%", width: 0, height: 0 }}
    >
      {itens.slice(0, n).map((p, i) => (
        <Animated.Text
          key={i}
          style={{
            position: "absolute",
            left: -12,
            top: -12,
            fontSize: 24,
            opacity: p.v.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateX: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
              { translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, -p.sobe] }) },
              {
                scale: p.v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.15, 0.8] }),
              },
              {
                rotate: p.v.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", `${p.gira}deg`],
                }),
              },
            ],
          }}
        >
          🌱
        </Animated.Text>
      ))}
    </View>
  );
}

/* ── A chama viva ─────────────────────────────────────────────────────── */

/**
 * Tremula devagar enquanto acesa (dois laços com períodos diferentes, para não
 * parecer metrônomo) e dá um pulo quando a sequência sobe.
 */
export function ChamaViva({
  acesa,
  dias,
  children,
}: {
  acesa: boolean;
  dias: number;
  children: ReactNode;
}) {
  const reduzido = useMovimentoReduzido();
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  const pulo = useRef(new Animated.Value(1)).current;
  const antes = useRef(dias);
  useEffect(() => {
    if (!acesa || reduzido) return;
    const onda = (v: Animated.Value, ms: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, {
            toValue: 1,
            duration: ms,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: ms,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
    const l1 = onda(a, 620);
    const l2 = onda(b, 910);
    l1.start();
    l2.start();
    return () => {
      l1.stop();
      l2.stop();
    };
  }, [a, acesa, b, reduzido]);
  useEffect(() => {
    const subiu = dias > antes.current;
    antes.current = dias;
    if (!subiu || reduzido) return;
    pulo.setValue(1.6);
    Animated.spring(pulo, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 18 }).start();
  }, [dias, pulo, reduzido]);
  return (
    <Animated.View
      style={{
        transform: [
          { scale: pulo },
          { scaleY: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
          { rotate: b.interpolate({ inputRange: [0, 1], outputRange: ["-4deg", "4deg"] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/* ── Halo: o anel que respira em volta do "agora" ─────────────────────── */

export function Halo({
  cor,
  tamanho,
  ativo = true,
}: {
  cor: string;
  tamanho: number;
  ativo?: boolean;
}) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ativo || reduzido) return;
    const laco = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(600),
      ]),
    );
    laco.start();
    return () => laco.stop();
  }, [ativo, reduzido, v]);
  if (!ativo || reduzido) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: tamanho,
        height: tamanho,
        borderRadius: tamanho / 2,
        backgroundColor: cor,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
      }}
    />
  );
}

/* ── Pulinho: a bolha saltitando sobre o dia de hoje ──────────────────── */

export function Pulinho({
  children,
  estilo,
}: {
  children: ReactNode;
  estilo?: StyleProp<ViewStyle>;
}) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduzido) return;
    const laco = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 340,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: 340,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(900),
      ]),
    );
    laco.start();
    return () => laco.stop();
  }, [reduzido, v]);
  return (
    <Animated.View
      style={[
        {
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
            /* Achata um pouco ao tocar o chão: o "squash" que faz parecer peso. */
            { scaleY: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.92, 1, 1.04] }) },
          ],
        },
        estilo,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/* ── Balanço: o "não" gentil (cadeado, resposta errada) ───────────────── */

export function useBalanco() {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(0)).current;
  const balancar = () => {
    if (reduzido) return;
    v.setValue(0);
    Animated.sequence(
      [8, -7, 5, -4, 2, 0].map((x) =>
        Animated.timing(v, {
          toValue: x,
          duration: 55,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    ).start();
  };
  return { estilo: { transform: [{ translateX: v }] }, balancar };
}

/* ── Quique: o "sim" (resposta certa) ─────────────────────────────────── */

export function useQuique() {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(1)).current;
  const quicar = () => {
    if (reduzido) return;
    v.setValue(0.92);
    Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 18 }).start();
  };
  return { estilo: { transform: [{ scale: v }] }, quicar };
}

/* ── Constelação: as cinco estrelas em órbita na festa ────────────────── */

export function Constelacao({
  tamanho,
  children,
  estrela,
}: {
  tamanho: number;
  children: ReactNode;
  /** Como desenhar uma estrela (a da Jornada), para não duplicar o SVG. */
  estrela: (i: number) => ReactNode;
}) {
  const reduzido = useMovimentoReduzido();
  const giro = useRef(new Animated.Value(0)).current;
  const chegada = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(reduzido ? 1 : 0)),
  ).current;
  useEffect(() => {
    if (reduzido) {
      chegada.forEach((c) => c.setValue(1));
      return;
    }
    Animated.stagger(
      120,
      chegada.map((c) =>
        Animated.spring(c, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 14 }),
      ),
    ).start();
    const laco = Animated.loop(
      Animated.timing(giro, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    laco.start();
    return () => laco.stop();
  }, [chegada, giro, reduzido]);
  const r = tamanho / 2 + 18;
  return (
    <View
      style={{
        width: tamanho + 72,
        height: tamanho + 72,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 0,
          height: 0,
          transform: [
            { rotate: giro.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) },
          ],
        }}
      >
        {chegada.map((c, i) => {
          const ang = (i / 5) * Math.PI * 2 - Math.PI / 2;
          return (
            <Animated.View
              key={i}
              style={{
                position: "absolute",
                left: Math.cos(ang) * r - 15,
                top: Math.sin(ang) * r - 15,
                opacity: c,
                transform: [
                  { scale: c.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
                ],
              }}
            >
              {estrela(i)}
            </Animated.View>
          );
        })}
      </Animated.View>
    </View>
  );
}

/* ── Virada 3D: a conquista que se revela ─────────────────────────────── */

export function useVirada() {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(0)).current;
  const virar = () => {
    if (reduzido) return;
    v.setValue(0);
    Animated.timing(v, {
      toValue: 1,
      duration: 800,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };
  const estilo = {
    transform: [
      { perspective: 700 },
      { rotateY: v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) },
      { scale: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.12, 1] }) },
    ],
  };
  return { estilo, virar };
}

/* ── Descolar: a figurinha que sai do álbum ───────────────────────────── */

export function Descolar({ ativo, children }: { ativo: boolean; children: ReactNode }) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(ativo && !reduzido ? 0 : 1)).current;
  useEffect(() => {
    if (!ativo || reduzido) {
      v.setValue(1);
      return;
    }
    v.setValue(0);
    Animated.sequence([
      Animated.delay(250),
      Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 6, bounciness: 12 }),
    ]).start();
  }, [ativo, reduzido, v]);
  return (
    <Animated.View
      style={{
        transform: [
          { perspective: 600 },
          { rotateX: v.interpolate({ inputRange: [0, 1], outputRange: ["75deg", "0deg"] }) },
          { rotateZ: v.interpolate({ inputRange: [0, 1], outputRange: ["-14deg", "0deg"] }) },
          { scale: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.5, 1.15, 1] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
