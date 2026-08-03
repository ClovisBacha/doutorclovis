/**
 * Excluir a conta.
 *
 * ─── Por que isto não era opcional ──────────────────────────────────────
 *
 * Não existia jeito nenhum de apagar uma conta neste app. Três consequências, e
 * a terceira é a que dói:
 *
 * · **App Store 5.1.1(v)** — app que deixa criar conta TEM que deixar apagar,
 *   por dentro do app. É reprovação automática, não ressalva.
 * · **LGPD, art. 18, VI** — eliminação dos dados a pedido do titular.
 * · **Os Termos já prometiam.** Está escrito em `/termos`: "Você pode encerrar
 *   sua conta a qualquer momento." A promessa existia e o botão não.
 *
 * ─── O médico não apaga a conta por aqui, e não é burocracia ────────────
 *
 * A conta do médico é o vínculo de todas as pacientes dele
 * (`patient_profiles.doctor_id`) e a autoria do que ele registrou. Apagá-la de
 * um toque desliga o SOS de gente que está grávida agora, e leva junto registro
 * que o CFM manda guardar por 20 anos.
 *
 * A própria Apple prevê isto: apps de setor regulado podem exigir um passo
 * adicional para confirmar a exclusão. Então o médico recebe o caminho, por
 * escrito, em vez de um botão que não pode existir — e a paciente, que é quem a
 * regra protege, apaga na hora.
 *
 * ─── O que NÃO é apagado, e por quê ─────────────────────────────────────
 *
 * O que a paciente escreveu sai inteiro. O que o MÉDICO registrou sobre um
 * atendimento (prontuário, receita emitida) é obrigação legal dele guardar — a
 * resolução do CFM é de 20 anos, e ela vale mesmo depois de a paciente sair.
 * Isso está dito na confirmação, antes de ela decidir, e não depois.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** O que a pessoa precisa digitar. Maiúsculo, sem acento, difícil de errar. */
export const PALAVRA_DE_CONFIRMACAO = "EXCLUIR";

export type ResultadoExclusao =
  | { ok: true }
  | { ok: false; motivo: "confirmacao" | "sessao" | "medico" | "falhou" };

export const excluirMinhaConta = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        confirmacao: z.string().max(40),
      })
      .parse(i),
  )
  .handler(async ({ data }): Promise<ResultadoExclusao> => {
    /* A palavra digitada é conferida no SERVIDOR também. No cliente ela é
       proteção contra o toque sem querer; aqui é o que impede um pedido
       montado à mão de apagar uma conta sem passar pela tela. */
    if (data.confirmacao.trim().toUpperCase() !== PALAVRA_DE_CONFIRMACAO) {
      return { ok: false, motivo: "confirmacao" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false, motivo: "sessao" };

    const sb = supabaseAdmin as any;

    const { data: medico } = await sb
      .from("doctors")
      .select("id")
      .eq("id", u.user.id)
      .maybeSingle();
    if (medico) return { ok: false, motivo: "medico" };

    /* `deleteUser` derruba `auth.users`, e o resto sai pelos `ON DELETE CASCADE`
       — que é justamente o que `APLICAR_EVENTOS_CLINICOS.sql` e
       `APLICAR_ESQUECIMENTO.sql` acrescentaram. Sem eles aplicados, isto FALHA
       com violação de chave estrangeira, e é por isso que o erro sobe em vez de
       virar um "pronto, apagamos" mentiroso: uma exclusão que a pessoa acredita
       ter acontecido é pior que uma que ela sabe que não aconteceu. */
    const { error } = await supabaseAdmin.auth.admin.deleteUser(u.user.id);
    if (error) return { ok: false, motivo: "falhou" };

    return { ok: true };
  });
