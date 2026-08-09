/**
 * A CONTA SAI DA FITA DE ABAS.
 *
 * ─── O DEFEITO ──────────────────────────────────────────────────────────────
 *
 * Tudo que o médico precisa para administrar a própria conta — foto, dados,
 * plano, consumo do ciclo, cartão de cobrança — já existia e estava correto.
 * Morava numa aba chamada "Meu Perfil": a DÉCIMA QUINTA de uma fita rolável de
 * uma linha só. Trocar o cartão exigia rolar a fita horizontalmente até o fim,
 * numa tela onde a nona aba já aparece cortada.
 *
 * Nada aqui é tela nova. É a mesma seção, alcançável do canto superior direito
 * — onde as pessoas procuram conta desde sempre.
 *
 * ─── O QUE ESTE ARQUIVO GUARDA ──────────────────────────────────────────────
 *
 * Duas armadilhas, e a segunda é a que quase passou:
 *
 * 1. Tirar "Meu Perfil" da lista de abas não pode tirar a TELA do ar. A lista
 *    é a fonte dos BOTÕES; o `if (tab === "Meu Perfil")` continua renderizando.
 *    Se alguém apagar o bloco junto, o menu passa a levar a lugar nenhum.
 *
 * 2. Várias idas ao perfil são PROGRAMÁTICAS — assinatura inativa manda o
 *    médico direto para lá. Sem botão na fita, ele aterrissava numa tela com a
 *    fita inteira apagada, sem nada indicando onde estava. A bolinha virou o
 *    indicador dessa tela, e é isso que `ativo` faz.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { FORA_DA_FITA, abasNaFita } from "./abas-do-painel";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const painel = semComentarios("src/routes/_authenticated/painel.tsx");
const menu = semComentarios("src/components/perfil-no-topo.tsx");

describe("1. a aba saiu da fita, a tela ficou", () => {
  test("«Meu Perfil» não é mais um botão da fita", () => {
    /**
     * A fonte dos botões mudou de lugar: era `DOCTOR_TABS`, dentro de
     * `painel.tsx`; agora é `GRUPOS`, em `abas-do-painel.ts`, com as quinze
     * abas agrupadas em cinco. A garantia é a mesma, então a asserção
     * pergunta à fonte nova em vez de raspar o arquivo.
     */
    expect(abasNaFita()).not.toContain("Meu Perfil");
    expect(FORA_DA_FITA).toContain("Meu Perfil");
    /* E a fita continua sendo montada a partir dela — se alguém desenhar uma
       lista literal no JSX, esta asserção deixa de significar algo. */
    expect(painel).toContain("<AbasDoPainel");
  });

  test("mas a TELA continua renderizando", () => {
    /**
     * É o erro natural de quem "limpa" a lista depois: apagar o bloco junto,
     * achando que virou código morto. Não virou — é o destino do menu.
     *
     * Cobrar só a string `tab === "Meu Perfil"` não servia: ela aparece também
     * em `ativo={tab === "Meu Perfil"}`, então trocar a condição do render por
     * `false` deixava o teste verde — mutante sobreviveu assim. O que vale é a
     * CONDIÇÃO DO RENDER.
     */
    expect(painel).toContain('{tab === "Meu Perfil" && (');
  });

  test("e o menu leva até ela", () => {
    expect(painel).toContain('onAbrirPerfil={() => setTab("Meu Perfil")}');
  });
});

describe("2. a bolinha é o indicador de posição da tela que saiu da fita", () => {
  test("o painel diz à bolinha quando o perfil está aberto", () => {
    expect(painel).toContain('ativo={tab === "Meu Perfil"}');
  });

  test("e a bolinha muda de aparência com isso", () => {
    /* Sem isto, `ativo` seria uma prop que ninguém olha — e o médico mandado
       para o perfil por assinatura inativa não teria nenhuma pista de onde
       está. */
    /* `toContain("ativo ?")` era satisfeito pelo próprio `aria-current` — a
       aparência podia parar de mudar e o teste continuava verde. Cobra-se o
       estilo que de fato marca a posição. */
    expect(menu).toContain('ativo ? "border-primary ring-2 ring-primary/25"');
    expect(menu).toContain('aria-current={ativo ? "page" : undefined}');
  });
});

describe("3. o caminho da cobrança sobrevive à troca de aba", () => {
  test("a rolagem até a âncora espera o próximo quadro", () => {
    /**
     * `setTab` só vale no render seguinte. Chamar `getElementById("cobranca")`
     * na mesma volta procura um nó que ainda não existe: o clique não faz
     * nada, e nada falha alto — o pior tipo de defeito de tela.
     */
    const i = painel.indexOf("onAbrirCobranca");
    expect(i).toBeGreaterThan(-1);
    const bloco = painel.slice(i, i + 500);
    expect(bloco).toContain("requestAnimationFrame");
    expect(bloco).toContain('getElementById("cobranca")');
  });

  test("e a âncora existe do outro lado", () => {
    expect(painel).toContain('id="cobranca"');
  });
});

describe("4. o que a bolinha mostra sem ser clicada", () => {
  test("o plano, porque é o que muda o que ele pode fazer", () => {
    /**
     * A única forma de descobrir o plano antes era esbarrar num limite.
     *
     * "Sem ser clicada" é a parte que importa, então a asserção é recortada ao
     * GATILHO. O texto aparece duas vezes — no botão e dentro do menu aberto —
     * e cobrar o arquivo inteiro deixava o plano sumir do botão sem ninguém
     * notar, que é justamente o caso que este teste diz cobrir.
     */
    const gatilho = menu.slice(
      menu.indexOf("<DropdownMenuTrigger"),
      menu.indexOf("</DropdownMenuTrigger>"),
    );
    expect(gatilho).toContain("plano {rotuloPlano}");
  });

  test("e um ponto de aviso quando a conta pede atenção", () => {
    expect(menu).toContain("{aviso &&");
    expect(painel).toContain("aviso={avisoDaConta}");
  });

  test("conta inativa é o aviso — é quando o painel inteiro parece quebrado", () => {
    /**
     * Com a conta inativa as listas vêm vazias, porque as pacientes não acham
     * o médico na busca. Ele conclui que o produto quebrou. O aviso já
     * existia, dentro da aba — exatamente onde ele não olha enquanto acha que
     * o problema é outro.
     */
    expect(painel).toContain("const avisoDaConta = inativo");
  });

  test("sem foto, iniciais — nunca um círculo vazio", () => {
    expect(menu).toContain("iniciais");
  });
});

describe("5. o texto do aviso não aponta mais para uma aba que não existe", () => {
  test("manda para o menu do perfil, não para «abaixo»", () => {
    /* A frase dizia "Ative a assinatura em Meu Perfil, abaixo" — e depois
       desta mudança não há nada abaixo com esse nome. Instrução que aponta
       para o lugar errado é pior que nenhuma: ele procura, não acha, e conclui
       que a tela está quebrada. */
    expect(painel).not.toContain("Ative a assinatura em Meu Perfil, abaixo");
    expect(painel).toContain("no canto superior direito");
  });
});
