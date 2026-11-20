/**
 * Acionamentos de SOS, do lado do médico.
 *
 * Existe porque o SOS avisava por e-mail e push e mais nada: se o médico não
 * viu a notificação naquele minuto, aquilo nunca aconteceu para ele. O evento
 * ficava gravado numa tabela que a política de acesso nem deixava ele ler.
 *
 * A ideia de "marcar como visto no link" foi descartada, e por um motivo de
 * realidade: numa emergência ninguém clica em "visto" — a pessoa LIGA. Então o
 * desfecho que registramos é o que de fato acontece depois, marcado com calma no
 * painel, e o que aparece na hora é um aviso impossível de ignorar.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { faltaNoBanco } from "@/lib/postgrest";

/**
 * Retrato clínico congelado no instante do disparo.
 *
 * Campos explícitos e não `Record<string, unknown>`: o verificador de
 * serialização do TanStack recusa `unknown`, e — mais importante — um formato
 * frouxo aqui viraria uma tela que exibe o que vier, incluindo o que mudou de
 * nome no meio do caminho. O que é congelado tem que ter forma conhecida.
 */
export type FichaCongelada = {
  nome?: string | null;
  telefone?: string | null;
  bebe?: string | null;
  semana?: string | null;
  dpp?: string | null;
  sangue?: string | null;
  alergias?: string | null;
  medicamentos?: string | null;
  contato?: string | null;
  contatoTel?: string | null;
  medico?: string | null;
  medicoTel?: string | null;
  endereco?: string | null;
  avisados?: { nome: string; via: string }[];
};

/** O que de fato saiu, e para quem. */
export type CanaisSalvos = {
  push?: boolean;
  medicoEmail?: boolean;
  contatoEmail?: boolean;
  sms?: boolean;
  whatsapp?: boolean;
  faltou?: string | null;
  destinos?: { nome: string; via: string }[];
};

export type AcionamentoSos = {
  id: string;
  created_at: string;
  paciente: string | null;
  paciente_id: string;
  motivo: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  atendido_em: string | null;
  ficha: FichaCongelada | null;
  channels: CanaisSalvos | null;
};

const COLS = "id,created_at,user_id,motivo,latitude,longitude,address,atendido_em,ficha,channels";

async function medicoDaSessao(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: u } = await supabaseAdmin.auth.getUser(accessToken);
  if (!u.user) return null;
  const { data: doc } = await (supabaseAdmin as any)
    .from("doctors")
    .select("id,active")
    .eq("id", u.user.id)
    .maybeSingle();
  return doc && doc.active !== false ? u.user : null;
}

/**
 * Pacientes que são dele AGORA — e não as que já foram.
 *
 * `panic_events.doctor_id` é carimbado no instante do disparo e nunca
 * revisitado. Encerrar o acompanhamento zera `patient_profiles.doctor_id`, mas
 * o carimbo antigo continuava abrindo a porta: o ex-médico seguia vendo a ficha
 * congelada do SOS dela — nome, telefone, tipo sanguíneo, alergias,
 * medicamentos, contato de emergência — e as coordenadas de onde ela estava.
 *
 * O painel já promete isso por escrito à paciente em outra tela ("os dados dela
 * deixam de ser seus quando isso acontece"). Aqui a promessa passa a valer.
 *
 * A linha continua no banco: retenção de prontuário é obrigação legal (CFM),
 * e guardar não é a mesma coisa que renderizar no painel todo dia. O que se
 * corta é a leitura pela interface, não o registro.
 *
 * ⚠️ `supabase-js` não lança: devolve `{ data, error }`, e esta leitura
 * ignorava o `error` — um array vazio significa duas coisas opostas: "este
 * médico não tem paciente vinculada" e "não consegui ler quais são". Um
 * timeout aqui fazia `listarAcionamentos`/`acionamentosDaPaciente` devolverem
 * `vazio` (com `ok: true`), e o painel de SOS — o único caminho pelo qual o
 * médico sabe que uma paciente apertou o botão de emergência, com a
 * localização e a ficha clínica congelada — dizia "nenhuma emergência"
 * quando o que houve foi "não consegui olhar". Mesma classe que
 * `clinical.functions.ts` (`pacientesAtuaisComEstado`) e
 * `secondbrain.functions.ts` (`listUnansweredQuestions`) já fecharam para a
 * fila de perguntas e a lista de eventos clínicos. `id`/`doctor_id` em
 * `patient_profiles` são colunas da primeira migration — não há "coluna
 * ausente" legítima aqui, só falha de leitura de verdade.
 */
