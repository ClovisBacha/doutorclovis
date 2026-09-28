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
import { ehSoSuporte, mereceFila } from "./secondbrain.server";

/**
 * A FUNÇÃO DE PRODUÇÃO, importada. Não uma cópia dela.
 *
 * Aqui morava uma reimplementação da regra — as mesmas quatro condições
 * escritas à mão neste arquivo. Ela usava `isSuporteDoApp` (UM sinal) enquanto
 * a de produção passou a usar `ehSoSuporte` (DOIS), e as duas divergiram em
 * 6 de 6 casos medidos: "o app travou e estou com dor de cabeça" dava `false`
 * aqui e `true` no ar. Um teste verde afirmando o oposto do que o produto faz
 * é pior que teste nenhum — foi ele que me deixou declarar o item pronto.
 *
 * Nome local mantido só pela legibilidade das asserções abaixo.
 */
const viraLacuna = mereceFila;

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

  /* CONSERTADO — e este teste é a prova de que foi.

     Ele nasceu invertido, documentando o defeito: citar o app derrubava a
     dúvida clínica junto, porque `isSuporteDoApp` casa com "app" em qualquer
     posição. A promessa do filtro era "na dúvida REGISTRA" e ele fazia o
     oposto: perdia a pergunta.

     A regra passou a exigir DOIS sinais (fala de app E não fala de corpo), e o
     teste virou junto. Note que ele só falhou — revelando o conserto — quando
     passou a importar a função de produção; enquanto reimplementava a regra
     aqui dentro, continuou verde afirmando o defeito que já não existia. */
  test("citar o app não derruba a pergunta clínica que vem junto", () => {
    expect(viraLacuna("adorei o app, mas posso tomar dipirona?")).toBe(true);
    expect(viraLacuna("no app não achei: posso tomar dipirona?")).toBe(true);
  });

  /* As frases de suporte que o verificador mediu vazando para a fila CLÍNICA
     do médico. Cada uma delas gerava o e-mail "sua IA não soube responder"
     sobre uma pergunta que ele não tem como responder. */
  test("cobrança e conta, em qualquer conjugação, são da plataforma", () => {
    expect(viraLacuna("como cancelo?")).toBe(false);
    expect(viraLacuna("como cancelo minha conta")).toBe(false);
    expect(viraLacuna("quero desativar minha conta")).toBe(false);
    expect(viraLacuna("como excluo meus dados")).toBe(false);
    expect(viraLacuna("vocês cobram alguma coisa?")).toBe(false);
  });

  test("falha técnica descrita na negativa é suporte", () => {
    expect(viraLacuna("não estou conseguindo entrar")).toBe(false);
    expect(viraLacuna("não consigo logar")).toBe(false);
    expect(viraLacuna("não consigo pagar a assinatura")).toBe(false);
    expect(viraLacuna("não carrega nada aqui")).toBe(false);
    expect(viraLacuna("não recebo as notificações")).toBe(false);
  });

  /* ─── O CASO DO MEIO, QUE NÃO TINHA TESTE ─────────────────────────────────
     "não consigo X" com X = VERBO DO CORPO, sem nenhum substantivo clínico.

     Escrevi o padrão como `não consigo \w+` — qualquer verbo — e validei
     contra os dois casos que ele acertava: "não consigo entrar" (suporte) e
     "não estou conseguindo sentir o bebê mexer" (clínica, que sobrevive só por
     ter "bebê" e "mexer"). O caso do meio ficou sem cobertura, e é justamente
     onde estava o defeito.

     Um verificador mediu contra o commit anterior e provou a regressão: seis
     frases que devolviam `true` passaram a devolver `false`. E `ehSoSuporte`
     não decide só a fila — decide o PROMPT: "não consigo respirar" (dispneia,
     bandeira vermelha de TEP e pré-eclâmpsia) recebia um bot de suporte
     técnico instruído a NÃO COMENTAR SINTOMAS, sem o cérebro do médico e sem
     lacuna registrada. Ele nunca ficaria sabendo.

     A lista de objetos de suporte é FECHADA agora. Estes testes são o que
     impede alguém de reabri-la com um `\w+` por conveniência. */
  test("verbo do corpo depois de 'não consigo' NUNCA é suporte", () => {
    expect(viraLacuna("não consigo respirar")).toBe(true);
    expect(viraLacuna("nao consigo respirar bem")).toBe(true);
    expect(viraLacuna("não estou conseguindo respirar direito")).toBe(true);
    expect(viraLacuna("não dá para respirar")).toBe(true);
    expect(viraLacuna("não consigo dormir de tanta azia")).toBe(true);
    expect(viraLacuna("não consigo urinar")).toBe(true);
    expect(viraLacuna("não consigo fazer xixi")).toBe(true);
    expect(viraLacuna("não estou conseguindo comer nada")).toBe(true);
    expect(viraLacuna("não consigo me alimentar direito")).toBe(true);
    expect(viraLacuna("não consigo abaixar")).toBe(true);
  });

  test("gíria de elogio também não vira trabalho clínico", () => {
    expect(viraLacuna("vcs sao demais")).toBe(false);
    expect(viraLacuna("melhor coisa que já usei")).toBe(false);
    expect(viraLacuna("vocês arrasam")).toBe(false);
  });

  /* O contrapeso das duas listas acima: alargar o filtro de suporte não pode
     começar a comer queixa de corpo. Toda frase aqui menciona algo clínico e
     TEM que continuar chegando ao médico. */
  test("alargar o suporte não pode engolir queixa clínica", () => {
    expect(viraLacuna("não estou conseguindo sentir o bebê mexer")).toBe(true);
    expect(viraLacuna("não carrega o resultado do meu exame de sangue")).toBe(true);
    expect(viraLacuna("quero cancelar minha cesárea, é possível?")).toBe(true);
    expect(viraLacuna("estou com dor demais na barriga")).toBe(true);
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

describe("as duas pontas não podem divergir", () => {
  /**
   * A condição vive em dois lugares: a que grava a lacuna e a que autoriza a
   * IA a dizer "registrei aqui para ele ver". Elas eram duas CÓPIAS — idênticas
   * em forma e diferentes em argumento: uma filtrava o texto cortado em 300
   * caracteres, a outra o texto inteiro.
   *
   * Numa mensagem longa com a palavra de suporte depois do caractere 300, uma
   * registrava e a outra negava. A IA dizia "não registrei" sobre algo que
   * estava na fila dele — ou o contrário, que é pior.
   *
   * Agora é uma função só. Não é que elas concordem: é que não há duas.
   */
  const chat = readFileSync("src/routes/api/chat.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
  const server = readFileSync("src/lib/secondbrain.server.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");

  test("o chat usa a MESMA função, não uma cópia da regra", () => {
    expect(chat).toContain("const gapWasLogged = mereceFila(userText);");
    expect(chat).not.toContain("normalizeGapQuestion(userText).length >= 8");
  });

  test("a gravação usa a mesma função", () => {
    expect(server).toContain("if (!mereceFila(question)) return;");
  });

  test("a função corta o texto uma vez só, dentro dela", () => {
    /* Era o ponto exato da divergência: cada lado cortava por conta própria. */
    expect(server).toContain("export function mereceFila(pergunta: string): boolean {");
    expect(server).toContain("const clean = pergunta.trim().slice(0, 300);");
  });

  test("usa DOIS sinais para suporte, não um", () => {
    /* Com `isSuporteDoApp` sozinho, "o app travou e estou com dor de cabeça"
       tinha a queixa clínica DESCARTADA da fila. Uma dor de cabeça sumindo
       porque a frase citava o aplicativo é o erro mais caro deste filtro. */
    const corpo = server.slice(server.indexOf("export function mereceFila"));
    expect(corpo.slice(0, 400)).toContain("!ehSoSuporte(clean)");
    expect(corpo.slice(0, 400)).not.toContain("!isSuporteDoApp(clean)");
  });
});

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
  /* ⚠️ O chat (ChatTab, WABubble, buildPatientContext…) saiu de minha-conta.tsx
     para src/components/chat-tab.tsx em set/2026. Este teste confere coisas dos
     DOIS arquivos, então lê os dois juntos — uma asserção que procura texto do
     chat aqui continua encontrando. */
  const app =
    readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8") +
    "\n" +
    readFileSync("src/components/chat-tab.tsx", "utf8");

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
    expect(chat).toContain("[chat] stream falhou — HTTP");
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

describe("o log do erro cabe na primeira linha", () => {
  const chat = readFileSync("src/routes/api/chat.ts", "utf8");

  /* O log da Vercel corta na largura da coluna, e o objeto de erro do SDK põe
     o que interessa NO FIM — "RetryError: Failed after 3 attempts…" e só
     depois a causa real. A primeira tentativa de diagnóstico mostrou
     "Failed a…" e mais nada: uma hora perdida por causa de ordem de texto. */
  test("status HTTP vem antes de qualquer prosa", () => {
    expect(chat).toContain("[chat] stream falhou — HTTP ${status}");
  });

  test("desembrulha o erro do SDK até a causa", () => {
    /* `RetryError` embrulha o erro real em `lastError`. Logar o de fora conta
       que houve tentativa; só o de dentro conta POR QUÊ. */
    expect(chat).toContain("e?.lastError ?? e?.cause ?? e");
  });

  test("o corpo da resposta é truncado", () => {
    /* Alguns provedores devolvem HTML de página de erro inteiro. */
    /* O prettier quebra a chamada em várias linhas, então a asserção olha o
       corte sem depender de onde a quebra caiu. */
    expect(chat.replace(/\s+/g, " ")).toContain(".slice( 0, 300, )");
  });
});

/**
 * A TABELA. Frase → o que tem que acontecer.
 *
 * Cada linha aqui saiu de uma medição, não de imaginação: um avaliador rodou
 * as funções de produção contra 100 frases inventadas e trouxe as que erravam.
 * Treze classes de erro, e cinco delas eram queixa de corpo classificada como
 * suporte técnico — o erro caro, porque `ehSoSuporte` não decide só a fila,
 * decide o PROMPT: vira um bot proibido de comentar sintomas, sem o cérebro do
 * médico e sem lacuna registrada.
 *
 * A seção ACENTUADA é obrigatória e não pode encolher. Duas vezes nesta base
 * um filtro morreu por ASCII: primeiro o `\b` (que nunca casava "ótimo"),
 * depois o `\w*` (que parava no "ç" de "contração"). Toda palavra clínica de
 * verdade tem acento em português.
 */
describe("a tabela do portão — medida, não imaginada", () => {
  /* CLÍNICAS: têm que chegar ao médico. Errar aqui é o erro caro. */
  const clinicas = [
    "estou com dor de cabeça",
    "posso tomar dipirona?",
    "não sinto meu bebê desde ontem",
    "não consigo respirar",
    "não consigo dormir de tanta azia",
    "quanto de peso é normal ganhar?",
    // ── ACENTUADAS: o `\w*` ASCII parava antes da cedilha e do til ──────────
    "o app não abre e estou com contração de 5 em 5 minutos",
    "não consigo abrir o app e estou tendo contrações fortes",
    "não consigo entrar, minha secreção mudou de cor",
    "o aplicativo travou, minha secreção está com sangue",
    "quanto custa? estou com inchaço no rosto",
    "minha gestação está de quantas semanas?",
    "dúvida sobre amamentação",
    "estou com sangue na urina",
    "não consigo registrar minha contração",
    // ── reclamação de atendimento: não é clínica, mas é dele ────────────────
    "esse app é ótimo mas ninguém responde minhas dúvidas",
  ];

  /* SUPORTE: a plataforma resolve, o médico não é incomodado. */
  const suporte = [
    "como cancelo?",
    "quanto custa o plano?",
    "o app travou",
    "não recebo as notificações",
    "quando sai a atualização do app?",
    "posso pagar no pix?",
    "como eu saio da conta nesse celular?",
    "quero apagar minhas fotos do álbum",
    "como faço para trocar de médico por aqui?",
    "a aba de contrações não abre",
    "não consigo entrar",
  ];

  /* CORTESIA e ELOGIO: não viram trabalho para ninguém. */
  const silenciosas = [
    "entendi, valeu",
    "ta bom então",
    "beleza, tchau",
    "muito obrigada mesmo",
    "obrigada doutora",
    "bom dia",
    "vocês são ótimos",
    "vcs sao demais",
    "perfeitíssimo esse app",
    "adorei o app!",
  ];

  for (const frase of clinicas) {
    test(`CLÍNICA → fila: "${frase}"`, () => {
      expect(viraLacuna(frase)).toBe(true);
    });
  }
  for (const frase of suporte) {
    test(`SUPORTE → não vai ao médico: "${frase}"`, () => {
      expect(viraLacuna(frase)).toBe(false);
    });
  }
  for (const frase of silenciosas) {
    test(`SILÊNCIO → nada acontece: "${frase}"`, () => {
      expect(viraLacuna(frase)).toBe(false);
    });
  }

  /* O prompt é a outra metade da decisão, e a mais perigosa das duas: só ela
     pode trocar o assistente clínico por um bot proibido de falar de sintoma. */
  test("nenhuma frase clínica cai no prompt de suporte", () => {
    const erradas = clinicas.filter((f) => ehSoSuporte(f));
    expect(erradas).toEqual([]);
  });
});

/**
 * A FRASE MISTA — o defeito mais perigoso deste filtro, e o mais teimoso.
 *
 * `ehSoSuporte` não decide só a fila: decide o PROMPT. Quando dá `true`, o
 * chat troca o assistente clínico por um bot de suporte instruído a NÃO
 * COMENTAR SINTOMAS — sem o cérebro do médico, sem as medidas, sem lacuna.
 *
 * A regra era "fala de app E não fala de corpo", com o corpo vindo de uma
 * ALLOWLIST de vocabulário. Allowlist clínica é lista que nunca fica pronta:
 * um avaliador mediu 61 de 85 termos comuns invisíveis — `aborto`,
 * `pré-eclâmpsia`, `convulsão`, `desmaio`, `visão embaçada`, `trombose`,
 * `bolsa rota`, `depressão`. Resultado: 25 de 30 frases mistas viravam suporte,
 * incluindo *"o aplicativo não funciona e eu quero morrer"*.
 *
 * O conserto não foi engordar a lista — foi mudar a pergunta: TODA oração
 * precisa ser de suporte. Uma oração com conteúdo próprio e sem sinal de app
 * devolve a frase ao caminho clínico. Mais as bandeiras vermelhas, que vencem
 * tudo e existem justamente para a palavra que ninguém lembrou.
 */
describe("frase mista: app + corpo nunca é suporte puro", () => {
  const perigosas = [
    "não consigo respirar e o app não abre",
    "o app não abre e minha visão está embaçada",
    "socorro, desmaiei agora, e o app travou",
    "o aplicativo não funciona e eu quero morrer",
    "não consigo entrar e estou com muita tristeza, penso em me machucar",
    "quero cancelar minha assinatura porque perdi a gestação",
    "quero excluir minha conta, tive um aborto",
    "não consigo pagar a assinatura, estou no hospital com pré-eclâmpsia",
    "o app não abre e tive uma convulsão ontem",
    "não consigo entrar no app, minha bolsa rompeu",
    "o site caiu e eu caí da escada agora",
    "quero cancelar, estou com trombose na perna",
    "o aplicativo bugou e meu coração está disparado",
    "não consigo entrar e meu mamilo está rachado e sangrando",
    "o app trava e tenho depressão pós-parto",
    "o app não abre, é normal ter falta de ar?",
  ];
  for (const frase of perigosas) {
    test(`NÃO vira bot de suporte: "${frase}"`, () => {
      expect(ehSoSuporte(frase)).toBe(false);
    });
  }

  /* O contrapeso. Endurecer o portão não pode passar a mandar queixa técnica
     bem escrita para a fila clínica do médico — ela tem mais de uma oração e
     continua sendo sobre a MESMA coisa. */
  const tecnicas = [
    "não consigo entrar no app, já tentei de tudo",
    "não consigo entrar, já tentei várias vezes no meu celular",
    "o app travou",
    "como cancelo?",
    "quanto custa o plano?",
    "posso pagar no pix?",
    "não recebo as notificações",
    "quero apagar minhas fotos do álbum",
  ];
  for (const frase of tecnicas) {
    test(`continua sendo suporte: "${frase}"`, () => {
      expect(ehSoSuporte(frase)).toBe(true);
    });
  }
});
