/**
 * A cota de respostas por médico.
 *
 * Dois livros-caixa que nunca se tocam: o do Google é UM, da plataforma
 * inteira, medido em tokens; o do plano é por médico, medido em mensagens. O
 * Google não sabe que existem médicos — a chave é uma só, e qualquer limite lá
 * cortaria todos ao mesmo tempo, inclusive quem nem usou.
 *
 * O que estes testes protegem não é a contabilidade. É a decisão de produto que
 * está por baixo dela: **quem paga o preço quando a cota acaba.**
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { AVISO_EM, inicioDoCiclo, situacaoDaCota } from "./cota-ia.server";

function codigoDe(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
}

describe("a régua", () => {
  test("abaixo de 80% está tudo bem", () => {
    expect(situacaoDaCota(0, 500).estado).toBe("ok");
    expect(situacaoDaCota(399, 500).estado).toBe("ok");
  });

  test("a partir de 80% avisa", () => {
    expect(situacaoDaCota(400, 500).estado).toBe("aviso");
    expect(situacaoDaCota(499, 500).estado).toBe("aviso");
  });

  test("no teto, estoura — e não um antes", () => {
    /* Cortar em 499 tiraria do médico uma resposta que ele pagou. */
    expect(situacaoDaCota(499, 500).estado).toBe("aviso");
    expect(situacaoDaCota(500, 500).estado).toBe("estourada");
    expect(situacaoDaCota(900, 500).estado).toBe("estourada");
  });

  test("o aviso vem antes do estouro, sempre", () => {
    expect(AVISO_EM).toBeGreaterThan(0);
    expect(AVISO_EM).toBeLessThan(1);
  });

  test("teto nulo é ilimitado, não zero", () => {
    /* Contrato sob medida (Clínica). Confundir `null` com 0 cortaria o cliente
       que paga mais. */
    expect(situacaoDaCota(999_999, null).estado).toBe("ok");
  });

  test("teto ZERO é plano sem IA, e não cota estourada", () => {
    /* Quem barra o plano sem IA é o entitlement, muito antes daqui. Tratar
       como "estourada" faria o painel dizer "sua cota acabou" a quem nunca
       teve o recurso — e sugerir que subir de plano devolveria algo que ele
       nunca teve. */
    expect(situacaoDaCota(0, 0).estado).toBe("ok");
    expect(situacaoDaCota(10, 0).estado).toBe("ok");
  });
});

describe("o ciclo", () => {
  test("começa no primeiro dia do mês", () => {
    const i = inicioDoCiclo(new Date(2026, 7, 20, 15, 30));
    expect(i.getDate()).toBe(1);
    expect(i.getMonth()).toBe(7);
    expect(i.getHours()).toBe(0);
  });

  test("vira quando o mês vira", () => {
    const julho = inicioDoCiclo(new Date(2026, 6, 31, 23, 59));
    const agosto = inicioDoCiclo(new Date(2026, 7, 1, 0, 1));
    expect(agosto.getTime()).toBeGreaterThan(julho.getTime());
  });
});

describe("na dúvida, o médico é atendido", () => {
  const fonte = codigoDe("src/lib/cota-ia.server.ts");

  test("falha de banco devolve ZERO, não estouro", () => {
    /* Uma cota que se fecha sozinha por um soluço de rede tiraria o cérebro do
       médico do ar sem ele ter feito nada — e ele descobriria pela paciente. */
    expect(fonte).toContain("return 0;");
    expect(fonte).toContain('ultimaFalha = (error as { code?: string })?.code === "42P01"');
    /* Devolver 0 na falha continua certo — o que mudou é que o MOTIVO sobe
       junto. Sem ele, "não consegui medir" e "você não usou nada" produziam a
       mesma tela, e o médico com migration pendente lia "nenhuma resposta
       ainda neste ciclo" enquanto as pacientes conversavam. */
    expect(fonte).toContain("export function motivoDaUltimaContagem()");
  });

  test("conta só a RESPOSTA, não memória nem embedding", () => {
    /* As três custam e as três estão medidas. Mas o que se VENDE é a resposta:
       cobrar um resumo de memória que ele não pediu e não vê seria vender uma
       unidade que ele não consegue conferir. */
    expect(fonte).toContain('.eq("especie", "chat")');
  });

  test("a contagem não traz as linhas", () => {
    /* Isto roda a cada mensagem. */
    expect(fonte).toContain('{ count: "exact", head: true }');
  });
});

describe("o que a paciente perde quando a cota acaba", () => {
  const cerebro = codigoDe("src/lib/secondbrain.server.ts");

  test("ela perde o cérebro do MÉDICO — não a resposta", () => {
    /* Bloquear a resposta transferiria para a gestante a consequência de um
       limite que não é dela e que ela não pode resolver. */
    expect(cerebro).toMatch(/cota\.estado === "estourada"[\s\S]{0,400}block: ""/);
  });

  test("a dúvida dela ENTRA na fila do médico mesmo assim", () => {
    /* Sem isto, a cota estourada apagaria a pergunta: ele nunca saberia o que
       ela quis saber, e ela esperaria por uma resposta que ninguém registrou. */
    const trecho = cerebro.slice(cerebro.indexOf('cota.estado === "estourada"'));
    /* `logBrainGapAgora`, e a promessa sai no `gravacaoDaLacuna`: a versão
       disparada-e-esquecida podia ser morta pelo congelamento da função
       serverless, e aí a promessa "registrei para ela ver" virava mentira. */
    expect(trecho.slice(0, 400)).toContain(
      "gravacaoDaLacuna: logBrainGapAgora(target, userMessage, channel, patientId",
    );
  });

  test("a checagem vem ANTES da busca semântica", () => {
    /* Depois dela custaria uma consulta ao banco, um embedding e uma varredura
       vetorial para descobrir algo já sabido — e economizar importa mais
       justamente no médico que estourou a conta. */
    const posCota = cerebro.indexOf("cotaDoMedico(target");
    const posBusca = cerebro.indexOf("embedText(textoParaVetor(userMessage)");
    expect(posCota).toBeGreaterThan(0);
    expect(posCota).toBeLessThan(posBusca);
  });

  test("o painel do médico continua funcionando com a cota estourada", () => {
    /* Ele não pode ficar sem testar a própria IA justamente enquanto decide se
       sobe de plano. */
    expect(cerebro).toContain('if (channel !== "teste") {');
  });
});

