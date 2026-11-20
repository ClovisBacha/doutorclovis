import { lerLinhaDoStream } from "@/lib/chat-stream";

/**
 * O LEITOR DO STREAM DA NUTRICIONISTA — pedaços de bytes entram, a resposta
 * sai. O intérprete de UMA linha é o do site (`lerLinhaDoStream`): duas cópias
 * de um parser divergem, e foi assim que a parte `error` ficou sem ser lida
 * uma vez lá.
 *
 * O que este arquivo acrescenta é o que o leitor de linha não faz:
 *   · o BUFFER — um `data:` partido entre dois pedaços da rede é rotina, e
 *     sem guardar o resto a frase some do meio da resposta;
 *   · o ACÚMULO — texto, erro dentro do fluxo e a assinatura do `finish`.
 *
 * Recebe TEXTO já decodificado (o `TextDecoder` com `{stream: true}` fica com
 * quem lê os bytes, porque acento partido entre dois pedaços é problema de
 * bytes, não de linha).
 */

export type EstadoDoStream = {
  texto: string;
  /** Erro que o servidor mandou DEPOIS do 200 (o provedor falhou no meio). */
  erro: string | null;
  assinatura: string | null;
};

export function criarLeitorDoStream() {
  let resto = "";
  const estado: EstadoDoStream = { texto: "", erro: null, assinatura: null };

  const linha = (l: string) => {
    const p = lerLinhaDoStream(l.replace(/\r$/, ""));
    if (p.tipo === "texto") estado.texto += p.texto;
    else if (p.tipo === "erro") estado.erro = p.texto;
    else if (p.tipo === "assinatura") estado.assinatura = p.assinatura;
  };

  return {
    /** Um pedaço que chegou. Devolve o estado acumulado até aqui. */
    empurrar(pedaco: string): EstadoDoStream {
      resto += pedaco;
      const linhas = resto.split("\n");
      resto = linhas.pop() ?? "";
      linhas.forEach(linha);
      return { ...estado };
    },
    /** O fluxo fechou: a última linha (sem `\n` no fim) também conta. */
    fechar(): EstadoDoStream {
      if (resto) linha(resto);
      resto = "";
      return { ...estado };
    },
  };
}

/** Lê um corpo SSE inteiro de uma vez (a bancada e os testes usam). */
export function lerStreamInteiro(corpo: string): EstadoDoStream {
  const l = criarLeitorDoStream();
  l.empurrar(corpo);
  return l.fechar();
}

/**
 * O cabeçalho `X-Nutricionista-Amostra`: quantas perguntas grátis restam.
 * Ausente = sem amostra (assinante, ou leitura degradada) → `null`, e a linha
 * não aparece. Valor torto também é `null`: um número inventado encurtaria a
 * amostra dela por causa de um defeito nosso.
 */
export function amostraDoCabecalho(valor: string | null | undefined): number | null {
  if (valor == null || valor.trim() === "") return null;
  const n = Number(valor);
  return Number.isInteger(n) && n >= 0 ? n : null;
}
