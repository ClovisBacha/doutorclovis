import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Check, ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react-native";
import { memo, useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets, type Edge } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { Sobrelinha, toque, Tocavel } from "~/componentes/base";
import { CEUS } from "~/componentes/ceu-vivo";
import { corNoite } from "~/componentes/jornada/cores";
import { BolhaViva, Entrada, type HumorDaBolha } from "~/componentes/movimento";
import { Vidro } from "~/componentes/vidro";
import { clarear, comAlfa, escurecer, misturar } from "~/lib/cor";
import {
  ALVO_MINIMO,
  brilhoDe,
  canto,
  cor,
  curva,
  escala,
  espaco,
  fonte,
  luz,
  margem,
  sombra,
  sombraFlutuante,
} from "~/tema";

/**
 * AS PEÇAS DAS ATIVIDADES — Mexer, Meditar, a Carta, a Gratidão e as duas da
 * noite (Para vocês dois, Para dormir) têm o mesmo esqueleto: a luz do app no
 * fundo, a bolha falando ao lado, as escolhas com relevo, o botão de começar
 * fixo no pé e, na sessão, os controles flutuando ao alcance do polegar.
 *
 * O AMANHECER (18/11/2026, a vistoria): antes cada atividade era pintada com
 * a paleta Tailwind do site, num degradê que acabava em branco puro, com o
 * título e o texto na cor dela — quatro marcas de cor, e quem tocava "Começar"
 * no cartão verde caía em outro app. Agora o fundo é a luz do app, o texto é
 * a tinta ameixa, e a cor da atividade (`PaletaDaAtividade`) é só ACENTO: o
 * botão cheio, a escolha marcada, a ficha do ícone, o rótulo e o brilho atrás
 * da arte.
 *
 * O MATERIAL (out/2026): os botões e as escolhas têm RELEVO — a face em cima
 * de um "lábio" mais escuro, que afunda quando o dedo aperta. O lábio é
 * sempre uma camada de baixo (o fundo do Pressable), nunca uma borda: borda
 * grossa num canto redondo desenha uma meia-lua que afina nas pontas.
 */

/** A cor de uma atividade: a luz (o brilho, a ficha) e a ação (o que se toca). */
export type PaletaDaAtividade = { readonly luz: string; readonly acao: string };

/** A altura do lábio: o quanto o botão afunda quando o dedo aperta. */
const LABIO = 4;

/** As cores do material, tiradas da paleta. */
export function materialDe(p: PaletaDaAtividade) {
  return {
    /** Embaixo da face cheia (a escolhida, o botão de começar). */
    labioCheio: escurecer(p.acao, 0.28),
    /** Embaixo da face branca. */
    labioClaro: misturar(p.luz, p.acao, 0.22),
    /** O círculo claro atrás de um ícone. */
    ficha: p.luz,
    /** Desligado: a face clara da própria paleta, com a letra na ação pela metade. */
    faceApagada: p.luz,
    letraApagada: comAlfa(p.acao, 0.5),
  };
}

/**
 * A sombra das superfícies claras: o contato junto da borda e um corpo largo
 * na cor da atividade, e não cinza. Em `boxShadow`, como o resto do app.
 */
export function sombraDe(tinta: string, forca = 1): { boxShadow: string } {
  const f = Math.max(0.2, forca);
  return {
    boxShadow: `0px 1px 2px rgba(35,25,66,0.05), 0px ${Math.round(6 * f)}px ${Math.round(
      22 * f,
    )}px -${Math.round(6 * f)}px ${comAlfa(tinta, Math.min(0.32, 0.2 * f))}`,
  };
}

/** Fechar a atividade: volta de onde ela veio (a pilha ou a folha em tela cheia). */
export function fecharAtividade() {
  if (router.canGoBack()) router.back();
  else router.replace("/jornada");
}

/* ── O fundo ──────────────────────────────────────────────────────────── */

/**
 * A LUZ DA ATIVIDADE: a mesma luz de estúdio do app (`FundoDeLuz`), com a cor
 * da atividade no lugar do lilás — pêssego no alto à esquerda, a luz dela no
 * alto à direita, rosé embaixo. Nunca chega ao branco puro. Parada, em SVG.
 */
