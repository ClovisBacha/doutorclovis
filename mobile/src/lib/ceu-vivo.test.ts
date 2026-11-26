import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";

/**
 * OS DOIS CÉUS (decisão do dono, 23/11/2026, cobrada em 26/11: "acredito que
 * as 4 telas de fundo ainda estão rodando, lembra das 2 que combinamos?"). O
 * app mostra o céu LILÁS de dia (das 5h às 19h) e o da NOITE (das 19h às 5h).
 * O azul do meio-dia e o pôr do sol saíram do app, e não voltam por uma tela
 * que peça a arte direto.
 */

const SRC = join(import.meta.dir, "..");
const codigo = (...p: string[]) => semComentarios(readFileSync(join(SRC, ...p), "utf8"));

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe("os dois céus", () => {
  test("de dia o lilás, de noite o da noite, nas mesmas horas do quartinho", async () => {
    const ceu = codigo("componentes", "ceu-vivo.tsx");
    expect(ceu).toMatch(/export type FaseDoCeu = "amanhecer" \| "noite";/);
    expect(ceu).toMatch(/return hora >= 5 && hora < 19 \? "amanhecer" : "noite";/);
    /* As mesmas horas da noite do quartinho. */
    const { ehNoiteNoQuarto } = await import("~/lib/quartinho/quarto");
    for (let h = 0; h < 24; h++) expect(ehNoiteNoQuarto(h)).toBe(!(h >= 5 && h < 19));
  });

  test("o azul do meio-dia e o pôr do sol não estão em lugar nenhum do app", () => {
    const fora = arquivos(SRC)
      .filter((p) => !p.endsWith(".test.ts"))
      .filter((p) =>
        /ceu\/(dia|por-do-sol)\.webp|CEUS\.(dia|tarde)\b/.test(
          semComentarios(readFileSync(p, "utf8")),
        ),
      )
      .map((p) => p.slice(SRC.length + 1));
    expect(fora).toEqual([]);
  });
});
