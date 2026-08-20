import { describe, expect, test } from "bun:test";
import { montarFunil, SEM_MEDIDA, taxa } from "./funil-de-indicacao";

const f = {
  porAmiga: 30,
  porCriadora: 12,
  /* ⚠️ 38, e não 42: quatro pacientes têm os DOIS campos. */
  chegaram: 38,
  publicaram: 18,
  conectaram: 25,
  comCodigo: 120,
};

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

  /**
   * ⚠️ NUNCA `porAmiga + porCriadora` — e a soma estava lá.
   *
   * Os dois campos convivem na mesma linha: quem entrou pelo link de uma amiga
   * (`referred_by`) pode digitar depois o código de uma embaixadora
   * (`ref_code`) no Perfil — é exatamente para isso que o cartão da rede de
   * segurança existe. Somando, essa paciente entrava DUAS VEZES no degrau de
   * cima e inflava o denominador de todas as taxas abaixo: o painel mostraria
   * um funil vazando onde ele não vaza.
   */
  test("⚠️ quem tem as DUAS origens conta UMA vez", () => {
    const d = montarFunil(f).degraus[1];
    expect(d.quantos).toBe(38);
    expect(d.quantos).not.toBe(f.porAmiga + f.porCriadora);
    expect(d.comoFoiContado).toContain("30");
    expect(d.comoFoiContado).toContain("12");
    // E a linha explica a diferença, senão 30 + 12 ≠ 38 parece erro de conta.
    expect(d.comoFoiContado).toContain("4");
  });

  /* ⚠️ Recuo: se a contagem do OR falhar (devolve 0 por `safe()`), o degrau não
     pode ficar MENOR que uma das origens — seria uma taxa acima de 100%. */
  test("⚠️ contagem do OR falhando cai no MAIOR, nunca na soma", () => {
    const d = montarFunil({ ...f, chegaram: 0 }).degraus[1];
    expect(d.quantos).toBe(30);
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
