/**
 * Configuração pública do app. Nada aqui é segredo: a URL e a chave
 * "publishable" do Supabase já vão para o navegador em todo deploy do site
 * (estão preenchidas no .env.example versionado). A segurança dos dados é a
 * RLS do banco e o token de cada paciente — nunca esconder a chave anon.
 */
export const SITE = process.env.EXPO_PUBLIC_SITE_URL ?? "https://www.obstetrica.com.br";

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://zqmqbnwvrmeabnmaaxfr.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_j8bs67itJ-3Ud_K2mTTrHA_MvT4CAlu";

/** Telefones de emergência — valem em qualquer cidade e sem internet. */
export const SAMU = "192";
export const BOMBEIROS = "193";
export const CVV = "188";
