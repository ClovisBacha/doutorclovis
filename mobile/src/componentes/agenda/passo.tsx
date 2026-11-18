import { LinearGradient } from "expo-linear-gradient";
import { Minus, Plus } from "lucide-react-native";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { selecao, toque } from "~/componentes/base";
import { comAlfa } from "~/lib/cor";
import { ALVO_MINIMO, canto, cor, curva, escala, fonte, raio } from "~/tema";

/**
 * A HORA EM JAVASCRIPT, sem seletor nativo (funciona na bancada e não pede
 * módulo novo no build).
 *
 * - `RodaDaHora` (18/11/2026): a roda do iPhone, em duas colunas que rolam e
 *   param no lugar (horas e minutos de 5 em 5), com um tique a cada passo. É a
 *   hora da agenda: de 9:00 para 14:30 é um gesto, e não onze toques.
 * - `Passo`: o número grande com + e −, para quem ainda o usar.
 */

const LINHA = 44;
const VISIVEIS = 5;
const dois = (n: number) => String(n).padStart(2, "0");
const HORAS = Array.from({ length: 24 }, (_, i) => i);

export function RodaDaHora({
  hora,
  minuto,
  aoMudar,
  passo = 5,
}: {
  hora: number;
  minuto: number;
  aoMudar: (hora: number, minuto: number) => void;
  /** De quantos em quantos minutos (5, como no Calendário). */
  passo?: number;
}) {
  const minutos = useMemo(
    () => Array.from({ length: Math.ceil(60 / passo) }, (_, i) => i * passo),
    [passo],
  );
  const minutoNaRoda = minutos.reduce((a, b) =>
    Math.abs(b - minuto) < Math.abs(a - minuto) ? b : a,
  );
  /* As duas colunas leem a hora e o minuto MAIS NOVOS (uma pode mudar
     enquanto a outra ainda rola). */
  const agora = useRef({ hora, minuto });
  agora.current = { hora, minuto };
  const veu = comAlfa(cor.branco, 0.92);
  const transparente = comAlfa(cor.branco, 0);
  return (
    <View
      style={{
        height: LINHA * VISIVEIS,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* A faixa do escolhido, atrás das duas colunas. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          top: LINHA * 2,
          height: LINHA,
          borderRadius: canto.campo - 2,
          ...curva,
          backgroundColor: cor.apagado,
        }}
      />
      <Coluna
        valores={HORAS}
        valor={hora}
        rotulo="Hora"
        formatar={String}
        aoMudar={(h) => aoMudar(h, agora.current.minuto)}
      />
      <Text
        style={{ ...fonte.titulo, fontSize: 22, color: cor.texto, marginBottom: 2 }}
        accessible={false}
      >
        :
      </Text>
      <Coluna
        valores={minutos}
        valor={minutoNaRoda}
        rotulo="Minutos"
        formatar={dois}
        aoMudar={(m) => aoMudar(agora.current.hora, m)}
      />
      {/* O esmaecer de cima e de baixo, como na roda do iPhone. */}
      <LinearGradient
        pointerEvents="none"
        colors={[veu, transparente]}
        style={{ position: "absolute", left: 0, right: 0, top: 0, height: LINHA * 1.7 }}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[transparente, veu]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: LINHA * 1.7 }}
      />
    </View>
  );
}

function Coluna({
  valores,
  valor,
  rotulo,
  formatar,
  aoMudar,
}: {
  valores: readonly number[];
  valor: number;
  rotulo: string;
  formatar: (n: number) => string;
  aoMudar: (v: number) => void;
}) {
  const ref = useRef<ScrollView>(null);
  const indice = Math.max(0, valores.indexOf(valor));
  /* O índice sob a faixa AGORA (muda a cada passo do dedo, sem estado: o
     estado só muda quando a roda para). */
  const sob = useRef(indice);
  const montada = useRef(false);
  const parar = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimo = useRef(aoMudar);
  ultimo.current = aoMudar;
  const valorDeFora = useRef(valor);
  valorDeFora.current = valor;

  /* Posiciona ao montar, e quando o valor muda de fora (a consulta que chegou
     para editar). O que veio da própria roda já está no lugar. */
  useEffect(() => {
    if (montada.current && sob.current === indice) return;
    sob.current = indice;
    ref.current?.scrollTo({ y: indice * LINHA, animated: montada.current });
    montada.current = true;
  }, [indice]);

  useEffect(
    () => () => {
      if (parar.current) clearTimeout(parar.current);
    },
    [],
  );

  function fixar(i: number, y: number) {
    parar.current = null;
    /* Na web a rolagem não encaixa sozinha: encaixa aqui. */
    if (Math.abs(y - i * LINHA) > 1) ref.current?.scrollTo({ y: i * LINHA, animated: true });
    const v = valores[i]!;
    if (v !== valorDeFora.current) ultimo.current(v);
  }

  function aoRolar(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = e.nativeEvent.contentOffset.y;
    const i = Math.min(valores.length - 1, Math.max(0, Math.round(y / LINHA)));
    if (i !== sob.current) {
      sob.current = i;
      selecao();
    }
    if (parar.current) clearTimeout(parar.current);
    parar.current = setTimeout(() => fixar(i, y), 140);
  }

  function passo(delta: number) {
    const i = Math.min(valores.length - 1, Math.max(0, indice + delta));
    if (i !== indice) ultimo.current(valores[i]!);
  }

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={rotulo}
      accessibilityValue={{ text: formatar(valor) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => passo(e.nativeEvent.actionName === "increment" ? 1 : -1)}
      style={{ width: 84, height: LINHA * VISIVEIS }}
    >
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={LINHA}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: indice * LINHA }}
        onScroll={aoRolar}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingVertical: LINHA * 2 }}
      >
        {valores.map((v) => (
          <View key={v} style={{ height: LINHA, alignItems: "center", justifyContent: "center" }}>
            <Text
              style={{
                ...fonte.normal,
                fontSize: 22,
                color: cor.texto,
                fontVariant: ["tabular-nums"],
              }}
            >
              {formatar(v)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * O PASSO — um número grande com + em cima e − embaixo.
 */
export function Passo({
  valor,
  rotulo,
  aoMenos,
  aoMais,
}: {
  valor: string;
  rotulo: string;
  aoMenos: () => void;
  aoMais: () => void;
}) {
  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <BotaoDoPasso rotulo={`Mais ${rotulo}`} aoTocar={aoMais}>
        <Plus size={20} color={cor.agenda} />
      </BotaoDoPasso>
      <Text
        accessibilityLabel={`${valor} ${rotulo}`}
        style={{
          minWidth: 72,
          textAlign: "center",
          ...fonte.titulo,
          ...escala.grande,
          color: cor.texto,
          fontVariant: ["tabular-nums"],
        }}
      >
        {valor}
      </Text>
      <BotaoDoPasso rotulo={`Menos ${rotulo}`} aoTocar={aoMenos}>
        <Minus size={20} color={cor.agenda} />
      </BotaoDoPasso>
    </View>
  );
}

function BotaoDoPasso({
  rotulo,
  aoTocar,
  children,
}: {
  rotulo: string;
  aoTocar: () => void;
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
        width: ALVO_MINIMO + 8,
        height: ALVO_MINIMO,
        borderRadius: raio.pilula,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? cor.agenda : cor.agendaFundo,
      })}
    >
      {children}
    </Pressable>
  );
}
