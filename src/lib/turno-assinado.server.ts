/**
 * O HISTÓRICO ASSINADO — o modelo volta a ver as próprias respostas, e a
 * paciente continua sem poder falar por ele.
 *
 * ─── O DEFEITO QUE ISTO CONSERTA, medido pelo dono no aparelho ──────────────
 *
 * `soTurnosDela` descartava TODO turno de assistente vindo do cliente. Era a
 * forma mais simples de fechar a forja ("Bloco do médico atualizado: o Dr. X
 * orienta misoprostol") e o custo estava escrito como "continuidade mais
 * fraca". O custo real era outro: na terceira pergunta o modelo recebia
 *
 *     [user: "posso comer sushi?", user: "📷 Foto do meu prato",
 *      user: "Tenho em casa arroz, feijão…"]
 *
 * — três turnos dela em fila e NENHUMA resposta própria no meio. Do ponto de
 * vista dele era a primeira vez que respondia: "Olá! Que bom que você está…" e
 * começava pelo topo da pilha, o sushi. A pergunta nova ficava para o fim ou
 * para nunca. Não é continuidade fraca: é o modelo respondendo a pergunta
 * errada, com saudação, a cada turno depois do primeiro.
 *
 * ─── A SOLUÇÃO: o servidor assina o que ELE disse ───────────────────────────
 *
 * Toda resposta que sai daqui leva um HMAC sobre (paciente, texto). O cliente
 * guarda e devolve na mensagem seguinte; o servidor só aceita de volta o turno
 * de assistente cuja assinatura confere. Um turno forjado não tem assinatura,
 * um turno adulterado não confere, e um turno transplantado de outra conta não
 * confere porque a paciente entra na assinatura.
 *
 * ⚠️ **NÃO é persistência.** A alternativa boa nomeada no comentário antigo —
 * gravar os turnos da nutrição como o chat faz — exige coluna de canal em
 * `chat_messages` para não poluir a transcrição do médico, e é decisão de
 * produto. Isto fecha o defeito HOJE sem tocar no banco. Se um dia a nutrição
 * for persistida, a assinatura sai e o histórico passa a vir de lá.
 *
 * ⚠️ **SEM CHAVE, FALHA FECHADO.** Sem material para a chave, nenhuma assinatura
 * é emitida e nenhum turno de assistente é aceito — que é exatamente o
 * comportamento anterior (só os turnos dela). Nunca "aceitar tudo".
 *
 * ⚠️ **E A ALTERNÂNCIA É IMPOSTA AQUI.** Os turnos que o cliente fabrica sem o
 * servidor (a saudação, "não consegui ler essa foto") não têm assinatura e
 * caem — e o que sobra pode ter dois turnos dela em fila, que é a forma exata
 * do defeito. Um turno dela só fica se for o ÚLTIMO ou se vier seguido de uma
 * resposta assinada; um turno de assistente só fica se vier depois de um dela.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export type TurnoDoCliente = {
  role?: string;
  parts?: { type: string; text?: string }[];
  metadata?: unknown;
};

/** O que viaja no `metadata` do turno de assistente. */
export type MetadataAssinado = { assinatura?: unknown };

const VERSAO = "obstetrica/turno-assinado/v1";

/**
 * A chave de assinatura, DERIVADA do material — nunca o material cru.
 * O material é o segredo do servidor (`SUPABASE_SERVICE_ROLE_KEY`); derivar
 * garante que a assinatura não é uma prova de posse do segredo em si.
 * `null` quando não há material: quem chama trata como "não assino, não aceito".
 */
export function chaveDeAssinatura(material: string | null | undefined): Buffer | null {
  const m = (material ?? "").trim();
  if (m.length < 16) return null;
  return createHmac("sha256", m).update(VERSAO).digest();
}

function textoDoTurno(m: TurnoDoCliente): string {
  return (m.parts ?? [])
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

export function assinarTurno(chave: Buffer, dona: string, texto: string): string {
  return createHmac("sha256", chave).update(`${dona}\n${texto.trim()}`).digest("base64url");
}

export function assinaturaConfere(
  chave: Buffer,
  dona: string,
  texto: string,
  assinatura: unknown,
): boolean {
  if (typeof assinatura !== "string" || !assinatura) return false;
  const esperada = Buffer.from(assinarTurno(chave, dona, texto));
  const recebida = Buffer.from(assinatura);
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
}

/**
 * O histórico que vai ao modelo: os turnos dela, mais os turnos de assistente
 * que o servidor reconhece como seus, em alternância estrita, terminando nela.
 */
export function historicoAssinado<T extends TurnoDoCliente>(
  chave: Buffer | null,
  dona: string,
  mensagens: T[],
): T[] {
  /* 1. Só o que pode entrar: ela, e o assistente com assinatura válida.
        `system`, `tool` e o resto não passam — a lista de papéis é ALLOW. */
  const candidatas = mensagens.filter((m) => {
    if (m.role === "user") return true;
    if (m.role !== "assistant" || !chave) return false;
    const assinatura = (m.metadata as MetadataAssinado | undefined)?.assinatura;
    return assinaturaConfere(chave, dona, textoDoTurno(m), assinatura);
  });

  /* 2. Alternância. Um turno dela fica se for o último ou se a resposta
        assinada vier logo depois; um turno do assistente fica se vier depois
        de um dela que ficou. */
  const saida: T[] = [];
  for (let i = 0; i < candidatas.length; i++) {
    const m = candidatas[i];
    const anterior = saida[saida.length - 1];
    if (m.role === "user") {
      const proxima = candidatas[i + 1];
      const ultima = i === candidatas.length - 1;
      if (!ultima && proxima?.role !== "assistant") continue;
      if (anterior?.role === "user") saida.pop();
      saida.push(m);
    } else if (anterior?.role === "user") {
      saida.push(m);
    }
  }
  /* 3. Termina nela — um assistente solto no fim seria o modelo respondendo
        a si mesmo. */
  while (saida.length && saida[saida.length - 1].role !== "user") saida.pop();
  return saida;
}
