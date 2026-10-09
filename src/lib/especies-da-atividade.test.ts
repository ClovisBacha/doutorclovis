/**
 * ⚠️ AS ESPÉCIES DA CAIXA ♡, E A MINA QUE SÓ EXPLODE NA SEGUNDA VEZ.
 *
 * ─── O DEFEITO QUE ESTE ARQUIVO EXISTE PARA IMPEDIR ─────────────────────────
 *
 * O CHECK de `rede_atividade.especie` é reescrito por TRÊS `APLICAR_*.sql`, com
 * `DROP CONSTRAINT` seguido de `ADD CONSTRAINT`. O dono os roda à mão, em
 * qualquer ordem, e a documentação manda RE-RODAR o principal sempre que a rede
 * ganha alguma coisa.
 *
 * Enquanto cada arquivo carregava só a lista que ELE cria, rodar na ordem certa
 * deixava o banco correto — e re-rodar o principal apagava `comentou` e
 * `mencionou`. A partir daí, toda atividade de comentário e de menção era
 * recusada pelo banco.
 *
 * ⚠️ **E EM SILÊNCIO.** `registrarAtividade` grava dentro de um `try/catch` que
 * engole, de propósito: um aviso não pode derrubar o comentário. A paciente
 * comentaria, o comentário apareceria, e a caixa ♡ da autora ficaria vazia para
 * sempre, sem erro em lugar nenhum.
 *
 * A régua: **toda lista é a lista COMPLETA**. Espécie nova entra em todos os
 * arquivos que reescrevem o CHECK, e neste teste.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** A verdade. Espécie nova entra AQUI e em todo `APLICAR_` que toca o CHECK. */
const ESPECIES = [
  "seguiu",
  "pediu_para_seguir",
  "aceitou",
  "reagiu",
  "marcou",
  "reagiu_story",
  "comentou",
  "mencionou",
] as const;

const RE_CHECK =
  /ADD CONSTRAINT rede_atividade_especie_check\s*CHECK \(especie IN \(([\s\S]*?)\)\)/g;

function listasDosArquivos(): { arquivo: string; especies: string[] }[] {
  const saida: { arquivo: string; especies: string[] }[] = [];
  for (const nome of readdirSync("supabase")) {
    if (!nome.startsWith("APLICAR_") || !nome.endsWith(".sql")) continue;
    const sql = readFileSync(join("supabase", nome), "utf8");
    for (const m of sql.matchAll(RE_CHECK)) {
      /* ⚠️ Tira os comentários do SQL antes de extrair: a prosa deste bloco CITA
         as espécies para explicar a regra, e um teste que casa o próprio
         comentário fica verde exatamente quando a lista está errada. */
      const corpo = m[1].replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");
      saida.push({ arquivo: nome, especies: [...corpo.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) });
    }
  }
  return saida;
}

describe("⚠️ o CHECK de rede_atividade.especie", () => {
  const listas = listasDosArquivos();

  test("mais de um arquivo reescreve o CHECK — é por isso que a regra existe", () => {
    /* Se um dia sobrar UM só, esta catraca pode sair. Enquanto forem vários com
       DROP+ADD, a ordem de execução decide o conteúdo do banco. */
    expect(listas.length).toBeGreaterThan(1);
  });

  test("⚠️ TODA lista é a lista completa", () => {
    /* A que estiver faltando uma espécie a APAGA do banco quando for a última a
       rodar — e o dono roda estes arquivos à mão, em qualquer ordem. */
    const faltando = listas
      .map((l) => ({ arquivo: l.arquivo, falta: ESPECIES.filter((e) => !l.especies.includes(e)) }))
      .filter((x) => x.falta.length > 0);
    expect(faltando).toEqual([]);
  });

  test("⚠️ e nenhuma inventa uma espécie que o app não escreve", () => {
    /* O inverso: uma espécie no CHECK que nenhuma função grava é uma linha que
       nunca nasce — e o próximo a ler a lista acha que o recurso existe. */
    const sobrando = listas
      .map((l) => ({
        arquivo: l.arquivo,
        sobra: l.especies.filter((e) => !(ESPECIES as readonly string[]).includes(e)),
      }))
      .filter((x) => x.sobra.length > 0);
    expect(sobrando).toEqual([]);
  });

  test("⚠️ e o TypeScript concorda com o SQL", () => {
    /* Uma espécie que o servidor grava e o banco recusa é o mesmo defeito pela
       outra ponta: a linha é rejeitada em silêncio. */
    const ts = readFileSync("src/lib/rede-social.ts", "utf8");
    const bloco = /EspecieDeAviso\s*=([\s\S]*?);/.exec(ts);
    expect(bloco).not.toBeNull();
    const noTs = [...(bloco?.[1] ?? "").matchAll(/"([a-z_]+)"/g)].map((x) => x[1]);
    expect(noTs.sort()).toEqual([...ESPECIES].sort());
  });
});
