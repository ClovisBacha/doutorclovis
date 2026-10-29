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
/* ⚠️ O chat (ChatTab, WABubble, buildPatientContext…) saiu de minha-conta.tsx
   para src/components/chat-tab.tsx em set/2026. Este teste confere coisas dos
   DOIS arquivos, então lê os dois juntos — uma asserção que procura texto do
   chat aqui continua encontrando. */
const tela =
  readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8") +
  "\n" +
  readFileSync("src/components/chat-tab.tsx", "utf8");

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
    /* Sem prender a lista de parâmetros: ela cresce quando o handler passa
       a olhar mais coisa (o `finishReason`, por exemplo). O que importa aqui
       é o `async` — é ele que a SDK aguarda. */
    expect(chat).toMatch(/onFinish: async \(\{[^}]*\}\) => \{/);
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

  test("a MEMÓRIA é disparada ANTES do stream, não no fim do onFinish", () => {
    /* ─── ESTE TESTE PROTEGIA O CONTRÁRIO DO CERTO ─────────────────────────
       Ele afirmava que a memória vinha DEPOIS do `await Promise.all` do
       `onFinish`, e chamava isso de proposital. A justificativa era que perdê-la
       não custa nada, porque "se conserta sozinha na mensagem seguinte".
       Não se conserta: a retomada cai na MESMA janela de congelamento. E o
       trabalho começava depois de a resposta ter terminado de sair —
       entitlements, cota, duas consultas, uma chamada de modelo de ~2s e um
       upsert, no instante exato em que a invocação serverless congela.
       Disparada ANTES do `streamText`, ela tem a resposta inteira de prazo (a
       invocação fica viva enquanto o stream está aberto) e a paciente não
       espera nada, porque continua sem `await`. */
    const disparo = chat.indexOf("maybeUpdateChatMemory(");
    const stream = chat.indexOf("const result = streamText({");
    const onFinish = chat.indexOf("onFinish:");
    expect(disparo).toBeGreaterThan(0);
    expect(disparo).toBeLessThan(stream);
    expect(disparo).toBeLessThan(onFinish);
    // Continua sem `await`: aguardar poria 2s no caminho da resposta dela.
    expect(chat).not.toContain("await maybeUpdateChatMemory(");
  });
});

describe("o histórico é contexto, não uma fila de perguntas pendentes", () => {
  const chat = readFileSync("src/routes/api/chat.ts", "utf8");

  test("os dois prompts mandam responder só a ÚLTIMA mensagem", () => {
    /* Sem esta regra, uma conversa retomada depois de dias faz o modelo
       "colocar em dia" tudo o que veio antes. Apareceu de forma extrema por
       causa do defeito de gravação — o banco tinha cinco perguntas seguidas sem
       nenhuma resposta, e um simples "Olá" respondia todas elas de uma vez —
       mas o problema é geral: histórico é contexto, não pauta. */
    expect(chat.match(/apenas à ÚLTIMA mensagem/g)?.length).toBe(2);
  });

  test("cumprimento sozinho recebe cumprimento de volta", () => {
    /* "Olá" não é pedido de resumo do acompanhamento. */
    expect(chat).toMatch(/Cumprimento sozinho recebe cumprimento curto de volta/);
    expect(chat).toMatch(/responda com um cumprimento curto/);
  });

  test("proíbe explicitamente o resumo do que já foi conversado", () => {
    expect(chat).toContain("nem faça um resumo do que já foi conversado");
  });
});

/**
 * A IA sabia que tinha encaminhado a dúvida e não sabia o que aconteceu depois.
 *
 * Quando a paciente voltava e perguntava "a doutora respondeu?", ela fazia a
 * única coisa que podia: inventava. Confirmava o encaminhamento (verdade) e
 * emendava um processo que nunca existiu — "geralmente é pela seção de
 * acompanhamento que a Dra. envia as respostas". Navegação inventada, contada a
 * uma gestante que está esperando o médico dela.
 */
