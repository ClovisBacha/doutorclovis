/**
 * LEITURA CUJO SILÊNCIO LIBERA ALGUMA COISA TEM DE FALHAR FECHADA.
 *
 * ⚠️ **A pergunta de triagem, e ela vale para toda leitura nova:**
 * _"se esta consulta voltar vazia ou com erro, alguma coisa fica mais
 * PERMITIDA, mais VISÍVEL ou mais BARATA?"_ Se sim, o erro tem de RECUSAR.
 *
 * Este repositório já pagou a mesma classe cinco vezes — o luto vazando, o
 * conjunto de bloqueio virando vazio, os horários livres ignorando as férias
 * do médico, o saldo do chá relido com erro descartado. Os três abaixo são a
 * sexta, sétima e oitava.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const ler = (f: string) => semComentarios(readFileSync(f, "utf8"));

/** O corpo de uma função exportada, do `export const NOME` até o próximo. */
function corpo(fonte: string, nome: string): string {
  const i = fonte.indexOf(`export const ${nome}`);
  expect(i).toBeGreaterThan(-1);
  const j = fonte.indexOf("\nexport ", i + 10);
  return fonte.slice(i, j === -1 ? fonte.length : j);
}

describe("marcar consulta: o choque de horário", () => {
  const M = corpo(ler("src/lib/admin.functions.ts"), "marcarConsultaNoDia");

  test("⚠️ a leitura do dia RECUSA quando falha", () => {
    /* Era `const { data: doDia } = await scopedBy(...)` com o erro descartado
       e `(doDia ?? [])` na régua: falha de leitura devolvia lista vazia, o
       choque virava `undefined`, e a consulta era marcada por cima de outra.
       O índice único do banco pega só o INSTANTE exato — a sobreposição
       (10:00–10:30 vs 10:15) passa por ele. */
    expect(M).toMatch(/doDia === null/);
    expect(M).toContain("Não foi possível conferir a agenda do dia");
  });

  test("⚠️ a régua não usa mais o `?? []` que apagava o choque", () => {
    expect(M).not.toMatch(/\(doDia \?\? \[\]\)/);
  });

  test("o degrau de `duration_minutes` continua", () => {
    /* Sem a coluna, ler sem ela e usar a duração padrão é melhor que recusar
       toda marcação num banco atrasado. */
    expect(M).toContain('lerODia("id, patient_name, confirmed_time")');
  });
});

describe("a cota mensal de convites Premium", () => {
  const I = ler("src/lib/invites.functions.ts");

  test("⚠️ a contagem devolve `null`, e nunca zero", () => {
    /* `return count ?? 0` com o erro descartado transformava toda falha em
       "zero usados": `0 >= 25` é falso, e a cota deixava de existir. Cada
       convite é um ANO de Premium grátis. */
    expect(I).toMatch(/Promise<number \| null>/);
    expect(I).toMatch(/if \(error\) return null;/);
  });

  test("⚠️ gerar convite RECUSA quando não deu para contar", () => {
    expect(I).toContain('error: "cota_ilegivel"');
  });

  test("⚠️ e o painel não anuncia convites que talvez não existam", () => {
    expect(I).toContain("usedIlegivel");
  });
});

describe("o chá de bebê e o Modo Cuidado", () => {
  const P = ler("src/lib/presentes.functions.ts");

  test("⚠️ perfil ilegível FECHA a lista", () => {
    /* Era `if (p?.care_mode)`. Com `p` nulo, `?.care_mode` é `undefined` e o
       `if` não dispara: a lista continuava no ar para as trinta pessoas que já
       têm o link, depois de uma perda. É o recurso em que isso dói mais,
       porque o objeto vive FORA do aparelho dela. */
    expect(P).toMatch(/if \(!p \|\| p\.care_mode\) return null;/);
    expect(P).not.toMatch(/if \(p\?\.care_mode\) return null;/);
  });
});

