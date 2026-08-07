/**
 * O CHAT DA PACIENTE, AUDITADO DE PONTA A PONTA.
 *
 * A auditoria mapeou dez caminhos em que a resposta podia não chegar. Estes
 * testes prendem os quatro que produziam o pior desfecho: a paciente
 * acreditando numa coisa que não aconteceu.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

function codigoDe(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
}

const chat = codigoDe("src/routes/api/chat.ts");
const chatBruto = readFileSync("src/routes/api/chat.ts", "utf8");
const app = codigoDe("src/routes/_authenticated/minha-conta.tsx");
const appBruto = readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8");

describe("erro do provedor vira mensagem, não bolha vazia", () => {
  /**
   * O defeito mais caro do dia anterior. Quando o provedor falha DEPOIS de o
   * fluxo começar, o HTTP já é 200 e o servidor não pode mais mudar o código:
   * ele manda uma parte `error`. O cliente só lia `text-delta` e descartava o
   * resto — `acc` ficava vazio e a paciente via branco.
   *
   * Ela lia aquilo como "a IA não soube responder", que é a leitura errada, e
   * o único registro do que houve ficava no console da Vercel.
   */
  test("o servidor manda um texto útil no lugar do genérico", () => {
    /* Sem comentários: o comentário do arquivo CITA a string genérica do SDK
       para explicar o defeito, e cobrar `chatBruto` faria o teste falhar pela
       explicação em vez de pelo código. */
    expect(chat).toContain("onError: (erro) => {");
    expect(chat).not.toContain("An error occurred");
  });

  test("o cliente aprendeu a LER a parte de erro", () => {
    /* As duas pontas: sem a mensagem não há o que mostrar, e sem o leitor a
       mensagem não chega. Consertar só um lado não conserta nada.

       O leitor saiu para `src/lib/chat-stream.ts` e agora tem teste de
       COMPORTAMENTO (`chat-stream.test.ts`) — este aqui só confere que a tela
       usa aquele leitor, em vez de ter reimplementado um por dentro. */
    expect(app).toContain("const p = lerLinhaDoStream(line)");
    expect(app).toContain('p.tipo === "erro"');
    expect(app).toContain("houveErro = true");
  });

  test("429 recebe um texto ACIONÁVEL, não um genérico", () => {
    /* É o único erro que ela pode resolver — esperando. "Ocorreu um erro" não
       diz o que fazer e ainda sugere que ela errou. */
    expect(chatBruto).toContain("Tente de novo em alguns instantes");
    expect(chatBruto).toContain("sua dúvida não se perdeu");
  });

  test("a culpa não é jogada nela", () => {
    expect(chatBruto).toContain("foi uma falha minha, não sua");
  });
});

describe("o limite não é mais um balde compartilhado", () => {
  /**
   * `clientIp` devolve a string literal "unknown" quando não há cabeçalho de
   * proxy — e aí TODAS as pacientes dividiam vinte mensagens por minuto. O
   * mesmo valia para CGNAT de operadora e wifi de clínica, que é justamente
   * onde várias pacientes do mesmo médico se encontram.
   */
  test("paciente logada tem balde próprio — pelo usuário RESOLVIDO", () => {
    /* ─── A CHAVE SAÍA DO HEADER, SEM VALIDAR NADA ─────────────────────────
       Era `u:${auth.slice(-32)}`: o sufixo do que o cliente mandou. Bastava
       `Bearer <32 aleatórios>` a cada requisição para o balde nunca acumular —
       e, de quebra, o teto global do site anônimo era pulado, porque ele só
       vale para chaves que NÃO começam com `u:`. Duas defesas de custo
       desligadas por uma string inventada, com o modelo sendo chamado do mesmo
       jeito na nossa chave.
       Agora a chave é o id do usuário resolvido; token inválido cai no balde de
       IP, que é onde ele pertence. */
    expect(chat).toContain("const usuarioDoLimite = await usuarioDaRequisicao(request)");
    expect(chat).toContain("`u:${usuarioDoLimite.id}`");
    expect(chat).not.toContain("`u:${auth.slice(-32)}`");
  });

  test("visitante anônimo continua por IP", () => {
    expect(chat).toContain("`ip:${clientIp(request)}`");
  });

  test("o limitador recebe a chave nova, não o IP cru", () => {
    expect(chat).toContain("rateLimited(chaveDoLimite)");
    expect(chat).not.toContain("rateLimited(ip)");
  });
});

