/**
 * "NÃO TEM NADA" E "NÃO CONSEGUI OLHAR" SÃO COISAS DIFERENTES.
 *
 * ─── A CLASSE DE DEFEITO ────────────────────────────────────────────────────
 *
 * `supabase-js` NUNCA lança: devolve `{ data, error }`. Uma auditoria contou 54
 * leituras neste produto que descartam o `error` — e todas produzem o mesmo
 * resultado: lista vazia, com cara de boa notícia.
 *
 * Num painel clínico isso não é um detalhe de UX. As duas frases levam o médico
 * a AÇÕES OPOSTAS:
 *
 *  · "Nada esperando por você" → ele fecha o painel. Se foi um timeout, pode
 *    haver uma pressão alterada esperando do outro lado.
 *  · "Ninguém na fila de espera" → ele para de oferecer vaga. Do outro lado há
 *    gestantes esperando um horário que ele acha que ninguém quer.
 *
 * Este arquivo cobra os dois casos que foram fechados, e a razão de cada um.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const clinical = semComentarios("src/lib/clinical.functions.ts");
const admin = semComentarios("src/lib/admin.functions.ts");
const painel = semComentarios("src/routes/_authenticated/painel.tsx");

describe("1. o recorte de pacientes diz quando não conseguiu ler", () => {
  test("a leitura passou a olhar o `error`", () => {
    const i = clinical.indexOf("async function pacientesAtuaisComEstado");
    const corpo = clinical.slice(i, clinical.indexOf("async function pacientesAtuais(", i));
    expect(corpo).toContain("const { data, error }");
    expect(corpo).toContain("falhou: !!error");
  });

  test("mas o Map vazio continua sendo o comportamento SEGURO", () => {
    /**
     * A falha não pode virar "mostra tudo". Quem não sabe de quem é a paciente
     * não mostra nada de ninguém — falha fechando. O que muda é só a MENSAGEM.
     */
    const i = clinical.indexOf("async function pacientesAtuais(");
    const corpo = clinical.slice(i, i + 240);
    /* O COMPORTAMENTO, não a sintaxe: ele devolve o mapa e não faz nada de
       diferente quando `falhou` — quem precisa distinguir usa a outra função.
       Cobrar a linha exata matava até um mutante equivalente (a mesma coisa
       escrita em duas linhas), o que é sinal de teste preso à forma. */
    expect(corpo).toContain("pacientesAtuaisComEstado(doctorId)");
    expect(corpo).toContain(".mapa");
    expect(corpo).not.toContain("falhou");
  });

  test("e a fila clínica distingue vazio de falha", () => {
    /* Era `if (ids.length === 0) return vazio;` — os dois casos no mesmo
       `return`, e a tela afirmando que não há nada. */
    expect(clinical).toContain(
      "if (ids.length === 0) return falhou ? { ...vazio, incompleto: true } : vazio;",
    );
  });

  test("o painel de fato acende o aviso com esse campo", () => {
    /* Sem isto o servidor diria a verdade e a tela continuaria calada. */
    expect(painel).toContain("setFonteFalhou((f) => ({ ...f, eventos: r.incompleto }))");
  });
});

describe("2. a fila de espera não afirma vazio quando não leu", () => {
  test("o servidor devolve `ok: false` quando a leitura falha", () => {
    /* Ancorado na FUNÇÃO, não na tabela: o `const { data, error }` vem antes do
       `.from(...)` na mesma expressão, então cortar a partir do nome da tabela
       deixava a asserção olhando para depois do que ela queria ver. */
    const i = admin.indexOf("export const getDoctorWaitlist");
    const corpo = admin.slice(i, i + 1600);
    expect(corpo).toContain("const { data: rows, error }");
    expect(corpo).toContain("if (error) return { ok: false as const");
  });

  test("a tela mostra a faixa, e NÃO um zero", () => {
    /**
     * Mostrar "0" seria a mesma mentira com outro tipo: um número é uma
     * afirmação. O traço não afirma nada.
     */
    const i = painel.indexOf("function WaitlistSection");
    const bloco = painel.slice(i, i + 2600);
    expect(bloco).toContain("setFalhou(!res.ok)");
    expect(bloco).toContain('{falhou ? "—" : entries.length}');
    expect(bloco).toContain("Não consegui ler a fila de espera agora");
  });

  test("e a faixa diz o que NÃO concluir", () => {
    /* "Erro ao carregar" faria o médico atualizar e seguir. A frase precisa
       impedir a conclusão errada, que é o dano real. */
    expect(painel).toContain("não</strong> quer dizer que ela");
  });
});

