/**
 * OS FILHOS — servidor.
 *
 * A régua (quem é gêmeo, como se escreve a idade, o que vai na linha do perfil)
 * mora em `filhos.ts`, pura e testada. Aqui é só a porta do banco.
 *
 * ⚠️ **TUDO PASSA POR `user_id` DA SESSÃO.** O `id` do filho vem do cliente em
 * duas funções; sem o recorte, um uuid forjado editaria ou apagaria o filho de
 * outra paciente — e isto é dado de criança, no app de um consultório.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Filho } from "./filhos";

/** Quantos filhos uma conta pode ter. Teto sóbrio contra o dedo preso. */
export const MAXIMO_DE_FILHOS = 12;

async function pacienteDaSessao(accessToken: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any).auth.getUser(accessToken);
  return data?.user?.id ?? null;
}

function daLinha(l: any): Filho {
  return {
    id: l.id,
    nome: l.nome ?? null,
    sexo: (l.sexo as "f" | "m" | null) ?? null,
    nascidoEm: l.nascido_em ?? null,
    previstoPara: l.previsto_para ?? null,
  };
}

/**
 * ⚠️ **A FALHA DE LEITURA DEVOLVE `null`, NUNCA `[]`.**
 *
 * Lista vazia quer dizer "ela não cadastrou filho nenhum", e a tela desenha o
 * convite para cadastrar. Um erro de rede virando lista vazia faria a tela
 * dizer a uma mãe de três que ela não tem filhos — e, pior, a linha do perfil
 * sumiria como se ela tivesse apagado tudo.
 */
export async function lerFilhos(sb: any, userId: string): Promise<Filho[] | null> {
  const { data, error } = await sb
    .from("patient_filhos")
    .select("id, nome, sexo, nascido_em, previsto_para")
    .eq("user_id", userId)
    .order("nascido_em", { ascending: true, nullsFirst: false })
    .order("criado_em", { ascending: true });
  if (error) return null;
  return ((data ?? []) as any[]).map(daLinha);
}

export const meusFilhos = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const filhos = await lerFilhos(supabaseAdmin as any, eu);
    if (!filhos) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const, filhos };
  });

const CorpoDoFilho = z.object({
  accessToken: z.string().min(10),
  /** Ausente = nasce um novo. Presente = edita aquele, se for dela. */
  id: z.string().uuid().optional(),
  nome: z.string().max(40).nullable().optional(),
  sexo: z.enum(["f", "m"]).nullable().optional(),
  /** `YYYY-MM-DD`. */
  nascidoEm: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  previstoPara: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export const salvarFilho = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => CorpoDoFilho.parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const campos: Record<string, unknown> = {};
    if (data.nome !== undefined) campos.nome = data.nome?.trim() || null;
    if (data.sexo !== undefined) campos.sexo = data.sexo;
    if (data.nascidoEm !== undefined) campos.nascido_em = data.nascidoEm;
    if (data.previstoPara !== undefined) campos.previsto_para = data.previstoPara;

    if (data.id) {
      /* ⚠️ `.eq("user_id", eu)` é o portão: o id vem do cliente. */
      const { error } = await sb
        .from("patient_filhos")
        .update(campos)
        .eq("id", data.id)
        .eq("user_id", eu);
      if (error) return { ok: false as const, motivo: "banco" as const };
      return { ok: true as const };
    }

    /**
     * ⚠️ **O TETO É CONFERIDO NO SERVIDOR, e a contagem vem do banco.**
     * A tela também esconde o botão no limite, mas tela é sugestão: um corpo
     * montado à mão criaria filhos sem fim.
     */
    const { count, error: erroConta } = await sb
      .from("patient_filhos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", eu);
    if (erroConta) return { ok: false as const, motivo: "banco" as const };
    if ((count ?? 0) >= MAXIMO_DE_FILHOS) return { ok: false as const, motivo: "cheio" as const };

    const { error } = await sb.from("patient_filhos").insert({ ...campos, user_id: eu });
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/**
 * REMOVER UM FILHO DA LISTA.
 *
 * ⚠️ **AQUI O `DELETE` É O CERTO, e a razão é o oposto da dos posts.** Um post
 * é arquivado porque as reações apontam para ele; uma linha de filho não tem
 * nada apontando para ela a não ser o marco, que é `ON DELETE SET NULL`.
 *
 * E o caso real é o erro de digitação: ela cadastra "Helena" duas vezes e
 * precisa desfazer. Um "arquivado" invisível deixaria a linha do perfil dizendo
 * "Mãe de 2" para sempre, sem nenhuma tela capaz de explicar por quê.
 *
 * ⚠️ A CONFERÊNCIA DE DONO VEM NO PRÓPRIO `DELETE` (`.eq("user_id", eu)`), e
 * não numa leitura antes: ler-depois-apagar tem uma corrida no meio, e o filtro
 * no comando não tem.
 */
export const removerFilho = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("patient_filhos")
      .delete()
      .eq("id", data.id)
      .eq("user_id", eu);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });
