import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Lock from "lucide-react-native/icons/lock";
import type { ReactNode } from "react";
import { ActivityIndicator, Animated, Platform, Pressable, Text, View } from "react-native";
import type { Raridade } from "@/lib/conquistas";
import { Botao, Cartao, T, TituloDaSecao, toque } from "~/componentes/base";
import { useMolaDeToque } from "~/componentes/movimento";
import { corDaRaridade } from "~/componentes/recompensas/cores";
import { comAlfa } from "~/lib/cor";
import { ALVO_MINIMO, canto, cor, curva, escala, espaco, fonte, sombra } from "~/tema";

/**
 * As peças das Recompensas (as conquistas e o "Ganhe mais"): a
 * pílula de ação, a medalha, o broto da moeda, o título de seção com arte, o
 * silêncio do Modo Cuidado e o esqueleto da leitura.
 */

/** O desfecho no dedo — fora da web (lá não há motor, e o navegador reclama). */
export function vibrar(tipo: "sucesso" | "erro") {
  if (Platform.OS === "web") return;
  void Haptics.notificationAsync(
    tipo === "sucesso"
      ? Haptics.NotificationFeedbackType.Success
      : Haptics.NotificationFeedbackType.Error,
  ).catch(() => {});
}

/**
 * A sementinha: a moeda do jogo, o 🌱 que a trilha já usa no placar (o emoji
 * é a moeda, e não um enfeite do rótulo). O `tinta` fica para quando a
 * moeda ganhar um desenho próprio; o emoji tem a cor dele.
 */
export function Broto({ tamanho = 14 }: { tamanho?: number; tinta?: string }) {
  return (
    <Text
      accessible={false}
      allowFontScaling={false}
      style={{ fontSize: tamanho, lineHeight: Math.round(tamanho * 1.25) }}
    >
      🌱
    </Text>
  );
}

/**
 * A PÍLULA DE AÇÃO do ladrilho e da conquista — no lugar do `.btn-3d` do
 * site (26 px, brilho e fios de luz). Três tons, e só três:
 * - `cheia`: comprar (a sementinha cheia, letra branca);
 * - `tingida`: usar ou resgatar uma coisa que já é dela;
 * - `apagada`: o que ainda não dá (o preço que não cabe, o trancado).
 * O desenho tem 32 pt; o toque, os 44 da Apple.
 */
export function PilulaDeAcao({
  texto,
  icone,
  tom,
  aoTocar,
  acessivel,
  carregando,
  esticada,
}: {
  texto: string;
  icone?: ReactNode;
  tom: "cheia" | "tingida" | "apagada";
  aoTocar?: () => void;
  /** O que o leitor de tela diz (o rótulo visível é curto: um número, um verbo). */
  acessivel?: string;
  carregando?: boolean;
  esticada?: boolean;
}) {
  const fundo =
    tom === "cheia" ? cor.sementinha : tom === "tingida" ? cor.sementinhaFundo : cor.apagado;
  const tinta =
    tom === "cheia" ? cor.branco : tom === "tingida" ? cor.sementinha : cor.textoApagado;
  const desenho = (
    <View
      style={{
        minHeight: 32,
        minWidth: 64,
        alignSelf: esticada ? "stretch" : "center",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        paddingHorizontal: espaco.md,
        borderRadius: canto.pilula,
        ...curva,
        backgroundColor: fundo,
      }}
    >
      {carregando ? (
        <ActivityIndicator size="small" color={tinta} />
      ) : (
        <>
          {icone}
          <Text
            numberOfLines={1}
            style={{
              ...fonte.forte,
              ...escala.legenda,
              color: tinta,
              fontVariant: ["tabular-nums"],
            }}
          >
            {texto}
          </Text>
        </>
      )}
    </View>
  );
  if (!aoTocar) {
    return (
      <View accessible accessibilityLabel={acessivel ?? texto} style={{ alignSelf: "stretch" }}>
        {desenho}
      </View>
    );
  }
  /* Pressable com a mola do app (e não o `Tocavel`): a pílula precisa do
     `hitSlop` para o alvo de 44 sem crescer o desenho. */
  return (
    <PilulaTocavel
      aoTocar={aoTocar}
      rotulo={acessivel ?? texto}
      ocupada={!!carregando}
      esticada={!!esticada}
    >
      {desenho}
    </PilulaTocavel>
  );
}

function PilulaTocavel({
  aoTocar,
  rotulo,
  ocupada,
  esticada,
  children,
}: {
  aoTocar: () => void;
  rotulo: string;
  ocupada: boolean;
  esticada: boolean;
  children: ReactNode;
}) {
  const mola = useMolaDeToque(0.94);
  const folga = (ALVO_MINIMO - 32) / 2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ busy: ocupada }}
      disabled={ocupada}
      hitSlop={{ top: folga, bottom: folga, left: 4, right: 4 }}
      onPressIn={mola.aoPressionar}
      onPressOut={mola.aoSoltar}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={{ alignSelf: esticada ? "stretch" : "center" }}
    >
      <Animated.View style={{ transform: [{ scale: mola.escala }] }}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * A MEDALHA de uma conquista (como os Prêmios do Fitness): o círculo com o
 * emoji e o anel na cor da raridade — a épica no degradê do amanhecer. A
 * bloqueada é um círculo apagado, com o emoji a 30% e um cadeado; o texto
 * em volta continua pleno (quem apaga é a arte, nunca a letra).
 */
