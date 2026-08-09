/**
 * A FILA DE PERGUNTAS RESPEITA O VÍNCULO ATUAL.
 *
 * ─── O VAZAMENTO ────────────────────────────────────────────────────────────
 *
 * `doctor_questions.doctor_id` é gravado no instante em que a paciente
 * pergunta. `encerrarAcompanhamento` zera `patient_profiles.doctor_id` e não
 * toca em carimbo nenhum — é uma tabela só.
 *
 * Então ela troca de consultório e a dúvida clínica dela continua caindo na
 * fila do médico ANTERIOR, que a lê, responde, e ensina o cérebro dele com a
 * pergunta de quem não é mais paciente dele.
 *
 * `vinculo.server.ts` existe exatamente para isto e já fechava as outras três
 * listas do painel. `doctor_questions` tinha ficado de fora — o comentário no
 * código dizia "multi-inquilino: sempre só as perguntas das pacientes DESTE
 * médico" e filtrava pelo carimbo, que é outra coisa.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const cerebro = readFileSync("src/lib/secondbrain.functions.ts", "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);
const bloco = cerebro.slice(
  cerebro.indexOf("export const listUnansweredQuestions"),
  cerebro.indexOf("const AnswerTrainSchema"),
);

/**
 * A LISTA e a CONTAGEM, separadas.
 *
 * As duas fazem o mesmo recorte, então as mesmas expressões aparecem duas vezes
 * no handler. Cobrar o bloco inteiro deixava cada asserção ser satisfeita pelo
 * vizinho: apagar o filtro da LISTA — que é o vazamento — passava batido porque
 * a contagem ainda tinha a expressão. Três mutantes sobreviveram assim.
 */
const blocoLista = bloco.slice(0, bloco.indexOf("const { data: todas }"));
const blocoContagem = bloco.slice(bloco.indexOf("const { data: todas }"));

describe("a lista cruza o carimbo com o vínculo de hoje", () => {
  test("pergunta ao `vinculadasAgora` e GUARDA a resposta", () => {
    /* A ATRIBUIÇÃO, não a chamada: chamar o helper e jogar fora o resultado é
       o mesmo defeito com uma etapa a mais. */
    expect(blocoLista).toContain("const atuais = await vinculadasAgora(supabaseAdmin as any");
    expect(blocoLista).toContain("doctorId: target.doctorId");
  });

  test("e FILTRA de verdade, não só consulta", () => {
    /* Chamar o helper e ignorar o resultado é o defeito com uma etapa a mais. */
    expect(blocoLista).toContain("atuais === null || atuais.has(r.user_id)");
  });

  test("o carimbo continua valendo — os dois filtros, não um", () => {
    /**
     * Trocar um pelo outro não resolve: sem o carimbo, a fila passaria a varrer
     * `doctor_questions` inteira e a depender só do cruzamento em memória. Os
     * dois juntos é que dão "minha paciente, hoje, que me perguntou".
     */
    expect(blocoLista).toContain('.eq("doctor_id", target.doctorId)');
    expect(blocoContagem).toContain('.eq("doctor_id", target.doctorId)');
  });

  test("o `user_id` não vaza para a tela", () => {
    /* Ele entra no `select` só para o cruzamento. Devolvê-lo entregaria o uuid
       de `auth.users` da paciente a uma tela que nunca precisou dele — é o
       mesmo dado morto que já vazou pelo álbum uma vez. */
    expect(blocoLista).toContain("map(({ user_id: _u, ...resto }) => resto)");
  });
});

describe("o contador não pode teimar num resto inalcançável", () => {
  test("a contagem passa pelo MESMO recorte da lista", () => {
    /**
     * Contar pelo carimbo e listar pelo vínculo dá um badge que nunca zera: o
     * médico responde tudo o que aparece na tela e o número teima num resto que
     * ele não tem como alcançar. Dois números para a mesma coisa, e o que ele
     * vê primeiro é o errado.
     */
    const i = blocoContagem.indexOf("const totalReal");
    expect(i).toBeGreaterThan(-1);
    expect(blocoContagem.slice(i, i + 320)).toContain("atuais === null || atuais.has(r.user_id)");
  });

  test("e não usa `head: true`, que só saberia contar pelo carimbo", () => {
    expect(blocoContagem.slice(0, 260)).not.toContain("head: true");
  });
});
