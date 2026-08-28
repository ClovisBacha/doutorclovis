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

    /**
     * ─── A AGENDA: ANONIMIZAR, e não apagar ──────────────────────────────
     *
     * ⚠️ **`appointment_requests` sobrevivia INTEIRA à exclusão, com nome,
     * e-mail, telefone e observações dela.** A coluna que a liga à conta
     * (`patient_user_id`) é `ON DELETE SET NULL` — deliberado, porque a agenda
     * do médico não pode perder a consulta —, mas os campos PESSOAIS são
     * digitados no pedido e não dependem daquela chave. Ela pedia a exclusão, o
     * app respondia "apagamos", e o nome e o telefone continuavam lá.
     *
     * ⚠️ **APAGAR A LINHA seria a correção errada.** Ela é o registro de que
     * houve uma consulta naquele horário — o histórico da agenda do médico, que
     * é dado DELE e legítimo. Apagar destruiria isso para resolver um problema
     * que é só dos campos de identificação.
     *
     * Anonimizar é exatamente o que a LGPD pede aqui: o fato fica, a pessoa
     * sai. O `patient_user_id` já saiu pelo `SET NULL`, então nada volta a
     * ligar a linha a ela.
     *
     * ⚠️ Roda ANTES do `deleteUser`: depois, `patient_user_id` já é `NULL` e
     * não há mais como achar quais linhas eram dela.
     */
    {
      const { error: anonErr } = await sb
        .from("appointment_requests")
        /* ⚠️ **MARCADOR, e não `null`.** `patient_email` e `patient_phone` são
           `NOT NULL` no schema: mandar `null` faz o `update` inteiro falhar, a
           exclusão devolver "falhou", e a paciente ficar sem conseguir apagar
           a conta — trocando um vazamento por um bloqueio. `notes` é
           anulável, e ali o `null` é o certo. */
        .update({
          patient_name: "Paciente removida",
          patient_email: "removido@removido.invalid",
          patient_phone: "removido",
          notes: null,
        })
        .eq("patient_user_id", uid);
      /* Tabela ou coluna ausente num banco atrás das migrations não é falha —
         não há o que anonimizar. Qualquer outro erro é dado dela que FICOU.

         ⚠️ **`PGRST204`, e NUNCA `42703`.** Este é um UPDATE: coluna fora do
         schema cache volta como `PGRST204`, do PostgREST — o `42703` do
         Postgres só aparece em SELECT. Eu escrevi os dois, e a catraca
         `recuo-de-coluna.test.ts` reprovou na hora. É a mesma confusão que já
         custou três recursos aqui (o "Salvar perfil" do médico, a devolutiva
         de exame, e o registro do SOS que nunca gravava). */
      const code = (anonErr as { code?: string } | null)?.code;
      if (anonErr && code !== "42P01" && code !== "PGRST204") {
        console.error("[exclusão] agenda não anonimizada", anonErr);
        return { ok: false, motivo: "falhou" };
      }
    }

    /* ─── OS ARQUIVOS, ANTES DAS LINHAS ──────────────────────────────────────
     *
     * O CASCADE derruba as linhas de `exam_files` e `family_album_posts` — e,
     * enquanto o laudo morava DENTRO da linha, derrubar a linha era derrubar a
     * imagem. Ao mover os bytes para o Storage, essa equivalência se quebrou em
     * silêncio: a linha some, o arquivo fica.
     *
     * Ela pede a exclusão da conta, o produto responde que apagou, e o laudo
     * dela continua no nosso disco. Isso torna a LGPD inexequível pelo caminho
     * que a própria migração de imagens criou.
     *
     * ANTES do `deleteUser`, e não depois: com a linha já apagada não há mais
     * como saber quais arquivos eram dela — o caminho tem o uuid, mas quem
     * relaciona uuid a pessoa é a linha que acabou de sumir.
     *
     * Best-effort: se o Storage não responder, a exclusão da CONTA segue. Negar
     * a exclusão por causa de um órfão seria um problema de LGPD maior que o
     * órfão. */
    {
      /**
       * ⚠️ **A COMUNIDADE ENTROU AQUI DEPOIS, e por meses ficou de fora.**
       *
       * Este bloco existia com dois baldes, e o comentário acima descreve
       * exatamente o defeito que ele conserta: "a linha some, o arquivo fica".
       * Quando a Comunidade nasceu, ela criou mais DOIS baldes — `rede` (fotos e
       * vídeos das publicações e dos stories) e `conversas` (as fotos do direct)
       * — e ninguém voltou aqui. A paciente pedia a exclusão, o produto
       * respondia que apagou, e a ultrassom dela continuava no nosso disco.
       *
       * ⚠️ **E é `apagarTudoDoDono`, nunca `apagarPastaDoDono`:** os baldes da
       * Comunidade usam DUAS convenções de pasta (o hash, nas fotos que passam
       * por `guardarImagem`; o uuid cru, nos vídeos e nas fotos de conversa, que
       * sobem por URL assinada). Varrer só uma delas apagaria as fotos e
       * deixaria os vídeos — e o produto continuaria dizendo "apagamos".
       */
      const { apagarTudoDoDono, BALDE_EXAMES, BALDE_ALBUM, BALDE_REDE, BALDE_CONVERSAS } =
        await import("@/lib/imagens.server");
      await apagarTudoDoDono(BALDE_EXAMES, uid);
      await apagarTudoDoDono(BALDE_ALBUM, uid);
      await apagarTudoDoDono(BALDE_REDE, uid);
      await apagarTudoDoDono(BALDE_CONVERSAS, uid);
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
