/**
 * O BEBÊ BOLHA NA HOME — o que ele diz, e o que ele NÃO diz.
 *
 * Ele entrou como a voz do app: anuncia os recados, leva à central com um
 * toque, e vai conduzir o tutorial do primeiro acesso. As três coisas que este
 * arquivo protege são as que quebram em silêncio.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { emblemaDeRecados, falaDosRecados, oQueOMascoteDiz } from "./fala-do-mascote";

describe("quando ele fala", () => {
  test("sem recado, ele fica QUIETO", () => {
    /* A regra mais importante do arquivo. Personagem que fala toda vez que a
       tela abre vira ruído em três dias, e aí ninguém lê o balão no dia em que
       ele tiver algo urgente. */
    expect(falaDosRecados(0)).toBeNull();
    expect(falaDosRecados(-3)).toBeNull();
    expect(falaDosRecados(Number.NaN)).toBeNull();
  });

  test("um recado fala no singular", () => {
    expect(falaDosRecados(1)?.texto).toBe("Tenho um recado para você 💌");
    expect(falaDosRecados(1)?.aria).toBe("Abrir 1 recado");
  });

  test("mais de um fala no plural, com o número", () => {
    expect(falaDosRecados(4)?.texto).toBe("Tenho 4 recados 💌");
    expect(falaDosRecados(4)?.aria).toBe("Abrir 4 recados");
  });
});

describe("a porta do tutorial", () => {
  test("a fala explícita VENCE a dos recados", () => {
    /* É por aqui que o tutorial entra. Se o recado interrompesse a aula, o
       personagem mudaria de assunto no meio da frase — e o recado continua lá
       quando ele terminar, então não se perde nada esperando. */
    const aula = { texto: "Toque no bebê para ver a semana", aria: "Continuar" };
    expect(oQueOMascoteDiz(aula, 7)).toBe(aula);
  });

  test("sem fala explícita, valem os recados", () => {
    expect(oQueOMascoteDiz(null, 2)?.texto).toBe("Tenho 2 recados 💌");
    expect(oQueOMascoteDiz(undefined, 0)).toBeNull();
  });
});

describe("o emblema", () => {
  test("some no zero e trava em 9+", () => {
    /* O teto é de LARGURA: o emblema pendura na borda de um personagem de
       44px no canto da tela, e três dígitos o empurrariam para fora. */
    expect(emblemaDeRecados(0)).toBeNull();
    expect(emblemaDeRecados(9)).toBe("9");
    expect(emblemaDeRecados(10)).toBe("9+");
    expect(emblemaDeRecados(137)).toBe("9+");
  });
});

describe("um aviso só para o mesmo fato", () => {
  const shell = readFileSync("src/components/app-mobile-shell.tsx", "utf8");

  test("o ponto vermelho NÃO voltou para o botão do menu", () => {
    /* Quando o mascote virou a voz dos recados, o ponto do ☰ passou a ser o
       segundo aviso do mesmo fato — e dois avisos competindo lêem como dois
       assuntos ("o menu tem algo" e "a bolha tem algo"). O acesso pelo ☰ não
       mudou; o que saiu foi o sinal duplicado.

       O teste olha o bloco do BOTÃO DO MENU, e não o arquivo inteiro: o
       emblema do mascote é legitimamente `bg-rose-500` e passa por aqui. */
    const i = shell.indexOf('aria-label={temNaoLidas ? "Menu');
    expect(i).toBeGreaterThan(-1);
    const botao = shell.slice(i, shell.indexOf("</button>", i));
    expect(botao).not.toMatch(/bg-rose-500/);
  });

  test("o mascote está na barra de topo da home", () => {
    expect(shell).toContain("<MascoteDaHome");
    /* `humorDaJornada` e não um `if` local: o portão de Modo Cuidado mora
       dentro dela, e uma segunda régua faria uma carinha festiva aparecer
       para quem perdeu a gestação. */
    /* A chamada cresceu quando as cinco expressões entraram em uso (dormindo
       à noite, surpresa de madrugada, orgulhosa com recado). O que o teste
       cobra é o VÍNCULO com a régua — não a forma exata da chamada. */
    expect(shell).toContain("humorDaJornada({");
    expect(shell).toMatch(/humorDaJornada\(\{[\s\S]{0,200}careMode,?\s*\}\)/);
  });
});

describe("o passo do tutorial não mora no componente que desmonta", () => {
  const tut = readFileSync("src/components/tutorial-da-bolha.tsx", "utf8");
  const conta = readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8");

  test("o índice é PROP, e não estado local", () => {
    /* ⚠️ O defeito que o dono viu: a barra continua clicável durante a aula,
       então tocar em "Jogo" troca a aba, tira a home do ar e DESMONTA o
       tutorial. Com o índice em `useState` lá dentro, voltar para o Bebê
       recomeçava do primeiro cartão. É o mesmo defeito do `sub` local do
       `RegistrosHub`, e a mesma solução: o estado sobe para quem não
       desmonta. */
    expect(tut).not.toMatch(/useState\(0\)/);
    expect(tut).toContain("passo: iPasso");
    expect(conta).toContain("const [passoDoTutorial, setPassoDoTutorial] = useState(0)");
  });

  test("o passo também é guardado no aparelho", () => {
    /* O estado na página resolve a ida e volta dentro do app; o storage
       resolve fechar o app no meio da aula. */
    expect(conta).toContain("chaveDoPassoDoTutorial");
    expect(conta).toContain("lerPassoDoTutorial");
  });

  test("durante o tutorial o mascote do canto fica calado", () => {
    /* Dois balões do mesmo personagem na mesma tela, um deles atrás do véu —
       está na foto que o dono mandou. */
    expect(conta).toContain("mascoteCalado={tutorialAberto}");
  });
});
