import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";

/**
 * A BARRA DA FASE 3 (a rede social no centro, decisão do dono de 21/10/2026):
 * Hoje · Comunidade · SOS · Amigas · Bebê, sem a aba Saúde.
 *
 * Esta catraca cobra a ordem das abas, que a Saúde não volte por um link
 * esquecido, e que ninguém EMPURRE uma aba de uma tela empilhada — isso abre
 * uma segunda barra por cima da primeira (`irParaAba`, em `cabecalho.tsx`).
 */

const RAIZ = join(import.meta.dir, "..");

function arquivos(dir: string): string[] {
  const fora: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fora.push(...arquivos(p));
    else if (/\.(tsx|ts)$/.test(nome) && !nome.endsWith(".test.ts")) fora.push(p);
  }
  return fora;
}

const FONTES = arquivos(RAIZ).map((p) => ({
  arquivo: relative(RAIZ, p),
  codigo: semComentarios(readFileSync(p, "utf8")),
}));

const BARRA = FONTES.find((f) => f.arquivo === join("app", "(abas)", "_layout.tsx"))!.codigo;

describe("a barra: Hoje · Comunidade · SOS · Amigas · Bebê", () => {
  test("as quatro abas, nesta ordem (as duas primeiras antes do SOS)", () => {
    const abas = [...BARRA.matchAll(/<Tabs\.Screen\s+name="(\w+)"/g)].map((m) => m[1]);
    expect(abas).toEqual(["jornada", "comunidade", "amigas", "inicio"]);
    expect(BARRA).toContain("rotas.slice(0, 2)");
    expect(BARRA).toContain("rotas.slice(2, 4)");
    const pastaDasAbas = readdirSync(join(RAIZ, "app", "(abas)"))
      .filter((n) => n !== "_layout.tsx")
      .map((n) => n.replace(/\.tsx$/, ""))
      .sort();
    expect(pastaDasAbas).toEqual([...abas].sort());
  });

  test("a aba Saúde não existe mais, e nenhum caminho leva até ela", () => {
    expect(existsSync(join(RAIZ, "app", "(abas)", "saude.tsx"))).toBe(false);
    const quem = FONTES.filter((f) => /["'`]\/saude["'`?]/.test(f.codigo)).map((f) => f.arquivo);
    expect(quem).toEqual([]);
  });

  test("as Amigas são uma aba: a lista não mora mais na pilha", () => {
    expect(existsSync(join(RAIZ, "app", "amigas", "index.tsx"))).toBe(false);
    expect(existsSync(join(RAIZ, "app", "amigas", "[id].tsx"))).toBe(true);
  });

  test("ninguém empurra a aba das Amigas (de uma tela empilhada, isso abre outra barra)", () => {
    const empurra = FONTES.filter((f) =>
      /\b(?:router\.push|ir)\(\s*(?:rota\()?["'`]\/amigas["'`?]/.test(f.codigo),
    ).map((f) => f.arquivo);
    expect(empurra).toEqual([]);
  });

  test("os selos: a barra lê ao voltar para o app, e não no Modo Cuidado", () => {
    expect(BARRA).toMatch(/useSelosDaBarra\(\s*!!sessao && !cuidado/);
    expect(BARRA).toContain('AppState.addEventListener("change"');
    expect(BARRA).toContain("zerarSelos()");
  });
});
