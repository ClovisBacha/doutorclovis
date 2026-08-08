/**
 * A LOJA NÃO PODE DIZER DUAS COISAS OPOSTAS SOBRE O MESMO ITEM.
 *
 * ─── O DEFEITO ──────────────────────────────────────────────────────────────
 *
 * `const locked = i.premium && !premium` — sem `has`.
 *
 * Vinte itens que eram grátis viraram Premium quando a loja foi recalibrada
 * (para a paciente típica zerar os quinze grátis por volta do 15º dia). Quem já
 * os tinha comprado passou a ver, no MESMO tile: o emoji cinza, um selo
 * "🔒 Premium" no canto, e o botão embaixo dizendo "No cantinho ✓".
 *
 * ─── POR QUE ISSO É PIOR QUE FEIO ───────────────────────────────────────────
 *
 * Compra é definitiva. O cadeado é sobre o que ela ainda PODE comprar, nunca
 * sobre o que já é dela. Um item comprado que aparece bloqueado ensina que a
 * plataforma pode tirar de volta o que ela pagou — e isso não se conserta com
 * um pedido de desculpas depois.
 *
 * ─── POR QUE UM TESTE DE LÓGICA, E NÃO DE PIXEL ─────────────────────────────
 *
 * A regra é uma expressão booleana de três variáveis, e o defeito era um termo
 * ausente. Reproduzir a expressão e varrer as OITO combinações pega qualquer
 * termo que sumir de novo, sem precisar renderizar nada.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { CANTINHO_ITEMS } from "./cantinho";

const fonte = readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8");
const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

/** A MESMA expressão da tela, reproduzida para poder ser varrida. */
const estaBloqueado = (item: { premium: boolean }, temPremium: boolean, jaComprou: boolean) =>
  item.premium && !temPremium && !jaComprou;

describe("1. o que ela já comprou nunca aparece bloqueado", () => {
  test("item premium que ela possui, sem assinatura → livre", () => {
    /* O caso exato dos vinte itens que mudaram de prateleira. */
    expect(estaBloqueado({ premium: true }, false, true)).toBe(false);
  });

  test("a varredura das oito combinações", () => {
    /* Só UMA delas bloqueia: item premium, sem assinatura, não comprado. */
    const bloqueiam: string[] = [];
    for (const premium of [true, false]) {
      for (const temPremium of [true, false]) {
        for (const jaComprou of [true, false]) {
          if (estaBloqueado({ premium }, temPremium, jaComprou)) {
            bloqueiam.push(`premium=${premium} assina=${temPremium} comprou=${jaComprou}`);
          }
        }
      }
    }
    expect(bloqueiam).toEqual(["premium=true assina=false comprou=false"]);
  });

  test("e comprar não depende de assinar — a moeda é que compra", () => {
    /* O desenho inteiro depende disto: a assinatura abre a PRATELEIRA, o item
       continua se pagando com Sementinhas. Se possuir exigisse assinar, o
       Premium viraria "compre tudo" e a economia da loja perderia o sentido. */
    expect(estaBloqueado({ premium: true }, true, false)).toBe(false);
  });
});

describe("2. a tela usa essa expressão, e não uma parecida", () => {
  test("`has` está na condição", () => {
    /* A asserção que descreve o defeito: era `i.premium && !premium`. */
    expect(codigo).toContain("const locked = i.premium && !premium && !has;");
  });

  test("o cinza e o cadeado saem os DOIS de `locked`", () => {
    /* Se um deles passasse a olhar `i.premium` cru, metade do defeito voltava
       — e voltaria só para quem comprou, que é quem menos olha. */
    expect(codigo).toContain('locked || trophyLocked ? "opacity-40 grayscale" : ""');
    expect(codigo).toContain('{locked ? "🔒 Premium" : "Premium"}');
  });
});

describe("3. a loja continua com o formato que a economia pressupõe", () => {
  /**
   * `economia-sementinhas.ts` calibra a caminhada contra o número de itens
   * grátis e o custo deles. Se alguém mover itens de prateleira sem refazer a
   * conta, a parede dos quinze dias muda de lugar em silêncio.
   */
  const gratis = CANTINHO_ITEMS.filter((i) => !i.premium && i.price > 0);
  const premium = CANTINHO_ITEMS.filter((i) => i.premium);

  test("quinze itens grátis compráveis", () => {
    expect(gratis).toHaveLength(15);
  });

  test("e a prateleira premium é muito maior — é ela a vitrine", () => {
    /* A parede só empurra se, do outro lado dela, houver muito o que olhar. */
    expect(premium.length).toBeGreaterThan(gratis.length * 3);
  });

  test("nenhum item grátis custa mais que o troféu da loja grátis", () => {
    const maisCaro = Math.max(...gratis.map((i) => i.price));
    expect(maisCaro).toBe(200);
  });
});
