/**
 * Nível 2 do Google Meet/Agenda: cada médico conecta a PRÓPRIA conta Google
 * (escopo calendar.events) para hospedar as teleconsultas na agenda dele.
 *
 * Fluxo (OAuth próprio, separado do login Supabase):
 *   1. startGoogleCalendarConnect → devolve a URL de consentimento do Google,
 *      com um `state` assinado (HMAC) que amarra o médico + expiração.
 *   2. O Google redireciona para /medicos/google-callback?code&state.
 *   3. finishGoogleCalendarConnect → valida o state, troca o code por um
 *      refresh_token, descobre o e-mail e guarda em doctor_google_tokens
 *      (tabela sem policies: só service_role).
 *
 * O refresh token NUNCA chega ao navegador. O gate é: o chamador precisa ser um
 * médico (linha em `doctors`) ou a equipe da instalação (ADMIN_EMAILS).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Verifica o token e garante que o chamador é médico ou equipe. Retorna o uid. */
async function requireDoctorUser(accessToken: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user?.email) return null;
  if (adminEmails().includes(data.user.email.toLowerCase())) return data.user.id;
  const { data: doc } = await (supabaseAdmin as any)
    .from("doctors")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();
  return doc?.id ? (data.user.id as string) : null;
}

const STATE_TTL_MS = 10 * 60 * 1000; // 10 min para concluir o consentimento

async function signState(userId: string): Promise<string> {
  const { createHmac } = await import("node:crypto");
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-secret";
  const payload = `${userId}.${Date.now() + STATE_TTL_MS}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

/** Valida o state assinado e devolve o uid, ou null se inválido/expirado. */
async function verifyState(state: string): Promise<string | null> {
  try {
    const [payloadB64, sig] = state.split(".");
    if (!payloadB64 || !sig) return null;
    const payload = Buffer.from(payloadB64, "base64url").toString("utf8");
    const { createHmac, timingSafeEqual } = await import("node:crypto");
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-secret";
    const expected = createHmac("sha256", secret).update(payload).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const [userId, expStr] = payload.split(".");
    if (!userId || !expStr) return null;
    if (Number(expStr) < Date.now()) return null;
    return userId;
  } catch {
    return null;
  }
}

const GOOGLE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events"].join(
  " ",
);

/** Passo 1: devolve a URL de consentimento do Google para conectar a Agenda. */
export const startGoogleCalendarConnect = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), origin: z.string().url() }).parse(i),
  )
  .handler(async ({ data }) => {
    const userId = await requireDoctorUser(data.accessToken);
    if (!userId) return { ok: false as const, error: "Não autorizado" };
    const clientId = process.env.GOOGLE_MEET_CLIENT_ID;
    if (!clientId) return { ok: false as const, error: "Google não configurado" };

    const redirectUri = `${data.origin}/medicos/google-callback`;
    const state = await signState(userId);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GOOGLE_SCOPES,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    });
    return { ok: true as const, url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
  });

/** Passo 3: troca o code por refresh_token e guarda por médico. */
export const finishGoogleCalendarConnect = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        code: z.string().min(10),
        state: z.string().min(10),
        origin: z.string().url(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const userId = await verifyState(data.state);
    if (!userId) return { ok: false as const, error: "Sessão de conexão expirada. Tente de novo." };

    const clientId = process.env.GOOGLE_MEET_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_MEET_CLIENT_SECRET;
    if (!clientId || !clientSecret) return { ok: false as const, error: "Google não configurado" };

    const redirectUri = `${data.origin}/medicos/google-callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: data.code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return { ok: false as const, error: "Falha ao autorizar no Google." };
    const tok = (await tokenRes.json()) as { refresh_token?: string; id_token?: string };
    if (!tok.refresh_token) {
      // Sem refresh_token: o Google só devolve na 1ª autorização. Force um novo
      // consentimento (prompt=consent já está na URL) desconectando antes.
      return {
        ok: false as const,
        error: "O Google não devolveu a autorização offline. Desconecte e conecte novamente.",
      };
    }

    // E-mail da conta conectada: vem no id_token (JWT) — decodifica o payload.
    let googleEmail: string | null = null;
    try {
      const payloadB64 = tok.id_token?.split(".")[1];
      if (payloadB64) {
        const json = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
        googleEmail = (json.email as string) ?? null;
      }
    } catch {
      /* e-mail é só informativo */
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("doctor_google_tokens").upsert(
      {
        user_id: userId,
        refresh_token: tok.refresh_token,
        google_email: googleEmail,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) return { ok: false as const, error: "Não foi possível salvar a conexão." };
    return { ok: true as const, email: googleEmail };
  });

/** Status da conexão do médico logado (para a UI do painel). */
export const getGoogleCalendarStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const userId = await requireDoctorUser(data.accessToken);
    if (!userId) return { ok: false as const, connected: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("doctor_google_tokens")
      .select("google_email,connected_at")
      .eq("user_id", userId)
      .maybeSingle();
    return {
      ok: true as const,
      connected: !!row,
      email: (row?.google_email as string | null) ?? null,
    };
  });

/** Desconecta a Agenda do médico logado (apaga o token guardado). */
export const disconnectGoogleCalendar = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const userId = await requireDoctorUser(data.accessToken);
    if (!userId) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("doctor_google_tokens").delete().eq("user_id", userId);
    return { ok: true as const };
  });

/**
 * Resolve o refresh token do Google DAQUELE médico (uso interno do servidor,
 * ex.: teleconsulta). Retorna null se ele não conectou a própria agenda.
 */
export async function getDoctorGoogleRefreshToken(userId: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("doctor_google_tokens")
      .select("refresh_token")
      .eq("user_id", userId)
      .maybeSingle();
    return (row?.refresh_token as string | null) ?? null;
  } catch {
    return null;
  }
}