describe("3. a lista de pacientes não afirma consultório vazio", () => {
  const link = semComentarios("src/lib/patientlink.functions.ts");

  test("a cascata de selects diz se chegou a LER", () => {
    /**
     * O laço sai por três portas: achou, erro real (break), ou esgotou os
     * selects. Nas duas últimas `rows` ficava `null` e o `(rows ?? [])`
     * transformava isso em lista vazia com `ok: true`.
     *
     * Em produção não é hipotético: a última tentativa da cascata ainda cita
     * `doctor_id` no filtro, e se ESSA coluna faltar as seis falham em
     * sequência com 42703 — a tela então afirma que o consultório está vazio.
     */
    const i = link.indexOf("export const listMyPatients");
    const corpo = link.slice(i, i + 2600);
    expect(corpo).toContain("let leu = false;");
    expect(corpo).toContain("leu = true;");
    expect(corpo).toContain("if (!leu) return { ok: false as const");
  });

  test("a tela avisa em vez de convidar a adicionar a primeira paciente", () => {
    /* O vazio antigo trazia um botão "+ Adicionar paciente". Para um médico com
       duzentas, isso não parece erro: parece que o produto perdeu tudo. */
    expect(painel).toContain("{patients.length === 0 && !falhouLista ? (");
    expect(painel).toContain("Não consegui carregar a sua lista de pacientes agora");
  });

  test("e a falha NÃO apaga a lista que já estava na tela", () => {
    /**
     * `setPatients([])` no ramo de erro seria a mesma mentira, só que
     * destruindo dado bom que já tinha sido lido com sucesso.
     */
    const i = painel.indexOf("async function loadPatients");
    const bloco = painel.slice(i, i + 500);
    expect(bloco).toContain("setFalhouLista(true)");
    expect(bloco).not.toContain("setPatients([])");
  });
});

describe("4. uma solicitação de vínculo que some é uma paciente perdida", () => {
  const link = semComentarios("src/lib/patientlink.functions.ts");

  test("a leitura das solicitações olha o `error`", () => {
    /**
     * É o único item desta fila em que o custo do silêncio é uma PESSOA, não um
     * número errado: do outro lado há uma gestante que pediu para ser
     * acompanhada e está esperando o aceite. Ela não tem como saber que o
     * pedido nunca apareceu para ninguém — e depois de alguns dias procura
     * outro obstetra.
     */
    const i = link.indexOf("export const listPatientRequests");
    const corpo = link.slice(i, i + 1600);
    expect(corpo).toContain("const { data: rows, error }");
    expect(corpo).toContain("if (error) return { ok: false as const, requests:");
  });

  test("o carregamento da tela tem `catch`, não só `finally`", () => {
    /**
     * Era `try/finally` SEM `catch`. `token()` devolve string vazia com a sessão
     * expirada, o validador exige `min(10)`, a chamada é rejeitada — e a
     * rejeição subia sem ninguém tratar. A tela saía do "carregando" por causa
     * do `finally` e ficava vazia, calada, para sempre.
     */
    /* Ancorado no `Promise.all` das duas listas: `listPatientRequests(...)`
       aparece antes, noutro carregador (`loadPedidosVinculo`, que já tratava
       certo), e cortar da primeira ocorrência media o bloco errado. */
    const i = painel.indexOf("const [reqRes, patRes] = await Promise.all(");
    expect(i).toBeGreaterThan(-1);
    const bloco = painel.slice(i, i + 900);
    expect(bloco).toContain("} catch {");
    expect(bloco).toContain("setFalhouLista(true)");
  });

  test("e a faixa acende se QUALQUER uma das duas listas falhar", () => {
    expect(painel).toContain("setFalhouLista(!reqRes.ok || !patRes.ok)");
  });
});

