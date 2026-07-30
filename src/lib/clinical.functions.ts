/**
 * O prontuário longitudinal, do lado do médico.
 *
 * Antes disto o painel enxergava SEIS tabelas. Triagem de sintomas, contrações
 * cronometradas, acionamento de SOS, exames enviados, glicemia, rastreio de
 * depressão e a série pós-parto inteira eram gravados pela paciente e nunca
 * lidos por ninguém — a triagem VERMELHA, que é o app dizendo a ela "procure
 * atendimento agora", morria no INSERT.
 *
 * Aqui existe UMA leitura: a view `clinical_events` entrega os números crus de
 * todas as fontes com um contrato só, e a gravidade sai de `sinais-clinicos.ts`
 * — a mesma régua que a paciente vê. Nenhum limite clínico mora neste arquivo,
 * de propósito: régua duplicada foi a causa do pior defeito que este produto
 * teve, um app que chamava 35 mg/dL de "Normal" em verde.
 *
 * Recorte: sempre pelo vínculo ATUAL (`patient_profiles.doctor_id`), nunca por
 * um `doctor_id` carimbado na linha de origem. Quem deixou de ser paciente dele
 * some da leitura no mesmo instante — mesmo que o evento tenha nascido na época
 * em que era. A linha continua no banco (retenção de prontuário é obrigação
 * legal); o que se corta é o acesso pela interface.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  piorSinal,
  sinalGlicemia,
  sinalPressao,
  type Gravidade,
  type Sinal,
} from "./sinais-clinicos";

/** Como a tela agrupa. Mesmo vocabulário da view. */
export type EspecieEvento =
  | "medida"
  | "sintoma"
  | "emergencia"
  | "exame"
  | "contracao"
  | "humor"
  | "movimento"
  | "consulta"
  | "pergunta";

/**
 * Os números de um evento, já normalizados entre as fontes.
 *
 * Campos explícitos e não `Record<string, unknown>`: o validador de
 * serialização do TanStack recusa `unknown`, e — o que importa mais — um
 * formato frouxo aqui viraria uma tela que exibe o que vier, incluindo o que
 * mudou de nome no meio do caminho.
 */
export type DadosEvento = {
  systolic?: number | null;
  diastolic?: number | null;
  glucose_mg_dl?: number | null;
  weight_kg?: number | null;
  spo2?: number | null;
  heart_rate_bpm?: number | null;
  momento?: string | null;
  nivel?: string | null;
  sintomas?: string[] | null;
  medicamentos?: string | null;
  emocional?: string | null;
  semana?: number | null;
  categoria?: string | null;
  nome?: string | null;
  intensidade?: number | null;
  duracao_seg?: number | null;
  chutes?: number | null;
  humor?: string | null;
  epds?: number | null;
  epds_q10?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  respondida?: boolean | null;
};

export type EventoClinico = {
  fonte: string;
  fonte_id: string;
  user_id: string;
  ocorrido_em: string;
  especie: EspecieEvento;
  dados: DadosEvento;
  texto: string | null;
  /** Calculada na leitura, nunca gravada — ver o cabeçalho. */
  gravidade: Gravidade;
  /** As frases dos sinais que dispararam, para a tela não ter que deduzir. */
  notas: string[];
  /** O médico já registrou desfecho para este evento? */
  tratado_em: string | null;
};

const COLS = "fonte,fonte_id,user_id,ocorrido_em,especie,dados,texto";

/* ────────────────────────────────────────────────────────────────────────────
   GRAVIDADE

   Um evento pode carregar mais de um número (a triagem traz pressão E nível;
   a medida traz pressão E glicemia). A gravidade do evento é a PIOR delas —
   é ela que ordena a fila do médico, e ordenar por média esconderia justamente
   o caso que não pode esperar.
   ──────────────────────────────────────────────────────────────────────────── */
