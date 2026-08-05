/**
 * O histórico da conversa na tela.
 *
 * O defeito que isto conserta era estranho de perceber e fácil de descrever: a
 * IA lembrava e a paciente não. Tudo ficava guardado, o servidor reconstruía as
 * últimas 12 a cada mensagem, e a tela abria com uma saudação e mais nada.
 *
 * Consertar isso cria três jeitos novos de errar, e é deles que estes testes
 * tratam — todos com o mesmo desenlace: a paciente perder o que escreveu, ou
 * ficar olhando para um chat em branco.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const fonte = readFileSync("src/lib/historico-chat.functions.ts", "utf8");
const tela = readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8");

describe("a leitura devolve a conversa recente, e só a dela", () => {
  test("ordena do mais novo e inverte — senão traz o começo da gravidez", () => {
    /* Pegar as 60 primeiras em ordem crescente traria as conversas do primeiro
       trimestre e deixaria de fora justamente a de ontem. */
    expect(fonte).toContain('.order("created_at", { ascending: false })');
    expect(fonte).toContain(".reverse()");
  });

  test("filtra pelo usuário da sessão, nunca por id vindo do cliente", () => {
    expect(fonte).toContain("supabaseAdmin.auth.getUser(data.accessToken)");
    expect(fonte).toContain('.eq("patient_id", u.user.id)');
  });

  test("sem sessão válida devolve vazio, não a conversa de outra pessoa", () => {
    expect(fonte).toContain("if (!u.user) return vazio;");
  });

  test("a tela recebe MAIS mensagens que o modelo", () => {
    /* O limite do modelo (12) existe por custo de token. Ler não custa token
       nenhum, então a tela não tem por que herdar esse limite. */
    expect(fonte).toContain("const LIMITE_PADRAO = 60;");
  });
});

describe("o chat nunca fica em branco para sempre", () => {
  test("todo caminho de falha ainda abre a conversa", () => {
    /* Sem sessão, sem histórico, erro de rede: nos três a paciente precisa ver
       alguma coisa. Um chat que não abre porque o banco não respondeu é pior
       que um chat sem histórico. */
    expect(tela).toContain("const abrirVazio = ()");
    expect(tela).toContain("if (!sess.session?.access_token) return abrirVazio();");
    expect(tela).toContain("if (!r.ok || r.mensagens.length === 0) return abrirVazio();");
    expect(tela).toMatch(/catch \{\s*abrirVazio\(\);/);
  });

  test("a função de leitura nunca lança", () => {
    expect(fonte).toContain("return vazio;");
    expect(fonte).not.toMatch(/\bthrow\b/);
  });
});

describe("o histórico nunca engole o que a paciente acabou de escrever", () => {
  test("só preenche se a lista ainda estiver vazia", () => {
    /* Se ela digitar enquanto o banco responde, a resposta lenta chegaria
       depois e apagaria a pergunta dela. */
    expect(tela).toContain("if (ms.length > 0) return ms;");
  });

  test("a saudação também respeita o que já existe", () => {
    expect(tela).toContain('ms.length === 0 ? [{ role: "assistant", content: greeting');
  });
});

describe("a abertura não pisca", () => {
  test("a lista começa vazia, não com a saudação", () => {
    /* Nascer com a saudação faria ela aparecer e ser trocada pelo histórico
       meio segundo depois — um salto visível, logo na abertura. */
    expect(tela).toContain("useState<WAMsg[]>([]);");
  });

  test("enquanto carrega, mostra algo em vez de tela branca", () => {
    expect(tela).toContain("carregandoHistorico && messages.length === 0");
    expect(tela).toContain('aria-label="Carregando a conversa"');
  });

  test("o nome do consultório entra na saudação mesmo chegando antes dela", () => {
    /* O efeito depende de `messages.length` e não só de `doctorName`: o nome
       costuma chegar ANTES do histórico, e com a lista ainda vazia ele não
       teria nada para reescrever — a saudação apareceria depois, genérica,
       para sempre. */
    expect(tela).toContain("}, [doctorName, messages.length]);");
  });
});

/**
 * O defeito de servidor sem servidor, e por que ele so aparece em producao.
 *
 * O `onFinish` dispara DEPOIS que a resposta inteira ja foi para a paciente.
 * Trabalho disparado e nao aguardado nesse instante pode ser morto junto com a
 * funcao — e era o que acontecia: a pergunta dela ficava gravada (ela acontece
 * antes do fluxo, com tempo de sobra) e a resposta da IA se perdia.
 *
 * Resultado: o chat guardava METADE da conversa, e a memoria da paciente era
 * construida sobre as perguntas dela sem nenhuma das respostas. Em
 * desenvolvimento nunca aparece — a funcao local nao e congelada.
 */
describe("a resposta da IA precisa sobreviver ao fim do fluxo", () => {
  const chat = readFileSync("src/routes/api/chat.ts", "utf8");
  const memoria = readFileSync("src/lib/chat-memory.server.ts", "utf8");
  const uso = readFileSync("src/lib/uso-ia.server.ts", "utf8");

  test("o onFinish é async — a SDK aguarda por ele", () => {
    /* `PromiseLike<void> | void` no tipo: devolver promessa aqui é o que mantém
       a função viva até a gravação terminar. */
    expect(chat).toContain("onFinish: async ({ text, usage }) => {");
  });

  test("a gravação da resposta é AGUARDADA", () => {
    expect(chat).toContain(
      'saveChatMessage(persistFor.patientId, persistFor.doctorId, "assistant", text)',
    );
    expect(chat).toContain("await Promise.all([");
  });

  test("`saveChatMessage` devolve promessa — não dá para esquecer de esperar", () => {
    /* Antes ela era `void` e disparava por dentro: quem chamasse não tinha como
       aguardar nem que quisesse. */
    expect(memoria).toContain("export async function saveChatMessage(");
    expect(memoria).toContain("): Promise<void> {");
  });

  test("o registro de custo também é aguardado", () => {
    expect(uso).toContain("export async function registrarUsoAgora(u: Uso): Promise<void>");
    expect(chat).toContain("usoIa.registrarUsoAgora({");
  });

  test("a MEMÓRIA fica de fora do await, e isso é proposital", () => {
    /* É uma chamada de modelo inteira (~2s) e faria o "digitando…" persistir
       depois de a resposta já estar lida. Perdê-la não custa: ela conta as
       mensagens desde a última atualização, então uma execução morta é retomada
       na mensagem seguinte. A resposta da IA, não — essa se perde para sempre. */
    const awaitPromise = chat.indexOf("await Promise.all([");
    const memChamada = chat.indexOf("maybeUpdateChatMemory(persistFor.patientId");
    expect(awaitPromise).toBeGreaterThan(0);
    expect(memChamada).toBeGreaterThan(awaitPromise);
    expect(chat).not.toContain("await maybeUpdateChatMemory(");
  });
});
