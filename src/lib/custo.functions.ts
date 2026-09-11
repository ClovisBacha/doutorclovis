/**
 * O CUSTO DA PLATAFORMA, LIDO DO QUE ACONTECEU.
 *
 * ⚠️ **O painel já tinha um cartão "Custo e margem de IA" e ele mentia.** Ele
 * fazia `brain_hits × 1 centavo` — contava só o Segundo Cérebro (deixando de
 * fora chat, triagem, transcrição, nota clínica e advisor) e multiplicava por
 * uma constante chutada. `ai_usage` guarda `input_tokens`, `output_tokens`,
 * `modelo`, `canal` e `especie` desde que existe: o dado sempre esteve lá.
 *
 * A régua que transforma token em dinheiro é pura e mora em
 * `custo-da-plataforma.ts` — aqui só se lê o banco e se aplica.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  CONFERIDO_EM,
  DOLAR_EM_REAIS,
  projetarMes,
  resumirCusto,
  type ResumoDeCusto,
} from "@/lib/custo-da-plataforma";
import { requireSuperAdmin } from "@/lib/platform-admin.server";

/**
 * ⚠️ **TETO DE LINHAS, e ele é DITO na resposta.**
 *
 * `ai_usage` cresce uma linha por chamada de IA: numa base viva são dezenas de
 * milhares por mês. Ler tudo sem teto é a consulta que um dia derruba o painel
 * — e pior, derruba EXATAMENTE quando o app está indo bem. Com o teto, o total
 * fica INCOMPLETO, e uma soma incompleta apresentada como completa é o mesmo
 * defeito que este arquivo veio consertar: por isso `truncado` volta junto e a
 * tela precisa mostrá-lo.
 */
const TETO_DE_LINHAS = 50_000;

const PeriodoSchema = z.object({
  accessToken: z.string().min(10),
  /** Quantos dias para trás. 30 por padrão; 1 a 180. */
  dias: z.number().int().min(1).max(180).optional(),
});

export type CustoDaPlataforma = {
  ok: true;
  dias: number;
  desde: string;
  resumo: ResumoDeCusto;
  /** Projeção até o fim do mês corrente, em centavos. `null` no dia 1. */
  projecaoDoMesCentavos: number | null;
  custoDoMesAteAgoraCentavos: number;
  /** Os cinco maiores consumidores, por médico. Nome resolvido no servidor. */
  porMedico: { nome: string; centavos: number; chamadas: number }[];
  /** ⚠️ `true` quando o teto cortou a leitura — o total está incompleto. */
  truncado: boolean;
  precoConferidoEm: string;
  dolar: number;
  /** Quando alguma leitura falhou, para a tela não afirmar completude. */
  degradado: boolean;
};

export const custoDaPlataforma = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => PeriodoSchema.parse(i))
  .handler(async ({ data }): Promise<CustoDaPlataforma | { ok: false }> => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const dias = data.dias ?? 30;
    const agora = new Date();
    const desde = new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000);
    /* O primeiro instante do mês corrente, para a projeção — que é uma pergunta
       diferente da janela de N dias e não pode reusar o mesmo corte. */
    const inicioDoMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));

    /* ⚠️ As duas leituras são INDEPENDENTES — em paralelo, uma onda só. Em
       série seriam duas latências somadas num painel que já é pesado. */
    const [janela, mes] = await Promise.all([
      sb
        .from("ai_usage")
        .select("modelo, input_tokens, output_tokens, canal, especie, doctor_id")
        .gte("created_at", desde.toISOString())
        .order("created_at", { ascending: false })
        .limit(TETO_DE_LINHAS),
      sb
        .from("ai_usage")
        .select("modelo, input_tokens, output_tokens")
        .gte("created_at", inicioDoMes.toISOString())
        .limit(TETO_DE_LINHAS),
    ]);

    /* ⚠️ **FALHA VIRA `degradado`, e NUNCA zero.** "Custo zero" num painel
       financeiro é a leitura mais perigosa possível: parece lucro. */
    const degradado = Boolean(janela.error || mes.error);
    const linhas = (janela.data ?? []) as {
      modelo: string | null;
      input_tokens: number | null;
      output_tokens: number | null;
      canal: string | null;
      especie: string | null;
      doctor_id: string | null;
    }[];

    const resumo = resumirCusto(linhas);

    const doMes = resumirCusto((mes.data ?? []) as any[]);
    const diaDoMes = agora.getUTCDate();
    const diasNoMes = new Date(
      Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 0),
    ).getUTCDate();

    /* ── Por médico ────────────────────────────────────────────────────────
       ⚠️ O nome é resolvido no SERVIDOR e só o nome viaja. Mandar `doctor_id`
       para a tela seria um uuid de conta num painel que não precisa dele. */
    const porId = new Map<string, { centavos: number; chamadas: number }>();
    for (const l of linhas) {
      if (!l.doctor_id) continue;
      const atual = porId.get(l.doctor_id) ?? { centavos: 0, chamadas: 0 };
      const c = resumirCusto([l]).centavos;
      atual.centavos += c;
      atual.chamadas += 1;
      porId.set(l.doctor_id, atual);
    }
    const topo = [...porId.entries()].sort((a, b) => b[1].centavos - a[1].centavos).slice(0, 5);
    let porMedico: CustoDaPlataforma["porMedico"] = [];
    if (topo.length) {
      const { data: perfis } = await sb
        /* ⚠️ A tabela é `doctors`, e eu escrevi `doctor_profiles` na primeira
         versão — o PostgREST devolveria 42P01, `perfis` viria nulo e TODO
         médico apareceria como "(sem nome)" no painel, sem erro nenhum. É a
         mesma classe de defeito que `preconsulta_forms` já custou aqui, e a
         catraca `tabelas-que-existem.test.ts` é quem a pega. */
        .from("doctors")
        .select("id, display_name")
        .in(
          "id",
          topo.map(([id]) => id),
        );
      const nomes = new Map(
        ((perfis ?? []) as { id: string; display_name: string | null }[]).map((p) => [
          p.id,
          p.display_name || "(sem nome)",
        ]),
      );
      porMedico = topo.map(([id, v]) => ({
        nome: nomes.get(id) ?? "(sem nome)",
        centavos: v.centavos,
        chamadas: v.chamadas,
      }));
    }

    return {
      ok: true as const,
      dias,
      desde: desde.toISOString(),
      resumo,
      custoDoMesAteAgoraCentavos: doMes.centavos,
      projecaoDoMesCentavos: projetarMes(doMes.centavos, diaDoMes, diasNoMes),
      porMedico,
      truncado: linhas.length >= TETO_DE_LINHAS,
      precoConferidoEm: CONFERIDO_EM,
      dolar: DOLAR_EM_REAIS,
      degradado,
    };
  });
