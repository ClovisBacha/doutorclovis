import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";

/**
 * A BARRA (decisão do dono de 13/11/2026: "o bebê é o centro [...] deve ficar
 * no meio. O jogo deve ficar na direita e a questão das amigas [...] na
 * esquerda"): Amigas · Bebê · Trilha, e o app abre no Bebê. No Modo Cuidado,
 * Amigas · Hoje · Início (sem trilha). A Comunidade e o SOS ficam no código,
 * escondidos pelas chaves `COMUNIDADE_NO_APP` e `SOS_NO_APP` de `config.ts`.
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

describe("a barra: Amigas · Bebê · Trilha", () => {
  test("as abas, nesta ordem; a Comunidade e o SOS só com as chaves ligadas", async () => {
    const abas = [...BARRA.matchAll(/<Tabs\.Screen\s+name="(\w+)"/g)].map((m) => m[1]);
    expect(abas).toEqual(["amigas", "jornada", "trilha", "inicio", "comunidade"]);
    expect(BARRA).toContain('name="jornada" options={{ title: cuidado ? "Hoje" : "Bebê" }}');
    expect(BARRA).toMatch(/title: "Trilha", \.\.\.\(cuidado \? \{ href: null \} : \{\}\)/);
    expect(BARRA).toMatch(/title: "Início", \.\.\.\(cuidado \? \{\} : \{ href: null \}\)/);
    expect(BARRA).toMatch(/COMUNIDADE_NO_APP \? \{\} : \{ href: null \}/);
    expect(BARRA).toContain("{SOS_NO_APP ? <BotaoDoSos /> : null}");
    const { COMUNIDADE_NO_APP, SOS_NO_APP } = await import("~/config");
    expect([COMUNIDADE_NO_APP, SOS_NO_APP]).toEqual([false, false]);
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

  test("o app abre no Bebê, a aba do meio — e o Bebê é a tela do bebê, não a trilha", () => {
    expect(BARRA).toContain('initialRouteName: "jornada"');
    const porta = FONTES.find((f) => f.arquivo === join("app", "index.tsx"))!.codigo;
    expect(porta).toContain('<Redirect href="/jornada" />');
    const aba = FONTES.find((f) => f.arquivo === join("app", "(abas)", "jornada.tsx"))!.codigo;
    expect(aba).toContain('<JornadaDaGestacao dia={dia} loja={loja} vista="hoje" />');
    expect(aba).toContain("<BebeNestaSemana");
    const trilha = FONTES.find((f) => f.arquivo === join("app", "(abas)", "trilha.tsx"))!.codigo;
    expect(trilha).toContain('<JornadaDaGestacao dia={dia} loja={loja} vista="aba" />');
    /* "Ver a trilha" troca de aba; empurrar a trilha abriria outra barra. */
    expect(aba).toContain('irParaAba("/trilha")');
    expect(aba).not.toMatch(/\bir\(\s*["'`]\/jornada\/trilha["'`]/);
  });

  test("os selos: a barra lê ao voltar para o app, e não no Modo Cuidado", () => {
    expect(BARRA).toMatch(/useSelosDaBarra\(\s*!!sessao && !cuidado/);
    expect(BARRA).toContain('AppState.addEventListener("change"');
    expect(BARRA).toContain("zerarSelos()");
  });
});
