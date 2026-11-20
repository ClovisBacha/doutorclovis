import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { selecao, Tocavel } from "~/componentes/base";
import { ArteDaBolha, useMovimentoReduzido } from "~/componentes/movimento";
import {
  abrirConversa,
  responder,
  type ContextoDaBolha,
  type Destino,
  type Fala,
  type HumorDela,
  type Resposta,
} from "~/lib/bolha/conversa";
import { HUMORES } from "~/lib/jornada/caminho";
import { canto, cor, curva, escala, espaco, fonte, luz, sombra } from "~/tema";

/**
 * A CONVERSA COM A BOLHA (19/11/2026) — a Bolha guia na tela.
 *
 * O dono: "o bebê bolha vai ser aquele personagem que vai conversar com a
 * mãe". Ela fala num balão (o que `lib/bolha/conversa.ts` escolhe para o
 * momento), e as respostas dela viram botões: o humor do dia (o mesmo
 * check-in da trilha), um cuidado ("Respirar comigo"), "Outra coisa", "Agora
 * não". A resposta tocada aparece do lado dela, como numa conversa, e a Bolha
 * "digita" um instante antes de responder.
 *
 * Tocar na Bolha recomeça a conversa. Movimento: os três pontinhos uma vez por
 * fala, e nada com "reduzir movimento".
 */
export const ConversaComABolha = memo(function ConversaComABolha({
  contexto,
  aoAbrir,
  aoMarcarHumor,
}: {
  contexto: ContextoDaBolha;
  /** Uma resposta que leva a uma tela (a aula, respirar, os sons…). */
  aoAbrir: (d: Destino) => void;
  /** O humor que ela contou (grava o check-in do dia, o mesmo da trilha). */
  aoMarcarHumor: (humor: HumorDela) => void;
}) {
  const reduzido = useMovimentoReduzido();
  /* A conversa abre com o contexto da montagem; o que ela responde guia o
     resto. Um contexto novo (outro dia, outra hora) recomeça. */
  const chave = `${contexto.D}-${contexto.hora}-${contexto.humor ?? ""}-${contexto.feitos.length}`;
  const [fala, setFala] = useState<Fala>(() => abrirConversa(contexto));
  const [dela, setDela] = useState<string | null>(null);
  const [digitando, setDigitando] = useState(false);
  const ctx = useRef(contexto);
  ctx.current = contexto;
  const ultimaChave = useRef(chave);
  useEffect(() => {
    if (ultimaChave.current === chave) return;
    ultimaChave.current = chave;
    /* O dia mudou por fora (fez um cuidado, marcou o humor na trilha): a Bolha
       retoma do ponto certo, sem repetir a pergunta que já foi respondida. */
    if (!dela) setFala(abrirConversa(contexto));
  }, [chave, contexto, dela]);

  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (espera.current) clearTimeout(espera.current);
    },
    [],
  );

  const falar = useCallback(
    (proxima: Fala) => {
      if (espera.current) clearTimeout(espera.current);
      if (reduzido) {
        setFala(proxima);
        return;
      }
      setDigitando(true);
      espera.current = setTimeout(() => {
        setDigitando(false);
        setFala(proxima);
        if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(proxima.texto);
      }, 650);
    },
    [reduzido],
  );

  const aoResponder = useCallback(
    (r: Resposta) => {
      selecao();
      if (r.tipo === "abrir") {
        aoAbrir(r.destino);
        return;
      }
      setDela(r.rotulo);
      if (r.tipo === "humor") aoMarcarHumor(r.humor);
      const proxima = responder(ctx.current, r);
      if (proxima) falar(proxima);
    },
    [aoAbrir, aoMarcarHumor, falar],
  );

  const recomecar = useCallback(() => {
    setDela(null);
    falar(abrirConversa(ctx.current));
  }, [falar]);

  return (
    <View style={{ gap: espaco.md }}>
      {dela ? <BalaoDela texto={dela} /> : null}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: espaco.sm }}>
        <Tocavel
          aoTocar={recomecar}
          rotulo="A Bolha. Toque para recomeçar a conversa"
          profundidade={0.92}
        >
          <ArteDaBolha humor={fala.pose} tamanho={64} />
        </Tocavel>
        <View
          accessibilityLiveRegion="polite"
          style={{
            flex: 1,
            borderRadius: canto.dentro,
            borderBottomLeftRadius: 6,
            ...curva,
            paddingHorizontal: 14,
            paddingVertical: 12,
            backgroundColor: cor.cartao,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: "rgba(255,255,255,0.95)",
            ...sombra,
          }}
        >
          {digitando ? (
            <Digitando />
          ) : (
            <Text style={{ ...fonte.media, ...escala.corpo, color: cor.texto }}>{fala.texto}</Text>
          )}
        </View>
      </View>
      {!digitando && fala.respostas.length ? (
        <Respostas respostas={fala.respostas} aoResponder={aoResponder} />
      ) : null}
    </View>
  );
});

