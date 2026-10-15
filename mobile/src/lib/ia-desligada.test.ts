import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";
import { IA_NO_APP } from "~/config";

/**
 * A IA DESLIGADA NO APP (decisão do dono, 15/10/2026) — ver `IA_NO_APP`.
 *
 * Desligar só pela chave não basta se um caminho novo para a IA nascer sem
 * passar por ela, ou se o texto de permissão da câmera continuar prometendo a
 * nutricionista (a Apple compara o texto com o que o app faz). Esta catraca
 * cobra os dois enquanto a chave estiver em `false`.
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

const ler = (p: string) => semComentarios(readFileSync(p, "utf8"));

describe("com a IA desligada, nada leva a ela", () => {
  test.skipIf(IA_NO_APP)("toda tela que aponta para /nutricao passa pela chave", () => {
    const telas = ["app", "componentes"]
      .flatMap((d) => arquivos(join(RAIZ, d)))
      .filter((f) => !/componentes\/nutricao\//.test(f));
    const semChave = telas.filter((f) => {
      const s = ler(f);
      return s.includes('"/nutricao"') && !s.includes("IA_NO_APP");
    });
    expect(semChave.map((f) => relative(RAIZ, f))).toEqual([]);
  });

  test.skipIf(IA_NO_APP)("a triagem só chama a IA atrás da chave", () => {
    const s = ler(join(RAIZ, "app", "saude", "sintomas.tsx"));
    expect(s).toContain("IA_NO_APP &&");
  });

  test.skipIf(IA_NO_APP)("o Perfil não mostra a permissão de IA", () => {
    const s = ler(join(RAIZ, "app", "perfil.tsx"));
    expect(s).toContain("IA_NO_APP ? <CartaoDaPermissaoDeIA");
  });

  test.skipIf(IA_NO_APP)("os textos de permissão não prometem a nutricionista", () => {
    const app = readFileSync(join(RAIZ, "..", "app.json"), "utf8");
    expect(app).not.toContain("nutricionista");
  });
});
