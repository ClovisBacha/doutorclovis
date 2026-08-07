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
     * R$ 295,40 (2.500). `PLAN_PRICE.mensagens` guarda só a entrada.
     *
     * A faixa dele atravessa quase toda a escada nomeada: começa abaixo do
     * Essencial (R$ 49,90) e termina praticamente no Pro (R$ 297). Qualquer
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
    expect(mensalidadeCentavos("mensagens", 2_500)).toBe(29_540);
    expect(mensalidadeCentavos("mensagens", 2_500)).toBeGreaterThan(PLAN_PRICE.mensagens * 100);
  });

  test("e ele fica acima dos nomeados que aposentou — só não acima dos contratos", () => {
    /* Ele é o único plano que ainda se vende: rankear todo médico novo abaixo
       dos legados esvaziaria a busca de quem está entrando. Black e Clínica
       ficam acima porque são contratos ativos de valor maior, e rebaixá-los
       seria punir quem paga mais por uma mudança de tabela que não foi escolha
       dele. */
    for (const legado of ["essencial", "starter", "pro", "elite"] as const) {
      expect(PLAN_RANK.mensagens).toBeGreaterThan(PLAN_RANK[legado]);
    }
    expect(PLAN_RANK.mensagens).toBeLessThan(PLAN_RANK.black);
    expect(PLAN_RANK.mensagens).toBeLessThan(PLAN_RANK.clinica);
  });
});

describe("o Essencial é o primeiro degrau pago", () => {
  const e = PLAN_ENTITLEMENTS.essencial;

  test("custa um terço do Starter — perto demais não abriria segmento", () => {
    /* A R$102 (31% abaixo do Starter) a conta por paciente favorecia tanto o
       Starter que ninguém compraria o Essencial. R$102 virou âncora riscada. */
    expect(PLAN_PRICE.essencial).toBe(49.9);
    expect(PLAN_PRICE.essencial).toBeLessThan(PLAN_PRICE.starter / 2.5);
    expect(mensalidadeCentavos("essencial")).toBe(4990);
  });

  test("INCLUI o Segundo Cérebro — é o motivo de comprar", () => {
    /* Era o pedido explícito, e é o que separa o Essencial do Free: um plano de
       entrada sem IA seria o Free com mais pacientes. */
    expect(e.aiApp).toBe(true);
    expect(PLAN_ENTITLEMENTS.free.aiApp).toBe(false);
  });

  test("cabe ENTRE o Free e o Starter em pacientes", () => {
    expect(e.maxPatients).toBeGreaterThan(PLAN_ENTITLEMENTS.free.maxPatients!);
    expect(e.maxPatients).toBeLessThan(PLAN_ENTITLEMENTS.starter.maxPatients!);
  });

  test("o Starter continua tendo duas razões de existir", () => {
    /* Mais pacientes E as ferramentas clínicas avançadas. Sem a segunda, a
       única diferença seria o número — e aí o Essencial canibaliza. */
    expect(e.clinicalToolsAdvanced).toBe(false);
    expect(PLAN_ENTITLEMENTS.starter.clinicalToolsAdvanced).toBe(true);
  });

  test("não invade o que é do Pro para cima", () => {
    expect(e.aiWhatsapp).toBe(false);
    expect(e.teamSeats).toBe(false);
    expect(e.premiumInvitesPerMonth).toBe(0);
    expect(e.dedicatedManager).toBe(false);
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

  describe("`essencial` — aposentado da venda, vivo para quem assinou", () => {
    for (const [onde, caminho] of Object.entries(SISTEMA)) {
      test(`aparece em: ${onde}`, () => {
        expect(readFileSync(caminho, "utf8").toLowerCase()).toContain("essencial");
      });
    }

    test("tem os dois Price — mensal e anual", () => {
      const fonte = readFileSync("src/lib/stripe.server.ts", "utf8");
      expect(fonte).toContain("STRIPE_PRICE_DOCTOR_ESSENCIAL_MONTHLY");
      expect(fonte).toContain("STRIPE_PRICE_DOCTOR_ESSENCIAL_ANNUAL");
    });

    test("e SAIU da página de vendas — a escada nova a substituiu", () => {
      /* Deixar os dois na tela venderia dois modelos de cobrança ao mesmo
         tempo, e o médico escolheria pelo número menor sem saber o que muda. */
      const vendas = readFileSync("src/routes/medicos.tsx", "utf8").toLowerCase();
      for (const aposentado of ["essencial", "starter", "reconhecido"]) {
        expect(vendas).not.toContain(aposentado);
      }
    });
  });
});

describe("o preço com centavos não vaza para a tela", () => {
  test("o card formata em pt-BR — `R$ {monthly}` cru imprimiria 'R$ 49.9'", () => {
    const codigo = codigoDe("src/routes/_authenticated/painel.tsx");
    expect(codigo).toContain('monthly.toLocaleString("pt-BR"');
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
