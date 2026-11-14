#!/usr/bin/env bun
/**
 * ESCREVE `src/lib/mapa-do-banco.ts` a partir da pasta `supabase/`.
 *
 * ⚠️ **A LEITURA NÃO MORA AQUI** — ela é `src/lib/mapa-do-banco.gerar.ts`, e a
 * razão está escrita lá: enquanto ela vivia neste script, a catraca de
 * sincronia precisava RODAR o script (e o `npx prettier` dentro dele) para
 * saber a verdade, e isso estourou o tempo limite no runner limpo da CI com a
 * suíte verde na minha máquina. O teste compara o DADO agora; este script só
 * escreve o arquivo.
 *
 * ⚠️ E ele roda com **bun**, não com node: precisa importar um módulo `.ts`.
 *
 *   bun scripts/gerar-mapa-do-banco.ts
 */
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { construirMapaDoBanco } from "../src/lib/mapa-do-banco.gerar";

const mapa = construirMapaDoBanco();

const cabecalho = `/**
 * O QUE CADA \`APLICAR_*.sql\` PROMETE AO BANCO — GERADO, NÃO EDITE.
 *
 * ⚠️ Regenerar: \`bun scripts/gerar-mapa-do-banco.ts\`. A leitura da pasta mora
 * em \`mapa-do-banco.gerar.ts\`, com a explicação inteira;
 * \`mapa-do-banco.test.ts\` cobra que este arquivo esteja em dia.
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
/* Formata o que escreve — senão o arquivo commitado (que o prettier reformata)
   nunca bateria com o que este script produz. */
execFileSync("npx", ["prettier", "--write", "src/lib/mapa-do-banco.ts"], { stdio: "pipe" });

const tabelas = new Set(mapa.flatMap((a) => a.alvos.map((x) => x.tabela)));
const conf = mapa.reduce((n, a) => n + a.alvos.length, 0);
console.log(
  `${mapa.length} arquivos · ${tabelas.size} tabelas · ${conf} conferências → src/lib/mapa-do-banco.ts`,
);
