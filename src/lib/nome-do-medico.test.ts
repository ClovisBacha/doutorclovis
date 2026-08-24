/**
 * O NOME DO MÉDICO — os dois erros simétricos que esta régua existe para matar.
 *
 * Os dois aconteceram no MESMO recurso (o aviso de presente), no mesmo dia:
 *
 *   · a tela montava `Dr(a). ${display_name}` → "Dr(a). Dr. Clóvis Bacha";
 *   · o push pegava `split(" ")[0]` para encurtar → "Dr. te mandou um presente".
 *
 * A causa dos dois é a mesma: `doctors.display_name` é campo LIVRE e quase todo
 * mundo escreve o título dentro dele. Quem não souber disso erra para um lado
 * ou para o outro, e nenhum dos dois erros dá exceção — só chega esquisito na
 * paciente.
 */

import { describe, expect, test } from "bun:test";
import { nomeDoMedico } from "./nome-do-medico";

describe("título dentro do display_name", () => {
  test("não duplica o título", () => {
    expect(nomeDoMedico("Dr. Clóvis Bacha")).toBe("Dr. Clóvis");
  });

  test("nem devolve o título sozinho", () => {
    /* `split(" ")[0]` devolveria "Dr.". Um título pelado no lugar do nome é
       pior que nome nenhum: parece bug, não parece formalidade. */
    expect(nomeDoMedico("Dr. Clóvis Bacha")).not.toBe("Dr.");
    expect(nomeDoMedico("Dr.")).toBeNull();
    expect(nomeDoMedico("Dra")).toBeNull();
  });

  test("médica é atendida pela mesma régua", () => {
    expect(nomeDoMedico("Dra. Ana Paula Ribeiro")).toBe("Dra. Ana");
    expect(nomeDoMedico("Drª Beatriz Lima")).toBe("Drª Beatriz");
    expect(nomeDoMedico("dra. ana")).toBe("dra. ana");
  });
});

describe("cadastro sem título", () => {
  test("fica só o primeiro nome", () => {
    expect(nomeDoMedico("Clóvis Bacha")).toBe("Clóvis");
    expect(nomeDoMedico("Ana Paula Ribeiro")).toBe("Ana");
  });

  test("um nome só continua valendo", () => {
    expect(nomeDoMedico("Clóvis")).toBe("Clóvis");
  });
});

describe("vazio devolve null, e não uma frase", () => {
  test("nulo, indefinido e espaço em branco", () => {
    /* O fallback é de quem chama: "O seu médico" no aviso do presente e
       "Assistente IA" no cabeçalho do chat são telas diferentes, e nenhuma das
       duas frases cabe dentro desta função. */
    for (const v of [null, undefined, "", "   ", "\n\t"]) {
      expect(nomeDoMedico(v)).toBeNull();
    }
  });
});

describe("espaçamento torto do cadastro não vaza", () => {
  test("espaços extras e quebras somem", () => {
    expect(nomeDoMedico("  Dr.   Clóvis   Bacha  ")).toBe("Dr. Clóvis");
  });
});
