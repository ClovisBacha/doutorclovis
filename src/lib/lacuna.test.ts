/**
 * O portão da promessa.
 *
 * Quando a dúvida da paciente não está coberta pelo cérebro do médico, a IA
 * responde textualmente: *"registrei aqui para ele ver"*. Essa frase só é
 * verdadeira se a pergunta de fato entrou na fila dele — e quem decide isso são
 * duas funções puras: `normalizeGapQuestion` (tamanho mínimo) e
 * `isSuporteDoApp` (dúvida de suporte não vira trabalho clínico).
 *
 * O risco é sutil e caro: o `chat.ts` reimplementa a MESMA condição para
 * decidir se pode dizer a frase. Se as duas divergirem, o produto passa a
 * mentir para a paciente — ela espera por uma resposta que ninguém vai dar.
 * Estes testes prendem as duas pontas.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { normalizeGapQuestion } from "./doctorthink/core";
import { isCortesia, isElogio, isSuporteDoApp } from "./secondbrain.server";

/** A condição, escrita uma vez. É esta que os dois lados têm que respeitar. */
function viraLacuna(pergunta: string): boolean {
  return (
    normalizeGapQuestion(pergunta).length >= 8 &&
    !isSuporteDoApp(pergunta) &&
    !isCortesia(pergunta) &&
    !isElogio(pergunta)
  );
}

describe("o que vira lacuna na fila do médico", () => {
  test("dúvida clínica de verdade entra", () => {
    expect(viraLacuna("posso tomar dipirona na gravidez?")).toBe(true);
    expect(viraLacuna("estou com dor de cabeça forte, é normal?")).toBe(true);
  });

  test("interjeição não vira trabalho para o médico", () => {
    expect(viraLacuna("oi")).toBe(false);
    expect(viraLacuna("ok")).toBe(false);
    expect(viraLacuna("obrigada!!")).toBe(false);
  });

  /* DEFEITO REAL, achado por este arquivo: "obrigada!!" normaliza para
     "obrigada" — oito caracteres, passava o piso e virava lacuna. Com a tabela
     de quem perguntou, a paciente ficaria esperando resposta para um
     agradecimento e ganharia push quando ele "respondesse". */
  test("cortesia não vira dúvida esperando resposta", () => {
    expect(viraLacuna("obrigada!!")).toBe(false);
    expect(viraLacuna("muito obrigada")).toBe(false);
    expect(viraLacuna("bom dia")).toBe(false);
    expect(viraLacuna("entendido")).toBe(false);
  });

  test("cortesia SEGUIDA de pergunta continua sendo pergunta", () => {
    expect(viraLacuna("obrigada, mas posso tomar dipirona?")).toBe(true);
    expect(viraLacuna("bom dia, estou com dor nas costas")).toBe(true);
  });

  test("suporte do app não vira fila clínica", () => {
    expect(viraLacuna("como faço para trocar minha senha no aplicativo?")).toBe(false);
  });
});