function avaliar(especie: EspecieEvento, d: DadosEvento): { g: Gravidade; notas: string[] } {
  const sinais: (Sinal | null)[] = [
    sinalPressao(d.systolic, d.diastolic),
    sinalGlicemia(d.glucose_mg_dl),
  ];

  /* A triagem já vem classificada pelo motor de sintomas do app — o mesmo que
     disse a ela "procure atendimento agora". Rebaixar isso aqui seria a tela
     do médico discordando, em silêncio, do que a paciente já leu. */
  if (d.nivel === "vermelho") sinais.push({ gravidade: "grave", nota: "Triagem vermelha" });
  else if (d.nivel === "amarelo") sinais.push({ gravidade: "atencao", nota: "Triagem amarela" });

  /* EPDS ≥13 é o corte de rastreio positivo para depressão; a questão 10 é
     ideação de autoagressão e não tem corte — qualquer resposta positiva é
     grave, e é por isso que ela é avaliada separada do escore total. */
  if (d.epds_q10 != null && d.epds_q10 > 0) {
    sinais.push({ gravidade: "grave", nota: "EPDS: questão 10 positiva" });
  } else if (d.epds != null && d.epds >= 13) {
    sinais.push({ gravidade: "grave", nota: `EPDS ${d.epds} — rastreio positivo` });
  } else if (d.epds != null && d.epds >= 10) {
    sinais.push({ gravidade: "atencao", nota: `EPDS ${d.epds}` });
  }

  // SOS é emergência por definição: ela apertou o botão.
  if (especie === "emergencia") sinais.push({ gravidade: "grave", nota: "Acionou o SOS" });

  return {
    g: piorSinal(...sinais),
    notas: sinais.filter((s): s is Sinal => !!s && !!s.nota).map((s) => s.nota),
  };
}

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

/** Pacientes que são dele AGORA. O recorte de tudo neste arquivo. */
async function pacientesAtuais(doctorId: string): Promise<Map<string, string>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("patient_profiles")
    .select("id,display_name")
    .eq("doctor_id", doctorId);
  return new Map(
    ((data ?? []) as { id: string; display_name: string | null }[]).map((p) => [
      p.id,
      p.display_name ?? "",
    ]),
  );
}

/**
 * `.in()` viaja na query string e uma lista longa estoura o buffer do proxy,
 * voltando 414 — que numa lista clínica viraria "nenhum evento", em silêncio.
 * Cem por vez, sempre.
 */
const LOTE = 100;

async function lerEventos(
  ids: string[],
  filtro: (q: any) => any,
): Promise<{ linhas: Record<string, unknown>[]; incompleto: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const linhas: Record<string, unknown>[] = [];
  let incompleto = false;
  for (let i = 0; i < ids.length; i += LOTE) {
    const { data, error } = await filtro(
      (supabaseAdmin as any)
        .from("clinical_events")
        .select(COLS)
        .in("user_id", ids.slice(i, i + LOTE)),
    );
    if (error) {
      // View ainda não criada (SQL pendente): tela vazia, não painel quebrado.
      incompleto = true;
      continue;
    }
    linhas.push(...((data ?? []) as Record<string, unknown>[]));
  }
  return { linhas, incompleto };
}

function montar(linhas: Record<string, unknown>[], tratados: Map<string, string>): EventoClinico[] {
  return linhas.map((r) => {
    const dados = (r.dados ?? {}) as DadosEvento;
    const especie = String(r.especie) as EspecieEvento;
    const { g, notas } = avaliar(especie, dados);
    return {
      fonte: String(r.fonte),
      fonte_id: String(r.fonte_id),
      user_id: String(r.user_id),
      ocorrido_em: String(r.ocorrido_em),
      especie,
      dados,
      texto: (r.texto as string) ?? null,
      gravidade: g,
      notas,
      tratado_em: tratados.get(`${r.fonte}:${r.fonte_id}`) ?? null,
    };
  });
}

/**
 * Eventos que pedem olhar — de todas as pacientes dele.
 *
 * É a matéria-prima da fila de trabalho. Só o que está fora de faixa e ainda
 * sem desfecho registrado: uma lista que inclui o normal vira arquivo, e
 * arquivo ninguém lê todo dia.
 */
