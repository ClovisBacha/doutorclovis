/**
 * AS TELAS QUE VENDEM O PLANO E DÃO A MESADA.
 *
 * ─── POR QUE ESTE ARQUIVO EXISTE ────────────────────────────────────────────
 *
 * Duas telas nasceram nesta rodada — o seletor da escada e o cartão da mesada —
 * e as duas substituíram telas que estavam ERRADAS, não ausentes:
 *
 *   · o painel vendia cinco planos nomeados, com teto de PACIENTES, mandando
 *     nomes de plano que o checkout novo não conhece;
 *   · e oferecia convites de Premium, que dão a assinatura inteira de graça e
 *     não funcionam dentro do iOS nem do Android.
 *
 * O risco de uma substituição é sempre o mesmo: a tela nova entra e um pedaço
 * da velha fica. É isso que se cobra aqui.
 *
 * O outro risco é o de sempre nesta base: DUAS TABELAS DE PREÇO. O seletor
 * mostra o preço antes do Stripe existir na conversa, então ele precisa
 * perguntar à mesma função que o checkout usa — nunca multiplicar por conta.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { CLASSES_DE_PRESENTE, CUSTO_LOJA_GRATIS, PRESENTE_SUGERIDO } from "./economia-sementinhas";
import { DEGRAUS_DESTAQUE, TETO_AUTOATENDIMENTO, precoDe } from "./planos-medico";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const seletor = semComentarios("src/components/escada-mensagens.tsx");
const mesada = semComentarios("src/components/mesada-do-medico.tsx");
const painel = semComentarios("src/routes/_authenticated/painel.tsx");
const vendas = semComentarios("src/routes/medicos.tsx");

describe("1. o seletor NÃO tem uma segunda tabela de preços", () => {
  test("pergunta à escada em vez de multiplicar", () => {
    for (const fn of [
      "precoDe(",
      "centavosPorMensagem(",
      "descontoVsEntrada(",
      "gestantesAtendidas(",
    ]) {
      expect(seletor).toContain(fn);
    }
  });

  test("nenhum preço de mensagem escrito à mão", () => {
    /* A asserção que descreve o defeito: um `n * 0.15` aqui é a segunda tabela,
       e é assim que a tela e a fatura divergem. Esta base já viu quatro vezes. */
    expect(seletor).not.toMatch(/\*\s*0[.,]\d{2}\b/);
    expect(seletor).not.toMatch(/\b(?:29[.,]90|174[.,]40|339[.,]40)\b/);
  });

  test("a faixa do slider é a da escada, não literais", () => {
    expect(seletor).toContain("min={ENTRADA_MENSAGENS}");
    expect(seletor).toContain("max={TETO_AUTOATENDIMENTO}");
  });
});

describe("2. o seletor é operável sem mouse", () => {
  /**
   * A barra bonita é desenho; o controle é um `input type=range`. Trocá-lo por
   * divs com `onPointerMove` daria a mesma imagem e tiraria teclado e leitor de
   * tela de quem depende deles — numa tela que decide uma compra.
   */
  test("o controle é um range nativo", () => {
    expect(seletor).toContain('type="range"');
    expect(seletor).toContain("aria-label=");
  });

  test("e anuncia o valor em palavras, não só o número", () => {
    /* Sem `aria-valuetext`, o leitor de tela lê "1000" e a pessoa não sabe se
       são reais ou mensagens — nem quanto vai pagar. */
    expect(seletor).toContain("aria-valuetext=");
  });

  test("respeita quem pediu menos movimento", () => {
    expect(seletor).toContain("useReducedMotion");
    /* E não só no enfeite: o número que rola precisa virar troca instantânea. */
    const i = seletor.indexOf("function NumeroQueRola");
    expect(seletor.slice(i, i + 500)).toContain("if (reduce)");
  });
});

describe("3. o painel deixou de vender o que não existe", () => {
  test("os cinco cartões nomeados saíram", () => {
    /* A asserção que descreve o defeito: eles mandavam `plan: "starter"` etc.,
       e o `priceIdFor` do plano novo não conhece esses nomes. */
    expect(painel).not.toContain("const PlanBtn = (");
    for (const morto of [
      'planKey="starter"',
      'planKey="pro"',
      'planKey="elite"',
      'planKey="black"',
    ]) {
      expect(painel).not.toContain(morto);
    }
  });

  test("e o alternador Mensal/Anual também", () => {
    /* A escada tem um Price MENSAL só. O botão "Anual · 2 meses grátis" mandava
       `..._annual`, o `priceIdFor` devolvia `null` e o médico clicava sem que
       nada acontecesse — um botão que não faz nada é pior que um botão ausente. */
    expect(painel).not.toContain("Anual · 2 meses grátis");
    expect(painel).not.toContain('setCycle("annual")');
  });

  test("o checkout do painel manda MENSAGENS, não nome de plano", () => {
    const i = painel.indexOf("async function checkout(");
    expect(i).toBeGreaterThan(-1);
    const corpo = painel.slice(i, i + 1400);
    expect(corpo).toContain("mensagens");
    expect(corpo).toContain('plan: "mensagens"');
  });

  test("e o seletor é o MESMO componente do site", () => {
    /* Duas telas para a mesma compra é o começo de duas contas para o mesmo
       preço. O tema muda; a conta, não. */
    expect(painel).toContain("EscadaDeMensagens");
    expect(vendas).toContain("EscadaDeMensagens");
    expect(painel).toContain('tema="claro"');
  });
});