describe("o médico vê antes de estourar", () => {
  const painel = readFileSync("src/routes/_authenticated/painel.tsx", "utf8");

  test("o aviso aparece no painel", () => {
    expect(painel).toContain("Cota do mês esgotada");
    expect(painel).toContain("respostas deste mês");
  });

  test("mostra o NÚMERO, não só a porcentagem", () => {
    /* "400 de 500" permite decidir se sobe de plano; "80%" não diz nada
       acionável. */
    expect(painel).toContain("{cota.usadas} de {cota.teto}");
  });

  test("nada aparece enquanto está tudo bem", () => {
    expect(painel).toContain('cota.estado !== "ok"');
  });

  /* ─── O CONSUMO NÃO PODE DEPENDER DO PLACAR ──────────────────────────────
     Os dois viviam no MESMO card, e o card devolve `null` quando `stats` é
     nulo — o que acontece se qualquer uma de `brain_hits`/`brain_gaps`/
     `brain_feedback` falhar. Em produção, com migrations pendentes, a cota
     carregava certinho e a barra simplesmente não aparecia, por causa de três
     tabelas de telemetria que não têm nada a ver com cota.
     Separá-los foi o conserto; estes testes são o que impede a religação. */
  test("o consumo tem card próprio, com a própria leitura", () => {
    expect(painel).toContain("function ConsumoDaIACard(");
    const card = painel.slice(painel.indexOf("function ConsumoDaIACard("));
    expect(card.slice(0, 1200)).toContain("cotaDeRespostas({");
  });

  /**
   * A fatia do card do consumo, delimitada de verdade.
   *
   * Estes três testes usavam `function BrainScoreCard(` como fronteira — e o
   * placar foi FUNDIDO no card do anel. `indexOf` passou a devolver `-1`, o
   * `slice` virou outra coisa, e os três continuaram verdes por acidente.
   * Fronteira que some sem quebrar o teste é fronteira que não protege nada.
   */
  function fatiaDoConsumo(fonte: string): string {
    const ini = fonte.indexOf("function ConsumoDaIACard(");
    const fim = fonte.indexOf("\nfunction ", ini + 10);
    expect(ini).toBeGreaterThan(0);
    expect(fim).toBeGreaterThan(ini);
    return fonte.slice(ini, fim);
  }

  test("o card do consumo não some junto com o placar", () => {
    /* A única condição de sumiço dele é sobre a PRÓPRIA cota.
       SEM COMENTÁRIOS: a docstring vizinha fala de `stats` para explicar por
       que a separação existe, e um `not.toContain` cru casaria com a própria
       explicação — o erro que já custou quatro rodadas nesta base. */
    const card = fatiaDoConsumo(codigoDe("src/routes/_authenticated/painel.tsx"));
    expect(card).toContain("if (cota === null)");
    expect(card).not.toContain("stats");
  });

  test("o placar foi FUNDIDO no card do anel — não há dois", () => {
    /* Dois cards na mesma faixa respondiam "como está o meu cérebro" com
       números diferentes, e o médico tinha que decidir qual era o verdadeiro.
       O anel é a nota; os três tiles são de onde ela vem. */
    expect(painel).not.toContain("function BrainScoreCard(");
    const anel = painel.slice(
      painel.indexOf("function BrainLevelCard("),
      painel.indexOf("function ConsumoDaIACard("),
    );
    expect(anel).toContain("getBrainQualityStats");
    expect(anel).toContain("Dúvidas que o cérebro cobriu");
    expect(anel).not.toContain("cotaDeRespostas");
  });

  test("o consumo aparece nos DOIS lugares — decisão do Clóvis", () => {
    /* Na aba Cérebro ele lê "quanto do meu trabalho rendeu"; em Meu Perfil,
       junto do teto de pacientes e da cobrança, lê "quanto do meu plano estou
       usando". Mesma medida, duas perguntas — e o card já sabe carregar
       sozinho, então não custa estado nem prop nova. */
    const usos = (painel.match(/<ConsumoDaIACard\b/g) ?? []).length;
    expect(usos).toBe(2);
    const perfil = painel.slice(painel.indexOf("function MeuPerfilSection("));
    expect(perfil).toContain("<ConsumoDaIACard");
  });

  test("a contagem das três filas aparece na faixa", () => {
    /* Sem o número, o médico rolava as três filas para descobrir se havia
       trabalho — e as três, vazias, são ~400px de "nada". */
    expect(painel).toContain("const esperando = fila.lacunas + fila.revisao + fila.perguntas;");
    expect(painel).toContain("onContar={(n) => setFila((f) => ({ ...f, lacunas: n }))}");
    expect(painel).toContain("onContar={(n) => setFila((f) => ({ ...f, revisao: n }))}");
    expect(painel).toContain("onContar={(n) => setFila((f) => ({ ...f, perguntas: n }))}");
  });

  test("plano ilimitado também vê o próprio consumo", () => {
    /* Antes a barra exigia `teto > 0`, então justamente quem paga mais não
       enxergava nada. */
    expect(fatiaDoConsumo(painel)).toContain("plano sem limite");
  });
});