const LuzDaAtividade = memo(function LuzDaAtividade({ tom }: { tom: string }) {
  /* Na web os ids de degradê são do documento inteiro: um por cor. */
  const id = tom.replace(/[^0-9a-z]/gi, "");
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={`atv-pessego-${id}`} cx="0%" cy="0%" r="62%">
            <Stop offset="0" stopColor={luz.pessego} stopOpacity={0.85} />
            <Stop offset="1" stopColor={luz.pessego} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`atv-tom-${id}`} cx="100%" cy="4%" r="70%">
            <Stop offset="0" stopColor={tom} stopOpacity={0.9} />
            <Stop offset="1" stopColor={tom} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`atv-rose-${id}`} cx="22%" cy="100%" r="58%">
            <Stop offset="0" stopColor={luz.rose} stopOpacity={0.6} />
            <Stop offset="1" stopColor={luz.rose} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#atv-pessego-${id})`} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#atv-tom-${id})`} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#atv-rose-${id})`} />
      </Svg>
    </View>
  );
});

/** O fundo de todas as etapas de uma atividade: a luz, e a área segura por dentro. */
export function FundoDaAtividade({
  paleta,
  children,
  bordas = ["top", "bottom"],
}: {
  paleta: PaletaDaAtividade;
  children: ReactNode;
  bordas?: Edge[];
}) {
  return (
    <View style={{ flex: 1, backgroundColor: luz.base }}>
      <LuzDaAtividade tom={paleta.luz} />
      <SafeAreaView edges={bordas} style={{ flex: 1 }}>
        {children}
      </SafeAreaView>
    </View>
  );
}

/**
 * O FUNDO DA NOITE: o céu da noite do app (a arte de `CEUS.noite`, PARADA —
 * sem estrela cadente nem nuvem andando atrás de quem quer dormir) com um véu
 * de azul-noite que fecha embaixo, onde mora o texto.
 */
export function FundoDaNoite({
  children,
  bordas = ["top", "bottom"],
}: {
  children: ReactNode;
  bordas?: Edge[];
}) {
  return (
    <View style={{ flex: 1, backgroundColor: corNoite.historia }}>
      <Image
        source={CEUS.noite.arte}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
        accessible={false}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[...corNoite.veu]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView edges={bordas} style={{ flex: 1 }}>
        {children}
      </SafeAreaView>
    </View>
  );
}

/**
 * O "vidro" da noite: um material escuro e translúcido. O Liquid Glass do app
 * é sempre o claro (`Vidro`), e sobre o céu escuro ele acenderia uma pastilha
 * branca onde a letra é branca.
 */
export function VidroDaNoite({
  children,
  estilo,
  forma = canto.pilula,
}: {
  children?: ReactNode;
  estilo?: StyleProp<ViewStyle>;
  forma?: number;
}) {
  return (
    <View
      style={[
        {
          borderRadius: forma,
          ...curva,
          backgroundColor: corNoite.material,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: corNoite.materialBorda,
        },
        Platform.OS === "web"
          ? ({ backdropFilter: "blur(22px) saturate(160%)" } as unknown as ViewStyle)
          : null,
        sombraFlutuante,
        estilo,
      ]}
    >
      {children}
    </View>
  );
}

/* ── O topo: um fechar só ─────────────────────────────────────────────── */

/**
 * O botão redondo que flutua (44 pt): o fechar, o voltar de um subnível, o
 * som da carta. Vidro no claro; o material escuro na noite.
 */
export function BotaoRedondo({
  rotulo,
  aoTocar,
  escuro,
  children,
}: {
  rotulo: string;
  aoTocar: () => void;
  escuro?: boolean;
  children: ReactNode;
}) {
  const miolo = (
    <View
      style={{
        width: ALVO_MINIMO,
        height: ALVO_MINIMO,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
  return (
    <Tocavel rotulo={rotulo} aoTocar={aoTocar} profundidade={0.92}>
      {escuro ? (
        <VidroDaNoite forma={ALVO_MINIMO / 2}>{miolo}</VidroDaNoite>
      ) : (
        <Vidro forma={ALVO_MINIMO / 2} interativo>
          {miolo}
        </Vidro>
      )}
    </Tocavel>
  );
}

/**
 * O TOPO DE TODAS AS ETAPAS: o fechar no canto (um só jeito de sair, em
 * qualquer etapa), e no meio o que a etapa quiser (a cápsula de progresso).
 * `voltar` troca o X pela seta, nos subníveis (a lista de cartas, a de
 * gratidões).
 */
export function TopoDaAtividade({
  aoFechar = fecharAtividade,
  voltar,
  escuro,
  meio,
  direita,
}: {
  aoFechar?: () => void;
  voltar?: boolean;
  escuro?: boolean;
  meio?: ReactNode;
  direita?: ReactNode;
}) {
  const tinta = escuro ? cor.branco : cor.texto;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        paddingHorizontal: margem.tela,
        paddingTop: espaco.xs,
        paddingBottom: espaco.sm,
        zIndex: 5,
      }}
    >
      <BotaoRedondo rotulo={voltar ? "Voltar" : "Fechar"} aoTocar={aoFechar} escuro={escuro}>
        {voltar ? (
          <ChevronLeft size={22} color={tinta} strokeWidth={2.4} />
        ) : (
          <X size={20} color={tinta} strokeWidth={2.4} />
        )}
      </BotaoRedondo>
      <View style={{ flex: 1 }}>{meio}</View>
      {/* Sem nada à direita, um vão do mesmo tamanho: o meio fica no meio. */}
      {direita ?? <View style={{ width: ALVO_MINIMO }} />}
    </View>
  );
}

