import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { toJSONAsync } from "seroval";
import { sha256Hex } from "./sha256";
import { idDaFuncao } from "./id-da-funcao";

// ⚠️ Não importa ponte.ts: ela puxa o cliente do Supabase e o AsyncStorage
// (módulo nativo). O que se testa aqui é o CONTRATO com o servidor.

describe("sha256 em JavaScript puro", () => {
  test("bate com o node:crypto, inclusive com acento e emoji", () => {
    const casos = [
      "",
      "abc",
      "src/lib/a.functions.ts--x_createServerFn_handler",
      "ção 🌱",
      "a".repeat(55),
      "b".repeat(64),
      "c".repeat(1000),
    ];
    for (const c of casos) expect(sha256Hex(c)).toBe(createHash("sha256").update(c).digest("hex"));
  });
});

describe("o id de uma função de servidor", () => {
  test("é o que a produção aceitou para listLivesPublic", () => {
    // Medido em 02/10/2026: POST em /_serverFn/<este id> devolveu 200 com
    // {result:{ok:true,lives:[]}} — a prova de que a fórmula é a do build.
    expect(idDaFuncao("src/lib/lives.functions.ts", "listLivesPublic")).toBe(
      "6723b7747b3ee323a3f0fc572cfc6fccf169c9ecb26e52fc10ed4edaa92ca176",
    );
  });
});

describe("o corpo do pedido", () => {
  test("é o formato do seroval que o servidor desserializa", async () => {
    const corpo = JSON.stringify(await toJSONAsync({ data: {} }));
    expect(corpo).toBe(
      '{"t":{"t":10,"i":0,"p":{"k":["data"],"v":[{"t":10,"i":1,"p":{"k":[],"v":[]},"o":0}]},"o":0},"f":63,"m":[]}',
    );
  });
});
