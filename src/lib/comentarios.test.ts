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
import {
  podeApagarComentario,
  recadoDoComentario,
  triarComentario,
  raizDoComentario,
  temPalavraOculta,
  limparPalavrasOcultas,
  verDoComentario,
  PALAVRA_OCULTA_MAX,
  PALAVRAS_OCULTAS_MAX,
} from "./comentarios";

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

describe("⚠️ a árvore tem UM nível", () => {
  test("a raiz de uma raiz é ela mesma", () => {
    expect(raizDoComentario({ id: "a", respondeA: null })).toBe("a");
  });

  test("⚠️ responder a uma resposta entra na MESMA conversa", () => {
    /* Árvore infinita num celular de 393px: o quarto nível tem 40px de largura
       e ninguém lê. Um nível também faz "responder" ser uma decisão só — a quem
       eu respondo é a conversa, nunca a linha exata. */
    expect(raizDoComentario({ id: "c", respondeA: "raiz" })).toBe("raiz");
  });
});

describe("o filtro de palavras", () => {
  test("acha sem acento e sem caixa", () => {
    /* Quem escreve "PERDI" e "perdí" escreve a mesma palavra, e ela não deveria
       ter de listar as quatro grafias. */
    expect(temPalavraOculta("eu PERDÍ o bebê", ["perdi"])).toBe(true);
    expect(temPalavraOculta("eu perdi o bebê", ["PERDÍ"])).toBe(true);
  });

  test("⚠️ casa PALAVRA INTEIRA — e é isto que faz o recurso servir", () => {
    /* Com `includes`, esconder "parto" esconderia "departamento"; esconder
       "mal" esconderia "mala", "malha", "animal". Ela veria comentários sumindo
       sem entender e desligaria o filtro — que é o mesmo que não tê-lo, só que
       depois de ter confiado nele. */
    expect(temPalavraOculta("trabalho no departamento", ["parto"])).toBe(false);
    expect(temPalavraOculta("levei a mala", ["mal"])).toBe(false);
    expect(temPalavraOculta("que animal lindo", ["mal"])).toBe(false);
    expect(temPalavraOculta("meu parto foi tranquilo", ["parto"])).toBe(true);
  });

  test("pega a palavra colada em pontuação", () => {
    expect(temPalavraOculta("e aí, parto?", ["parto"])).toBe(true);
    expect(temPalavraOculta("parto", ["parto"])).toBe(true);
    expect(temPalavraOculta("(parto)", ["parto"])).toBe(true);
  });

  test("expressão com espaço casa como FRASE", () => {
    expect(temPalavraOculta("eu perdi o bebê ontem", ["perdi o bebê"])).toBe(true);
    expect(temPalavraOculta("perdi a chave e vi o bebê", ["perdi o bebê"])).toBe(false);
  });

  test("⚠️ caractere especial na palavra não vira regex", () => {
    /* Ela digita o que quiser. Sem escapar, um "(" derruba a construção da
       expressão e o filtro inteiro para de funcionar — em silêncio, porque o
       erro acontece dentro de um laço. */
    expect(() => temPalavraOculta("teste", ["a(b"])).not.toThrow();
    expect(temPalavraOculta("isso e a(b sim", ["a(b"])).toBe(true);
  });

  test("lista vazia não esconde nada", () => {
    expect(temPalavraOculta("qualquer coisa", [])).toBe(false);
    expect(temPalavraOculta("qualquer coisa", ["", "  "])).toBe(false);
  });
});

describe("limparPalavrasOcultas", () => {
  test("tira repetida, vazia e espaço sobrando", () => {
    expect(limparPalavrasOcultas([" parto ", "PARTO", "", "  ", "perdi"])).toEqual([
      "parto",
      "perdi",
    ]);
  });

  test("⚠️ a repetida some por NORMALIZAÇÃO, não por igualdade", () => {
    /* "Perdí" e "perdi" são a mesma entrada para o filtro; guardar as duas
       faria a lista dela encher de duplicatas que ela não consegue distinguir. */
    expect(limparPalavrasOcultas(["Perdí", "perdi"])).toHaveLength(1);
  });

  test("respeita os dois tetos", () => {
    expect(limparPalavrasOcultas([`${"a".repeat(80)}`])[0]).toHaveLength(PALAVRA_OCULTA_MAX);
    const muitas = Array.from({ length: 200 }, (_, i) => `p${i}`);
    expect(limparPalavrasOcultas(muitas)).toHaveLength(PALAVRAS_OCULTAS_MAX);
  });
});

