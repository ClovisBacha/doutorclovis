/**
 * Assinatura de Web Push (lado do cliente).
 *
 * Cria a inscrição no navegador (`pushManager.subscribe`) e guarda em
 * `push_subscriptions` (RLS: a paciente só mexe nas próprias linhas). O envio
 * das notificações é feito no servidor com a chave VAPID privada — aqui só
 * usamos a chave PÚBLICA (`VITE_VAPID_PUBLIC_KEY`).
 *
 * Ressalvas de plataforma:
 * - iOS só entrega push se o app estiver INSTALADO na Tela de Início
 *   (iOS 16.4+). No Safari comum não funciona — detectamos e avisamos.
 * - Sem `VITE_VAPID_PUBLIC_KEY` configurada, a inscrição não acontece.
 */

import { supabase } from "@/integrations/supabase/client";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function vapidPublicKey(): string | undefined {
  const k = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_VAPID_PUBLIC_KEY;
  return k && k.trim() ? k.trim() : undefined;
}

export type PushSupport = { ok: boolean; reason?: string };

/** Diz se o navegador atual consegue receber push (e por que não, se for o caso). */
export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return { ok: false, reason: "ssr" };
  if (!("serviceWorker" in navigator)) return { ok: false, reason: "no-sw" };
  if (!("PushManager" in window)) return { ok: false, reason: "no-push" };
  if (!("Notification" in window)) return { ok: false, reason: "no-notif" };
  const isIos = /iP(hone|ad|od)/.test(navigator.userAgent);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (isIos && !standalone) return { ok: false, reason: "ios-not-installed" };
  return { ok: true };
}

/**
 * Pede permissão, inscreve no push e salva no banco. Retorna `{ ok }` ou um
 * motivo (`no-key`, `denied`, `ios-not-installed`, ...) pra UI orientar.
 */
export async function subscribeToPush(): Promise<PushSupport> {
  const sup = pushSupport();
  if (!sup.ok) return sup;
  const key = vapidPublicKey();
  if (!key) return { ok: false, reason: "no-key" };

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "denied" };

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    }));

  const json = sub.toJSON();
  const endpoint = sub.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) return { ok: false, reason: "bad-sub" };

  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false, reason: "no-session" };

  const { error } = await (
    supabase as unknown as {
      from: (t: string) => {
        upsert: (v: unknown, o: unknown) => Promise<{ error: unknown }>;
      };
    }
  )
    .from("push_subscriptions")
    .upsert(
      { user_id: u.user.id, endpoint, p256dh, auth_key: auth },
      { onConflict: "user_id,endpoint" },
    );
  if (error) return { ok: false, reason: "db" };
  return { ok: true };
}

/** Cancela a inscrição no navegador e remove a linha do banco. */
export async function unsubscribeFromPush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      await (
        supabase as unknown as {
          from: (t: string) => {
            delete: () => {
              eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<unknown> };
            };
          };
        }
      )
        .from("push_subscriptions")
        .delete()
        .eq("user_id", u.user.id)
        .eq("endpoint", endpoint);
    }
  } catch {
    /* best-effort */
  }
}