/**
 * A CÁPSULA DE PROGRESSO em segmentos (os movimentos, as linhas da carta):
 * os feitos na ação, o de agora pela metade, os que faltam no trilho.
 */
export function Segmentos({
  paleta,
  total,
  atual,
  altura = 4,
  rotulo,
}: {
  paleta: PaletaDaAtividade;
  total: number;
  atual: number;
  altura?: number;
  rotulo?: string;
}) {
  return (
    <View
      accessible={!!rotulo}
      accessibilityLabel={rotulo}
      style={{ flexDirection: "row", gap: 3, alignItems: "center" }}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: altura,
            borderRadius: altura / 2,
            backgroundColor:
              i < atual ? paleta.acao : i === atual ? comAlfa(paleta.acao, 0.45) : cor.trilho,
          }}
        />
      ))}
    </View>
  );
}

/* ── A bolha que fala ─────────────────────────────────────────────────── */

/**
 * O BRILHO atrás da arte: a luz de estúdio em que as artes 3D foram pintadas.
 * Sem ele, a arte flutua num fundo chapado e parece recortada.
 */
export function Brilho({ tamanho, tinta = "#ffffff" }: { tamanho: number; tinta?: string }) {
  /* Na web os ids de degradê são do documento inteiro: um por cor. */
  const id = `brilho-${tinta.replace(/[^0-9a-z]/gi, "")}`;
  return (
    <Svg
      width={tamanho}
      height={tamanho}
      pointerEvents="none"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        marginLeft: -tamanho / 2,
        marginTop: -tamanho / 2,
      }}
    >
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={tinta} stopOpacity={0.95} />
          <Stop offset="0.55" stopColor={tinta} stopOpacity={0.5} />
          <Stop offset="1" stopColor={tinta} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={tamanho / 2} cy={tamanho / 2} r={tamanho / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

/** O balão: branco, com a sombra do material, e a ponta virada para quem fala. */
function Balao({ fala, ponta }: { fala: string; ponta: "cima" | "esquerda" }) {
  return (
    <View style={ponta === "esquerda" ? { flex: 1, justifyContent: "center" } : null}>
      <View
        style={{
          borderRadius: canto.dentro,
          ...curva,
          backgroundColor: cor.branco,
          paddingHorizontal: espaco.lg,
          paddingVertical: 10,
          ...sombra,
        }}
      >
        <Text
          style={{
            textAlign: ponta === "cima" ? "center" : "left",
            ...fonte.media,
            ...escala.legenda,
            color: cor.textoCorpo,
          }}
        >
          {fala}
        </Text>
      </View>
      {/* A ponta, por CIMA do balão: assim a sombra dele não a corta. */}
      <View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            width: 14,
            height: 14,
            borderRadius: 3,
            backgroundColor: cor.branco,
            transform: [{ rotate: "45deg" }],
          },
          ponta === "cima"
            ? { top: -6, left: "50%", marginLeft: -7 }
            : { left: -6, top: "50%", marginTop: -7 },
        ]}
      />
    </View>
  );
}

/**
 * O porta-voz falando num balão — "ele que vai interagir com as pessoas",
 * nas palavras do dono no app antigo. `lado` é a abertura das atividades: a
 * bolha de 88 à esquerda e o balão à direita, para a primeira escolha caber na
 * primeira tela (a bolha grande, com o balão embaixo, ocupava ~420 pt antes
 * de qualquer coisa que se faz).
 */
export function BolhaComBalao({
  humor,
  fala,
  tamanho,
  lado,
}: {
  humor: HumorDaBolha;
  fala: string;
  tamanho?: number;
  lado?: boolean;
}) {
  if (lado) {
    const t = tamanho ?? 88;
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md + 2 }}>
        <View style={{ width: t, height: t, alignItems: "center", justifyContent: "center" }}>
          <Brilho tamanho={t * 1.36} />
          <BolhaViva humor={humor} tamanho={t} />
        </View>
        <Balao fala={fala} ponta="esquerda" />
      </View>
    );
  }
  const t = tamanho ?? 168;
  const grande = t >= 120;
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        {grande ? <Brilho tamanho={t * 1.45} /> : null}
        <BolhaViva humor={humor} tamanho={t} />
      </View>
      <View style={{ marginTop: espaco.md, maxWidth: 296 }}>
        <Balao fala={fala} ponta="cima" />
      </View>
    </View>
  );
}

