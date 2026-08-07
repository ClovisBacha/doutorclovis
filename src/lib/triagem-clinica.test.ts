/**
 * A RÉGUA QUE MANDA A GESTANTE AO PRONTO-SOCORRO.
 *
 * `assessLevel` decide entre "vá agora" (vermelho), "fale com o consultório
 * hoje" (amarelo) e "siga o pré-natal" (verde). É a decisão mais consequente
 * que este produto toma sozinho, às três da manhã, sem médico na frente.
 *
 * ─── ELA NÃO TINHA UM TESTE ─────────────────────────────────────────────────
 *
 * Uma varredura mediu: apagar o ramo `hasRed` deixava a suíte inteira verde —
 * sangramento, convulsão e bolsa rota passariam a devolver "amarelo", e a
 * paciente leria "entre em contato com o consultório ainda hoje" no lugar de
 * "ligue 192 agora".
 *
 * A função é PURA. Não havia nada a mockar, nem desculpa.
 *
 * ─── A REGRA QUE ELA IMPLEMENTA ─────────────────────────────────────────────
 *
 * Vermelho GANHA de tudo. Um sintoma vermelho e dez amarelos continuam sendo
 * vermelho — e é assim que tem de ser: a triagem erra para o lado de mandar
 * avaliar. O contrário (diluir o grave no meio dos leves) é o erro que mata.
 */

import { describe, expect, test } from "bun:test";
import { ALL_SYMPTOMS, LEVEL_FALLBACK, assessLevel } from "./triage";

const VERMELHOS = ALL_SYMPTOMS.filter((s) => s.severity === "vermelho").map((s) => s.id);
const AMARELOS = ALL_SYMPTOMS.filter((s) => s.severity === "amarelo").map((s) => s.id);

describe("cada sinal vermelho, sozinho, manda procurar atendimento", () => {
  /* Um a um, e não "os vermelhos em geral": se alguém marcar um deles como
     amarelo por engano numa edição futura, o teste diz QUAL. */
  for (const id of VERMELHOS) {
    test(`"${id}" sozinho → vermelho`, () => {
      expect(assessLevel([id]).level).toBe("vermelho");
    });
  }

  test("são dez — nenhum sumiu da lista", () => {
    /* A lista é a régua. Perder um item dela é perder a proteção inteira
       daquele sintoma, sem nenhum teste falhar. */
    expect(VERMELHOS).toHaveLength(10);
    expect(VERMELHOS).toContain("sangramento");
    expect(VERMELHOS).toContain("convulsao");
    expect(VERMELHOS).toContain("movimentos");
  });
});

describe("cada sinal amarelo, sozinho, pede contato — não urgência", () => {
  for (const id of AMARELOS) {
    test(`"${id}" sozinho → amarelo`, () => {
      expect(assessLevel([id]).level).toBe("amarelo");
    });
  }

  test("são seis", () => {
    expect(AMARELOS).toHaveLength(6);
  });
});

describe("o vermelho vence o amarelo, sempre", () => {
  test("um vermelho no meio de todos os amarelos continua vermelho", () => {
    /* O erro que mata é diluir o grave no meio dos leves. */
    expect(assessLevel([...AMARELOS, "sangramento"]).level).toBe("vermelho");
  });

  test("a ordem em que ela marca não muda nada", () => {
    expect(assessLevel(["sangramento", "vomito"]).level).toBe("vermelho");
    expect(assessLevel(["vomito", "sangramento"]).level).toBe("vermelho");
  });
});

describe("nada marcado é verde — e verde não é silêncio", () => {
  test("lista vazia → verde", () => {
    expect(assessLevel([]).level).toBe("verde");
  });

  test("id desconhecido não inventa gravidade", () => {
    /* Um id que não existe na régua (versão antiga da tela, payload forjado)
       não pode virar vermelho nem amarelo por acidente. */
    expect(assessLevel(["id_que_nao_existe"]).level).toBe("verde");
  });

  test("o verde ainda diz o que fazer", () => {
    expect(LEVEL_FALLBACK.verde).toContain("pré-natal");
  });
});

describe("a pressão arterial entra na conta", () => {
  test("160/— sozinha é vermelho, sem sintoma nenhum marcado", () => {
    /* Crise hipertensiva não precisa de sintoma marcado: o número basta. */
    expect(assessLevel([], { systolic: 160, diastolic: 80 }).level).toBe("vermelho");
  });

  test("—/110 sozinha é vermelho", () => {
    expect(assessLevel([], { systolic: 120, diastolic: 110 }).level).toBe("vermelho");
  });

  test("140/90 é amarelo, não vermelho", () => {
    /* A faixa do meio existe: hipertensão gestacional pede avaliação hoje, não
       corrida ao pronto-socorro. Tratar tudo como vermelho ensinaria a
       paciente a ignorar o vermelho. */
    expect(assessLevel([], { systolic: 140, diastolic: 90 }).level).toBe("amarelo");
  });

  test("139/89 não dispara nada", () => {
    expect(assessLevel([], { systolic: 139, diastolic: 89 }).level).toBe("verde");
  });

  test("o corte é >=, não >", () => {
    /* Um fora-por-um aqui deixa 160/110 exato passar como amarelo. */
    expect(assessLevel([], { systolic: 160 }).level).toBe("vermelho");
    expect(assessLevel([], { diastolic: 110 }).level).toBe("vermelho");
  });

  test("pressão ausente ou nula não conta como zero", () => {
    /* `0 >= 140` é falso, mas `null` mal tratado viraria número em alguma
       comparação — e uma paciente sem pressão medida ficaria com o nível
       decidido por um dado que não existe. */
    expect(assessLevel(["vomito"], { systolic: null, diastolic: null }).level).toBe("amarelo");
    expect(assessLevel(["vomito"], {}).level).toBe("amarelo");
  });
});

describe("os motivos acompanham o nível", () => {
  test("cada sintoma marcado aparece por extenso", () => {
    /* O médico lê os motivos no painel; um nível sem motivo é um alarme que
       ele não consegue avaliar. */
    const { reasons } = assessLevel(["sangramento", "vomito"]);
    expect(reasons).toContain("Sangramento vaginal");
    expect(reasons).toContain("Vômitos persistentes");
  });

  test("a pressão elevada vira motivo escrito", () => {
    expect(assessLevel([], { systolic: 170 }).reasons).toContain("Pressão arterial muito elevada");
    expect(assessLevel([], { systolic: 145 }).reasons).toContain("Pressão arterial elevada");
  });

  test("as duas faixas de pressão não somam motivos", () => {
    /* `else if`: 170 é "muito elevada" e só. Dois motivos sobre a mesma
       aferição fariam o médico achar que houve duas medidas. */
    const r = assessLevel([], { systolic: 170 }).reasons;
    expect(r.filter((x) => x.startsWith("Pressão"))).toHaveLength(1);
  });
});

describe("o texto de cada nível diz o que fazer", () => {
  test("vermelho manda ligar 192 e não esperar", () => {
    expect(LEVEL_FALLBACK.vermelho).toContain("192");
    expect(LEVEL_FALLBACK.vermelho.toLowerCase()).toContain("não espere");
  });

  test("amarelo manda falar com o consultório hoje", () => {
    expect(LEVEL_FALLBACK.amarelo.toLowerCase()).toContain("ainda hoje");
  });
});