async function pacientesAtuaisComEstado(
  doctorId: string,
): Promise<{ ids: string[]; falhou: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("patient_profiles")
    .select("id")
    .eq("doctor_id", doctorId);
  return { ids: ((data ?? []) as { id: string }[]).map((p) => p.id), falhou: !!error };
}

/**
 * Acionamentos das pacientes DESTE médico, mais recentes primeiro.
 *
 * `desde` existe para o painel poder perguntar "tem algo novo?" sem baixar o
 * histórico inteiro a cada minuto.
 */
export const listarAcionamentos = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        limite: z.number().int().min(1).max(200).default(50),
        apenasPendentes: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const vazio = { ok: true as const, acionamentos: [] as AcionamentoSos[] };
    const user = await medicoDaSessao(data.accessToken);
    if (!user) return { ok: false as const, acionamentos: [] as AcionamentoSos[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const falhouAoOlhar = { ok: false as const, acionamentos: [] as AcionamentoSos[] };
    try {
      const { ids: atuais, falhou: vinculoFalhou } = await pacientesAtuaisComEstado(user.id);
      if (vinculoFalhou) {
        console.error("[acionamentos] vínculo não carregou; painel de SOS não é confiável");
        return falhouAoOlhar;
      }
      if (atuais.length === 0) return vazio;
      /* EM LOTES DE 100: `.in()` viaja na query string, e uma lista longa
         estoura o buffer do proxy — devolvendo 414, que aqui viraria "nenhuma
         emergência". Cortar a lista em 100 seria pior ainda: esconderia em
         silêncio o SOS de quem tem carteira grande. */
      const rows: Record<string, unknown>[] = [];
      for (let i = 0; i < atuais.length; i += 100) {
        let q = (supabaseAdmin as any)
          .from("panic_events")
          .select(COLS)
          .eq("doctor_id", user.id)
          // O vínculo ATUAL, além do carimbo: quem deixou de ser paciente dele
          // sai desta lista no mesmo instante.
          .in("user_id", atuais.slice(i, i + 100))
          .order("created_at", { ascending: false })
          .limit(data.limite);
        if (data.apenasPendentes) q = q.is("atendido_em", null);
        const { data: parte, error } = await q;
        /* Coluna/tabela ausente (migração ainda não chegou a este banco):
           lista vazia em vez de painel quebrado — degradação legítima.
           Qualquer OUTRO erro (timeout, RLS, rede) é falha de verdade, e
           dizer "nenhuma emergência" sobre ela é o mesmo defeito que o
           vínculo tinha: "não consegui olhar" com a cara de "não há nada". */
        if (error) {
          if (faltaNoBanco(error)) return vazio;
          console.error("[acionamentos] panic_events não carregou", error);
          return falhouAoOlhar;
        }
        rows.push(...((parte ?? []) as Record<string, unknown>[]));
      }
      rows.sort((a, b) => (String(a.created_at) < String(b.created_at) ? 1 : -1));
      rows.splice(data.limite);

      /* Os nomes das pacientes numa consulta só. Um `select` por linha viraria
         cinquenta idas ao banco para desenhar uma lista. */
      const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id).filter(Boolean)));
      const nomes = new Map<string, string>();
      if (ids.length) {
        const { data: ps } = await (supabaseAdmin as any)
          .from("patient_profiles")
          .select("id,display_name")
          .in("id", ids);
        for (const p of (ps ?? []) as any[]) nomes.set(p.id, p.display_name ?? "");
      }

      return {
        ok: true as const,
        acionamentos: (rows ?? []).map((r: any) => ({
          id: r.id,
          created_at: r.created_at,
          paciente: nomes.get(r.user_id) ?? null,
          paciente_id: r.user_id,
          motivo: r.motivo ?? null,
          latitude: r.latitude ?? null,
          longitude: r.longitude ?? null,
          address: r.address ?? null,
          atendido_em: r.atendido_em ?? null,
          ficha: r.ficha ?? null,
          channels: r.channels ?? null,
        })) as AcionamentoSos[],
      };
    } catch (e) {
      /* Uma exceção não pega (rede caiu no meio do laço, por exemplo) é a
         MESMA falha de verdade que o `if (error)` acima — nunca "nenhuma
         emergência". */
      console.error("[acionamentos] exceção ao montar a lista de SOS", e);
      return falhouAoOlhar;
    }
  });

