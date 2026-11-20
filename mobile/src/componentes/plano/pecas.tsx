import Activity from "lucide-react-native/icons/activity";
import Baby from "lucide-react-native/icons/baby";
import BookHeart from "lucide-react-native/icons/book-heart";
import Calendar from "lucide-react-native/icons/calendar";
import Check from "lucide-react-native/icons/check";
import Clock from "lucide-react-native/icons/clock";
import CloudSun from "lucide-react-native/icons/cloud-sun";
import FaceSlightlySmiling from "lucide-react-native/icons/face-slightly-smiling";
import Feather from "lucide-react-native/icons/feather";
import Flower from "lucide-react-native/icons/flower";
import GraduationCap from "lucide-react-native/icons/graduation-cap";
import Heart from "lucide-react-native/icons/heart";
import HeartHandshake from "lucide-react-native/icons/heart-handshake";
import Leaf from "lucide-react-native/icons/leaf";
import Moon from "lucide-react-native/icons/moon";
import Shuffle from "lucide-react-native/icons/shuffle";
import Sparkles from "lucide-react-native/icons/sparkles";
import Sprout from "lucide-react-native/icons/sprout";
import Sun from "lucide-react-native/icons/sun";
import Sunrise from "lucide-react-native/icons/sunrise";
import Ticket from "lucide-react-native/icons/ticket";
import User from "lucide-react-native/icons/user";
import UserPlus from "lucide-react-native/icons/user-plus";
import Users from "lucide-react-native/icons/users";
import Wind from "lucide-react-native/icons/wind";
import type { LucideIcon } from "lucide-react-native";
import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { selecao } from "~/componentes/base";
import {
  ArteDaBolha,
  Entrada,
  useMolaDeToque,
  useMovimentoReduzido,
  type HumorDaArte,
} from "~/componentes/movimento";
import { cor, curva, escala, espaco, fonte, raio, veu } from "~/tema";

/**
 * AS PEÇAS DO FUNIL "MONTAR O MEU PLANO" (20/11/2026): a opção com ícone, a
 * barra de progresso contínua e os ícones por nome. Tudo sobre o véu da
 * entrada (o céu da hora escurecido), como o ritual.
 */

const ICONES: Readonly<Record<string, LucideIcon>> = {
  activity: Activity,
  baby: Baby,
  "book-heart": BookHeart,
  calendar: Calendar,
  clock: Clock,
  "cloud-sun": CloudSun,
  "face-slightly-smiling": FaceSlightlySmiling,
  feather: Feather,
  flower: Flower,
  "graduation-cap": GraduationCap,
  heart: Heart,
  "heart-handshake": HeartHandshake,
  leaf: Leaf,
  moon: Moon,
  shuffle: Shuffle,
  sparkles: Sparkles,
  sprout: Sprout,
  sun: Sun,
  sunrise: Sunrise,
  ticket: Ticket,
  user: User,
  "user-plus": UserPlus,
  users: Users,
  wind: Wind,
};

export function IconeDoPlano({
  nome,
  tamanho = 22,
  corDoIcone,
}: {
  nome: string;
  tamanho?: number;
  corDoIcone: string;
}) {
  const Icone = ICONES[nome] ?? Sparkles;
  return <Icone size={tamanho} color={corDoIcone} strokeWidth={2} />;
}

/**
 * A SUPERFÍCIE do funil (21/11/2026): uma só, discreta, para tudo o que agrupa
 * conteúdo sobre o véu — as opções, as listas, o gráfico, o plano. No lugar
 * dos blocos brancos de antes, que cortavam o céu em retângulos.
 */
