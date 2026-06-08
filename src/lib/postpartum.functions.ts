import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PpdScreening = { id: string; score: number; answers: number[]; screened_at: string };
export type BreastfeedingLog = { id: string; started_at: string; ended_at: string | null; side: string; notes: string | null };
export type BabyMilestone = { id: string; milestone_key: string; custom_label: string | null; achieved_at: string; notes: string | null };
export type BabyWeight = { id: string; measured_at: string; weight_g: number };
export type BabyVaccine = { id: string; vaccine_key: string; administered_at: string; batch: string | null };

// ─── PPD ──────────────────────────────────────────────────────────────────────

export const savePpdScreening = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), score: z.number().int(), answers: z.array(z.number()) }).parse(i)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false as const };
    const { error } = await supabaseAdmin.from("ppd_screenings").insert({
      user_id: u.user.id, score: data.score, answers: data.answers,
    });
    return { ok: !error };
  });

export const getMyPpdScreenings = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false as const, screenings: [] as PpdScreening[] };
    const { data: rows } = await supabaseAdmin
      .from("ppd_screenings").select("*").eq("user_id", u.user.id)
      .order("screened_at", { ascending: false }).limit(10);
    return { ok: true as const, screenings: (rows ?? []) as PpdScreening[] };
  });

// ─── Breastfeeding ────────────────────────────────────────────────────────────

export const startBreastfeeding = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), side: z.string() }).parse(i)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false as const };
    const { data: row, error } = await supabaseAdmin.from("breastfeeding_logs")
      .insert({ user_id: u.user.id, side: data.side }).select().single();
    return { ok: !error, id: (row as any)?.id ?? null };
  });

export const endBreastfeeding = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), id: z.string().uuid(), notes: z.string().nullable() }).parse(i)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false as const };
    const { error } = await supabaseAdmin.from("breastfeeding_logs")
      .update({ ended_at: new Date().toISOString(), notes: data.notes })
      .eq("id", data.id).eq("user_id", u.user.id);
    return { ok: !error };
  });

export const getBreastfeedingLogs = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false as const, logs: [] as BreastfeedingLog[] };
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: rows } = await supabaseAdmin.from("breastfeeding_logs")
      .select("*").eq("user_id", u.user.id).gte("started_at", since)
      .order("started_at", { ascending: false });
    return { ok: true as const, logs: (rows ?? []) as BreastfeedingLog[] };
  });

// ─── Baby Milestones ──────────────────────────────────────────────────────────

export const setMilestone = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      accessToken: z.string().min(10),
      milestoneKey: z.string(),
      achievedAt: z.string(),
      notes: z.string().nullable(),
      customLabel: z.string().nullable(),
    }).parse(i)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false as const };
    const { error } = await supabaseAdmin.from("baby_milestones").upsert({
      user_id: u.user.id, milestone_key: data.milestoneKey,
      achieved_at: data.achievedAt, notes: data.notes, custom_label: data.customLabel,
    });
    return { ok: !error };
  });

export const getMilestones = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false as const, milestones: [] as BabyMilestone[] };
    const { data: rows } = await supabaseAdmin.from("baby_milestones")
      .select("*").eq("user_id", u.user.id).order("achieved_at", { ascending: true });
    return { ok: true as const, milestones: (rows ?? []) as BabyMilestone[] };
  });

export const removeMilestone = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), milestoneKey: z.string() }).parse(i)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false as const };
    const { error } = await supabaseAdmin.from("baby_milestones")
      .delete().eq("user_id", u.user.id).eq("milestone_key", data.milestoneKey);
    return { ok: !error };
  });

// ─── Baby Weight ──────────────────────────────────────────────────────────────

export const addBabyWeight = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), measuredAt: z.string(), weightG: z.number().int().positive() }).parse(i)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false as const };
    const { error } = await supabaseAdmin.from("baby_weights")
      .insert({ user_id: u.user.id, measured_at: data.measuredAt, weight_g: data.weightG });
    return { ok: !error };
  });

export const getBabyWeights = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false as const, weights: [] as BabyWeight[] };
    const { data: rows } = await supabaseAdmin.from("baby_weights")
      .select("*").eq("user_id", u.user.id).order("measured_at", { ascending: true });
    return { ok: true as const, weights: (rows ?? []) as BabyWeight[] };
  });

// ─── Baby Vaccines ────────────────────────────────────────────────────────────

export const markVaccineGiven = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      accessToken: z.string().min(10),
      vaccineKey: z.string(),
      administeredAt: z.string(),
      batch: z.string().nullable(),
    }).parse(i)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false as const };
    const { error } = await supabaseAdmin.from("baby_vaccines").upsert({
      user_id: u.user.id, vaccine_key: data.vaccineKey,
      administered_at: data.administeredAt, batch: data.batch,
    });
    return { ok: !error };
  });

export const getBabyVaccines = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false as const, vaccines: [] as BabyVaccine[] };
    const { data: rows } = await supabaseAdmin.from("baby_vaccines")
      .select("*").eq("user_id", u.user.id);
    return { ok: true as const, vaccines: (rows ?? []) as BabyVaccine[] };
  });

export const removeVaccine = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), vaccineKey: z.string() }).parse(i)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false as const };
    const { error } = await supabaseAdmin.from("baby_vaccines")
      .delete().eq("user_id", u.user.id).eq("vaccine_key", data.vaccineKey);
    return { ok: !error };
  });