/** O esqueleto da abertura: a bolha e o balão vazios, enquanto a atividade carrega. */
function EsqueletoDaAbertura({ paleta }: { paleta: PaletaDaAtividade }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md + 2 }}>
      <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: paleta.luz }} />
      <View
        style={{
          flex: 1,
          height: 64,
          borderRadius: canto.dentro,
          ...curva,
          backgroundColor: luz.cartao,
        }}
      />
    </View>
  );
}

/**
 * CARREGANDO: a luz da atividade desde o primeiro quadro (o fundo não pisca de
 * uma cor para outra durante a entrada da tela) e o esqueleto da abertura por
 * cima. A roda só aparece se passar de 400 ms.
 */
export function CarregandoAtividade({
  paleta,
  noite,
}: {
  paleta?: PaletaDaAtividade;
  noite?: boolean;
}) {
  const [demorou, setDemorou] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setDemorou(true), 400);
    return () => clearTimeout(id);
  }, []);
  const roda = demorou ? (
    <ActivityIndicator
      style={{ marginTop: espaco.xxl }}
      color={noite ? cor.branco : (paleta?.acao ?? cor.texto)}
    />
  ) : null;
  if (noite || !paleta)
    return (
      <FundoDaNoite>
        <StatusBar style="light" animated />
        <TopoDaAtividade escuro />
        {roda}
      </FundoDaNoite>
    );
  return (
    <FundoDaAtividade paleta={paleta}>
      <TopoDaAtividade />
      <View style={{ paddingHorizontal: margem.foco, paddingTop: espaco.sm }}>
        <EsqueletoDaAbertura paleta={paleta} />
        {roda}
      </View>
    </FundoDaAtividade>
  );
}

/* ── A letra das atividades ───────────────────────────────────────────── */

/** O título da atividade: a serifada do app, 28/34. */
export function TituloDaAtividade({
  children,
  centro,
  escuro,
}: {
  children: string;
  centro?: boolean;
  escuro?: boolean;
}) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        marginTop: espaco.xl,
        textAlign: centro ? "center" : "left",
        ...fonte.display,
        ...escala.titulo1,
        letterSpacing: -0.2,
        color: escuro ? corNoite.texto : cor.texto,
      }}
    >
      {children}
    </Text>
  );
}

/** A sobrelinha da atividade (um estilo só no app inteiro), na cor da ação. */
export function SobrelinhaDaAtividade({
  paleta,
  children,
}: {
  paleta: PaletaDaAtividade;
  children: ReactNode;
}) {
  return <Sobrelinha tinta={paleta.acao}>{children}</Sobrelinha>;
}

/**
 * O título de seção: a pergunta que a tela faz a ela, em frase, firme e na
 * tinta do app (era em maiúsculas espaçadas, na cor clara: rótulo de site).
 */
export function Secao({
  children,
  topo = 28,
  escuro,
}: {
  children: string;
  topo?: number;
  escuro?: boolean;
}) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        marginTop: topo,
        marginBottom: espaco.md,
        ...fonte.forte,
        ...escala.manchete,
        color: escuro ? corNoite.texto : cor.texto,
      }}
    >
      {children}
    </Text>
  );
}

/** O círculo claro atrás de um ícone (o emoji de uma escolha, um ícone desenhado). */
export function Ficha({
  fundo,
  tamanho = 36,
  children,
}: {
  fundo: string;
  tamanho?: number;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: tamanho / 2,
        backgroundColor: fundo,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}

/** A superfície clara: o cartão do material, com a sombra na cor da atividade. */
export function Superficie({
  tinta,
  fundo = cor.branco,
  estilo,
  children,
}: {
  /** A cor da sombra (a ação da atividade). */
  tinta: string;
  fundo?: string;
  estilo?: ViewStyle;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        borderRadius: canto.dentro + 2,
        ...curva,
        backgroundColor: fundo,
        padding: espaco.lg,
        ...sombraDe(tinta),
        ...estilo,
      }}
    >
      {children}
    </View>
  );
}

/* ── Os botões com relevo ─────────────────────────────────────────────── */

