import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { IAP_ATIVO } from "./canal-de-venda";

/**
 * ⚠️ O DOCUMENTO QUE DESTRAVA A RECEITA DA PACIENTE ESTAVA MENTINDO.
 *
 * `docs/plano-iap.md` é o que o dono lê para decidir se investe no IAP — e a
 * tabela de estado dele afirmava "Capacitor instalado: **Não** — nem `ios/`,
 * nem `android/`, nem `@capacitor/*` no `package.json`". Os três existem, e há
 * um workflow de CI compilando os dois projetos.
 *
 * Documento que estima para baixo o que já está pronto adia uma decisão de
 * receita — é a mesma classe do comentário do `QuizPaywall` que inventava um
 * canal de PIX inexistente, e a terceira vez que prosa desatualizada engana
 * alguém aqui.
 *
 * Este teste amarra o documento aos FATOS do repositório, para ele não
 * envelhecer de novo em silêncio.
 */
const DOC = readFileSync("docs/plano-iap.md", "utf8");
const PKG = JSON.parse(readFileSync("package.json", "utf8"));
const DEPS: Record<string, string> = { ...PKG.dependencies, ...PKG.devDependencies };

describe("o plano do IAP diz a verdade sobre o repositório", () => {
  test("⚠️ o Capacitor está instalado, e o documento não diz o contrário", () => {
    expect(typeof DEPS["@capacitor/core"]).toBe("string");
    expect(typeof DEPS["@capacitor/ios"]).toBe("string");
    expect(typeof DEPS["@capacitor/android"]).toBe("string");
    /* A frase antiga, exatamente como estava, não pode voltar. */
    expect(DOC).not.toContain("Capacitor instalado        | **Não**");
    expect(DOC).toContain("**instalado**");
  });

  /**
   * ⚠️ **Se um plugin de compra for instalado, o documento tem de parar de
   * dizer que falta.** É o item que decide se o trabalho restante é "uma
   * semana" ou "um mês", e ele muda no dia em que alguém rodar um `bun add`.
   */
  test("⚠️ o estado do plugin de compra acompanha o package.json", () => {
    const temPluginDeCompra = Object.keys(DEPS).some((k) =>
      /purchase|revenuecat|billing|storekit/i.test(k),
    );
    if (temPluginDeCompra) {
      expect(DOC).not.toContain("**Plugin de COMPRA**           | ⚠️ **não instalado**");
    } else {
      expect(DOC).toContain("não instalado");
    }
  });

  /** Idem para a validação de recibo — a parte inegociável. */
  test("⚠️ o estado da validação de recibo acompanha o código", () => {
    const fontes = ["src/lib", "src/routes/api"];
    const temValidacao = fontes.some((d) => {
      try {
        return readdirSync(d).some((n) => /recibo|receipt|iap/i.test(n) && !n.includes(".test."));
      } catch {
        return false;
      }
    });
    if (!temValidacao) expect(DOC).toContain("**não existe**");
  });

  /**
   * ⚠️ **`IAP_ATIVO` é a ÚLTIMA coisa a virar, não a primeira.** Com os
   * produtos ausentes nas lojas, ligá-la troca "a compra ainda não está aberta"
   * por um erro de loja no meio do checkout — pior, porque a paciente já
   * decidiu pagar.
   */
  test("⚠️ enquanto o IAP estiver desligado, o documento diz que está", () => {
    if (!IAP_ATIVO) expect(DOC).toContain("`IAP_ATIVO`");
  });
});
