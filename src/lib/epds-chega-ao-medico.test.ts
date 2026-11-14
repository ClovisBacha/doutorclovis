/**
 * A EPDS DA PACIENTE TEM DE CHEGAR AO MÉDICO.
 *
 * ⚠️ **O PIOR DEFEITO CLÍNICO QUE ESTE REPOSITÓRIO TEVE.**
 *
 * A Escala de Edinburgh tem dez perguntas, e a décima é **ideação de
 * autolesão**. Existiam duas telas rodando o MESMO questionário validado:
 *
 *   · `/epds` — a página PÚBLICA. Chama `saveEpdsLog`, que carimba
 *     `doctor_id`, dispara o e-mail "🚨 EPDS URGENTE — {nome} relatou
 *     pensamentos de autolesão" e entra em `clinical_events` como gravidade
 *     GRAVE.
 *   · A aba **Pós-parto** do app da paciente. Chamava só `savePpdScreening`,
 *     que grava em `ppd_screenings` — uma tabela **sem coluna `doctor_id`**,
 *     fora da view `clinical_events`, e que nenhum caminho do médico lê.
 *
 * Ou seja: a puérpera respondia "sim, tive pensamentos de me machucar" DENTRO
 * do app, via a caixa vermelha com o 188 — e o obstetra dela não recebia nada.
 * A mesma resposta, na página pública, alertava.
 *
 * E a tela prometia o contrário: "o resultado deve ser compartilhado com o seu
 * médico".
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { CORTE_ATENCAO, CORTE_RASTREIO_POSITIVO, nivelDaEpds, respostaDaQuestao10 } from "./epds";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const CONTA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));
const PUBLICA = semComentarios(readFileSync("src/routes/epds.tsx", "utf8"));

/**
 * O corpo de `handleSubmit` do rastreio da aba Pós-parto.
 *
 * ⚠️ **Ancorado DENTRO de `PpdSection`, e não no nome solto.** `minha-conta.tsx`
 * tem vinte mil linhas e vários `handleSubmit` — a primeira versão desta
 * âncora pegou o do álbum de fotos e reprovou o conserto da EPDS falando de
 * outra função. É a armadilha de "outra ocorrência do mesmo nome", pela
 * enésima vez nesta base.
 */
function envioDaAba(): string {
  const secao = CONTA.indexOf("function PpdSection(");
  expect(secao).toBeGreaterThan(-1);
  const i = CONTA.indexOf("async function handleSubmit() {", secao);
  expect(i).toBeGreaterThan(secao);
  const j = CONTA.indexOf("\n  }", i);
  return CONTA.slice(i, j === -1 ? i + 3000 : j);
}

