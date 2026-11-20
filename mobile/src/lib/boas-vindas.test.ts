import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";
import { FALA_NA_ENTRADA, frasesDasBoasVindas, SLIDES } from "~/lib/boas-vindas";

/**
 * OS SLIDES DE BOAS-VINDAS (19/11/2026): bem-estar materno, com a Bolha se
 * apresentando e um slide para cada cuidado do app.
 *
 * ⚠️ A entrada não sabe se quem abre está no Modo Cuidado: nenhum slide fala
 * do bebê nem o mostra. E bem-estar não é conselho médico: nenhum promete
 * efeito.
 */

const RAIZ = join(import.meta.dir, "..");
const fonte = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), "utf8"));

/** Promessa de efeito ou conduta (a régua do resumo de 19/11: "Saúde sem conduta"). */
const PROMESSA =
  /\b(reduz\w*|melhora\w*|fortalec\w*|previne|preven\w*|alivia\w*|faz bem|saud[aá]vel|deve(ria)?|precisa|procure|recomendad\w*|ansiedade|m[eé]dic[oa]s?|exames?|rem[eé]dios?|suplement\w*|dieta|sintomas?)\b/i;

describe("os slides vendem bem-estar, com a Bolha", () => {
  test("a Bolha se apresenta no primeiro slide e convida no último", () => {
    expect(FALA_NA_ENTRADA.ola).toMatch(/^Oi, eu sou a Bolha!/);
    expect(FALA_NA_ENTRADA.ola).toMatch(/aprender/);
    expect(FALA_NA_ENTRADA.ola).toMatch(/respirar/);
    expect(FALA_NA_ENTRADA.ola).toMatch(/mexer o corpo/);
    expect(SLIDES.bolha.titulo).toBe("Mãe Esperta");
  });

  test("um slide para cada cuidado de verdade: a aula, respirar, mexer, a trilha com a amiga", () => {
    const entrar = fonte("app", "(entrada)", "entrar.tsx");
    const ordem = [
      "<VitrineDaBolha",
      "<VitrineDaAula",
      "<VitrineDaPausa",
      "<VitrineDoMexer",
      "<VitrineDaTrilha",
      "<VitrineDoFim",
    ].map((v) => entrar.indexOf(v));
    expect(ordem.every((i) => i > 0)).toBe(true);
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
    expect(entrar).toContain("const TOTAL = 6;");
    /* Cada vitrine tem a Bolha na pose do cuidado. */
    const vitrines = fonte("componentes", "boas-vindas.tsx");
    for (const pose of ["feliz", "estudiosa", "dormindo", "exercicio", "apaixonado", "comemorando"])
      expect({ pose, tem: vitrines.includes(`humor="${pose}"`) }).toEqual({ pose, tem: true });
  });

  test("nenhum slide fala do bebê nem promete efeito", () => {
    const fora = frasesDasBoasVindas().filter(
      (f) => /\bbeb[eê]s?\b|gr[aá]vida|gesta[cç][aã]o|vocês dois/i.test(f) || PROMESSA.test(f),
    );
    expect(fora).toEqual([]);
    const vitrines = fonte("componentes", "boas-vindas.tsx");
    expect(vitrines).not.toMatch(
      /arte-do-bebe|arteDoBebe|ceu-do-bebe|bebe-da-semana|assets\/bebes?\/|RECEM_NASCIDO|figura-movimento/,
    );
  });

  test("a voz do app: sem travessão, sem emoji, títulos de uma linha", () => {
    const fora = frasesDasBoasVindas().filter(
      (f) => /—|–/.test(f) || /\p{Extended_Pictographic}/u.test(f) || /!.*!.*!/.test(f),
    );
    expect(fora).toEqual([]);
    for (const s of Object.values(SLIDES)) expect(s.titulo.length).toBeLessThanOrEqual(22);
  });
});
