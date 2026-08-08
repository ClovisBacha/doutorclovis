/**
 * O QUE O FREE É, E O QUE ELE NÃO PAGA.
 *
 * ─── AS DUAS DECISÕES QUE ESTE ARQUIVO GUARDA ───────────────────────────────
 *
 * "O plano free a gente vai oferecer tudo que aquelas plataformas oferecem — de
 * gestão de pacientes, enfim, todas aquelas questões que NÃO TÊM CUSTO."
 *
 * Isso são duas coisas, e as duas precisavam mudar:
 *
 *  1. **O Free entrega a gestão inteira.** Tinha teto de 5 pacientes, que o
 *     tornava inútil como plataforma de gestão — que é justamente o que ele
 *     precisa ser para atrair quem depois assina.
 *  2. **O Free não chama modelo.** `semPlano` só trocava o PROMPT: o modelo era
 *     chamado do mesmo jeito e a plataforma pagava.
 *
 * A ORDEM importava. Tirar o teto sem fechar o portão transformaria um médico de
 * R$ 1,18/mês num de R$ 21/mês — o teto era a única coisa que limitava o
 * vazamento. Por isso o portão fechou primeiro.
 *
 * ─── E POR QUE O PORTÃO É SEGURO ────────────────────────────────────────────
 *
 * A objeção que travou isto por um dia: sem chamar o modelo, ninguém faz triagem
 * do texto dela, e calar uma emergência às 3 da manhã para economizar centavos é
 * a troca errada num app de alto risco.
 *
 * O erro do raciocínio foi supor que a mensagem precisa DETECTAR urgência. Não
 * precisa: ela carrega a orientação de emergência SEMPRE, em toda resposta, para
 * toda pergunta. Não há caso em que a instrução falte — garantia mais forte que
 * qualquer triagem por palavra-chave, e sem duplicar régua clínica fora de
 * `sinais-clinicos.ts`.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PLAN_ENTITLEMENTS, type PlanKey } from "./entitlements";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const chat = semComentarios("src/routes/api/chat.ts");
const TODOS = Object.keys(PLAN_ENTITLEMENTS) as PlanKey[];

describe("1. o Free entrega a plataforma de gestão inteira", () => {
  const free = PLAN_ENTITLEMENTS.free;

  test("sem teto de pacientes", () => {
    expect(free.maxPatients).toBeNull();
  });

  test("e NENHUM plano tem — o eixo saiu do produto", () => {
    /* Um plano PAGO com teto enquanto o Free é ilimitado seria punir quem
       paga. É o que o teste de pares pegou quando só o Free foi liberado. */
    for (const p of TODOS) {
      expect(PLAN_ENTITLEMENTS[p].maxPatients).toBeNull();
    }
  });

  test("a ÚNICA coisa que ele não tem é a IA", () => {
    expect(free.aiApp).toBe(false);
    expect(free.aiWhatsapp).toBe(false);
    expect(free.aiRepliesPerCycle).toBe(0);
  });

  test("as bandeiras que não bloqueavam nada saíram do tipo", () => {
    /* `clinicalToolsAdvanced` e `dashboardAdvanced` não tinham UM consumidor
       fora de `entitlements.ts`. Uma bandeira que não bloqueia nada faz a
       tabela mentir sobre o produto, e quem lê para decidir um plano decide
       errado. */
    const ent = semComentarios("src/lib/entitlements.ts");
    expect(ent).not.toContain("clinicalToolsAdvanced");
    expect(ent).not.toContain("dashboardAdvanced");
  });
});

describe("2. os quatro bloqueios por paciente sumiram", () => {
  /**
   * Eram quatro caminhos contando `patient_profiles` para barrar o vínculo, e o
   * comentário de um deles se orgulhava de ser "o terceiro caminho, antes o
   * único sem a checagem". Nenhum protege mais nada.
   */
  const arquivos = {
    "pedido de vínculo": "src/lib/patientlink.functions.ts",
    "resgate de convite": "src/lib/invites.functions.ts",
    "escolha na busca": "src/lib/doctors.functions.ts",
  };

  for (const [onde, caminho] of Object.entries(arquivos)) {
    test(`${onde} não conta pacientes para barrar`, () => {
      expect(semComentarios(caminho)).not.toContain("maxPatients");
    });
  }

  test("e as TELAS não falam mais em limite de pacientes", () => {
    /* A pior delas mandava a gestante "escolher outro médico" por um limite que
       não existe — o pior desfecho possível daquela tela. */
    expect(semComentarios("src/routes/encontrar-medico.tsx")).not.toContain("medico_lotado");
    expect(semComentarios("src/routes/_authenticated/painel.tsx")).not.toContain(
      'res.reason === "limit"',
    );
  });
});

describe("3. sem plano, sem chamada de modelo", () => {
  test("o chat corta ANTES do `streamText`", () => {
    /* A asserção que descreve o defeito: `semPlano` só trocava o prompt. */
    const iCorte = chat.indexOf("if (brain.semPlano) {");
    const iStream = chat.indexOf("const result = streamText(");
    expect(iCorte).toBeGreaterThan(-1);
    expect(iStream).toBeGreaterThan(-1);
    expect(iCorte).toBeLessThan(iStream);
  });

  test("e devolve um fluxo estático, no protocolo que o cliente lê", () => {
    /* Texto cru quebraria o cliente, que só sabe ler `text-delta`. */
    expect(chat).toContain("createUIMessageStreamResponse");
    expect(chat).toContain('type: "text-delta"');
  });

  test("a resposta SEMPRE carrega a orientação de emergência", () => {
    /**
     * É esta a linha que torna o corte seguro. Sem modelo não há triagem, então
     * a instrução não pode depender do conteúdo da pergunta: ela vai em toda
     * resposta, para toda pergunta, na primeira linha.
     */
    const i = chat.indexOf("if (brain.semPlano) {");
    const bloco = chat.slice(i, i + 2_000);
    expect(bloco).toContain("192");
    expect(bloco).toContain("SAMU");
    expect(bloco).toContain("maternidade");
    expect(bloco).toContain("urgente");
  });

  test("e dá o caminho até o médico, com o WhatsApp quando existe", () => {
    const i = chat.indexOf("if (brain.semPlano) {");
    const bloco = chat.slice(i, i + 2_000);
    expect(bloco).toContain("patient.doctorWhatsapp");
    expect(bloco).toContain("aba Consultas");
  });

  test("a dúvida dela continua sendo registrada para ele", () => {
    /* A lacuna é gravada acima do corte — o médico continua vendo o que ela
       perguntou, que é o que impede o Free de virar um beco sem saída. */
    const iLacuna = chat.indexOf("gravacaoDaLacuna = brain.gravacaoDaLacuna");
    const iCorte = chat.indexOf("if (brain.semPlano) {");
    expect(iLacuna).toBeGreaterThan(-1);
    expect(iLacuna).toBeLessThan(iCorte);
  });

  test("o caminho de COTA ESGOTADA continua chamando o modelo", () => {
    /**
     * São coisas diferentes e o corte não pode ter engolido as duas. Cota
     * estourada é de quem PAGOU: tem prazo, volta na virada do mês, e a
     * resposta dela é do modelo com instrução própria (`avisoDeCota`).
     */
    expect(chat).toContain("brain.cotaEsgotada");
    expect(chat).toContain("avisoDeCota");
    const iCorte = chat.indexOf("if (brain.semPlano) {");
    expect(chat.slice(iCorte, iCorte + 2_000)).not.toContain("cotaEsgotada");
  });
});