describe("a régua do nível", () => {
  test("⚠️ a questão 10 GANHA do escore total, sempre", () => {
    /* Uma paciente pode somar 8 — bem abaixo do corte de 13 — e ainda assim
       ter respondido que pensou em se machucar. O corte serve para depressão;
       a questão 10 serve para risco de vida. */
    expect(nivelDaEpds(0, 1)).toBe("urgente");
    expect(nivelDaEpds(8, 2)).toBe("urgente");
    expect(nivelDaEpds(30, 3)).toBe("urgente");
  });

  test("os cortes publicados da escala", () => {
    expect(nivelDaEpds(CORTE_RASTREIO_POSITIVO, 0)).toBe("alto");
    expect(nivelDaEpds(CORTE_RASTREIO_POSITIVO - 1, 0)).toBe("moderado");
    expect(nivelDaEpds(CORTE_ATENCAO, 0)).toBe("moderado");
    expect(nivelDaEpds(CORTE_ATENCAO - 1, 0)).toBe("baixo");
    expect(nivelDaEpds(0, 0)).toBe("baixo");
  });

  test("⚠️ a questão 10 é a DÉCIMA — índice 9", () => {
    /* Um off-by-one silencioso trocaria ideação de autolesão por "eu me senti
       triste": o alerta urgente sairia pela pergunta errada, ou não sairia. */
    const dez = [0, 0, 0, 0, 0, 0, 0, 0, 0, 2];
    expect(respostaDaQuestao10(dez)).toBe(2);
    expect(respostaDaQuestao10([2, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(0);
    expect(respostaDaQuestao10([])).toBe(0);
    expect(respostaDaQuestao10([null, null, null, null, null, null, null, null, null, null])).toBe(
      0,
    );
  });
});

describe("as DUAS telas usam a MESMA régua", () => {
  test("⚠️ a régua mora em `lib/`, e não numa rota", () => {
    /* Ela era a `interpret` de dentro de `src/routes/epds.tsx`. A aba
       Pós-parto não podia importá-la (a catraca `rotas-sem-export-solto`
       proíbe export não-rota num arquivo de rota, e com razão), e foi assim
       que as duas telas divergiram. */
    expect(PUBLICA).toContain("nivelDaEpds(");
    expect(CONTA).toContain("nivelDaEpds(");
  });
});

describe("a aba Pós-parto AVISA o médico", () => {
  test("⚠️ ela chama `saveEpdsLog` — o caminho que carimba `doctor_id`", () => {
    /* `savePpdScreening` sozinho grava numa tabela sem `doctor_id`, fora da
       view clínica, que ninguém lê. */
    /* ⚠️ Cobra o MÓDULO, e não o nome: trocar o import por
       `const saveEpdsLog = async () => ({ ok: true })` mantinha a string e
       passava verde — um alerta de mentira, com o teste aprovando. */
    expect(envioDaAba()).toContain('import("@/lib/epds.functions")');
    expect(envioDaAba()).toContain("saveEpdsLog");
  });

  test("⚠️ o alerta vem ANTES da gravação do histórico", () => {
    /* Se `savePpdScreening` falhar, o alerta já saiu. A ordem inversa faria a
       falha da parte menos importante engolir a mais importante. */
    const corpo = envioDaAba();
    const alerta = corpo.indexOf("saveEpdsLog");
    const historico = corpo.indexOf("savePpdScreening");
    expect(alerta).toBeGreaterThan(-1);
    expect(historico).toBeGreaterThan(-1);
    expect(alerta).toBeLessThan(historico);
  });

  test("⚠️ o retorno é LIDO — `{ ok: false }` vem num 200 normal", () => {
    /* Um `try/catch` em volta não pega: a função devolve o objeto, não lança.
       Sem ler, a tela não teria como distinguir "avisei" de "não avisei". */
    expect(envioDaAba()).toMatch(/setAvisouOMedico\(/);
  });

  test("⚠️ `ppd_screenings` CONTINUA sendo gravada", () => {
    /* É dela que sai o histórico que a paciente relê nesta tela. Apagar seria
       tirar dela um dado que já é seu — o conserto é somar o alerta, nunca
       trocar uma coisa pela outra. */
    expect(envioDaAba()).toContain("savePpdScreening");
  });
});

describe("a tela não promete o que não faz", () => {
  test("⚠️ some a frase 'informe o seu médico na próxima consulta'", () => {
    /* Ela era a única coisa verdadeira enquanto nada avisava ninguém. Mantê-la
       agora ensinaria a paciente a esperar a consulta depois de ter respondido
       que pensou em se machucar. */
    expect(CONTA).not.toContain("Informe o seu médico sobre seu resultado na próxima consulta");
    expect(CONTA).not.toContain("O resultado deve ser compartilhado com o seu médico");
  });

  test("⚠️ existem os DOIS textos: avisou e NÃO avisou", () => {
    /* "Avisamos seu médico" sobre um envio que falhou é a mentira mais cara
       desta tela: ela para de procurar ajuda achando que já pediu. */
    expect(CONTA).toContain("avisouOMedico === true");
    expect(CONTA).toContain("avisouOMedico === false");
  });

  test("⚠️ nenhum dos dois textos manda ESPERAR o médico", () => {
    /* Em ideação de autolesão, a conduta é agora — o 188 e o atendimento vêm
       antes da resposta dele, tenha ela saído ou não. */
    const i = CONTA.indexOf("avisouOMedico === true");
    const trecho = CONTA.slice(i, CONTA.indexOf("</div>", i));
    expect(trecho).toContain("188");
    /* ⚠️ A frase certa é "**NÃO** espere a resposta dele" — proibir a
       substring "espere a resposta dele" reprovaria exatamente a instrução
       correta. O que se cobra é que não exista um MANDO de esperar. */
    expect(trecho.toLowerCase()).not.toContain("aguarde");
    expect(trecho.toLowerCase()).not.toMatch(/(?<!não )espere a resposta/);
  });
});
