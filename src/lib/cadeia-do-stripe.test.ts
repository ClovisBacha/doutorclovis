/**
 * A CADEIA DO STRIPE, PONTA A PONTA — o médico paga e RECEBE.
 *
 * ─── O DEFEITO QUE ESTE ARQUIVO IMPEDE ──────────────────────────────────────
 *
 * Uma auditoria mediu a cadeia antes desta mudança e achou os quatro elos
 * cortados: o checkout mandava `quantity: 1` fixo, o tipo da assinatura não
 * tinha `quantity`, o webhook gravava só o NOME normalizado do plano, e não
 * existia coluna para a quantidade.
 *
 * O desfecho, na palavra dela: criar hoje o Price graduado e mandar
 * `plan: "mensagens"` faz `normalizePlan` devolver `"free"` — **o médico paga
 * o topo da escada e recebe o plano grátis**, sem erro em lugar nenhum, com 200
 * devolvido ao Stripe, que nunca reenvia. Silencioso dos dois lados.
 *
 * É o mesmo defeito que o comentário de `stripe-webhook.ts` diz ter consertado
 * uma vez, com o sinal trocado: lá era conceder DEMAIS, aqui é conceder de
 * MENOS. Nos dois casos, ninguém descobre.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  ENTRADA_MENSAGENS,
  TETO_AUTOATENDIMENTO,
  centavosPorMensagem,
  precoDe,
} from "./planos-medico";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const stripe = semComentarios("src/lib/stripe.server.ts");
const webhook = semComentarios("src/routes/api/stripe-webhook.ts");
const entServer = semComentarios("src/lib/entitlements.server.ts");
const billing = semComentarios("src/lib/billing.functions.ts");
const entitlements = semComentarios("src/lib/entitlements.ts");
const migration = readFileSync(
  "supabase/migrations/20260807180000_mensagens_contratadas.sql",
  "utf8",
);

/** O corpo de UMA função — a janela precisa ser da assinatura, não do arquivo. */
function corpoDe(fonte: string, assinatura: string): string {
  const i = fonte.indexOf(assinatura);
  if (i < 0) throw new Error(`assinatura não encontrada: ${assinatura}`);
  const fim = fonte.indexOf("\nexport ", i + assinatura.length);
  return fonte.slice(i, fim < 0 ? fonte.length : fim);
}

describe("1. o CHECKOUT manda a quantidade", () => {
  /**
   * A janela é o corpo de `createCheckoutSession`. O arquivo inteiro não serve:
   * `createOneTimeCheckout` (a compra avulsa de Sementinhas) compra uma unidade
   * de propósito, e uma asserção sobre o arquivo confundiria as duas.
   */
  const assinatura = corpoDe(stripe, "export async function createCheckoutSession");

  test("`quantity` deixou de ser 1 fixo", () => {
    /* A asserção que descreve o defeito. */
    expect(assinatura).not.toContain('"line_items[0][quantity]": 1,');
    expect(assinatura).toContain(
      '"line_items[0][quantity]": Math.max(1, Math.floor(opts.quantity ?? 1))',
    );
  });

  test("e a compra AVULSA continua sendo de uma unidade", () => {
    /* O contraponto: se alguém "corrigisse" as duas de uma vez, o pacote de
       Sementinhas passaria a ler uma quantidade que ninguém escolheu. */
    expect(corpoDe(stripe, "export async function createOneTimeCheckout")).toContain(
      '"line_items[0][quantity]": 1,',
    );
  });

  test("e o padrão continua 1 — para o que NÃO é escada", () => {
    /* Premium da paciente e Sementinhas compram uma unidade. Se o padrão virasse
       zero ou obrigatório, essas duas compras quebrariam. */
    expect(assinatura).toContain("opts.quantity ?? 1");
  });

  test("o slider é o do PRÓPRIO Stripe (`adjustable_quantity`)", () => {
    /* Escrever o nosso deixaria uma segunda tabela de preços no cliente — e
       duas tabelas para a mesma compra é o que este projeto já viu divergir
       quatro vezes. */
    expect(assinatura).toContain('"line_items[0][adjustable_quantity][enabled]"');
    expect(assinatura).toContain('"line_items[0][adjustable_quantity][minimum]"');
    expect(assinatura).toContain('"line_items[0][adjustable_quantity][maximum]"');
  });
});

