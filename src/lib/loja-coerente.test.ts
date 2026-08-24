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
import { readFileSync, readdirSync } from "node:fs";
import { CANTINHO_ITEMS } from "./cantinho";
import { CURVA_GRATIS } from "./economia-sementinhas";

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
       — e voltaria só para quem comprou, que é quem menos olha.

       O cinza ganhou um TERCEIRO motivo (ago/2026): três itens só abrem depois
       de N dias de cinco estrelas. A régua continua a mesma — o tile apagado
       tem de cobrir todos os motivos de não poder comprar, senão sobra um
       estado em que o botão recusa e o desenho diz que está tudo bem. */
    const cinza = codigo.slice(codigo.indexOf("className={`text-4xl ${"));
    const ate = cinza.slice(0, cinza.indexOf("}`}"));
    expect(ate).toContain("locked");
    expect(ate).toContain("trophyLocked");
    expect(ate).toContain("faltamTrof > 0");
    expect(ate).toContain("opacity-40 grayscale");
    expect(codigo).toContain('{locked ? "🔒 Premium" : "Premium"}');
  });

  test("o cadeado de troféu diz quantos faltam, e o botão não some", () => {
    /* "Bloqueado" não dá o que fazer a seguir, e é a frase que faz a paciente
       achar que o item é pago em dinheiro. */
    expect(codigo).toContain("faltam {faltamTrof} 🏆");
    /* E o cinza não pode aparecer para quem JÁ comprou: `has` zera a conta. */
    expect(codigo).toContain("const faltamTrof = has ? 0 : faltamTrofeus(i.id, trofeus);");
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
    /* ⚠️ O valor sai da CURVA, não de um número escrito à mão. Ele estava
       cravado em 200 e virou mentira no dia em que a âncora subiu para 260 —
       a mesma lição de "constante que descreve um arquivo é constante que um
       dia diverge dele". O que o teste quer dizer é que o topo dos grátis é o
       último degrau da curva, e isso continua valendo em qualquer número. */
    const trofeuDosGratis = CURVA_GRATIS[CURVA_GRATIS.length - 1];
    expect(Math.max(...gratis.map((i) => i.price))).toBe(trofeuDosGratis);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   ⚠️ A PROSA QUE CITA PREÇO

   O reajuste de ago/2026 mexeu em 90 itens, e uma auditoria depois encontrou
   TREZE lugares no `src/` afirmando um preço que já não existia — dez deles
   causados pelo próprio reajuste. Alguns eram narrativa histórica (tudo bem),
   mas outros eram o ARGUMENTO de uma decisão: `trofeus.ts` justificava a escada
   de desbloqueio com "Borboleta — 74 🌱 · Fim de tarde — 240 🌱 · Bolinhas —
   400 🌱", e os três viraram 65, 550 e 1.000. A ordem sobreviveu; os números,
   não. Quem lesse aquilo para decidir o próximo degrau decidiria sobre uma
   loja que não existe.

   Nenhuma revisão humana pega isso: a frase está sempre a centenas de linhas
   do valor que descreve, e nada quebra quando ela envelhece.

   Este teste varre o `src/` procurando o padrão «"Nome do Item" … N 🌱» e cobra
   que N seja o preço real. É estreito de propósito — só dispara quando alguém
   escreveu o nome E o preço juntos, que é exatamente a forma que envelhece.
   ══════════════════════════════════════════════════════════════════════════ */
describe("⚠️ nenhum comentário afirma um preço que o catálogo não tem", () => {
  test("as citações «Nome (N 🌱)» batem com o preço real", () => {
    const arquivos = readdirSync("src", { recursive: true, encoding: "utf8" }).filter(
      (p) => p.endsWith(".ts") || p.endsWith(".tsx"),
    );
    const porNome = new Map(CANTINHO_ITEMS.map((i) => [i.name.toLowerCase(), i.price]));
    const erradas: string[] = [];

    for (const rel of arquivos) {
      const texto = readFileSync(`src/${rel}`, "utf8");
      /* «"Chuva mansa" por N 🌱» · «Borboleta — N 🌱» · «(Árvore que cresce,
         N 🌱)». Até 40 caracteres entre o nome e o número: passar disso
         começa a casar frases vizinhas que não têm relação. */
      for (const m of texto.matchAll(
        /["“(]?([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^"”()\n]{2,34})["”)]?[^\n]{0,40}?\b(\d{2,4}) 🌱/g,
      )) {
        const nome = m[1]
          .trim()
          .replace(/[—–,-]\s*$/, "")
          .toLowerCase();
        const preco = porNome.get(nome);
        if (preco === undefined || preco === Number(m[2])) continue;
        erradas.push(`${rel}: "${m[1].trim()}" citado como ${m[2]} 🌱, mas custa ${preco}`);
      }
    }
    expect(erradas).toEqual([]);
  });
});