describe("o que ela já estava lendo não se perde", () => {
  /**
   * A lista era reconstruída do retrato anterior à resposta. Se a rede caísse
   * no meio, o texto sumia da tela — e o servidor, que não é interrompido,
   * gravava a resposta inteira. Ela reaparecia "do nada" na abertura seguinte.
   */
  test("o texto parcial é preservado no erro", () => {
    /* O que CHEGOU, não o que já tinha sido desenhado.
       Cortar em `mostradoRef` jogava fora o texto que o servidor já mandara e
       o laço ainda não pintara — e, para quem pediu menos movimento,
       `mostradoRef` ficava em ZERO para sempre, então o corte devolvia string
       vazia e o texto sumia inteiro. O comentário ao lado dizia "o que chegou
       fica"; agora o código diz a mesma coisa. */
    expect(app).toContain("const parcial = alvoRef.current.trim()");
  });

  test("e o aviso reconhece que a conversa foi interrompida", () => {
    expect(appBruto).toContain("A conexão caiu no meio da resposta");
  });

  test("sem nada lido, o aviso continua sendo o genérico", () => {
    /* Dizer "a conexão caiu no meio" quando nada chegou seria descrever algo
       que ela não viu acontecer. */
    expect(app).toContain("Desculpe, ocorreu um erro. Tente novamente.");
  });
});

describe("a queda para o assistente público deixa rastro", () => {
  /**
   * Token expirado rebaixa a paciente a um bot sem o cérebro do médico, sem o
   * histórico clínico dela, que não registra lacuna e que a orienta a "se
   * vincular ao seu obstetra" — para alguém já vinculada. E nada dessa
   * conversa é gravado. O cabeçalho continua mostrando o nome do consultório,
   * então ela não tem como perceber.
   */
  test("o servidor registra quando isso acontece", () => {
    expect(chatBruto).toContain("a paciente cai no assistente publico");
  });
});

/**
 * OS TRÊS CHATS DO PRODUTO — e o que cada um tem que saber fazer.
 *
 * O app tem três superfícies de conversa com IA: o chat principal da paciente,
 * a aba de Nutrição (mesmo arquivo, ~2.000 linhas abaixo) e o widget do site
 * público. Um avaliador rodou mutação e mediu: **desligar a leitura de erro do
 * widget, o `res.ok` da Nutrição e a leitura da parte de erro dela não
 * quebravam NADA** — três superfícies onde a bolha vazia podia voltar sem
 * ninguém saber.
 *
 * Estes testes são estruturais de propósito: renderizar os três componentes
 * exigiria um DOM inteiro, e o que importa aqui é que a peça esteja LIGADA —
 * o comportamento dela já é testado em `chat-stream.test.ts`, que roda as
 * funções de verdade.
 */
