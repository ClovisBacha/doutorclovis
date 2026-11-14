import { describe, expect, test } from "bun:test";
import { deYmd, diasDesde, mascaraDeData, paraYmd, recusaDaDum, recusaDoUltrassom } from "./datas";

describe("datas digitadas", () => {
  test("a máscara põe as barras", () => {
    expect(mascaraDeData("0")).toBe("0");
    expect(mascaraDeData("0203")).toBe("02/03");
    expect(mascaraDeData("02032026")).toBe("02/03/2026");
    expect(mascaraDeData("02/03/2026999")).toBe("02/03/2026");
  });
  test("data que não existe é recusada", () => {
    expect(paraYmd("31/02/2026")).toBeNull();
    expect(paraYmd("29/02/2028")).toBe("2028-02-29");
    expect(paraYmd("2/3/2026")).toBeNull();
    expect(deYmd("2026-03-02")).toBe("02/03/2026");
  });
  test("a DUM não pode ser futura nem passar de 43 semanas", () => {
    const hoje = new Date(2026, 9, 2);
    expect(recusaDaDum("2026-10-03", hoje)).toBe("futuro");
    expect(recusaDaDum("2025-11-01", hoje)).toBe("antiga");
    expect(recusaDaDum("2026-05-01", hoje)).toBeNull();
    expect(diasDesde("2026-10-01", hoje)).toBe(1);
  });
  test("o ultrassom soma as semanas que ele já tinha", () => {
    const hoje = new Date(2026, 9, 2);
    expect(recusaDoUltrassom("2026-09-01", 12, hoje)).toBeNull();
    expect(recusaDoUltrassom("2026-01-01", 40, hoje)).toBe("antiga");
  });
});
