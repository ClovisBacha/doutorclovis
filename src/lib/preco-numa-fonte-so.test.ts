/**
 * O PREÇO DA PACIENTE MORA EM UM LUGAR SÓ.
 *
 * ─── O QUE UMA AUDITORIA MEDIU ──────────────────────────────────────────────
 *
 * O anual passou de R$ 118,80 para R$ 109,90. `promo.ts` foi atualizado. E
 * CINCO outros lugares ficaram com a tabela antiga:
 *
 *  · `baby-journey.tsx` — o pop-up do Premium, renderizado em `minha-conta`,
 *    anunciava "de R$ 19,90 por R$ 9,90/mês, no plano anual (R$ 118,80/ano)".
 *    Três números escritos à mão, os três errados;
 *  · `chat.ts` — o system prompt mandava a IA informar "primeiro ano com
 *    desconto: R$ 89,90 (equivale a R$ 7,49/mês)", uma oferta APOSENTADA. A IA
 *    cotava, com a marca do médico, um preço que a plataforma não cobra;
 *  · `platform-admin.server.ts` — o MRR contava R$ 9,90/mês por assinante
 *    anual em vez de R$ 9,16. Oito por cento a mais no número que o fundador
 *    usa para saber como o negócio vai;
 *  · `gestacao-path.tsx` — três constantes de preço mortas, com a tabela
 *    antiga, esperando que alguém as usasse achando que eram a fonte;
 *  · `docs/plano-iap.md` — mandava cadastrar R$ 118,80 na App Store e na Play.
 *
 * ─── POR QUE O `chat.ts` É O PIOR DELES ─────────────────────────────────────
 *
 * Uma tela errada alguém relê antes de publicar. Uma frase gerada na hora,
 * dentro de uma conversa, com a autoridade de quem cuida dela, não passa por
 * revisão nenhuma — e a paciente não tem como desconfiar.
 *
 * ─── O QUE ESTE ARQUIVO COBRA ───────────────────────────────────────────────
 *
 * Que nenhum desses lugares volte a escrever preço à mão. Não é elegância: é a
 * única forma de a próxima mudança de preço não deixar cinco mentiras no ar.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  ANUAL_CENTAVOS,
  ANUAL_MENSAL_EQUIV_CENTAVOS,
  DESCONTO_ANUAL_PCT,
  MENSAL_CENTAVOS,
  REFERENCIA_CENTAVOS,
} from "./promo";
import { patientPremiumMonthlyCents } from "./platform-admin.server";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/** Os preços que já estiveram no ar e não valem mais. */
const MORTOS = [
  "118,80",
  "118.80",
  "89,90",
  "7,49",
  "9,90/mês",
  "R$ 9,90",
  /* Um botão dizia "Assinar anual — 50% OFF" oito linhas abaixo do mesmo cartão
     que imprimia `{DESCONTO_ANUAL_PCT}%` = 53%. Dois números para o mesmo
     desconto, na mesma tela — e o menor deles é o que a pessoa acredita. */
  "50% OFF",
];

describe("1. as telas do Premium não escrevem preço à mão", () => {
  const telas = {
    "o pop-up da Jornada": "src/components/baby-journey.tsx",
    "a folha de oferta": "src/components/oferta-premium.tsx",
    "o paywall das aulas": "src/components/gestacao-path.tsx",
  };

  for (const [onde, caminho] of Object.entries(telas)) {
    test(`${onde} não carrega preço antigo`, () => {
      const codigo = semComentarios(caminho);
      for (const morto of MORTOS) {
        expect(codigo).not.toContain(morto);
      }
    });
  }

  test("o pop-up da Jornada lê os quatro números da fonte", () => {
    /* Era ele o pior caso das telas: três literais, os três errados, numa
       tela que está no ar e que a paciente vê ao tocar num item bloqueado. */
    const codigo = semComentarios("src/components/baby-journey.tsx");
    for (const nome of [
      "ANUAL_CENTAVOS",
      "ANUAL_MENSAL_EQUIV_CENTAVOS",
      "DESCONTO_ANUAL_PCT",
      "REFERENCIA_CENTAVOS",
      "MENSAL_CENTAVOS",
    ]) {
      expect(codigo).toContain(nome);
    }
  });

  test("e o riscado tem legenda dizendo o que ele é", () => {
    /* Riscar um número que ninguém cobra é o "preço de referência" que o CDC
       proíbe. R$ 238,80 é real: é o que ela paga em doze meses no mensal. */
    const fonte = readFileSync("src/components/baby-journey.tsx", "utf8");
    expect(fonte).toContain("mês a mês");
    expect(REFERENCIA_CENTAVOS).toBe(MENSAL_CENTAVOS * 12);
  });
});

