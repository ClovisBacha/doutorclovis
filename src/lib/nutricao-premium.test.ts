import { describe, expect, test } from "bun:test";
import {
  AMOSTRA_SEMANAL,
  JANELA_DA_AMOSTRA_DIAS,
  LIMITE_DIARIO,
  decidirAcesso,
  recadoDaAmostra,
  recadoDoBloqueio,
  type EntradaDoAcesso,
} from "@/lib/nutricao-premium";

const base: EntradaDoAcesso = {
  premium: true,
  careMode: false,
  usadasHoje: 0,
  usadasNaSemana: 0,
};

describe("o teto diário não tem exceção", () => {
  /* ⚠️ ESTE É O TESTE QUE PROTEGE A MARGEM. Medido em `custo-da-nutricao`:
     sem teto, 30 perguntas por dia levam a margem a NEGATIVO no preço de
     lançamento. As três isenções abaixo dispensam o Premium, nunca o teto. */
  test("a assinante para no teto", () => {
    const a = decidirAcesso({ ...base, usadasHoje: LIMITE_DIARIO });
    expect(a.pode).toBe(false);
    expect(a.motivo).toBe("teto_diario");
  });

  test("o Modo Cuidado também para no teto", () => {
    const a = decidirAcesso({
      ...base,
      premium: false,
      careMode: true,
      usadasHoje: LIMITE_DIARIO,
    });
    expect(a.pode).toBe(false);
    expect(a.motivo).toBe("teto_diario");
  });

  test("o perfil ilegível também para no teto", () => {
    const a = decidirAcesso({ ...base, premium: null, usadasHoje: LIMITE_DIARIO });
    expect(a.pode).toBe(false);
    expect(a.motivo).toBe("teto_diario");
  });

  test("quem não assina para no teto antes de gastar a amostra", () => {
    /* Cinto e suspensório: mesmo que a contagem da semana venha zerada por um
       defeito, o teto do dia continua fechando a porta. */
    const a = decidirAcesso({
      ...base,
      premium: false,
      usadasHoje: LIMITE_DIARIO,
      usadasNaSemana: 0,
    });
    expect(a.pode).toBe(false);
    expect(a.motivo).toBe("teto_diario");
  });

  test("uma abaixo do teto ainda passa, e diz quantas sobram", () => {
    const a = decidirAcesso({ ...base, usadasHoje: LIMITE_DIARIO - 1 });
    expect(a.pode).toBe(true);
    expect(a.restantesHoje).toBe(1);
  });
});

describe("o Premium é o que abre a porta", () => {
  test("assinante entra", () => {
    const a = decidirAcesso(base);
    expect(a.pode).toBe(true);
    expect(a.amostra).toBe(false);
  });

  test("quem não assina gasta a amostra da semana", () => {
    const a = decidirAcesso({ ...base, premium: false, usadasNaSemana: 1 });
    expect(a.pode).toBe(true);
    expect(a.amostra).toBe(true);
    expect(a.restantesNaAmostra).toBe(AMOSTRA_SEMANAL - 1);
  });

  test("gastada a amostra, aparece o Premium — nunca o teto do dia", () => {
    const a = decidirAcesso({ ...base, premium: false, usadasNaSemana: AMOSTRA_SEMANAL });
    expect(a.pode).toBe(false);
    expect(a.motivo).toBe("sem_premium");
  });

  test("AMOSTRA_SEMANAL = 0 tranca de vez, sem mudar mais nada", () => {
    /* A linha que o dono muda se quiser Premium estrito. A régua já trata:
       com zero, a PRIMEIRA pergunta de quem não assina cai no paywall. */
    const semAmostra = (usadasNaSemana: number) =>
      usadasNaSemana >= 0 ? decidirAcesso({ ...base, premium: false, usadasNaSemana }) : null;
    /* Com a constante em 3, uma pergunta na semana ainda passa — é o estado de
       hoje. O teste do zero é a prova de que a régua não precisa de código
       novo: basta `usadasNaSemana >= AMOSTRA_SEMANAL`. */
    expect(semAmostra(0)!.pode).toBe(AMOSTRA_SEMANAL > 0);
    expect(semAmostra(AMOSTRA_SEMANAL)!.pode).toBe(false);
  });
});

