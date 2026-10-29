import { describe, expect, test } from "bun:test";
import { amostraDoCabecalho, criarLeitorDoStream, lerStreamInteiro } from "./stream";

/* O corpo real do `toUIMessageStreamResponse` do AI SDK, como o
   `/api/nutrition` manda: start, text-start, deltas, text-end, finish com a
   assinatura no messageMetadata, e [DONE]. */
const CORPO = [
  'data: {"type":"start","messageId":"m1"}',
  "",
  'data: {"type":"text-start","id":"t1"}',
  "",
  'data: {"type":"text-delta","id":"t1","delta":"Peixe **cru** "}',
  "",
  'data: {"type":"text-delta","id":"t1","delta":"fica fora.\\n\\n• Hot roll"}',
  "",
  'data: {"type":"text-end","id":"t1"}',
  "",
  'data: {"type":"finish","messageMetadata":{"assinatura":"abc.123"}}',
  "",
  "data: [DONE]",
  "",
].join("\n");

describe("leitor do SSE da nutricionista", () => {
  test("junta os deltas e pega a assinatura do finish", () => {
    const e = lerStreamInteiro(CORPO);
    expect(e.texto).toBe("Peixe **cru** fica fora.\n\n• Hot roll");
    expect(e.assinatura).toBe("abc.123");
    expect(e.erro).toBeNull();
  });

  test("linha partida entre dois pedaços da rede não perde texto", () => {
    /* Corta o corpo em TODO ponto possível: o resultado tem de ser igual. */
    for (let corte = 1; corte < CORPO.length; corte++) {
      const l = criarLeitorDoStream();
      l.empurrar(CORPO.slice(0, corte));
      l.empurrar(CORPO.slice(corte));
      const e = l.fechar();
      expect(e.texto).toBe("Peixe **cru** fica fora.\n\n• Hot roll");
      expect(e.assinatura).toBe("abc.123");
    }
  });

  test("pedaço a pedaço, o texto cresce enquanto chega", () => {
    const l = criarLeitorDoStream();
    const a = l.empurrar('data: {"type":"text-delta","delta":"Oi"}\n');
    expect(a.texto).toBe("Oi");
    const b = l.empurrar('data: {"type":"text-delta","delta":", tudo bem?"}\n');
    expect(b.texto).toBe("Oi, tudo bem?");
  });

  test("última linha sem \\n no fim também conta", () => {
    const l = criarLeitorDoStream();
    l.empurrar('data: {"type":"text-delta","delta":"fim"}');
    expect(l.fechar().texto).toBe("fim");
  });

  test("CRLF não quebra a leitura", () => {
    const e = lerStreamInteiro('data: {"type":"text-delta","delta":"a"}\r\n\r\ndata: {"type":"text-delta","delta":"b"}\r\n');
    expect(e.texto).toBe("ab");
  });

  test("erro dentro do fluxo (depois do 200) é lido, e não vira bolha vazia", () => {
    const e = lerStreamInteiro(
      'data: {"type":"start"}\n\ndata: {"type":"error","errorText":"Não consegui responder agora. Pode tentar de novo?"}\n\ndata: [DONE]\n',
    );
    expect(e.texto).toBe("");
    expect(e.erro).toBe("Não consegui responder agora. Pode tentar de novo?");
  });

  test("lixo, [DONE] e linhas sem 'data: ' não lançam", () => {
    const e = lerStreamInteiro("oi\n: ping\ndata: {quebrado\ndata: [DONE]\n");
    expect(e).toEqual({ texto: "", erro: null, assinatura: null });
  });
});

describe("cabeçalho X-Nutricionista-Amostra", () => {
  test("ausente = sem amostra (a linha não aparece)", () => {
    expect(amostraDoCabecalho(null)).toBeNull();
    expect(amostraDoCabecalho(undefined)).toBeNull();
    expect(amostraDoCabecalho("")).toBeNull();
  });
  test("número inteiro não negativo passa", () => {
    expect(amostraDoCabecalho("2")).toBe(2);
    expect(amostraDoCabecalho("0")).toBe(0);
  });
  test("valor torto é 'não sei', nunca um número inventado", () => {
    expect(amostraDoCabecalho("-1")).toBeNull();
    expect(amostraDoCabecalho("1.5")).toBeNull();
    expect(amostraDoCabecalho("dois")).toBeNull();
  });
});
