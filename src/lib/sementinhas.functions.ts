import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { typedDb, type SementinhasLedgerRow } from "@/integrations/supabase/types.extended";
import { isCareModeActive } from "@/lib/care-mode.functions";
import { COURSE_MODULES } from "@/lib/course-modules";
import { quizForDay } from "@/lib/daily-quizzes";
import { computeGestation } from "@/lib/gestacao";

/**
 * Sementinhas 🌱 — moeda de recompensa da paciente.
 *
 * Ética (ver pesquisa de gamificação em saúde):
 * - O saldo NUNCA zera e nada é deletado — o saldo é sempre SUM(amount).
 * - Ganho só por autocuidado / educação / marcos, NUNCA por resultado clínico.
 * - Sem streak punitivo, sem aleatoriedade, sem FOMO.
 * - O ganho é concedido SÓ no servidor; o cliente jamais escreve no ledger
 *   (a tabela é server-only), pra ninguém "imprimir" moeda.
 *
 * Desde ago/2026 existe uma SEGUNDA porta de entrada: os pacotes pagos
 * (`pacotes-sementinhas.ts`, creditados pelo webhook do Stripe). Isso não
 * revoga nada acima — o ganho por jogar continua inteiro e o pacote é atalho,
 * nunca condição. O limite que sustenta as duas portas convivendo é um só, e
 * ele é inegociável: **a Sementinha compra enfeite, nunca cuidado**. Nenhuma
 * aula, exame, alerta ou conduta clínica pode passar a depender dela. No dia
 * em que isso acontecer, o app terá começado a cobrar por saúde — que é outro
 * negócio, e não este.
 */

/** Valores de ganho — transparentes e calibráveis sem migração. */
export const SEMENTINHAS = {
  dailyCheckin: 5,
  weekMilestone: 25,
  trimesterMilestone: 100,
  achievementDefault: 20,
  achievementBig: 100,
} as const;

/** Conquistas "grandes" que valem mais (marcos de conclusão). */
export const BIG_ACHIEVEMENTS = new Set(["course_complete", "prenatal_done"]);

type Db = ReturnType<typeof typedDb>;
// dedupeKey é obrigatório: ganho sem chave duplicaria (NULL não conflita no
// índice único). Gastos NÃO passam por aqui — usam insert direto (dedupe_key NULL).
type Grant = { amount: number; reason: string; dedupeKey: string };

/** Concede Sementinhas de forma idempotente (dedupe_key). Server-only. */
export async function grantSementinhas(db: Db, userId: string, grants: Grant[]): Promise<void> {
  const rows = grants
    .filter((g) => g.amount !== 0)
    .map((g) => ({
      user_id: userId,
      amount: g.amount,
      reason: g.reason,
      dedupe_key: g.dedupeKey,
    }));
  if (rows.length === 0) return;
  const { error } = await db
    .from("sementinhas_ledger")
    .upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });
  /* `dedupe_key` torna a concessão idempotente, então repetir é seguro — o que
     não existe é alguém para repetir. Falhando aqui, ela cumpre o desafio, vê
     a animação e o saldo não muda; e como todo chamador ignora o retorno, o
     único lugar onde isso pode aparecer é o log. */
  if (error) console.error("[sementinhas] concessão não gravou", userId, error);
}

/** Saldo atual = SUM(amount). Server-only. */
async function computeBalance(db: Db, userId: string): Promise<number> {
  const { data } = await db.from("sementinhas_ledger").select("amount").eq("user_id", userId);
  return ((data ?? []) as Pick<SementinhasLedgerRow, "amount">[]).reduce(
    (sum, r) => sum + (r.amount ?? 0),
    0,
  );
}

