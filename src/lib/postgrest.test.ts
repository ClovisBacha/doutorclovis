/**
 * Os dois códigos de "coluna ausente" — a confusão que já custou caro.
 *
 * Este teste existe por causa de dois defeitos reais, encontrados no mesmo dia:
 *
 *  · `devolutivaDoExame` checava só `42703` num INSERT. O PostgREST devolve
 *    `PGRST204` para coluna ausente no PAYLOAD, então o recuo nunca rodava: o
 *    texto que o médico escreveu para a paciente ("Seu TOTG veio alterado,
 *    precisamos conversar") não era gravado, e a tela mostrava "Marcado como
 *    lido ✓" e fechava o modal.
 *
 *  · `setQuestionAnswered` fazia igual num UPDATE. No banco de produção de
 *    hoje, o botão "marcar respondida" falha sempre, sem pista.
 *
 * Nos dois casos `tsc`, `eslint` e o build passaram limpos: uma string
 * comparada com a string errada é código perfeitamente válido.
 */

import { describe, expect, test } from "bun:test";
import { colunaAusente, faltaNoBanco, tabelaAusente } from "./postgrest";

describe("colunaAusente cobre leitura E escrita", () => {
  test("42703 — Postgres, coluna citada num SELECT", () => {
    expect(colunaAusente({ code: "42703" })).toBe(true);
  });

  test("PGRST204 — PostgREST, coluna no payload de INSERT/UPDATE", () => {
    /* O caso que sumiu com a devolutiva do médico. */
    expect(colunaAusente({ code: "PGRST204" })).toBe(true);
  });

  test("erro real NÃO é confundido com migration pendente", () => {
    /* Isto é o que impede o recuo de engolir problema de verdade: violação de
       constraint, RLS e permissão precisam continuar sendo erro. */
    expect(colunaAusente({ code: "23505" })).toBe(false); // unique_violation
    expect(colunaAusente({ code: "42501" })).toBe(false); // insufficient_privilege
    expect(colunaAusente({ code: "PGRST301" })).toBe(false); // JWT expirado
    expect(colunaAusente({ code: "42P01" })).toBe(false); // tabela, não coluna
  });
});

describe("tabelaAusente", () => {
  test("42P01 e PGRST205 — os dois sentidos de 'essa tabela não existe'", () => {
    expect(tabelaAusente({ code: "42P01" })).toBe(true);
    /* PGRST205 é tabela fora do schema cache. Tratá-lo como erro real fazia o
       painel acender "não consegui ler todos os registros" em TODO
       carregamento, porque produção não tem quatro das tabelas lidas. */
    expect(tabelaAusente({ code: "PGRST205" })).toBe(true);
    expect(tabelaAusente({ code: "42703" })).toBe(false);
  });
});

describe("faltaNoBanco junta os dois", () => {
  test("qualquer um dos quatro", () => {
    for (const c of ["42703", "PGRST204", "42P01", "PGRST205"]) {
      expect(faltaNoBanco({ code: c })).toBe(true);
    }
    expect(faltaNoBanco({ code: "23505" })).toBe(false);
  });
});

describe("bordas", () => {
  test("null, undefined e erro sem código não são migration pendente", () => {
    /* Fail-closed: sem código, o recuo NÃO deve entrar — ele existe para um
       caso específico e conhecido, não para 'deu algum problema'. */
    expect(colunaAusente(null)).toBe(false);
    expect(colunaAusente(undefined)).toBe(false);
    expect(colunaAusente({})).toBe(false);
    expect(colunaAusente({ code: null })).toBe(false);
    expect(faltaNoBanco(null)).toBe(false);
  });

  test("comparação é exata — não casa por prefixo nem por caixa", () => {
    expect(colunaAusente({ code: "PGRST2040" })).toBe(false);
    expect(colunaAusente({ code: "pgrst204" })).toBe(false);
    expect(colunaAusente({ code: " 42703" })).toBe(false);
  });
});
