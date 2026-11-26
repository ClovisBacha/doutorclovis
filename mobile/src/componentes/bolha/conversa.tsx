import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { ReactNode } from "react";
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
import { brilhoDe, canto, cor, curva, escala, espaco, fonte, veu } from "~/tema";

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
 *
 * O DESENHO (23/11/2026, o dono: "o chat do bebê bolha deve ficar mais clean
 * [...] manter esse design mais moderno que estamos fazendo; esse fundo branco
 * ficou ruim no chat"): a conversa é o funil "Montar o meu plano" continuando
 * — o vidro de ameixa-noite solto sobre o céu (`PainelDaBolha`), a fala dela
 * em branco num balão de vidro discreto, a resposta dela numa pílula rosa
 * clara e as respostas em pílulas de contorno. O convite principal é a
 * framboesa, a única cor cheia. Nada de bloco branco.
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
          <ArteDaBolha humor={fala.pose} tamanho={60} />
        </Tocavel>
        <View
          accessibilityLiveRegion="polite"
          style={{
            flex: 1,
            borderRadius: canto.dentro,
            borderBottomLeftRadius: 6,
            ...curva,
            paddingHorizontal: 15,
            paddingVertical: 12,
            backgroundColor: veu.superficieAcesa,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: veu.superficieBorda,
          }}
        >
          {digitando ? (
            <Digitando />
          ) : (
            <Text style={{ ...fonte.media, ...escala.corpo, color: cor.branco }}>{fala.texto}</Text>
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
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.sm, paddingLeft: 68 }}>
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
              minHeight: 42,
              paddingHorizontal: 15,
              borderRadius: canto.pilula,
              ...curva,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: cheio ? cor.primaria : veu.superficie,
              borderWidth: cheio ? 0 : 1,
              borderColor: "rgba(255,255,255,0.3)",
              ...(cheio ? brilhoDe(cor.primaria, 0.5) : null),
            }}
          >
            {emoji ? <Text style={{ fontSize: 16 }}>{emoji}</Text> : null}
            <Text
              style={{
                ...fonte.forte,
                ...escala.legenda,
                color: cor.branco,
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
            backgroundColor: cor.branco,
            opacity: o,
          }}
        />
      ))}
    </View>
  );
}

/**
 * O PAINEL DA BOLHA: o vidro de ameixa-noite da conversa, solto sobre o céu
 * (o mesmo desenho do funil). No lugar do `Painel` branco das outras seções.
 */
export function PainelDaBolha({
  children,
  estilo,
}: {
  children: ReactNode;
  estilo?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          borderRadius: canto.painel,
          ...curva,
          paddingHorizontal: 14,
          paddingVertical: 16,
          gap: espaco.md,
          backgroundColor: veu.vidroDaConversa,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: veu.vidroDaConversaBorda,
          boxShadow: "0px 22px 44px -22px rgba(20,12,60,0.6)",
        },
        estilo,
      ]}
    >
      {children}
    </View>
  );
}
