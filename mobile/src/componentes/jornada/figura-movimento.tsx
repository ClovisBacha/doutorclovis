import { memo, useEffect, useState } from "react";
import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";
import type { PoseKey } from "@/lib/exercicios";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { clarear } from "~/lib/cor";
import { parteNoTempo, type Parte } from "~/lib/jornada/figura";

/**
 * A FIGURA DEMONSTRANDO O MOVIMENTO — o desenho de `figura-movimento.tsx` do
 * site, traço por traço, com as mesmas coordenadas. Ela ensina o que o emoji
 * não ensinava: como o corpo entra na posição.
 *
 * As animações saem de `~/lib/jornada/figura` (os `@keyframes dc-mv-*` do site
 * em números). O relógio anda a ~30 quadros por segundo e só re-desenha a
 * figura, nunca a tela. Com "Reduzir movimento" ligado ela fica na primeira
 * pose — o mesmo `animation: none` do site, e nada se perde: os passos estão
 * escritos embaixo.
 */

const QUADRO_MS = 33;

/** Os segundos desde que a figura apareceu, de quadro em quadro. */
function useSegundos(ativo: boolean): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    const inicio = Date.now();
    let ultimo = 0;
    let id = requestAnimationFrame(function quadro() {
      const agora = Date.now();
      if (agora - ultimo >= QUADRO_MS) {
        ultimo = agora;
        setT((agora - inicio) / 1000);
      }
      id = requestAnimationFrame(quadro);
    });
    return () => cancelAnimationFrame(id);
  }, [ativo]);
  return t;
}

