import { describe, expect, test } from "bun:test";
import { IDADE_MINIMA_DIAS, memoriaDeHoje, textoDaMemoria } from "./memorias";

const AGORA = new Date("2027-08-26T12:00:00Z");
const base = (over: Partial<Parameters<typeof memoriaDeHoje>[0]["posts"][number]> = {}) => ({
  id: "p1",
  criadoEm: "2026-08-26T12:00:00Z",
  ciclo: "c1",
  vista: false,
  arquivada: false,
  ...over,
});
const chamar = (over: Partial<Parameters<typeof memoriaDeHoje>[0]> = {}) =>
  memoriaDeHoje({
    posts: [base()],
    cicloAtual: "c1",
    careMode: false,
    /* ⚠️ A Trava 5 pede um sinal POSITIVO de nascimento — ver `memorias.ts`. */
    nascimento: "2025-06-01",
    agora: AGORA,
    ...over,
  });

describe("as quatro travas", () => {
  test("o caso feliz devolve a memória", () => {
    expect(chamar()?.id).toBe("p1");
  });

  test("⚠️ TRAVA 1 — NUNCA em Modo Cuidado", () => {
    expect(chamar({ careMode: true })).toBeNull();
  });

  test('⚠️ e "não sei" também não mostra', () => {
    /* Enquanto o perfil não chegou, mostrar e descobrir o luto depois é tarde. */
    expect(chamar({ careMode: undefined })).toBeNull();
  });

  test("⚠️ TRAVA 5 — sem NASCIMENTO registrado, nenhuma memória", () => {
    /**
     * ⚠️ **Modo Cuidado é OPT-IN, e é por isso que esta trava existe.** Uma
     * mulher que perdeu a gestação e não contou ao app fica com o `lmp_date`
     * intacto: o ciclo continua o mesmo, a Trava 2 não morde, e ~300 dias
     * depois ela receberia "Há um ano, você publicou isto" com a foto da
     * barriga. O conserto não é esperar que ela ligue o Modo Cuidado — é
     * exigir um sinal POSITIVO de que a gestação terminou em nascimento.
     */
    expect(chamar({ nascimento: null })).toBeNull();
    /* E com ele, a memória volta a existir. */
    expect(chamar({ nascimento: "2025-06-01" })).not.toBeNull();
  });

  test("⚠️ TRAVA 2 — só do ciclo ATUAL", () => {
    /* O pior caso: a foto da barriga de uma gestação que terminou. */
    expect(chamar({ posts: [base({ ciclo: "c0" })] })).toBeNull();
  });

  test("⚠️ publicação SEM ciclo não vira memória", () => {
    expect(chamar({ posts: [base({ ciclo: null })] })).toBeNull();
  });

  test("⚠️ sem ciclo atual conhecido, nada", () => {
    expect(chamar({ cicloAtual: null })).toBeNull();
  });

  test("⚠️ e os DOIS nulos é o caso que a comparação sozinha deixa passar", () => {
    /**
     * ⚠️ **A MUTAÇÃO ACHOU ESTE BURACO.** Com uma publicação SEM ciclo e o
     * ciclo atual DESCONHECIDO, `null !== null` é falso — ou seja, o filtro
     * aprova. É exatamente o pior caso possível: não se sabe de que gestação a
     * publicação é, e ela seria mostrada assim mesmo.
     *
     * Quem fecha é o `return` antecipado, e é por isso que ele não é redundante.
     */
    expect(chamar({ cicloAtual: null, posts: [base({ ciclo: null })] })).toBeNull();
  });

  test("⚠️ TRAVA 3 — o que ela arquivou não volta", () => {
    expect(chamar({ posts: [base({ arquivada: true })] })).toBeNull();
  });

  test("⚠️ TRAVA 4 — uma vez só", () => {
    expect(chamar({ posts: [base({ vista: true })] })).toBeNull();
  });
});

describe("a janela", () => {
  test("post de ontem não é memória", () => {
    expect(chamar({ posts: [base({ criadoEm: "2027-08-25T12:00:00Z" })] })).toBeNull();
  });

  test("fora da janela do aniversário, nada", () => {
    expect(chamar({ posts: [base({ criadoEm: "2026-05-01T12:00:00Z" })] })).toBeNull();
  });

  test("dentro da tolerância, sim", () => {
    expect(chamar({ posts: [base({ criadoEm: "2026-08-24T12:00:00Z" })] })?.id).toBe("p1");
  });

  test("data inválida não quebra", () => {
    expect(chamar({ posts: [base({ criadoEm: "não é data" })] })).toBeNull();
  });

  test("⚠️ UMA por dia — a mais antiga", () => {
    const r = memoriaDeHoje({
      posts: [base({ id: "novo" }), base({ id: "velho", criadoEm: "2025-08-26T12:00:00Z" })],
      cicloAtual: "c1",
      careMode: false,
      nascimento: "2025-06-01",
      agora: AGORA,
    });
    expect(r?.id).toBe("velho");
  });

  test("a idade mínima é de quase um ano", () => {
    expect(IDADE_MINIMA_DIAS).toBeGreaterThan(180);
  });
});

describe("o texto", () => {
  test("⚠️ diz o FATO e para aí — não cobra nem comemora", () => {
    /* "Que ano incrível!" cai numa mulher que passou o ano no hospital. */
    for (const t of [textoDaMemoria(1), textoDaMemoria(2)]) {
      expect(t.toLowerCase()).not.toMatch(/incr[íi]vel|parab[ée]ns|que ano|saudade|lembra\?/);
    }
    expect(textoDaMemoria(1)).toContain("um ano");
    expect(textoDaMemoria(3)).toContain("3 anos");
  });
});
