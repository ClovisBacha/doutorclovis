import { describe, expect, test } from "bun:test";
import {
  REPETICOES_QUE_CHAMAM,
  TRECHO_MAX,
  agruparPorPessoa,
  trechoParaFila,
  type BarradaNaFila,
} from "./triagem-barrada";

const l = (o: Partial<BarradaNaFila> = {}): BarradaNaFila => ({
  quemId: "a",
  quemNome: "Ana",
  onde: "post",
  desfecho: "clinica",
  trecho: "toma buscopan",
  criadoEm: "2026-08-26T10:00:00Z",
  ...o,
});

describe("o trecho", () => {
  test("corta o que passa do teto", () => {
    const r = trechoParaFila("x".repeat(TRECHO_MAX + 50));
    expect(r.length).toBe(TRECHO_MAX);
    expect(r.endsWith("…")).toBe(true);
  });

  test("normaliza espaço e não corta o que cabe", () => {
    expect(trechoParaFila("  oi   tudo  bem  ")).toBe("oi tudo bem");
  });

  test("⚠️ existe teto — o post inteiro é dado clínico demais para a fila", () => {
    expect(TRECHO_MAX).toBeGreaterThan(80);
    expect(TRECHO_MAX).toBeLessThan(1000);
  });
});

describe("o agrupamento", () => {
  test("⚠️ uma tentativa isolada NÃO chama atenção", () => {
    /* Toda paciente um dia escreve uma frase que a régua barra. */
    const r = agruparPorPessoa([l()]);
    expect(r[0]!.tentativas).toBe(1);
    expect(r[0]!.chamaAtencao).toBe(false);
  });

  test("repetição vira caso", () => {
    const r = agruparPorPessoa(Array.from({ length: REPETICOES_QUE_CHAMAM }, () => l()));
    expect(r[0]!.chamaAtencao).toBe(true);
  });

  test("⚠️ a EMERGÊNCIA nunca conta — é pedido de socorro, não infração", () => {
    /**
     * Se entrasse na conta, a paciente que passou mal três vezes apareceria
     * como reincidente na fila de moderação.
     */
    const r = agruparPorPessoa([
      l({ desfecho: "emergencia" }),
      l({ desfecho: "emergencia" }),
      l({ desfecho: "emergencia" }),
    ]);
    expect(r).toEqual([]);
  });

  test("⚠️ e emergência misturada não infla a contagem", () => {
    const r = agruparPorPessoa([l(), l({ desfecho: "emergencia" }), l()]);
    expect(r[0]!.tentativas).toBe(2);
  });

  test("quem repete mais vem primeiro", () => {
    const r = agruparPorPessoa([
      l({ quemId: "so-uma" }),
      l({ quemId: "varias" }),
      l({ quemId: "varias" }),
    ]);
    expect(r[0]!.quemId).toBe("varias");
  });

  test("empate desempata pelo mais recente", () => {
    const r = agruparPorPessoa([
      l({ quemId: "velha", criadoEm: "2026-08-20T10:00:00Z" }),
      l({ quemId: "nova", criadoEm: "2026-08-25T10:00:00Z" }),
    ]);
    expect(r[0]!.quemId).toBe("nova");
  });

  test("no máximo três exemplos por pessoa", () => {
    const r = agruparPorPessoa(Array.from({ length: 9 }, () => l()));
    expect(r[0]!.exemplos.length).toBe(3);
    expect(r[0]!.tentativas).toBe(9);
  });

  test("lista vazia não quebra", () => {
    expect(agruparPorPessoa([])).toEqual([]);
  });
});
