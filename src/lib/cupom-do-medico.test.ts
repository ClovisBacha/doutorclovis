/**
 * O CAMINHO DO DINHEIRO — do código que o médico dá até a fatura do Stripe.
 *
 * ─── POR QUE ESTE ARQUIVO EXISTE ────────────────────────────────────────────
 *
 * `promo.test.ts` prova a CONTA e não prova nada sobre quem a usa. Uma bateria
 * de mutação mediu: desligar o cupom no checkout (`if (false)`), fazer o
 * resgate voltar a dar Premium de graça, e restringir o cupom só ao anual —
 * as três passaram com os 1.285 testes verdes. O dinheiro tem três pontos de
 * decisão e nenhum deles tinha uma linha de teste.
 *
 * É a quarta vez nesta base que a mesma armadilha aparece: o teste prova a
 * função extraída e nunca o CHAMADOR (as outras foram o backfill, o bloco do
 * cérebro e o corte da memória).
 *
 * ─── A MUDANÇA QUE ELE GUARDA (ago/2026) ────────────────────────────────────
 *
 * O médico dava Premium DE GRAÇA para algumas pacientes por mês. Passou a dar
 * 20% de desconto, nos dois planos, enquanto ela for assinante. E a oferta de
 * boas-vindas automática (62% no 1º ano) foi aposentada, porque com o anual a
 * R$ 109,90 ela entregava quase o mesmo que o cupom — manter as duas faria o
 * cupom do médico não valer nada, e empilhá-las levaria a assinatura a
 * R$ 71,92.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { CUPOM_MEDICO_ID, CUPOM_MEDICO_PCT, PRECOS_PREMIUM } from "./promo";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const billing = semComentarios("src/lib/billing.functions.ts");
const invites = semComentarios("src/lib/invites.functions.ts");
const promoFns = semComentarios("src/lib/promo.functions.ts");

describe("1. o resgate do código NÃO dá mais Premium de graça", () => {
  /**
   * O mutante que sobreviveu: reintroduzir
   * `patient_profiles.update({ quiz_premium: true })` no caminho do convite do
   * médico. O médico voltaria a dar a assinatura inteira, de graça, e nada
   * falharia.
   */
  /* A âncora é o RESGATE, não a geração. `invite_codes` aparece quatro vezes
     no arquivo (duas em `generateInviteCode`), e ancorar na primeira olhava
     para o pedaço errado — foi o que fez a primeira versão destes testes
     reprovar sem nada estar quebrado. */
  const doConvite = (() => {
    const i = invites.indexOf("export const redeemInviteCode");
    return invites.slice(i);
  })();

  test("o caminho do convite do médico não escreve `quiz_premium`", () => {
    /* Do ponto em que o cupom de plataforma termina até o fim da função. */
    const i = doConvite.indexOf('.from("invite_codes")');
    expect(i).toBeGreaterThan(-1);
    expect(doConvite.slice(i)).not.toContain("quiz_premium: true");
  });

  test("mas o cupom de PLATAFORMA continua concedendo — é outra coisa", () => {
    /* O simétrico. Os cupons do super-admin (`platform_coupons`) são a
       alavanca promocional do dono e continuam dando Premium de graça. Um
       teste que apagasse os dois passaria no de cima e destruiria isso. */
    const i = invites.indexOf('.from("platform_coupons")');
    const j = invites.indexOf('.from("invite_codes")', i);
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
    expect(invites.slice(i, j)).toContain("quiz_premium: true");
  });

  test("o resgate continua marcando `redeemed_by` — é ELE o cupom", () => {
    /* Nada é concedido no resgate: a marca de resgate É o direito ao desconto.
       Se esta linha sumir, a paciente resgata e não ganha nada. */
    expect(doConvite).toContain("redeemed_by: u.user.id");
  });
});

