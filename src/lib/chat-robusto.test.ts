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
  test("paciente logada tem balde próprio", () => {
    expect(chat).toContain('const chaveDoLimite = auth.toLowerCase().startsWith("bearer ")');
    expect(chat).toContain("`u:${auth.slice(-32)}`");
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