export function Medalha({
  emoji,
  raridade,
  tamanho = 76,
  anel = 3,
  bloqueada = false,
}: {
  emoji: string;
  raridade: Raridade;
  tamanho?: number;
  anel?: number;
  bloqueada?: boolean;
}) {
  const r = corDaRaridade[raridade];
  const dentro = tamanho - anel * 2;
  const arte = (
    <Text
      allowFontScaling={false}
      style={{
        fontSize: Math.round(tamanho / 2),
        lineHeight: Math.round(tamanho * 0.64),
        textAlign: "center",
        opacity: bloqueada ? 0.3 : 1,
      }}
    >
      {emoji}
    </Text>
  );
  const miolo = (
    <View
      style={{
        width: dentro,
        height: dentro,
        borderRadius: dentro / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bloqueada ? cor.apagado : r.fundo,
      }}
    >
      {arte}
    </View>
  );
  return (
    <View style={{ width: tamanho, height: tamanho }}>
      {bloqueada ? (
        <View
          style={{
            width: tamanho,
            height: tamanho,
            borderRadius: tamanho / 2,
            borderWidth: anel,
            borderColor: cor.trilho,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: cor.apagado,
          }}
        >
          {arte}
        </View>
      ) : (
        <LinearGradient
          colors={r.anel}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: tamanho,
            height: tamanho,
            borderRadius: tamanho / 2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {miolo}
        </LinearGradient>
      )}
      {bloqueada ? (
        <View
          style={[
            {
              position: "absolute",
              right: 0,
              bottom: 0,
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

/** O rótulo da raridade: "Raro · 40", na tinta dela, sobre o fundo dela. */
export function RotuloDaRaridade({
  raridade,
  nome,
  sementinhas,
}: {
  raridade: Raridade;
  nome: string;
  sementinhas: number;
}) {
  const r = corDaRaridade[raridade];
  return (
    <View
      accessible
      accessibilityLabel={`${nome}, ${sementinhas} sementinhas`}
      style={{
        alignSelf: "center",
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderRadius: canto.pilula,
        ...curva,
        backgroundColor: r.rotuloFundo,
        paddingHorizontal: espaco.md,
        paddingVertical: 4,
      }}
    >
      <Text style={{ ...fonte.forte, ...escala.nota, color: r.tinta }}>
        {nome} · {sementinhas}
      </Text>
      <Broto tamanho={13} tinta={r.tinta} />
    </View>
  );
}

/** O selo de contagem (o "3" ao lado de Conquistas): framboesa, 20 pt. */
export function SeloDeContagem({ n }: { n: number }) {
  return (
    <View
      style={{
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        paddingHorizontal: 5,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: cor.primaria,
      }}
    >
      <Text
        allowFontScaling={false}
        style={{ ...fonte.titulo, fontSize: 13, lineHeight: 16, color: cor.branco }}
      >
        {n > 9 ? "9+" : n}
      </Text>
    </View>
  );
}

/**
 * O título de uma seção com a arte dela (o emoji da categoria) FORA do
 * texto: o leitor de tela lê "Bebê", e não "bebê, Bebê".
 */
export function SecaoComArte({
  arte,
  titulo,
  direita,
}: {
  arte?: string;
  titulo: string;
  direita?: ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
      {arte ? (
        <Text accessible={false} allowFontScaling={false} style={{ fontSize: 20, lineHeight: 26 }}>
          {arte}
        </Text>
      ) : null}
      <View style={{ flex: 1 }}>
        <TituloDaSecao direita={direita}>{titulo}</TituloDaSecao>
      </View>
    </View>
  );
}

/** A contagem à direita de um título de seção ("2 de 9"). */
export function Contagem({ texto }: { texto: string }) {
  return (
    <Text
      style={{
        ...fonte.forte,
        ...escala.nota,
        color: cor.textoApagado,
        fontVariant: ["tabular-nums"],
      }}
    >
      {texto}
    </Text>
  );
}

export function SilencioDoCuidado() {
  return (
    <Cartao estilo={{ padding: espaco.xl, alignItems: "center", gap: espaco.lg }}>
      <T centro>As recompensas ficam em pausa enquanto o Modo Cuidado estiver ligado.</T>
      <Botao
        rotulo="Ajustes do Modo Cuidado"
        tipo="secundario"
        aoTocar={() => router.push("/perfil")}
      />
    </Cartao>
  );
}

/** O esqueleto enquanto lê: blocos claros no lugar do conteúdo, no desenho da grade. */
export function Esqueleto({ rotulo }: { rotulo: string }) {
  const bloco = (h: number, r: number = canto.dentro) => (
    <View
      style={{ height: h, borderRadius: r, ...curva, backgroundColor: comAlfa(cor.trilho, 0.7) }}
    />
  );
  const fileira = (
    <View style={{ flexDirection: "row", gap: espaco.md }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ flex: 1 }}>
          {bloco(150)}
        </View>
      ))}
    </View>
  );
  return (
    <View style={{ gap: espaco.md }} accessibilityLabel={rotulo}>
      <View style={{ flexDirection: "row", gap: espaco.sm }}>
        {[64, 88, 80].map((w, i) => (
          <View key={i} style={{ width: w }}>
            {bloco(36, canto.pilula)}
          </View>
        ))}
      </View>
      {fileira}
      {fileira}
    </View>
  );
}
