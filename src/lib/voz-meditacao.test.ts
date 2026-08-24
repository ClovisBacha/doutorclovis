/**
 * TODA FALA TEM ÁUDIO, E TODO ÁUDIO TEM FALA.
 *
 * Os dois lados custam coisas diferentes: uma fala sem arquivo faz a sessão
 * andar em silêncio naquele trecho; um arquivo sem fala é crédito gasto num
 * áudio que nunca toca. O teste lê o DIRETÓRIO, não o módulo — `voz-meditacao`
 * usa `import.meta.glob`, que só existe dentro do Vite.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { ROTEIROS } from "./meditacao-roteiros";

const DIR = "src/assets/audio/med";
const noDisco = new Set(
  readdirSync(DIR)
    .filter((f) => f.endsWith(".mp3"))
    .map((f) => f.slice(0, -4)),
);

describe("as faixas da meditação", () => {
  test("toda fala do roteiro tem arquivo", () => {
    expect(ROTEIROS.filter((f) => !noDisco.has(f.id)).map((f) => f.id)).toEqual([]);
  });

  test("nenhum arquivo órfão — crédito gasto em áudio que não toca", () => {
    const ids = new Set(ROTEIROS.map((f) => f.id));
    expect([...noDisco].filter((n) => !ids.has(n))).toEqual([]);
  });

  test("os ids são únicos — dois textos no mesmo arquivo perderiam um", () => {
    /* O id vira o nome do arquivo. Dois iguais e o segundo sobrescreve o
       primeiro em silêncio, na hora de baixar. */
    const ids = ROTEIROS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("nenhum arquivo vazio ou truncado", () => {
    /* 2 KB é menos de um segundo a 128 kbps: abaixo disso a fala não existe.
       Um arquivo que baixou pela metade toca um pedaço e corta. */
    const magros = [...noDisco].filter((n) => statSync(`${DIR}/${n}.mp3`).size < 2000);
    expect(magros).toEqual([]);
  });
});
