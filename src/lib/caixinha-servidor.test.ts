import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * AS TRAVAS DA CAIXINHA, lidas na fonte.
 *
 * ⚠️ **Estes testes já nasceram sabendo como mentem.** Duas vezes neste
 * repositório um teste de servidor ficou verde procurando PALAVRA solta: o de
 * Modo Cuidado dos presentes casava `care_mode` (que continua no `.select()`)
 * e `return null` (da linha de cima), e o de "o saldo é relido" comparava dois
 * `indexOf`. Aqui cada asserção amarra uma CADEIA — o identificador que uma
 * régua produz tem de ser o que a outra consome —, e todas foram conferidas
 * por mutação: quebrei a linha, vi vermelho, desfiz.
 */
/**
 * ⚠️ **SEM COMENTÁRIOS, e as duas direções desta armadilha já custaram caro.**
 *
 * Na catraca de portas, um comentário meu dizendo que `publicarPost` tinha
 * ficado sem porta fez o teste PASSAR — ele se satisfazia com a própria prosa.
 * Aqui aconteceu o contrário, na primeira execução: o comentário do tipo
 * (`não há quem, quemId, autor nem avatar`) fez um `not.toContain("quemId")`
 * FALHAR sobre um tipo que está correto. Prosa não é código nas duas direções.
 */
function semComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

const FONTE = readFileSync("src/lib/caixinha.functions.ts", "utf8");
const CODIGO = semComentarios(FONTE);

/** Só o corpo de uma função de servidor — nunca até o fim do arquivo. */
function corpoDe(nome: string): string {
  const i = CODIGO.indexOf(`export const ${nome} = createServerFn`);
  expect(i).toBeGreaterThan(-1);
  /* ⚠️ O corte é a PRÓXIMA `export`, e não o fim do arquivo: as fatias
     `slice(indexOf(...))` da rodada passada iam até o fim, e a próxima função
     acrescentada passaria a satisfazer os `toContain` sozinha.

     ⚠️ E é sobre o código SEM COMENTÁRIOS: com eles, o corpo de
     `arquivarPergunta` ia até o `\nexport` seguinte e engolia o bloco de doc de
     `denunciarPergunta` — que fala de `quem_id`. A catraca de contagem acusou
     três funções tocando na coluna onde só duas tocam. */
  const resto = CODIGO.slice(i + 10);
  const j = resto.indexOf("\nexport ");
  return j === -1 ? resto : resto.slice(0, j);
}

