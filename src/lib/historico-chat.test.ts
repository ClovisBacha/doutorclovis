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
