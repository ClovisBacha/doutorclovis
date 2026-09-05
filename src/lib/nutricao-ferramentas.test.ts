/**
 * AS FERRAMENTAS DA NUTRICIONISTA — o que a frase montada pode e não pode dizer.
 *
 * ⚠️ O risco desta régua é de TEXTO: ela escreve a pergunta que vai para a
 * IA, e em Modo Cuidado a palavra "gestação" não pode entrar por aqui — a
 * saudação e o cartão de nutrientes já se calam, e a ferramenta seria a porta
 * dos fundos.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  ALIMENTO_MAX,
  ALIVIOS,
  META_COPOS,
  PREFIXO_AGUA,
  REFEICOES,
  chaveDaAgua,
  chavesDeAguaVencidas,
  limparAlimento,
  perguntaDeAlivio,
  perguntaDoPrato,
  perguntaPossoComer,
} from "./nutricao-ferramentas";

const semProsa = (t: string) =>
  t
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

describe("posso comer?", () => {
  test("fora do luto, a pergunta é sobre a gestação", () => {
    expect(perguntaPossoComer("sushi", false)).toMatch(/^Posso comer sushi na gestação\?/);
  });
  test("⚠️ em Modo Cuidado NENHUM modelo diz gestação, bebê ou parto", () => {
    const frases = [
      perguntaPossoComer("sushi", true),
      ...REFEICOES.map((r) => perguntaDoPrato(r)),
      ...ALIVIOS.map((a) => perguntaDeAlivio(a.frase)),
    ];
    for (const f of frases) expect(f).not.toMatch(/gesta|beb[êe]|parto|trimestre/i);
  });
  test("o que ela digita é limpo e tem teto", () => {
    expect(limparAlimento("  queijo   brie \n")).toBe("queijo brie");
    expect(limparAlimento("a")).toBeNull();
    expect(limparAlimento("")).toBeNull();
    expect(limparAlimento("x".repeat(200))!.length).toBe(ALIMENTO_MAX);
  });
});

describe("as frases leem como português", () => {
  test("⚠️ 'estou com sem apetite' não existe — o chip tem rótulo e frase", () => {
    for (const a of ALIVIOS) {
      const f = perguntaDeAlivio(a.frase);
      expect(f).toMatch(/^Estou com [a-zà-ú]/);
      expect(f).not.toMatch(/com sem /);
    }
  });
  test("a refeição entra em minúscula no meio da frase", () => {
    expect(perguntaDoPrato("Café da manhã")).toMatch(/^Monte um café da manhã/);
  });
});

describe("a água do dia", () => {
  test("uma chave por dia, e as dos outros dias saem", () => {
    const hoje = "2026-09-05";
    const chaves = [chaveDaAgua("2026-09-03"), chaveDaAgua(hoje), "dc-path-day-3", "outra"];
    expect(chavesDeAguaVencidas(chaves, hoje)).toEqual([chaveDaAgua("2026-09-03")]);
  });
  test("⚠️ a chave NÃO é `dc-path-` — essa viaja no blob e dispara push por escrita", () => {
    expect(PREFIXO_AGUA.startsWith("dc-path-")).toBe(false);
    expect(chaveDaAgua("2026-09-05").startsWith("dc-path-")).toBe(false);
  });
  test("8 copos é a referência, e a tela diz que é referência", () => {
    expect(META_COPOS).toBe(8);
    const TELA = semProsa(readFileSync("src/components/nutricao-tab.tsx", "utf8"));
    expect(TELA).toMatch(/Referência de cerca de 2 litros/);
  });
});

describe("a tela usa a régua, e não frases soltas", () => {
  const TELA = semProsa(readFileSync("src/components/nutricao-tab.tsx", "utf8"));
  test("as três ferramentas mandam pela régua", () => {
    expect(TELA).toMatch(/perguntar\(perguntaPossoComer\(a, careMode\)\)/);
    expect(TELA).toMatch(/perguntar\(perguntaDoPrato\(r\)\)/);
    expect(TELA).toMatch(/perguntar\(perguntaDeAlivio\(a\.frase\)\)/);
  });
  test("⚠️ a água é lida num EFEITO, nunca no render", () => {
    const i = TELA.indexOf("localStorage.getItem(chaveDaAgua");
    expect(i).toBeGreaterThan(-1);
    const antes = TELA.slice(Math.max(0, i - 260), i);
    expect(antes).toMatch(/useEffect\(\(\) => \{/);
  });
  test("o que ela digita passa por `limparAlimento` antes de virar pergunta", () => {
    expect(TELA).toMatch(/const a = limparAlimento\(alimento\);\s*if \(a\) perguntar/);
  });
});
