/**
 * "NÃO CONSEGUI LER O PERFIL" NÃO PODE VALER "NÃO ESTÁ DE LUTO".
 *
 * ⚠️ `care_mode` é o único campo do perfil em que a leitura degradada tem um
 * lado CARO. Para todo o resto, "não sei" degrada para menos recurso e pronto:
 * sem `doctor_id` a nutrição responde com informação consolidada, sem as
 * colunas clínicas o chat perde a personalização. Para o luto, "não sei" caindo
 * em `false` faz o app **falar da gestação com quem acabou de perdê-la** — e
 * essa é a pior coisa que este produto pode fazer.
 *
 * A aritmética que produz isso é sempre a mesma, e ela é invisível: o
 * PostgREST devolve `{ data: null, error }` numa falha e **não lança**, então
 * nem `try/catch` pega; `Boolean(null)` é `false`; e o `?.` de um perfil nulo
 * também é `false`. Três caminhos, um resultado: "não está de luto".
 *
 * ⚠️ E a assimetria é o que decide o lado seguro, não uma regra geral de
 * "falhe fechado". Assumir luto por engano custa uma resposta genérica em vez
 * de uma por trimestre — chato, e a próxima tentativa já corrige. Assumir que
 * não há luto por engano custa uma conversa sobre o bebê. Os dois erros não
 * têm o mesmo preço, então o padrão não pode ser o do meio.
 *
 * Este arquivo cobra o endpoint da NUTRIÇÃO, que era o que faltava: o chat já
 * tinha um degrau (re-consulta só o essencial, com `care_mode` na lista, e o
 * comentário lá explica que sem ele a degradação RELIGARIA as semanas para a
 * paciente em luto). A nutrição lia o mesmo perfil e não tinha degrau nenhum.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/** ⚠️ A prosa acima cita o que ela proíbe — sai antes de qualquer busca. */
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const NUTRICAO = semComentarios(readFileSync("src/routes/api/nutrition.ts", "utf8"));

/**
 * O corpo de uma função de topo, da assinatura até a próxima declaração de
 * topo.
 *
 * ⚠️ **NÃO é contagem de chaves a partir da assinatura**, e a primeira versão
 * deste teste caiu exatamente nisso: a assinatura termina em `(`, e o primeiro
 * `{` depois dela é o do TIPO DE RETORNO
 * (`Promise<{ doctorId: string | null; … }>`), não o do corpo. O extrator
 * devolvia o tipo, e quatro asserções ficaram vermelhas sobre código correto.
 * É a mesma armadilha que este repositório já pagou três vezes — com o objeto
 * de opções de `createServerFn({ method: "POST" })` e com o argumento
 * destruturado de `.handler(async ({ data }) => {`.
 */
function corpoDe(fonte: string, assinatura: string): string {
  const i = fonte.indexOf(assinatura);
  /* ⚠️ A âncora é conferida: `indexOf` devolve −1 quando o alvo some, e uma
     fatia a partir de −1 deixa asserção passar em branco. */
  expect(i).toBeGreaterThan(-1);
  const j = fonte.indexOf("\nfunction ", i + 1);
  expect(j).toBeGreaterThan(i);
  return fonte.slice(i, j);
}

describe("⚠️ o Modo Cuidado da nutrição falha FECHADO", () => {
  const corpo = corpoDe(NUTRICAO, "async function consultorioDaPaciente(");

  test("o erro da leitura é OLHADO — não basta o try/catch", () => {
    /* O PostgREST resolve com `{ data, error }`; um `catch` em volta pega a
       queda de rede e deixa passar exatamente o caso comum, que é o banco
       recusando a consulta. */
    expect(corpo).toMatch(/const \{ data, error \} = await/);
    expect(corpo).toMatch(/if \(error\)/);
  });

  test("perfil ilegível assume LUTO, nos DOIS caminhos", () => {
    /* O ramo do `error` e o do `catch` — os dois devolviam `careMode: false`.
       ⚠️ A cobrança é pela AUSÊNCIA do literal, e não pela contagem: o caminho
       feliz não escreve `false`, ele DERIVA de `Boolean(data?.care_mode)`.
       Contar ocorrências foi a primeira versão deste teste, e ela reprovou o
       código certo. */
    expect(corpo).not.toContain("careMode: false");
    expect((corpo.match(/careMode: true/g) ?? []).length).toBe(2);
    /* E o único caminho que aceita "não está de luto" é o que LEU o perfil. */
    const i = corpo.indexOf("careMode: Boolean(data?.care_mode)");
    expect(i).toBeGreaterThan(-1);
    /* Ele vem DEPOIS da guarda do erro: invertida, a guarda vira código morto
       e o valor derivado de um `data` nulo volta a ser `false`. */
    const iErro = corpo.indexOf("if (error)");
    expect(iErro).toBeGreaterThan(-1);
    expect(iErro).toBeLessThan(i);
  });

  test("e a falha deixa RASTRO — silêncio total esconde o dia em que isso disparar", () => {
    expect(corpo).toMatch(/console\.error\("\[nutricao\][^"]*Modo Cuidado/);
    /* Nos dois ramos, não só num. */
    expect((corpo.match(/console\.error\("\[nutricao\]/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  test("⚠️ e o luto continua governando CONTEÚDO, nunca o acesso", () => {
    /* A nutrição em luto não fecha a porta: ela troca o prompt. Assumir luto
       por engano não pode virar uma tela que não abre — senão o lado "seguro"
       passa a ser o de tirar um recurso da paciente. */
    expect(NUTRICAO).toContain("careMode ? NUTRICAO_EM_LUTO : NUTRITION_SYSTEM");
    expect(NUTRICAO).toMatch(/careMode \? "paciente" : "gestante"/);
  });

  test("o vínculo com o médico continua degradando para MENOS, e não para luto", () => {
    /* `doctorId` tem a assimetria oposta: sem ele a resposta sai consolidada,
       o que é degradação inofensiva. Ele não pode herdar a régua do luto. */
    expect(corpo).toMatch(/doctorId: null/);
    expect(corpo).toMatch(/doctorId: \(data\?\.doctor_id as string \| null\) \?\? null/);
  });
});
