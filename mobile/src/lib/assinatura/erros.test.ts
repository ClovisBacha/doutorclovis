import { describe, expect, test } from "bun:test";
import {
  codigoDoErro,
  estaEsperandoAprovacao,
  FRASE_ESPERANDO_APROVACAO,
  FRASE_NADA_A_RESTAURAR,
  foiCancelado,
  fraseDoErro,
} from "~/lib/assinatura/erros";

/* Os códigos do OpenIAP (`ErrorCode` do expo-iap 6.4.3). */
const CODIGOS = [
  "activity-unavailable",
  "already-owned",
  "billing-unavailable",
  "connection-closed",
  "deferred-payment",
  "developer-error",
  "duplicate-purchase",
  "feature-not-supported",
  "iap-not-available",
  "init-connection",
  "item-unavailable",
  "network-error",
  "not-prepared",
  "pending",
  "purchase-error",
  "purchase-verification-failed",
  "query-product",
  "remote-error",
  "service-error",
  "service-timeout",
  "sku-not-found",
  "sync-error",
  "transaction-validation-failed",
  "unknown",
  "user-error",
];

describe("os erros da Apple viram frase calma", () => {
  test("cancelar a compra não é erro: nenhuma frase", () => {
    expect(foiCancelado("user-cancelled")).toBe(true);
    expect(fraseDoErro("user-cancelled")).toBeNull();
  });

  test("todo código vira uma frase em português, sem código nem número", () => {
    for (const c of [...CODIGOS, null, "um-codigo-novo"]) {
      const f = fraseDoErro(c);
      expect(typeof f).toBe("string");
      expect({ c, f, temCodigo: /[a-z]+-[a-z]+|E_|\d/.test(f!) }).toEqual({
        c,
        f,
        temCodigo: false,
      });
      expect(f!.endsWith(".")).toBe(true);
    }
  });

  test("sem internet diz para conferir a conexão", () => {
    expect(fraseDoErro("network-error")).toMatch(/internet/);
  });

  test("o 'Pedir para Comprar' é espera, não erro", () => {
    expect(estaEsperandoAprovacao("deferred-payment")).toBe(true);
    expect(estaEsperandoAprovacao("pending")).toBe(true);
    expect(estaEsperandoAprovacao("network-error")).toBe(false);
    expect(FRASE_ESPERANDO_APROVACAO).toMatch(/libera sozinho/);
    expect(FRASE_NADA_A_RESTAURAR).toMatch(/Não encontramos/);
  });

  test("o código sai do erro do expo-iap (e do formato antigo E_…)", () => {
    expect(codigoDoErro({ code: "user-cancelled" })).toBe("user-cancelled");
    expect(codigoDoErro({ code: "E_USER_CANCELLED" })).toBe("user-cancelled");
    expect(codigoDoErro(new Error("x"))).toBeNull();
    expect(codigoDoErro(null)).toBeNull();
  });
});