describe("todo plano tem teto declarado", () => {
  const ent = readFileSync("src/lib/entitlements.ts", "utf8");

  test("o campo existe no tipo", () => {
    expect(ent).toContain("aiRepliesPerCycle: number | null;");
  });

  test("nenhum plano ficou sem valor", () => {
    /* Oito planos. Um sem teto declarado herdaria `undefined`, que não é nem
       ilimitado nem zero — é comportamento indefinido em cima de dinheiro. */
    const declarados = (ent.match(/^\s*aiRepliesPerCycle: /gm) ?? []).length;
    expect(declarados).toBeGreaterThanOrEqual(8);
  });

  test("plano sem IA tem teto ZERO, não nulo", () => {
    /* `null` quer dizer ilimitado. Um plano Free com `null` daria IA infinita
       de graça. */
    const free = ent.slice(ent.indexOf("const FREE: Entitlements"), ent.indexOf("const ESSENCIAL"));
    expect(free).toContain("aiRepliesPerCycle: 0,");
  });

  test("o teto cresce junto com o preço", () => {
    const teto = (nome: string) => {
      const bloco = ent.slice(ent.indexOf(`const ${nome}: Entitlements`));
      return Number((bloco.match(/aiRepliesPerCycle: ([\d_]+)/)?.[1] ?? "0").replace(/_/g, ""));
    };
    expect(teto("ESSENCIAL")).toBeLessThan(teto("STARTER"));
    expect(teto("STARTER")).toBeLessThan(teto("PRO"));
    expect(teto("PRO")).toBeLessThan(teto("ELITE"));
    expect(teto("ELITE")).toBeLessThan(teto("BLACK"));
  });
});

/**
 * O QUE A PACIENTE OUVE QUANDO A COTA DO MÉDICO ACABA.
 *
 * Sem cobertura e cota esgotada produzem o MESMO bloco vazio e pedem respostas
 * OPOSTAS:
 *
 *   sem cobertura → "registrei aqui para ele ver" — e a promessa se cumpre,
 *                   porque a lacuna entra na fila dele.
 *   cota esgotada → ele NÃO vai responder pelo app. Repetir a mesma frase
 *                   seria mentir e deixar a paciente esperando por algo que
 *                   não vem.
 *
 * Por isso `cotaEsgotada` é um campo próprio, e não uma dedução a partir do
 * bloco vazio.
 */
