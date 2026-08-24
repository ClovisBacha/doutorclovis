/**
 * O GANCHO — e a linha entre o que é grátis e o que é pago.
 *
 * ─── AS DUAS DECISÕES QUE ISTO GUARDA ───────────────────────────────────────
 *
 * 1. **Todos os planos pagos entregam as MESMAS funções.** O que muda de um
 *    para o outro é só quantas mensagens de IA ele tem por mês. Não há função
 *    reservada ao plano mais caro, e a página não pode sugerir que há.
 *
 * 2. **A transcrição é do plano pago.** Não só pelo custo do modelo: o que sai
 *    dela vira BASE DE CONHECIMENTO do Segundo Cérebro — é o jeito mais rápido
 *    de o médico ensinar a própria voz à IA. É feature do produto de IA, não da
 *    plataforma de gestão.
 *
 * E o gancho existe porque o dono pediu, com estas palavras: "essa função só
 * está disponível no plano de R$ 29,90 — ofereça a ele ali o plano mais barato;
 * esse gancho tem que estar no site."
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { FUNCOES_PAGAS, SELO_PAGO, fraseDoGancho, precoDeEntrada } from "./gancho-de-upgrade";
import { ENTRADA_MENSAGENS, precoDe } from "./planos-medico";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const transcribe = semComentarios("src/routes/api/transcribe.ts");
const painel = semComentarios("src/routes/_authenticated/painel.tsx");
const conta = semComentarios("src/routes/_authenticated/minha-conta.tsx");
const vendas = semComentarios("src/routes/medicos.tsx");

describe("1. o preço do gancho vem da escada, nunca digitado", () => {
  test("é o preço de entrada, formatado", () => {
    expect(precoDeEntrada()).toBe("R$ 29,90");
    expect(precoDeEntrada()).toBe(
      `R$ ${(precoDe(ENTRADA_MENSAGENS) / 100).toFixed(2).replace(".", ",")}`,
    );
  });

  test("a frase diz o que ele perde, o que aquilo faz, e quanto custa", () => {
    /* Nesta ordem. Começar pelo preço soa a cobrança; terminar sem ele obriga
       o médico a procurar. */
    const f = fraseDoGancho("transcricao");
    expect(f).toContain("Transcrição de consulta");
    expect(f).toContain("ensinar a IA com a sua voz");
    expect(f).toContain(precoDeEntrada());
    expect(f.indexOf("Transcrição")).toBeLessThan(f.indexOf(precoDeEntrada()));
  });

  test("e NENHUM chamador o digita à mão", () => {
    /**
     * O teste acima prova a função. Não provava os CHAMADORES — e foi
     * exatamente ali que o preço vazou: `transcribe.ts` respondia 402 com
     * "Assine a partir de R$ 29,90/mês" escrito no meio do JSON. A função
     * existia, estava certa, e o servidor não a chamava.
     *
     * Uma escada de dez degraus muda de valor com frequência. Cada preço
     * digitado é uma cotação que sobrevive à mudança e passa a mentir — e
     * esta, saindo do servidor, ninguém relê antes de publicar.
     */
    const chamadores = [
      "src/routes/api/transcribe.ts",
      "src/routes/_authenticated/painel.tsx",
      "src/routes/medicos.tsx",
      "src/components/escada-mensagens.tsx",
    ];
    for (const caminho of chamadores) {
      expect(semComentarios(caminho)).not.toContain("29,90");
    }
  });

  test("e nunca chama o plano do médico de «Premium»", () => {
    /* «Premium» é a assinatura da PACIENTE (R$ 19,90). A mesma palavra para as
       duas faria as duas conversas colidirem no suporte — e esse tipo de
       confusão só aparece depois que alguém pagou a coisa errada. */
    const fonte = readFileSync("src/lib/gancho-de-upgrade.ts", "utf8");
    const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(codigo).not.toContain("Premium");
    expect(SELO_PAGO).not.toContain("Premium");
  });
});

describe("2. a transcrição pede plano — e cobra o do MÉDICO", () => {
  test("há gate, e ele vem antes de gastar qualquer coisa", () => {
    /* A asserção que descreve o defeito: não havia gate NENHUM. Um médico no
       Free mandava 20 MB de áudio e a fatura ia para a nossa chave. */
    const iGate = transcribe.indexOf("if (!ent.aiApp)");
    const iModelo = transcribe.indexOf("GOOGLE_GENERATIVE_AI_API_KEY");
    expect(iGate).toBeGreaterThan(-1);
    expect(iGate).toBeLessThan(iModelo);
  });

  test("responde 402, não 403 nem 500", () => {
    /* 402 é "precisa pagar" — é o código que a tela sabe transformar em gancho
       em vez de em "tente novamente". */
    expect(transcribe).toContain("status: 402");
    expect(transcribe).toContain('error: "sem_plano"');
  });

  test("quando quem chama é a PACIENTE, vale o plano do médico dela", () => {
    /**
     * Ela não tem linha em `doctors`: `getEntitlements` a resolveria como Free
     * e barraria a transcrição dela mesmo com o médico pagando. É a cota dele
     * que paga e é o cérebro dele que o texto alimenta.
     */
    expect(transcribe).toContain("getEntitlementsByDoctorId");
    expect(transcribe).toContain('.select("doctor_id")');
  });

  test("sem médico vinculado, não passa", () => {
    /* O `if` de fora continua valendo: se não achou médico, `ent` fica como
       estava — Free — e o gate barra. Falha fechada. */
    const i = transcribe.indexOf("if (!ent.aiApp)");
    const segundo = transcribe.indexOf("if (!ent.aiApp)", i + 10);
    expect(segundo).toBeGreaterThan(i);
  });
});