describe("os três chats leem erro do mesmo jeito", () => {
  const widget = readFileSync("src/components/chatbot-widget.tsx", "utf8");
  /* SÓ o corpo da NutricaoTab. Fatiar "daqui até o fim do arquivo" pegava
     ocorrências de outros componentes que vêm depois dela — e foi assim que
     desligar o `res.ok` DELA passou por um `toContain` que casava com o de
     outro lugar. Teste que encontra a string no vizinho é teste que não
     protege ninguém. */
  const nutricao = (() => {
    const ini = appBruto.indexOf("function NutricaoTab");
    const fim = appBruto.indexOf("\nfunction ", ini + 10);
    return appBruto.slice(ini, fim > 0 ? fim : undefined);
  })();
  const endpointNutricao = readFileSync("src/routes/api/nutrition.ts", "utf8");

  test("o widget do site LÊ o erro — e filtra o que é interno", () => {
    /* `DefaultChatTransport` lança `new Error(await response.text())`, então um
       500 mandava "Missing GOOGLE_GENERATIVE_AI_API_KEY" para a visitante. */
    expect(widget).toContain("error");
    expect(widget).toContain('avisoQuePodeAparecer(error.message ?? "")');
  });

  test("a Nutrição confere `res.ok` ANTES do corpo", () => {
    /* 429, 401 e o 500 de chave ausente TÊM corpo: o laço lia texto sem
       prefixo `data: `, `acc` ficava vazio, e a bolha renderizava "..." para
       sempre — sem erro, sem retry, sem nada dizendo o que houve. */
    expect(nutricao).toContain("if (!res.ok)");
    expect(nutricao).toContain("avisoQuePodeAparecer(corpo)");
  });

  test("a Nutrição tem a MESMA cadência — a paciente troca de aba na mesma tela", () => {
    /* Dois ritmos diferentes leem como dois produtos. E aqui o texto vinha em
       bloco por pedaço, que é exatamente o "nada, nada, parágrafo inteiro" que
       a régua existe para consertar. */
    expect(nutricao).toContain("passoDaDigitacao(acc.length - mostrado, aberto)");
    expect(nutricao).toContain("semAnimacaoNutricao()");
  });

  test("a Nutrição junta linha partida entre dois `read()`", () => {
    /* Sem `{stream: true}` e sem carry-over, um `data:` cortado ao meio some da
       resposta — e acento partido vira "�". O chat principal tinha buffer;
       este não. */
    expect(nutricao).toContain("decoder.decode(value, { stream: true })");
    expect(nutricao).toContain("buffer = linhas.pop()");
  });

  test("a Nutrição usa o MESMO leitor de linha, não uma cópia", () => {
    /* Duas cópias de um parser divergem — foi assim que a parte `error` ficou
       sem ser lida aqui depois de consertada no chat principal. */
    expect(nutricao).toContain("lerLinhaDoStream(line)");
    expect(nutricao).toContain('parte.tipo === "erro"');
  });

  test("o endpoint da Nutrição tem as MESMAS quatro proteções", () => {
    /* Mesmo modelo, respondendo sobre "vômitos intensos" e "carnes cruas" — e
       era o único dos dois endpoints sem nenhuma delas. A causa-raiz da bolha
       vazia ficou intacta aqui enquanto o chat principal a consertava. */
    expect(endpointNutricao).toContain("thinkingConfig: { thinkingBudget: 0 }");
    expect(endpointNutricao).toContain("BLOCK_ONLY_HIGH");
    expect(endpointNutricao).toContain("maxOutputTokens");
    expect(endpointNutricao).toContain("onError:");
  });
});

describe("a busca por significado não morre calada", () => {
  /* Sem log, `match_brain_entries` ausente derruba a busca semântica INTEIRA e
     o chat cai no ranking por palavras para sempre — com o painel verde e
     nenhum sinal.

     ─── ESTE TESTE JÁ QUEBROU POR SER FRÁGIL ─────────────────────────────────
     Ele fazia `indexOf` e olhava os 1.200 caracteres seguintes: media a PRIMEIRA
     ocorrência da RPC no arquivo. Quando a checagem de duplicata passou a usar
     a mesma RPC e ficou acima no arquivo, o teste reprovou sem que nada tivesse
     regredido — a alegação continuava verdadeira no lugar que ele queria medir.
     A correção não é reancorar em outra posição (o próximo `insert` desloca de
     novo): é cobrar de TODAS as ocorrências. Assim o teste fica mais forte e
     para de depender de ordem no arquivo. */
  test("toda chamada de match_brain_entries loga a própria falha", () => {
    const cerebro = readFileSync("src/lib/secondbrain.server.ts", "utf8");
    const pedacos = cerebro.split('rpc("match_brain_entries"').slice(1);
    expect(pedacos.length).toBeGreaterThan(0);
    for (const p of pedacos) {
      /* A janela cobre o `if (error)` imediatamente seguinte; um log a 1.200
         caracteres de distância estaria noutra função. */
      expect(p.slice(0, 1200)).toContain("console.error");
    }
  });

  test("a busca do chat diz QUAL SQL falta — o log só serve se acionar", () => {
    const cerebro = readFileSync("src/lib/secondbrain.server.ts", "utf8");
    expect(cerebro).toContain("[cerebro] match_brain_entries falhou");
    expect(cerebro).toContain("APLICAR_PENDENTES.sql");
  });
});
