/**
 * ⚠️ O CHECK DE `rede_denuncias.alvo`, E A MESMA MINA DE `especie`.
 *
 * ─── O DEFEITO QUE ESTE ARQUIVO EXISTE PARA IMPEDIR ─────────────────────────
 *
 * Três `APLICAR_*.sql` reescrevem `rede_denuncias_alvo_check` com
 * `DROP CONSTRAINT` + `ADD CONSTRAINT`, e o dono os roda à mão, em qualquer
 * ordem e mais de uma vez. Cada um carregava a lista completa NO DIA EM QUE FOI
 * ESCRITO — e a rede depois ganhou `story` e `conversa` sem ninguém voltar aos
 * arquivos anteriores. O último a rodar manda:
 *
 *   · rodar `APLICAR_MAIS_DEZ` depois de `APLICAR_DIRECT_COMPLETO`
 *     → o CHECK perde `'conversa'`, e denunciar uma CONVERSA passa a ser
 *       recusado pelo banco;
 *   · rodar `APLICAR_DEZ_DA_REDE` por último → perde `'story'` também.
 *
 * ⚠️ **E a ironia estava escrita:** o comentário de `APLICAR_DEZ_DA_REDE` diz
 * "o CHECK é reescrito COM A LISTA COMPLETA … é o defeito que
 * `rede_atividade_especie_check` já teve aqui" — e o arquivo cometia o mesmo
 * defeito, porque a lista dele envelheceu e não havia catraca.
 *
 * `especies-da-atividade.test.ts` é o irmão deste, para a outra tabela.
 *
 * A régua: **toda lista é a lista COMPLETA**. Alvo novo entra em todos os
 * arquivos que reescrevem o CHECK, e aqui.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** A verdade. Alvo novo entra AQUI e em todo `APLICAR_` que toca o CHECK. */
const ALVOS = [
  "post",
  "perfil",
  "comentario",
  "pergunta",
  "mensagem",
  "story",
  "conversa",
] as const;

const RE_CHECK = /ADD CONSTRAINT rede_denuncias_alvo_check\s*CHECK \(alvo IN \(([\s\S]*?)\)\)/g;

function listasDosArquivos(): { arquivo: string; alvos: string[] }[] {
  const saida: { arquivo: string; alvos: string[] }[] = [];
  for (const nome of readdirSync("supabase")) {
    if (!nome.startsWith("APLICAR_") || !nome.endsWith(".sql")) continue;
    const sql = readFileSync(join("supabase", nome), "utf8");
    for (const m of sql.matchAll(RE_CHECK)) {
      /* ⚠️ Tira os comentários do SQL antes de extrair: a prosa CITA alvos para
         explicar a regra, e um teste que casa o próprio comentário fica verde
         exatamente quando a lista está errada. */
      const corpo = m[1]!.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");
      saida.push({ arquivo: nome, alvos: [...corpo.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]!) });
    }
  }
  return saida;
}

describe("⚠️ o CHECK de rede_denuncias.alvo", () => {
  const listas = listasDosArquivos();

  test("há mais de um arquivo reescrevendo o CHECK — é o que cria a mina", () => {
    expect(listas.length).toBeGreaterThan(1);
  });

  test("TODO arquivo carrega a lista COMPLETA", () => {
    for (const { arquivo, alvos } of listas) {
      for (const a of ALVOS) {
        expect(`${arquivo}: ${a}`).toBe(
          alvos.includes(a) ? `${arquivo}: ${a}` : `${arquivo}: FALTA ${a}`,
        );
      }
    }
  });

  test("nenhum arquivo lista alvo que o app não grava", () => {
    for (const { arquivo, alvos } of listas) {
      for (const a of alvos) {
        expect(`${arquivo}: ${a}`).toBe(
          (ALVOS as readonly string[]).includes(a) ? `${arquivo}: ${a}` : `${arquivo}: SOBRA ${a}`,
        );
      }
    }
  });

  test("⚠️ todo alvo que o app GRAVA está no CHECK", () => {
    const fontes = [
      "rede-social.functions.ts",
      "conversa.functions.ts",
      "comentarios.functions.ts",
    ];
    const escritos = new Set<string>();
    for (const f of fontes) {
      const codigo = readFileSync(join("src/lib", f), "utf8")
        /* A prosa deste repositório cita alvos ao explicar as regras. */
        .replace(/\/\*[\s\S]*?\*\//g, "");
      for (const m of codigo.matchAll(
        /\.from\("rede_denuncias"\)\s*\.insert\(\{\s*alvo: "([a-z_]+)"/g,
      ))
        escritos.add(m[1]!);
    }
    expect(escritos.size).toBeGreaterThan(0);
    for (const a of escritos) expect(ALVOS as readonly string[]).toContain(a);
  });

  test("⚠️ a união do TypeScript bate com o SQL", () => {
    /* Sem isto, `AlvoDaDenuncia` envelhece em silêncio — foi exatamente o que
       aconteceu: ela ficou em `"post" | "perfil"` enquanto o banco já aceitava
       sete, e a fila passou a rotular mensagem privada como "publicação". */
    const fonte = readFileSync("src/lib/denuncias.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const i = fonte.indexOf("export type AlvoDaDenuncia");
    expect(i).toBeGreaterThan(0);
    const uniao = fonte.slice(i, fonte.indexOf(";", i));
    const naUniao = [...uniao.matchAll(/"([a-z_]+)"/g)].map((x) => x[1]!);
    expect([...naUniao].sort()).toEqual([...ALVOS].sort());
  });

  test("⚠️ a fila do painel dá nome a TODOS eles, e nunca 'publicação' por padrão", async () => {
    const { rotuloDoAlvo } = await import("./denuncias");
    const nomes = new Set(ALVOS.map((a) => rotuloDoAlvo(a)));
    // Cada alvo tem um nome PRÓPRIO — nenhum dois compartilham rótulo.
    expect(nomes.size).toBe(ALVOS.length);
    expect(rotuloDoAlvo("mensagem")).not.toBe(rotuloDoAlvo("post"));
    // Alvo desconhecido devolve o próprio valor, nunca "publicação".
    expect(rotuloDoAlvo("coisa_nova")).toBe("coisa_nova");
  });
});