describe("3. as telas transformam o 402 em gancho, não em erro", () => {
  test("o painel do médico mostra a frase e um caminho", () => {
    /**
     * "Tente novamente" faz ele tentar de novo, falhar de novo, e nunca
     * descobrir que existe um plano.
     *
     * As três asserções são recortadas ao BLOCO do 402, não ao arquivo. O
     * painel tem 5 mil linhas: "Ver planos" aparece três vezes nele e
     * `fraseDoGancho` duas. Cobrando o arquivo inteiro, apagar o botão daqui
     * deixava o teste verde na conta de um botão de outra tela — dois mutantes
     * sobreviveram exatamente assim.
     */
    const i = painel.indexOf("res.status === 402");
    expect(i).toBeGreaterThan(-1);
    /* Até o `return` do próprio ramo — uma janela fixa de caracteres passava
       do fim do `if` e engolia o `toast.error` genérico que vem logo abaixo. */
    const bloco = painel.slice(i, painel.indexOf("return;", i));
    expect(bloco).toContain('fraseDoGancho("transcricao")');
    expect(bloco).toContain("Ver planos");
    /**
     * E o botão LEVA a algum lugar.
     *
     * Ele rolava até `getElementById("cobranca")` — uma âncora que mora na tela
     * de perfil e só existe quando `tab === "Meu Perfil"`. O médico está na aba
     * Cérebro quando transcreve, então o nó não existia, o `?.` engolia tudo e
     * o botão não fazia absolutamente nada. Um gancho que não leva a lugar
     * nenhum é pior que nenhum gancho: confirma ao médico que o produto está
     * quebrado, no exato momento em que a gente pede dinheiro a ele.
     */
    expect(bloco).toContain("onIrParaPlanos");
    expect(bloco).not.toContain('getElementById("cobranca")');
    /**
     * E ALGUÉM passa a prop.
     *
     * Sem esta linha o teste provava o componente e não o CHAMADOR — pela sexta
     * vez nesta base. `onIrParaPlanos?.()` com a prop ausente é exatamente o
     * botão morto de novo, só que agora com um `?.` para engolir o silêncio.
     */
    expect(painel).toContain("<BrainConsultaCard");
    const iCard = painel.indexOf("<BrainConsultaCard");
    expect(painel.slice(iCard, iCard + 200)).toContain("onIrParaPlanos={onIrParaPlanos}");
    /* E o gancho não pode virar `toast.error`: erro vermelho para quem só
       precisa assinar é a mesma mentira do "tente novamente". */
    expect(bloco).not.toContain("toast.error");
  });

  test("o app da paciente NÃO oferece o plano a ela", () => {
    /**
     * Quem não tem plano é o MÉDICO. Mandar a gestante "assinar a partir de
     * R$ 29,90" seria cobrar dela um plano que não é dela — e a mensagem do
     * servidor é escrita para o painel dele.
     */
    const i = conta.indexOf("res.status === 402");
    expect(i).toBeGreaterThan(-1);
    const bloco = conta.slice(i, i + 600);
    expect(bloco).not.toContain("29,90");
    expect(bloco).not.toContain("Assine");
    expect(bloco).toContain("seu médico");
  });
});

describe("4. o site diz o que é grátis e o que pede plano", () => {
  test("o gancho está na página, não só nas telas de quem já paga", () => {
    /* `toContain("FUNCOES_PAGAS")` sozinho era satisfeito pela linha do
       `import` — a página podia não renderizar função paga nenhuma e o teste
       ficava verde. A asserção que vale é a que descreve a TELA: a lista sai
       da constante, e o selo traz o preço da escada. */
    expect(vendas).toContain("Object.values(FUNCOES_PAGAS).map");
    expect(vendas).toContain("{SELO_PAGO} · a partir de {precoDeEntrada()}/mês");
  });

  test("e diz, por escrito, que os planos pagos são iguais", () => {
    /* É a decisão do dono. Sem a frase, três cartões com preços diferentes
       sugerem três produtos diferentes — e o médico procura a diferença que
       não existe. */
    expect(vendas).toContain("Todos os planos pagos entregam as mesmas funções");
  });

  test("nada na página sugere função reservada ao plano mais caro", () => {
    /* Os "níveis" saíram: o cérebro atende no app E no WhatsApp desde o plano
       de entrada. Enquanto o texto dizia "Nível 2 (Pro)", ele vendia uma
       escada de recursos que deixou de existir. */
    expect(vendas).not.toContain("Nível");
  });
});
