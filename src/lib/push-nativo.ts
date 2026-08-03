/**
 * Push no app nativo — o caminho que o Web Push nunca vai cobrir.
 *
 * ─── Por que existe um segundo caminho ──────────────────────────────────
 *
 * O Web Push que já está no ar (`src/lib/push.ts`) funciona no Android e, no
 * iPhone, **só com o site instalado na Tela de Início** (iOS 16.4+). É a
 * limitação que o cartão do médico já explica em português, e ela é dura: quem
 * não instalou não recebe aviso de consulta, e nunca vai saber que não recebe.
 *
 * Dentro da casca nativa isso muda de natureza. O `WKWebView` do app **não tem
 * Web Push** — não é questão de instalar, não existe. Quem entrega ali é o APNs
 * (iOS) e o FCM (Android), e o que se registra não é um endpoint de navegador:
 * é um TOKEN do aparelho.
 *
 * São, então, duas rotas de entrega para a mesma pergunta ("avise esta
 * pessoa"), e o servidor tenta as duas (`sendPushToUser` em `push.server.ts`).
 * A mesma pessoa pode ter as duas: o site no computador e o app no celular.
 *
 * ─── O que este arquivo NÃO decide ──────────────────────────────────────
 *
 * Nada sobre o conteúdo do aviso. Ele só registra o aparelho. Os gatilhos (SOS,
 * consulta, vaga liberada, paciente nova) continuam exatamente onde estavam —
 * é justamente por isso que ligar o push nativo não exige tocar em nenhum deles.
 */

import { supabase } from "@/integrations/supabase/client";
import { ehNativo, plataforma } from "@/lib/nativo";
import { registrarTokenNativo } from "@/lib/push-nativo.functions";

export type ResultadoPush = { ok: boolean; reason?: string };

/**
 * Registra este aparelho para receber push nativo.
 *
 * Precisa de um gesto do usuário como qualquer permissão — pedir sem explicar é
 * o jeito mais rápido de a pessoa negar para sempre, e no iOS negar é
 * definitivo pela interface do app.
 */
export async function inscreverPushNativo(): Promise<ResultadoPush> {
  if (!ehNativo()) return { ok: false, reason: "nao-nativo" };
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const atual = await PushNotifications.checkPermissions();
    const perm = atual.receive === "granted" ? atual : await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return { ok: false, reason: "denied" };

    const token = await esperarToken(PushNotifications);
    if (!token) return { ok: false, reason: "sem-token" };

    const { data: s } = await supabase.auth.getSession();
    const accessToken = s.session?.access_token;
    if (!accessToken) return { ok: false, reason: "no-session" };

    /* Pelo SERVIDOR, e não direto na tabela: um token pertence a UM aparelho, e
       quando outra conta entra no mesmo aparelho a linha antiga precisa sair.
       A RLS impede — de propósito — que o navegador apague a linha de outra
       pessoa, então essa limpeza só é possível com a chave de serviço. Sem ela,
       o push de uma gestante chegaria no aparelho de quem entrou depois: isso é
       vazamento de dado de saúde, não inconveniente de interface. */
    const r = await registrarTokenNativo({
      data: { accessToken, token, plataforma: plataforma() },
    });
    return r.ok ? { ok: true } : { ok: false, reason: r.reason };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/**
 * O token não volta de `register()`: ele chega por EVENTO, e pode demorar — o
 * aparelho fala com a Apple ou com o Google antes. Daí a promessa com prazo:
 * sem ela, uma rede ruim deixaria o botão girando para sempre.
 */
async function esperarToken(
  Push: typeof import("@capacitor/push-notifications").PushNotifications,
): Promise<string | null> {
  const vivos: Array<{ remove: () => Promise<void> }> = [];
  try {
    return await new Promise<string | null>((resolve) => {
      let respondeu = false;
      const fim = (t: string | null) => {
        if (respondeu) return;
        respondeu = true;
        resolve(t);
      };
      void Push.addListener("registration", (t) => fim(t.value)).then((h) => vivos.push(h));
      void Push.addListener("registrationError", () => fim(null)).then((h) => vivos.push(h));
      void Push.register().catch(() => fim(null));
      setTimeout(() => fim(null), 15000);
    });
  } finally {
    /* Sem isto, cada tentativa deixa dois ouvintes para trás e a próxima
       resolve com o token da anterior. */
    for (const h of vivos) void h.remove().catch(() => {});
  }
}

/** Já tem permissão concedida neste aparelho? Usado para renovar o token. */
export async function pushNativoJaAutorizado(): Promise<boolean> {
  if (!ehNativo()) return false;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    return (await PushNotifications.checkPermissions()).receive === "granted";
  } catch {
    return false;
  }
}
