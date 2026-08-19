import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A CATRACA DAS RÉGUAS SEM CHAMADOR.
 *
 * ─── POR QUE ELA EXISTE, ALÉM DA DE PORTAS ─────────────────────────────────
 *
 * `rede-tem-porta.test.ts` cobra que toda função de SERVIDOR seja alcançável.
 * Ela não vê o módulo puro — e foi lá que a auditoria achou seis funções
 * exportadas com ZERO chamadores fora de teste:
 *
 *  · `avisoMandaPush` — a decisão "isto merece push?" estava escrita aqui e o
 *    servidor tinha um `estado === "pendente"` que dizia a mesma coisa POR
 *    ACASO. Duas réguas para a mesma pergunta, e a que decide de verdade era a
 *    de dentro do handler. Foi ligada.
 *  · `personaAlcancaOPerfil` — o mesmo, sobre uma decisão de SEGURANÇA.
 *  · `redeDisponivel` (`!emCuidado`), `bloqueioDesfazSeguir` (`return true`),
 *    `resumoDeReacoes` e `REACAO_PADRAO` — decoração com cara de régua.
 *    Saíram.
 *
 * ⚠️ **O perigo não é o código morto; é o código morto que PARECE a régua.** A
 * próxima pessoa a mexer aqui encontra `avisoMandaPush`, confia nela, e não
 * repara que quem manda é um `if` do outro lado do repositório. Uma régua sem
 * chamador é uma armadilha com documentação.
 */

const MODULOS = [
  "src/lib/rede-social.ts",
  "src/lib/selo-do-perfil.ts",
  "src/lib/sugestoes.ts",
  "src/lib/caixinha.ts",
  "src/lib/pergunta-clinica.ts",
  "src/lib/desafio-em-grupo.ts",
  "src/lib/comunidade.ts",
];

/** Onde alguém pode chamar. Testes e bancadas NÃO contam — ver o cabeçalho. */
function arquivosDoApp(): string[] {
  const out: string[] = [];
  const anda = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) {
        anda(p);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(nome)) continue;
      if (nome.includes(".test.")) continue;
      if (nome.startsWith("preview-")) continue;
      out.push(p);
    }
  };
  for (const d of ["src/components", "src/routes", "src/lib"]) anda(d);
  return out;
}

function semComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/**
 * As FUNÇÕES exportadas. Tipos e constantes ficam de fora, e é decisão:
 *
 * ⚠️ Uma constante exportada costuma ser ÂNCORA DE TESTE (`SEMANA_MAXIMA`,
 * `MOSTRAR_SEMANA_PADRAO`) ou ser consumida dentro do próprio módulo — cobrar
 * chamador externo dela produziria vinte falsos positivos e a catraca seria
 * desligada na primeira semana. Função exportada que ninguém chama, em lugar
 * NENHUM, é inequívoca: foi escrita para ser a régua e não é.
 */
function exportados(arquivo: string): string[] {
  const src = semComentarios(readFileSync(arquivo, "utf8"));
  return [...src.matchAll(/^export function (\w+)/gm)].map((m) => m[1]);
}

describe("nenhuma régua da Comunidade fica sem chamador", () => {
  const codigo = arquivosDoApp()
    .map((f) => `\n/*FILE:${f}*/\n` + semComentarios(readFileSync(f, "utf8")))
    .join("\n");

  test("o inventário não está vazio (senão o teste passa por acidente)", () => {
    expect(codigo.length).toBeGreaterThan(50_000);
    expect(MODULOS.flatMap(exportados).length).toBeGreaterThan(25);
  });

  for (const modulo of MODULOS) {
    for (const nome of exportados(modulo)) {
      test(`\`${nome}\` (${modulo.replace("src/lib/", "")}) é CHAMADA em algum lugar`, () => {
        /* ⚠️ Procura a CHAMADA (`nome(`), não o nome solto: a declaração
           `export function nome(` casaria com o nome, e toda régua passaria por
           si mesma. E ignora STRING — o nome entre aspas não é chamada (o mesmo
           cuidado, e o mesmo tropeço, de `rede-tem-porta.test.ts`). */
        const semStrings = codigo.replace(/"[^"\n]*"/g, '""').replace(/'[^'\n]*'/g, "''");
        const chamadas = [...semStrings.matchAll(new RegExp(`\\b${nome}\\s*\\(`, "g"))].length;
        const declaracoes = [...semStrings.matchAll(new RegExp(`function ${nome}\\s*\\(`, "g"))]
          .length;
        expect(chamadas - declaracoes).toBeGreaterThan(0);
      });
    }
  }
});
