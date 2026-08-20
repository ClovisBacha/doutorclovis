import { describe, expect, test } from "bun:test";
import { comOficialNoTopo, ehContaOficial, SELO_OFICIAL } from "./conta-oficial";

describe("o portão", () => {
  test("só a coluna marca a conta", () => {
    expect(ehContaOficial({ conta_oficial: true })).toBe(true);
    expect(ehContaOficial({ conta_oficial: false })).toBe(false);
  });

  /* ⚠️ Um banco sem a coluna (o deploy chega antes do SQL) se comporta como
     "não existe conta oficial" — que é a verdade, e é o lado seguro. */
  test("⚠️ ausente vale FALSE, nunca true", () => {
    expect(ehContaOficial({})).toBe(false);
    expect(ehContaOficial(null)).toBe(false);
    expect(ehContaOficial(undefined)).toBe(false);
    expect(ehContaOficial({ conta_oficial: null })).toBe(false);
  });
});

describe("a fileira de sugeridas", () => {
  const p = [{ id: "a" }, { id: "of" }, { id: "b" }];

  /* ⚠️ `ordenarPessoas` classifica por elos em comum, e a conta oficial não tem
     elos com ninguém: ela cairia no fim exatamente na conta NOVA, que é a única
     para quem ela importa. */
  test("⚠️ a oficial vem PRIMEIRO", () => {
    expect(comOficialNoTopo(p, "of").map((x) => x.id)).toEqual(["of", "a", "b"]);
  });

  test("⚠️ e nunca aparece duas vezes", () => {
    const r = comOficialNoTopo(p, "of");
    expect(r.filter((x) => x.id === "of")).toHaveLength(1);
    expect(r).toHaveLength(p.length);
  });

  test("sem conta oficial, a lista não muda", () => {
    expect(comOficialNoTopo(p, null)).toEqual(p);
  });

  /* Se ela não estiver entre as sugeridas (já seguida, bloqueada, fora da
     régua), a lista fica como estava — nunca se inventa uma linha. */
  test("não está na lista? a lista não muda", () => {
    expect(comOficialNoTopo(p, "nao-existe")).toEqual(p);
  });
});

describe("o selo", () => {
  /* ⚠️ É o selo do CONSULTÓRIO. O do obstetra dela é outro, resolvido pelo
     vínculo atual e visível só na lista que a autora abre. */
  test("⚠️ não cita médico nem obstetra — é institucional", () => {
    const s = SELO_OFICIAL.toLocaleLowerCase("pt-BR");
    expect(s).not.toContain("médic");
    expect(s).not.toContain("obstetra");
    expect(s).not.toContain("seu ");
  });
});
