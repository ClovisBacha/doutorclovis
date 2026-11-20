import { describe, expect, test, mock } from "bun:test";

mock.module("~/servidor/supabase", () => ({ supabase: {} }));
const { colunaQueFalta } = await import("./gravar-perfil");

describe("colunaQueFalta", () => {
  test("lê a coluna da mensagem do PostgREST", () => {
    expect(
      colunaQueFalta({
        code: "PGRST204",
        message: "Could not find the 'blood_type' column of 'patient_profiles' in the schema cache",
      }),
    ).toBe("blood_type");
  });
  test("lê a mensagem do Postgres", () => {
    expect(
      colunaQueFalta({
        message: 'column "emergency_email" of relation "patient_profiles" does not exist',
      }),
    ).toBe("emergency_email");
  });
  test("outro erro não é coluna ausente", () => {
    expect(colunaQueFalta({ message: "new row violates row-level security policy" })).toBeNull();
    expect(colunaQueFalta(null)).toBeNull();
  });
});
