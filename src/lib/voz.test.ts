/**
 * O mapa de faixas casa com os temas de meditação?
 *
 * `voz.ts` liga tema → arquivo por uma string escrita à mão. Se alguém
 * renomear "Sono tranquilo" no `gestacao-path.tsx` e esquecer daqui, a tela
 * roda muda e nada quebra — o tipo de defeito que só aparece quando uma
 * paciente reclama. Este teste lê os dois lados do disco e falha alto.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  faixaDoTema,
  temasComFaixa,
  faixaDoMovimento,
  movimentosComFaixa,
  RESPIRACAO,
  RECHAMADAS_AUDIO,
  FECHAMENTO,
} from "./voz";

// Os testes rodam a partir da raiz do repositório (`bun test src/`).
const RAIZ = process.cwd();

/** Os temas como estão escritos hoje no componente da jornada. */
function temasDoComponente(): string[] {
  const s = readFileSync(join(RAIZ, "src", "components", "gestacao-path.tsx"), "utf8");
  const i = s.indexOf("const MEDITACOES:");
  expect(i).toBeGreaterThan(-1);
  const bloco = s.slice(i, s.indexOf("/* ── Registro de meditação"));
  return [...bloco.matchAll(/theme:\s*"([^"]+)"/g)].map((m) => m[1]);
}

describe("voz guiada", () => {
  test("tem faixa para todos os temas de meditação", () => {
    const faltando = temasDoComponente().filter((t) => faixaDoTema(t) === null);
    expect(faltando).toEqual([]);
  });

  test("não tem faixa sobrando para tema que não existe mais", () => {
    const doComponente = new Set(temasDoComponente());
    const orfas = temasComFaixa().filter((t) => !doComponente.has(t));
    expect(orfas).toEqual([]);
  });

  test("tem as três palavras da respiração e elas são arquivos distintos", () => {
    const vs = [RESPIRACAO.in, RESPIRACAO.hold, RESPIRACAO.out];
    expect(vs.every(Boolean)).toBe(true);
    expect(new Set(vs).size).toBe(3);
  });

  test("tem uma rechamada para cada frase escrita", () => {
    const s = readFileSync(join(RAIZ, "src", "components", "gestacao-path.tsx"), "utf8");
    const bloco = s.slice(s.indexOf("const RECHAMADAS"), s.indexOf("const COMO_ESTOU"));
    const frases = [...bloco.matchAll(/"((?:[^"\\]|\\.)*)"/g)].length;
    expect(RECHAMADAS_AUDIO.length).toBe(frases);
  });

  test("tem faixa de fechamento", () => {
    expect(FECHAMENTO).toBeTruthy();
  });

  test("tem faixa para todos os nove movimentos", () => {
    const s = readFileSync(join(RAIZ, "src", "components", "gestacao-path.tsx"), "utf8");
    const bloco = s.slice(
      s.indexOf("const MOVIMENTOS: Movimento[] = ["),
      // Âncora no CÓDIGO, não num comentário: a primeira versão terminava
      // a fatia num texto de comentário, e bastou reescrevê-lo para o teste
      // varrer o arquivo inteiro e achar `id:` de outras coisas.
      s.indexOf("function movimentosForDay"),
    );
    const ids = [...bloco.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((i) => faixaDoMovimento(i) === null)).toEqual([]);
  });

  test("não tem faixa de movimento órfã", () => {
    const s = readFileSync(join(RAIZ, "src", "components", "gestacao-path.tsx"), "utf8");
    const bloco = s.slice(
      s.indexOf("const MOVIMENTOS: Movimento[] = ["),
      // Âncora no CÓDIGO, não num comentário: a primeira versão terminava
      // a fatia num texto de comentário, e bastou reescrevê-lo para o teste
      // varrer o arquivo inteiro e achar `id:` de outras coisas.
      s.indexOf("function movimentosForDay"),
    );
    const ids = new Set([...bloco.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]));
    expect(movimentosComFaixa().filter((i) => !ids.has(i))).toEqual([]);
  });
});
