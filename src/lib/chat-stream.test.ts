/**
 * A PEÇA QUE DECIDE SE A PACIENTE VÊ ALGUMA COISA.
 *
 * Estes testes não existiam — e não podiam existir: o leitor de linha e a
 * régua da digitação viviam dentro de uma função de 270 linhas num arquivo de
 * 19.000. A suíte fazia a única coisa possível, que era ler o arquivo como
 * texto e procurar string.
 *
 * O custo foi medido por um avaliador com teste de mutação: `digitacao.test.ts`
 * declarava *"o mesmo passo que a tela usa. Copiado de propósito"* e validava a
 * CÓPIA — dividir por 45.000 em vez de 45 na tela real não quebrava nada. E o
 * leitor de linha, que é o que separa "resposta" de "bolha em branco", não
 * tinha um único teste: trocar `errorText` por `mensagem` passava despercebido.
 */

import { describe, expect, test } from "bun:test";
import { avisoQuePodeAparecer, lerLinhaDoStream, passoDaDigitacao } from "./chat-stream";

describe("ler a linha do fluxo", () => {
  test("pedaço de texto vira texto", () => {
    expect(lerLinhaDoStream('data: {"type":"text-delta","delta":"oi"}')).toEqual({
      tipo: "texto",
      texto: "oi",
    });
  });

  test("A PARTE DE ERRO — a que virava bolha vazia", () => {
    /* Quando o provedor falha DEPOIS de o HTTP 200 já ter saído, a SDK não
       pode mais mudar o código: o erro viaja dentro do fluxo. Quem não lê esta
       parte mostra uma bolha em branco, e a paciente entende isso como "a IA
       não soube responder" — que é a leitura errada. */
    expect(lerLinhaDoStream('data: {"type":"error","errorText":"Muitas mensagens"}')).toEqual({
      tipo: "erro",
      texto: "Muitas mensagens",
    });
  });

  test("aceita o campo `error` além do `errorText`", () => {
    expect(lerLinhaDoStream('data: {"type":"error","error":"falhou"}')).toEqual({
      tipo: "erro",
      texto: "falhou",
    });
  });

  test("linha partida ao meio não derruba a resposta", () => {
    /* Um `read()` corta no meio do JSON o tempo todo. Uma exceção aqui mataria
       a resposta inteira por causa de um pedaço. */
    expect(lerLinhaDoStream('data: {"type":"text-de')).toEqual({ tipo: "nada" });
    expect(lerLinhaDoStream("data: ")).toEqual({ tipo: "nada" });
    expect(lerLinhaDoStream("")).toEqual({ tipo: "nada" });
    expect(lerLinhaDoStream(": keep-alive")).toEqual({ tipo: "nada" });
  });

  test("delta vazio não conta como texto", () => {
    /* Mensagem sem conteúdo é o que envenena o histórico: o Gemini recusa
       assistente sem texto, e a falha vira permanente. */
    expect(lerLinhaDoStream('data: {"type":"text-delta","delta":""}')).toEqual({ tipo: "nada" });
  });

  test("um fluxo inteiro, montado", () => {
    const linhas = [
      'data: {"type":"start"}',
      'data: {"type":"text-delta","delta":"Sim, "}',
      'data: {"type":"text-delta","delta":"pode."}',
      "data: [DONE]",
    ];
    const texto = linhas
      .map(lerLinhaDoStream)
      .filter((p) => p.tipo === "texto")
      .map((p) => (p as { texto: string }).texto)
      .join("");
    expect(texto).toBe("Sim, pode.");
  });
});

describe("a régua da digitação", () => {
  test("nunca fica atrás de um provedor lento", () => {
    /* Piso de 2 por quadro = 120 caracteres por segundo a 60fps. */
    expect(passoDaDigitacao(1, true)).toBe(2);
    expect(passoDaDigitacao(10, true)).toBe(2);
  });

  test("acelera quando há texto represado, mas com teto", () => {
    expect(passoDaDigitacao(450, true)).toBe(10);
    expect(passoDaDigitacao(5000, true)).toBe(12);
  });

  test("com o stream FECHADO, acaba — não faz esperar", () => {
    /* Este é o conserto que a régua antiga não tinha: o teto de 12 valia nos
       dois regimes, e 8.000 caracteres deixavam 12,3s de cauda DEPOIS de o
       texto inteiro já estar no navegador. */
    expect(passoDaDigitacao(8000, false)).toBe(800);
    expect(passoDaDigitacao(100, false)).toBe(40);
  });

  test("uma resposta longa fecha em menos de um segundo", () => {
    /* A régua rodada de verdade: quantos quadros para desenhar N caracteres
       que já chegaram todos. A 60fps, 60 quadros = 1s. */
    const quadros = (n: number) => {
      let mostrado = 0;
      let q = 0;
      while (mostrado < n && q < 100_000) {
        mostrado += passoDaDigitacao(n - mostrado, false);
        q++;
      }
      return q;
    };
    expect(quadros(2_000)).toBeLessThan(60);
    expect(quadros(8_000)).toBeLessThan(60);
    expect(quadros(20_000)).toBeLessThan(60);
  });

  test("sem atraso, não anda", () => {
    expect(passoDaDigitacao(0, true)).toBe(0);
    expect(passoDaDigitacao(0, false)).toBe(0);
  });
});

describe("o que o servidor diz pode chegar à paciente?", () => {
  test("o 429 é para ela ler — é acionável", () => {
    expect(avisoQuePodeAparecer("Muitas mensagens em pouco tempo. Aguarde um instante.")).toBe(
      "Muitas mensagens em pouco tempo. Aguarde um instante.",
    );
  });

  test("NOME DE VARIÁVEL DE AMBIENTE, não", () => {
    /* O cliente aceitava qualquer corpo com menos de 300 caracteres, e
       `/api/chat` devolve "Missing GOOGLE_GENERATIVE_AI_API_KEY" com 36. A
       gestante lia isso numa bolha de chat. */
    expect(avisoQuePodeAparecer("Missing GOOGLE_GENERATIVE_AI_API_KEY")).toBeNull();
  });

  test("stack, JSON cru e resposta longa também não", () => {
    expect(avisoQuePodeAparecer('{"error":"boom"}')).toBeNull();
    expect(avisoQuePodeAparecer("TypeError: undefined is not a function")).toBeNull();
    expect(avisoQuePodeAparecer("x".repeat(400))).toBeNull();
    expect(avisoQuePodeAparecer("")).toBeNull();
  });

  test("uma palavra só não é frase — é identificador", () => {
    expect(avisoQuePodeAparecer("unauthorized")).toBeNull();
  });
});
