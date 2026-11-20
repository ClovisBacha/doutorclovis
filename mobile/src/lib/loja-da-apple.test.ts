import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";
import { letraPequena, type ProdutoDaLoja } from "~/lib/assinatura/precos";

/**
 * A CATRACA DA LOJA DA APPLE (diretrizes 3.1.1, 3.1.2, 2.3.1 e 5.6).
 *
 * Até 20/11/2026 o app não vendia nada, e esta catraca recusava toda palavra
 * de venda. Agora o plano completo é vendido PELA APPLE (StoreKit, ver
 * `lib/assinatura/`), e a catraca mudou junto — sem se afrouxar:
 *
 * - as palavras de venda só moram na tela do plano (`app/assinatura.tsx`) e
 *   nos componentes dela (`componentes/assinatura/`);
 * - preço escrito à mão ("R$ 9…") continua proibido em TODAS as telas,
 *   inclusive na do plano: o preço vem só do StoreKit;
 * - Stripe, porta de compra no site e a loja paga de sementinhas continuam
 *   proibidos em toda parte;
 * - a tela do plano tem "Restaurar compras", Termos, Privacidade e a letra
 *   pequena (renovação automática e como cancelar), e não tem número de
 *   usuárias, nota, avaliações nem contagem regressiva.
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

const ler = (f: string) => semComentarios(readFileSync(f, "utf8"));

/** A tela do plano: o único lugar onde se vende. */
function ehDaVenda(f: string): boolean {
  const r = relative(RAIZ, f);
  return (
    r === join("app", "assinatura.tsx") || r.startsWith(join("componentes", "assinatura") + sep)
  );
}

/** Proibidos em toda tela, inclusive na do plano. */
const PROIBIDOS_EM_TODA_PARTE: { re: RegExp; por: string }[] = [
  { re: /\bPremium\b/, por: "o app vende o plano completo, e não um Premium" },
  { re: /R\$\s?\d/, por: "preço escrito à mão: o preço vem só do StoreKit" },
  { re: /\bStripe\b/i, por: "pagamento fora da Apple" },
  { re: /Loja de Sementinhas|pacotes? de [Ss]ementinhas/, por: "a loja paga de sementinhas" },
  {
    re: /obstetrica\.com\.br\/(premium|assinar|assinatura|planos|loja|checkout)/i,
    por: "porta de compra no site",
  },
];

/** Proibidos fora da tela do plano. */
const PROIBIDOS_FORA_DA_VENDA: { re: RegExp; por: string }[] = [
  { re: /\bAssin(e|ar|atura)\b/, por: "a assinatura só é oferecida na tela do plano" },
  { re: /from "expo-iap"/, por: "o StoreKit só é chamado por lib/assinatura/loja.ts" },
];

describe("as telas do app não vendem nada fora da Apple (3.1.1)", () => {
  const todos = PASTAS.flatMap((p) => arquivos(join(RAIZ, p)));

  test("há telas para conferir, e a tela do plano está entre elas", () => {
    expect(todos.length).toBeGreaterThan(40);
    expect(todos.filter(ehDaVenda).length).toBeGreaterThanOrEqual(3);
  });

  for (const { re, por } of PROIBIDOS_EM_TODA_PARTE) {
    test(`nenhuma tela tem ${re} — ${por}`, () => {
      const achados = todos.filter((f) => re.test(ler(f)));
      expect(achados.map((f) => relative(RAIZ, f))).toEqual([]);
    });
  }

  for (const { re, por } of PROIBIDOS_FORA_DA_VENDA) {
    test(`fora da tela do plano, nenhuma tem ${re} — ${por}`, () => {
      const achados = todos.filter((f) => !ehDaVenda(f) && re.test(ler(f)));
      expect(achados.map((f) => relative(RAIZ, f))).toEqual([]);
    });
  }

  test("só o invólucro da loja importa o expo-iap", () => {
    const lib = arquivos(join(RAIZ, "lib")).filter((f) =>
      /from "expo-iap"|import\("expo-iap"\)/.test(ler(f)),
    );
    expect(lib.map((f) => relative(RAIZ, f))).toEqual([join("lib", "assinatura", "loja.ts")]);
  });
});

describe("a tela do plano é honesta (3.1.2, 2.3.1, 5.6 e o CDC)", () => {
  const venda = PASTAS.flatMap((p) => arquivos(join(RAIZ, p))).filter(ehDaVenda);
  const tudo = venda.map(ler).join("\n");

  test("tem Restaurar compras, Gerenciar assinatura, Termos e Privacidade", () => {
    expect(tudo).toContain("Restaurar compras");
    expect(tudo).toContain("Gerenciar assinatura");
    expect(tudo).toContain('"/termos"');
    expect(tudo).toContain('"/privacidade"');
  });

  test("a letra pequena do plano escolhido aparece antes do botão", () => {
    const tela = ler(join(RAIZ, "componentes", "assinatura", "tela.tsx"));
    const letra = tela.indexOf("{letraPequena(produto)}");
    const botao = tela.indexOf("textoDoBotao(escolhido)");
    expect(letra).toBeGreaterThan(-1);
    expect(botao).toBeGreaterThan(letra);
  });

  test("a letra pequena diz o preço, a renovação automática e como cancelar", () => {
    const base = { id: "x", preco: 1, moeda: "BRL", oferta: null };
    const anual: ProdutoDaLoja = { ...base, plano: "anual", precoTexto: "<preço>" };
    const mensal: ProdutoDaLoja = { ...base, plano: "mensal", precoTexto: "<preço>" };
    const vitalicio: ProdutoDaLoja = { ...base, plano: "vitalicio", precoTexto: "<preço>" };
    for (const p of [anual, mensal]) {
      const t = letraPequena(p);
      expect(t).toContain("<preço>");
      expect(t).toMatch(/Renovação (anual|mensal) automática/);
      expect(t).toContain("Cancele quando quiser");
    }
    expect(letraPequena(vitalicio)).toContain("Pagamento único, sem renovação");
  });

  test("sem prova social inventada nem pressa falsa", () => {
    const PROIBIDO = [
      /\d[\d.]*\s*(mães|mamães|usuárias|gestantes|pessoas|avaliações|downloads)/i,
      /junte-se a/i,
      /★|⭐|estrelas na App Store|nota \d/i,
      /depoimento/i,
      /só hoje|somente hoje|acaba hoje|últimas horas|últimas vagas|oferta por tempo|contagem regressiva|expira em/i,
    ];
    for (const re of PROIBIDO)
      expect({ re: String(re), achou: re.test(tudo) }).toEqual({ re: String(re), achou: false });
  });
});