describe("a paciente é avisada com honestidade, não com jargão", () => {
  const chat = readFileSync("src/routes/api/chat.ts", "utf8");
  const cerebro = readFileSync("src/lib/secondbrain.server.ts", "utf8");

  test("`cotaEsgotada` é um campo do contexto, não uma dedução", () => {
    expect(cerebro).toContain("cotaEsgotada: boolean;");
    expect(cerebro).toContain("cotaEsgotada: true,");
  });

  test("o aviso tem instrução PRÓPRIA, escolhida antes das outras", () => {
    /* Se ele viesse depois, a regra de "sem cobertura" ganharia e a promessa
       impossível voltaria.
       A asserção é sobre a POSIÇÃO na cadeia, e não sobre qual condição vem
       primeiro: um terceiro estado entrou no meio (plano sem IA) e o teste
       reprovou sem que nada tivesse regredido. Prender ao texto exato do
       primeiro ramo era prender à ordem entre os avisos, que não importa —
       importa que TODOS venham antes da cobertura. */
    const posCota = chat.indexOf("? avisoDeCota");
    const posCobertura = chat.indexOf("brain.enabledApp && brain.hadCoverage");
    expect(posCota).toBeGreaterThan(0);
    expect(posCobertura).toBeGreaterThan(posCota);
  });

  test("plano sem IA também tem instrução própria, e antes da cobertura", () => {
    /* O caso vizinho da cota, e PIOR que ela: a cota volta na virada do mês, o
       plano vencido não volta sozinho. Antes disto o ramo nem existia — a
       paciente perdia a voz do médico em silêncio absoluto, e a dúvida dela
       nem entrava na fila dele. */
    const posSemPlano = chat.indexOf("? avisoSemPlano");
    const posCobertura = chat.indexOf("brain.enabledApp && brain.hadCoverage");
    expect(posSemPlano).toBeGreaterThan(0);
    expect(posCobertura).toBeGreaterThan(posSemPlano);
    /* E a CONDIÇÃO tem que ser `brain.semPlano`. Só a posição não bastava:
       uma mutação trocou a condição por `false` — o ramo virou código morto e
       o texto continuava lá, com o teste verde. O aviso existia e nunca saía. */
    expect(chat).toContain("const confianca = brain.semPlano");
  });

  test("o aviso de plano PROÍBE falar de dinheiro", () => {
    /* A relação comercial é entre o médico e a plataforma. Explicá-la à
       paciente seria constrangê-lo na frente de quem ele atende — e ela não
       tem o que fazer com essa informação.
       A asserção é sobre a PROIBIÇÃO existir, e não sobre a ausência das
       palavras: elas aparecem de propósito na linha que manda o modelo não
       usá-las, e um `not.toContain("pagamento")` reprovaria justamente a
       proteção. É a terceira vez que caio nisso nesta base — a lição é que
       texto de prompt fala SOBRE as palavras que proíbe. */
    const aviso = chat.slice(chat.indexOf("const avisoSemPlano"), chat.indexOf("const confianca"));
    expect(aviso).toContain("sem falar em plano, assinatura, pagamento ou limite");
    // E oferece o caminho até ele, que é o que impede o beco sem saída.
    expect(aviso).toContain("SEMPRE ofereça o caminho até ele");
  });

  test("diz a VERDADE sobre o registro — que é o que acontece", () => {
    /* O prompt mandava a IA dizer que NÃO registrou. Mas
       `getBrainContext` grava a lacuna mesmo com a cota estourada
       (`secondbrain.server.ts`, no ramo `estourada`), e ao respondê-la o médico
       dispara `entregarRespostaDaLacuna` → a paciente RECEBE.
       Ou seja: o produto fazia certo e mentia sobre isso. O que não se pode
       prometer é resposta pelo app NESTE ciclo — não o registro. */
    expect(chat).toContain("A dúvida FICA REGISTRADA para ${medico}");
    expect(chat).toContain("O que você NÃO promete é resposta pelo app agora");
  });

  test("não fala de cota, plano nem pagamento com a paciente", () => {
    /* O problema comercial é entre a plataforma e o médico. Jogar isso na
       conversa da gestante a constrange e não resolve nada para ela. */
    expect(chat).toContain("sem falar em cota, plano, pagamento ou limite");
  });

  test("oferece um caminho REAL até o médico", () => {
    /* "Fale com sua médica" sem dizer como é o mesmo que não dizer nada. */
    expect(chat).toContain("patient.doctorWhatsapp");
    expect(chat).toContain("pelo WhatsApp do consultório");
  });

  test("sem WhatsApp cadastrado, o caminho continua CONCRETO", () => {
    /* "pelo canal que ela já usa com o consultório" é exatamente o não-resposta
       que o próprio `medicalSystemPrompt` condena ("uma resposta que só diz
       'converse com sua médica' e não informa nada é uma resposta RUIM"). A aba
       Consultas existe, chega ao consultório, e é acionável às 3 da manhã. */
    expect(chat).toContain('"pela aba Consultas do app, que chega direto ao consultório"');
  });

  test("o caminho até ela é INCONDICIONAL", () => {
    /* Era "SE a pergunta for daquelas que só quem acompanha pode decidir" —
       opcional a critério do modelo. Numa dúvida geral às 3 da manhã, ela lia
       "isto não é a orientação da sua médica" e não recebia saída nenhuma. */
    const aviso = chat.slice(chat.indexOf("const avisoDeCota"));
    expect(aviso.slice(0, 1400)).toContain("SEMPRE ofereça o caminho até ela");
    expect(aviso.slice(0, 1400)).toContain("Isto não é opcional");
  });

  test("o aviso tem PRAZO — senão a paciente conclui o pior", () => {
    /* Proibir "cota, plano, pagamento, limite" tinha virado "sem explicação".
       Uma gestante ansiosa lendo "esta resposta não é a orientação da sua
       médica", sem causa e sem prazo, conclui a coisa mais assustadora
       disponível: que a médica parou de acompanhá-la. "Até a virada do mês" é
       a verdade, dá prazo, e não diz uma palavra sobre dinheiro. */
    /* A janela cresceu: entre a declaração e o texto entrou `seguirAcompanhamento`,
       que existe porque os dois avisos afirmavam "o acompanhamento da GESTAÇÃO
       segue normalmente" — no mesmo prompt do bloco que proíbe falar em
       gestação, e marcado com IMPORTANTE, ou seja, ganhando dele. Bastava a
       cota estourar para a IA anunciar a gestação a quem a perdeu. */
    /* SEM COMENTÁRIOS: a janela é medida em bytes a partir de um marcador, e o
       bloco que explica a decisão do dono entrou entre os dois. É a terceira
       vez hoje que uma janela fixa encolhe a própria cobertura quando o código
       ganha explicação. */
    const semComentarios = chat.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const aviso = semComentarios.slice(semComentarios.indexOf("const seguirAcompanhamento"));
    expect(aviso.slice(0, 1800)).toContain("até a virada do mês");
    /* SEM GÊNERO: "Ela continua acompanhando" era feminino fixo, enquanto
       `${medico}` é montado como "o(a) …". Numa plataforma multi-médico — e
       com o dono desta instalação sendo homem — a frase saía errada. */
    expect(aviso.slice(0, 1400)).toContain("O acompanhamento da gestação segue normalmente");
    expect(aviso.slice(0, 1400)).not.toContain("Ela continua acompanhando");
    /* ─── O PRAZO NA PRIMEIRA FRASE, e não em algum lugar do bloco ──────────
       Uma mutação sobreviveu à bateria: tirar o prazo do cabeçalho e deixá-lo
       só no item 3 mantinha o teste verde. A propriedade continuava tecnicamente
       verdadeira, mas o motivo escrito no código é sobre O QUE ELA LÊ PRIMEIRO —
       "uma gestante ansiosa que lê aquilo sem causa e sem prazo conclui a coisa
       mais assustadora disponível". Um prazo enterrado no terceiro item não
       cumpre isso. */
    const abertura = aviso.slice(
      aviso.indexOf("const avisoDeCota"),
      aviso.indexOf("Como agir, NESTA ORDEM"),
    );
    expect(abertura).toContain("virada do mês");
  });

  /* ─── DECISÃO DO DONO (ago/2026): O LIMITE PASSA A SER DITO ───────────────
     Antes, a IA respondia a dúvida com informação consolidada e nunca
     mencionava limite — "primeiro serve, depois explica". O efeito colateral
     era que NINGUÉM sentia o limite: o médico recebia o push de 80% e 100% e
     podia ignorar os dois, porque nada mudava para ele.
     Agora a dúvida COMUM não é respondida — a paciente vai ao WhatsApp dele, e
     é ele quem sente. O que NÃO mudou, e não pode mudar, é a urgência. */
  test("URGÊNCIA é respondida antes de tudo, e sem mencionar limite", () => {
    /* A trava que substitui a antiga. Um app de gestação de ALTO RISCO que cala
       às 3 da manhã por causa de uma fatura não é um produto, é um risco. */
    const aviso = chat.slice(
      chat.indexOf("const avisoDeCota"),
      chat.indexOf("const avisoSemPlano"),
    );
    const posUrgencia = aviso.indexOf("1. URGÊNCIA VEM ANTES DE TUDO E NÃO TEM LIMITE");
    const posDemais = aviso.indexOf("3. Para as demais dúvidas");
    expect(posUrgencia).toBeGreaterThan(0);
    expect(posUrgencia).toBeLessThan(posDemais);
    /* E na urgência o limite é INVISÍVEL — não é só "responda também". */
    expect(aviso).toContain("você NÃO menciona limite nenhum");
  });

  test("a lista de urgência vem da fonte única, não de uma cópia", () => {
    /* O CLAUDE.md proíbe duplicar limite clínico. A lista vivia como variável
       local dentro de `medicalSystemPrompt`; quando o aviso de cota passou a
       precisar dela, copiá-la teria criado uma segunda régua. */
    expect(chat).toContain("sinaisDeUrgencia(patient.careMode)");
    expect(chat).toContain("export function sinaisDeUrgencia(");
  });

  test("e o limite nunca é apresentado como escolha do médico", () => {
    /* A IA carrega a marca dele. Dizer à cliente dele que ele "cortou custo" no
       cuidado dela custa mais caro que a diferença entre dois planos. */
    const aviso = chat.slice(
      chat.indexOf("const avisoDeCota"),
      chat.indexOf("const avisoSemPlano"),
    );
    expect(aviso).toContain("O limite é DA PLATAFORMA, não dele");
  });

  test("o WhatsApp vem da coluna das PACIENTES, não do pessoal", () => {
    /* `personal_phone` existe justamente para nunca ser exposto. */
    expect(chat).toContain('.select("display_name,whatsapp")');
    expect(chat).not.toContain("personal_phone");
  });
});

