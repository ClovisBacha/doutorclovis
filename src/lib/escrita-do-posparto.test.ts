/**
 * A ABA PÓS-PARTO DIZIA "PRONTO" SEM OLHAR A RESPOSTA.
 *
 * ⚠️ **`{ ok: false }` CHEGA NUMA RESPOSTA 200 NORMAL.** Toda função de escrita
 * de `postpartum.functions.ts` devolve `{ ok: !error }` — sessão expirada, RLS,
 * coluna ausente, tudo isso volta como sucesso HTTP com `ok` falso. Um
 * `try/catch` em volta **não pega nada disso**, e foi por isso que o defeito
 * durou: o caminho parecia protegido.
 *
 * O que a tela fazia era pintar a intenção e nunca corrigir:
 *
 *   · **os marcos do bebê** — a mãe registrava o primeiro sorriso, via o ✓, e
 *     na abertura seguinte não havia nada. ⚠️ **É o livro de memórias:** o
 *     primeiro sorriso não volta para ser registrado de novo.
 *   · **o peso** — a lista era relida do servidor (então ela não mentia), e o
 *     CAMPO era limpo de qualquer jeito: numa falha o número sumia E nada
 *     aparecia. Perder o valor sem receber recado é a pior combinação, porque
 *     não sobra nem o que tentar de novo.
 *
 * ⚠️ **E A IRMÃ AO LADO — a caderneta de VACINAS — JÁ ESTAVA CONSERTADA**, com
 * o comentário do conserto visível na mesma tela. É a forma mais comum de
 * defeito deste repositório: a régua aplicada num lugar e deixada de pé no
 * vizinho. Esta catraca existe para cobrar as TRÊS de uma vez, e a próxima que
 * alguém acrescentar à lista.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const CONTA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));

/**
 * As escritas do pós-parto que a tela chama.
 *
 * ⚠️ **A lista é escrita à mão de propósito, e é a parte que envelhece.** Uma
 * varredura automática por "toda função de `postpartum.functions`" pegaria
 * junto as LEITURAS (`getMilestones`, `getBabyWeights`), que legitimamente não
 * têm `ok` a conferir — e catraca com falso positivo é catraca que alguém
 * desliga. Escrita nova entra aqui no mesmo commit que a cria.
 */
const ESCRITAS = [
  "setMilestone",
  "removeMilestone",
  "addBabyWeight",
  "markVaccineGiven",
  "removeVaccine",
] as const;

/**
 * O corpo de uma função, por CONTAGEM DE CHAVES.
 *
 * ⚠️ Nunca uma janela de N caracteres: este repositório já pagou quatro vezes
 * por asserção que media distância — ela fica verde no dia em que alguém
 * acrescenta uma linha no meio, e vermelha sobre código correto no dia em que
 * alguém tira uma.
 */
function corpoDe(fonte: string, assinatura: string): string {
  const i = fonte.indexOf(assinatura);
  if (i < 0) return "";
  const abre = fonte.indexOf("{", i);
  if (abre < 0) return "";
  let n = 0;
  for (let j = abre; j < fonte.length; j++) {
    if (fonte[j] === "{") n++;
    else if (fonte[j] === "}" && --n === 0) return fonte.slice(abre, j + 1);
  }
  return "";
}

describe("nenhuma escrita do pós-parto é chamada às cegas", () => {
  for (const fn of ESCRITAS) {
    test(`⚠️ \`${fn}\` tem o retorno LIDO`, () => {
      const chamadas = [...CONTA.matchAll(new RegExp(`(.{0,12})await ${fn}\\(`, "g"))];
      /* Se a chamada sumiu, a catraca não pode ficar verde em vazio: ela
         passaria a aprovar exatamente a remoção que deveria acusar. */
      expect(chamadas.length).toBeGreaterThan(0);
      for (const c of chamadas) {
        /* `= await fn(` ou `? await fn(` / `: await fn(` de um ternário
           atribuído — nunca um `await fn(` solto no começo da linha, que é a
           forma exata do defeito. */
        expect(c[1]).toMatch(/[=?:]\s*$/);
      }
    });
  }

  test("⚠️ os três lugares recusam quando `ok` é falso", () => {
    for (const assinatura of [
      "async function toggleMilestone(",
      "async function toggleVaccine(",
      "async function handleAddWeight(",
    ]) {
      const corpo = corpoDe(CONTA, assinatura);
      expect(corpo.length).toBeGreaterThan(0);
      expect(corpo).toMatch(/if \(!r\.ok\)/);
      /* E o recado sai: um `return` mudo faz o toque não fazer nada, que é
         indistinguível de app quebrado. */
      expect(corpo).toMatch(/toast\.error\(/);
    }
  });

  test("⚠️ a pintura vem DEPOIS do desfecho, e não antes", () => {
    /* O defeito era pintar a intenção. Cobra-se a ORDEM: nos marcos, o
       `setMilestones` que ACRESCENTA tem de vir depois do `if (!r.ok)`. */
    const corpo = corpoDe(CONTA, "async function toggleMilestone(");
    const guarda = corpo.indexOf("if (!r.ok)");
    const pinta = corpo.indexOf("setMilestones(");
    expect(guarda).toBeGreaterThan(-1);
    expect(pinta).toBeGreaterThan(-1);
    expect(pinta).toBeGreaterThan(guarda);
  });

  test("⚠️ o campo do peso só limpa depois do desfecho", () => {
    /* Numa falha o número que ela digitou sumia E nada aparecia na lista. */
    const corpo = corpoDe(CONTA, "async function handleAddWeight(");
    const guarda = corpo.indexOf("if (!r.ok)");
    const limpa = corpo.indexOf('setBabyWeight("")');
    expect(guarda).toBeGreaterThan(-1);
    expect(limpa).toBeGreaterThan(guarda);
  });
});
