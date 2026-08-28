/**
 * O CUSTO REAL — e as três formas de ele mentir.
 *
 * Um painel financeiro erra em UMA direção que importa: para menos. Um custo
 * subestimado faz a plataforma parecer lucrativa quando não está, e todas as
 * decisões a jusante (preço, plano, se a IA vale a pena) saem erradas juntas.
 * Os testes abaixo existem para essa direção.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  CONFERIDO_EM,
  DOLAR_EM_REAIS,
  PRECO_POR_MODELO,
  custoEmCentavos,
  emReais,
  precoDe,
  projetarMes,
  resumirCusto,
} from "./custo-da-plataforma";

describe("o preço de um modelo", () => {
  test("casa por PREFIXO, porque o modelo ganha sufixo de data", () => {
    /* `CHAT_MODEL` é variável de ambiente. Casar exato faria uma troca trivial
       (`gemini-2.5-flash-001`) transformar toda linha em "desconhecido". */
    expect(precoDe("gemini-2.5-flash-001")).toEqual(PRECO_POR_MODELO["gemini-2.5-flash"]);
    expect(precoDe("GEMINI-2.5-FLASH")).toEqual(PRECO_POR_MODELO["gemini-2.5-flash"]);
  });

  test("⚠️ o prefixo mais LONGO ganha — senão o Pro seria cobrado como Flash", () => {
    /* `gemini-2.5-flash` também começa com... nada em comum com `gemini-flash`,
       mas `gemini-flash-latest` começa com `gemini-flash`. O risco real é a
       ordem de iteração do objeto decidir o preço, e um modelo caro entrar na
       conta pelo preço do barato. */
    expect(precoDe("gemini-2.5-pro")).toEqual(PRECO_POR_MODELO["gemini-2.5-pro"]);
    expect(precoDe("gemini-2.5-pro")!.saida).toBeGreaterThan(
      PRECO_POR_MODELO["gemini-2.5-flash"].saida,
    );
  });

  test("⚠️ modelo desconhecido devolve null, NUNCA zero", () => {
    /* Zero seria "essa chamada foi de graça" — a mentira que subestima. */
    expect(precoDe("modelo-que-ninguem-cadastrou")).toBeNull();
    expect(precoDe(null)).toBeNull();
    expect(precoDe("")).toBeNull();
    expect(
      custoEmCentavos({ modelo: "vixe", input_tokens: 999999, output_tokens: 999999 }),
    ).toBeNull();
  });
});

describe("a conta de uma chamada", () => {
  test("entrada e saída têm preços DIFERENTES, e a conta usa os dois", () => {
    /* No Flash a saída custa mais de oito vezes a entrada. Somar tudo com um
       preço só erraria por um fator grande na direção errada, porque respostas
       longas são justamente as caras. */
    const p = PRECO_POR_MODELO["gemini-2.5-flash"];
    const so_entrada = custoEmCentavos({
      modelo: "gemini-2.5-flash",
      input_tokens: 1_000_000,
      output_tokens: 0,
    })!;
    const so_saida = custoEmCentavos({
      modelo: "gemini-2.5-flash",
      input_tokens: 0,
      output_tokens: 1_000_000,
    })!;
    expect(so_entrada).toBeCloseTo(p.entrada * DOLAR_EM_REAIS * 100, 4);
    expect(so_saida).toBeCloseTo(p.saida * DOLAR_EM_REAIS * 100, 4);
    expect(so_saida).toBeGreaterThan(so_entrada * 5);
  });

  test("⚠️ NÃO arredonda por chamada — uma conversa custa frações de centavo", () => {
    /* Arredondar aqui zeraria quase toda linha, e o total do mês viraria zero
       num app com milhares de chamadas baratas. O arredondamento é só na
       exibição. */
    const c = custoEmCentavos({
      modelo: "gemini-2.5-flash",
      input_tokens: 4000,
      output_tokens: 300,
    })!;
    /* Uma conversa típica (4 mil de contexto, 300 de resposta) dá ~1,07
       centavo. O que importa não é o VALOR — é ele não ter sido arredondado:
       com `Math.round` por chamada, milhares de chamadas de meio centavo
       somariam zero. */
    expect(c).toBeGreaterThan(0);
    expect(Number.isInteger(c)).toBe(false);
    expect(
      custoEmCentavos({ modelo: "gemini-2.5-flash", input_tokens: 40, output_tokens: 3 })!,
    ).toBeGreaterThan(0);
  });

  test("token negativo ou nulo não vira crédito", () => {
    expect(
      custoEmCentavos({ modelo: "gemini-2.5-flash", input_tokens: -500, output_tokens: null }),
    ).toBe(0);
  });
});