describe("1b. e ALGUÉM manda a quantidade — o elo que faltava", () => {
  /**
   * Este bloco existe porque a primeira versão deste arquivo passou verde com a
   * cadeia cortada. Provava que `createCheckoutSession` ACEITA `quantity`, e
   * nada mais: nenhum chamador passava, todo checkout ia com 1, e o médico
   * pagaria R$ 29,90 para receber UMA resposta de IA no mês.
   *
   * É a quinta vez nesta base que a mesma armadilha aparece — o teste prova a
   * função extraída e nunca o CHAMADOR. As outras foram o backfill, o bloco do
   * cérebro, o corte da memória, o caminho do dinheiro do cupom e o bônus de
   * vínculo.
   */
  test("o checkout do médico passa `quantity` e `quantityRange`", () => {
    expect(billing).toContain("quantity,");
    expect(billing).toContain("quantityRange,");
    expect(billing).toContain("quantity = pedido;");
  });

  test("a faixa vem da ESCADA, não de números escritos aqui", () => {
    /* Um literal aqui seria a segunda tabela de preços — a divergência que esta
       base já viu quatro vezes entre a tela e a cobrança. */
    expect(billing).toContain(
      'const { ENTRADA_MENSAGENS, TETO_AUTOATENDIMENTO } = await import("@/lib/planos-medico")',
    );
    expect(billing).toContain("pedido < ENTRADA_MENSAGENS || pedido > TETO_AUTOATENDIMENTO");
  });

  test("acima do topo o checkout RECUSA — é contrato de Clínica", () => {
    expect(billing).toContain('error: "fora_da_escada"');
  });

  test("e existe um Price para o plano — senão ele nem chega ao Stripe", () => {
    /* `priceIdFor` devolvendo `null` vira `plano_indisponivel`: o médico clica
       em assinar e não acontece nada. Silencioso do lado dele também. */
    expect(stripe).toContain('"doctor_plan:mensagens": env.STRIPE_PRICE_DOCTOR_MENSAGENS');
  });

  test("`mensagens` é um plano que o validador aceita", () => {
    /* Sem isto o Zod recusa antes de qualquer coisa, com erro de validação —
       e a tela de vendas mostraria um botão que nunca funciona. */
    expect(billing).toContain('"mensagens",');
  });
});

describe("2. o WEBHOOK lê do ITEM, nunca do metadata", () => {
  /**
   * O próprio arquivo já defende esse princípio ao creditar Sementinhas: "o
   * metadata é pista, não autoridade". Aqui o valor É a fatura — lê-lo do
   * metadata deixaria qualquer um forjar um POST com 20.000 mensagens.
   */
  test("a quantidade vem de `items.data[0].quantity`", () => {
    expect(webhook).toContain("sub.items?.data?.[0]?.quantity");
  });

  test("e NÃO do metadata", () => {
    expect(webhook).not.toContain("metadata?.quantity");
    expect(webhook).not.toContain('metadata["quantity"]');
  });

  test("o tipo da assinatura carrega `quantity`", () => {
    /* Sem isto o TypeScript aceitaria `undefined` em silêncio e a leitura
       nunca daria nada. */
    expect(stripe).toContain("quantity?: number");
  });
});

describe("3. quantidade implausível NÃO concede — falha fechada", () => {
  test("há faixa, e ela recusa fora dela", () => {
    const i = webhook.indexOf("const qtd = ehEscada");
    expect(i).toBeGreaterThan(-1);
    const bloco = webhook.slice(i, i + 700);
    expect(bloco).toContain("qtd > 0 && qtd <= 20_000");
    expect(bloco).toContain(": null");
  });

  test("e a quantidade SÓ é lida no plano que é medido em mensagens", () => {
    /**
     * ─── O DEFEITO QUE UM VERIFICADOR ADVERSARIAL ACHOU ────────────────────
     *
     * A leitura valia para QUALQUER plano de médico. Nos planos NOMEADOS o item
     * do Stripe tem `quantity: 1` sempre — é um assento, não uma escada.
     *
     * Resultado: um médico no Pro (R$ 297/mês, 4.000 respostas por ciclo) tinha
     * a cota reescrita para UMA mensagem por ciclo no próximo evento da
     * assinatura. E o gatilho é rotina: renovação mensal, troca de cartão.
     * Ele pagaria R$ 297 e o cérebro pararia depois da primeira mensagem do
     * mês, sem erro nenhum — porque 1 é um número perfeitamente válido.
     */
    expect(webhook).toContain('const ehEscada = planKey === "mensagens"');
    expect(webhook).toContain("const qtd = ehEscada ? sub.items?.data?.[0]?.quantity : undefined");
  });

  test("e avisa no log em vez de conceder calado", () => {
    /* Conceder de menos o médico reclama e a gente conserta. Conceder de mais
       ninguém reclama e ninguém descobre — por isso a direção é esta, e por
       isso precisa deixar rastro. */
    expect(webhook).toContain("quantidade fora da faixa; plano de mensagens NÃO concedido");
  });

  test("`null` não APAGA a quantidade de quem já tinha", () => {
    /* Um médico que renova por um caminho antigo (sem `quantity` no item) não
       pode perder o que comprou. O update só inclui a coluna quando há valor. */
    expect(webhook).toContain(
      "...(mensagens !== null ? { ai_messages_per_cycle: mensagens } : {})",
    );
  });

  test("mas REVOGAR zera — senão a IA sobrevive ao cancelamento", () => {
    /* O teto da cota passou a sair desta coluna. Sem zerar, quem cancelou
       mantém a IA inteira de graça. */
    expect(webhook).toContain('plan: "free", plan_expires_at: null, ai_messages_per_cycle: null');
  });
});

