import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";
import { DURACAO_DA_FASE, toquesDaFase } from "./respiracao";

const intervalos = (ms: number[]) => ms.slice(1).map((t, i) => t - ms[i]!);

describe("a vibração no ritmo da respiração (23/11/2026)", () => {
  test("inspirar aperta o passo e ganha força; segurar é silêncio; soltar espaça", () => {
    const inspire = toquesDaFase("inspire");
    const solte = toquesDaFase("solte");
    expect(toquesDaFase("segure")).toEqual([]);
    expect(inspire.length).toBeGreaterThanOrEqual(10);
    expect(solte.length).toBeGreaterThanOrEqual(10);
    const ai = intervalos(inspire.map((t) => t.ms));
    const as = intervalos(solte.map((t) => t.ms));
    for (let i = 1; i < ai.length; i++) expect(ai[i]!).toBeLessThan(ai[i - 1]!);
    for (let i = 1; i < as.length; i++) expect(as[i]!).toBeGreaterThan(as[i - 1]!);
    expect(inspire[0]!.forca).toBe("macio");
    expect(inspire.at(-1)!.forca).toBe("medio");
    expect(solte.at(-1)!.forca).toBe("macio");
    expect(solte.some((t) => t.forca === "medio")).toBe(false);
  });

  test("todo toque cai dentro da fase, e o primeiro marca o começo dela", () => {
    for (const fase of ["inspire", "solte"] as const) {
      const t = toquesDaFase(fase);
      expect(t[0]!.ms).toBe(0);
      for (const x of t) expect(x.ms).toBeLessThan(DURACAO_DA_FASE[fase] * 1000);
    }
  });
});

describe("a tela de respirar (catraca do fonte)", () => {
  const RAIZ = join(import.meta.dir, "..", "..");
  const ler = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), "utf8"));

  test("a sessão é a flor de bolhas na noite, e vibra no ritmo", () => {
    const tela = ler("app", "jornada", "meditar.tsx");
    expect(tela).toMatch(/<FlorDeBolhas respiro=\{respiro\}/);
    expect(tela).not.toMatch(/function Circulo|<Circulo/);
    expect(tela).toMatch(/toquesDaFase\(inst\.fase\)/);
    expect(tela).toMatch(/<FundoDaSessao \/>/);
    expect(tela).toMatch(/rotulo="Vibrar no ritmo"/);
  });

  test("as pétalas são bolhas que somam luz, e a Bolha dorme no meio", () => {
    const flor = ler("componentes", "jornada", "flor-de-bolhas.tsx");
    expect(flor).toMatch(/mixBlendMode: "screen"/);
    expect(flor).toMatch(/isolation: "isolate"/);
    expect(flor).toMatch(/source=\{BOLHA\.dormindo\}/);
    expect(flor).toMatch(/florDoRespiro\.petalas/);
  });
});
