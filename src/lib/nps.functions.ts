/**
 * NPS (satisfação): pergunta curta in-app "de 0 a 10, o quanto recomendaria?"
 * para médicos e pacientes. Uma resposta por pessoa a cada 90 dias. O dono vê
 * o NPS agregado (promotores − detratores), por papel e no tempo.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  MAX_ROWS,
  TokenSchema,
  getUser,
  requireSuperAdmin,
  safe,
  userIsDoctor,
} from "@/lib/platform-admin.server";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/** Deve mostrar a pesquisa? (sem resposta nos últimos 90 dias.) */
export const shouldAskNps = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await getUser(data.accessToken);
    if (!user) return { ok: false as const, ask: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const recent = await safe<boolean>(async () => {
      const since = new Date(Date.now() - NINETY_DAYS_MS).toISOString();
      const { data: rows } = await (supabaseAdmin as any)
        .from("nps_responses")
        .select("id")
        .eq("user_id", user.id)
        .gte("created_at", since)
        .limit(1);
      return (rows ?? []).length > 0;
    }, true); // erro → não incomoda (ask=false)
    return { ok: true as const, ask: !recent };
  });

/** Envia a nota (0..10) + comentário opcional. */
export const submitNps = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        score: z.number().int().min(0).max(10),
        comment: z.string().max(1000).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await getUser(data.accessToken);
    if (!user) return { ok: false as const };
    const role = (await userIsDoctor(user.id)) ? "medico" : "paciente";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("nps_responses").insert({
      user_id: user.id,
      role,
      score: data.score,
      comment: data.comment?.trim() || null,
    });
    if (error?.code === "42P01") return { ok: false as const, reason: "migracao" as const };
    if (error) return { ok: false as const };
    return { ok: true as const };
  });

export type NpsBucket = {
  promoters: number;
  passives: number;
  detractors: number;
  responses: number;
  nps: number;
  avg: number;
};
export type NpsComment = { role: string; score: number; comment: string; created_at: string };
export type NpsReport = {
  isSuperAdmin: true;
  overall: NpsBucket;
  byRole: { medico: NpsBucket; paciente: NpsBucket };
  trend: { month: string; nps: number; responses: number }[];
  recentComments: NpsComment[];
  generatedAt: string;
};

function emptyBucket(): { p: number; pa: number; d: number; sum: number; n: number } {
  return { p: 0, pa: 0, d: 0, sum: 0, n: 0 };
}
function toBucket(b: { p: number; pa: number; d: number; sum: number; n: number }): NpsBucket {
  const nps = b.n > 0 ? Math.round(((b.p - b.d) / b.n) * 100) : 0;
  const avg = b.n > 0 ? Math.round((b.sum / b.n) * 10) / 10 : 0;
  return { promoters: b.p, passives: b.pa, detractors: b.d, responses: b.n, nps, avg };
}
function add(b: { p: number; pa: number; d: number; sum: number; n: number }, score: number) {
  b.n += 1;
  b.sum += score;
  if (score >= 9) b.p += 1;
  else if (score >= 7) b.pa += 1;
  else b.d += 1;
}

/** NPS agregado (super-admin). */
export const getNpsReport = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    type Row = { role: string | null; score: number; comment: string | null; created_at: string };
    const rows = await safe<Row[]>(
      async () =>
        ((
          await (supabaseAdmin as any)
            .from("nps_responses")
            .select("role,score,comment,created_at")
            .order("created_at", { ascending: false })
            .limit(MAX_ROWS)
        ).data ?? []) as Row[],
      [],
    );

    const overall = emptyBucket();
    const medico = emptyBucket();
    const paciente = emptyBucket();
    const trendMap = new Map<
      string,
      { p: number; pa: number; d: number; sum: number; n: number }
    >();
    const recentComments: NpsComment[] = [];
    for (const r of rows) {
      add(overall, r.score);
      if (r.role === "medico") add(medico, r.score);
      else add(paciente, r.score);
      const month = (r.created_at ?? "").slice(0, 7);
      if (month) {
        const t = trendMap.get(month) ?? emptyBucket();
        add(t, r.score);
        trendMap.set(month, t);
      }
      if (r.comment && recentComments.length < 25)
        recentComments.push({
          role: r.role ?? "—",
          score: r.score,
          comment: r.comment,
          created_at: r.created_at,
        });
    }
    const trend = [...trendMap.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 6)
      .reverse()
      .map(([month, t]) => ({ month, nps: toBucket(t).nps, responses: t.n }));

    const report: NpsReport = {
      isSuperAdmin: true,
      overall: toBucket(overall),
      byRole: { medico: toBucket(medico), paciente: toBucket(paciente) },
      trend,
      recentComments,
      generatedAt: new Date().toISOString(),
    };
    return { ok: true as const, report };
  });