describe("normalização — a chave de deduplicação", () => {
  /* A lacuna é deduplicada por `(médico, pergunta normalizada)`. É isso que faz
     cinquenta pacientes com a mesma dúvida virarem UM item na fila dele, com
     contador — e não cinquenta vezes o mesmo trabalho. Se a normalização
     deixasse de colapsar variações triviais, a fila do médico viraria ruído. */
  test("acento, caixa e pontuação não criam lacunas diferentes", () => {
    const a = normalizeGapQuestion("Posso tomar DIPIRONA?");
    const b = normalizeGapQuestion("posso tomar dipirona");
    const c = normalizeGapQuestion("  posso  tomar   dipirona!!!  ");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  test("perguntas diferentes continuam diferentes", () => {
    expect(normalizeGapQuestion("posso tomar dipirona")).not.toBe(
      normalizeGapQuestion("posso tomar paracetamol"),
    );
  });

  test("não estoura com entrada vazia ou só símbolos", () => {
    expect(normalizeGapQuestion("").length).toBe(0);
    expect(normalizeGapQuestion("!!!???").length).toBeLessThan(8);
  });
});

/**
 * ELOGIO NÃO É DÚVIDA.
 *
 * Caso real, visto na fila do médico: "Bacana dms , gostei muito dessa ia"
 * virou um item com botão "Responder". A paciente estava agradando; o produto
 * transformou isso em trabalho clínico.
 *
 * A lista de cortesias não alcançava — ela compara o texto INTEIRO com um
 * dicionário fechado, e elogio é frase livre. Mas a regra nova precisa ser
 * conservadora: perder uma dúvida clínica de verdade é muito pior que uma
 * linha de ruído na fila.
 */
describe("elogio à IA não vira fila do médico", () => {
  test("o caso real que apareceu na fila", () => {
    expect(viraLacuna("Bacana dms , gostei muito dessa ia")).toBe(false);
  });

  test("outros elogios comuns", () => {
    expect(viraLacuna("adorei o aplicativo, muito bom mesmo")).toBe(false);
    expect(viraLacuna("parabéns pelo trabalho de vocês")).toBe(false);
    expect(viraLacuna("essa ia me ajudou muito, sensacional")).toBe(false);
  });

  /* O erro caro é este lado. Um elogio no começo da frase não pode fazer a
     dúvida da paciente desaparecer sem ninguém ver. */
  test("elogio SEGUIDO de pergunta continua sendo pergunta", () => {
    expect(viraLacuna("adorei, mas posso tomar dipirona?")).toBe(true);
    expect(viraLacuna("gostei muito! quando devo fazer o próximo exame")).toBe(true);
    expect(viraLacuna("que legal isso, é normal sentir enjoo assim")).toBe(true);
  });

  /* DEFEITO PRÉ-EXISTENTE, achado ao escrever o teste acima e deixado à
     mostra de propósito.

     "adorei O APP, mas posso tomar dipirona?" NÃO vira lacuna — e não é culpa
     do filtro de elogio: `isSuporteDoApp` casa com a palavra "app" em
     qualquer posição, então basta citar o aplicativo para a dúvida clínica ser
     descartada. O comentário do filtro promete o contrário ("na dúvida
     REGISTRA"), e aqui ele faz o oposto: perde a pergunta.

     Este teste documenta o comportamento ATUAL. Quando o filtro for
     consertado, ele falha — e é isso que se quer. */
  test("HOJE: citar o app derruba até pergunta clínica (a consertar)", () => {
    expect(viraLacuna("adorei o app, mas posso tomar dipirona?")).toBe(false);
    expect(viraLacuna("no app não achei: posso tomar dipirona?")).toBe(false);
  });

  test("elogio junto de relato clínico continua sendo lacuna", () => {
    /* "gostei do resultado do exame" tem elogio e nenhum "?" — mas fala de
       exame, e relato de corpo nunca pode cair no filtro de agrado. */
    expect(viraLacuna("gostei do resultado do exame de sangue")).toBe(true);
    expect(viraLacuna("show, a dor nas costas melhorou com o alongamento")).toBe(true);
  });

  test("dúvida clínica sem elogio nenhum não é afetada", () => {
    expect(viraLacuna("estou com dor de cabeça forte, é normal?")).toBe(true);
    expect(viraLacuna("posso tomar dipirona na gravidez?")).toBe(true);
  });
});

describe("as duas pontas continuam concordando", () => {
  /* O `chat.ts` reimplementa a condição para decidir se a IA pode dizer
     "registrei aqui para ele ver". Um filtro novo só de um lado faz o produto
     mentir: a IA promete o registro e a lacuna não existe. */
  const chat = readFileSync("src/routes/api/chat.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");

  test("o chat também descarta elogio antes de prometer registro", () => {
    expect(chat).toContain("!isElogio(userText)");
  });

  test("os três filtros do registro estão nos dois lados", () => {
    const server = readFileSync("src/lib/secondbrain.server.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*/g, "");
    for (const f of ["isSuporteDoApp", "isCortesia", "isElogio"]) {
      expect(server).toContain(`if (${f}(clean)) return;`);
      expect(chat).toContain(`!${f}(userText)`);
    }
  });
});

/**
 * A REGRA QUE VIROU MORDAÇA.
 *
 * Caso real, e a prova veio de uma comparação: a MESMA pergunta ("posso comer
 * comida japonesa"), o MESMO cérebro vazio, dois canais.
 *
 *   Playground do painel → "evitar carnes e peixes crus… pode consumir as
 *                           opções cozidas ou bem passadas"
 *   App da paciente      → "como sou uma inteligência artificial e não posso
 *                           dar orientações médicas, o ideal é que você
 *                           converse diretamente com a Dra."
 *
 * A diferença não era o cérebro — era o prompt. O do app dizia "responda
 * SOMENTE seguindo as condutas já validadas pelo médico", e com o cérebro
 * vazio NADA está validado: o modelo concluiu, corretamente, que não podia
 * dizer nada. A regra escrita para proteger a paciente passou a deixá-la sem
 * resposta nenhuma — e ela vai procurar num grupo de WhatsApp, que é pior.
 *
 * O conserto separa as duas camadas: informação consolidada a IA responde;
 * conduta do caso dela continua sendo do médico.
 */
describe("o prompt do app informa antes de encaminhar", () => {
  const chat = readFileSync("src/routes/api/chat.ts", "utf8");

  test("não existe mais o `SOMENTE` que travava tudo", () => {
    expect(chat).not.toContain("responda SOMENTE seguindo o estilo e as condutas");
  });

  test("as duas camadas da dúvida clínica estão escritas", () => {
    expect(chat).toContain("Informação consolidada");
    expect(chat).toContain("Decisão sobre o caso DELA");
  });

  test('"sou uma IA" deixa de ser desculpa para não responder', () => {
    /* Foi a frase exata que a paciente recebeu. */
    expect(chat).toContain('NUNCA use "sou uma IA" como motivo para não responder');
  });

  test("recusar sem informar está nomeado como resposta RUIM", () => {
    /* Sem dizer isso com todas as letras, o modelo escolhe o caminho seguro
       para ele — que é o caminho inútil para ela. */
    expect(chat).toContain("Informe primeiro, encaminhe depois");
  });

  test("sem cobertura, a ordem é responder E DEPOIS registrar", () => {
    /* Antes era "limite-se a informações gerais", que o modelo leu como
       permissão para não dizer nada. Agora é uma obrigação, e o encaminhamento
       vem depois. */
    expect(chat).toContain("RESPONDA mesmo assim, com informação obstétrica consolidada");
    expect(chat).toContain("SÓ DEPOIS diga");
  });

  test("a fronteira de segurança continua de pé", () => {
    /* Informar mais não pode ter afrouxado o que realmente protege. */
    expect(chat).toContain("NUNCA dê diagnóstico, prescrição, dose de medicamento");
    expect(chat).toContain("192 (SAMU)");
    expect(chat).toContain("Não invente dados");
  });
});

/**
 * A BOLHA VAZIA.
 *
 * A paciente perguntou e recebeu uma bolha em branco: só os dois botões de
 * joinha e o horário. Nada para ler, nada para entender, e nenhum erro em
 * lugar nenhum.
 *
 * A causa é do Gemini 2.5: ele "pensa" antes de responder, e os tokens desse
 * raciocínio saem do MESMO orçamento da resposta. Numa pergunta que puxa
 * deliberação — e o prompt clínico daqui puxa — o modelo gasta o orçamento
 * pensando e entrega texto ZERO.
 *
 * Duas defesas, porque uma só não basta: tirar a causa (não deliberar) e não
 * deixar o sintoma chegar na tela (bolha muda vira frase honesta).
 */
describe("a resposta nunca chega vazia", () => {
  const chat = readFileSync("src/routes/api/chat.ts", "utf8");
  const app = readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8");

  test("o raciocínio do modelo está desligado", () => {
    /* Ele não é necessário aqui — o trabalho é informar bem e encaminhar o
       resto — e cada token dele é cobrado como SAÍDA, a parte cara. */
    expect(chat).toContain("thinkingConfig: { thinkingBudget: 0 }");
  });

  test("a saída tem teto", () => {
    /* Sem teto, uma pergunta aberta rende texto que ninguém lê e todo mundo
       paga. E é a saída que domina o custo. */
    expect(chat).toMatch(/maxOutputTokens: \d+/);
  });

  test("resposta vazia deixa rastro com o MOTIVO do término", () => {
    /* `MAX_TOKENS` com texto vazio diz "o raciocínio comeu o orçamento";
       `SAFETY` diz outra coisa e pede outro conserto. Sem o motivo, os dois
       são a mesma bolha em branco. */
    expect(chat).toContain("resposta VAZIA — finishReason=");
  });

  test("falha no streaming também é registrada", () => {
    expect(chat).toContain("[chat] stream falhou:");
  });

  test("a tela mostra uma frase honesta em vez de bolha muda", () => {
    expect(app).toContain("Não consegui formular a resposta agora. Pode perguntar de novo?");
  });

  test("o aviso NÃO aparece durante o streaming", () => {
    /* Enquanto a resposta chega, o texto nasce vazio — e isso é normal. Sem a
       guarda, toda resposta piscaria o aviso antes da primeira palavra. */
    expect(app).toContain("terminada={!(loading && i === messages.length - 1)}");
    expect(app).toContain("!isUser && terminada && !msg.content");
  });
});

describe("o filtro de segurança do provedor não engole a obstetrícia", () => {
  const chat = readFileSync("src/routes/api/chat.ts", "utf8");

  /* Desligar o raciocínio não bastou — a resposta continuou vindo vazia. O que
     sobra é o filtro do Gemini, mal calibrado para um app clínico:
     "sangramento", "dose", "dor intensa" são o vocabulário normal do pré-natal
     e caem em DANGEROUS_CONTENT. Ele bloqueia a resposta inteira e devolve
     texto zero, sem erro nenhum. */
  test("as quatro categorias estão em BLOCK_ONLY_HIGH", () => {
    for (const cat of [
      "HARM_CATEGORY_DANGEROUS_CONTENT",
      "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      "HARM_CATEGORY_HARASSMENT",
      "HARM_CATEGORY_HATE_SPEECH",
    ]) {
      expect(chat).toMatch(new RegExp(`${cat}", threshold: "BLOCK_ONLY_HIGH`));
    }
  });

  test("NÃO é `OFF` nem `BLOCK_NONE`", () => {
    /* O que protege este chat é o prompt (sem diagnóstico, sem prescrição, sem
       dose) e o cérebro do médico — mas isso não é motivo para desligar o
       filtro por completo. Alto continua barrando o que é de fato perigoso. */
    const bloco = chat.slice(chat.indexOf("safetySettings"), chat.indexOf("safetySettings") + 700);
    expect(bloco).not.toContain('"OFF"');
    expect(bloco).not.toContain('"BLOCK_NONE"');
  });

  test("o prompt não lista atos médicos como se fossem instruções", () => {
    /* "diagnosticar, prescrever, dar dose, mudar tratamento" numa lista
       imperativa é exatamente o que o classificador lê como conteúdo perigoso.
       A regra continua valendo — mudou só a forma de dizê-la. */
    expect(chat).not.toContain("diagnosticar, prescrever, dar dose, mudar tratamento");
    expect(chat).toContain("NUNCA dê diagnóstico, prescrição, dose de medicamento");
  });
});
