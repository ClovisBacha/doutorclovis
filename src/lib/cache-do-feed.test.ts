/**
 * O CACHE DE MEMÓRIA DA COMUNIDADE.
 *
 * Ele existe porque as abas de `minha-conta` são montadas com
 * `{tab === "X" && <X/>}`: trocar de aba DESMONTA o componente e joga o estado
 * fora. Ir ao Bebê e voltar refazia o feed inteiro — e a paciente esperava de
 * novo por uma tela que ela viu dez segundos atrás.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  guardarNoCache,
  lerDoCache,
  limparCacheDoFeed,
  tamanhoDoCache,
  VALIDADE_MS,
} from "./cache-do-feed";

beforeEach(() => limparCacheDoFeed());

describe("guardar e ler", () => {
  test("o que entra sai igual", () => {
    guardarNoCache("k", { posts: [1, 2] });
    expect(lerDoCache("k")).toEqual({ posts: [1, 2] });
  });

  test("chave que nunca foi guardada devolve null", () => {
    expect(lerDoCache("nada")).toBeNull();
  });

  /* ⚠️ `undefined` guardado seria indistinguível de "não tem nada" na leitura —
     e quem lê continuaria buscando, que é o certo. Guardar é que não faz
     sentido: ocuparia uma entrada para dizer nada. */
  test("⚠️ `undefined` não é guardado", () => {
    guardarNoCache("k", undefined);
    expect(tamanhoDoCache()).toBe(0);
  });
});

describe("a validade", () => {
  /* ⚠️ Curta de propósito, e não para poupar rede: é para o feed não MENTIR.
     Um cache de meia hora mostraria como "agora" um story que já venceu e uma
     publicação que a autora arquivou. */
  test("⚠️ é curta — minutos, não horas", () => {
    expect(VALIDADE_MS).toBeLessThanOrEqual(5 * 60_000);
    expect(VALIDADE_MS).toBeGreaterThanOrEqual(30_000);
  });

  test("dentro da janela, serve", () => {
    guardarNoCache("k", 1);
    expect(lerDoCache("k", Date.now() + VALIDADE_MS - 1000)).toBe(1);
  });

  test("passou da janela, não serve — e a entrada some", () => {
    guardarNoCache("k", 1);
    expect(lerDoCache("k", Date.now() + VALIDADE_MS + 1000)).toBeNull();
    expect(tamanhoDoCache()).toBe(0);
  });

  /**
   * ⚠️ RELÓGIO QUE ANDOU PARA TRÁS NÃO VALIDA UM CACHE ETERNO.
   *
   * O relógio do aparelho é do usuário, não nosso: fuso trocado, ajuste manual
   * ou sincronização atrasada produzem `agora` menor que `quando`. Com uma
   * comparação só de "maior que", a idade negativa passaria para sempre — e o
   * feed congelaria numa foto do passado sem nenhuma forma de sair.
   */
  test("⚠️ idade NEGATIVA também é descartada", () => {
    guardarNoCache("k", 1);
    expect(lerDoCache("k", Date.now() - 10 * 60_000)).toBeNull();
  });
});

/**
 * ⚠️ O LOGOUT APAGA TUDO — e este é o teste de privacidade, não de desempenho.
 *
 * O cache guarda fotos, textos e nomes de OUTRAS pacientes, de uma base de
 * gestação de alto risco. Num aparelho compartilhado — que num consultório é o
 * caso comum — a próxima conta não pode encontrar o feed da anterior.
 */
describe("o logout", () => {
  test("⚠️ apaga TODAS as chaves, não uma lista escolhida", () => {
    guardarNoCache("a", 1);
    guardarNoCache("b", 2);
    guardarNoCache("c", 3);
    limparCacheDoFeed();
    expect(tamanhoDoCache()).toBe(0);
    expect(lerDoCache("a")).toBeNull();
    expect(lerDoCache("b")).toBeNull();
    expect(lerDoCache("c")).toBeNull();
  });

  /* ⚠️ E o `signOut` de `minha-conta` chama a limpeza ANTES de derrubar a
     sessão: depois, o componente já pode ter remontado. */
  test("⚠️ `signOut` limpa o cache, e antes do `supabase.auth.signOut()`", () => {
    const fonte = readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    const i = fonte.indexOf("async function signOut()");
    expect(i).toBeGreaterThan(-1);
    const corpo = fonte.slice(i, i + 600);
    const limpa = corpo.indexOf("limparCacheDoFeed");
    const sai = corpo.indexOf("supabase.auth.signOut()");
    expect(limpa).toBeGreaterThan(-1);
    expect(sai).toBeGreaterThan(-1);
    expect(limpa).toBeLessThan(sai);
  });
});

/**
 * ⚠️ E ELE NUNCA VAI PARA O DISCO.
 *
 * Escrevê-lo no `localStorage` criaria uma segunda cópia do conteúdo de outras
 * pacientes no aparelho dela — que sobrevive ao logout, aparece em backup e não
 * é apagada pela varredura da LGPD (`conta.functions.ts` sabe apagar tabelas e
 * baldes, não o armazém local de outro aparelho).
 */
describe("nada disso vai para o disco", () => {
  test("⚠️ o módulo não toca em localStorage nem em sessionStorage", () => {
    const fonte = readFileSync("src/lib/cache-do-feed.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    expect(fonte).not.toContain("localStorage");
    expect(fonte).not.toContain("sessionStorage");
    expect(fonte).not.toContain("indexedDB");
  });
});