const TRACO = {
  fill: "none",
  strokeWidth: 3.2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

type Desenho = { anim: string; t: number; tinta: string };

/**
 * O recheio da cabeça e da barriga: o traço sozinho era um boneco de palito, e
 * com o tom claro por dentro a figura ganha corpo — sem mudar uma coordenada
 * nem um movimento. Braços e pernas são desenhados DEPOIS, por cima dele.
 */
const recheio = (tinta: string) => clarear(tinta, 0.86);

export const FiguraMovimento = memo(function FiguraMovimento({
  pose,
  anim,
  tinta,
}: {
  pose: PoseKey;
  /** A `id` do movimento: é ela que diz qual pedaço se mexe. */
  anim: string;
  tinta: string;
}) {
  const reduzido = useMovimentoReduzido();
  const t = useSegundos(!reduzido);
  /* Deitada e de quatro são largas e baixas: no quadro alto sobraria espaço em
     cima e embaixo, e o desenho encolheria pela metade. */
  const deitada = pose === "quatro" || pose === "deitada";
  const d: Desenho = { anim, t: reduzido ? 0 : t, tinta };
  return (
    <Svg
      width={deitada ? 160 : 128}
      height={deitada ? 112 : 160}
      viewBox={deitada ? "12 20 130 90" : "0 0 120 150"}
      accessibilityRole="image"
      accessibilityLabel="Demonstração do movimento"
    >
      {pose === "quatro" ? <Quatro {...d} /> : null}
      {pose === "pe" ? <EmPe {...d} /> : null}
      {pose === "sentada" ? <Sentada {...d} /> : null}
      {pose === "borboleta" ? <Borboleta {...d} /> : null}
      {pose === "deitada" ? <Deitada {...d} /> : null}
      {pose === "parede" ? <Parede {...d} /> : null}
    </Svg>
  );
});

/** O que o `<G>` de uma parte recebe agora: o transform e a opacidade do quadro. */
const em = ({ anim, t }: Desenho, parte: Parte) => parteNoTempo(anim, parte, t);

function Linha({
  d: caminho,
  tinta,
  ...resto
}: {
  d: string;
  tinta: string;
  strokeWidth?: number;
  opacity?: number;
}) {
  return <Path d={caminho} stroke={tinta} {...TRACO} {...resto} />;
}

function Chao({ tinta, d = "M24 144 L96 144" }: { tinta: string; d?: string }) {
  return <Linha d={d} tinta={tinta} strokeWidth={2.2} opacity={0.35} />;
}

function Cabeca({ tinta, g = {} }: { tinta: string; g?: ReturnType<typeof em> }) {
  return (
    <G {...g}>
      <Circle cx={60} cy={24} r={12} stroke={tinta} {...TRACO} fill={recheio(tinta)} />
      <Linha d="M60 36 L60 46" tinta={tinta} />
    </G>
  );
}

function TroncoFrente({ tinta }: { tinta: string }) {
  return (
    <>
      <Linha d="M60 46 L60 68" tinta={tinta} />
      <Ellipse cx={60} cy={78} rx={20} ry={17} stroke={tinta} {...TRACO} fill={recheio(tinta)} />
    </>
  );
}

function EmPe(d: Desenho) {
  const { tinta } = d;
  const alonga = d.anim === "bracos";
  return (
    <>
      <Cabeca tinta={tinta} />
      <TroncoFrente tinta={tinta} />
      {/* Ombros e braços viajam juntos no rolar de ombros: é o conjunto que
          sobe e desce, não o braço solto. */}
      <G {...em(d, "ombros")}>
        <Linha d="M44 50 L76 50" tinta={tinta} />
        {/* Braços para o alto trocam a POSE inteira, e não giram: duas poses
            cruzando a opacidade, o mesmo truque do gato-camelo. */}
        <G {...em(d, "bracosBaixos")}>
          <Linha d="M44 50 L32 74 L30 94" tinta={tinta} />
          <Linha d="M76 50 L88 74 L90 94" tinta={tinta} />
        </G>
        {alonga ? (
          <G opacity={0} {...em(d, "bracosAltos")}>
            <Linha d="M44 50 L48 28 L57 12" tinta={tinta} />
            <Linha d="M76 50 L72 28 L63 12" tinta={tinta} />
          </G>
        ) : null}
      </G>
      <G {...em(d, "quadril")}>
        <Linha d="M48 96 L72 96" tinta={tinta} />
        <Linha d="M52 96 L50 120 L50 140" tinta={tinta} />
        <Linha d="M68 96 L70 120 L70 140" tinta={tinta} />
      </G>
      <Chao tinta={tinta} />
    </>
  );
}

function Sentada(d: Desenho) {
  const { tinta } = d;
  return (
    <>
      {/* A cadeira: sem ela a figura parece flutuar de joelhos dobrados. */}
      <Linha d="M40 100 L88 100 L88 140" tinta={tinta} strokeWidth={2.4} opacity={0.35} />
      <G {...em(d, "tronco")}>
        <Cabeca tinta={tinta} g={em(d, "cabeca")} />
        <TroncoFrente tinta={tinta} />
        <Linha d="M44 50 L76 50" tinta={tinta} />
        <Linha d="M44 50 L34 74 L40 96" tinta={tinta} />
        <Linha d="M76 50 L86 74 L80 96" tinta={tinta} />
      </G>
      <Linha d="M48 98 L72 98" tinta={tinta} />
      <Linha d="M52 98 L48 122" tinta={tinta} />
      <Linha d="M68 98 L72 122" tinta={tinta} />
      <Linha d="M48 122 L48 140" tinta={tinta} />
      <G {...em(d, "pe")}>
        <Linha d="M72 122 L72 138 L80 140" tinta={tinta} />
      </G>
      <Chao tinta={tinta} />
    </>
  );
}

function Borboleta(d: Desenho) {
  const { tinta } = d;
  return (
    <>
      <Cabeca tinta={tinta} />
      <TroncoFrente tinta={tinta} />
      <Linha d="M44 50 L76 50" tinta={tinta} />
      <Linha d="M44 50 L34 76 L42 96" tinta={tinta} />
      <Linha d="M76 50 L86 76 L78 96" tinta={tinta} />
      <Linha d="M48 100 L72 100" tinta={tinta} />
      {/* Cada perna gira em volta do próprio quadril, em espelho: é o que torna
          o "deixe os joelhos caírem" visível sem texto. */}
      <G {...em(d, "pernaE")}>
        <Linha d="M50 100 L30 118 L52 130" tinta={tinta} />
      </G>
      <G {...em(d, "pernaD")}>
        <Linha d="M70 100 L90 118 L68 130" tinta={tinta} />
      </G>
      <Chao tinta={tinta} />
    </>
  );
}

function Quatro(d: Desenho) {
  const { tinta } = d;
  const gato = d.anim === "gatocamelo";
  return (
    <G {...em(d, "tudo")}>
      {/* O gato-camelo é a única troca de FORMA da coluna: duas colunas
          desenhadas, uma neutra e outra arredondada, cruzando a opacidade. */}
      <G {...em(d, "colunaNeutra")}>
        <Circle cx={30} cy={46} r={13} stroke={tinta} {...TRACO} fill={recheio(tinta)} />
        <Linha d="M43 43 L50 42" tinta={tinta} />
        <Linha d="M50 42 C70 34 92 36 110 44" tinta={tinta} />
        <Linha d="M62 46 C68 76 96 76 104 50" tinta={tinta} />
      </G>
      {gato ? (
        <G opacity={0} {...em(d, "colunaRedonda")}>
          {/* Coluna arredondada: o queixo desce, o dorso sobe. */}
          <Circle cx={32} cy={60} r={13} stroke={tinta} {...TRACO} fill={recheio(tinta)} />
          <Linha d="M45 55 L52 51" tinta={tinta} />
          <Linha d="M52 51 C70 24 94 26 110 44" tinta={tinta} />
          <Linha d="M62 54 C70 82 96 80 104 52" tinta={tinta} />
        </G>
      ) : null}
      <Linha d="M46 46 L42 74 L46 100" tinta={tinta} />
      <Linha d="M110 46 L116 74 L112 100" tinta={tinta} />
      <Linha d="M20 104 L134 104" tinta={tinta} strokeWidth={2.4} opacity={0.35} />
    </G>
  );
}

/* Deitada de lado: a posição em que se aprende o assoalho pélvico, e a única
   segura para deitar depois da 20ª semana. */
function Deitada(d: Desenho) {
  const { tinta, anim } = d;
  const respira = anim === "respiracao-diafragma" || anim === "assoalho-soltar";
  const joelho = anim === "joelho-ao-peito";
  const aperta = anim === "travesseiro-entre-joelhos";
  return (
    <G>
      {/* O travesseiro sob a cabeça: ela está apoiada, não caída. */}
      <Linha d="M18 52 L38 52" tinta={tinta} strokeWidth={2.4} opacity={0.35} />
      <Circle cx={30} cy={44} r={11} stroke={tinta} {...TRACO} fill={recheio(tinta)} />
      <Linha d="M41 46 L52 48" tinta={tinta} />
      <G {...em(d, "barriga")}>
        <Linha d="M52 48 C68 44 88 46 100 52" tinta={tinta} />
        <Ellipse cx={74} cy={64} rx={19} ry={13} stroke={tinta} {...TRACO} fill={recheio(tinta)} />
      </G>
      {/* As pernas dobradas, uma sobre a outra. */}
      <G {...em(d, "pernaDeCima")}>
        <Linha d="M100 52 L118 62 L104 76" tinta={tinta} />
      </G>
      <Linha d="M100 56 L120 70 L106 84" tinta={tinta} />
      {/* O travesseiro entre os joelhos: some quando não é o assunto. */}
      {aperta || joelho || respira ? (
        <G {...em(d, "travesseiro")}>
          <Ellipse
            cx={117}
            cy={70}
            rx={7}
            ry={5}
            stroke={tinta}
            {...TRACO}
            strokeWidth={2.2}
            opacity={aperta ? 0.85 : 0.35}
          />
        </G>
      ) : null}
      <Linha d="M14 92 L136 92" tinta={tinta} strokeWidth={2.4} opacity={0.35} />
    </G>
  );
}

/* Panturrilha, costelas e agachamento apoiado: os três precisam da parede
   desenhada, senão a figura parece empurrar o ar. */
function Parede(d: Desenho) {
  const { tinta } = d;
  return (
    <>
      <Linha d="M18 8 L18 144" tinta={tinta} strokeWidth={3.6} opacity={0.4} />
      <G {...em(d, "corpo")}>
        <Cabeca tinta={tinta} />
        <TroncoFrente tinta={tinta} />
        <Linha d="M44 50 L76 50" tinta={tinta} />
        {/* Os braços para a parede. */}
        <Linha d="M44 50 L30 40 L22 34" tinta={tinta} />
        <Linha d="M76 50 L58 38 L26 30" tinta={tinta} />
      </G>
      <G {...em(d, "pernas")}>
        <Linha d="M48 96 L72 96" tinta={tinta} />
        <Linha d="M52 96 L44 120 L44 140" tinta={tinta} />
        <Linha d="M68 96 L84 118 L92 140" tinta={tinta} />
      </G>
      <Chao tinta={tinta} d="M24 144 L108 144" />
    </>
  );
}