describe("⚠️ `quem_id` é guardado sempre e devolvido nunca", () => {
  test("a caixa da dona não LÊ a coluna", () => {
    /* Pedir a coluna e descartá-la no `.map()` funcionaria hoje e falharia no
       dia em que alguém devolvesse a linha inteira por conveniência. O que não
       é lido não vaza. */
    const caixa = corpoDe("minhaCaixinha");
    expect(caixa).toContain("rede_perguntas");
    expect(caixa).not.toContain("quem_id");
  });

  test("o tipo que a tela recebe não tem campo de autor", () => {
    const tipo = CODIGO.slice(
      CODIGO.indexOf("export type PerguntaNaCaixa"),
      CODIGO.indexOf("async function pacienteDaSessao"),
    );
    expect(tipo.length).toBeGreaterThan(80);
    for (const proibido of ["quemId", "quem_id", "autor", "avatar", "nome"]) {
      expect(tipo).not.toContain(proibido);
    }
  });

  test("só a denúncia lê `quem_id`, e ela não o devolve", () => {
    /* É o único ponto do módulo que precisa dele — é ele que permite bloquear
       a partir de uma caixa anônima. */
    const denuncia = corpoDe("denunciarPergunta");
    expect(denuncia).toContain("quem_id");
    /* ⚠️ E o retorno de sucesso é `{ ok: true }` PELADO. Devolver o id (ou um
       nome resolvido a partir dele) daria por campo o que a tela recusa por
       desenho. */
    expect(denuncia).toMatch(/return \{ ok: true as const \};/);
    expect(denuncia).not.toMatch(/return \{ ok: true as const, quem/);
  });

  test("quantas funções do módulo tocam em `quem_id`", () => {
    /* Uma catraca de contagem: a sexta função que precisar do autor tem de
       passar por aqui e explicar por quê. Hoje são duas — `perguntar`, que o
       GRAVA, e `denunciarPergunta`, que o lê para bloquear. */
    const nomes = [...CODIGO.matchAll(/export const (\w+) = createServerFn/g)].map((m) => m[1]);
    const tocam = nomes.filter((n) => corpoDe(n).includes("quem_id"));
    expect(tocam.sort()).toEqual(["denunciarPergunta", "perguntar"]);
  });
});

describe("⚠️ a régua roda nos DOIS textos", () => {
  test("na pergunta e na resposta", () => {
    /* O texto perigoso é a RESPOSTA — foi ele que fechou os comentários. Uma
       caixinha que triasse só a entrada publicaria "no seu lugar eu esperava"
       com o nome do consultório em volta. */
    expect(corpoDe("perguntar")).toContain("triarTexto(texto)");
    expect(corpoDe("responderPergunta")).toContain("triarTexto(resposta)");
  });

  test("⚠️ e a resposta só publica quando a régua devolve `publicavel`", () => {
    const responder = corpoDe("responderPergunta");
    /* Amarra a CADEIA: o valor que `triarTexto` produz é o mesmo que decide a
       recusa, e a recusa acontece ANTES do insert em `rede_posts`. */
    expect(responder).toMatch(/const desfecho = triarTexto\(resposta\)/);
    expect(responder).toMatch(/if \(desfecho !== "publicavel"\)[\s\S]*?return \{ ok: false/);
    expect(responder.indexOf('desfecho !== "publicavel"')).toBeLessThan(
      responder.indexOf('.from("rede_posts")'),
    );
  });
});

describe("⚠️ a pergunta clínica vai para o médico de QUEM PERGUNTOU", () => {
  test("o `doctor_id` sai do perfil de `eu`, nunca do da dona", () => {
    const p = corpoDe("perguntar");
    const trecho = p.slice(p.indexOf('desfecho === "clinica"'), p.indexOf("teto"));
    expect(trecho).toContain('.eq("id", eu)');
    /* ⚠️ O `.eq("id", data.donaId)` existe neste corpo (é a leitura da caixa),
       então procurar a string solta não prova nada: o que prova é ele NÃO
       aparecer dentro do trecho que monta a linha do médico. */
    expect(trecho).not.toContain("data.donaId");
    expect(trecho).toContain('.from("doctor_questions")');
    expect(trecho).toMatch(/user_id: eu/);
  });

  test("falhar ao gravar a dúvida clínica é ERRO, e não um envio de mentira", () => {
    const p = corpoDe("perguntar");
    const trecho = p.slice(p.indexOf('.from("doctor_questions")'));
    expect(trecho.slice(0, 400)).toMatch(/if \(error\) return \{ ok: false/);
  });
});

describe("⚠️ a bandeira vermelha não vira linha na caixa", () => {
  test("ela sai por cima, antes de qualquer escrita", () => {
    /* Ninguém responde "estou sangrando" com um coraçãozinho, e deixar essa
       frase esperando a boa vontade de outra paciente é o pior desfecho
       possível desta tela. O caminho dela é a Central de Emergência. */
    const p = corpoDe("perguntar");
    expect(p.indexOf('desfecho === "emergencia"')).toBeLessThan(p.indexOf(".insert("));
    const trecho = p.slice(p.indexOf('desfecho === "emergencia"'), p.indexOf('=== "clinica"'));
    expect(trecho).not.toContain(".insert(");
  });
});

describe("as três recusas de `perguntar`", () => {
  const p = corpoDe("perguntar");

  test("caixa fechada, Modo Cuidado e bloqueio recusam ANTES da triagem", () => {
    /* Triar primeiro roteria para o médico uma dúvida escrita para uma caixa
       que não existe — e a paciente receberia "mandei para o seu médico" por
       um texto que ela mandou para outra pessoa. */
    expect(p).toMatch(/care_mode \|\| !\(dona as any\)\.aceita_perguntas/);
    expect(p.indexOf("aceita_perguntas")).toBeLessThan(p.indexOf("triarTexto"));
    expect(p.indexOf("rede_bloqueios")).toBeLessThan(p.indexOf("triarTexto"));
  });

  test("⚠️ o bloqueio conta nos DOIS sentidos", () => {
    /* Só o meu deixaria quem me bloqueou continuar me perguntando. */
    const trecho = p.slice(p.indexOf("rede_bloqueios"), p.indexOf("triarTexto"));
    expect(trecho).toContain("quem_id.eq.${eu}");
    expect(trecho).toContain("quem_id.eq.${data.donaId}");
  });

  test("o teto diário conta o que ENTRA NA CAIXA", () => {
    const trecho = p.slice(p.indexOf("PERGUNTAS_POR_DIA") - 400);
    expect(trecho).toContain('.eq("quem_id", eu)');
    expect(trecho).toContain('.gte("criado_em", inicioDoDia())');
    expect(trecho).toMatch(/>= PERGUNTAS_POR_DIA[\s\S]*?motivo: "teto"/);
  });
});

describe("⚠️ nada é apagado", () => {
  test("o módulo não chama `.delete()` em `rede_perguntas`", () => {
    /* Arquivar e denunciar MARCAM: apagar faria "nunca perguntou" e "perguntou
       e eu escondi" serem a mesma ausência, e a denúncia precisa da linha.
       O único `.delete()` do módulo é o de `rede_seguidores`, que faz parte do
       bloqueio. */
    const deletes = [...CODIGO.matchAll(/\.from\("(\w+)"\)\s*\n?\s*\.delete\(/g)].map((m) => m[1]);
    expect(deletes).toEqual(["rede_seguidores"]);
  });

  test("responder e arquivar são `update`, e escopados pela dona", () => {
    for (const nome of ["responderPergunta", "arquivarPergunta", "denunciarPergunta"]) {
      const c = corpoDe(nome);
      /* ⚠️ `.eq("dona_id", eu)` é o que impede mexer em pergunta alheia — o id
         vem do cliente, e sem ele bastaria um uuid no corpo do pedido para
         responder pela caixa de outra pessoa. */
      expect(c).toContain('.eq("dona_id", eu)');
    }
  });
});

describe("⚠️ a ordem do bloqueio da denúncia é a mesma de `bloquear`", () => {
  test("desfaz o seguir ANTES de gravar o bloqueio", () => {
    /* Um rollback é mais uma escrita que pode falhar, e falhando deixa
       exatamente o estado que veio evitar. Nesta ordem, o estado intermediário
       ruim é o inofensivo. A mutação que INVERTE a ordem passava verde na rede
       até esta asserção existir lá; aqui ela nasceu junto. */
    const d = corpoDe("denunciarPergunta");
    expect(d.indexOf("rede_seguidores")).toBeLessThan(d.indexOf("rede_bloqueios"));
  });

  test("a denúncia é gravada mesmo quando o bloqueio falha", () => {
    const d = corpoDe("denunciarPergunta");
    expect(d.indexOf("denunciado_em")).toBeLessThan(d.indexOf("rede_bloqueios"));
  });
});

describe("⚠️ falhar ao ler não vira caixa vazia", () => {
  test("`minhaCaixinha` devolve erro, e não uma lista vazia", () => {
    /* A caixa vazia é a tela que ela lê como "ninguém me perguntou nada", e é
       a conclusão errada para tirar de um timeout. Mesma régua de
       `chavesResgatadas` e de `listUnansweredQuestions`. */
    const c = corpoDe("minhaCaixinha");
    expect(c).toMatch(/if \(error\)[\s\S]{0,220}?return \{ ok: false as const, motivo: "banco"/);
  });
});
