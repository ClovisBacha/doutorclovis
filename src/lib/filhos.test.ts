/**
 * OS FILHOS, MEDIDOS.
 *
 * A régua que decide como a paciente é apresentada depois do parto. Errar aqui
 * é errar o nome ou o número de filhos de alguém na tela dela.
 */

import { describe, expect, test } from "bun:test";
import {
  type Filho,
  diasEntre,
  ehGestante,
  ehMae,
  idadeEmPalavras,
  linhaDoPerfil,
  mesesEntre,
  palavraDeMultiplos,
  turmaDe,
  turmaEmPalavras,
} from "./filhos";

const HOJE = "2026-08-24";
let seq = 0;
const bebe = (p: Partial<Filho> = {}): Filho => ({
  id: `f${++seq}`,
  nome: null,
  sexo: null,
  nascidoEm: null,
  previstoPara: null,
  ...p,
});

describe("⚠️ as datas não passam por fuso", () => {
  test("`YYYY-MM-DD` é lido como dia local, nunca como meia-noite UTC", () => {
    /* `new Date("2026-08-24")` é 23/08 às 21h em São Paulo — um dia inteiro de
       erro em toda conta de idade. O projeto já pagou isso na agenda. */
    expect(diasEntre("2026-08-01", "2026-08-24")).toBe(23);
    expect(mesesEntre("2026-05-24", "2026-08-24")).toBe(3);
  });

  test("o mês só fecha quando chega o dia dele", () => {
    expect(mesesEntre("2026-05-25", "2026-08-24")).toBe(2);
    expect(mesesEntre("2026-05-24", "2026-08-24")).toBe(3);
  });
});

describe("a idade em palavras segue a fala, não a aritmética", () => {
  test("recém-nascida no dia, dias na primeira quinzena", () => {
    expect(idadeEmPalavras("2026-08-24", HOJE)).toBe("recém-nascida");
    expect(idadeEmPalavras("2026-08-23", HOJE)).toBe("1 dia");
    expect(idadeEmPalavras("2026-08-14", HOJE)).toBe("10 dias");
  });

  test("⚠️ semanas antes do primeiro mês — nunca '0 meses'", () => {
    /* Ninguém diz que o filho tem zero meses. */
    expect(idadeEmPalavras("2026-08-03", HOJE)).toBe("3 semanas");
  });

  test("meses, e depois anos", () => {
    expect(idadeEmPalavras("2026-05-24", HOJE)).toBe("3 meses");
    expect(idadeEmPalavras("2025-08-24", HOJE)).toBe("12 meses");
    expect(idadeEmPalavras("2024-08-24", HOJE)).toBe("2 anos");
    expect(idadeEmPalavras("2024-06-24", HOJE)).toBe("2 anos e 2 meses");
  });

  test("data no futuro não vira idade negativa", () => {
    expect(idadeEmPalavras("2026-12-01", HOJE)).toBe(null);
  });
});

describe("⚠️ a concordância dos múltiplos", () => {
  test("só vira feminino com TODAS meninas", () => {
    expect(palavraDeMultiplos(2, ["f", "f"])).toBe("gêmeas");
    expect(palavraDeMultiplos(2, ["f", "m"])).toBe("gêmeos");
    expect(palavraDeMultiplos(3, ["f", "f", "f"])).toBe("trigêmeas");
  });

  test("⚠️ sexo desconhecido cai no masculino, que é o plural neutro", () => {
    /* Escrever "gêmeas" numa gestação mista é errar o nome de um filho na cara
       da mãe. O masculino cobre o grupo misto e o desconhecido. */
    expect(palavraDeMultiplos(2, [null, null])).toBe("gêmeos");
    expect(palavraDeMultiplos(3, ["f", null, "f"])).toBe("trigêmeos");
  });

  test("um bebê só não é múltiplo", () => {
    expect(palavraDeMultiplos(1, ["f"])).toBe(null);
  });
});

describe("a linha do perfil", () => {
  test("grávida de primeira viagem, com e sem nome", () => {
    expect(linhaDoPerfil([bebe({ previstoPara: "2026-12-01" })], HOJE)).toBe("Grávida");
    expect(
      linhaDoPerfil([bebe({ nome: "Helena", sexo: "f", previstoPara: "2026-12-01" })], HOJE),
    ).toBe("Grávida da Helena");
  });

  test("grávida de gêmeas", () => {
    expect(linhaDoPerfil([bebe({ sexo: "f" }), bebe({ sexo: "f" })], HOJE)).toBe(
      "Grávida de gêmeas",
    );
  });

  test("mãe de um, com nome e idade", () => {
    expect(
      linhaDoPerfil([bebe({ nome: "Helena", sexo: "f", nascidoEm: "2026-05-24" })], HOJE),
    ).toBe("Mãe da Helena, 3 meses");
  });

  test("⚠️ mãe sem nome publicado continua sendo mãe", () => {
    /* Há quem não queira publicar o nome, e há quem perdeu uma gestação e quer
       que aquele filho continue contando. "Mãe de 1" tem de ser dizível. */
    expect(linhaDoPerfil([bebe({ nascidoEm: "2026-05-24" })], HOJE)).toBe("Mãe de 1");
  });

  test("com dois ou mais, o número informa mais que os nomes", () => {
    expect(
      linhaDoPerfil(
        [
          bebe({ nome: "Ana", nascidoEm: "2022-01-10" }),
          bebe({ nome: "Léo", nascidoEm: "2024-03-02" }),
        ],
        HOJE,
      ),
    ).toBe("Mãe de 2");
  });

  test("⚠️ O CASO QUE OS APPS ERRAM: mãe E grávida ao mesmo tempo", () => {
    /* É a situação mais comum depois do primeiro parto, e nenhum aplicativo de
       gestação a representa — todos assumem primeira viagem. */
    const filhos = [
      bebe({ nome: "Ana", sexo: "f", nascidoEm: "2023-04-10" }),
      bebe({ sexo: "m", previstoPara: "2026-12-01" }),
    ];
    expect(linhaDoPerfil(filhos, HOJE)).toBe("Mãe da Ana, 3 anos e 4 meses, grávida do segundo");
  });

  test("⚠️ mãe de um esperando gêmeos — o ordinal não serve, o número sim", () => {
    const filhos = [bebe({ nascidoEm: "2023-04-10" }), bebe({ sexo: "f" }), bebe({ sexo: "f" })];
    expect(linhaDoPerfil(filhos, HOJE)).toBe("Mãe de 1, grávida de gêmeas");
  });

  test("sem filho nenhum, não inventa linha", () => {
    expect(linhaDoPerfil([], HOJE)).toBe(null);
  });
});

describe("gestante e mãe não são exclusivos", () => {
  test("dá para ser os dois", () => {
    const filhos = [bebe({ nascidoEm: "2023-04-10" }), bebe({ previstoPara: "2026-12-01" })];
    expect(ehMae(filhos)).toBe(true);
    expect(ehGestante(filhos)).toBe(true);
  });
});

describe("⚠️ a turma — o que faz a comunidade não morrer", () => {
  test("o mês do nascimento vira a turma", () => {
    expect(turmaDe(bebe({ nascidoEm: "2026-08-03" }))).toBe("2026-08");
    expect(turmaEmPalavras("2026-08")).toBe("agosto de 2026");
  });

  test("quem ainda não nasceu não tem turma", () => {
    expect(turmaDe(bebe({ previstoPara: "2026-12-01" }))).toBe(null);
  });
});
