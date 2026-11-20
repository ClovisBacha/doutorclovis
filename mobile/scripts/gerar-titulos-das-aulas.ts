/**
 * GERA `src/lib/jornada/aulas-do-app.titulos.json` — o assunto de cada aula do
 * app numa linha curta (`tituloCurtoDaAula`), por dia D.
 *
 * A aba do bebê, a Semana e os lembretes só precisam do assunto. Com este
 * índice (uns 20 KB), o app não monta os três trimestres de aulas (880 KB) na
 * abertura só para escrever uma linha.
 *
 * Rodar de novo sempre que uma aula mudar de texto:
 *
 *   bun scripts/gerar-titulos-das-aulas.ts
 *
 * `titulos-das-aulas.test.ts` cobra que o índice bate com as aulas.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tituloCurtoDaAula } from "../src/lib/jornada/aula";

const PASTA = join(import.meta.dir, "..", "src", "lib", "jornada");
const SAIDA = join(PASTA, "aulas-do-app.titulos.json");

const titulos: Record<string, string> = {};
for (const t of ["t1", "t2", "t3"]) {
  const banco = JSON.parse(readFileSync(join(PASTA, `aulas-do-app.${t}.json`), "utf8")) as Record<
    string,
    { teach: string }
  >;
  for (const [D, aula] of Object.entries(banco)) titulos[D] = tituloCurtoDaAula(aula.teach);
}

const ordenado = Object.fromEntries(
  Object.entries(titulos).sort(([a], [b]) => Number(a) - Number(b)),
);
writeFileSync(SAIDA, `${JSON.stringify(ordenado, null, 2)}\n`);
console.log(`✓ ${Object.keys(ordenado).length} assuntos em ${SAIDA}`);