/**
 * O BOTÃO COM RELEVO: a face em cima do lábio, que afunda quando o dedo aperta
 * (a altura total não muda, então nada embaixo dele pula). `claro` é o botão
 * secundário: face branca, letra na cor.
 */
export function BotaoDaAtividade({
  cor: tinta,
  luz: faceClara,
  rotulo,
  aoTocar,
  desabilitado,
  claro,
  icone,
  rotuloAcessivel,
  carregando,
  vibrar = true,
}: {
  cor: string;
  /** A luz da paleta: a face do botão desligado (sem ela, a cor clareada). */
  luz?: string;
  rotulo: string;
  aoTocar: () => void;
  desabilitado?: boolean;
  claro?: boolean;
  icone?: ReactNode;
  rotuloAcessivel?: string;
  /** Gravando: a roda gira no lugar do ícone e o botão não aceita outro toque. */
  carregando?: boolean;
  /** `false` quando a própria ação vibra do seu jeito (o acerto e o erro da aula). */
  vibrar?: boolean;
}) {
  /* Desabilitado, o botão fica na face clara da própria cor, com a letra na
     cor pela metade — e não a cor cheia com transparência, que virava um tom
     de barro sobre o fundo. */
  const apagado = !!desabilitado && !claro;
  const face = apagado ? (faceClara ?? clarear(tinta, 0.84)) : tinta;
  const labio = claro || apagado ? misturar(face, tinta, 0.2) : escurecer(tinta, 0.28);
  const off = desabilitado || carregando;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel ?? rotulo}
      accessibilityState={{ disabled: !!off, busy: !!carregando }}
      disabled={off}
      onPress={() => {
        if (vibrar) toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        borderRadius: 22,
        ...curva,
        backgroundColor: claro ? misturar(cor.branco, tinta, 0.22) : labio,
        paddingBottom: pressed ? 1 : LABIO + 1,
        marginTop: pressed ? LABIO : 0,
        opacity: desabilitado && claro ? 0.5 : 1,
        /* A luz do botão cheio: um brilho da própria cor embaixo. */
        boxShadow: claro || off ? undefined : `0px 12px 22px -12px ${comAlfa(tinta, 0.75)}`,
      })}
    >
      <View
        style={{
          minHeight: claro ? 48 : 54,
          borderRadius: 22,
          ...curva,
          overflow: "hidden",
          backgroundColor: claro ? cor.branco : face,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: espaco.sm,
          paddingHorizontal: espaco.xl,
        }}
      >
        {/* A face recebe a luz de cima, como os botões das abas. */}
        {claro || apagado ? null : (
          <LinearGradient
            pointerEvents="none"
            colors={[clarear(face, 0.18), face]}
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
          />
        )}
        {carregando ? <ActivityIndicator color={claro ? tinta : cor.branco} /> : icone}
        <Text
          style={{
            ...fonte.forte,
            fontSize: claro ? 16 : 17,
            lineHeight: 22,
            color: claro ? tinta : apagado ? comAlfa(tinta, 0.5) : cor.branco,
          }}
        >
          {rotulo}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * A PÍLULA COM RELEVO (as fichinhas da Gratidão, o horário do lembrete): a
 * mesma face-sobre-lábio do botão grande, num tamanho de etiqueta. `cheia` é a
 * marcada.
 */
export function PilulaComRelevo({
  paleta,
  rotulo,
  aoTocar,
  cheia,
  rotuloAcessivel,
  numero,
}: {
  paleta: PaletaDaAtividade;
  rotulo: string;
  aoTocar: () => void;
  cheia?: boolean;
  rotuloAcessivel?: string;
  /** Um horário, um número: algarismos da mesma largura. */
  numero?: boolean;
}) {
  const m = materialDe(paleta);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel ?? rotulo}
      hitSlop={{ top: 4, bottom: 4 }}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        borderRadius: canto.pilula,
        ...curva,
        backgroundColor: cheia ? m.labioCheio : m.labioClaro,
        paddingBottom: pressed ? 1 : 3,
        marginTop: pressed ? 2 : 0,
      })}
    >
      <View
        style={{
          minHeight: 36,
          paddingHorizontal: 14,
          borderRadius: canto.pilula,
          ...curva,
          backgroundColor: cheia ? paleta.acao : cor.branco,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            ...fonte.forte,
            ...escala.legenda,
            color: cheia ? cor.branco : paleta.acao,
            fontVariant: numero ? ["tabular-nums"] : undefined,
          }}
        >
          {rotulo}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * As escolhas, com relevo: face branca sobre o lábio claro; escolhida, a face
 * enche de cor sobre o lábio escuro. `centro` é o botão de tempo (texto no
 * meio); sem ele, o ícone vai numa ficha à esquerda.
 */