describe("o export de LGPD não some com dado dela", () => {
  const E = ler("src/lib/exportar-dados.functions.ts");

  test("⚠️ COLUNA ausente (42703) vira FALHA, e não bloco vazio", () => {
    /* Tabela ausente (42P01) é normal num banco atrás das migrations: não há o
       que levar. Coluna ausente é o OPOSTO — a tabela está lá, com o que ela
       escreveu, e o `select` é que pediu errado. Juntar os dois fazia o bloco
       inteiro sumir com `falhas: []`: ela baixava um arquivo que PARECE
       completo, sem o perfil, e apagava a conta confiando nele. */
    expect(E).toMatch(/if \(code !== "42P01"\) falhas\.push/);
    expect(E).not.toMatch(/code !== "42P01" && code !== "42703"/);
  });
});

describe("apagar a conta não deixa nome e telefone na agenda", () => {
  const C = ler("src/lib/conta.functions.ts");

  test("⚠️ a agenda é ANONIMIZADA, e não apagada", () => {
    /* `patient_user_id` é `ON DELETE SET NULL` — deliberado, a agenda do médico
       não pode perder a consulta. Mas nome, e-mail, telefone e observações são
       digitados no pedido e sobreviviam inteiros. Apagar a linha destruiria o
       histórico DELE; anonimizar tira a pessoa e deixa o fato. */
    expect(C).toContain('.from("appointment_requests")');
    expect(C).toContain('patient_name: "Paciente removida"');
    expect(C).toMatch(/notes: null/);
  });

  test("⚠️ NOT NULL não vira `null` — isso travaria a exclusão inteira", () => {
    /* `patient_email` e `patient_phone` são `NOT NULL`: mandar `null` faz o
       update falhar, a exclusão devolver "falhou", e ela ficar sem conseguir
       apagar a conta — um vazamento trocado por um bloqueio. */
    expect(C).not.toMatch(/patient_email: null/);
    expect(C).not.toMatch(/patient_phone: null/);
  });

  test("⚠️ roda ANTES do `deleteUser`", () => {
    /* Depois, `patient_user_id` já é NULL e não há mais como achar as linhas
       dela. */
    const anon = C.indexOf('patient_name: "Paciente removida"');
    const apaga = C.indexOf("admin.deleteUser");
    expect(anon).toBeGreaterThan(-1);
    expect(apaga).toBeGreaterThan(-1);
    expect(anon).toBeLessThan(apaga);
  });
});

/**
 * ─── A VAGA CORPORATIVA ───────────────────────────────────────────────────
 *
 * ⚠️ `const { count } = …` descartava o `error`, e `count ?? 0` fazia
 * `0 >= max_seats` ser FALSO: qualquer falha de leitura concedia a vaga. O teto
 * contratado deixava de existir em silêncio, e cada vaga é um acesso pago que a
 * empresa não comprou.
 *
 * ⚠️ E o recado distingue os dois casos. "Limite atingido" sobre uma contagem
 * que falhou faria a paciente — e o RH que ela procurasse — concluírem que o
 * contrato acabou, num mês em que ainda há vagas.
 */