describe("2. a IA não cota preço que a plataforma não cobra", () => {
  const chat = semComentarios("src/routes/api/chat.ts");

  test("a oferta de boas-vindas sumiu do system prompt", () => {
    /* A asserção que descreve o defeito: o prompt mandava informar R$ 89,90 no
       primeiro ano, uma oferta aposentada. */
    for (const morto of ["89,90", "7,49", "Primeiro ano com desconto"]) {
      expect(chat).not.toContain(morto);
    }
  });

  test("e os preços do prompt vêm de `promo.ts`", () => {
    expect(chat).toContain('from "@/lib/promo"');
    expect(chat).toContain("${brl(MENSAL_CENTAVOS)}");
    expect(chat).toContain("${brl(ANUAL_CENTAVOS)}");
  });

  test("o prompt continua proibindo a IA de inventar valores", () => {
    /* A trava que já existia, e que este bloco não pode ter derrubado. */
    expect(chat).toContain("nunca invente outros");
  });
});

describe("3. o MRR conta o preço certo", () => {
  test("assinante anual entra pelo equivalente mensal real", () => {
    /* Eram R$ 9,90 contra os R$ 9,16 verdadeiros: 8% a mais, todo mês, no
       número que o fundador usa para decidir. */
    expect(patientPremiumMonthlyCents("annual")).toBe(ANUAL_MENSAL_EQUIV_CENTAVOS);
    expect(patientPremiumMonthlyCents("annual")).toBe(916);
  });

  test("assinante mensal entra pelo mensal", () => {
    expect(patientPremiumMonthlyCents("monthly")).toBe(MENSAL_CENTAVOS);
    expect(patientPremiumMonthlyCents(null)).toBe(MENSAL_CENTAVOS);
  });

  test("e o servidor não tem mais a própria tabela", () => {
    const codigo = semComentarios("src/lib/platform-admin.server.ts");
    expect(codigo).not.toContain("990 : 1990");
    expect(codigo).toContain('from "./promo"');
  });
});

describe("4. as constantes de preço mortas saíram", () => {
  test("o paywall das aulas não declara preço próprio", () => {
    /* Constante de preço morta é a pior espécie de código morto: parece
       autoridade, e alguém a usa achando que é a fonte. */
    const codigo = semComentarios("src/components/gestacao-path.tsx");
    for (const morta of [
      "QUIZ_PRICE_MONTHLY",
      "QUIZ_PRICE_ANNUAL_MONTH",
      "QUIZ_PRICE_ANNUAL_TOTAL",
    ]) {
      expect(codigo).not.toContain(morta);
    }
  });
});

describe("5. o documento do IAP manda cadastrar o preço vigente", () => {
  const doc = readFileSync("docs/plano-iap.md", "utf8");

  test("o anual é R$ 109,90, não R$ 118,80", () => {
    /* Este documento vira digitação humana no painel da Apple e da Google. Um
       número errado aqui não dá erro em lugar nenhum: vira cobrança errada. */
    expect(doc).toContain("R$ 109,90/ano");
    expect(doc).not.toContain("R$ 118,80/ano");
  });

  test("e bate com `promo.ts`", () => {
    expect(ANUAL_CENTAVOS).toBe(10_990);
    expect(doc).toContain(`R$ ${(ANUAL_CENTAVOS / 100).toFixed(2).replace(".", ",")}/ano`);
  });

  test("o mensal também", () => {
    expect(doc).toContain(`R$ ${(MENSAL_CENTAVOS / 100).toFixed(2).replace(".", ",")}/mês`);
  });
});

describe("6. a conta que a tela mostra fecha", () => {
  test("o desconto anunciado é o que a fatura entrega, ou menos", () => {
    const real = (1 - ANUAL_CENTAVOS / REFERENCIA_CENTAVOS) * 100;
    expect(DESCONTO_ANUAL_PCT).toBeLessThanOrEqual(real);
    expect(DESCONTO_ANUAL_PCT).toBe(53);
  });

  test("e o equivalente mensal é comparação, não preço", () => {
    /* ×12 dá R$ 109,92, dois centavos ACIMA do cobrado — por isso a tela diz
       "equivale a" e nunca "12×". */
    expect(ANUAL_MENSAL_EQUIV_CENTAVOS * 12).toBeGreaterThan(ANUAL_CENTAVOS);
  });
});
