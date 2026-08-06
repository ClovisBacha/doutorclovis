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
    expect(trecho.slice(0, 300)).toContain("logBrainGap(target, userMessage, channel, patientId");
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

  test("uma falha na cota não derruba o placar", () => {
    expect(painel).toContain(
      "cotaDeRespostas({ data: dados }).catch(() => ({ ok: false as const }))",
    );
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

  test("sem WhatsApp cadastrado, não inventa um canal", () => {
    expect(chat).toContain('"pelo canal que ela já usa com o consultório"');
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