/**
 * O CONSUMO PRECISA SER VISTO, NÃO LIDO.
 *
 * "340 respostas" não diz se é muito. A barra diz na largura, antes de
 * qualquer leitura — é a diferença entre informar e fazer entender.
 *
 * E o total responde "quanto". A pergunta seguinte, que é a que o médico de
 * fato faz, é "quem": numa fila de cinquenta gestantes, três costumam
 * responder por metade das conversas.
 */
describe("o consumo aparece antes de virar problema", () => {
  const painel = readFileSync("src/routes/_authenticated/painel.tsx", "utf8");

  test("a barra aparece com qualquer uso, não só no aviso", () => {
    /* Descobrir o limite só quando ele está perto é descobrir tarde. */
    expect(painel).toContain("const temTeto = cota.teto != null && cota.teto > 0;");
  });

  test('"não sei medir" e "você não usou" são telas DIFERENTES', () => {
    /* `respostasNoCiclo` devolve 0 quando `ai_usage` não existe (migration
       pendente). Com `usadas <= 0 → null`, o card sumia exatamente no cenário
       que o refator dele veio corrigir — só que por outro caminho. */
    expect(painel).toContain('<div className="skeleton h-24 rounded-3xl" />');
    expect(painel).toContain("Nenhuma resposta ainda neste ciclo");
  });

  test("responde 'vou estourar antes do fim do mês?'", () => {
    /* A barra respondia "quanto usei". Esta é a pergunta seguinte, e a única
       acionável: subir de plano no dia 10 é decisão, descobrir no dia 30 é
       constatação. */
    expect(painel).toContain(
      "const projecao = Math.round((cota.usadas / diaDoCiclo) * diasDoMes);",
    );
    expect(painel).toContain("No seu ritmo, você chega a");
  });

  test("a lista leva ao prontuário — é ferramenta, não relatório", () => {
    /* `patientId` é o `auth.users.id`, exatamente o que `setAbrirPaciente`
       espera. A ponte existia dos dois lados e não estava ligada: o card
       mostrava "Maria — 87 · 31%" e ele ia procurar Maria pelo nome. */
    expect(painel).toContain("onClick={() => onAbrirPaciente?.(p.patientId)}");
    expect(painel).toContain('setTab("Pacientes 👩‍🍼");');
  });

  test("a cor da barra significa alguma coisa — e NÃO a mesma coisa que a de cima", () => {
    /* O pedido dizia "barra colorida" e todas eram `bg-primary/70`. Mas a
       primeira tentativa usou vermelho/âmbar, que a 40px dali significam "cota
       estourada" e "cota em aviso": "Maria em vermelho" leria como "Maria tem
       algo errado" quando é o contrário — ela conversa muito, o que é
       engajamento. Escala sequencial própria, que ordena sem alarmar. */
    expect(painel).toContain("p.fatia >= 0.4");
    expect(painel).toContain("p.fatia >= 0.25");
    expect(painel).toContain("bg-violet-600");
    /* Só a linha da régua de cor — logo abaixo vem o aviso de cota, que USA
       `bg-destructive` legitimamente, e uma fatia larga demais o alcançaria. */
    const regua = painel.slice(painel.indexOf("const cor ="), painel.indexOf("const cor =") + 220);
    expect(regua).not.toContain("bg-destructive");
    expect(regua).not.toContain("bg-amber");
  });

  test("a cota estourada tem uma PORTA para os planos", () => {
    /* O texto dizia "ou se você subir de plano" sem link, botão ou aba — a
       única ação que resolve o problema não tinha caminho. O `TrancadoCard`
       vizinho já tinha essa ponte. */
    expect(painel).toContain("Ver planos →");
    expect(painel).toContain('onIrParaPlanos={() => setTab("Meu Perfil")}');
  });

  test("a fita de abas é uma tablist de verdade", () => {
    /* Quinze botões numa fita rolável sem semântica: o leitor de tela os lê
       como quinze botões soltos e não anuncia qual está ativo. */
    expect(painel).toContain('role="tablist"');
    expect(painel).toContain('role="tab"');
    expect(painel).toContain("aria-selected={tab === t}");
  });

  test("a barra muda de cor conforme a régua", () => {
    expect(painel).toContain('cota.estado === "estourada"');
    expect(painel).toContain("bg-destructive");
    expect(painel).toContain("bg-amber-500");
  });

  test("passar do limite não faz a barra vazar do card", () => {
    expect(painel).toContain(
      "Math.min(100, Math.round((cota.usadas / (cota.teto as number)) * 100))",
    );
  });

  test("mostra o número absoluto junto da barra", () => {
    /* A barra dá a proporção; o número dá o que decidir. */
    expect(painel).toContain("de {cota.teto}");
  });
});

