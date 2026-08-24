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
    /* Uma catraca de contagem: a quarta função que precisar do autor tem de
       passar por aqui e explicar por quê. Hoje são três:
         · `perguntar` — GRAVA;
         · `denunciarPergunta` — lê para bloquear (a única defesa possível numa
           caixa anônima);
         · `denunciasAbertas` — lê para CONTAR reincidência, e o id morre lá
           dentro (ver o teste logo abaixo).
       Esta catraca já fez o trabalho dela uma vez: `denunciasAbertas` nasceu e
       o teste ficou vermelho até a razão ser escrita aqui. */
    const nomes = [...CODIGO.matchAll(/export const (\w+) = createServerFn/g)].map((m) => m[1]);
    const tocam = nomes.filter((n) => corpoDe(n).includes("quem_id"));
    expect(tocam.sort()).toEqual(["denunciarPergunta", "denunciasAbertas", "perguntar"]);
  });

  test("⚠️ nem o ADMINISTRADOR recebe `quem_id`", () => {
    /* O que ele precisa para agir é o TEXTO e a REINCIDÊNCIA. Um id na tela
       vira um nome na primeira vez que alguém o colar numa consulta — e a
       caixa é anônima para todo mundo, não só para a dona. */
    const c = corpoDe("denunciasAbertas");
    expect(c).toContain("reincidencias:");
    /* O retorno é montado CAMPO A CAMPO, e nenhum campo é o autor. `quem_id`
       aparece uma vez no `.map`, e só do lado DIREITO de um `:` — como chave de
       consulta ao contador. Um `quemId: l.quem_id` cairia aqui. */
    const i = c.indexOf("fila: brutas.map(");
    expect(i).toBeGreaterThan(-1);
    const mapa = c.slice(i, c.indexOf("satisfies DenunciaNaFila", i));
    const campos = [...mapa.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
    expect(campos.sort()).toEqual(["fila", "id", "quando", "reincidencias", "texto"]);
    const tipo = CODIGO.slice(
      CODIGO.indexOf("export type DenunciaNaFila"),
      CODIGO.indexOf("export const denunciasAbertas"),
    );
    expect(tipo.length).toBeGreaterThan(60);
    for (const proibido of ["quemId", "quem_id", "autor", "avatar"]) {
      expect(tipo).not.toContain(proibido);
    }
  });
});

describe("⚠️ o servidor DELEGA a decisão, e não a reescreve", () => {
  test("`perguntar` e `responderPergunta` chamam a régua pura", () => {
    /* Se um dia alguém reescrever a guarda inline, a régua passa a existir em
       dois lugares e as duas divergem no primeiro conserto — com a divergência
       aparecendo como pergunta clínica virando post público. O QUE cada guarda
       faz é testado por comportamento em `caixinha.test.ts`; aqui só se cobra
       que este arquivo não tenha uma segunda opinião. */
    expect(corpoDe("perguntar")).toContain("decidirPergunta(");
    expect(corpoDe("responderPergunta")).toContain("decidirResposta(");
    expect(CODIGO).not.toMatch(/function decidirPergunta|function decidirResposta/);
    /* E o texto da recusa vem de lá também. */
    expect(corpoDe("perguntar")).toContain("recadoDoVeredicto(");
    expect(corpoDe("responderPergunta")).toContain("recadoDaResposta(");
  });

  test("⚠️ e os FATOS que ele passa são lidos do banco, não cravados", () => {
    /* Uma régua pura perfeita alimentada com `bloqueadas: false` fixo não
       protege ninguém. */
    const p = corpoDe("perguntar").replace(/\s+/g, " ");
    expect(p).not.toMatch(/bloqueadas: false|donaAceita: true|alcancoOPerfil: true/);
    expect(p).toContain("alcancoOPerfil: alcancaOPerfil({");
    expect(p).toContain("mandeiParaElaHoje:");
  });

  test("⚠️ falha ao ler o bloqueio conta como BLOQUEADAS", () => {
    /* Mesma direção do `conjuntoDeBloqueio`: numa caixa anônima, errar para o
       lado de aceitar é derrubar a única defesa que a dona tem. */
    const p = corpoDe("perguntar").replace(/\s+/g, " ");
    expect(p).toContain("const bloqueadas = !!erroBloqueio ||");
  });
});

