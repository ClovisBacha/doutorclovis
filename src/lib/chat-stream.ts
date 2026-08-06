/**
 * O STREAM DO CHAT — a régua da digitação e o leitor de linha.
 *
 * ─── Por que estas duas coisas saíram de dentro da tela ─────────────────────
 *
 * As duas viviam dentro de `sendText`, uma função de 270 linhas num arquivo de
 * 19.000. Nenhum teste conseguia importá-las, então a suíte fazia a única coisa
 * possível: ler o arquivo como texto e procurar string.
 *
 * O preço disso foi medido. Um avaliador rodou mutação nesta base e o passo da
 * digitação foi o caso mais didático: `digitacao.test.ts` declarava *"o mesmo
 * passo que a tela usa. Copiado de propósito"* — e o teste validava a CÓPIA.
 * Dividir por 45.000 em vez de 45 na tela real não quebrava nada; a resposta
 * levaria horas para aparecer e a suíte continuaria verde.
 *
 * O leitor de linha era pior: ele é a peça que decide se a paciente vê a
 * resposta, o texto de um erro, ou uma bolha em branco — o defeito mais caro
 * deste chat — e não tinha um único teste. Trocar `json.errorText` por
 * `json.mensagem` passava despercebido.
 */

/** Uma linha do fluxo, já interpretada. */
export type PedacoDoStream =
  | { tipo: "texto"; texto: string }
  | { tipo: "erro"; texto: string }
  | { tipo: "nada" };

/**
 * Interpreta UMA linha do fluxo SSE.
 *
 * Três formatos importam:
 *   `data: {"type":"text-delta","delta":"oi"}`  → pedaço da resposta
 *   `data: {"type":"error","errorText":"..."}`  → o provedor falhou DEPOIS de
 *      o HTTP 200 já ter saído; a SDK não pode mais mudar o código, então o
 *      erro viaja dentro do fluxo. Quem não lê esta parte mostra bolha vazia.
 *   qualquer outra                              → ignorada
 *
 * Nunca lança: linha partida ao meio entre dois `read()` é rotina, e uma
 * exceção aqui derrubaria a resposta inteira por causa de um pedaço.
 */
export function lerLinhaDoStream(linha: string): PedacoDoStream {
  if (!linha.startsWith("data: ")) return { tipo: "nada" };
  try {
    const json = JSON.parse(linha.slice(6)) as {
      type?: string;
      delta?: string;
      errorText?: string;
      error?: string;
    };
    if (json.type === "text-delta" && json.delta) return { tipo: "texto", texto: json.delta };
    if (json.type === "error" && (json.errorText || json.error)) {
      return { tipo: "erro", texto: String(json.errorText ?? json.error) };
    }
    return { tipo: "nada" };
  } catch {
    return { tipo: "nada" };
  }
}

/**
 * Quantos caracteres revelar neste quadro.
 *
 * Dois regimes, e a diferença entre eles é a diferença entre "parece escrita"
 * e "faz esperar":
 *
 * - **Chegando** (`streamAberto`): ritmo de leitura. Piso de 2 por quadro para
 *   nunca ficar atrás de um provedor lento, teto de 12 quando há texto
 *   represado.
 * - **Já chegou tudo**: acabar. Não há mais nada a revelar — só a paciente
 *   esperando por texto que o navegador já tem. Medido com a régua antiga
 *   (teto de 12 nos dois regimes): 4.000 caracteres deixavam 6,7s de cauda e
 *   8.000 deixavam 12,3s. Com o piso de 40, 8.000 fecham em ~40 quadros.
 */
export function passoDaDigitacao(atraso: number, streamAberto: boolean): number {
  if (atraso <= 0) return 0;
  return streamAberto
    ? Math.min(12, Math.max(2, Math.ceil(atraso / 45)))
    : Math.max(40, Math.ceil(atraso / 10));
}

/**
 * O texto de erro do servidor pode ser mostrado à paciente?
 *
 * `/api/chat` devolve corpos que servem a públicos diferentes. O 429 do
 * limitador é para ela ler ("aguarde um instante"); `"Missing
 * GOOGLE_GENERATIVE_AI_API_KEY"` é para o log da Vercel — e o cliente aceitava
 * qualquer corpo com menos de 300 caracteres, então a gestante lia o nome de
 * uma variável de ambiente numa bolha de chat.
 *
 * Lista de permissão, não de bloqueio: texto novo do servidor nasce interno até
 * alguém decidir o contrário, que é o lado seguro do erro.
 */
export function avisoQuePodeAparecer(corpo: string): string | null {
  const t = corpo.trim();
  if (!t || t.length > 300) return null;
  /* Vazamentos conhecidos: nome de variável, stack, JSON cru. */
  if (/missing|undefined|null|error:|at\s+\w+\s+\(|^[[{]/i.test(t)) return null;
  /* Frase em português, com pelo menos duas palavras e sem `_` de constante. */
  if (t.includes("_") || !/^[^_]{8,}$/.test(t) || !/\s/.test(t)) return null;
  return t;
}

/**
 * SÓ TEXTO CHEGA AO MODELO — a trava que impede a IA de receber laudo.
 *
 * Ler exame é ato médico: o anexo vai para a aba do médico, e mandá-lo junto
 * convidaria a IA a opinar sobre ele. Duas coisas acontecem aqui:
 *
 * 1. mensagem sem NENHUM texto é descartada inteira — assistente vazio no
 *    histórico faz o Gemini recusar a chamada seguinte, e a falha vira
 *    permanente;
 * 2. partes não-texto são removidas das mensagens que ficam — descartar a
 *    parte é melhor que rejeitar a mensagem, porque a pergunta que veio junto
 *    do anexo é legítima e continua sendo respondida.
 *
 * Vive aqui, e não inline no endpoint, porque um avaliador removeu a trava
 * inteira num teste de mutação e **nenhum teste quebrou**: era a defesa mais
 * importante do produto e a única sem cobertura.
 */
export function soTexto<T extends { parts?: { type: string; text?: string }[] }>(
  mensagens: T[],
): T[] {
  return mensagens
    .filter((m) => m.parts?.some((p) => p.type === "text" && p.text?.trim()))
    .map((m) =>
      m.parts?.every((p) => p.type === "text")
        ? m
        : { ...m, parts: m.parts?.filter((p) => p.type === "text") },
    );
}