describe("as duas isenções, e por que existem", () => {
  test("Modo Cuidado nunca vê convite de assinatura", () => {
    const a = decidirAcesso({ ...base, premium: false, careMode: true, usadasNaSemana: 99 });
    expect(a.pode).toBe(true);
    expect(a.motivo).toBe(null);
    /* E não gasta amostra: a tela não vai contar sobras para quem está de
       luto. */
    expect(a.amostra).toBe(false);
  });

  test("não saber se ela assina LIBERA, e não bloqueia", () => {
    /* ⚠️ A direção segura aqui é a oposta à do luto. "Não consegui ler" com
       cara de "não há nada" é o defeito que este repositório fechou em seis
       telas; aqui ele seria "não consegui ler" com cara de "você não pagou",
       para uma assinante que pagou. */
    const a = decidirAcesso({ ...base, premium: null, usadasNaSemana: 99 });
    expect(a.pode).toBe(true);
    expect(a.motivo).toBe(null);
  });

  test("contagem ilegível não fecha a porta nem inventa um número", () => {
    const a = decidirAcesso({ ...base, usadasHoje: null, usadasNaSemana: null });
    expect(a.pode).toBe(true);
    expect(a.restantesHoje).toBe(null);
  });
});

describe("os recados", () => {
  const PROIBIDAS = [
    "você não",
    "você já usou tudo",
    "acabou o seu",
    "esgotou",
    "não pode",
    "infelizmente",
    "você deveria",
  ];

  test("nenhum recado cobra ou culpa", () => {
    for (const motivo of ["teto_diario", "sem_premium"] as const) {
      const { titulo, texto } = recadoDoBloqueio(motivo);
      const tudo = `${titulo} ${texto}`.toLowerCase();
      for (const p of PROIBIDAS) expect(tudo).not.toContain(p);
    }
  });

  test("o recado do teto promete a volta, e o do Premium diz o que ele dá", () => {
    expect(recadoDoBloqueio("teto_diario").texto).toContain("Amanhã");
    expect(recadoDoBloqueio("teto_diario").texto).toContain(String(LIMITE_DIARIO));
    expect(recadoDoBloqueio("sem_premium").texto).toContain(String(AMOSTRA_SEMANAL));
  });
});

describe("os números são os que a margem sustenta", () => {
  test("a janela da amostra é semanal", () => {
    expect(JANELA_DA_AMOSTRA_DIAS).toBe(7);
  });

  test("o teto diário é positivo e folgado", () => {
    /* Abaixo de 5 o teto vira incômodo no uso normal (planejar a semana são
       cinco ou seis perguntas de uma vez); acima de 15 a margem no preço de
       lançamento deixa de fechar — ver `custo-da-nutricao.test.ts`. */
    expect(LIMITE_DIARIO).toBeGreaterThanOrEqual(5);
    expect(LIMITE_DIARIO).toBeLessThanOrEqual(15);
  });
});

/* ─── O AVISO DA AMOSTRA ────────────────────────────────────────────────────
   Ele existe porque a régua acima declara, no tipo `Acesso`, que "sem o aviso
   a paciente descobre a parede batendo nela". */

test("o aviso conta quantas sobram, e o singular não sai errado", () => {
  expect(recadoDaAmostra(2)).toContain("2");
  expect(recadoDaAmostra(1)).toContain("Resta 1");
  expect(recadoDaAmostra(1)).not.toContain("perguntas");
});

test("⚠️ contagem ilegível NÃO inventa número — ela CALA", () => {
  /* `usoDaNutricionista` falha aberta de propósito. Dizer "resta 1" para quem
     tem três encurtaria a amostra por causa de uma falha de rede. */
  expect(recadoDaAmostra(null)).toBeNull();
});

test("a última pergunta avisa que foi a última", () => {
  const t = recadoDaAmostra(0);
  expect(t).toBeTruthy();
  expect(t).toContain("última");
});

test("⚠️ o aviso da amostra não COBRA e não promete", () => {
  const proibidas = [
    "você já usou",
    "não perca",
    "acabou",
    "esgotou",
    "aproveite",
    "corra",
    "última chance",
  ];
  for (const n of [0, 1, 2, 3]) {
    const t = (recadoDaAmostra(n) ?? "").toLowerCase();
    for (const p of proibidas) expect(t).not.toContain(p);
  }
});

test("⚠️ o recado do Premium não OFERECE o que já acabou", () => {
  /* A foto da bancada pegou: o texto dizia "você TEM 3 perguntas por semana"
     numa tela que só existe porque as três já foram usadas — presente do
     indicativo lido como oferta, na hora exata em que a porta fechou. Ele diz
     o FATO (o tamanho da amostra) e QUANDO ela volta. */
  const t = recadoDoBloqueio("sem_premium").texto.toLowerCase();
  /* ⚠️ E a asserção é sobre a AFIRMAÇÃO, nunca sobre a palavra: um
     `not.toContain("você tem")` cru reprova "com o que você tem em casa", que
     é a frase que descreve a ferramenta. Armadilha de substring cometida na
     primeira escrita deste próprio teste. */
  expect(t).not.toMatch(/você tem \d+ pergunta/);
  expect(t).toContain("volta");
});
