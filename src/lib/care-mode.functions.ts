import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Modo Cuidado 🤍 — pausa ética da gamificação.
 *
 * Quando ativo, o servidor NÃO concede Sementinhas nem comemora, e o cliente
 * troca a experiência festiva por acolhimento. É um estado da paciente, que ela
 * ativa/desativa quando quiser. Nada é deletado — só pausado.
 */

/** Lê care_mode do perfil (server-only). Usado para suprimir ganho/comemoração. */
/**
 * ⚠️ **ESTE LEITOR FALHAVA ABERTO, e ele e o canonico do servidor.**
 *
 * O `error` era descartado: qualquer falha de leitura — rede, RLS, tempo
 * esgotado — deixava `data` nulo, `?.care_mode` virava `undefined`, e
 * `Boolean(undefined)` e **`false`**, que aqui significa "ela NAO esta de
 * luto". Vinte e duas chamadas em doze modulos herdavam isso.
 *
 * O que essas chamadas fazem com a resposta e sempre a mesma coisa: o Modo
 * Cuidado SUPRIME (jogo, Sementinhas, push, confete) e nunca concede nada. Logo
 * a assimetria e brutal:
 *
 *   · falhar ABERTO = quem acabou de perder a gestacao recebe "+5 🌱", confete
 *     e um push sobre o bebe, porque uma consulta deu timeout;
 *   · falhar FECHADO = quem NAO esta de luto deixa de ganhar um bonus.
 *
 * O primeiro e o defeito que o Modo Cuidado inteiro existe para impedir. Entao
 * "nao sei" CALA — a mesma regua de `conjuntoDeBloqueio` e de `podeMostrarNps`.
 *
 * ⚠️ **E O CASO DE ZERO LINHAS E DIFERENTE DE UMA FALHA.** `.single()` devolve
 * `PGRST116` quando nao ha linha nenhuma — o que acontece com toda paciente
 * antes de o perfil existir. Tratar isso como luto calaria a gamificacao de
 * toda conta nova, para sempre. Sem perfil nao ha `care_mode` marcado, e isso e
 * "nao esta de luto", nao "nao sei".
 */
export async function isCareModeActive(client: SupabaseClient, uid: string): Promise<boolean> {
  const { data, error } = await client
    .from("patient_profiles")
    .select("care_mode")
    .eq("id", uid)
    .single();
  if (error) {
    /* Zero linhas: o perfil ainda nao existe. Nao e luto, e nao e duvida. */
    if ((error as { code?: string }).code === "PGRST116") return false;
    /* Qualquer outra coisa e "nao consegui ler" — e aqui isso CALA.
       Registrado porque silencio total e o que impede alguem de descobrir que a
       gamificacao parou: se este log aparecer em serie, o problema e a leitura,
       nao o produto. */
    console.error("[modo-cuidado] nao consegui ler o perfil — calando por seguranca", uid, error);
    return true;
  }
  return Boolean((data as { care_mode?: boolean } | null)?.care_mode);
}

export const getCareMode = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !u.user) return { ok: false as const, error: "Não autenticado" };
    return { ok: true as const, careMode: await isCareModeActive(supabaseAdmin, u.user.id) };
  });

export const setCareMode = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), on: z.boolean() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !u.user) return { ok: false as const, error: "Não autenticado" };
    const patch = {
      care_mode: data.on,
      care_mode_since: data.on ? new Date().toISOString() : null,
    };
    const { error: upErr } = await (
      supabaseAdmin.from("patient_profiles") as unknown as {
        update: (v: typeof patch) => {
          eq: (col: string, val: string) => Promise<{ error: unknown }>;
        };
      }
    )
      .update(patch)
      .eq("id", u.user.id);
    if (upErr) return { ok: false as const, error: "Falha ao salvar" };
    return { ok: true as const, careMode: data.on };
  });
