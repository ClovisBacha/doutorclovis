/**
 * A pilha do "voltar".
 *
 * O que se protege aqui não é uma interação bonita — é a diferença entre fechar
 * uma folha e FECHAR O APP. No Android, sem ninguém escutando, o Capacitor sai
 * do app de qualquer tela. Um handler esquecido na pilha, uma ordem invertida
 * ou um erro engolido tornam esse comportamento de volta, e num aparelho isso é
 * mudo: a paciente conclui que o app fechou sozinho.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { limparVoltar, quantosEsperandoVoltar, registrarVoltar, voltarAgora } from "./voltar";

afterEach(() => limparVoltar());

describe("sem ninguém esperando, o voltar não é de ninguém", () => {
  test('pilha vazia devolve "vazio"', () => {
    expect(voltarAgora()).toBe("vazio");
  });

  test('"vazio" é o que autoriza minimizar o app — não pode virar "consumido"', () => {
    /* Se um handler que devolve `false` contasse como consumido, o botão de
       voltar não faria NADA na tela inicial: nem fecharia, nem minimizaria. O
       app pareceria travado. */
    registrarVoltar(() => false);
    expect(voltarAgora()).toBe("vazio");
  });
});

describe("o último a abrir responde primeiro", () => {
  test("com duas folhas abertas, a de cima fecha antes", () => {
    const ordem: string[] = [];
    registrarVoltar(() => {
      ordem.push("baixo");
      return true;
    });
    /* A folha de cima se desregistra ao fechar — é o que o `useVoltar` faz
       quando `ativo` vira falso. Sem isso ela responderia para sempre, e o
       segundo "voltar" não alcançaria a de baixo. */
    const soltarCima = registrarVoltar(() => {
      ordem.push("cima");
      soltarCima();
      return true;
    });
    voltarAgora();
    expect(ordem).toEqual(["cima"]);
    voltarAgora();
    expect(ordem).toEqual(["cima", "baixo"]);
  });

  test("quem devolve false passa a vez para o de baixo", () => {
    const ordem: string[] = [];
    registrarVoltar(() => {
      ordem.push("baixo");
      return true;
    });
    registrarVoltar(() => {
      ordem.push("cima");
      return false;
    });
    expect(voltarAgora()).toBe("consumido");
    expect(ordem).toEqual(["cima", "baixo"]);
  });
});

describe("sair da tela tira o handler da pilha", () => {
  test("o cancelador remove, e remove só o dele", () => {
    const soltarA = registrarVoltar(() => true);
    registrarVoltar(() => true);
    expect(quantosEsperandoVoltar()).toBe(2);
    soltarA();
    expect(quantosEsperandoVoltar()).toBe(1);
  });

  test("cancelar duas vezes não remove o do vizinho", () => {
    /* Um `useEffect` que roda a limpeza duas vezes (StrictMode faz isso em
       desenvolvimento) não pode desregistrar a folha de outra pessoa. */
    const soltar = registrarVoltar(() => true);
    registrarVoltar(() => true);
    soltar();
    soltar();
    expect(quantosEsperandoVoltar()).toBe(1);
  });

  test("o cancelador remove A REGISTRO DELE, não outro igual mais antigo", () => {
    /* Duas telas podem registrar a MESMA função (uma referência estável de
       módulo, ou duas instâncias do mesmo componente). Se o cancelador do
       registro mais novo removesse o mais antigo, a pilha ficaria com a ordem
       trocada e o "voltar" alcançaria a tela errada.
       Contando só o tamanho, `indexOf` e `lastIndexOf` são indistinguíveis —
       por isso este caso intercala um terceiro handler e cobra QUEM responde. */
    const ordem: string[] = [];
    const mesma = () => {
      ordem.push("mesma");
      return true;
    };
    registrarVoltar(mesma);
    registrarVoltar(() => {
      ordem.push("meio");
      return true;
    });
    const soltarSegunda = registrarVoltar(mesma);

    soltarSegunda();
    expect(quantosEsperandoVoltar()).toBe(2);
    voltarAgora();
    expect(ordem).toEqual(["meio"]);
  });
});

describe("um handler que explode perde a vez, não fecha o app", () => {
  test("o erro é contido e o de baixo assume", () => {
    const ordem: string[] = [];
    registrarVoltar(() => {
      ordem.push("baixo");
      return true;
    });
    registrarVoltar(() => {
      throw new Error("estourou");
    });
    expect(voltarAgora()).toBe("consumido");
    expect(ordem).toEqual(["baixo"]);
  });

  test("se TODOS explodem, o resultado é vazio — e aí o app minimiza", () => {
    registrarVoltar(() => {
      throw new Error("estourou");
    });
    expect(voltarAgora()).toBe("vazio");
  });
});
