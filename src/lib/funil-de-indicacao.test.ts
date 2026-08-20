import { describe, expect, test } from "bun:test";
import { montarFunil, SEM_MEDIDA, taxa } from "./funil-de-indicacao";

const f = { porAmiga: 30, porCriadora: 12, publicaram: 18, conectaram: 25, comCodigo: 120 };

describe("os degraus", () => {
  test("estão na ordem do funil", () => {
    expect(montarFunil(f).degraus.map((d) => d.chave)).toEqual([
      "abriram",
      "criaram",
      "publicaram",
      "conectaram",
    ]);
  });

  /* ⚠️ O código fica no navegador e só vira linha quando a conta é criada:
     antes disso não há rastro. Um número inventado no topo faria todas as taxas
     abaixo dele mentirem juntas. */
  test("⚠️ 'abriram o link' é NÃO MEDIDO, e não zero", () => {
    const d = montarFunil(f).degraus[0];
    expect(d.quantos).toBeNull();
    expect(d.comoFoiContado.toLowerCase()).toContain("não medido");
  });

  test("as contas por convite somam as duas origens, e a linha diz quais", () => {
    const d = montarFunil(f).degraus[1];
    expect(d.quantos).toBe(42);
    expect(d.comoFoiContado).toContain("30");
    expect(d.comoFoiContado).toContain("12");
  });

  /* ⚠️ Um painel de conversão sem essa linha é onde alguém lê "publicaram: 12"
     como "12 posts" — e decide sobre uma métrica que nunca existiu. */
  test("⚠️ TODO degrau diz como foi contado", () => {
    for (const d of montarFunil(f).degraus) {
      expect(d.comoFoiContado.trim().length).toBeGreaterThan(20);
    }
  });

  test("o texto do não medido existe e não é '0' nem '—'", () => {
    expect(SEM_MEDIDA).not.toBe("0");
    expect(SEM_MEDIDA).not.toBe("—");
  });
});

describe("a taxa", () => {
  test("é porcentagem com uma casa", () => {
    expect(taxa(42, 18)).toBe(42.9);
    expect(taxa(100, 25)).toBe(25);
  });

  /* ⚠️ Dividir por zero devolveria Infinity; calcular sobre um degrau não
     medido produziria uma porcentagem que parece exata e não é. */
  test("⚠️ null quando algum lado não foi medido, ou o de cima é zero", () => {
    expect(taxa(null, 10)).toBeNull();
    expect(taxa(10, null)).toBeNull();
    expect(taxa(0, 5)).toBeNull();
    expect(taxa(-1, 5)).toBeNull();
  });
});
