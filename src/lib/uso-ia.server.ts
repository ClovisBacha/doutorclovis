/**
 * Medição de uso de IA — os tokens que o modelo de fato cobrou.
 *
 * ─── Por que isto existe ────────────────────────────────────────────────
 *
 * Toda decisão de preço da plataforma depende de duas perguntas que hoje
 * ninguém sabe responder: quanto custa uma resposta, e quantas respostas um
 * médico consome por mês. Enquanto elas forem chute, "1.000 mensagens por
 * R$49,90" é chute — e chute em preço vira margem negativa que só aparece na
 * fatura do trimestre.
 *
 * O que se grava é o `usage` que VOLTA da chamada, não uma conta feita por
 * cima do prompt. É a medição do próprio Google.
 *
 * ─── As três regras deste arquivo ───────────────────────────────────────
 *
 * 1. **Nunca lança, nunca espera.** É chamado de dentro do caminho da resposta
 *    da paciente. Um erro aqui — tabela ausente, banco lento, coluna com outro
 *    nome — não pode atrasar nem derrubar uma conversa. Tudo é
 *    dispara-e-esquece com `catch` vazio.
 *
 * 2. **Grava TOKEN, não real.** O preço do token muda, o câmbio muda e o modelo
 *    muda. Custo gravado congela a conta de hoje num número que estará errado
 *    no mês que vem, sem ninguém perceber que envelheceu. Token é fato; real é
 *    interpretação, e a interpretação se faz na leitura.
 *
 * 3. **Nenhum texto.** Só contadores. Já existe `chat_messages` para o
 *    conteúdo, com a RLS dela; duplicar conversa de gestante numa tabela de
 *    telemetria seria criar uma segunda cópia do dado mais sensível do produto
 *    para responder a uma pergunta de custo.
 */

/** Quantos tokens, de qual chamada. */
/**
 * As três espécies do CHECK da tabela: `ai_usage` tem
 * `CHECK (especie IN ('chat','memoria','embedding'))`.
 *
 * Não invente uma quarta aqui. Eu inventei `"aviso"` para marcar que o médico
 * já tinha sido notificado da cota, e o insert passou a falhar com 23514 —
 * silenciosamente, porque quem grava engole `{error}`. A marca de aviso mora
 * no `canal` ("cota-80"/"cota-100"), que não tem CHECK, e é excluída da
 * contagem em `respostasNoCiclo`.
 */
export type EspecieDeUso = "chat" | "memoria" | "embedding";

export type Uso = {
  especie: EspecieDeUso;
  modelo: string;
  /** O que o SDK devolve em `usage` — os dois campos podem vir indefinidos. */
  inputTokens?: number;
  outputTokens?: number;
  doctorId?: string | null;
  patientId?: string | null;
  canal?: string;
  /**
   * Alguma orientação validada do médico casou com a pergunta?
   *
   * `undefined` quando a pergunta nem passou pelo cérebro (suporte, site
   * anônimo, paciente sem médico) — e aí a coluna fica nula, que é diferente
   * de `false`. Gravar `false` ali afundaria a taxa de cobertura com perguntas
   * que nunca deveriam entrar na conta.
   */
  cobertura?: boolean;
  /** Similaridade do melhor acerto (0–1), inclusive abaixo do corte. */
  similaridade?: number | null;
};

/**
 * Registra um uso. Dispara e esquece — quem chama não deve `await`.
 *
 * Devolve `void` de propósito: uma promessa aqui convidaria alguém a esperar
 * por ela no meio do streaming da resposta.
 */
export function registrarUso(u: Uso): void {
  void registrarUsoAgora(u);
}

/**
 * A mesma coisa, aguardável.
 *
 * Existe por causa de um defeito de servidor sem servidor: trabalho disparado e
 * não aguardado DEPOIS que a resposta terminou pode ser morto quando a função é
 * congelada. Quem chama de dentro do `onFinish` precisa esperar — a SDK aguarda
 * o `onFinish`, e é isso que mantém a função viva.
 */
export async function registrarUsoAgora(u: Uso): Promise<void> {
  const entrada = Math.max(0, Math.trunc(u.inputTokens ?? 0));
  const saida = Math.max(0, Math.trunc(u.outputTokens ?? 0));
  /* Sem tokens não há CUSTO para medir — mas pode haver RESPOSTA para contar.
     A linha é a unidade da cota do médico (`respostasNoCiclo` conta linhas,
     não tokens), então descartá-la porque o provedor não reportou `usage`
     fazia a cota sub-contar em silêncio: respostas reais que nunca apareciam
     no medidor nem consumiam o plano. Zero token com a linha presente é
     honesto — a média de custo é calculada na leitura e sabe pular zeros.
     Só o que não é resposta (embedding, memória) continua sendo descartado. */
  if (entrada === 0 && saida === 0 && u.especie !== "chat") return;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const linha = {
      doctor_id: u.doctorId ?? null,
      patient_id: u.patientId ?? null,
      especie: u.especie,
      canal: u.canal ?? "app",
      modelo: u.modelo,
      input_tokens: entrada,
      output_tokens: saida,
    };
    const res = await (supabaseAdmin as any)
      .from("ai_usage")
      .insert({ ...linha, cobertura: u.cobertura ?? null, similaridade: u.similaridade ?? null });

    /* AS DUAS COLUNAS NOVAS NÃO PODEM LEVAR A LINHA INTEIRA JUNTO.
       `cobertura` e `similaridade` vieram numa migration recente, e o CLAUDE.md
       avisa que produção fica atrás. O PostgREST rejeita a linha TODA quando
       uma coluna não existe (42703) — e o supabase-js devolve `{error}` sem
       lançar, então o `catch` abaixo nunca via nada. Resultado: `ai_usage`
       vazia, `respostasNoCiclo` sempre 0, cota que nunca estoura, medidor
       sempre zerado, "quem mais conversou" sempre vazio. Quatro telas mortas
       por duas colunas opcionais, sem uma única linha de log.
       Mesmo padrão de rede que `chat.ts` já usa nas colunas clínicas. */
    if (res?.error) {
      const semExtras = await (supabaseAdmin as any).from("ai_usage").insert(linha);
      if (semExtras?.error) {
        console.error(`[uso-ia] não gravou: ${semExtras.error.message ?? "sem detalhe"}`);
      } else {
        console.error(
          `[uso-ia] cobertura/similaridade não existem no banco (${res.error.code ?? "?"}) — ` +
            `rode supabase/APLICAR_COBERTURA.sql. O consumo está sendo contado sem elas.`,
        );
      }
    }
  } catch {
    /* Tabela ainda não migrada, banco fora do ar: medir é opcional, responder
       não é. */
  }
}
