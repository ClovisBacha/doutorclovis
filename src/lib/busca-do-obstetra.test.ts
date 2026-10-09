/**
 * "NÃO CONSEGUI LER" NÃO PODE TER A CARA DE "ELE NÃO ESTÁ AQUI".
 *
 * ⚠️ **O app afirmava, sobre o mundo real, que o obstetra dela não existe.**
 * `searchDoctors` devolve `{ ok: false, error }` quando a leitura falha — a
 * tela descartava o sinal, caía em `results: []` com `searched: true`, e
 * escrevia **"Nenhum médico com esse nome"**. Uma queda de rede bastava.
 *
 * Nesta aba esse é o pior desfecho possível. Ela está procurando o SEU médico:
 * lê que ele não está na plataforma, e **para de procurar**. O vínculo que liga
 * uma gestação de alto risco ao obstetra dela morre numa frase que não era
 * verdade — e não sobra erro, log nem tela vazia para alguém investigar.
 *
 * ⚠️ **É a mesma correção que a Comunidade já tinha ganhado.** `meuFeed`,
 * `sugestoesDoFeed` e `buscarPerfis` devolvem `motivo: "instavel"` exatamente
 * por isto, e o CLAUDE.md registra que o caso pior era a BUSCA, "porque o vazio
 * dela EXPLICA um motivo errado". Aqui o motivo errado é sobre uma pessoa de
 * verdade.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

/**
 * ⚠️ Os comentários saem ANTES da busca, nos dois sentidos: este arquivo e a
 * tela CITAM a frase proibida para explicar por que ela é condicionada. Sem
 * tirar a prosa, a catraca acusaria a documentação do próprio conserto.
 */
const CONTA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));
const SERVIDOR = semComentarios(readFileSync("src/lib/doctors.functions.ts", "utf8"));

/**
 * O corpo de uma função, por CONTAGEM DE CHAVES — nunca por janela de
 * caracteres, que fica verde no dia em que alguém acrescenta uma linha.
 *
 * ⚠️ `depois` é uma lista de marcadores percorridos EM ORDEM, e ela existe
 * porque um `createServerFn` põe DUAS chaves antes do corpo — e cada uma custou
 * uma volta:
 *
 *   · `createServerFn({ method: "POST" })` — o extrator devolvia
 *     `{ method: "POST" }`, e a mutação do servidor passou VERDE;
 *   · `.handler(async ({ data }) => {` — devolvia `{ data }`, e a asserção
 *     ficou VERMELHA sobre o código certo.
 *
 * As duas direções do mesmo engano, na mesma tarde. Por isso o caminho é
 * declarado (`.handler(` → `=>`) em vez de adivinhado.
 *
 * ⚠️ E o marcador NÃO inclui a chave de abertura: incluindo-a, o cursor passa
 * dela e a contagem começa na chave SEGUINTE — que num handler é a
 * desestruturação da primeira linha. Terceira volta pelo mesmo extrator.
 */
function corpoDe(fonte: string, assinatura: string, depois: readonly string[] = []): string {
  const i = fonte.indexOf(assinatura);
  if (i < 0) return "";
  let de = i;
  for (const marca of depois) {
    de = fonte.indexOf(marca, de);
    if (de < 0) return "";
    de += marca.length;
  }
  const abre = fonte.indexOf("{", de);
  if (abre < 0) return "";
  let n = 0;
  for (let j = abre; j < fonte.length; j++) {
    if (fonte[j] === "{") n++;
    else if (fonte[j] === "}" && --n === 0) return fonte.slice(abre, j + 1);
  }
  return "";
}

const BUSCA = corpoDe(CONTA, "async function doSearch(");

describe("o servidor distingue, e a tela precisa ler", () => {
  test("⚠️ `searchDoctors` devolve `ok: false` quando a leitura falha", () => {
    /* Se ele deixasse de distinguir, a tela não teria como — e o conserto
       abaixo viraria decoração.

       ⚠️ Ancorado no CORPO de `searchDoctors`, e nunca no arquivo: este mesmo
       `if (error) return { ok: false` aparece três vezes em `doctors.functions`,
       e sobre o arquivo inteiro a mutação que o apagava DAQUI passava verde. É
       a armadilha de "outra ocorrência do mesmo nome", pela enésima vez. */
    const corpo = corpoDe(SERVIDOR, "export const searchDoctors", [".handler(", "=>"]);
    expect(corpo.length).toBeGreaterThan(0);
    expect(corpo).toMatch(/if \(error\) return \{ ok: false/);
  });

  test("⚠️ `doSearch` guarda a falha, nos DOIS caminhos", () => {
    expect(BUSCA.length).toBeGreaterThan(0);
    /* `!res.ok` (o servidor recusou) e o `catch` (a rede caiu) são o MESMO
       caso: ninguém leu lista nenhuma. */
    expect(BUSCA).toContain("setFalhouABusca(!res.ok)");
    const doCatch = BUSCA.slice(BUSCA.indexOf("} catch"));
    expect(doCatch).toContain("setFalhouABusca(true)");
  });
});

describe("a frase que afirma sobre o mundo real", () => {
  test("⚠️ 'Nenhum médico com esse nome' NÃO sai numa falha", () => {
    /* A forma exata do defeito era `searched && results.length === 0`. */
    expect(CONTA).toContain("searched && !falhouABusca && results.length === 0");
    expect(CONTA).not.toMatch(/\{searched && results\.length === 0 &&/);
  });

  test("⚠️ a falha tem tela PRÓPRIA, com o que fazer a seguir", () => {
    /* Um estado sem saída é o vazio silencioso outra vez, só que honesto — e
       ela continua sem o médico. O botão é a diferença entre "deu erro" e
       "tente de novo". */
    expect(CONTA).toContain("{falhouABusca && (");
    expect(CONTA).toMatch(/Não consegui carregar a lista agora/);
    expect(CONTA).toMatch(/Tentar de novo/);
  });

  test("⚠️ o texto da falha NÃO conclui nada sobre o cadastro do médico", () => {
    /* É a lição inteira: o app pode dizer que ELE falhou, nunca que ELA não
       vai achar quem procura. */
    const i = CONTA.indexOf("{falhouABusca && (");
    const bloco = CONTA.slice(i, i + 1200);
    for (const proibido of [
      "não está",
      "não encontramos",
      "não existe",
      "ainda não",
      "não faz parte",
    ]) {
      expect(bloco.toLowerCase()).not.toContain(proibido);
    }
    /* E diz de quem é a culpa, que é o que impede a conclusão errada. */
    expect(bloco).toMatch(/conexão/);
  });

  test("o alvo do dedo tem 44px", () => {
    const i = CONTA.indexOf("{falhouABusca && (");
    expect(CONTA.slice(i, i + 1200)).toContain("min-h-[44px]");
  });
});
