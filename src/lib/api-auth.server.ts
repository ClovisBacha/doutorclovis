/**
 * Quem pode gastar a chave de IA do consultório.
 *
 * `/api/nutrition` e `/api/transcribe` não liam `Authorization` nenhum: eram
 * proxies abertos para o Gemini na chave do dono. Qualquer pessoa podia mandar
 * o array de mensagens que quisesse — traduzir um contrato, resumir um livro —
 * e a fatura ia para o `GOOGLE_GENERATIVE_AI_API_KEY`. O `transcribe` aceitava
 * 20 MB de áudio por requisição, de qualquer um.
 *
 * O único freio era um limitador de taxa em memória, e o próprio comentário
 * dele admite o problema: em serverless cada instância tem o seu Map, então na
 * Vercel N invocações concorrentes valem N × o limite.
 *
 * Isso não é só custo. É a chave do consultório servindo de infraestrutura
 * gratuita para quem descobrir a URL — e o `chat.ts`, que faz a mesma coisa,
 * sempre leu o `Authorization`. Estes dois ficaram para trás.
 */

/**
 * `null` quando não há sessão válida. Nunca lança: quem chama decide o status.
 *
 * Aceita QUALQUER usuário autenticado, e é de propósito: a nutrição é da
 * paciente, a transcrição é do médico, e distinguir aqui só criaria um segundo
 * lugar para a regra de papéis divergir. O que estava faltando é a linha entre
 * "alguém do produto" e "a internet".
 */
export async function usuarioDaRequisicao(
  request: Request,
): Promise<{ id: string; email?: string | null } | null> {
  const cabecalho = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!cabecalho?.startsWith("Bearer ")) return null;
  const token = cabecalho.slice(7).trim();
  /* Um token curto não vale a ida ao Auth: o `getUser` de uma string de dois
     caracteres custa a mesma viagem de rede que o de um JWT real, e é assim que
     um proxy aberto vira um proxy lento. */
  if (token.length < 10) return null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email };
  } catch {
    return null;
  }
}

/** A resposta padrão de quem não está logado. Sem detalhe: não é oráculo. */
export function naoAutorizado(): Response {
  return new Response("Não autorizado", { status: 401 });
}