describe("4. os cartões da página de vendas saem da escada", () => {
  test("os preços são derivados, não digitados", () => {
    expect(vendas).toContain("monthly: reais(precoDe(");
    expect(vendas).toContain("DEGRAUS_DESTAQUE");
  });

  test("e batem com a escada nos três degraus", () => {
    /* Se um dia alguém digitar um número aqui, é este teste que percebe. */
    const [entrada, meio, topo] = DEGRAUS_DESTAQUE;
    expect(precoDe(entrada)).toBe(2_990);
    expect(precoDe(meio)).toBe(17_440);
    expect(precoDe(topo)).toBe(33_940);
    expect(topo).toBe(TETO_AUTOATENDIMENTO);
  });

  test("cada cartão pago carrega a própria quantidade para o cadastro", () => {
    /* Sem isto os três botões caem no mesmo cadastro sem número, e o degrau
       que a pessoa escolheu se perde entre a vitrine e o checkout. */
    expect(vendas).toContain("/medicos/cadastro?mensagens=");
  });
});

describe("5. a mesada tem tela — e a tela conta a mesma história do servidor", () => {
  /**
   * `getMesada` e `presentearPaciente` estavam escritas, testadas e sem NENHUM
   * chamador. Mesada sem botão é coluna gravada e nunca lida.
   */
  test("o cartão chama as duas funções", () => {
    expect(mesada).toContain("getMesada");
    expect(mesada).toContain("presentearPaciente");
    expect(painel).toContain("<MesadaDoMedico");
  });

  test("o cartão de convites premium SAIU", () => {
    /* Ele dava a assinatura inteira de graça, e não funcionava nos apps. */
    expect(painel).not.toContain("function DoctorInviteCard(");
    expect(painel).not.toContain("<DoctorInviteCard");
  });

  test("cada recusa do servidor tem frase própria na tela", () => {
    /* "Não foi possível" faz o médico tentar de novo contra uma parede que não
       vai ceder — e três dessas recusas são estados normais, não erros. */
    for (const motivo of ["ja_presenteada", "mesada_esgotada", "modo_cuidado", "sem_vinculo"]) {
      expect(mesada).toContain(motivo);
    }
  });

  test("Modo Cuidado aparece como explicação, não como falha", () => {
    expect(mesada).toContain("Modo Cuidado");
  });

  test("o cartão some para quem não tem bolso", () => {
    /* Médico no Free não tem o que dar, e mostrar "0 de 0" só ensina que existe
       algo que ele não pode usar. */
    expect(mesada).toContain("mesada.total <= 0) return null");
  });
});

describe("6. as três classes de presente são calibradas contra a LOJA", () => {
  test("são três, em ordem crescente", () => {
    expect(CLASSES_DE_PRESENTE).toHaveLength(3);
    for (let i = 1; i < CLASSES_DE_PRESENTE.length; i++) {
      expect(CLASSES_DE_PRESENTE[i].quantidade).toBeGreaterThan(
        CLASSES_DE_PRESENTE[i - 1].quantidade,
      );
    }
  });

  test("a menor é o presente sugerido", () => {
    expect(CLASSES_DE_PRESENTE[0].quantidade).toBe(PRESENTE_SUGERIDO);
  });

  test("nenhuma delas paga a loja grátis inteira", () => {
    /**
     * O desenho inteiro depende disto. O presente do médico ACELERA a caminhada
     * até a parede dos quinze dias — o momento em que ela tem moeda sobrando e
     * nada grátis para comprar. Um presente que pagasse a loja toda de uma vez
     * derrubaria a parede em vez de aproximá-la.
     */
    for (const c of CLASSES_DE_PRESENTE) {
      expect(c.quantidade).toBeLessThan(CUSTO_LOJA_GRATIS);
    }
  });

  test("e a maior passa do troféu da loja grátis", () => {
    /* É o que faz o Jardim valer a pena: ela cruza o item mais caro do grátis e
       passa a olhar a prateleira que só o Premium abre. */
    const TROFEU = 200;
    expect(CLASSES_DE_PRESENTE[CLASSES_DE_PRESENTE.length - 1].quantidade).toBeGreaterThan(TROFEU);
  });

  test("toda classe tem nome, emoji e efeito declarado", () => {
    /* Um número solto obriga o médico a adivinhar o que 150 significa contra
       uma loja que ele nunca viu. */
    for (const c of CLASSES_DE_PRESENTE) {
      expect(c.nome.length).toBeGreaterThan(2);
      expect(c.emoji.length).toBeGreaterThan(0);
      expect(c.efeito.length).toBeGreaterThan(10);
    }
  });
});
