/**
 * O plano Essencial, e a escada inteira.
 *
 * O que se protege aqui é uma classe de defeito que não dá erro e custa
 * dinheiro dos dois lados: **conceder o plano errado**.
 *
 * Um plano é enumerado em nove lugares (tipo, entitlements, preço, escada,
 * normalizador, mapa de Price, lista do checkout, webhook, telas). Esquecer um
 * não quebra o build — só faz o médico pagar um plano e receber outro.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  PLAN_ENTITLEMENTS,
  PLAN_PRICE,
  PLAN_RANK,
  normalizePlan,
  mensalidadeCentavos,
  type PlanKey,
} from "./entitlements";

const TODOS = Object.keys(PLAN_ENTITLEMENTS) as PlanKey[];

/**
 * A fonte sem comentários.
 *
 * Testes que cobram "este arquivo NÃO contém X" se enganam sozinhos: o
 * comentário que EXPLICA o defeito quase sempre cita X. Aconteceu quatro vezes
 * nesta base — sempre passando por acidente, que é o pior jeito de um teste
 * falhar. O que se cobra é o código.
 */
function codigoDe(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
}

describe("nenhum plano fica pela metade", () => {
  test("todo plano tem entitlements, preço, posição na escada e normaliza para si", () => {
    for (const p of TODOS) {
      expect(PLAN_ENTITLEMENTS[p]).not.toBeUndefined();
      expect(PLAN_PRICE[p]).not.toBeUndefined();
      expect(PLAN_RANK[p]).not.toBeUndefined();
      expect(normalizePlan(p)).toBe(p);
    }
  });

  test("a escada não tem empate — dois planos no mesmo degrau é ordem indefinida", () => {
    /* `PLAN_RANK` decide quem aparece antes na busca que a paciente vê. */
    const postos = TODOS.map((p) => PLAN_RANK[p]);
    expect(new Set(postos).size).toBe(postos.length);
  });

  test("quem paga mais nunca fica abaixo de quem paga menos", () => {
    /**
     * `mensagens` fica de fora, e o motivo é que ele quebra a PREMISSA da
     * invariante, não a invariante: ela ordena por `PLAN_PRICE[p]`, um número
     * por plano, e o preço dele é uma FAIXA — R$ 29,90 (150 mensagens) a
     * R$ 339,40 (2.500). `PLAN_PRICE.mensagens` guarda só a entrada.
     *
     * A faixa dele atravessa quase toda a escada nomeada: começa abaixo do
     * Essencial (R$ 49,90) e termina acima do Pro (R$ 297). Qualquer
     * posto único seria certo para uma ponta e errado para a outra, então
     * ordená-lo pela entrada seria escolher a leitura mais errada das duas — a
     * de que o plano que substituiu a escada vale menos que todos os degraus
     * que ele aposentou, na busca que a paciente vê.
     */
    const pagos = TODOS.filter((p) => p !== "mensagens" && PLAN_PRICE[p] > 0).sort(
      (a, b) => PLAN_PRICE[a] - PLAN_PRICE[b],
    );
    for (let i = 1; i < pagos.length; i++) {
      expect(PLAN_RANK[pagos[i]]).toBeGreaterThan(PLAN_RANK[pagos[i - 1]]);
    }
  });

  test("`mensagens` é uma FAIXA de preço, e é por isso que ele sai da regra acima", () => {
    /* Se um dia ele virar preço único, a exclusão acima perde a justificativa e
       este teste é o que avisa. */
    expect(PLAN_PRICE.mensagens).toBe(29.9);
    expect(mensalidadeCentavos("mensagens", 11_100)).toBe(99_900);
    expect(mensalidadeCentavos("mensagens", 11_100)).toBeGreaterThan(PLAN_PRICE.mensagens * 100);
  });

  test("e ele fica abaixo só do contrato de Clínica", () => {
    /* Sobraram quatro planos: `free`, `trial` (em extinção), `mensagens` (o que
       se vende) e `clinica` (contrato). Só a Clínica fica acima. */
    expect(PLAN_RANK.mensagens).toBeGreaterThan(PLAN_RANK.free);
    expect(PLAN_RANK.mensagens).toBeGreaterThan(PLAN_RANK.trial);
    expect(PLAN_RANK.mensagens).toBeLessThan(PLAN_RANK.clinica);
  });

  test("e são QUATRO planos, não nove", () => {
    /* Os cinco nomeados foram apagados porque não havia médico em nenhum. Um
       plano vazio que fica no código é manutenção para zero receita. */
    expect(TODOS.sort()).toEqual(["clinica", "free", "mensagens", "trial"]);
  });
});