/** Data de hoje (America/Sao_Paulo) como YYYY-MM-DD, para dedupe do check-in. */
function todayKeySaoPaulo(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * Lê o perfil e devolve o "ciclo" (chave de dedupe por gestação) + a idade
 * gestacional REAL de hoje calculada no servidor. É a fonte de verdade
 * anti-fraude: o cliente não pode reivindicar recompensa de um dia/semana no
 * FUTURO (isso "imprimiria" a jornada inteira de uma vez). `gest` é null quando
 * não há dado gestacional (pós-parto ou perfil incompleto) — aí não dá pra
 * validar por data e caímos no limite do conteúdo finito + dedupe.
 */
async function loadCycleAndGestation(
  admin: typeof import("@/integrations/supabase/client.server").supabaseAdmin,
  uid: string,
) {
  const { data: prof } = await admin
    .from("patient_profiles")
    .select("lmp_date, reference_date, reference_weeks, reference_days, birth_date")
    .eq("id", uid)
    .single();
  const p = prof as {
    lmp_date?: string | null;
    reference_date?: string | null;
    reference_weeks?: number | null;
    reference_days?: number | null;
    birth_date?: string | null;
  } | null;
  const cycle = p?.lmp_date ?? p?.reference_date ?? p?.birth_date ?? "x";
  const gest = computeGestation({
    lmp: p?.lmp_date ?? null,
    referenceDate: p?.reference_date ?? null,
    referenceWeeks: p?.reference_weeks ?? null,
    referenceDays: p?.reference_days ?? null,
  });
  return { cycle, gest };
}

async function walletPayload(db: Db, userId: string) {
  const balance = await computeBalance(db, userId);
  const { data: recent } = await db
    .from("sementinhas_ledger")
    .select("amount, reason, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  return {
    balance,
    recent: (recent ?? []) as Pick<SementinhasLedgerRow, "amount" | "reason" | "created_at">[],
  };
}

/**
 * Lê a carteira e, de quebra, concede o check-in do dia (idempotente por dia).
 * O app chama isto ao abrir a área logada.
 */
export const claimDailyAndGetWallet = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !u.user) return { ok: false as const, error: "Não autenticado" };
    const uid = u.user.id;
    // Modo Cuidado: não concede nem comemora; só devolve o saldo que já existe.
    const careMode = await isCareModeActive(supabaseAdmin, uid);
    if (!careMode) {
      await grantSementinhas(db, uid, [
        {
          amount: SEMENTINHAS.dailyCheckin,
          reason: "Check-in de hoje",
          dedupeKey: `checkin:${todayKeySaoPaulo()}`,
        },
      ]);
    }
    return { ok: true as const, careMode, ...(await walletPayload(db, uid)) };
  });

/** Só lê a carteira (sem conceder nada). */
export const getWallet = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !u.user) return { ok: false as const, error: "Não autenticado" };
    return { ok: true as const, ...(await walletPayload(db, u.user.id)) };
  });

/**
 * Recompensa por concluir a lição do quiz. NUNCA punitivo: base por concluir +
 * bônus por acerto. Idempotente por lição (dedupe), escopado ao ciclo. Devolve
 * quanto foi concedido AGORA (0 se já havia ganhado ou em Modo Cuidado).
 */
export const grantLessonReward = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        week: z.number().int().min(1).max(45),
        correct: z.number().int().min(0).max(20),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !u.user) return { ok: false as const, error: "Não autenticado" };
    const uid = u.user.id;
    if (await isCareModeActive(supabaseAdmin, uid)) return { ok: true as const, granted: 0 };

    // ANTI-FRAUDE: a semana e o nº de acertos são validados contra o CURSO real
    // no servidor — o cliente não define o valor creditado. Semana inexistente
    // não paga; `correct` é limitado ao nº de perguntas daquela lição.
    const mod = COURSE_MODULES.find((mm) => mm.week === data.week);
    if (!mod) return { ok: true as const, granted: 0 };
    const correct = Math.max(0, Math.min(data.correct, mod.quiz.length));

    const { cycle, gest } = await loadCycleAndGestation(supabaseAdmin, uid);
    // ANTI-FRAUDE (cadência): a lição só paga a SEMANA gestacional atual (±1 de
    // folga p/ fuso). Sem idade gestacional confiável não paga. Assim uma única
    // edição do perfil não "varre" os 12 módulos de uma vez (antes bastava
    // inflar reference_weeks). As lições do curso já saíram da UI (ensino só no
    // desafio do dia), então travar na semana atual não bloqueia nada legítimo.
    if (!gest) return { ok: true as const, granted: 0 };
    if (Math.abs(data.week - gest.weeks) > 1) return { ok: true as const, granted: 0 };
    const dedupeKey = `lesson:${cycle}:${data.week}`;

    // Já ganhou por esta lição? (idempotência transparente p/ o "você ganhou X")
    const { data: existing } = await db
      .from("sementinhas_ledger")
      .select("amount")
      .eq("user_id", uid)
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();
    if (existing) return { ok: true as const, granted: 0 };

    const amount = 10 + 3 * correct; // base + bônus por acerto (limitado)
    await grantSementinhas(db, uid, [
      { amount, reason: `Lição da semana ${data.week} 📚`, dedupeKey },
    ]);
    return { ok: true as const, granted: amount };
  });

