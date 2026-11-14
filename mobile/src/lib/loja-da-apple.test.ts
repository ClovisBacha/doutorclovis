import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";

/**
 * A CATRACA DA LOJA DA APPLE (diretriz 3.1.1).
 *
 * O app v1 não vende nada: sem compra dentro do app, sem Premium, e sem porta
 * para pagar fora da Apple — o que reprova na revisão. Hoje as telas estão
 * limpas (conferido em 15/10/2026, na revisão para a loja); esta catraca é
 * para continuarem assim. Ela lê o fonte de TODAS as telas e componentes,
 * sem os comentários, e recusa as palavras de venda.
 *
 * ⚠️ Quando a compra pela Apple existir (IAP), esta catraca muda junto — não
 * se contorna: o produto vendido tem de passar pela Apple.
 */

const RAIZ = join(import.meta.dir, "..");
const PASTAS = ["app", "componentes"];

function arquivos(dir: string): string[] {
  const fora: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fora.push(...arquivos(p));
    else if (/\.(tsx|ts)$/.test(nome) && !nome.endsWith(".test.ts")) fora.push(p);
  }
  return fora;
}

const PROIBIDOS: { re: RegExp; por: string }[] = [
  { re: /\bPremium\b/, por: "o app v1 não vende o Premium" },
  { re: /R\$\s?\d/, por: "preço em reais é venda fora da Apple" },
  { re: /\bStripe\b/i, por: "pagamento fora da Apple" },
  { re: /\bAssin(e|ar|atura)\b/, por: "assinatura que o app não vende" },
  { re: /Loja de Sementinhas|pacotes? de [Ss]ementinhas/, por: "a loja paga de sementinhas" },
  {
    re: /obstetrica\.com\.br\/(premium|assinar|assinatura|planos|loja|checkout)/i,
    por: "porta de compra no site",
  },
];

describe("as telas do app não vendem nada fora da Apple (3.1.1)", () => {
  const todos = PASTAS.flatMap((p) => arquivos(join(RAIZ, p)));

  test("há telas para conferir", () => {
    expect(todos.length).toBeGreaterThan(40);
  });

  for (const { re, por } of PROIBIDOS) {
    test(`nenhuma tela tem ${re} — ${por}`, () => {
      const achados = todos.filter((f) => re.test(semComentarios(readFileSync(f, "utf8"))));
      expect(achados.map((f) => relative(RAIZ, f))).toEqual([]);
    });
  }
});
