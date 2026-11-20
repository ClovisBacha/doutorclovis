/**
 * A MEMÓRIA CURTA DA NUTRICIONISTA — a régua pura.
 *
 * A conversa morria com a aba: a pergunta de ontem sobre o ferro não existia
 * mais hoje, e o modelo recomeçava do zero a cada visita. Os últimos turnos
 * passam a viver em `nutricao_mensagens` (dela, por RLS) e voltam para a tela
 * na abertura seguinte — e como cada resposta carrega a ASSINATURA do
 * servidor, o modelo volta a vê-las como turnos próprios sem reabrir a forja.
 *
 * ⚠️ **QUEM GRAVA É A TELA, e só depois de a resposta CHEGAR.** Gravar a
 * pergunta antes da resposta deixaria, numa falha, uma pergunta órfã que na
 * visita seguinte volta sem resposta — o modelo receberia duas perguntas dela
 * em fila, que é a forma exata do defeito que a assinatura consertou. Uma
 * resposta forjada gravada pelo navegador não tem assinatura e é descartada
 * pelo servidor: guardar aqui não é confiar.
 *
 * ⚠️ **NADA NO MODO CUIDADO.** Nem lê, nem grava: uma conversa de antes da
 * perda pode falar do bebê, e trazê-la de volta seria a porta dos fundos do
 * portão de luto. E o que já está gravado fica — é dela.
 */

/** Quantos turnos voltam. Doze são seis trocas — o que uma pessoa lembra. */
export const TURNOS_DA_MEMORIA = 12;

export type LinhaDaMemoria = {
  role: "user" | "assistant";
  content: string;
  assinatura?: string | null;
};

export type TurnoDaTela = { role: "user" | "assistant"; content: string; assinatura?: string };

/**
 * Do banco para a tela. As linhas chegam da mais NOVA para a mais velha
 * (é o índice), e a tela lê em ordem cronológica.
 *
 * ⚠️ A primeira linha que volta tem de ser DELA: uma resposta sem a pergunta
 * na frente lê como a nutricionista falando sozinha — e o servidor descarta
 * turno de assistente sem turno dela antes. O que sobrar antes da primeira
 * pergunta cai.
 */
export function turnosDaMemoria(linhas: readonly LinhaDaMemoria[]): TurnoDaTela[] {
  const cronologica = [...linhas].reverse();
  const primeira = cronologica.findIndex((l) => l.role === "user");
  if (primeira < 0) return [];
  return cronologica.slice(primeira).map((l) => ({
    role: l.role,
    content: l.content,
    ...(l.role === "assistant" && l.assinatura ? { assinatura: l.assinatura } : {}),
  }));
}

/**
 * O que vai para o banco depois de UMA troca. Sempre o par: pergunta e
 * resposta, nesta ordem — e só quando a resposta veio.
 */
export function parParaGravar(
  userId: string,
  pergunta: string,
  resposta: { content: string; assinatura?: string },
): { user_id: string; role: "user" | "assistant"; content: string; assinatura: string | null }[] {
  return [
    { user_id: userId, role: "user", content: pergunta, assinatura: null },
    {
      user_id: userId,
      role: "assistant",
      content: resposta.content,
      assinatura: resposta.assinatura ?? null,
    },
  ];
}

/** As preferências, recortadas para o prompt e para a coluna. */
export const PREFERENCIAS_MAX = 240;
export function limparPreferencias(texto: string): string | null {
  const s = texto.replace(/\s+/g, " ").trim().slice(0, PREFERENCIAS_MAX);
  return s || null;
}
