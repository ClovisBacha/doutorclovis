import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { babyForWeek, consultaForWeek } from "@/lib/gestacao";
import { COURSE_MODULES, type CourseModule } from "@/lib/course-modules";
import { getCourseProgress, markModuleComplete } from "@/lib/escola.functions";
import {
  claimDailyAndGetWallet,
  grantLessonReward,
  grantDailyQuizReward,
  grantWellnessReward,
} from "@/lib/sementinhas.functions";
import { getCantinho } from "@/lib/cantinho.functions";
import { CANTINHO_BY_ID, fundoBgFor } from "@/lib/cantinho";
import { createBreathAudio, vibratePhase } from "@/lib/breath-audio";

/** Hash estável de string → número (posiciona decorações de forma determinística). */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
import {
  quizForDay,
  quizEmojiForDay,
  isAnswerCorrect,
  isMultiQuestion,
  type DailyQuiz,
} from "@/lib/daily-quizzes";
import { DOCTOR } from "@/lib/doctor.config";

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

/** Figurinha (emoji da fruta) de cada semana gestacional — colecionável no álbum. */
const FRUIT_EMOJI: Record<number, string> = {
  1: "✨",
  2: "✨",
  3: "✨",
  4: "🌾",
  5: "🌱",
  6: "🫘",
  7: "🫐",
  8: "🍓",
  9: "🍇",
  10: "🍓",
  11: "🍐",
  12: "🍋",
  13: "🫛",
  14: "🍋",
  15: "🍎",
  16: "🥑",
  17: "🧅",
  18: "🫑",
  19: "🍅",
  20: "🍌",
  21: "🥕",
  22: "🌽",
  23: "🥭",
  24: "🌽",
  25: "🥦",
  26: "🥬",
  27: "🍆",
  28: "🎃",
  29: "🥬",
  30: "🥒",
  31: "🥥",
  32: "🥬",
  33: "🍍",
  34: "🍈",
  35: "🍈",
  36: "🍈",
  37: "🥬",
  38: "🧅",
  39: "🍉",
  40: "🎃",
  41: "🍈",
  42: "🎃",
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

/** Desafio determinístico do dia gestacional D (mesmo dia = mesmo desafio). */
function challengeForDay(D: number): Challenge {
  const week = Math.floor(D / 7);
  const pool =
    week >= 41
      ? CHALLENGES_POSDATA
      : week <= 13
        ? CHALLENGES_T1
        : week <= 27
          ? CHALLENGES_T2
          : CHALLENGES_T3;
  return pool[D % pool.length];
}

/** Desafio determinístico do dia pós-parto (D em pseudo-dias, semana 1–12). */
function challengeForPosDay(D: number): Challenge {
  const week = Math.floor(D / 7);
  const pool = week <= 4 ? CHALLENGES_POS_1 : week <= 8 ? CHALLENGES_POS_2 : CHALLENGES_POS_3;
  return pool[D % pool.length];
}

/* ══════════════════════ ORIENTAÇÕES MÉDICAS ══════════════════════ */

const POSDATA_GUIDANCE =
  "Pós-data: consultas 2x por semana com cardiotocografia e avaliação do líquido amniótico. " +
  "Converse com o seu médico sobre o planejamento da indução. Conte os movimentos do bebê " +
  "todos os dias — se diminuírem, vá direto à maternidade.";

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

function trimMeta(week: number) {
  if (week <= 13)
    return { main: "#ec4899", lip: "#be185d", banner: "bg-pink-500", softText: "text-pink-400" };
  if (week <= 27)
    return { main: "#f59e0b", lip: "#b45309", banner: "bg-amber-500", softText: "text-amber-500" };
  if (week <= 40)
    return {
      main: "#8b5cf6",
      lip: "#6d28d9",
      banner: "bg-violet-500",
      softText: "text-violet-400",
    };
  // Pós-data: tom âmbar quente, sem alarme
  return { main: "#f59e0b", lip: "#b45309", banner: "bg-amber-500", softText: "text-amber-500" };
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
const ALBUM_ROW = 116;
const WEEK_HEADER = 44;

type PathNode =
  | { kind: "week-header"; week: number; y: number }
  | { kind: "day"; D: number; week: number; y: number; x: number; row: number }
  | { kind: "album-week"; week: number; y: number; x: number; row: number };

/** Monta os nós da fase: semanas pré-jornada viram nó-álbum; as demais, 7 dias. */
function buildPhaseNodes(
  phase: Phase,
  journeyStartD: number,
): { nodes: PathNode[]; height: number } {
  const nodes: PathNode[] = [];
  let y = 30;
  let row = 0;
  const xOf = (r: number) => 50 + 27 * Math.sin((r * Math.PI) / 4);

  for (let w = phase.from; w <= phase.to; w++) {
    const weekStartD = w * 7;
    const weekEndD = w * 7 + 6;
    if (weekEndD < journeyStartD) {
      nodes.push({ kind: "album-week", week: w, y: y + ALBUM_ROW / 2, x: xOf(row), row });
      y += ALBUM_ROW;
      row++;
    } else {
      nodes.push({ kind: "week-header", week: w, y });
      y += WEEK_HEADER;
      for (let D = Math.max(weekStartD, journeyStartD); D <= weekEndD; D++) {
        nodes.push({ kind: "day", D, week: w, y: y + DAY_ROW / 2, x: xOf(row), row });
        y += DAY_ROW;
        row++;
      }
    }
  }
  return { nodes, height: y + 40 };
}

/* ── Caminho contínuo estilo Duolingo: todas as fases numa página só ── */

const IDAY_ROW = 104;
const IALBUM_ROW = 112;
const IWEEK_HEADER = 72; // folga para o balão "Desafio de hoje" não cobrir o pill da semana
const IBANNER_ROW = 120;
const ILESSON_ROW = 116;

/** Semana → lição da Escola do Bebê (o aprendizado agora vive DENTRO do caminho). */
const LESSON_BY_WEEK = new Map<number, CourseModule>(COURSE_MODULES.map((m) => [m.week, m]));

type JourneyNode =
  | PathNode
  | { kind: "phase-banner"; phase: Phase; y: number }
  | { kind: "mascot"; emoji: string; y: number; x: number }
  | { kind: "lesson"; week: number; y: number; x: number; row: number };

const MASCOTS = ["🧸", "🦢", "🌷", "🍼", "🐘", "🌈", "🐥", "🧦"];

/** Uma página só: banners de seção entre as fases, dias grandes, mascotes ao lado. */
function buildFullJourney(
  phases: Phase[],
  journeyStartD: number,
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
      emoji: MASCOTS[mascotIdx++ % MASCOTS.length],
      y: rowY + rowH / 2,
      x: x < 50 ? Math.min(x + 44, 82) : Math.max(x - 44, 18),
    });
  };

  for (const p of phases) {
    nodes.push({ kind: "phase-banner", phase: p, y });
    y += IBANNER_ROW;
    for (let w = p.from; w <= p.to; w++) {
      const weekStartD = w * 7;
      const weekEndD = w * 7 + 6;
      if (weekEndD < journeyStartD) {
        const x = xOf(row);
        nodes.push({ kind: "album-week", week: w, y: y + IALBUM_ROW / 2, x, row });
        maybeMascot(x, y, IALBUM_ROW);
        y += IALBUM_ROW;
        row++;
      } else {
        nodes.push({ kind: "week-header", week: w, y });
        y += IWEEK_HEADER;
        for (let D = Math.max(weekStartD, journeyStartD); D <= weekEndD; D++) {
          const x = xOf(row);
          nodes.push({ kind: "day", D, week: w, y: y + IDAY_ROW / 2, x, row });
          maybeMascot(x, y, IDAY_ROW);
          y += IDAY_ROW;
          row++;
        }
      }
      // (Opção A) As lições do curso saíram do Caminho — o ensino é só o
      // "desafio do dia" (aula por semana). Sem nós de LIÇÃO na trilha.
    }
  }
  return { nodes, height: y + 40 };
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

