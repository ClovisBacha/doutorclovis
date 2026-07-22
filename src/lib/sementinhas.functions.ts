import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { typedDb, type SementinhasLedgerRow } from "@/integrations/supabase/types.extended";
import { isCareModeActive } from "@/lib/care-mode.functions";

/**
 * Sementinhas 🌱 — moeda de recompensa da paciente.
 *
 * Ética (ver pesquisa de gamificação em saúde):
 * - O saldo NUNCA zera e nada é deletado — o saldo é sempre SUM(amount).
 * - Ganho só por autocuidado / educação / marcos, NUNCA por resultado clínico.
 * - Sem streak punitivo, sem aleatoriedade, sem FOMO.
 * - O ganho é concedido SÓ no servidor; o cliente jamais escreve no ledger
 *   (a tabela é server-only), pra ninguém "imprimir" moeda.
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
  await db
    .from("sementinhas_ledger")
    .upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });
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

// Nota: o GASTO de Sementinhas é feito pela RPC atômica buy_cantinho_item
// (ver cantinho.functions.ts) — com advisory lock por usuário, sem risco de
// saldo negativo. Não há função genérica de gasto de propósito, pra evitar um
// caminho não-atômico que furasse essa garantia.
