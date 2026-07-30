/**
 * Endereços de atendimento do médico.
 *
 * Tabela e não coluna porque médico com dois consultórios é a regra, não a
 * exceção — e a paciente precisa ver o mais perto dela, o que exige uma linha
 * por endereço com cidade própria. Um campo de texto com "Savassi e Nova Lima"
 * não responde "qual dos dois é perto de mim?" nem "para qual eu ligo?".
 *
 * O médico administra os próprios; qualquer pessoa logada lê os de médicos
 * ativos (é o que a busca e a tela de consulta precisam). As duas regras são
 * de RLS, não daqui — estas funções usam o service_role e checam o dono na mão
 * porque precisam funcionar também no cadastro, antes de a sessão do médico
 * existir de fato.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type DoctorAddress = {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  notes: string;
  is_primary: boolean;
  position: number;
};

const COLS = "id,label,street,city,state,zip,phone,notes,is_primary,position";

const AddressSchema = z.object({
  /** Vazio = criar. Preenchido = editar aquele endereço. */
  id: z.string().uuid().optional(),
  label: z.string().max(120).default(""),
  street: z.string().max(240).default(""),
  city: z.string().max(120).default(""),
  state: z.string().max(2).default(""),
  zip: z.string().max(20).default(""),
  phone: z.string().max(40).default(""),
  notes: z.string().max(240).default(""),
  is_primary: z.boolean().default(false),
  position: z.number().int().min(0).max(50).default(0),
});

async function requireUser(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user;
}

/** Endereços do médico logado, na ordem que ele escolheu. */
export const listMyAddresses = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const vazio = { ok: true as const, addresses: [] as DoctorAddress[] };
    try {
      const user = await requireUser(data.accessToken);
      if (!user) return vazio;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows, error } = await (supabaseAdmin as any)
        .from("doctor_addresses")
        .select(COLS)
        .eq("doctor_id", user.id)
        .order("position", { ascending: true });
      // Tabela ainda não migrada: lista vazia em vez de tela quebrada.
      if (error) return vazio;
      return { ok: true as const, addresses: (rows ?? []) as DoctorAddress[] };
    } catch {
      return vazio;
    }
  });

/**
 * Endereços de um médico QUALQUER — o que a paciente vê antes de escolher e
 * depois, para saber onde é a consulta. Só de médicos ativos.
 */
export const listDoctorAddresses = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ doctorId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: doc } = await (supabaseAdmin as any)
        .from("doctors")
        .select("id,active")
        .eq("id", data.doctorId)
        .maybeSingle();
      if (!doc?.active) return { ok: true as const, addresses: [] as DoctorAddress[] };
      const { data: rows } = await (supabaseAdmin as any)
        .from("doctor_addresses")
        .select(COLS)
        .eq("doctor_id", data.doctorId)
        .order("position", { ascending: true });
      return { ok: true as const, addresses: (rows ?? []) as DoctorAddress[] };
    } catch {
      return { ok: true as const, addresses: [] as DoctorAddress[] };
    }
  });

/** Cria ou atualiza um endereço do médico logado. */
export const saveMyAddress = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), address: AddressSchema }).parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { id, ...campos } = data.address;
    const linha = { ...campos, state: campos.state.toUpperCase(), doctor_id: user.id };

    try {
      /* Um só primário: marcar um desmarca os outros. Sem isto a paciente
         veria dois "endereço principal" e não saberia para onde ir. */
      if (linha.is_primary) {
        await sb.from("doctor_addresses").update({ is_primary: false }).eq("doctor_id", user.id);
      }
      if (id) {
        // `.eq("doctor_id")` junto do id: o dono é conferido na consulta, não
        // confiado no que veio do cliente.
        const { error } = await sb
          .from("doctor_addresses")
          .update(linha)
          .eq("id", id)
          .eq("doctor_id", user.id);
        return { ok: !error };
      }
      const { error } = await sb.from("doctor_addresses").insert(linha);
      return { ok: !error };
    } catch {
      return { ok: false as const };
    }
  });

/** Apaga um endereço do médico logado. */
export const deleteMyAddress = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("doctor_addresses")
      .delete()
      .eq("id", data.id)
      .eq("doctor_id", user.id);
    return { ok: !error };
  });
