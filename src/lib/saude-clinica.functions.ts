/**
 * A FILA CLÍNICA ESTÁ COMPLETA? — o controle que faltava, e o risco que ele cobre.
 *
 * ⚠️ **A VIEW `clinical_events` PODE ESTAR INCOMPLETA SEM NINGUÉM SABER.**
 *
 * Ela é montada dinamicamente (`DO` + `to_regclass`): cada uma das doze fontes
 * só entra se a tabela dela existir no instante em que o SQL roda. É um desenho
 * deliberado e certo — produção tem menos tabelas que o repositório, e um
 * `CREATE VIEW` sobre tabela ausente falharia inteiro, derrubando junto as
 * fontes que existem.
 *
 * O preço é uma dependência de ORDEM que nada verifica: se `epds_logs` nasceu
 * num `APLICAR_` rodado DEPOIS do da view, a EPDS simplesmente não está lá. A
 * view existe, as consultas respondem, a fila do médico só tem uma fonte a
 * menos.
 *
 * ⚠️ **E a fonte mais provável de ficar de fora é a pior possível.** A questão
 * 10 da EPDS é **ideação de autolesão** — `clinical.functions.ts` a trata como
 * `gravidade: "grave"`. Uma paciente pode responder que sim, a linha grava, e
 * o evento nunca chega ao médico. Não há erro, não há log, não há tela vazia:
 * há uma fila que parece completa.
 *
 * Este handler compara, fonte a fonte: **a tabela tem linhas** e **a view
 * devolve linhas daquela fonte**? Tem e não devolve = a view está velha.
 *
 * ⚠️ **"Sem dados" NUNCA vira "ok".** Uma tabela vazia não prova nada sobre a
 * view, e responder verde ali seria a mesma mentira que este arquivo existe
 * para pegar. O estado é `indeterminado`, e a tela diz isso.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSuperAdmin, TokenSchema } from "@/lib/platform-admin.server";

/**
 * As doze fontes que a view deve unir, com o que cada uma carrega.
 *
 * ⚠️ **A ordem é de GRAVIDADE, e não alfabética.** Quem abre esta tela precisa
 * ver primeiro o que dói mais se estiver faltando — e a EPDS é a primeira
 * porque é a única que pode carregar ideação de autolesão.
 */
export const FONTES_CLINICAS = [
  { tabela: "epds_logs", nome: "EPDS (rastreio de depressão)", peso: "ideação de autolesão" },
  { tabela: "triage_logs", nome: "Triagem de sintomas", peso: "sintomas vermelhos" },
  { tabela: "panic_events", nome: "SOS", peso: "emergência" },
  { tabela: "health_logs", nome: "Pressão, glicemia, peso", peso: "pré-eclâmpsia" },
  { tabela: "contraction_sessions", nome: "Contrações", peso: "trabalho de parto prematuro" },
  { tabela: "kick_sessions", nome: "Movimentos do bebê", peso: "redução de movimento" },
  { tabela: "exam_files", nome: "Exames enviados", peso: "histórico" },
  { tabela: "journal_entries", nome: "Diário (só o rótulo de humor)", peso: "humor" },
  { tabela: "consultations", nome: "Consultas registradas", peso: "linha do tempo" },
  { tabela: "doctor_questions", nome: "Perguntas ao médico", peso: "dúvida clínica" },
  { tabela: "preconsulta_forms", nome: "Pré-consulta", peso: "preparo da consulta" },
  { tabela: "appointment_requests", nome: "Pedidos de consulta", peso: "agenda" },
] as const;

export type EstadoDaFonte = {
  tabela: string;
  nome: string;
  peso: string;
  /**
   * `ausente`      — a tabela não existe (falta rodar o APLICAR_ dela)
   * `fora_da_view` — a tabela TEM linhas e a view não devolve nenhuma: view velha
   * `ok`           — a tabela tem linhas e a view as devolve
   * `indeterminado`— a tabela existe e está vazia: não dá para concluir nada
   * `ilegivel`     — a leitura falhou
   */
  estado: "ausente" | "fora_da_view" | "ok" | "indeterminado" | "ilegivel";
  linhasNaTabela: number | null;
  linhasNaView: number | null;
};

export type SaudeClinica = {
  ok: true;
  /** ⚠️ `false` quando a própria view não responde — aí nada abaixo vale. */
  viewExiste: boolean;
  fontes: EstadoDaFonte[];
  foraDaView: number;
  ausentes: number;
};

/** Conta linhas sem trazer nenhuma — o conteúdo clínico não precisa viajar. */
async function contar(
  sb: any,
  tabela: string,
  filtro?: (q: any) => any,
): Promise<{ n: number | null; ausente: boolean }> {
  let q = sb.from(tabela).select("*", { count: "exact", head: true });
  if (filtro) q = filtro(q);
  const { count, error } = await q;
  if (error) {
    /* 42P01 = tabela não existe. Qualquer outro erro é "não consegui ler", e
       os dois NÃO podem virar a mesma resposta: um é "falta rodar o SQL", o
       outro é "tente de novo". */
    return { n: null, ausente: error.code === "42P01" };
  }
  return { n: count ?? 0, ausente: false };
}

export const saudeClinica = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }): Promise<SaudeClinica | { ok: false }> => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const daView = await contar(sb, "clinical_events");
    const viewExiste = !daView.ausente && daView.n !== null;

    /* ⚠️ Todas as sondas em PARALELO: são 24 contagens independentes, e em
       série seriam 24 latências somadas numa tela que o dono abre para ter uma
       resposta rápida. */
    const fontes = await Promise.all(
      FONTES_CLINICAS.map(async (f): Promise<EstadoDaFonte> => {
        const [tabela, naView] = await Promise.all([
          contar(sb, f.tabela),
          viewExiste
            ? contar(sb, "clinical_events", (q: any) => q.eq("fonte", f.tabela))
            : Promise.resolve({ n: null, ausente: false }),
        ]);

        const base = {
          tabela: f.tabela,
          nome: f.nome,
          peso: f.peso,
          linhasNaTabela: tabela.n,
          linhasNaView: naView.n,
        };

        if (tabela.ausente) return { ...base, estado: "ausente" };
        if (tabela.n === null) return { ...base, estado: "ilegivel" };
        /* ⚠️ Tabela vazia não prova nada sobre a view — e responder "ok" aqui
           seria exatamente a mentira que este arquivo existe para pegar. */
        if (tabela.n === 0) return { ...base, estado: "indeterminado" };
        if (!viewExiste || naView.n === null) return { ...base, estado: "ilegivel" };
        if (naView.n === 0) return { ...base, estado: "fora_da_view" };
        return { ...base, estado: "ok" };
      }),
    );

    return {
      ok: true as const,
      viewExiste,
      fontes,
      foraDaView: fontes.filter((f) => f.estado === "fora_da_view").length,
      ausentes: fontes.filter((f) => f.estado === "ausente").length,
    };
  });
