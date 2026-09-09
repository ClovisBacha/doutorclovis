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
import { semComentarios } from "./sem-comentarios";

/* ⚠️ A prosa acima cita o que ela proíbe — sai antes de qualquer busca, pela
   RÉGUA ÚNICA. Este arquivo tinha um apagador próprio de regex ingênua, e ela
   é a que este repositório documenta engolir código: `minha-conta.tsx` tem
   `accept="image/(estrela)"` em duas linhas, e a barra-asterisco dentro da
   string abre um "comentário" que só fecha centenas de linhas abaixo. */

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
  /* ⚠️ A FUNÇÃO PODE SER A ÚLTIMA DO ARQUIVO, e a primeira versão disto não
     previa: ao virar módulo próprio, `consultorioDaPaciente` deixou de ter um
     `\nfunction ` depois dela, o corte estourou no ESCOPO DO MÓDULO e o
     arquivo inteiro saiu com "0 pass, 0 fail, 1 error" — ou seja, nenhuma
     destas travas rodou, e só o aviso de erro-fora-de-teste do portão contou.
     Sem fim à vista, o corpo vai até o fim do arquivo. */
  const proxima = ["\nfunction ", "\nexport function ", "\nexport async function "]
    .map((m) => fonte.indexOf(m, i + 1))
    .filter((k) => k > i);
  const j = proxima.length ? Math.min(...proxima) : fonte.length;
  const corpo = fonte.slice(i, j);
  /* E o corte não pode engolir uma segunda função: seria a fatia inteira
     passando por "o corpo desta", que é como uma asserção começa a mentir. */
  expect(corpo.slice(assinatura.length)).not.toMatch(/\n(export )?(async )?function /);
  return corpo;
}

/**
 * ⚠️ A RÉGUA MUDOU DE ARQUIVO, E A GARANTIA FICOU MAIOR.
 *
 * `consultorioDaPaciente` nasceu privada dentro de `api/nutrition.ts`. No dia
 * em que `api/prato.ts` (a foto do prato e do rótulo) precisou da mesma
 * decisão, a tentação era copiar as quinze linhas — e a cópia divergiria no
 * primeiro conserto, aparecendo como a resposta da FOTO falando da gestação de
 * quem acabou de perdê-la. Ela virou módulo, e a catraca passou a cobrar
 * também que ninguém escreva a segunda cópia.
 */
const REGUA = readFileSync("src/lib/consultorio-da-paciente.server.ts", "utf8");
const PRATO = readFileSync("src/routes/api/prato.ts", "utf8");

describe("⚠️ o Modo Cuidado da nutrição falha FECHADO", () => {
  const corpo = corpoDe(REGUA, "export async function consultorioDaPaciente(");

  test("⚠️ os DOIS endpoints usam a mesma régua — nunca uma segunda leitura", () => {
    for (const [nome, fonte] of [
      ["nutrition", NUTRICAO],
      ["prato", PRATO],
    ] as const) {
      expect(`${nome}:${fonte.includes("consultorioDaPaciente(usuario.id)")}`).toBe(`${nome}:true`);
      /* E nenhum dos dois relê o perfil por conta própria: uma segunda leitura
         seria a segunda régua, com o `Boolean(null)` de volta. */
      expect(`${nome}:${/\.select\("doctor_id/.test(fonte)}`).toBe(`${nome}:false`);
    }
  });

  test("o erro da leitura é OLHADO — não basta o try/catch", () => {
    /* O PostgREST resolve com `{ data, error }`; um `catch` em volta pega a
       queda de rede e deixa passar exatamente o caso comum, que é o banco
       recusando a consulta.

       ⚠️ `const` OU `let` — e a diferença não é estilo: no dia em que a leitura
       ganhou o degrau de recuo da coluna nova (`quiz_premium`), ela precisou
       ser reatribuída, e esta asserção reprovou uma mudança que só APERTOU a
       garantia. É a décima quarta vez nesta base; a régua continua sendo cobrar
       o que o código GARANTE — o `error` é destruturado e é olhado —, nunca a
       palavra com que ele foi escrito. */
    expect(corpo).toMatch(/(?:const|let) \{ data, error \} = await/);
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

/**
 * ⚠️ A OUTRA METADE DA MESMA REGRA — A TELA.
 *
 * O servidor falha fechado desde que este arquivo existe. O CLIENTE não
 * falhava: `minha-conta.tsx` derivava `careMode` de `Boolean(profile?.care_mode)`,
 * e `profile` é `null` em DOIS casos que essa linha não distinguia — "ainda
 * não chegou" e "a leitura FALHOU". O erro até era capturado (`perfilInstavel`),
 * e tinha UM só consumidor: a carteirinha de emergência.
 *
 * Com uma oscilação de rede, a paciente em Modo Cuidado abria a Nutrição e
 * lia "Sou sua nutricionista GESTACIONAL virtual"; a bolha dela passava a
 * perguntar "posso comer sushi NA GESTAÇÃO?"; e os portões de
 * `nutricao-memoria.ts` caíam — até doze turnos de uma conversa ANTERIOR À
 * PERDA voltavam para a tela, e os novos eram gravados.
 *
 * ⚠️ E o conserto separou DUAS PERGUNTAS que uma variável só respondia:
 * `lutoDoPerfil` é o FATO gravado e governa o que AFIRMA o estado dela (a
 * faixa e a chave do Perfil); `careMode` é o PORTÃO DE CONTEÚDO e falha
 * fechado. Sem a separação, a fail-closed diria "você está em Modo Cuidado" a
 * quem não está.
 */
describe("a tela também assume luto quando não conseguiu ler o perfil", () => {
  const TELA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));

  test("⚠️ `careMode` inclui a leitura instável", () => {
    expect(TELA).toMatch(/const careMode = perfilInstavel \|\| lutoDoPerfil;/);
  });

  test("o fato gravado continua existindo, separado do portão", () => {
    expect(TELA).toMatch(/const lutoDoPerfil = Boolean\(/);
    /* E é ELE que decide a faixa do luto e a chave do Perfil — nunca o portão,
       que afirmaria à paciente uma coisa falsa sobre a própria perda. */
    expect(TELA).toMatch(/\{lutoDoPerfil && \(\s*<CareModeBanner/);
    expect(TELA).toMatch(/careMode=\{lutoDoPerfil\}/);
  });

  test("⚠️ e a aba da Nutrição recebe o PORTÃO, não o fato", () => {
    /* É ela que carrega a memória entre conversas e a palavra "gestacional". */
    const i = TELA.indexOf("<NutricaoTab");
    expect(i).toBeGreaterThan(-1);
    expect(TELA.slice(i, i + 400)).toMatch(/careMode=\{careMode\}/);
  });
});