export function Escolha({
  paleta,
  rotulo,
  ativa,
  aoTocar,
  centro,
  estilo,
  children,
}: {
  paleta: PaletaDaAtividade;
  rotulo: string;
  ativa: boolean;
  aoTocar: () => void;
  centro?: boolean;
  estilo?: { width?: `${number}%`; flex?: number };
  children?: ReactNode;
}) {
  const m = materialDe(paleta);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: ativa }}
      accessibilityLabel={rotulo}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        ...estilo,
        borderRadius: 18,
        ...curva,
        backgroundColor: ativa ? m.labioCheio : m.labioClaro,
        paddingBottom: pressed ? 1 : LABIO,
        marginTop: pressed ? LABIO - 1 : 0,
      })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: centro ? "center" : "flex-start",
          gap: 10,
          minHeight: centro ? 48 : 58,
          paddingHorizontal: centro ? espaco.md : 10,
          paddingVertical: espaco.sm,
          borderRadius: 18,
          ...curva,
          backgroundColor: ativa ? paleta.acao : cor.branco,
        }}
      >
        {children ? (
          <Ficha fundo={ativa ? "rgba(255,255,255,0.22)" : m.ficha}>{children}</Ficha>
        ) : null}
        <Text
          style={{
            flexShrink: 1,
            ...fonte.forte,
            ...(centro ? escala.chamada : escala.legenda),
            color: ativa ? cor.branco : cor.texto,
            fontVariant: centro ? ["tabular-nums"] : undefined,
          }}
        >
          {rotulo}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * A linha de escolha com título e legenda (o tema da meditação, a quantidade
 * de voz): a legenda diz o que o título não diz sozinho.
 */
export function EscolhaComLegenda({
  paleta,
  titulo,
  legenda,
  ativa,
  aoTocar,
  antes,
  depois,
}: {
  paleta: PaletaDaAtividade;
  titulo: string;
  legenda: string;
  ativa: boolean;
  aoTocar: () => void;
  antes?: ReactNode;
  depois?: ReactNode;
}) {
  const m = materialDe(paleta);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: ativa }}
      accessibilityLabel={`${titulo}. ${legenda}`}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        borderRadius: canto.dentro,
        ...curva,
        backgroundColor: ativa ? m.labioCheio : m.labioClaro,
        paddingBottom: pressed ? 1 : LABIO,
        marginTop: pressed ? LABIO - 1 : 0,
      })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.md,
          minHeight: ALVO_MINIMO + 12,
          paddingHorizontal: espaco.lg,
          paddingVertical: espaco.md,
          borderRadius: canto.dentro,
          ...curva,
          backgroundColor: ativa ? paleta.acao : cor.branco,
        }}
      >
        {antes}
        <View style={{ flex: 1 }}>
          <Text
            style={{ ...fonte.forte, ...escala.legenda, color: ativa ? cor.branco : cor.texto }}
          >
            {titulo}
          </Text>
          <Text
            style={{
              ...fonte.normal,
              ...escala.nota,
              color: ativa ? "rgba(255,255,255,0.86)" : cor.textoApagado,
            }}
          >
            {legenda}
          </Text>
        </View>
        {depois}
      </View>
    </Pressable>
  );
}

/**
 * A LINHA DE LISTA: navegar (abrir outra tela) não tem a cara de escolher. É
 * o cartão claro do app, sem lábio, com a seta no fim (como nos Ajustes).
 */
export function LinhaDaAtividade({
  arte,
  titulo,
  legenda,
  aoTocar,
  direita,
}: {
  arte?: ReactNode;
  titulo: string;
  legenda?: string;
  aoTocar: () => void;
  direita?: ReactNode;
}) {
  return (
    <Tocavel
      rotulo={legenda ? `${titulo}. ${legenda}` : titulo}
      aoTocar={aoTocar}
      estilo={{
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        minHeight: ALVO_MINIMO + 16,
        paddingHorizontal: espaco.lg,
        paddingVertical: espaco.md,
        borderRadius: canto.dentro,
        ...curva,
        backgroundColor: luz.cartao,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.9)",
        ...sombra,
      }}
    >
      {arte}
      <View style={{ flex: 1 }}>
        <Text style={{ ...fonte.forte, ...escala.chamada, color: cor.texto }}>{titulo}</Text>
        {legenda ? (
          <Text style={{ ...fonte.normal, ...escala.nota, color: cor.textoApagado }}>
            {legenda}
          </Text>
        ) : null}
      </View>
      {direita ?? <ChevronRight size={20} color={cor.chevron} strokeWidth={2.4} />}
    </Tocavel>
  );
}

