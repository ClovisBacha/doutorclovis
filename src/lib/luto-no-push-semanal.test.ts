/**
 * O MODO CUIDADO NO CRON SEMANAL — e ele falhava ABERTO.
 *
 * Os dois resumos que o `push-weekly-tick` manda (o da Gratidão e o da
 * Comunidade) consultam quem está em Modo Cuidado DEPOIS de somar, contra só
 * quem tem resumo — o que é certo, porque ler `care_mode` da base inteira seria
 * varrê-la à toa.
 *
 * ⚠️ O que estava errado é o que se fazia com a FALHA dessa consulta. O `error`
 * era descartado, e `data` vem `null` quando a consulta falha: o conjunto de
 * quem está em luto saía VAZIO e o portão virava um no-op. TODA paciente em Modo
 * Cuidado recebia o push — um comemorando "coisas boas esta semana 💛", o outro
 * chamando de volta para o feed —, no mesmo canal por onde chega o aviso de
 * emergência, para quem acabou de perder a gestação.
 *
 * Estes dois resumos são um agrado, não uma necessidade: não mandar por uma
 * noite não custa nada, e mandar para a pessoa errada custa o que não se
 * desfaz.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const FONTE = readFileSync("src/routes/api/push-weekly-tick.ts", "utf8");
/* ⚠️ Sem comentários antes de procurar: a prosa que EXPLICA a decisão contém,
   por definição, as palavras que o teste procura. */
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

/**
 * O corpo de UMA função, até a PRÓXIMA declaração de topo.
 *
 * ⚠️ Recortar em `\n}\n` não serve: o primeiro fechamento de coluna zero pode
 * ser o de um bloco interno, e a janela sai curta demais — a asserção passa a
 * medir um pedaço que não contém o que ela procura. É a mesma armadilha que
 * `caixinha.ts` documenta (`slice` curto demais mente em silêncio).
 */
function corpoDe(nome: string): string {
  const i = CODIGO.indexOf(`async function ${nome}`);
  expect(i).toBeGreaterThan(-1);
  const resto = CODIGO.slice(i + 20);
  const j = resto.search(/\n(async function|function|export|const \w+ =)/);
  return j === -1 ? CODIGO.slice(i) : CODIGO.slice(i, i + 20 + j);
}

describe("os dois resumos semanais", () => {
  for (const fn of ["resumoDaComunidade", "nudgeGratidaoDaSemana"]) {
    const corpo = corpoDe(fn);

    test(`⚠️ ${fn}: a consulta do luto LÊ o erro`, () => {
      /* Sem ler o `error`, a falha é indistinguível de "ninguém está em luto". */
      expect(corpo).toMatch(/error:\s*erroDoLuto/);
    });

    test(`⚠️ ${fn}: erro ao ler o luto NÃO manda nada`, () => {
      /* O `return 0` tem de vir ANTES do laço de envio — depois dele seria
         decoração. */
      /* ⚠️ A CHAMADA, e não a primeira ocorrência do nome: `sendPushToUser`
         aparece antes num `await import(...)`, e procurar o nome cru fazia a
         asserção comparar o guarda com o IMPORT — que vem no topo da função e
         daria vermelho sobre código certo. Foi o próprio teste que pegou isso,
         e é a mesma família de defeito que `caixinha.ts` documenta. */
      const guarda = corpo.indexOf("if (erroDoLuto)");
      const envio = corpo.indexOf("await sendPushToUser(");
      expect(guarda).toBeGreaterThan(-1);
      expect(envio).toBeGreaterThan(-1);
      expect(guarda).toBeLessThan(envio);
      expect(corpo.slice(guarda, envio)).toContain("return 0");
    });
  }
});