describe("5. aceitar uma paciente que não vinculou não pode passar por aceite", () => {
  const link = semComentarios("src/lib/patientlink.functions.ts");
  const bloco = link.slice(link.indexOf("export const respondPatientRequest"));

  test("o vínculo confere QUANTAS linhas mudaram, não só o erro", () => {
    /**
     * Um UPDATE que não encontra a linha NÃO é erro no Postgres: afeta zero
     * linhas e volta limpo. Como a solicitação já foi RECLAMADA como "accepted"
     * uma linha acima, o resultado era o pior estado possível.
     *
     * A paciente fica em limbo: o cartão dela sai de "aguardando o médico" e
     * ela acredita que foi aceita, enquanto `doctor_id` continua nulo. Não
     * aparece na lista dele, o cérebro dele não a atende, e o SOS dela não
     * chega a ninguém — sem uma linha de erro em lugar nenhum.
     */
    expect(bloco).toContain('.eq("id", req.patient_id)\n        .select("id")');
    expect(bloco).toContain("if (linkErr || !vinculada?.length)");
  });

  test("e zero linhas DESFAZ a decisão, em vez de seguir", () => {
    /* O rollback já existia para o caso de erro; faltava chegar até aqui. */
    const i = bloco.indexOf("if (linkErr || !vinculada?.length)");
    const trecho = bloco.slice(i, i + 420);
    expect(trecho).toContain("await desfazer();");
    expect(trecho).toContain("return { ok: false as const };");
  });

  test("o caso silencioso fica REGISTRADO — ele não tem erro para logar", () => {
    /* Sem erro do banco não há nada em log nenhum: se não registrarmos, esse
       estado é literalmente invisível depois do fato. */
    const i = bloco.indexOf("if (linkErr || !vinculada?.length)");
    expect(bloco.slice(i, i + 420)).toContain("aceite não encontrou o perfil da paciente");
  });
});

describe("6. o botão «Ver relatório» não pode virar «...» para sempre", () => {
  /**
   * `tokenFn()` devolve string vazia quando a sessão expira, e o validador do
   * servidor exige `min(10)` — a chamada é REJEITADA e a promessa estoura.
   *
   * Sem `catch`/`finally`, `setLoadingReport(null)` nunca rodava: o botão
   * virava "..." e ficava assim, desabilitado, até o médico recarregar a
   * página. Ele fica clicando num botão morto, sem uma palavra do que houve.
   *
   * E com `res.ok` falso a linha expandia sem nada dentro — silêncio no lugar
   * de "não consegui".
   */
  const i = painel.indexOf("async function loadPatientReport");
  const bloco = painel.slice(i, i + 1100);

  test("o carregamento sempre termina", () => {
    expect(bloco).toContain("} finally {");
    expect(bloco).toContain("setLoadingReport(null);");
    /* O `finally` é o que garante isso mesmo quando a promessa estoura. */
    const iFinally = bloco.indexOf("} finally {");
    expect(bloco.indexOf("setLoadingReport(null);")).toBeGreaterThan(iFinally);
  });

  test("e a falha aparece na linha DAQUELA paciente", () => {
    /* Um erro global mostraria o aviso na linha errada quando duas falham. */
    /* Os DOIS ramos: `ok:false` (o servidor respondeu que não deu) e a exceção
       (a promessa estourou). Cobrar a expressão solta era satisfeito pelo
       `catch` enquanto o `else` sumia — e `ok:false` é o caso mais comum dos
       dois, porque não depende de a sessão ter expirado. */
    expect(bloco).toContain("else setErroReport((e) => ({ ...e, [userId]: true }));");
    expect(bloco).toContain("} catch {\n      setErroReport((e) => ({ ...e, [userId]: true }));");
    expect(painel).toContain("{expandedId === p.id && erroReport[p.id] && (");
    expect(painel).toContain("Não consegui carregar o relatório dela agora");
  });

  test("os DOIS botões «Ver relatório» têm a faixa", () => {
    /* A tela repete o cartão em duas listas; corrigir um só deixaria o defeito
       vivo na outra — é o padrão desta base. */
    expect((painel.match(/erroReport\[p\.id\]/g) ?? []).length).toBe(2);
  });
});

