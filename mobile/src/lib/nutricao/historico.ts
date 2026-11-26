/**
 * A CONVERSA NA TELA E O QUE SOBE PARA O MODELO — a régua pura.
 *
 * A tela guarda mais coisas do que o modelo pode ver: o cartão de socorro, o
 * recado de uma foto que não deu para ler, uma resposta que chegou pela metade.
 * Nada disso pode subir:
 *
 *   · o SOCORRO não sai do aparelho — é a garantia de `socorro-na-nutricao`, e
 *     ela tem de ser estrutural aqui, não depender do servidor descartar;
 *   · RECADO do app não é turno da nutricionista: sem assinatura o servidor o
 *     descartaria, e a pergunta dela ficaria órfã;
 *   · turno de assistente SEM assinatura idem.
 *
 * O servidor (`historicoAssinado`, em `turno-assinado.server.ts`) aplica a
 * mesma alternância — mas mandar já certo é o que evita o modelo receber duas
 * perguntas dela em fila e responder à primeira.
 */

export type EspecieDoTurno = "conversa" | "socorro" | "recado";

export type Turno = {
  id: string;
  role: "user" | "assistant";
  texto: string;
  especie: EspecieDoTurno;
  /** A assinatura do servidor sobre a resposta (só assistente, só conversa). */
  assinatura?: string;
  /** URI local da foto (só em memória; nunca gravada). */
  foto?: string;
};

export type MensagemDaApi = {
  id: string;
  role: "user" | "assistant";
  parts: { type: "text"; text: string }[];
  metadata?: { assinatura: string };
};

/** O mesmo teto do servidor (`MAX_MENSAGENS_DO_CLIENTE`). */
export const MAX_MENSAGENS = 12;

/** Um turno pode voltar ao modelo? */
function sobe(t: Turno): boolean {
  if (t.especie !== "conversa") return false;
  if (!t.texto.trim()) return false;
  if (t.role === "assistant") return !!t.assinatura;
  return true;
}

/**
 * O corpo `messages` de um envio: o histórico que pode subir, mais a pergunta
 * nova no fim.
 *
 * Regras (as do servidor, aplicadas antes da rede):
 *   1. só conversa; assistente só com assinatura;
 *   2. alterna ela/assistente — pergunta dela sem resposta assinada logo
 *      depois cai;
 *   3. termina nela (a pergunta nova);
 *   4. no máximo 12, e a primeira é dela (um assistente abrindo a conversa
 *      seria a nutricionista falando sozinha).
 */
export function historicoParaEnviar(turnos: readonly Turno[], pergunta: string): MensagemDaApi[] {
  const candidatos = turnos.filter(sobe);
  const pares: Turno[] = [];
  for (let i = 0; i < candidatos.length; i++) {
    const t = candidatos[i];
    const proximo = candidatos[i + 1];
    if (t.role === "user" && proximo?.role === "assistant") {
      pares.push(t, proximo);
      i++;
    }
    /* Pergunta sem resposta, ou resposta sem pergunta: cai. */
  }
  const nova: Turno = {
    id: `nova-${turnos.length}`,
    role: "user",
    texto: pergunta,
    especie: "conversa",
  };
  let lista = [...pares, nova];
  if (lista.length > MAX_MENSAGENS) lista = lista.slice(-MAX_MENSAGENS);
  while (lista.length && lista[0].role !== "user") lista = lista.slice(1);
  return lista.map((t) => ({
    id: t.id,
    role: t.role,
    parts: [{ type: "text", text: t.texto }],
    ...(t.role === "assistant" && t.assinatura ? { metadata: { assinatura: t.assinatura } } : {}),
  }));
}

/** Da memória do banco (já em ordem, ver `turnosDaMemoria`) para a tela. */
export function turnosDaTela(
  memoria: readonly { role: "user" | "assistant"; content: string; assinatura?: string }[],
): Turno[] {
  return memoria.map((m, i) => ({
    id: `memoria-${i}`,
    role: m.role,
    texto: m.content,
    especie: "conversa" as const,
    ...(m.assinatura ? { assinatura: m.assinatura } : {}),
  }));
}
