import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * OS ÍCONES UM POR UM (18/11/2026, "está um pouco travado"): importar do
 * barril `lucide-react-native` levava os ~1.700 ícones para o pacote JS — o
 * Metro não poda. Com um import por ícone (`lucide-react-native/icons/<nome>`)
 * o pacote do iPhone caiu de 10,1 MB para ~8 MB. Do barril, só TIPO
 * (`import type`), que some na compilação.
 */
const SRC = join(import.meta.dir, "..");

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

describe("os ícones", () => {
  test("ninguém importa valor do barril do lucide", () => {
    const doBarril = arquivos(SRC).filter((p) =>
      readFileSync(p, "utf8")
        .split("\n")
        .some((l) => /from "lucide-react-native";/.test(l) && !/^import type /.test(l.trim())),
    );
    expect(doBarril.map((p) => relative(SRC, p))).toEqual([]);
  });
});
