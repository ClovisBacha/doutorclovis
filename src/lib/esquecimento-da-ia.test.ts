/**
 * APAGAR A CONTA PRECISA APAGAR AS CONVERSAS COM A IA.
 *
 * `excluirMinhaConta` chamava `deleteUser` e confiava nos cascatas — o
 * comentário dizia, com todas as letras, "o resto sai pelos ON DELETE CASCADE".
 * Quatro tabelas não tinham chave estrangeira NENHUMA para `auth.users`, e são
 * justamente as da IA:
 *
 *   · `chat_messages`    — a transcrição das conversas dela;
 *   · `chat_memory`      — o RESUMO CLÍNICO que o modelo escreveu sobre ela;
 *   · `brain_feedback`   — a pergunta dela, no texto original, até 4.000 chars;
 *   · `brain_gap_askers` — quais dúvidas ela fez.
 *
 * Sem chave estrangeira nada bloqueia o `deleteUser`: ele funciona, ela lê "sua
 * conta foi apagada", e o dado mais íntimo do produto continua no banco — órfão
 * de um usuário que não existe mais, sem dono e sem RLS que o proteja.
 *
 * Pior que não ter apagado: é ter acreditado que apagou.
 *
 * ─── O QUE ESTE ARQUIVO PROTEGE ─────────────────────────────────────────────
 *
 * O SQL põe os cascatas. Mas o CLAUDE.md avisa que produção fica atrás das
 * migrations, e direito ao esquecimento não pode depender de alguém ter rodado
 * um arquivo. Por isso o apagamento é EXPLÍCITO no código — e é esse apagamento
 * que está sob teste, com um banco de mentira que registra o que foi apagado.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const fonte = readFileSync("src/lib/conta.functions.ts", "utf8");
const sql = readFileSync("supabase/APLICAR_ESQUECIMENTO_DA_IA.sql", "utf8");
/* SEM os comentários. A prosa deste arquivo cita os comandos que ela explica —
   "senão o ADD CONSTRAINT falha" mora no cabeçalho, ANTES dos DELETEs, e um
   teste de posição casava com o comentário em vez do SQL. É a mesma armadilha
   que `codigoDe()` existe para evitar do lado do TypeScript, e eu caí nela de
   novo aqui. */
const comandos = sql.replace(/^\s*--.*$/gm, "");

/** As quatro que não tinham chave estrangeira, com a coluna de cada uma. */
const DA_IA: [string, string][] = [
  ["chat_messages", "patient_id"],
  ["chat_memory", "patient_id"],
  ["brain_feedback", "user_id"],
  ["brain_gap_askers", "user_id"],
];

describe("o SQL cria os quatro cascatas", () => {
  for (const [tabela, coluna] of DA_IA) {
    test(`${tabela}.${coluna} passa a cascatear`, () => {
      expect(sql).toContain(`'${tabela}'`);
      expect(sql).toContain(`'${coluna}'`);
    });
  }

  test("apaga os órfãos ANTES de criar a chave", () => {
    /* Sem isso o `ADD CONSTRAINT` falha em qualquer banco que já teve uma
       exclusão — ou seja, exatamente nos bancos que precisam disto. */
    const posDelete = comandos.indexOf("DELETE FROM public.chat_messages");
    const posConstraint = comandos.indexOf("ADD CONSTRAINT");
    expect(posDelete).toBeGreaterThan(-1);
    expect(posConstraint).toBeGreaterThan(posDelete);
  });

  test("tolera tabela ausente em vez de derrubar o arquivo", () => {
    /* Produção tem menos tabelas que o repo. Um ALTER sobre tabela inexistente
       aborta tudo, e as outras três também não seriam criadas. */
    expect(comandos).toContain("to_regclass");
  });
});

describe("o código apaga sozinho, sem depender da migration", () => {
  /* Ancorado na LISTA `daIa`, e não na primeira ocorrência do nome da tabela:
     `apagarMinhasConversas` (o botão da paciente) também cita `chat_messages`,
     e passou a aparecer antes no arquivo. O teste reprovou sem nada ter
     regredido — de novo, por olhar posição em vez de estrutura. */
  const lista = fonte.slice(fonte.indexOf("const daIa"), fonte.indexOf("for (const [tabela"));
  for (const [tabela, coluna] of DA_IA) {
    test(`${tabela} é apagada por (${coluna})`, () => {
      expect(lista).toContain(`["${tabela}", "${coluna}"]`);
    });
  }

  test("a lista é PERCORRIDA — não basta existir", () => {
    /* Uma bateria de mutação trocou o `for (… of daIa)` por `of []` e nenhum
       teste caiu: as quatro tabelas continuavam escritas no arquivo, e eu
       estava conferindo a lista em vez do apagamento. */
    expect(fonte).toContain("for (const [tabela, coluna] of daIa)");
    const i = fonte.indexOf("for (const [tabela, coluna] of daIa)");
    expect(fonte.slice(i, i + 300)).toContain(".delete()");
    expect(fonte.slice(i, i + 300)).toContain(".eq(coluna, uid)");
  });

  test("o apagamento vem ANTES do deleteUser", () => {
    /* Depois seria tarde: com os cascatas aplicados a linha já sumiu, e sem
       eles o `deleteUser` pode falhar e sair antes de apagar. */
    const posLista = fonte.indexOf("const daIa");
    const posDelete = fonte.indexOf("auth.admin.deleteUser");
    expect(posLista).toBeGreaterThan(-1);
    expect(posDelete).toBeGreaterThan(posLista);
  });

  test("falha ao apagar NÃO vira 'pronto, apagamos'", () => {
    /* Uma exclusão que a pessoa acredita ter acontecido é pior que uma que ela
       sabe que não aconteceu — ela precisa poder tentar de novo. */
    const i = fonte.indexOf("[exclusão] dado da IA não saiu");
    expect(i).toBeGreaterThan(-1);
    expect(fonte.slice(i, i + 200)).toContain('motivo: "falhou"');
  });

  test("tabela ausente não impede a exclusão", () => {
    /* 42P01 num banco atrás das migrations significa "não há o que apagar".
       Tratar isso como falha trancaria a paciente na própria conta. */
    expect(fonte).toContain('!== "42P01"');
  });
});

describe("o comentário não pode voltar a mentir", () => {
  test("nada afirma que o cascata cobre as tabelas da IA", () => {
    /* O defeito original foi um comentário confiante e falso — ele é o motivo
       de ninguém ter olhado por meses. */
    expect(fonte).not.toContain("o resto sai pelos `ON DELETE CASCADE`\n       —");
  });
});
