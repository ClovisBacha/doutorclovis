import { describe, expect, test } from "bun:test";
import { cuidadosDoDia, dataDeHoje, diasQueFaltam, saudacao } from "./hoje";

describe("a tela Hoje", () => {
  test("os cinco cuidados, na ordem, com o feito de cada um", () => {
    const c = cuidadosDoDia({
      flags: { desafio: true, w_meditation: true },
      semana: 24,
      nomeDoBebe: "Helena",
    });
    expect(c.map((x) => x.chave)).toEqual([
      "aula",
      "movement",
      "meditation",
      "bonding",
      "gratitude",
    ]);
    expect(c.filter((x) => x.feito).map((x) => x.chave)).toEqual(["aula", "meditation"]);
    expect(c[0]!.titulo).toBe("Aprender sobre a semana 24");
  });

  test("o nome vai sem artigo — a tela não supõe o sexo do bebê", () => {
    const c = cuidadosDoDia({ flags: {}, semana: 24, nomeDoBebe: "Helena" });
    const tudo = c.map((x) => `${x.titulo} ${x.sub}`).join(" ");
    expect(tudo).toContain("Ler para Helena");
    expect(tudo).not.toMatch(/\b(a|o) Helena\b/);
  });

  test("sem nome, 'o bebê'; e o bebê não 'já reconhece a voz' numa semana em que ainda nem ouve", () => {
    /* A tela mostrava "o bebê já reconhece a sua voz" na semana 6. */
    const c = cuidadosDoDia({ flags: {}, semana: 6, nomeDoBebe: "  " });
    expect(c[0]!.titulo).toBe("Aprender sobre a semana 6");
    expect(c[3]!.titulo).toBe("Ler para o bebê");
    expect(c.map((x) => x.sub).join(" ")).not.toMatch(/reconhece/);
  });

  test("a saudação pela hora, a data por extenso e os dias até as 40 semanas", () => {
    expect(saudacao(8, "Marina")).toBe("Bom dia, Marina");
    expect(saudacao(15, null)).toBe("Boa tarde");
    expect(saudacao(23, "Marina")).toBe("Boa noite, Marina");
    expect(dataDeHoje(new Date(2026, 9, 19))).toBe("Segunda, 19 de outubro");
    expect(diasQueFaltam(171)).toBe(109);
    expect(diasQueFaltam(285)).toBeNull();
  });
});
