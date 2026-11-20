import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { chaveDaFita, gravarFitaCache, lerFitaCache, PREFIXO_FITA_CACHE } from "./fita-cache";

/* Um localStorage de mentira, só o que o módulo usa. */
function armazemDeMentira() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    _m: m,
  };
}

const g = globalThis as unknown as { localStorage?: unknown };
let antes: unknown;
beforeEach(() => {
  antes = g.localStorage;
  g.localStorage = armazemDeMentira();
});
afterEach(() => {
  g.localStorage = antes;
});

describe("o cache da fita", () => {
  test("lembra saldo, troféus e amigas por uid — e nada de outra conta", () => {
    gravarFitaCache("a", { saldo: 118, trofeus: 3 });
    gravarFitaCache("b", { saldo: 5 });
    expect(lerFitaCache("a")).toEqual({ saldo: 118, trofeus: 3 });
    expect(lerFitaCache("b")).toEqual({ saldo: 5 });
    expect(lerFitaCache("c")).toBeNull();
  });

  test("⚠️ grava SÓ o que veio, preservando o resto", () => {
    /* saldo e amigas chegam de funções diferentes, em instantes diferentes:
       uma escrita que substituísse o objeto apagaria o número da outra. */
    gravarFitaCache("a", { saldo: 118, trofeus: 3 });
    gravarFitaCache("a", { amigas: 4 });
    expect(lerFitaCache("a")).toEqual({ saldo: 118, trofeus: 3, amigas: 4 });
  });

  test("⚠️ `saldo: null` é o Modo Cuidado, e sobrevive à gravação", () => {
    gravarFitaCache("a", { saldo: null, trofeus: 0 });
    const c = lerFitaCache("a");
    expect(c).not.toBeNull();
    expect("saldo" in c!).toBe(true);
    expect(c!.saldo).toBeNull();
  });

  test("lixo no armazém vira `null`, nunca estoura", () => {
    (g.localStorage as Storage).setItem(chaveDaFita("a"), "{não é json");
    expect(lerFitaCache("a")).toBeNull();
    (g.localStorage as Storage).setItem(chaveDaFita("a"), JSON.stringify(["x"]));
    expect(lerFitaCache("a")).toBeNull();
    (g.localStorage as Storage).setItem(chaveDaFita("a"), JSON.stringify({ saldo: "12" }));
    expect(lerFitaCache("a")).toEqual({});
  });

  test("⚠️ a chave NÃO é `dc-path-` — cache de número não é jornada", () => {
    expect(PREFIXO_FITA_CACHE.startsWith("dc-path-")).toBe(false);
    expect(chaveDaFita("u1")).toBe("dc-cache-fita:u1");
  });

  test("sem localStorage (SSR) o módulo cala", () => {
    g.localStorage = undefined;
    expect(lerFitaCache("a")).toBeNull();
    expect(() => gravarFitaCache("a", { saldo: 1 })).not.toThrow();
  });
});

describe("a fita do Jogo usa o cache — e confere o uid da sessão", () => {
  const TRILHA = readFileSync("src/components/gestacao-path.tsx", "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

  test("lê o cache com o uid da SESSÃO, antes de esperar o servidor", () => {
    const i = TRILHA.indexOf("lerFitaCache(uid)");
    const j = TRILHA.indexOf("await claimDailyAndGetWallet(");
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
    /* e o uid vem da sessão, nunca de uma variável de módulo */
    const trecho = TRILHA.slice(TRILHA.lastIndexOf("const uid =", i), i);
    expect(trecho).toContain("s.session.user.id");
  });

  test("⚠️ a carteira e o cantinho saem JUNTOS", () => {
    expect(TRILHA).toContain("void Promise.all([carteira, cantinho])");
  });

  test("grava o que o servidor devolveu, inclusive o Modo Cuidado como `null`", () => {
    const i = TRILHA.indexOf("gravarFitaCache(uid, {");
    expect(i).toBeGreaterThan(-1);
    expect(TRILHA.slice(i, i + 200)).toMatch(/saldo:\s*w\.careMode \? null : w\.balance/);
  });
});
