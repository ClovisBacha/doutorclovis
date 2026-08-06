/**
 * ENSINAR E CORRIGIR SÃO COISAS DIFERENTES.
 *
 * Todo 👎 virava "a IA não soube responder" — inclusive quando ela soube. Se a
 * resposta veio de uma entrada APROVADA e estava errada, o médico via aquela
 * pergunta num card que afirma o contrário; e ao respondê-la, criava uma
 * SEGUNDA entrada com a mesma pergunta.
 *
 * A primeira, errada, continuava aprovada e continuava competindo na busca. O
 * cérebro passava a ter duas verdades sobre o mesmo assunto e nenhuma forma de
 * escolher entre elas — e cada correção piorava o problema em vez de resolvê-lo.
 *
 * Agora são duas filas:
 *   a IA NÃO SABIA     → lacuna.  Ele ensina algo novo.
 *   a IA SABIA e errou → revisão. Ele corrige o que já existe.
 */

import { describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";

function codigoDe(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
}

const fn = codigoDe("src/lib/secondbrain.functions.ts");
const cerebro = codigoDe("src/lib/secondbrain.server.ts");
const app = codigoDe("src/routes/_authenticated/minha-conta.tsx");
const painel = readFileSync("src/routes/_authenticated/painel.tsx", "utf8");
const sql = readFileSync("supabase/APLICAR_REVISAO.sql", "utf8").replace(/^\s*--.*$/gm, "");

describe("o voto carrega o que foi reprovado", () => {
  test("a RESPOSTA viaja junto com a pergunta", () => {
    /* Antes só a pergunta ia — e a pergunta é a única coisa que não estava
       errada. Sem o texto lido, o médico revisa no escuro. */
    expect(app).toContain("const resposta = messages[i]?.content");
    expect(app).toContain("...(resposta ? { answer: resposta } : {})");
  });

  test("o servidor guarda a resposta e a entrada", () => {
    expect(fn).toContain("answer: data.answer?.slice(0, 4000) ?? null");
    expect(fn).toContain("entry_id: entryId");
  });

  test("bolha VAZIA não é votável", () => {
    /* Quando o provedor falha, a resposta chega em branco. Um 👎 ali viraria
       trabalho para o médico criado por um erro 429 do Gemini. */
    expect(app).toContain("!!m.content?.trim() &&");
  });

  test("votar duas vezes é um voto só", () => {
    /* O voto vivia no estado da tela: recarregar permitia votar de novo e
       inflar a fila, fazendo uma reclamação parecer dez. */
    expect(fn).toContain("onConflict:");
    expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_brain_feedback_voto");
  });

  test("MUDAR DE IDEIA substitui — o `helpful` não pode estar na chave", () => {
    /* Com `helpful` DENTRO da chave, 👍 e 👎 da mesma paciente sobre a mesma
       pergunta conviviam como duas linhas. Uma paciente que tocou no 👎 sem
       querer e corrigiu entrava como um voto positivo E um negativo — 50% de
       satisfação sozinha, no número que o produto usa como prova de valor. E o
       👎 ficava `aberta` na fila dele para sempre, sobre uma resposta que ela
       já tinha dito que ajudou.
       Este teste afirma a AUSÊNCIA porque é ela que conserta: a chave certa é
       (paciente, pergunta), e o último voto vale. */
    expect(fn).not.toContain('onConflict: "user_id,question,helpful"');
    expect(fn).toContain('onConflict: "user_id,question"');
  });
});

describe("as duas filas não se misturam", () => {
  test("com entrada identificada, NÃO vira lacuna", () => {
    /* Este é o defeito central. Mandar para lacuna diria ao médico que "a IA
       não soube responder" sobre algo que ela soube. */
    expect(fn).toContain("if (!data.helpful && doctorId && !entryIdEfetivo) {");
    /* `entryIdEfetivo`, e não `entryId`: quando a migration da revisão não foi
       aplicada, a gravação cai na forma antiga (sem `entry_id`) e o item TEM
       que seguir para a fila de lacunas — senão o 👎 não chega a lugar nenhum. */
    expect(fn).toContain("entryIdEfetivo = null;");
  });

  test("sem entrada, continua virando lacuna", () => {
    /* A IA não sabia mesmo: é ensino, e a fila de lacunas é a certa. */
    expect(fn).toContain('logBrainGap(doctorId, pergunta, "app", u.user.id)');
  });

  test("a lacuna do 👎 agora registra QUEM reclamou", () => {
    /* Sem o `patientId`, `brain_gap_askers` ficava vazia: a paciente lia
       "seu médico vai ver 💛" e nunca recebia retorno. */
    expect(fn).toContain('"app", u.user.id)');
  });

  test("a entrada só é identificada acima do corte de ATRIBUIÇÃO", () => {
    /* Abaixo dele a resposta não foi apresentada como orientação do médico —
       corrigir uma entrada por causa dela seria punir o texto errado. */
    /* CORTE DE COBERTURA, não o de atribuição — e isto foi um conserto.
       A pergunta aqui é "esta entrada ENTROU na resposta?", que é o corte que
       faz o bloco ser injetado (0,62). Com o de atribuição (0,74), TODA
       resposta montada com uma entrada entre os dois caía na fila de LACUNAS
       ao levar 👎: o médico lia "sua IA não soube responder" sobre algo que ela
       respondeu com o material dele, respondia de novo, e criava uma segunda
       entrada sobre o mesmo assunto — o defeito que esta fila veio matar,
       sobrevivendo numa faixa inteira. */
    expect(cerebro).toContain("melhor.similarity >= SEMANTIC_MIN_SIMILARITY");
  });
});

describe("corrigir edita — não duplica", () => {
  test("a correção faz UPDATE na entrada existente", () => {
    expect(fn).toContain('.from("brain_entries")\n        .update({ answer: data.answer })');
  });

  test("nenhum insert de entrada no caminho da revisão", () => {
    const trecho = fn.slice(
      fn.indexOf("export const resolveBrainReview"),
      fn.indexOf("export const submitBrainFeedback"),
    );
    expect(trecho).not.toContain('.from("brain_entries").insert(');
  });

  test("o vetor é regerado junto com o texto", () => {
    /* Sem isto a busca continuaria achando a entrada pela resposta ANTIGA: o
       médico corrigiria e nada mudaria — o pior desfecho para quem acabou de
       trabalhar. */
    const trecho = fn.slice(fn.indexOf("export const resolveBrainReview"));
    expect(trecho.slice(0, 3000)).toContain("embedBrainEntry(");
  });

  test("o escopo do médico é checado de novo no update", () => {
    /* Escopo herdado é escopo que um refactor quebra em silêncio. */
    expect(fn).toContain('.eq("id", rev.entry_id)\n        .eq("doctor_id", doctorId)');
  });

  test("confirmar sem editar é um caminho legítimo", () => {
    /* Nem todo 👎 é erro: às vezes ela queria outra coisa, ou não gostou da
       notícia. Forçar edição faria o médico piorar um texto que estava certo
       só para tirar o item da tela. */
    expect(fn).toContain("if (data.answer && rev.entry_id) {");
    expect(painel).toContain("Está certa, manter");
  });
});

describe("a tela mostra as três coisas", () => {
  test("a pergunta, o que ela LEU e o que está aprovado", () => {
    expect(painel).toContain("O que ela leu");
    expect(painel).toContain("A sua resposta, corrigida");
  });

  test("o editor abre com o texto APROVADO, não com o reprovado", () => {
    /* Abrir com o que ela leu faria uma edição rápida sobrescrever o
       conhecimento com a versão que a própria paciente reprovou. */
    expect(painel).toContain('setTexto(it.entryAnswer ?? it.answer ?? "")');
  });

  test("fila vazia vira uma LINHA que ensina, não o nada", () => {
    /* Era `return null`, e o custo era o item que o médico pediu: ele achava a
       aba confusa, e a distinção entre ENSINAR (lacuna) e CORRIGIR (revisão)
       só era ensinada a quem já tivesse item na fila. Como a revisão é a rara
       das duas, dava para usar o Cérebro por meses sem descobrir que ela
       existe — enquanto a de lacunas sempre aparece, com estado vazio
       explicativo. Uma linha discreta não é "caixa vazia": é o nome da coisa. */
    expect(painel).not.toContain("if (!itens.length) return null;");
    expect(painel).toContain("nenhuma resposta reprovada");
  });

  test("o card mostra as TRÊS coisas que promete", () => {
    /* A docstring dele diz "pergunta, o que ela leu, e o que está aprovado
       hoje". Mostrava duas: `entryQuestion` era buscado, tipado e nunca
       renderizado — e sem ele o médico não sabe QUAL entrada do cérebro dele
       produziu aquilo, que é justamente o que ele vai corrigir. */
    expect(painel).toContain("{it.question}");
    expect(painel).toContain("{it.answer}");
    expect(painel).toContain("{it.entryQuestion}");
  });
});

/**
 * ─── COMPORTAMENTO, NÃO TEXTO ────────────────────────────────────────────────
 *
 * Os testes acima leem o arquivo e procuram string. Eles provam que alguém
 * escreveu a linha; não provam que o caminho funciona. Um avaliador rodou
 * mutação nesta base e mediu: 4 de 12 constantes podiam virar valores absurdos
 * — inclusive a trava que impede a IA de receber imagem de laudo — sem uma
 * única falha na suíte.
 *
 * Estes rodam a decisão de verdade, com um Supabase de mentira. Sem tocar no
 * Gemini, que é o que o dono pediu.
 */
describe("a correção volta para quem reclamou", () => {
  /** Banco falso: registra o que foi escrito. */
  function bancoFalso(opts: { vinculoAtual: boolean }) {
    const reg = { inserts: [] as { tabela: string; linha: any }[] };
    const sb: any = {
      from(tabela: string) {
        const q: any = {
          select: () => q,
          eq: () => q,
          maybeSingle: async () => ({ data: opts.vinculoAtual ? { id: "pac-1" } : null }),
          insert: async (linha: any) => {
            reg.inserts.push({ tabela, linha });
            return { error: null };
          },
        };
        return q;
      },
    };
    return { sb, reg };
  }

  const args = { doctorId: "doc-1", userId: "pac-1", pergunta: "posso tomar X?" };

  test("editar a resposta entrega em doctor_questions e dispara push", async () => {
    const { sb, reg } = bancoFalso({ vinculoAtual: true });
    const empurrados: string[] = [];
    mock.module("./push.server", () => ({
      sendPushToUser: async (uid: string) => {
        empurrados.push(uid);
      },
    }));
    const { entregarCorrecao } = await import("./secondbrain.functions");

    const avisada = await entregarCorrecao(sb, { ...args, resposta: "A resposta corrigida." });

    expect(avisada).toBe(true);
    const entregue = reg.inserts.find((i) => i.tabela === "doctor_questions");
    expect(entregue?.linha?.user_id).toBe("pac-1");
    expect(entregue?.linha?.answer).toBe("A resposta corrigida.");
    expect(entregue?.linha?.answered).toBe(true);
    expect(empurrados).toEqual(["pac-1"]);
  });

  test("quem trocou de médico NÃO recebe correção do consultório anterior", async () => {
    const { sb, reg } = bancoFalso({ vinculoAtual: false });
    mock.module("./push.server", () => ({ sendPushToUser: async () => {} }));
    const { entregarCorrecao } = await import("./secondbrain.functions");

    const avisada = await entregarCorrecao(sb, { ...args, resposta: "corrigida" });

    expect(avisada).toBe(false);
    expect(reg.inserts.find((i) => i.tabela === "doctor_questions")).toBeUndefined();
  });

  test('"está certa, manter" não avisa ninguém', async () => {
    /* Nada mudou para ela — dizer que mudou seria ruído com cara de novidade. */
    const { sb, reg } = bancoFalso({ vinculoAtual: true });
    mock.module("./push.server", () => ({ sendPushToUser: async () => {} }));
    const { entregarCorrecao } = await import("./secondbrain.functions");

    const avisada = await entregarCorrecao(sb, { ...args, resposta: null });

    expect(avisada).toBe(false);
    expect(reg.inserts.find((i) => i.tabela === "doctor_questions")).toBeUndefined();
  });
});
