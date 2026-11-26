import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";

/**
 * AS ARTES DA BOLHA (23/11/2026, o dono: "o bebê bolha está ficando desfocada
 * na tela principal e a imagem dele de coração está ficando cortada em cima").
 *
 * - DESFOCADA (refeito em 24/11/2026, medido no simulador): o iOS reduz a
 *   arte na placa de vídeo com o filtro TRILINEAR, que mistura a imagem com
 *   uma cópia pela metade. Com a arte de 960 inteira (`allowDownscaling={false}`,
 *   a correção de 23/11) a Bolha pequena saía MAIS borrada que com a redução
 *   do próprio expo-image, que entrega a arte no tamanho exato da vista
 *   (comparadas lado a lado, ampliadas). Então: a Bolha do CÉU vem já no
 *   tamanho exato (`BOLHA_DO_CEU`, 212/424/636 px, reduzida com o filtro de
 *   alta qualidade) e não é reduzida de novo; todas as outras deixam o
 *   expo-image reduzir (o padrão). E a Bolha para no pixel inteiro: o
 *   `Flutuar` descansa em escala 1, e a inclinação tem uma zona morta.
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
  test("a Bolha do céu vem no tamanho exato; as outras, reduzidas pelo expo-image", () => {
    const daBolha = imagens().filter(({ el }) =>
      /source=\{[^}]*\b(BOLHA|BOLHA_DO_CEU|ARTE_SURPRESA|BOLHA_DORMINDO)\b|source=\{ARTES\[humor\]\}|source=\{fonte\}/.test(
        el,
      ),
    );
    expect(daBolha.length).toBeGreaterThan(8);
    const doCeu = daBolha.filter(({ el }) => /BOLHA_DO_CEU/.test(el));
    expect(doCeu.map((d) => d.arquivo)).toEqual([
      join("componentes", "jornada", "ceu-do-bebe.tsx"),
    ]);
    expect(doCeu[0]!.el).toContain("allowDownscaling={false}");
    const outras = daBolha.filter(({ el }) => !/BOLHA_DO_CEU/.test(el));
    expect(
      outras.filter(({ el }) => el.includes("allowDownscaling={false}")).map((s) => s.arquivo),
    ).toEqual([]);
  });

  test("a Bolha do céu tem as três escalas, no tamanho exato de 212 pt", () => {
    const dir = join(RAIZ, "..", "assets", "bolha", "ceu");
    for (const h of ["feliz", "surpresa"])
      for (const [suf, px] of [
        ["", 212],
        ["@2x", 424],
        ["@3x", 636],
      ] as const) {
        const arq = join(dir, `${h}${suf}.webp`);
        expect(existsSync(arq)).toBe(true);
        /* O cabeçalho VP8X do webp guarda a largura - 1 em 3 bytes (pos. 24). */
        const b = readFileSync(arq);
        expect({ arq: `${h}${suf}`, largura: b.readUIntLE(24, 3) + 1 }).toEqual({
          arq: `${h}${suf}`,
          largura: px,
        });
      }
    const ceu = readFileSync(join(RAIZ, "componentes", "jornada", "ceu-do-bebe.tsx"), "utf8");
    expect(ceu).toMatch(/const BEBE = 212;/);
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
