/**
 * OS COMENTÁRIOS, MEDIDOS CONTRA FRASES DE VERDADE.
 *
 * ⚠️ A afirmação central deste arquivo é que um filtro de "ofensivo" genérico
 * ERRARIA O ALVO nesta população: o comentário que mais machuca numa foto de
 * barriga não tem palavrão nenhum. Os testes de `alarmista` são os que provam
 * isso — e se um deles cair, o recurso perdeu a razão de ter sido aprovado.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { podeApagarComentario, recadoDoComentario, triarComentario } from "./comentarios";

describe("⚠️ o alarme — o dano que não tem palavrão", () => {
  const alarmes = [
    "nossa, tá pequeno demais pra essa idade",
    "sua barriga tá muito pequena hein",
    "isso não é normal não amiga",
    "com essa semana ele já devia estar mexendo",
    "minha prima teve isso e perdeu o bebê",
    "cuidado isso pode ser algo sério",
  ];
  for (const frase of alarmes) {
    test(`recusa: "${frase.slice(0, 34)}…"`, () => {
      expect({ frase, d: triarComentario(frase) }).toEqual({ frase, d: "alarmista" });
    });
  }

  test("⚠️ e o recado EXPLICA, nunca acusa", () => {
    /* Quem escreve alarme quase sempre está tentando ajudar. Tratada como
       agressora, a pessoa reescreve com raiva ou vai embora. */
    const r = recadoDoComentario("alarmista") ?? "";
    expect(r).toMatch(/mesmo com boa inten/i);
    expect(r).not.toMatch(/você (foi|é) (grosseir|ofensiv|agressiv)/i);
  });
});

describe("o ofensivo", () => {
  for (const frase of [
    "você é uma idiota mesmo",
    "que mãe horrível",
    "tomara que perca",
    "tá muito gorda",
  ]) {
    test(`recusa: "${frase}"`, () => {
      expect(triarComentario(frase)).toBe("ofensivo");
    });
  }

  test("⚠️ ofensivo vence clínico quando as duas coisas estão na frase", () => {
    /* "sua burra, isso não é normal" é as duas; a pessoa precisa ouvir a razão
       certa, e a razão certa aqui é o ataque. */
    expect(triarComentario("sua burra, isso não é normal")).toBe("ofensivo");
  });
});

describe("⚠️ a emergência vence tudo", () => {
  test("quem comenta sangrando é mandada para o SOS, não recusada", () => {
    /* Recusar por "ofensivo" mandaria embora quem está sangrando. */
    expect(triarComentario("to sangrando muito aqui, alguém sabe o que fazer")).toBe("emergencia");
    expect(recadoDoComentario("emergencia")).toMatch(/Central de Emerg/i);
  });
});

describe("⚠️ o que TEM de passar — senão o recurso não existe", () => {
  const boas = [
    "que linda! 💛",
    "parabéns, muito feliz por você",
    "também estou de 30 semanas, vamos juntas",
    "que foto linda do enxoval",
    "força amiga, tô torcendo",
    "meu bebê nasceu em agosto também",
    "amei o nome!",
    "saudade de você",
    "que barrigão lindo",
  ];
  for (const frase of boas) {
    test(`passa: "${frase.slice(0, 34)}"`, () => {
      expect({ frase, d: triarComentario(frase) }).toEqual({ frase, d: "publicavel" });
    });
  }

  test("comentário vazio não vira recusa", () => {
    expect(triarComentario("")).toBe("publicavel");
    expect(triarComentario("   ")).toBe("publicavel");
  });
});

describe("⚠️ a tranquilização por experiência pessoal É recusada", () => {
  test('"comigo foi parecido, foi tudo bem" NÃO passa — e eu errei o teste antes', () => {
    /* ⚠️ ESTA FRASE ESTAVA NA LISTA DAS QUE DEVIAM PASSAR, e o teste falhou.
       A régua tinha razão e eu não: "comigo foi…" é literalmente a abertura da
       tranquilização anedótica que ela foi construída para pegar — dizer a
       outra gestante que vai dar tudo certo com base na própria história É os
       20,9% de conselho errado, mesmo dito com afeto.

       O custo é real e fica registrado: uma forma calorosa e comum de se
       relacionar passa a ser recusada. É por isso que o recado precisa
       explicar o QUE fazer em vez de só negar. */
    expect(triarComentario("comigo foi parecido, foi tudo bem no fim")).toBe("clinico");
  });

  test("mas contar a própria história SEM prever o desfecho passa", () => {
    /* A saída existe, e o recado a aponta: relatar sem dizer o que vai
       acontecer com ela. */
    expect(triarComentario("passei por isso também")).toBe("publicavel");
    expect(triarComentario("também senti isso na 30ª semana")).toBe("publicavel");
  });

  test("⚠️ e o recado ENSINA a saída, em vez de só negar", () => {
    const r = recadoDoComentario("clinico") ?? "";
    expect(r).toMatch(/sem dizer o que vai acontecer|sem prever/i);
  });
});

describe("⚠️ o nome da régua não promete o que ela não faz", () => {
  test("o arquivo diz REDUZ, nunca impede", () => {
    /* Lista de palavras pega o óbvio e perde o resto; quem escreve para
       machucar contorna qualquer lista na segunda tentativa. É a mesma
       honestidade de `TERMOS_CLINICOS`. */
    const fonte = readFileSync("src/lib/comentarios.ts", "utf8");
    expect(fonte).toContain("REDUZ_OFENSA");
    expect(fonte).toMatch(/REDUZ o risco, NUNCA o impede/);
    expect(fonte).not.toMatch(/garante que nenhum|impede todo/i);
  });
});

describe("quem apaga", () => {
  test("⚠️ a dona do post apaga QUALQUER comentário", () => {
    /* O post é o espaço dela, e ela precisa limpar sem depender de denúncia —
       que é lenta por natureza. */
    expect(
      podeApagarComentario({ euId: "dona", autorDoComentario: "outra", donaDoPost: "dona" }),
    ).toBe(true);
  });

  test("a autora apaga o dela", () => {
    expect(podeApagarComentario({ euId: "eu", autorDoComentario: "eu", donaDoPost: "outra" })).toBe(
      true,
    );
  });

  test("mais ninguém", () => {
    expect(
      podeApagarComentario({ euId: "terceira", autorDoComentario: "eu", donaDoPost: "dona" }),
    ).toBe(false);
  });
});
