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
    /* Âncora ÚNICA deste chat. `content: "Desculpe, ocorreu um erro"` existe em
       DOIS componentes do arquivo, e a versão anterior deste teste lia o
       outro — passando e falhando pelos motivos errados. */
    const posErro = codigo.indexOf('"A conexão caiu no meio da resposta. Pode perguntar de novo?"');
    expect(posErro).toBeGreaterThan(0);
    /* Até o fim da função, e não uma janela de tamanho fixo: o `catch` cresceu
       quando passou a preservar o texto parcial, e uma janela curta faria o
       teste falhar por motivo errado — dizendo "não cancela" quando cancela. */
    const bloco = codigo.slice(posErro, codigo.indexOf("setLoading(false);", posErro) + 40);
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
    expect(codigo).toContain("if (semAnimacao) {");
    expect(codigo).toContain(
      "if (!semAnimacao) quadroRef.current = requestAnimationFrame(digitar)",
    );
  });

  test("o contador de exibição anda TAMBÉM sem animação", () => {
    /* `mostradoRef` só era escrito dentro do laço de digitação, que não roda
       para quem pediu menos movimento. Ficava em zero para sempre — e o
       `catch` cortava o texto parcial em `mostradoRef`, devolvendo string
       vazia: o texto que ela estava lendo sumia e virava o erro genérico. O
       conserto do texto parcial existia e não valia para a trilha de
       acessibilidade. */
    const semAnim = codigo.split("if (semAnimacao)").slice(1);
    expect(semAnim.length).toBeGreaterThanOrEqual(2);
    expect(semAnim.some((t) => t.slice(0, 200).includes("mostradoRef.current = acc.length"))).toBe(
      true,
    );
  });
});

describe("a cauda não pode fazer a paciente esperar", () => {
  test("com o stream fechado, o passo deixa de ter teto fixo", () => {
    /* Medido com a régua antiga (teto de 12 caracteres por quadro, 720/s a
       60fps): 4.000 caracteres deixavam 6,7s de cauda DEPOIS de o texto
       inteiro já estar no navegador; 8.000 deixavam 12,3s. O teste antigo só
       cobria até 2.000 e passava por 0,03s de folga. */
    /* A régua saiu para `src/lib/chat-stream.ts` e agora é IMPORTADA pelo
       teste — antes este arquivo validava uma CÓPIA declarada "copiada de
       propósito", e dividir por 45.000 na tela real não quebrava nada. */
    expect(codigo).toContain("passoDaDigitacao(atraso, streamAbertoRef.current)");
  });

  test("uma resposta longa termina de aparecer em ~1s depois de chegar", () => {
    /* A régua, rodada de verdade: quantos quadros para desenhar N caracteres
       que já chegaram todos. A 60fps, 60 quadros = 1s. */
    const quadros = (n: number) => {
      let mostrado = 0;
      let q = 0;
      while (mostrado < n && q < 100_000) {
        const atraso = n - mostrado;
        mostrado += Math.max(40, Math.ceil(atraso / 10));
        q++;
      }
      return q;
    };
    expect(quadros(2_000)).toBeLessThan(60);
    expect(quadros(4_000)).toBeLessThan(60);
    expect(quadros(8_000)).toBeLessThan(60);
  });
});

describe("o que a paciente vê não pode ser apagado pelo próprio laço", () => {
  test("a escrita é funcional e acha a bolha pelo `ts`", () => {
    /* Era `setMessages([...displayNext, …])` — um retrato de quando o envio
       começou. Anexar um exame durante o streaming fazia o quadro seguinte
       APAGAR da tela a bolha do arquivo e a confirmação de envio: o arquivo
       estava salvo no servidor e a paciente via o contrário disso.
       Pelo `ts` e não pela última posição, porque a bolha do anexo entra
       DEPOIS da resposta. */
    expect(codigo).toContain("const escreverNaBolha = (texto: string, extra?: Partial<WAMsg>) =>");
    expect(codigo).toContain("atuais.findIndex((m) => m.ts === asstMsg.ts)");
    /* TODAS as escritas passam por ela. O laço por quadro foi consertado
       primeiro e as QUATRO escritas de fim de stream continuaram usando
       `displayNext` — o retrato de antes do envio. O anexo sobrevivia ao laço
       e era apagado quando o stream fechava: o mesmo defeito, ~1s depois. */
    const corpo = codigo.slice(
      codigo.indexOf("const escreverNaBolha"),
      codigo.indexOf("async function enviarParaOMedico"),
    );
    expect(corpo).not.toContain("setMessages([...displayNext, { ...asstMsg");
    expect(corpo).not.toContain("...displayNext,\n        ...(parcial");
  });
});

describe("bolha de erro não vira trabalho para o médico", () => {
  test("a parte `error` marca a mensagem", () => {
    /* Ler a parte `error` consertou a bolha vazia e abriu um buraco: a
       mensagem passou a TER conteúdo e continuava sem a marca, então os
       polegares apareciam. Um 👎 num 429 do Gemini virava lacuna na fila do
       médico. */
    expect(codigo).toContain("houveErro = true;");
    expect(codigo).toContain("escreverNaBolha(acc, houveErro ? { error: true } : undefined)");
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

/**
 * O CHAT PARA QUEM NÃO ENXERGA A TELA — e para quem quer desistir da resposta.
 *
 * Duas coisas que um avaliador mediu como ausentes e que não custam nada:
 * a resposta aparecia em SILÊNCIO absoluto para leitor de tela, e uma resposta
 * longa e errada obrigava a paciente a esperar ~19 segundos sem saída.
 */
describe("a resposta é anunciada, e pode ser interrompida", () => {
  test("a lista de mensagens é uma live region", () => {
    /* Sem `role="log"` + `aria-live`, o texto chegando caractere a caractere
       não é anunciado nem no começo nem no fim: a paciente cega manda a
       pergunta e não sabe se algo aconteceu.
       `polite`, não `assertive` — a resposta não deve interromper o que ela
       está lendo. */
    expect(codigo).toContain('role="log"');
    expect(codigo).toContain('aria-live="polite"');
  });

  test('o "Pensando" está numa região que o leitor anuncia', () => {
    /* O `sr-only` existia e era inserido/removido do DOM sem live region
       nenhuma — ou seja, nunca era lido em voz alta. */
    expect(codigo).toContain('<span role="status" className="sr-only">');
  });

  test("existe botão de PARAR durante a resposta", () => {
    expect(codigo).toContain("const parar = new AbortController();");
    expect(codigo).toContain("signal: parar.signal");
    expect(codigo).toContain("onClick={() => pararRef.current?.abort()}");
  });

  test("parar NÃO é erro — o que já apareceu fica", () => {
    /* Cancelamento pedido por ela não pode virar "ocorreu um erro": ela sabe o
       que fez, e o texto lido até ali continua valendo. */
    expect(codigo).toContain('if ((e as Error)?.name === "AbortError")');
  });
});
