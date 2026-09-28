import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * NENHUM CAMPO DO APP DÁ ZOOM NO IPHONE (set/2026).
 *
 * Abaixo de 16px o Safari do iPhone amplia a página ao focar um campo — e
 * não volta sozinho. Foi metade da causa do "a tela se desloca" do chat, e o
 * chat era UM de 161 campos: 155 estavam em 13, 14 ou 15px. O conserto é UMA
 * regra em `styles.css`, fora de @layer e recortada por `(pointer: coarse)`,
 * e não 155 edições — esta catraca cobra que a regra continue de pé e que
 * ninguém a "conserte" para dentro de uma camada, onde um `text-sm` a
 * venceria de novo.
 */
const css = readFileSync("src/styles.css", "utf8");
const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, "");

function blocoDaRegra(): string {
  const i = semComentarios.indexOf("font-size: max(16px, 1em)");
  expect(i).toBeGreaterThan(-1);
  const inicio = semComentarios.lastIndexOf("@media", i);
  const fim = semComentarios.indexOf("}\n}", i);
  expect(inicio).toBeGreaterThan(-1);
  expect(fim).toBeGreaterThan(i);
  return semComentarios.slice(inicio, fim + 3);
}

describe("a regra do zoom nos campos", () => {
  test("cobre input, textarea e select, e só sobe", () => {
    const b = blocoDaRegra();
    expect(b).toMatch(/\binput\b/);
    expect(b).toMatch(/\btextarea\b/);
    expect(b).toMatch(/\bselect\b/);
    /* `max(16px, 1em)`: um campo que já é maior fica como está. */
    expect(b).toContain("max(16px, 1em)");
  });

  test("é recortada para o dedo, e não para todo mundo", () => {
    const b = blocoDaRegra();
    expect(b).toContain("(pointer: coarse)");
    expect(b).toMatch(/max-width:\s*767px/);
  });

  test("⚠️ vive FORA de @layer — dentro, um `text-sm` a venceria", () => {
    const i = semComentarios.indexOf("font-size: max(16px, 1em)");
    /* Conta as chaves abertas antes da regra: dentro de um `@layer x { … }`
       haveria uma chave a mais aberta do que fechada além das da própria
       @media. A regra está no nível zero do arquivo quando, antes do seu
       `@media`, o número de `{` e `}` empata. */
    const antes = semComentarios.slice(0, semComentarios.lastIndexOf("@media", i));
    const abertas = (antes.match(/\{/g) ?? []).length;
    const fechadas = (antes.match(/\}/g) ?? []).length;
    expect(abertas).toBe(fechadas);
  });

  test("os campos que não recebem texto ficam de fora", () => {
    const b = blocoDaRegra();
    for (const tipo of ["checkbox", "radio", "range"]) {
      expect(b).toContain(`:not([type="${tipo}"])`);
    }
  });
});