/** A arte 3D de uma linha (os fones com a lua, o coração na almofada), parada. */
export function ArteDaLinha({ fonte: arte, tamanho = 32 }: { fonte: number; tamanho?: number }) {
  return (
    <Image
      source={arte}
      style={{ width: tamanho, height: tamanho }}
      contentFit="contain"
      accessible={false}
    />
  );
}

/* ── O pé: o botão de começar e os controles da sessão ───────────────── */

/** O quanto a rolagem precisa sobrar embaixo para terminar acima do rodapé. */
export const FOLGA_DO_RODAPE = 112;

/**
 * O rodapé com o botão de começar, FLUTUANDO sobre o fim da rolagem: a lista
 * não empurra o botão para fora da tela, e some num esfumado embaixo dele. Sem
 * faixa opaca (era um retângulo branco cortando a luz).
 */
export function RodapeDaAtividade({ children }: { children: ReactNode }) {
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
      <LinearGradient
        pointerEvents="none"
        colors={[comAlfa(luz.base, 0), comAlfa(luz.base, 0.9), comAlfa(luz.base, 0.96)]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ paddingHorizontal: margem.foco, paddingTop: 28, paddingBottom: espaco.md }}>
        {children}
      </View>
    </View>
  );
}

/** O quanto a rolagem de uma sessão precisa sobrar embaixo para passar dos controles. */
export const FOLGA_DOS_CONTROLES = 116;

/** Um controle de 44 pt da barra da sessão. */
export function BotaoDoControle({
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
        width: ALVO_MINIMO + 4,
        height: ALVO_MINIMO + 4,
        borderRadius: (ALVO_MINIMO + 4) / 2,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.55 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

/**
 * OS CONTROLES DA SESSÃO, embaixo e ao alcance do polegar (como no Fitness e
 * no Mindfulness): uma barra de vidro flutuando no pé, com pausar/continuar
 * de 64 pt no meio e os controles de 44 dos lados. Antes eram cinco botões
 * miúdos espremidos no cabeçalho, e a pausa — o controle principal de uma
 * sessão guiada — era a menor coisa da tela.
 */
export function ControlesDaSessao({
  paleta,
  pausada,
  aoAlternar,
  esquerda,
  direita,
}: {
  paleta: PaletaDaAtividade;
  pausada: boolean;
  aoAlternar: () => void;
  esquerda?: ReactNode;
  direita?: ReactNode;
}) {
  const vao = <View style={{ width: ALVO_MINIMO + 4 }} />;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: espaco.sm,
        alignItems: "center",
      }}
    >
      <Vidro
        estilo={{
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.lg,
          paddingHorizontal: espaco.md,
          paddingVertical: 6,
        }}
      >
        {esquerda ?? vao}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={pausada ? "Continuar" : "Pausar"}
          onPress={() => {
            toque(false);
            aoAlternar();
          }}
          style={({ pressed }) => ({
            width: 64,
            height: 64,
            borderRadius: 32,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: paleta.acao,
            transform: [{ scale: pressed ? 0.94 : 1 }],
            ...brilhoDe(paleta.acao, 0.6),
          })}
        >
          {pausada ? (
            <Play size={26} color={cor.branco} fill={cor.branco} style={{ marginLeft: 3 }} />
          ) : (
            <Pause size={26} color={cor.branco} fill={cor.branco} />
          )}
        </Pressable>
        {direita ?? vao}
      </Vidro>
    </View>
  );
}

/* ── As folhas ────────────────────────────────────────────────────────── */

/**
 * A FOLHA NATIVA do iOS (`pageSheet`): sobe da base, com o véu e o arrastar
 * para baixo do sistema. Era um Modal transparente com o véu subindo junto,
 * sem alça nem arrastar — a folha mais nativa do iPhone, reimplementada, era a
 * que mais denunciava a web.
 */
