import { Image, type ImageSource } from "expo-image";
import Check from "lucide-react-native/icons/check";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Lock from "lucide-react-native/icons/lock";
import Play from "lucide-react-native/icons/play";
import { memo, useMemo, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";
import { toque } from "~/componentes/base";
import { corCaminho } from "~/componentes/caminho/cores";
import {
  AnelDeTarefas,
  Boiar,
  Emoji,
  EstrelaDoDia,
  Halo,
  Moeda3D,
  useAfundar,
} from "~/componentes/caminho/pecas";
import { Painel } from "~/componentes/painel";
import { clarear, comAlfa } from "~/lib/cor";
import {
  comBranco,
  coresDaSemana,
  tomFuturo,
  tomPerdido,
  tracadoDoBloco,
  trimestreDaFase,
  type PontoDaTrilha,
  type Tom,
} from "~/lib/jornada/caminho";
import { coresDaSemanaDoPos } from "~/lib/jornada/pos-parto";
import { brilhoDe, canto, cor, curva, escala, espaco, fonte, luz, margem, sombra } from "~/tema";

/**
 * OS BLOCOS DA TRILHA — a faixa da fase, a barra da semana, o nó do dia e o
 * traço que os liga, iguais na gestação (`caminho.tsx`) e no 4º trimestre
 * (`caminho-pos.tsx`). Tudo `memo`: a lista monta umas sete semanas de cada
 * vez, e um bloco só se redesenha quando o que ele mostra mudou.
 */

/* ── Os tons ─────────────────────────────────────────────────────────────── */

export type TonsDaSemana = { cheia: Tom; futuro: Tom; perdido: Tom };

/* As fórmulas de cor (oklch → oklab → sRGB) rodavam para cada nó a cada
   render; agora uma vez por semana, e o MESMO objeto volta sempre (a moeda é
   `memo` e compara o tom pela identidade). */
const cacheDosTons = new Map<string, TonsDaSemana>();

export function tonsDaSemana(semana: number, pos = false): TonsDaSemana {
  const chave = `${pos ? "p" : "g"}${semana}`;
  let t = cacheDosTons.get(chave);
  if (!t) {
    const cheia = pos ? coresDaSemanaDoPos(semana) : coresDaSemana(semana);
    t = { cheia, futuro: tomFuturo(cheia), perdido: tomPerdido(cheia) };
    cacheDosTons.set(chave, t);
  }
  return t;
}

/** A cor da ficha de uma fase da gestação, pelo trimestre: framboesa, âmbar, violeta. */
export function corDaFaseDaGestacao(semanaInicial: number): string {
  const t = trimestreDaFase(semanaInicial);
  return t === 1 ? cor.primaria : t === 2 ? cor.atencao : cor.jogo;
}

/* ── A faixa da fase ─────────────────────────────────────────────────────── */

/**
 * A FAIXA DA FASE é um painel solto sobre o céu, como os blocos das abas: o
 * nome em 22 (a serifada), "Fase 4 · semanas 22–28" embaixo e o emoji numa
 * ficha na cor da fase. Era uma faixa âmbar com o título branco (2,1:1).
 */
export const FaixaDaFase = memo(function FaixaDaFase({
  nome,
  sub,
  emoji,
  corDaFase,
  travada,
  altura,
  arrumando,
  children,
}: {
  nome: string;
  sub: string;
  emoji: string;
  corDaFase: string;
  travada: boolean;
  altura: number;
  arrumando?: boolean;
  /** Os enfeites do bloco (desenhados antes, embaixo). */
  children?: ReactNode;
}) {
  return (
    <View style={{ height: altura }}>
      {children}
      <View
        pointerEvents={arrumando ? "none" : "box-none"}
        style={{
          position: "absolute",
          left: margem.tela,
          right: margem.tela,
          top: 0,
          bottom: 0,
          justifyContent: "center",
        }}
      >
        <Painel estilo={{ flexDirection: "row", alignItems: "center", paddingVertical: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: canto.campo,
              ...curva,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: travada ? cor.trilho : clarear(corDaFase, 0.84),
            }}
          >
            {travada ? (
              <Lock size={20} color={cor.textoApagado} strokeWidth={2.2} />
            ) : (
              <Emoji tamanho={24}>{emoji}</Emoji>
            )}
          </View>
          <View
            accessible
            accessibilityRole="header"
            accessibilityLabel={`${nome}. ${sub}${travada ? ", ainda não chegou" : ""}`}
            style={{ flex: 1, minWidth: 0 }}
          >
            <Text
              numberOfLines={1}
              style={{ ...fonte.media, ...escala.nota, color: cor.textoApagado }}
            >
              {sub}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                ...fonte.display,
                ...escala.titulo2,
                letterSpacing: -0.2,
                color: travada ? cor.textoApagado : cor.texto,
              }}
            >
              {nome}
            </Text>
          </View>
        </Painel>
      </View>
    </View>
  );
});

