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
  faixaDoTema,
  guiaTerminou,
  faixaDoMovimento,
  decorrido as vozDecorrido,
  duracao as vozDuracao,
  RESPIRACAO,
  RECHAMADAS_AUDIO,
  FECHAMENTO as VOZ_FECHAMENTO,
} from "@/lib/voz";
import { FiguraMovimento, type PoseKey } from "@/components/figura-movimento";
import {
  IconeCadeado,
  IconeCalendario,
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
/* ── Estrelas do dia em MEIAS: 6 jogos × ½⭐ = 3⭐ ─────────────────────────
   Os 5 jogos de bem-estar + a aula da professora. Cada um vale meia estrela. */
const WELLNESS_HALF_KEYS = [
  "w_breathing",
  "w_movement",
  "w_meditation",
  "w_bonding",
  "w_gratitude",
] as const;

function halvesFromState(s: Record<string, boolean>): number {
  return WELLNESS_HALF_KEYS.filter((k) => s[k]).length + (s.desafio ? 1 : 0);
}

/** 3 estrelas que enchem em METADES (0–6). Base cinza, recheio por cima. */
function StarMeter({ halves, size = "text-xl" }: { halves: number; size?: string }) {
  return (
    <span className={`inline-flex gap-0.5 ${size} leading-none`} aria-label={`${halves / 2} de 3`}>
      {[0, 1, 2].map((i) => {
        const fill = Math.max(0, Math.min(2, halves - i * 2)); // 0 | 1 (meia) | 2 (cheia)
        return (
          <span key={i} className="relative inline-block">
            <span className="opacity-30 grayscale">⭐</span>
            {fill > 0 && (
              <span
                className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap"
                style={{ width: fill === 2 ? "100%" : "50%" }}
              >
                ⭐
              </span>
            )}
          </span>
        );
      })}
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
import { Bolha, humorDaJornada } from "@/components/bolha";
import { recadoDaBolha } from "@/lib/recado-da-bolha";
/* Arte própria desta tela, feita a partir do desenho de referência. Ela mora
   em `assets/jogo` e não em `assets/sky` porque não é um céu do relógio: é o
   cenário fixo da tela de atividades. */
import jogoBolha from "@/assets/jogo/bolha.webp";
import { BabyIllustration } from "@/components/baby-illustration";
import { ehNativo, tocarPadrao } from "@/lib/nativo";
import { podeComprarAqui } from "@/lib/canal-de-venda";
import { brl as brlPromo } from "@/lib/promo";
import { BONUS_VINCULO_MEDICO } from "@/lib/economia-sementinhas";
import type { PrecosDaPaciente } from "@/lib/promo.functions";
import { manterTelaAcesa } from "@/lib/tela-acesa";

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
  /** Cidade do cadastro — chega até o céu da tela de atividades. */
  homeCity?: { nome: string; lat: number; lon: number } | null;
  /**
   * SÓ a bancada de design `/preview-jogo` usa.
   *
   * Um objeto e não três props soltas: assim fica óbvio no chamador que isto
   * é andaime de conferência, e o dia em que sair, sai inteiro. `jogos` abre
   * as atividades do dia (que na conta real só se alcança tocando num nó da
   * trilha) e os outros dois fingem um estado com progresso, porque a tela
   * vazia esconde justamente o anel e o ✓ das linhas.
   */
  bancada?: { jogos?: boolean; saldo?: number; halves?: number; enfeites?: string[] };
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
  homeCity = null,
  bancada,
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

  const streak = useMemo(() => {
    if (!hasGest || doneDays.length === 0) return 0;
    const set = new Set(doneDays);
    let s = 0;
    let d = set.has(todayD) ? todayD : todayD - 1;
    while (set.has(d)) {
      s++;
      d--;
    }
    return s;
  }, [doneDays, todayD, hasGest]);

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
    // As 3 estrelas do dia agora são 6 MEIAS: aula + os 5 jogos de bem-estar.
    const allDone = halvesFromState(state) >= 6;
    if (allDone && !doneDays.includes(D)) {
      const next = [...doneDays, D];
      setDoneDays(next);
      lsSet(LS.doneDays, next);
      setRevealing(true);
      setTimeout(() => setRevealing(false), 1800);
      collectSticker(Math.floor(D / 7), false);
      // 3 estrelas fechadas hoje (fora do Modo Cuidado): bônus + celebração.
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
              if (r.ok && r.granted > 0) toast.success(`⭐⭐⭐ 3 estrelas! +${r.granted} 🌱`);
              else toast.success("⭐⭐⭐ 3 estrelas do dia!");
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
              <IconeChama
                className={`h-[22px] w-[22px] ${streak > 0 ? "text-amber-500" : "text-slate-300"}`}
              />
              <span className="text-lg font-extrabold text-amber-500">{streak}</span>
              <span className="text-xs font-medium text-muted-foreground">
                {streak === 1 ? "dia" : "dias"}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
          </>
        )}
        <div className="flex items-center gap-1.5" title="Dia da sua jornada">
          <IconeCalendario className="h-[22px] w-[22px] text-sky-500" />
          <span className="text-lg font-extrabold text-sky-500">{journeyDayNum}º</span>
          <span className="text-xs font-medium text-muted-foreground">dia</span>
        </div>
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-1.5" title="Figurinhas coletadas">
          <IconeTrofeu className="h-[22px] w-[22px] text-violet-500" />
          <span className="text-lg font-extrabold text-violet-500">{stickers.length}</span>
        </div>
        {saldo != null && (
          <>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5" title="Suas Sementinhas">
              <span className="text-xl">🌱</span>
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
          const halvesToday = isToday ? halvesFromState(todayTasks) : 0;

          return (
            <div key={`d${D}`}>
              <button
                id={isToday ? "dc-today-node" : undefined}
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
                /* O rótulo diz o ESTADO, não só a data. Eram ~300 botões com
                   "Dia 3 da semana 12" e nada mais: um leitor de tela lia
                   trezentos rótulos quase idênticos, sem nenhuma âncora para
                   achar onde a paciente está nem o que já fez. */
                aria-label={
                  `Dia ${dayOfWeek} da semana ${week}` +
                  (isToday
                    ? `, hoje — ${halvesToday} de 6 atividades`
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
                  {isToday && <TaskRing done={done ? 6 : halvesToday} total={6} color={tm.main} />}
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
                {/* 3 estrelas do dia em MEIAS (6 jogos). Só em HOJE e nos dias
                    FEITOS: num dia passado que ela não jogou, três estrelas
                    apagadas não informam nada — repetidas ao longo da trilha
                    viram ruído, e ainda por cima parecem cobrança. */}
                {(isToday || done) && !careMode && (
                  <div className="mt-1.5 drop-shadow-sm">
                    <StarMeter halves={done ? 6 : halvesToday} size="text-sm" />
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
                halves={bancada?.halves ?? (doneDays.includes(D) ? 6 : halvesFromState(st))}
                babyName={profile?.baby_name ?? null}
                homeCity={homeCity ?? null}
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

/* ══════════════════ Respiração guiada (atividade de bem-estar do dia) ══════════════════
   Estilo iPhone/Apple Watch: um círculo que abre (inspire), segura e fecha
   (expire), com vibração suave a cada fase. Padrão calmo 4-4-6. Ao concluir,
   recompensa fixa (nunca punitiva), suprimida em Modo Cuidado. */

const BREATH_PATTERN = { in: 4000, hold: 4000, out: 6000 } as const;
const BREATH_CYCLES = 5;

/* Toque curto das viradas (mudança de movimento, próxima linha da carta).
   Passa pela ponte: `navigator.vibrate` não existe no iPhone, então isto era
   mudo em todo iOS — e é justamente o sinal que diz "mudou" a quem está de
   olhos fechados. */
function buzz(ms = 28) {
  tocarPadrao([ms]);
}

function BreathingBlock({
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
  const [open, setOpen] = useState(!!aoSair);
  const [phase, setPhase] = useState<"intro" | "in" | "hold" | "out" | "done">("intro");
  const [cycle, setCycle] = useState(0);
  const [tick, setTick] = useState(0); // segundos restantes da fase (contagem viva)
  const [reward, setReward] = useState<number | null>(null);
  const [sound, setSound] = useState(true);
  const grantedRef = useRef(false);
  const audioRef = useRef<ReturnType<typeof createBreathAudio> | null>(null);

  // Contagem regressiva visível dentro do círculo (1s em 1s).
  useEffect(() => {
    if (phase !== "in" && phase !== "hold" && phase !== "out") return;
    const dur =
      phase === "in"
        ? BREATH_PATTERN.in
        : phase === "hold"
          ? BREATH_PATTERN.hold
          : BREATH_PATTERN.out;
    setTick(Math.round(dur / 1000));
    const iv = setInterval(() => setTick((t) => Math.max(1, t - 1)), 1000);
    return () => clearInterval(iv);
  }, [phase, cycle]);

  // Loop das respirações: inspire → segure → expire, BREATH_CYCLES vezes.
  // Ao ENTRAR em cada fase, dispara a vibração e o som (que incha/afina junto).
  useEffect(() => {
    if (phase !== "in" && phase !== "hold" && phase !== "out") return;
    const dur =
      phase === "in"
        ? BREATH_PATTERN.in
        : phase === "hold"
          ? BREATH_PATTERN.hold
          : BREATH_PATTERN.out;
    vibratePhase(phase, dur);
    audioRef.current?.setPhase(phase, dur);
    /* A VOZ da fase — "inspire", "segure", "solte".
       As três faixas existem em `voz.ts` desde que a Isabella foi gravada, e
       só o MeditationBlock as usava. Esta tela escreve "pode fechar os olhos —
       o som conduz o compasso" e guiava com um drone de volume variável: de
       olhos fechados não dá para saber se está no "segure" ou no "solte".
       O primeiro disparo sai de dentro do clique (`begin`), então a política
       de autoplay libera os seguintes. */
    if (sound) {
      const palavra =
        phase === "in" ? RESPIRACAO.in : phase === "hold" ? RESPIRACAO.hold : RESPIRACAO.out;
      tocarVoz(palavra, { canal: "pulso", volume: 0.85 });
    }
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      if (phase === "in") setPhase("hold");
      else if (phase === "hold") setPhase("out");
      else {
        const next = cycle + 1;
        if (next >= BREATH_CYCLES) {
          setPhase("done");
          finish();
        } else {
          setCycle(next);
          setPhase("in");
        }
      }
    }, dur);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cycle]);

  // Garante que o áudio pare se o componente sair da tela.
  useEffect(() => () => audioRef.current?.stop(), []);

  /* Tela acesa enquanto respira. São 70 segundos com a tela pedindo que ela
     feche os olhos — tempo de sobra para o aparelho bloquear e suspender o
     `setTimeout` que conduz as fases. */
  useEffect(() => {
    if (phase !== "in" && phase !== "hold" && phase !== "out") return;
    return manterTelaAcesa();
  }, [phase]);

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
        data: { accessToken: token, day, activity: "breathing" },
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
    setCycle(0);
    setReward(null);
    grantedRef.current = false;
    /* Primeira palavra DENTRO do clique: o efeito da fase roda depois do
       React pintar, e aí o Safari e o Chrome do celular já não consideram
       mais o gesto — o `play()` volta rejeitado e a sessão inteira sai muda.
       Mesmo motivo documentado no MeditationBlock. */
    if (sound) tocarVoz(RESPIRACAO.in, { canal: "pulso", volume: 0.85 });
    if (sound) {
      audioRef.current = createBreathAudio();
      audioRef.current.start();
    }
    setPhase("in");
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
      } else if (phase === "in" || phase === "hold" || phase === "out") {
        audioRef.current = createBreathAudio();
        audioRef.current.start();
      }
      return next;
    });
  }

  const label =
    phase === "in" ? "Inspire" : phase === "hold" ? "Segure" : phase === "out" ? "Expire" : "";
  // Escala do círculo: começa pequeno (desaproxima), incha ao inspirar/segurar,
  // encolhe ao expirar — igual ao "Respirar" do iPhone/Apple Watch.
  const scale = phase === "in" || phase === "hold" ? 1 : phase === "out" ? 0.5 : 0.5;
  const scaleDur = phase === "in" ? BREATH_PATTERN.in : phase === "out" ? BREATH_PATTERN.out : 0;
  /* Duração da fase em curso — a MESMA que move o som, a vibração e a bolha.
     `scaleDur` não serve: ele é 0 no "segure" porque os anéis não mudam de
     tamanho ali, e uma transição de 0ms faria a bolha saltar. */
  const faseDur =
    phase === "hold"
      ? BREATH_PATTERN.hold
      : phase === "out"
        ? BREATH_PATTERN.out
        : BREATH_PATTERN.in;

  return (
    <>
      <div className="mt-4 rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-cyan-50 p-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌬️</span>
          <div className="flex-1">
            <p className="text-sm font-extrabold text-sky-800">Respiração do dia</p>
            <p className="text-xs text-sky-700/80">
              Um minutinho de calma pra você e o bebê {alreadyDone ? "· feito hoje ✓" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setOpen(true);
            setPhase("intro");
          }}
          className="press mt-3 w-full rounded-full bg-sky-500 py-2.5 text-sm font-extrabold text-white"
        >
          {alreadyDone ? "Respirar de novo" : "Começar a respirar"}
        </button>
      </div>

      {open && (
        <div
          className="dc-quiz-in fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-sky-100 via-cyan-50 to-white"
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
            {phase === "in" || phase === "hold" || phase === "out" ? (
              <p className="flex-1 text-center text-xs font-bold uppercase tracking-wider text-sky-500">
                Ciclo {Math.min(cycle + 1, BREATH_CYCLES)} de {BREATH_CYCLES}
              </p>
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
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              <span className="text-6xl">🌸</span>
              <h3 className="mt-4 text-2xl font-extrabold text-sky-900">Respire com seu bebê</h3>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-sky-800/80">
                Vamos fazer {BREATH_CYCLES} respirações lentas: inspire em 4s, segure 4s e solte em
                6s. Deixe os ombros caírem. 💙
              </p>
              <button
                onClick={begin}
                className="press mt-8 rounded-full bg-sky-500 px-8 py-3 text-sm font-extrabold text-white"
              >
                Começar
              </button>
            </div>
          )}

          {(phase === "in" || phase === "hold" || phase === "out") && (
            <div className="flex flex-1 flex-col items-center justify-center">
              <div className="relative flex h-72 w-72 items-center justify-center">
                {/* Aura girando devagar — dá vida ao círculo sem repaint pesado */}
                <div
                  className="absolute -inset-4 rounded-full opacity-60 blur-2xl"
                  style={{
                    background:
                      "conic-gradient(from 0deg, rgba(56,189,248,0.35), rgba(34,211,238,0.12), rgba(129,140,248,0.28), rgba(56,189,248,0.35))",
                    animation: "orbitSpin 16s linear infinite",
                  }}
                  aria-hidden
                />
                <div
                  className="dc-guiado absolute inset-0 rounded-full bg-sky-300/30"
                  style={
                    {
                      transform: `scale(${scale})`,
                      "--guiado-ms": `${scaleDur}ms`,
                      "--guiado-escala": scale,
                    } as React.CSSProperties
                  }
                  aria-hidden
                />
                <div
                  className="dc-guiado absolute inset-6 rounded-full bg-sky-400/40"
                  style={
                    {
                      transform: `scale(${scale})`,
                      "--guiado-ms": `${scaleDur}ms`,
                      "--guiado-escala": scale,
                    } as React.CSSProperties
                  }
                  aria-hidden
                />
                {/* No centro, ELA — inflando e esvaziando no compasso.
                    Duas coisas de propósito:

                    · O humor é `dormindo`, de olhos fechados. O personagem
                      DEMONSTRA o que se pede à paciente, em vez de a tela
                      mandar. É o que o Duo faz no Duolingo: ele não explica o
                      exercício, ele faz junto.

                    · Ela escala sozinha, pelo `respiro`. Pôr um `scale` no
                      contêiner multiplicaria com o dela e a bolha estouraria o
                      anel — os anéis atrás continuam com o seu próprio. */}
                <div className="relative z-10 flex flex-col items-center gap-3">
                  <Bolha
                    tamanho={104}
                    humor="dormindo"
                    flutua={false}
                    respiro={{ fase: phase, duracaoMs: faseDur }}
                  />
                  <span className="tabular-nums text-2xl font-black leading-none text-sky-700">
                    {tick}
                  </span>
                </div>
              </div>
              {/* O rótulo aparecia DUAS vezes — dentro do círculo e aqui. Ficou
                  só este: um comando repetido na mesma tela não reforça, cansa. */}
              <p className="mt-8 text-lg font-bold text-sky-800">{label}…</p>
              <p className="mt-1 max-w-[230px] text-center text-xs text-sky-700/70">
                Pode fechar os olhos — o som conduz o compasso.
              </p>
              {/* Bolinhas dos ciclos — enchem conforme respira */}
              <div className="mt-3 flex gap-1.5">
                {Array.from({ length: BREATH_CYCLES }, (_, i) => (
                  <span
                    key={i}
                    className={`h-2 w-2 rounded-full transition-colors ${
                      i < cycle ? "bg-sky-500" : i === cycle ? "bg-sky-400/70" : "bg-sky-200"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {phase === "done" && (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              {!careMode && <ConfettiBurst />}
              {/* A flor emoji saiu: cada celular desenha uma flor diferente, e
                  o instante que a paciente veio buscar era o único da sessão
                  sem a personagem nele.

                  E o `dc-result-in` que embrulhava isto saiu junto: ele é
                  `scale(0.4→1.18→1)` mais `rotate(-8°→3°)` em 620ms, então os
                  primeiros 620 dos 900ms do pulo — a antecipação inteira e
                  toda a subida — rodavam MULTIPLICADOS por um pop-in que gira.
                  Medido: no instante do agachamento o embrulho estava em
                  scale 0,80. O único uso do salto no produto era justamente o
                  que anulava o princípio que ele existe para mostrar. A bolha
                  já tem a própria entrada. */}
              <Bolha tamanho={96} humor="comemorando" entrada="pulo" careMode={careMode} />
              <h3 className="mt-3 text-2xl font-extrabold text-sky-900">Que calma boa 💙</h3>
              <p className="mt-1 text-sm text-sky-800/80">
                Você respirou com seu bebê. Guarde essa sensação.
              </p>
              {!careMode && reward != null && reward > 0 && (
                <div className="mt-4 rounded-full bg-emerald-100 px-5 py-2 text-base font-extrabold text-emerald-700">
                  +{reward} 🌱 Sementinhas!
                </div>
              )}
              <button
                onClick={close}
                className="press mt-8 w-full max-w-xs rounded-full bg-sky-500 py-3 text-sm font-extrabold text-white"
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

/* ══════════════════ Movimento do dia (atividade de bem-estar) ══════════════════
   Movimentos LEVES e seguros em qualquer trimestre (sentada/em pé, sem deitar
   de costas). Sequência curta com cronômetro. Sempre com aviso de confirmar
   com o médico. Recompensa fixa por concluir (nunca punitiva). */

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
type Movimento = {
  id: string;
  pose: PoseKey;
  emoji: string;
  name: string;
  cue: string;
  passos: string[];
  sentir: string;
  parar: string;
  secs: number;
};

const MOVIMENTOS: Movimento[] = [
  {
    id: "ombros",
    pose: "pe",
    emoji: "💆",
    name: "Rolar os ombros",
    cue: "Gire os ombros para trás, devagar e amplo.",
    passos: [
      "Fique em pé ou sentada, pés afastados na largura do quadril.",
      "Solte os braços ao lado do corpo, sem travar os cotovelos.",
      "Suba os ombros na direção das orelhas, leve-os para trás e desça.",
      "Cada volta deve levar uns 4 segundos — quanto mais lento, melhor.",
    ],
    sentir: "Um alívio entre o pescoço e as escápulas.",
    parar: "Se der pontada no ombro ou formigar o braço.",
    secs: 30,
  },
  {
    id: "pescoco",
    pose: "sentada",
    emoji: "🙆",
    name: "Alongar o pescoço",
    cue: "Incline a orelha em direção ao ombro; troque de lado sem forçar.",
    passos: [
      "Sente-se com as costas apoiadas e os dois pés no chão.",
      "Deixe o ombro direito pesado, como se ele puxasse o chão.",
      "Incline a orelha esquerda ao ombro esquerdo, sem girar o rosto.",
      "Fique 15 segundos respirando e troque de lado.",
    ],
    sentir: "Um estica suave na lateral do pescoço, nunca na garganta.",
    parar: "Se der tontura ou formigamento nas mãos.",
    secs: 30,
  },
  {
    id: "gatocamelo",
    pose: "quatro",
    emoji: "🐈",
    name: "Gato-camelo suave",
    cue: "De quatro apoios, arredonde a coluna e volte ao neutro com a respiração.",
    passos: [
      "De quatro apoios: mãos abaixo dos ombros, joelhos abaixo do quadril.",
      "Se o joelho incomodar, dobre uma toalha embaixo dele.",
      "Ao SOLTAR o ar, arredonde as costas e leve o queixo ao peito.",
      "Ao PUXAR o ar, volte a coluna ao neutro — sem afundar a lombar.",
      "Uma ida e volta por respiração.",
    ],
    sentir: "A lombar abrindo e aliviando.",
    parar: "Se doer o punho — apoie nos punhos fechados ou pare.",
    secs: 40,
  },
  {
    id: "quadril",
    pose: "borboleta",
    emoji: "🦋",
    name: "Abertura de quadril",
    cue: "Sentada, solas dos pés juntas, deixe os joelhos caírem suaves.",
    passos: [
      "Sente-se no chão ou na cama com as solas dos pés encostadas.",
      "Apoie as costas numa parede se for mais confortável.",
      "Segure os tornozelos e deixe os joelhos caírem pelo próprio peso.",
      "Não empurre os joelhos para baixo com as mãos.",
    ],
    sentir: "Um alongamento na parte interna das coxas.",
    parar: "Se doer a virilha ou o osso da frente do púbis.",
    secs: 30,
  },
  {
    id: "tornozelo",
    pose: "sentada",
    emoji: "🦶",
    name: "Círculos de tornozelo",
    cue: "Desenhe círculos lentos com o pé — ajuda a circulação e o inchaço.",
    passos: [
      "Sentada, estenda uma perna e apoie o calcanhar no chão ou num banquinho.",
      "Desenhe círculos lentos com o pé: 10 para cada lado.",
      "Troque de pé e repita.",
      "Termine puxando a ponta do pé na direção do joelho por 5 segundos.",
    ],
    sentir: "A panturrilha trabalhando e o pé mais leve.",
    parar: "Se uma panturrilha doer sozinha, quente ou muito inchada — avise o médico.",
    secs: 30,
  },
  {
    id: "pelve",
    pose: "pe",
    emoji: "🧍",
    name: "Inclinação pélvica em pé",
    cue: "Em pé, gire a bacia para frente e para trás, bem devagar.",
    passos: [
      "Em pé, encoste as costas numa parede com os pés a um palmo dela.",
      "Puxe o ar e relaxe o corpo.",
      "Ao soltar o ar, gire a bacia para cima e cole a lombar na parede.",
      "Solte devagar e repita no ritmo da respiração.",
    ],
    sentir: "A lombar se soltando e o abdômen ativando de leve.",
    parar: "Se sentir contração ou dor que não passa ao parar.",
    secs: 30,
  },
  {
    id: "bracos",
    pose: "pe",
    emoji: "🙌",
    name: "Alongar os braços pro alto",
    cue: "Entrelace os dedos, vire as palmas pra cima e estique — respira fundo.",
    passos: [
      "Em pé ou sentada, entrelace os dedos à frente do peito.",
      "Vire as palmas para fora e estenda os braços.",
      "Suba os braços acima da cabeça enquanto puxa o ar.",
      "Desça devagar soltando o ar. Repita 5 vezes.",
    ],
    sentir: "As costelas e as laterais do tronco abrindo — alívio pra azia.",
    parar: "Se ficar tonta ao levantar os braços: desça e sente-se.",
    secs: 30,
  },
  {
    id: "torcao",
    pose: "sentada",
    emoji: "🪑",
    name: "Torção suave sentada",
    cue: "Sentada, gire o tronco devagar pra um lado, depois pro outro.",
    passos: [
      "Sente-se na beira da cadeira com os pés apoiados no chão.",
      "Mão direita no encosto, mão esquerda na coxa direita.",
      "Gire a partir do meio das costas, mantendo a barriga apontada pra frente.",
      "Fique 15 segundos respirando e troque de lado.",
    ],
    sentir: "A coluna girando — nunca um aperto na barriga.",
    parar: "Se a barriga apertar ou a respiração embolar.",
    secs: 30,
  },
  {
    id: "balanco",
    pose: "quatro",
    emoji: "🐾",
    name: "Balanço em quatro apoios",
    cue: "Leve o quadril pra trás e volte — alivia as costas e ajuda o encaixe.",
    passos: [
      "De quatro apoios, mãos abaixo dos ombros.",
      "Leve o quadril pra trás, na direção dos calcanhares, até onde for confortável.",
      "Volte devagar à posição inicial.",
      "Vá e volte no ritmo da respiração.",
    ],
    sentir: "A lombar descomprimindo.",
    parar: "Se o punho ou o joelho doerem.",
    secs: 40,
  },
];

/**
 * Movimentos que NÃO servem para todo mundo.
 *
 * Quatro apoios e borboleta no chão são seguros e até úteis em boa parte da
 * gestação, mas deixam de ser em dois momentos:
 *
 *  · No PÓS-PARTO recente. A rotação antiga não sabia disso, e uma mulher com
 *    três dias de puérpera recebia gato-camelo em quatro apoios — três dias
 *    depois de uma cesárea, se tiver sido cesárea.
 *  · No FIM da gestação, quando a sínfise púbica dói, abrir o quadril sentada
 *    no chão e ficar de quatro deixam de ser alívio e viram esforço.
 *
 * Não é uma regra de conduta clínica: é o mínimo de bom senso para não
 * oferecer o movimento errado no dia errado. Quem decide o que ela pode fazer
 * continua sendo o obstetra dela.
 */
const CHAO = new Set(["gatocamelo", "balanco", "quadril"]);

/**
 * Os 3 movimentos do dia.
 *
 * `semana` é opcional só porque o pós-parto chama sem ela — mas quando vem, é
 * ela que decide quais movimentos entram no sorteio. Antes a função recebia
 * apenas o dia e girava os nove por `day % 9`: uma gestante de 6 semanas e
 * outra de 40 recebiam exatamente o mesmo trio, e a semana estava disponível
 * no escopo de quem chamava, sem ser passada.
 */
function movimentosForDay(day: number, semana?: number, posParto = false): Movimento[] {
  const elegiveis =
    posParto || (semana != null && semana >= 37)
      ? MOVIMENTOS.filter((m) => !CHAO.has(m.id))
      : MOVIMENTOS;
  // Sobram 6 movimentos no filtro — ainda dá os 3 do dia sem repetir.
  const start = day % elegiveis.length;
  return [0, 1, 2].map((k) => elegiveis[(start + k) % elegiveis.length]);
}

function MovementBlock({
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
  const seq = useMemo(() => movimentosForDay(day, semana, posParto), [day, semana, posParto]);
  const [open, setOpen] = useState(!!aoSair);
  // Aberto pela lista, o exercício começa NO exercício. A telinha "Movimento
  // do dia / Começar" só repetia o nome do card que ela acabou de tocar; o
  // aviso médico que morava nela virou uma linha fixa no topo da tela.
  const [phase, setPhase] = useState<"intro" | "active" | "done">(aoSair ? "active" : "intro");
  const [idx, setIdx] = useState(0);
  const [secs, setSecs] = useState(aoSair ? seq[0].secs : 0);
  const [voz, setVoz] = useState(true);
  const [reward, setReward] = useState<number | null>(null);
  const grantedRef = useRef(false);

  /* A voz desta tela é arquivo nosso, então o botão aparece sempre. Antes ele
     sumia em quem não tinha voz pt-BR instalada no aparelho — no Android, muita
     gente abria a tela sem sequer saber que existia voz. */
  useEffect(() => () => pararVoz(), []);

  // A voz lê o nome e a dica ao ENTRAR em cada movimento — assim ela pode
  // olhar para o próprio corpo em vez de para o celular, que é justamente o
  // que um exercício pede e um texto na tela impede.
  useEffect(() => {
    if (phase !== "active" || !voz || !seq[idx]) return;
    const faixa = faixaDoMovimento(seq[idx].id);
    if (faixa) tocarVoz(faixa, { canal: "guia" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx, voz]);

  useEffect(() => {
    if (phase !== "active") return;
    if (secs <= 0) {
      if (idx + 1 >= seq.length) {
        setPhase("done");
        finish();
      } else {
        setIdx(idx + 1);
        setSecs(seq[idx + 1].secs);
        buzz();
      }
      return;
    }
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, secs, idx]);

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
    setIdx(0);
    setSecs(seq[0].secs);
    setReward(null);
    grantedRef.current = false;
    setPhase("active");
    buzz();
  }
  function close() {
    pararVoz();
    if (aoSair) return aoSair();
    setOpen(false);
    setPhase("intro");
  }
  function alternarVoz() {
    setVoz((v) => {
      if (v) pararVoz();
      return !v;
    });
  }

  const cur = seq[idx];

  return (
    <>
      <div className="mt-4 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤸</span>
          <div className="flex-1">
            <p className="text-sm font-extrabold text-emerald-800">Movimento do dia</p>
            <p className="text-xs text-emerald-700/80">
              3 movimentos leves e seguros {alreadyDone ? "· feito hoje ✓" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setOpen(true);
            setPhase("intro");
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
              <button
                onClick={alternarVoz}
                aria-label={voz ? "Desligar voz" : "Ligar voz"}
                className={`press text-lg leading-none ${voz ? "" : "opacity-40 grayscale"}`}
              >
                🗣️
              </button>
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

          {phase === "intro" && (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              <span className="text-6xl">🤸</span>
              <h3 className="mt-4 text-2xl font-extrabold text-emerald-900">Movimento do dia</h3>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-emerald-800/80">
                3 movimentos suaves pra soltar o corpo. Vá no seu ritmo e pare se sentir qualquer
                desconforto.
              </p>
              <p className="mt-2 max-w-xs text-[11px] text-emerald-700/70">
                Confirme com seu médico se algum movimento não é indicado pra você.
              </p>
              <button
                onClick={begin}
                className="press mt-8 rounded-full bg-emerald-500 px-8 py-3 text-sm font-extrabold text-white"
              >
                Começar
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
                    style={{ transition: "stroke-dashoffset 1s linear" }}
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
          {phase === "done" && (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              {!careMode && <ConfettiBurst />}
              <span className="dc-result-in text-6xl">💪</span>
              <h3 className="mt-3 text-2xl font-extrabold text-emerald-900">Corpo soltinho! 🎉</h3>
              <p className="mt-1 text-sm text-emerald-800/80">
                Você cuidou de você e do bebê hoje.
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

const MEDITACOES: { theme: string; need: string; emoji: string; lines: string[] }[] = [
  {
    theme: "Calma",
    need: "Estou tensa",
    emoji: "🌊",
    lines: [
      "Feche os olhos e solte os ombros.",
      "Sinta o ar entrando… e saindo, sem pressa.",
      "A cada expiração, solte um pouco da tensão do dia.",
      "Você está segura. Seu bebê está bem aqui com você.",
      "Deixe o corpo pesar, como se afundasse em algo macio.",
      "Fique mais um instante, só respirando.",
      "Quando quiser, abra os olhos devagar.",
    ],
  },
  {
    theme: "Conexão com o bebê",
    need: "Quero sentir o bebê",
    emoji: "💛",
    lines: [
      "Leve uma das mãos até a barriga, sem apertar.",
      "Respire fundo e imagine esse ar chegando até o bebê.",
      "Por dentro, mande um 'oi' carinhoso pra ele.",
      "Sinta que, agora, vocês dois estão respirando juntos.",
      "Não precisa fazer nada — só estar aqui já é cuidado.",
      "Guarde essa sensação de vínculo.",
      "Abra os olhos quando estiver pronta.",
    ],
  },
  {
    theme: "Descanso",
    need: "Preciso descansar",
    emoji: "🌙",
    lines: [
      "Acomode-se do jeito mais confortável possível.",
      "Solte a mandíbula, solte a testa, solte as mãos.",
      "Deixe a respiração ficar mais lenta, sozinha.",
      "Imagine um lugar tranquilo e seguro só seu.",
      "Aqui, não há nada pra resolver agora.",
      "Descanse mais um pouco nesse lugar.",
      "Volte devagar, sem pressa.",
    ],
  },
  {
    theme: "Gratidão",
    need: "Quero um respiro bom",
    emoji: "✨",
    lines: [
      "Respire fundo uma vez, bem devagar.",
      "Pense em uma coisa boa que aconteceu hoje.",
      "Pode ser bem pequena — um gole de água, um sol na pele.",
      "Deixe esse pensamento aquecer o peito.",
      "Agradeça ao seu corpo por estar cuidando de duas vidas.",
      "Respire mais uma vez, sorrindo por dentro.",
      "Abra os olhos levando essa calma com você.",
    ],
  },
  {
    theme: "Sono tranquilo",
    need: "Não consigo dormir",
    emoji: "😴",
    lines: [
      "Deite-se de lado, com um travesseiro apoiando a barriga.",
      "Solte o peso do corpo no colchão, parte por parte.",
      "Deixe a respiração ficar longa e silenciosa.",
      "Imagine cada pensamento indo embora como uma nuvem.",
      "Não precisa dormir agora — só descansar já basta.",
      "Fique nesse aconchego mais um pouquinho.",
    ],
  },
  {
    theme: "Coragem pro parto",
    need: "Estou com medo do parto",
    emoji: "🦁",
    lines: [
      "Respire fundo e sinta a força que já existe em você.",
      "Seu corpo sabe o caminho — ele foi feito pra isso.",
      "A cada respiração, diga por dentro: 'eu sou capaz'.",
      "O medo pode vir junto — e você segue mesmo assim.",
      "Milhões de mulheres já fizeram isso. Você não está só.",
      "Guarde essa confiança pra quando precisar dela.",
    ],
  },
  {
    theme: "Aqui e agora",
    need: "Minha cabeça não para",
    emoji: "🍃",
    lines: [
      "Sinta os pontos do corpo que tocam o chão ou a cadeira.",
      "Perceba 3 sons ao seu redor, sem julgar.",
      "Perceba o ar tocando a sua pele.",
      "Não há passado nem futuro neste instante — só agora.",
      "Você e o bebê, respirando, neste exato momento.",
      "Leve essa presença pro resto do dia.",
    ],
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

/**
 * Dias seguidos com meditação.
 *
 * Detalhe que separa "gancho gentil" de "gancho punitivo": se ela AINDA não
 * meditou hoje, a sequência de ontem continua contando. Ela só quebra quando
 * um dia inteiro passa em branco. Zerar o número às 00h01 de um dia que mal
 * começou é o tipo de pressão que não cabe numa tela de gestante.
 */
function sequenciaDeDias(dias: string[]): number {
  const set = new Set(dias);
  const d = new Date();
  if (!set.has(diaISO(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(diaISO(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
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

const RESPIRO = { in: 4, hold: 2, out: 6 } as const; // 12s por ciclo
const CICLO_SEGS = RESPIRO.in + RESPIRO.hold + RESPIRO.out;

const DURACOES = [2, 5, 10] as const;

/** Frases esparsas do trecho silencioso — nunca instruem, só reancoram. */
const RECHAMADAS = [
  "Se a cabeça foi embora, tudo bem. Volte pra respiração.",
  "Nada pra resolver agora. Só o ar entrando e saindo.",
  "Solte os ombros de novo.",
  "Você e o bebê, respirando juntos.",
  "Deixe a expiração ser mais longa que a inspiração.",
];

const COMO_ESTOU = [
  { emoji: "😌", label: "Mais calma" },
  { emoji: "🥱", label: "Com sono" },
  { emoji: "💛", label: "Conectada" },
  { emoji: "😐", label: "Igual" },
  { emoji: "😟", label: "Ainda ansiosa" },
] as const;

const FECHAMENTO: Record<string, string> = {
  "Mais calma": "É isso mesmo. Guarde esse ritmo pro resto do dia.",
  "Com sono": "Sono depois de meditar é o corpo aceitando descansar. Vá deitar.",
  Conectada: "Esse instante também é cuidado com ele. Vocês dois sentiram.",
  Igual: "Nem toda sessão muda o dia — e mesmo assim ela contou. Volte amanhã.",
  "Ainda ansiosa":
    "Ansiedade que não passa em 5 minutos merece ser falada. Leve isso pra consulta.",
};

function MeditationBlock({
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
  const sugerida = day % MEDITACOES.length;
  const [open, setOpen] = useState(!!aoSair);
  const [etapa, setEtapa] = useState<"escolha" | "sessao" | "reflexo" | "fim">("escolha");
  const [temaIdx, setTemaIdx] = useState(sugerida);
  const [minutos, setMinutos] = useState<(typeof DURACOES)[number]>(5);
  const [som, setSom] = useState<SoundscapeKey>("pad");
  const [voz, setVoz] = useState(true);
  const [ciclo, setCiclo] = useState(0);
  const [fase, setFase] = useState<"in" | "hold" | "out">("in");
  const [tick, setTick] = useState<number>(RESPIRO.in);
  const [humor, setHumor] = useState<string | null>(null);
  /* Quantos minutos ela DE FATO ficou. Igual a `minutos` quando a sessão vai
     até o fim, menor quando ela encerra antes — a tela de fim não pode dizer
     "10 minutos só seus" para quem ficou quatro. */
  const [minutosFeitos, setMinutosFeitos] = useState(0);
  const [reward, setReward] = useState<number | null>(null);
  const grantedRef = useRef(false);
  const audioRef = useRef<Soundscape | null>(null);

  const med = MEDITACOES[temaIdx];
  const totalCiclos = Math.round((minutos * 60) / CICLO_SEGS);
  // Relido a cada troca de etapa de propósito: quando a sessão termina ela
  // acabou de gravar o dia de hoje, e a tela de fim precisa mostrar a sequência
  // JÁ contando com a sessão que a paciente terminou agora.
  const [log, setLog] = useState<MedLog>(MED_LOG_VAZIO);
  useEffect(() => {
    if (open) setLog(lsGet<MedLog>(MED_LOG_KEY, MED_LOG_VAZIO));
  }, [open, etapa]);
  const seq = sequenciaDeDias(log.dias ?? []);

  /* Não há mais o que preparar: a voz desta tela é arquivo nosso, então o
     botão aparece sempre. Antes ele ficava escondido em quem não tinha voz
     pt-BR instalada no aparelho — o que, no Android, é bastante gente. */

  useEffect(
    () => () => {
      audioRef.current?.stop();
      pararVoz();
    },
    [],
  );

  /** Frase da vez: as do tema abrem a sessão; depois, silêncio com rechamadas. */
  const frase = useMemo(() => {
    if (ciclo < med.lines.length) return med.lines[ciclo];
    const desde = ciclo - med.lines.length;
    if (desde > 0 && desde % 5 === 0) return RECHAMADAS[(desde / 5 - 1) % RECHAMADAS.length];
    return null;
  }, [ciclo, med]);

  // Relógio da respiração: cada fase agenda a próxima. O ciclo fecha na
  // expiração — inspirar é o começo natural, expirar é o fim natural.
  useEffect(() => {
    if (etapa !== "sessao") return;
    const dur = RESPIRO[fase];
    setTick(dur);
    const iv = setInterval(() => setTick((t) => Math.max(1, t - 1)), 1000);
    const t = setTimeout(() => {
      if (fase === "in") setFase("hold");
      else if (fase === "hold") setFase("out");
      else if (ciclo + 1 >= totalCiclos) {
        setEtapa("reflexo");
        registrarMeditacao(minutos, null);
        finish();
      } else {
        setCiclo((c) => c + 1);
        setFase("in");
      }
    }, dur * 1000);
    /* `RESPIRO` guarda SEGUNDOS, e `vibratePhase` quer milissegundos. O outro
       ponto de chamada (BreathingBlock) já usa ms, então a mesma variável `dur`
       significa coisas diferentes nos dois — passar cru aqui daria um padrão de
       4 ms, imperceptível, e o defeito pareceria "vibração não funciona". */
    vibratePhase(fase, dur * 1000);
    return () => {
      clearInterval(iv);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, fase, ciclo]);

  /**
   * Quem COMEÇA a faixa guiada é o clique em `begin()`, por causa do bloqueio
   * de autoplay. Aqui só cuidamos de calá-la: ao sair da sessão, e quando ela
   * desliga a voz no meio.
   *
   * A faixa é contínua, e não uma frase por ciclo. A voz gravada guia, respira
   * junto, e o silêncio faz parte — como em qualquer meditação de verdade.
   * Frase-por-frase produzia voz picotada com silêncio seco entre elas.
   */
  useEffect(() => {
    if (etapa !== "sessao" || !voz) pararVoz("guia");
  }, [etapa, voz]);

  /**
   * As três palavras da respiração, na virada de cada fase.
   *
   * Só entram DEPOIS que a guia terminou. Durante a faixa longa elas seriam
   * uma interrupção a cada quatro segundos — e a guia já está dizendo o que
   * fazer. Depois dela, são a única coisa que orienta quem está de olhos
   * fechados, que é o estado em que a tela pede que ela fique.
   */
  /* Tela acesa durante a meditação. É a atividade mais longa do app — até dez
     minutos — e a própria tela pede "com a voz você pode fechar os olhos".
     Sem isto, o aparelho bloqueia em uns trinta segundos, o ciclo é suspenso e
     a sessão morre exatamente por a paciente ter feito o que pedimos. */
  useEffect(() => {
    if (etapa !== "sessao") return;
    return manterTelaAcesa();
  }, [etapa]);

  useEffect(() => {
    if (etapa !== "sessao" || !voz || !guiaTerminou()) return;
    const palavra =
      fase === "in" ? RESPIRACAO.in : fase === "hold" ? RESPIRACAO.hold : RESPIRACAO.out;
    tocarVoz(palavra, { canal: "pulso", volume: 0.85 });
  }, [etapa, fase, voz]);

  /**
   * As rechamadas, a cada cinco ciclos, depois que a guia acabou.
   *
   * `frase` continua sendo a fonte da verdade do que está escrito na tela; aqui
   * só se procura o áudio correspondente àquele texto. Se um dia alguém
   * acrescentar uma rechamada escrita sem gravar a faixa, esta busca devolve
   * nada e a tela segue muda — nunca com a frase errada na boca.
   */
  useEffect(() => {
    if (etapa !== "sessao" || !voz || !frase || !guiaTerminou()) return;
    const i = RECHAMADAS.indexOf(frase);
    if (i < 0 || !RECHAMADAS_AUDIO[i]) return;
    tocarVoz(RECHAMADAS_AUDIO[i], { canal: "pulso" });
  }, [etapa, frase, voz]);

  /** O fim ganha voz. Antes a sessão simplesmente parava. */
  useEffect(() => {
    if (etapa !== "reflexo" || !voz) return;
    pararVoz("guia");
    tocarVoz(VOZ_FECHAMENTO, { canal: "pulso" });
  }, [etapa, voz]);

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

  function begin() {
    setCiclo(0);
    setMinutosFeitos(minutos);
    setFase("in");
    setHumor(null);
    setReward(null);
    grantedRef.current = false;
    audioRef.current?.stop();
    audioRef.current = createSoundscape(som);
    audioRef.current.start();
    /**
     * A faixa guiada começa AQUI, dentro do clique — não num efeito.
     *
     * O navegador só deixa tocar áudio a partir de um gesto do usuário, e um
     * `useEffect` roda depois que o React pintou: para o Safari e o Chrome do
     * celular isso já não é mais o gesto, e o `play()` volta rejeitado. O som
     * ambiente ao lado sempre soube disso — nasce neste mesmo clique. A voz
     * precisava do mesmo tratamento, senão a paciente abriria a meditação e
     * ouviria apenas o ambiente, sem nunca entender por quê.
     */
    if (voz) {
      const faixa = faixaDoTema(med.theme);
      if (faixa) tocarVoz(faixa, { canal: "guia" });
    }
    setEtapa("sessao");
  }

  function close() {
    audioRef.current?.stop();
    audioRef.current = null;
    pararVoz();
    if (aoSair) return aoSair();
    setOpen(false);
    setEtapa("escolha");
  }

  function trocarSom(k: SoundscapeKey) {
    setSom(k);
    if (etapa === "sessao") {
      audioRef.current?.stop();
      audioRef.current = createSoundscape(k);
      audioRef.current.start();
    }
  }

  function alternarVoz() {
    setVoz((v) => {
      if (v) pararVoz();
      return !v;
    });
  }

  const faseLabel = fase === "in" ? "Inspire" : fase === "hold" ? "Segure" : "Solte";
  // O círculo cresce na inspiração e volta na expiração; na pausa ele fica
  // parado, cheio. A transição dura exatamente a fase, então o desenho e o
  // pulmão andam juntos.
  const escala = fase === "out" ? 1 : 1.34;

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
      </div>

      {open && (
        <div
          className="dc-quiz-in fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-violet-100 via-fuchsia-50 to-white"
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
            {etapa === "sessao" ? (
              <div className="mx-3 h-1.5 flex-1 overflow-hidden rounded-full bg-violet-200">
                <div
                  className="h-full rounded-full bg-violet-500"
                  style={{
                    width: `${((ciclo + 1) / totalCiclos) * 100}%`,
                    transition: `width ${CICLO_SEGS}s linear`,
                  }}
                />
              </div>
            ) : (
              <span className="flex-1" />
            )}
            {etapa === "sessao" && (
              <div className="flex items-center gap-3">
                {
                  <button
                    onClick={alternarVoz}
                    aria-label={voz ? "Desligar voz" : "Ligar voz"}
                    className={`press text-lg leading-none ${voz ? "" : "opacity-40 grayscale"}`}
                  >
                    🗣️
                  </button>
                }
                <button
                  onClick={() => trocarSom(som === "silencio" ? "pad" : "silencio")}
                  aria-label={som === "silencio" ? "Ligar som" : "Desligar som"}
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
                {MEDITACOES.map((m, i) => (
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
                          temaIdx === i ? "bg-white/25 text-white" : "bg-violet-100 text-violet-700"
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
                    className={`press rounded-full px-3.5 py-2 text-xs font-bold transition-colors ${
                      som === s.key
                        ? "bg-violet-500 text-white"
                        : "border border-violet-200 bg-white/70 text-violet-700"
                    }`}
                  >
                    {s.emoji} {s.label}
                  </button>
                ))}
              </div>

              {
                <button
                  onClick={alternarVoz}
                  className={`press mt-4 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${
                    voz ? "bg-violet-500 text-white" : "border border-violet-200 bg-white/70"
                  }`}
                >
                  <span className="text-xl leading-none">🗣️</span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm font-extrabold ${voz ? "" : "text-violet-900"}`}
                    >
                      Voz guiada {voz ? "ligada" : "desligada"}
                    </span>
                    <span
                      className={`block text-[11px] ${voz ? "text-white/75" : "text-violet-700/70"}`}
                    >
                      Com a voz você pode fechar os olhos.
                    </span>
                  </span>
                </button>
              }
            </div>
          )}

          {/* O botão fica FIXO no rodapé: a lista de necessidades tem sete
              itens e empurrava o "Começar" para fora da tela — quem escolhia o
              primeiro tema tinha que rolar até o fim pra poder começar. */}
          {etapa === "escolha" && (
            <div
              className="border-t border-violet-200/60 bg-white/70 px-6 pb-5 pt-3 backdrop-blur"
              style={{ paddingBottom: "calc(1.25rem + var(--safe-bottom, 0px))" }}
            >
              <button
                onClick={begin}
                className="press w-full rounded-full bg-violet-500 py-3.5 text-sm font-extrabold text-white"
              >
                Começar · {minutos} min
              </button>
            </div>
          )}

          {/* ── 2. Sessão: o círculo que respira ──────────────────────────── */}
          {etapa === "sessao" && (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              <div className="relative flex h-56 w-56 items-center justify-center">
                <div
                  className="dc-guiado absolute h-40 w-40 rounded-full bg-fuchsia-200/40 blur-2xl"
                  style={
                    {
                      transform: `scale(${escala})`,
                      "--guiado-ms": `${RESPIRO[fase] * 1000}ms`,
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
                      "--guiado-ms": `${RESPIRO[fase] * 1000}ms`,
                      "--guiado-escala": escala,
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
                    } as React.CSSProperties
                  }
                  aria-hidden
                />
                <div className="relative flex flex-col items-center">
                  <span className="text-[13px] font-bold uppercase tracking-[0.18em] text-violet-500">
                    {faseLabel}
                  </span>
                  <span className="tabular-nums text-5xl font-extrabold text-violet-800">
                    {tick}
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

              <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-violet-400">
                {med.theme} · {Math.max(0, Math.ceil(((totalCiclos - ciclo) * CICLO_SEGS) / 60))}{" "}
                min restantes
              </p>

              {/* Encerrar antes da hora — a saída que a versão de sete frases
                  tinha no "Continuar →" e que o ritmo da respiração tirou:
                  lá ela podia adiantar as frases e chegar ao fim; aqui o
                  relógio manda.

                  Só aparece depois de cinco respirações completas — um minuto
                  redondo, porque o ciclo é de 12s — e de propósito:
                  antes disso não houve sessão para encerrar, e um botão de
                  encerrar visível desde o primeiro segundo convida a sair de
                  uma tela que ainda nem começou. Passado o minuto, a sessão
                  conta — quem parou aos 4 de 10 minutos meditou, e o app não
                  tem por que fingir que não. */}
              {ciclo >= 5 && (
                <button
                  onClick={() => {
                    const feitos = Math.max(1, Math.round(((ciclo + 1) * CICLO_SEGS) / 60));
                    setMinutosFeitos(feitos);
                    setEtapa("reflexo");
                    registrarMeditacao(feitos, null);
                    finish();
                  }}
                  className="press mt-8 rounded-full border border-violet-200 bg-white/70 px-6 py-2 text-xs font-bold text-violet-500 backdrop-blur"
                >
                  Encerrar por aqui
                </button>
              )}
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
                {COMO_ESTOU.map((c) => (
                  <button
                    key={c.label}
                    onClick={() => {
                      setHumor(c.label);
                      registrarMeditacao(0, c.label);
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
  const carta = useMemo(() => BONDING_LETTERS[day % BONDING_LETTERS.length], [day]);
  const [open, setOpen] = useState(!!aoSair);
  const [phase, setPhase] = useState<"intro" | "active" | "done">("intro");
  const [idx, setIdx] = useState(0);
  const [reward, setReward] = useState<number | null>(null);
  const [sound, setSound] = useState(true);
  const grantedRef = useRef(false);
  const audioRef = useRef<ReturnType<typeof createBreathAudio> | null>(null);

  useEffect(() => () => audioRef.current?.stop(), []);

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
                Carta de hoje
              </p>
              <h3 className="mt-1 font-serif text-3xl font-extrabold text-rose-900">
                {carta.title} {carta.emoji}
              </h3>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-rose-800/80">
                Encontre um lugar calmo, mão na barriga… e leia <strong>em voz alta</strong>,
                devagar. A sua voz é o som preferido do bebê. 💛
              </p>
              <button
                onClick={begin}
                className="press mt-8 rounded-full bg-rose-500 px-10 py-3 text-sm font-extrabold text-white shadow-[0_10px_24px_-8px_rgba(244,63,94,0.6)]"
              >
                Começar a ler 💗
              </button>
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

/* ══════════════════ Gratidão do dia (vai pro diário) ══════════════════ */

function GratitudeBlock({
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
  const [open, setOpen] = useState(!!aoSair);
  const [phase, setPhase] = useState<"write" | "done">("write");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [reward, setReward] = useState<number | null>(null);

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
        .insert({ user_id: u.user.id, content: `Gratidão: ${text.trim()}`, mood: "🙏" });

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

      /* Recompensa (uma por dia, como as outras atividades de bem-estar).
         A meia-estrela vem antes do servidor — ela escreveu, e isso já
         aconteceu, então rede caída não pode apagar o progresso dela.
         Mas NÃO vem antes do Modo Cuidado: as outras quatro atividades saem
         no começo do `finish()` quando ele está ligado, e só esta acendia a
         estrela no luto. Em Modo Cuidado não há jornada, não há estrela e não
         há placar — o diário continua funcionando, que é o que importa. */
      if (careMode) return;
      onEarn();
      if (canEarn) {
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
    if (aoSair) return aoSair();
    setOpen(false);
    setPhase("write");
    setText("");
  }

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
          {phase === "write" ? (
            <div className="flex flex-1 flex-col items-center px-8 pt-6 text-center">
              <span className="text-6xl">✨</span>
              <h3 className="mt-4 text-2xl font-extrabold text-amber-900">O que foi bom hoje?</h3>
              <p className="mt-2 max-w-xs text-sm text-amber-800/80">
                Pode ser bem pequeno. Isso vai pro seu diário. 💛
              </p>
              {/* Fichinhas de 1 toque — destravam a escrita nos dias cansados */}
              <div className="mt-4 flex max-w-sm flex-wrap justify-center gap-1.5">
                {[
                  "Meu bebê mexeu 🦶",
                  "Um carinho que recebi 💕",
                  "Uma boa notícia 📩",
                  "Comi algo gostoso 🍓",
                  "Descansei um pouquinho 😴",
                ].map((chip) => (
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
                placeholder="Hoje eu fiquei grata por…"
                className="mt-3 w-full max-w-sm resize-none rounded-2xl border border-amber-200 bg-white p-3 text-sm outline-none focus:border-amber-400"
              />
              <button
                onClick={save}
                disabled={saving || text.trim().length < 2}
                className="press mt-4 w-full max-w-sm rounded-full bg-amber-500 py-3 text-sm font-extrabold text-white disabled:opacity-40"
              >
                Guardar
              </button>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              {!careMode && <ConfettiBurst />}
              <span className="dc-result-in text-6xl">✨</span>
              <h3 className="mt-3 text-2xl font-extrabold text-amber-900">Guardado 💛</h3>
              <p className="mt-1 text-sm text-amber-800/80">Anotei no seu diário.</p>
              {!careMode && reward != null && reward > 0 && (
                <div className="mt-4 rounded-full bg-emerald-100 px-5 py-2 text-base font-extrabold text-emerald-700">
                  +{reward} 🌱 Sementinhas!
                </div>
              )}
              <button
                onClick={close}
                className="press mt-8 w-full max-w-xs rounded-full bg-amber-500 py-3 text-sm font-extrabold text-white"
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

/** Motor dos "jogos do dia": os 5 de bem-estar + a AULA (que virou jogo). */
const WELLNESS_TYPES = [
  { key: "breathing", emoji: "🌬️", label: "Respirar", Comp: BreathingBlock },
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
    title: "Aula de hoje",
    a: "#818cf8",
    b: "#3b82f6",
    desc: "A lição da professora + o quiz da semana.",
  },
  breathing: {
    inkDark: "#8cc4ff",
    ink: "#1c5fd0",
    tile: "#d6e8fb",
    tileB: "#bcd9f7",
    title: "Respirar",
    a: "#38bdf8",
    b: "#06b6d4",
    desc: "Respiração guiada com som e vibração pra acalmar.",
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
    case "breathing": // pulmões
      return (
        <svg {...comum}>
          <path d="M11.2 3.4h1.6v8.2h-1.6z" />
          <path d="M10.6 10.2c0-2-1.5-3.4-3.3-3.4-2 0-3.4 1.7-3.8 3.7-.4 2-.6 3.9-.6 5.6 0 1.6 1.3 2.9 2.9 2.9h1.4c2 0 3.4-1.7 3.4-3.6v-5.2z" />
          <path d="M13.4 10.2c0-2 1.5-3.4 3.3-3.4 2 0 3.4 1.7 3.8 3.7.4 2 .6 3.9.6 5.6 0 1.6-1.3 2.9-2.9 2.9h-1.4c-2 0-3.4-1.7-3.4-3.6v-5.2z" />
        </svg>
      );
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
  homeCity,
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
  /** Meias estrelas do dia (0–6): aula + 5 jogos de bem-estar. */
  halves: number;
  lesson: WellnessLesson;
  /** Nome do bebê — a tela cumprimenta por ele. */
  babyName?: string | null;
  /** Cidade do cadastro — o degrau entre o GPS e o IP, igual ao da home. */
  homeCity?: { nome: string; lat: number; lon: number } | null;
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
    setTimeout(refresh, 500);
  }

  const activity = openKey ? WELLNESS_TYPES.find((a) => a.key === openKey) : null;
  const Chosen = activity?.Comp;
  const openMeta = openKey ? WELLNESS_META[openKey] : null;
  const lessonEmoji = lesson.emoji;

  /* O cartão da aula fala do conteúdo de HOJE. Título e duração saem do
     próprio quiz: um exercício de 5 perguntas não leva o mesmo tempo que um
     de 3, e escrever "8 min" fixo seria número de enfeite. */
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
  const minutosAula =
    lesson.kind === "quiz" ? Math.max(3, Math.round(lesson.quiz.questions.length * 1.6)) : 2;
  /* 100% quando a aula está feita; senão o quanto do DIA já andou — é o que a
     barra do desenho comunica, e inventar uma porcentagem por dentro do quiz
     exigiria rastrear pergunta a pergunta fora dele. */
  const pctAula = aulaFeita ? 100 : Math.round((halves / 6) * 100);

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
              <Bolha
                tamanho={298}
                humor={humorDaJornada({
                  comemorando: halves >= 6,
                  diaFeito: halves >= 6,
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
                  <p className="text-[15px] leading-[1.5]" style={{ color: tinta }}>
                    {recadoDoDia}
                  </p>
                </div>
              </div>
            </div>

            {/* ─── O CARTÃO DA AULA SAIU DAQUI (ago/2026) ──────────────
                Era o bloco em destaque entre o balão e a lista: selo
                "Recomendada", título da aula da semana, duração, o bebê da
                semana e o botão "Continuar aula". Saiu porque a arte de
                referência não o traz, e o pedido foi tela 100% igual a ela.

                ⚠️ ELE ERA A ÚNICA PORTA DA AULA. `setOpenKey("aula")` não é
                chamado de nenhum outro lugar do app, então enquanto não
                existir outra entrada:
                  · a aula da semana e o quiz ficam inalcançáveis;
                  · `halves` nunca chega a 6 (a aula vale 1 dos 6), então
                    "Dia completo" e as 3 estrelas do dia ficam fora de
                    alcance mesmo fazendo tudo o que a tela mostra.

                O ramo `openKey === "aula"` continua inteiro e funcionando
                logo acima — falta só quem o acione. Três saídas possíveis: um
                sexto cartão na lista, o cartão de volta abaixo das estrelas,
                ou um botão na trilha. É decisão do dono. */}

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
              {WELLNESS_TYPES.map((a) => {
                const meta = WELLNESS_META[a.key];
                const isDone = !careMode && done.has(a.key);
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
                        {meta.desc}
                      </span>
                    </span>
                    {!careMode && (
                      <span className="flex shrink-0 items-center gap-1.5">
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

                ─── SEIS ESTRELAS, E POR QUE O TEXTO NÃO DIZ "ESTRELAS" ─────
                O desenho traz seis estrelas e a legenda "2/6 estrelas
                conquistadas". Nesta base os dois números são coisas
                diferentes: `halves` conta os SEIS momentos do dia (5 de
                bem-estar + a aula), e a recompensa por fechar o dia são TRÊS
                estrelas — a moeda que ela gasta na Loja. Escrever "6 estrelas"
                prometeria o dobro do que o app paga, e ela descobriria isso no
                fim do dia.
                Então: seis estrelas no desenho, uma por momento (que é o que a
                referência mostra), e a legenda fala de MOMENTOS. */}
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
                  aria-label={`${halves} de 6 momentos concluídos`}
                >
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <EstrelaDoDia key={i} acesa={i < halves} tamanho={38} />
                  ))}
                </div>

                <p className="mt-3 text-center text-[13px]" style={{ color: tintaSec }}>
                  <span className="text-[16px] font-bold tabular-nums" style={{ color: tinta }}>
                    {halves}/6
                  </span>{" "}
                  momentos concluídos
                </p>
                <p className="mt-1 text-center text-[12px]" style={{ color: tintaSec }}>
                  {halves >= 6 ? (
                    "Dia completo! As 3 estrelas são suas 🌟"
                  ) : halves > 0 ? (
                    <>
                      Continue assim! Feche os 6 e ganhe{" "}
                      <span className="font-semibold" style={{ color: "#7c3aed" }}>
                        3 estrelas
                      </span>{" "}
                      💗
                    </>
                  ) : (
                    <>
                      Comece por onde quiser — feche os 6 e ganhe{" "}
                      <span className="font-semibold" style={{ color: "#7c3aed" }}>
                        3 estrelas
                      </span>{" "}
                      ✨
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
                  <Bolha
                    tamanho={84}
                    humor={score > 0 ? "comemorando" : "feliz"}
                    entrada={score > 0 ? "pulo" : undefined}
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

  const streak = useMemo(() => {
    if (posDone.length === 0) return 0;
    const set = new Set(posDone);
    let s = 0;
    let d = set.has(todayD) ? todayD : todayD - 1;
    while (set.has(d)) {
      s++;
      d--;
    }
    return s;
  }, [posDone, todayD]);

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
              <span className={`text-xl ${streak > 0 ? "" : "grayscale opacity-50"}`}>🔥</span>
              <span className="text-lg font-extrabold text-amber-500">{streak}</span>
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