export function FolhaDaAtividade({
  aberta,
  titulo,
  paleta,
  aoFechar,
  children,
  nota,
}: {
  aberta: boolean;
  titulo: string;
  paleta: PaletaDaAtividade;
  aoFechar: () => void;
  children: ReactNode;
  /** Uma linha de ajuda embaixo do título. */
  nota?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={aberta}
      presentationStyle="pageSheet"
      animationType="slide"
      onRequestClose={aoFechar}
    >
      <View style={{ flex: 1, backgroundColor: luz.base }}>
        <View style={{ alignItems: "center", paddingTop: 6 }}>
          <View
            style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: cor.trilho }}
            accessible={false}
          />
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: margem.tela,
            minHeight: 52,
          }}
        >
          <View style={{ width: 80 }} />
          <Text
            accessibilityRole="header"
            style={{
              flex: 1,
              textAlign: "center",
              ...fonte.forte,
              ...escala.manchete,
              color: cor.texto,
            }}
          >
            {titulo}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pronto"
            onPress={() => {
              toque();
              aoFechar();
            }}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 80,
              minHeight: ALVO_MINIMO,
              alignItems: "flex-end",
              justifyContent: "center",
              opacity: pressed ? 0.55 : 1,
            })}
          >
            <Text style={{ ...fonte.forte, ...escala.manchete, color: paleta.acao }}>Pronto</Text>
          </Pressable>
        </View>
        {nota ? (
          <Text
            style={{
              paddingHorizontal: margem.foco,
              textAlign: "center",
              ...fonte.normal,
              ...escala.nota,
              color: cor.textoApagado,
            }}
          >
            {nota}
          </Text>
        ) : null}
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: margem.tela,
            paddingTop: espaco.lg,
            paddingBottom: Math.max(insets.bottom, espaco.lg) + espaco.xl,
            gap: espaco.lg,
          }}
        >
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Um grupo de linhas numa folha (como os grupos dos Ajustes), com o título em cima. */
export function GrupoDaFolha({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      {titulo ? (
        <View style={{ paddingHorizontal: espaco.lg }}>
          <Sobrelinha>{titulo}</Sobrelinha>
        </View>
      ) : null}
      <View
        style={{
          borderRadius: canto.dentro,
          ...curva,
          backgroundColor: cor.branco,
          overflow: "hidden",
          ...sombra,
        }}
      >
        {children}
      </View>
    </View>
  );
}

/** Uma linha de escolha numa folha: a arte, o nome, a legenda e o ✓ na marcada. */
export function LinhaDaFolha({
  paleta,
  arte,
  titulo,
  legenda,
  marcada,
  aoTocar,
  primeira,
  depois,
}: {
  paleta: PaletaDaAtividade;
  arte?: ReactNode;
  titulo: string;
  legenda?: string;
  marcada: boolean;
  aoTocar: () => void;
  primeira?: boolean;
  depois?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: marcada }}
      accessibilityLabel={legenda ? `${titulo}. ${legenda}` : titulo}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        minHeight: ALVO_MINIMO + 12,
        paddingLeft: espaco.lg,
        paddingRight: espaco.lg,
        backgroundColor: pressed ? cor.apagado : cor.branco,
      })}
    >
      {arte}
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.sm,
          alignSelf: "stretch",
          paddingVertical: 10,
          borderTopWidth: primeira ? 0 : StyleSheet.hairlineWidth,
          borderTopColor: cor.borda,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ ...fonte.forte, ...escala.legenda, color: cor.texto }}>{titulo}</Text>
          {legenda ? (
            <Text style={{ ...fonte.normal, ...escala.nota, color: cor.textoApagado }}>
              {legenda}
            </Text>
          ) : null}
        </View>
        {depois}
        {marcada ? <Check size={20} color={paleta.acao} strokeWidth={2.6} /> : null}
      </View>
    </Pressable>
  );
}

/* ── A voz ────────────────────────────────────────────────────────────── */

/**
 * A VOZ, DESENHADA — um balão de fala com duas linhas por dentro. Pedido do
 * dono no app antigo, no lugar do emoji 🗣️ ("está muito feio").
 */
export function IconeDaVoz({ cor: tinta, tamanho = 22 }: { cor: string; tamanho?: number }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={4} width={17} height={11} rx={3} stroke={tinta} strokeWidth={2} />
      <Path
        d="M7.5 15v3.6l3.6-3.6"
        stroke={tinta}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M8 8.3h8M8 11.3h5" stroke={tinta} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** O botão da voz dos controles: o ícone na tinta, riscado pela metade quando desligada. */
export function BotaoDaVoz({ ligada, aoTocar }: { ligada: boolean; aoTocar: () => void }) {
  return (
    <BotaoDoControle rotulo={ligada ? "Desligar a voz" : "Ligar a voz"} aoTocar={aoTocar}>
      <View style={{ opacity: ligada ? 1 : 0.4 }}>
        <IconeDaVoz cor={cor.texto} />
      </View>
    </BotaoDoControle>
  );
}

/** A troca de etapa: o miolo novo entra subindo de leve, sobre o mesmo fundo. */
export function TrocaDeEtapa({ chave, children }: { chave: string; children: ReactNode }) {
  return (
    <Entrada key={chave} deslocamento={20} estilo={{ flex: 1 }}>
      {children}
    </Entrada>
  );
}