/** A resposta dela, do lado direito (a cor framboesa clara do app). */
function BalaoDela({ texto }: { texto: string }) {
  return (
    <View
      style={{
        alignSelf: "flex-end",
        maxWidth: "78%",
        borderRadius: canto.dentro,
        borderBottomRightRadius: 6,
        ...curva,
        paddingHorizontal: 14,
        paddingVertical: 9,
        backgroundColor: cor.destaque,
      }}
    >
      <Text style={{ ...fonte.forte, ...escala.chamada, color: cor.textoDestaque }}>{texto}</Text>
    </View>
  );
}

const EMOJI_DO_HUMOR: Record<string, string> = Object.fromEntries(
  HUMORES.map((h) => [h.label, h.emoji]),
);

/** As respostas: o convite principal cheio, o resto em pílulas claras. */
const Respostas = memo(function Respostas({
  respostas,
  aoResponder,
}: {
  respostas: readonly Resposta[];
  aoResponder: (r: Resposta) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.sm, paddingLeft: 72 }}>
      {respostas.map((r, i) => {
        const cheio = r.tipo === "abrir" && i === 0;
        const emoji = r.tipo === "humor" ? (r.emoji ?? EMOJI_DO_HUMOR[r.humor]) : null;
        return (
          <Tocavel
            key={r.id}
            aoTocar={() => aoResponder(r)}
            rotulo={r.rotulo}
            folga={4}
            estilo={{
              minHeight: 40,
              paddingHorizontal: 14,
              borderRadius: canto.pilula,
              ...curva,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: cheio ? cor.primaria : luz.cartao,
              borderWidth: cheio ? 0 : 1,
              borderColor: cor.borda,
            }}
          >
            {emoji ? <Text style={{ fontSize: 16 }}>{emoji}</Text> : null}
            <Text
              style={{
                ...fonte.forte,
                ...escala.legenda,
                color: cheio ? cor.branco : cor.texto,
              }}
            >
              {r.rotulo}
            </Text>
          </Tocavel>
        );
      })}
    </View>
  );
});

/** Os três pontinhos de quem está digitando: uma vez, e param. */
function Digitando() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(v, {
      toValue: 1,
      duration: 650,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [v]);
  const pontos = useMemo(
    () =>
      [0, 1, 2].map((i) =>
        v.interpolate({
          inputRange: [0, 0.2 + i * 0.2, 0.4 + i * 0.2, 1],
          outputRange: [0.3, 1, 0.3, 0.3],
          extrapolate: "clamp",
        }),
      ),
    [v],
  );
  return (
    <View
      accessibilityLabel="A Bolha está escrevendo"
      style={{ flexDirection: "row", gap: 5, paddingVertical: 8 }}
    >
      {pontos.map((o, i) => (
        <Animated.View
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: cor.textoApagado,
            opacity: o,
          }}
        />
      ))}
    </View>
  );
}
