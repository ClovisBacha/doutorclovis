import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ver .env.example).");
}

/** Cliente do banco PRÓPRIO do DoctorThink (service_role — server-only). */
export const db = createClient(url, key, { auth: { persistSession: false } });
