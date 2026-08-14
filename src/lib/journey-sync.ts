/**
 * O ARMAZÉM LOCAL DA JORNADA, e a sincronização dele com o perfil.
 *
 * ─── POR QUE ISTO SAIU DE `gestacao-path.tsx` (ago/2026) ────────────────────
 *
 * Estas funções são pequenas e sem JSX, mas moravam dentro de um componente de
 * dez mil linhas — e três telas as importavam de lá (`lsGet`, `lsSet`,
 * `ensureInitialJourneyPull`). Isso amarrava o chunk INTEIRO do Caminho a
 * qualquer arquivo que quisesse ler uma chave do `localStorage`: medido, 892 KB
 * crus / 264 KB comprimidos baixando junto com a tela de Minha Conta, mesmo
 * para quem nunca abriu a aba do jogo naquele dia.
 *
 * Com elas aqui, `GestacaoPath` pôde virar `lazy()` de verdade — o peso do jogo
 * só desce quando ela abre o jogo.
 *
 * ⚠️ NÃO é um arquivo "utils". É o contrato de um dado só: a jornada da
 * paciente, que vive no aparelho como cache e no `journey_state` como verdade.
 * O que decide se algo entra aqui é a chave `dc-path-`, não o tamanho da
 * função.
 */

import { toast } from "sonner";

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

/**
 * O pull inicial já foi armado nesta sessão?
 *
 * ⚠️ É uma FUNÇÃO, e não a variável exportada: `export let` congela o valor
 * no import de quem lê, e o Caminho pergunta isto DEPOIS de a barreira ser
 * armada. Exportando a variável, ele leria `false` para sempre e re-hidrataria
 * a cada montagem.
 */
export function pullInicialJaArmado(): boolean {
  return gatePrimed;
}

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
export async function pullJourneyFromProfile(retries = 2): Promise<boolean> {
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
