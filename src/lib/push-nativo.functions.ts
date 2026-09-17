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

/**
 * ESQUECER ESTE APARELHO — o outro lado de `registrarTokenNativo`.
 *
 * ⚠️ **Sem ela, "desligar os avisos" seria um botão que não cumpre.** A marca
 * local impede a RE-inscrição, e só; a linha gravada continua em
 * `native_push_tokens`, e é ela que o servidor lê na hora de enviar. O push
 * continuaria chegando com a tela dizendo que está desligado — que é a classe
 * de defeito que este repositório vem consertando há levas ("diz pronto sem
 * ler o retorno").
 *
 * ⚠️ **Passa pelo SERVIDOR pela MESMA razão que a inscrição passa**: a tabela é
 * escrita com a chave de serviço, e o navegador não tem como apagar a linha.
 *
 * ⚠️ **E o recorte é `(user_id, token)`, nunca só o token.** Apagar por token
 * puro deixaria uma conta remover o aparelho de outra pessoa que tenha usado o
 * mesmo celular — é o simétrico do `neq` que a inscrição já faz.
 */
export const esquecerTokenNativo = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        token: z.string().min(20).max(4096),
      })
      .parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
      if (!u.user) return { ok: false, reason: "no-session" };

      const { error } = await (supabaseAdmin as any)
        .from("native_push_tokens")
        .delete()
        .eq("user_id", u.user.id)
        .eq("token", data.token);

      /* ⚠️ Erro aqui é RECUSA, e não "melhor esforço": a linha sobrevivendo
         significa que o push continua saindo. Quem chama precisa saber para
         não afirmar à paciente que desligou. */
      if (error) return { ok: false, reason: "db" };
      return { ok: true };
    } catch {
      return { ok: false, reason: "indisponivel" };
    }
  });

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