describe("⚠️ verDoComentario — restringir e filtrar", () => {
  const base = {
    euId: "eu",
    autorDoComentario: "outra",
    donaDoPost: "dona",
    restringiOAutor: false,
    donaRestringeOAutor: false,
    batePalavraMinha: false,
  };

  test("comentário comum aparece sem marca", () => {
    expect(verDoComentario(base)).toEqual({ mostra: true, marca: null, revelavel: false });
  });

  test("⚠️ A PESSOA RESTRINGIDA CONTINUA VENDO O PRÓPRIO COMENTÁRIO", () => {
    /* É a regra que separa restringir de bloquear. Com a checagem de autoria
       depois da restrição, ela escreveria, o comentário sumiria da tela dela, e
       ela descobriria na hora — e restringir viraria um bloqueio anunciado. */
    expect(
      verDoComentario({
        ...base,
        euId: "outra",
        autorDoComentario: "outra",
        donaRestringeOAutor: true,
      }),
    ).toEqual({ mostra: true, marca: null, revelavel: false });
  });

  test("⚠️ A DONA NÃO LÊ O QUE ELA MANDOU ESCONDER — ela decide se quer ler", () => {
    /* A primeira versão devolvia `mostra: true` com uma etiqueta embaixo, e
       isso contradizia a razão do recurso: entregar o texto e avisar depois que
       ele devia estar escondido é o pior desfecho de um filtro, porque ela já
       leu. Recolhido é `mostra: false` + `revelavel: true`. */
    for (const caso of [
      { euId: "dona", donaRestringeOAutor: true, marca: "restrito" },
      { euId: "dona", batePalavraMinha: true, marca: "palavra" },
    ]) {
      const { marca, ...entrada } = caso;
      const r = verDoComentario({ ...base, ...entrada });
      expect(r.mostra).toBe(false);
      expect(r.revelavel).toBe(true);
      expect(r.marca).toBe(marca as "restrito" | "palavra");
    }
  });

  test("⚠️ e para TERCEIROS não sobra nem a linha recolhida", () => {
    /* Se um terceiro visse "comentário escondido", restringir passaria a
       ANUNCIAR a restrição para a conversa inteira — que é exatamente o que
       separa restringir de bloquear. */
    for (const caso of [{ donaRestringeOAutor: true }, { batePalavraMinha: true }]) {
      const r = verDoComentario({ ...base, euId: "terceira", ...caso });
      expect(r.mostra).toBe(false);
      expect(r.revelavel).toBe(false);
      expect(r.marca).toBeNull();
    }
  });

  test("⚠️ a MINHA palavra escondida vale inclusive no MEU post", () => {
    /* Se eu escondi "perdi", eu não quero ler "perdi" em lugar nenhum — nem no
       meu. Ali ele existe recolhido, para eu poder decidir o que fazer. */
    const minha = verDoComentario({ ...base, euId: "dona", batePalavraMinha: true });
    expect(minha.revelavel).toBe(true);
    expect(verDoComentario({ ...base, batePalavraMinha: true })).toEqual({
      mostra: false,
      marca: null,
      revelavel: false,
    });
  });

  test("⚠️ mas nunca esconde o que EU escrevi", () => {
    /* Minha própria palavra escondida aparecendo no meu próprio comentário
       faria a tela apagar o que acabei de escrever. */
    expect(
      verDoComentario({
        ...base,
        euId: "outra",
        autorDoComentario: "outra",
        batePalavraMinha: true,
      }),
    ).toEqual({ mostra: true, marca: null, revelavel: false });
  });

  test("⚠️ a minha restrição esconde de mim no post DE OUTRA PESSOA", () => {
    /* Restringir é sobre não ler aquela pessoa, não só sobre o meu post. E aqui
       NÃO é revelável: eu não sou a dona, e uma linha recolhida no post alheio
       contaria à conversa que eu restrinjo alguém. */
    expect(verDoComentario({ ...base, restringiOAutor: true })).toEqual({
      mostra: false,
      marca: null,
      revelavel: false,
    });
  });

  test("a palavra vence a restrição quando as duas valem", () => {
    /* Ordem determinística: sem ela, a mesma linha mostraria marcas diferentes
       entre duas aberturas. */
    expect(
      verDoComentario({
        ...base,
        euId: "dona",
        donaRestringeOAutor: true,
        batePalavraMinha: true,
      }).marca,
    ).toBe("palavra");
  });
});
