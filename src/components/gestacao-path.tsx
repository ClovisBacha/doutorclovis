import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { babyForWeek, fruitEmojiForWeek } from "@/lib/gestacao";
import { COURSE_MODULES, type CourseModule } from "@/lib/course-modules";
import { getCourseProgress, markModuleComplete } from "@/lib/escola.functions";
import {
  claimDailyAndGetWallet,
  grantLessonReward,
  grantDailyQuizReward,
  grantWellnessReward,
  getWellnessProgress,
  grantDayStarsBonus,
  getWallet,
  type PresenteRecebido,
} from "@/lib/sementinhas.functions";
import { getCantinho } from "@/lib/cantinho.functions";
import { CANTINHO_BY_ID, fundoBgFor } from "@/lib/cantinho";
import { TRILHA_SKINS, SKIN_KEY, estadoDoNo } from "@/lib/trilha-skins";
import { createBreathAudio, vibratePhase } from "@/lib/breath-audio";
import {
  createSoundscape,
  SOUNDSCAPES,
  type Soundscape,
  type SoundscapeKey,
} from "@/lib/soundscapes";
import {
  tocar as tocarVoz,
  parar as pararVoz,
  preparar as prepararVoz,
  faixaDoMovimento,
  RESPIRACAO,
} from "@/lib/voz";
import { faixaDaFala } from "@/lib/voz-meditacao";
import {
  CICLO,
  DENSIDADES,
  RESPIRO,
  falaNoCiclo,
  planejarSessao,
  type Densidade,
  type Plano,
} from "@/lib/meditacao-sessao";
import {
  CHAVE_DO_PROGRAMA,
  diaDoPrograma,
  PROGRAMA,
  type DiaDoPrograma,
} from "@/lib/meditacao-programa";
import { FiguraMovimento } from "@/components/figura-movimento";
import {
  DURACOES_EXERCICIO,
  SINAIS_DE_PARADA,
  SINTOMAS,
  ajustarNotas,
  elegiveis,
  fasePara,
  sessaoDoDia,
  type DuracaoExercicio,
  type Movimento,
  type NotasDoCorpo,
  type Sintoma,
} from "@/lib/exercicios";
import {
  HUMOR_GRATIDAO,
  PREFIXO_GRATIDAO,
  cartaDasGratidoes,
  ehDiaDificil,
  ehDomingoDeResumo,
  ehGratidao,
  falaDaBolha,
  gratidaoParaReler,
  gratidoesDaSemana,
  haQuantoTempo,
  marcoAtingido,
  perguntaDoDia,
  textoDaGratidao,
  type Gratidao,
} from "@/lib/gratidao";
import { periodoDaHora, type Periodo } from "@/lib/frases-do-mascote";
import {
  LIMITE_BYTES,
  LIMITE_SEGUNDOS,
  gravar,
  podeGravar,
  relogio,
  type Gravacao,
} from "@/lib/gravador";
import {
  IconeCadeado,
  IconeAmigas,
  IconeChama,
  IconeLoja,
  IconeTrofeu,
} from "@/components/icones-jogo";
import { fireConfetti, celebrateChime, celebrateHaptic, nivelDaSequencia } from "@/lib/celebrate";

/**
 * Comemora o bônus por VARIAR as atividades (a "sequência" da semana): confete
 * + som + vibração. Só dispara quando o bônus foi de fato concedido. O reward
 * já é gated por Modo Cuidado no servidor e no gate `canEarn`.
 */
/* ── Os momentos do dia: 5 × 1⭐ ──────────────────────────────────────────
   Os 4 jogos de bem-estar + a aula da professora. Cada um vale UMA estrela.

   Eram seis valendo meia (a respiração era o sexto). Ela virou tema da
   meditação, e com cinco não há mais motivo para metades — ver `StarMeter`. */
const TOTAL_DO_DIA = 5;
const WELLNESS_DAY_KEYS = ["w_movement", "w_meditation", "w_bonding", "w_gratitude"] as const;

function momentosDoDia(s: Record<string, boolean>): number {
  return WELLNESS_DAY_KEYS.filter((k) => s[k]).length + (s.desafio ? 1 : 0);
}

/**
 * O PLACAR DO DIA NA TRILHA — cinco estrelas, uma por momento.
 *
 * ─── ERAM TRÊS ESTRELAS EM METADES, E ISSO ACABOU (ago/2026) ────────────────
 *
 * A conta antiga era 6 momentos × meia estrela = 3 estrelas. Ela existia só
 * para fazer seis coisas caberem em três desenhos, e cobrava caro por isso: a
 * MESMA jornada era contada em duas denominações — a trilha dizia "1½ de 3" e
 * a folha do dia dizia "3 de 6" —, e meia estrela é um estado que ninguém
 * consegue ler de relance.
 *
 * Com a respiração absorvida pela meditação sobraram cinco momentos, e cinco é
 * um número que não pede metade nenhuma. Uma estrela por momento, inteira.
 *
 * Desenha com o MESMO `EstrelaDoDia` do painel da folha do dia. Antes eram
 * dois renderizadores diferentes (emoji com recorte aqui, SVG lá) para a mesma
 * ideia — e o emoji não tem versão vazia, então a estrela apagada saía cinza
 * suja em vez do contorno leve.
 */
function StarMeter({ feitos, px = 15 }: { feitos: number; px?: number }) {
  /* Sem animação aqui: este placar aparece no NÓ DA TRILHA, e a conquista
     acontece com a folha do dia aberta por cima. As duas comemorações moram
     lá dentro — ver `WellnessScreen`. */
  return (
    <span
      className="inline-flex items-center gap-0.5 leading-none"
      role="img"
      aria-label={`${feitos} de ${TOTAL_DO_DIA} estrelas`}
    >
      {Array.from({ length: TOTAL_DO_DIA }, (_, i) => (
        <EstrelaDoDia key={i} acesa={i < feitos} tamanho={px} />
      ))}
    </span>
  );
}

/**
 * UMA ESTRELA DO PLACAR DO DIA — acesa ou apagada.
 *
 * SVG e não o emoji ⭐. O emoji não tem versão VAZIA: para apagá-lo só resta
 * `grayscale` + `opacity`, e o que sai é uma estrela cinza suja em vez do
 * contorno leve que o desenho pede. Com SVG as duas versões partem da MESMA
 * geometria — a apagada é a acesa sem recheio —, então elas se alinham
 * perfeitamente na fileira, que é justamente o que se nota quando não está.
 */
function EstrelaDoDia({ acesa, tamanho = 34 }: { acesa: boolean; tamanho?: number }) {
  /* Ponta para cima e cinco braços iguais, calculados em vez de escritos à
     mão: um `path` decorado a olho fica com um braço mais curto, e numa
     fileira de seis o defeito se repete seis vezes. */
  const pontos = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? 48 : 19.5;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
  return (
    <svg
      viewBox="0 0 100 100"
      width={tamanho}
      height={tamanho}
      aria-hidden
      className="shrink-0"
      style={acesa ? { filter: "drop-shadow(0 2px 4px rgba(214,158,46,0.45))" } : undefined}
    >
      <polygon
        points={pontos}
        fill={acesa ? "url(#dc-estrela-ouro)" : "rgba(255,255,255,0.5)"}
        stroke={acesa ? "#e0a92b" : "rgba(120,90,120,0.28)"}
        strokeWidth={acesa ? 3 : 3.5}
        strokeLinejoin="round"
      />
      {acesa && (
        <defs>
          {/* Claro em cima e âmbar embaixo: estrela chapada lê como adesivo. */}
          <linearGradient id="dc-estrela-ouro" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffe08a" />
            <stop offset="52%" stopColor="#fdc32f" />
            <stop offset="100%" stopColor="#f0a51c" />
          </linearGradient>
        </defs>
      )}
    </svg>
  );
}

/**
 * O AVISO DE QUE ALGUÉM TE DEU SEMENTINHAS.
 *
 * ─── POR QUE ISTO É UMA TELA, E NÃO UM TOAST ────────────────────────────────
 *
 * O presente do médico era invisível: o servidor gravava, o saldo dela subia e
 * NADA dizia de onde tinha vindo. Um toast de três segundos consertaria o
 * "chegou" e perderia a parte que importa — que foi **ele** quem mandou. O
 * desenho inteiro da mesada (ele dá, ela vê que foi ele, ela volta) mora nesse
 * nome, e nome que passa em três segundos ninguém lê.
 *
 * ─── O NOME É O TÍTULO, E O NÚMERO VEM DEPOIS ───────────────────────────────
 *
 * "100 Sementinhas" com o remetente em letrinha embaixo transformaria um gesto
 * em um crédito bancário. Aqui a ordem é a do gesto: quem, o que, e só então
 * para que serve.
 *
 * ─── SEM REMETENTE AINDA É UM PRESENTE ──────────────────────────────────────
 *
 * `nome` volta `null` quando o vínculo foi encerrado depois do envio. Aí o
 * título cai para "do seu médico" — nunca um espaço em branco e nunca um
 * genérico "alguém", que numa tela de gestante lê como erro.
 */
function AvisoDePresente({
  presente,
  careMode,
  onFechar,
  onIrAoCantinho,
}: {
  presente: PresenteRecebido;
  /**
   * Sim, DE NOVO — e o servidor já filtrou.
   *
   * `presenteRecente` devolve `null` em Modo Cuidado, então esta tela não
   * deveria nem existir no luto. Mas o portão do mascote é o do componente
   * (`bolha.tsx` rebaixa a arte de comemorar e engole o pulo), e confiar no
   * chamador já falhou uma vez nesta base. Passar aqui custa uma prop e cobre
   * o dia em que alguém chamar isto de outro lugar.
   */
  careMode: boolean;
  onFechar: () => void;
  /** Sem loja aberta (bancada, telas antigas) o botão simplesmente não aparece. */
  onIrAoCantinho?: () => void;
}) {
  /* A festa acontece uma vez, na montagem. `fireConfetti` e `celebrateChime`
     já respeitam `prefers-reduced-motion` e a ausência de áudio — repetir a
     checagem aqui seria uma segunda régua para divergir da primeira. */
  useEffect(() => {
    if (careMode) return;
    fireConfetti();
    celebrateChime(2);
    celebrateHaptic(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* O nome vem PRONTO do servidor ("Dr. Clóvis", "Ana") — `nome-do-medico.ts`
     já resolveu título e primeiro nome lá. Montar `Dr(a). ${nome}` aqui era o
     defeito: o `display_name` do cadastro já traz o título, e a primeira foto
     desta tela saiu com "Dr(a). Dr. Clóvis Bacha". */
  const deQuem = presente.nome ?? (presente.de === "medico" ? "O seu médico" : "Uma amiga");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Você ganhou um presente"
      className="fixed inset-0 z-[70] flex items-center justify-center p-5"
      style={{ background: "rgba(38,20,40,0.44)", backdropFilter: "blur(3px)" }}
      onClick={onFechar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[340px] rounded-[28px] bg-white p-6 text-center shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
      >
        <div className="mx-auto w-fit">
          <Bolha tamanho={132} humor="comemorando" careMode={careMode} />
        </div>

        <p className="mt-2 font-serif text-[22px] leading-tight text-slate-800">
          {deQuem} te mandou um presente
        </p>

        <p className="mt-3 flex items-center justify-center gap-1.5">
          <span className="text-[34px] leading-none">🌱</span>
          <span className="text-[40px] font-black leading-none text-emerald-500">
            {presente.quantidade}
          </span>
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Sementinhas já estão no seu saldo — são suas para gastar no Cantinho.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {onIrAoCantinho && (
            <button
              onClick={onIrAoCantinho}
              className="press w-full rounded-full bg-emerald-500 py-3 text-sm font-bold text-white"
            >
              Ver o Cantinho
            </button>
          )}
          <button
            onClick={onFechar}
            className="w-full rounded-full py-2.5 text-sm font-semibold text-slate-500"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}

/** Hash estável de string → número (posiciona decorações de forma determinística). */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/* ── Decoração do Caminho (modo "Arrumar") ────────────────────────────────
   A paciente decora a PRÓPRIA trilha do jogo: escolhe onde cada item comprado
   fica e de que tamanho. O mesmo item pode ser colocado várias vezes.
   `x` = % da largura da trilha (responsivo), `y` = px ao longo dela,
   `s` = escala (1 ≈ 2rem). Salvo no aparelho, por usuária. */
export type PlacedDecor = { k: string; id: string; x: number; y: number; s: number };

// Teto de enfeites na trilha. Cada um é um <span> com uma animação CSS de
// transform/opacity (roda na GPU, não repinta layout) e ~60 bytes no blob
// salvo — 120 cabe folgado em celular antigo sem engasgar o scroll.
const DECOR_MAX = 120;
const DECOR_MIN_SCALE = 0.5;
const DECOR_MAX_SCALE = 4.5;

function clampN(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

/* A decoração da trilha é da PACIENTE, não do aparelho: usa o prefixo
   `dc-path-`, então entra no blob de `journey_state` e volta igualzinha em
   qualquer celular/navegador onde ela entrar (mesma sincronização da jornada). */
const DECOR_KEY = "dc-path-decor";

type DecorSave = { v: 1; items: PlacedDecor[]; seen: string[] };

function loadDecor(): DecorSave | null {
  try {
    const p = lsGet<Partial<DecorSave> | null>(DECOR_KEY, null);
    if (!p || !Array.isArray(p.items)) return null;
    const items = p.items
      .filter((it) => it && typeof it.id === "string" && CANTINHO_BY_ID[it.id])
      .map((it, i) => ({
        k: typeof it.k === "string" && it.k ? it.k : `p${i}`,
        id: it.id,
        x: clampN(Number(it.x) || 50, 3, 97),
        y: Math.max(0, Number(it.y) || 0),
        s: clampN(Number(it.s) || 1, DECOR_MIN_SCALE, DECOR_MAX_SCALE),
      }))
      .slice(0, DECOR_MAX);
    const seen = Array.isArray(p.seen) ? p.seen.filter((s) => typeof s === "string") : [];
    return { v: 1, items, seen };
  } catch {
    return null; // layout corrompido: volta pro automático
  }
}

function saveDecor(items: PlacedDecor[], seen: string[]) {
  // lsSet agenda o push pra nuvem — o layout viaja com a paciente.
  lsSet(DECOR_KEY, { v: 1, items, seen } as DecorSave);
}

/** Espalha itens novos pela trilha (ponto de partida; a paciente arruma depois). */
function seedDecor(ids: string[], height: number, offset: number): PlacedDecor[] {
  const out: PlacedDecor[] = [];
  const span = Math.max(240, height - 260);
  ids.forEach((id, i) => {
    const item = CANTINHO_BY_ID[id];
    if (!item) return;
    const h = hashStr(id);
    const idx = offset + i;
    const especial = item.type === "especial";
    const copies = especial ? 1 : 2;
    for (let e = 0; e < copies; e++) {
      /* Céu mora no ALTO, e por isso não usa o `span` da trilha inteira: uma
         nuvem no meio do caminho, entre uma suculenta e um cestinho, não lê
         como céu — lê como enfeite fora do lugar. A faixa vai de 40 a ~240px,
         acima do primeiro nó, e as duas cópias se afastam uma da outra. */
      const y =
        item.type === "ceu"
          ? 40 + (((h % 90) + e * 110 + idx * 37) % 200)
          : 130 + (((h % 400) + e * 880 + idx * 270) % span);
      const side = (e + idx) % 2;
      // `>>>` (não `>>`): hash acima de 2^31 vira NEGATIVO no shift com sinal e
      // o resto sai negativo — item nascia fora da tela ou em cima das lições.
      const jitter = (h >>> (e + 2)) % 10;
      /* Os de chão vivem nas calhas (8–18 e 82–92) porque o meio é da trilha.
         Acima do primeiro nó não há trilha nenhuma, então o céu pode usar a
         largura toda — e precisa, senão sol, lua e arco-íris se empilham nas
         duas beiradas. */
      const x =
        item.type === "ceu" ? 12 + ((h >>> (e + 5)) % 76) : side === 0 ? 8 + jitter : 82 + jitter;
      out.push({
        k: `s${idx}-${e}-${id}`,
        id,
        x,
        y,
        s: especial ? 1.6 : item.type === "planta" ? 1.25 : 1,
      });
    }
  });
  return out;
}

/** Um item decorando a trilha. Fora do modo Arrumar, só enfeita (sem cliques). */
function DecorSprite({ p, still = false }: { p: PlacedDecor; still?: boolean }) {
  const item = CANTINHO_BY_ID[p.id];
  if (!item) return null;
  const h = hashStr(p.k);
  const delay = `${(h % 24) * 0.22}s`;
  const especial = item.type === "especial";
  const anim =
    item.type === "bicho"
      ? "dcWander 7s ease-in-out infinite"
      : item.type === "planta"
        ? "dcSway 5.5s ease-in-out infinite"
        : item.type === "luz"
          ? "dcTwinkle 5.3s ease-in-out infinite"
          : item.type === "agua"
            ? "dcRipple 4.7s ease-in-out infinite"
            : "dcHover 4s ease-in-out infinite";
  return (
    <>
      {especial && (
        <span
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: `${p.s * 3.4}rem`,
            height: `${p.s * 3.4}rem`,
            background: "radial-gradient(circle, rgba(255,214,120,0.55), transparent 70%)",
            animation: still ? undefined : "dcGlow 3.6s ease-in-out infinite",
            animationDelay: delay,
          }}
          aria-hidden
        />
      )}
      <span
        className="relative inline-block leading-none"
        style={{
          fontSize: `${(p.s * 2).toFixed(2)}rem`,
          animation: still ? undefined : anim,
          animationDelay: delay,
          transformOrigin: item.type === "planta" ? "50% 90%" : "50% 50%",
        }}
      >
        {item.emoji}
      </span>
    </>
  );
}
import {
  quizForDay,
  quizEmojiForDay,
  isAnswerCorrect,
  isMultiQuestion,
  type DailyQuiz,
} from "@/lib/daily-quizzes";
import { gestChallenge, posChallenge } from "@/lib/daily-challenges";
import { DOCTOR } from "@/lib/doctor.config";
import { Bolha, ESCALA_RESPIRO, humorDaJornada } from "@/components/bolha";
import { SpriteDoJogo } from "@/components/sprites-do-jogo";
import { ChamaDaSequencia } from "@/components/chama-sequencia";
import { deslocamentoDaLinha } from "@/lib/alinhar-na-linha";
import { rotuloDeAmigas } from "@/lib/amigas";
import { TrofeuConquistado, TrofeuIcone } from "@/components/trofeu";
import {
  diasComAlgumMomento,
  sequenciaAcesa,
  sequenciaDeDatas,
  sequenciaDeDias,
} from "@/lib/sequencia";
import { faixaDaHora, recadoDaBolha } from "@/lib/recado-da-bolha";
/* Arte própria desta tela, feita a partir do desenho de referência. Ela mora
   em `assets/jogo` e não em `assets/sky` porque não é um céu do relógio: é o
   cenário fixo da tela de atividades. */
import jogoBolha from "@/assets/jogo/bolha.webp";
import { ehNativo, tocarPadrao } from "@/lib/nativo";
import { podeComprarAqui } from "@/lib/canal-de-venda";
import { brl as brlPromo } from "@/lib/promo";
import { BONUS_VINCULO_MEDICO } from "@/lib/economia-sementinhas";
import type { PrecosDaPaciente } from "@/lib/promo.functions";
import { manterTelaAcesa } from "@/lib/tela-acesa";
import { anunciarMidia, estadoDaMidia } from "@/lib/media-session";
import { estaEscondida, podeRetomar } from "@/lib/pausa-da-sessao";
import { fusoDoNavegador, horaLocal, paraGuardar } from "@/lib/lembrete-de-meditacao";
import { subscribeToPush } from "@/lib/push";
import { SonsParaDormir } from "@/components/sons-para-dormir";
import { SessaoDoCasal } from "@/components/sessao-do-casal";

type Gest = { weeks: number; days: number; totalDays: number } | null;

interface GestacaoPathProps {
  profile: { baby_name: string | null } | null;
  gest: Gest;
  /** Premium do quiz: revisão de qualquer aula liberada (grátis = só a de hoje). */
  quizPremium?: boolean;
  /** Modo Cuidado: silencia confete, comemorações, streak e a tela de nascimento. */
  careMode?: boolean;
  /** Abre o Cantinho (lojinha das Sementinhas). */
  onOpenShop?: () => void;
  /** Abre a aba das Amigas — o ícone que substituiu o calendário na fita. */
  onOpenAmigas?: () => void;
  /**
   * SÓ a bancada de design `/preview-jogo` usa.
   *
   * Um objeto e não três props soltas: assim fica óbvio no chamador que isto
   * é andaime de conferência, e o dia em que sair, sai inteiro. `jogos` abre
   * as atividades do dia (que na conta real só se alcança tocando num nó da
   * trilha) e os outros dois fingem um estado com progresso, porque a tela
   * vazia esconde justamente o anel e o ✓ das linhas.
   */
  bancada?: {
    jogos?: boolean;
    saldo?: number;
    halves?: number;
    enfeites?: string[];
    /**
     * Liga UMA das três animações de conquista já na abertura da tela.
     *
     * Elas só nascem de `handleEarn` — o instante em que uma atividade acaba de
     * ser feita —, então conferir o desenho exigia fazer a atividade de verdade,
     * numa conta de verdade, e ainda acertar os dois segundos em que a
     * animação existe. É como uma animação entra no app sem ninguém nunca ter
     * olhado para ela rodando; a chama e o troféu já custaram essa lição.
     */
    anim?: "check" | "estrela" | "cinco";
    /**
     * O aviso do presente, sem conta e sem ledger.
     *
     * Ele só nasce de uma linha real de `sementinhas_ledger`, então conferir o
     * desenho exigiria um médico logado presenteando uma paciente logada — e
     * foi justamente por ninguém conseguir olhar essa tela que ela passou tanto
     * tempo não existindo.
     */
    presente?: PresenteRecebido;
    /**
     * Finge a sequência de dias, para fotografar a chama ACESA.
     *
     * Ela só arde quando há dias fechados de verdade, então conferir o desenho
     * exigiria uma conta com semanas de uso — e é assim que uma animação entra
     * no app sem ninguém nunca ter olhado para ela rodando.
     */
    streak?: number;
    /** Finge o contador de troféus. */
    trofeus?: number;
    /** Finge o contador de amigas — inclusive acima de 99, para ver o `99+`. */
    amigas?: number;
    /** Abre a comemoração do troféu direto, para fotografar os 5 segundos. */
    trofeuNovo?: number;
  };
}

/* ══════════════════════════ FASES (7 semanas cada) ══════════════════════════ */

const PHASES = [
  { n: 1, from: 1, to: 7, emoji: "🌱", name: "Primeiros passos" },
  { n: 2, from: 8, to: 14, emoji: "💗", name: "Coração e forma" },
  { n: 3, from: 15, to: 21, emoji: "🦋", name: "Primeiros chutes" },
  { n: 4, from: 22, to: 28, emoji: "🌈", name: "Crescendo forte" },
  { n: 5, from: 29, to: 35, emoji: "🌙", name: "Reta final" },
  { n: 6, from: 36, to: 40, emoji: "🎉", name: "Chegada" },
];

/** Fase bônus pós-data: só existe para quem passa da semana 40 sem o bebê nascer. */
const BONUS_PHASE = { n: 7, from: 41, to: 42, emoji: "⏳", name: "Bônus: quase lá" };

/** Fases do 4º trimestre (após o nascimento). */
const PHASES_POS = [
  { n: 1, from: 1, to: 4, emoji: "🍼", name: "Chegando em casa" },
  { n: 2, from: 5, to: 8, emoji: "🌙", name: "Criando ritmo" },
  { n: 3, from: 9, to: 12, emoji: "🧸", name: "Descobertas" },
];

type Phase = (typeof PHASES)[number];

function phaseOfWeek(phases: Phase[], week: number) {
  return phases.find((p) => week >= p.from && week <= p.to) ?? phases[phases.length - 1];
}

const MILESTONES: Record<number, { emoji: string; label: string }> = {
  4: { emoji: "🌱", label: "Início da jornada" },
  8: { emoji: "💗", label: "Coração batendo" },
  12: { emoji: "✨", label: "Translucência nucal" },
  16: { emoji: "🫐", label: "Sente a luz" },
  20: { emoji: "🎶", label: "Ultrassom morfológico" },
  24: { emoji: "🏥", label: "Viabilidade fetal" },
  28: { emoji: "💜", label: "3º Trimestre!" },
  32: { emoji: "🌟", label: "Scan de crescimento" },
  36: { emoji: "🏠", label: "Quase em casa" },
  40: { emoji: "🎊", label: "Data prevista do parto!" },
  41: { emoji: "⏳", label: "Pós-data — monitoramento próximo" },
  42: { emoji: "🏥", label: "Avaliação para indução" },
};

/** Figurinhas do 4º trimestre (semanas de vida do bebê). */
const POS_EMOJI: Record<number, string> = {
  1: "🤱",
  2: "🍼",
  3: "👶",
  4: "💜",
  5: "🌙",
  6: "😊",
  7: "🎈",
  8: "🧸",
  9: "🪁",
  10: "🌷",
  11: "🎵",
  12: "🎓",
};

/* ══════════════════════ DESAFIOS DIÁRIOS ══════════════════════ */

type Challenge = { id: string; label: string; emoji: string };

const CHALLENGES_T1: Challenge[] = [
  { id: "agua", label: "Beber 8 copos de água hoje", emoji: "💧" },
  { id: "folico", label: "Tomar o ácido fólico", emoji: "💊" },
  { id: "descanso", label: "Tirar 20 minutos só para descansar", emoji: "😴" },
  { id: "fruta", label: "Comer uma fruta rica em vitamina C", emoji: "🍊" },
  { id: "caminhada", label: "Caminhar 15 minutos em ritmo leve", emoji: "🚶‍♀️" },
  { id: "diario", label: "Escrever uma linha no seu Diário", emoji: "📖" },
  { id: "respiracao", label: "Fazer a respiração guiada (Meditações)", emoji: "🧘‍♀️" },
];

const CHALLENGES_T2: Challenge[] = [
  { id: "agua", label: "Beber 8 copos de água hoje", emoji: "💧" },
  { id: "conversa", label: "Conversar com o bebê por 2 minutos", emoji: "💬" },
  { id: "barriga", label: "Tirar uma foto da barriga para o Álbum", emoji: "📸" },
  { id: "caminhada", label: "Caminhar 20 minutos", emoji: "🚶‍♀️" },
  { id: "musica", label: "Colocar uma música para o bebê ouvir", emoji: "🎶" },
  { id: "peso", label: "Registrar seu peso na aba Saúde", emoji: "⚖️" },
  { id: "diario", label: "Escrever uma linha no seu Diário", emoji: "📖" },
  { id: "respiracao", label: "Fazer a respiração guiada (Meditações)", emoji: "🧘‍♀️" },
];

const CHALLENGES_T3: Challenge[] = [
  { id: "chutes", label: "Contar os chutes do bebê (aba Chutes)", emoji: "🦶" },
  { id: "agua", label: "Beber 8 copos de água hoje", emoji: "💧" },
  { id: "mala", label: "Separar 1 item da mala da maternidade", emoji: "🧳" },
  { id: "caminhada", label: "Caminhar 20 minutos em ritmo leve", emoji: "🚶‍♀️" },
  { id: "conversa", label: "Conversar com o bebê — ele já ouve você", emoji: "💬" },
  { id: "peso", label: "Registrar seu peso na aba Saúde", emoji: "⚖️" },
  { id: "respiracao", label: "Treinar a respiração para o parto", emoji: "🧘‍♀️" },
  { id: "nomes", label: "Adicionar um nome à votação da família", emoji: "✨" },
];

/** Pós-data (41–42s): desafios com relevância clínica direta. */
const CHALLENGES_POSDATA: Challenge[] = [
  { id: "movimentos", label: "Contar os movimentos do bebê (aba Chutes)", emoji: "🦶" },
  { id: "contracoes", label: "Monitorar contrações na aba Contrações", emoji: "⏱️" },
  { id: "caminhada", label: "Caminhar 20 minutos em ritmo leve", emoji: "🚶‍♀️" },
  { id: "agua", label: "Beber 8 copos de água hoje", emoji: "💧" },
  { id: "descanso", label: "Descansar — guarde energia para o grande dia", emoji: "😴" },
  { id: "sinais", label: "Revisar os sinais de alerta (aba Alertas)", emoji: "🚨" },
];

/** 4º trimestre por fase. */
const CHALLENGES_POS_1: Challenge[] = [
  { id: "amamentar", label: "Registrar uma mamada (aba Pós-parto)", emoji: "🤱" },
  { id: "agua", label: "Beber água a cada mamada", emoji: "💧" },
  { id: "dormir", label: "Dormir quando o bebê dormir", emoji: "😴" },
  { id: "foto", label: "Tirar uma foto do bebê para o Álbum", emoji: "📸" },
  { id: "emocional", label: "Fazer o check-in emocional (aba Pós-parto)", emoji: "💜" },
  { id: "diario", label: "Escrever uma memória no Diário", emoji: "📖" },
];

const CHALLENGES_POS_2: Challenge[] = [
  { id: "vacinas", label: "Conferir as vacinas do bebê (aba Pós-parto)", emoji: "💉" },
  { id: "marco", label: "Registrar um marco do bebê (aba Pós-parto)", emoji: "👶" },
  { id: "musica", label: "Cantar ou conversar com o bebê", emoji: "🎶" },
  { id: "caminhada", label: "Caminhar 15 minutos com o bebê", emoji: "🚶‍♀️" },
  { id: "emocional", label: "Fazer o check-in emocional (aba Pós-parto)", emoji: "💜" },
  { id: "pesobebe", label: "Registrar o peso do bebê (aba Pós-parto)", emoji: "⚖️" },
];

const CHALLENGES_POS_3: Challenge[] = [
  { id: "brucos", label: "Brincar de bruços com o bebê (tummy time)", emoji: "🧸" },
  { id: "marco", label: "Registrar um marco do bebê (aba Pós-parto)", emoji: "👶" },
  { id: "autocuidado", label: "20 minutos só para você", emoji: "💅" },
  { id: "caminhada", label: "Caminhar 20 minutos com o bebê", emoji: "🚶‍♀️" },
  { id: "vacinas", label: "Conferir as vacinas do bebê (aba Pós-parto)", emoji: "💉" },
  { id: "diario", label: "Escrever uma memória no Diário", emoji: "📖" },
];

/** Desafio do dia gestacional D — texto próprio do dia (D 7..300). */
function challengeForDay(D: number): Challenge {
  const custom = gestChallenge(D);
  if (custom) return custom;
  // Fora da faixa escrita (DUM corrigida, jornada além de 42s): rede de segurança.
  const week = Math.floor(D / 7);
  const pool =
    week >= 41
      ? CHALLENGES_POSDATA
      : week <= 13
        ? CHALLENGES_T1
        : week <= 27
          ? CHALLENGES_T2
          : CHALLENGES_T3;
  return pool[Math.abs(D) % pool.length];
}

/** Desafio do dia pós-parto (D em pseudo-dias = idade do bebê + 7, 7..90). */
function challengeForPosDay(D: number): Challenge {
  const custom = posChallenge(D);
  if (custom) return custom;
  const week = Math.floor(D / 7);
  const pool = week <= 4 ? CHALLENGES_POS_1 : week <= 8 ? CHALLENGES_POS_2 : CHALLENGES_POS_3;
  return pool[Math.abs(D) % pool.length];
}

/* ══════════════════════ ORIENTAÇÕES MÉDICAS ══════════════════════ */

const POS_GUIDANCE: Record<number, string> = {
  1: "Descanso e amamentação em livre demanda. Teste do pezinho entre o 3º e o 5º dia. Agende a revisão pós-parto (7–10 dias).",
  2: "Atenção aos sinais de alerta: febre, sangramento intenso, dor forte ou tristeza persistente. Se a amamentação doer, procure ajuda com a pega.",
  3: "Baby blues costuma passar até aqui. Se a tristeza persistir ou piorar, faça o check-in emocional e fale com o seu médico — você não está sozinha.",
  4: "Agende a consulta puerperal completa (30–40 dias): revisão geral, contracepção e liberação de atividades.",
  5: "As vacinas de 2 meses do bebê estão chegando — deixe agendadas (penta, VIP, pneumo 10, rotavírus).",
  6: "Consulta puerperal em dia? É nela que se libera exercício físico e se define contracepção. Cuide também do seu sono.",
  7: "Crie pequenos rituais de rotina para o bebê: banho, mamada, soneca. A previsibilidade acalma vocês dois.",
  8: "Semana das vacinas de 2 meses. Febre baixa e irritação no dia seguinte podem acontecer — mantenha o bebê hidratado.",
  9: "Se liberada na consulta puerperal, retome exercícios leves de forma gradual. Assoalho pélvico primeiro.",
  10: "Autocuidado não é luxo: reserve um tempo seu por dia. Mãe cuidada cuida melhor.",
  11: "Marcos esperados: sorriso social e mais firmeza no pescoço. Cada bebê tem seu ritmo — registre os do seu.",
  12: "Fim do 4º trimestre! Vacina de meningo C aos 3 meses. Parabéns por chegar até aqui — jornada completa. 🎓",
};

const MOODS = [
  { emoji: "😄", label: "Ótima" },
  { emoji: "🙂", label: "Bem" },
  { emoji: "😐", label: "Normal" },
  { emoji: "😔", label: "Cansada" },
  { emoji: "🤢", label: "Enjoada" },
];

/* ══════════════════════ Persistência local (v1) ══════════════════════ */

const LS = {
  stickers: "dc-path-stickers",
  posStickers: "dc-path-pos-stickers",
  checkin: "dc-path-checkin",
  journeyStart: "dc-path-journey-start",
  doneDays: "dc-path-done-days",
  posDoneDays: "dc-path-pos-done-days",
  dayTasks: (d: number) => `dc-path-day-${d}`,
  posDayTasks: (d: number) => `dc-path-pos-day-${d}`,
  lessons: "dc-path-lessons",
  welcomed: "dc-path-welcomed",
  birth: "dc-path-birth",
  celebrated: "dc-path-birth-celebrated",
};

/**
 * A chave do "já vi este presente".
 *
 * Carrega o prefixo `dc-path-` de propósito: assim ela entra no blob do
 * `journey_state` e viaja com a jornada. Sem isso, quem abre o app no celular e
 * depois no computador receberia o mesmo anúncio duas vezes — e um presente
 * anunciado duas vezes faz duvidar se chegaram dois.
 */
function chaveDoPresente(quando: string): string {
  return `dc-path-presente-visto-${quando}`;
}

/* Os dois prefixos que `diasComAlgumMomento` varre. Saem de `LS.dayTasks(0)`
   e `LS.posDayTasks(0)` em vez de escritos à mão: são a MESMA chave que a
   gravação usa, e uma cópia divergente faria a chama nunca acender sem erro
   nenhum aparecer. */
const DIA_KEY = LS.dayTasks(0).slice(0, -1);
const POS_DIA_KEY = LS.posDayTasks(0).slice(0, -1);

/** As chaves do armazém, para a varredura da sequência. */
function entradasDoArmazem(): [string, string | null][] {
  if (typeof window === "undefined") return [];
  const fora: [string, string | null][] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) fora.push([k, localStorage.getItem(k)]);
    }
  } catch {
    /* modo privado com armazenamento bloqueado: sem sequência, e a tela de pé */
  }
  return fora;
}

export function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
let warnedStorageBlocked = false;

export function lsSet(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Modo privado/cota cheia: o progresso local não está sendo salvo.
    // Avisa UMA vez em vez de falhar em silêncio.
    if (!warnedStorageBlocked) {
      warnedStorageBlocked = true;
      toast.error(
        "Seu navegador está bloqueando o salvamento local — o progresso do dia pode se perder. Evite o modo anônimo.",
      );
    }
  }
  // A jornada pertence ao PERFIL da paciente, não ao aparelho: cada escrita
  // agenda uma sincronização do estado completo para journey_state no Supabase
  // (o localStorage vira cache offline). Debounce para agrupar toques rápidos.
  scheduleJourneySync();
}

/* ── Sincronização da jornada com o perfil (journey_state) ─────────────────── */

const JOURNEY_PREFIX = "dc-path-";
const SYNC_MARKER = "dc-journey-synced-at"; // fora do prefixo: não entra no blob

function collectJourneyBlob(): Record<string, unknown> {
  const blob: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(JOURNEY_PREFIX)) continue;
    try {
      blob[k] = JSON.parse(localStorage.getItem(k) ?? "null");
    } catch {
      /* valor corrompido: fica de fora */
    }
  }
  return blob;
}

let journeySyncTimer: ReturnType<typeof setTimeout> | null = null;

// Barreira anti-corrida: NENHUM push acontece antes de o pull inicial do
// perfil terminar — senão um toque rápido num aparelho novo empurraria o
// blob zerado por cima da jornada real na nuvem (e o marcador bloquearia a
// hidratação em seguida). Armada por ensureInitialJourneyPull; até lá, um push
// espera de graça em Promise.resolve().
let initialPullGate: Promise<unknown> = Promise.resolve();
let gatePrimed = false;

// Dispara o pull inicial da nuvem UMA vez por sessão e arma a barreira acima.
// Precisa rodar antes do PRIMEIRO push — venha ele da aba Caminho (que monta
// GestacaoPath) ou de abas irmãs (Sons/Quartinho) que também gravam chaves
// dc-path- via lsSet sem passar pela Caminho. Num aparelho onde a jornada só
// existe na nuvem, sem esse pull o push empurraria um blob incompleto por cima
// da jornada real e o marcador ainda bloquearia a re-hidratação (P1).
export function ensureInitialJourneyPull(): Promise<boolean> {
  if (gatePrimed) return initialPullGate as Promise<boolean>;
  gatePrimed = true;
  const pullPromise = pullJourneyFromProfile();
  initialPullGate = pullPromise.catch(() => false);
  return pullPromise;
}

function scheduleJourneySync() {
  if (typeof window === "undefined") return;
  // Arma o pull inicial/barreira já na primeira escrita, qualquer que seja a
  // aba — impede que Sons/Quartinho empurrem antes do pull inicial (P1).
  ensureInitialJourneyPull();
  if (journeySyncTimer) clearTimeout(journeySyncTimer);
  journeySyncTimer = setTimeout(async () => {
    try {
      await initialPullGate; // espera o pull do mount (instantâneo se já resolvido)
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      // LWW de blob INTEIRO: dois aparelhos online no mesmo dia → o push mais
      // tardio vence por completo (perda granular aceita pelo produto).
      // updated_at é do SERVIDOR (trigger touch_journey_updated_at) para o
      // relógio do aparelho não distorcer o last-write-wins.
      const { data: row, error } = await (supabase as any)
        .from("journey_state")
        .upsert({ user_id: u.user.id, data: collectJourneyBlob() })
        .select("updated_at")
        .maybeSingle();
      if (!error && row?.updated_at) {
        localStorage.setItem(SYNC_MARKER, JSON.stringify(row.updated_at));
      }
    } catch {
      /* offline / tabela ainda não aplicada: o localStorage segue como fonte */
    }
  }, 1500);
}

/* ── Merge granular na hidratação (evita reverter progresso não sincronizado) ──
 *
 * O blob inteiro é last-write-wins, mas os dados de PROGRESSO só crescem: dias
 * feitos, figurinhas, notas de lição e os checks de cada dia nunca "desfazem".
 * Se o aparelho fez um desafio offline e a nuvem (de outro aparelho) ficou mais
 * recente, um overwrite cego apagaria esse desafio. Por isso, no pull, esses
 * campos são UNIDOS (local ∪ nuvem); só o estado de fato mutável (nascimento,
 * início da jornada, check-in do dia) segue LWW com a nuvem vencendo. */

const UNION_ARRAY_KEYS = new Set([
  "dc-path-done-days",
  "dc-path-pos-done-days",
  "dc-path-stickers",
  "dc-path-pos-stickers",
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Combina o valor local com o da nuvem para uma chave da jornada. */
export function mergeJourneyValue(key: string, local: unknown, cloud: unknown): unknown {
  // Arrays append-only (dias feitos, figurinhas) → união ordenada.
  if (UNION_ARRAY_KEYS.has(key)) {
    if (Array.isArray(local) && Array.isArray(cloud)) {
      return Array.from(new Set([...local, ...cloud])).sort((a, b) => a - b);
    }
    return cloud;
  }
  // Notas das lições (semana → nota 0–100) → maior nota vence.
  if (key === "dc-path-lessons") {
    if (isPlainObject(local) && isPlainObject(cloud)) {
      const out: Record<string, unknown> = { ...cloud };
      for (const [w, v] of Object.entries(local)) {
        const cur = out[w];
        if (typeof v === "number" && (typeof cur !== "number" || v > cur)) out[w] = v;
      }
      return out;
    }
    return cloud;
  }
  // Tarefas de cada dia (humor/desafio/leitura) → OR: uma vez feito, feito.
  if (/^dc-path-(pos-)?day-\d+$/.test(key)) {
    if (isPlainObject(local) && isPlainObject(cloud)) {
      const out: Record<string, unknown> = { ...cloud };
      for (const [t, v] of Object.entries(local)) if (v) out[t] = true;
      return out;
    }
    return cloud;
  }
  // Demais chaves (nascimento, início, check-in, welcomed, premium-pending):
  // mutáveis → a nuvem (mais recente) vence, como antes.
  return cloud;
}

/**
 * Baixa a jornada do perfil e hidrata o localStorage quando a nuvem estiver
 * mais recente que a última sincronização deste aparelho. Faz merge granular
 * (união do progresso; LWW no estado mutável) e tenta de novo se a rede falhar
 * — num aparelho novo, o game não pode ficar "zerado" por uma falha de rede.
 * Retorna true quando hidratou/mesclou algo (o chamador re-lê os estados).
 */
async function pullJourneyFromProfile(retries = 2): Promise<boolean> {
  if (typeof window === "undefined") return false;
  for (let attempt = 0; ; attempt++) {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data: row, error } = await (supabase as any)
        .from("journey_state")
        .select("data,updated_at")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (error) throw error; // rede/servidor: tenta de novo
      if (!row?.data) return false; // sem jornada na nuvem (não é erro)
      const localMark = lsGet<string>(SYNC_MARKER, "");
      if (localMark && localMark >= row.updated_at) return false; // já em dia
      const cloudData = row.data as Record<string, unknown>;
      const keys = new Set<string>();
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(JOURNEY_PREFIX)) keys.add(k);
      }
      for (const k of Object.keys(cloudData)) if (k.startsWith(JOURNEY_PREFIX)) keys.add(k);
      let localHadExtra = false; // o merge preservou algo que a nuvem não tinha?
      for (const k of keys) {
        const cloudHas = Object.prototype.hasOwnProperty.call(cloudData, k);
        if (!cloudHas) {
          localHadExtra = true; // chave só local: progresso não sincronizado
          continue; // já está no localStorage — preserva
        }
        const localRaw = localStorage.getItem(k);
        const localVal = localRaw != null ? safeParse(localRaw) : undefined;
        const merged = mergeJourneyValue(k, localVal, cloudData[k]);
        const mergedStr = JSON.stringify(merged);
        if (mergedStr !== JSON.stringify(cloudData[k])) localHadExtra = true;
        localStorage.setItem(k, mergedStr);
      }
      localStorage.setItem(SYNC_MARKER, JSON.stringify(row.updated_at));
      // Se o merge manteve dados ausentes na nuvem, empurra de volta para ela
      // convergir (senão o progresso ficaria só neste aparelho).
      if (localHadExtra) scheduleJourneySync();
      return true;
    } catch {
      if (attempt >= retries) return false;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Checkin = { last: string; streak: number; mood?: string };
type JourneyStart = { date: string; gestDay: number };
type Birth = { date: string };

/* ══════════════════════ Cores por trimestre/fase ══════════════════════ */

/**
 * Cor da SEMANA — cada uma tem a sua, não uma por trimestre.
 *
 * O matiz percorre a roda de cor ao longo das 42 semanas (rosé → violeta →
 * azul → verde → âmbar): semanas vizinhas ficam distinguíveis e a jornada
 * inteira lê como progressão. Luminosidade e croma são fixos, então nenhuma
 * semana fica mais berrante que outra — o que muda é só o matiz.
 *
 * `banner` e `softText` continuam por trimestre porque são classes utilitárias
 * do Tailwind (não dá para gerar classe dinâmica) e são usadas em faixas
 * grandes, onde a cor do trimestre é a leitura certa.
 */
const WEEK_HUE_START = 348; // rosé da marca
const WEEK_HUE_SWEEP = 300; // quanto a roda gira até a semana 42

function weekHue(week: number): number {
  const w = Math.max(1, Math.min(42, week));
  return (WEEK_HUE_START - ((w - 1) / 41) * WEEK_HUE_SWEEP + 360) % 360;
}

function trimMeta(week: number) {
  const h = weekHue(week);
  const main = `oklch(0.64 0.163 ${h.toFixed(1)})`;
  const lip = `oklch(0.47 0.142 ${h.toFixed(1)})`;
  if (week <= 13) return { main, lip, banner: "bg-pink-500", softText: "text-pink-400" };
  if (week <= 27) return { main, lip, banner: "bg-amber-500", softText: "text-amber-500" };
  if (week <= 40) return { main, lip, banner: "bg-violet-500", softText: "text-violet-400" };
  // Pós-data: tom âmbar quente, sem alarme
  return { main, lip, banner: "bg-amber-500", softText: "text-amber-500" };
}

function posMeta(week: number) {
  if (week <= 4)
    return { main: "#38bdf8", lip: "#0369a1", banner: "bg-sky-500", softText: "text-sky-400" };
  if (week <= 8)
    return {
      main: "#8b5cf6",
      lip: "#6d28d9",
      banner: "bg-violet-500",
      softText: "text-violet-400",
    };
  return {
    main: "#34d399",
    lip: "#047857",
    banner: "bg-emerald-500",
    softText: "text-emerald-500",
  };
}

// Lábios bem mais escuros que o corpo: a moeda 3D precisa ler como moeda mesmo cinza
const LOCKED = { main: "#dde5ee", lip: "#9fb0c4" };

/**
 * Os três estados de um dia usam a MESMA cor da semana, em intensidades
 * diferentes — é o que faz a trilha inteira mostrar a progressão de cores:
 *
 *   feito/hoje  cor cheia, viva
 *   futuro      pálida e arejada ("tem caminho pela frente")
 *   perdido     acinzentada ("passou")
 *
 * Antes o dia perdido era um rosa FIXO: quem tinha muitos dias sem jogar via a
 * trilha inteira rosa, sem nenhuma leitura de semana.
 */
function futureTint(meta: { main: string; lip: string }) {
  return {
    main: `color-mix(in oklab, ${meta.main} 20%, white)`,
    lip: `color-mix(in oklab, ${meta.lip} 28%, white)`,
  };
}

function missedTint(meta: { main: string; lip: string }) {
  return {
    main: `color-mix(in oklab, ${meta.main} 42%, #ded7dc)`,
    lip: `color-mix(in oklab, ${meta.lip} 46%, #c3bcc2)`,
  };
}
const MISSED = { main: "#fbd3e8", lip: "#ef9fca" };

const CONFETTI_COLORS = ["#ec4899", "#f59e0b", "#8b5cf6", "#38bdf8", "#34d399", "#fbbf24"];

function ConfettiBurst({ big = false }: { big?: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: big ? 60 : 26 }, (_, i) => ({
        left: 4 + ((i * 37) % 92),
        delay: (i % 12) * 70,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rot: (i * 47) % 360,
        size: 6 + (i % 3) * 3,
      })),
    [big],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="dc-confetti absolute"
          style={{
            left: `${p.left}%`,
            top: "-4%",
            width: `${p.size}px`,
            height: `${p.size * 1.6}px`,
            background: p.color,
            transform: `rotate(${p.rot}deg)`,
            animationDelay: `${p.delay}ms`,
            borderRadius: "2px",
          }}
        />
      ))}
    </div>
  );
}

/* ══════════════════════ Layout do caminho ══════════════════════ */

const DAY_ROW = 84;
const WEEK_HEADER = 88;

type PathNode =
  | { kind: "week-header"; week: number; y: number }
  | { kind: "day"; D: number; week: number; y: number; x: number; row: number };

/**
 * Monta os nós da fase: barra da semana + os 7 dias, sempre.
 *
 * Semanas anteriores à entrada na jornada já viraram uma única moeda "memória",
 * e quem entrava na semana 30 não via dia nenhum das 29 primeiras. Agora todo
 * dia existe no caminho — o que separa é o portão premium na aula, não o
 * desenho da trilha. O álbum da semana mudou de casa: mora na barra.
 */
function buildPhaseNodes(phase: Phase): { nodes: PathNode[]; height: number } {
  const nodes: PathNode[] = [];
  let y = 30;
  let row = 0;
  const xOf = (r: number) => 50 + 27 * Math.sin((r * Math.PI) / 4);

  for (let w = phase.from; w <= phase.to; w++) {
    nodes.push({ kind: "week-header", week: w, y });
    y += WEEK_HEADER;
    for (let D = w * 7; D <= w * 7 + 6; D++) {
      nodes.push({ kind: "day", D, week: w, y: y + DAY_ROW / 2, x: xOf(row), row });
      y += DAY_ROW;
      row++;
    }
  }
  return { nodes, height: y + 40 };
}

/* ── Caminho contínuo estilo Duolingo: todas as fases numa página só ── */

// 78 e não 104: com o passo antigo a semana não cabia numa tela e sobrava
// muito céu morto entre as bolinhas. Em 78 os 7 dias entram quase juntos, o
// que dá a leitura de "estou perto de fechar a semana".
const IDAY_ROW = 78;
/** Espaço extra antes do dia de HOJE, onde mora o balão "Desafio de hoje". */
const TODAY_BUBBLE_ROOM = 64;
const IWEEK_HEADER = 112; // folga para o balão "Desafio de hoje" não cobrir a barra da semana
const IBANNER_ROW = 120;
const ILESSON_ROW = 116;

/** Semana → lição da Escola do Bebê (o aprendizado agora vive DENTRO do caminho). */
const LESSON_BY_WEEK = new Map<number, CourseModule>(COURSE_MODULES.map((m) => [m.week, m]));

type JourneyNode =
  | PathNode
  | { kind: "phase-banner"; phase: Phase; y: number }
  | { kind: "mascot"; humor: "feliz" | "dormindo"; y: number; x: number }
  | { kind: "lesson"; week: number; y: number; x: number; row: number };

/** Uma página só: banners de seção entre as fases, dias grandes, mascotes ao lado. */
/**
 * `todayD` só existe para dar FOLGA EXTRA na linha de hoje: o balão "Desafio de
 * hoje" fica acima da bolinha, e com o passo apertado (78px) ele cobria a
 * bolinha da linha de cima. O resto do caminho segue o passo normal.
 */
function buildFullJourney(
  phases: Phase[],
  todayD: number,
): { nodes: JourneyNode[]; height: number } {
  const nodes: JourneyNode[] = [];
  let y = 8;
  let row = 0;
  let mascotIdx = 0;
  const xOf = (r: number) => 50 + 26 * Math.sin((r * Math.PI) / 4);

  // Mascote grande ao lado do caminho (Duolingo), do lado oposto ao nó da linha
  const maybeMascot = (x: number, rowY: number, rowH: number) => {
    if (row % 5 !== 2) return;
    nodes.push({
      kind: "mascot",
      // Uma personagem só, alternando entre acordada e cochilando. Antes eram
      // oito emoji sorteados — oito bichos sem relação entre si, e cada um
      // desenhado de um jeito por fabricante de celular. Repetir a MESMA cara
      // é o que constrói personagem; variedade aqui só dispersa.
      humor: mascotIdx++ % 3 === 1 ? "dormindo" : "feliz",
      y: rowY + rowH / 2,
      x: x < 50 ? Math.min(x + 44, 82) : Math.max(x - 44, 18),
    });
  };

  for (const p of phases) {
    nodes.push({ kind: "phase-banner", phase: p, y });
    y += IBANNER_ROW;
    for (let w = p.from; w <= p.to; w++) {
      nodes.push({ kind: "week-header", week: w, y });
      y += IWEEK_HEADER;
      for (let D = w * 7; D <= w * 7 + 6; D++) {
        const x = xOf(row);
        // Altura do balão de hoje + respiro, para ele não cobrir a linha acima.
        if (D === todayD) y += TODAY_BUBBLE_ROOM;
        nodes.push({ kind: "day", D, week: w, y: y + IDAY_ROW / 2, x, row });
        maybeMascot(x, y, IDAY_ROW);
        y += IDAY_ROW;
        row++;
      }
      // (Opção A) As lições do curso saíram do Caminho — o ensino é só o
      // "desafio do dia" (aula por semana). Sem nós de LIÇÃO na trilha.
    }
  }
  return { nodes, height: y + 40 };
}

/* ══════════════════════ Barra divisória da semana ══════════════════════ */

/**
 * A cada 7 dias o caminho para e anuncia onde estamos.
 *
 * Era um pill branco de 11px espremido entre duas bolinhas; virou uma faixa
 * que divide de verdade — e que carrega informação em vez de só rotular: as 7
 * bolinhas dão o placar da semana num relance e a moeda da fruta abre o álbum
 * (a antiga moeda "memória" da trilha, que saiu quando todo dia virou nó).
 */
function WeekBar({
  title,
  sub,
  main,
  lip,
  days,
  current,
  onAlbum,
  albumDone,
}: {
  title: string;
  sub?: string;
  main: string;
  lip: string;
  /** Um item por dia da semana, na ordem. */
  days: { done: boolean; today: boolean; future: boolean }[];
  current: boolean;
  onAlbum?: () => void;
  albumDone?: boolean;
}) {
  const feitos = days.filter((d) => d.done).length;
  const Moeda = onAlbum ? "button" : "div";
  return (
    <>
      {/* Fio que atravessa a trilha: é ele que faz a faixa ler como divisória */}
      <div
        aria-hidden
        className="h-px w-full"
        style={{
          background: `linear-gradient(90deg, transparent, color-mix(in oklab, ${main} 55%, white) 50%, transparent)`,
        }}
      />
      <div
        className="mt-1.5 flex items-center gap-3 rounded-2xl px-3 py-2.5 backdrop-blur-sm"
        style={{
          background: `linear-gradient(100deg, color-mix(in oklab, ${main} 18%, white) 0%, color-mix(in oklab, ${main} 7%, white) 100%)`,
          border: `1px solid color-mix(in oklab, ${main} 30%, white)`,
          boxShadow: current
            ? `0 3px 0 color-mix(in oklab, ${lip} 32%, white), 0 0 0 2px ${main}55`
            : `0 3px 0 color-mix(in oklab, ${lip} 22%, white)`,
        }}
      >
        <div className="relative shrink-0">
          <Moeda
            {...(onAlbum
              ? { onClick: onAlbum, type: "button" as const, "aria-label": `Álbum: ${title}` }
              : {})}
            className={`duo3d relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full ${
              onAlbum ? "press" : ""
            }`}
            style={
              {
                background: `radial-gradient(120% 120% at 32% 24%, color-mix(in oklab, ${main} 45%, white) 0%, ${main} 62%, color-mix(in oklab, ${main} 80%, black) 100%)`,
                "--lip": lip,
                boxShadow: `0 4px 0 ${lip}`,
              } as React.CSSProperties
            }
          >
            {/* Sem emoji: a moeda virou a PASTILHA DE COR da semana — é ela
                que mostra em que ponto da jornada a faixa está. Continua
                clicável para abrir o álbum. */}
            <span className="dc-coin-shine" aria-hidden />
          </Moeda>
          {/* Fora da moeda: o `overflow-hidden` que arredonda o brilho cortaria o selo */}
          {albumDone && (
            <span
              className="pointer-events-none absolute -right-1 -top-1 rounded-full bg-white px-1 text-[9px] font-black text-emerald-500 shadow-sm"
              aria-label="figurinha coletada"
            >
              ✓
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[15px] font-extrabold leading-tight text-slate-700">
            {title}
            {current && (
              <span
                className="rounded-full px-1.5 py-px text-[9px] font-black uppercase tracking-wider text-white"
                style={{ background: main }}
              >
                agora
              </span>
            )}
          </p>
          <p className="truncate text-[11px] font-semibold leading-tight text-slate-500">
            {sub ?? `${feitos} de 7 dias`}
          </p>
        </div>

        {/* Placar da semana: 7 pontinhos, um por dia */}
        <div className="flex shrink-0 items-center gap-1" aria-hidden>
          {days.map((d, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: d.done
                  ? main
                  : d.future
                    ? "#dde5ee"
                    : `color-mix(in oklab, ${main} 26%, white)`,
                outline: d.today ? `2px solid ${main}` : undefined,
                outlineOffset: d.today ? "1.5px" : undefined,
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
}

/* ── Anel de progresso segmentado (Duolingo): 3 segmentos = 3 tarefas do dia ── */

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

function TaskRing({ done, total = 3, color }: { done: number; total?: number; color: string }) {
  // Segmentos iguais com folga, começando no topo (ex.: 6 jogos = 6 arcos)
  const seg = 360 / total;
  const pad = total > 4 ? 5 : 8;
  const segs = Array.from({ length: total }, (_, i) => {
    const start = i * seg + pad;
    return arcPath(50, 50, 46, start, start + seg - pad * 2);
  });
  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute -inset-[9px] h-[calc(100%+18px)] w-[calc(100%+18px)]"
      aria-hidden
    >
      {segs.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={i < done ? color : "oklch(0.91 0.01 40)"}
          strokeWidth="7"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

/* ══════════════════════════════ Componente ══════════════════════════════ */

export function GestacaoPath({
  profile,
  gest,
  quizPremium = false,
  careMode = false,
  onOpenShop,
  bancada,
  onOpenAmigas,
}: GestacaoPathProps) {
  const hasGest = !!gest;
  // Dia gestacional de hoje (0-based desde a DUM), até a semana 42 (D=300)
  const rawD = hasGest ? gest.totalDays : 0;
  const todayD = hasGest ? Math.max(7, Math.min(300, rawD)) : 0;
  const currentWeek = hasGest ? Math.max(1, Math.min(42, Math.floor(todayD / 7))) : 0;
  const isPostDate = hasGest && rawD > 286; // passou da semana 40
  const isBeyond42 = hasGest && rawD > 300; // passou da semana 42

  const [sheet, setSheet] = useState<
    /* O pós-parto ainda usa a folha de dia e compartilha este estado, então o
       tipo continua largo. No CAMINHO ela não existe mais: o nó abre as
       atividades direto (ver `reallyOpenDay`). */
    { kind: "day"; D: number } | { kind: "album"; week: number } | null
  >(null);
  const [revealing, setRevealing] = useState(false);
  // Lições da Escola do Bebê dentro do caminho: semana → nota do quiz (0–100).
  // Cache local (entra no sync do journey_state); o servidor é a fonte da verdade.
  const [lessonsDone, setLessonsDone] = useState<Record<number, number>>({});
  const [lessonSheet, setLessonSheet] = useState<CourseModule | null>(null);

  const [journeyStart, setJourneyStart] = useState<JourneyStart | null>(null);
  const [stickers, setStickers] = useState<number[]>([]);
  const [doneDays, setDoneDays] = useState<number[]>([]);
  const [saldo, setSaldo] = useState<number | null>(null);
  /* O presente que o médico (ou a amiga) mandou e que ela ainda não viu.
     Ver `PresenteRecebido` em `sementinhas.functions.ts` para por que ele
     precisou existir: o saldo subia sozinho e nada dizia de onde tinha vindo. */
  const [presente, setPresente] = useState<PresenteRecebido | null>(bancada?.presente ?? null);
  /* Troféus: dias de cinco estrelas, contados no SERVIDOR pelas linhas
     `day_stars:` do ledger. Não é `doneDays.length` — esse mora no navegador,
     e é este número que destranca item pago na loja. */
  const [trofeus, setTrofeus] = useState(bancada?.trofeus ?? 0);
  /* O troféu que ela acabou de ganhar, esperando a comemoração aparecer. */
  const [trofeuNovo, setTrofeuNovo] = useState<number | null>(bancada?.trofeuNovo ?? null);
  /* Quantas amigas — o número que a fita mostra no lugar do calendário.
     Consulta própria e leve (`contarAmigas`), e não a lista inteira: a fita
     abre em toda visita ao Caminho, e a lista calcula chama e troféus de cada
     amiga. */
  const [amigas, setAmigas] = useState(bancada?.amigas ?? 0);
  useEffect(() => {
    if (bancada?.amigas != null) return;
    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: s } = await supabase.auth.getSession();
        if (!s.session?.access_token) return;
        const { contarAmigas } = await import("@/lib/amigas.functions");
        const r = await contarAmigas({ data: { accessToken: s.session.access_token } });
        if (r.ok) setAmigas(r.amigas);
      } catch {
        /* fica em 0: a fita mostra o número honesto de quem não tem ninguém */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Itens do Cantinho que decoram o Caminho (não-fundo) + o fundo ativo.
  const [decor, setDecor] = useState<string[]>([]);
  /* Pele das bolinhas. Mora no `journey_state` (chave `dc-path-`), não numa
     coluna nova: assim ela sincroniza entre aparelhos junto com o resto da
     jornada e não exige migração de banco. */
  const [skin, setSkin] = useState<string | null>(null);
  useEffect(() => {
    const guardada = lsGet<string | null>(SKIN_KEY, null);
    if (guardada && TRILHA_SKINS[guardada]) setSkin(guardada);
  }, []);
  /* Comprou e depois a pele saiu do catálogo? Cai para a bolinha de sempre em
     vez de sumir com o nó. */
  const peleAtiva = skin && TRILHA_SKINS[skin] ? TRILHA_SKINS[skin] : null;

  /* A loja vive noutra aba, então a troca chega por um evento na janela em vez
     de por prop: o Caminho pode nem estar montado quando ela equipa. Ao voltar
     para cá, o `lsGet` do efeito acima já pegou o valor — o evento serve para
     o caso de as duas telas estarem vivas ao mesmo tempo. */
  useEffect(() => {
    const ouvir = (e: Event) => {
      const id = (e as CustomEvent<string | null>).detail;
      setSkin(id && TRILHA_SKINS[id] ? id : null);
    };
    window.addEventListener("dc-skin-trocada", ouvir);
    return () => window.removeEventListener("dc-skin-trocada", ouvir);
  }, []);
  const [fundoBg, setFundoBg] = useState<string | null>(null);
  // Decoração PERSONALIZADA da trilha: a paciente define posição e tamanho de
  // cada enfeite direto aqui no jogo (modo "Arrumar"). Fica no aparelho, por
  // usuária — as lições e o cenário nunca são tocados.
  const [placed, setPlaced] = useState<PlacedDecor[]>([]);
  const [decorReady, setDecorReady] = useState(false);
  const [arranging, setArranging] = useState(false);
  const [selDecor, setSelDecor] = useState<string | null>(null);
  // Itens já espalhados alguma vez: o que foi apagado não volta sozinho, mas
  // uma compra nova aparece na trilha automaticamente.
  const seenRef = useRef<string[]>([]);
  // Última versão já gravada (evita regravar/sincronizar sem mudança real).
  const savedRef = useRef<string>("");
  // Espelho de `arranging` p/ o efeito de hidratação não depender do estado.
  const arrangingRef = useRef(false);
  const dragRef = useRef<{
    k: string;
    mode: "move" | "size";
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    os: number;
    /** Trilha inteira antes deste arrasto (vira o passo do Desfazer). */
    before: PlacedDecor[];
    /** O dedo saiu do lugar? Só aí vira um passo de verdade. */
    moved: boolean;
  } | null>(null);
  // Pilha do Desfazer: um passo por AÇÃO (um arrasto, um item colocado, um
  // item tirado) — nunca "apagar tudo". Fica só em memória, de propósito: é
  // pra corrigir um errinho na hora, não é histórico permanente.
  const histRef = useRef<PlacedDecor[][]>([]);
  const [histLen, setHistLen] = useState(0);
  const [checkin, setCheckin] = useState<Checkin>({ last: "", streak: 0 });
  const [dayTasks, setDayTasks] = useState<Record<string, boolean>>({});
  // Estado dedicado do dia de HOJE: alimenta o anel segmentado sem vazar o
  // estado de outros dias abertos no sheet (dayTasks muda a cada openDay)
  const [todayTasks, setTodayTasks] = useState<Record<string, boolean>>({});

  /* O gatilho que ficava aqui — comparar `momentosDoDia(todayTasks)` entre
     renderizações para acender a estrela no nó da trilha — SAIU. Ele tinha dois
     defeitos que a revisão mediu: disparava sozinho quando a hidratação chegava
     (o contador nasce em zero e sobe), e mesmo quando disparava certo a
     animação acontecia ATRÁS da folha do dia, opaca, apagando-se antes de a
     paciente voltar. As duas comemorações vivem agora dentro da folha, onde ela
     está no instante da conquista. */
  const [showWelcome, setShowWelcome] = useState(false);
  // Incrementa quando o pull da nuvem hidrata o localStorage — filhos que leem
  // no mount (PosPartoJourney) usam como key para remontar com dados frescos
  const [hydratedAt, setHydratedAt] = useState(0);
  // Aparelho novo (sem nada local) esperando a jornada vir da nuvem: mostra um
  // aviso sutil em vez de piscar "zerado" (e o pull tem retry se a rede falhar).
  const [syncing, setSyncing] = useState(false);

  // Sementinhas 🌱: concede o check-in do dia (idempotente) e lê o saldo p/ a
  // barra do topo. Falha é silenciosa (moeda é secundária ao Caminho).
  useEffect(() => {
    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: s } = await supabase.auth.getSession();
        const token = s.session?.access_token;
        if (!token || !s.session) return;
        const w = await claimDailyAndGetWallet({ data: { accessToken: token } });
        // Modo Cuidado: esconde a barra de moeda e as decorações (não celebra).
        if (w.ok) setSaldo(w.careMode ? null : w.balance);
        if (w.ok && w.careMode) return;
        if (w.ok) setTrofeus(w.trofeus ?? 0);
        /* O anúncio do presente. A chave do "já vi" é o INSTANTE da linha do
           ledger, e não o valor: dois presentes de 100 no mesmo mês são duas
           notícias, e uma chave por valor engoliria a segunda. Fica no aparelho
           — no pior caso ela recebe a boa notícia de novo no computador, que é
           um erro muito melhor que engolir a única vez que ela apareceria. */
        if (w.ok && w.presente && !lsGet(chaveDoPresente(w.presente.quando), false)) {
          setPresente(w.presente);
        }
        // Itens comprados decoram o Caminho.
        const c = await getCantinho({ data: { accessToken: token } });
        if (c.ok) {
          setDecor(c.owned.filter((id) => CANTINHO_BY_ID[id]?.type !== "fundo"));
          // Cenário = o fundo EQUIPADO (escolhido na loja). O Fundo Suave grátis
          // troca de tom pela semana gestacional.
          setFundoBg(fundoBgFor(c.equippedFundo, currentWeek));
        }
      } catch {
        /* saldo é secundário */
      }
    })();
  }, []);

  // Lazy init: evita flash da tela errada no primeiro render (rota é ssr:false)
  const [birth, setBirth] = useState<Birth | null>(() => lsGet<Birth | null>(LS.birth, null));
  const [celebrated, setCelebrated] = useState(() => lsGet<boolean>(LS.celebrated, false));
  const [birthDateInput, setBirthDateInput] = useState(localDateStr());
  const [showBirthForm, setShowBirthForm] = useState(false);
  const [albumOpen, setAlbumOpen] = useState(false);

  // Premium ativado: limpa o flag de "comprovante enviado" (o paywall some,
  // mas o flag sincronizado não deve ficar para sempre no blob da jornada).
  useEffect(() => {
    if (quizPremium && lsGet<string>("dc-path-premium-pending", "")) {
      lsSet("dc-path-premium-pending", "");
    }
  }, [quizPremium]);

  /* ── Fases visíveis: bônus pós-data só aparece para quem precisa ── */
  const phases = useMemo<Phase[]>(
    () => (isPostDate ? [...PHASES, BONUS_PHASE] : PHASES),
    [isPostDate],
  );

  /* ── Carregamento + começo inteligente (jornada pertence ao PERFIL) ── */
  useEffect(() => {
    if (!hasGest) return;
    let cancelled = false;

    // Leitura pura do cache local (sem criar nada ainda)
    const hydrateFromLocal = () => {
      setStickers(lsGet<number[]>(LS.stickers, []));
      setDoneDays(lsGet<number[]>(LS.doneDays, []));
      setLessonsDone(lsGet<Record<number, number>>(LS.lessons, {}));
      setCheckin(lsGet<Checkin>(LS.checkin, { last: "", streak: 0 }));
      setBirth(lsGet<Birth | null>(LS.birth, null));
      setCelebrated(lsGet<boolean>(LS.celebrated, false));
      setJourneyStart(lsGet<JourneyStart | null>(LS.journeyStart, null));
      setTodayTasks(lsGet<Record<string, boolean>>(LS.dayTasks(todayD), {}));
    };

    // Render imediato com o que o aparelho tem
    hydrateFromLocal();

    // Aparelho sem nenhum dado local + primeiro pull ainda em andamento: em vez
    // de piscar a jornada "zerada", avisa que está sincronizando.
    const localEmpty =
      lsGet<number[]>(LS.doneDays, []).length === 0 && !lsGet<unknown>(LS.journeyStart, null);
    setSyncing(localEmpty && !gatePrimed);

    (async () => {
      // Nuvem PRIMEIRO: num aparelho novo, a jornada real vem do perfil —
      // sem isso criaríamos uma jornada zerada por cima da verdadeira.
      // A primeira montagem arma a barreira compartilhada (P1); remontagens
      // seguintes (reabrir a aba) re-baixam para frescor cross-device.
      const changed = gatePrimed
        ? await pullJourneyFromProfile()
        : await ensureInitialJourneyPull();
      if (cancelled) return;
      setSyncing(false);
      if (changed) {
        hydrateFromLocal();
        // Filhos que leem o localStorage no próprio mount (PosPartoJourney)
        // remontam via key para reler o estado recém-baixado (P2)
        setHydratedAt((n) => n + 1);
      }

      // Só agora, se o perfil também não tem jornada, ela começa HOJE
      let js = lsGet<JourneyStart | null>(LS.journeyStart, null);
      // DUM corrigida no Perfil pode jogar o início da jornada para o "futuro"
      // (gestDay > hoje) — recalcula em vez de exibir dia negativo/travado.
      if (js && js.gestDay > todayD) {
        js = { date: localDateStr(), gestDay: todayD };
        lsSet(LS.journeyStart, js);
        toast("📅 Suas datas mudaram — a jornada foi recalculada a partir de hoje.");
      }
      if (!js) {
        js = { date: localDateStr(), gestDay: todayD };
        lsSet(LS.journeyStart, js);
        if (todayD > 14 && !lsGet(LS.welcomed, false)) {
          setShowWelcome(true);
          lsSet(LS.welcomed, true);
        }
      }
      if (!cancelled) setJourneyStart(js);

      // Progresso das lições: o servidor (course_progress) é a fonte da verdade —
      // mescla por cima do cache local e regrava para os próximos offline.
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: s } = await supabase.auth.getSession();
        if (s.session && !cancelled) {
          const res = await getCourseProgress({
            data: { accessToken: s.session.access_token },
          });
          if (res.ok && !cancelled) {
            const merged = { ...lsGet<Record<number, number>>(LS.lessons, {}) };
            for (const row of res.progress) merged[row.module_week] = row.quiz_score;
            setLessonsDone(merged);
            lsSet(LS.lessons, merged);
          }
        }
      } catch {
        /* offline: o cache local segue valendo */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasGest, todayD]);

  const journeyStartD = journeyStart?.gestDay ?? todayD;

  /* A régua mora em `sequencia.ts`, testada. Estava escrita aqui e OUTRA VEZ no
     pós-parto, idêntica — e a virada da meia-noite (contar a partir de ontem
     quando hoje ainda não foi fechado) é fácil demais de consertar num lugar só.

     Conta dias com PELO MENOS UM momento, e não `doneDays` (os cinco fechados):
     quem fez um exercício veio, e a sequência mede vinda. Ver
     `diasComAlgumMomento` para por que as duas listas continuam separadas.

     `todayTasks`/`dayTasks` entram nas dependências porque são eles que mudam
     quando ela marca um momento — sem isso a chama só acenderia no próximo
     carregamento da tela, que é justamente o instante em que ela quer ver. */
  const streak = useMemo(
    () =>
      bancada?.streak ??
      (hasGest ? sequenciaDeDias(diasComAlgumMomento(entradasDoArmazem(), DIA_KEY), todayD) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doneDays, todayTasks, dayTasks, todayD, hasGest, bancada?.streak],
  );

  // Caminho contínuo: todas as fases numa página só, como o Duolingo
  const { nodes, height } = useMemo(() => buildFullJourney(phases, todayD), [phases, todayD]);

  const pathRef = useRef<HTMLDivElement>(null);

  /* ── Modo "Arrumar": a trilha é a tela de decoração ────────────────────
     Enfeite novo entra espalhado sozinho; depois a paciente arrasta pra onde
     quiser e escolhe o tamanho. O que ela apagou não volta. */

  // Bandeja: TUDO que ela tem, menos cenário (fundo é papel de parede, não
  // emoji). Céu entra aqui também — se ela quiser uma nuvem parada na trilha,
  // pode; a faixa que passeia lá no alto continua existindo do mesmo jeito.
  const trayItems = useMemo(
    () =>
      decor.filter(
        (id) =>
          CANTINHO_BY_ID[id] &&
          CANTINHO_BY_ID[id].type !== "fundo" &&
          /* Pele veste a bolinha; se entrasse aqui, o 🌱 dela também sairia
             boiando pela trilha como se fosse uma plantinha comprada. */
          CANTINHO_BY_ID[id].type !== "trilha" &&
          /* Tema veste o CÉU DA HOME, que nem é esta tela. Ele faltava nesta
             lista: quem comprava o Céu Clássico (150 🌱) ganhava de brinde um
             🌅 vagando pela trilha, como se fosse um enfeite. */
          CANTINHO_BY_ID[id].type !== "tema",
      ),
    [decor],
  );
  /* TUDO se espalha sozinho, inclusive o céu.
     Antes o `ceu` era excluído daqui com o comentário "o céu já se vira
     sozinho lá em cima" — e não havia código nenhum fazendo isso. Quem
     comprava Estrelinhas (40 🌱) ou Arco-íris (150 🌱) não via absolutamente
     nada até descobrir, por conta própria, o botão ✏️ de Arrumar e arrastar o
     item para o lugar. Cinco itens do catálogo eram dinheiro em troca de nada.
     `seedDecor` agora coloca os de céu na faixa do alto (ver lá). */
  const seedables = trayItems;
  // Só desenha o que ela REALMENTE possui (e nada em Modo Cuidado). Enquanto a
  // lista de itens não chegou do servidor, confia no layout salvo — evita a
  // trilha piscar vazia a cada abertura.
  const visiblePlaced = useMemo(() => {
    if (careMode) return [];
    if (decor.length === 0) return placed;
    const owned = new Set(decor);
    return placed.filter((p) => owned.has(p.id));
  }, [placed, decor, careMode]);

  // Hidrata do storage no mount E de novo quando o pull da nuvem trouxer o
  // layout de outro aparelho (hydratedAt muda). Nunca no meio de um arrasto:
  // o que ela está fazendo AGORA na tela vale mais que o que a nuvem mandou.
  useEffect(() => {
    if (arrangingRef.current) return;
    const saved = loadDecor();
    if (saved) {
      seenRef.current = saved.seen;
      setPlaced(saved.items);
      savedRef.current = JSON.stringify(saved.items);
    }
    setDecorReady(true);
  }, [hydratedAt]);

  arrangingRef.current = arranging;

  // Cada sessão de Arrumar começa com o Desfazer zerado: ele desfaz o que ela
  // acabou de fazer, nunca algo de uma visita anterior que ela nem lembra.
  useEffect(() => {
    if (!arranging) return;
    histRef.current = [];
    setHistLen(0);
  }, [arranging]);

  /* Havia aqui um atalho que abria o modo Arrumar automaticamente quando a
     paciente vinha do Cantinho. Ele morreu junto com a vitrine do Cantinho:
     ninguém mais pede pra chegar arrumando, e entrar em modo de edição sem
     ter pedido é justamente o tipo de tela que assusta. O botão Arrumar da
     própria trilha continua sendo a porta. */

  useEffect(() => {
    if (!decorReady || height <= 0) return;
    const fresh = seedables.filter((id) => !seenRef.current.includes(id));
    if (fresh.length === 0) return;
    seenRef.current = [...seenRef.current, ...fresh];
    setPlaced((prev) => [...prev, ...seedDecor(fresh, height, prev.length)].slice(0, DECOR_MAX));
  }, [seedables, decorReady, height]);

  // Salva com folga: arrastar dispara dezenas de updates por segundo e não vale
  // escrever (e sincronizar) a cada pixel.
  useEffect(() => {
    if (!decorReady) return;
    const t = setTimeout(() => {
      const next = JSON.stringify(placed);
      // Nada mudou de verdade (ex.: logo depois de hidratar): não escreve nem
      // acorda a sincronização da jornada à toa.
      if (next === savedRef.current) return;
      savedRef.current = next;
      saveDecor(placed, seenRef.current);
    }, 400);
    return () => clearTimeout(t);
  }, [placed, decorReady]);

  const DECOR_HIST_MAX = 40;

  /** Guarda o estado ANTES de uma mudança, pra ela poder voltar um passo. */
  function pushHistory(before: PlacedDecor[]) {
    histRef.current = [...histRef.current.slice(-(DECOR_HIST_MAX - 1)), before];
    setHistLen(histRef.current.length);
  }

  /** Volta UM passo. Nunca mexe no resto do que ela montou. */
  function undoDecor() {
    const before = histRef.current.pop();
    setHistLen(histRef.current.length);
    if (!before) return;
    setPlaced(before);
    setSelDecor(null);
  }

  function startDecorDrag(e: React.PointerEvent, p: PlacedDecor, mode: "move" | "size") {
    if (!arranging) return;
    e.preventDefault();
    e.stopPropagation();
    setSelDecor(p.k);
    dragRef.current = {
      k: p.k,
      mode,
      sx: e.clientX,
      sy: e.clientY,
      ox: p.x,
      oy: p.y,
      os: p.s,
      before: placed,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  // O ponteiro fica capturado no item, mas o evento sobe até a trilha — por
  // isso mover/soltar moram aqui, no contêiner que dá as coordenadas.
  function onPathPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    const el = pathRef.current;
    if (!d || !el) return;
    const r = el.getBoundingClientRect();
    // Um toque que não arrastou nada não vira passo do Desfazer.
    if (!d.moved && Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) < 4) return;
    if (!d.moved) {
      d.moved = true;
      pushHistory(d.before);
    }
    if (d.mode === "move") {
      const x = clampN(d.ox + ((e.clientX - d.sx) / Math.max(1, r.width)) * 100, 3, 97);
      const y = clampN(d.oy + (e.clientY - d.sy), 20, Math.max(20, height - 20));
      setPlaced((prev) => prev.map((p) => (p.k === d.k ? { ...p, x, y } : p)));
    } else {
      const s = clampN(
        d.os + (e.clientX - d.sx + (e.clientY - d.sy)) / 160,
        DECOR_MIN_SCALE,
        DECOR_MAX_SCALE,
      );
      setPlaced((prev) => prev.map((p) => (p.k === d.k ? { ...p, s } : p)));
    }
  }

  function endDecorDrag() {
    dragRef.current = null;
  }

  function addDecor(id: string) {
    if (placed.length >= DECOR_MAX) {
      toast.error(`A trilha já tem ${DECOR_MAX} enfeites — tire algum com o ✕ antes.`);
      return;
    }
    // Nasce no meio do que está à vista, pra ela ver o item aparecer.
    const el = pathRef.current;
    let y = Math.min(220, Math.max(40, height - 40));
    if (el) {
      const r = el.getBoundingClientRect();
      y = clampN(window.innerHeight / 2 - r.top, 40, Math.max(40, height - 40));
    }
    const k = `u${placed.length}-${id}-${Math.round(y)}`;
    pushHistory(placed);
    setPlaced((prev) => [...prev, { k, id, x: 50, y, s: 1.4 }]);
    setSelDecor(k);
  }

  function removeDecor(k: string) {
    pushHistory(placed);
    setPlaced((prev) => prev.filter((p) => p.k !== k));
    setSelDecor(null);
  }

  // Centraliza o nó de HOJE na tela ao abrir (scroll da própria página)
  useEffect(() => {
    if (!hasGest || birth) return;
    const t = setTimeout(() => {
      document
        .getElementById("dc-today-node")
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 450);
    return () => clearTimeout(t);
  }, [hasGest, birth, todayD]);

  const checkedToday = checkin.last === localDateStr();

  function doCheckin(mood: string) {
    if (checkedToday) return;
    const yesterday = localDateStr(new Date(Date.now() - 86400000));
    const s = checkin.last === yesterday ? checkin.streak + 1 : 1;
    const next = { last: localDateStr(), streak: s, mood };
    setCheckin(next);
    lsSet(LS.checkin, next);
    // Após o nascimento, o humor pertence ao dia PÓS-PARTO — não gravar na gestação
    if (!birth) markDayTask(todayD, "humor", true);
  }

  function dayTaskState(D: number): Record<string, boolean> {
    return lsGet<Record<string, boolean>>(LS.dayTasks(D), {});
  }

  function markDayTask(D: number, id: string, value: boolean) {
    const state = { ...dayTaskState(D), [id]: value };
    lsSet(LS.dayTasks(D), state);
    if (wellnessDay === D) setDayTasks(state);
    if (D === todayD) setTodayTasks(state);
    // As 5 estrelas do dia: a aula + os 4 jogos de bem-estar, uma cada.
    const allDone = momentosDoDia(state) >= TOTAL_DO_DIA;
    if (allDone && !doneDays.includes(D)) {
      const next = [...doneDays, D];
      setDoneDays(next);
      lsSet(LS.doneDays, next);
      setRevealing(true);
      setTimeout(() => setRevealing(false), 1800);
      collectSticker(Math.floor(D / 7), false);
      // As 5 estrelas fechadas hoje (fora do Modo Cuidado): bônus + celebração.
      if (D === todayD && !careMode) {
        /* A festa cresce com a sequência: `streak` já conta os dias seguidos,
           e é ele que decide quantos confetes, quantas notas e quanta
           vibração. Somo 1 porque HOJE ainda não entrou na conta quando esta
           linha roda. */
        const nivel = nivelDaSequencia(streak + 1);
        fireConfetti(nivel);
        celebrateChime(nivel);
        celebrateHaptic(nivel);
        (async () => {
          try {
            const { supabase } = await import("@/integrations/supabase/client");
            const { data: s } = await supabase.auth.getSession();
            if (s.session) {
              const r = await grantDayStarsBonus({
                data: { accessToken: s.session.access_token, day: D },
              });
              if (r.ok && r.granted > 0) toast.success(`⭐ 5 estrelas! +${r.granted} 🌱`);
              else toast.success("⭐ As 5 estrelas do dia!");

              /* O TROFÉU.
                 A comemoração acontece AQUI, e não numa comparação de números.
                 A primeira versão só abria se `novo > antes` — e foi assim que
                 o dono fechou as cinco estrelas e não viu animação nenhuma: a
                 contagem daquele momento devolvia 0, então `0 > 0` era falso e
                 a tela simplesmente não aparecia.

                 Este bloco já é o instante exato da conquista, e já roda uma
                 vez por dia (`!doneDays.includes(D)`). Deixar a festa depender
                 de um segundo número, lido logo depois por outra viagem à rede,
                 é pôr uma condição a mais entre ela e o momento que a condição
                 existe para celebrar.

                 O número exibido ainda vem do servidor — é o mesmo que
                 destranca item na loja, e um contador que anda sozinho na tela
                 mostraria um troféu a mais que o gate. Se a leitura falhar, a
                 festa acontece com o número local + 1: melhor um número que se
                 corrige no próximo carregamento do que engolir a conquista. */
              const w = await getWallet({ data: { accessToken: s.session.access_token } });
              const doServidor = w.ok && typeof w.trofeus === "number" ? w.trofeus : null;
              /* Fora do atualizador de estado: chamar `setTrofeuNovo` de dentro
                 de um `setTrofeus(fn)` é efeito colateral dentro de função que
                 o React pode executar duas vezes — e duas execuções abririam a
                 comemoração duas vezes. O `trofeus` do fecho pode estar velho,
                 mas ele só serve de rede quando o servidor não respondeu. */
              const agora = doServidor ?? trofeus + 1;
              setTrofeus(agora);
              setTrofeuNovo(agora);
            }
          } catch {
            /* o bônus é secundário */
          }
        })();
      } else {
        /* Sem festa no luto. Alcançável para quem já tinha meias-estrelas
           antes de entrar no Modo Cuidado e volta ao app depois. */
        if (!careMode) toast.success(`🎉 Dia ${D - journeyStartD + 1} da jornada completo!`);
      }
    }
  }

  function collectSticker(week: number, announce = true) {
    if (stickers.includes(week)) return;
    const next = [...stickers, week];
    setStickers(next);
    lsSet(LS.stickers, next);
    const baby = babyForWeek(week);
    if (announce) {
      setRevealing(true);
      setTimeout(() => setRevealing(false), 1800);
    }
    /* Idem: a figurinha da semana é comemoração de bebê crescendo. */
    if (!careMode) toast.success(`${fruitEmojiForWeek(week)} Figurinha coletada: ${baby.fruit}!`);
  }

  // Intro imersiva (Duolingo) antes do sheet da aula
  const [intro, setIntro] = useState<number | null>(null);
  // Tela cheia de bem-estar (aberta pelo card do dia). Guarda o dia (D).
  const [wellnessDay, setWellnessDay] = useState<number | null>(null);
  /* Atalho SÓ da bancada de design: sem ele a tela das atividades só se
     alcança tocando num nó da trilha, e não haveria como fotografá-la. */
  useEffect(() => {
    if (bancada?.jogos) setWellnessDay(todayD);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bancada?.jogos]);

  function reallyOpenDay(D: number) {
    setDayTasks(dayTaskState(D));
    /* Vai DIRETO para as atividades do dia.
       Antes havia uma folha no meio do caminho — cabeçalho "Desafio de hoje",
       um cartão roxo "Jogos do dia · 0 de 6" e um botão "Jogar ›" — e o único
       destino dela era esta tela. Um toque a mais para chegar num lugar que a
       folha nem descrevia melhor do que a própria tela descreve. O aviso de
       "amanhã tem aula nova" que morava lá desceu para o rodapé das
       atividades, onde continua sendo lido no fim da sessão. */
    setWellnessDay(D);
  }

  function openDay(D: number) {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // A intro só roda quando uma aula de verdade vem a seguir: hoje (grátis)
    // ou revisão premium. Dia passado sem premium vai direto ao paywall —
    // sem prometer 1,3s de aula que não vem.
    const willHaveLesson = D === todayD || quizPremium;
    if (quizForDay(D) && !reduced && willHaveLesson) {
      setIntro(D);
      return;
    }
    reallyOpenDay(D);
  }

  /** Salva a lição concluída: otimista no aparelho, canônico no servidor. */
  async function completeLesson(week: number, score: number) {
    if (lessonsDone[week] != null) return;
    const next = { ...lessonsDone, [week]: score };
    setLessonsDone(next);
    lsSet(LS.lessons, next);
    setRevealing(true);
    setTimeout(() => setRevealing(false), 1800);
    if (!careMode) toast.success(`📚 Lição da semana ${week} completa!`);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: s } = await supabase.auth.getSession();
      if (s.session) {
        await markModuleComplete({
          data: { accessToken: s.session.access_token, moduleWeek: week, quizScore: score },
        });
      }
    } catch {
      /* offline: fica no cache e o próximo sync resolve */
    }
  }

  function openAlbum(week: number) {
    setSheet({ kind: "album", week });
    if (week <= currentWeek) collectSticker(week);
  }

  // Piso de 300 dias: cobre qualquer parto real mesmo para quem só abre o app
  // meses depois do nascimento (a única saída da jornada não pode ficar travada).
  // 420 dias (~14 meses) cobre até quem só volta ao app bem depois do parto.
  const birthMinDate = localDateStr(new Date(Date.now() - 420 * 86400000));

  // Declarar o nascimento muda o app inteiro para o modo pós-parto — por isso
  // o fluxo tem DOIS passos: validar a data e depois confirmar de verdade.
  const [birthConfirming, setBirthConfirming] = useState(false);

  function declareBirth() {
    const today = localDateStr();
    if (!birthDateInput) {
      toast.error("Informe a data do nascimento.");
      return;
    }
    if (birthDateInput > today) {
      toast.error("A data do nascimento não pode ser no futuro.");
      return;
    }
    if (birthDateInput < birthMinDate) {
      toast.error("Data muito antiga — confira o dia do nascimento.");
      return;
    }
    if (!birthConfirming) {
      setBirthConfirming(true);
      return;
    }
    const b = { date: birthDateInput };
    setBirth(b);
    lsSet(LS.birth, b);
    setCelebrated(false);
    lsSet(LS.celebrated, false);
    setShowBirthForm(false);
    setBirthConfirming(false);
  }

  /** Desfaz um nascimento declarado por engano (disponível na celebração). */
  function undoBirth() {
    setBirth(null);
    lsSet(LS.birth, null);
    setCelebrated(false);
    lsSet(LS.celebrated, false);
    setBirthConfirming(false);
    // Se o check-in de humor de hoje aconteceu enquanto o app estava em modo
    // pós-parto, ele não foi gravado na gestação (doCheckin pula com birth) —
    // credita agora, senão o dia mostraria 3/3 sem nunca completar.
    if (checkedToday && !dayTaskState(todayD).humor) {
      markDayTask(todayD, "humor", true);
    }
    toast.success("Tudo certo — sua gestação continua aqui 💛");
  }

  async function share(week: number) {
    const baby = babyForWeek(week);
    const name = profile?.baby_name || "Meu bebê";
    const text = `🤰 Semana ${week}: ${name} está do tamanho de ${baby.fruit.toLowerCase()}! ${fruitEmojiForWeek(week)}\n📏 ${baby.size} · ⚖️ ${baby.weight}\n\nAcompanhando cada semana no app Obstétrica 💜`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Texto copiado! Cole no WhatsApp 💬");
      }
    } catch {
      /* cancelado */
    }
  }

  if (!hasGest) {
    return (
      <div className="glass-card glass-pink rounded-3xl p-10 text-center">
        <p className="text-5xl mb-4">🗺️</p>
        <p className="text-xl font-bold text-pink-700">Sua jornada começa aqui</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure a data da última menstruação em <strong>Perfil</strong> para ver o caminho das
          40 semanas.
        </p>
      </div>
    );
  }

  const babyLabel = profile?.baby_name || "seu bebê";

  const styleBlock = (
    <style>{`
      @keyframes dcConfettiFall {
        0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
        100% { transform: translateY(75vh) rotate(540deg); opacity: 0; }
      }
      .dc-confetti { animation: dcConfettiFall 1.6s ease-in both; }
      @keyframes dcChestPulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.12);} }
      .dc-chest { animation: dcChestPulse 1.1s ease-in-out infinite; }
      @keyframes dcHaloPulse { 0%,100%{opacity:0.35;} 50%{opacity:1;} }
      .dc-halo { animation: dcHaloPulse 1.8s ease-in-out infinite; }
      @keyframes dcStep {
        from { opacity: 0; transform: scale(0.4); }
        to { opacity: 1; transform: scale(1); }
      }
      .dc-step { animation: dcStep 420ms var(--ease-spring) backwards; }
      @keyframes dcStickerPop {
        0% { transform: scale(0) rotate(-12deg); }
        70% { transform: scale(1.25) rotate(4deg); }
        100% { transform: scale(1) rotate(0); }
      }
      .dc-sticker-pop { animation: dcStickerPop 700ms cubic-bezier(0.34,1.56,0.64,1) both; }
      /* Intro imersiva da aula (Duolingo): moeda salta, anéis pulsam, textos sobem */
      @keyframes dcIntroCoin {
        0% { transform: scale(0.2) rotate(-14deg); opacity: 0; }
        60% { transform: scale(1.18) rotate(4deg); opacity: 1; }
        100% { transform: scale(1) rotate(0deg); opacity: 1; }
      }
      @keyframes dcIntroRing {
        0% { transform: scale(0.5); opacity: 0.75; }
        100% { transform: scale(2.1); opacity: 0; }
      }
      @keyframes dcIntroText {
        0% { transform: translateY(18px); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
      }
      @keyframes dcIntroOut {
        to { opacity: 0; }
      }
      .dc-intro-coin { animation: dcIntroCoin 620ms cubic-bezier(0.34,1.56,0.64,1) both; }
      .dc-intro-ring { animation: dcIntroRing 900ms ease-out both; }
      .dc-intro-text { animation: dcIntroText 480ms 260ms var(--ease-out-expo, ease-out) both; }
      .dc-intro-sub { animation: dcIntroText 480ms 420ms var(--ease-out-expo, ease-out) both; }
      .dc-intro-leave { animation: dcIntroOut 260ms ease-in both; }

      /* Brilho 3D estilo logo: reflexo superior + luz interna suave */
      .dc-coin-shine {
        position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
        background:
          radial-gradient(62% 48% at 30% 20%, rgba(255,255,255,0.62), rgba(255,255,255,0.10) 55%, transparent 72%),
          radial-gradient(80% 45% at 50% 108%, rgba(255,255,255,0.20), transparent 60%);
      }
      @media (prefers-reduced-motion: reduce) {
        .dc-confetti, .dc-chest, .dc-sticker-pop, .dc-halo, .dc-step { animation: none; }
      }
    `}</style>
  );

  /* ══════════ PONTO 2 · Celebração do nascimento (uma vez) ══════════ */
  // Modo Cuidado: nunca dispara a celebração de nascimento (crítico em perda).
  if (birth && !celebrated && !careMode) {
    const totalDone = doneDays.length;
    return (
      <div className="relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl bg-white/80 p-8 text-center backdrop-blur-sm">
        {styleBlock}
        <ConfettiBurst big />
        <p className="text-6xl">🎉</p>
        <div>
          <p className="text-2xl font-extrabold">{babyLabel} chegou!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Parabéns, mamãe. Vocês completaram a maior jornada que existe.
          </p>
        </div>
        <div
          className="duo3d flex h-24 w-24 items-center justify-center rounded-full text-5xl"
          style={{ background: "#fbbf24", "--lip": "#b45309" } as React.CSSProperties}
        >
          🏆
        </div>
        <div className="rounded-2xl bg-amber-50 px-5 py-3">
          <p className="text-sm font-extrabold text-amber-700">Jornada da Gestação completa</p>
          <p className="mt-0.5 text-xs text-amber-600">
            {totalDone} {totalDone === 1 ? "desafio completo" : "desafios completos"} ·{" "}
            {stickers.length} figurinhas colecionadas
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Seu álbum da gestação fica guardado para sempre 💝
        </p>
        <button
          onClick={() => {
            setCelebrated(true);
            lsSet(LS.celebrated, true);
          }}
          className="press rounded-full bg-sky-500 px-6 py-3 text-sm font-extrabold text-white shadow-md"
        >
          Começar o 4º trimestre 🍼
        </button>
        <button
          onClick={undoBirth}
          className="text-xs font-medium text-muted-foreground underline underline-offset-2"
        >
          Declarei sem querer — voltar para a gestação
        </button>
      </div>
    );
  }

  /* ══════════ PONTO 2 · Jornada do 4º trimestre ══════════ */
  if (birth && celebrated) {
    return (
      <PosPartoJourney
        key={`pos-${hydratedAt}`}
        babyLabel={babyLabel}
        birth={birth}
        checkedToday={checkedToday}
        doCheckin={doCheckin}
        gestStickers={stickers}
        albumOpen={albumOpen}
        setAlbumOpen={setAlbumOpen}
        openGestAlbum={(w) => setSheet({ kind: "album", week: w })}
        sheet={sheet}
        setSheet={setSheet}
        revealing={revealing}
        setRevealing={setRevealing}
        styleBlock={styleBlock}
        shareGest={share}
        careMode={careMode}
      />
    );
  }

  /* ══════════ PONTO 3 · Semana 43+: o app se cala e manda para o médico ══════════ */
  if (isBeyond42) {
    return (
      <div className="flex flex-col gap-4">
        {styleBlock}
        <div className="rounded-3xl border-2 border-amber-300 bg-amber-50 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Acompanhamento necessário
          </p>
          <p className="mt-2 text-lg font-bold text-amber-900">Sua gestação passou de 42 semanas</p>
          <p className="mt-2 text-sm leading-relaxed text-amber-800">
            Entre em contato com o consultório do seu médico <strong>hoje</strong> para avaliação do
            bem-estar do bebê e decisão sobre o parto. Se notar diminuição dos movimentos, perda de
            líquido ou sangramento, vá direto à maternidade.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="/agendamento"
              className="press rounded-full bg-amber-600 px-5 py-2.5 text-sm font-bold text-white"
            >
              Falar com o consultório
            </a>
            <a
              href="tel:192"
              className="press rounded-full border-2 border-amber-600 px-5 py-2.5 text-sm font-bold text-amber-700"
            >
              Emergência: 192
            </a>
          </div>
        </div>

        {/* A única ação de jornada disponível: declarar o nascimento */}
        <div className="rounded-3xl bg-white/80 p-5 backdrop-blur-sm">
          <p className="text-sm font-bold">{babyLabel} já nasceu? 🎉</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Informe a data para celebrar e começar a jornada do 4º trimestre. Seu caminho e as
            figurinhas continuam guardados — eles voltam a aparecer no álbum. 💛
          </p>
          {birthConfirming ? (
            <div className="mt-3 rounded-xl bg-pink-50 p-3">
              <p className="text-sm font-bold text-pink-800">
                Confirmar o nascimento em{" "}
                {new Date(birthDateInput + "T00:00:00").toLocaleDateString("pt-BR")}?
              </p>
              <p className="mt-0.5 text-xs text-pink-700">
                O app muda para o modo pós-parto (dá para desfazer logo em seguida).
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={declareBirth}
                  className="press rounded-full bg-pink-500 px-4 py-2 text-sm font-bold text-white"
                >
                  Sim, nasceu! 🎉
                </button>
                <button
                  onClick={() => setBirthConfirming(false)}
                  className="press rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-500"
                >
                  Ainda não
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <input
                type="date"
                value={birthDateInput}
                max={localDateStr()}
                onChange={(e) => setBirthDateInput(e.target.value)}
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
              />
              <button
                onClick={declareBirth}
                className="press rounded-full bg-pink-500 px-4 py-2 text-sm font-bold text-white"
              >
                Nasceu! 🎉
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ══════════ Jornada da gestação (com PONTO 1 embutido) ══════════ */
  const meta = trimMeta(currentWeek);
  const journeyDayNum = todayD - journeyStartD + 1;

  return (
    <div className="flex flex-col gap-4">
      {styleBlock}

      {syncing && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-700">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
          Sincronizando sua jornada…
        </div>
      )}

      {showWelcome && (
        <div className="glass-card glass-pink rounded-3xl p-5">
          <p className="text-2xl">👋💜</p>
          <p className="mt-1 font-bold">Você chegou na semana {currentWeek} — e está tudo certo!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sua jornada de desafios diários começa <strong>hoje</strong>. As {currentWeek - 1}{" "}
            semanas que você já viveu viraram seu <strong>álbum de memórias</strong>: toque nelas no
            caminho para colecionar as figurinhas do que {babyLabel} já conquistou.
          </p>
          <button
            onClick={() => setShowWelcome(false)}
            className="press mt-3 rounded-full bg-pink-500 px-4 py-1.5 text-sm font-bold text-white"
          >
            Começar a jornada 🚀
          </button>
        </div>
      )}

      {/* PONTO 1 · Banner pós-data: acolhedor + CTA médico forte */}
      {isPostDate && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-2xl">⏳💜</p>
          <p className="mt-1 font-bold text-amber-900">
            {babyLabel} escolheu ficar mais um pouquinho
          </p>
          <p className="mt-1 text-sm leading-relaxed text-amber-800">
            Isso é normal — acontece em 1 a cada 10 gestações. A partir de agora o acompanhamento
            fica mais próximo: consultas <strong>2x por semana</strong> com cardiotocografia, e a
            conversa sobre indução acontece com o seu médico.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="/agendamento"
              className="press rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-white"
            >
              Agendar consulta
            </a>
          </div>
        </div>
      )}

      {/* PONTO 2 · Botão "nasceu" — disponível do termo (37s) em diante */}
      {currentWeek >= 37 && (
        <div className="rounded-2xl bg-white/80 p-4 backdrop-blur-sm shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
          {!showBirthForm ? (
            <button
              onClick={() => setShowBirthForm(true)}
              className="press w-full rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 py-3 text-sm font-extrabold text-white"
            >
              🎉 {babyLabel} nasceu!
            </button>
          ) : (
            <div>
              <p className="text-sm font-bold">Que dia {babyLabel} chegou?</p>
              {birthConfirming ? (
                <div className="mt-2 rounded-xl bg-pink-50 p-3">
                  <p className="text-sm font-bold text-pink-800">
                    Confirmar o nascimento em{" "}
                    {new Date(birthDateInput + "T00:00:00").toLocaleDateString("pt-BR")}?
                  </p>
                  <p className="mt-0.5 text-xs text-pink-700">
                    O app muda para o modo pós-parto (dá para desfazer logo em seguida).
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={declareBirth}
                      className="press rounded-full bg-pink-500 px-4 py-2 text-sm font-bold text-white"
                    >
                      Sim, nasceu! 🎉
                    </button>
                    <button
                      onClick={() => setBirthConfirming(false)}
                      className="press rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-500"
                    >
                      Ainda não
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <input
                    type="date"
                    value={birthDateInput}
                    max={localDateStr()}
                    onChange={(e) => setBirthDateInput(e.target.value)}
                    className="flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm"
                  />
                  <button
                    onClick={declareBirth}
                    className="press rounded-full bg-pink-500 px-4 py-2 text-sm font-bold text-white"
                  >
                    Confirmar 🎉
                  </button>
                  <button
                    onClick={() => {
                      setShowBirthForm(false);
                      setBirthConfirming(false);
                    }}
                    className="press rounded-full bg-slate-100 px-3 py-2 text-sm font-bold text-slate-500"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stats — faixa sólida fixa no topo (Duolingo): conteúdo passa por baixo limpo */}
      <div
        style={{ top: "var(--safe-top)" }}
        className="sticky z-30 -mx-5 flex items-center justify-around border-b border-border/60 bg-background/95 px-6 py-3 backdrop-blur-md md:mx-0 md:rounded-2xl md:border"
      >
        {!careMode && (
          <>
            <div className="flex items-center gap-1.5" title="Dias seguidos completando o desafio">
              <ChamaDaSequencia acesa={sequenciaAcesa(streak)} tamanho={26} />
              <span
                className={`text-lg font-extrabold ${
                  sequenciaAcesa(streak) ? "text-amber-500" : "text-slate-400"
                }`}
              >
                {streak}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {streak === 1 ? "dia" : "dias"}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
          </>
        )}
        {/* ── AMIGAS ────────────────────────────────────────────────────
            Substituiu o calendário (pedido do dono). O "11º dia da jornada"
            que estava aqui não se perdeu: ele conta a mesma história que o
            "no app há X" do perfil, e é lá que ele passa a morar.

            É o ÚNICO item da fita que é botão, então ele tem `press`,
            `aria-label` e alvo de toque próprio — os outros três são placar,
            e um deles virar link sem parecer link é o jeito de a paciente
            nunca descobrir a aba. */}
        <button
          type="button"
          onClick={onOpenAmigas}
          disabled={!onOpenAmigas}
          aria-label="Abrir as Amigas"
          className="press flex items-center gap-1.5 rounded-full px-1 py-0.5 disabled:opacity-100"
        >
          {/* 0,9242 é MEDIDO com o ícone isolado sobre fundo transparente.

              Eu tinha ESTIMADO 1, supondo que o disco do `+` encostasse na
              borda do `viewBox` — ele para em y≈22,2 de 24. A diferença
              levantava o ícone 1,67px acima da linha dos números, e o dono viu
              na fita. É a terceira vez nesta fita que estimar custa uma volta:
              a fração se mede, nunca se supõe. */}
          <IconeAmigas
            className="h-[22px] w-[22px] text-sky-500"
            style={{
              transform: `translateY(${deslocamentoDaLinha({ altura: 22, baseDaTinta: 0.9242 })}px)`,
            }}
          />
          {/* O NÚMERO, no mesmo peso da chama e do troféu — a fita é um placar
              e os três itens têm de ler como a mesma coisa.

              `tabular-nums` + largura mínima: sem os dois, a fita se
              redesenharia quando o número passasse de "9" para "10", e o
              `justify-around` empurraria a chama e o troféu de lugar. A largura
              é a de `99+`, o valor mais largo que pode aparecer. */}
          <span
            className="min-w-[2.1ch] text-center text-lg font-extrabold tabular-nums text-sky-500"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {rotuloDeAmigas(amigas)}
          </span>
        </button>
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-1.5" title="Figurinhas coletadas">
          {/* O TROFÉU CONTA DIAS DE CINCO ESTRELAS, e não mais figurinhas de
              álbum da semana. O dono viu "8" com três conquistas e disse a
              coisa certa: não significava nada. O número vem do SERVIDOR
              (linhas `day_stars:` do ledger), que é o mesmo que destranca item
              da loja — dois números diferentes para a mesma palavra seria o
              defeito antigo de volta. */}
          <TrofeuIcone />
          <span className="text-lg font-extrabold text-violet-500">{trofeus}</span>
        </div>
        {saldo != null && (
          <>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5" title="Suas Sementinhas">
              {/* O broto é GLIFO, não imagem: ele já se apoia na mesma linha de
                  base dos algarismos por construção da fonte, e deslocá-lo o
                  tiraria de lá. */}
              <span className="text-xl leading-none">🌱</span>
              <span className="text-lg font-extrabold text-emerald-500">{saldo}</span>
            </div>
          </>
        )}
      </div>

      {/* Botões flutuantes: lojinha + "Arrumar" — silenciados no Modo Cuidado
          e escondidos enquanto ela está arrumando (a barra de baixo assume). */}
      {!careMode && !arranging && (
        <>
          <style>{`
            @keyframes dc-shop-glow {
              0%, 100% { box-shadow: 0 6px 16px rgba(16,185,129,0.28); }
              50% { box-shadow: 0 8px 24px rgba(16,185,129,0.45), 0 0 0 4px rgba(167,243,208,0.55); }
            }
            @media (prefers-reduced-motion: reduce) { .dc-shop-fab { animation: none !important; } }
          `}</style>
          {/* Um de cada lado, como o cliente pediu: Arrumar à esquerda,
              Cantinho à direita. Só o ícone — o rótulo apertava o círculo e
              disputava atenção com a trilha, que é a estrela da tela. */}
          {trayItems.length > 0 && (
            <button
              onClick={() => setArranging(true)}
              aria-label="Arrumar os enfeites da trilha"
              title="Arrumar"
              className="press fixed bottom-24 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-xl shadow-[0_6px_18px_rgba(0,0,0,0.14)] ring-1 ring-slate-200 backdrop-blur md:bottom-8"
            >
              ✏️
            </button>
          )}
          {onOpenShop && (
            <button
              onClick={onOpenShop}
              aria-label="Abrir o Cantinho"
              title="Cantinho"
              className="dc-shop-fab press fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 ring-1 ring-emerald-300 md:bottom-8"
              style={{ animation: "dc-shop-glow 2.2s ease-in-out infinite" }}
            >
              <IconeLoja className="h-6 w-6 text-emerald-600" />
              {saldo != null && (
                <span className="absolute -right-1.5 -top-1.5 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-black leading-none text-emerald-700 shadow-sm ring-1 ring-emerald-200">
                  {saldo}
                </span>
              )}
            </button>
          )}
        </>
      )}

      {/* A COMEMORAÇÃO DO TROFÉU. Cinco segundos, e um toque em qualquer
          lugar da tela pula — pedido do dono, e ele está certo: comemoração
          que não se pode pular vira pedágio, e quem fecha o dia todo dia é
          quem mais pagaria esse pedágio. */}
      {trofeuNovo != null && (
        <TrofeuConquistado numero={trofeuNovo} aoFechar={() => setTrofeuNovo(null)} />
      )}

      {/* O ANÚNCIO DO PRESENTE. Fora do bloco acima de propósito: aquele some
          quando ela está arrumando os enfeites, e um presente não pode depender
          do modo em que a tela está. O Modo Cuidado já foi barrado no servidor
          (`presenteRecente` devolve `null`), então aqui não há segundo portão a
          esquecer. */}
      {presente && (
        <AvisoDePresente
          presente={presente}
          careMode={careMode}
          onFechar={() => {
            lsSet(chaveDoPresente(presente.quando), true);
            setPresente(null);
          }}
          onIrAoCantinho={
            onOpenShop
              ? () => {
                  lsSet(chaveDoPresente(presente.quando), true);
                  setPresente(null);
                  onOpenShop();
                }
              : undefined
          }
        />
      )}

      {/* Barra do modo Arrumar: bandeja de enfeites + sair. Fica ACIMA da
          barra do app (z-50) pra ela terminar sem sair da trilha. */}
      {arranging && !careMode && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-emerald-200 bg-white/95 px-3 pt-2 shadow-[0_-6px_24px_rgba(0,0,0,0.12)] backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] leading-snug text-muted-foreground">
              Arraste pra mover · <span className="font-bold text-emerald-600">⤢</span> pra mudar o
              tamanho · <span className="font-bold text-rose-500">✕</span> pra tirar
              <span className="ml-1 tabular-nums opacity-70">
                ({visiblePlaced.length}/{DECOR_MAX})
              </span>
            </p>
            {/* Desfazer volta UM passo (o último arrasto, o último item posto
                ou tirado). Não existe "apagar tudo": um toque sem querer nunca
                pode levar embora o que ela montou. */}
            <button
              onClick={undoDecor}
              disabled={histLen === 0}
              aria-label="Desfazer a última mudança"
              className="press shrink-0 rounded-full bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200 disabled:opacity-40"
            >
              ↩︎ <span className="text-[13px]">Desfazer</span>
            </button>
            <button
              onClick={() => {
                setArranging(false);
                setSelDecor(null);
              }}
              className="press shrink-0 rounded-full bg-emerald-500 px-4 py-2 text-sm font-extrabold text-white"
            >
              Pronto ✓
            </button>
          </div>
          <div
            className="flex gap-2 overflow-x-auto pb-1 pt-2"
            style={{ paddingBottom: "max(0.5rem, var(--safe-bottom))" }}
          >
            {trayItems.map((id) => {
              const item = CANTINHO_BY_ID[id];
              if (!item) return null;
              return (
                <button
                  key={id}
                  onClick={() => addDecor(id)}
                  title={`Colocar ${item.name} na trilha`}
                  aria-label={`Colocar ${item.name} na trilha`}
                  className="press flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-2xl ring-1 ring-slate-200"
                >
                  {item.emoji}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!checkedToday && (
        <div className="rounded-2xl bg-white/80 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.05)] backdrop-blur-sm">
          <p className="text-sm font-bold">Como você está hoje?</p>
          <p className="text-xs text-muted-foreground">1ª tarefa do desafio de hoje 🔥</p>
          <div className="mt-2.5 flex justify-between gap-1">
            {MOODS.map((m) => (
              <button
                key={m.label}
                onClick={() => doCheckin(m.label)}
                className="press flex flex-1 flex-col items-center gap-0.5 rounded-xl bg-slate-50 py-2 hover:bg-pink-50"
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[10px] font-medium text-muted-foreground">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Caminho contínuo em tela cheia (Duolingo-style) ──
          Sem caixa nem scroll interno: a página inteira É o caminho. */}
      <div
        ref={pathRef}
        className="relative -mx-5 md:mx-0"
        style={{ height: `${height}px` }}
        onPointerMove={arranging ? onPathPointerMove : undefined}
        onPointerUp={arranging ? endDecorDrag : undefined}
        onPointerCancel={arranging ? endDecorDrag : undefined}
      >
        {/* Cenário (papel de parede) equipado — atrás de tudo */}
        {fundoBg && (
          <div
            className="pointer-events-none absolute inset-0 select-none rounded-2xl opacity-55"
            style={{ background: fundoBg }}
            aria-hidden
          />
        )}
        {/* Os itens do tipo "céu" (nuvem, estrelinhas, sol, arco-íris, lua)
            NÃO têm mais faixa automática. Existia aqui um bloco `sticky` que
            os fazia derivar no alto da tela com `pointer-events-none`: a
            paciente comprava uma nuvem e ela saía voando pelo cenário, sem
            poder ser tocada, selecionada nem movida. Era resquício de uma
            versão anterior ao modo Arrumar, e convivia mal com ele — o mesmo
            item podia estar parado onde ela pôs E voando por cima.
            Agora céu é item como qualquer outro: vai para a bandeja e ela
            escolhe o lugar e o tamanho. */}

        {/* Escudo do modo Arrumar: cobre as lições pra um toque na trilha não
            abrir o dia por engano. As lições em si ficam intactas. */}
        {arranging && (
          <div
            className="absolute inset-0 z-30"
            onPointerDown={() => setSelDecor(null)}
            aria-hidden
          />
        )}

        {/* Enfeites onde a paciente colocou, do tamanho que ela escolheu. */}
        {visiblePlaced.map((p) => {
          const item = CANTINHO_BY_ID[p.id];
          if (!item) return null;
          const sel = arranging && selDecor === p.k;
          return (
            <span
              key={p.k}
              className={`dc-decor absolute select-none drop-shadow-sm ${
                arranging ? "cursor-grab" : "pointer-events-none"
              }`}
              style={{
                left: `${p.x}%`,
                top: `${p.y}px`,
                transform: "translate(-50%,-50%)",
                // Só o item arrastado trava o scroll da página.
                touchAction: arranging ? "none" : undefined,
                zIndex: arranging ? 31 : undefined,
              }}
              title={item.name}
              aria-hidden={!arranging}
              onPointerDown={arranging ? (e) => startDecorDrag(e, p, "move") : undefined}
            >
              {sel && (
                <span
                  className="absolute -inset-4 rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50/40"
                  aria-hidden
                />
              )}
              {/* Nada se mexe enquanto ela arruma. Antes só o item SELECIONADO
                  ficava parado, então os outros continuavam andando debaixo do
                  dedo na hora de pegar — alvo móvel de 32px no celular. */}
              <DecorSprite p={p} still={sel || arranging} />
              {sel && (
                <>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => removeDecor(p.k)}
                    aria-label={`Tirar ${item.name} da trilha`}
                    className="absolute -left-6 -top-6 flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-sm font-bold text-white shadow-md"
                  >
                    ✕
                  </button>
                  <span
                    role="slider"
                    tabIndex={0}
                    aria-label={`Tamanho de ${item.name}`}
                    aria-valuemin={DECOR_MIN_SCALE}
                    aria-valuemax={DECOR_MAX_SCALE}
                    aria-valuenow={Number(p.s.toFixed(2))}
                    onPointerDown={(e) => startDecorDrag(e, p, "size")}
                    onKeyDown={(e) => {
                      const step = e.key === "ArrowUp" ? 0.2 : e.key === "ArrowDown" ? -0.2 : 0;
                      if (!step) return;
                      e.preventDefault();
                      setPlaced((prev) =>
                        prev.map((q) =>
                          q.k === p.k
                            ? {
                                ...q,
                                s: clampN(q.s + step, DECOR_MIN_SCALE, DECOR_MAX_SCALE),
                              }
                            : q,
                        ),
                      );
                    }}
                    className="absolute -bottom-6 -right-6 flex h-8 w-8 cursor-nwse-resize touch-none items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white shadow-md"
                  >
                    ⤢
                  </span>
                </>
              )}
            </span>
          );
        })}
        {nodes.map((node) => {
          if (node.kind === "phase-banner") {
            const p = node.phase;
            const tm = trimMeta(p.from);
            const locked = p.from * 7 > todayD;
            return (
              <div
                key={`b${p.n}`}
                className="absolute inset-x-4 md:inset-x-0"
                style={{ top: `${node.y}px` }}
              >
                <div
                  className={`flex items-center justify-between rounded-2xl ${locked ? "bg-slate-300" : tm.banner} px-5 py-4 text-white`}
                  style={{
                    boxShadow: `0 4px 0 ${locked ? "#94a3b8" : tm.lip}, 0 10px 24px -10px rgba(0,0,0,0.18)`,
                  }}
                >
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                      Fase {p.n} · Semanas {p.from}–{p.to}
                    </p>
                    <p className="mt-0.5 text-xl font-extrabold">{p.name}</p>
                  </div>
                  <div className={`text-4xl ${locked ? "opacity-50 grayscale" : ""}`}>
                    {locked ? <IconeCadeado className="h-5 w-5 text-slate-400" /> : p.emoji}
                  </div>
                </div>
              </div>
            );
          }

          // Tela limpa: sem decorações grátis. Só os itens do Cantinho que a
          // paciente COMPROU aparecem (renderizados acima, via `decor`).
          /**
           * O mascote NÃO entra na trilha. É regra de produto, não descuido.
           *
           * Esta tela é inteiramente personalizada — o céu muda com a hora
           * real, a decoração é a que a paciente comprou, e a bolinha do dia é
           * a única coisa que pede o toque dela. Um personagem espalhado por
           * aqui compete com tudo isso: é o único elemento que ela não
           * escolheu e não pode tirar.
           *
           * O lugar dele é DENTRO do jogo — nas telas de bem-estar, na
           * celebração, no fim do quiz — e, no futuro, como item comprável no
           * Cantinho, aí sim com a posição definida por ela.
           *
           * Os nós continuam sendo montados de propósito: o cálculo de altura
           * da trilha depende deles, e removê-los da montagem deslocaria todo
           * o caminho.
           */
          if (node.kind === "mascot") return null;

          if (node.kind === "week-header") {
            const ms = MILESTONES[node.week];
            const start = node.week * 7;
            // Semana inteira no futuro fica cinza, igual às bolinhas dos dias:
            // a cor é a régua de "isso já é seu" no caminho todo.
            const porVir = start > todayD;
            const tm = porVir ? LOCKED : trimMeta(node.week);
            const dias = Array.from({ length: 7 }, (_, i) => ({
              done: doneDays.includes(start + i),
              today: start + i === todayD,
              future: start + i > todayD,
            }));
            return (
              <div
                key={`h${node.week}`}
                className="absolute inset-x-3 md:inset-x-0"
                style={{ top: `${node.y + 8}px` }}
              >
                <WeekBar
                  title={`Semana ${node.week}`}
                  sub={ms?.label}
                  main={tm.main}
                  lip={tm.lip}
                  days={dias}
                  current={todayD >= start && todayD <= start + 6}
                  // O álbum só abre a partir da semana atual — antes disso não
                  // há memória para guardar, e a figurinha estragaria a surpresa.
                  onAlbum={porVir ? undefined : () => openAlbum(node.week)}
                  albumDone={stickers.includes(node.week)}
                />
              </div>
            );
          }

          if (node.kind === "lesson") {
            const m = LESSON_BY_WEEK.get(node.week)!;
            const done = lessonsDone[node.week] != null;
            const unlocked = node.week <= currentWeek;
            const tm = trimMeta(node.week);
            return (
              <button
                key={`l${node.week}`}
                onClick={() => unlocked && setLessonSheet(m)}
                disabled={!unlocked}
                className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center focus:outline-none disabled:cursor-not-allowed"
                style={{ left: `${node.x}%`, top: `${node.y}px` }}
                aria-label={`Lição da semana ${node.week}: ${m.title}`}
              >
                <div className="relative">
                  {/* Lição disponível e não feita: halo dourado convida o toque */}
                  {unlocked && !done && (
                    <span
                      className="dc-halo pointer-events-none absolute inset-0 rounded-full"
                      style={{ boxShadow: "0 0 26px 5px rgba(245,158,11,0.4)" }}
                    />
                  )}
                  <div
                    className="duo3d relative flex h-[68px] w-[68px] items-center justify-center rounded-full"
                    style={
                      {
                        background: !unlocked
                          ? `linear-gradient(180deg, color-mix(in oklab, ${LOCKED.main} 88%, white) 0%, ${LOCKED.main} 60%)`
                          : done
                            ? "linear-gradient(180deg, #fcd34d 0%, #f59e0b 60%)"
                            : `linear-gradient(180deg, color-mix(in oklab, ${tm.main} 78%, white) 0%, ${tm.main} 55%)`,
                        "--lip": !unlocked ? LOCKED.lip : done ? "#b45309" : tm.lip,
                        boxShadow: "0 6px 0 var(--lip)",
                      } as React.CSSProperties
                    }
                  >
                    <span className="relative z-10 text-3xl">
                      {!unlocked ? "🔒" : done ? "⭐" : "📚"}
                    </span>
                    <span className="dc-coin-shine" aria-hidden />
                  </div>
                </div>
                <span
                  className={`mt-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide shadow-sm ${
                    !unlocked
                      ? "bg-white/80 text-slate-400"
                      : done
                        ? "bg-amber-100 text-amber-700"
                        : "bg-white/90 " + tm.softText
                  }`}
                >
                  {done ? "Lição completa" : "Lição"}
                </span>
              </button>
            );
          }

          const { D, week } = node;
          const isToday = D === todayD;
          const done = doneDays.includes(D);
          const isPast = D < todayD;
          const isFuture = D > todayD;
          const tm = trimMeta(week);
          const palette = done || isToday ? tm : isPast ? missedTint(tm) : futureTint(tm);
          const dia = isToday ? 84 : 64;
          const dayOfWeek = (D % 7) + 1;
          // Progresso de hoje em MEIAS estrelas (0–6): aula + 5 jogos de bem-estar.
          const feitosHoje = isToday ? momentosDoDia(todayTasks) : 0;

          return (
            <div key={`d${D}`}>
              <button
                id={isToday ? "dc-today-node" : undefined}
                onClick={() => {
                  /* ─── ESPIAR O QUE VEM (ago/2026) ────────────────────────
                     Pedido do dono: "eu tenho que conseguir acessar também os
                     próximos exercícios". Quem assina passa a ABRIR o dia que
                     ainda não chegou; quem não assina continua com o "um passo
                     de cada vez", que é a pedagogia da trilha.

                     ⚠️ E isto NÃO abre buraco de economia: `canEarn` é
                     `D === todayD` e sozinho já barra Sementinhas, estrela,
                     fechamento do dia e sequência — a espiada é de LEITURA por
                     construção, em todos os blocos. É a mesma porta que o
                     Premium já tinha para o passado (`locked: !isT &&
                     !quizPremium`), agora simétrica para o futuro. */
                  if (isFuture && !quizPremium) {
                    const em = D - todayD;
                    toast(
                      `🔒 Esse dia abre ${em === 1 ? "amanhã" : `em ${em} dias`} — um passo de cada vez 💛`,
                    );
                    return;
                  }
                  openDay(D);
                }}
                aria-disabled={isFuture && !quizPremium}
                className={`group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center focus:outline-none ${isFuture && !quizPremium ? "cursor-not-allowed" : ""}`}
                style={{ left: `${node.x}%`, top: `${node.y}px` }}
                /* O rótulo diz o ESTADO, não só a data. Eram ~300 botões com
                   "Dia 3 da semana 12" e nada mais: um leitor de tela lia
                   trezentos rótulos quase idênticos, sem nenhuma âncora para
                   achar onde a paciente está nem o que já fez. */
                aria-label={
                  `Dia ${dayOfWeek} da semana ${week}` +
                  (isToday
                    ? `, hoje — ${feitosHoje} de ${TOTAL_DO_DIA} atividades`
                    : done
                      ? ", concluído"
                      : isFuture
                        ? `, abre em ${D - todayD} ${D - todayD === 1 ? "dia" : "dias"}`
                        : ", não concluído")
                }
                aria-current={isToday ? "date" : undefined}
              >
                {isToday && (
                  <div className="duo-bubble absolute -top-11 z-20 whitespace-nowrap">
                    <div className="relative rounded-xl bg-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-pink-500 shadow-[0_3px_10px_rgba(0,0,0,0.12)]">
                      {done ? "Desafio completo ✓" : "Desafio de hoje 🎁"}
                      <div className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-white" />
                    </div>
                  </div>
                )}
                <div className="relative">
                  {/* Halo pulsante convida o toque (opacity-only, zero repaint) */}
                  {isToday && !done && (
                    <span
                      className="dc-halo pointer-events-none absolute inset-0 rounded-full"
                      style={{ boxShadow: `0 0 30px 6px ${tm.main}55` }}
                    />
                  )}
                  {/* Aqui orbitava uma faísca ✨ em volta da bolinha de hoje.
                      Saiu a pedido do Clóvis: o nó de hoje já é o maior da
                      trilha, já tem halo, já tem o balão "DESAFIO DE HOJE" e
                      já tem o anel de tarefas. A faísca era o quinto sinal
                      apontando para a mesma coisa — e o único que se MEXE o
                      tempo todo, no canto do olho de quem só quer ler o que
                      tem para fazer hoje. */}
                  {/* Anel segmentado: 3 segmentos = as 3 tarefas de hoje */}
                  {isToday && (
                    <TaskRing
                      done={done ? TOTAL_DO_DIA : feitosHoje}
                      total={TOTAL_DO_DIA}
                      color={tm.main}
                    />
                  )}
                  {peleAtiva ? (
                    /* COM PELE: a arte substitui a bolinha inteira, sem o
                       relevo 3D nem o brilho — a imagem já traz o próprio
                       volume, e empilhar os dois daria um objeto dentro de um
                       botão. O ✓ e o 🎁 também saem: quem diz o estado agora é
                       o desenho (semente / broto / flor), que é exatamente o
                       que a pele veio fazer. */
                    <img
                      src={peleAtiva.arte[estadoDoNo(done, isToday)]}
                      alt=""
                      aria-hidden
                      className={`relative select-none ${isToday && !done ? "dc-chest" : ""}`}
                      style={{
                        width: `${dia * 1.42}px`,
                        height: `${dia * 1.42}px`,
                        /* 42% maior que a bolinha, medido comparando as duas
                           trilhas lado a lado: a arte tem ar em volta do
                           objeto, então na medida exata o nó com pele parece
                           menor que o sem, e a trilha fica irregular. */
                        filter: `drop-shadow(0 6px 10px ${palette.main}55)`,
                      }}
                    />
                  ) : (
                    <div
                      className={`duo3d relative flex items-center justify-center overflow-hidden rounded-full ${
                        isToday && !done ? "dc-chest" : ""
                      }`}
                      style={
                        {
                          width: `${dia}px`,
                          height: `${dia}px`,
                          background: `radial-gradient(120% 120% at 32% 24%, color-mix(in oklab, ${palette.main} 55%, white) 0%, ${palette.main} 58%, color-mix(in oklab, ${palette.main} 82%, black) 100%)`,
                          "--lip": palette.lip,
                          boxShadow: `0 ${isToday ? 8 : 6}px 0 ${palette.lip}, 0 12px 24px -10px ${palette.main}99`,
                        } as React.CSSProperties
                      }
                    >
                      {/* Sem números: as bolinhas falam pela cor e pelo brilho (estilo da logo) */}
                      {isToday && !done ? (
                        <span className="relative z-10 text-3xl">🎁</span>
                      ) : done ? (
                        <span
                          className={`relative z-10 font-black text-white ${isToday ? "text-3xl" : "text-2xl"}`}
                        >
                          ✓
                        </span>
                      ) : null}
                      <span className="dc-coin-shine" aria-hidden />
                    </div>
                  )}
                </div>
                {/* As 5 estrelas do dia, uma por momento. Só em HOJE e nos dias
                    FEITOS: num dia passado que ela não jogou, três estrelas
                    apagadas não informam nada — repetidas ao longo da trilha
                    viram ruído, e ainda por cima parecem cobrança. */}
                {(isToday || done) && !careMode && (
                  <div className="mt-1.5 drop-shadow-sm">
                    {/* As CINCO enfileiradas quando o dia fecha — só no nó de
                        hoje, e só no instante em que fecha. Depois dela, o
                        placar volta a ser o placar. */}
                    {/* ⚠️ Sem animação AQUI. As duas comemorações moram na
                        folha do dia, que é onde a paciente está no instante da
                        conquista — na trilha elas tocavam atrás de uma tela
                        opaca e se apagavam antes de ela voltar. */}
                    <StarMeter feitos={done ? TOTAL_DO_DIA : feitosHoje} px={13} />
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Folga para a barra de navegação inferior do app */}
      <div className="h-16" />

      {/* Intro imersiva da aula (Duolingo): moeda salta, depois o sheet abre */}
      {/* PORTAL para o <body>, e não uma div aqui dentro.
          `position: fixed` se resolve contra o ancestral mais próximo que
          tenha `transform`, `filter`, `backdrop-filter`, `contain` ou
          `perspective` — e esta tela vive lá no fundo da árvore da aba, atrás
          de vários cartões de vidro. Bastava um deles para a "tela cheia"
          virar uma caixa do tamanho do cartão, deixando a trilha aparecendo
          em cima e embaixo. No body não há ancestral nenhum: ela cobre a
          janela, ponto. */}
      {wellnessDay !== null &&
        typeof document !== "undefined" &&
        createPortal(
          (() => {
            const D = wellnessDay;
            const isT = D === todayD;
            const wk = Math.max(1, Math.min(42, Math.floor(D / 7)));
            const q = quizForDay(D);
            const st = wellnessDay === D ? dayTasks : dayTaskState(D);
            const chD = challengeForDay(D);
            const lessonDone = !!st.desafio || doneDays.includes(D);
            return (
              <WellnessScreen
                day={D}
                canEarn={isT}
                careMode={careMode}
                halves={
                  bancada?.halves ?? (doneDays.includes(D) ? TOTAL_DO_DIA : momentosDoDia(st))
                }
                babyName={profile?.baby_name ?? null}
                anim={bancada?.anim}
                enfeites={
                  bancada?.enfeites ??
                  trayItems.map((id) => CANTINHO_BY_ID[id]?.emoji).filter((e): e is string => !!e)
                }
                lesson={
                  q
                    ? {
                        kind: "quiz" as const,
                        quiz: q,
                        emoji: quizEmojiForDay(D),
                        week: wk,
                        alreadyDone: lessonDone,
                        locked: !isT && !quizPremium,
                        showAd: isT && !quizPremium,
                      }
                    : {
                        kind: "challenge" as const,
                        label: chD.label,
                        emoji: chD.emoji,
                        alreadyDone: lessonDone,
                      }
                }
                onEarn={(key) => {
                  markDayTask(D, `w_${key}`, true);
                  markDayTask(D, "bemestar", true); // legado: ≥1 atividade feita
                }}
                onEarnLesson={() => markDayTask(D, "desafio", true)}
                onSyncWellness={(keys) => {
                  // Espelha o progresso do servidor (outro aparelho) nas meias locais.
                  const cur = dayTaskState(D);
                  keys.forEach((k) => {
                    if (!cur[`w_${k}`]) markDayTask(D, `w_${k}`, true);
                  });
                }}
                onClose={() => setWellnessDay(null)}
              />
            );
          })(),
          document.body,
        )}

      {intro !== null && (
        <QuizIntro
          D={intro}
          isToday={intro === todayD}
          babyLabel={babyLabel}
          onDone={() => {
            const D = intro;
            setIntro(null);
            reallyOpenDay(D);
          }}
        />
      )}

      {/* A folha do dia saiu daqui. O nó da trilha abre as atividades direto —
          ver `reallyOpenDay`. Ela só embrulhava um botão "Jogar ›" cujo único
          destino era a tela que já existe. */}

      {/* Sheet de ÁLBUM */}
      {sheet?.kind === "album" && (
        <AlbumSheet
          week={sheet.week}
          babyLabel={babyLabel}
          revealing={revealing}
          onClose={() => setSheet(null)}
          onShare={share}
          careMode={careMode}
        />
      )}

      {/* Sheet de LIÇÃO (Escola do Bebê dentro do caminho) */}
      {lessonSheet && (
        <LessonSheet
          module={lessonSheet}
          savedScore={lessonsDone[lessonSheet.week] ?? null}
          revealing={revealing}
          onComplete={(score) => completeLesson(lessonSheet.week, score)}
          onClose={() => setLessonSheet(null)}
          careMode={careMode}
        />
      )}
    </div>
  );
}

/* ══════════════════ Sheet de álbum (gestação) — compartilhado ══════════════════ */

function AlbumSheet({
  week,
  babyLabel,
  revealing,
  onClose,
  onShare,
  careMode = false,
}: {
  week: number;
  babyLabel: string;
  revealing: boolean;
  onClose: () => void;
  onShare: (week: number) => void;
  careMode?: boolean;
}) {
  const baby = babyForWeek(week);
  const tm = trimMeta(week);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: "rgba(0,0,0,0.2)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 pb-10 shadow-2xl"
        style={{ animation: "slideUp 300ms cubic-bezier(0.34,1.56,0.64,1) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        {revealing && !careMode && <ConfettiBurst />}
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-slate-200" />

        <div className="mb-4 flex items-center gap-3">
          <div
            className={`duo3d flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-3xl ${revealing ? "dc-sticker-pop" : ""}`}
            style={{ background: tm.main, "--lip": tm.lip } as React.CSSProperties}
          >
            {fruitEmojiForWeek(week)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Memória · Semana {week}
            </p>
            <h3 className="mt-0.5 truncate text-2xl font-extrabold">{baby.fruit}</h3>
          </div>
          <button
            onClick={() => onShare(week)}
            className="press shrink-0 rounded-full bg-pink-50 px-3 py-2 text-sm font-bold text-pink-600"
          >
            Enviar 💌
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-pink-50 p-3">
            <p className="text-xs font-bold text-pink-600">📏 Tamanho</p>
            <p className="mt-0.5 text-lg font-extrabold">{baby.size}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-3">
            <p className="text-xs font-bold text-amber-600">⚖️ Peso</p>
            <p className="mt-0.5 text-lg font-extrabold">{baby.weight}</p>
          </div>
        </div>

        <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
          Nessa semana, {baby.desc.charAt(0).toLowerCase() + baby.desc.slice(1)}
        </p>

        {MILESTONES[week] && (
          <div className="rounded-2xl bg-violet-50 p-3">
            <p className="text-sm font-bold text-violet-700">
              🎯 {babyLabel} já conquistou: {MILESTONES[week].label}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════ Sheet de lição (Escola do Bebê no caminho) ══════════════════ */

function LessonSheet({
  module: m,
  savedScore,
  revealing,
  onComplete,
  onClose,
  careMode = false,
}: {
  module: CourseModule;
  savedScore: number | null;
  revealing: boolean;
  onComplete: (score: number) => void;
  onClose: () => void;
  careMode?: boolean;
}) {
  const alreadyDone = savedScore != null;
  const total = m.quiz.length;
  const tm = trimMeta(m.week);
  const [phase, setPhase] = useState<"intro" | "quiz" | "done">("intro");
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [reward, setReward] = useState<number | null>(null);
  const finishedRef = useRef(false);

  const q = m.quiz[qIndex];
  const score = alreadyDone ? (savedScore ?? 0) : Math.round((correctCount / total) * 100);
  const progressPct =
    phase === "done" ? 100 : phase === "intro" ? 4 : Math.round((qIndex / total) * 100);

  function startQuiz() {
    setPhase("quiz");
    setQIndex(0);
    setSelected(alreadyDone ? m.quiz[0].correct : null);
    setChecked(alreadyDone);
  }

  function check() {
    if (selected == null) return;
    setChecked(true);
    if (selected === q.correct) setCorrectCount((c) => c + 1);
  }

  async function finish(finalCorrect: number) {
    setPhase("done");
    if (alreadyDone || finishedRef.current) return;
    finishedRef.current = true;
    onComplete(Math.round((finalCorrect / total) * 100));
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (token) {
        const r = await grantLessonReward({
          data: { accessToken: token, week: m.week, correct: finalCorrect },
        });
        if (r.ok) setReward(r.granted);
      }
    } catch {
      /* recompensa é secundária */
    }
  }

  function next() {
    // correctCount já foi incrementado em check(); no último passo reflete tudo.
    if (qIndex + 1 >= total) {
      finish(correctCount);
      return;
    }
    const ni = qIndex + 1;
    setQIndex(ni);
    setSelected(alreadyDone ? m.quiz[ni].correct : null);
    setChecked(alreadyDone);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      style={{ paddingTop: "var(--safe-top)" }}
    >
      {revealing && !careMode && <ConfettiBurst />}

      {/* Topo: fechar + progresso */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="press text-2xl leading-none text-slate-400"
        >
          ✕
        </button>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {phase === "intro" && (
          <div>
            <div className="mt-4 flex flex-col items-center text-center">
              <div
                className="duo3d flex h-20 w-20 items-center justify-center rounded-3xl text-4xl"
                style={{ background: tm.main, "--lip": tm.lip } as React.CSSProperties}
              >
                📚
              </div>
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Lição · Semana {m.week}
                {alreadyDone && <span className="ml-1 text-amber-500">· ⭐ {savedScore}%</span>}
              </p>
              <h3 className="mt-1 text-2xl font-extrabold leading-tight">{m.title}</h3>
              <p className="text-sm text-muted-foreground">{m.theme}</p>
            </div>
            <div className="mt-5 rounded-2xl bg-violet-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-violet-600">
                📖 Para aprender hoje
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-violet-950">{m.content}</p>
            </div>
          </div>
        )}

        {phase === "quiz" && q && (
          <div>
            <p className="mt-4 text-xs font-bold uppercase tracking-wider text-emerald-600">
              Pergunta {qIndex + 1} de {total}
            </p>
            <h3 className="mt-2 text-2xl font-extrabold leading-tight text-foreground">
              {q.question}
            </h3>
            <div className="mt-5 flex flex-col gap-3">
              {q.options.map((opt, oi) => {
                let cls = "border-slate-200 bg-white text-foreground";
                if (checked) {
                  if (oi === q.correct) cls = "border-emerald-500 bg-emerald-50 text-emerald-800";
                  else if (oi === selected) cls = "border-rose-400 bg-rose-50 text-rose-700";
                  else cls = "border-slate-100 text-slate-400";
                } else if (selected === oi) {
                  cls = "border-emerald-500 bg-emerald-50 text-emerald-900";
                }
                return (
                  <button
                    key={oi}
                    disabled={checked}
                    onClick={() => setSelected(oi)}
                    className={`press rounded-2xl border-2 px-4 py-4 text-left text-base font-semibold transition-colors ${cls}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {checked && (
              <div
                className={`mt-4 rounded-2xl p-3 text-sm font-bold ${
                  alreadyDone || selected === q.correct
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-700"
                }`}
              >
                {alreadyDone
                  ? "Resposta correta destacada em verde."
                  : selected === q.correct
                    ? "Certíssimo! 🎉"
                    : "Quase! A resposta certa está em verde. 💛"}
              </div>
            )}
          </div>
        )}

        {phase === "done" && (
          <div className="mt-10 flex flex-col items-center text-center">
            <p className="text-6xl">{score === 100 ? "🏆" : score >= 67 ? "🎉" : "💪"}</p>
            <h3 className="mt-3 text-2xl font-extrabold">
              {score === 100 ? "Perfeito!" : score >= 67 ? "Muito bem!" : "Lição completa!"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {alreadyDone
                ? `${score}% na sua última tentativa`
                : `${correctCount} de ${total} acertos · ${score}%`}
            </p>
            {!careMode && reward != null && reward > 0 && (
              <div className="mt-5 rounded-full bg-emerald-100 px-5 py-2 text-base font-extrabold text-emerald-700">
                +{reward} 🌱 Sementinhas!
              </div>
            )}
            {!alreadyDone && score < 67 && (
              <p className="mt-3 max-w-xs text-xs text-muted-foreground">
                Toda tentativa vale — releia o conteúdo quando quiser pra fixar. 💛
              </p>
            )}
          </div>
        )}
      </div>

      {/* Barra de ação inferior */}
      <div
        className="border-t border-slate-100 p-4"
        style={{ paddingBottom: "calc(1rem + var(--safe-bottom))" }}
      >
        {phase === "intro" && (
          <button
            onClick={startQuiz}
            className="press w-full rounded-full bg-emerald-500 py-3.5 text-sm font-extrabold text-white"
          >
            {alreadyDone ? "Revisar as respostas" : "Começar o quiz"}
          </button>
        )}
        {phase === "quiz" && !checked && (
          <button
            onClick={check}
            disabled={selected == null}
            className="press w-full rounded-full bg-emerald-500 py-3.5 text-sm font-extrabold text-white disabled:opacity-40"
          >
            Verificar
          </button>
        )}
        {phase === "quiz" && checked && (
          <button
            onClick={next}
            className="press w-full rounded-full bg-pink-500 py-3.5 text-sm font-extrabold text-white"
          >
            {qIndex + 1 >= total ? "Ver resultado" : "Continuar"}
          </button>
        )}
        {phase === "done" && (
          <button
            onClick={onClose}
            className="press w-full rounded-full bg-pink-500 py-3.5 text-sm font-extrabold text-white"
          >
            Voltar ao caminho
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════ Paywall das aulas premium ══════════════════
   Grátis: só a aula do dia de HOJE. Premium: revisitar/fazer qualquer aula
   já liberada. Pagamento assistido: PIX + comprovante no WhatsApp e o
   consultório ativa o acesso (toggle no painel do médico). */

/* ─── TRÊS CONSTANTES DE PREÇO MORTAS SAÍRAM DAQUI ────────────────────────
   `QUIZ_PRICE_MONTHLY` (19,9), `QUIZ_PRICE_ANNUAL_MONTH` (9,9) e
   `QUIZ_PRICE_ANNUAL_TOTAL` (118,80). Nenhuma era referenciada em lugar nenhum
   do arquivo — a tela já lê os preços do servidor —, e as três guardavam a
   tabela ANTIGA. Constante de preço morta é a pior espécie de código morto:
   parece autoridade, e alguém a usa achando que é a fonte. */

function QuizPaywall({
  week,
  context = "past",
  peek,
}: {
  week: number;
  context?: "past" | "ad";
  /** A aula que está atrás do portão — o conteúdo aparece, jogar é que não. */
  peek?: DailyQuiz | null;
}) {
  const [plan, setPlan] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  /* Mesmo portão da OfertaPremium e da LojaSementinhas: assinatura digital
     dentro do app nativo tem de passar pela loja da Apple/Google (3.1.1).
     Este paywall era o único dos três que ainda abria o Stripe direto. */
  const [nativo, setNativo] = useState(false);
  useEffect(() => setNativo(ehNativo()), []);
  const veredito = podeComprarAqui("premium_paciente", nativo);

  /* A mesma oferta de boas-vindas da folha do Cantinho.
     Precisa estar nos DOIS lugares: a paciente que visse 61% num paywall e o
     preço cheio no outro acharia que um dos dois está mentindo — e o desconto
     seria aplicado no checkout de qualquer jeito, porque quem decide é o
     servidor. Melhor ela saber o que está levando. */
  const [oferta, setOferta] = useState<PrecosDaPaciente | null>(null);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: s } = await supabase.auth.getSession();
        if (!s.session) return;
        const { getPrecosDaPaciente } = await import("@/lib/promo.functions");
        const o = await getPrecosDaPaciente({ data: { accessToken: s.session.access_token } });
        if (!vivo) return;
        setOferta(o);
        /* O anual é SEMPRE o de melhor valor agora — antes isto era
           condicional à promoção estar viva. Não há mais estado em que faça
           sentido abrir no mensal. */
        setPlan("annual");
      } catch {
        /* Sem resposta do servidor, os cartões ficam com "—": preço é a única
           coisa desta tela que não pode ser adivinhada. */
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);
  /* Os preços vêm do servidor; a tela não inventa nenhum.

     O `comCupom` que morava aqui saiu junto com o cupom do médico: o cartaz do
     anual sempre apareceu, porque o desconto contra pagar mês a mês existe por
     si — o cupom só mudava QUANTO. Agora há um preço só, para todas. */

  // Código do médico Elite: a paciente digita e ganha o premium na hora.
  async function redeem() {
    if (code.trim().length < 4) {
      toast.error("Digite o código do seu médico.");
      return;
    }
    setRedeeming(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        toast.error("Entre na sua conta para usar o código.");
        setRedeeming(false);
        return;
      }
      const { redeemInviteCode } = await import("@/lib/invites.functions");
      const res = await redeemInviteCode({
        data: { accessToken: s.session.access_token, code: code.trim() },
      });
      if (res.ok) {
        /* ─── O QUE O CÓDIGO DÁ MUDOU, E A FRASE TINHA FICADO ─────────────
           Ela dizia "Premium liberado pelo seu médico". O resgate parou de
           escrever `quiz_premium` quando o médico deixou de dar a assinatura,
           e depois parou de dar desconto também: hoje ele vincula a paciente ao
           médico e paga o bônus de Sementinhas.

           Uma tela que anuncia Premium e entrega outra coisa é pior que uma que
           não anuncia nada — ela vai procurar o Premium e não achar. */
        /* ─── A FRASE DEPENDE DE QUAL CÓDIGO FOI ─────────────────────────
           O mesmo campo aceita o cupom da PLATAFORMA (concede Premium) e o
           código do MÉDICO (vincula e paga Sementinhas). Anunciar um pelo outro
           manda a paciente procurar o que não existe — e já errou nas duas
           direções nesta base. Quem sabe qual foi é o servidor: `res.tipo`. */
        toast.success(
          res.tipo === "convite"
            ? `Médico vinculado! Você ganhou ${BONUS_VINCULO_MEDICO} Sementinhas 🌱`
            : "Premium liberado! 💛",
        );
        setTimeout(() => window.location.reload(), 1200);
        return;
      }
      const msg: Record<string, string> = {
        codigo_invalido: "Código não encontrado. Confira com o seu médico.",
        codigo_usado: "Este código já foi usado. Peça um novo ao seu médico.",
        codigo_inativo: "Este código não está mais ativo.",
        cota_esgotada: "O seu médico já usou todos os convites deste mês.",
        nao_autenticado: "Entre na sua conta para usar o código.",
        falha_resgate: "Não foi possível resgatar. Tente novamente.",
        falha_ao_liberar:
          "O código foi aceito, mas o Premium não entrou. Tente de novo — o código continua seu.",
      };
      toast.error(msg[res.error ?? ""] ?? "Não foi possível resgatar o código.");
    } catch {
      toast.error("Não foi possível resgatar o código.");
    }
    setRedeeming(false);
  }

  // Assinatura recorrente por cartão (Stripe): paga → o webhook libera o
  // acesso na hora. A UI só leva ao checkout seguro, nunca concede nada.
  async function subscribe() {
    setLoading(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        toast.error("Entre na sua conta para assinar.");
        setLoading(false);
        return;
      }
      const { createSubscriptionCheckout } = await import("@/lib/billing.functions");
      // Afiliado (influenciador): código guardado do link ?ref= vira
      // atribuição/comissão — validado no servidor.
      const { storedAffiliateCode } = await import("@/routes/__root");
      const refCode = storedAffiliateCode();
      const res = await createSubscriptionCheckout({
        data: {
          accessToken: s.session.access_token,
          product: "quiz_premium",
          plan,
          returnPath: "/minha-conta",
          ...(refCode ? { refCode } : {}),
        },
      });
      if (res.ok && res.url) {
        window.location.href = res.url;
        return;
      }
      toast.error(
        res.error === "pagamento_indisponivel"
          ? "O pagamento está sendo configurado. Tente em instantes."
          : "Não foi possível abrir o pagamento. Tente novamente.",
      );
    } catch {
      toast.error("Não foi possível abrir o pagamento. Tente novamente.");
    }
    setLoading(false);
  }

  const PlanCard = ({
    id,
    label,
    price,
    sub,
    badge,
  }: {
    id: "monthly" | "annual";
    label: string;
    price: string;
    sub: string;
    badge?: string;
  }) => {
    const active = plan === id;
    return (
      <button
        type="button"
        onClick={() => setPlan(id)}
        aria-pressed={active}
        className={`relative rounded-xl border-2 p-2.5 text-center transition-colors ${
          active ? "border-amber-500 bg-white" : "border-amber-200 bg-white/70"
        }`}
      >
        {badge && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black text-white">
            {badge}
          </span>
        )}
        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">{label}</p>
        <p className="text-lg font-extrabold text-amber-900">{price}</p>
        <p className="text-[10px] text-amber-700">{sub}</p>
      </button>
    );
  };

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 to-orange-50 p-4">
      <div className="flex items-start gap-3">
        <div
          className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full"
          style={{
            background: `radial-gradient(120% 120% at 32% 24%, #fde68a 0%, #f59e0b 60%, #b45309 100%)`,
            boxShadow: "0 5px 0 #b45309",
          }}
        >
          <span className="relative z-10 text-2xl">👑</span>
          <span className="dc-coin-shine" aria-hidden />
        </div>
        <div className="min-w-0">
          {context === "ad" ? (
            <>
              <p className="text-sm font-extrabold text-amber-900">Gostou de aprender hoje? 🌟</p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
                {/* "faça" saiu. As Sementinhas e a estrela só são concedidas no
                    dia corrente — no servidor, não só na tela — então a aula de
                    ontem é releitura, e prometer que ela "faz" é prometer um
                    ganho que não vem. Entrou no lugar o benefício maior e que o
                    texto escondia: 38 dos 74 enfeites do Cantinho e a Coroa da
                    Coleção são exclusivos do premium, e nada disso era dito. */}
                No plano grátis você faz <strong>só a aula de hoje</strong>. Com o{" "}
                <strong>Obstétrica Premium</strong> você <strong>revê todas as aulas</strong> que já
                passaram e libera <strong>dezenas de enfeites exclusivos</strong> do seu Cantinho.
                💛
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-extrabold text-amber-900">Aula premium 🔒</p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
                Essa aula é de um dia que já passou. No plano grátis você faz{" "}
                <strong>a aula de cada dia</strong> no próprio dia. Com o premium, você{" "}
                <strong>revê todas as aulas já liberadas</strong> quando quiser — e libera{" "}
                <strong>dezenas de enfeites exclusivos</strong> do seu Cantinho.
              </p>
            </>
          )}
        </div>
      </div>

      {/* O que está atrás do portão. Esconder a aula inteira fazia o dia
          passado parecer vazio; aqui os exercícios aparecem (só o enunciado —
          as alternativas e o gabarito continuam do lado de dentro). */}
      {peek && peek.questions.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-white/70 p-3">
          <p className="text-[11px] font-black uppercase tracking-wider text-amber-600">
            Nesta aula · {peek.questions.length} exercícios
          </p>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-amber-900/80">
            {peek.teach}
          </p>
          <ul className="mt-2 space-y-1.5">
            {peek.questions.map((q, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[11px] leading-snug text-amber-800"
              >
                <span
                  className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[9px] font-black text-amber-600"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">{q.q}</span>
                <span aria-hidden>🔒</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {oferta && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3.5 py-2.5 text-white">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/85">
              Plano anual
            </p>
            <p className="font-serif text-xl leading-tight">
              {oferta.descontoAnualPct}% de desconto
            </p>
            {/* O riscado com legenda: R$ 238,80 é o plano mensal por doze
                meses, não um preço anual inflado. Sem a legenda, comparação
                vira propaganda enganosa. */}
            <p className="mt-0.5 text-[11px] leading-tight text-white/80">
              <span className="whitespace-nowrap line-through">
                {brlPromo(oferta.referenciaCentavos)}
              </span>{" "}
              mês a mês →{" "}
              <span className="whitespace-nowrap font-bold text-white">
                {brlPromo(oferta.anualCentavos)}
              </span>
            </p>
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <PlanCard
          id="monthly"
          label="Mensal"
          price={oferta ? brlPromo(oferta.mensalCentavos) : "—"}
          sub="por mês"
        />
        {/* O anual mostra o valor À VISTA e o equivalente mensal só na
            legenda — decisão do dono: R$ 9,16 nunca é apresentado como preço.
            O selo carrega a porcentagem real, e ela é DERIVADA do preço em
            `promo.ts` (nunca escrita à mão), então não há como a etiqueta
            prometer um desconto que a fatura não dá. */}
        <PlanCard
          id="annual"
          label="Anual"
          price={oferta ? brlPromo(oferta.anualCentavos) : "—"}
          sub={
            oferta
              ? `cobrado uma vez · equivale a ${brlPromo(Math.round(oferta.anualCentavos / 12))}/mês`
              : ""
          }
          badge={oferta ? `−${oferta.descontoAnualPct}%` : ""}
        />
      </div>

      {!veredito.pode ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5">
          <p className="text-[13px] font-bold text-amber-900">Ainda não dá para assinar aqui</p>
          {/* Frase vinda de `canal-de-venda.ts` — a mesma que a folha do
              Cantinho usa. Duas telas de preço com textos diferentes sobre a
              mesma regra é como a divergência começa. */}
          <p className="mt-1 text-[12px] leading-relaxed text-amber-800/90">{veredito.texto}</p>
          <p className="mt-1 text-[12px] text-amber-800/90">
            Se o seu médico te deu um código, ele funciona aqui mesmo.
          </p>
        </div>
      ) : (
        <button
          onClick={subscribe}
          disabled={loading}
          className="press mt-3 w-full rounded-full bg-amber-500 py-3 text-sm font-extrabold text-white disabled:opacity-60"
          style={{ boxShadow: "0 4px 0 #b45309" }}
        >
          {loading ? "Abrindo pagamento seguro…" : "✨ Assinar e liberar as aulas"}
        </button>
      )}

      <p className="mt-2 text-center text-[10px] leading-relaxed text-amber-700/80">
        Pagamento seguro por cartão · acesso na hora · cancele quando quiser.
        <br />A aula de hoje continua grátis, todos os dias 💛
      </p>

      {/* Código do médico: vincula a paciente a ele e paga o bônus de
          Sementinhas. NÃO dá Premium — isso saiu em ago/2026. */}
      <div className="mt-3 border-t border-amber-200/70 pt-3">
        {!codeOpen ? (
          <button
            onClick={() => setCodeOpen(true)}
            className="w-full text-center text-xs font-semibold text-amber-800 underline decoration-amber-300 underline-offset-2"
          >
            Tenho o código do meu médico
          </button>
        ) : (
          <div>
            <p className="text-xs font-semibold text-amber-900">
              Digite o código do seu médico e ganhe {BONUS_VINCULO_MEDICO} Sementinhas 🌱
            </p>
            <div className="mt-1.5 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={16}
                placeholder="EX: ABCD2345"
                className="min-w-0 flex-1 rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-mono tracking-widest text-amber-900 outline-none"
              />
              <button
                onClick={redeem}
                disabled={redeeming}
                className="press shrink-0 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"
              >
                {redeeming ? "…" : "Resgatar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════ Intro imersiva da aula (estilo Duolingo) ══════════════════
   Tela cheia por ~1,3s: fundo no tom do trimestre, moeda saltando com anéis,
   "Semana N · Aula de hoje". Toque pula. Reduced-motion nem chega aqui. */

function QuizIntro({
  D,
  isToday,
  babyLabel,
  onDone,
}: {
  D: number;
  isToday: boolean;
  babyLabel: string;
  onDone: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const week = Math.max(1, Math.min(42, Math.floor(D / 7)));
  const tm = trimMeta(week);
  const emoji = quizEmojiForDay(D);
  const skipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(false);

  // onDone dispara exatamente UMA vez (timer natural ou toque para pular)
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 1250);
    const t2 = setTimeout(finish, 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (skipTimer.current) clearTimeout(skipTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden ${
        leaving ? "dc-intro-leave" : ""
      }`}
      style={{
        background: `radial-gradient(120% 100% at 50% 20%, color-mix(in oklab, ${tm.main} 30%, white) 0%, color-mix(in oklab, ${tm.main} 72%, white) 45%, ${tm.main} 100%)`,
        paddingTop: "var(--safe-top)",
      }}
      onClick={() => {
        if (doneRef.current || skipTimer.current) return;
        setLeaving(true);
        skipTimer.current = setTimeout(finish, 180);
      }}
      role="status"
      aria-label="Abrindo a aula de hoje"
    >
      <div className="relative flex items-center justify-center">
        {/* Anéis pulsando para fora */}
        <span
          className="dc-intro-ring absolute h-32 w-32 rounded-full border-4 border-white/50"
          aria-hidden
        />
        <span
          className="dc-intro-ring absolute h-32 w-32 rounded-full border-4 border-white/30"
          style={{ animationDelay: "220ms" }}
          aria-hidden
        />
        {/* Moeda saltando, no mesmo estilo glossy da logo */}
        <div
          className="dc-intro-coin relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full"
          style={{
            background: `radial-gradient(120% 120% at 32% 24%, color-mix(in oklab, ${tm.main} 45%, white) 0%, ${tm.main} 60%, color-mix(in oklab, ${tm.main} 80%, black) 100%)`,
            boxShadow: `0 10px 0 ${tm.lip}, 0 22px 40px -12px rgba(0,0,0,0.35)`,
          }}
        >
          <span className="relative z-10 text-5xl">{emoji}</span>
          <span className="dc-coin-shine" aria-hidden />
        </div>
      </div>

      <p className="dc-intro-text mt-8 text-xs font-black uppercase tracking-[0.3em] text-white/85">
        Semana {week} · {isToday ? "Aula de hoje" : "Revisão"}
      </p>
      <p className="dc-intro-sub mt-2 max-w-[240px] text-center font-serif text-2xl font-extrabold leading-snug text-white drop-shadow-sm">
        {isToday ? `2 minutinhos por ${babyLabel} 💛` : `Relembre pelo ${babyLabel} 💛`}
      </p>
      <p className="dc-intro-sub mt-3 text-[11px] font-semibold text-white/75">
        toque para começar
      </p>
    </div>
  );
}

/* ─── A RESPIRAÇÃO GUIADA SAIU DAQUI (ago/2026) ─────────────────────────────
   Eram ~600 linhas de componente próprio para um exercício que rodava o MESMO
   motor da meditação: as mesmas fases in/hold/out encadeadas, a mesma
   `vibratePhase`, a mesma voz da Isabella nas fases, o mesmo `manterTelaAcesa`,
   a mesma classe `dc-guiado` e o mesmo `finish()` com a estrela antes do
   servidor. Duas telas mantendo a mesma máquina divergem — e divergiram: o
   ritmo era 4-4-6 aqui e 4-2-6 lá, sem que ninguém tivesse decidido isso.

   Ela virou o tema "Só respirar" da meditação (`lines: []`), e o que ela tinha
   de melhor — a Bolha respirando no centro — foi para a sessão de lá.
   `createBreathAudio` continua vivo: o Momento com o bebê e o marco de semana
   usam. O que morreu foi a duplicata do relógio. */

/* Toque curto das viradas (mudança de movimento, próxima linha da carta).
   Passa pela ponte: `navigator.vibrate` não existe no iPhone, então isto era
   mudo em todo iOS — e é justamente o sinal que diz "mudou" a quem está de
   olhos fechados. */
function buzz(ms = 28) {
  tocarPadrao([ms]);
}

/**
 * Um movimento agora carrega COMO fazer, e não só o nome.
 *
 * A versão anterior dizia "gato-camelo suave: de quatro apoios, alterne
 * arredondar e relaxar a coluna" e ligava um cronômetro de 40 segundos. Quem
 * nunca fez ficava 40 segundos olhando pro emoji do gato. Faltavam as três
 * coisas que uma aula presencial dá de graça:
 *
 *  · `passos` — como MONTAR a posição, numerada, na ordem em que o corpo entra
 *    nela. É o que um vídeo mostraria, dito em palavras;
 *  · `sentir` — onde ela deve sentir. Sem isso não dá pra saber se está certo;
 *  · `parar` — o sinal específico de PARAR daquele movimento. Um aviso genérico
 *    ("pare se sentir desconforto") todo mundo pula; "se a panturrilha doer só
 *    de um lado e estiver quente, avise o médico" ninguém pula.
 *
 * `pose` + `id` escolhem qual desenho de linha animado demonstra o movimento
 * (`figura-movimento.tsx`).
 */
/* ─── OS MOVIMENTOS SAÍRAM DAQUI (ago/2026) ───────────────────────────────
   Nove movimentos girando por `day % 9` viraram vinte e cinco, com sintoma,
   fase e tipo — e foram para `src/lib/exercicios.ts` pela mesma razão das
   frases do mascote: é texto CLÍNICO, é o que o dono relê e corrige, e texto
   enterrado num componente de nove mil linhas é texto que ninguém revisa.
   A régua de qual movimento entra hoje (`sessaoDoDia`) mora lá também, pura e
   testada. Aqui ficou só o desenho da tela. */

/** O que já aliviou cada queixa dela. Prefixo `dc-path-`: viaja no blob. */
const EX_NOTAS_KEY = "dc-path-ex-notas";

export function MovementBlock({
  day,
  semana,
  posParto = false,
  canEarn,
  careMode = false,
  alreadyDone,
  onEarn,
  aoSair,
}: {
  /** Semana gestacional — decide quais movimentos entram no sorteio. */
  semana?: number;
  /** No pós-parto os movimentos de chão saem, qualquer que seja o dia. */
  posParto?: boolean;
  day: number;
  canEarn: boolean;
  careMode?: boolean;
  alreadyDone: boolean;
  onEarn: () => void;
  /**
   * Presente quando o exercício foi aberto pela lista de atividades — que é
   * como a paciente chega aqui de verdade.
   *
   * Muda duas coisas: o exercício abre JÁ na tela cheia (sem o cartão
   * "Começar a meditar", que só repetia o nome do exercício que ela acabou
   * de tocar), e fechar volta para a lista em vez de voltar para o cartão.
   * Sem isto, sair do exercício caía numa tela intermediária que ninguém
   * pediu para ver.
   */
  aoSair?: () => void;
}) {
  /**
   * ⚠️ A TELINHA DE ABERTURA VOLTOU — e voltou por um motivo clínico.
   *
   * Ela tinha sido removida por "só repetir o nome do card". Estava certo
   * enquanto a sessão era sempre a mesma; deixou de estar quando ela passou a
   * ter uma PERGUNTA que muda tudo: o que está incomodando hoje. Ninguém abre
   * um app de alongamento porque é terça — abre porque a lombar travou, porque
   * a câimbra acordou de madrugada, porque a azia não deixa deitar.
   */
  const [open, setOpen] = useState(!!aoSair);
  const [phase, setPhase] = useState<"escolha" | "active" | "reflexo" | "done">("escolha");
  const [sintoma, setSintoma] = useState<Sintoma | null>(null);
  const [minutos, setMinutos] = useState<DuracaoExercicio>(5);
  /**
   * "Hoje eu não desço ao chão" — cama de hospital, repouso, o tapete que não
   * existe, a sala do trabalho. A régua já sabia tirar o chão sozinha (37ª
   * semana, pós-parto); o que faltava era ela poder PEDIR.
   */
  const [semChao, setSemChao] = useState(false);
  /**
   * O QUE JÁ FUNCIONOU PARA ELA, por queixa. Ver `ajustarNotas`.
   *
   * A chave começa com `dc-path-`, então viaja no blob de `journey_state` e o
   * que ela aprendeu sobre o próprio corpo acompanha o aparelho novo. A nota
   * só REORDENA a fila — nunca tira um movimento do poço.
   */
  const [notas, setNotas] = useState<NotasDoCorpo>({});
  useEffect(() => {
    if (open) setNotas(lsGet<NotasDoCorpo>(EX_NOTAS_KEY, {}));
  }, [open]);
  const [idx, setIdx] = useState(0);
  const [secs, setSecs] = useState(0);
  const [voz, setVoz] = useState(true);
  const [pausado, setPausado] = useState(false);
  const [melhorou, setMelhorou] = useState<string | null>(null);
  const [reward, setReward] = useState<number | null>(null);
  const grantedRef = useRef(false);
  /* A sequência nasce no clique de começar, e não do render: derivada, ela
     mudaria debaixo dela ao trocar de sintoma no meio do exercício. */
  const [seq, setSeq] = useState<Movimento[]>([]);

  /* A voz desta tela é arquivo nosso, então o botão aparece sempre. Antes ele
     sumia em quem não tinha voz pt-BR instalada no aparelho — no Android, muita
     gente abria a tela sem sequer saber que existia voz. */
  useEffect(() => () => pararVoz(), []);

  // A voz lê o nome e a dica ao ENTRAR em cada movimento — assim ela pode
  // olhar para o próprio corpo em vez de para o celular, que é justamente o
  // que um exercício pede e um texto na tela impede.
  useEffect(() => {
    if (phase !== "active" || pausado || !voz || !seq[idx]) return;
    /* Movimento sem faixa gravada anda em silêncio, e isso é degradação
       aceitável: os passos estão escritos na tela. Nunca com a voz errada. */
    const faixa = faixaDoMovimento(seq[idx].id);
    if (faixa) tocarVoz(faixa, { canal: "guia" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx, voz, pausado]);

  useEffect(() => {
    /* Pausado o relógio para de verdade — mesma régua da meditação, e pelo
       mesmo motivo: em cinco minutos de exercício a campainha toca. */
    if (phase !== "active" || pausado) return;
    if (secs <= 0) {
      if (idx + 1 >= seq.length) {
        setPhase("reflexo");
        finish();
      } else {
        setIdx(idx + 1);
        setSecs(seq[idx + 1].secs);
        buzz();
      }
      return;
    }
    const t = setTimeout(() => setSecs((s: number) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, secs, idx, pausado]);

  async function finish() {
    if (grantedRef.current || !canEarn || careMode) return;
    grantedRef.current = true;
    /**
     * A meia-estrela acende ANTES de falar com o servidor, e de propósito.
     *
     * Ela é progresso local: quem a ganhou foi a paciente, fazendo a atividade
     * inteira. Antes o `onEarn()` vivia dentro do `if (r.ok)` — então uma
     * queda de rede, um token expirado ou a tabela de Sementinhas ainda não
     * criada no banco faziam a tela dizer "concluído" e a estrela não acender.
     * E como `grantedRef` já estava marcado, não havia segunda chance sem
     * reabrir a atividade. Sem estrela o dia não fecha, a sequência quebra e a
     * figurinha da semana não vem — perde-se muito mais que a moeda.
     *
     * A Sementinha continua dependendo do servidor, que é quem tem o direito
     * de conceder. Essa parte pode falhar em silêncio; a estrela não.
     */
    onEarn();
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) return;
      const r = await grantWellnessReward({
        data: { accessToken: token, day, activity: "movement" },
      });
      // Meia estrela acende sempre que o servidor confirmou a atividade (r.ok).
      // `granted` pode vir 0 quando a recompensa do dia já tinha sido paga —
      // isso não pode apagar o progresso da estrela.
      if (r.ok && r.granted > 0) setReward(r.granted);
    } catch {
      /* recompensa é secundária */
    }
  }

  function begin() {
    const lista = sessaoDoDia({ dia: day, minutos, semana, posParto, sintoma, semChao, notas });
    if (!lista.length) return;
    setSeq(lista);
    setIdx(0);
    setSecs(lista[0].secs);
    setReward(null);
    setMelhorou(null);
    setPausado(false);
    grantedRef.current = false;
    setPhase("active");
    buzz();
  }
  function close() {
    pararVoz();
    setPausado(false);
    if (aoSair) return aoSair();
    setOpen(false);
    setPhase("escolha");
  }
  function alternarVoz() {
    setVoz((v) => {
      if (v) pararVoz();
      return !v;
    });
  }

  const cur = seq[idx];
  /* Há chão para tirar nesta fase? Ver o botão "Hoje eu não desço ao chão". */
  const temChao = useMemo(
    () => elegiveis(fasePara(semana, posParto), semana, posParto).some((m) => m.chao),
    [semana, posParto],
  );

  return (
    <>
      <div className="mt-4 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤸</span>
          <div className="flex-1">
            <p className="text-sm font-extrabold text-emerald-800">Movimento do dia</p>
            <p className="text-xs text-emerald-700/80">
              Escolha o que está incomodando {alreadyDone ? "· feito hoje ✓" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setOpen(true);
            setPhase("escolha");
          }}
          className="press mt-3 w-full rounded-full bg-emerald-500 py-2.5 text-sm font-extrabold text-white"
        >
          {alreadyDone ? "Mover de novo" : "Começar a mexer"}
        </button>
      </div>

      {open && (
        <div
          className="dc-quiz-in fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-emerald-100 via-teal-50 to-white"
          style={{ paddingTop: "var(--safe-top)" }}
        >
          <div className="flex items-center px-4 py-3">
            <button
              onClick={close}
              aria-label="Fechar"
              className="press text-2xl leading-none text-slate-400"
            >
              ✕
            </button>
            {phase === "active" ? (
              <p className="flex-1 text-center text-xs font-bold uppercase tracking-wider text-emerald-500">
                {idx + 1} de {seq.length}
              </p>
            ) : (
              <span className="flex-1" />
            )}
            {phase === "active" ? (
              <div className="flex items-center gap-3">
                {/* ⏸ desenhado, e não emoji: emoji tem cor própria em cada
                    sistema — a mesma lição do 📞 preto no iOS. */}
                <button
                  onClick={() => setPausado((v) => !v)}
                  aria-label={pausado ? "Continuar" : "Pausar"}
                  className="press grid h-9 w-9 place-items-center rounded-full border border-emerald-200 bg-white/70 text-emerald-600"
                >
                  <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="currentColor">
                    {pausado ? (
                      <path d="M8 5.2v13.6L19 12z" />
                    ) : (
                      <path d="M6.6 4.8h3.7v14.4H6.6zM13.7 4.8h3.7v14.4h-3.7z" />
                    )}
                  </svg>
                </button>
                <button
                  onClick={alternarVoz}
                  aria-label={voz ? "Desligar voz" : "Ligar voz"}
                  className={`press text-lg leading-none ${voz ? "" : "opacity-40 grayscale"}`}
                >
                  🗣️
                </button>
              </div>
            ) : (
              <span className="w-6" />
            )}
          </div>

          {/* O aviso médico morava na telinha intermediária que saiu. Ele não
              podia sair junto: fica fixo, discreto, na tela do exercício. */}
          {phase === "active" && (
            <p className="px-6 pb-1 text-center text-[10.5px] leading-snug text-emerald-700/70">
              Vá no seu ritmo. Confirme com seu médico se algum movimento não é indicado pra você.
            </p>
          )}

          {phase === "escolha" && (
            <div className="flex-1 overflow-y-auto px-6 pb-10">
              <h3 className="font-serif text-[26px] font-semibold text-emerald-900">
                Mexer o corpo
              </h3>
              <p className="mt-1 text-[13px] text-emerald-800/70">
                Diga o que está incomodando e eu monto a sequência.
              </p>

              {/* ── O QUE INCOMODA HOJE ────────────────────────────────────
                  A pergunta que faltava. Antes a sessão era `day % 9`: a
                  mulher com ciática recebia "rolar os ombros" porque era
                  terça. */}
              <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                O que está incomodando?
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {SINTOMAS.map((x) => (
                  <button
                    key={x.chave}
                    onClick={() => setSintoma(sintoma === x.chave ? null : x.chave)}
                    aria-pressed={sintoma === x.chave}
                    className={`press flex items-center gap-2 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                      sintoma === x.chave
                        ? "bg-emerald-500 text-white"
                        : "border border-emerald-200 bg-white/70 text-emerald-900"
                    }`}
                  >
                    <span className="text-lg leading-none" aria-hidden>
                      {x.emoji}
                    </span>
                    <span className="text-[12.5px] font-bold leading-tight">{x.rotulo}</span>
                  </button>
                ))}
              </div>

              <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                De quanto tempo você tem?
              </p>
              <div className="mt-2 flex gap-2">
                {DURACOES_EXERCICIO.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMinutos(m)}
                    className={`press flex-1 rounded-2xl py-3 text-sm font-extrabold transition-colors ${
                      minutos === m
                        ? "bg-emerald-500 text-white"
                        : "border border-emerald-200 bg-white/70 text-emerald-700"
                    }`}
                  >
                    {m} min
                  </button>
                ))}
              </div>

              {/* ── SEM DESCER AO CHÃO ─────────────────────────────────────
                  Só aparece quando há chão a tirar: a partir da 37ª semana e
                  no pós-parto a régua já o tirou sozinha, e um botão que não
                  muda nada ensina que os botões desta tela não valem. */}
              {temChao && (
                <button
                  onClick={() => setSemChao((v) => !v)}
                  aria-pressed={semChao}
                  className={`press mt-3 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${
                    semChao
                      ? "bg-emerald-500 text-white"
                      : "border border-emerald-200 bg-white/70 text-emerald-900"
                  }`}
                >
                  <span className="text-lg leading-none" aria-hidden>
                    🛏️
                  </span>
                  <span className="flex-1">
                    <span className="block text-[12.5px] font-bold leading-tight">
                      Hoje eu não desço ao chão
                    </span>
                    <span
                      className={`block text-[11px] leading-snug ${semChao ? "text-white/80" : "text-emerald-700/60"}`}
                    >
                      Cama, sofá ou de pé — sem tapete
                    </span>
                  </span>
                </button>
              )}

              {/* ── ⚠️ OS SINAIS DE PARADA ─────────────────────────────────
                  Não é "li e aceito": são os motivos pelos quais ela NÃO deve
                  se exercitar hoje, e todos pedem contato com o obstetra em
                  vez de alongamento. Fica ANTES, porque depois não serve. */}
              <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3">
                <p className="text-[12px] font-extrabold text-amber-900">
                  Hoje não é dia de exercício se você tiver:
                </p>
                <ul className="mt-1.5 grid gap-1">
                  {SINAIS_DE_PARADA.map((sinal) => (
                    <li key={sinal} className="text-[12px] leading-snug text-amber-900/85">
                      · {sinal}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11.5px] leading-snug text-amber-900/70">
                  Qualquer um deles: fale com seu médico agora, pelo SOS ou pela conversa.
                </p>
              </div>

              <p className="mt-4 text-[11px] leading-relaxed text-emerald-700/60">
                Nada aqui substitui a orientação do seu obstetra. Se ele já disse que algum
                movimento não serve pra você, pule esse.
              </p>
            </div>
          )}

          {phase === "escolha" && (
            <div
              className="border-t border-emerald-200/60 bg-white/70 px-6 pb-5 pt-3 backdrop-blur"
              style={{ paddingBottom: "calc(1.25rem + var(--safe-bottom, 0px))" }}
            >
              <button
                onClick={begin}
                className="press w-full rounded-full bg-emerald-500 py-3.5 text-sm font-extrabold text-white"
              >
                Começar · {minutos} min
              </button>
            </div>
          )}

          {phase === "active" && cur && (
            <div className="flex flex-1 flex-col overflow-y-auto px-6 pb-8">
              {/* A figura DEMONSTRANDO, dentro do anel que conta o tempo.
                  Antes havia um emoji flutuando aqui: bonito, mas ele não
                  ensina nada — e ensinar era o que faltava nesta tela. */}
              <div className="relative mx-auto flex h-52 w-52 shrink-0 items-center justify-center">
                <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#a7f3d0" strokeWidth="6" />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 45}
                    strokeDashoffset={(1 - secs / cur.secs) * 2 * Math.PI * 45}
                    /* Pausado, o anel congela: um anel que continua andando
                       com o relógio parado é a tela mentindo. */
                    style={{ transition: pausado ? "none" : "stroke-dashoffset 1s linear" }}
                  />
                </svg>
                <FiguraMovimento pose={cur.pose} anim={cur.id} className="text-emerald-700" />
                {/* O relógio fica no TOPO do anel. Embaixo ele cobria os pés —
                    e o pé é justamente a parte que se mexe em metade dos
                    exercícios. */}
                <span className="absolute -top-1 rounded-full bg-emerald-500 px-2.5 py-0.5 text-sm font-extrabold tabular-nums text-white">
                  {secs}s
                </span>
              </div>

              <h3 className="mt-4 text-center text-2xl font-extrabold text-emerald-900">
                {cur.name}
              </h3>
              <p className="mx-auto mt-1 max-w-xs text-center text-sm leading-relaxed text-emerald-800/80">
                {cur.cue}
              </p>

              {/* Como montar a posição, na ordem em que o corpo entra nela. */}
              <ol className="mx-auto mt-4 w-full max-w-sm space-y-2">
                {cur.passos.map((p, i) => (
                  <li key={i} className="flex gap-2.5 text-left">
                    <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-extrabold text-emerald-700">
                      {i + 1}
                    </span>
                    <span className="text-[13px] leading-snug text-emerald-900/90">{p}</span>
                  </li>
                ))}
              </ol>

              <div className="mx-auto mt-4 grid w-full max-w-sm gap-2">
                <p className="rounded-2xl bg-emerald-50 px-3.5 py-2.5 text-left text-[12px] leading-snug text-emerald-800">
                  <span className="font-extrabold">Você deve sentir:</span> {cur.sentir}
                </p>
                <p className="rounded-2xl bg-amber-50 px-3.5 py-2.5 text-left text-[12px] leading-snug text-amber-900">
                  <span className="font-extrabold">Pare se:</span> {cur.parar}
                </p>
              </div>

              <div className="mt-5 flex justify-center gap-1.5">
                {seq.map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 w-6 rounded-full transition-colors ${
                      i < idx
                        ? "bg-emerald-500"
                        : i === idx
                          ? "bg-emerald-400/70"
                          : "bg-emerald-200"
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={() => setSecs(0)}
                className="press mx-auto mt-4 rounded-full border border-emerald-300 bg-white/70 px-6 py-2 text-xs font-bold text-emerald-700 backdrop-blur"
              >
                Próximo →
              </button>
            </div>
          )}
          {/* ── ⚠️ MELHOROU? ──────────────────────────────────────────────
              A pergunta que transforma alongamento em informação clínica. A
              paciente responde em um toque, e a resposta vai para o diário
              dela com a queixa que ela escolheu no começo — então o médico
              abre o prontuário e vê "lombar: melhorou" oito vezes seguidas, ou
              "não mudou" oito vezes, que é uma conversa completamente outra.
              Só aparece quando ela DISSE o que incomodava: sem queixa, não há
              o que comparar. */}
          {phase === "reflexo" && (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              <span className="text-5xl">🤸</span>
              <h3 className="mt-4 font-serif text-[24px] font-semibold text-emerald-900">
                {sintoma ? "E agora, como está?" : "Terminou!"}
              </h3>
              {sintoma ? (
                <>
                  <p className="mt-1.5 text-[13px] text-emerald-800/70">
                    Sobre o que você marcou no começo.
                  </p>
                  <div className="mt-6 grid w-full max-w-xs gap-2">
                    {(
                      [
                        { e: "😌", r: "Melhorou" },
                        { e: "😐", r: "Igual" },
                        { e: "😖", r: "Piorou" },
                      ] as const
                    ).map((o) => (
                      <button
                        key={o.r}
                        onClick={() => {
                          setMelhorou(o.r);
                          void registrarExercicio(sintoma, o.r, minutos);
                          /* ⚠️ A nota é dos movimentos DESTA sessão, e por
                             isso ela é gravada aqui e não no fim: `seq` é o
                             que ela acabou de fazer, e `close()` a limpa. */
                          const novas = ajustarNotas(notas, seq, sintoma, o.r);
                          setNotas(novas);
                          lsSet(EX_NOTAS_KEY, novas);
                          setPhase("done");
                        }}
                        className="press flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white/75 px-4 py-3 text-left text-sm font-bold text-emerald-900"
                      >
                        <span className="text-xl leading-none">{o.e}</span>
                        {o.r}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setPhase("done")}
                    className="press mt-5 text-xs font-bold text-emerald-600"
                  >
                    Pular
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setPhase("done")}
                  className="press mt-8 w-full max-w-xs rounded-full bg-emerald-500 py-3 text-sm font-extrabold text-white"
                >
                  Continuar
                </button>
              )}
            </div>
          )}

          {phase === "done" && (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              {!careMode && <ConfettiBurst />}
              <span className="dc-result-in text-6xl">💪</span>
              <h3 className="mt-3 text-2xl font-extrabold text-emerald-900">Corpo soltinho! 🎉</h3>
              <p className="mt-1 max-w-xs text-sm text-emerald-800/80">
                {melhorou === "Piorou"
                  ? "Anotei. Se piorar de novo, conte na próxima consulta — isso é informação, não frescura."
                  : melhorou === "Melhorou"
                    ? "Anotei que melhorou. Repetir nos próximos dias costuma segurar o alívio."
                    : "Você cuidou de você e do bebê hoje."}
              </p>
              {!careMode && reward != null && reward > 0 && (
                <div className="mt-4 rounded-full bg-emerald-100 px-5 py-2 text-base font-extrabold text-emerald-700">
                  +{reward} 🌱 Sementinhas!
                </div>
              )}
              <button
                onClick={close}
                className="press mt-8 w-full max-w-xs rounded-full bg-emerald-500 py-3 text-sm font-extrabold text-white"
              >
                Voltar ao caminho
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ══════════════════ Meditação relâmpago (atividade de bem-estar) ══════════════════
   Meditação guiada curta (~1,5 min): frases calmas que avançam sozinhas, tema
   do dia. Recompensa fixa por concluir (nunca punitiva). */

/**
 * ⚠️ O MODO CUIDADO NÃO EXISTIA NESTA TELA — e este é o pior defeito que a
 * revisão de ago/2026 encontrou, porque ele estava em produção.
 *
 * `careMode` aparecia UMA vez no bloco inteiro da meditação: no portão de
 * recompensa do `finish()`. Nada filtrava o conteúdo. Uma paciente que acabou
 * de perder a gestação abria a meditação e encontrava:
 *
 *   · o tema "Conexão com o bebê" oferecido na lista, com "leve uma das mãos
 *     até a barriga" e "mande um oi carinhoso pra ele";
 *   · em "Calma" — que é justamente o tema que alguém em sofrimento escolhe —
 *     a fala "Você está segura. Seu bebê está bem aqui com você.";
 *   · a rechamada "Você e o bebê, respirando juntos", que entra em QUALQUER
 *     tema a cada cinco ciclos;
 *   · e, no fechamento, "Esse instante também é cuidado com ele."
 *
 * Agora cada tema declara se sobrevive ao luto (`noLuto`), e as FALAS são
 * limpas uma a uma por `planejarSessao`. É a mesma régua de
 * `frases-do-mascote.ts`: passar pelo luto é decisão consciente, e o padrão é
 * NÃO passar.
 */
const MEDITACOES: {
  theme: string;
  need: string;
  emoji: string;
  /** Oferecido no Modo Cuidado. O padrão é não. */
  noLuto?: boolean;
}[] = [
  {
    /* ─── A RESPIRAÇÃO VIROU UM TEMA (ago/2026) ─────────────────────────
       Era uma atividade separada, com 600 linhas de componente próprio — e
       o motor dela era ESTE: as mesmas fases in/hold/out, a mesma
       `vibratePhase`, a mesma voz da Isabella, o mesmo `manterTelaAcesa`, a
       mesma classe `dc-guiado`. A única coisa que ela tinha de diferente
       está logo abaixo, no centro da sessão: a Bolha respirando junto.

       E não precisou de código para virar tema: ele simplesmente não tem
       falas de corpo em `meditacao-roteiros`. O plano da sessão monta
       acolhimento, ancoragem, silêncio e volta, e o meio fica com o compasso.
       O silêncio guiado É o exercício. */
    theme: "Só respirar",
    need: "Quero só respirar",
    emoji: "🌬️",
    /* Sem falas, sem risco: é só o compasso. No luto, é o único exercício que
       não precisa de nenhuma ressalva — e costuma ser o que serve. */
    noLuto: true,
  },
  {
    theme: "Calma",
    need: "Estou tensa",
    emoji: "🌊",
    /* Calma é o tema que alguém em sofrimento escolhe — tirá-lo do luto seria
       fechar a porta certa. Quem limpa as falas é `planejarSessao`, fala a
       fala: nenhuma que cite o bebê, a barriga ou o parto entra no plano. */
    noLuto: true,
  },
  {
    theme: "Conexão com o bebê",
    need: "Quero sentir o bebê",
    emoji: "💛",
  },
  {
    theme: "Descanso",
    need: "Preciso descansar",
    emoji: "🌙",
    noLuto: true,
  },
  {
    theme: "Gratidão",
    need: "Quero um respiro bom",
    emoji: "✨",
  },
  {
    theme: "Sono tranquilo",
    need: "Não consigo dormir",
    emoji: "😴",
    /* Dormir é o que mais falta a quem está de luto. */
    noLuto: true,
  },
  {
    theme: "Coragem pro parto",
    need: "Estou com medo do parto",
    emoji: "🦁",
  },
  {
    theme: "Aqui e agora",
    need: "Minha cabeça não para",
    emoji: "🍃",
    /* Ancorar no presente é das poucas práticas que servem no luto agudo — a
       cabeça é justamente o lugar de onde ela precisa sair. */
    noLuto: true,
  },
];

/* ── Registro de meditação (sequência + minutos) ───────────────────────────
   Chave com prefixo `dc-path-`, então entra no blob de `journey_state` e a
   sequência acompanha a paciente de aparelho pra aparelho. É o mesmo gancho
   que todo app de meditação usa pra fazer a pessoa voltar amanhã — e aqui ele
   é barato porque o transporte já existia. */

const MED_LOG_KEY = "dc-path-med-log";
type MedLog = { dias: string[]; minutos: number; humores: string[] };
const MED_LOG_VAZIO: MedLog = { dias: [], minutos: 0, humores: [] };

function diaISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function registrarMeditacao(minutos: number, humor: string | null) {
  const log = lsGet<MedLog>(MED_LOG_KEY, MED_LOG_VAZIO);
  const hoje = diaISO(new Date());
  lsSet(MED_LOG_KEY, {
    dias: log.dias.includes(hoje) ? log.dias : [...log.dias, hoje].slice(-400),
    minutos: (log.minutos ?? 0) + minutos,
    humores: humor ? [...(log.humores ?? []), humor].slice(-30) : (log.humores ?? []),
  } satisfies MedLog);
}

/* ══════════════════ Meditação guiada ══════════════════
   Reescrita para o que os apps de meditação de mercado provaram que funciona,
   com o que dá pra fazer sem estúdio nem biblioteca de áudio:

   1. ELA ESCOLHE. Duração (2/5/10 min), o que está precisando agora e o som de
      fundo. A versão anterior servia um tema fixo por rotação de dia — se o que
      ela precisava era dormir e o dia calhava de ser "coragem pro parto", não
      havia o que fazer.
   2. UM RITMO PRA SEGUIR. O centro da tela virou o círculo de respiração
      (4s inspira · 2s segura · 6s solta). É o elemento mais copiado do gênero
      porque resolve o problema real de quem nunca meditou: "eu não sei o que
      fazer com o silêncio". Aqui tem o que fazer.
   3. VOZ. `speechSynthesis` em pt-BR lê as frases — e com voz ela pode fechar
      os olhos, que é o pedido da primeira linha de toda meditação.
   4. GUIA E DEPOIS SILÊNCIO. As frases do tema abrem a sessão; passadas todas,
      a sessão continua só com a respiração e uma frase esparsa. É assim que
      uma sessão de 10 min não vira 10 min de tagarelice.
   5. SEQUÊNCIA E MINUTOS. O número que faz voltar amanhã.
   6. FECHAMENTO COM UMA PERGUNTA. "Como você está agora?" — devolve pra ela a
      diferença que os 5 minutos fizeram, que é a única prova que importa. */

/* ⚠️ O COMPASSO VEM DE `meditacao-sessao.ts`, e não daqui.
   Eram dois números que precisavam concordar — `CICLO = 12` lá e um `RESPIRO`
   próprio aqui — e nada obrigava isso. O planejador conta ciclos; a tela os
   desenha; um desencontro entre os dois faria a sessão terminar no lugar
   errado sem ninguém entender por quê. Ver o comentário longo lá. */
const CICLO_SEGS = CICLO;
/* Respirações que fecham um minuto — o corte a partir do qual a sessão CONTA.
   Era `5` cravado, que valia enquanto o ciclo tinha 12 s. */
const UM_MINUTO = Math.ceil(60 / CICLO_SEGS);
/* Quanto dura a amostra do som de fundo na tela de escolha.
   Cinco segundos, a pedido do dono: dez faziam folhear os quatro custar quase
   um minuto, e a decisão ("gosto ou não gosto") acontece nos primeiros dois. */
const AMOSTRA_MS = 5_000;

/**
 * "3m" enquanto falta um minuto inteiro ou mais; "59s", "58s"... só depois
 * que passa a faltar menos de um minuto — pedido do dono, ao lado da barra de
 * progresso. Um número só, sem "min restantes": a barra já mostra a
 * evolução, o número é só a contagem que ela pediu para acompanhar.
 */
function formatarRestante(seg: number | null): string {
  if (seg == null) return "";
  if (seg <= 59) return `${Math.max(0, seg)}s`;
  /* ⚠️ FLOOR, NÃO CEIL — e a diferença apareceu na primeira sessão testada.
     `ciclosDe` arredonda o total para CIMA em ciclos inteiros: uma sessão de
     "3 min" dura de verdade 3min12s (192 s). Com ceil, o número ABRIA em
     "4m" — a paciente escolheu 3 e a tela dizia outra coisa. Floor abre
     exatamente no número que ela tocou, e só perde precisão no MEIO da
     contagem (mostra "2m" um pouco antes dos 2:00 exatos) — o oposto do
     defeito, que era abrir errado. */
  return `${Math.max(1, Math.floor(seg / 60))}m`;
}

/* O 1 min entrou quando a Respiração foi absorvida aqui (ago/2026): ela durava
   70 segundos e o cartão dela prometia "um minutinho de calma". Sem este
   degrau, quem só tinha um minuto perdia o exercício inteiro.
   Cai redondo: o ciclo tem 12s, então 1 min são exatamente 5 respirações. */
const DURACOES = [1, 2, 5, 10] as const;

const COMO_ESTOU = [
  { emoji: "😌", label: "Mais calma" },
  { emoji: "🥱", label: "Com sono" },
  { emoji: "💛", label: "Conectada" },
  { emoji: "😐", label: "Igual" },
  { emoji: "😟", label: "Ainda ansiosa" },
] as const;

/**
 * O HUMOR DO FECHAMENTO VAI PARA O DIÁRIO — e de lá para o prontuário.
 *
 * ⚠️ Antes ele ia só para o `localStorage` (`log.humores`), onde ficava
 * guardado, limitado às últimas 30 sessões, e NENHUMA tela do app o lia: nem a
 * dela, nem a do médico. "Ainda ansiosa" cinco sessões seguidas é achado
 * clínico de gestação de alto risco, e morria no aparelho.
 *
 * O caminho não precisou de migration nem de tabela nova: `journal_entries` já
 * é onde o app guarda humor (o check-in rápido da home e a Gratidão escrevem
 * lá), a aba Humor desenha o gráfico a partir dela, e `clinical_events` já une
 * essa tabela como espécie `humor` — levando **só o rótulo**, nunca o texto do
 * diário. A régua está escrita no próprio SQL: "o conteúdo do diário é dela, e
 * um fluxo de eventos que o carrega para o painel transforma desabafo em
 * prontuário".
 *
 * ⚠️ E o `mood` gravado é o EMOJI CRU, não "😌 Mais calma": `MOOD_VALUE`, que
 * alimenta o gráfico de humor dela, é indexado por emoji. Um rótulo colado
 * junto viraria uma chave desconhecida e a sessão entraria no gráfico como
 * valor neutro, sem ninguém perceber. O rótulo legível vai no `content`, que
 * fica com ela.
 */
/**
 * O LEMBRETE DIÁRIO — ler e gravar a hora que ela escolheu.
 *
 * Direto pela tabela dela, com a RLS de linha própria (`own profile update`),
 * como `registrarHumorDaMeditacao` logo abaixo. A régua de fuso mora em
 * `lembrete-de-meditacao.ts` e é a MESMA que o cron usa — duas contas de fuso
 * para o mesmo horário é como elas divergem em três horas.
 *
 * ⚠️ Devolve `null` quando as colunas ainda não existem no banco (o
 * `APLICAR_LEMBRETE_DE_MEDITACAO.sql` não foi rodado). A tela ESCONDE a linha
 * nesse caso: um interruptor que não guarda nada é pior que interruptor nenhum.
 */
async function lerLembrete(): Promise<{ hora: string | null } | null> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user.id;
    if (!uid) return null;
    /* `as any` porque os tipos gerados do Supabase ainda não conhecem as
       colunas novas — é o mesmo recuo que as outras colunas recém-criadas
       usam neste repositório, e o `maybeSingle` já trata a ausência delas. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("patient_profiles")
      .select("med_reminder_utc_min, med_reminder_offset")
      .eq("id", uid)
      .maybeSingle();
    if (error || !data) return null;
    const linha = data as {
      med_reminder_utc_min: number | null;
      med_reminder_offset: number | null;
    };
    if (linha.med_reminder_utc_min == null) return { hora: null };
    const offset = linha.med_reminder_offset ?? 0;
    const hora = horaLocal(linha.med_reminder_utc_min, offset);
    /* ⚠️ SE ELA MUDOU DE FUSO, o horário DELA é que manda: "nove da noite"
       continua sendo nove da noite onde ela estiver. Regrava em silêncio. */
    const agora = fusoDoNavegador();
    if (offset !== agora) void gravarLembrete(hora);
    return { hora };
  } catch {
    return null;
  }
}

async function gravarLembrete(hora: string | null): Promise<boolean> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user.id;
    if (!uid) return false;
    const valores =
      hora === null
        ? { med_reminder_utc_min: null }
        : (() => {
            const g = paraGuardar(hora, fusoDoNavegador());
            return g ? { med_reminder_utc_min: g.utcMin, med_reminder_offset: g.offset } : null;
          })();
    if (!valores) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("patient_profiles")
      .update(valores)
      .eq("id", uid);
    return !error;
  } catch {
    return false;
  }
}

/**
 * O DESFECHO DO EXERCÍCIO — e por que ele vale mais que a estrelinha.
 *
 * "Lombar: melhorou" repetido oito vezes e "lombar: igual" repetido oito vezes
 * são duas conversas clínicas completamente diferentes, e nenhuma delas
 * existia antes: a paciente alongava e o app registrava só que ela tinha
 * alongado. Isto entra no diário dela e, por ele, na linha do tempo que o
 * médico abre na consulta.
 *
 * ⚠️ SEM `mood`. A tabela é a mesma do diário, e o campo `mood` alimenta o
 * gráfico de humor dela e o bloco de humor do cérebro da IA. "Piorou" aqui é
 * sobre uma DOR NAS COSTAS, não sobre como ela está se sentindo — carimbar
 * isso como humor faria a curva emocional dela despencar por causa de uma
 * lombalgia.
 */
async function registrarExercicio(sintoma: string, desfecho: string, minutos: number) {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const rotulo = SINTOMAS.find((x) => x.chave === sintoma)?.rotulo ?? sintoma;
    await (
      supabase as unknown as {
        from: (t: string) => {
          insert: (v: Record<string, unknown>) => Promise<{ error: unknown }>;
        };
      }
    )
      .from("journal_entries")
      .insert({
        user_id: u.user.id,
        content: `Exercício de ${minutos} min · ${rotulo}: ${desfecho.toLowerCase()}`,
      });
  } catch {
    /* Mesma razão do registro da meditação: falhar em silêncio é melhor que
       uma mensagem vermelha no fim de uma atividade que ela concluiu. */
  }
}

async function registrarHumorDaMeditacao(emoji: string, label: string, minutos: number) {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await (
      supabase as unknown as {
        from: (t: string) => {
          insert: (v: Record<string, unknown>) => Promise<{ error: unknown }>;
        };
      }
    )
      .from("journal_entries")
      .insert({
        user_id: u.user.id,
        content: `Meditação de ${minutos} min · ${label}`,
        mood: emoji,
      });
  } catch {
    /* O registro local já aconteceu e a tela já seguiu. Falhar aqui em silêncio
       é melhor que um erro no fim de uma meditação — que é o pior lugar do app
       para uma mensagem vermelha. */
  }
}

const FECHAMENTO: Record<string, string> = {
  "Mais calma": "É isso mesmo. Guarde esse ritmo pro resto do dia.",
  "Com sono": "Sono depois de meditar é o corpo aceitando descansar. Vá deitar.",
  Conectada: "Esse instante também é cuidado com ele. Vocês dois sentiram.",
  Igual: "Nem toda sessão muda o dia — e mesmo assim ela contou. Volte amanhã.",
  "Ainda ansiosa":
    "Ansiedade que não passa em 5 minutos merece ser falada. Leve isso pra consulta.",
};

/**
 * A faixa de cada fechamento.
 *
 * Antes havia UMA faixa de fechamento para as cinco respostas — a voz dizia a
 * mesma coisa para quem saiu mais calma e para quem saiu ainda ansiosa,
 * enquanto a tela escrevia coisas diferentes. Agora cada resposta tem a sua, e
 * é a mesma frase que ela lê.
 *
 * A de "Ainda ansiosa" é a única do app que manda levar algo para a consulta.
 * Ela ganhou voz de propósito: é a que mais precisa ser ouvida, e não lida de
 * relance antes de fechar a tela.
 */
const FALA_DO_FECHAMENTO: Record<string, string> = {
  "Mais calma": "fe-calma",
  "Com sono": "fe-sono",
  Conectada: "fe-conectada",
  Igual: "fe-igual",
  "Ainda ansiosa": "fe-ansiosa",
};

export function MeditationBlock({
  day,
  canEarn,
  careMode = false,
  alreadyDone,
  onEarn,
  aoSair,
}: {
  day: number;
  canEarn: boolean;
  careMode?: boolean;
  alreadyDone: boolean;
  onEarn: () => void;
  /**
   * Presente quando o exercício foi aberto pela lista de atividades — que é
   * como a paciente chega aqui de verdade.
   *
   * Muda duas coisas: o exercício abre JÁ na tela cheia (sem o cartão
   * "Começar a meditar", que só repetia o nome do exercício que ela acabou
   * de tocar), e fechar volta para a lista em vez de voltar para o cartão.
   * Sem isto, sair do exercício caía numa tela intermediária que ninguém
   * pediu para ver.
   */
  aoSair?: () => void;
}) {
  /* ⚠️ NO LUTO A LISTA ENCOLHE, e o índice tem de nascer dentro dela.
     `day % MEDITACOES.length` apontaria para a lista COMPLETA — e o tema
     sugerido do dia poderia ser "Conexão com o bebê" para quem acabou de
     perder a gestação, mesmo com ele fora da lista desenhada. */
  const temas = useMemo(
    () => (careMode ? MEDITACOES.filter((m) => m.noLuto) : MEDITACOES),
    [careMode],
  );
  const sugerida = day % temas.length;
  const [open, setOpen] = useState(!!aoSair);
  const [etapa, setEtapa] = useState<"escolha" | "sessao" | "reflexo" | "fim">("escolha");
  const [temaIdx, setTemaIdx] = useState(sugerida);
  const [minutos, setMinutos] = useState<(typeof DURACOES)[number]>(5);
  const [som, setSom] = useState<SoundscapeKey>("pad");
  const [voz, setVoz] = useState(true);
  /* Quanta voz ela quer — guiada, pouca, ou só o desenho. É o controle que o
     Headspace tem e que faltava aqui: quem quer silêncio pedia silêncio
     desligando a voz inteira, e aí perdia também o acolhimento e a volta. */
  const [densidade, setDensidade] = useState<Densidade>("guiada");
  /**
   * O PLANO DA SESSÃO — quais falas tocam, e em qual respiração.
   *
   * Montado uma vez, no clique de começar. Se fosse derivado do render, a
   * semente mudaria e as rechamadas trocariam debaixo da paciente — o mesmo
   * defeito que o balão do mascote teve com o clima.
   */
  const [plano, setPlano] = useState<Plano | null>(null);
  /**
   * OS SETE PRIMEIROS DIAS.
   *
   * `progFeitos` é a CONTAGEM de dias do programa concluídos — nunca uma data.
   * É o que mantém o programa independente do calendário: ela some uma semana
   * e volta no dia onde parou, com a chama zerada (isso é honesto, ela não
   * veio) mas sem perder o que já aprendeu. Ver o cabeçalho de
   * `meditacao-programa.ts`.
   *
   * A chave começa com `dc-path-`, então viaja no `journey_state` e o programa
   * continua no outro aparelho.
   */
  const [progFeitos, setProgFeitos] = useState(0);
  /* Ela pode ter tocado em "ou escolha você mesma": aí o cartão sai do caminho
     nesta abertura, sem marcar nada como feito. */
  const [menuAberto, setMenuAberto] = useState(false);
  const [emPrograma, setEmPrograma] = useState<DiaDoPrograma | null>(null);
  useEffect(() => {
    if (open) setProgFeitos(lsGet<number>(CHAVE_DO_PROGRAMA, 0));
  }, [open]);
  useEffect(() => {
    if (!open || careMode) return;
    let vivo = true;
    void lerLembrete().then((r) => {
      if (vivo) setLembrete(r ?? false);
    });
    return () => {
      vivo = false;
    };
  }, [open, careMode]);
  const diaAtualDoPrograma = careMode ? null : diaDoPrograma(progFeitos);
  const [ciclo, setCiclo] = useState(0);
  const [fase, setFase] = useState<"in" | "hold" | "out">("in");
  /**
   * PAUSA — e ela guarda POR QUE parou.
   *
   * Em dez minutos a campainha toca, o outro filho chama, o telefone vibra. Os
   * três líderes do gênero pausam; aqui só havia sair. E o segundo motivo é
   * mais grave que o primeiro: quando o app sai da tela (ela troca de app, ou
   * bloqueia o aparelho), o iOS SUSPENDE o áudio sintetizado e congela os
   * relógios da respiração. A sessão não morria de verdade — ficava parada,
   * muda, e voltava sem som, sem nada dizer o que houve. Agora ela pausa de
   * propósito e a tela conta qual dos dois foi.
   */
  const [pausa, setPausa] = useState<null | "toque" | "fundo">(null);
  const pausada = pausa !== null;
  /* Sobe a cada retomada. Serve de dependência para os dois efeitos de voz:
     é o que faz a deixa deste ciclo ser dita de novo, já que nem `ciclo` nem
     `fase` mudam necessariamente ao voltar. */
  const [retomada, setRetomada] = useState(0);
  /* Os sons soltos, sem sessão. Ver `sons-para-dormir.tsx`: mesma receita de
     som, tocada de um arquivo — é o que sobrevive à tela bloqueada. */
  const [sonsAbertos, setSonsAbertos] = useState(false);
  /* A prática para dois. Fora do Modo Cuidado: ela é preparação de parto. */
  const [casalAberto, setCasalAberto] = useState(false);
  /* `null` enquanto carrega, `false` quando o banco ainda não tem as colunas —
     e aí a linha do lembrete nem aparece. */
  const [lembrete, setLembrete] = useState<{ hora: string | null } | null | false>(null);
  const [humor, setHumor] = useState<string | null>(null);
  /* Quantos minutos ela DE FATO ficou. Igual a `minutos` quando a sessão vai
     até o fim, menor quando ela encerra antes — a tela de fim não pode dizer
     "10 minutos só seus" para quem ficou quatro. */
  const [minutosFeitos, setMinutosFeitos] = useState(0);
  const [reward, setReward] = useState<number | null>(null);
  const grantedRef = useRef(false);
  const audioRef = useRef<Soundscape | null>(null);
  /* O componente ainda está na tela? Lido DEPOIS de esperas — ver
     `podeRetomar`. Um `setState` ou um `createSoundscape` depois do desmonte
     é som sem dono. */
  const vivaRef = useRef(true);
  useEffect(() => {
    vivaRef.current = true;
    return () => {
      vivaRef.current = false;
    };
  }, []);
  /* O som ESCOLHIDO agora, para ser lido depois de uma espera: a closure do
     toque guarda o de antes, e ela pode ter silenciado no meio. */
  const somRef = useRef<SoundscapeKey>("pad");
  /**
   * O CONTADOR REGRESSIVO DA SESSÃO — pedido do dono, para ficar ao lado da
   * barra de progresso.
   *
   * ⚠️ NÃO É O CONTADOR QUE JÁ FOI TIRADO DAQUI UMA VEZ. Existia um
   * `setInterval` por RESPIRAÇÃO, contando "segundos restantes desta fase" —
   * 4→1, depois 2→1, depois 6→1 — três máximos diferentes por ciclo, e por
   * isso ele saiu (ver o relógio da respiração, logo abaixo). Este é outro:
   * conta o tempo restante da SESSÃO INTEIRA, em relógio de verdade, e por
   * isso pode andar de segundo em segundo sem herdar aquele defeito — não
   * reseta a cada respiração, só desce.
   *
   * Andar por RELÓGIO (`Date.now()`), e não por `ciclo × CICLO_SEGS`, é o que
   * permite mostrar segundo a segundo no último minuto ("59s", "58s"...) sem
   * esperar a virada do próximo ciclo de 16s para atualizar.
   */
  const inicioSessaoRef = useRef<number | null>(null);
  /** Quando a pausa atual começou — para descontar do relógio ao voltar. */
  const pausadoDesdeRef = useRef<number | null>(null);
  const [restanteSeg, setRestanteSeg] = useState<number | null>(null);
  /* O sheet de sons DENTRO da sessão — pedido do dono: tocar no ícone de som
     não alterna mais direto, abre as opções. */
  const [somNaSessaoAberto, setSomNaSessaoAberto] = useState(false);
  /**
   * A AMOSTRA DE DEZ SEGUNDOS — pedido do dono.
   *
   * Antes ela escolhia o som de fundo às cegas: o nome e o emoji, e a primeira
   * vez que ouvia chuva era com a sessão já correndo. Agora tocar no chip toca
   * o som, e ele para sozinho — dá para folhear os quatro antes de decidir.
   *
   * ⚠️ É uma instância PRÓPRIA, nunca o `audioRef` da sessão. Se dividissem o
   * mesmo objeto, o relógio da amostra pararia o som da meditação dez segundos
   * depois de ela começar — e ninguém entenderia por quê.
   *
   * Dez segundos não é número redondo por acaso: é uma onda inteira do mar
   * (o sweep tem período de 9 s) e vinte e três batidas do coração.
   */
  const amostraRef = useRef<Soundscape | null>(null);
  const amostraTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [amostrando, setAmostrando] = useState<SoundscapeKey | null>(null);

  /* `Math.min` porque `temaIdx` pode ter sido escolhido com a lista cheia e o
     Modo Cuidado ser ligado depois — a lista encolhe debaixo do índice. */
  const med = temas[Math.min(temaIdx, temas.length - 1)];
  /* ⚠️ O NÚMERO DE CICLOS VEM DO PLANO, e não do `minutos` do menu.
     O dia do programa manda na própria duração (3, 5, 7 ou 10 min). Lendo o
     `minutos` do seletor, a sessão de três minutos do Dia 1 rodaria com os
     cinco minutos que estavam escolhidos na tela — e a fala de volta ao corpo
     cairia no meio. */
  const totalCiclos = plano?.totalCiclos ?? Math.round((minutos * 60) / CICLO_SEGS);

  /**
   * O CONTADOR AO LADO DA BARRA — ticando por RELÓGIO, não por ciclo.
   *
   * ⚠️ Congela sozinho durante a pausa: a condição de saída (`pausada`) faz o
   * efeito não reagendar o próprio intervalo, e o número visto por último
   * fica na tela — a mesma promessa que a barra de progresso já faz
   * ("uma barra que continua andando com a sessão parada é a tela
   * mentindo"). Ao voltar, `retomarSessao` já adiantou `inicioSessaoRef` pelo
   * tempo pausado, então o primeiro tick pós-pausa acerta o número sem salto.
   */
  useEffect(() => {
    if (etapa !== "sessao" || pausada) return;
    const totalSeg = totalCiclos * CICLO_SEGS;
    const atualizar = () => {
      const inicio = inicioSessaoRef.current;
      if (inicio == null) return;
      const decorrido = (Date.now() - inicio) / 1000;
      setRestanteSeg(Math.max(0, Math.round(totalSeg - decorrido)));
    };
    atualizar();
    const t = setInterval(atualizar, 1000);
    return () => clearInterval(t);
  }, [etapa, pausada, totalCiclos]);

  // Relido a cada troca de etapa de propósito: quando a sessão termina ela
  // acabou de gravar o dia de hoje, e a tela de fim precisa mostrar a sequência
  // JÁ contando com a sessão que a paciente terminou agora.
  const [log, setLog] = useState<MedLog>(MED_LOG_VAZIO);
  useEffect(() => {
    if (open) setLog(lsGet<MedLog>(MED_LOG_KEY, MED_LOG_VAZIO));
  }, [open, etapa]);
  /* Mesma régua da trilha, sobre datas do calendário — ver `sequencia.ts`.
     Era a terceira cópia do mesmo laço neste arquivo. */
  const seq = sequenciaDeDatas(log.dias ?? []);

  /* Não há mais o que preparar: a voz desta tela é arquivo nosso, então o
     botão aparece sempre. Antes ele ficava escondido em quem não tinha voz
     pt-BR instalada no aparelho — o que, no Android, é bastante gente. */

  useEffect(
    () => () => {
      audioRef.current?.stop();
      amostraRef.current?.stop();
      if (amostraTimer.current) clearTimeout(amostraTimer.current);
      pararVoz();
    },
    [],
  );

  /**
   * A FALA DESTA RESPIRAÇÃO — e ela é a mesma coisa que a tela escreve e que a
   * voz diz.
   *
   * ⚠️ Era esse o defeito estrutural que a auditoria mediu: o texto andava uma
   * linha a cada 12 s por um relógio próprio, e a faixa gravada lia as sete
   * frases em 34 s. No tema Calma, aos 30 s a voz estava na sétima frase e a
   * tela mostrava a terceira; das linhas 4 a 7 ela lia em silêncio. Agora cada
   * fala é um arquivo, e o mesmo objeto alimenta os dois — não há como
   * dessincronizar.
   */
  const falaAgora = plano ? falaNoCiclo(plano, ciclo) : null;
  const frase = falaAgora?.texto ?? null;

  // Relógio da respiração: cada fase agenda a próxima. O ciclo fecha na
  // expiração — inspirar é o começo natural, expirar é o fim natural.
  useEffect(() => {
    if (etapa !== "sessao" || pausada) return;
    const dur = RESPIRO[fase];
    /* ⚠️ NÃO HÁ MAIS CONTADOR REGRESSIVO AQUI.
       Existia um `setInterval` de 1s escrevendo um número embaixo da bolha, e
       ele tinha dois problemas. O pequeno: o intervalo e o `setTimeout` da fase
       disparavam no mesmo milissegundo no fim de cada fase, então o último
       decremento corria contra a troca. O grande é de desenho — o número era
       "segundos restantes DESTA fase", então contava 4→1, depois 2→1, depois
       6→1, três máximos diferentes por ciclo. Ninguém lê isso como progresso, e
       somado ao atraso da animação era o que fazia a tela parecer quebrada.
       Nenhum dos três líderes do gênero põe um número aí: quem conta é o
       desenho que enche e esvazia, e agora ele está certo. */
    const t = setTimeout(() => {
      if (fase === "in") setFase("hold");
      else if (fase === "hold") setFase("out");
      else if (ciclo + 1 >= totalCiclos) {
        setEtapa("reflexo");
        /* Os minutos são os do PLANO — o dia do programa manda na duração, e
           `minutos` é o que estava no seletor do menu. */
        registrarMeditacao(Math.round((totalCiclos * CICLO_SEGS) / 60), null);
        concluirDiaDoPrograma();
        finish();
      } else {
        setCiclo((c) => c + 1);
        setFase("in");
      }
    }, dur * 1000);
    /* `RESPIRO` guarda SEGUNDOS, e `vibratePhase` quer milissegundos. O outro
       era em ms no BreathingBlock, que foi absorvido aqui — a mesma variável
       `dur` significava coisas diferentes nos dois. Passar cru daria um padrão
       de 4 ms, imperceptível, e o defeito pareceria "vibração não funciona". */
    vibratePhase(fase, dur * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, fase, ciclo, pausada]);

  /**
   * ⚠️ A PRIMEIRA INSPIRAÇÃO PRECISA DE UM QUADRO PEQUENO ANTES DELA.
   *
   * O defeito medido: a sessão abria com a bolha JÁ CHEIA (escala 1,160 aos
   * 78 ms) e ela ficava imóvel os 4 s do "Inspire" e os 2 s do "Segure" — o
   * primeiro movimento aparecia só aos 7,2 s, no "Solte". A causa é banal e
   * invisível no código: a fase inicial é `"in"`, então o elemento MONTA já na
   * escala inspirada, e transição de CSS não tem de onde animar sem um valor
   * anterior.
   *
   * O estrago não é estético. Este é o quadro em que o exercício se explica
   * sozinho — a bola cresce, você puxa o ar — e ele simplesmente não existia
   * para quem abria a meditação pela primeira vez. Ela aprendia a mecânica ao
   * contrário, pela expiração.
   *
   * Dois `requestAnimationFrame` aninhados, e não um: com um só, o React ainda
   * pode não ter PINTADO o quadro pequeno, e o navegador colapsa as duas
   * escalas numa transição que nunca acontece. O segundo quadro garante que o
   * pequeno foi para a tela antes de o grande ser pedido.
   */
  const [respiroPronto, setRespiroPronto] = useState(false);
  useEffect(() => {
    /* A pausa cai aqui de propósito: a bolha desce ao repouso (sem transição,
       porque `respiroMs` vai a zero) e, ao voltar, a mesma dança de dois
       quadros faz a inspiração ter de onde crescer. É a MESMA máquina do
       primeiro quadro da sessão — duas seriam duas chances de divergir. */
    if (etapa !== "sessao" || pausada) {
      setRespiroPronto(false);
      return;
    }
    let b = 0;
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setRespiroPronto(true));
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, [etapa, pausada]);

  /* A fase que o DESENHO usa. Igual à real, menos no primeiro quadro da
     sessão, em que ela é a expiração (bolha pequena, sem transição) para a
     inspiração seguinte ter de onde crescer. */
  const faseVisual: "in" | "hold" | "out" = respiroPronto ? fase : "out";
  const respiroMs = respiroPronto ? RESPIRO[fase] * 1000 : 0;

  /**
   * ⚠️ A ÚLTIMA FRASE DO ARCO PODE OCUPAR O CICLO FINAL — e por isso não
   * pode ser cortada no instante em que ele acaba.
   *
   * `planejarSessao` garante "cada janela recebe pelo menos um ciclo", e para
   * sessões curtas (1, 2 e 5 min) a janela `volta` só tem espaço para UM
   * ciclo — que é literalmente o último da sessão inteira. A frase de
   * fechamento ("Vamos voltar devagar...") toca no início desse ciclo, e o
   * relógio da respiração termina a sessão no segundo exato em que o ciclo
   * acaba. Numa rede mais lenta, ou só pela variação normal de quando o áudio
   * termina de carregar, a frase podia estar tocando ainda — e cortar no
   * instante certo era a diferença entre "não paro no meio" e "ela nunca
   * ouviu por inteiro".
   *
   * A correção é no RUNTIME, não no plano: alongar a sessão em `totalCiclos`
   * quebraria "o compasso é o mesmo em 1 e em 10 minutos" (testado — a
   * duração é `ciclosDe(minutos) * CICLO`, e ponto). Em vez disso, só o
   * canal `pulso` (as três palavras do compasso) é cortado na hora; o `guia`
   * — a fala em si — termina sozinho. `tocar()` já para o canal anterior
   * antes de tocar o próximo, então não há vazamento: a próxima sessão, ou a
   * próxima fala guiada, silencia esta sozinha quando chegar a vez dela.
   */
  useEffect(() => {
    if (etapa !== "sessao") {
      pararVoz("pulso");
      return;
    }
    if (!voz) pararVoz();
  }, [etapa, voz]);

  /* Tela acesa durante a meditação. É a atividade mais longa do app — até dez
     minutos — e a própria tela pede "com a voz você pode fechar os olhos".
     Sem isto, o aparelho bloqueia em uns trinta segundos, o ciclo é suspenso e
     a sessão morre exatamente por a paciente ter feito o que pedimos. */
  useEffect(() => {
    /* Pausada, o bloqueio é LIBERADO: ela largou o celular na mesa de
       cabeceira, e segurar a tela acesa numa sessão que não está correndo é
       bateria gasta pelo app inteiro. */
    if (etapa !== "sessao" || pausada) return;
    return manterTelaAcesa();
  }, [etapa, pausada]);

  /**
   * ⚠️ O APP SAIU DA TELA → A SESSÃO PARA, E DIZ QUE PAROU.
   *
   * O que acontecia antes, sem nada disto: o iOS suspende o `AudioContext` e
   * congela `setTimeout` assim que a página fica escondida. A paciente
   * respondia uma mensagem, voltava — e encontrava a bolha parada no meio de um
   * "Inspire", sem som de fundo, sem voz, e sem nada explicando. A barra de
   * progresso ficava onde estava. Parecia quebrado porque, funcionalmente,
   * estava.
   *
   * Manter tocando não é opção nossa: som sintetizado no Web Audio não
   * sobrevive à tela bloqueada em iPhone nenhum — quem sobrevive é arquivo
   * tocando num `<audio>`, que é o caminho dos Sons para dormir. Então o certo
   * é parar de propósito, guardar o lugar e esperar por ela.
   *
   * O `manterTelaAcesa` reduz a frequência disso (a tela não apaga sozinha),
   * mas não cobre o botão de desligar nem o Modo de Baixo Consumo, que recusa
   * o pedido de tela acesa.
   */
  useEffect(() => {
    if (etapa !== "sessao" || typeof document === "undefined") return;
    const aoTrocar = () => {
      if (document.hidden) pausarSessao("fundo");
    };
    document.addEventListener("visibilitychange", aoTrocar);
    return () => document.removeEventListener("visibilitychange", aoTrocar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, pausa]);

  /**
   * O CARD DO SISTEMA — o que aparece na tela bloqueada e no fone de ouvido.
   *
   * As ações passam por um `ref` de propósito: trocar os handlers a cada
   * `pausa` faria o card piscar no sistema operacional a cada toque. O
   * anúncio é montado uma vez por sessão; o que muda é só o estado (▶︎/⏸).
   */
  const acoesDaMidia = useRef<{ pausar: () => void; tocar: () => void }>({
    pausar: () => {},
    tocar: () => {},
  });
  /* Escrito num efeito, e não no corpo do render: num render concorrente que o
     React descarte, os botões do sistema passariam a agir sobre um estado que
     nunca foi comitado. */
  useEffect(() => {
    acoesDaMidia.current = {
      pausar: () => pausarSessao("toque"),
      tocar: () => void retomarSessao(),
    };
  });
  useEffect(() => {
    if (etapa !== "sessao") return;
    return anunciarMidia({
      titulo: `Meditar · ${med.theme}`,
      aoPausar: () => acoesDaMidia.current.pausar(),
      aoTocar: () => acoesDaMidia.current.tocar(),
    });
  }, [etapa, med.theme]);

  useEffect(() => {
    if (etapa !== "sessao") return;
    estadoDaMidia(pausada ? "paused" : "playing");
  }, [etapa, pausada]);

  /**
   * A FALA DA RESPIRAÇÃO ATUAL, no canal da guia.
   *
   * Uma fala por ciclo, e o ciclo tem 12 s contra os ~5 s de fala: sobra
   * silêncio dentro da própria respiração, que é onde o exercício acontece. O
   * canal é o `guia` porque as três palavras vivem no `pulso` — assim uma
   * nunca corta a outra, que era o motivo de existirem dois canais.
   */
  useEffect(() => {
    if (etapa !== "sessao" || pausada || !voz || !falaAgora) return;
    const faixa = faixaDaFala(falaAgora.id);
    /* Sem arquivo, a tela segue escrevendo e a sessão anda em silêncio naquele
       trecho. Nunca com a voz errada, que seria pior. */
    if (faixa) tocarVoz(faixa, { canal: "guia" });
    /* `retomada` está nas dependências para a deixa deste ciclo ser DITA DE
       NOVO ao voltar: a pausa cortou a fala no meio e o texto dela continua na
       tela. Sem isso, a frase ficaria escrita sem nunca ter sido falada — e
       essa sincronia entre o que se lê e o que se ouve é o contrato desta
       tela desde que o roteiro virou arquivo. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, voz, falaAgora?.id, pausada, retomada]);

  /**
   * ⚠️ E A PRIMEIRA FALA É BUSCADA ENQUANTO ELA AINDA ESCOLHE.
   *
   * Ela é a única que o prefetch de ciclo não alcança: toca no mesmo instante
   * do clique em "Começar". Medido em 3G lento, saía 1,76 s depois — quase dois
   * segundos de nada logo após o toque, que é onde alguém desiste achando que
   * travou. A tela de escolha fica no ar enquanto ela lê duração, tema e som:
   * é tempo de rede de graça.
   *
   * O plano é montado com as escolhas ATUAIS, então trocar de tema busca a
   * fala certa — em vez de adivinhar qual seria a primeira e errar quando a
   * ordem do roteiro mudar.
   */
  useEffect(() => {
    if (!open || etapa !== "escolha" || !voz) return;
    const previa = planejarSessao({
      minutos,
      tema: med.theme,
      semanas: Math.floor(day / 7),
      densidade,
      careMode,
    });
    const f = previa.deixas.length ? faixaDaFala(previa.deixas[0].fala.id) : null;
    if (!f) return;
    /* Um respiro antes de buscar: ela pode estar tocando nos botões, e a cada
       toque este efeito roda de novo. */
    const t = setTimeout(() => prepararVoz(f), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, etapa, voz, minutos, med.theme, densidade, careMode, day]);

  /**
   * ⚠️ A PRÓXIMA FALA É BUSCADA ENQUANTO A ATUAL AINDA TOCA.
   *
   * Medido em 3G lento (400 kbps, 300 ms de latência): sem isto, cada fala
   * levava de 0,97 a 1,80 segundo entre ser criada e começar a soar — e a pior
   * era a primeira da sessão, logo depois do toque em "Começar". O ciclo tem
   * 12 s, então o atraso não perde a respiração, mas empurra cada fala um
   * segundo para dentro dela; numa tela cujo assunto é ritmo, isso se sente.
   */
  useEffect(() => {
    if (etapa !== "sessao" || !voz || !plano) return;
    const proxima = plano.deixas.find((d) => d.ciclo > ciclo);
    if (!proxima) return;
    const f = faixaDaFala(proxima.fala.id);
    if (!f) return;
    /* ⚠️ ESPERA A FALA ATUAL SAIR NA FRENTE.
       Buscar a próxima no mesmo instante em que a atual começa faz as duas
       disputarem o cano: medido em 3G lento, a primeira fala da sessão ia de
       1,8 s para 2,5 s só por causa disso. A próxima só toca daqui a 12
       segundos ou mais — dois segundos e meio de espera não custam nada, e é
       o que devolve a prioridade a quem está tocando agora. */
    const t = setTimeout(() => prepararVoz(f), 2500);
    return () => clearTimeout(t);
  }, [etapa, voz, plano, ciclo]);

  /**
   * As três palavras da respiração, na virada de cada fase.
   *
   * ⚠️ Elas tocavam a sessão INTEIRA — 47 vezes em dez minutos, 141 palavras,
   * o grosso de tudo que se ouvia. Agora conduzem só enquanto o desenho ainda
   * está ensinando o compasso (`palavrasAte`), e depois calam. Na densidade
   * "só o ritmo" vão até o fim: são o único guia que sobra.
   */
  useEffect(() => {
    if (etapa !== "sessao" || pausada || !voz || !plano || ciclo >= plano.palavrasAte) return;
    /**
     * ⚠️ A PALAVRA CALA QUANDO HÁ INSTRUÇÃO NESTA RESPIRAÇÃO.
     *
     * Este era o defeito que o dono ouviu e descreveu como "as frases estão se
     * sobrepondo, e parece que algumas nem são lidas". Elas ERAM lidas: 191 de
     * 191 têm áudio. O que acontecia é que os dois canais tocavam ao mesmo
     * tempo — a guia dizendo a instrução e o pulso dizendo "Inspire" por cima.
     * Medido antes: 11 das 24 instruções de uma sessão de dez minutos saíam
     * com uma palavra em cima, e no primeiro minuto de qualquer sessão isso
     * acontecia em TODAS.
     *
     * Dois canais existem para uma fala não CORTAR a outra; não para as duas
     * falarem juntas. Nesta respiração, quem fala é a instrução.
     */
    if (falaAgora) return;
    const palavra =
      fase === "in" ? RESPIRACAO.in : fase === "hold" ? RESPIRACAO.hold : RESPIRACAO.out;
    tocarVoz(palavra, { canal: "pulso", volume: 0.85 });
    /* ⚠️ `retomada` nas deps: a volta força `fase` para "in", e se ela tivesse
       pausado DURANTE a inspiração o valor não mudaria — o efeito não rodaria e
       a respiração recomeçaria muda. O mesmo gesto daria dois comportamentos
       conforme o instante em que ela tocou em pausar. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, fase, voz, ciclo, plano?.palavrasAte, pausada, retomada, falaAgora?.id]);

  async function finish() {
    if (grantedRef.current || !canEarn || careMode) return;
    grantedRef.current = true;
    /**
     * A meia-estrela acende ANTES de falar com o servidor, e de propósito.
     *
     * Ela é progresso local: quem a ganhou foi a paciente, fazendo a atividade
     * inteira. Antes o `onEarn()` vivia dentro do `if (r.ok)` — então uma
     * queda de rede, um token expirado ou a tabela de Sementinhas ainda não
     * criada no banco faziam a tela dizer "concluído" e a estrela não acender.
     * E como `grantedRef` já estava marcado, não havia segunda chance sem
     * reabrir a atividade. Sem estrela o dia não fecha, a sequência quebra e a
     * figurinha da semana não vem — perde-se muito mais que a moeda.
     *
     * A Sementinha continua dependendo do servidor, que é quem tem o direito
     * de conceder. Essa parte pode falhar em silêncio; a estrela não.
     */
    onEarn();
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) return;
      const r = await grantWellnessReward({
        data: { accessToken: token, day, activity: "meditation" },
      });
      // Meia estrela acende sempre que o servidor confirmou a atividade (r.ok).
      // `granted` pode vir 0 quando a recompensa do dia já tinha sido paga —
      // isso não pode apagar o progresso da estrela.
      if (r.ok && r.granted > 0) setReward(r.granted);
    } catch {
      /* recompensa é secundária */
    }
  }

  function begin(doPrograma?: DiaDoPrograma) {
    /* O dia do programa manda na duração e na densidade: quem está aprendendo
       não escolhe, e é isso que o programa existe para poupar dela. O tema, o
       som e o resto do menu continuam onde estavam para quando ela quiser. */
    const mins = doPrograma?.minutos ?? minutos;
    const dens = doPrograma?.densidade ?? densidade;
    pararAmostra();
    setEmPrograma(doPrograma ?? null);
    setCiclo(0);
    setMinutosFeitos(mins);
    setFase("in");
    setPausa(null);
    setHumor(null);
    setReward(null);
    grantedRef.current = false;
    audioRef.current?.stop();
    somRef.current = som;
    audioRef.current = createSoundscape(som);
    audioRef.current.start();
    /* O relógio da sessão nasce aqui, junto com tudo o mais — ver o
       contador ao lado da barra de progresso. */
    inicioSessaoRef.current = Date.now();
    pausadoDesdeRef.current = null;
    setRestanteSeg(null);
    /**
     * O PLANO NASCE AQUI, no clique — e a primeira fala toca junto.
     *
     * O navegador só deixa tocar áudio a partir de um gesto do usuário, e um
     * `useEffect` roda depois que o React pintou: para o Safari e o Chrome do
     * celular isso já não é mais o gesto, e o `play()` volta rejeitado. O som
     * ambiente ao lado sempre soube disso — nasce neste mesmo clique. A voz
     * precisa do mesmo tratamento, senão a paciente abriria a meditação e
     * ouviria apenas o ambiente, sem nunca entender por quê.
     *
     * A semente vem dos minutos já meditados: duas sessões seguidas ouvem
     * rechamadas diferentes, e a mesma sessão pedida duas vezes dá o mesmo
     * plano. Com vinte no poço, ela medita duas semanas sem repetir uma frase.
     */
    const p = planejarSessao({
      minutos: mins,
      tema: doPrograma?.tema ?? med.theme,
      /* A leitura do tema gira com os dias meditados: a segunda sessão de
         "Calma" não é a primeira de novo. É a resposta direta à queixa nº 2
         dos usuários de Calm e Headspace — repetição de conteúdo. */
      variacao: (((log.dias?.length ?? 0) % 3) + 1) as 1 | 2 | 3,
      semanas: Math.floor(day / 7),
      densidade: dens,
      careMode,
      semente: log.minutos ?? 0,
    });
    setPlano(p);
    if (voz) {
      const primeira = p.deixas.find((d) => d.ciclo === 0);
      const faixa = primeira ? faixaDaFala(primeira.fala.id) : null;
      if (faixa) tocarVoz(faixa, { canal: "guia" });
      /* ⚠️ NADA MAIS É BAIXADO NESTE INSTANTE.
         Eu cheguei a pedir aqui as três palavras da respiração, achando que
         adiantava o primeiro "Inspire". O efeito medido em 3G lento foi o
         oposto: quatro arquivos disputando um cano de 400 kbps fizeram a
         PRIMEIRA FALA — a que ela ouve logo depois de tocar em "Começar" —
         saltar de 1,8 s para 4,8 s. Numa rede estreita, buscar mais coisa é
         atrasar a que importa. As palavras são pequenas (27 a 46 KB) e vêm
         sozinhas quando chega a hora delas. */
    }
    setEtapa("sessao");
  }

  /**
   * Encerra a sessão em curso GUARDANDO o que ela fez.
   *
   * É o mesmo caminho do botão "Encerrar por aqui", extraído para poder ser
   * chamado também pelo ✕ — ver `close()`.
   */
  /**
   * O DIA DO PROGRAMA SÓ AVANÇA QUANDO ELA CHEGA AO FIM.
   *
   * ⚠️ E "o fim" aqui é o fim de verdade, não o botão de encerrar: sair aos
   * dois minutos de uma sessão de sete guarda os minutos e a chama (isso ela
   * fez), mas não conta como o Dia 5 aprendido. Contar meia sessão empurraria
   * a paciente para o dia seguinte sem o que ele pressupõe — e o Dia 6 abre
   * dizendo "hoje a gente treina o que serve fora daqui", o que só faz sentido
   * depois do silêncio do 5.
   */
  function concluirDiaDoPrograma() {
    if (!emPrograma) return;
    const novo = Math.max(progFeitos, emPrograma.dia);
    setProgFeitos(novo);
    lsSet(CHAVE_DO_PROGRAMA, novo);
  }

  function encerrarGuardando() {
    const feitos = Math.max(1, Math.round(((ciclo + 1) * CICLO_SEGS) / 60));
    setMinutosFeitos(feitos);
    setPausa(null);
    setEtapa("reflexo");
    registrarMeditacao(feitos, null);
    finish();
  }

  /**
   * O LEMBRETE DIÁRIO.
   *
   * ⚠️ Pedir permissão de notificação AQUI, e não antes: é o único instante em
   * que a paciente acabou de dizer que quer ser avisada. Um pedido do sistema
   * que aparece sem contexto é negado — e negado no iOS é para sempre, sem
   * segunda chance dentro do app.
   */
  async function definirLembrete(hora: string | null) {
    const antes = lembrete;
    setLembrete({ hora });
    if (hora) {
      const p = await subscribeToPush();
      if (!p.ok) {
        toast("Ative as notificações do app para o lembrete chegar", { icon: "🔕" });
      }
    }
    const ok = await gravarLembrete(hora);
    if (!ok) {
      setLembrete(antes);
      toast.error("Não consegui guardar o lembrete");
    }
  }

  function pausarSessao(motivo: "toque" | "fundo") {
    if (etapa !== "sessao" || pausada) return;
    setPausa(motivo);
    pausadoDesdeRef.current = Date.now();
    audioRef.current?.pausar();
    pararVoz();
  }

  /**
   * VOLTA — e a respiração recomeça do INÍCIO da inspiração.
   *
   * Retomar no meio de uma expiração exigiria guardar quanto faltava da fase e
   * fazer a bolha continuar de uma escala intermediária, que é justamente o
   * quadro que transição de CSS não sabe animar (foi o defeito da primeira
   * inspiração da sessão, medido em ago/2026). Recomeçar o ciclo custa no
   * máximo doze segundos, e uma respiração inteira é melhor que meia.
   * O `ciclo` NÃO volta: a barra de progresso continua honesta.
   */
  async function retomarSessao() {
    const antes = { etapa, pausada, escondida: estaEscondida(), viva: vivaRef.current };
    if (!podeRetomar(antes)) return;
    const voltou = await (audioRef.current?.retomar() ?? Promise.resolve(true));
    /**
     * ⚠️ A MESMA PERGUNTA, DE NOVO — porque esperar é onde o mundo muda.
     *
     * Entre o toque e a resposta do navegador cabem: fechar a folha (e aí o
     * recuo abaixo criaria som tocando num componente que já saiu da tela),
     * a sessão acabar, e a paciente sair do app. Este último chega também pelo
     * ▶︎ da tela bloqueada, que dispara COM a página escondida: despausar ali
     * devolveria a sessão a um mundo onde o iOS congela os relógios — a bolha
     * parada, muda, e agora sem o véu que explicava o porquê.
     */
    if (!podeRetomar({ ...antes, escondida: estaEscondida(), viva: vivaRef.current })) return;
    /* Contexto suspenso pode recusar voltar sem um gesto novo — e este caminho
       SEMPRE vem de um toque (o botão da tela ou o do card do sistema), então
       recriar aqui é seguro e devolve o som. Sem isto ela voltaria para uma
       sessão em silêncio, que é metade do defeito que a pausa veio consertar.
       O som lido é o ATUAL (`somRef`), nunca o da closure do toque: ela pode
       ter silenciado enquanto o contexto voltava. */
    const somAgora = somRef.current;
    if (!voltou && somAgora !== "silencio") {
      audioRef.current?.stop();
      audioRef.current = createSoundscape(somAgora);
      audioRef.current.start();
    }
    setFase("in");
    setPausa(null);
    /* O relógio da sessão SALTA para a frente pelo tempo que ficou pausada —
       sem isto, o contador contaria o tempo de pausa como se ela tivesse
       continuado respirando, e "3m" viraria "1m" na volta do banheiro. */
    if (inicioSessaoRef.current != null && pausadoDesdeRef.current != null) {
      inicioSessaoRef.current += Date.now() - pausadoDesdeRef.current;
    }
    pausadoDesdeRef.current = null;
    /* A fala e as palavras do compasso são refeitas: a deixa deste ciclo foi
       cortada no meio pelo `pararVoz()`, e o texto dela continua na tela. Sem
       isto a frase ficaria escrita sem nunca ter sido dita — e "Inspire" só
       sairia quando a pausa tivesse caído fora da inspiração. */
    setRetomada((n) => n + 1);
  }

  function close() {
    /* ⚠️ O ✕ NO MEIO DA SESSÃO PASSOU A GUARDAR, EM VEZ DE JOGAR FORA.
       Ele descartava tudo: nove minutos de meditação, e nem estrela, nem
       minutos, nem dia de sequência. O único caminho que salvava era o botão
       "Encerrar por aqui" — pequeno, no rodapé, em texto de baixo contraste —,
       enquanto o ✕ fica no canto superior, que é onde o dedo vai quando alguém
       decide que já é o bastante. O app cobrava dela saber a diferença entre
       dois botões que significam a mesma coisa.
       O corte é o mesmo do outro botão (5 ciclos = um minuto redondo): abaixo
       disso não houve sessão para guardar, e aí o ✕ continua sendo só sair. */
    if (etapa === "sessao" && ciclo >= UM_MINUTO) {
      audioRef.current?.stop();
      audioRef.current = null;
      pararVoz();
      encerrarGuardando();
      return;
    }
    audioRef.current?.stop();
    audioRef.current = null;
    pararVoz();
    pararAmostra();
    setPausa(null);
    if (aoSair) return aoSair();
    setOpen(false);
    setEtapa("escolha");
  }

  /**
   * ⚠️ TROCAR O SOM PAUSADA NÃO PODE COMEÇAR A TOCAR.
   *
   * A faixa de cima fica acima do véu de propósito (o ✕ é a saída), então 🔊 e
   * 🗣️ continuam alcançáveis com "Pausado" na tela. Sem este guarda, silenciar
   * e religar durante a pausa trazia o pad de volta em volume cheio por cima do
   * véu — som tocando numa sessão que a tela diz estar parada.
   * A escolha é guardada; ela vale quando a sessão voltar.
   */
  function pararAmostra() {
    if (amostraTimer.current) clearTimeout(amostraTimer.current);
    amostraTimer.current = null;
    amostraRef.current?.stop();
    amostraRef.current = null;
    setAmostrando(null);
  }

  function ouvirAmostra(k: SoundscapeKey) {
    const eraEste = amostrando === k;
    pararAmostra();
    /* Tocar de novo no mesmo chip desliga: quem já ouviu não precisa esperar
       os dez segundos para escolher outro. */
    if (eraEste || k === "silencio") return;
    const s = createSoundscape(k);
    amostraRef.current = s;
    s.start();
    setAmostrando(k);
    amostraTimer.current = setTimeout(() => {
      /* Desce o volume antes de cortar: `stop()` fecha o contexto no ato, e
         corte seco é o oposto do que esta tela inteira existe para fazer. */
      amostraRef.current?.setVolume(0.0001);
      amostraTimer.current = setTimeout(pararAmostra, 400);
    }, AMOSTRA_MS);
  }

  function trocarSom(k: SoundscapeKey) {
    setSom(k);
    somRef.current = k;
    if (etapa === "sessao" && !pausada) {
      audioRef.current?.stop();
      audioRef.current = createSoundscape(k);
      audioRef.current.start();
    } else if (etapa === "escolha") {
      ouvirAmostra(k);
    }
  }

  function alternarVoz() {
    setVoz((v) => {
      if (v) pararVoz();
      return !v;
    });
  }

  const faseLabel = fase === "in" ? "Inspire" : fase === "hold" ? "Segure" : "Solte";
  /* O ANEL USA A TABELA DA BOLHA, e não uma própria.
     Ele tinha 1,00 → 1,34 com curva suavizada enquanto a bolha no centro dele
     fazia 0,90 → 1,16 em ritmo linear: dois círculos concêntricos com
     amplitudes e acelerações diferentes, que é exatamente o que se vê como um
     deslizando dentro do outro. Medido antes: aos 13,1 s a bolha tinha andado
     26% do percurso e o anel 19%.
     Agora os dois leem os MESMOS números (`ESCALA_RESPIRO`, exportada de
     `bolha.tsx`) e a mesma função de tempo (`linear`, ver `.dc-guiado`). */
  const escala = ESCALA_RESPIRO[faseVisual];

  return (
    <>
      <div className="mt-4 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🧘</span>
          <div className="flex-1">
            <p className="text-sm font-extrabold text-violet-800">Meditação do dia</p>
            <p className="text-xs text-violet-700/80">
              {med.theme} · você escolhe o tempo {alreadyDone ? "· feito hoje ✓" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setOpen(true);
            setEtapa("escolha");
          }}
          className="press mt-3 w-full rounded-full bg-violet-500 py-2.5 text-sm font-extrabold text-white"
        >
          {alreadyDone ? "Meditar de novo" : "Começar a meditar"}
        </button>
        {/* O atalho fica AQUI, e não só dentro da meditação: quem acorda às
            três da manhã não vai abrir uma sessão de dez minutos para chegar
            ao som. */}
        <button
          onClick={() => setSonsAbertos(true)}
          className="press mt-2 w-full text-center text-[12px] font-bold text-violet-600/80"
        >
          🌙 Só sons, para dormir
        </button>
      </div>

      {open && (
        <div
          className="dc-quiz-in fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-violet-100 via-fuchsia-50 to-white"
          style={{ paddingTop: "var(--safe-top)" }}
        >
          {/* A faixa de cima fica ACIMA do véu da pausa (`z-30` contra `z-20`):
              o ✕ é a saída, e ele agora guarda a sessão em vez de descartá-la —
              cobri-lo com o véu tiraria a saída de quem pausou justo para sair. */}
          <div className="relative z-30 flex items-center px-4 py-3">
            <button
              onClick={close}
              aria-label="Fechar"
              className="press text-2xl leading-none text-slate-400"
            >
              ✕
            </button>
            {etapa === "sessao" ? (
              <div className="mx-3 h-1.5 flex-1 overflow-hidden rounded-full bg-violet-200">
                <div
                  className="h-full rounded-full bg-violet-500"
                  style={{
                    width: `${((ciclo + 1) / totalCiclos) * 100}%`,
                    /* Pausada, a barra congela onde está: uma barra que continua
                       andando com a sessão parada é a tela mentindo. */
                    transition: pausada ? "none" : `width ${CICLO_SEGS}s linear`,
                  }}
                />
              </div>
            ) : (
              <span className="flex-1" />
            )}
            {/* O NÚMERO AO LADO DA BARRA — pedido do dono, no lugar de "Calma ·
                2 min restantes" embaixo da frase. A barra já mostra a
                evolução; isto é só a contagem que ela pediu para acompanhar,
                sem repetir o tema nem a palavra "restantes". `tabular-nums`
                trava a largura: sem isso "9s" para "10s" empurra o ícone de
                pausa um pixel para o lado a cada troca de dígito. */}
            {etapa === "sessao" && (
              <span className="mr-2 text-[12px] font-bold tabular-nums text-violet-500/80">
                {formatarRestante(restanteSeg)}
              </span>
            )}
            {etapa === "sessao" && (
              <div className="flex items-center gap-3">
                {/* ⏸ DESENHADO, e não emoji: o de pausa sai com cor própria em
                    cada sistema (a mesma lição do 📞 preto no iOS e do
                    calendário da fita). Aqui ele tem de ser da cor da tela. */}
                <button
                  onClick={() => (pausada ? void retomarSessao() : pausarSessao("toque"))}
                  aria-label={pausada ? "Continuar" : "Pausar"}
                  className="press grid h-9 w-9 place-items-center rounded-full border border-violet-200 bg-white/70 text-violet-600"
                >
                  <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="currentColor">
                    {pausada ? (
                      <path d="M8 5.2v13.6L19 12z" />
                    ) : (
                      <path d="M6.6 4.8h3.7v14.4H6.6zM13.7 4.8h3.7v14.4h-3.7z" />
                    )}
                  </svg>
                </button>
                {/* ⚠️ ÍCONE DESENHADO, e não mais o emoji 🗣️ — pedido do dono
                    ("está muito feio"). Um balão de fala com duas linhas por
                    dentro: a mesma ideia do emoji (voz narrando um texto),
                    sem a renderização inconsistente de emoji entre sistemas
                    (a mesma lição do 📞 preto no iOS). */}
                <button
                  onClick={alternarVoz}
                  aria-label={voz ? "Desligar voz" : "Ligar voz"}
                  className={`press ${voz ? "text-violet-600" : "text-violet-300"}`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-[18px] w-[18px]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3.5" y="4" width="17" height="11" rx="3" />
                    <path d="M7.5 15v3.6l3.6-3.6" />
                    <path d="M8 8.3h8M8 11.3h5" />
                  </svg>
                </button>
                {/* ⚠️ NÃO ALTERNA MAIS DIRETO — abre as opções. Pedido do dono:
                    "que a pessoa consiga abrir uma aba com os sons
                    disponíveis para mudar dentro do exercício". */}
                <button
                  onClick={() => setSomNaSessaoAberto(true)}
                  aria-label="Trocar o som de fundo"
                  className="press text-xl leading-none"
                >
                  {som === "silencio" ? "🔇" : "🔊"}
                </button>
              </div>
            )}
          </div>

          {/* ── 1. Escolha: tempo, necessidade, som ───────────────────────── */}
          {etapa === "escolha" && (
            <div className="flex-1 overflow-y-auto px-6 pb-10">
              <h3 className="font-serif text-[26px] font-semibold text-violet-900">Meditar</h3>
              <p className="mt-1 text-[13px] text-violet-800/70">
                {seq > 0 ? (
                  <>
                    🔥 {seq} {seq === 1 ? "dia seguido" : "dias seguidos"}
                    {log.minutos > 0 ? ` · ${log.minutos} min no total` : ""}
                  </>
                ) : (
                  "Alguns minutos só seus. Comece por onde der."
                )}
              </p>

              {/* ── O LEMBRETE DIÁRIO ─────────────────────────────────────
                  Fica colado na sequência de propósito: são a mesma coisa —
                  a chama diz quantos dias ela veio, e isto é o que a traz. É a
                  metade do Headspace que faltava aqui.
                  Some inteiro se as colunas ainda não existirem no banco: um
                  interruptor que não guarda nada é pior que interruptor nenhum. */}
              {lembrete && !careMode && (
                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-violet-200 bg-white/70 px-4 py-2.5">
                  <span className="text-lg leading-none" aria-hidden>
                    🔔
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-extrabold text-violet-900">Lembrar todo dia</p>
                    <p className="text-[11px] leading-snug text-violet-700/70">
                      {lembrete.hora
                        ? "E fico quieto se você já tiver meditado"
                        : "Um empurrãozinho na hora que você escolher"}
                    </p>
                  </div>
                  {lembrete.hora ? (
                    <>
                      <input
                        type="time"
                        aria-label="Horário do lembrete"
                        value={lembrete.hora}
                        onChange={(e) => e.target.value && void definirLembrete(e.target.value)}
                        className="rounded-xl border border-violet-200 bg-white px-2 py-1.5 text-sm font-extrabold text-violet-700"
                      />
                      <button
                        onClick={() => void definirLembrete(null)}
                        aria-label="Desligar lembrete"
                        className="press text-lg leading-none text-violet-300"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => void definirLembrete("21:00")}
                      className="press rounded-full bg-violet-500 px-4 py-1.5 text-xs font-extrabold text-white"
                    >
                      Ativar
                    </button>
                  )}
                </div>
              )}

              {/* ── OS SETE PRIMEIROS DIAS ────────────────────────────────
                  Enquanto o programa não acabou, a tela abre com UM cartão em
                  vez de quatro perguntas. Para quem nunca meditou, "o que você
                  precisa agora?" é uma pergunta difícil — ela não sabe, e é
                  por não saber que está aqui. Quatro decisões viram quatro
                  chances de fechar o app.
                  ⚠️ O menu não some: ele desce. Tocar em "ou escolha você
                  mesma" abre exatamente a tela de sempre, inteira. */}
              {diaAtualDoPrograma && !menuAberto && (
                <>
                  <div className="mt-6 rounded-3xl bg-violet-500 p-5 text-white">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/80">
                      Dia {diaAtualDoPrograma.dia} de {PROGRAMA.length}
                    </p>
                    <p className="mt-1.5 font-serif text-[21px] leading-tight">
                      {diaAtualDoPrograma.titulo}
                    </p>
                    <p className="mt-1 text-[12.5px] text-white/85">{diaAtualDoPrograma.sub}</p>
                    <div className="mt-3.5 flex gap-1.5" aria-hidden>
                      {PROGRAMA.map((d) => (
                        <span
                          key={d.dia}
                          className={`h-1.5 flex-1 rounded-full ${
                            d.dia <= progFeitos ? "bg-white" : "bg-white/30"
                          }`}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => begin(diaAtualDoPrograma)}
                      className="press mt-4 w-full rounded-full bg-white py-3 text-sm font-extrabold text-violet-600"
                    >
                      Começar
                    </button>
                  </div>
                  <button
                    onClick={() => setMenuAberto(true)}
                    className="press mt-3 flex w-full items-center justify-between border-t border-dashed border-violet-200 pt-3 text-[13px] text-violet-700/75"
                  >
                    <span>Ou escolha você mesma</span>
                    <span aria-hidden>⌄</span>
                  </button>
                </>
              )}

              {(!diaAtualDoPrograma || menuAberto) && (
                <>
                  <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-violet-500">
                    De quanto tempo você tem?
                  </p>
                  <div className="mt-2 flex gap-2">
                    {DURACOES.map((m) => (
                      <button
                        key={m}
                        onClick={() => setMinutos(m)}
                        className={`press flex-1 rounded-2xl py-3 text-sm font-extrabold transition-colors ${
                          minutos === m
                            ? "bg-violet-500 text-white"
                            : "border border-violet-200 bg-white/70 text-violet-700"
                        }`}
                      >
                        {m} min
                      </button>
                    ))}
                  </div>

                  <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-violet-500">
                    O que você precisa agora?
                  </p>
                  <div className="mt-2 grid gap-2">
                    {temas.map((m, i) => (
                      <button
                        key={m.theme}
                        onClick={() => setTemaIdx(i)}
                        className={`press flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${
                          temaIdx === i
                            ? "bg-violet-500 text-white"
                            : "border border-violet-200 bg-white/70 text-violet-900"
                        }`}
                      >
                        <span className="text-2xl leading-none">{m.emoji}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-extrabold">{m.need}</span>
                          <span
                            className={`block text-[11px] ${temaIdx === i ? "text-white/75" : "text-violet-700/70"}`}
                          >
                            {m.theme}
                          </span>
                        </span>
                        {i === sugerida && (
                          <span
                            className={`shrink-0 rounded-full px-2 py-[3px] text-[9.5px] font-bold ${
                              temaIdx === i
                                ? "bg-white/25 text-white"
                                : "bg-violet-100 text-violet-700"
                            }`}
                          >
                            Do dia
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-violet-500">
                    Som de fundo
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SOUNDSCAPES.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => trocarSom(s.key)}
                        className={`press flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-colors ${
                          som === s.key
                            ? "bg-violet-500 text-white"
                            : "border border-violet-200 bg-white/70 text-violet-700"
                        }`}
                      >
                        <span aria-hidden>{s.emoji}</span>
                        {s.label}
                        {amostrando === s.key && (
                          <span className="flex items-end gap-[2px]" aria-hidden>
                            {[0, 1, 2].map((i) => (
                              <span
                                key={i}
                                className={`dc-onda w-[2px] rounded-full ${som === s.key ? "bg-white" : "bg-violet-400"}`}
                                style={{ animationDelay: `${i * 0.18}s` }}
                              />
                            ))}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-violet-700/60">
                    Toque para ouvir 5 segundos antes de escolher.
                  </p>

                  {/* ── QUANTA VOZ ELA QUER ────────────────────────────────
                  Substitui o interruptor de liga/desliga. Ele era binário e
                  caro: quem queria silêncio desligava a voz inteira e perdia
                  junto o acolhimento e a volta ao corpo — as duas partes que
                  mais importam para quem está começando. Três degraus é o que
                  o Headspace oferece (guiada, semi-guiada, não guiada), e é uma
                  das razões de ele ser o melhor app para iniciante. */}
                  <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-violet-500">
                    Quanta voz você quer?
                  </p>
                  <div className="mt-2 grid gap-2">
                    {DENSIDADES.map((d) => (
                      <button
                        key={d.chave}
                        onClick={() => {
                          setDensidade(d.chave);
                          /* "Só o ritmo" ainda usa as três palavras da respiração,
                         então a voz continua ligada — o que muda é o quanto
                         ela fala. Só o desligamento manual cala tudo. */
                          setVoz(true);
                        }}
                        className={`press flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${
                          densidade === d.chave
                            ? "bg-violet-500 text-white"
                            : "border border-violet-200 bg-white/70 text-violet-900"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-extrabold">{d.rotulo}</span>
                          <span
                            className={`block text-[11px] ${
                              densidade === d.chave ? "text-white/75" : "text-violet-700/70"
                            }`}
                          >
                            {d.sub}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* ── PARA VOCÊS DOIS ───────────────────────────────────────
                  Fica junto do "para dormir" porque as duas são coisas que ela
                  pode querer EM VEZ da sessão de hoje — não configurações
                  dela. Some no Modo Cuidado: é preparação de parto. */}
              {!careMode && (
                <button
                  onClick={() => setCasalAberto(true)}
                  className="press mt-8 flex w-full items-center gap-3 rounded-2xl border border-violet-200 bg-white/70 px-4 py-3 text-left"
                >
                  <span className="text-2xl leading-none" aria-hidden>
                    🤲
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold text-violet-900">
                      Para vocês dois
                    </span>
                    <span className="block text-[11px] text-violet-700/70">
                      10 min com quem vai estar com você no parto
                    </span>
                  </span>
                  <span className="shrink-0 text-violet-400" aria-hidden>
                    ›
                  </span>
                </button>
              )}

              {/* Sai do fluxo da sessão de propósito: não é uma escolha DESTA
                  meditação, é outra coisa que ela pode querer em vez dela. */}
              <button
                onClick={() => setSonsAbertos(true)}
                className="press mt-3 flex w-full items-center gap-3 rounded-2xl border border-violet-200 bg-white/70 px-4 py-3 text-left"
              >
                <span className="text-2xl leading-none" aria-hidden>
                  🌙
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold text-violet-900">
                    Só sons, para dormir
                  </span>
                  <span className="block text-[11px] text-violet-700/70">
                    Chuva, mar ou o coração — com a tela apagada
                  </span>
                </span>
                <span className="shrink-0 text-violet-400" aria-hidden>
                  ›
                </span>
              </button>
            </div>
          )}

          {/* O botão fica FIXO no rodapé: a lista de necessidades tem sete
              itens e empurrava o "Começar" para fora da tela — quem escolhia o
              primeiro tema tinha que rolar até o fim pra poder começar. */}
          {etapa === "escolha" && (!diaAtualDoPrograma || menuAberto) && (
            <div
              className="border-t border-violet-200/60 bg-white/70 px-6 pb-5 pt-3 backdrop-blur"
              style={{ paddingBottom: "calc(1.25rem + var(--safe-bottom, 0px))" }}
            >
              <button
                onClick={() => begin()}
                className="press w-full rounded-full bg-violet-500 py-3.5 text-sm font-extrabold text-white"
              >
                Começar · {minutos} min
              </button>
            </div>
          )}

          {/* ── 2. Sessão: o círculo que respira ────────────────────────────
              ⚠️ `aria-hidden` durante a pausa: o véu esconde o conteúdo do
              dedo, e não do VoiceOver. Sem isto, quem navega por gestos
              deslizava para além do véu e encontrava a frase da sessão, que a
              tela diz estar parada. `inert` faria as duas coisas de uma vez,
              mas ainda não chega ao Safari que a maioria delas usa. */}
          {etapa === "sessao" && (
            <div
              aria-hidden={pausada}
              className="flex flex-1 flex-col items-center justify-center px-8 text-center"
            >
              <div className="relative flex h-56 w-56 items-center justify-center">
                <div
                  className="dc-guiado absolute h-40 w-40 rounded-full bg-fuchsia-200/40 blur-2xl"
                  style={
                    {
                      transform: `scale(${escala})`,
                      "--guiado-ms": `${respiroMs}ms`,
                      "--guiado-escala": escala,
                    } as React.CSSProperties
                  }
                  aria-hidden
                />
                <div
                  className="dc-guiado absolute h-40 w-40 rounded-full border-2 border-violet-400/50 bg-gradient-to-br from-white/95 to-violet-300/70"
                  style={
                    {
                      transform: `scale(${escala})`,
                      "--guiado-ms": `${respiroMs}ms`,
                      "--guiado-escala": escala,
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
                    } as React.CSSProperties
                  }
                  aria-hidden
                />
                {/* ── ELA, RESPIRANDO JUNTO (veio da Respiração) ──────────
                    Era o único ativo que a Respiração tinha e esta tela não, e
                    é o melhor que ela tinha. O comentário que morava lá dizia
                    por quê, e vale igual aqui: o personagem DEMONSTRA o que se
                    pede à paciente, em vez de a tela mandar. É o que o Duo faz
                    no Duolingo — ele não explica o exercício, ele faz junto.
                    Antes havia dois círculos de gradiente e um número: isso é
                    informação, não companhia.

                    Ela escala SOZINHA, pelo `respiro`. Um `scale` no contêiner
                    multiplicaria com o dela e a bolha estouraria os anéis, que
                    já têm o seu próprio. */}
                <div className="relative z-10 flex flex-col items-center gap-2">
                  <Bolha
                    tamanho={96}
                    humor="dormindo"
                    flutua={false}
                    respiro={{ fase: faseVisual, duracaoMs: respiroMs }}
                  />
                  {/* Só a PALAVRA. O número que ficava aqui saiu — ver o
                      comentário no relógio da respiração. Quem conta é o
                      desenho, e ele voltou a contar certo. */}
                  <span className="text-[15px] font-bold uppercase tracking-[0.18em] text-violet-500">
                    {faseLabel}
                  </span>
                </div>
              </div>

              <p
                key={ciclo}
                className={`dc-q-slide mt-10 min-h-[84px] max-w-sm font-serif text-[22px] leading-relaxed ${
                  frase ? "text-violet-900" : "text-violet-500/60"
                }`}
              >
                {frase ?? "Só respire."}
              </p>

              {/* ⚠️ O "CALMA · X MIN RESTANTES" SAIU DAQUI — pedido do dono: a
                  barra de progresso já mostra a evolução, e o contador que a
                  substituiu mora ao lado dela, no topo (ver
                  `formatarRestante`). Duas contagens da mesma coisa, em dois
                  lugares da tela, era a mesma repetição que já tinha saído do
                  link da Gratidão — a informação sobrando, não faltando. */}

              {/* ⚠️ "ENCERRAR POR AQUI" SAIU — pedido do dono: "se a pessoa
                  quiser sair é só clicar no X". O ✕ já GUARDA a sessão
                  (`close()`, ver o comentário lá) desde que ela passe de um
                  minuto — os dois botões faziam exatamente a mesma coisa, um
                  no canto e um aqui embaixo, e o app cobrava dela saber a
                  diferença entre dois botões que significam a mesma coisa.
                  Um caminho só para "eu quero parar" é mais fácil de achar
                  do que dois que levam ao mesmo lugar. */}
            </div>
          )}

          {/* ── O véu da pausa ────────────────────────────────────────────
              Cobre a sessão, nunca a substitui: por baixo a bolha continua no
              lugar, no repouso, e a barra de progresso congelada mostra onde
              ela parou. Trocar a tela inteira faria a volta parecer uma sessão
              nova.

              ⚠️ O texto diz QUAL dos dois motivos foi. "O app saiu da tela"
              responde a pergunta que a paciente faria ("por que parou?") antes
              de ela desconfiar do aplicativo — que era exatamente o que
              acontecia quando isto não existia e ela voltava para uma bolha
              imóvel e muda. */}
          {etapa === "sessao" && pausada && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Sessão pausada"
              className="absolute inset-0 z-20 flex flex-col items-center justify-center px-8 text-center backdrop-blur-[2px]"
            >
              <div className="absolute inset-0 bg-violet-50/80" aria-hidden />
              <div className="relative flex w-full flex-col items-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-violet-500/10 text-violet-500">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                    <path d="M6.6 4.8h3.7v14.4H6.6zM13.7 4.8h3.7v14.4h-3.7z" />
                  </svg>
                </span>
                <h3
                  aria-live="assertive"
                  className="mt-4 font-serif text-[24px] font-semibold text-violet-900"
                >
                  Pausado
                </h3>
                <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-violet-800/75">
                  {pausa === "fundo"
                    ? "O app saiu da tela e a sessão parou aqui. Está tudo guardado."
                    : "Sem pressa. Sua respiração espera por você."}
                </p>
                <button
                  onClick={() => void retomarSessao()}
                  className="press mt-7 w-full max-w-xs rounded-full bg-violet-500 py-3.5 text-sm font-extrabold text-white"
                >
                  Continuar
                </button>
                {/* "Encerrar por aqui" saiu — o ✕ da faixa de cima continua
                    alcançável durante a pausa (`z-30` contra o `z-20` deste
                    véu) e já guarda a sessão. */}
              </div>
            </div>
          )}

          {/* ── O SHEET DE SONS, DENTRO DA SESSÃO ───────────────────────────
              Pedido do dono: tocar no ícone de som abre as opções para trocar
              SEM sair do exercício, com "desligar" no final. Antes o ícone
              alternava direto entre o som escolhido e o silêncio — quem
              estava ouvindo chuva e queria mar tinha de silenciar primeiro
              para depois reabrir o menu de escolha, que só existe na tela de
              ANTES de começar.
              ⚠️ `trocarSom` já troca o som AO VIVO quando `etapa === "sessao"`
              (ver a função): o sheet só precisa chamá-la, a troca acontece na
              hora, sem esperar ela fechar o painel. */}
          {etapa === "sessao" && somNaSessaoAberto && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Trocar o som de fundo"
              className="absolute inset-0 z-40 flex flex-col justify-end"
            >
              <button
                aria-label="Fechar"
                onClick={() => setSomNaSessaoAberto(false)}
                className="absolute inset-0 bg-violet-900/30 backdrop-blur-[1px]"
              />
              <div
                className="relative rounded-t-3xl bg-white px-6 pb-8 pt-5"
                style={{ paddingBottom: "calc(2rem + var(--safe-bottom, 0px))" }}
              >
                <p className="text-center text-[11px] font-bold uppercase tracking-wider text-violet-500">
                  Som de fundo
                </p>
                <div className="mt-4 grid gap-2">
                  {SOUNDSCAPES.filter((s) => s.key !== "silencio").map((s) => (
                    <button
                      key={s.key}
                      onClick={() => {
                        trocarSom(s.key);
                        setSomNaSessaoAberto(false);
                      }}
                      className={`press flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${
                        som === s.key
                          ? "bg-violet-500 text-white"
                          : "border border-violet-200 bg-white/70 text-violet-900"
                      }`}
                    >
                      <span className="text-xl leading-none" aria-hidden>
                        {s.emoji}
                      </span>
                      <span className="text-sm font-extrabold">{s.label}</span>
                    </button>
                  ))}
                </div>
                {/* "No final a opção de desligar" — separada dos chips de som,
                    para não se confundir com mais uma escolha de trilha: é o
                    fim da lista, não mais uma faixa. */}
                <button
                  onClick={() => {
                    trocarSom("silencio");
                    setSomNaSessaoAberto(false);
                  }}
                  className="press mt-4 w-full rounded-full border border-violet-200 bg-white/70 py-3 text-sm font-bold text-violet-600"
                >
                  🔇 Desligar som
                </button>
              </div>
            </div>
          )}

          {/* ── 3. Fechamento: a pergunta que devolve a sessão pra ela ─────── */}
          {etapa === "reflexo" && (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              <span className="text-5xl">🧘</span>
              <h3 className="mt-4 font-serif text-[26px] font-semibold text-violet-900">
                Como você está agora?
              </h3>
              <p className="mt-1.5 text-[13px] text-violet-800/70">
                Sem resposta certa — é só pra você notar a diferença.
              </p>
              <div className="mt-6 grid w-full max-w-xs grid-cols-1 gap-2">
                {COMO_ESTOU.filter((c) => !careMode || c.label !== "Conectada").map((c) => (
                  <button
                    key={c.label}
                    onClick={() => {
                      setHumor(c.label);
                      /* A voz do fechamento sai do CLIQUE dela, e não de um
                         efeito: é o gesto que libera o áudio no Safari, e sem
                         ele a última palavra da sessão sairia muda. */
                      if (voz) {
                        const f = faixaDaFala(FALA_DO_FECHAMENTO[c.label] ?? "");
                        if (f) tocarVoz(f, { canal: "guia" });
                      }
                      registrarMeditacao(0, c.label);
                      /* Fora do aparelho também — é o que faz esta resposta
                         chegar ao gráfico de humor dela e ao prontuário. */
                      void registrarHumorDaMeditacao(c.emoji, c.label, minutosFeitos || minutos);
                      setEtapa("fim");
                    }}
                    className="press flex items-center gap-3 rounded-2xl border border-violet-200 bg-white/75 px-4 py-3 text-left text-sm font-bold text-violet-900"
                  >
                    <span className="text-xl leading-none">{c.emoji}</span>
                    {c.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setEtapa("fim")}
                className="press mt-5 text-xs font-bold text-violet-500"
              >
                Pular
              </button>
            </div>
          )}

          {etapa === "fim" && (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              {!careMode && <ConfettiBurst />}
              <span className="dc-result-in text-6xl">🧘</span>
              <h3 className="mt-3 font-serif text-[26px] font-semibold text-violet-900">
                {(() => {
                  const m = minutosFeitos || minutos;
                  return `${m} ${m === 1 ? "minuto" : "minutos"} só seus`;
                })()}{" "}
                💜
              </h3>
              <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-violet-800/80">
                {(humor && FECHAMENTO[humor]) ||
                  "Você tirou um tempinho só pra você. Leve essa calma com você."}
              </p>
              {seq > 0 && (
                <p className="mt-3 text-[13px] font-bold text-violet-600">
                  🔥 {seq} {seq === 1 ? "dia seguido" : "dias seguidos"}
                </p>
              )}
              {!careMode && reward != null && reward > 0 && (
                <div className="mt-4 rounded-full bg-emerald-100 px-5 py-2 text-base font-extrabold text-emerald-700">
                  +{reward} 🌱 Sementinhas!
                </div>
              )}
              <button
                onClick={close}
                className="press mt-8 w-full max-w-xs rounded-full bg-violet-500 py-3 text-sm font-extrabold text-white"
              >
                Voltar ao caminho
              </button>
            </div>
          )}
        </div>
      )}

      {/* Fora da folha da meditação: ela abre os sons sem sessão nenhuma, e a
          folha continua por baixo se ela veio de dentro. */}
      {sonsAbertos && <SonsParaDormir aoFechar={() => setSonsAbertos(false)} />}
      {casalAberto && <SessaoDoCasal aoSair={() => setCasalAberto(false)} />}
    </>
  );
}

/* ══════════════════ Momento com o bebê — Cartas de 1 minuto ══════════════════
   Cartinhas de amor pra LER EM VOZ ALTA pro bebê (ele já reconhece a voz da
   mãe por volta da semana 25 — e o coraçãozinho acalma quando ela fala).
   Uma carta por dia (rotação), leitura guiada linha a linha, ~1 minuto. */

const BONDING_LETTERS: { title: string; emoji: string; lines: string[] }[] = [
  {
    title: "Pra você, que eu ainda não vi",
    emoji: "💛",
    lines: [
      "Oi, meu amor. Sou eu — a sua mãe.",
      "A gente ainda não se viu, mas eu já te conheço de cor.",
      "Sei quando você acorda, sei quando você dança aí dentro.",
      "Todo dia eu invento o seu rostinho de um jeito novo.",
      "E todos os jeitos são lindos, porque são você.",
      "Cresce tranquilo, que aqui fora já existe um amor te esperando.",
      "Um beijo, do tamanho do céu. 💛",
    ],
  },
  {
    title: "O dia em que soubemos de você",
    emoji: "🌱",
    lines: [
      "Deixa eu te contar uma história: o dia em que você começou.",
      "Foi um dia comum — e de repente virou o mais importante da minha vida.",
      "Duas listras rosas, e o mundo inteiro mudou de cor.",
      "Meu coração bateu tão forte que acho que você ouviu daí.",
      "Eu ri, chorei, e liguei pra quem eu mais amo.",
      "Desde aquele dia, tudo o que eu faço tem você dentro.",
      "Essa é a nossa primeira história. Ainda vamos escrever mil. 🌱",
    ],
  },
  {
    title: "O mundo que te espera",
    emoji: "🌍",
    lines: [
      "Meu bem, deixa eu te contar do mundo aqui fora.",
      "Tem sol que esquenta o rosto e chuva que canta no telhado.",
      "Tem cheiro de café de manhã e de terra molhada à tarde.",
      "Tem gente que já te ama sem nunca ter te visto.",
      "Tem música — ah, você vai amar música.",
      "Não precisa ter pressa. Mas saiba: é bonito aqui.",
      "E vai ficar mais bonito ainda quando você chegar. 🌍",
    ],
  },
  {
    title: "A sua casa",
    emoji: "🏠",
    lines: [
      "Hoje eu quero te contar da sua casa.",
      "Tem um cantinho que a gente arruma devagarinho pra você.",
      "Cada roupinha dobrada é um 'te espero' silencioso.",
      "As paredes já sabem o seu nome — eu falo dele todo dia.",
      "Sua casa não é feita de tijolo, é feita de espera boa.",
      "E o seu melhor lugar já está pronto faz tempo:",
      "é aqui, no meu colo. 🏠",
    ],
  },
  {
    title: "Sua canção falada",
    emoji: "🎵",
    lines: [
      "Dizem que a minha voz é a sua música preferida.",
      "Então hoje eu vou te dar uma canção falada.",
      "Você é o meu sol de todo dia, mesmo quando chove.",
      "Você é o meu sonho mais corajoso.",
      "Você é a melhor parte de todos os meus planos.",
      "Guarda essa melodia aí no peito.",
      "Quando você nascer, eu canto de novo — bem baixinho, no seu ouvido. 🎵",
    ],
  },
  {
    title: "Você é coragem",
    emoji: "🦁",
    lines: [
      "Sabia que você já me deixou mais corajosa?",
      "Antes de você, eu tinha medo de um monte de coisas.",
      "Agora eu tenho força que eu nem sabia que existia.",
      "É que amor grande faz a gente crescer por dentro.",
      "Se um dia você tiver medo, lembra: coragem corre no seu sangue.",
      "A gente já é um time, eu e você.",
      "E time que se ama não se solta. 🦁",
    ],
  },
  {
    title: "O nosso primeiro passeio",
    emoji: "🌳",
    lines: [
      "Fecha os olhinhos — deixa eu te levar num sonho.",
      "No nosso primeiro passeio, vai ter sol peneirado entre as folhas.",
      "Eu vou te mostrar o céu e você vai piscar, encantado.",
      "Um cachorro vai latir longe, e eu vou dizer: 'olha, au-au!'",
      "Você vai dormir no meio do passeio, e tudo bem.",
      "O mundo pode esperar — eu vou estar ocupada te olhando.",
      "Já estou com saudade desse dia que ainda não aconteceu. 🌳",
    ],
  },
  {
    title: "Obrigada por me escolher",
    emoji: "🌷",
    lines: [
      "Hoje o recado é curto e é o mais verdadeiro de todos.",
      "De todos os lugares do universo, você veio parar aqui.",
      "Bem no meu colo, bem no meu peito, bem em mim.",
      "Obrigada por me escolher pra ser a sua mãe.",
      "Eu prometo errar tentando acertar, todos os dias.",
      "E te amar sem instruções, sem medida e sem fim.",
      "Você já é a melhor coisa que eu fiz. 🌷",
    ],
  },
  {
    title: "Pros dias difíceis",
    emoji: "🌧️",
    lines: [
      "Meu amor, nem todo dia aqui fora é fácil — e tudo bem.",
      "Hoje talvez a mamãe esteja cansada, e sabe o que me levanta?",
      "Você. Um chutinho seu vale por dez xícaras de café.",
      "Quando eu falo com você, o dia desamarra os nós.",
      "Então fica aí, quietinho, sendo o meu melhor motivo.",
      "A gente atravessa qualquer chuva juntos.",
      "Depois dela, eu te mostro o arco-íris. 🌧️→🌈",
    ],
  },
  {
    title: "Até já, meu amor",
    emoji: "💌",
    lines: [
      "Essa cartinha é só pra dizer: até já.",
      "Cada dia que passa é um dia a menos pra eu te ver.",
      "Eu conto as semanas como quem conta estrelas.",
      "Você não tem ideia da festa que é você existir.",
      "Termina de crescer com calma — capricha nesse coração.",
      "Que aqui fora, o meu já é todo seu.",
      "Até já, meu amor. Assinado: a mamãe. 💌",
    ],
  },
];

function BondingBlock({
  day,
  babyName,
  canEarn,
  careMode = false,
  alreadyDone,
  onEarn,
  aoSair,
}: {
  day: number;
  /** Entra na abertura da carta feita das gratidões dela. */
  babyName?: string | null;
  canEarn: boolean;
  careMode?: boolean;
  alreadyDone: boolean;
  onEarn: () => void;
  /**
   * Presente quando o exercício foi aberto pela lista de atividades — que é
   * como a paciente chega aqui de verdade.
   *
   * Muda duas coisas: o exercício abre JÁ na tela cheia (sem o cartão
   * "Começar a meditar", que só repetia o nome do exercício que ela acabou
   * de tocar), e fechar volta para a lista em vez de voltar para o cartão.
   * Sem isto, sair do exercício caía numa tela intermediária que ninguém
   * pediu para ver.
   */
  aoSair?: () => void;
}) {
  /**
   * ⚠️ A CARTA FEITA DAS GRATIDÕES DELA — e por que ela nasceu aqui.
   *
   * São ONZE cartas escritas para 294 dias de jornada: cada uma se repete umas
   * vinte e sete vezes ao longo da gestação. E do outro lado do app havia uma
   * atividade guardando dezenas de frases dela que nenhuma tela mostrava de
   * volta. As duas carências se resolvem uma à outra: o que ela agradeceu vira
   * a carta que ela lê em voz alta para o bebê.
   *
   * É a coisa que o Finch, o Presently e o Day One estruturalmente não podem
   * fazer — eles não têm um bebê do outro lado.
   *
   * ⚠️ Fora do Modo Cuidado, e sem exceção: a atividade inteira é ler para o
   * bebê. E ela só existe a partir de oito gratidões (`MINIMO_PARA_CARTA`) —
   * uma carta de três linhas seria um cartão de felicitação.
   */
  const [minhasGratidoes, setMinhasGratidoes] = useState<Gratidao[] | null>(null);
  const cartaDelas = useMemo(
    () =>
      careMode || !minhasGratidoes
        ? null
        : cartaDasGratidoes(minhasGratidoes, { nomeDoBebe: babyName }),
    [careMode, minhasGratidoes, babyName],
  );
  const [lendoAsDelas, setLendoAsDelas] = useState(false);
  const cartaDoDia = useMemo(() => BONDING_LETTERS[day % BONDING_LETTERS.length], [day]);
  const carta = lendoAsDelas && cartaDelas ? cartaDelas : cartaDoDia;
  const [open, setOpen] = useState(!!aoSair);
  const [phase, setPhase] = useState<"intro" | "active" | "done">("intro");
  const [idx, setIdx] = useState(0);
  const [reward, setReward] = useState<number | null>(null);
  const [sound, setSound] = useState(true);
  const grantedRef = useRef(false);
  const audioRef = useRef<ReturnType<typeof createBreathAudio> | null>(null);

  useEffect(() => () => audioRef.current?.stop(), []);

  useEffect(() => {
    if (!open || careMode) return;
    let vivo = true;
    void (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: u } = await supabase.auth.getUser();
        if (!u.user || !vivo) return;
        const { data } = await (supabase as any)
          .from("journal_entries")
          .select("content,created_at")
          .eq("user_id", u.user.id)
          .ilike("content", `${PREFIXO_GRATIDAO}%`)
          /* CRESCENTE: a carta conta a história na ordem em que aconteceu. */
          .order("created_at", { ascending: true })
          .limit(300);
        if (!vivo) return;
        setMinhasGratidoes(
          ((data ?? []) as { content: string; created_at: string }[])
            .filter((l) => ehGratidao(l.content))
            .map((l) => ({ texto: textoDaGratidao(l.content), quando: l.created_at })),
        );
      } catch {
        /* Sem rede, a carta do dia continua inteira — é ela que a atividade
           sempre prometeu. A das gratidões é o extra. */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [open, careMode]);

  /* Aqui havia um avanço automático a cada 10 segundos, e ele brigava com o
     enunciado da própria tela.
     A atividade pede que ELA leia a carta em voz alta para o bebê — é esse o
     exercício, é dele que vem o vínculo. Quem lê em voz alta lê devagar, e
     lendo devagar a linha trocava embaixo dela no meio da frase. Pior: quem
     parava para chorar, ou para repetir o nome do bebê, perdia o lugar.
     Não existe relógio certo aqui. Quem decide quando a linha acabou é quem
     está lendo — por isso só o botão "Próxima linha" avança. */

  async function finish() {
    if (grantedRef.current || !canEarn || careMode) return;
    grantedRef.current = true;
    /**
     * A meia-estrela acende ANTES de falar com o servidor, e de propósito.
     *
     * Ela é progresso local: quem a ganhou foi a paciente, fazendo a atividade
     * inteira. Antes o `onEarn()` vivia dentro do `if (r.ok)` — então uma
     * queda de rede, um token expirado ou a tabela de Sementinhas ainda não
     * criada no banco faziam a tela dizer "concluído" e a estrela não acender.
     * E como `grantedRef` já estava marcado, não havia segunda chance sem
     * reabrir a atividade. Sem estrela o dia não fecha, a sequência quebra e a
     * figurinha da semana não vem — perde-se muito mais que a moeda.
     *
     * A Sementinha continua dependendo do servidor, que é quem tem o direito
     * de conceder. Essa parte pode falhar em silêncio; a estrela não.
     */
    onEarn();
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) return;
      const r = await grantWellnessReward({
        data: { accessToken: token, day, activity: "bonding" },
      });
      // Meia estrela acende sempre que o servidor confirmou a atividade (r.ok).
      // `granted` pode vir 0 quando a recompensa do dia já tinha sido paga —
      // isso não pode apagar o progresso da estrela.
      if (r.ok && r.granted > 0) setReward(r.granted);
    } catch {
      /* recompensa é secundária */
    }
  }

  function begin() {
    setIdx(0);
    setReward(null);
    grantedRef.current = false;
    if (sound) {
      audioRef.current = createBreathAudio();
      audioRef.current.start();
      audioRef.current.ambient();
    }
    setPhase("active");
  }
  function close() {
    audioRef.current?.stop();
    audioRef.current = null;
    if (aoSair) return aoSair();
    setOpen(false);
    setPhase("intro");
  }
  function toggleSound() {
    setSound((on) => {
      const next = !on;
      if (!next) {
        audioRef.current?.stop();
        audioRef.current = null;
      } else if (phase === "active") {
        audioRef.current = createBreathAudio();
        audioRef.current.start();
        audioRef.current.ambient();
      }
      return next;
    });
  }

  // Corações flutuando pro alto — o "clima" da carta (posições determinísticas).
  const hearts = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        left: `${8 + ((i * 13 + day * 7) % 84)}%`,
        delay: `${(i * 1.3) % 6}s`,
        dur: `${6 + (i % 3) * 2}s`,
        emoji: i % 3 === 0 ? "💗" : i % 3 === 1 ? "💛" : "🤍",
        size: i % 2 === 0 ? "text-2xl" : "text-lg",
      })),
    [day],
  );

  return (
    <>
      <div className="mt-4 rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-pink-50 p-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{carta.emoji}</span>
          <div className="flex-1">
            <p className="text-sm font-extrabold text-rose-800">Carta de hoje pro bebê</p>
            <p className="text-xs text-rose-700/80">
              “{carta.title}” · 1 min em voz alta {alreadyDone ? "· lida hoje ✓" : ""}
            </p>
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-rose-700/70">
          Leia em voz alta, devagar: o bebê já reconhece a sua voz — e o coraçãozinho dele acalma
          quando você fala. 💛
        </p>
        <button
          onClick={() => {
            setOpen(true);
            setPhase("intro");
          }}
          className="press mt-3 w-full rounded-full bg-rose-500 py-2.5 text-sm font-extrabold text-white"
        >
          {alreadyDone ? "Ler outra vez 💌" : "Abrir a carta 💌"}
        </button>
      </div>

      {open && (
        <div
          className="dc-quiz-in fixed inset-0 z-50 flex flex-col overflow-hidden bg-gradient-to-b from-rose-100 via-pink-50 to-white"
          style={{ paddingTop: "var(--safe-top)" }}
        >
          {/* Corações subindo — só durante a leitura e no final */}
          {(phase === "active" || phase === "done") &&
            hearts.map((h, i) => (
              <span
                key={i}
                aria-hidden
                className={`dc-heart ${h.size}`}
                style={{ left: h.left, animationDelay: h.delay, animationDuration: h.dur }}
              >
                {h.emoji}
              </span>
            ))}

          <div className="relative flex items-center px-4 py-3">
            <button
              onClick={close}
              aria-label="Fechar"
              className="press text-2xl leading-none text-slate-400"
            >
              ✕
            </button>
            {phase === "active" ? (
              <div className="flex flex-1 items-center justify-center gap-1 text-sm">
                {carta.lines.map((_, i) => (
                  <span key={i} className={i <= idx ? "" : "opacity-30 grayscale"}>
                    💗
                  </span>
                ))}
              </div>
            ) : (
              <span className="flex-1" />
            )}
            <button
              onClick={toggleSound}
              aria-label={sound ? "Desligar som" : "Ligar som"}
              className="press text-xl leading-none"
            >
              {sound ? "🔊" : "🔇"}
            </button>
          </div>

          {phase === "intro" && (
            <div className="relative flex flex-1 flex-col items-center justify-center px-8 text-center">
              <span className="text-6xl" style={{ animation: "dc-float 3s ease-in-out infinite" }}>
                💌
              </span>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-rose-400">
                {lendoAsDelas ? "Escrita por você" : "Carta de hoje"}
              </p>
              <h3 className="mt-1 font-serif text-3xl font-extrabold text-rose-900">
                {carta.title} {carta.emoji}
              </h3>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-rose-800/80">
                {lendoAsDelas ? (
                  <>
                    Esta carta é feita das coisas boas que <strong>você mesma anotou</strong> na
                    Gratidão, na ordem em que aconteceram. Leia em voz alta, devagar. 💛
                  </>
                ) : (
                  <>
                    Encontre um lugar calmo, mão na barriga… e leia <strong>em voz alta</strong>,
                    devagar. A sua voz é o som preferido do bebê. 💛
                  </>
                )}
              </p>
              <button
                onClick={begin}
                className="press mt-8 rounded-full bg-rose-500 px-10 py-3 text-sm font-extrabold text-white shadow-[0_10px_24px_-8px_rgba(244,63,94,0.6)]"
              >
                Começar a ler 💗
              </button>
              {/* ── A CARTA FEITA DAS GRATIDÕES DELA ────────────────────────
                  Só aparece quando existe (oito ou mais guardadas). Um botão
                  que abre uma carta de três linhas seria pior que não ter. */}
              {cartaDelas && (
                <button
                  onClick={() => {
                    setLendoAsDelas((v) => !v);
                    setIdx(0);
                  }}
                  className="press mt-4 text-[13px] font-bold text-rose-600 underline decoration-rose-300 underline-offset-4"
                >
                  {lendoAsDelas
                    ? "Ler a carta de hoje 💌"
                    : `Ler as ${minhasGratidoes?.length ?? 0} coisas boas que você anotou ✨`}
                </button>
              )}
            </div>
          )}

          {phase === "active" && (
            <div className="relative flex flex-1 flex-col items-center justify-center px-8 text-center">
              <p
                key={idx}
                className="dc-q-slide max-w-sm font-serif text-[26px] font-semibold leading-relaxed text-rose-900"
              >
                {carta.lines[idx]}
              </p>
              <p className="mt-8 text-[11px] font-semibold uppercase tracking-wider text-rose-300">
                leia em voz alta, no seu ritmo
              </p>
              <button
                onClick={() => {
                  buzz(16);
                  if (idx + 1 >= carta.lines.length) {
                    setPhase("done");
                    finish();
                  } else setIdx(idx + 1);
                }}
                className="press mt-4 rounded-full border border-rose-200 bg-white/70 px-6 py-2 text-xs font-bold text-rose-500 backdrop-blur"
              >
                {/* A última linha não é "próxima": é o fim da carta. Dizer
                    "Próxima linha →" ali prometia uma página que não existe. */}
                {idx + 1 >= carta.lines.length ? "Terminei de ler 💛" : "Próxima linha →"}
              </button>
            </div>
          )}

          {phase === "done" && (
            <div className="relative flex flex-1 flex-col items-center justify-center px-8 text-center">
              {!careMode && <ConfettiBurst />}
              <span className="dc-result-in text-6xl">💋</span>
              <h3 className="mt-3 font-serif text-3xl font-extrabold text-rose-900">
                Beijo entregue
              </h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-rose-800/80">
                Ele ouviu a sua voz — e, do jeitinho dele, guardou cada palavra. 💛
              </p>
              {!careMode && reward != null && reward > 0 && (
                <div className="mt-4 rounded-full bg-emerald-100 px-5 py-2 text-base font-extrabold text-emerald-700">
                  +{reward} 🌱 Sementinhas!
                </div>
              )}
              <button
                onClick={close}
                className="press mt-8 w-full max-w-xs rounded-full bg-rose-500 py-3 text-sm font-extrabold text-white"
              >
                Voltar aos jogos
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/**
 * O BEBÊ BOLHA FALANDO NUMA TELA DE ATIVIDADE.
 *
 * Pedido do dono: "ele é o nosso porta-voz do app". Na home ele mora num canto
 * e o balão pende para a esquerda; aqui ele está no EIXO da tela, então o
 * balão é centrado embaixo e o problema de shrink-to-fit que obrigou o `w-max`
 * lá não existe — o container aqui tem a largura da tela, não 44px.
 *
 * ⚠️ O HUMOR NÃO É ESCOLHIDO AQUI. `humorDaJornada` é quem sabe: o portão de
 * Modo Cuidado mora dentro dela, e uma carinha decidida por `if` local faria
 * festa na tela de quem perdeu a gestação. Este componente só diz o que está
 * acontecendo (`comemorando`) e deixa ela decidir a cara.
 */
function BolhaComBalao({
  fala,
  careMode = false,
  comemorando = false,
  tamanho = 96,
}: {
  fala: string;
  careMode?: boolean;
  comemorando?: boolean;
  tamanho?: number;
}) {
  const humor = humorDaJornada({ comemorando, careMode });
  return (
    <div className="flex flex-col items-center">
      <Bolha humor={humor} tamanho={tamanho} careMode={careMode} />
      {/* `dc-result-in` e não uma animação própria: é a mesma entrada que o
          resto das telas de resultado usa, e ela respeita
          `prefers-reduced-motion` no bloco que já existe. */}
      <p className="dc-result-in mt-2 max-w-[17rem] rounded-2xl border border-amber-200 bg-white/85 px-3.5 py-2 text-[13px] font-medium leading-snug text-amber-900 shadow-[0_6px_16px_-10px_rgba(180,120,20,0.5)]">
        {fala}
      </p>
    </div>
  );
}

/* ══════════════════ Gratidão do dia (vai pro diário) ══════════════════ */

export function GratitudeBlock({
  day,
  semana,
  posParto = false,
  canEarn,
  careMode = false,
  alreadyDone,
  onEarn,
  aoSair,
  bancada,
}: {
  day: number;
  /** Semana gestacional — escolhe o grupo de perguntas da fase. */
  semana?: number;
  /**
   * ⚠️ No pós-parto `semana` vem do dia gestacional e NÃO quer dizer nada
   * (`D` é a idade do bebê + 7). Por isso `faseDaGratidao` lê esta bandeira
   * PRIMEIRO — é o mesmo defeito que a meditação ainda tem, onde uma mãe com
   * um mês de bebê ouve o acolhimento de primeiro trimestre.
   */
  posParto?: boolean;
  canEarn: boolean;
  careMode?: boolean;
  alreadyDone: boolean;
  onEarn: () => void;
  /**
   * Presente quando o exercício foi aberto pela lista de atividades — que é
   * como a paciente chega aqui de verdade.
   *
   * Muda duas coisas: o exercício abre JÁ na tela cheia (sem o cartão
   * "Começar a meditar", que só repetia o nome do exercício que ela acabou
   * de tocar), e fechar volta para a lista em vez de voltar para o cartão.
   * Sem isto, sair do exercício caía numa tela intermediária que ninguém
   * pediu para ver.
   */
  aoSair?: () => void;
  /**
   * ⚠️ SÓ A BANCADA (`/preview-gratidao`).
   *
   * A coleção e o dia difícil vêm do diário dela no servidor, então conferir a
   * releitura, o contador e a lista exigiria uma conta com semanas de uso — e
   * é assim que uma tela passa meses sem ninguém nunca ter olhado para ela.
   * Com isto preenchido, a busca nem acontece.
   */
  bancada?: {
    gratidoes: Gratidao[];
    total: number;
    diaDificil?: boolean;
    /* A releitura mora na tela de GUARDADO, e chegar nela exige salvar no
       banco — ou seja, exige login. Sem isto, o pedaço mais importante da
       mudança continuaria impossível de olhar. */
    fase?: "write" | "lista" | "done" | "resumo";
    /** Força o marco redondo na tela de guardado, sem precisar guardar 50 vezes. */
    marco?: number;
    /** Força a faixa do dia na tela de escrever, sem esperar a madrugada chegar. */
    periodo?: Periodo;
  };
}) {
  const [open, setOpen] = useState(!!aoSair);
  const [phase, setPhase] = useState<"write" | "lista" | "done" | "resumo">(
    bancada?.fase ?? "write",
  );
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [reward, setReward] = useState<number | null>(null);
  /** O marco redondo que ela ACABOU de bater — some ao sair da tela de guardado. */
  const [marcoAtual, setMarcoAtual] = useState<number | null>(bancada?.marco ?? null);
  /** Escolha ephemeral do resumo de domingo — nunca persistida, é só reflexão. */
  const [favoritaEscolhida, setFavoritaEscolhida] = useState<string | null>(null);
  /**
   * O QUE ELA JÁ ESCREVEU — e é isto que a atividade não tinha.
   *
   * Tudo ia para `journal_entries` e nenhuma tela desta atividade mostrava de
   * volta. ⚠️ A releitura não é enfeite: escrever ajuda, RELER é o que muda o
   * afeto depois. Guardávamos tudo e nunca devolvíamos nada.
   */
  const [gratidoes, setGratidoes] = useState<Gratidao[]>(bancada?.gratidoes ?? []);
  /**
   * O contador que SÓ SOBE.
   *
   * Vem do `count` da mesma consulta, e não do tamanho da lista — a lista é
   * cortada em 200 e o número ficaria travado ali. E ele não é sequência de
   * propósito: quem passou a noite no hospital não perde nada por não ter
   * agradecido, e uma chama zerada aqui puniria exatamente quem menos deveria.
   */
  const [total, setTotal] = useState(bancada?.total ?? 0);
  const [diaDificil, setDiaDificil] = useState(bancada?.diaDificil ?? false);
  /* Gravação de voz. `podeGravar()` é lido uma vez: ele toca `navigator`, e o
     servidor não tem nenhum — no SSR o botão simplesmente não existe. */
  const [temMicrofone, setTemMicrofone] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const gravacaoRef = useRef<Gravacao | null>(null);

  const pergunta = useMemo(
    () => perguntaDoDia({ dia: day, semanas: semana, posParto, careMode, diaDificil }),
    [day, semana, posParto, careMode, diaDificil],
  );

  useEffect(() => setTemMicrofone(podeGravar()), []);

  /* O microfone não pode ficar aceso se a folha fechar no meio da gravação —
     no celular isso deixa a bolinha vermelha no alto da tela, sem nada
     gravando, até a aba morrer. */
  useEffect(
    () => () => {
      gravacaoRef.current?.cancelar();
      gravacaoRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!open || bancada) return;
    let vivo = true;
    void (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: u } = await supabase.auth.getUser();
        if (!u.user || !vivo) return;
        const sb = supabase as any;
        const [minhas, hoje] = await Promise.all([
          sb
            .from("journal_entries")
            .select("content,created_at", { count: "exact" })
            .eq("user_id", u.user.id)
            .ilike("content", `${PREFIXO_GRATIDAO}%`)
            .order("created_at", { ascending: false })
            .limit(200),
          /* O humor de HOJE decide o tom da pergunta. Só os de hoje: um dia
             ruim da semana passada não muda o que ela lê agora. */
          sb
            .from("journal_entries")
            .select("mood")
            .eq("user_id", u.user.id)
            .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
            .limit(30),
        ]);
        if (!vivo) return;
        const linhas = (minhas.data ?? []) as { content: string; created_at: string }[];
        const lidas = linhas
          .filter((l) => ehGratidao(l.content))
          .map((l) => ({ texto: textoDaGratidao(l.content), quando: l.created_at }));
        setGratidoes(lidas);
        setTotal(minhas.count ?? linhas.length);
        setDiaDificil(
          ehDiaDificil(((hoje.data ?? []) as { mood: string | null }[]).map((h) => h.mood)),
        );
        /* ── ⚠️ O RESUMO DE DOMINGO ────────────────────────────────────────
           Só entra ANTES de escrever, e só quando ela ainda não escreveu
           hoje: quem já registrou não precisa ser interrompida por uma tela
           de reflexão no caminho de volta. Nenhum app de gratidão do mercado
           para para olhar para trás antes de pedir o próximo registro. */
        const semana = gratidoesDaSemana(lidas, new Date());
        if (!alreadyDone && ehDomingoDeResumo(new Date(), semana)) setPhase("resumo");
      } catch {
        /* Sem rede a atividade continua inteira: ela escreve, e o que não dá
           é reler. Uma falha de leitura nunca pode impedir de registrar. */
      }
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* O relógio da gravação, e o corte automático em 90 s. */
  useEffect(() => {
    if (!gravando) return;
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [gravando]);
  useEffect(() => {
    if (gravando && segundos >= LIMITE_SEGUNDOS) void pararEEnviar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gravando, segundos]);

  /**
   * ⚠️ `gravar()` É CHAMADA DENTRO DO TOQUE, sem nenhum `await` antes.
   *
   * `getUserMedia` exige gesto do usuário no iOS, e depois de uma espera o
   * gesto já passou — é a mesma armadilha do `destravar()` dos sons para
   * dormir, que só aparece no aparelho.
   */
  async function comecarAGravar() {
    if (gravando || transcrevendo) return;
    try {
      const g = await gravar();
      gravacaoRef.current = g;
      setSegundos(0);
      setGravando(true);
    } catch {
      toast.error("Não consegui usar o microfone. Você pode escrever aqui embaixo. 💛");
    }
  }

  async function pararEEnviar() {
    const g = gravacaoRef.current;
    gravacaoRef.current = null;
    setGravando(false);
    if (!g) return;
    const blob = await g.parar();
    if (blob.size < 1200) {
      /* Um toque sem querer. Nada de erro vermelho por isso. */
      return;
    }
    if (blob.size > LIMITE_BYTES) {
      toast.error("O áudio ficou muito longo. Tente contar em menos tempo.");
      return;
    }
    setTranscrevendo(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) {
        toast.error("Sua sessão expirou. Entre de novo para usar o microfone.");
        return;
      }
      const corpo = new FormData();
      corpo.append("audio", new File([blob], "voz", { type: blob.type }));
      const r = await fetch("/api/transcrever-diario", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: corpo,
      });
      const dados = (await r.json().catch(() => null)) as { ok?: boolean; texto?: string } | null;
      if (!r.ok || !dados?.ok) {
        toast.error("Não consegui transcrever agora. Você pode escrever aqui embaixo. 💛");
        return;
      }
      const falado = (dados.texto ?? "").trim();
      if (!falado) {
        toast("Não consegui ouvir. Tente falar mais perto do celular.");
        return;
      }
      /* ⚠️ O QUE VOLTA É RASCUNHO, e cai no campo PARA ELA CONFERIR. A
         transcrição erra nome, corta o fim da frase e inventa pontuação —
         guardar direto poria no diário (que o médico lê) palavras que ela não
         escreveu. E ACRESCENTA ao que já estava lá: apagar o que ela digitou
         antes de falar seria perder trabalho dela. */
      setText((t) => (t.trim() ? `${t.trim()} ${falado}` : falado).slice(0, 300));
    } catch {
      toast.error("Não consegui transcrever agora. Você pode escrever aqui embaixo. 💛");
    } finally {
      setTranscrevendo(false);
    }
  }

  function descartarGravacao() {
    gravacaoRef.current?.cancelar();
    gravacaoRef.current = null;
    setGravando(false);
  }

  async function save() {
    if (saving || text.trim().length < 2) return;
    setSaving(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        // Antes isto era um `return` mudo: ela tocava "Guardar" e a tela
        // simplesmente não mudava, para sempre, sem explicação nenhuma.
        toast.error("Sua sessão expirou. Entre de novo para guardar.");
        setSaving(false);
        return;
      }
      // Guarda no diário (registro da paciente).
      const { error: erro } = await (
        supabase as unknown as {
          from: (t: string) => {
            insert: (v: Record<string, unknown>) => Promise<{ error: unknown }>;
          };
        }
      )
        .from("journal_entries")
        .insert({
          user_id: u.user.id,
          content: `${PREFIXO_GRATIDAO}${text.trim()}`,
          mood: HUMOR_GRATIDAO,
        });

      /**
       * O erro do insert precisa ser lido.
       *
       * Ele era descartado, e a tela avançava para "Guardado 💛 — anotei no
       * seu diário" de qualquer jeito: RLS negada, rede caída, tabela ausente
       * no banco. O texto que ela escreveu sumia junto com a tela, e ela saía
       * acreditando que estava guardado. Dizer que salvou sem ter salvo é o
       * pior tipo de defeito num diário — ela só descobre quando for reler.
       */
      if (erro) {
        toast.error("Não consegui guardar agora. O texto continua aqui — tente de novo.");
        return;
      }

      /* A coleção cresce na hora, sem uma segunda ida ao servidor. O `total` é
         o número que a tela mostra ("23 coisas boas nesta gestação") e ele
         precisa subir no mesmo instante em que ela guarda — recarregar para
         ver o próprio registro entrar é o tipo de espera que faz o número
         parecer quebrado. */
      const nova = { texto: text.trim(), quando: new Date().toISOString() };
      setGratidoes((antes) => [nova, ...antes]);
      const novoTotal = total + 1;
      setTotal(novoTotal);

      /**
       * ⚠️ OS MARCOS REDONDOS — festa própria, que a atividade não tinha.
       *
       * `marcoAtingido` só devolve algo quando `novoTotal` bate exatamente um
       * dos degraus (10, 25, 50…). A celebração usa a MESMA escada de
       * `nivelDaSequencia` que a chama já usa: quanto maior o marco, maior o
       * confete — sem inventar uma segunda régua de "quão grande é a festa".
       * Nunca em Modo Cuidado: celebração é alegria, e não pode aparecer pra
       * quem está em luto.
       */
      const marco = marcoAtingido(novoTotal);
      setMarcoAtual(marco);
      if (marco && !careMode) {
        const nivel = nivelDaSequencia(marco);
        fireConfetti(nivel);
        celebrateChime(nivel);
        celebrateHaptic(nivel);
      }

      /* Recompensa (uma por dia, como as outras atividades de bem-estar).
         A meia-estrela vem antes do servidor — ela escreveu, e isso já
         aconteceu, então rede caída não pode apagar o progresso dela.
         Mas NÃO vem antes do Modo Cuidado: as outras quatro atividades saem
         no começo do `finish()` quando ele está ligado, e só esta acendia a
         estrela no luto. Em Modo Cuidado não há jornada, não há estrela e não
         há placar — o diário continua funcionando, que é o que importa. */
      if (careMode) return;
      /* ⚠️ `onEarn` SÓ NO DIA DE HOJE — e esta era a única das quatro
         atividades que não conferia.
         As outras três (`movement`, `meditation`, `bonding`) barram logo na
         primeira linha do `finish()` com `!canEarn`; aqui o `onEarn()` estava
         FORA do `if (canEarn)`, então escrever uma gratidão num dia que não é
         hoje marcava `w_gratitude` daquele dia no `localStorage`. E o que lê
         essas chaves não é só o placar: `sequencia.ts` conta a chama a partir
         das chaves `dc-path-day-<D>`, e `doneDays` solta a figurinha da semana.
         Ou seja, dava para inflar a sequência escrevendo em dias avulsos.
         Ficou pior quando o Premium passou a abrir o FUTURO: a chama nasceria
         acesa em dias que ainda não aconteceram.
         O diário NÃO é afetado — o texto dela já foi gravado acima, em
         qualquer dia. O que passa a depender de ser hoje é só a estrela. */
      if (canEarn) {
        onEarn();
        const { data: s } = await supabase.auth.getSession();
        const token = s.session?.access_token;
        if (token) {
          const r = await grantWellnessReward({
            data: { accessToken: token, day, activity: "gratitude" },
          });
          if (r.ok && r.granted > 0) setReward(r.granted);
        }
      }
      setPhase("done");
    } catch {
      toast.error("Não consegui guardar agora. O texto continua aqui — tente de novo.");
    } finally {
      setSaving(false);
    }
  }

  function close() {
    descartarGravacao();
    setFavoritaEscolhida(null);
    setMarcoAtual(bancada?.marco ?? null);
    if (aoSair) return aoSair();
    setOpen(false);
    setPhase("write");
    setText("");
  }

  /**
   * A gratidão que volta para ela na tela de guardado.
   *
   * A semente é o `total`, então a cada registro novo a que reaparece é outra
   * — sem sorteio, que mudaria a frase debaixo dos olhos dela a cada
   * re-renderização (o mesmo defeito que o balão do mascote teve com o clima).
   */
  const paraReler = useMemo(
    () => gratidaoParaReler(gratidoes, new Date(), total),
    [gratidoes, total],
  );

  /** As gratidões dos últimos 7 dias — o que o resumo de domingo mostra. */
  const semanaAtual = useMemo(() => gratidoesDaSemana(gratidoes, new Date()), [gratidoes]);

  /**
   * A faixa do dia, uma vez por abertura — não precisa reagir ao relógio: a
   * tela vive minutos, não horas, e recalcular no meio dela trocaria a frase
   * embaixo do dedo dela.
   */
  const periodoAtual = useMemo(
    () => bancada?.periodo ?? periodoDaHora(new Date().getHours()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <>
      <div className="mt-4 rounded-2xl border border-yellow-100 bg-gradient-to-br from-yellow-50 to-amber-50 p-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">✨</span>
          <div className="flex-1">
            <p className="text-sm font-extrabold text-amber-800">Gratidão do dia</p>
            <p className="text-xs text-amber-700/80">
              Uma coisa boa de hoje {alreadyDone ? "· feito hoje ✓" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setOpen(true);
            setPhase("write");
          }}
          className="press mt-3 w-full rounded-full bg-amber-500 py-2.5 text-sm font-extrabold text-white"
        >
          {alreadyDone ? "Escrever de novo" : "Escrever"}
        </button>
      </div>

      {open && (
        <div
          className="dc-quiz-in fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-yellow-100 via-amber-50 to-white"
          style={{ paddingTop: "var(--safe-top)" }}
        >
          <div className="flex items-center px-4 py-3">
            <button
              onClick={close}
              aria-label="Fechar"
              className="press text-2xl leading-none text-slate-400"
            >
              ✕
            </button>
          </div>
          {phase === "resumo" ? (
            <div className="flex flex-1 flex-col items-center overflow-y-auto px-8 pb-10 pt-2 text-center">
              {/* ── ⚠️ O RESUMO DE DOMINGO ─────────────────────────────────
                  Nenhum app de gratidão do mercado faz isto: todos empurram o
                  PRÓXIMO registro, nenhum comemora os que já existem. Antes de
                  pedir mais uma, a tela para e olha para trás.
                  Escolher uma "favorita" aqui é decoração — não existe coluna
                  pra isto, e não precisa existir: o valor é RELER, não a
                  escolha em si (ver `ehDomingoDeResumo`). */}
              <BolhaComBalao
                fala={falaDaBolha({ tela: "resumo", total: semanaAtual.length })}
                careMode={careMode}
                tamanho={96}
              />
              <h3 className="mt-4 text-2xl font-extrabold leading-tight text-amber-900">
                Antes de escrever, olha a sua semana
              </h3>
              <p className="mt-2 max-w-xs text-sm text-amber-800/80">
                Não precisa escolher nada — é só pra reler. 💛
              </p>
              <div className="mt-5 grid w-full max-w-sm gap-2">
                {semanaAtual.map((g) => (
                  <button
                    key={`${g.quando}-${g.texto.slice(0, 12)}`}
                    onClick={() => setFavoritaEscolhida(g.texto)}
                    className={`press rounded-2xl border px-4 py-3 text-left text-[13.5px] leading-snug transition-colors ${
                      favoritaEscolhida === g.texto
                        ? "border-amber-400 bg-amber-100 text-amber-900"
                        : "border-amber-200 bg-white/80 text-amber-900"
                    }`}
                  >
                    {g.texto}
                  </button>
                ))}
              </div>
              {favoritaEscolhida && (
                <p className="dc-result-in mt-3 text-[13px] font-bold text-amber-700">
                  Boa escolha 💛
                </p>
              )}
              <button
                onClick={() => setPhase("write")}
                className="press mt-6 w-full max-w-sm rounded-full bg-amber-500 py-3 text-sm font-extrabold text-white"
              >
                {alreadyDone ? "Fechar" : "Escrever a de hoje"}
              </button>
            </div>
          ) : phase === "write" ? (
            <div className="flex flex-1 flex-col items-center overflow-y-auto px-8 pb-10 pt-2 text-center">
              {/* ── O PORTA-VOZ ────────────────────────────────────────────
                  O emoji ✨ que ficava aqui não dizia nada. Quem apresenta a
                  tela agora é a personagem do app — e o que ela entrega é o
                  que era rótulo seco: quantas ela já guardou, e o reencontro
                  na tela seguinte. Ela NÃO repete a pergunta: o título grande
                  é a pergunta, e dois textos dizendo o mesmo fariam da bolha
                  um enfeite. */}
              <BolhaComBalao
                fala={falaDaBolha({ tela: "escrever", total, diaDificil, periodo: periodoAtual })}
                careMode={careMode}
                tamanho={96}
              />
              {/* ── A PERGUNTA DO DIA ──────────────────────────────────────
                  Era "O que foi bom hoje?" no dia 1 e no dia 280, com as
                  mesmas cinco fichinhas. Agora gira por fase da gestação — e
                  num dia em que ela marcou humor baixo, a pergunta muda de tom
                  inteiro (ver `PERGUNTAS_DIA_DIFICIL`): estreita, sem dizer
                  que vai passar. */}
              <h3 className="mt-4 text-2xl font-extrabold leading-tight text-amber-900">
                {pergunta.texto}
              </h3>
              <p className="mt-2 max-w-xs text-sm text-amber-800/80">
                {diaDificil
                  ? "Pode ser mínimo. Isso fica no seu diário. 💛"
                  : "Pode ser bem pequeno. Isso vai pro seu diário. 💛"}
              </p>
              {/* Fichinhas de 1 toque — destravam a escrita nos dias cansados.
                  Elas seguem a pergunta: fichas fixas embaixo de uma pergunta
                  que muda dariam respostas que não respondem nada. */}
              <div className="mt-4 flex max-w-sm flex-wrap justify-center gap-1.5">
                {pergunta.fichas.map((chip) => (
                  <button
                    key={chip}
                    onClick={() =>
                      setText((t) => (t.trim() ? `${t.trim()} · ${chip}` : chip).slice(0, 300))
                    }
                    className="press rounded-full border border-amber-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-amber-700"
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 300))}
                rows={4}
                placeholder={gravando ? "Estou ouvindo…" : "Hoje eu fiquei grata por…"}
                className="mt-3 w-full max-w-sm resize-none rounded-2xl border border-amber-200 bg-white p-3 text-sm outline-none focus:border-amber-400"
              />

              {/* ── FALAR EM VEZ DE ESCREVER ───────────────────────────────
                  Escrever no celular às onze da noite, com o bebê no colo, é
                  trabalho; falar não é. O botão SÓ APARECE onde o navegador
                  grava de verdade (`podeGravar`) — um microfone desenhado numa
                  tela que não grava promete e não cumpre.
                  ⚠️ O áudio não é guardado: vira texto e some. E o texto cai no
                  campo acima PARA ELA CONFERIR, nunca direto no diário. */}
              {temMicrofone && (
                <div className="mt-3 w-full max-w-sm">
                  {!gravando ? (
                    <button
                      onClick={comecarAGravar}
                      disabled={transcrevendo}
                      className="press flex w-full items-center justify-center gap-2 rounded-full border border-amber-300 bg-white/80 py-2.5 text-sm font-bold text-amber-700 disabled:opacity-50"
                    >
                      {transcrevendo ? (
                        "Transcrevendo…"
                      ) : (
                        <>
                          {/* Microfone DESENHADO: o emoji 🎤 sai preto no iOS —
                              a mesma lição do 📞 da Central de Emergência. */}
                          <svg
                            viewBox="0 0 24 24"
                            className="h-[17px] w-[17px]"
                            fill="currentColor"
                            aria-hidden
                          >
                            <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" />
                            <path d="M17.5 11a.9.9 0 0 0-1.8 0 3.7 3.7 0 0 1-7.4 0 .9.9 0 0 0-1.8 0 5.5 5.5 0 0 0 4.6 5.4V19h-2a.9.9 0 0 0 0 1.8h5.8a.9.9 0 0 0 0-1.8h-2v-2.6a5.5 5.5 0 0 0 4.6-5.4Z" />
                          </svg>
                          Falar como foi o dia
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={pararEEnviar}
                        className="press flex flex-1 items-center justify-center gap-2 rounded-full bg-rose-500 py-2.5 text-sm font-extrabold text-white"
                      >
                        <span
                          className="dc-rec-dot h-2.5 w-2.5 rounded-full bg-white"
                          aria-hidden
                        />
                        Gravando · {relogio(segundos)} · tocar para parar
                      </button>
                      <button
                        onClick={descartarGravacao}
                        aria-label="Descartar gravação"
                        className="press rounded-full border border-amber-200 bg-white/80 px-3 py-2.5 text-sm font-bold text-amber-700"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  <p className="mt-1.5 text-[11px] leading-snug text-amber-700/60">
                    O áudio não fica guardado — vira texto aqui pra você conferir e mudar.
                  </p>
                </div>
              )}

              <button
                onClick={save}
                disabled={saving || transcrevendo || gravando || text.trim().length < 2}
                className="press mt-4 w-full max-w-sm rounded-full bg-amber-500 py-3 text-sm font-extrabold text-white disabled:opacity-40"
              >
                Guardar
              </button>

              {/* ── A COLEÇÃO ──────────────────────────────────────────────
                  ⚠️ O NÚMERO NÃO ESTÁ AQUI, e saiu por um motivo visto na
                  bancada: o balão da bolha já diz "você já me contou 12
                  coisas boas", e este link dizia o mesmo número quatro dedos
                  abaixo. Se o porta-voz entrega a informação, o rótulo que a
                  repetia é ruído — o link fica só com a AÇÃO.
                  O contador em si continua sendo o que só sobe, e não uma
                  sequência: quem passou a noite no hospital não perde nada. */}
              {total > 0 && (
                <button
                  onClick={() => setPhase("lista")}
                  className="press mt-5 text-[13px] font-bold text-amber-700 underline decoration-amber-300 underline-offset-4"
                >
                  Ver todas
                </button>
              )}
            </div>
          ) : phase === "lista" ? (
            <div className="flex flex-1 flex-col overflow-y-auto px-6 pb-10">
              <div className="self-center">
                <BolhaComBalao
                  fala={falaDaBolha({ tela: "lista", total })}
                  careMode={careMode}
                  tamanho={72}
                />
              </div>
              <h3 className="mt-3 text-center font-serif text-[24px] font-semibold text-amber-900">
                Suas coisas boas
              </h3>
              <p className="mt-1 text-center text-[13px] text-amber-800/70">
                {total} {total === 1 ? "guardada" : "guardadas"} até aqui 💛
              </p>
              <ul className="mt-5 grid gap-2">
                {gratidoes.map((g) => (
                  <li
                    key={`${g.quando}-${g.texto.slice(0, 12)}`}
                    className="rounded-2xl border border-amber-200/70 bg-white/80 px-4 py-3 text-left"
                  >
                    <p className="text-[13.5px] leading-snug text-amber-900">{g.texto}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-amber-600/80">
                      {haQuantoTempo(g.quando, new Date())}
                    </p>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setPhase("write")}
                className="press mt-6 w-full max-w-xs self-center rounded-full bg-amber-500 py-3 text-sm font-extrabold text-white"
              >
                Escrever uma nova
              </button>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-8 py-6 text-center">
              {/* ⚠️ O confete GRANDE só no marco redondo — é a mesma distinção
                  que a Aula já faz (`big={score === total}`): o confete de
                  todo dia continua do tamanho de sempre, e só cresce quando o
                  número é mesmo especial. */}
              {!careMode && <ConfettiBurst big={!!marcoAtual} />}
              {/* ⚠️ Aqui ele COMEMORA, e a cara vem de `humorDaJornada` —
                  nunca de um `if` local. É lá que mora o portão de Modo
                  Cuidado, e uma segunda régua faria carinha festiva aparecer
                  para quem perdeu a gestação.
                  O "Guardado 💛" e o contador que ficavam em texto viraram
                  fala dele: era a mesma informação, sem voz nenhuma. */}
              <BolhaComBalao
                fala={falaDaBolha({
                  tela: "guardado",
                  total,
                  temReleitura: !!paraReler,
                  marco: marcoAtual,
                })}
                careMode={careMode}
                comemorando
                tamanho={120}
              />
              {/* O NÚMERO GRANDE — só no marco. Nos dias comuns o contador já
                  está na fala da bolha, e repeti-lo aqui em fonte gigante
                  seria o mesmo ruído que tirou o link duplicado da tela de
                  escrever. Um marco é diferente: é a exceção que merece o
                  destaque visual que o dia comum não merece. */}
              {marcoAtual && !careMode && (
                <p className="dc-result-in mt-2 font-serif text-6xl font-black text-amber-500">
                  {marcoAtual}
                </p>
              )}
              {!careMode && reward != null && reward > 0 && (
                <div className="mt-4 rounded-full bg-emerald-100 px-5 py-2 text-base font-extrabold text-emerald-700">
                  +{reward} 🌱 Sementinhas!
                </div>
              )}

              {/* ── ⚠️ O REENCONTRO ────────────────────────────────────────
                  É aqui que o exercício passa a valer: escrever ajuda, RELER é
                  o que muda o afeto depois. Nunca a de hoje nem a de ontem —
                  reler o que se acabou de escrever é eco (ver
                  `gratidaoParaReler`). Sem nada com três dias, a seção não
                  existe: melhor não ter do que repetir a frase de cima.
                  Quem ANUNCIA é a bolha, logo acima; aqui fica só a frase
                  dela, com a distância — o rótulo em caixa alta que fazia a
                  apresentação não tinha voz nenhuma. */}
              {paraReler && (
                <div className="mt-4 w-full max-w-xs rounded-2xl border border-amber-200 bg-white/80 px-4 py-3">
                  <p className="text-[15px] leading-snug text-amber-900">“{paraReler.texto}”</p>
                  <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-600">
                    {haQuantoTempo(paraReler.quando, new Date())}
                  </p>
                </div>
              )}

              <button
                onClick={close}
                className="press mt-7 w-full max-w-xs rounded-full bg-amber-500 py-3 text-sm font-extrabold text-white"
              >
                Voltar ao caminho
              </button>
              {total > 1 && (
                <button
                  onClick={() => setPhase("lista")}
                  className="press mt-3 text-[13px] font-bold text-amber-700 underline decoration-amber-300 underline-offset-4"
                >
                  Ver todas
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** Motor dos "jogos do dia": os 5 de bem-estar + a AULA (que virou jogo). */
const WELLNESS_TYPES = [
  { key: "movement", emoji: "🤸", label: "Mexer", Comp: MovementBlock },
  { key: "meditation", emoji: "🧘", label: "Meditar", Comp: MeditationBlock },
  { key: "bonding", emoji: "💛", label: "Bebê", Comp: BondingBlock },
  { key: "gratitude", emoji: "✨", label: "Gratidão", Comp: GratitudeBlock },
] as const;

/**
 * Título, descrição e o par de cores do vidro de cada jogo (`.liquid-glass`
 * pinta com `--lg-a`/`--lg-b`). São hex e não classe do Tailwind porque o
 * material precisa da cor como valor: mistura com transparência, sombra
 * colorida e rim entram por `color-mix`, não por utilitário.
 */
const WELLNESS_META: Record<
  string,
  {
    title: string;
    a: string;
    b: string;
    desc: string;
    tile?: string;
    tileB?: string;
    /** Cor do título e do glifo na lista — separada de `a`/`b`, que ainda
        pintam o material de vidro das telas de dentro. */
    ink?: string;
    /** A mesma cor levantada para o céu escuro: #2d7ff9 sobre madrugada é um
        borrão. Cada uma foi clareada até ler sobre o vidro noturno. */
    inkDark?: string;
  }
> = {
  aula: {
    /* `tile`/`ink` entraram quando a aula virou LINHA da lista (ago/2026).
       Sem eles o tile caía no `?? meta.a` e saía com o gradiente SATURADO —
       o mesmo defeito que o comentário do tile descreve, e logo na primeira
       linha da lista: cinco pastéis e um azul berrante no topo.
       O índigo é o que sobrou de livre: azul é do Respirar, roxo do Meditar,
       âmbar do Movimento, rosa do Bebê e verde da Gratidão. */
    inkDark: "#a9a8ff",
    ink: "#3d34c4",
    tile: "#dfe0fb",
    tileB: "#c9cbf7",
    title: "Aula de hoje",
    a: "#818cf8",
    b: "#3b82f6",
    desc: "A lição da professora + o quiz da semana.",
  },
  movement: {
    inkDark: "#ffbe7a",
    ink: "#b2560c",
    tile: "#fde6bd",
    tileB: "#fbd79b",
    title: "Movimento",
    a: "#fbbf24",
    b: "#f97316",
    desc: "3 movimentos leves, com a figura mostrando como fazer cada um.",
  },
  meditation: {
    inkDark: "#d2b2ff",
    ink: "#7434d4",
    tile: "#e9dcfa",
    tileB: "#dcc8f6",
    title: "Meditar",
    a: "#a78bfa",
    b: "#a855f7",
    desc: "Você escolhe o tempo, o que precisa e o som de fundo.",
  },
  bonding: {
    inkDark: "#ff9ec4",
    ink: "#c11a63",
    tile: "#fbd6e0",
    tileB: "#f8c2d2",
    title: "Momento com o bebê",
    a: "#fb7185",
    b: "#ec4899",
    desc: "Uma carta de 1 minuto pra ler em voz alta pro bebê.",
  },
  gratitude: {
    inkDark: "#84e6ab",
    ink: "#0f7538",
    tile: "#d3ecdb",
    tileB: "#bce2c8",
    title: "Gratidão",
    a: "#34d399",
    b: "#16a34a",
    desc: "Guarde uma coisa boa do seu dia no diário.",
  },
};

/** A "aula" na tela de jogos: quiz da professora ou o desafio simples do dia. */
type WellnessLesson =
  | {
      kind: "quiz";
      quiz: DailyQuiz;
      emoji: string;
      week: number;
      alreadyDone: boolean;
      locked: boolean;
      showAd: boolean;
    }
  | { kind: "challenge"; label: string; emoji: string; alreadyDone: boolean };

/** Desafio simples do dia (quando não há quiz): confirmar que fez. */
function ChallengeBlock({
  label,
  emoji,
  alreadyDone,
  canEarn,
  onEarn,
  /* Faltava. Este bloco é o plano B da aula do dia, e era o único da tela que
     não sabia do Modo Cuidado — comemorava "+½ ⭐" no luto. */
  careMode = false,
}: {
  label: string;
  emoji: string;
  alreadyDone: boolean;
  canEarn: boolean;
  onEarn: () => void;
  careMode?: boolean;
}) {
  const [doneNow, setDoneNow] = useState(false);
  const isDone = alreadyDone || doneNow;
  return (
    <div className="mt-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-blue-50 p-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{emoji}</span>
        <div className="flex-1">
          <p className="text-sm font-extrabold text-indigo-800">Desafio do dia</p>
          <p className="text-xs text-indigo-700/80">{isDone ? "Feito hoje ✓" : label}</p>
        </div>
      </div>
      <button
        onClick={() => {
          if (isDone || !canEarn) return;
          setDoneNow(true);
          onEarn();
          if (!careMode) toast.success("📚 Desafio do dia completo! +½ ⭐");
        }}
        disabled={isDone || !canEarn}
        className="press mt-3 w-full rounded-full bg-indigo-500 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
      >
        {isDone ? "Completo ✓" : canEarn ? "Marcar como feito ✓" : "Válido só no dia 💜"}
      </button>
    </div>
  );
}

/**
 * Onde cada enfeite boia, e de que tamanho.
 *
 * Posições fixas e escolhidas à mão, não sorteadas: nas laterais e nos cantos,
 * fora da coluna central onde moram o título, os cartões e os botões. Sorteio
 * puro põe um enfeite bem atrás do "Continuar aula" mais cedo ou mais tarde, e
 * aí não é mais cenário, é ruído.
 *
 * Os tamanhos variam de propósito — três planos de profundidade. Todos iguais
 * viram papel de parede repetido.
 */
const POS_ENFEITE = [
  { x: -6, y: 12, tam: 132 },
  { x: 74, y: 4, tam: 96 },
  { x: 80, y: 44, tam: 120 },
  { x: -8, y: 46, tam: 108 },
  { x: 68, y: 76, tam: 140 },
  { x: -4, y: 80, tam: 100 },
  { x: 38, y: 92, tam: 88 },
  { x: 84, y: 24, tam: 76 },
  { x: 6, y: 64, tam: 84 },
];

/* A saudação por hora do dia saiu daqui: a hero da tela do Bebê já dá bom-dia
   com o nome do bebê, e repetir "Boa noite, {bebê}" na tela seguinte só gastava
   a linha mais nobre da tela com uma frase que a paciente acabou de ler. As
   seis faixas de horário que moravam aqui foram para `dayGreetingLabel` em
   `app-mobile-shell.tsx`, onde a saudação acontece uma vez só. Esta tela usa a
   linha para dizer onde ela está: "Hoje com {bebê}". */

/* ─── O ANEL DO DIA SAIU (ago/2026) ──────────────────────────────────────
   Era um anel de 92px com "0/6 concluídos" no canto superior direito da folha
   do dia. Saiu no redesenho: placar no ALTO da tela é a primeira coisa que ela
   lê toda manhã, e de manhã ele está sempre zerado. A mesma contagem virou o
   painel de estrelas do PÉ — depois do trabalho, que é onde saldo se lê sem
   soar cobrança. O `AtividadeIcone` do tile das atividades continua abaixo. */

/**
 * Os desenhinhos das atividades.
 *
 * São traços feitos à mão e não emoji: emoji muda de arte conforme o aparelho
 * e nenhum deles existe para "pulmão" ou "lótus" no mesmo peso dos outros.
 * Traço próprio mantém as cinco linhas com a mesma espessura.
 */
function AtividadeIcone({ chave }: { chave: string }) {
  /* Preenchido, não de traço. Num tile de 38px o contorno fino some, e a
     referência usa massa sólida — é o que dá o peso de "adesivo" a cada
     linha. `fill="currentColor"` deixa a cor vir do tile. */
  const comum = {
    viewBox: "0 0 24 24",
    fill: "currentColor",
    className: "h-[22px] w-[22px]",
  };
  switch (chave) {
    case "movement": // pessoa de braços abertos
      return (
        <svg {...comum}>
          <circle cx="12" cy="4.3" r="2.4" />
          <path d="M12 7.3c-.5 0-.9.3-1.1.7L6.6 12l1.5 1.5 2.4-2.3v2.3l-2.8 5.6 1.8.9L12 15.2l2.5 4.8 1.8-.9-2.8-5.6v-2.3l2.4 2.3 1.5-1.5-4.3-4c-.2-.4-.6-.7-1.1-.7z" />
        </svg>
      );
    case "meditation": // lótus
      return (
        <svg {...comum}>
          <circle cx="12" cy="4.6" r="2.4" />
          <path d="M12 8c-1.9 0-3.4 1.5-3.4 3.4v2.2h6.8v-2.2C15.4 9.5 13.9 8 12 8z" />
          <path d="M8.3 13.9C5.6 14.6 3.4 16 2.4 17.6c2 1.8 5.5 2.9 9.6 2.9s7.6-1.1 9.6-2.9c-1-1.6-3.2-3-5.9-3.7l-.5 1.9H8.8l-.5-1.9z" />
        </svg>
      );
    case "bonding": // coração
      return (
        <svg {...comum}>
          <path d="M12 20.4s-7.8-4.8-7.8-10.1A4.7 4.7 0 0 1 12 7.2a4.7 4.7 0 0 1 7.8 3.1c0 5.3-7.8 10.1-7.8 10.1z" />
        </svg>
      );
    case "aula": // livro aberto
      /* Sem este `case` a aula cairia no `default` e usaria as FAÍSCAS da
         gratidão — duas linhas da mesma lista com o mesmo desenho, e a de
         cima seria a errada. */
      return (
        <svg {...comum}>
          <path d="M11.2 6.4C9.6 5.2 7.6 4.6 5.2 4.6c-.7 0-1.2.5-1.2 1.2v11c0 .7.5 1.2 1.2 1.2 2.2 0 4 .5 5.4 1.5.3.2.6 0 .6-.3V6.4z" />
          <path d="M12.8 6.4c1.6-1.2 3.6-1.8 6-1.8.7 0 1.2.5 1.2 1.2v11c0 .7-.5 1.2-1.2 1.2-2.2 0-4 .5-5.4 1.5-.3.2-.6 0-.6-.3V6.4z" />
        </svg>
      );
    default: // gratidão — faíscas
      return (
        <svg {...comum}>
          <path d="M11 2.6l1.8 5 5 1.8-5 1.8-1.8 5-1.8-5-5-1.8 5-1.8 1.8-5z" />
          <path d="M18.2 13.8l.95 2.6 2.6.95-2.6.95-.95 2.6-.95-2.6-2.6-.95 2.6-.95.95-2.6z" />
        </svg>
      );
  }
}

/**
 * Tela CHEIA de bem-estar: cards coloridos com as atividades. Abre instantâneo
 * (cards são estáticos; o ✓ de progresso carrega em segundo plano). Faça 1 pra
 * ganhar a estrela; cada uma rende Sementinhas. No Modo Cuidado some o placar.
 * X no canto fecha (ou volta, se estiver dentro de uma atividade).
 */
function WellnessScreen({
  day,
  ehPosParto = false,
  canEarn,
  careMode,
  halves,
  lesson,
  babyName,
  anim,
  enfeites = [],
  onEarn,
  onEarnLesson,
  onSyncWellness,
  onClose,
}: {
  day: number;
  /**
   * O caminho pós-parto entra aqui com `D = idade do bebê + 7`.
   *
   * Sem esta bandeira, um `D` de 10 (três dias de puérpera) pareceria semana 1
   * de gestação, e os movimentos de chão — gato-camelo, borboleta, balanço em
   * quatro apoios — sairiam normalmente. Três dias depois de uma cesárea.
   */
  ehPosParto?: boolean;
  canEarn: boolean;
  careMode?: boolean;
  /** Estrelas do dia (0–5): a aula + os 4 jogos de bem-estar. */
  halves: number;
  lesson: WellnessLesson;
  /** Nome do bebê — a tela cumprimenta por ele. */
  babyName?: string | null;
  /** SÓ a bancada: liga uma das três animações de conquista na abertura. */
  anim?: "check" | "estrela" | "cinco";
  /** Emojis dos itens comprados na loja — boiam atrás do conteúdo. */
  enfeites?: string[];
  onEarn: (key: string) => void;
  onEarnLesson: () => void;
  onSyncWellness?: (keys: string[]) => void;
  onClose: () => void;
}) {
  /* O MESMO céu da aba do bebê — mesmo hook, mesmo slot, mesmo arquivo.
     Não é uma cópia parecida: é a mesma decisão lida duas vezes, então as
     duas telas não têm como divergir nem quando a regra mudar. */
  /* Esta tela deixou de usar o céu da home, de propósito — ver o comentário
     do fundo logo abaixo. `ceuEscuro` fica falso para sempre: a tela tem uma
     cor só, então a tinta não precisa mais trocar com a hora. */
  const ceuEscuro = false;
  /* Toda a tela lê destas quatro. Espalhar `text-slate-500` pelo JSX faria
     metade dela ficar ilegível na madrugada e a outra metade não — que é
     exatamente o defeito que a home já teve. */
  const tinta = ceuEscuro ? "#f6f2ff" : "#4b3a55";
  /* No céu claro a secundária é AMEIXA a 82%, não o cinza-ardósia do Tailwind.
     Medido nas dez horas: slate-500 sobre céu dava 1,8 a 2,6:1 — ilegível. A
     ameixa parte de um escuro, então continua lendo como secundária ao lado
     do título sem cair abaixo de 3:1 em nenhuma arte. */
  const tintaSec = ceuEscuro ? "rgba(255,255,255,0.74)" : "rgba(66,48,78,0.84)";
  /* Base bem mais opaca que a primeira versão (0,42 → 0,66 no escuro,
     0,50 → 0,72 no claro). Medido: no anoitecer e no pré-amanhecer o céu
     quente atravessava o cartão e o título "Momento com o bebê" caía a
     1,3:1 — o cartão deixava de existir como superfície. Vidro fino é
     bonito num fundo calmo; estas duas artes não são calmas. */
  const vidro = ceuEscuro
    ? "linear-gradient(150deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 60%), rgba(24,17,42,0.8)"
    : "linear-gradient(150deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.3) 52%), rgba(255,252,253,0.82)";
  const vidroBorda = ceuEscuro ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.7)";
  const vidroLuz = ceuEscuro ? "rgba(255,255,255,0.34)" : "rgba(255,255,255,0.95)";

  const [openKey, setOpenKey] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  async function refresh() {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;
      const r = await getWellnessProgress({ data: { accessToken: s.session.access_token, day } });
      if (r.ok) {
        setDone(new Set(r.done));
        // Espelha o servidor (ex.: jogou em outro aparelho) nas meias locais.
        if (r.done.length) onSyncWellness?.(r.done);
      }
    } catch {
      /* progresso é secundário — não bloqueia a tela */
    }
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  function handleEarn(key: string) {
    onEarn(key);
    /* ⚠️ A ANIMAÇÃO NASCE AQUI, no evento, e não de comparar listas.
       A versão anterior comparava o conjunto de feitos entre renderizações —
       mas `done` nasce vazio e só é preenchido por `refresh()`, que é
       assíncrono. Quando a resposta do servidor chegava, o conjunto saltava de
       vazio para "tudo que ela fez hoje", e a comparação lia isso como uma
       atividade recém-concluída: a bolinha verde "completava" de novo numa
       tarefa terminada de manhã, toda vez que a folha do dia abria.

       Aqui não há ambiguidade — este é o único ponto do arquivo em que uma
       atividade acabou de ser feita. */
    setRecemFeito(key);
    /* `halves` é a contagem ANTES deste ganho, então ela é o índice (0-based)
       da estrela que acabou de acender. Ler o estado depois não serviria: ele
       só sobe quando o servidor responde. */
    if (halves + 1 >= TOTAL_DO_DIA) setCincoNovas(true);
    else setEstrelaNova(halves);
    setTimeout(refresh, 500);
  }

  const activity = openKey ? WELLNESS_TYPES.find((a) => a.key === openKey) : null;
  const Chosen = activity?.Comp;
  const openMeta = openKey ? WELLNESS_META[openKey] : null;
  const lessonEmoji = lesson.emoji;

  const aulaFeita = lesson.alreadyDone;
  /* O quiz não tem campo de título — tem `teach`, a lição. A primeira frase
     dela É o assunto do dia, então ela vira o título, cortada no ponto. Sem
     isso o cartão precisaria de um título inventado, e inventar aqui daria um
     nome que não corresponde ao que a paciente vai ler dentro. */
  const tituloAula =
    lesson.kind === "quiz"
      ? (() => {
          const frase = lesson.quiz.teach
            .split(/(?<=[.!?])\s/)[0]
            .replace(/[.!?]+$/, "")
            .trim();
          if (frase.length <= 46) return frase;
          /* Corta no último espaço, não no 44º caractere: "METADE da jornada,
             que conq…" lê como erro; "METADE da jornada…" lê como resumo. */
          const corte = frase.slice(0, 44);
          const espaco = corte.lastIndexOf(" ");
          return `${(espaco > 24 ? corte.slice(0, espaco) : corte).trimEnd()}…`;
        })()
      : lesson.label || "O desafio de hoje";

  /* ─── AS SEIS LINHAS DO DIA ──────────────────────────────────────────────
     A aula voltou a ter porta, e voltou como LINHA da mesma lista — não como
     cartão em destaque. Pedido do dono: "o ensino tem que ser criado como uma
     nova linha que nem os outros".

     É uma lista só, percorrida por um `map` só, e isso é o ponto: a versão
     anterior tinha a aula num bloco de marcação PRÓPRIO, com selo, barra de
     progresso e botão. Duas marcações para a mesma ideia divergem sempre —
     bastava mexer no raio ou na folga dos cinco para a aula ficar de fora.
     Agora ela não pode ficar diferente por acidente; se ficar, é porque
     alguém mudou esta linha de propósito.

     Ela vem PRIMEIRO porque é o conteúdo do dia — as outras cinco são
     bem-estar e cabem em qualquer ordem; a aula é o que muda a cada 24h.

     A descrição dela é o ASSUNTO DE HOJE (`tituloAula`), e não um texto fixo:
     "A lição da professora + o quiz" descreve a mecânica e não dá motivo
     nenhum para tocar. O assunto dá. */
  const linhasDoDia: { key: string; desc: string; feito: boolean }[] = [
    { key: "aula", desc: tituloAula, feito: aulaFeita },
    ...WELLNESS_TYPES.map((a) => ({
      key: a.key,
      desc: WELLNESS_META[a.key].desc,
      feito: done.has(a.key),
    })),
  ];

  /* ─── AS TRÊS ANIMAÇÕES DE CONQUISTA, E POR QUE ELAS MORAM AQUI ──────────
     Elas nasceram no nó da trilha, e a revisão mediu o óbvio depois de pronto:
     a folha do dia é `fixed inset-0 z-[60]` com fundo OPACO e não fecha sozinha
     ao ganhar. A estrela acendia atrás dela e se apagava em 2 s — a paciente
     terminava a atividade e a comemoração acontecia numa tela que ela não
     estava vendo.

     Aqui ela está. E o cartão "⭐ Estrelas de hoje", no pé desta folha, é
     literalmente o lugar que o dono descreveu: "lá embaixo tem as cinco
     estrelas, e cada vez que a pessoa completar uma dessas, ela ganha ali uma
     estrela".

     Os três nascem de `handleEarn`, o único ponto do arquivo em que uma
     atividade acabou de ser feita — e não de comparar contadores que chegam do
     servidor, que foi o que fazia a bolinha "completar" de novo numa tarefa
     terminada de manhã. */
  const [recemFeito, setRecemFeito] = useState<string | null>(
    /* A bancada acende o check na PRIMEIRA atividade da lista, que é a que
       aparece sem rolar a tela. */
    anim === "check" ? "movement" : null,
  );
  const [estrelaNova, setEstrelaNova] = useState<number | null>(anim === "estrela" ? 0 : null);
  const [cincoNovas, setCincoNovas] = useState(anim === "cinco");

  /* ─── O QUE O MASCOTE DIZ ────────────────────────────────────────────────
     Eram três textos fixos, um deles com 118 caracteres e cinco linhas — a
     primeira dobra inteira gasta na mesma frase todo dia. Agora são 36 frases
     em `recado-da-bolha.ts`, escolhidas pelo estado do dia e pela hora, e a
     régua mora lá porque ela é pura e tem regras que só um teste pega (buraco
     de gabarito na tela, "vocês dois" no Modo Cuidado, "Semana 41" no
     pós-parto).

     A HORA vem por estado, e não de um `new Date()` no corpo do render.
     Renderizado no servidor, o relógio de lá escolheria uma frase e o do
     navegador outra, e o balão trocaria de texto na hidratação. Enquanto ela
     não chega, `hora: null` tira só as frases de hora do bolo — a tela nunca
     fica sem recado. */
  const [horaLocal, setHoraLocal] = useState<number | null>(null);
  useEffect(() => setHoraLocal(new Date().getHours()), []);

  const recadoDoDia = recadoDaBolha({
    feitos: halves,
    total: TOTAL_DO_DIA,
    dia: day,
    hora: horaLocal,
    bebe: babyName,
    semana: Math.floor(day / 7),
    posParto: ehPosParto,
    careMode,
  });

  // Os 6 cards: aula primeiro (o conteúdo do dia), depois os 5 de bem-estar.
  const cards: { key: string; emoji: string; done: boolean }[] = [
    { key: "aula", emoji: lessonEmoji || "📚", done: lesson.alreadyDone },
    ...WELLNESS_TYPES.map((a) => ({ key: a.key, emoji: a.emoji, done: done.has(a.key) })),
  ];

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto"
      style={{
        /* Rosa muito claro no alto descendo para salmão. Sem imagem nenhuma:
           cor chapada carrega instantâneo, não tem nuvem disputando atenção
           com seis cartões e não muda de humor conforme a hora — esta tela
           fica sempre a mesma, que é o que se quer de um lugar onde ela vem
           TRABALHAR. O céu continua na aba do bebê, onde ele é o assunto. */
        background: "linear-gradient(180deg,#fff5f4 0%,#ffeae7 34%,#ffdfd8 68%,#ffd4c9 100%)",
      }}
    >
      {/* ── Os enfeites dela, boiando ───────────────────────────────────
          São os itens que ela comprou na loja — os mesmos que decoram o
          Caminho. Aqui NÃO são arrumáveis nem tocáveis: sem modo de edição e
          com `pointer-events` desligado. É cenário, não inventário.
          Ficam grandes e bem apagados, atrás de tudo: nesse tamanho o desenho
          vira mancha macia e sai da leitura; pequenos e nítidos virariam
          confete no meio do texto. Quem não comprou nada não vê nada, e a
          tela continua de pé — o gradiente já se basta. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        {enfeites.slice(0, 9).map((e, i) => {
          const pos = POS_ENFEITE[i % POS_ENFEITE.length];
          return (
            <span
              key={`${e}-${i}`}
              className="dc-flutua absolute select-none leading-none"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                fontSize: `${pos.tam}px`,
                opacity: 0.09,
                animationDelay: `${i * 1.7}s`,
                animationDuration: `${14 + (i % 4) * 3}s`,
              }}
            >
              {e}
            </span>
          );
        })}
      </div>

      {/* VÉU DO TOPO — o que salva a saudação.
          Metade das artes tem o alto escuro (golden hour, entardecer, tarde:
          azul profundo em cima, nuvens acesas embaixo) mesmo contando como
          "céu claro" pela faixa. Sem este degradê curto, o "Boa tarde, Clovis"
          em ameixa caía num azul-marinho e sumia — medido às 16h55. Ele morre
          em 34% da altura, então não lava o resto da tela. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[34%]"
        style={{
          background: ceuEscuro
            ? "linear-gradient(180deg, rgba(18,12,34,0.62) 0%, rgba(18,12,34,0.28) 46%, rgba(18,12,34,0) 100%)"
            : "linear-gradient(180deg, rgba(255,250,252,0.72) 0%, rgba(255,250,252,0.34) 46%, rgba(255,250,252,0) 100%)",
        }}
      />
      {/* Véu geral: a arte sozinha tem contraste demais para texto por cima. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            /* No céu claro o véu clareia (o texto é escuro); no escuro ele
               ESCURECE, senão o branco das nuvens do anoitecer come o texto
               claro. A força é a mesma nos dois — o que muda é o sentido. */
            ceuEscuro
              ? "linear-gradient(180deg, rgba(24,18,42,0.42) 0%, rgba(28,20,46,0.34) 50%, rgba(30,22,48,0.4) 100%)"
              : "linear-gradient(180deg, rgba(255,250,252,0.12) 0%, rgba(255,248,250,0.1) 50%, rgba(255,246,248,0.14) 100%)",
        }}
      />
      {/* O ✕ do canto só existe DENTRO de uma atividade. Na lista, quem fecha é
          a seta ‹ do topo, que faz parte do desenho — dois botões de sair na
          mesma tela é o tipo de coisa que faz alguém tocar no errado. */}
      {openKey && (
        <button
          onClick={() => setOpenKey(null)}
          aria-label="Voltar às atividades"
          className="press fixed right-4 top-[calc(0.75rem+var(--safe-top))] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-lg text-slate-600 backdrop-blur-xl"
          style={{
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.95), inset 0 0 0 1px rgba(255,255,255,0.5), 0 8px 20px -8px rgba(80,50,40,0.45)",
          }}
        >
          ✕
        </button>
      )}

      {/* `pb-8` e não mais 24: esta tela é uma sobreposição em z-60 e a barra de
          navegação do app fica ATRÁS dela (z-40). A folga de 96px que havia
          aqui era para uma barra que nunca aparece — e era ela que empurrava
          o cartão de recompensa para fora da primeira tela. */}
      <div className="relative mx-auto max-w-md px-8 pb-8 pt-[calc(0.75rem+var(--safe-top))]">
        {openKey === "aula" ? (
          <div>
            <p className="mb-3 text-center text-sm font-bold text-foreground/60">
              {lessonEmoji || "📚"} {WELLNESS_META.aula.title}
            </p>
            {lesson.kind === "quiz" ? (
              lesson.locked ? (
                <QuizPaywall week={lesson.week} peek={lesson.quiz} />
              ) : (
                <DailyQuizBlock
                  key={`wq-${day}`}
                  quiz={lesson.quiz}
                  emoji={lesson.emoji}
                  week={lesson.week}
                  day={day}
                  alreadyDone={lesson.alreadyDone}
                  canEarn={canEarn}
                  careMode={careMode}
                  missingHint={null}
                  showPremiumAd={lesson.showAd}
                  onEarn={onEarnLesson}
                />
              )
            ) : (
              <ChallengeBlock
                label={lesson.label}
                emoji={lesson.emoji}
                alreadyDone={lesson.alreadyDone}
                canEarn={canEarn}
                onEarn={onEarnLesson}
                careMode={careMode}
              />
            )}
          </div>
        ) : activity && Chosen ? (
          <div>
            <p className="mb-3 text-center text-sm font-bold text-foreground/60">
              {activity.emoji} {openMeta?.title ?? activity.label}
            </p>
            <Chosen
              day={day}
              /* A semana sai do dia gestacional, como em todo o arquivo. Só o
                 bloco de Movimento lê — os outros ignoram a prop extra. */
              semana={Math.floor(day / 7)}
              posParto={ehPosParto}
              /* Só a carta feita das gratidões dela o usa, na abertura. */
              babyName={babyName}
              canEarn={canEarn}
              careMode={careMode}
              alreadyDone={done.has(activity.key)}
              onEarn={() => handleEarn(activity.key)}
              aoSair={() => setOpenKey(null)}
            />
          </div>
        ) : (
          <>
            {/* ── Topo: voltar ──────────────────────────────────────────
                FLUTUANDO, não numa linha própria. Na arte de referência a
                bolha começa 17px abaixo da área segura; com o botão ocupando
                uma faixa de 40px no fluxo, ela só podia começar 57px mais
                embaixo. O botão não pode sair (é a única saída da folha),
                então quem sai é a FAIXA dele: `absolute` no canto, e o
                mascote sobe para o lugar que o desenho lhe dá. Como a bolha é
                centrada e o botão fica na ponta esquerda, os dois dividem a
                mesma altura sem se tocar. */}
            <div className="pointer-events-none absolute left-8 right-8 top-[calc(0.75rem+var(--safe-top))] z-10 flex items-center justify-between">
              <button
                onClick={onClose}
                aria-label="Voltar ao Caminho"
                className={`press pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-xl ${ceuEscuro ? "bg-white/16 text-white/80" : "bg-white/70 text-slate-500"}`}
                style={{
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.95), inset 0 0 0 1px rgba(255,255,255,0.55), 0 8px 20px -10px rgba(90,60,80,0.4)",
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.1}
                  className="h-5 w-5"
                >
                  <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* A carteira saiu daqui. O saldo de Sementinhas já aparece na aba
                  de onde ela veio, e repetido aqui ele só disputava o canto de
                  cima com o anel de progresso — que é o número que importa
                  NESTA tela. Um número por canto. */}
            </div>

            {/* ── O MASCOTE GRANDE E O QUE ELE DIZ ────────────────────
                Antes eram três coisas numa linha: mascote de 44px, título com
                subtítulo, e o anel de progresso. Viraram duas, empilhadas e
                centradas — mascote grande e um balão de fala.

                O QUE MUDOU DE FUNDO, e não é só tamanho: a tela abria
                COBRANDO. "0/6 concluídos" no canto superior direito é um
                placar, e placar zerado é a primeira coisa que ela lia toda
                manhã. Agora abre com alguém falando com ela; o placar foi para
                o PÉ da tela, depois do trabalho feito, que é onde saldo se lê
                sem soar cobrança.

                O mascote mora AQUI, e não na trilha. O Caminho é a tela que a
                paciente personaliza — o céu segue a hora dela, a decoração é a
                que ela comprou. Um personagem espalhado por lá seria o único
                elemento que ela não escolheu e não pode tirar. Aqui, no lugar
                onde ela vem trabalhar, ele faz o oposto: dá companhia a uma
                tela que antes só cobrava tarefa. A cara vem do progresso do
                próprio dia. */}
            {/* ─── AS MEDIDAS SAÍRAM DA ARTE, NÃO DO OLHO ──────────────
                A referência é um PNG de 853×1844 representando uma tela de
                430px, então a escala é 430/853 = 0,5041 e toda distância dela
                sai de uma conta, não de um chute. Medido no arquivo
                (`.medir-ref.mjs`, descartado depois):

                  cartão de atividade   367,0px de largura → o conteúdo da
                                        página já mede 366 (430 − 2×32) ✔
                  balão                 257,1 × 190,6, topo a 262,6 do alto
                  bolha do mascote      ~199 de diâmetro, topo a 64 do alto

                É por isso que o balão NÃO é da largura do cartão: na arte ele
                mede 70% dela. Cheio, o balão vira mais um cartão da pilha e
                deixa de ler como fala. */}
            <div className="mt-2 flex flex-col items-center">
              {/* O mascote divide a faixa com o botão de voltar. Na arte não
                  há botão nenhum e a bolha começa logo abaixo da barra de
                  status; aqui o botão existe e não pode sair (é a única saída
                  da folha). Como ele é pequeno e fica na ponta esquerda, e a
                  bolha é centrada, os dois convivem sem se tocar.

                  298 e não 258: `tamanho` é a caixa da ARTE, e a bolha
                  desenhada dentro dela é menor que a caixa. Com 258 a bolha
                  saía com 172px de diâmetro contra os 199 medidos na
                  referência — o número que interessa é o da bolha, então ele é
                  que foi calibrado, não o da caixa.

                  `careMode` VAI para o componente, não só para o texto: a arte
                  de "comemorando" tem confete pintado dentro dela, e o portão
                  do luto mora lá justamente para o chamador não esquecer. */}
              {/* `diaFeito` e NÃO `comemorando`, embora os dois saiam do mesmo
                  `halves >= 6`. A arte de comemorar tem chapéu de festa e
                  confete — é arte de INSTANTE, e esta tela não sabe distinguir
                  "acabei de fechar o dia" de "abri de novo às 22h". Mostrada
                  nas duas, a festa vira papel de parede e perde o efeito
                  justamente onde ele importa.
                  A festa continua onde existe o instante: ao terminar uma
                  atividade e ao gabaritar o quiz. Aqui fica a piscadinha, que
                  é o "eu vi o que você fez" sem estourar confete de novo. */}
              {/* `ritmoIncomum` em 4 de 6, e não em 2: metade do dia é rotina,
                  e uma bolha espantada com o que é normal ensina que o espanto
                  dela não quer dizer nada. Em 4 já é dia cheio — e ainda não é
                  o dia fechado, que tem cara própria. */}
              <Bolha
                tamanho={298}
                humor={humorDaJornada({
                  diaFeito: halves >= TOTAL_DO_DIA,
                  madrugada: horaLocal !== null && faixaDaHora(horaLocal) === "madrugada",
                  ritmoIncomum: halves >= TOTAL_DO_DIA - 1,
                  careMode,
                })}
                careMode={careMode}
              />

              {/* O BALÃO. O rabinho aponta para CIMA, para o mascote — é o que
                  faz o texto ser fala dele em vez de mais um cartão da tela.
                  Ele é um quadrado girado 45° com as duas bordas de baixo
                  escondidas atrás do balão: triângulo em `border` não aceita
                  o mesmo fundo translúcido do balão e apareceria como uma
                  cunha opaca mais escura que ele. */}
              {/* `-mt-[74px]`: a caixa da arte do mascote continua ~80px
                  abaixo da bolha (é onde mora a sombra no chão). Sem puxar, o
                  balão nascia 77px longe da bolha e o rabinho apontava para o
                  vazio. Na arte de referência o balão encosta na sombra —
                  balão topo a 262,6 e sombra a ~270. */}
              <div className="relative -mt-[74px] w-[257px] max-w-full">
                <span
                  aria-hidden
                  className="absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[3px]"
                  style={{
                    background: vidro,
                    borderTop: `1px solid ${vidroBorda}`,
                    borderLeft: `1px solid ${vidroBorda}`,
                  }}
                />
                <div
                  className="relative rounded-[26px] px-5 py-5"
                  style={{
                    background: vidro,
                    backdropFilter: "blur(22px) saturate(175%)",
                    WebkitBackdropFilter: "blur(22px) saturate(175%)",
                    border: `1px solid ${vidroBorda}`,
                    boxShadow: `inset 0 1px 0 ${vidroLuz}, 0 18px 40px -22px rgba(60,40,70,0.5)`,
                  }}
                >
                  {/* ─── CENTRADO, E COM AS LINHAS EQUILIBRADAS ──────────
                      A caixa está no eixo da tela (medido: centro em 215, o
                      mesmo da tela); o que lia como torto era o TEXTO dentro
                      dela. O balão tem largura FIXA de 257px, herdada da arte
                      de referência, mas os recados novos são curtos: alinhado à
                      esquerda, um texto de três linhas medindo 155, 156 e 193
                      numa coluna de 215 deixava um vão só do lado direito, e a
                      mancha do texto ficava à esquerda do meio do balão.

                      `text-center` devolve a simetria, e `text-balance` evita o
                      outro defeito que aparece assim que se centra: duas linhas
                      cheias e uma última com duas palavras soltas no meio.
                      Balão de fala centrado também é o que se lê em qualquer
                      história em quadrinhos — o alinhamento à esquerda só
                      funcionava porque o texto da referência enchia a caixa. */}
                  <p
                    className="text-center text-[15px] leading-[1.5] [text-wrap:balance]"
                    style={{ color: tinta }}
                  >
                    {recadoDoDia}
                  </p>
                </div>
              </div>
            </div>

            {/* ─── O CARTÃO EM DESTAQUE DA AULA SAIU, E NÃO VOLTA ──────
                Era um bloco entre o balão e a lista: selo "Recomendada",
                título da semana, duração, o bebê da semana e um botão
                "Continuar aula". Saiu porque a arte de referência não o traz.

                Por um commit ele levou junto a ÚNICA porta da aula, e o dia
                deixou de poder fechar em 6/6 — a aula vale 1 dos 6. A porta
                voltou logo abaixo, como LINHA da lista de atividades: pedido
                do dono, "o ensino tem que ser criado como uma nova linha que
                nem os outros".

                Fica registrado para quem for mexer: `openKey === "aula"` é o
                ramo que monta o quiz, e hoje quem o aciona é a primeira linha
                de `linhasDoDia`. Se alguém tirar a aula dali de novo, tem que
                pôr a porta em outro lugar no mesmo commit. */}

            {/* ── Atividades de hoje ─────────────────────────────────── */}
            <div className="mt-3.5 flex items-center justify-between gap-3">
              <p className="font-serif text-[16px]" style={{ fontWeight: 600, color: tinta }}>
                Atividades de hoje{" "}
                {/* `currentColor` a 55%: o brilho segue a tinta do título em
                    vez de um lilás fixo. Fixo, ele media 1,02:1 sobre o céu do
                    meio-dia — mesma família de matiz do fundo, sumia. */}
                <span style={{ opacity: 0.55 }}>✦</span>
              </p>
              {/* O "Ver todas" saiu. Ele nunca teve o que revelar: as atividades
                  são cinco, todas já visíveis. Um filtro que não filtra ensina
                  que os controles desta tela podem não fazer nada. */}
            </div>

            {/* `gap-2` e não `gap-1`: na referência os cartões respiram, e é
                essa folga que faz cinco deles lerem como lista em vez de
                bloco único. */}
            <div className="mt-2.5 flex flex-col gap-2">
              {linhasDoDia.map((a) => {
                const meta = WELLNESS_META[a.key];
                const isDone = !careMode && a.feito;
                return (
                  <button
                    key={a.key}
                    onClick={() => setOpenKey(a.key)}
                    /* `px-3` e não `px-3.5`, `gap-2.5` e não `gap-3`: cada 2px
                       aqui é largura na coluna de texto, e é ela que decide se
                       "Momento com o bebê" cabe numa linha como na referência
                       ou quebra em duas. Medido: com 14px de folga lateral a
                       coluna dava 181px e o título pedia 185. */
                    className="press flex w-full items-center gap-2.5 rounded-[22px] px-3 py-3 text-left"
                    style={{
                      background: vidro,
                      backdropFilter: "blur(18px) saturate(170%)",
                      WebkitBackdropFilter: "blur(18px) saturate(170%)",
                      border: `1px solid ${vidroBorda}`,
                      boxShadow: `inset 0 1px 0 ${vidroLuz}, 0 12px 28px -18px rgba(60,40,70,0.45)`,
                    }}
                  >
                    {/* Tile PASTEL com o glifo na cor cheia — não o inverso.
                        Gradiente saturado com traço branco fino, que era o que
                        estava aqui, grita ao lado de uma tela toda em pó-de-
                        arroz: os cinco tiles viravam o elemento mais forte da
                        página, acima até do bebê. */}
                    <span
                      className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[16px]"
                      style={{
                        background: `linear-gradient(150deg, ${meta.tile ?? meta.a} 0%, ${meta.tileB ?? meta.b} 100%)`,
                        color: meta.ink ?? meta.b,
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
                      }}
                    >
                      <AtividadeIcone chave={a.key} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block text-[14.5px] leading-tight"
                        style={{
                          color: ceuEscuro
                            ? (meta.inkDark ?? meta.ink ?? meta.b)
                            : (meta.ink ?? meta.b),
                          fontWeight: 600,
                        }}
                      >
                        {meta.title}
                      </span>
                      <span
                        className="mt-0.5 block text-[12.5px] leading-[1.35]"
                        style={{ color: tintaSec }}
                      >
                        {a.desc}
                      </span>
                    </span>
                    {!careMode && (
                      <span className="flex shrink-0 items-center gap-1.5">
                        {/* A BOLINHA VERDE, e a animação que a completa.
                            Só na atividade que ACABOU de ser feita: o sprite
                            para no último quadro, que é o próprio check
                            pousado, então ele não precisa ser trocado de volta
                            depois — vira o estado final. */}
                        {recemFeito === a.key ? (
                          <SpriteDoJogo tipo="check" tamanho={30} className="-m-0.5" />
                        ) : (
                          <span
                            className={`flex h-[26px] w-[26px] items-center justify-center rounded-full text-[12px] ${
                              isDone ? "bg-emerald-400 text-white" : ""
                            }`}
                            style={
                              isDone
                                ? undefined
                                : {
                                    border: `1.5px dashed ${ceuEscuro ? "rgba(255,255,255,0.34)" : "rgba(160,130,160,0.4)"}`,
                                  }
                            }
                          >
                            {isDone ? "✓" : ""}
                          </span>
                        )}
                        <span className="tabular-nums text-[13.5px]" style={{ color: tintaSec }}>
                          {isDone ? "1/1" : "0/1"}
                        </span>
                        {/* A seta mora num botão de vidro, como no desenho —
                            solta ela lê como enfeite, não como "isto abre". */}
                        <span
                          className={`flex h-[30px] w-[30px] items-center justify-center rounded-full ${ceuEscuro ? "text-white/70" : "text-slate-400"}`}
                          style={{
                            background: ceuEscuro
                              ? "rgba(255,255,255,0.14)"
                              : "rgba(255,255,255,0.55)",
                            border: `1px solid ${vidroBorda}`,
                            backdropFilter: "blur(8px)",
                            WebkitBackdropFilter: "blur(8px)",
                          }}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            className="h-3.5 w-3.5"
                          >
                            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ─── O GANCHO DE AMANHÃ SAIU (ago/2026) ──────────────────
                Era uma linha entre os cartões e o placar: "🍼 Amanhã tem aula
                nova — volte para manter a chama 🔥". Saiu porque a arte de
                referência não a traz, e o pedido foi tela 100% igual a ela.
                Além disso ela ficou mentindo no mesmo commit: aponta para a
                aula, e a aula perdeu a porta junto com o cartão em destaque. */}

            {/* ── ESTRELAS DE HOJE ────────────────────────────────────
                Substitui o cartão "Recompensa do dia", e absorve o que ele
                dizia. O antigo mostrava um 🎁 e a PROMESSA ("complete tudo e
                ganhe 3 estrelas"); este mostra o ESTADO — seis estrelas, uma
                por momento do dia, acesas conforme ela anda. A promessa
                continua, virou a última linha.

                ─── "ESTRELAS", E A CONTRADIÇÃO QUE ISSO CRIOU ──────────────
                A legenda diz "N/6 estrelas conquistadas", como no desenho e
                como o dono pediu. Mas a linha de baixo prometia "feche os 6 e
                ganhe 3 estrelas" — dois números para a mesma moeda, no MESMO
                cartão. Quem lesse os dois só podia concluir que o app não sabe
                quantas estrelas está pagando.
                Quem cedeu foi a promessa, porque ela era imprecisa de qualquer
                jeito: o que o app credita ao fechar o dia é SEMENTINHAS 🌱
                (`grantSementinhas`, com "3 estrelas do dia" apenas como nome
                da conquista). Agora a última linha diz o que de fato cai na
                carteira dela.
                Fica de fora deste commit, e vale registrar: o medidor da
                trilha e o aviso de fim de dia continuam falando em TRÊS
                estrelas (seis meias). É a mesma jornada contada em duas
                denominações, e uma hora precisa ser unificada. */}
            {!careMode && (
              <div
                className="mt-3 rounded-[22px] px-4 py-4"
                style={{
                  background: vidro,
                  backdropFilter: "blur(18px) saturate(170%)",
                  WebkitBackdropFilter: "blur(18px) saturate(170%)",
                  border: `1px solid ${vidroBorda}`,
                  boxShadow: `inset 0 1px 0 ${vidroLuz}, 0 12px 28px -18px rgba(60,40,70,0.45)`,
                }}
              >
                <p
                  className="text-center font-serif text-[14.5px]"
                  style={{ fontWeight: 600, color: tinta }}
                >
                  ⭐ Estrelas de hoje
                </p>

                {/* A fileira ocupa quase a largura do cartão, como no desenho:
                    seis estrelas pequenas e apertadas no meio leem como
                    enfeite; grandes e espalhadas leem como placar. */}
                <div
                  className="mt-3 flex items-center justify-center gap-3.5"
                  role="img"
                  aria-label={`${halves} de ${TOTAL_DO_DIA} estrelas conquistadas`}
                >
                  {cincoNovas ? (
                    /* As cinco enfileiradas ocupam a fileira inteira no
                       instante em que o dia fecha. `-my-8` porque o sprite é
                       quadrado e a arte final é uma faixa horizontal: sem o
                       recuo, o cartão saltaria de altura. */
                    <SpriteDoJogo
                      tipo="cinco"
                      tamanho={200}
                      style={{ margin: "-2rem 0" }}
                      onFim={() => setCincoNovas(false)}
                    />
                  ) : (
                    Array.from({ length: TOTAL_DO_DIA }, (_, i) =>
                      i === estrelaNova ? (
                        <SpriteDoJogo
                          key={i}
                          tipo="estrela"
                          tamanho={38 * 2.2}
                          style={{ margin: "-23px" }}
                          onFim={() => setEstrelaNova(null)}
                        />
                      ) : (
                        <EstrelaDoDia key={i} acesa={i < halves} tamanho={38} />
                      ),
                    )
                  )}
                </div>

                <p className="mt-3 text-center text-[13px]" style={{ color: tintaSec }}>
                  <span className="text-[16px] font-bold tabular-nums" style={{ color: tinta }}>
                    {halves}/{TOTAL_DO_DIA}
                  </span>{" "}
                  estrelas conquistadas
                </p>
                <p className="mt-1 text-center text-[12px]" style={{ color: tintaSec }}>
                  {halves >= TOTAL_DO_DIA ? (
                    "Dia completo! Você acendeu as cinco 🌟"
                  ) : halves > 0 ? (
                    <>
                      Continue assim! Acenda as 5 e ganhe{" "}
                      <span className="font-semibold" style={{ color: "#7c3aed" }}>
                        Sementinhas
                      </span>{" "}
                      🌱
                    </>
                  ) : (
                    <>
                      Comece por onde quiser — acenda as 5 e ganhe{" "}
                      <span className="font-semibold" style={{ color: "#7c3aed" }}>
                        Sementinhas
                      </span>{" "}
                      🌱
                    </>
                  )}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════ Quiz diário da professora (dentro do sheet do dia) ══════════════════
   Um exercício por dia (semanas 1-40): mini-lição rica + curiosidade + 4-5
   perguntas variadas (escolha única ou "marque todas"), estilo Duolingo.
   Responder no dia de HOJE completa a tarefa "desafio"; dias passados ficam
   jogáveis em modo revisão (aprender vale sempre; a chama vale no dia).
   Ao terminar, quem é do plano grátis recebe um convite para o Premium. */

type QuizAnswer = number | number[] | null;

function DailyQuizBlock({
  quiz,
  emoji,
  week,
  day,
  alreadyDone,
  canEarn,
  careMode = false,
  missingHint,
  showPremiumAd = false,
  onEarn,
}: {
  quiz: DailyQuiz;
  emoji: string;
  week: number;
  /** Dia da jornada (D) — usado no ganho de Sementinhas (dedupe + validação). */
  day: number;
  alreadyDone: boolean;
  canEarn: boolean;
  careMode?: boolean;
  /** Dica do que ainda falta para fechar o dia (ex.: check-in de humor). */
  missingHint?: string | null;
  /** Mostra o convite ao Premium ao terminar (só para quem é do plano grátis). */
  showPremiumAd?: boolean;
  onEarn: () => void;
}) {
  const questions = quiz.questions;
  const tm = trimMeta(week);
  const total = questions.length;

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"intro" | "quiz" | "done">("intro");
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>(() => questions.map(() => null));
  const [checked, setChecked] = useState(false);
  const [earnedNow, setEarnedNow] = useState(false);
  const [reward, setReward] = useState<number | null>(null);
  const earnedRef = useRef(false);

  const q = questions[qIndex];
  const isMulti = q ? isMultiQuestion(q) : false;
  const cur = answers[qIndex];
  const score = questions.filter((qq, i) => isAnswerCorrect(qq, answers[i])).length;
  const progressPct =
    phase === "done" ? 100 : phase === "intro" ? 4 : Math.round((qIndex / total) * 100);
  const isSel = (oi: number) => (Array.isArray(cur) ? cur.includes(oi) : cur === oi);
  const canVerify = isMulti ? Array.isArray(cur) && cur.length > 0 : cur != null;

  function begin() {
    setOpen(true);
    setPhase("intro");
    setQIndex(0);
    setAnswers(questions.map(() => null));
    setChecked(false);
  }

  function startQuiz() {
    setPhase("quiz");
    setQIndex(0);
    if (alreadyDone) {
      setAnswers(questions.map((qq) => qq.a)); // revisão: pré-preenche o gabarito
      setChecked(true);
    } else {
      setChecked(false);
    }
  }

  function pick(oi: number) {
    if (checked) return;
    setAnswers((prev) => {
      const next = [...prev];
      if (isMulti) {
        const arr = Array.isArray(next[qIndex]) ? [...(next[qIndex] as number[])] : [];
        const at = arr.indexOf(oi);
        if (at >= 0) arr.splice(at, 1);
        else arr.push(oi);
        next[qIndex] = arr;
      } else {
        next[qIndex] = oi;
      }
      return next;
    });
  }

  async function grantReward(correct: number) {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) return;
      const r = await grantDailyQuizReward({ data: { accessToken: token, day, correct } });
      if (r.ok) setReward(r.granted);
    } catch {
      /* recompensa é secundária */
    }
  }

  function next() {
    if (qIndex + 1 >= total) {
      setPhase("done");
      if (canEarn && !alreadyDone && !earnedRef.current) {
        earnedRef.current = true;
        setEarnedNow(true);
        onEarn();
        grantReward(score);
      }
      return;
    }
    setQIndex((i) => i + 1);
    setChecked(alreadyDone);
  }

  return (
    <>
      {/* Card de entrada (abre a experiência em tela cheia) */}
      <div className="mb-4 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-4">
        <div className="flex items-center gap-3">
          <div
            className="duo3d flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
            style={{ background: tm.main, "--lip": tm.lip } as React.CSSProperties}
          >
            {alreadyDone ? "⭐" : emoji}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-violet-600">
              Aula de hoje · Semana {week}
            </p>
            <p className="line-clamp-1 text-sm font-bold text-violet-950">
              {quiz.teach.split(". ")[0]}.
            </p>
          </div>
        </div>
        <button
          onClick={begin}
          className="press mt-3 w-full rounded-full py-3 text-sm font-extrabold text-white"
          style={{ background: tm.main, boxShadow: `0 4px 0 ${tm.lip}` }}
        >
          {alreadyDone ? "Revisar a aula ⭐" : "Fazer a aula de hoje 📚"}
        </button>
        {missingHint && !alreadyDone && (
          <p className="mt-2 text-center text-[11px] text-violet-500">{missingHint}</p>
        )}
      </div>

      {/* Experiência em tela cheia (Duolingo) */}
      {open && (
        <div
          className="dc-quiz-in fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-violet-50 via-white to-fuchsia-50"
          style={{ paddingTop: "var(--safe-top)" }}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="press text-2xl leading-none text-slate-400"
            >
              ✕
            </button>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-violet-500 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-4">
            {phase === "intro" && (
              <div>
                <div className="mt-2 flex flex-col items-center text-center">
                  <div
                    className="duo3d flex h-20 w-20 items-center justify-center rounded-3xl text-4xl"
                    style={{ background: tm.main, "--lip": tm.lip } as React.CSSProperties}
                  >
                    {emoji}
                  </div>
                  <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Aula de hoje · Semana {week}
                    {alreadyDone && <span className="ml-1 text-amber-500">· revisão</span>}
                  </p>
                </div>
                <div className="mt-4 rounded-2xl bg-violet-50 p-4">
                  <p className="text-sm leading-relaxed text-violet-950">{quiz.teach}</p>
                </div>
                {quiz.funFact && (
                  <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-3 text-sm leading-relaxed text-amber-800">
                    <span className="font-bold">💡 Você sabia?</span> {quiz.funFact}
                  </div>
                )}
              </div>
            )}

            {phase === "quiz" && q && (
              <div key={qIndex} className="dc-q-slide">
                <p className="mt-4 text-xs font-bold uppercase tracking-wider text-violet-600">
                  Pergunta {qIndex + 1} de {total}
                </p>
                <h3 className="mt-2 text-2xl font-extrabold leading-tight text-foreground">
                  {q.q}
                </h3>
                {isMulti && (
                  <p className="mt-1 text-[13px] font-semibold text-violet-500">
                    Marque todas as corretas
                  </p>
                )}
                <div className="mt-5 flex flex-col gap-3">
                  {q.o.map((opt, oi) => {
                    const isCorrectOpt = Array.isArray(q.a) ? q.a.includes(oi) : q.a === oi;
                    const picked = isSel(oi);
                    let cls = "border-slate-200 bg-white text-foreground";
                    let pop = "";
                    if (checked) {
                      if (isCorrectOpt) {
                        cls = "border-emerald-500 bg-emerald-50 text-emerald-800";
                        pop = "dc-pop";
                      } else if (picked) cls = "border-rose-400 bg-rose-50 text-rose-700";
                      else cls = "border-slate-100 text-slate-400";
                    } else if (picked) {
                      cls = "border-violet-500 bg-violet-50 text-violet-900";
                    }
                    return (
                      <button
                        key={oi}
                        disabled={checked}
                        onClick={() => pick(oi)}
                        className={`press flex items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left text-base font-semibold transition-colors ${cls} ${pop}`}
                      >
                        {isMulti && (
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-xs ${
                              picked
                                ? "border-violet-500 bg-violet-500 text-white"
                                : "border-slate-300"
                            }`}
                          >
                            {picked ? "✓" : ""}
                          </span>
                        )}
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
                {checked && (
                  <div
                    className={`mt-4 rounded-2xl p-3 text-sm leading-relaxed ${
                      isAnswerCorrect(q, cur)
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    <span className="font-bold">
                      {isAnswerCorrect(q, cur) ? "✓ Isso! " : "💡 "}
                    </span>
                    {q.why}
                  </div>
                )}
              </div>
            )}

            {phase === "done" && (
              <div className="mt-8 flex flex-col items-center text-center">
                {!careMode && score > 0 && <ConfettiBurst big={score === total} />}
                {/* A personagem no lugar do emoji, com o TOM que o Clóvis
                    definiu: neutro, sem empurrar.

                    Acertando, ela comemora e pula — e o portão do Modo Cuidado
                    mora dentro do componente, então nem a cara nem o salto
                    saem no luto.

                    Zerando, ela fica FELIZ e PARADA. Não entra a cara de
                    saudade: saudade é para quem sumiu, não para quem apareceu e
                    errou. E não entra animação nenhuma, porque qualquer reação
                    ali vira comentário sobre o desempenho dela — que é
                    exatamente o peso que se pediu para tirar. Ela só está
                    junto. */}
                <span className="dc-result-in">
                  {/* Três caras para três resultados, e não duas para dois: a
                      festa (chapéu e confete) é para quem GABARITOU, e usá-la
                      também no "acertou 2 de 5" gasta a comemoração — depois
                      dela, acertar tudo não tem mais o que ganhar. No meio
                      entra a piscadinha, que é elogio sem festa. */}
                  <Bolha
                    tamanho={84}
                    humor={score === total ? "comemorando" : score > 0 ? "orgulhosa" : "feliz"}
                    entrada={score === total ? "pulo" : undefined}
                    careMode={careMode}
                  />
                </span>
                <h3 className="mt-3 text-2xl font-extrabold">
                  {score === total
                    ? "Acertou tudo!"
                    : score >= total - 1
                      ? "Quase perfeito!"
                      : score > 0
                        ? "Muito bem!"
                        : "Anotado!"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {score} de {total} acertos
                </p>
                {!careMode && reward != null && reward > 0 && (
                  <div className="mt-4 rounded-full bg-emerald-100 px-5 py-2 text-base font-extrabold text-emerald-700">
                    +{reward} 🌱 Sementinhas!
                  </div>
                )}
                <p className="mt-3 max-w-xs text-xs text-muted-foreground">
                  {earnedNow
                    ? (missingHint ?? "Tarefa da aula completa — dia fechado! ✓")
                    : "Aprender vale sempre 💜"}
                </p>
                {showPremiumAd && (
                  <div className="mt-4 w-full">
                    <QuizPaywall week={week} context="ad" />
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            className="border-t border-slate-100 p-4"
            style={{ paddingBottom: "calc(1rem + var(--safe-bottom))" }}
          >
            {phase === "intro" && (
              <button
                onClick={startQuiz}
                className="press w-full rounded-full bg-violet-500 py-3.5 text-sm font-extrabold text-white"
              >
                {alreadyDone ? "Revisar as respostas" : "Começar o quiz"}
              </button>
            )}
            {phase === "quiz" && !checked && (
              <button
                onClick={() => {
                  setChecked(true);
                  /* Som e toque no momento de verificar. A referência declarada
                     desta tela é o Duolingo, e lá verificar uma resposta tem
                     som e vibração — aqui acertar não fazia barulho nenhum, o
                     que deixa a aula com cara de formulário.
                     Sai de dentro do CLIQUE de propósito: é o gesto que a
                     política de autoplay exige para deixar o áudio tocar.
                     Nada disso no Modo Cuidado. */
                  if (!careMode) {
                    const acertou = isAnswerCorrect(q, cur);
                    if (acertou) {
                      celebrateChime(1);
                      tocarPadrao([18]);
                    } else {
                      /* Erro NÃO tem som. Ele tem um toque curto, que serve de
                         confirmação de que o botão respondeu — não de punição.
                         Som de erro num app de gestação de alto risco é o tipo
                         de coisa que faz a paciente parar de estudar. */
                      tocarPadrao([10]);
                    }
                  }
                }}
                disabled={!canVerify}
                className="press w-full rounded-full bg-violet-500 py-3.5 text-sm font-extrabold text-white disabled:opacity-40"
              >
                Verificar
              </button>
            )}
            {phase === "quiz" && checked && (
              <button
                onClick={next}
                className="press w-full rounded-full bg-pink-500 py-3.5 text-sm font-extrabold text-white"
              >
                {qIndex + 1 >= total ? "Ver resultado" : "Continuar"}
              </button>
            )}
            {phase === "done" && (
              <button
                onClick={() => setOpen(false)}
                className="press w-full rounded-full bg-pink-500 py-3.5 text-sm font-extrabold text-white"
              >
                Voltar ao caminho
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ══════════════════ PONTO 2 · Jornada do 4º trimestre ══════════════════ */

function PosPartoJourney({
  babyLabel,
  birth,
  checkedToday,
  doCheckin,
  gestStickers,
  albumOpen,
  setAlbumOpen,
  openGestAlbum,
  sheet,
  setSheet,
  revealing,
  setRevealing,
  styleBlock,
  shareGest,
  careMode = false,
}: {
  babyLabel: string;
  birth: Birth;
  checkedToday: boolean;
  doCheckin: (mood: string) => void;
  gestStickers: number[];
  albumOpen: boolean;
  setAlbumOpen: (v: boolean) => void;
  openGestAlbum: (week: number) => void;
  sheet: { kind: "day"; D: number } | { kind: "album"; week: number } | null;
  setSheet: (s: { kind: "day"; D: number } | { kind: "album"; week: number } | null) => void;
  revealing: boolean;
  setRevealing: (v: boolean) => void;
  styleBlock: React.ReactNode;
  shareGest: (week: number) => void;
  careMode?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [posDone, setPosDone] = useState<number[]>([]);
  const [posStickers, setPosStickers] = useState<number[]>([]);
  const [dayTasks, setDayTasks] = useState<Record<string, boolean>>({});
  const [selectedPhase, setSelectedPhase] = useState(0);

  // Idade do bebê em dias (0-based) → pseudo-dia D = idade + 7 (semana 1 = D 7..13)
  const birthDate = new Date(birth.date + "T00:00:00");
  const rawAgeDays = Math.max(0, Math.floor((Date.now() - birthDate.getTime()) / 86400000));
  const babyAgeDays = Math.min(83, rawAgeDays);
  const graduated = rawAgeDays > 83; // 12 semanas completas — 4º trimestre encerrado
  const todayD = babyAgeDays + 7;
  const currentWeek = Math.max(1, Math.min(12, Math.floor(todayD / 7)));
  const phases = PHASES_POS;
  const currentPhase = phaseOfWeek(phases, currentWeek);

  useEffect(() => {
    setPosDone(lsGet<number[]>(LS.posDoneDays, []));
    setPosStickers(lsGet<number[]>(LS.posStickers, []));
    const idx = phases.findIndex((p) => p === currentPhase);
    setSelectedPhase(idx >= 0 ? idx : 0);
  }, [currentPhase, phases]);

  /* Mesma régua da gestação — dias com ALGUM momento, não os cinco. */
  const streak = useMemo(
    () => sequenciaDeDias(diasComAlgumMomento(entradasDoArmazem(), POS_DIA_KEY), todayD),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [posDone, dayTasks, todayD],
  );

  const phase = phases[selectedPhase] ?? phases[0];
  // Jornada pós-parto começa no nascimento: sem semanas-álbum aqui
  const { nodes, height } = useMemo(() => buildPhaseNodes(phase), [phase]);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const target = nodes.find((n) => n.kind === "day" && n.D === todayD);
    const y = target?.y ?? 0;
    const t = setTimeout(() => {
      el.scrollTo({ top: Math.max(0, y - el.clientHeight / 2), behavior: "smooth" });
    }, 400);
    return () => clearTimeout(t);
  }, [nodes, todayD]);

  function dayTaskState(D: number): Record<string, boolean> {
    return lsGet<Record<string, boolean>>(LS.posDayTasks(D), {});
  }

  function markDayTask(D: number, id: string, value: boolean) {
    const state = { ...dayTaskState(D), [id]: value };
    lsSet(LS.posDayTasks(D), state);
    if (sheet?.kind === "day" && sheet.D === D) setDayTasks(state);
    // No dia da transição gestação→pós-parto, o check-in pode ter sido feito ainda
    // na gestação (checkedToday) — vale como humor de hoje aqui também.
    const humorOk = state.humor || (D === todayD && checkedToday);
    const allDone = humorOk && state.desafio && state.leitura;
    if (allDone && !posDone.includes(D)) {
      const next = [...posDone, D];
      setPosDone(next);
      lsSet(LS.posDoneDays, next);
      setRevealing(true);
      setTimeout(() => setRevealing(false), 1800);
      const week = Math.floor(D / 7);
      if (!posStickers.includes(week)) {
        const ns = [...posStickers, week];
        setPosStickers(ns);
        lsSet(LS.posStickers, ns);
        /* Modo Cuidado também no PÓS-PARTO. Eu tinha protegido as duas
           equivalentes da gestação e deixado estas duas de fora — e aqui é
           pior: a perda perinatal acontece justamente nesta fase. */
        if (!careMode)
          toast.success(`${POS_EMOJI[week] ?? "🍼"} Figurinha da semana ${week} de vida coletada!`);
      }
      if (!careMode) toast.success(`🎉 Dia ${babyAgeDays + 1} com ${babyLabel} completo!`);
    }
  }

  function openDay(D: number) {
    setDayTasks(dayTaskState(D));
    setSheet({ kind: "day", D });
    if (D === todayD) setTimeout(() => markDayTask(D, "leitura", true), 600);
  }

  return (
    <div className="flex flex-col gap-4">
      {styleBlock}

      {/* Cabeçalho do 4º trimestre + álbum da gestação preservado */}
      <div className="flex items-center justify-between rounded-2xl bg-white/80 p-4 backdrop-blur-sm shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-sky-600">4º Trimestre</p>
          <p className="text-lg font-extrabold">
            {graduated
              ? `${babyLabel} · 12 semanas completas 🎓`
              : `${babyLabel} · ${babyAgeDays + 1}º dia de vida 🍼`}
          </p>
        </div>
        <button
          onClick={() => setAlbumOpen(!albumOpen)}
          className="press rounded-full bg-pink-50 px-3 py-2 text-xs font-bold text-pink-600"
        >
          {albumOpen ? "Fechar álbum" : "Álbum da gestação 💝"}
        </button>
      </div>

      {/* Álbum da gestação: recordação permanente */}
      {albumOpen && (
        <div className="rounded-3xl bg-white/80 p-4 backdrop-blur-sm">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Álbum da gestação · {gestStickers.length} figurinhas
          </p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 42 }, (_, i) => i + 1).map((w) => {
              const got = gestStickers.includes(w);
              return (
                <button
                  key={w}
                  onClick={() => openGestAlbum(w)}
                  className={`press flex h-11 w-11 items-center justify-center rounded-xl text-xl ${
                    got ? "bg-pink-50" : "bg-slate-50 opacity-40 grayscale"
                  }`}
                  aria-label={`Semana ${w}`}
                >
                  {fruitEmojiForWeek(w)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center justify-around rounded-2xl bg-white/70 px-3 py-2.5 backdrop-blur-sm shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
        {!careMode && (
          <>
            <div className="flex items-center gap-1.5">
              {/* O emoji 🔥 saiu: cada sistema desenha o seu, e a paciente via
                  uma chama na gestação e outra no pós-parto. */}
              <ChamaDaSequencia acesa={sequenciaAcesa(streak)} tamanho={24} />
              <span
                className={`text-lg font-extrabold ${
                  sequenciaAcesa(streak) ? "text-amber-500" : "text-slate-400"
                }`}
              >
                {streak}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {streak === 1 ? "dia" : "dias"}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
          </>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-xl">👶</span>
          <span className="text-lg font-extrabold text-sky-500">S{currentWeek}</span>
          <span className="text-xs font-medium text-muted-foreground">de vida</span>
        </div>
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-xl">🏆</span>
          <span className="text-lg font-extrabold text-violet-500">
            {gestStickers.length + posStickers.length}
          </span>
        </div>
      </div>

      {/* Graduação: 12 semanas completas encerra o 4º trimestre com celebração */}
      {graduated && (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <p className="text-4xl">🎓</p>
          <p className="mt-1 font-extrabold text-emerald-800">Jornada do 4º trimestre completa!</p>
          <p className="mt-1 text-sm text-emerald-700">
            Parabéns! Você e {babyLabel} atravessaram as 12 primeiras semanas juntos. O caminho e os
            álbuns ficam guardados aqui para sempre 💝
          </p>
        </div>
      )}

      {/* Check-in (a chama continua a mesma da gestação — recorrência não quebra) */}
      {!checkedToday && !graduated && (
        <div className="rounded-2xl bg-white/80 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.05)] backdrop-blur-sm">
          <p className="text-sm font-bold">Como você está hoje, mamãe?</p>
          <p className="text-xs text-muted-foreground">
            Seu bem-estar importa tanto quanto o do bebê 💜
          </p>
          <div className="mt-2.5 flex justify-between gap-1">
            {MOODS.map((m) => (
              <button
                key={m.label}
                onClick={() => {
                  doCheckin(m.label);
                  markDayTask(todayD, "humor", true);
                }}
                className="press flex flex-1 flex-col items-center gap-0.5 rounded-xl bg-slate-50 py-2 hover:bg-sky-50"
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[10px] font-medium text-muted-foreground">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Seletor de fases pós-parto */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {phases.map((p, i) => {
          const locked = p.from * 7 > todayD;
          const isSelected = i === selectedPhase;
          return (
            <button
              key={p.n}
              onClick={() => setSelectedPhase(i)}
              disabled={locked}
              className={`press flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all disabled:cursor-not-allowed ${
                isSelected
                  ? `${posMeta(p.from).banner} text-white shadow-sm`
                  : locked
                    ? "bg-slate-100 text-slate-300"
                    : "bg-white/80 text-slate-500"
              }`}
            >
              {locked ? "🔒" : p.emoji} Fase {p.n}
            </button>
          );
        })}
      </div>

      <div
        className={`flex items-center justify-between rounded-2xl ${posMeta(phase.from).banner} px-5 py-4 text-white shadow-md`}
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">
            Fase {phase.n} · Semanas {phase.from}–{phase.to} de vida
          </p>
          <p className="mt-0.5 text-xl font-extrabold">{phase.name}</p>
        </div>
        <div className="text-4xl">{phase.emoji}</div>
      </div>

      {/* Caminho pós-parto */}
      <div
        ref={containerRef}
        className="relative overflow-y-auto rounded-3xl bg-gradient-to-b from-white/60 to-white/30 backdrop-blur-sm"
        style={{ height: "56vh" }}
      >
        <div className="relative" style={{ height: `${height}px` }}>
          {nodes.map((node) => {
            if (node.kind === "week-header") {
              const start = node.week * 7;
              const pm = start > todayD ? LOCKED : posMeta(node.week);
              const dias = Array.from({ length: 7 }, (_, i) => ({
                done: posDone.includes(start + i),
                today: start + i === todayD,
                future: start + i > todayD,
              }));
              return (
                <div
                  key={`h${node.week}`}
                  className="absolute inset-x-2"
                  style={{ top: `${node.y + 8}px` }}
                >
                  <WeekBar
                    title={`Semana ${node.week} de vida`}
                    main={pm.main}
                    lip={pm.lip}
                    days={dias}
                    current={todayD >= start && todayD <= start + 6}
                  />
                </div>
              );
            }

            const { D, week } = node;
            const isToday = D === todayD;
            const done = posDone.includes(D);
            const isPast = D < todayD;
            const isFuture = D > todayD;
            const pm = posMeta(week);
            const palette = done || isToday ? pm : isPast ? missedTint(pm) : futureTint(pm);
            const dia = isToday ? 72 : 52;

            return (
              <button
                key={`d${D}`}
                onClick={() => {
                  if (isFuture) {
                    const em = D - todayD;
                    toast(
                      `🔒 Esse dia abre ${em === 1 ? "amanhã" : `em ${em} dias`} — um passo de cada vez 💛`,
                    );
                    return;
                  }
                  openDay(D);
                }}
                aria-disabled={isFuture}
                className={`group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center focus:outline-none ${isFuture ? "cursor-not-allowed" : ""}`}
                style={{ left: `${node.x}%`, top: `${node.y}px` }}
                aria-label={
                  `Dia ${(D % 7) + 1} da semana ${week} de vida` +
                  (D === todayD ? ", hoje" : done ? ", concluído" : "")
                }
                aria-current={D === todayD ? "date" : undefined}
              >
                {isToday && (
                  <div className="duo-bubble absolute -top-10 z-20 whitespace-nowrap">
                    <div className="relative rounded-xl bg-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-sky-500 shadow-[0_3px_10px_rgba(0,0,0,0.12)]">
                      {graduated
                        ? "Jornada completa 🎓"
                        : done
                          ? "Dia completo ✓"
                          : "Desafio de hoje 🎁"}
                      <div className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-white" />
                    </div>
                  </div>
                )}
                <div
                  className={`duo3d relative flex items-center justify-center overflow-hidden rounded-full ${
                    isToday ? "ring-4 ring-white/70" : ""
                  } ${isToday && !done ? "dc-chest" : ""}`}
                  style={
                    {
                      width: `${dia}px`,
                      height: `${dia}px`,
                      background: palette.main,
                      "--lip": palette.lip,
                    } as React.CSSProperties
                  }
                >
                  {isToday && !done ? (
                    <span className="relative z-10 text-2xl">🎁</span>
                  ) : done ? (
                    <span
                      className={`relative z-10 font-black text-white ${isToday ? "text-2xl" : "text-lg"}`}
                    >
                      ✓
                    </span>
                  ) : null}
                  <span className="dc-coin-shine" aria-hidden />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sheet de dia pós-parto */}
      {sheet?.kind === "day" &&
        (() => {
          const D = sheet.D;
          const week = Math.max(1, Math.min(12, Math.floor(D / 7)));
          const ch = challengeForPosDay(D);
          const isToday = D === todayD;
          const state = isToday ? dayTasks : dayTaskState(D);
          const done = posDone.includes(D);
          const pm = posMeta(week);
          return (
            <div
              className="fixed inset-0 z-50 flex items-end"
              style={{ background: "rgba(0,0,0,0.2)", backdropFilter: "blur(2px)" }}
              onClick={() => setSheet(null)}
            >
              <div
                className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 pb-10 shadow-2xl"
                style={{ animation: "slideUp 300ms cubic-bezier(0.34,1.56,0.64,1) both" }}
                onClick={(e) => e.stopPropagation()}
              >
                {revealing && !careMode && <ConfettiBurst />}
                <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-slate-200" />

                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={`duo3d flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-3xl ${revealing ? "dc-sticker-pop" : ""}`}
                    style={{ background: pm.main, "--lip": pm.lip } as React.CSSProperties}
                  >
                    {done ? "⭐" : ch.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Semana {week} de vida · dia {(D % 7) + 1}
                      {isToday && (
                        <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-sky-600">
                          hoje
                        </span>
                      )}
                    </p>
                    <h3 className="mt-0.5 text-xl font-extrabold">
                      {done ? "Dia completo!" : "Desafio de hoje"}
                    </h3>
                  </div>
                </div>

                <div className="mb-4 rounded-2xl bg-emerald-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    ✅ Complete as 3 para ganhar o dia
                  </p>
                  <div className="mt-2 flex flex-col gap-2">
                    {[
                      { id: "humor", label: "Check-in: como você está?", emoji: "🙂" },
                      { id: "desafio", label: ch.label, emoji: ch.emoji },
                      { id: "leitura", label: "Ler a orientação da semana (abaixo)", emoji: "📖" },
                    ].map((t) => {
                      const checked =
                        t.id === "humor" && isToday ? checkedToday || !!state[t.id] : !!state[t.id];
                      const canToggle = isToday && !graduated && t.id === "desafio";
                      return (
                        <div key={t.id} className="flex items-center gap-2">
                          <button
                            onClick={() => canToggle && markDayTask(D, t.id, !state[t.id])}
                            disabled={!canToggle && t.id === "desafio"}
                            className={`press flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 text-xs font-black text-white transition-colors ${
                              checked
                                ? "border-emerald-500 bg-emerald-500"
                                : "border-emerald-300 bg-white"
                            }`}
                            aria-label={checked ? "Feito" : "Marcar"}
                          >
                            {checked ? "✓" : ""}
                          </button>
                          <span
                            className={`flex-1 text-sm ${checked ? "text-emerald-600 line-through" : "text-emerald-900"}`}
                          >
                            {t.emoji} {t.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mb-4 rounded-2xl border border-sky-100 bg-sky-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-sky-600">
                    🩺 Orientação médica
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-sky-900">
                    {POS_GUIDANCE[week] ?? POS_GUIDANCE[12]}
                  </p>
                </div>

                {isToday && !graduated && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      🔒 Amanhã: novo desafio
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {challengeForPosDay(D + 1).emoji} Volte amanhã para manter a chama 🔥
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      {/* Sheet de álbum da gestação (recordação) */}
      {sheet?.kind === "album" && (
        <AlbumSheet
          week={sheet.week}
          babyLabel={babyLabel}
          revealing={revealing}
          onClose={() => setSheet(null)}
          onShare={shareGest}
          careMode={careMode}
        />
      )}
    </div>
  );
}
