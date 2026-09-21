import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  MARCA_AUTOMATICA,
  MOTIVOS_SENSIVEIS,
  deveBorrar,
  rotuloDoMotivo,
} from "./conteudo-sensivel";

const semProsa = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("o aviso de conteúdo sensível", () => {
  test("borra para quem lê", () => {
    expect(deveBorrar({ sensivel: true, souAAutora: false, revelado: false })).toBe(true);
  });

  test("⚠️ a AUTORA nunca vê o próprio post borrado", () => {
    /* Ela sabe o que escreveu; borrar seria o app tratando-a como quem precisa
       ser protegida do que ela mesma decidiu contar. */
    expect(deveBorrar({ sensivel: true, souAAutora: true, revelado: false })).toBe(false);
  });

  test("post não marcado nunca borra", () => {
    expect(deveBorrar({ sensivel: false, souAAutora: false, revelado: false })).toBe(false);
  });

  test("revelado deixa de borrar", () => {
    expect(deveBorrar({ sensivel: true, souAAutora: false, revelado: true })).toBe(false);
  });

  test("⚠️ o app NÃO marca nada sozinho", () => {
    /**
     * A tentação é marcar o que a régua clínica reconhece, ou todo post de quem
     * está em luto. A segunda contaria o luto dela para quem visse a marca.
     */
    expect(MARCA_AUTOMATICA).toBe(false);
  });

  test("⚠️ o motivo é catálogo FECHADO", () => {
    /* Campo livre aqui é onde alguém escreve o diagnóstico de outra pessoa. */
    expect(MOTIVOS_SENSIVEIS.length).toBeGreaterThan(2);
    expect(MOTIVOS_SENSIVEIS.length).toBeLessThan(8);
    for (const m of MOTIVOS_SENSIVEIS) expect(m.rotulo.trim().length).toBeGreaterThan(3);
  });

  test("motivo desconhecido cai no genérico, nunca em vazio", () => {
    expect(rotuloDoMotivo(null)).toBe("Conteúdo sensível");
    expect(rotuloDoMotivo("inventado")).toBe("Conteúdo sensível");
  });

  test("⚠️ NUNCA esconde — a régua só sabe borrar", () => {
    /**
     * Esconder seria o app decidindo que aquilo não deve ser lido, e a
     * experiência de quem perdeu uma gestação é o que esta comunidade não pode
     * calar. Há teste porque a próxima pessoa a mexer aqui vai querer filtrar.
     */
    const F = semProsa(readFileSync("src/lib/conteudo-sensivel.ts", "utf8"));
    expect(F).not.toMatch(/\bfilter\b|\besconder\b|\bocultar\b/);
  });
});
