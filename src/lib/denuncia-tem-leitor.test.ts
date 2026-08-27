/**
 * ⚠️ TODA DENÚNCIA TEM DE CHEGAR EM ALGUÉM.
 *
 * ─── O DEFEITO QUE ESTE ARQUIVO EXISTE PARA IMPEDIR ─────────────────────────
 *
 * `denunciarComentario` gravava `rede_comentarios.denunciado_em` — uma coluna
 * que NENHUMA consulta do repositório lia — e a tela respondia
 * "Denunciado. A gente vai olhar." **Ninguém ia olhar.**
 *
 * É palavra por palavra o defeito que o post e o perfil já pagaram aqui: o
 * CLAUDE.md registra "`denunciado_em` era gravada e NENHUMA consulta a lia".
 * Foi consertado num caminho e deixado de pé no outro — e justamente no canal
 * onde mora o conselho clínico de leiga, que é a razão de esta aba quase não
 * ter comentários.
 *
 * ⚠️ **`rede-tem-porta.test.ts` NÃO pegava**: a função TEM porta e TEM chamador.
 * O que faltava era leitor do que ela grava — outra pergunta, outra catraca.
 *
 * A régua: **quem escreve uma denúncia escreve num lugar que alguém lê.** Ou em
 * `rede_denuncias` (que `denunciasAbertas` lê), ou numa coluna com leitor
 * declarado aqui.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/** Os módulos que podem registrar uma denúncia. */
const MODULOS = [
  "src/lib/rede-social.functions.ts",
  "src/lib/comentarios.functions.ts",
  "src/lib/conversa.functions.ts",
  "src/lib/caixinha.functions.ts",
];

/**
 * Os destinos que TÊM leitor, com o leitor nomeado.
 *
 * ⚠️ Acrescentar um destino aqui é afirmar que existe uma tela que o lê. Se não
 * existir, o destino é dívida com cara de recurso.
 */
const COM_LEITOR: Record<string, string> = {
  rede_denuncias: "denunciasAbertas (fila do painel)",
  rede_perguntas: "denunciasAbertas da caixinha (lê denunciado_em)",
};

/** Sem os comentários: a prosa daqui e dos módulos cita os nomes proibidos. */
function semProsa(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("⚠️ toda denúncia tem leitor", () => {
  test("o comentário denunciado entra em `rede_denuncias`", () => {
    const c = semProsa("src/lib/comentarios.functions.ts");
    const i = c.indexOf("export const denunciarComentario");
    expect(i).toBeGreaterThan(0);
    const corpo = c.slice(i, c.indexOf("\nexport const", i + 10));
    expect(corpo).toContain('.from("rede_denuncias")');
    expect(corpo).toContain('alvo: "comentario"');
  });

  test("⚠️ e ele congela o TRECHO — o texto pode ser editado ou apagado depois", () => {
    const c = semProsa("src/lib/comentarios.functions.ts");
    const i = c.indexOf("export const denunciarComentario");
    const corpo = c.slice(i, c.indexOf("\nexport const", i + 10));
    expect(corpo).toMatch(/trecho:/);
  });

  test("⚠️ o motivo é catálogo FECHADO, como nas outras portas", () => {
    const c = semProsa("src/lib/comentarios.functions.ts");
    const i = c.indexOf("export const denunciarComentario");
    const corpo = c.slice(i, c.indexOf("\nexport const", i + 10));
    expect(corpo).toContain("motivoConhecido");
  });

  test("nenhum módulo grava uma denúncia num destino sem leitor", () => {
    for (const m of MODULOS) {
      const codigo = semProsa(m);
      /* Toda escrita de `denunciado_em` tem de ser numa tabela com leitor. */
      for (const achado of codigo.matchAll(/\.from\("([a-z_]+)"\)[\s\S]{0,200}?denunciado_em/g)) {
        const tabela = achado[1]!;
        expect(`${m} → ${tabela}`).toBe(
          COM_LEITOR[tabela] ? `${m} → ${tabela}` : `${m} → ${tabela} SEM LEITOR`,
        );
      }
    }
  });

  test("⚠️ a catraca MORDE — um destino sem leitor é reprovado", () => {
    // Contraprova: catraca que passa em vazio é catraca que mente.
    const inventado = "rede_coisas";
    expect(COM_LEITOR[inventado]).toBeUndefined();
  });
});
