/**
 * AS DUAS LOJAS DO APP DA PACIENTE, e por que elas não podem se encostar.
 *
 * ─── O QUE ESTÁ EM JOGO ─────────────────────────────────────────────────────
 *
 * O app vende duas coisas com naturezas opostas:
 *
 *  · o **Cantinho** vende ENFEITE por Sementinhas — moeda que ela ganha
 *    cuidando de si, e que não custa dinheiro nenhum;
 *  · a **Loja** vende suplemento, conforto e enxoval por DINHEIRO de verdade.
 *
 * Elas viviam lado a lado, como duas pílulas da mesma fita dentro de
 * "Recompensas". Nessa vizinhança elas leem como duas prateleiras da mesma
 * coisa — e é assim que uma paciente toca em "Loja" achando que vai gastar o
 * que juntou e encontra um carrinho de compras.
 *
 * Pedido do dono (ago/2026), sem meio-termo: "a loja não é pra estar ali de
 * maneira alguma; ela já está lá no perfil. A única aba que vai estar ali vai
 * ser a de conquistas e a própria aba onde compra os jogos".
 *
 * ⚠️ Mas ela NÃO foi apagada — o caminho pelo menu da conta é o "está no
 * perfil" do pedido. Este arquivo cobra as duas metades ao mesmo tempo: fora da
 * fita, e viva pelo menu. Uma sem a outra é ou o defeito de volta, ou uma loja
 * inteira desaparecida do app.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const conta = semComentarios("src/routes/_authenticated/minha-conta.tsx");
const menu = semComentarios("src/components/menu-conta.tsx");

/** O bloco literal da fita de pílulas de Recompensas. */
const fita = (() => {
  const i = conta.indexOf("const RECOMPENSAS_SUBTABS");
  return conta.slice(i, conta.indexOf("] as const;", i));
})();

describe("a Loja de produtos saiu da fita das Recompensas", () => {
  test("a fita tem DUAS pílulas: o Cantinho e as Conquistas", () => {
    /* As palavras do dono: "a única aba que vai estar ali vai ser a de
       conquistas e a própria aba onde compra os jogos". */
    const chaves = [...fita.matchAll(/key: "([a-z]+)"/g)].map((m) => m[1]);
    expect(chaves).toEqual(["cantinho", "conquistas"]);
  });

  test("⚠️ e «loja» não é uma delas", () => {
    /* O teste acima já cobre isso, e este existe assim mesmo: é a afirmação
       que a próxima pessoa a mexer aqui vai ler no relatório de falha, e
       "esperava 2, veio 3" não conta a ela POR QUE três está errado. */
    expect(fita).not.toContain('key: "loja"');
  });
});

describe("⚠️ mas a Loja continua alcançável — ela mudou de porta", () => {
  test("o menu da conta entra direto nela", () => {
    /* `MenuDaConta` é o "perfil" do pedido. Sem esta linha, a loja de produtos
       simplesmente não existiria mais no app da paciente — e tirar da fita
       viraria apagar, que é outra decisão. */
    expect(menu).toContain('subAba: "loja"');
    expect(menu).toContain('tab: "Recompensas"');
  });

  test("e o hub AINDA sabe desenhá-la", () => {
    /* O bloco de render tem de sobreviver à saída da fita. Sem ele, a linha do
       menu abriria uma tela em branco. */
    expect(conta).toContain("<LojaTab gest={gest} />");
  });

  test("⚠️ o tipo aceita «loja» mesmo ela estando fora da lista", () => {
    /**
     * Esta é a linha que faz a coisa toda funcionar, e é a que some primeiro
     * numa limpeza distraída.
     *
     * `SubRec` era derivado só de `RECOMPENSAS_SUBTABS`. Tirando "loja" da
     * lista sem acrescentá-la ao tipo, `eSub("loja")` passaria a devolver
     * `false` e o `initialSub` do menu cairia no Cantinho **em silêncio**: a
     * linha "Loja · Suplementos, conforto e enxoval" abriria o jardim de
     * enfeites, sem erro nenhum para investigar.
     */
    const i = conta.indexOf("type SubRec");
    const corpo = conta.slice(i, i + 300);
    expect(corpo).toContain('| "loja"');
    expect(corpo).toContain('v === "loja"');
  });

  test("a fita some quando a Loja está aberta", () => {
    /* Duas pílulas e NENHUMA acesa é como uma tela quebrada se parece. E a
       fita é justamente o que o dono mandou tirar de perto da loja de
       produtos: quem chega aqui veio do menu e sai por ele. */
    expect(conta).toContain('const naLoja = sub === "loja";');
    expect(conta).toContain("{!naLoja && (");
  });
});

describe("as duas lojas não se confundem no texto", () => {
  test("a linha do menu fala de produto físico, não de Sementinha", () => {
    /* "Suplementos, conforto e enxoval" é o que impede a paciente de tocar ali
       esperando gastar o que juntou. */
    const i = menu.indexOf('subAba: "loja"');
    const bloco = menu.slice(i - 200, i + 300);
    expect(bloco).toContain("enxoval");
    expect(bloco).not.toContain("Sementinha");
    expect(bloco).not.toContain("🌱");
  });
});
