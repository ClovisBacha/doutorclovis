/**
 * ⚠️ OS MATCHERS QUE O `tsc` DA CI NÃO CONHECE.
 *
 * ─── POR QUE ESTE ARQUIVO EXISTE ────────────────────────────────────────────
 *
 * `toMatchObject` **não é tipado no `bun:test`**, e o `bunx tsc --noEmit` da CI
 * reprova com `TS2339: Property 'toMatchObject' does not exist on type
 * 'Matchers'`. Isto já estava escrito em `lacunas-parecidas.test.ts` — e foi
 * reintroduzido mesmo assim, num arquivo novo.
 *
 * ⚠️ **E O `tsc` LOCAL NÃO PEGA.** Ele resolve `toMatchObject` a partir de
 * `playwright/types/test.d.ts`, que está no `node_modules` de desenvolvimento e
 * declara o mesmo nome de tipo (`Matchers`). O resultado é o pior caso possível:
 * o portão local fica VERDE e a CI fica vermelha — a mesma família de armadilha
 * do `node_modules` remendado que já custou uma volta nesta sessão.
 *
 * Este teste roda no `bun test`, que é o portão local, e falha em segundos.
 *
 * ⚠️ **Se um dia o `bun:test` passar a tipar um destes, TIRE-O da lista** — em
 * vez de relaxar a asserção. Uma catraca que proíbe o que já é permitido é uma
 * catraca que a próxima pessoa aprende a contornar.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Os que o `tsc` da CI recusa. Cada entrada nasceu de uma quebra real. */
const PROIBIDOS = ["toMatchObject"];

function testes(dir: string, achados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      testes(caminho, achados);
    } else if (nome.endsWith(".test.ts") || nome.endsWith(".test.tsx")) {
      achados.push(caminho);
    }
  }
  return achados;
}

describe("⚠️ matchers que quebram o tsc da CI", () => {
  test("nenhum teste do repo os USA", () => {
    const culpados: string[] = [];
    for (const arquivo of testes("src")) {
      /* ⚠️ Tira os comentários antes de procurar: este arquivo e o de
         `lacunas-parecidas` CITAM o nome proibido para explicar a regra, e um
         teste que casa a própria prosa fica verde exatamente quando o defeito
         está documentado — armadilha que este repo já pagou nos dois sentidos. */
      const codigo = readFileSync(arquivo, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      for (const m of PROIBIDOS) {
        if (codigo.includes(`.${m}(`)) culpados.push(`${arquivo} → ${m}`);
      }
    }
    expect(culpados).toEqual([]);
  });
});
