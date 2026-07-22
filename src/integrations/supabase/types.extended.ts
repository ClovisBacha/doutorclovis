import type { SupabaseClient } from "@supabase/supabase-js";

// Extended row types for tables added after the initial Supabase type generation.
// When types are regenerated via `supabase gen types`, delete this file.

export type PrivateConsultationRow = {
  id: string;
  patient_user_id: string;
  consult_type: string;
  preferred_dates: string[];
  message: string | null;
  status: string;
  created_at: string;
};

export type PatientAchievementRow = {
  id: string;
  user_id: string;
  achievement_key: string;
  unlocked_at: string;
};

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  created_at: string;
};

export type MenstrualCycleRow = {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string | null;
  flow_intensity: string | null;
  symptoms: string[];
  notes: string | null;
  created_at: string;
};

export type PreventiveReminderRow = {
  id: string;
  user_id: string;
  exam_key: string;
  last_done_date: string | null;
  notes: string | null;
};

export type CorporateLeadRow = {
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

export type CorporateAccountRow = {
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

export type SementinhasLedgerRow = {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  dedupe_key: string | null;
  created_at: string;
};

// Typed helper that casts the Supabase admin client to support new tables.
// Usage: `const db = typedDb(supabaseAdmin);`
export function typedDb(client: SupabaseClient) {
  return client as SupabaseClient & {
    from(table: "private_consultations"): ReturnType<SupabaseClient["from"]>;
    from(table: "patient_achievements"): ReturnType<SupabaseClient["from"]>;
    from(table: "push_subscriptions"): ReturnType<SupabaseClient["from"]>;
    from(table: "menstrual_cycles"): ReturnType<SupabaseClient["from"]>;
    from(table: "preventive_reminders"): ReturnType<SupabaseClient["from"]>;
    from(table: "corporate_leads"): ReturnType<SupabaseClient["from"]>;
    from(table: "corporate_accounts"): ReturnType<SupabaseClient["from"]>;
    from(table: "sementinhas_ledger"): ReturnType<SupabaseClient["from"]>;
    from(table: "cantinho_items"): ReturnType<SupabaseClient["from"]>;
  };
}