describe("quem mais conversou", () => {
  const painel = readFileSync("src/routes/_authenticated/painel.tsx", "utf8");
  const cota = codigoDe("src/lib/cota-ia.server.ts");

  test("a barra compara com a MAIOR, não com o total", () => {
    expect(painel).toContain("Quem mais conversou");
    /* Proporcional ao TOTAL, numa fila de cinquenta gestantes a maior fatia dá
       ~12% da largura e todas as outras colapsam no piso: seis barrinhas do
       mesmo tamanho, que é exatamente a comparação que o card existe para
       fazer. A porcentagem do total continua escrita ao lado, em número. */
    expect(painel).toContain(
      "const maior = Math.max(1, ...(cota.pacientes ?? []).map((p) => p.respostas));",
    );
    expect(painel).toContain("Math.round((p.respostas / maior) * 100)");
  });

  test("uma paciente com pouquíssimo uso ainda aparece", () => {
    /* 1 de 300 desenharia uma barra invisível — e barra invisível diz "zero"
       quando o número diz "um". */
    expect(painel).toContain("Math.max(4, Math.round((p.respostas / maior) * 100))");
  });

  test("a amostra é ordenada — senão o topo é um recorte aleatório", () => {
    /* `.limit(5000)` sem `order by` não garante ordem nenhuma no PostgREST:
       acima de 5000 respostas no mês, "quem mais conversou" era calculado
       sobre linhas arbitrárias, e o médico não tinha como saber. */
    const trecho = cota.slice(cota.indexOf("export async function consumoPorPaciente"));
    expect(trecho.indexOf('.order("created_at"')).toBeLessThan(trecho.indexOf(".limit(5000)"));
  });

  test("o médico vê QUANTO, nunca O QUÊ", () => {
    /* Consumo é dado de plano; conteúdo de conversa é da paciente. A lista
       carrega nome e contagem — nunca texto. */
    const trecho = cota.slice(cota.indexOf("export async function consumoPorPaciente"));
    expect(trecho).toContain('.select("patient_id")');
    expect(trecho).not.toContain("question");
    expect(trecho).not.toContain("content");
  });

  test("conta só as respostas, igual à cota", () => {
    /* Se a lista contasse memória e embedding, as fatias não fechariam com o
       total que aparece na barra logo acima — dois números discordando na
       mesma tela. */
    const trecho = cota.slice(cota.indexOf("export async function consumoPorPaciente"));
    expect(trecho).toContain('.eq("especie", "chat")');
  });

  test("falha na lista não derruba a cota", () => {
    const trecho = cota.slice(cota.indexOf("export async function consumoPorPaciente"));
    expect(trecho).toContain("return { total: 0, pacientes: [] };");
  });

  test("usa a coluna de nome que a tabela realmente tem", () => {
    /* `patient_profiles` tem `display_name`. Pedir `name` devolveria erro e a
       lista apareceria com todos chamados "Paciente" — um defeito que parece
       decisão de design. */
    expect(cota).toContain('.select("id,display_name")');
  });
});

/** Só o corpo de `DOCTOR_TABS` — a lista termina em `];`, não em `as const`,
    e recortar até o marcador errado varre metade do arquivo junto. */
/**
 * A lista de abas SEM COMENTÁRIOS.
 *
 * O bloco de `DOCTOR_TABS` é quase todo prosa: cada aba ligada carrega o
 * parágrafo que explica por que ela estava faltando. Uma dessas explicações
 * cita `setTab("Calendário")` — com aspas — e um `toContain('"Calendário"')`
 * cru casava com a EXPLICAÇÃO em vez da entrada da lista. Removi o Calendário
 * de propósito para conferir, e os 50 testes continuaram verdes.
 *
 * É a quarta vez nesta base que um teste mede o texto que descreve o código em
 * vez do código. Por isso a limpeza mora no helper, e não em cada chamada.
 */
function listaDeAbas(painel: string): string {
  const ini = painel.indexOf("const DOCTOR_TABS");
  return painel
    .slice(ini, painel.indexOf("\n];", ini))
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
}

/**
 * TODA ABA IMPLEMENTADA TEM QUE SER ALCANÇÁVEL.
 *
 * `DOCTOR_TABS` é a ÚNICA fonte dos botões da fita. Uma aba com bloco de
 * renderização e ausente dessa lista não tem caminho nenhum até ela — e é pior
 * que uma tela que não existe, porque ninguém a procura. Já aconteceu quatro
 * vezes neste arquivo: Ferramentas (a única tela de receituário do produto),
 * Exames, e o Calendário, que ficou órfão até agosto/2026.
 *
 * "Empresas" é a única exceção legítima: mora no console do dono (`/admin`),
 * por decisão registrada no comentário de `DOCTOR_TABS`.
 */
