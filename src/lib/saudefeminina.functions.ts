import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { typedDb } from "@/integrations/supabase/types.extended";

export type MenstrualCycle = {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string | null;
  flow_intensity: string | null;
  symptoms: string[];
  notes: string | null;
  created_at: string;
};

export type PreventiveReminder = {
  id: string;
  user_id: string;
  exam_key: string;
  last_done_date: string | null;
  notes: string | null;
};

export const logCycleStart = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        flowIntensity: z.string().max(30).nullable(),
        // Sintomas entram no contexto da IA — limita tamanho/quantidade (defesa
        // em profundidade contra injeção/inchaço; a UI usa uma lista fixa curta).
        symptoms: z.array(z.string().max(60)).max(20),
        notes: z.string().max(1000).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const };
    const { data: row, error } = await db
      .from("menstrual_cycles")
      .upsert(
        {
          user_id: u.user.id,
          start_date: data.startDate,
          flow_intensity: data.flowIntensity,
          symptoms: data.symptoms,
          notes: data.notes,
        },
        { onConflict: "user_id,start_date" },
      )
      .select()
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, cycle: row as MenstrualCycle };
  });

export const updateCycleEnd = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        cycleId: z.string().uuid(),
        endDate: z.string(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const };
    const { error } = await db
      .from("menstrual_cycles")
      .update({ end_date: data.endDate })
      .eq("id", data.cycleId)
      .eq("user_id", u.user.id);
    return { ok: !error };
  });

export const deleteCycle = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), cycleId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const };
    const { error } = await db
      .from("menstrual_cycles")
      .delete()
      .eq("id", data.cycleId)
      .eq("user_id", u.user.id);
    return { ok: !error };
  });

export const getRecentCycles = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const, cycles: [] as MenstrualCycle[] };
    const { data: rows } = await db
      .from("menstrual_cycles")
      .select("*")
      .eq("user_id", u.user.id)
      .order("start_date", { ascending: false })
      .limit(12);
    return { ok: true as const, cycles: (rows ?? []) as MenstrualCycle[] };
  });

export const setPreventiveReminder = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        examKey: z.string(),
        lastDoneDate: z.string().nullable(),
        notes: z.string().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const };
    const { error } = await db.from("preventive_reminders").upsert(
      {
        user_id: u.user.id,
        exam_key: data.examKey,
        last_done_date: data.lastDoneDate,
        notes: data.notes,
      },
      { onConflict: "user_id,exam_key" },
    );
    return { ok: !error };
  });

export const getPreventiveReminders = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const, reminders: [] as PreventiveReminder[] };
    const { data: rows } = await db
      .from("preventive_reminders")
      .select("*")
      .eq("user_id", u.user.id);
    return { ok: true as const, reminders: (rows ?? []) as PreventiveReminder[] };
  });
