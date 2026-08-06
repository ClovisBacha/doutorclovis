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
    expect(fonte).toContain("if (error) return 0;");
    expect(fonte).toMatch(/catch \{\s*return 0;\s*\}/);
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

  test("o card do consumo não some junto com o placar", () => {
    /* A única condição de sumiço dele é sobre a PRÓPRIA cota.
       SEM COMENTÁRIOS: a docstring do card vizinho fala de `stats` para
       explicar por que a separação existe, e um `not.toContain` cru casaria
       com a própria explicação. Foi o erro que já custou quatro rodadas hoje —
       medir o texto que descreve o código em vez do código. */
    const limpo = codigoDe("src/routes/_authenticated/painel.tsx");
    const card = limpo.slice(
      limpo.indexOf("function ConsumoDaIACard("),
      limpo.indexOf("function BrainScoreCard("),
    );
    /* Nenhuma condição de sumiço vinda do PLACAR. As dele são sobre a própria
       cota — e são três estados distintos, não um `return null` para tudo. */
    expect(card).toContain("if (cota === null)");
    expect(card).not.toContain("stats");
  });

  test("o placar já não lê cota nenhuma", () => {
    const placar = painel.slice(
      painel.indexOf("function BrainScoreCard("),
      painel.indexOf("function BrainReviewCard("),
    );
    expect(placar).not.toContain("cotaDeRespostas");
  });

  test("plano ilimitado também vê o próprio consumo", () => {
    /* Antes a barra exigia `teto > 0`, então justamente quem paga mais não
       enxergava nada. */
    const card = painel.slice(
      painel.indexOf("function ConsumoDaIACard("),
      painel.indexOf("function BrainScoreCard("),
    );
    expect(card).toContain("plano sem limite");
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
       impossível voltaria. */
    expect(chat).toContain("const confianca = brain.cotaEsgotada");
    expect(chat).toContain("? avisoDeCota");
  });

  test("PROÍBE explicitamente a promessa que não se cumpre", () => {
    expect(chat).toContain("NÃO diga que registrou a pergunta para ${medico} responder no app");
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
    const aviso = chat.slice(chat.indexOf("const avisoDeCota"));
    expect(aviso.slice(0, 1400)).toContain("até a virada do mês");
    expect(aviso.slice(0, 1400)).toContain("continua acompanhando a gestação normalmente");
  });

  test("a pergunta é respondida ANTES de qualquer aviso", () => {
    /* A ordem importa: primeiro serve, depois explica. Uma resposta que abre
       com "não posso te ajudar" já perdeu a paciente. */
    const aviso = chat.slice(
      chat.indexOf("const avisoDeCota"),
      chat.indexOf("const confianca = brain.cotaEsgotada"),
    );
    const posResponda = aviso.indexOf("1. Responda a pergunta");
    const posDiga = aviso.indexOf("2. Diga com naturalidade");
    expect(posResponda).toBeGreaterThan(0);
    expect(posResponda).toBeLessThan(posDiga);
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

  test("a cor da barra significa alguma coisa", () => {
    /* O pedido dizia "barra colorida" e todas eram `bg-primary/70`. */
    expect(painel).toContain("p.fatia >= 0.4");
    expect(painel).toContain("p.fatia >= 0.25");
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