describe("⚠️ a pergunta clínica vai para o médico de QUEM PERGUNTOU", () => {
  test("o `doctor_id` sai do perfil de `eu`, nunca do da dona", () => {
    const p = corpoDe("perguntar");
    const i = p.indexOf('.from("doctor_questions")');
    expect(i).toBeGreaterThan(-1);
    /* A janela é a montagem da linha, e ela começa na leitura do MEU perfil. */
    const abre = p.lastIndexOf('.from("patient_profiles")', i);
    expect(abre).toBeGreaterThan(-1);
    const trecho = p.slice(abre, i + 300);
    expect(trecho).toContain('.eq("id", eu)');
    /* ⚠️ Procurar `data.donaId` solto não prova nada — ele aparece no corpo
       inteiro. O que prova é ele não aparecer NESTE trecho, e a variável `dona`
       (o perfil dela, que está em escopo) também não. */
    expect(trecho).not.toContain("data.donaId");
    expect(trecho).not.toMatch(/\bdona\b[^I]/);
    expect(trecho).toMatch(/user_id: eu/);
  });

  test("falhar ao gravar a dúvida clínica é ERRO, e não um envio de mentira", () => {
    const p = corpoDe("perguntar");
    const i = p.indexOf('.from("doctor_questions")');
    expect(i).toBeGreaterThan(-1);
    expect(p.slice(i, i + 500)).toMatch(/if \(erroFila\) return \{ ok: false/);
  });

  test("⚠️ a EMERGÊNCIA deixa rastro, e é o mais grave dos três", () => {
    /* Antes ela não gravava NADA: o app detectava a bandeira vermelha, mostrava
       um botão, e se ela fechasse a folha não sobrava registro nenhum de que a
       frase existiu. A hierarquia estava invertida — `publicavel` persistia,
       `clinica` persistia, e o mais grave era o único volátil. */
    const p = corpoDe("perguntar").replace(/\s+/g, " ");
    expect(p).toContain('const naCaixa = veredicto.desfecho === "publicavel"');
    expect(p).toContain("arquivado_em: naCaixa ? null : agora");
    /* E as duas não-publicáveis vão para a fila do médico dela. */
    expect(p).toContain("if (!naCaixa) {");
    expect(p).toContain('.from("doctor_questions")');
  });
});

describe("⚠️ o que a caixa devolve é só o que ela PODE devolver", () => {
  test("nenhum campo estruturalmente impossível", () => {
    /* ⚠️ `denunciada` viveu no tipo e no servidor sem NUNCA poder ser
       verdadeiro: `denunciarPergunta` grava `arquivado_em` junto com
       `denunciado_em`, e `minhaCaixinha` filtra `.is("arquivado_em", null)` —
       uma pergunta denunciada sai da caixa por definição. O campo prometia uma
       informação que a consulta não pode produzir, e nenhuma tela o desenhava.
       É a mesma família da régua sem chamador: não é código morto, é código
       morto que parece contar alguma coisa. */
    const c = corpoDe("minhaCaixinha");
    expect(c).toContain('.is("arquivado_em", null)');
    expect(c).not.toContain("denunciada");
    const tipo = CODIGO.slice(
      CODIGO.indexOf("export type PerguntaNaCaixa"),
      CODIGO.indexOf("async function pacienteDaSessao"),
    );
    expect(tipo).not.toContain("denunciada");
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

/* ══════════════════════════════════════════════════════════════════════════
   ⚠️ A CAIXINHA DO STORY — o consentimento POR PUBLICAÇÃO
   ══════════════════════════════════════════════════════════════════════════ */
describe("o story abre a caixa sem ligar a chave permanente", () => {
  const corpo = corpoDe("perguntar");

  /* ⚠️ Três condições, e faltar qualquer uma abriria a caixa de quem a mantém
     fechada: o story tem de ser DELA, ter a caixinha aberta, e estar de pé. */
  test("⚠️ o story é conferido no BANCO — dono, caixinha aberta e 24h", () => {
    /* ⚠️ O recorte é a CONSULTA do story, e não "daqui até o fim do corpo": os
       dois tetos diários também usam `.gte("criado_em", …)`, e apagar a janela
       de 24 horas do story continuava verde porque a asserção casava a
       ocorrência dos tetos. É a armadilha que o cabeçalho deste arquivo
       descreve, cometida de novo — e pega por mutação. */
    const i = corpo.indexOf('.from("rede_stories")');
    expect(i).toBeGreaterThan(-1);
    const consulta = corpo.slice(i, corpo.indexOf("maybeSingle()", i));
    expect(consulta).toContain('.eq("id", data.storyId)');
    expect(consulta).toContain('.eq("autor_id", data.donaId)');
    expect(consulta).toContain('.gte("criado_em"');
    expect(consulta).toContain("pergunta_aberta");
    /* E o que decide é a coluna, nunca a existência da linha. */
    expect(corpo).toContain("storyAbriuACaixa = !!(st as any)?.pergunta_aberta");
  });

  /* ⚠️ A derivação é a função PURA, e não um `||` escrito no handler: dez
     asserções deste arquivo já passaram verdes numa auditoria por mutação
     justamente por medirem posição de string em vez de comportamento. */
  test("⚠️ o consentimento sai de `consentiuReceber`, não de um || local", () => {
    expect(corpo).toContain("donaAceita: consentiuReceber({");
    expect(corpo).toContain("chaveLigada: !!(dona as any)?.aceita_perguntas");
    expect(corpo).toContain("storyAbriuACaixa,");
  });

  /* ⚠️ O story NÃO liga a chave do perfil: é a mesma distinção de
     `semanaParaCarimbo` — ato por publicação contra decisão permanente. */
  test("⚠️ perguntar nunca escreve em `patient_profiles`", () => {
    expect(corpo).not.toContain('.from("patient_profiles").update');
    expect(corpo).not.toContain("aceita_perguntas: true");
  });
});
