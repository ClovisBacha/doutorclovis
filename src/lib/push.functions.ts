import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Envia uma notificação de teste para a própria paciente (resolvida pelo
 * accessToken). Serve para validar a entrega ponta a ponta depois que as
 * chaves VAPID estiverem configuradas.
 */
export const sendTestPushToMe = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !u.user) return { ok: false as const, reason: "auth" };

    const { sendPushToUser, pushConfigured } = await import("@/lib/push.server");
    if (!pushConfigured()) return { ok: false as const, reason: "not-configured" };

    const res = await sendPushToUser(u.user.id, {
      title: "Notificações ativas 🔔",
      body: "Prontinho! Você vai receber os lembretes da sua gestação por aqui. 💛",
      url: "/minha-conta",
    });
    return {
      ok: res.sent > 0,
      reason: res.sent > 0 ? undefined : "no-subscription",
      sent: res.sent,
    };
  });
