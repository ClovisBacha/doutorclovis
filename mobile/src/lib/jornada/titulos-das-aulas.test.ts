import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";
import { tituloCurtoDaAula } from "~/lib/jornada/aula";
import {
  aulaDoAppNoDia,
  DIAS_COM_AULA_DO_APP,
  FIM_DO_1O_TRIMESTRE,
  FIM_DO_2O_TRIMESTRE,
  tituloDaAulaDoApp,
} from "~/lib/jornada/aulas-do-app";
import TITULOS from "~/lib/jornada/aulas-do-app.titulos.json";
import T1 from "~/lib/jornada/aulas-do-app.t1.json";
import T2 from "~/lib/jornada/aulas-do-app.t2.json";
import T3 from "~/lib/jornada/aulas-do-app.t3.json";

/**
 * O ÍNDICE DOS ASSUNTOS (18/11/2026): a aba do bebê mostra o assunto da aula
 * de hoje sem montar os 880 KB das aulas na abertura. O índice é gerado
 * (`bun scripts/gerar-titulos-das-aulas.ts`); esta catraca cobra que ele não
 * ficou para trás de uma aula editada, e que o banco não voltou a ser
 * importado no topo.
 */

const AULAS = { ...T1, ...T2, ...T3 } as Record<string, { teach: string }>;

describe("o índice dos assuntos das aulas", () => {
  test("cada dia tem o assunto que tituloCurtoDaAula tira da aula (rode o gerador se falhar)", () => {
    expect(Object.keys(TITULOS).sort()).toEqual(Object.keys(AULAS).sort());
    const fora = Object.entries(AULAS)
      .filter(([D, a]) => (TITULOS as Record<string, string>)[D] !== tituloCurtoDaAula(a.teach))
      .map(([D]) => D);
    expect(fora).toEqual([]);
    expect(tituloDaAulaDoApp(150)).toBe(tituloCurtoDaAula(AULAS["150"]!.teach));
    expect(tituloDaAulaDoApp(6)).toBeNull();
    expect(tituloDaAulaDoApp(301)).toBeNull();
    expect(DIAS_COM_AULA_DO_APP).toEqual(Array.from({ length: 294 }, (_, i) => i + 7));
  });

  test("cada trimestre mora no arquivo que a função abre para ele", () => {
    const dias = (b: object) => Object.keys(b).map(Number);
    expect(Math.max(...dias(T1))).toBe(FIM_DO_1O_TRIMESTRE);
    expect(Math.min(...dias(T2))).toBe(FIM_DO_1O_TRIMESTRE + 1);
    expect(Math.max(...dias(T2))).toBe(FIM_DO_2O_TRIMESTRE);
    expect(Math.min(...dias(T3))).toBe(FIM_DO_2O_TRIMESTRE + 1);
    for (const D of [7, 97, 98, 195, 196, 300])
      expect(aulaDoAppNoDia(D)?.teach).toBe(AULAS[String(D)]!.teach);
  });

  test("as aulas só são montadas quando pedidas, e sem recuo para o banco do site", () => {
    const fonte = semComentarios(readFileSync(join(import.meta.dir, "aulas-do-app.ts"), "utf8"));
    expect(fonte).not.toMatch(/^import [^\n]*aulas-do-app\.t[123]\.json/m);
    expect(fonte).not.toMatch(/carregarQuizDoDia|daily-quizzes\.data/);
    expect(fonte).toMatch(/^import type \{ DailyQuiz \}/m);
  });
});
