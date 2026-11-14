/**
 * A RÉGUA DINÂMICA DO PARÂMETRO DE BANCADA — executada, e não lida.
 *
 * `parametro-de-bancada.test.ts` é a catraca ESTÁTICA: ela varre o fonte das
 * rotas atrás da forma conhecida do defeito. Esta cobre a régua que a
 * VARREDURA usa no navegador — a que compara o que foi pedido com o que o
 * router devolveu, e por isso pega também a forma que ninguém previu.
 *
 * ⚠️ **Os casos abaixo não são hipóteses: são a medição de 172 alvos com
 * parâmetro** (set/2026). Cada linha da régua responde a um deles, e o mais
 * importante é o falso positivo que ela precisa NÃO ter — o `?notif=3`, em que
 * o valor não se perdeu, foi para outro campo. Uma catraca que reprova o
 * estado correto é uma catraca que alguém desliga.
 */
import { describe, expect, test } from "bun:test";
import { parametrosPerdidos, porQueSePerdeu } from "../../scripts/parametro-preservado.mjs";

describe("o que o router faz de LEGÍTIMO não pode ser acusado", () => {
  test("o booleano ligado: ?luto=1 volta como luto=true (38 dos 172 medidos)", () => {
    expect(porQueSePerdeu("1", "true")).toBeNull();
  });

  test("o booleano desligado: ?luto=0 volta como luto=false", () => {
    expect(porQueSePerdeu("0", "false")).toBeNull();
  });

  test("o valor preservado tal e qual, inclusive com acento e espaço", () => {
    expect(porQueSePerdeu("alerta", "alerta")).toBeNull();
    expect(porQueSePerdeu("Ferro e Cálcio", "Ferro e Cálcio")).toBeNull();
    expect(porQueSePerdeu("39", "39")).toBeNull();
  });

  /* ⚠️ ESTE É O CASO QUE DEFINE A RÉGUA. `/preview-home?notif=3` volta como
     `notif=true&quantos=3`: o número foi para `quantos`, que é o campo que o
     CLAUDE.md descreve. Acusar aqui seria reprovar uma bancada correta. */
  test("o truthy que vira `true` porque o valor foi para OUTRO campo (?notif=3)", () => {
    expect(porQueSePerdeu("3", "true")).toBeNull();
  });
});

describe("os quatro defeitos medidos, reintroduzidos um a um", () => {
  test("?luto=1 caindo no padrão desligado — os quatro estados nunca desenhados", () => {
    expect(porQueSePerdeu("1", "false")).toContain("caiu no padrão");
  });

  test("a armadilha do Number(null): ?w=20 virando w=0", () => {
    expect(porQueSePerdeu("20", "0")).toContain("caiu no padrão");
  });

  test("o parâmetro DESCARTADO, que some da URL", () => {
    expect(porQueSePerdeu("1", null)).toContain("sumiu da URL");
  });

  test("o estado trocado por outro: ?estado=alerta abrindo em `feed`", () => {
    expect(porQueSePerdeu("alerta", "feed")).toContain("trocado");
  });

  test("a string virando vazia também é queda no padrão", () => {
    expect(porQueSePerdeu("MARIA", "")).toContain("caiu no padrão");
  });
});

describe("sobre a URL inteira", () => {
  test("a bancada certa não acusa nada — o caso normal de 172 alvos", () => {
    expect(
      parametrosPerdidos(
        "/preview-saude?w=20&luto=1",
        "/preview-saude?w=20&luto=true&dados=0&cabecalhos=false",
      ),
    ).toEqual([]);
  });

  /* O defeito real, como ele aparecia na URL efetiva antes do conserto. */
  test("o defeito acusa, e o recado NOMEIA o parâmetro e o valor efetivo", () => {
    const perdidos = parametrosPerdidos(
      "/preview-sons?luto=1",
      "/preview-sons?luto=false&musica=true",
    );
    expect(perdidos).toHaveLength(1);
    expect(perdidos[0]).toContain("?luto=1");
    expect(perdidos[0]).toContain("efetivo: false");
  });

  /* ⚠️ O router escreve TODOS os parâmetros com os padrões na URL — medido —,
     então o que ela ganha a mais nunca é assunto desta régua. */
  test("os padrões que a URL ganha a mais não são acusados", () => {
    expect(
      parametrosPerdidos(
        "/preview-chutes?estado=alerta",
        "/preview-chutes?estado=alerta&w=32&semdum=false",
      ),
    ).toEqual([]);
  });

  test("dois parâmetros perdidos aparecem os dois, e não só o primeiro", () => {
    expect(parametrosPerdidos("/x?luto=1&vazio=1", "/x?luto=false&vazio=false")).toHaveLength(2);
  });
});
