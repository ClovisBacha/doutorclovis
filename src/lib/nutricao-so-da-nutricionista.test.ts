import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { CANAIS_DA_NUTRICIONISTA } from "@/lib/nutricao-premium.server";
import { CANAIS_DA_COTA } from "@/lib/cota-ia.server";
import { semComentarios } from "@/lib/sem-comentarios";

/**
 * O TETO DIÁRIO É SÓ DA NUTRICIONISTA — a catraca da fronteira.
 *
 * O app tem DOIS livros-caixa de IA e eles nunca se tocam: o chat clínico
 * (`canal: "app"`) é a voz do médico e quem paga é ELE, pela franquia do plano
 * dele; a nutricionista (`nutricao` e `prato`) é da paciente, e quem paga é ela,
 * no Premium. Decisão do dono: "as mensagens do médico são pagas pelo médico;
 * no plano premium somente essa da nutricionista deveria ser paga pela
 * paciente".
 *
 * ⚠️ **A FRONTEIRA TEM DOIS LADOS, e cada um já foi rompido uma vez em direção
 * diferente:**
 *
 *   1. `nutricao` esteve em `CANAIS_DA_COTA` — a paciente ia comprar a
 *      nutricionista enquanto a conversa dela descontava da franquia do
 *      MÉDICO. Cobrança dupla, e invisível: a cota dele encolheria por um
 *      recurso que ele não usa, sem nada a que apontar.
 *   2. O outro lado nunca teve guarda: nada impedia alguém de pôr
 *      `decidirAcesso`/`usoDaNutricionista` em `/api/chat.ts` "para limitar a
 *      IA". O teto de dez por dia — que existe para proteger a MARGEM DA
 *      ASSINATURA DA PACIENTE — passaria a calar o chat clínico do médico, que
 *      ele já pagou. Um limite de produto silenciando um canal de cuidado.
 *
 * `recorte-da-cota.test.ts` guarda o lado 1. Este arquivo guarda os DOIS, e é
 * ele que a prosa de `LIMITE_DIARIO` nomeia.
 */

const RAIZ = "src";
const DEFINEM = ["src/lib/nutricao-premium.ts", "src/lib/nutricao-premium.server.ts"];

/** Os únicos endpoints que podem consultar o teto da nutricionista. */
const ENDPOINTS_DA_NUTRICIONISTA = ["src/routes/api/nutrition.ts", "src/routes/api/prato.ts"];

function fontes(dir: string, achados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      fontes(caminho, achados);
      continue;
    }
    if (!/\.tsx?$/.test(nome)) continue;
    if (/\.test\.tsx?$/.test(nome)) continue;
    achados.push(caminho);
  }
  return achados;
}

/**
 * Quem CHAMA o nome, no código de verdade.
 *
 * ⚠️ Os comentários saem antes de procurar: a prosa deste repositório cita os
 * nomes que ela proíbe, e é assim que uma varredura de texto fica vermelha
 * sobre código correto (ou verde sobre o defeito, quando a citação está do
 * lado errado). Já custou dez voltas aqui.
 *
 * ⚠️ E a busca é por CHAMADA (`nome(`), com fronteira de palavra na frente —
 * `usoDaNutricionista` casaria dentro de `usoDaNutricionistaHoje`, e a
 * armadilha de substring já enganou `bloquear`/`bloquearPeriodo` nesta base.
 */
function chamadores(nome: string): string[] {
  const padrao = new RegExp(`(?<![A-Za-z0-9_$])${nome}\\s*\\(`);
  return fontes(RAIZ)
    .filter((f) => !DEFINEM.includes(f))
    .filter((f) => padrao.test(semComentarios(readFileSync(f, "utf8"))))
    .sort();
}

describe("o teto diário não alcança o chat do médico", () => {
  for (const nome of ["decidirAcesso", "usoDaNutricionista"]) {
    test(`${nome} só é chamada pelos dois endpoints da nutricionista`, () => {
      expect(chamadores(nome)).toEqual(ENDPOINTS_DA_NUTRICIONISTA);
    });
  }

  test("⚠️ o chat clínico não conhece nenhuma das duas", () => {
    /* Asserção redundante com a de cima e escrita à mão de propósito: é ELA
       que fica vermelha com o nome do arquivo certo no dia em que alguém
       "limitar a IA" no lugar errado. */
    const chat = semComentarios(readFileSync("src/routes/api/chat.ts", "utf8"));
    expect(chat).not.toMatch(/(?<![A-Za-z0-9_$])decidirAcesso\s*\(/);
    expect(chat).not.toMatch(/(?<![A-Za-z0-9_$])usoDaNutricionista\s*\(/);
  });
});

describe("os dois livros-caixa não se tocam", () => {
  test("a conta da nutricionista NÃO conta o canal do médico", () => {
    expect([...CANAIS_DA_NUTRICIONISTA]).not.toContain("app");
  });

  test("a franquia do médico NÃO conta os canais da nutricionista", () => {
    /* O mesmo que `recorte-da-cota.test.ts` cobra, dito do outro lado da
       fronteira: aqui ele é derivado da lista de verdade, então um canal novo
       da nutricionista entra nesta guarda sozinho. */
    for (const canal of CANAIS_DA_NUTRICIONISTA) {
      expect([...CANAIS_DA_COTA]).not.toContain(canal);
    }
  });
});
