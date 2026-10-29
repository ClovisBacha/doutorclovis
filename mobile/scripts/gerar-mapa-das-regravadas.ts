/**
 * GERA `src/lib/audio/regravadas.ts` (a voz) e `src/lib/audio/regravadas-texto.ts`
 * (o texto) — as falas regravadas do roteiro `docs/regravacao/roteiro.json`.
 *
 * ⚠️ TEXTO E VOZ ENTRAM JUNTOS. Uma fala só entra nos dois mapas quando o
 * arquivo dela existe em `assets/vozes/regravadas/<id>.mp3`: assim o texto novo
 * nunca aparece na tela com a voz velha dizendo a frase antiga. Sem nenhum
 * arquivo, os mapas saem vazios e o app segue como está.
 *
 * Rodar de novo depois de acrescentar (ou tirar) arquivos:
 *
 *   bun scripts/gerar-mapa-das-regravadas.ts
 *
 * `regravadas.test.ts` cobra que os mapas batem com a pasta e com o roteiro.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MOBILE = join(import.meta.dir, "..");
const RAIZ = join(MOBILE, "..");
const PASTA = join(MOBILE, "assets", "vozes", "regravadas");
const ROTEIRO = join(RAIZ, "docs", "regravacao", "roteiro.json");
const SAIDA_VOZ = join(MOBILE, "src", "lib", "audio", "regravadas.ts");
const SAIDA_TEXTO = join(MOBILE, "src", "lib", "audio", "regravadas-texto.ts");

type Fala = { id: string; texto_novo: string };
const { falas } = JSON.parse(readFileSync(ROTEIRO, "utf8")) as { falas: Fala[] };

const presentes = existsSync(PASTA)
  ? readdirSync(PASTA)
      .filter((f) => f.endsWith(".mp3"))
      .map((f) => f.slice(0, -4))
  : [];
const fora = presentes.filter((id) => !falas.some((f) => f.id === id));
if (fora.length) {
  console.error(`❌ arquivo sem fala no roteiro: ${fora.join(", ")}`);
  process.exit(1);
}
const entram = falas
  .filter((f) => presentes.includes(f.id))
  .sort((a, b) => a.id.localeCompare(b.id));

const voz: string[] = [
  "/* eslint-disable */",
  "/**",
  " * GERADO por scripts/gerar-mapa-das-regravadas.ts — não edite à mão.",
  " *",
  " * A voz das falas regravadas (docs/regravacao, a mesma voz Isabella), pela `id`",
  " * da fala. Só entra a fala cujo arquivo existe — e o texto dela, junto, em",
  " * `regravadas-texto.ts`. Quem toca uma voz do site pergunta aqui primeiro.",
  " */",
  "",
  "export const VOZ_REGRAVADA: Readonly<Record<string, number>> = {",
  ...entram.map(
    (f) =>
      `  ${JSON.stringify(f.id)}: require(${JSON.stringify(`../../../assets/vozes/regravadas/${f.id}.mp3`)}),`,
  ),
  "};",
  "",
];

const texto: string[] = [
  "/**",
  " * GERADO por scripts/gerar-mapa-das-regravadas.ts — não edite à mão.",
  " *",
  " * O texto novo de cada fala regravada — só das que já têm a voz em",
  " * `regravadas.ts`. Sem react-native e sem `require` de áudio: as regras puras",
  " * (o plano da meditação, o Mexer, a sessão do casal) leem daqui.",
  " */",
  "",
  "export const TEXTO_REGRAVADO: Readonly<Record<string, string>> = {",
  ...entram.map((f) => `  ${JSON.stringify(f.id)}: ${JSON.stringify(f.texto_novo)},`),
  "};",
  "",
];

writeFileSync(SAIDA_VOZ, voz.join("\n"));
writeFileSync(SAIDA_TEXTO, texto.join("\n"));
/* Sai já formatado: sem isto, cada geração brigaria com o formatador do commit. */
execFileSync(join(RAIZ, "node_modules", ".bin", "prettier"), ["--write", SAIDA_VOZ, SAIDA_TEXTO], {
  stdio: "ignore",
});
console.log(`${entram.length} de ${falas.length} falas regravadas no app.`);