describe("4. a COLUNA existe, com faixa e sem default", () => {
  test("a migration cria a coluna", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS ai_messages_per_cycle integer");
  });

  test("sem DEFAULT — `NULL` significa 'não comprou'", () => {
    /* Um default de 0 ou 150 daria plano a todo médico existente no momento em
       que a migration rodasse. */
    expect(migration).not.toMatch(/ai_messages_per_cycle integer[^;]*DEFAULT/);
  });

  test("com CHECK de faixa — a quantidade vem de fora", () => {
    expect(migration).toContain("doctors_ai_messages_faixa");
    expect(migration).toContain("<= 20000");
  });

  test("e é idempotente, como todo SQL desta base", () => {
    expect(migration).toContain("IF NOT EXISTS");
    expect(migration).toContain("pg_constraint WHERE conname");
  });
});

describe("5. UMA fonte alimenta os CINCO leitores do teto", () => {
  /**
   * `aiRepliesPerCycle` é lido em cinco lugares. Trocar a fonte em cada um é
   * exatamente como a régua de vencimento ganhou quatro cópias discordantes, e
   * como o teto de pacientes existia em dois caminhos e vazava no terceiro.
   */
  test("o resolvedor lê a coluna", () => {
    expect(entServer).toContain("async function comMensagensCompradas");
    expect(entServer).toContain('.select("ai_messages_per_cycle")');
  });

  test("e os DOIS pontos de entrada passam por ela", () => {
    expect(entServer).toContain("comMensagensCompradas(user.id, entitlementsFor");
    expect(entServer).toContain("comMensagensCompradas(doctorId, entitlementsFor");
  });

  test("coluna ausente ou falha → segue pelo plano, sem quebrar", () => {
    /* A migration é aplicada à mão nesta base (o CLAUDE.md avisa que produção
       fica atrás). Sem esta rede, todo médico ficaria sem entitlements no
       intervalo entre o deploy e o SQL. */
    const i = entServer.indexOf("async function comMensagensCompradas");
    const corpo = entServer.slice(i, i + 900);
    expect(corpo).toContain("if (error) return base;");
    expect(corpo).toContain("catch");
  });

  test("valor inválido não vira teto", () => {
    const i = entServer.indexOf("async function comMensagensCompradas");
    const corpo = entServer.slice(i, i + 900);
    expect(corpo).toContain("!Number.isFinite(n) || n <= 0");
  });
});

describe("5b. o NOME do plano sobrevive à normalização", () => {
  /**
   * O defeito exato que a auditoria mediu, e que a versão anterior deste arquivo
   * não cobria: o webhook grava `normalizePlan(plan)`, e enquanto
   * `normalizePlan("mensagens")` devolvia `"free"`, gravar a quantidade certa na
   * coluna não adiantava nada — todo o resto (IA no app, ferramentas clínicas,
   * teto de pacientes) vinha do plano Free.
   *
   * Pagar R$ 295,40 e receber o plano grátis, com 200 devolvido ao Stripe.
   */
  test("`normalizePlan` conhece o nome que o checkout manda", () => {
    expect(entitlements).toContain('p === "mensagens"');
  });

  test("e o padrão continua sendo `free` — conceder de menos, nunca de mais", () => {
    /* A rede que faz um plano DESCONHECIDO ser um bug barato. */
    const i = entitlements.indexOf("export function normalizePlan");
    const corpo = entitlements.slice(i, i + 900);
    expect(corpo).toContain('return "free";');
  });
});

