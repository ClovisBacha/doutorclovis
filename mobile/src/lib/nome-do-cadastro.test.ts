import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ehOComecoDoEmail, nomeParaSugerir, precisaDeNome } from "~/lib/nome-do-cadastro";

const RELAY = "x7k2m9qd4f@privaterelay.appleid.com";

describe("o nome que o cadastro sugere", () => {
  test("o começo do e-mail não é nome — nem o código do 'Ocultar meu e-mail'", () => {
    expect(ehOComecoDoEmail("x7k2m9qd4f", RELAY)).toBe(true);
    expect(ehOComecoDoEmail("Maria.Silva", "maria.silva@gmail.com")).toBe(true);
    expect(ehOComecoDoEmail("Maria", "maria.silva@gmail.com")).toBe(false);
    expect(ehOComecoDoEmail("", RELAY)).toBe(false);
    expect(ehOComecoDoEmail("Maria", null)).toBe(false);
  });

  test("pela Apple: o nome da folha vence o começo do e-mail que o banco gravou", () => {
    expect(nomeParaSugerir({ doPerfil: "x7k2m9qd4f", daConta: "Ana Souza", email: RELAY })).toBe(
      "Ana Souza",
    );
  });

  test("sem nome de verdade em lugar nenhum, o campo vem vazio", () => {
    expect(nomeParaSugerir({ doPerfil: "x7k2m9qd4f", daConta: null, email: RELAY })).toBe("");
    expect(nomeParaSugerir({ doPerfil: "maria.silva", email: "maria.silva@gmail.com" })).toBe("");
    expect(nomeParaSugerir({})).toBe("");
  });

  test("o nome que ela já escolheu fica", () => {
    expect(nomeParaSugerir({ doPerfil: "Mari", daConta: "Maria Silva", email: RELAY })).toBe(
      "Mari",
    );
    expect(nomeParaSugerir({ doPerfil: null, daConta: "Maria Silva", email: RELAY })).toBe(
      "Maria Silva",
    );
  });

  test("o passo do nome só segue vazio quando o perfil já tem um nome de verdade", () => {
    expect(precisaDeNome({ digitado: "", doPerfil: "x7k2m9qd4f", email: RELAY })).toBe(true);
    expect(precisaDeNome({ digitado: "  ", doPerfil: null, email: RELAY })).toBe(true);
    expect(precisaDeNome({ digitado: "", doPerfil: "Mari", email: RELAY })).toBe(false);
    expect(precisaDeNome({ digitado: "Ana", doPerfil: "x7k2m9qd4f", email: RELAY })).toBe(false);
  });

  test("o ritual usa a regra (e não sugere mais o nome do perfil cru)", () => {
    const ritual = readFileSync(join(import.meta.dir, "..", "app", "ritual.tsx"), "utf8");
    expect(ritual).toContain("nomeParaSugerir(");
    expect(ritual).toContain("precisaDeNome(");
    expect(ritual).not.toMatch(/useState\(\s*perfil\?\.display_name/);
  });
});
