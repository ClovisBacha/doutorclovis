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
 * ─── O QUE NÃO TEM FORMA DE JWT NÃO VALE UMA VIAGEM DE REDE ──────────────────
 *
 * Havia só `token.length < 10`, e o comentário original já dizia por quê:
 * `getUser` de uma string qualquer custa a mesma ida ao Supabase Auth que a de
 * um token real. Mas o teto de 10 caracteres não segurava nada — quem manda
 * `Bearer` com 64 caracteres aleatórios em rajada passava direto, e cada
 * requisição virava uma chamada de rede na nossa conta. Pior depois que a chave
 * do limitador passou a sair do usuário RESOLVIDO: a viagem passou a acontecer
 * ANTES do limite, então o 429 — que existe para ser a resposta barata — virou
 * a cara, e o limitador virou o amplificador.
 *
 * Todo token de sessão do Supabase é um JWT: três segmentos base64url separados
 * por ponto. Exigir a FORMA elimina a rajada de lixo com custo zero, e não
 * recusa nada que o Auth fosse aceitar — um token sem essa forma seria rejeitado
 * lá de qualquer jeito, só que depois da viagem.
 *
 * Está separada e exportada porque é a única maneira de um teste PROVAR que a
 * rede não foi tocada: exercitando `usuarioDaRequisicao` num ambiente sem
 * Supabase, um token de lixo devolve `null` tanto pelo atalho quanto pela
 * chamada que falha — e o teste passa verde com a defesa removida. Foi
 * exatamente o que aconteceu na primeira versão: o mutante sobreviveu.
 */
export function tokenPlausivel(token: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
}

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
  const cabecalho = request.headers.get("authorization");
  /* O esquema é case-insensitive na RFC 7235, e havia um `startsWith("Bearer ")`
     literal aqui: um cliente que mandasse `bearer` minúsculo — o que a norma
     permite — era tratado como anônimo e caía no prompt público sem nenhum
     aviso. Bug de compatibilidade silencioso, do tipo que só aparece quando
     alguém escreve um segundo cliente. */
  const m = cabecalho?.match(/^\s*bearer\s+(\S+)\s*$/i);
  if (!m) return null;
  const token = m[1];
  if (!tokenPlausivel(token)) return null;
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
