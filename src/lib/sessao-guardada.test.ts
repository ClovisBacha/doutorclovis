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

describe("⚠️ a FORÇA viaja junto", () => {
  /* ⚠️ **Era o MESMO defeito que este arquivo veio consertar, resolvido para
     um campo e deixado de pé para o outro.** A força é escolhida durante a
     sessão e vive em `useState`; quem toca em "Falar com o meu médico" porque
     sentiu o bebê MAIS FRACO volta com o chip em "Como sempre", e a linha é
     gravada afirmando o contrário do que ela marcou — no eixo cuja razão de
     chance para desfecho ruim é 2,53 (Heazell 2017). */
  test("o que ela marcou volta com a contagem", () => {
    const startedAt = new Date(AGORA - min(40)).toISOString();
    guardarSessao("u1", { startedAt, count: 4, forca: 1 });
    expect(lerSessao("u1", AGORA)?.forca).toBe(1);
  });

  test("⚠️ pacote de versão anterior devolve `undefined`, e nunca 2", () => {
    /* Quem escolhe o padrão de exibição é o componente, num lugar só. Cravar
       "Como sempre" aqui faria a leitura AFIRMAR uma escolha que ela nunca
       fez. */
    guardarSessao("u1", { startedAt: new Date(AGORA - min(5)).toISOString(), count: 2 });
    expect(lerSessao("u1", AGORA)?.forca).toBeUndefined();
  });

  test("⚠️ fora do catálogo de três também é `undefined`", () => {
    for (const cru of [0, 4, -1, 2.5, "1", null]) {
      memoria.set(
        chaveDaSessaoDeChutes("u1"),
        JSON.stringify({ startedAt: new Date(AGORA - min(5)).toISOString(), count: 2, forca: cru }),
      );
      const lida = lerSessao("u1", AGORA);
      /* A sessão continua valendo — o que não vale é a força. */
      expect(lida?.count).toBe(2);
      if (cru === 2.5) expect(lida?.forca).toBe(2);
      else expect(lida?.forca).toBeUndefined();
    }
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