/**
 * Recompensa por concluir o DESAFIO DO DIA (quiz da aula de hoje). Base por
 * concluir + bônus por acerto (nunca punitivo). Validado no servidor contra o
 * quiz real do dia (anti-fraude: dia inexistente não paga; `correct` limitado
 * ao nº de perguntas). Idempotente por dia/ciclo; suprimido em Modo Cuidado.
 */
export const grantDailyQuizReward = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        day: z.number().int().min(1).max(400),
        correct: z.number().int().min(0).max(20),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !u.user) return { ok: false as const, error: "Não autenticado" };
    const uid = u.user.id;
    if (await isCareModeActive(supabaseAdmin, uid)) return { ok: true as const, granted: 0 };

    const quiz = quizForDay(data.day);
    if (!quiz || quiz.questions.length === 0) return { ok: true as const, granted: 0 };
    const correct = Math.max(0, Math.min(data.correct, quiz.questions.length));

    const { cycle, gest } = await loadCycleAndGestation(supabaseAdmin, uid);
    // ANTI-FRAUDE (cadência diária): o "desafio do dia" só paga o dia de HOJE.
    // Espelha o cliente (canEarn={isToday}). Isto barra as DUAS fraudes: minerar
    // o FUTURO (reivindicar a jornada inteira) e reprocessar TODOS os dias
    // passados de uma vez. `todayDay` usa a mesma janela do cliente (7..300).
    // Sem idade gestacional confiável (perfil incompleto/pós-parto) não há
    // cadência a validar — não paga (o quiz é conteúdo de gravidez).
    if (!gest) return { ok: true as const, granted: 0 };
    const todayDay = Math.max(7, Math.min(300, gest.totalDays));
    if (Math.abs(data.day - todayDay) > 1) return { ok: true as const, granted: 0 };
    const dedupeKey = `dailyquiz:${cycle}:${data.day}`;

    const { data: existing } = await db
      .from("sementinhas_ledger")
      .select("amount")
      .eq("user_id", uid)
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();
    if (existing) return { ok: true as const, granted: 0 };

    const amount = 5 + 3 * correct; // base 5 + 3 por acerto
    await grantSementinhas(db, uid, [{ amount, reason: "Desafio do dia 🎯", dedupeKey }]);
    return { ok: true as const, granted: amount };
  });

/**
 * Recompensa por concluir a ATIVIDADE DE BEM-ESTAR do dia (respiração,
 * movimento ou meditação). Recompensa fixa por concluir (nunca punitivo, sem
 * "acerto"). Só paga o dia de HOJE (mesma cadência do desafio), idempotente por
 * dia/ciclo (uma por dia, independente do tipo), suprimido em Modo Cuidado.
 */
export const grantWellnessReward = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        day: z.number().int().min(1).max(400),
        activity: z.enum(["breathing", "movement", "meditation", "bonding", "gratitude"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !u.user) return { ok: false as const, error: "Não autenticado" };
    const uid = u.user.id;
    if (await isCareModeActive(supabaseAdmin, uid)) return { ok: true as const, granted: 0 };

    const { cycle, gest } = await loadCycleAndGestation(supabaseAdmin, uid);
    // Mesma cadência do desafio: só paga o dia de HOJE (anti-fraude).
    if (!gest) return { ok: true as const, granted: 0 };
    const todayDay = Math.max(7, Math.min(300, gest.totalDays));
    if (Math.abs(data.day - todayDay) > 1) return { ok: true as const, granted: 0 };
    // Recompensa POR ATIVIDADE (uma vez por dia cada). Fazer TODAS rende mais —
    // é o "desafio do dia". Nunca punitivo: fazer só uma já ganha.
    const keyFor = (a: string) => `wellness:${a}:${cycle}:${data.day}`;
    const dedupeKey = keyFor(data.activity);

    const { data: existing } = await db
      .from("sementinhas_ledger")
      .select("amount")
      .eq("user_id", uid)
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();

    const reason =
      data.activity === "breathing"
        ? "Respiração do dia 🌬️"
        : data.activity === "movement"
          ? "Movimento do dia 🤸"
          : data.activity === "meditation"
            ? "Meditação do dia 🧘"
            : data.activity === "bonding"
              ? "Momento com o bebê 💛"
              : "Gratidão do dia ✨";
    const amount = 5; // base fixa por concluir (nunca punitivo)
    let granted = 0;
    if (!existing) {
      await grantSementinhas(db, uid, [{ amount, reason, dedupeKey }]);
      granted = amount;
    }

    // Quantas atividades já foram feitas hoje (fonte da verdade: o ledger).
    const allKeys = WELLNESS_ACTIVITIES.map(keyFor);
    const { data: rows } = await db
      .from("sementinhas_ledger")
      .select("dedupe_key")
      .eq("user_id", uid)
      .in("dedupe_key", allKeys);
    const doneSet = new Set(((rows ?? []) as { dedupe_key: string }[]).map((r) => r.dedupe_key));
    doneSet.add(dedupeKey); // acabou de ganhar (pode não estar no SELECT ainda)
    const doneCount = WELLNESS_ACTIVITIES.filter((a) => doneSet.has(keyFor(a))).length;
    const allDone = doneCount === WELLNESS_ACTIVITIES.length;

    // (O bônus do dia é por fechar as 3 ESTRELAS — os 6 jogos, cada um valendo
    // meia — via grantDayStarsBonus. Aqui cada atividade só rende a sua.)
    return { ok: true as const, granted, doneCount, allDone };
  });

