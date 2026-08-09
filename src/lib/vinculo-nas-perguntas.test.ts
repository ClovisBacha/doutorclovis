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

describe("as AÇÕES de teleconsulta autorizam pelo vínculo, não só pelo carimbo", () => {
  /**
   * ─── A ASSIMETRIA, QUE É O QUE TORNAVA ISTO PIOR ──────────────────────────
   *
   * A LISTA já tinha sido corrigida para o vínculo atual. As AÇÕES não. Então a
   * sessão da ex-paciente sumia da tela do médico anterior — e ele continuava
   * podendo abrir a sala dela e gravar nota clínica nela, bastando o id, que
   * ele teve na mão enquanto ela era paciente.
   *
   * Autorização assimétrica em relação à leitura é a pior forma disto: some da
   * tela, e por isso ninguém percebe que continua permitido.
   */
  const tele = readFileSync("src/lib/teleconsulta.functions.ts", "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const owns = tele.slice(
    tele.indexOf("async function ownsTele"),
    tele.indexOf("export type TeleconsultaSession"),
  );

  test("o carimbo continua sendo exigido", () => {
    expect(owns).toContain("data.doctor_id !== scope.doctorId");
  });

  test("e o vínculo de HOJE também", () => {
    expect(owns).toContain("vinculadasAgora(sb,");
    expect(owns).toContain("atuais.has(String(data.patient_user_id))");
  });

  test("equipe passa; assinante sem médico resolvido NÃO", () => {
    /* `vinculadasAgora` devolve conjunto VAZIO (não `null`) quando não há
       médico — falha fechando, que é o que se quer numa autorização. */
    expect(owns).toContain("if (scope.isTeam) return true;");
    expect(owns).toContain("if (atuais === null) return true;");
  });

  test("as duas ações passam por ele", () => {
    expect((tele.match(/await ownsTele\(/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe("ABRIR A SALA passa pelo vínculo — a ação que o commit anterior dizia ter fechado", () => {
  /**
   * ─── UM ERRO MEU, ACHADO POR REVISÃO ADVERSARIAL ──────────────────────────
   *
   * Quando `ownsTele` ganhou o vínculo atual, eu escrevi no commit que aquilo
   * fechava "abrir a sala dela e gravar nota clínica nela". Fechou só as duas
   * ações que chamavam `ownsTele` — `updateTeleconsultaStatus` e
   * `saveDoctorClinicalNote`. `openTeleconsultaRoom`, que é literalmente abrir
   * a sala, autorizava por conta própria, só pelo carimbo.
   *
   * Dois revisores independentes apontaram a mesma coisa, citando o meu próprio
   * texto de commit como evidência de que a correção não cobria o que dizia.
   *
   * É a pior forma do defeito: a sala é uma chamada de vídeo COM a paciente, e
   * o convite sai por e-mail e push para ela. O médico anterior podia convocar
   * para uma consulta por vídeo alguém que já é de outro consultório.
   */
  const tele = readFileSync("src/lib/teleconsulta.functions.ts", "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

  test("as TRÊS ações passam por `ownsTele` — não duas", () => {
    expect((tele.match(/await ownsTele\(/g) ?? []).length).toBe(3);
  });

  test("e abrir a sala não autoriza mais por conta própria", () => {
    const i = tele.indexOf("export const openTeleconsultaRoom");
    const corpo = tele.slice(i, i + 1800);
    expect(corpo).toContain("await ownsTele(supabaseAdmin as any, data.id, scope)");
    /* A comparação solta de carimbo era a autorização inteira. */
    expect(corpo).not.toContain("sess.doctor_id !== scope.doctorId");
  });
});