describe("o estado das dúvidas encaminhadas ao médico", () => {
  const chat = readFileSync("src/routes/api/chat.ts", "utf8");

  test("a IA passa a receber o status de cada uma", () => {
    expect(chat).toContain("async function buildPendenciasBlock(");
    expect(chat).toContain("JÁ RESPONDIDA pelo médico");
    expect(chat).toContain("AINDA AGUARDANDO o médico");
  });

  test("só as dúvidas DESTA paciente", () => {
    /* A lacuna é deduplicada por (médico, pergunta): cinquenta pacientes com a
       mesma dúvida viram UM item. Sem o filtro por quem perguntou, a IA
       contaria a esta paciente a dúvida de outra. */
    expect(chat).toContain('.from("brain_gap_askers")');
    expect(chat).toContain('.eq("user_id", patientId)');
    expect(chat).toContain('.eq("doctor_id", doctorId)');
  });

  test("'ignorada' não vira 'o médico ignorou você'", () => {
    expect(chat).toContain('g.status === "aberta" || g.status === "respondida"');
  });

  test("o bloco entra no prompt clínico", () => {
    expect(chat).toContain("buildPendenciasBlock(patient.patientId, patient.doctorId,");
    expect(chat).toMatch(/memoria,\s*\n\s*pendencias,/);
  });

  test("sem dado, o bloco some — não vira afirmação errada", () => {
    /* Melhor a IA não saber que afirmar o que não pode verificar. */
    expect(chat).toContain('if (!ids.length) return "";');
    expect(chat).toContain('if (!linhas.length) return "";');
  });

  test("proíbe inventar tela, e isso vale sempre — não só quando há pendência", () => {
    expect(chat).toContain("NUNCA descreva telas, abas, seções ou fluxos do app");
    expect(chat).toContain("NÃO invente onde a resposta aparece");
  });
});

/**
 * O LAÇO QUE SE ALIMENTAVA.
 *
 * Uma resposta vazia era GRAVADA como mensagem da IA. Na pergunta seguinte ela
 * voltava no histórico, e o Gemini recusa mensagem de assistente sem texto —
 * produzindo OUTRA resposta vazia, que era gravada de novo.
 *
 * Uma falha isolada virava permanente. É por isso que o chat não saía mais do
 * "não consegui formular a resposta agora", enquanto o playground do painel —
 * que manda só a pergunta, sem histórico — respondia bem a mesma coisa com o
 * mesmo modelo e a mesma chave.
 *
 * Três travas, porque o laço tem três entradas.
 */
describe("mensagem vazia não entra na conversa", () => {
  const chat = readFileSync("src/routes/api/chat.ts", "utf8");

  test("1) resposta vazia não é GRAVADA", () => {
    /* Sem isto, a próxima pergunta já nasce com o veneno no histórico. */
    expect(chat).toContain("text.trim()\n                  ? saveChatMessage(");
  });

  test("2) o histórico do banco é podado antes de virar mensagem", () => {
    /* As linhas vazias que JÁ existem não podem ir para o modelo. */
    expect(chat).toContain("const comConteudo = anteriores.filter((m) => m.content?.trim());");
    expect(chat).toContain("...comConteudo.map(");
  });

  test("3) a poda final cobre TODOS os caminhos, inclusive o anônimo", () => {
    /* O array que chega do navegador (site sem login) não passa pelo banco —
       e também pode trazer uma bolha vazia.
       A poda saiu para `chat-stream.ts` (`soTexto`) porque aqui, inline, ela
       não tinha teste NENHUM: um avaliador removeu as duas condições e a suíte
       inteira continuou verde. Era a defesa que impede a IA de receber laudo.
       O comportamento agora é exercitado em `chat-stream.test.ts`; este teste
       confere que a tela usa aquela função em vez de reimplementar. */
    expect(chat).toContain("paraOModelo = soTexto(paraOModelo)");
  });

  test("a poda acontece ANTES de montar a chamada ao modelo", () => {
    const posPoda = chat.indexOf("paraOModelo = soTexto(paraOModelo)");
    const posChamada = chat.indexOf("messages: await convertToModelMessages(paraOModelo)");
    expect(posPoda).toBeGreaterThan(0);
    expect(posPoda).toBeLessThan(posChamada);
  });

  test("a tela da paciente também ignora conteúdo vazio", () => {
    /* Já era assim, e tem que continuar: é o que faz as bolhas mudas já
       gravadas sumirem sozinhas quando ela recarrega. */
    const hist = readFileSync("src/lib/historico-chat.functions.ts", "utf8");
    expect(hist).toContain('(m.role === "user" || m.role === "assistant") && m.content?.trim()');
  });
});
