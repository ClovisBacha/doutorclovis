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

/**
 * Os temas como estão escritos hoje no componente, e se cada um TEM FALAS.
 *
 * A distinção passou a existir em ago/2026, quando a respiração guiada virou
 * o tema "Só respirar" com `lines: []`. Um tema sem falas não tem o que
 * narrar: quem conduz ali são as três palavras da respiração
 * (`RESPIRACAO`), que não dependem de tema nenhum.
 */
function temasDoComponente(): { tema: string; temFalas: boolean }[] {
  const s = readFileSync(join(RAIZ, "src", "components", "gestacao-path.tsx"), "utf8");
  const i = s.indexOf("const MEDITACOES:");
  expect(i).toBeGreaterThan(-1);
  const bloco = s.slice(i, s.indexOf("/* ── Registro de meditação"));
  return [...bloco.matchAll(/theme:\s*"([^"]+)"[\s\S]*?lines:\s*\[([\s\S]*?)\]/g)].map((m) => ({
    tema: m[1],
    temFalas: m[2].trim().length > 0,
  }));
}

describe("voz guiada", () => {
  test("tem faixa para todo tema que TEM falas", () => {
    const faltando = temasDoComponente()
      .filter((t) => t.temFalas)
      .filter((t) => faixaDoTema(t.tema) === null)
      .map((t) => t.tema);
    expect(faltando).toEqual([]);
  });

  test("tema SEM falas não tem faixa — seria uma narração sem texto", () => {
    /* O inverso do teste acima, e não uma folga dele: se alguém apagar as
       falas de um tema e esquecer a faixa, a voz passaria a narrar um texto
       que não está mais escrito em lugar nenhum da tela. */
    const sobrando = temasDoComponente()
      .filter((t) => !t.temFalas)
      .filter((t) => faixaDoTema(t.tema) !== null)
      .map((t) => t.tema);
    expect(sobrando).toEqual([]);
  });

  test("o parser acha temas de verdade (o teste testa algo)", () => {
    /* Se a regex parar de casar — porque o formato do array mudou — os dois
       testes acima passam com zero temas e viram decoração. */
    const todos = temasDoComponente();
    expect(todos.length).toBeGreaterThanOrEqual(5);
    expect(todos.some((t) => t.temFalas)).toBe(true);
  });

  test("não tem faixa sobrando para tema que não existe mais", () => {
    const doComponente = new Set(temasDoComponente().map((t) => t.tema));
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
