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
 * ─── ⚠️ A PRIMEIRA VERSÃO ESCONDEU EM VEZ DE MUDAR DE LUGAR ─────────────────
 *
 * Ela virou uma sub-aba INVISÍVEL de "Recompensas": fora da fita, mas ainda
 * dentro do hub, alcançada por `initialSub="loja"` vindo do menu. Uma auditoria
 * mediu dois defeitos que essa forma trouxe:
 *
 *  1. **o computador ficou sem porta.** `MenuDaConta` vive dentro de um
 *     `md:hidden` — a pílula ERA a única entrada do desktop;
 *  2. **a sub-aba grudava.** A fita de abas do desktop chamava `setTab` direto,
 *     que não limpa `consultasSub`: toda visita a "Recompensas" reabria a Loja,
 *     e com a fita escondida o Cantinho ficava inalcançável por ali.
 *
 * E a corrente do menu até a tela tinha TRÊS elos no meio (repassar a sub-aba,
 * gravá-la, aceitá-la) que nenhum teste cobria — mutar qualquer um deles
 * passava verde.
 *
 * Hoje a Loja é um DESTINO PRÓPRIO (`tab: "Loja"`, ao lado do Perfil). Sem elo
 * nenhum para quebrar, sem tipo costurado à mão, e com porta nos dois tamanhos
 * de tela.
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
const shell = semComentarios("src/components/app-mobile-shell.tsx");

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

  test("⚠️ e o hub NÃO desenha a loja de produtos por dentro", () => {
    /* Não basta sumir da fita: enquanto o `<LojaTab>` estiver dentro do
       `RecompensasHub`, uma sub-aba escondida pode ressuscitá-lo — que foi
       exatamente a primeira versão desta mudança. */
    const i = conta.indexOf("function RecompensasHub");
    const hub = conta.slice(i, conta.indexOf("\nfunction ", i + 10));
    expect(hub).not.toContain("LojaTab");
    expect(hub).not.toContain('"loja"');
  });
});

describe("⚠️ e virou destino próprio — com porta nos DOIS tamanhos de tela", () => {
  test("«Loja» é uma aba de verdade", () => {
    const i = conta.indexOf("const TABS = [");
    const lista = conta.slice(i, conta.indexOf("] as const;", i));
    expect(lista).toContain('"Loja"');
    /* E o tipo compartilhado com a casca do app precisa conhecê-la, senão o
       item do menu não compila. */
    expect(shell).toContain('| "Loja"');
  });

  test("e o hub da conta a desenha", () => {
    /* ⚠️ Casa por `<LojaTab` e pelas props em separado, nunca pela linha
       inteira: a primeira versão cravava `"<LojaTab gest={gest} />"` e quebrou
       no dia em que a tela ganhou `careMode` — teste que cobra a assinatura
       exata reprova quem melhora o componente. */
    /* ⚠️ Sem o `&& (` no meio: o Prettier decide sozinho se a linha cabe
       inteira ou quebra em parênteses, e cravar a forma faz o teste reprovar
       numa formatação. Terceira vez que esta armadilha aparece hoje. */
    const i = conta.indexOf('tab === "Loja"');
    expect(i).toBeGreaterThan(-1);
    expect(conta.slice(i, i + 200)).toContain("<LojaTab");
  });

  test("⚠️ PORTA DO CELULAR: o menu ☰ aponta direto para ela", () => {
    /* `MenuDaConta` é o "está no perfil" do pedido. E sem `subAba`: um destino
       próprio não depende de nenhum elo intermediário. */
    const i = menu.indexOf('tab: "Loja"');
    expect(i).toBeGreaterThan(-1);
    const bloco = menu.slice(i, i + 220);
    expect(bloco).not.toContain("subAba");
  });

  test("⚠️ PORTA DO COMPUTADOR: a categoria «Conta» a lista", () => {
    /**
     * Este é o teste que a primeira versão não tinha, e o defeito que ela
     * escondeu: `MenuDaConta` inteiro vive dentro de um `md:hidden`, então
     * tirar a pílula da fita deixou a loja SEM NENHUMA porta no desktop —
     * alcançável só digitando `?sub=loja` na barra de endereço.
     */
    const i = conta.indexOf('label: "Conta"');
    const bloco = conta.slice(i, i + 260);
    expect(bloco).toContain('"Loja"');
  });

  test("⚠️ a fita do desktop navega por `goToTab`, nunca por `setTab` cru", () => {
    /**
     * `goToTab` limpa `consultasSub` (a sub-aba pedida por quem navegou até
     * aqui); `setTab` não. Com `setTab`, uma sub-aba aberta uma vez por deep
     * link reabria a cada visita àquele hub pelo desktop, para sempre — medido.
     * Vale para todos os hubs, não só para este.
     */
    /* ⚠️ Ancorado no CÓDIGO, não no comentário: `semComentarios` apaga os
       comentários de JSX, e a primeira versão deste teste procurou por
       "Desktop: linha de abas da categoria ativa" — um comentário que já não
       existia no texto lido, devolvendo fatia vazia. */
    const i = conta.indexOf("CATEGORIES.find((c) => c.label === categoryOfTab(tab))?.tabs.map");
    expect(i).toBeGreaterThan(-1);
    const bloco = conta.slice(i, i + 700);
    expect(bloco).toContain("goToTab(t)");
    expect(bloco).not.toContain("setTab(t)");
  });
});