/* ── A barra da semana ───────────────────────────────────────────────────── */

export type EstadoDaBarra = "atual" | "passada" | "futura";
export type PontoDaBarra = { feito: boolean; hoje: boolean; futuro: boolean };

const MATERIAL_DA_BARRA: Record<EstadoDaBarra, (tom: Tom) => ViewStyle> = {
  /* A semana de agora é o objeto mais presente: o cartão branco, com a borda
     na cor da semana. */
  atual: (tom) => ({
    backgroundColor: luz.cartao,
    borderWidth: 1,
    borderColor: comAlfa(tom.main, 0.4),
    ...sombra,
  }),
  /* As outras são material claro, sem lábio — a que vem, mais apagada. Antes
     a semana travada era um bloco branco sólido com lábio: o objeto mais
     forte da tela era justamente o que não se podia usar. */
  passada: () => ({
    backgroundColor: corCaminho.barraPassada,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: corCaminho.barraBorda,
  }),
  futura: () => ({
    backgroundColor: corCaminho.barraFutura,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: corCaminho.barraBorda,
  }),
};

/**
 * A BARRA DA SEMANA: a moeda (o álbum), o título, os sete pontinhos e a seta.
 * A barra INTEIRA abre o álbum (antes só a moeda de 44 respondia, e o título
 * era um alvo falso); ao toque, ela encolhe um tico e a moeda afunda no lábio.
 */
export const BarraDaSemana = memo(function BarraDaSemana({
  titulo,
  sub,
  estado,
  tom,
  dias,
  figurinha,
  moeda,
  rotulo,
  aoAbrir,
  agora = estado === "atual",
}: {
  titulo: string;
  sub: string;
  estado: EstadoDaBarra;
  tom: Tom;
  dias: readonly PontoDaBarra[];
  /** A figurinha da semana já está no álbum (o selo branco com o ✓). */
  figurinha: boolean;
  /** O que vai dentro da moeda (no 4º trimestre, a figurinha da semana). */
  moeda?: ReactNode;
  rotulo: string;
  aoAbrir?: () => void;
  agora?: boolean;
}) {
  const afundar = useAfundar();
  const descida = useMemo(
    () => afundar.valor.interpolate({ inputRange: [0, 1], outputRange: [0, 3] }),
    [afundar.valor],
  );
  const encolhe = useMemo(
    () => afundar.valor.interpolate({ inputRange: [0, 1], outputRange: [1, 0.98] }),
    [afundar.valor],
  );
  const corpo = (
    <Animated.View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.md,
          minHeight: 64,
          borderRadius: canto.cartao,
          ...curva,
          paddingLeft: espaco.md,
          paddingRight: aoAbrir ? espaco.sm + 2 : espaco.md,
          paddingVertical: espaco.sm,
        },
        MATERIAL_DA_BARRA[estado](tom),
        { transform: [{ scale: encolhe }] },
      ]}
    >
      <View>
        <Moeda3D
          tamanho={44}
          tom={tom}
          labio={4}
          claro={0.45}
          escuro={0.8}
          meio={0.62}
          descida={descida}
        >
          {moeda}
        </Moeda3D>
        {figurinha ? <SeloDaFigurinha /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              ...fonte.forte,
              ...escala.manchete,
              color: estado === "futura" ? cor.textoApagado : cor.texto,
            }}
          >
            {titulo}
          </Text>
          {agora ? <PilulaAgora /> : null}
        </View>
        <Text
          numberOfLines={1}
          style={{ ...fonte.normal, ...escala.nota, color: cor.textoApagado }}
        >
          {sub}
        </Text>
      </View>
      <PontosDaSemana dias={dias} tom={tom} />
      {aoAbrir ? <ChevronRight size={18} color={cor.chevron} strokeWidth={2.6} /> : null}
    </Animated.View>
  );
  if (!aoAbrir)
    return (
      <View accessible accessibilityLabel={rotulo}>
        {corpo}
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityHint="Abre o álbum da semana"
      onPressIn={afundar.aoPressionar}
      onPressOut={afundar.aoSoltar}
      onPress={() => {
        toque();
        aoAbrir();
      }}
    >
      {corpo}
    </Pressable>
  );
});

function PilulaAgora() {
  return (
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
        Agora
      </Text>
    </View>
  );
}

