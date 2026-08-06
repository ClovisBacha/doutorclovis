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

/**
 * APAGAR AS CONVERSAS COM A IA, SEM APAGAR A CONTA.
 *
 * ─── POR QUE ISTO PRECISA EXISTIR ───────────────────────────────────────────
 *
 * `chat_messages` guarda a transcrição inteira, para sempre, e o médico dela
 * lê no painel. O comentário de `listBrainConversations` é honesto sobre o que
 * isso é: "o dado mais íntimo do produto: é para a IA que ela conta o que não
 * conta a ninguém."
 *
 * E o único jeito de apagar aquilo era apagar a CONTA — ou seja, perder a
 * gestação inteira, o diário, os exames, o vínculo com o médico. Ninguém faz
 * essa troca. Na prática, o que ela escreveu ficava, e ela sabia disso desde
 * que passamos a avisá-la de que ele lê.
 *
 * Um aviso sem um botão é uma armadilha educada: a pessoa é informada de algo
 * que não pode mudar.
 *
 * A memória (`chat_memory`) vai junto de propósito — ela é um RESUMO das mesmas
 * mensagens, escrito por um modelo. Apagar a transcrição e deixar o resumo
 * seria apagar a fonte e guardar a interpretação.
 *
 * O que NÃO é apagado: as respostas que o médico escreveu para ela na aba
 * Perguntas (`doctor_questions`). Aquilo é orientação clínica que ela pediu e
 * recebeu, e faz parte do cuidado dela — some se ela apagar, uma a uma, onde já
 * dá.
 */
export const apagarMinhasConversas = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false as const, motivo: "sessao" as const };
    const sb = supabaseAdmin as any;
    const uid = u.user.id;

    for (const tabela of ["chat_messages", "chat_memory"]) {
      const { error } = await sb.from(tabela).delete().eq("patient_id", uid);
      /* Tabela ausente é normal num banco atrás das migrations — não há o que
         apagar. Qualquer outro erro é conversa que FICOU, e dizer "apagamos"
         seria a mesma mentira que a exclusão de conta contava. */
      if (error && (error as { code?: string }).code !== "42P01") {
        console.error("[conversas] não foi possível apagar", tabela, error);
        return { ok: false as const, motivo: "falhou" as const };
      }
    }
    return { ok: true as const };
  });

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

    /* ─── O QUE O CASCATA NÃO PEGAVA ──────────────────────────────────────
     *
     * O comentário que estava aqui dizia "o resto sai pelos ON DELETE CASCADE".
     * Quatro tabelas não tinham chave estrangeira NENHUMA para `auth.users` —
     * e são exatamente as da IA:
     *
     *   · `chat_messages`    — a transcrição das conversas dela;
     *   · `chat_memory`      — o resumo clínico que o modelo escreveu sobre ela;
     *   · `brain_feedback`   — a pergunta dela, no texto original;
     *   · `brain_gap_askers` — quais dúvidas ela fez.
     *
     * Sem chave estrangeira nada bloqueia o `deleteUser`. Ela lia "sua conta foi
     * apagada" e o dado mais íntimo do produto seguia no banco, órfão de um
     * usuário que não existe mais — sem dono, sem RLS que o proteja, para
     * sempre. Pior que não ter apagado: é ter acreditado que apagou.
     *
     * `APLICAR_ESQUECIMENTO_DA_IA.sql` põe os quatro cascatas. Este apagamento
     * EXPLÍCITO existe porque o CLAUDE.md avisa que produção fica atrás das
     * migrations, e o direito ao esquecimento não pode depender de alguém ter
     * rodado um arquivo. Com o SQL aplicado, isto vira no-op (as linhas já
     * saíram); sem ele, é o que faz o apagamento acontecer.
     */
    const uid = u.user.id;
    const daIa: [string, string][] = [
      ["chat_messages", "patient_id"],
      ["chat_memory", "patient_id"],
      ["brain_feedback", "user_id"],
      ["brain_gap_askers", "user_id"],
    ];
    for (const [tabela, coluna] of daIa) {
      const { error: delErr } = await sb.from(tabela).delete().eq(coluna, uid);
      /* Tabela ausente (42P01) é normal num banco atrás das migrations — não há
         o que apagar. Qualquer outro erro é dado dela que FICOU, e a exclusão
         não pode se declarar feita: ela precisa poder tentar de novo. */
      if (delErr && (delErr as { code?: string }).code !== "42P01") {
        console.error("[exclusão] dado da IA não saiu", tabela, delErr);
        return { ok: false, motivo: "falhou" };
      }
    }

    /* `deleteUser` derruba `auth.users`, e o restante sai pelos `ON DELETE
       CASCADE` que `APLICAR_EVENTOS_CLINICOS.sql` e `APLICAR_ESQUECIMENTO.sql`
       acrescentaram. Sem eles, isto FALHA com violação de chave estrangeira — e
       o erro sobe de propósito, em vez de virar um "pronto, apagamos" que não
       aconteceu. */
    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) return { ok: false, motivo: "falhou" };

    return { ok: true };
  });
