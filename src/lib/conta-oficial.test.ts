import { describe, expect, test } from "bun:test";
import { comOficialNoTopo, ehContaOficial, fileiraComOficial, SELO_OFICIAL } from "./conta-oficial";

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

/**
 * ⚠️ O DEFEITO QUE ESTA FUNÇÃO EXISTE PARA IMPEDIR, e ele estava no ar.
 *
 * A fileira é o recorte de `PESSOAS_SUGERIDAS` de um ranking ordenado por elos
 * em comum. A conta oficial não tem elo com ninguém, então ela cai no FIM e é a
 * PRIMEIRA a ser cortada — e a versão anterior procurava por ela DEPOIS do
 * corte. `comOficialNoTopo` recebia uma lista onde ela nunca estava, devolvia a
 * lista intacta, e a conta do consultório simplesmente não aparecia para
 * ninguém. Sem erro e sem log: o recurso inteiro do dia um era um no-op.
 */
describe("a fileira, quando o corte já tirou a oficial", () => {
  const a = { id: "a" };
  const b = { id: "b" };
  const oficial = { id: "of" };

  test("⚠️ cortada do ranking, ela ENTRA — e na frente", () => {
    expect(fileiraComOficial([a, b], oficial)).toEqual([oficial, a, b]);
  });

  test("já no ranking, ela SOBE e não duplica", () => {
    expect(fileiraComOficial([a, oficial, b], oficial)).toEqual([oficial, a, b]);
  });

  /* Sem conta oficial (banco sem a coluna, ou nenhuma marcada) a fileira é a
     que o ranking devolveu — nunca se inventa uma linha. */
  test("sem oficial, a lista não muda", () => {
    expect(fileiraComOficial([a, b], null)).toEqual([a, b]);
    expect(fileiraComOficial([a, b], undefined)).toEqual([a, b]);
  });

  test("fileira vazia com oficial vira a oficial sozinha", () => {
    expect(fileiraComOficial([], oficial)).toEqual([oficial]);
  });
});
