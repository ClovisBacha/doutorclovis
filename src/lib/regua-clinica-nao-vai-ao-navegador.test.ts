import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A RÉGUA CLÍNICA NÃO VAI PARA O NAVEGADOR.
 *
 * ─── ⚠️ O DEFEITO QUE ESTA CATRACA EXISTE PARA IMPEDIR ─────────────────────
 *
 * `rede-instagram.tsx` precisava de três coisas triviais para desenhar a
 * caixinha — um número, uma função que devolve string e um tipo — e importou de
 * `pergunta-clinica.ts`, que é onde elas moravam. `minha-conta.tsx` importa
 * `rede-instagram.tsx` ESTATICAMENTE.
 *
 * Medido no bundle de produção: as regex clínicas inteiras foram parar em
 * `rede-instagram-*.js`, **com o `(?<!` das fronteiras que respeitam acento**.
 * Negative lookbehind só existe no Safari a partir do 16.4 — num iPhone mais
 * antigo o módulo estoura com `SyntaxError` no instante em que carrega, e a
 * paciente vê "Algo deu errado" ao abrir o app. Foi o que o dono viu.
 *
 * ⚠️ **Nem `tsc`, nem `bun test`, nem o build viam.** O build passa: um
 * `SyntaxError` de regex acontece na EXECUÇÃO, no aparelho dela. O único lugar
 * onde o defeito era visível era o bundle gerado — e é o que este teste olha,
 * pela cadeia de imports.
 */

/** Módulos que só o servidor pode carregar. */
const SO_NO_SERVIDOR = ["@/lib/pergunta-clinica", "@/lib/caixinha", "@/lib/sugestoes"];

/** De onde o app do NAVEGADOR parte. Uma cadeia estática a partir daqui é bundle. */
const RAIZES = [
  "src/routes/_authenticated/minha-conta.tsx",
  "src/routes/_authenticated/painel.tsx",
];

function todosOsArquivos(): string[] {
  const out: string[] = [];
  const anda = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) {
        anda(p);
        continue;
      }
      if (/\.(ts|tsx)$/.test(nome) && !nome.includes(".test.")) out.push(p);
    }
  };
  anda("src");
  return out;
}

function semComentarios(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/**
 * Só os imports que CHEGAM AO PACOTE.
 *
 * ⚠️ **`import type` fica de fora**, e a primeira versão desta função o incluía:
 * ela acusou `rede-social.tsx → rede-social.functions.ts` e
 * `fila-de-denuncias.tsx → caixinha.functions.ts`, que são os DOIS `import
 * type` do lote — apagados pelo TypeScript antes de existir bundle. Catraca que
 * acusa o inocente é catraca que a próxima pessoa desliga.
 *
 * `await import(...)` também fica de fora: vira chunk próprio, carregado só
 * quando a função é chamada — que é exatamente o conserto deste defeito.
 */
function importaEstaticamente(arquivo: string): string[] {
  const src = semComentarios(readFileSync(arquivo, "utf8"));
  return [...src.matchAll(/^\s*import\s+([^;]*?)from\s+["']([^"']+)["']/gm)]
    .filter((m) => !/^type\s/.test(m[1].trim()))
    .map((m) => m[2]);
}

/** `@/lib/x` → `src/lib/x.ts` (ou `.tsx`), quando existe. */
function resolver(especificador: string, arquivos: Set<string>): string | null {
  if (!especificador.startsWith("@/")) return null;
  const base = "src/" + especificador.slice(2);
  for (const ext of [".ts", ".tsx"]) if (arquivos.has(base + ext)) return base + ext;
  return null;
}

describe("a régua clínica não entra no pacote do navegador", () => {
  const arquivos = new Set(todosOsArquivos());

  for (const raiz of RAIZES) {
    test(`nada alcançável de \`${raiz.replace("src/routes/_authenticated/", "")}\` importa a régua`, () => {
      expect(arquivos.has(raiz)).toBe(true);

      /* Percorre a árvore de imports ESTÁTICOS a partir da raiz, guardando o
         caminho — sem ele, a mensagem de falha diz "algo importa" e a próxima
         pessoa passa meia hora procurando o quê. */
      const visto = new Map<string, string[]>([[raiz, [raiz]]]);
      const fila = [raiz];
      const culpados: string[] = [];
      while (fila.length) {
        const atual = fila.shift()!;
        const caminho = visto.get(atual)!;
        for (const esp of importaEstaticamente(atual)) {
          if (SO_NO_SERVIDOR.includes(esp)) {
            culpados.push([...caminho, esp].join(" → "));
            continue;
          }
          const alvo = resolver(esp, arquivos);
          if (!alvo || visto.has(alvo)) continue;
          visto.set(alvo, [...caminho, alvo]);
          fila.push(alvo);
        }
      }
      expect(culpados).toEqual([]);
    });
  }

  test("⚠️ e o `(?<!` continua lá, porque é ele que quebra", () => {
    /* Se um dia alguém "consertar" trocando a fronteira por `\\b`, esta catraca
       vira teatro — e a régua passa a casar dentro de "aDORei". O lookbehind é
       necessário e é justamente por isso que o arquivo não pode ir ao
       navegador. */
    expect(readFileSync("src/lib/pergunta-clinica.ts", "utf8")).toContain("(?<!");
  });

  test("o inventário não está vazio (senão o teste passa por acidente)", () => {
    expect(arquivos.size).toBeGreaterThan(100);
    for (const r of RAIZES) expect(importaEstaticamente(r).length).toBeGreaterThan(5);
  });
});