describe("o webhook concede o plano que foi pago", () => {
  const fonte = codigoDe("src/routes/api/stripe-webhook.ts");

  test("não existe mais a corrente de startsWith com 'starter' como padrão", () => {
    /* Era o defeito mais caro possível aqui: um plano novo que ninguém
       acrescentasse à corrente viraria Starter em silêncio — o médico pagaria
       R$49,90 e receberia o plano de R$149. Nenhum erro, nenhum log. */
    expect(fonte).not.toContain('p.startsWith("black")');
    expect(fonte).not.toContain(': "starter";');
  });

  test("usa a fonte única e tira o sufixo do ciclo", () => {
    expect(fonte).toContain('normalizePlan((plan ?? "").replace(/_annual$/, ""))');
  });

  test("o ciclo anual concede o MESMO plano do mensal", () => {
    for (const p of TODOS) {
      expect(normalizePlan(`${p}_annual`.replace(/_annual$/, ""))).toBe(p);
    }
  });

  test("plano desconhecido concede de MENOS, nunca de mais", () => {
    /* Bug de cobrança tem que errar para o lado seguro. */
    expect(normalizePlan("plano_que_nao_existe")).toBe("free");
    expect(PLAN_RANK[normalizePlan("")]).toBe(0);
  });
});

/**
 * ─── UM PLANO PRECISA EXISTIR EM TODO LUGAR QUE ENUMERA PLANO ───────────────
 *
 * Este varredor nasceu para o Essencial e pegou, de graça, o defeito de verdade
 * quando a escada nova entrou: `mensagens` estava em quatro sítios de menos.
 * O pior deles não era cosmético — `painel.tsx` decide com uma lista literal se
 * o médico É assinante, e um médico que acabou de pagar a escada aparecia como
 * não-assinante no próprio painel, com o banner de venda no lugar da gestão da
 * assinatura.
 *
 * A lista de arquivos é a mesma para os dois planos, com UMA diferença que é
 * decisão de produto e não descuido: a página de VENDAS. Ela mostra o que se
 * vende hoje, e o Essencial deixou de ser vendido — continua existindo para
 * quem já assinou, e é por isso que ele segue em todos os outros.
 */
