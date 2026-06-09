import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type CorporateLead = {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  employee_count: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

export type CorporateAccount = {
  id: string;
  company_name: string;
  contact_email: string;
  plan_type: string;
  max_seats: number;
  access_code: string;
  status: string;
  notes: string | null;
  created_at: string;
};

export const submitCorporateLead = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      companyName: z.string().min(2),
      contactName: z.string().min(2),
      contactEmail: z.string().email(),
      contactPhone: z.string().nullable(),
      employeeCount: z.string().nullable(),
      message: z.string().nullable(),
    }).parse(i)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db.from("corporate_leads").insert({
      company_name: data.companyName,
      contact_name: data.contactName,
      contact_email: data.contactEmail,
      contact_phone: data.contactPhone,
      employee_count: data.employeeCount,
      message: data.message,
    });
    return { ok: !error, error: error?.message };
  });

export const joinCorporate = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), accessCode: z.string().min(4) }).parse(i)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const, error: "Não autenticado" };
    // Validate code
    const { data: account } = await db
      .from("corporate_accounts")
      .select("id, company_name, max_seats, status")
      .eq("access_code", data.accessCode.toUpperCase())
      .eq("status", "ativo")
      .single();
    if (!account) return { ok: false as const, error: "Código inválido ou inativo." };
    // Count current seats
    const { count } = await db
      .from("patient_profiles")
      .select("*", { count: "exact", head: true })
      .eq("corporate_account_id", account.id);
    if ((count ?? 0) >= account.max_seats)
      return { ok: false as const, error: "Limite de vagas atingido para esta empresa." };
    // Link user
    const { error } = await db
      .from("patient_profiles")
      .update({ corporate_account_id: account.id })
      .eq("id", u.user.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, companyName: account.company_name as string };
  });

export const getCorporateLeadsAdmin = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user?.email || !adminEmails.includes(u.user.email.toLowerCase()))
      return { ok: false as const, error: "Não autorizado" };
    const { data: leads } = await db
      .from("corporate_leads")
      .select("*")
      .order("created_at", { ascending: false });
    const { data: accounts } = await db
      .from("corporate_accounts")
      .select("*")
      .order("created_at", { ascending: false });
    return {
      ok: true as const,
      leads: (leads ?? []) as CorporateLead[],
      accounts: (accounts ?? []) as CorporateAccount[],
    };
  });

export const createCorporateAccountAdmin = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      accessToken: z.string().min(10),
      companyName: z.string().min(2),
      contactEmail: z.string().email(),
      planType: z.enum(["basico", "standard", "premium"]),
      maxSeats: z.number().int().min(1),
      notes: z.string().nullable(),
    }).parse(i)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user?.email || !adminEmails.includes(u.user.email.toLowerCase()))
      return { ok: false as const, error: "Não autorizado" };
    const { data: row, error } = await db
      .from("corporate_accounts")
      .insert({
        company_name: data.companyName,
        contact_email: data.contactEmail,
        plan_type: data.planType,
        max_seats: data.maxSeats,
        notes: data.notes,
      })
      .select()
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, account: row as CorporateAccount };
  });

export const updateLeadStatusAdmin = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), id: z.string().uuid(), status: z.string() }).parse(i)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user?.email || !adminEmails.includes(u.user.email.toLowerCase()))
      return { ok: false as const };
    const { error } = await db
      .from("corporate_leads")
      .update({ status: data.status })
      .eq("id", data.id);
    return { ok: !error };
  });