export function Superficie({
  children,
  acesa,
  estilo,
}: {
  children: ReactNode;
  acesa?: boolean;
  estilo?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          borderRadius: 22,
          ...curva,
          borderWidth: acesa ? 1.5 : 1,
          borderColor: acesa ? "rgba(255,255,255,0.82)" : veu.superficieBorda,
          backgroundColor: acesa ? veu.superficieAcesa : veu.superficie,
        },
        estilo,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * A PERGUNTA de um passo (21/11/2026, "mais clean, de outro nível"): a Bolha
 * pequena com a reação dela (uma linha ou duas, quando há), e a pergunta
 * grande, na serifada, como o título da tela. Uma coisa de cada vez, com ar.
 */
export function PerguntaDoPlano({
  pose,
  reacao,
  pergunta,
  apoio,
}: {
  pose: HumorDaArte;
  reacao: string | null;
  pergunta: string;
  apoio?: string;
}) {
  return (
    <View style={{ gap: espaco.md, paddingTop: espaco.md, paddingBottom: espaco.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md, minHeight: 56 }}>
        <View accessible={false} importantForAccessibility="no-hide-descendants">
          <ArteDaBolha humor={pose} tamanho={56} />
        </View>
        {reacao ? (
          <Entrada atraso={60} deslocamento={8} estilo={{ flex: 1 }}>
            <Text style={{ ...fonte.media, ...escala.chamada, color: veu.textoNoVeu }}>
              {reacao}
            </Text>
          </Entrada>
        ) : null}
      </View>
      <Entrada atraso={reacao ? 200 : 60} deslocamento={10}>
        <Text
          accessibilityRole="header"
          style={{ ...fonte.display, ...escala.titulo1, letterSpacing: -0.3, color: cor.branco }}
        >
          {pergunta}
        </Text>
      </Entrada>
      {apoio ? (
        <Text style={{ ...fonte.normal, ...escala.legenda, color: veu.textoNoVeu }}>{apoio}</Text>
      ) : null}
    </View>
  );
}

/**
 * Uma opção do funil, no desenho de 21/11/2026: a superfície discreta, o ícone
 * em pêssego, o rótulo branco; escolhida, a superfície acende (aro branco e
 * o visto framboesa) — sem virar um bloco branco, que pesava a tela quando
 * três ficavam marcadas. O círculo é de uma escolha; o quadradinho, de várias.
 */
export function OpcaoDoPlano({
  rotulo,
  sub,
  icone,
  marcada,
  varias = false,
  aoTocar,
}: {
  rotulo: string;
  sub?: string;
  icone: string;
  marcada: boolean;
  varias?: boolean;
  aoTocar: () => void;
}) {
  const { escala: mola, aoPressionar, aoSoltar } = useMolaDeToque(0.975);
  return (
    <Pressable
      accessibilityRole={varias ? "checkbox" : "radio"}
      accessibilityLabel={sub ? `${rotulo}, ${sub}` : rotulo}
      accessibilityState={{ checked: marcada }}
      onPressIn={aoPressionar}
      onPressOut={aoSoltar}
      onPress={() => {
        selecao();
        aoTocar();
      }}
    >
      <Animated.View style={{ transform: [{ scale: mola }] }}>
        <Superficie
          acesa={marcada}
          estilo={{
            minHeight: 60,
            flexDirection: "row",
            alignItems: "center",
            gap: espaco.md,
            paddingVertical: 10,
            paddingLeft: 10,
            paddingRight: espaco.lg,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 13,
              ...curva,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: marcada ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.07)",
            }}
          >
            <IconeDoPlano
              nome={icone}
              tamanho={20}
              corDoIcone={marcada ? cor.branco : veu.destaqueNoVeu}
            />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={{ ...fonte.forte, ...escala.manchete, color: cor.branco }}>{rotulo}</Text>
            {sub ? (
              <Text style={{ ...fonte.media, ...escala.legenda, color: veu.textoNoVeu }}>
                {sub}
              </Text>
            ) : null}
          </View>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: varias ? 7 : raio.pilula,
              ...curva,
              borderWidth: marcada ? 0 : 1.5,
              borderColor: "rgba(255,255,255,0.4)",
              backgroundColor: marcada ? cor.primaria : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {marcada ? <Check size={14} color={cor.branco} strokeWidth={3} /> : null}
          </View>
        </Superficie>
      </Animated.View>
    </Pressable>
  );
}

/**
 * A barra do alto: uma linha contínua que enche (a referência usa uma barra só,
 * e com dezenove passos os tracinhos do ritual ficariam finos demais).
 */
export function BarraDoPlano({ fracao }: { fracao: number }) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(fracao)).current;
  useEffect(() => {
    if (reduzido) {
      v.setValue(fracao);
      return;
    }
    Animated.timing(v, {
      toValue: fracao,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fracao, reduzido, v]);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Montando o seu plano"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fracao * 100) }}
      style={{
        flex: 1,
        height: 6,
        borderRadius: 3,
        backgroundColor: "rgba(255,255,255,0.22)",
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: cor.branco,
          width: v.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
        }}
      />
    </View>
  );
}

/** A etiqueta pequena em caixa alta, espaçada ("SEMANA", "MONTADO COM AS SUAS RESPOSTAS"). */
export function Sobretitulo({ children, centro }: { children: string; centro?: boolean }) {
  return (
    <Text
      style={{
        ...fonte.forte,
        ...escala.nota,
        letterSpacing: 2.2,
        textTransform: "uppercase",
        color: veu.destaqueNoVeu,
        textAlign: centro ? "center" : "left",
      }}
    >
      {children}
    </Text>
  );
}
