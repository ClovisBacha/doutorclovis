import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { semComentarios } from "./sem-comentarios";

/**
 * O APP REACT NATIVE (mobile/) CHAMA AS FUNÇÕES DE SERVIDOR DESTE SITE.
 *
 * Ele fala o mesmo protocolo do navegador: POST em /_serverFn/<id>, e no build
 * de produção o id é sha256("<arquivo>--<variável>_createServerFn_handler").
 * Ou seja: RENOMEAR OU MOVER uma função aqui quebra o app instalado no iPhone
 * das pacientes — sem erro de compilação em lado nenhum, e o app não se
 * atualiza junto com o site.
 *
 * Esta catraca roda no portão do SITE: cada `funcaoDoServidor("arquivo",
 * "nome")` declarada no app precisa continuar sendo um
 * `export const nome = createServerFn` naquele arquivo, e o nome não pode
 * estar declarado duas vezes (o compilador acrescentaria um sufixo e o id
 * mudaria).
 *
 * Se esta catraca ficou vermelha porque você renomeou uma função de propósito,
 * o app instalado PARA de funcionar naquele ponto até uma versão nova sair na
 * loja. Mantenha o nome antigo como export ao lado do novo.
 */

const RAIZ = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/$/, "");
const APP = join(RAIZ, "mobile", "src");

function arquivosDoApp(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivosDoApp(caminho);
    return /\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

export function declaracoesDoApp(
  fontes: string[],
): { arquivo: string; nome: string; onde: string }[] {
  const achadas: { arquivo: string; nome: string; onde: string }[] = [];
  for (const caminho of fontes) {
    const fonte = semComentarios(readFileSync(caminho, "utf8"));
    const re = /funcaoDoServidor\b[\s\S]*?\(\s*"(src\/lib\/[^"]+\.functions\.ts)"\s*,\s*"(\w+)"/g;
    for (const m of fonte.matchAll(re))
      achadas.push({ arquivo: m[1], nome: m[2], onde: caminho.replace(RAIZ + "/", "") });
  }
  return achadas;
}

describe("as funções de servidor que o app nativo chama", () => {
  const declaracoes = declaracoesDoApp(arquivosDoApp(APP));

  test("o app declara funções (senão a varredura está cega)", () => {
    if (!existsSync(APP)) return;
    expect(declaracoes.length).toBeGreaterThan(5);
  });

  test("cada uma continua exportada, com o mesmo nome, no mesmo arquivo", () => {
    const quebradas: string[] = [];
    for (const d of declaracoes) {
      const caminho = join(RAIZ, d.arquivo);
      if (!existsSync(caminho)) {
        quebradas.push(`${d.onde}: ${d.arquivo} não existe`);
        continue;
      }
      const fonte = readFileSync(caminho, "utf8");
      if (!new RegExp(`export const ${d.nome} = createServerFn\\b`).test(fonte))
        quebradas.push(
          `${d.onde}: ${d.nome} não é mais "export const ${d.nome} = createServerFn" em ${d.arquivo}`,
        );
      const vezes =
        fonte.match(new RegExp(`\\b(?:const|let|var)\\s+${d.nome}\\s*=\\s*createServerFn\\b`, "g"))
          ?.length ?? 0;
      if (vezes > 1)
        quebradas.push(`${d.onde}: ${d.nome} declarado ${vezes} vezes em ${d.arquivo}`);
    }
    expect(quebradas).toEqual([]);
  });

  test("a varredura acha uma declaração com genéricos aninhados (contraprova)", () => {
    const fonte = `export const x = funcaoDoServidor<{ a: Record<string, number> }, { ok: true }>(\n  "src/lib/lives.functions.ts",\n  "listLivesPublic",\n);`;
    const re = /funcaoDoServidor\b[\s\S]*?\(\s*"(src\/lib\/[^"]+\.functions\.ts)"\s*,\s*"(\w+)"/g;
    const m = [...fonte.matchAll(re)];
    expect(m.map((x) => x[2])).toEqual(["listLivesPublic"]);
  });
});

describe("⚠️ o app e o site falam o MESMO seroval", () => {
  /* O corpo de cada chamada é o JSON do seroval, e o campo `f` dele é o
     conjunto de recursos da versão que serializou. O servidor desserializa com
     a versão do site; um app com outra versão manda um formato que ninguém
     testou (foi o que a atualização do TanStack Start de 05/10/2026 pegou: o
     site foi para o seroval 1.6.8 e o app ficou no 1.5.2). As duas versões
     vêm dos dois lockfiles, e têm de ser uma só. */
  function versaoDoSeroval(lock: string): string | null {
    return readFileSync(lock, "utf8").match(/"seroval": \["seroval@([0-9.]+)"/)?.[1] ?? null;
  }

  test("a versão do lock do app é a do lock do site", () => {
    const site = versaoDoSeroval(join(RAIZ, "bun.lock"));
    const app = versaoDoSeroval(join(RAIZ, "mobile", "bun.lock"));
    expect(site).toBeTruthy();
    expect(app).toBe(site);
  });
});