describe("vaga corporativa: o teto do contrato", () => {
  const CORP = readFileSync("src/lib/corporativo.functions.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

  test("⚠️ o erro da contagem é NOMEADO e conferido", () => {
    expect(CORP).toContain("error: erroDaContagem");
    expect(CORP).toContain("if (erroDaContagem || count === null)");
  });

  test("⚠️ `count ?? 0` sumiu — era ele que abria o portão", () => {
    expect(CORP).not.toContain("(count ?? 0) >= account.max_seats");
    expect(CORP).toContain("if (count >= account.max_seats)");
  });

  test("⚠️ a falha NÃO é dita como 'limite atingido'", () => {
    const i = CORP.indexOf("if (erroDaContagem || count === null)");
    expect(i).toBeGreaterThan(-1);
    const bloco = CORP.slice(i, CORP.indexOf("if (count >= account.max_seats)", i));
    expect(bloco).toMatch(/tente de novo/i);
    expect(bloco).not.toMatch(/Limite de vagas atingido/);
  });
});

/**
 * ─── ARQUIVAR UM ITEM DO CHÁ ──────────────────────────────────────────────
 *
 * ⚠️ O `error` era descartado e `(count ?? 0) > 0` virava falso: qualquer falha
 * de leitura ARQUIVAVA o item por cima de uma reserva viva — quebrando, em
 * silêncio, a promessa que o comentário da própria função faz três linhas
 * acima ("quem prometeu merece saber antes"). A amiga que reservou o carrinho
 * perde a reserva sem ninguém avisar, e a mãe fica sem o presente achando que
 * ele foi retirado.
 */
describe("chá de bebê: arquivar por cima de uma reserva", () => {
  const CHA = readFileSync("src/lib/presentes.functions.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
  const TELA = readFileSync("src/components/cha-de-bebe.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

  test("⚠️ o erro da contagem é NOMEADO e recusa", () => {
    expect(CHA).toContain("error: erroDaContagem");
    expect(CHA).toContain("if (erroDaContagem || count === null)");
    expect(CHA).toContain('motivo: "contagem-ilegivel" as const');
  });

  test("⚠️ `count ?? 0` sumiu — era ele que abria o portão", () => {
    expect(CHA).not.toContain("(count ?? 0) > 0");
    expect(CHA).toContain("if (count > 0) return");
  });

  test("⚠️ a falha NÃO é dita como 'alguém já reservou'", () => {
    /* Faria a mãe procurar uma reserva que talvez não exista, e desistir de
       tirar um item que ela pode tirar. */
    expect(TELA).toContain('motivo === "contagem-ilegivel"');
    expect(TELA).toMatch(/Não consegui conferir se alguém já reservou/);
  });
});

/**
 * ─── O INTERRUPTOR DE EMERGÊNCIA DO DONO ──────────────────────────────────
 *
 * ⚠️ A ausência de linha vale "ligado", e isso está certo. O defeito era tratar
 * **falha de leitura** como ausência — e GRAVAR essa falha no cache por trinta
 * segundos: o dono desliga algo que está causando dano, o banco oscila, e o
 * interruptor fica inoperante justamente no momento em que é acionado.
 */
describe("kill switch: a falha de leitura não desarma", () => {
  const FLAGS = readFileSync("src/lib/platform-flags.server.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

  test("⚠️ o `error` é lido, e a tabela ausente é o ÚNICO caso que vira 'ligado'", () => {
    expect(FLAGS).toContain("const { data, error }");
    expect(FLAGS).toContain("if (error && !AUSENTE.has(String(error.code)))");
    expect(FLAGS).toContain('"42P01"');
  });

  test("⚠️ falha serve o ÚLTIMO VALOR CONHECIDO", () => {
    /* Mesmo vencido: um valor real de trinta segundos atrás é infinitamente
       melhor que "ligado" quando o dono acabou de desligar. */
    const falhas = FLAGS.match(/return hit \? hit\.row : null;/g) ?? [];
    expect(falhas.length).toBe(2); // o erro do PostgREST e a exceção de rede
  });

  test("⚠️ e NÃO grava no cache — senão o engano congela por 30s", () => {
    /* A gravação só acontece no caminho de sucesso. Se ela estivesse depois do
       try/catch, cada oscilação re-gravaria a mesma mentira e o interruptor
       ficaria inoperante enquanto a oscilação durasse. */
    const gravacoes = FLAGS.match(/cache\.set\(key, \{ row/g) ?? [];
    expect(gravacoes.length).toBe(1);
    const iGrava = FLAGS.indexOf("cache.set(key, { row");
    const iCatch = FLAGS.indexOf("} catch {", FLAGS.indexOf("async function readFlag"));
    expect(iGrava).toBeLessThan(iCatch);
  });
});

/**
 * ─── AS DUAS ÚLTIMAS CONTAGENS QUE BARRAVAM E FALHAVAM ABERTAS ────────────
 *
 * ⚠️ Achadas por varredura mecânica da forma exata (`const { count } = await`)
 * depois de a classe produzir seis defeitos numa noite. Treze sítios no `src/`
 * inteiro; onze são NÚMERO INFORMATIVO — quatro deles já dizem isso no próprio
 * comentário —, e estes dois BARRAM alguma coisa.
 *
 * ⚠️ **A régua de triagem não é "o erro foi olhado?", é "se esta leitura voltar
 * vazia, alguma coisa fica mais PERMITIDA?"** Mexer nos onze informativos seria
 * churn; deixar estes dois seria o teto de um cupom pago e o teto anti-spam
 * deixando de existir em silêncio.
 */
describe("as contagens que barram", () => {
  const semCom = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  const CUPOM = semCom(readFileSync("src/lib/invites.functions.ts", "utf8"));
  const AMIGAS = semCom(readFileSync("src/lib/amigas.functions.ts", "utf8"));
  const TELA = semCom(readFileSync("src/components/amigas.tsx", "utf8"));

  test("⚠️ o cupom da plataforma REVERTE quando não consegue contar", () => {
    /* A linha JÁ foi inserida acima, então uma falha aqui não é "não sei" — é o
       teto deixando de existir, e cada resgate a mais é um plano pago que
       ninguém comprou. */
    expect(CUPOM).toContain("if (erroDaContagem || count === null || count > pc.max_redemptions)");
    expect(CUPOM).not.toContain("(count ?? 0) > pc.max_redemptions");
  });

  test("⚠️ o teto diário de convites RECUSA quando não consegue contar", () => {
    /* É justamente sob carga — um roteiro disparando — que a leitura falha, e
       o canal que isso gasta é o mesmo por onde chega o aviso de emergência. */
    expect(AMIGAS).toContain('return { ok: false as const, error: "instavel" as const }');
    expect(AMIGAS).toContain("if (count >= CONVITES_POR_DIA)");
    expect(AMIGAS).not.toContain("(count ?? 0) >= CONVITES_POR_DIA");
  });

  test("⚠️ a falha NÃO é dita como 'tente de novo amanhã'", () => {
    /* Faria ela desistir por um dia inteiro de um convite que o servidor
       aceitaria em dez segundos. */
    expect(TELA).toContain('r.error === "instavel"');
    expect(TELA).toMatch(/Não consegui conferir seus convites de hoje/);
  });
});

/**
 * ─── O BOLSO DA CRIADORA ──────────────────────────────────────────────────
 *
 * ⚠️ O `error` da releitura do ledger era descartado e `pagasCru ?? []` virava
 * lista vazia: `gasto` ia a ZERO, `0 + 30 > 300` era falso, e o presente saía.
 * Numa oscilação do banco a mesada inteira deixava de existir — e não uma vez:
 * cada chamada recalcularia zero, e a criadora distribuiria sem teto enquanto a
 * leitura não voltasse.
 *
 * ⚠️ E o comentário logo acima da consulta diz "o bolso é RELIDO ANTES de
 * gravar" — a releitura acontecia e o resultado dela não valia nada.
 */
describe("criadora: a mesada relida", () => {
  const semCom = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  const INF = semCom(readFileSync("src/lib/influenciadora.functions.ts", "utf8"));
  const TELA = semCom(readFileSync("src/routes/influenciadora.tsx", "utf8"));

  test("⚠️ o erro da releitura é NOMEADO e recusa", () => {
    expect(INF).toContain("error: erroDoBolso");
    expect(INF).toContain(
      'if (erroDoBolso || !pagasCru) return { ok: false as const, motivo: "instavel" as const }',
    );
  });

  test("⚠️ `pagasCru ?? []` sumiu — era ele que zerava o gasto", () => {
    expect(INF).not.toContain("((pagasCru ?? []) as unknown[]).length");
    expect(INF).toContain("(pagasCru as unknown[]).length");
  });

  test("⚠️ a falha NÃO é dita como 'o bolso acabou'", () => {
    /* Faria a criadora concluir, no dia 3 do mês, que a mesada dela terminou —
       e parar de presentear até o mês virar. */
    expect(TELA).toContain('r.motivo === "instavel"');
    expect(TELA).toMatch(/Não consegui conferir o seu bolso agora/);
  });
});
