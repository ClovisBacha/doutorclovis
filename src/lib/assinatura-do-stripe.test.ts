/**
 * A ASSINATURA DO WEBHOOK DE PAGAMENTO — exercitada.
 *
 * ─── POR QUE ISTO NÃO EXISTIA E DEVIA ───────────────────────────────────────
 *
 * `verifyStripeSignature` é a única coisa entre um POST anônimo e a concessão
 * de plano: sem ela, qualquer pessoa manda `{"type":"checkout.session.completed"}`
 * para `/api/stripe-webhook` e ganha o plano mais caro de graça — ou revoga o
 * de outro médico.
 *
 * Ela não tinha um teste. Uma varredura mediu: trocar o corpo inteiro por
 * `return true` deixava a suíte com 1.000 testes verdes. A defesa mais crítica
 * de dinheiro do produto era a única sem prova.
 *
 * A função é PURA (só `node:crypto`), então dá para exercitá-la de verdade —
 * assinando payloads e conferindo cada caminho de recusa.
 */

import { describe, expect, test } from "bun:test";
import crypto from "node:crypto";
import { verifyStripeSignature } from "./stripe.server";

const SEGREDO = "whsec_um_segredo_de_teste";
const CORPO = JSON.stringify({
  type: "checkout.session.completed",
  data: { object: { id: "cs_1" } },
});

/** Monta um header no formato do Stripe: `t=<epoch>,v1=<hmac>`. */
function assinar(corpo: string, segredo: string, quandoMs = Date.now()): string {
  const t = Math.floor(quandoMs / 1000);
  const v1 = crypto.createHmac("sha256", segredo).update(`${t}.${corpo}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

describe("o caminho feliz", () => {
  test("assinatura correta passa", () => {
    expect(verifyStripeSignature(CORPO, assinar(CORPO, SEGREDO), SEGREDO)).toBe(true);
  });

  test("ordem dos campos no header não importa", () => {
    /* O Stripe não garante ordem, e um parser posicional quebraria em produção
       sem quebrar em teste. */
    const h = assinar(CORPO, SEGREDO);
    const [t, v1] = h.split(",");
    expect(verifyStripeSignature(CORPO, `${v1},${t}`, SEGREDO)).toBe(true);
  });

  test("campos extras (v0, etc.) não atrapalham", () => {
    const h = assinar(CORPO, SEGREDO);
    expect(verifyStripeSignature(CORPO, `${h},v0=deadbeef`, SEGREDO)).toBe(true);
  });
});

describe("o que precisa ser RECUSADO", () => {
  test("segredo errado", () => {
    /* O caso real: alguém descobre a URL do webhook e forja um evento. */
    expect(verifyStripeSignature(CORPO, assinar(CORPO, "whsec_outro"), SEGREDO)).toBe(false);
  });

  test("corpo adulterado depois de assinado", () => {
    /* Trocar o `client_reference_id` de um evento legítimo capturado daria o
       plano para outra conta. */
    const h = assinar(CORPO, SEGREDO);
    expect(verifyStripeSignature(CORPO.replace("cs_1", "cs_999"), h, SEGREDO)).toBe(false);
  });

  test("header ausente", () => {
    expect(verifyStripeSignature(CORPO, null, SEGREDO)).toBe(false);
  });

  test("header sem v1", () => {
    expect(verifyStripeSignature(CORPO, `t=${Math.floor(Date.now() / 1000)}`, SEGREDO)).toBe(false);
  });

  test("header sem t", () => {
    expect(verifyStripeSignature(CORPO, "v1=deadbeef", SEGREDO)).toBe(false);
  });

  test("header vazio", () => {
    expect(verifyStripeSignature(CORPO, "", SEGREDO)).toBe(false);
  });

  test("segredo vazio — configuração faltando NÃO libera", () => {
    /* Um `STRIPE_WEBHOOK_SECRET` esquecido no ambiente não pode virar "aceita
       tudo": seria a porta aberta pelo caminho mais provável de todos. */
    expect(verifyStripeSignature(CORPO, assinar(CORPO, SEGREDO), "")).toBe(false);
  });

  test("assinatura de OUTRO corpo", () => {
    const h = assinar('{"type":"outra.coisa"}', SEGREDO);
    expect(verifyStripeSignature(CORPO, h, SEGREDO)).toBe(false);
  });
});

describe("a janela anti-replay", () => {
  test("evento de 6 minutos atrás é recusado", () => {
    /* Sem a janela, um webhook válido capturado uma vez pode ser reenviado
       para sempre — e cada reenvio de `invoice.paid` credita comissão de
       afiliado de novo. */
    const h = assinar(CORPO, SEGREDO, Date.now() - 6 * 60 * 1000);
    expect(verifyStripeSignature(CORPO, h, SEGREDO)).toBe(false);
  });

  test("evento de 4 minutos atrás ainda passa", () => {
    /* A tolerância existe porque relógios divergem e a rede atrasa; apertá-la
       demais recusaria webhooks legítimos e o médico não receberia o plano. */
    const h = assinar(CORPO, SEGREDO, Date.now() - 4 * 60 * 1000);
    expect(verifyStripeSignature(CORPO, h, SEGREDO)).toBe(true);
  });

  test("evento com data no FUTURO também é recusado", () => {
    /* `Math.abs` na comparação: um `t` adiantado seria uma forma de driblar a
       janela se ela olhasse só para o passado. */
    const h = assinar(CORPO, SEGREDO, Date.now() + 6 * 60 * 1000);
    expect(verifyStripeSignature(CORPO, h, SEGREDO)).toBe(false);
  });

  test("timestamp não numérico é recusado", () => {
    const v1 = crypto.createHmac("sha256", SEGREDO).update(`abc.${CORPO}`).digest("hex");
    expect(verifyStripeSignature(CORPO, `t=abc,v1=${v1}`, SEGREDO)).toBe(false);
  });
});

describe("comparação em tempo constante", () => {
  test("assinatura de comprimento diferente não estoura", () => {
    /* `timingSafeEqual` LANÇA quando os buffers têm tamanhos diferentes — e uma
       exceção aqui viraria 500, não 400. O código confere o tamanho antes. */
    expect(() =>
      verifyStripeSignature(CORPO, `t=${Math.floor(Date.now() / 1000)},v1=ab`, SEGREDO),
    ).not.toThrow();
    expect(verifyStripeSignature(CORPO, `t=${Math.floor(Date.now() / 1000)},v1=ab`, SEGREDO)).toBe(
      false,
    );
  });
});