describe("6. o preço que o Stripe vai cobrar é o que a nossa conta diz", () => {
  /**
   * As faixas são configuradas no Stripe à mão. Se a nossa `precoDe` divergir
   * delas, a tela promete um número e a fatura cobra outro — a reclamação mais
   * cara que existe.
   *
   * Estes são os números que vão para a configuração; qualquer mudança aqui é
   * uma mudança que precisa ser refeita no painel do Stripe.
   */
  test("a entrada: 150 mensagens = R$ 29,90", () => {
    expect(ENTRADA_MENSAGENS).toBe(150);
    expect(precoDe(150)).toBe(2_990);
  });

  test("o topo: 2.500 mensagens = R$ 339,40", () => {
    expect(TETO_AUTOATENDIMENTO).toBe(2_500);
    expect(precoDe(2_500)).toBe(33_940);
  });

  test("e o antigo topo (R$ 294,40) agora compra 2.000", () => {
    /* A escada passou de quatro faixas para dez, com o desconto morando nas
       mensagens de cima. O mesmo bolso de antes compra 2.000 em vez de 2.500 —
       e é preciso que o Stripe reproduza os DOIS pontos, não só o topo. */
    expect(precoDe(2_000)).toBe(29_440);
  });

  test("e as dez faixas somam exatamente isso", () => {
    /* A conta que a configuração do Stripe tem de reproduzir, faixa a faixa. */
    const soma =
      2_990 +
      150 * 19 +
      200 * 18 +
      250 * 17 +
      250 * 15 +
      250 * 14 +
      250 * 13 +
      250 * 11 +
      250 * 10 +
      500 * 9;
    expect(soma).toBe(precoDe(2_500));
  });
});

describe("7. o DOCUMENTO do Stripe é conferido contra a escada, linha por linha", () => {
  /**
   * ─── POR QUE ESTE BLOCO PRECISOU EXISTIR ──────────────────────────────────
   *
   * Um verificador adversarial achou uma linha errada na tabela "Confira antes
   * de salvar": 1.750 mensagens estavam anotadas como R$ 0,1554 por mensagem,
   * quando a escada entrega R$ 0,1539. Erro de digitação meu, ao compor a
   * tabela à mão.
   *
   * E a linha errada era ativamente perigosa: o cabeçalho da seção manda
   * "se algum não bater, uma camada está errada". Quem fosse conferir veria o
   * site calcular 0,1539, concluiria que a camada 8 estava errada, e mexeria
   * numa camada CERTA — o documento induzindo o erro que existe para evitar.
   *
   * Este documento vira digitação humana no painel do Stripe. Um número errado
   * aqui não dá erro em lugar nenhum: vira cobrança errada.
   */
  const doc = readFileSync("docs/stripe-plano-medico.md", "utf8");

  /** Uma linha da tabela markdown → números. */
  const linhas = doc
    .split("\n")
    .filter((l) => /^\| [\d.]+ +\|/.test(l))
    .map((l) => l.split("|").map((c) => c.trim()))
    .filter((c) => (c.length >= 5 && c[2].startsWith("**R$") === false ? true : true));

  test("a tabela de conferência existe e tem os dez degraus", () => {
    const comFatura = linhas.filter((c) => /R\$/.test(c[2]));
    expect(comFatura.length).toBeGreaterThanOrEqual(10);
  });

  test("cada linha bate com `precoDe` e `centavosPorMensagem`", () => {
    const num = (t: string) => Number(t.replace(/[^\d,]/g, "").replace(",", "."));
    let conferidas = 0;
    for (const c of linhas) {
      const mensagens = Number(c[1].replace(/\./g, ""));
      if (!Number.isFinite(mensagens) || mensagens < 150 || mensagens > 2_500) continue;
      if (!/R\$/.test(c[2])) continue;
      const fatura = Math.round(num(c[2]) * 100);
      expect(fatura).toBe(precoDe(mensagens));
      /* O unitário do documento tem quatro casas: comparo em reais, com
         tolerância de meio décimo de centavo. */
      const unitario = num(c[3]);
      expect(unitario).toBeCloseTo(centavosPorMensagem(mensagens) / 100, 4);
      conferidas++;
    }
    /* Se o parser deixar de achar linhas, o teste passaria vazio — e um teste
       que não confere nada é pior que nenhum teste. */
    expect(conferidas).toBeGreaterThanOrEqual(10);
  });
});
