import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * ⚠️ ESCRITA QUE FALHA E A TELA DIZ QUE DEU CERTO.
 *
 * A varredura das LEITURAS ("se voltar vazia, algo fica mais permitido?") achou
 * dois defeitos graves. Esta é a outra metade: gravações cujo desfecho é
 * DESCARTADO, com a tela seguindo em frente como se tivesse funcionado.
 *
 * ⚠️ **O `.catch()` não basta, e é o engano central.** Estas funções de servidor
 * devolvem `{ ok: false }` numa resposta **200 normal** — não lançam. Um
 * `try/catch` em volta pega a queda de rede e deixa passar exatamente o caso
 * mais comum, que é o INSERT recusado pelo banco. É preciso LER o valor.
 */
const CONTA = readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8");
/* Comentários fora antes de procurar — padrão desta base desde a sexta vez em
   que a própria prosa satisfez uma asserção. */
const codigo = CONTA.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");

describe("a triagem de sintomas não some em silêncio", () => {
  /**
   * ⚠️ `triage_logs` é uma das onze fontes de `clinical_events`, e é por ela
   * que uma triagem VERMELHA entra em `eventosQuePedemOlhar` — a fila de
   * trabalho do painel. Sem a linha, "sangramento" ou "redução dos movimentos
   * do bebê" não chegam ao obstetra, e nem ela nem ele têm como saber.
   */
  test("⚠️ o desfecho da gravação é lido, não descartado", () => {
    const i = codigo.indexOf("saveTriageLog(");
    expect(i).toBeGreaterThan(-1);
    const trecho = codigo.slice(Math.max(0, i - 200), i + 600);
    expect(trecho).toContain("await saveTriageLog(");
    expect(trecho).toContain("setRegistrou(");
    /* O `void` é o que fazia o retorno morrer antes de ser olhado. */
    expect(trecho).not.toContain("void saveTriageLog(");
  });

  /**
   * ⚠️ **Só fala quando a triagem NÃO é verde.** Numa verde o registro é
   * histórico e o aviso assustaria sem dar o que fazer; no amarelo e no
   * vermelho é justamente a que deveria entrar na fila do médico.
   */
  test("⚠️ o aviso de falha é recortado pelo nível", () => {
    expect(codigo).toContain('registrou === false && result.level !== "verde"');
  });

  /** A orientação clínica continua inteira mesmo com a gravação falhando. */
  test("⚠️ a conduta não depende do registro", () => {
    const iAviso = codigo.indexOf("registrou === false");
    const i192 = codigo.indexOf('href="tel:192"');
    expect(i192).toBeGreaterThan(-1);
    /* O 192 é desenhado ANTES do aviso e por condição própria (`level`), então
       nenhuma falha de gravação pode escondê-lo. */
    expect(i192).toBeLessThan(iAviso);
  });

  /** E a falha existe no log do servidor, para poder ser investigada. */
  test("⚠️ o servidor registra a falha", () => {
    const src = readFileSync("src/lib/triage.functions.ts", "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      " ",
    );
    /* ⚠️ **Ancora na MENSAGEM, não em `console.error`.** O arquivo já tinha um
       `console.error` — o da falha da IA em `assessSymptoms` —, e a asserção
       genérica casava com ele: a mutação que apagava o log da GRAVAÇÃO passava
       verde. Sétima vez que outra ocorrência do mesmo nome satisfaz um teste
       nesta base. */
    expect(src).toContain("[triagem] não gravou em triage_logs");
    expect(src.indexOf("[triagem] não gravou")).toBeLessThan(src.indexOf("return { ok: !error }"));
  });
});

describe("a caderneta de vacinas reflete o banco, não a intenção", () => {
  /**
   * ⚠️ A vacina aparecia marcada, a mãe fechava o app, e na abertura seguinte o
   * quadradinho estava vazio. Numa caderneta isso é pior que um contador
   * errado: é a tela que diz **o que ainda falta aplicar no bebê**.
   */
  test("⚠️ a tela só muda depois do desfecho", () => {
    const i = codigo.indexOf("async function toggleVaccine");
    expect(i).toBeGreaterThan(-1);
    const corpo = codigo.slice(i, codigo.indexOf("\n  }", i));
    expect(corpo).toContain("if (!r.ok)");
    /* A recusa vem ANTES de mexer na lista. */
    expect(corpo.indexOf("if (!r.ok)")).toBeLessThan(corpo.indexOf("setVaccines("));
    expect(corpo).toContain("toast.error");
  });
});
