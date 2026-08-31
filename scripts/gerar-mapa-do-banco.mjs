#!/usr/bin/env node
/**
 * O MAPA DO QUE CADA `APLICAR_*.sql` PROMETE AO BANCO.
 *
 * ⚠️ Este repositório tem um defeito que se repete: **o dono roda os
 * `APLICAR_*.sql` à mão, e o deploy do código chega sempre antes.** Quando um
 * arquivo não é rodado, o recurso novo não quebra a tela — ele DESAPARECE em
 * silêncio, porque toda leitura tem degrau de recuo. O CLAUDE.md registra pelo
 * menos oito recursos que passaram semanas mortos por isso, e dois deles hoje.
 *
 * O mapa é o que permite ao painel PERGUNTAR ao banco quais arquivos já foram
 * rodados, em vez de o dono adivinhar.
 *
 * ⚠️ **É GERADO, e nunca escrito à mão.** Uma lista à mão envelhece no primeiro
 * `APLICAR_` novo — e envelhecer aqui significa a tela dizer "tudo aplicado"
 * sobre um arquivo que ela não conhece, que é pior que não ter a tela.
 *
 *   node scripts/gerar-mapa-do-banco.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const DIR = "supabase";
const arquivos = readdirSync(DIR)
  .filter((f) => f.startsWith("APLICAR_") && f.endsWith(".sql"))
  .sort();

/** Tira comentários de SQL — a prosa deste repositório CITA o que ela proíbe. */
const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*--.*$/gm, " ");

const semEsquema = (n) => n.replace(/^public\./, "").replace(/"/g, "");

const mapa = [];
for (const arquivo of arquivos) {
  const sql = semComentarios(readFileSync(`${DIR}/${arquivo}`, "utf8"));

  /* Tabelas que o arquivo CRIA. */
  const tabelas = new Set();
  for (const m of sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+([\w".]+)/gi))
    tabelas.add(semEsquema(m[1]));

  /* Colunas que o arquivo ACRESCENTA, casadas com a tabela do `ALTER` mais
     próximo acima — um `ALTER TABLE` pode trazer vários `ADD COLUMN`, e essa
     armadilha já fez uma catraca deste repositório acusar código correto. */
  const colunas = new Map(); // tabela -> Set(coluna)
  let atual = null;
  for (const m of sql.matchAll(
    /ALTER TABLE\s+(?:IF EXISTS\s+)?([\w".]+)|ADD COLUMN(?:\s+IF NOT EXISTS)?\s+([\w"]+)/gi,
  )) {
    if (m[1]) atual = semEsquema(m[1]);
    else if (m[2] && atual) {
      if (!colunas.has(atual)) colunas.set(atual, new Set());
      colunas.get(atual).add(m[2].replace(/"/g, ""));
    }
  }

  const alvos = [];
  for (const t of [...tabelas].sort()) alvos.push({ tabela: t, colunas: [] });
  for (const [t, cs] of [...colunas.entries()].sort()) {
    const ja = alvos.find((a) => a.tabela === t);
    /* ⚠️ Coluna de tabela que o PRÓPRIO arquivo cria não vira conferência
       separada: se a tabela existe, ela nasceu com as colunas. Conferi-las
       daria falso vermelho num banco correto. */
    if (ja) continue;
    alvos.push({ tabela: t, colunas: [...cs].sort() });
  }
  if (alvos.length) mapa.push({ arquivo, alvos });
}

const cabecalho = `/**
 * O QUE CADA \`APLICAR_*.sql\` PROMETE AO BANCO — GERADO, NÃO EDITE.
 *
 * ⚠️ Regenerar: \`node scripts/gerar-mapa-do-banco.mjs\`. O gerador tem a
 * explicação inteira; \`mapa-do-banco.test.ts\` cobra que este arquivo esteja
 * em dia com a pasta \`supabase/\`.
 */
export type AlvoDoBanco = {
  tabela: string;
  /** Vazio = a tabela inteira nasce neste arquivo. */
  colunas: string[];
};
export type ArquivoDoBanco = { arquivo: string; alvos: AlvoDoBanco[] };

export const MAPA_DO_BANCO: readonly ArquivoDoBanco[] = ${JSON.stringify(mapa, null, 2)} as const;
`;

writeFileSync("src/lib/mapa-do-banco.ts", cabecalho);
/* ⚠️ O gerador FORMATA o que escreve. Sem isto, `mapa-do-banco.test.ts` —
   que regenera e compara — ficaria eternamente vermelho contra o arquivo que
   o prettier reformatou no commit: um teste que reprova o estado correto é um
   teste que a próxima pessoa aprende a ignorar. */
execFileSync("npx", ["prettier", "--write", "src/lib/mapa-do-banco.ts"], { stdio: "pipe" });
const tabelas = new Set(mapa.flatMap((a) => a.alvos.map((x) => x.tabela)));
const conf = mapa.reduce((n, a) => n + a.alvos.length, 0);
console.log(
  `${mapa.length} arquivos · ${tabelas.size} tabelas · ${conf} conferências → src/lib/mapa-do-banco.ts`,
);
