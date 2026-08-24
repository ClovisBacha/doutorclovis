import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  AVISO,
  FONTES,
  FORA_DO_EXPORT,
  LIMITE_POR_FONTE,
  type Export,
  type ValorJson,
} from "./exportar-dados";

/**
 * EXPORTAR OS DADOS DA PACIENTE (LGPD Art. 18, II e V).
 *
 * A régua — quais tabelas entram, quais colunas saem e o que fica de fora —
 * mora em `exportar-dados.ts`, pura e testável. Aqui é só o trabalho sujo.
 *
 * ⚠️ **A SESSÃO É O ÚNICO RECORTE, e ela vem ANTES de tudo.** Não há
 * `pacienteId` no corpo do pedido de propósito: bastaria trocar um uuid para
 * baixar a gestação inteira de outra pessoa. É a mesma decisão de
 * `/influenciadora`, resolvida pelo e-mail da sessão e nunca por um código
 * vindo do cliente.
 *
 * ⚠️ **O MÉDICO NÃO EXPORTA POR AQUI.** Se a conta for de médico, recusa: o
 * dado dele é outro assunto (pacientes de terceiros, cérebro, faturamento), e
 * um export desenhado para paciente aplicado a uma conta de médico é
 * exatamente como se vaza a base inteira.
 *
 * ⚠️ **FALHA DE LEITURA NÃO VIRA BLOCO VAZIO.** Uma tabela que não pôde ser
 * lida entra em `falhas`, com o nome. Um export silenciosamente incompleto é
 * pior que nenhum: ela acredita que levou tudo, apaga a conta, e o que faltou
 * some junto. É a mesma direção do "incompleto" do prontuário — a tela avisa em
 * vez de fingir completude.
 */
export const exportarMeusDados = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(
    async ({ data }): Promise<{ ok: true; arquivo: Export } | { ok: false; motivo: string }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
      if (!u.user) return { ok: false as const, motivo: "sessao" };
      const uid = u.user.id;
      const sb = supabaseAdmin as any;

      /* Conta de médico não passa por aqui — ver o cabeçalho. */
      const { data: medico } = await sb.from("doctors").select("id").eq("id", uid).maybeSingle();
      if (medico) return { ok: false as const, motivo: "medico" };

      const dados: Record<string, ValorJson[]> = {};
      const falhas: string[] = [];

      /* Em paralelo: são ~22 leituras independentes, e em série a paciente
       esperaria 22 latências para baixar o próprio arquivo. */
      await Promise.all(
        FONTES.map(async (f) => {
          try {
            const { data: linhas, error } = await sb
              .from(f.tabela)
              .select(f.colunas)
              .eq(f.coluna, uid)
              .limit(LIMITE_POR_FONTE);
            if (error) {
              /* ⚠️ Tabela ausente é NORMAL num banco atrás das migrations, e não
               é falha do export: não há o que levar. Qualquer outro erro é dado
               dela que ficou para trás, e tem de aparecer. */
              const code = (error as { code?: string }).code;
              if (code !== "42P01" && code !== "42703") falhas.push(f.tabela);
              return;
            }
            dados[f.chave] = (linhas ?? []) as ValorJson[];
          } catch {
            falhas.push(f.tabela);
          }
        }),
      );

      return {
        ok: true as const,
        arquivo: {
          gerado_em: new Date().toISOString(),
          sobre: AVISO,
          fora: FORA_DO_EXPORT,
          falhas,
          dados,
        },
      };
    },
  );
