import { describe, expect, test } from "bun:test";
import {
  chaveDaRetrospectiva,
  daSemana,
  ehDomingo,
  FOTOS_NA_RETROSPECTIVA,
  fraseDaRetrospectiva,
  montarRetrospectiva,
  type PostDaSemana,
  type Retrospectiva,
} from "./retrospectiva";

/* 2026-08-23 é um domingo. */
const DOMINGO = new Date("2026-08-23T15:00:00Z");
const atras = (dias: number) => new Date(DOMINGO.getTime() - dias * 86_400_000).toISOString();

const post = (dias: number, mudar: Partial<PostDaSemana> = {}): PostDaSemana => ({
  id: `p${dias}`,
  criadoEm: atras(dias),
  imagemUrl: `foto-${dias}`,
  reacoes: 0,
  ...mudar,
});

const montar = (opts: Partial<Parameters<typeof montarRetrospectiva>[0]> = {}) =>
  montarRetrospectiva({
    posts: [],
    agora: DOMINGO,
    semanaAgora: 29,
    semanaHaSeteDias: 28,
    emCuidado: false,
    ...opts,
  });

describe("quando ela aparece", () => {
  test("é domingo", () => {
    expect(ehDomingo(DOMINGO)).toBe(true);
    expect(ehDomingo(new Date("2026-08-24T15:00:00Z"))).toBe(false);
  });

  /* ⚠️ O cartão mais festivo da aba, montado a partir de fotos de barriga, e
     chegando sem ela pedir. */
  test("⚠️ NUNCA em Modo Cuidado", () => {
    expect(montar({ emCuidado: true, posts: [post(1)] })).toBeNull();
  });

  /* ⚠️ "Você não publicou nada esta semana" é cobrança com cara de resumo — e
     chega justamente a quem teve a semana pior. */
  test("⚠️ sem publicação E sem virada de semana, não existe", () => {
    expect(montar({ posts: [], semanaAgora: 29, semanaHaSeteDias: 29 })).toBeNull();
  });

  test("só a virada de semana já basta", () => {
    expect(montar({ posts: [] })?.semanaQueVirou).toBe(29);
  });

  test("só a publicação já basta", () => {
    const r = montar({ posts: [post(2)], semanaAgora: 29, semanaHaSeteDias: 29 });
    expect(r?.publicacoes).toBe(1);
    expect(r?.semanaQueVirou).toBeNull();
  });

  test("sem gestação em curso, a virada é nula e não quebra", () => {
    const r = montar({ posts: [post(1)], semanaAgora: null, semanaHaSeteDias: null });
    expect(r?.semanaQueVirou).toBeNull();
  });
});

describe("a janela de sete dias", () => {
  test("pega o que está dentro e descarta o que está fora", () => {
    const ids = daSemana([post(1), post(6), post(9), post(30)], DOMINGO).map((p) => p.id);
    expect(ids).toEqual(["p1", "p6"]);
  });

  test("do mais novo para o mais antigo", () => {
    expect(daSemana([post(5), post(1), post(3)], DOMINGO).map((p) => p.id)).toEqual([
      "p1",
      "p3",
      "p5",
    ]);
  });

  test("data inválida não entra e não estoura", () => {
    expect(daSemana([post(1, { criadoEm: "ontem" })], DOMINGO)).toEqual([]);
  });
});

describe("o conteúdo", () => {
  test("até quatro fotos, e só as que existem", () => {
    const r = montar({
      posts: [post(1), post(2), post(3), post(4), post(5), post(6, { imagemUrl: null })],
    });
    expect(r?.fotos).toHaveLength(FOTOS_NA_RETROSPECTIVA);
    expect(r?.fotos).not.toContain(null);
  });

  test("soma as reações da janela", () => {
    const r = montar({ posts: [post(1, { reacoes: 5 }), post(3, { reacoes: 2 })] });
    expect(r?.reacoes).toBe(7);
  });

  test("reação negativa (dado estranho) não subtrai", () => {
    expect(montar({ posts: [post(1, { reacoes: -9 })] })?.reacoes).toBe(0);
  });
});

describe("a frase", () => {
  const base: Retrospectiva = {
    fotos: [],
    publicacoes: 0,
    reacoes: 0,
    semanaQueVirou: null,
  };

  test("junta o que aconteceu", () => {
    expect(fraseDaRetrospectiva({ ...base, semanaQueVirou: 29, publicacoes: 2, reacoes: 7 })).toBe(
      "Você entrou na 29ª semana, publicou 2 vezes e recebeu 7 reações.",
    );
  });

  test("singular no lugar certo", () => {
    expect(fraseDaRetrospectiva({ ...base, publicacoes: 1, reacoes: 1 })).toBe(
      "Publicou uma vez e recebeu uma reação.",
    );
  });

  /* ⚠️ "Que semana incrível!" impõe um sentimento a quem talvez tenha passado a
     semana no hospital; "você só publicou uma vez" é cobrança. O cartão narra. */
  test("⚠️ sem superlativo, sem cobrança e sem comparar com outra semana", () => {
    const f = fraseDaRetrospectiva({
      ...base,
      semanaQueVirou: 29,
      publicacoes: 1,
      reacoes: 3,
    }).toLocaleLowerCase("pt-BR");
    for (const proibido of [
      "incrível",
      "só ",
      "apenas",
      "semana passada",
      "melhor",
      "mais que",
      "recorde",
      "parabéns",
    ]) {
      expect(f).not.toContain(proibido);
    }
  });

  test("nunca sai vazia", () => {
    expect(fraseDaRetrospectiva(base).length).toBeGreaterThan(0);
  });
});

describe("a chave do 'já vi'", () => {
  /* Por conta e por DOMINGO: dispensar a de hoje não pode esconder a da semana
     que vem. */
  test("⚠️ muda por conta e por data", () => {
    expect(chaveDaRetrospectiva("a", DOMINGO)).not.toBe(chaveDaRetrospectiva("b", DOMINGO));
    const outroDomingo = new Date("2026-08-30T15:00:00Z");
    expect(chaveDaRetrospectiva("a", DOMINGO)).not.toBe(chaveDaRetrospectiva("a", outroDomingo));
  });
});
