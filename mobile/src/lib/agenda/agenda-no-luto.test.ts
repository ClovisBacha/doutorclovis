import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";
import { lembretesDaAgenda, type Compromisso } from "~/lib/agenda/agenda";

/**
 * A AGENDA NO LUTO (18/11/2026): a tela já dizia "Consulta" no Modo Cuidado,
 * mas o aviso agendado no iPhone continuava dizendo "Consulta pré-natal" e
 * "caderneta da gestante" — quem agendava não passava o modo. Esta catraca
 * cobra que todo reagendamento leva o Modo Cuidado junto.
 */
const SRC = join(import.meta.dir, "..", "..");

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

describe("a agenda no Modo Cuidado", () => {
  test("todo reagendamento e toda gravação levam o Modo Cuidado", () => {
    const sem: string[] = [];
    for (const p of arquivos(SRC)) {
      const s = semComentarios(readFileSync(p, "utf8"));
      for (const m of s.matchAll(
        /\b(reagendarAgenda|salvarCompromisso|apagarCompromisso)\(([\s\S]*?)\);/g,
      )) {
        if (/export async function/.test(s.slice(Math.max(0, m.index! - 30), m.index!))) continue;
        if (!/cuidado/.test(m[2]!) && !/\bmodo\b/.test(m[2]!))
          sem.push(`${relative(SRC, p)}: ${m[1]}`);
      }
    }
    expect(sem).toEqual([]);
  });

  test("o aviso do luto não fala de pré-natal", () => {
    const agora = new Date(2026, 10, 18, 9, 0);
    const c: Compromisso = { id: "c1", tipo: "consulta", quando: "2026-11-21T14:30" };
    const doLuto = lembretesDaAgenda([c], agora, undefined, { cuidado: true });
    const daGestacao = lembretesDaAgenda([c], agora);
    expect(doLuto.length).toBeGreaterThan(0);
    expect(doLuto.map((l) => `${l.titulo} ${l.corpo}`).join(" ")).not.toMatch(
      /pré-natal|gestante/i,
    );
    /* E a gestação continua dizendo o nome dela. */
    expect(daGestacao.map((l) => `${l.titulo} ${l.corpo}`).join(" ")).toMatch(/pré-natal/i);
  });
});