function TaskRing({ done, color }: { done: number; color: string }) {
  // 3 segmentos de 104° com folgas de 16°, começando no topo
  const segs = [0, 1, 2].map((i) => {
    const start = i * 120 + 8;
    return arcPath(50, 50, 46, start, start + 104);
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
}: GestacaoPathProps) {
  const hasGest = !!gest;
  // Dia gestacional de hoje (0-based desde a DUM), até a semana 42 (D=300)
  const rawD = hasGest ? gest.totalDays : 0;
  const todayD = hasGest ? Math.max(7, Math.min(300, rawD)) : 0;
  const currentWeek = hasGest ? Math.max(1, Math.min(42, Math.floor(todayD / 7))) : 0;
  const isPostDate = hasGest && rawD > 286; // passou da semana 40
  const isBeyond42 = hasGest && rawD > 300; // passou da semana 42

  const [sheet, setSheet] = useState<
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
  const [fundoBg, setFundoBg] = useState<string | null>(null);
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
        if (!token) return;
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
  const { nodes, height } = useMemo(
    () => buildFullJourney(phases, journeyStartD),
    [phases, journeyStartD],
  );

  const pathRef = useRef<HTMLDivElement>(null);

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
    if (sheet?.kind === "day" && sheet.D === D) setDayTasks(state);
    if (D === todayD) setTodayTasks(state);
    const allDone = state.humor && state.desafio && state.leitura;
    if (allDone && !doneDays.includes(D)) {
      const next = [...doneDays, D];
      setDoneDays(next);
      lsSet(LS.doneDays, next);
      setRevealing(true);
      setTimeout(() => setRevealing(false), 1800);
      collectSticker(Math.floor(D / 7), false);
      toast.success(`🎉 Dia ${D - journeyStartD + 1} da jornada completo!`);
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
    toast.success(`${FRUIT_EMOJI[week] ?? "🍼"} Figurinha coletada: ${baby.fruit}!`);
  }

  // Intro imersiva (Duolingo) antes do sheet da aula
  const [intro, setIntro] = useState<number | null>(null);

  function reallyOpenDay(D: number) {
    setDayTasks(dayTaskState(D));
    setSheet({ kind: "day", D });
    if (D === todayD) {
      setTimeout(() => markDayTask(D, "leitura", true), 600);
    }
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
    toast.success(`📚 Lição da semana ${week} completa!`);
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
    const text = `🤰 Semana ${week}: ${name} está do tamanho de ${baby.fruit.toLowerCase()}! ${FRUIT_EMOJI[week] ?? ""}\n📏 ${baby.size} · ⚖️ ${baby.weight}\n\nAcompanhando cada semana no app Obstétrica 💜`;
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
              <span className={`text-xl ${streak > 0 ? "" : "grayscale opacity-50"}`}>🔥</span>
              <span className="text-lg font-extrabold text-amber-500">{streak}</span>
              <span className="text-xs font-medium text-muted-foreground">
                {streak === 1 ? "dia" : "dias"}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
          </>
        )}
        <div className="flex items-center gap-1.5" title="Dia da sua jornada">
          <span className="text-xl">📅</span>
          <span className="text-lg font-extrabold text-sky-500">{journeyDayNum}º</span>
          <span className="text-xs font-medium text-muted-foreground">dia</span>
        </div>
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-1.5" title="Figurinhas coletadas">
          <span className="text-xl">🏆</span>
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

      {/* Botão flutuante da lojinha (Cantinho) — silenciado no Modo Cuidado */}
      {!careMode && onOpenShop && (
        <>
          <style>{`
            @keyframes dc-shop-glow {
              0%, 100% { box-shadow: 0 8px 22px rgba(16,185,129,0.42); }
              50% { box-shadow: 0 10px 34px rgba(16,185,129,0.78), 0 0 0 5px rgba(163,230,53,0.30); }
            }
            @media (prefers-reduced-motion: reduce) { .dc-shop-fab { animation: none !important; } }
          `}</style>
          <button
            onClick={onOpenShop}
            aria-label="Abrir o Cantinho"
            className="dc-shop-fab press fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full bg-gradient-to-br from-emerald-400 via-lime-400 to-emerald-500 px-4 py-3 text-white ring-2 ring-white/70 md:bottom-8"
            style={{ animation: "dc-shop-glow 2.2s ease-in-out infinite" }}
          >
            <span className="text-xl leading-none">🛍️</span>
            <span className="text-sm font-extrabold leading-none">Cantinho</span>
            {saldo != null && (
              <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold leading-none">
                🌱 {saldo}
              </span>
            )}
          </button>
        </>
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
      <div ref={pathRef} className="relative -mx-5 md:mx-0" style={{ height: `${height}px` }}>
        {/* Cenário (papel de parede) equipado — atrás de tudo */}
        {fundoBg && (
          <div
            className="pointer-events-none absolute inset-0 select-none rounded-2xl opacity-55"
            style={{ background: fundoBg }}
            aria-hidden
          />
        )}
        {/* Itens do Cantinho decoram as margens da trilha (não cobrem as lições) */}
        {decor.map((id, k) => {
          const item = CANTINHO_BY_ID[id];
          if (!item) return null;
          const h = hashStr(id);
          const side = k % 2;
          const left = side === 0 ? 3 + (h % 9) : 88 + (h % 9);
          const top = 6 + ((h >> 4) % 88);
          return (
            <span
              key={id}
              className="dc-float pointer-events-none absolute select-none text-3xl opacity-90 drop-shadow-sm"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                transform: "translate(-50%,-50%)",
                animationDelay: `${(h % 20) * 0.16}s`,
              }}
              aria-hidden
              title={item.name}
            >
              {item.emoji}
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
                    {locked ? "🔒" : p.emoji}
                  </div>
                </div>
              </div>
            );
          }

          if (node.kind === "mascot") {
            return (
              <div
                key={`m${node.y}`}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 select-none"
                style={{ left: `${node.x}%`, top: `${node.y}px` }}
                aria-hidden
              >
                <div className="float-slow text-7xl drop-shadow-[0_8px_10px_rgba(0,0,0,0.12)]">
                  {node.emoji}
                </div>
                <div className="mx-auto mt-1.5 h-2.5 w-14 rounded-full bg-slate-900/10 blur-[3px]" />
              </div>
            );
          }

          if (node.kind === "week-header") {
            const tm = trimMeta(node.week);
            return (
              <div
                key={`h${node.week}`}
                className="absolute left-1/2 -translate-x-1/2"
                style={{ top: `${node.y + 8}px` }}
              >
                <span
                  className={`rounded-full bg-white/90 px-3.5 py-1 text-[11px] font-extrabold shadow-sm backdrop-blur-sm ${tm.softText}`}
                >
                  Semana {node.week} {FRUIT_EMOJI[node.week] ?? ""}
                  {MILESTONES[node.week] ? ` · ${MILESTONES[node.week].emoji}` : ""}
                </span>
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
                      className="dc-halo pointer-events-none absolute inset-0 rounded-2xl"
                      style={{ boxShadow: "0 0 26px 5px rgba(245,158,11,0.4)" }}
                    />
                  )}
                  <div
                    className="duo3d relative flex h-[68px] w-[68px] items-center justify-center rounded-2xl"
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

          if (node.kind === "album-week") {
            const collected = stickers.includes(node.week);
            const tm = trimMeta(node.week);
            // Desbloqueado é COLORIDO (Duolingo): cinza fica só para o futuro.
            // Não colecionada = moeda mais clara da mesma cor, convidando o toque.
            return (
              <button
                key={`a${node.week}`}
                onClick={() => openAlbum(node.week)}
                className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center focus:outline-none"
                style={{ left: `${node.x}%`, top: `${node.y}px` }}
                aria-label={`Memória da semana ${node.week}`}
              >
                <div
                  className="duo3d flex h-16 w-16 items-center justify-center rounded-full"
                  style={
                    {
                      background: collected
                        ? `linear-gradient(180deg, color-mix(in oklab, ${tm.main} 82%, white) 0%, ${tm.main} 55%)`
                        : `color-mix(in oklab, ${tm.main} 38%, white)`,
                      "--lip": collected ? tm.lip : `color-mix(in oklab, ${tm.lip} 55%, white)`,
                      boxShadow: `0 6px 0 var(--lip)`,
                    } as React.CSSProperties
                  }
                >
                  <span className="relative z-10 text-2xl">{FRUIT_EMOJI[node.week] ?? "🍼"}</span>
                  <span className="dc-coin-shine" aria-hidden />
                </div>
                <span className="mt-1 rounded-full bg-white/85 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400 shadow-sm">
                  memória
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
          const palette = done || isToday ? tm : isPast ? MISSED : LOCKED;
          const dia = isToday ? 84 : 64;
          const dayOfWeek = (D % 7) + 1;
          const tasksDone = isToday
            ? [checkedToday || todayTasks.humor, todayTasks.desafio, todayTasks.leitura].filter(
                Boolean,
              ).length
            : 0;

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
                aria-label={`Dia ${dayOfWeek} da semana ${week}`}
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
                  {/* Anel segmentado: 3 segmentos = as 3 tarefas de hoje */}
                  {isToday && <TaskRing done={done ? 3 : tasksDone} color={tm.main} />}
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
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Folga para a barra de navegação inferior do app */}
      <div className="h-16" />

      {/* Intro imersiva da aula (Duolingo): moeda salta, depois o sheet abre */}
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

      {/* Sheet de DIA */}
      {sheet?.kind === "day" &&
        (() => {
          const D = sheet.D;
          const week = Math.max(1, Math.min(42, Math.floor(D / 7)));
          const baby = babyForWeek(week);
          const ch = challengeForDay(D);
          const quiz = quizForDay(D);
          const quizEmoji = quizEmojiForDay(D);
          const isToday = D === todayD;
          const state = isToday ? dayTasks : dayTaskState(D);
          const done = doneDays.includes(D);
          const tm = trimMeta(week);
          // Progresso explícito das 3 tarefas — evita o "respondi o quiz e o
          // dia não completou" (faltava o check-in de humor).
          const humorOk = isToday ? checkedToday || !!state.humor : !!state.humor;
          const tasksChecked = [humorOk, !!state.desafio, !!state.leitura].filter(Boolean).length;
          const missingHumorHint =
            isToday && !humorOk
              ? "Quase lá! Falta o check-in de humor — feche esta aula e toque em como você está 💛"
              : null;
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
                    style={{ background: tm.main, "--lip": tm.lip } as React.CSSProperties}
                  >
                    {done ? "⭐" : ch.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Semana {week} · dia {(D % 7) + 1}
                      {isToday && (
                        <span className="ml-2 rounded-full bg-pink-100 px-2 py-0.5 text-pink-600">
                          hoje
                        </span>
                      )}
                    </p>
                    <h3 className="mt-0.5 text-xl font-extrabold">
                      {done ? "Desafio completo!" : isToday ? "Desafio de hoje" : "Desafio do dia"}
                    </h3>
                  </div>
                  <button
                    onClick={() => share(week)}
                    className="press shrink-0 rounded-full bg-pink-50 px-3 py-2 text-sm font-bold text-pink-600"
                  >
                    💌
                  </button>
                </div>

                <div className="mb-4 rounded-2xl bg-emerald-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    ✅ Complete as 3 para ganhar o dia · {tasksChecked}/3
                  </p>
                  <div className="mt-2 flex flex-col gap-2">
                    {[
                      { id: "humor", label: "Check-in: como você está?", emoji: "🙂" },
                      quiz
                        ? {
                            id: "desafio",
                            label: "Aula da professora de hoje (abaixo)",
                            emoji: quizEmoji,
                          }
                        : { id: "desafio", label: ch.label, emoji: ch.emoji },
                      { id: "leitura", label: `Ler sobre ${babyLabel} hoje (abaixo)`, emoji: "📖" },
                    ].map((t) => {
                      const checked = t.id === "humor" && isToday ? checkedToday : !!state[t.id];
                      // Com quiz, a tarefa "desafio" completa ao responder o quiz.
                      const canToggle = isToday && t.id === "desafio" && !quiz;
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
                  {!isToday && !done && (
                    <p className="mt-2 text-[11px] text-emerald-700/70">
                      Desafios valem no dia — mas a leitura e as figurinhas ficam para sempre 💜
                    </p>
                  )}
                </div>

                <div className="mb-4 flex items-center gap-3 rounded-2xl bg-pink-50 p-4">
                  <span className="text-4xl">{FRUIT_EMOJI[week] ?? "🍼"}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold">
                      {babyLabel} está do tamanho de {baby.fruit.toLowerCase()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      📏 {baby.size} · ⚖️ {baby.weight}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {baby.desc.replace("seu bebê", babyLabel)}
                    </p>
                  </div>
                </div>

                {/* PONTO 1 · Orientação pós-data mais séria nas semanas 41–42 */}
                <div className="mb-4 rounded-2xl border border-sky-100 bg-sky-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-sky-600">
                    🩺 Orientação médica
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-sky-900">
                    {week >= 41 ? POSDATA_GUIDANCE : consultaForWeek(week)}
                  </p>
                  {week >= 41 && (
                    <a
                      href="/agendamento"
                      className="press mt-3 inline-block rounded-full bg-sky-500 px-4 py-2 text-xs font-bold text-white"
                    >
                      Agendar consulta desta semana
                    </a>
                  )}
                </div>

                {quiz &&
                  (isToday || quizPremium ? (
                    <DailyQuizBlock
                      key={`quiz-${D}`}
                      quiz={quiz}
                      emoji={quizEmoji}
                      week={week}
                      day={D}
                      alreadyDone={!!state.desafio || done}
                      canEarn={isToday}
                      careMode={careMode}
                      missingHint={missingHumorHint}
                      showPremiumAd={isToday && !quizPremium}
                      onEarn={() => markDayTask(D, "desafio", true)}
                    />
                  ) : (
                    <QuizPaywall week={week} />
                  ))}

                {/* Atividade de bem-estar do dia (alterna respiração / movimento) */}
                <WellnessBlock
                  key={`wellness-${D}`}
                  day={D}
                  canEarn={isToday}
                  careMode={careMode}
                  alreadyDone={!!state.bemestar}
                  onEarn={() => markDayTask(D, "bemestar", true)}
                />

                {isToday && (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      🔒 Amanhã: {quizForDay(D + 1) ? "nova aula da professora" : "novo desafio"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {quizForDay(D + 1)
                        ? `${quizEmojiForDay(D + 1)} `
                        : `${challengeForDay(D + 1).emoji} `}
                      Volte amanhã para manter a chama 🔥
                      {streak > 0 ? ` (${streak} ${streak === 1 ? "dia" : "dias"})` : ""}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

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
            {FRUIT_EMOJI[week] ?? "🍼"}
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

const QUIZ_PRICE_MONTHLY = 19.9;
const QUIZ_PRICE_ANNUAL_MONTH = 9.9; // 12x — cobrado anualmente (R$ 118,80/ano)

function QuizPaywall({ week, context = "past" }: { week: number; context?: "past" | "ad" }) {
  const [plan, setPlan] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

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
        toast.success("Premium liberado pelo seu médico! 💛");
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
                No plano grátis você faz <strong>só a aula de hoje</strong>. Com o{" "}
                <strong>Obstétrica Premium</strong> você libera{" "}
                <strong>todas as aulas já disponíveis</strong> — faça e revise as de qualquer dia
                que já passou, quando quiser. 💛
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-extrabold text-amber-900">Aula premium 🔒</p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
                Essa aula é de um dia que já passou. No plano grátis você faz{" "}
                <strong>a aula de cada dia</strong> no próprio dia. Com o premium, você desbloqueia{" "}
                <strong>todas as aulas já liberadas</strong> para fazer e revisar quando quiser.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <PlanCard
          id="monthly"
          label="Mensal"
          price={`R$ ${QUIZ_PRICE_MONTHLY.toFixed(2).replace(".", ",")}`}
          sub="por mês"
        />
        <PlanCard
          id="annual"
          label="Anual"
          price={`R$ ${QUIZ_PRICE_ANNUAL_MONTH.toFixed(2).replace(".", ",")}`}
          sub="por mês · no anual"
          badge="ECONOMIZE 50%"
        />
      </div>

      <button
        onClick={subscribe}
        disabled={loading}
        className="press mt-3 w-full rounded-full bg-amber-500 py-3 text-sm font-extrabold text-white disabled:opacity-60"
        style={{ boxShadow: "0 4px 0 #b45309" }}
      >
        {loading ? "Abrindo pagamento seguro…" : "✨ Assinar e liberar as aulas"}
      </button>

      <p className="mt-2 text-center text-[10px] leading-relaxed text-amber-700/80">
        Pagamento seguro por cartão · acesso na hora · cancele quando quiser.
        <br />A aula de hoje continua grátis, todos os dias 💛
      </p>

      {/* Código do médico Elite — libera o premium sem pagar */}
      <div className="mt-3 border-t border-amber-200/70 pt-3">
        {!codeOpen ? (
          <button
            onClick={() => setCodeOpen(true)}
            className="w-full text-center text-xs font-semibold text-amber-800 underline decoration-amber-300 underline-offset-2"
          >
            Tenho um cupom
          </button>
        ) : (
          <div>
            <p className="text-xs font-semibold text-amber-900">
              Digite o código que seu médico te passou:
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

function buzz(ms = 28) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* sem haptics */
  }
}

function BreathingBlock({
  day,
  canEarn,
  careMode = false,
  alreadyDone,
  onEarn,
}: {
  day: number;
  canEarn: boolean;
  careMode?: boolean;
  alreadyDone: boolean;
  onEarn: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"intro" | "in" | "hold" | "out" | "done">("intro");
  const [cycle, setCycle] = useState(0);
  const [reward, setReward] = useState<number | null>(null);
  const [sound, setSound] = useState(true);
  const grantedRef = useRef(false);
  const audioRef = useRef<ReturnType<typeof createBreathAudio> | null>(null);

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
    vibratePhase(phase);
    audioRef.current?.setPhase(phase, dur);
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

  async function finish() {
    if (grantedRef.current || !canEarn || careMode) return;
    grantedRef.current = true;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) return;
      const r = await grantWellnessReward({
        data: { accessToken: token, day, activity: "breathing" },
      });
      if (r.ok && r.granted > 0) {
        setReward(r.granted);
        onEarn();
      }
    } catch {
      /* recompensa é secundária */
    }
  }

  function begin() {
    setCycle(0);
    setReward(null);
    grantedRef.current = false;
    if (sound) {
      audioRef.current = createBreathAudio();
      audioRef.current.start();
    }
    setPhase("in");
  }

  function close() {
    audioRef.current?.stop();
    audioRef.current = null;
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
                <div
                  className="absolute inset-0 rounded-full bg-sky-300/30"
                  style={{
                    transform: `scale(${scale})`,
                    transitionProperty: "transform",
                    transitionDuration: `${scaleDur}ms`,
                    transitionTimingFunction: "cubic-bezier(0.4,0,0.4,1)",
                  }}
                  aria-hidden
                />
                <div
                  className="absolute inset-6 rounded-full bg-sky-400/40"
                  style={{
                    transform: `scale(${scale})`,
                    transitionProperty: "transform",
                    transitionDuration: `${scaleDur}ms`,
                    transitionTimingFunction: "cubic-bezier(0.4,0,0.4,1)",
                  }}
                  aria-hidden
                />
                <div
                  className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-cyan-500 text-white shadow-lg"
                  style={{
                    transform: `scale(${scale})`,
                    transitionProperty: "transform",
                    transitionDuration: `${scaleDur}ms`,
                    transitionTimingFunction: "cubic-bezier(0.4,0,0.4,1)",
                  }}
                >
                  <span className="text-base font-extrabold">{label}</span>
                </div>
              </div>
              <p className="mt-10 text-lg font-bold text-sky-800">{label}…</p>
            </div>
          )}

          {phase === "done" && (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              {!careMode && <ConfettiBurst />}
              <span className="dc-result-in text-6xl">🌸</span>
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

type Movimento = { emoji: string; name: string; cue: string; secs: number };

const MOVIMENTOS: Movimento[] = [
  {
    emoji: "💆",
    name: "Rolar os ombros",
    cue: "Gire os ombros para trás, devagar e amplo.",
    secs: 30,
  },
  {
    emoji: "🙆",
    name: "Alongar o pescoço",
    cue: "Incline a orelha em direção ao ombro; troque de lado sem forçar.",
    secs: 30,
  },
  {
    emoji: "🐈",
    name: "Gato-camelo suave",
    cue: "De quatro apoios, alterne arredondar e relaxar a coluna com a respiração.",
    secs: 40,
  },
  {
    emoji: "🦋",
    name: "Abertura de quadril",
    cue: "Sentada, solas dos pés juntas, deixe os joelhos caírem suaves.",
    secs: 30,
  },
  {
    emoji: "🦶",
    name: "Círculos de tornozelo",
    cue: "Pés no ar, desenhe círculos lentos — ajuda a circulação e o inchaço.",
    secs: 30,
  },
  {
    emoji: "🧍",
    name: "Inclinação pélvica em pé",
    cue: "Em pé, incline a bacia para frente e para trás, bem devagar.",
    secs: 30,
  },
];

/** 3 movimentos do dia (rotação determinística por dia). */
function movimentosForDay(day: number): Movimento[] {
  const start = day % MOVIMENTOS.length;
  return [0, 1, 2].map((k) => MOVIMENTOS[(start + k) % MOVIMENTOS.length]);
}

function MovementBlock({
  day,
  canEarn,
  careMode = false,
  alreadyDone,
  onEarn,
}: {
  day: number;
  canEarn: boolean;
  careMode?: boolean;
  alreadyDone: boolean;
  onEarn: () => void;
}) {
  const seq = useMemo(() => movimentosForDay(day), [day]);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"intro" | "active" | "done">("intro");
  const [idx, setIdx] = useState(0);
  const [secs, setSecs] = useState(0);
  const [reward, setReward] = useState<number | null>(null);
  const grantedRef = useRef(false);

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
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) return;
      const r = await grantWellnessReward({
        data: { accessToken: token, day, activity: "movement" },
      });
      if (r.ok && r.granted > 0) {
        setReward(r.granted);
        onEarn();
      }
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
    setOpen(false);
    setPhase("intro");
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
            {phase === "active" && (
              <p className="flex-1 text-center text-xs font-bold uppercase tracking-wider text-emerald-500">
                {idx + 1} de {seq.length}
              </p>
            )}
            <span className="w-6" />
          </div>

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
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              <span className="text-7xl">{cur.emoji}</span>
              <h3 className="mt-4 text-2xl font-extrabold text-emerald-900">{cur.name}</h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-emerald-800/80">{cur.cue}</p>
              <p className="mt-6 tabular-nums text-5xl font-extrabold text-emerald-600">{secs}s</p>
              <button
                onClick={() => setSecs(0)}
                className="press mt-8 rounded-full border border-emerald-300 px-6 py-2 text-xs font-bold text-emerald-700"
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

const MEDITACOES: { theme: string; emoji: string; lines: string[] }[] = [
  {
    theme: "Calma",
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
];

function MeditationBlock({
  day,
  canEarn,
  careMode = false,
  alreadyDone,
  onEarn,
}: {
  day: number;
  canEarn: boolean;
  careMode?: boolean;
  alreadyDone: boolean;
  onEarn: () => void;
}) {
  const med = useMemo(() => MEDITACOES[day % MEDITACOES.length], [day]);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"intro" | "active" | "done">("intro");
  const [idx, setIdx] = useState(0);
  const [reward, setReward] = useState<number | null>(null);
  const [sound, setSound] = useState(true);
  const grantedRef = useRef(false);
  const audioRef = useRef<ReturnType<typeof createBreathAudio> | null>(null);
  const SECS_PER_LINE = 12;

  useEffect(() => () => audioRef.current?.stop(), []);

  useEffect(() => {
    if (phase !== "active") return;
    const t = setTimeout(() => {
      if (idx + 1 >= med.lines.length) {
        setPhase("done");
        finish();
      } else {
        setIdx(idx + 1);
      }
    }, SECS_PER_LINE * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx]);

  async function finish() {
    if (grantedRef.current || !canEarn || careMode) return;
    grantedRef.current = true;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) return;
      const r = await grantWellnessReward({
        data: { accessToken: token, day, activity: "meditation" },
      });
      if (r.ok && r.granted > 0) {
        setReward(r.granted);
        onEarn();
      }
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

  return (
    <>
      <div className="mt-4 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🧘</span>
          <div className="flex-1">
            <p className="text-sm font-extrabold text-violet-800">Meditação do dia</p>
            <p className="text-xs text-violet-700/80">
              {med.theme} · ~1,5 min {alreadyDone ? "· feito hoje ✓" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setOpen(true);
            setPhase("intro");
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
            {phase === "active" ? (
              <div className="mx-3 h-1.5 flex-1 overflow-hidden rounded-full bg-violet-200">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all duration-1000"
                  style={{ width: `${((idx + 1) / med.lines.length) * 100}%` }}
                />
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
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              <span className="text-6xl">{med.emoji}</span>
              <h3 className="mt-4 text-2xl font-extrabold text-violet-900">{med.theme}</h3>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-violet-800/80">
                Uma meditação curtinha. Deixe as frases te guiarem, sem esforço. Encontre uma
                posição confortável. 💜
              </p>
              <button
                onClick={begin}
                className="press mt-8 rounded-full bg-violet-500 px-8 py-3 text-sm font-extrabold text-white"
              >
                Começar
              </button>
            </div>
          )}

          {phase === "active" && (
            <div className="flex flex-1 flex-col items-center justify-center px-10 text-center">
              <span className="text-5xl opacity-80">{med.emoji}</span>
              <p
                key={idx}
                className="dc-q-slide mt-8 max-w-sm text-2xl font-semibold leading-relaxed text-violet-900"
              >
                {med.lines[idx]}
              </p>
              <button
                onClick={() => {
                  if (idx + 1 >= med.lines.length) {
                    setPhase("done");
                    finish();
                  } else setIdx(idx + 1);
                }}
                className="press mt-10 text-xs font-bold text-violet-500"
              >
                Continuar →
              </button>
            </div>
          )}

          {phase === "done" && (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              {!careMode && <ConfettiBurst />}
              <span className="dc-result-in text-6xl">🧘</span>
              <h3 className="mt-3 text-2xl font-extrabold text-violet-900">Que paz 💜</h3>
              <p className="mt-1 text-sm text-violet-800/80">
                Você tirou um tempinho só pra você. Leve essa calma com você.
              </p>
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

/** Motor da "atividade de bem-estar do dia": alterna respiração, movimento e meditação. */
function WellnessBlock(props: {
  day: number;
  canEarn: boolean;
  careMode?: boolean;
  alreadyDone: boolean;
  onEarn: () => void;
}) {
  // Rotação por dia pra dar variedade: respiração → movimento → meditação.
  const which = props.day % 3;
  if (which === 0) return <BreathingBlock {...props} />;
  if (which === 1) return <MovementBlock {...props} />;
  return <MeditationBlock {...props} />;
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
                <p className="dc-result-in text-6xl">
                  {score === total ? "🏆" : score >= total - 1 ? "🎉" : score > 0 ? "👏" : "💪"}
                </p>
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
                onClick={() => setChecked(true)}
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
  const { nodes, height } = useMemo(() => buildPhaseNodes(phase, 7), [phase]);

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
        toast.success(`${POS_EMOJI[week] ?? "🍼"} Figurinha da semana ${week} de vida coletada!`);
      }
      toast.success(`🎉 Dia ${babyAgeDays + 1} com ${babyLabel} completo!`);
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
                  {FRUIT_EMOJI[w] ?? "🍼"}
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
              const pm = posMeta(node.week);
              return (
                <div
                  key={`h${node.week}`}
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{ top: `${node.y + 8}px` }}
                >
                  <span
                    className={`rounded-full bg-white/90 px-3 py-1 text-[11px] font-extrabold shadow-sm ${pm.softText}`}
                  >
                    Semana {node.week} de vida {POS_EMOJI[node.week] ?? ""}
                  </span>
                </div>
              );
            }
            if (node.kind === "album-week") return null;

            const { D, week } = node;
            const isToday = D === todayD;
            const done = posDone.includes(D);
            const isPast = D < todayD;
            const isFuture = D > todayD;
            const pm = posMeta(week);
            const palette = done || isToday ? pm : isPast ? MISSED : LOCKED;
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
                aria-label={`Dia ${(D % 7) + 1} da semana ${week} de vida`}
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
