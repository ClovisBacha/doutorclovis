/**
 * GERA as cópias dos documentos jurídicos do app em `docs/juridico/`: o
 * Markdown (para a revisão do advogado) e a página HTML (para hospedar — a URL
 * pública que a App Store pede). O texto mora em `src/lib/juridico/`; o app
 * mostra o mesmo texto em telas próprias.
 *
 *   bun scripts/gerar-juridico.ts
 *
 * `juridico.test.ts` cobra que as cópias estão em dia com o texto do app.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONTATO_EMAIL } from "../src/config";
import { DATA_DOS_TERMOS } from "../src/lib/juridico/aceite";
import { paraHtml, paraMarkdown } from "../src/lib/juridico/documento";
import { PRIVACIDADE } from "../src/lib/juridico/privacidade";
import { TERMOS } from "../src/lib/juridico/termos";

const PASTA = join(import.meta.dir, "..", "..", "docs", "juridico");
mkdirSync(PASTA, { recursive: true });
for (const [nome, doc] of [
  ["termos", TERMOS],
  ["privacidade", PRIVACIDADE],
] as const) {
  writeFileSync(join(PASTA, `${nome}.md`), paraMarkdown(doc, DATA_DOS_TERMOS, CONTATO_EMAIL));
  writeFileSync(join(PASTA, `${nome}.html`), paraHtml(doc, DATA_DOS_TERMOS, CONTATO_EMAIL));
}
/* Sai já formatado: sem isto, cada geração brigaria com o formatador do commit. */
execFileSync(
  join(import.meta.dir, "..", "..", "node_modules", ".bin", "prettier"),
  [
    "--write",
    ...["termos", "privacidade"].flatMap((n) =>
      [`${n}.md`, `${n}.html`].map((f) => join(PASTA, f)),
    ),
  ],
  { stdio: "ignore" },
);
console.log(`docs/juridico: termos e privacidade (${DATA_DOS_TERMOS}).`);