describe("2. o servidor lê o cupom a partir do resgate", () => {
  test("`lerPrecos` procura o convite resgatado por ela", () => {
    expect(promoFns).toContain('.from("invite_codes")');
    expect(promoFns).toContain('.eq("redeemed_by", uid)');
  });

  test("quem já é Premium não recebe oferta nenhuma", () => {
    /* Mostrar desconto a quem já assinou é o que faz a paciente achar que
       pagou caro. */
    const i = promoFns.indexOf("export async function lerPrecos");
    const corpo = promoFns.slice(i, i + 900);
    expect(corpo).toContain("quiz_premium");
    expect(corpo).toContain("return SEM_CUPOM");
  });

  test("sem cupom, os preços FINAIS são os cheios", () => {
    /* A asserção que impede o defeito silencioso: um `SEM_CUPOM` com os preços
       descontados daria 20% a todo mundo, e ninguém notaria — os números
       continuariam plausíveis. */
    const i = promoFns.indexOf("const SEM_CUPOM");
    const bloco = promoFns.slice(i, i + 300);
    expect(bloco).toContain("mensalFinalCentavos: MENSAL_CENTAVOS");
    expect(bloco).toContain("anualFinalCentavos: ANUAL_CENTAVOS");
  });

  test("falha de banco tira o desconto, nunca dá", () => {
    /* Errar para o lado de não descontar é chato; errar para o outro é dar 20%
       a quem não tem. */
    const i = promoFns.indexOf("catch (e)");
    expect(promoFns.slice(i, i + 200)).toContain("return SEM_CUPOM");
  });
});

describe("3. o checkout aplica o cupom — nos DOIS planos", () => {
  /**
   * Os dois mutantes que sobreviveram aqui: `if (false)` na condição, e
   * restringir a `data.plan === "annual"`. O segundo é o mais traiçoeiro,
   * porque era o comportamento da oferta ANTIGA e parece razoável — mas o
   * cupom do médico é `duration: forever`, então o motivo que justificava
   * limitar ao anual (um mês barato seguido de onze cheios) não existe aqui.
   */
  /* A âncora é o bloco do CUPOM, e `quiz_premium` aparece três vezes antes
     dele no arquivo. Ancorar na primeira olhava para a lista de produtos. */
  const bloco = (() => {
    const i = billing.indexOf('!discountCoupon && data.product === "quiz_premium"');
    return billing.slice(i, i + 800);
  })();

  test("a condição é o cupom dela, e não um literal", () => {
    expect(bloco).toContain("precos.temCupom");
    expect(bloco).not.toContain("if (false)");
  });

  test("e NÃO é restrito ao anual", () => {
    /* A asserção que descreve o defeito. */
    const i = billing.indexOf('!discountCoupon && data.product === "quiz_premium"');
    expect(i).toBeGreaterThan(-1);
    const condicao = billing.slice(i, billing.indexOf(")", i));
    expect(condicao).not.toContain('data.plan === "annual"');
  });

  test("usa o cupom de PORCENTAGEM, com o id e a % de `promo.ts`", () => {
    /* Porcentagem só é segura porque as duas contas fecham exatas em centavos
       — ver `promo.test.ts`. E o id/pct vêm da fonte única: escrever "20" aqui
       criaria uma segunda régua. */
    expect(bloco).toContain("ensurePercentCoupon(CUPOM_MEDICO_ID, CUPOM_MEDICO_PCT)");
  });

  test("falhar não bloqueia o checkout — segue sem desconto", () => {
    expect(bloco).toContain("catch");
  });

  test("o cupom de convite-de-paciente continua com prioridade", () => {
    /* São produtos diferentes (`doctor_plan` × `quiz_premium`) e nunca
       colidem, mas a guarda `!discountCoupon` é o que garante isso. */
    expect(billing).toContain('!discountCoupon && data.product === "quiz_premium"');
  });
});

describe("4. a oferta de boas-vindas não voltou por nenhuma porta", () => {
  test("nenhum vestígio no checkout", () => {
    /* Se ela reaparecer junto com o cupom, a assinatura vai a R$ 71,92 — 30%
       do que uma paciente de doze meses no mensal vale. */
    expect(billing).not.toContain("lerOferta");
    expect(billing).not.toContain("ensureAmountCoupon");
  });

  test("nem no servidor de preços", () => {
    expect(promoFns).not.toContain("ativa:");
    expect(promoFns).not.toContain("PROMO_CENTAVOS");
  });
});

describe("5. os valores que a paciente vê batem com os que o Stripe cobra", () => {
  /* O fecho: a tela promete estes números e o Stripe aplica `CUPOM_MEDICO_PCT`
     sobre o Price. As duas contas têm de dar no mesmo lugar. */
  test("mensal com cupom", () => {
    expect(Math.round((1990 * (100 - CUPOM_MEDICO_PCT)) / 100)).toBe(PRECOS_PREMIUM.mensalComCupom);
  });

  test("anual com cupom", () => {
    expect(Math.round((10990 * (100 - CUPOM_MEDICO_PCT)) / 100)).toBe(PRECOS_PREMIUM.anualComCupom);
  });

  test("o id do cupom é estável enquanto a % não mudar", () => {
    expect(CUPOM_MEDICO_ID).toBe(`medico-${CUPOM_MEDICO_PCT}pct`);
  });
});
