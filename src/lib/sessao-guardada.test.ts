/**
 * A CONTAGEM SOBREVIVE A TROCAR DE TELA — e o caminho de SOCORRO era o pior.
 *
 * ⚠️ `RegistrosHub` renderiza `<Fade key={sub}>`: tocar em Contrações, no
 * Diário ou na seta desmonta a aba de chutes, e a contagem era estado do React.
 * O botão do cartão vermelho chama `onNavigate("Consultas")` — ou seja, o único
 * caminho de contato da tela DESTRUÍA a contagem de duas horas que produziu o
 * alarme, que é justamente a evidência que ela ia contar ao médico.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { chaveDaSessaoDeChutes, guardarSessao, lerSessao } from "@/lib/sessao-guardada";

/** Um `localStorage` de mentira — o `bun` não tem `window`. */
const memoria = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => memoria.get(k) ?? null,
    setItem: (k: string, v: string) => void memoria.set(k, v),
    removeItem: (k: string) => void memoria.delete(k),
  },
};

const AGORA = new Date("2026-09-05T22:00:00-03:00").getTime();
const min = (m: number) => m * 60000;

beforeEach(() => memoria.clear());

describe("guardar e ler", () => {
  test("a contagem volta com o instante e o número", () => {
    const startedAt = new Date(AGORA - min(35)).toISOString();
    guardarSessao("u1", { startedAt, count: 6 });
    expect(lerSessao("u1", AGORA)).toEqual({ startedAt, count: 6 });
  });

  test("⚠️ a chave leva o id da conta — o aparelho é compartilhado", () => {
    /* Num consultório isso é o caso comum, e uma contagem em curso da conta
       anterior reaparecendo é pior que contagem nenhuma: ela seria lida como
       dela. */
    guardarSessao("u1", { startedAt: new Date(AGORA - min(5)).toISOString(), count: 3 });
    expect(lerSessao("u2", AGORA)).toBeNull();
  });

  test("⚠️ e a chave NÃO leva o prefixo `dc-path-`", () => {
    /* Aquele viaja no blob do `journey_state` e dispara um PUSH a cada
       gravação — e aqui a gravação acontece a cada toque no bebê. É o mesmo
       motivo pelo qual `dc-agua:` e `dc-suplementos:` ficaram de fora dele. */
    expect(chaveDaSessaoDeChutes("u1").startsWith("dc-path-")).toBe(false);
    expect(chaveDaSessaoDeChutes("u1")).toContain("u1");
  });

  test("encerrar apaga", () => {
    guardarSessao("u1", { startedAt: new Date(AGORA).toISOString(), count: 2 });
    guardarSessao("u1", null);
    expect(lerSessao("u1", AGORA)).toBeNull();
  });
});

describe("⚠️ o que NÃO volta", () => {
  test("sessão de ontem é abandono, não pausa", () => {
    /* Restaurar uma contagem de ontem faria a tela mostrar um relógio que não
       corresponde a nada — e o `started_at` gravado ancoraria a duração num
       instante de outro dia. */
    guardarSessao("u1", { startedAt: new Date(AGORA - min(60 * 9)).toISOString(), count: 4 });
    expect(lerSessao("u1", AGORA)).toBeNull();
  });

  test("quatro horas ainda volta; cinco não", () => {
    guardarSessao("u1", { startedAt: new Date(AGORA - min(230)).toISOString(), count: 4 });
    expect(lerSessao("u1", AGORA)?.count).toBe(4);
    guardarSessao("u1", { startedAt: new Date(AGORA - min(300)).toISOString(), count: 4 });
    expect(lerSessao("u1", AGORA)).toBeNull();
  });

  test("⚠️ instante no FUTURO também vence", () => {
    /* Relógio adiantado e depois corrigido deixaria uma sessão eterna. */
    guardarSessao("u1", { startedAt: new Date(AGORA + min(30)).toISOString(), count: 1 });
    expect(lerSessao("u1", AGORA)).toBeNull();
  });

  test("lixo gravado não estoura e não vira sessão", () => {
    memoria.set(chaveDaSessaoDeChutes("u1"), "{isto não é json");
    expect(lerSessao("u1", AGORA)).toBeNull();
    memoria.set(chaveDaSessaoDeChutes("u1"), JSON.stringify({ count: 3 }));
    expect(lerSessao("u1", AGORA)).toBeNull();
    memoria.set(chaveDaSessaoDeChutes("u1"), JSON.stringify({ startedAt: "x", count: 3 }));
    expect(lerSessao("u1", AGORA)).toBeNull();
  });

  test("sem conta resolvida, não lê nem grava", () => {
    guardarSessao(null, { startedAt: new Date(AGORA).toISOString(), count: 9 });
    expect(memoria.size).toBe(0);
    expect(lerSessao(null, AGORA)).toBeNull();
  });
});