describe("⚠️ a Loja de produtos cala no Modo Cuidado", () => {
  /**
   * ELA ERA A QUINTA TELA SEM O PORTÃO, e ninguém tinha reparado.
   *
   * O comentário de `SilencioDoCuidado` lista quatro telas que mostravam bebê
   * a quem tinha acabado de perder a gestação, e diz "a loja mostrava Berço com
   * preço" — mas aquela "loja" é o CANTINHO (`objeto-berco`, enfeite por
   * Sementinhas). Esta, que vende Kit Enxoval Recém-nascido, Banheirinha para
   * Bebê, Sutiã e Almofada de Amamentação, nunca recebeu `careMode`.
   *
   * Os suplementos ainda fariam sentido depois de uma perda (ferro para
   * anemia). Não é motivo para deixar a tela de pé: é uma lista de afiliados,
   * não é cuidado — não se perde clínica nenhuma calando-a.
   */
  test("o catálogo tem produtos de recém-nascido", () => {
    /* Se um dia a curadoria mudar e não houver mais nada de bebê aqui, este
       teste avisa que o portão abaixo talvez não seja mais necessário — em vez
       de o portão virar código morto sem ninguém saber. */
    expect(conta).toContain("Kit Enxoval Recém-nascido");
    expect(conta).toContain("Amamentação");
  });

  test("e a tela recebe e OBEDECE o careMode", () => {
    /* ⚠️ O corpo vai até a PRÓXIMA declaração de função, não até o primeiro
       `return (`: o `useEffect` de rolagem devolve `return () => …`, que casa
       com "return (" e cortava a função quase no começo — a primeira versão
       deste teste reprovou por isso, olhando um trecho onde o portão nem
       poderia estar. */
    const i = conta.indexOf("function LojaTab");
    const corpo = conta.slice(i, conta.indexOf("\nfunction ", i + 10));
    expect(corpo).toContain("careMode: boolean");
    expect(corpo).toContain("if (careMode) return <SilencioDoCuidado");
  });

  test("⚠️ o portão fica DEPOIS dos hooks", () => {
    /* Um `return` antes de `useState`/`useEffect` muda a ordem de chamada
       entre renders e o React quebra — é por isso que as outras quatro telas
       também põem a linha lá embaixo. */
    const i = conta.indexOf("function LojaTab");
    const portao = conta.indexOf("if (careMode) return <SilencioDoCuidado", i);
    const ultimoHook = conta.lastIndexOf("useEffect(", portao);
    expect(ultimoHook).toBeGreaterThan(i);
    expect(portao).toBeGreaterThan(ultimoHook);
  });

  test("e quem a desenha PASSA o careMode", () => {
    /* A prop existir e ninguém passá-la é o mesmo que não existir. */
    const i = conta.indexOf('tab === "Loja"');
    expect(i).toBeGreaterThan(-1);
    expect(conta.slice(i, i + 200)).toContain("careMode={careMode}");
  });
});

describe("as duas lojas não se confundem no texto", () => {
  test("a linha do menu fala de produto físico, não de Sementinha", () => {
    /* "Suplementos, conforto e enxoval" é o que impede a paciente de tocar ali
       esperando gastar o que juntou. */
    const i = menu.indexOf('tab: "Loja"');
    const bloco = menu.slice(i, i + 260);
    expect(bloco).toContain("enxoval");
    expect(bloco).not.toContain("Sementinha");
    expect(bloco).not.toContain("🌱");
  });
});
