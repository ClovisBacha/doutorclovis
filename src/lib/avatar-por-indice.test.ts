/**
 * ⚠️ A FOTO DE UMA PACIENTE SOBRE A FALA DE OUTRA.
 *
 * ─── O DEFEITO ──────────────────────────────────────────────────────────────
 *
 * `comentariosDoPost` montava as URLs assinadas dos avatares a partir da lista
 * COMPLETA de comentários e as lia pelo índice do `.map()` — que roda DEPOIS do
 * `.filter()` do bloqueio. `.filter()` devolve um array NOVO: um único
 * comentário removido desloca todos os índices seguintes em um, e o avatar de
 * quem ela bloqueou passa a aparecer no comentário da pessoa de baixo.
 *
 * Numa base em que as pessoas se conhecem da vida real, isso não é um enfeite
 * trocado — é a foto de alguém sobre a fala de outra.
 *
 * ⚠️ **`forEach` COM `return` NÃO TEM O PROBLEMA**, e é por isso que os outros
 * três leitores da rede estavam certos: o índice do `forEach` não se move quando
 * uma volta sai cedo. Só a cadeia `.filter().map((x, i))` desalinha.
 *
 * A régua: **URL de avatar se indexa por AUTOR, nunca por posição.**
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";

function fontesDaRede(): { arquivo: string; codigo: string }[] {
  const saida: { arquivo: string; codigo: string }[] = [];
  for (const dir of ["src/lib", "src/components"]) {
    for (const nome of readdirSync(dir)) {
      const ehDaRede =
        /^(rede-|conversa|comentarios|caixinha|mencoes|sugestoes|amigas)/.test(nome) &&
        /\.(ts|tsx)$/.test(nome) &&
        !nome.includes(".test.");
      if (!ehDaRede) continue;
      saida.push({
        arquivo: join(dir, nome),
        /* ⚠️ Tira os comentários: a prosa deste projeto CITA os padrões que
           proíbe, e um teste que casa a documentação fica verde exatamente
           quando o defeito está descrito. Já aconteceu nos dois sentidos. */
        codigo: readFileSync(join(dir, nome), "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/.*$/gm, ""),
      });
    }
  }
  return saida;
}

describe("⚠️ índice de array depois de filtrar", () => {
  test("nenhum `.filter(…).map((x, i) =>` nos módulos da rede", () => {
    /* A cadeia inteira é proibida — não só o uso do índice. Distinguir "usa o
       índice para indexar OUTRO array" de "usa para numerar" exigiria entender
       o corpo da função, e um teste que quase acerta é pior que um estrito: o
       conserto é sempre o mesmo e é barato (indexar por chave). */
    const culpados: string[] = [];
    for (const { arquivo, codigo } of fontesDaRede()) {
      for (const m of codigo.matchAll(
        /\.filter\((?:[^;]{0,400}?)\)\s*\.map\(\(\s*\w+\s*,\s*\w+\s*\)/gs,
      )) {
        culpados.push(`${arquivo}:${codigo.slice(0, m.index).split("\n").length}`);
      }
    }
    expect(culpados).toEqual([]);
  });

  test("⚠️ e o avatar do comentário é indexado por AUTOR", () => {
    /* A asserção positiva, para o caso de alguém trocar a cadeia por outra
       forma igualmente errada (um `reduce`, um laço com contador). */
    const codigo = readFileSync("src/lib/comentarios.functions.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(codigo).toContain("urlsPorAutor.get(c.autor_id)");
    expect(codigo).not.toMatch(/autorAvatar:\s*urls\[/);
  });
});