/** O selo da figurinha guardada: um círculo branco com o ✓, no canto da moeda. */
function SeloDaFigurinha() {
  return (
    <View
      accessible={false}
      pointerEvents="none"
      style={{
        position: "absolute",
        right: -5,
        top: -5,
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: cor.branco,
        ...sombra,
      }}
    >
      <Check size={12} color={cor.ok} strokeWidth={3.4} />
    </View>
  );
}

/** Os sete dias da semana em pontinhos de 8 pt; o de hoje com um aro. */
function PontosDaSemana({ dias, tom }: { dias: readonly PontoDaBarra[]; tom: Tom }) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
    >
      {dias.map((d, i) => (
        <View
          key={i}
          style={{ width: 8, height: 8, alignItems: "center", justifyContent: "center" }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: d.feito ? tom.main : d.futuro ? cor.trilho : comBranco(tom, 0.32),
            }}
          />
          {d.hoje ? (
            <View
              style={{
                position: "absolute",
                width: 14,
                height: 14,
                borderRadius: 7,
                borderWidth: 2,
                borderColor: tom.main,
              }}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

/* ── O nó do dia ─────────────────────────────────────────────────────────── */

/**
 * UM NÓ DA TRILHA. Hoje é o maior, com o anel das tarefas (ouro), o halo que
 * chama o dedo, o glifo de "começar" e o balão framboesa em cima. O dia
 * fechado leva o ✓ e, se pedir, o selo dourado de cinco estrelas no canto (a
 * fileira de cinco estrelinhas embaixo de cada nó saiu: repetia o ✓ e
 * empurrava a moeda para fora do ponto do caminho). Toda moeda fica CENTRADA
 * no ponto do caminho, e afunda até o lábio no toque.
 */
export const NoDaTrilha = memo(function NoDaTrilha({
  D,
  x,
  y,
  tamanho,
  tom,
  hoje,
  fechado,
  futuro,
  anel,
  balao,
  selo = false,
  rotulo,
  aoTocar,
  arte,
  corDoBrilho,
  arrumando = false,
  parado = false,
}: {
  D: number;
  x: number;
  y: number;
  tamanho: number;
  tom: Tom;
  hoje: boolean;
  fechado: boolean;
  futuro: boolean;
  /** Só no nó de hoje: quantas tarefas de quantas. */
  anel?: { feitos: number; total: number } | null;
  balao?: string | null;
  selo?: boolean;
  rotulo: string;
  aoTocar: (D: number) => void;
  /** A pele da trilha (a arte no lugar da moeda), se ela equipou uma. */
  arte?: ImageSource | number | null;
  /** A cor do halo da pele. */
  corDoBrilho?: string;
  arrumando?: boolean;
  parado?: boolean;
}) {
  const afundar = useAfundar();
  const descida = useMemo(
    () => afundar.valor.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }),
    [afundar.valor],
  );
  return (
    <View
      pointerEvents={arrumando ? "none" : "box-none"}
      style={{
        position: "absolute",
        left: `${x}%`,
        top: y - tamanho / 2,
        width: 0,
        alignItems: "center",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={rotulo}
        accessibilityState={{ disabled: futuro, selected: hoje }}
        onPressIn={futuro || arte ? undefined : afundar.aoPressionar}
        onPressOut={futuro || arte ? undefined : afundar.aoSoltar}
        onPress={() => aoTocar(D)}
        hitSlop={6}
        style={{ width: tamanho + 24, height: tamanho, alignItems: "center" }}
      >
        {balao ? <Balao texto={balao} tamanho={tamanho} parado={parado} /> : null}
        <View style={{ width: tamanho, height: tamanho }}>
          {hoje && !fechado ? <Halo tamanho={tamanho} cor={tom.main} parado={parado} /> : null}
          {anel ? (
            <AnelDeTarefas tamanho={tamanho} feitos={anel.feitos} total={anel.total} />
          ) : null}
          {arte ? (
            /* COM PELE: a arte substitui a bolinha inteira — sem o relevo, o ✓
               nem o glifo. Quem diz o estado é o desenho (adormecido,
               desperto, florido). 42% maior que a bolinha: a arte tem ar em
               volta do objeto, medido no site lado a lado. */
            <View
              style={{
                width: tamanho,
                height: tamanho,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BrilhoDaPele caixa={tamanho} cor={corDoBrilho ?? tom.main} />
              <Image
                source={arte}
                style={{ width: tamanho * 1.42, height: tamanho * 1.42 }}
                contentFit="contain"
              />
            </View>
          ) : (
            <Moeda3D tamanho={tamanho} tom={tom} descida={descida}>
              {hoje && !fechado ? (
                <Play
                  size={32}
                  color={cor.branco}
                  fill={cor.branco}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  style={{ marginLeft: 4 }}
                />
              ) : fechado ? (
                <Check size={hoje ? 38 : 30} color={cor.branco} strokeWidth={3.6} />
              ) : null}
            </Moeda3D>
          )}
          {selo && fechado ? (
            <View pointerEvents="none" style={{ position: "absolute", right: -4, top: -4 }}>
              <EstrelaDoDia acesa tamanho={18} />
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
});

/** O balão de cima do nó de hoje: framboesa, letra branca (5,1:1), sem emoji. */
function Balao({ texto, tamanho, parado }: { texto: string; tamanho: number; parado: boolean }) {
  const largura = 220;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: -56,
        width: largura,
        left: (tamanho + 24 - largura) / 2,
        zIndex: 2,
        alignItems: "center",
      }}
    >
      <Boiar parado={parado}>
        <View
          style={{
            borderRadius: canto.pilula,
            backgroundColor: cor.primaria,
            paddingHorizontal: 14,
            paddingVertical: 5,
            ...brilhoDe(cor.primaria, 0.5),
          }}
        >
          {/* O rabinho vem antes do texto: fica embaixo da letra, por cima do corpo. */}
          <View
            style={{
              position: "absolute",
              bottom: -4,
              left: "50%",
              marginLeft: -5,
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: cor.primaria,
              transform: [{ rotate: "45deg" }],
            }}
          />
          <Text
            numberOfLines={1}
            style={{
              ...fonte.titulo,
              fontSize: 13,
              lineHeight: 17,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              color: cor.branco,
            }}
          >
            {texto}
          </Text>
        </View>
      </Boiar>
    </View>
  );
}

/**
 * O `drop-shadow(0 6px 10px <cor>55)` que o site põe na arte da pele: um halo
 * na cor da semana, 6 px abaixo do globo. Desenhado, e não `shadow*` da View —
 * na web a sombra da View é um RETÂNGULO em volta da caixa, e no iPhone ela
 * seguiria a arte: dois desenhos.
 */
function BrilhoDaPele({ caixa, cor: tinta }: { caixa: number; cor: string }) {
  /* A arte tem 1,42× a caixa, e o globo, ~66% dela. O perfil é o de um disco
     desfocado pelo `blur 10px` do CSS (σ = 5 px): uma franja, nunca um disco. */
  const R = caixa * 1.42 * 0.33;
  const raio = R + 10;
  const id = `brilho-${caixa}-${tinta.replace("#", "")}`;
  const em = (r: number) => String(Math.max(0, r) / raio);
  return (
    <Svg
      pointerEvents="none"
      width={raio * 2}
      height={raio * 2}
      style={{ position: "absolute", left: caixa / 2 - raio, top: caixa / 2 - raio + 6 }}
    >
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset={em(R - 5)} stopColor={tinta} stopOpacity={0.28} />
          <Stop offset={em(R)} stopColor={tinta} stopOpacity={0.16} />
          <Stop offset={em(R + 5)} stopColor={tinta} stopOpacity={0.05} />
          <Stop offset="1" stopColor={tinta} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={raio} cy={raio} r={raio} fill={`url(#${id})`} />
    </Svg>
  );
}

/* ── O traço do caminho ──────────────────────────────────────────────────── */

/**
 * O CAMINHO VISÍVEL: um traço largo e claro que liga os centros dos nós, por
 * trás de tudo — até hoje, cheio; depois, em pontinhos redondos. Sobre o céu
 * vivo, a curva só lê como estrada se algo a desenhar. Um `<Svg>` por bloco,
 * com a ponte até o primeiro nó da semana seguinte (o bloco de baixo, por cima,
 * cobre a ponta: o traço passa por baixo da barra e do nó).
 */
export const TracadoDoBloco = memo(function TracadoDoBloco({
  nos,
  proximo,
  hojeD,
  largura,
  altura,
}: {
  nos: readonly PontoDaTrilha[];
  proximo: PontoDaTrilha | null;
  hojeD: number;
  largura: number;
  altura: number;
}) {
  const { andado, porVir } = useMemo(
    () => tracadoDoBloco(nos, proximo, hojeD, largura),
    [nos, proximo, hojeD, largura],
  );
  if (largura <= 0) return null;
  const alto = Math.max(altura, proximo ? proximo.y : 0) + 10;
  return (
    <Svg
      pointerEvents="none"
      width={largura}
      height={alto}
      style={{ position: "absolute", left: 0, top: 0 }}
    >
      {andado ? (
        <Path
          d={andado}
          fill="none"
          stroke={corCaminho.tracoAndado}
          strokeWidth={14}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {porVir ? (
        <Path
          d={porVir}
          fill="none"
          stroke={corCaminho.tracoPorVir}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray="0.1 20"
        />
      ) : null}
    </Svg>
  );
});