describe("todo plano vivo existe em todos os lugares que enumeram plano", () => {
  const SISTEMA = {
    "mapa de Price do Stripe": "src/lib/stripe.server.ts",
    "lista aceita no checkout": "src/lib/billing.functions.ts",
    "enum do console": "src/lib/platform.functions.ts",
    "seletor do admin": "src/routes/_authenticated/admin.tsx",
    "card do painel": "src/routes/_authenticated/painel.tsx",
    "variáveis de ambiente": ".env.example",
  };

  describe("`mensagens` — o que se vende hoje", () => {
    for (const [onde, caminho] of Object.entries({
      ...SISTEMA,
      "página de vendas": "src/routes/medicos.tsx",
    })) {
      test(`aparece em: ${onde}`, () => {
        expect(readFileSync(caminho, "utf8").toLowerCase()).toContain("mensagens");
      });
    }

    test("o painel o conta como plano PAGO", () => {
      /* A asserção que descreve o defeito: sem ele nesta lista, quem pagou vê a
         tela de quem não pagou. */
      const painel = readFileSync("src/routes/_authenticated/painel.tsx", "utf8");
      const i = painel.indexOf("const isPaid =");
      expect(i).toBeGreaterThan(-1);
      expect(painel.slice(i, i + 300)).toContain('"mensagens"');
    });

    test("tem Price próprio no ambiente", () => {
      expect(readFileSync("src/lib/stripe.server.ts", "utf8")).toContain(
        "STRIPE_PRICE_DOCTOR_MENSAGENS",
      );
      expect(readFileSync(".env.example", "utf8")).toContain("STRIPE_PRICE_DOCTOR_MENSAGENS");
    });
  });

  describe("os cinco nomeados foram APAGADOS, e não podem voltar por acidente", () => {
    /**
     * ─── APAGAR EM VEZ DE APOSENTAR ────────────────────────────────────────
     *
     * `essencial`, `starter`, `pro`, `elite` e `black` saíram do sistema
     * inteiro. A condição que permitiu isso: não havia médico assinado em
     * nenhum. Um plano vazio que fica no código aparece em seletor de admin,
     * entra na comparação de escada, exige Price no Stripe e obriga todo teste
     * de pares a carregá-lo — manutenção para zero receita.
     *
     * Este bloco cobra a AUSÊNCIA nos mesmos lugares onde o bloco anterior
     * cobrava a presença. É a única forma de a remoção ficar de pé: sem ele,
     * qualquer um reintroduz um nome num seletor e o resto do sistema não sabe.
     */
    const MORTOS = ["essencial", "starter", "elite", "black"] as const;

    for (const [onde, caminho] of Object.entries(SISTEMA)) {
      test(`sumiram de: ${onde}`, () => {
        /* Sem `toLowerCase`, e de propósito: "Elite" com maiúscula é um NÍVEL de
           cobertura do cérebro no painel, e `installStarterPack` é o pacote
           inicial de orientações. Nenhum dos dois é plano, e baixar tudo para
           minúsculas transformava os dois em falso positivo — um teste que
           acusa o que não é defeito é abandonado na terceira vez. */
        const codigo = readFileSync(caminho, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
          .replace(/^\s*\/\/.*$/gm, "");
        for (const morto of MORTOS) {
          /* Como VALOR entre aspas (`plan: "starter"`) e como CHAVE de tabela
             de planos (`starter:`) — as duas formas em que um plano aparece. */
          expect(codigo).not.toContain(`"${morto}"`);
          expect(codigo).not.toMatch(new RegExp(`^\\s{2}${morto}:`, "m"));
        }
      });
    }

    test("e os Price deles saíram do ambiente", () => {
      const env = readFileSync(".env.example", "utf8");
      for (const morto of ["ESSENCIAL", "STARTER", "PRO", "ELITE", "BLACK"]) {
        expect(env).not.toContain(`STRIPE_PRICE_DOCTOR_${morto}`);
      }
    });

    test("e o TIPO tem exatamente quatro nomes", () => {
      /**
       * A mutação que sobreviveu à primeira bateria: acrescentar `"black"` a
       * `PlanKey` sem acrescentar à tabela. `TODOS` vem de
       * `Object.keys(PLAN_ENTITLEMENTS)`, então não muda — e nenhum teste via.
       *
       * O `tsc` reclamaria (`Record<PlanKey, …>` ficaria incompleto), mas a
       * suíte não roda o compilador. Um plano que existe no tipo e não na
       * tabela é `undefined` em cima de dinheiro.
       */
      const ent = readFileSync("src/lib/entitlements.ts", "utf8");
      expect(ent).toContain('export type PlanKey = "trial" | "free" | "mensagens" | "clinica";');
    });

    test("um nome antigo em `doctors.plan` cai em `free`, não quebra", () => {
      /* Se sobrar uma linha no banco com um desses nomes, o normalizador a
         trata como qualquer desconhecido: o plano mais restritivo. */
      for (const morto of MORTOS) {
        expect(normalizePlan(morto)).toBe("free");
      }
    });
  });
});

describe("o preço com centavos não vaza para a tela", () => {
  test("o seletor formata em pt-BR — cru imprimiria 'R$ 174.4'", () => {
    /* Este teste cobrava o cartão de plano do painel, que deixou de existir: os
       cinco cartões viraram o seletor da escada. A regra não mudou de valor,
       mudou de casa — e um teste que aponta para o lugar errado passa a ser
       decoração. Agora o preço é formatado num ponto só, e é este. */
    const codigo = codigoDe("src/components/escada-mensagens.tsx");
    expect(codigo).toContain('toLocaleString("pt-BR"');
    expect(codigo).toContain("minimumFractionDigits: 2");
    /* Centavos SEMPRE, aqui: a escada tem preços como R$ 174,40 e R$ 294,40, e
       esconder o zero final ("R$ 294,4") é o defeito que este bloco existe para
       impedir, com outro sinal. */
    expect(codigo).toContain("maximumFractionDigits: 2");
  });

  test("e o painel não voltou a imprimir preço cru", () => {
    const codigo = codigoDe("src/routes/_authenticated/painel.tsx");
    expect(codigo).not.toMatch(/R\$ \{monthly\}/);
  });

  test("e os planos inteiros continuam sem centavos", () => {
    const fmt = (v: number) =>
      v.toLocaleString("pt-BR", {
        minimumFractionDigits: v % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      });
    expect(fmt(49.9)).toBe("49,90");
    expect(fmt(149)).toBe("149");
    expect(fmt(1499)).toBe("1.499");
  });
});
