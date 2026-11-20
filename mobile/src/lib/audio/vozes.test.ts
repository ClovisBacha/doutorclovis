import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HISTORIAS } from "@/lib/historias-para-dormir";
import { SESSAO_DO_CASAL } from "@/lib/sessao-do-casal";

/* Lê o TEXTO do mapa gerado: carregar o módulo faria o bun abrir os mp3 como
   código. O que se confere é o que o empacotador vai levar. */
const MAPA = readFileSync(join(import.meta.dir, "vozes.ts"), "utf8");
const AUDIO = join(import.meta.dir, "..", "..", "..", "..", "src", "assets", "audio");

function chavesDe(bloco: string): string[] {
  const ini = MAPA.indexOf(`export const ${bloco}`);
  const fim = MAPA.indexOf("};", ini);
  return [...MAPA.slice(ini, fim).matchAll(/^\s+"?([\w-]+)"?: require\(/gm)]
    .map((m) => m[1])
    .sort();
}

describe("o mapa das vozes bate com as gravações do app antigo", () => {
  test("toda fala da meditação gravada está no mapa, e só elas", () => {
    const arquivos = readdirSync(join(AUDIO, "med"))
      .filter((f) => f.endsWith(".mp3"))
      .map((f) => f.slice(0, -4))
      .sort();
    expect(chavesDe("VOZ_DA_MEDITACAO")).toEqual(arquivos);
    expect(arquivos.length).toBe(191);
  });
  test("os nove movimentos narrados e as três palavras da respiração", () => {
    expect(chavesDe("VOZ_DO_MOVIMENTO")).toEqual([
      "balanco",
      "bracos",
      "gatocamelo",
      "ombros",
      "pelve",
      "pescoco",
      "quadril",
      "torcao",
      "tornozelo",
    ]);
    expect(chavesDe("VOZ_DA_RESPIRACAO")).toEqual(["inspire", "segure", "solte"]);
  });
  test("a voz da noite: cada bloco das histórias e da sessão do casal tem a sua gravação", () => {
    const arquivos = ["dormir", "casal"]
      .flatMap((p) => readdirSync(join(AUDIO, p)).filter((f) => f.endsWith(".mp3")))
      .map((f) => f.slice(0, -4))
      .sort();
    expect(chavesDe("VOZ_DA_NOITE")).toEqual(arquivos);
    const blocos = [...HISTORIAS.flatMap((h) => h.blocos), ...SESSAO_DO_CASAL.blocos].map(
      (b) => b.id,
    );
    for (const id of blocos) expect(arquivos).toContain(id);
  });
  test("todo require aponta para um arquivo que existe", () => {
    const caminhos = [
      ...MAPA.matchAll(/require\("\.\.\/\.\.\/\.\.\/\.\.\/src\/assets\/audio\/([^"]+)"\)/g),
    ].map((m) => m[1]);
    expect(caminhos.length).toBe(268);
    for (const c of caminhos) expect(() => readFileSync(join(AUDIO, c))).not.toThrow();
  });
});