export const eventosQuePedemOlhar = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        dias: z.number().int().min(1).max(90).default(14),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const vazio = {
      ok: true as const,
      eventos: [] as EventoClinico[],
      nomes: {} as Record<string, string>,
      incompleto: false,
    };
    const user = await medicoDaSessao(data.accessToken);
    if (!user) return { ...vazio, ok: false as const };
    try {
      const pacientes = await pacientesAtuais(user.id);
      const ids = [...pacientes.keys()];
      if (ids.length === 0) return vazio;

      const desde = new Date(Date.now() - data.dias * 86400000).toISOString();
      const { linhas, incompleto } = await lerEventos(ids, (q) =>
        q
          /* Humor e movimento ficam de fora daqui de propósito: são sinais de
             engajamento, não de deterioração, e enchiam a fila de itens que
             não mudam conduta. Eles continuam na ficha da paciente. */
          .in("especie", ["medida", "sintoma", "emergencia", "consulta", "contracao"])
          .gte("ocorrido_em", desde)
          .order("ocorrido_em", { ascending: false })
          .limit(400),
      );

      const tratados = await lerDesfechos(user.id);
      const eventos = montar(linhas, tratados)
        .filter((e) => e.gravidade !== "normal" && !e.tratado_em)
        .sort((a, b) => {
          const peso = (g: Gravidade) => (g === "grave" ? 0 : g === "atencao" ? 1 : 2);
          const p = peso(a.gravidade) - peso(b.gravidade);
          if (p !== 0) return p;
          // Dentro da mesma cor, o mais RECENTE primeiro: um valor grave de
          // hoje pede mais que um de dez dias atrás que já passou.
          return b.ocorrido_em.localeCompare(a.ocorrido_em);
        });

      return {
        ok: true as const,
        eventos,
        nomes: Object.fromEntries(pacientes),
        incompleto,
      };
    } catch {
      return vazio;
    }
  });

async function lerDesfechos(doctorId: string): Promise<Map<string, string>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    const { data } = await (supabaseAdmin as any)
      .from("clinical_acks")
      .select("fonte,fonte_id,visto_em")
      .eq("doctor_id", doctorId)
      .order("visto_em", { ascending: false })
      .limit(1000);
    return new Map(
      ((data ?? []) as { fonte: string; fonte_id: string; visto_em: string }[]).map((a) => [
        `${a.fonte}:${a.fonte_id}`,
        a.visto_em,
      ]),
    );
  } catch {
    return new Map();
  }
}

/**
 * A linha do tempo clínica de UMA paciente — o prontuário.
 *
 * Sem janela de 14 dias como no relatório antigo: uma medida de 20 dias atrás
 * aparecia como "—", que o médico lia como "ela não registra" quando o certo
 * era "a última foi há 20 dias". Aqui a janela é escolhida por quem chama, e o
 * padrão cobre a gestação inteira.
 */
export const prontuarioDaPaciente = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        pacienteId: z.string().uuid(),
        dias: z.number().int().min(1).max(400).default(300),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const vazio = { ok: true as const, eventos: [] as EventoClinico[], incompleto: false };
    const user = await medicoDaSessao(data.accessToken);
    if (!user) return { ...vazio, ok: false as const };
    try {
      const pacientes = await pacientesAtuais(user.id);
      // Vínculo atual antes de qualquer leitura.
      if (!pacientes.has(data.pacienteId)) return { ...vazio, ok: false as const };

      const desde = new Date(Date.now() - data.dias * 86400000).toISOString();
      const { linhas, incompleto } = await lerEventos([data.pacienteId], (q) =>
        q.gte("ocorrido_em", desde).order("ocorrido_em", { ascending: false }).limit(1000),
      );
      const tratados = await lerDesfechos(user.id);
      return { ok: true as const, eventos: montar(linhas, tratados), incompleto };
    } catch {
      return vazio;
    }
  });

/**
 * Registra o desfecho de um evento.
 *
 * Não é "visto" — é "eu resolvi isto". A diferença importa: numa lista clínica,
 * marcar como lido faz o item sumir sem que nada tenha sido feito, e o próximo
 * médico não tem como saber se houve conduta.
 */
export const registrarDesfecho = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        fonte: z.string().min(1).max(60),
        fonteId: z.string().uuid(),
        pacienteId: z.string().uuid(),
        conduta: z.string().max(2000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await medicoDaSessao(data.accessToken);
    if (!user) return { ok: false as const };
    const pacientes = await pacientesAtuais(user.id);
    if (!pacientes.has(data.pacienteId)) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("clinical_acks").upsert(
      {
        doctor_id: user.id,
        fonte: data.fonte,
        fonte_id: data.fonteId,
        user_id: data.pacienteId,
        visto_em: new Date().toISOString(),
        conduta: data.conduta ?? null,
      },
      { onConflict: "doctor_id,fonte,fonte_id" },
    );
    return { ok: !error };
  });