describe("7. a aba Engajamento não morre calada", () => {
  /**
   * `token()` devolve string vazia quando a sessão expira e o validador exige
   * `min(10)` — a chamada é REJEITADA e a promessa estoura. Sem `try`, sem
   * estado de erro e sem `else`, `engagement` ficava `null` e a aba continuava
   * mostrando "Clique para carregar o dashboard". O médico clica, nada
   * acontece, clica de novo.
   *
   * O irmão ao lado (`loadEventosClinicos`) já fazia isto certo — mais um caso
   * de correção aplicada de um lado só.
   */
  const i = painel.indexOf("async function loadEngagement");
  const bloco = painel.slice(i, i + 800);

  test("o carregador trata os dois modos de falha", () => {
    expect(bloco).toContain("else setFonteFalhou((f) => ({ ...f, engajamento: true }));");
    expect(bloco).toContain(
      "} catch {\n      setFonteFalhou((f) => ({ ...f, engajamento: true }));",
    );
  });

  test("e limpa o aviso quando dá certo", () => {
    /* Sem isto a faixa fica acesa para sempre depois da primeira falha. */
    expect(bloco).toContain("setFonteFalhou((f) => ({ ...f, engajamento: false }));");
  });

  test("a tela para de convidar a repetir o que acabou de falhar", () => {
    expect(painel).toContain("falhou={fonteFalhou.engajamento}");
    expect(painel).toContain("Não consegui carregar o dashboard agora");
    expect(painel).toContain('{falhou ? "Tentar de novo:" : "Clique para carregar o dashboard."}');
  });
});

describe("8. a fila de perguntas não esvazia por causa da leitura dos PERFIS", () => {
  /**
   * ─── O ELO QUE NÃO É ÓBVIO ────────────────────────────────────────────────
   *
   * `getAdminData` faz três leituras em paralelo e descartava os três `error`.
   *
   * A de `patient_profiles` é a pior, e não parece: o mapa de nomes que ela
   * produz alimenta o FILTRO das perguntas (`nameById.has(q.user_id)`). Se essa
   * leitura falha, o mapa fica vazio e o filtro derruba TODAS as perguntas — a
   * fila do médico esvazia inteira por causa de uma consulta que nem é a das
   * perguntas, e a tela diz que não há nada a responder.
   *
   * É o mesmo formato do defeito de `vinculadasAgora`: uma segunda leitura,
   * acrescentada por um bom motivo, sem a proteção que a primeira já tinha.
   */
  const adminFn = semComentarios("src/lib/admin.functions.ts");

  test("as três leituras são conferidas", () => {
    expect(adminFn).toContain(
      "const leituraFalhou = !!(appts.error || questions.error || profiles.error);",
    );
  });

  test("mas o dado bom NÃO é jogado fora", () => {
    /**
     * `ok:false` aqui apagaria os agendamentos que podem ter vindo bem. Trocar
     * uma mentira por um apagão não é conserto — a tela precisa mostrar o que
     * tem E avisar que pode faltar.
     */
    const i = adminFn.indexOf("const leituraFalhou");
    const bloco = adminFn.slice(i, i + 2600);
    expect(bloco).toContain("incompleto: leituraFalhou,");
    expect(bloco).not.toContain("if (leituraFalhou) return { ok: false");
  });

  test("e o painel acende a faixa com isso", () => {
    /* Sem o chamador, o servidor diria a verdade e a tela continuaria calada. */
    expect(painel).toContain(
      "setFonteFalhou((f) => ({ ...f, consultasEPerguntas: !!res.incompleto }));",
    );
  });
});