/**
 * Marca um acionamento como atendido.
 *
 * Não é "visto" — é "eu resolvi isto". O médico marca depois de ligar, com
 * calma, e é essa marca que faz o aviso parar de aparecer na tela dele.
 */
export const marcarAcionamentoAtendido = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const user = await medicoDaSessao(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // `doctor_id` no próprio WHERE: um id de outro consultório não afeta linha
    // nenhuma, sem checagem separada que abriria corrida.
    const { data: mexeu, error } = await (supabaseAdmin as any)
      .from("panic_events")
      .update({ atendido_em: new Date().toISOString(), atendido_por: user.id })
      .eq("id", data.id)
      .eq("doctor_id", user.id)
      .select("id");
    return error || !mexeu?.length ? { ok: false as const } : { ok: true as const };
  });

/** Acionamentos de UMA paciente — para a ficha dela no painel. */
export const acionamentosDaPaciente = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), pacienteId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const vazio = { ok: true as const, acionamentos: [] as AcionamentoSos[] };
    const falhouAoOlhar = { ok: false as const, acionamentos: [] as AcionamentoSos[] };
    const user = await medicoDaSessao(data.accessToken);
    if (!user) return { ok: false as const, acionamentos: [] as AcionamentoSos[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      /* Vínculo atual antes de qualquer leitura: depois de encerrado o
         acompanhamento, esta consulta não devolve mais nada. */
      const { ids: atuais, falhou: vinculoFalhou } = await pacientesAtuaisComEstado(user.id);
      if (vinculoFalhou) {
        console.error("[acionamentos] vínculo não carregou; ficha de SOS não é confiável");
        return falhouAoOlhar;
      }
      if (!atuais.includes(data.pacienteId)) return vazio;
      const { data: rows, error } = await (supabaseAdmin as any)
        .from("panic_events")
        .select(COLS)
        // Os dois filtros juntos: a paciente pedida E do médico logado.
        .eq("user_id", data.pacienteId)
        .eq("doctor_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        if (faltaNoBanco(error)) return vazio;
        console.error("[acionamentos] panic_events da paciente não carregou", error);
        return falhouAoOlhar;
      }
      return {
        ok: true as const,
        acionamentos: (rows ?? []).map((r: any) => ({
          id: r.id,
          created_at: r.created_at,
          paciente: null,
          paciente_id: r.user_id,
          motivo: r.motivo ?? null,
          latitude: r.latitude ?? null,
          longitude: r.longitude ?? null,
          address: r.address ?? null,
          atendido_em: r.atendido_em ?? null,
          ficha: r.ficha ?? null,
          channels: r.channels ?? null,
        })) as AcionamentoSos[],
      };
    } catch (e) {
      console.error("[acionamentos] exceção ao montar o SOS da paciente", e);
      return falhouAoOlhar;
    }
  });