/** Bônus por fechar as 3 estrelas do dia (6 jogos × meia estrela). 1x/dia. */
export const grantDayStarsBonus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), day: z.number().int().min(1).max(400) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !u.user) return { ok: false as const, granted: 0 };
    const uid = u.user.id;
    if (await isCareModeActive(supabaseAdmin, uid)) return { ok: true as const, granted: 0 };
    const { cycle, gest } = await loadCycleAndGestation(supabaseAdmin, uid);
    if (!gest) return { ok: true as const, granted: 0 };
    const todayDay = Math.max(7, Math.min(300, gest.totalDays));
    if (Math.abs(data.day - todayDay) > 1) return { ok: true as const, granted: 0 };
    // Anti-fraude: o bônus só sai se o LEDGER confirmar as 5 atividades de
    // bem-estar do dia (não confia no cliente dizer "fechei").
    const wellnessKeys = WELLNESS_ACTIVITIES.map((a) => `wellness:${a}:${cycle}:${data.day}`);
    const { data: wrows } = await db
      .from("sementinhas_ledger")
      .select("dedupe_key")
      .eq("user_id", uid)
      .in("dedupe_key", wellnessKeys);
    if (((wrows ?? []) as { dedupe_key: string }[]).length < WELLNESS_ACTIVITIES.length) {
      return { ok: true as const, granted: 0 };
    }
    const dedupeKey = `day_stars:${cycle}:${data.day}`;
    const { data: had } = await db
      .from("sementinhas_ledger")
      .select("amount")
      .eq("user_id", uid)
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();
    if (had) return { ok: true as const, granted: 0 };
    const amount = 20;
    await grantSementinhas(db, uid, [{ amount, reason: "3 estrelas do dia! 🌟", dedupeKey }]);
    return { ok: true as const, granted: amount };
  });

/** Atividades do desafio diário de bem-estar (ordem = ordem no jogo). */
const WELLNESS_ACTIVITIES = [
  "breathing",
  "movement",
  "meditation",
  "bonding",
  "gratitude",
] as const;

/** Progresso do desafio de bem-estar de HOJE (quais atividades já foram feitas). */
export const getWellnessProgress = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), day: z.number().int().min(1).max(400) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !u.user) return { ok: false as const, done: [] as string[], allDone: false };
    const uid = u.user.id;
    // Modo Cuidado: sem gamificação — desafio "vazio".
    if (await isCareModeActive(supabaseAdmin, uid))
      return { ok: true as const, done: [] as string[], allDone: false };
    const { cycle, gest } = await loadCycleAndGestation(supabaseAdmin, uid);
    if (!gest) return { ok: true as const, done: [] as string[], allDone: false };

    const keyFor = (a: string) => `wellness:${a}:${cycle}:${data.day}`;
    const allKeys = WELLNESS_ACTIVITIES.map(keyFor);
    const { data: rows } = await db
      .from("sementinhas_ledger")
      .select("dedupe_key")
      .eq("user_id", uid)
      .in("dedupe_key", allKeys);
    const doneSet = new Set(((rows ?? []) as { dedupe_key: string }[]).map((r) => r.dedupe_key));
    const done = WELLNESS_ACTIVITIES.filter((a) => doneSet.has(keyFor(a)));
    return {
      ok: true as const,
      done: done as string[],
      allDone: done.length === WELLNESS_ACTIVITIES.length,
    };
  });

// Nota: o GASTO de Sementinhas é feito pela RPC atômica buy_cantinho_item
// (ver cantinho.functions.ts) — com advisory lock por usuário, sem risco de
// saldo negativo. Não há função genérica de gasto de propósito, pra evitar um
// caminho não-atômico que furasse essa garantia.
