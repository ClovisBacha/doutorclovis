import { describe, expect, test } from "bun:test";
import { celularE164, emailValido, medicoCadastrado, nomeDoMedico } from "./medico-da-gestante";

describe("o médico que ela cadastrou", () => {
  test("celular vira E.164 sem o +", () => {
    expect(celularE164("(31) 99999-0000")).toBe("5531999990000");
    expect(celularE164("31 3333-4444")).toBe("553133334444");
    expect(celularE164("+55 31 99999-0000")).toBe("5531999990000");
    expect(celularE164("999")).toBeNull();
    expect(celularE164(null)).toBeNull();
  });

  test("e-mail inválido não conta", () => {
    expect(emailValido(" Dra.Ana@Clinica.com.br ")).toBe("dra.ana@clinica.com.br");
    expect(emailValido("ana@")).toBeNull();
    expect(emailValido("")).toBeNull();
  });

  test("sem celular e sem e-mail, não há médico — nome sozinho não avisa ninguém", () => {
    expect(medicoCadastrado({ medico_nome: "Dra. Ana" })).toBeNull();
    expect(medicoCadastrado(null)).toBeNull();
    expect(medicoCadastrado({ medico_nome: "Dra. Ana", medico_celular: "31999990000" })).toEqual({
      nome: "Dra. Ana",
      celular: "5531999990000",
      email: null,
    });
  });

  test("o nome tem um padrão que não crava gênero", () => {
    expect(nomeDoMedico(null)).toBe("seu médico ou médica");
    expect(nomeDoMedico({ nome: "Dr. Clóvis", celular: null, email: "a@b.co" })).toBe("Dr. Clóvis");
  });
});
