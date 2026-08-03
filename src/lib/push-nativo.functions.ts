/**
 * Guarda o token de push do aparelho.
 *
 * Passa pelo servidor por um motivo só, e ele é de segurança: **um token
 * pertence a um aparelho, não a uma pessoa.** Quando outra conta entra no mesmo
 * celular — a paciente que empresta o telefone, o médico que abre a conta de
 * teste —, a linha antiga tem que sair, senão os avisos da primeira continuam
 * chegando ali. Num app de gestação de alto risco isso não é inconveniente de
 * interface: é dado de saúde entregue à pessoa errada.
 *
 * A RLS impede — de propósito — que o navegador apague a linha de outra pessoa.
 * Então a troca de dono só é possível com a chave de serviço, aqui.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const registrarTokenNativo = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        /* Tokens de APNs têm 64 hex; os do FCM passam de 150 caracteres e não
           têm tamanho fixo. O teto existe para não aceitar um corpo enorme. */
        token: z.string().min(20).max(4096),
        plataforma: z.string().max(16),
      })
      .parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
      if (!u.user) return { ok: false, reason: "no-session" };

      const sb = supabaseAdmin as any;

      /* Este token deixa de ser de quem quer que fosse antes. `neq` no user_id
         para não apagar a própria linha que estamos prestes a gravar. */
      await sb
        .from("native_push_tokens")
        .delete()
        .eq("token", data.token)
        .neq("user_id", u.user.id);

      const { error } = await sb.from("native_push_tokens").upsert(
        {
          user_id: u.user.id,
          token: data.token,
          platform: data.plataforma === "ios" ? "ios" : "android",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "token" },
      );
      if (error) return { ok: false, reason: "db" };
      return { ok: true };
    } catch {
      /* Tabela ainda não migrada, banco fora do ar: o app não pode quebrar por
         não conseguir registrar um aviso. */
      return { ok: false, reason: "indisponivel" };
    }
  });
