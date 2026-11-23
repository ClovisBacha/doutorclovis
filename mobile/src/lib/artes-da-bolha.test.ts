import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";

/**
 * AS ARTES DA BOLHA (23/11/2026, o dono: "o bebê bolha está ficando desfocada
 * na tela principal e a imagem dele de coração está ficando cortada em cima").
 *
 * - DESFOCADA: o `expo-image` reduz a arte ao tamanho da vista na hora de
 *   decodificar (`allowDownscaling`, ligado por padrão). A Bolha nunca fica
 *   parada — flutua, balança e, no céu, inclina com o celular —, e a arte
 *   reduzida, redesenhada girada e fora do pixel inteiro, borrava. Toda
 *   imagem da Bolha leva `allowDownscaling={false}`: a arte de 960 px inteira
 *   (e uma só na memória, para todas as telas).
 * - CORTADA: a apaixonada e a estudiosa vinham cortadas na borda de cima. As
 *   duas foram refeitas das originais do Drive, inteiras
 *   (`mobile/scripts/bolha-do-drive.mjs`), e moram no app
 *   (`mobile/assets/bolha/`); o site, que não muda mais, fica com as dele.
 */

const RAIZ = join(import.meta.dir, "..");

function arquivos(dir: string): string[] {
  const fora: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fora.push(...arquivos(p));
    else if (/\.tsx$/.test(nome)) fora.push(p);
  }
  return fora;
}

/** Cada `<Image …/>` do fonte, com o arquivo. */
function imagens(): { arquivo: string; el: string }[] {
  const fora: { arquivo: string; el: string }[] = [];
  for (const p of arquivos(RAIZ)) {
    const s = semComentarios(readFileSync(p, "utf8"));
    for (const m of s.matchAll(/<Image\b[\s\S]*?\/>/g))
      fora.push({ arquivo: relative(RAIZ, p), el: m[0] });
  }
  return fora;
}

describe("as artes da Bolha", () => {
  test("toda imagem da Bolha é desenhada com a arte inteira (nítida em movimento)", () => {
    const daBolha = imagens().filter(({ el }) =>
      /source=\{[^}]*\b(BOLHA|ARTE_SURPRESA|BOLHA_DORMINDO)\b|source=\{ARTES\[humor\]\}|source=\{fonte\}/.test(
        el,
      ),
    );
    expect(daBolha.length).toBeGreaterThan(8);
    const sem = daBolha.filter(({ el }) => !el.includes("allowDownscaling={false}"));
    expect(sem.map((s) => s.arquivo)).toEqual([]);
  });

  test("a apaixonada e a estudiosa são as refeitas das originais, do app", () => {
    const artes = readFileSync(join(RAIZ, "componentes", "artes.ts"), "utf8");
    expect(artes).toContain('apaixonado: require("../../assets/bolha/apaixonado.webp")');
    expect(artes).toContain('estudiosa: require("../../assets/bolha/estudiosa.webp")');
    for (const n of ["apaixonado", "estudiosa"])
      expect(existsSync(join(RAIZ, "..", "assets", "bolha", `${n}.webp`))).toBe(true);
    /* Ninguém pede a arte da Bolha direto ao site, por fora do mapa. */
    const fora = arquivos(RAIZ)
      .filter((p) => !p.endsWith(join("componentes", "artes.ts")))
      .filter((p) => /assets\/bolha\//.test(readFileSync(p, "utf8")))
      .map((p) => relative(RAIZ, p));
    expect(fora).toEqual([]);
  });
});
