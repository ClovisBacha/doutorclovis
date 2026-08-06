/**
 * A RESPOSTA APARECE SENDO ESCRITA.
 *
 * O streaming já entregava a resposta em pedaços, mas cada pedaço virava um
 * `setState` imediato — e o modelo manda blocos grandes. O resultado era o
 * oposto de uma conversa: nada, nada, parágrafo inteiro de uma vez.
 *
 * O conserto separa CHEGADA de EXIBIÇÃO. O que chega vai para `alvoRef`; o que
 * aparece avança sozinho, quadro a quadro, até alcançar.
 *
 * O risco desta mudança é ela ficar LENTA: se o texto continuar aparecendo
 * depois de já ter chegado, troca-se um defeito por outro — e o segundo é
 * pior, porque é tempo que a paciente perde sem ganhar nada. Por isso o passo
 * é adaptativo e há teste para os dois extremos.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const tela = readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8");
const codigo = tela.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

/** O mesmo passo que a tela usa. Copiado de propósito: é a regra sob teste. */
function passoDe(atraso: number): number {
  return Math.min(12, Math.max(2, Math.ceil(atraso / 45)));
}

describe("o ritmo da digitação", () => {
  test("nunca trava: sempre avança pelo menos 2 caracteres", () => {
    /* Passo zero pararia a resposta pela metade para sempre. */
    for (const atraso of [1, 2, 5, 20, 44]) expect(passoDe(atraso)).toBeGreaterThanOrEqual(2);
  });

  test("acelera quando há texto represado", () => {
    expect(passoDe(600)).toBeGreaterThan(passoDe(60));
  });

  test("tem teto — não vira despejo de bloco", () => {
    /* Sem teto, uma resposta longa apareceria inteira num quadro, que é
       exatamente o defeito que isto conserta. */
    expect(passoDe(100_000)).toBeLessThanOrEqual(12);
  });

  test("a cauda é curta em qualquer tamanho de resposta", () => {
    /* Quadros a 60fps. O que não pode acontecer é a paciente ficar olhando
       texto aparecer depois de a resposta inteira já ter chegado. */
    const segundosPara = (n: number) => {
      let mostrado = 0;
      let quadros = 0;
      while (mostrado < n && quadros < 10_000) {
        mostrado += passoDe(n - mostrado);
        quadros++;
      }
      return quadros / 60;
    };
    expect(segundosPara(120)).toBeLessThan(1.5);
    expect(segundosPara(600)).toBeLessThan(3);
    expect(segundosPara(2000)).toBeLessThan(4);
  });

  test("uma resposta curta não fica lenta", () => {
    expect(passoDe(10)).toBe(2);
  });
});

describe("o laço nunca sobrevive ao que o criou", () => {
  test("é cancelado quando a tela é desmontada", () => {
    /* Sair da conversa no meio da digitação deixaria um laço de quadros vivo
       chamando `setState` num componente que não existe mais. */
    expect(codigo).toContain("cancelAnimationFrame(quadroRef.current)");
    expect(tela).toContain("Sair da tela no meio da digitação");
  });

  test("é cancelado no `finally`, inclusive quando dá erro", () => {
    /* Vivo depois de um erro, ele reescreveria por cima da mensagem de falha —
       a paciente veria a resposta antiga voltando por cima do aviso. */
    /* Ancorado na mensagem de erro do chat: o arquivo tem vários `finally`, e
       o primeiro deles é de outra tela. */
    const posErro = codigo.indexOf('content: "Desculpe, ocorreu um erro. Tente novamente."');
    expect(posErro).toBeGreaterThan(0);
    const bloco = codigo.slice(posErro, posErro + 600);
    expect(bloco).toContain("} finally {");
    expect(bloco).toContain("streamAbertoRef.current = false;");
    expect(bloco).toContain("cancelAnimationFrame(quadroRef.current)");
  });

  test('o "digitando" só sai quando o texto terminou de aparecer', () => {
    /* Sem esta espera, o indicador sumiria com a bolha pela metade — e a
       paciente veria uma resposta truncada parecendo pronta. */
    expect(codigo).toContain("mostradoRef.current >= alvoRef.current.length");
  });
});

describe("quem pede menos movimento recebe o texto inteiro", () => {
  test("respeita `prefers-reduced-motion`", () => {
    /* A animação aqui é conforto, nunca informação: nada se perde ao
       desligá-la, e para quem tem enxaqueca vestibular ela é o oposto de
       conforto. */
    expect(codigo).toContain('window.matchMedia("(prefers-reduced-motion: reduce)").matches');
  });

  test("sem animação, a chegada é a exibição — como era antes", () => {
    expect(codigo).toContain("if (semAnimacao) setMessages(");
    expect(codigo).toContain(
      "if (!semAnimacao) quadroRef.current = requestAnimationFrame(digitar)",
    );
  });
});

describe("o texto final é o texto completo", () => {
  test("a última escrita usa o acumulado inteiro, não o parcial", () => {
    /* Se a bolha terminasse com `alvo.slice(0, mostrado)`, um arredondamento
       do passo poderia comer o último caractere — e ninguém notaria, porque a
       frase continuaria fazendo sentido. */
    const fim = codigo.slice(codigo.indexOf("streamAbertoRef.current = false;"));
    expect(fim).toContain("content: acc }");
  });
});
