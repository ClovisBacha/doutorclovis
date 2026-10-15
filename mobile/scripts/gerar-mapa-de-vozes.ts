/**
 * GERA `src/lib/audio/vozes.ts` — o mapa das vozes gravadas do app antigo.
 *
 * O empacotador do app (Metro) só leva um arquivo que aparece num `require`
 * ESCRITO POR EXTENSO: não há `import.meta.glob` como no site. Então este
 * script lê as pastas de áudio do site (só leitura) e escreve um `require` por
 * arquivo. Rodar de novo se uma gravação entrar ou sair:
 *
 *   bun scripts/gerar-mapa-de-vozes.ts
 *
 * O teste `vozes.test.ts` cobra que o mapa bate com as pastas.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(import.meta.dir, "..", "..");
const AUDIO = join(RAIZ, "src", "assets", "audio");
const SAIDA = join(import.meta.dir, "..", "src", "lib", "audio", "vozes.ts");
const DE_LA = "../../../../src/assets/audio";

const mov = readdirSync(AUDIO)
  .filter((f) => /^mov-.+\.mp3$/.test(f))
  .sort();
const med = readdirSync(join(AUDIO, "med"))
  .filter((f) => f.endsWith(".mp3"))
  .sort();

const linhas: string[] = [];
linhas.push("/* eslint-disable */");
linhas.push("/**");
linhas.push(" * GERADO por scripts/gerar-mapa-de-vozes.ts — não edite à mão.");
linhas.push(" *");
linhas.push(" * As vozes gravadas do app antigo (a voz Isabella), as MESMAS do site, em");
linhas.push(" * src/assets/audio. `vozes.test.ts` confere que o mapa bate com as pastas.");
linhas.push(" */");
linhas.push("");
linhas.push("/** A narração de cada movimento, pela `id` do movimento (`mov-<id>.mp3`). */");
linhas.push("export const VOZ_DO_MOVIMENTO: Record<string, number> = {");
for (const f of mov)
  linhas.push(`  ${JSON.stringify(f.slice(4, -4))}: require(${JSON.stringify(`${DE_LA}/${f}`)}),`);
linhas.push("};");
linhas.push("");
linhas.push("/** As palavras da respiração (o canal do pulso). */");
linhas.push("export const VOZ_DA_RESPIRACAO = {");
for (const p of ["inspire", "segure", "solte"])
  linhas.push(`  ${p}: require(${JSON.stringify(`${DE_LA}/${p}.mp3`)}) as number,`);
linhas.push("};");
linhas.push("");
linhas.push("/** As falas da meditação, pela id da fala (= nome do arquivo = texto na tela). */");
linhas.push("export const VOZ_DA_MEDITACAO: Record<string, number> = {");
for (const f of med)
  linhas.push(
    `  ${JSON.stringify(f.slice(0, -4))}: require(${JSON.stringify(`${DE_LA}/med/${f}`)}),`,
  );
linhas.push("};");
linhas.push("");
writeFileSync(SAIDA, linhas.join("\n"));
/* Sai já formatado: sem isto, cada geração brigaria com o formatador do commit. */
execFileSync(join(RAIZ, "node_modules", ".bin", "prettier"), ["--write", SAIDA], {
  stdio: "ignore",
});
console.log(`vozes.ts: ${mov.length} movimentos, 3 da respiração, ${med.length} da meditação`);