describe("nenhuma aba fica órfã", () => {
  const painel = readFileSync("src/routes/_authenticated/painel.tsx", "utf8");

  test("toda aba com render está no menu do médico", () => {
    const lista = listaDeAbas(painel);
    /* As abas que o corpo do componente sabe desenhar — no código, não nos
       comentários, pelo mesmo motivo explicado em `listaDeAbas`. */
    const codigo = painel.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
    const comRender = [...codigo.matchAll(/\{tab === "([^"]+)"/g)].map((m) => m[1]);
    const orfas = [...new Set(comRender)].filter(
      (aba) => aba !== "Empresas" && !lista.includes(`"${aba}"`),
    );
    expect(orfas).toEqual([]);
  });

  test("toda aba do menu TEM bloco de renderização", () => {
    /* A direção contrária da de cima, e igualmente muda: uma aba acrescentada
       a `DOCTOR_TABS` sem bloco correspondente dá tela em BRANCO — o médico
       toca no botão e não acontece nada, sem erro nenhum. */
    const codigo = painel.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
    const comRender = new Set([...codigo.matchAll(/\{tab === "([^"]+)"/g)].map((m) => m[1]));
    const noMenu = [...listaDeAbas(painel).matchAll(/"([^"]+)",/g)].map((m) => m[1]);
    expect(noMenu.filter((aba) => !comRender.has(aba))).toEqual([]);
    /* E a lista não pode estar vazia, senão o teste acima é decoração. */
    expect(noMenu.length).toBeGreaterThan(10);
  });

  test("o Calendário está ligado — decisão do Clóvis", () => {
    /* Implementado (`CalendárioSection`, grade do mês) e fora da lista: não
       havia UM `setTab("Calendário")` em lugar nenhum do arquivo. */
    expect(listaDeAbas(painel)).toContain('"Calendário"');
    expect(painel).toContain('{tab === "Calendário" && (');
  });
});

describe("o Cérebro é a primeira coisa que ele vê", () => {
  const painel = readFileSync("src/routes/_authenticated/painel.tsx", "utf8");

  test("é a primeira aba da fita", () => {
    /* Era a 11ª de 14 numa fita rolável de uma linha — uns oitocentos pixels à
       direita num celular. O médico precisava ROLAR para chegar na única parte
       do painel que fica melhor quanto mais ele a usa. */
    const lista = listaDeAbas(painel);
    const posCerebro = lista.indexOf('"Cérebro 🧠"');
    const posPainel = lista.indexOf('"Painel 📊"');
    expect(posCerebro).toBeGreaterThan(0);
    expect(posCerebro).toBeLessThan(posPainel);
  });

  test("e é a aba que abre", () => {
    /* O painel de números diz o que ACONTECEU; o cérebro é onde ele MUDA o que
       vai acontecer. */
    /* Pela CONSTANTE, não pelo literal: o interruptor de push do SOS e o
       resumo do app se penduram na "aba de entrada", e escritos como
       `tab === "Painel 📊"` eles saíram silenciosamente da tela quando o
       Cérebro passou para a frente. */
    expect(painel).toContain('const ABA_DE_ENTRADA: PanelTab = "Cérebro 🧠";');
    expect(painel).toContain("useState<PanelTab>(ABA_DE_ENTRADA)");
  });

  test("aparece uma vez só na lista", () => {
    /* Duplicar renderizaria dois botões da mesma aba. */
    const lista = listaDeAbas(painel);
    expect((lista.match(/"Cérebro 🧠"/g) ?? []).length).toBe(1);
  });
});

/**
 * A ABA DO CÉREBRO NÃO PODE MENTIR SOBRE SI MESMA.
 *
 * Três defeitos de FATO — não de gosto — que um avaliador encontrou lendo a aba
 * como se fosse o médico abrindo pela primeira vez.
 */
describe("o painel do cérebro conta a verdade", () => {
  const painel = readFileSync("src/routes/_authenticated/painel.tsx", "utf8");
  const fns = readFileSync("src/lib/secondbrain.functions.ts", "utf8");
  const admin = readFileSync("src/lib/admin.functions.ts", "utf8");

  test("o texto de orientação conta as filas certas", () => {
    /* Dizia "duas filas" e havia três: eu movi o card de perguntas das
       pacientes para o grupo de trabalho e não atualizei o parágrafo que
       existe justamente para dar nome às filas. O texto que orienta era o
       único errado da tela. */
    const cabecalho = painel.slice(painel.indexOf("Abaixo há"), painel.indexOf("Abaixo há") + 700);
    expect(cabecalho).toContain("três filas");
    expect(cabecalho).toContain("❓ Perguntas");
  });

  test("erro de banco NÃO vira 'tudo respondido 🎉'", () => {
    /* `listUnansweredQuestions` devolvia `ok: true` com lista vazia no erro. O
       comentário dizia "fail-closed p/ escopado" — e era fail-closed no escopo
       e fail-OPEN na mensagem: o médico lia que não há trabalho quando o que
       houve foi não conseguir olhar. */
    const trecho = fns.slice(fns.indexOf("export const listUnansweredQuestions"));
    expect(trecho.slice(0, 2500)).toContain("ok: false as const");
    expect(painel).toContain("isto não quer dizer que não há");
  });

  test("os dois contadores de perguntas são a MESMA contagem exata", () => {
    /* O badge da fita filtrava não-respondidas entre as 200 mais RECENTES; o
       card lista as 50 mais ANTIGAS. Com 73 na fila, a fita dizia um número e
       o card outro, lado a lado — e num histórico grande o badge contava MENOS
       que a realidade, escondendo trabalho. */
    expect(admin).toContain('.select("id", { count: "exact", head: true })');
    expect(admin).toContain("pendingQuestions:");
    expect(painel).toContain("const pendingQs = pendingExato ??");
    /* E a tela diz que está mostrando um recorte, em vez de deixar o médico
       concluir que resolveu a fila ao terminar as 50. */
    expect(painel).toContain("Mostrando as {questions.length} mais antigas de {totalQ}");
  });
});

/**
 * AS SEIS DECISÕES DO CLÓVIS — travadas para não se desfazerem sozinhas.
 *
 * Cada uma foi uma escolha dele, não uma dedução minha. Um teste é o que
 * impede que a próxima pessoa (ou eu, em três semanas) desfaça sem saber que
 * havia uma decisão ali.
 */
describe("as decisões do dono, escritas em teste", () => {
  const painel = readFileSync("src/routes/_authenticated/painel.tsx", "utf8");
  const store = readFileSync("src/lib/doctorthink/obstetrica-store.server.ts", "utf8");
  const fns = readFileSync("src/lib/secondbrain.functions.ts", "utf8");
  const widget = readFileSync("src/components/chatbot-widget.tsx", "utf8");

  test("a API do DoctorThink usa a MESMA régua clínica da Obstétrica", () => {
    /* Vivia ali um `const SEMANTIC_MIN_SIMILARITY = 0.55` — segunda régua, com
       o valor que a Obstétrica já tinha abandonado, servida ao vivo por
       `/api/doctorthink/ask`. O CLAUDE.md proíbe: "nunca duplique um limite
       clínico fora desse arquivo". Se a API vira produto para outros sites, o
       mesmo médico responderia diferente conforme o canal. */
    /* SEM COMENTÁRIOS: a explicação de por que a constante saiu cita a própria
       constante. É a quinta vez nesta base que uma asserção casa com a prosa
       que descreve o código em vez do código. */
    expect(codigoDe("src/lib/doctorthink/obstetrica-store.server.ts")).not.toMatch(
      /const SEMANTIC_MIN_SIMILARITY *=/,
    );
    expect(store).toContain('import { SEMANTIC_MIN_SIMILARITY } from "../secondbrain.server"');
    /* E a consulta é embedada como CONSULTA, com a limpeza de saudação — sem
       isso a similaridade sai um número incomparável com o corte. */
    expect(store).toContain('embedText(textoParaVetor(message), EMBED_TIMEOUT_MS, "consulta")');
  });

  test("no celular ele entra pelo resumo, e todas as abas continuam a um toque", () => {
    /* `PainelNoApp` existe porque quinze abas de tela de computador não
       encolhem para 390px — e o conteúdo da aba renderizava LOGO ABAIXO dele:
       resumo do dia mais os doze cards do Cérebro, a tela mais pesada do
       produto. O resumo virou cabeçalho do despejo que ele evita.
       Aterrissar no Painel (e não no Cérebro) é o que mantém TODAS as abas
       alcançáveis: se a entrada fosse o Cérebro, tocar em "Cérebro" não
       mostraria nada — a aba ativa seria a de entrada. */
    /* Sem espaços: o prettier quebra o ternário em quatro linhas conforme o
       tamanho dos nomes muda, e uma asserção presa à formatação quebra por
       motivo errado. */
    expect(painel.replace(/\s+/g, " ")).toContain(
      "const abaDeEntrada = noApp ? ABA_DE_ENTRADA_SEM_IA",
    );
    expect(painel).toContain("if (nativo) setTab(ABA_DE_ENTRADA_SEM_IA);");
    expect(painel).toContain('noApp && tab === abaDeEntrada ? "hidden" : "mt-8"');
  });

  test("ligar a IA exige o WhatsApp do consultório preenchido", () => {
    /* Quando a cota acaba, a IA precisa dar à paciente um caminho até ele.
       Campo vazio no cadastro custa dez segundos; a mesma lacuna às 3 da manhã
       custa uma gestante sem saída.
       Só barra LIGAR — desligar, ou salvar persona com a IA já desligada,
       continua livre, senão ele ficaria preso numa configuração. */
    expect(fns).toContain('return { ok: false as const, reason: "semWhatsapp" as const };');
    expect(fns).toContain("if (data.settings.enabled_app || data.settings.enabled_whatsapp)");
    expect(painel).toContain("Preencha o WhatsApp do consultório em Meu Perfil");
  });

  test('"Empresas" saiu do painel — mora no console do dono', () => {
    /* ~200 linhas vivas e inalcançáveis: render, loader e estados, com a aba
       fora do menu. O `/admin` tem a própria implementação. */
    expect(painel).not.toContain("EmpresasSection");
    expect(painel).not.toContain("loadCorporate");
    expect(painel).not.toContain("getCorporateLeadsAdmin");
    const admin = readFileSync("src/routes/_authenticated/admin.tsx", "utf8");
    expect(admin).toContain("getCorporateLeadsAdmin");
  });

  test("o chat do site público tem indicador e botão de parar", () => {
    /* Era "digitando…" em itálico contra a bolha de varredura do chat da
       paciente — mesma espera, dois produtos. E é a primeira tela que uma
       gestante nova vê. */
    expect(widget).toContain("stop } = useChat");
    expect(widget).toContain("onClick={() => stop()}");
    expect(widget).toContain('role="status"');
  });

  test("o custo dos laudos no banco é medido e mostrado", () => {
    /* Base64 em coluna TEXT é a escolha certa hoje — a RLS, o visualizador e a
       devolutiva já existem em cima da tabela. E é custo recorrente que cresce
       sozinho: disco de banco custa ~6× o de Storage e entra em todo backup.
       O número na tela é o que transforma "um dia vai custar caro" numa
       decisão com data. `pg_column_size` mede o tamanho REAL depois do TOAST,
       não o do base64. */
    const clinical = readFileSync("src/lib/clinical.functions.ts", "utf8");
    expect(clinical).toContain('rpc("tamanho_dos_exames"');
    const visor = readFileSync("src/components/exames-recebidos.tsx", "utf8");
    expect(visor).toContain("no banco. Acima de ~1 GB");
    const sql = readFileSync("supabase/APLICAR_TAMANHO_EXAMES.sql", "utf8");
    expect(sql).toContain("pg_column_size(image_data)");
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.tamanho_dos_exames(uuid[]) TO service_role",
    );
  });
});
