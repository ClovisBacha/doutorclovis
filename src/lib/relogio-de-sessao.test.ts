/**
 * ⚠️ O relógio de sessão vira `h:mm:ss` passada a hora — e as DUAS telas de
 * cronômetro leem esta função. O defeito que ela trava foi medido nas duas:
 * "125:00" no contador de movimentos (cujo critério é de duas horas) e
 * "3502:18" no cronômetro de contrações (a contração aberta retomada do banco).
 */
import { describe, expect, test } from "bun:test";
import { relogioDeSessao } from "@/lib/relogio-de-sessao";

const min = (m: number) => m * 60000;

describe("o relógio", () => {
  test("abaixo de uma hora é mm:ss", () => {
    expect(relogioDeSessao(0)).toBe("00:00");
    expect(relogioDeSessao(9000)).toBe("00:09");
    expect(relogioDeSessao(min(59) + 59000)).toBe("59:59");
  });

  test("⚠️ a partir de uma hora vira h:mm:ss", () => {
    expect(relogioDeSessao(min(60))).toBe("1:00:00");
    expect(relogioDeSessao(min(125))).toBe("2:05:00");
    /* O caso medido na bancada das contrações. */
    expect(relogioDeSessao(min(3502) + 18000)).toBe("58:22:18");
  });

  test("tempo negativo não vira relógio ao contrário", () => {
    expect(relogioDeSessao(-5000)).toBe("00:00");
  });
});
