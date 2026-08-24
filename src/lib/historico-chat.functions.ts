/**
 * O histórico da conversa da paciente, para a TELA.
 *
 * ─── O defeito que isto conserta ────────────────────────────────────────
 *
 * Tudo o que a paciente conversou já era guardado em `chat_messages`, e o
 * servidor reconstruía as últimas 12 a cada mensagem — é por isso que a IA
 * lembra do que foi dito ontem.
 *
 * A tela, não. O chat abria com uma saudação e mais nada, toda vez. A paciente
 * perguntava sobre uma dor na terça, voltava na quinta e não encontrava a
 * resposta que tinha recebido — enquanto a IA continuava lembrando.
 *
 * É um defeito estranho de perceber e fácil de descrever: **a IA lembra e ela
 * não.** Para uma gestante que quer reler a orientação que recebeu, o app
 * perdia a própria conversa.
 *
 * ─── Por que uma função de servidor, e não leitura direta ───────────────
 *
 * `chat_messages` guarda o que a paciente contou de mais íntimo — e a mesma
 * linha carrega `doctor_id`. Abrir a tabela ao navegador com a chave anônima
 * exigiria confiar a separação inteiramente à RLS, para um dado em que o custo
 * de errar é alto. Aqui a leitura é sempre pela sessão de quem pede, e devolve
 * só o que é dela.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type MensagemDoHistorico = {
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

/**
 * Quantas mensagens a tela recebe ao abrir.
 *
 * Bem mais que as 12 que vão ao MODELO, e de propósito: o limite do modelo
 * existe por custo de token, e ler não custa token nenhum. Sessenta cobre
 * várias semanas de conversa sem transformar a abertura do chat numa
 * transferência grande.
 */
const LIMITE_PADRAO = 60;

export const historicoDaConversa = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        limite: z.number().int().min(1).max(200).default(LIMITE_PADRAO),
      })
      .parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; mensagens: MensagemDoHistorico[] }> => {
    const vazio = { ok: false, mensagens: [] as MensagemDoHistorico[] };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
      if (!u.user) return vazio;

      /* Ordena DESC para pegar as mais recentes, e inverte depois: pegar as 60
         primeiras por ordem crescente traria o começo da gravidez e deixaria de
         fora justamente a conversa de ontem. */
      const { data: linhas, error } = await (supabaseAdmin as any)
        .from("chat_messages")
        .select("role, content, created_at")
        .eq("patient_id", u.user.id)
        .order("created_at", { ascending: false })
        .limit(data.limite);
      if (error) return vazio;

      const mensagens = ((linhas ?? []) as MensagemDoHistorico[])
        .filter((m) => (m.role === "user" || m.role === "assistant") && m.content?.trim())
        .reverse();

      return { ok: true, mensagens };
    } catch {
      /* Tabela ausente ou banco fora do ar: o chat abre vazio, como antes.
         Perder o histórico é ruim; impedir a paciente de conversar é pior. */
      return vazio;
    }
  });