describe("o resumo de um período", () => {
  const linhas = [
    {
      modelo: "gemini-2.5-flash",
      input_tokens: 4000,
      output_tokens: 400,
      canal: "app",
      especie: "chat",
    },
    {
      modelo: "gemini-2.5-flash",
      input_tokens: 2000,
      output_tokens: 200,
      canal: "app",
      especie: "chat",
    },
    {
      modelo: "gemini-2.5-pro",
      input_tokens: 8000,
      output_tokens: 900,
      canal: "app",
      especie: "memoria",
    },
    {
      modelo: "coisa-nova-sem-preco",
      input_tokens: 5000,
      output_tokens: 5000,
      canal: "diario",
      especie: "chat",
    },
  ];

  test("⚠️ o que não soube precificar é CONTADO à parte, com o nome do modelo", () => {
    /* Um total que ignora silenciosamente uma fatia das chamadas é pior que
       nenhum total: ele PARECE completo. A tela precisa poder dizer quantas
       ficaram de fora e qual modelo cadastrar. */
    const r = resumirCusto(linhas);
    expect(r.semPreco).toBe(1);
    expect(r.modelosSemPreco).toEqual(["coisa-nova-sem-preco"]);
  });

  test("⚠️ a linha sem preço ENTRA na contagem de chamadas", () => {
    /* Se ela sumisse dos recortes, um canal inteiro sem preço ficaria
       invisível — e ninguém descobriria que existe. */
    const r = resumirCusto(linhas);
    expect(r.chamadas).toBe(4);
    const diario = r.porCanal.find((c) => c.chave === "diario");
    expect(diario?.chamadas).toBe(1);
    expect(diario?.centavos).toBe(0);
  });

  test("o total é a soma do que TEM preço, e os tokens contam todos", () => {
    const r = resumirCusto(linhas);
    const esperado = linhas.map((l) => custoEmCentavos(l) ?? 0).reduce((a, b) => a + b, 0);
    expect(r.centavos).toBeCloseTo(esperado, 6);
    expect(r.tokensEntrada).toBe(4000 + 2000 + 8000 + 5000);
    expect(r.tokensSaida).toBe(400 + 200 + 900 + 5000);
  });

  test("os recortes vêm ordenados pelo mais caro", () => {
    const r = resumirCusto(linhas);
    for (const lista of [r.porCanal, r.porEspecie, r.porModelo]) {
      for (let i = 1; i < lista.length; i++) {
        expect(lista[i - 1].centavos).toBeGreaterThanOrEqual(lista[i].centavos);
      }
    }
  });

  test("lista vazia devolve zero, e não NaN", () => {
    const r = resumirCusto([]);
    expect(r.centavos).toBe(0);
    expect(r.chamadas).toBe(0);
    expect(r.porCanal).toEqual([]);
  });
});

describe("a projeção do mês", () => {
  test("⚠️ NÃO projeta no primeiro dia", () => {
    /* Regra de três sobre algumas horas multiplicadas por trinta abriria o mês
       anunciando um custo dez vezes maior — o tipo de número que faz alguém
       mexer no preço no susto. */
    expect(projetarMes(1000, 1, 31)).toBeNull();
  });

  test("projeta linearmente a partir do segundo dia", () => {
    expect(projetarMes(1000, 10, 30)).toBeCloseTo(3000, 6);
  });

  test("dia fora do mês devolve null", () => {
    expect(projetarMes(1000, 45, 31)).toBeNull();
    expect(projetarMes(-5, 10, 30)).toBeNull();
  });
});

describe("a tabela de preço não pode envelhecer em silêncio", () => {
  test("⚠️ existe uma data de conferência, e ela é MOSTRADA", () => {
    /* Sem a data, alguém lê "custo de agosto" seis meses depois com preço de
       agosto e conclui que a margem melhorou. */
    expect(CONFERIDO_EM).toMatch(/^\d{4}-\d{2}$/);
    const painel = readFileSync("src/lib/custo.functions.ts", "utf8");
    expect(painel).toContain("CONFERIDO_EM");
  });

  test("toda entrada da tabela tem os dois preços, e nenhum é negativo", () => {
    for (const [nome, p] of Object.entries(PRECO_POR_MODELO)) {
      /* ⚠️ Sem o segundo argumento: `expect(valor, "recado")` não é tipado no
         `bun:test` e o `tsc` da CI reprova — minha própria catraca
         (`matchers-do-bun.test.ts`) pegou isto aqui. O nome entra na mensagem
         pelo `nomes` abaixo. */
      expect(typeof p.entrada).toBe("number");
      expect(p.entrada).toBeGreaterThanOrEqual(0);
      expect(p.saida).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("a exibição", () => {
  test("arredonda só na tela, e em real", () => {
    expect(emReais(1234)).toContain("12,34");
    expect(emReais(0.4)).toContain("0,00");
  });
});
