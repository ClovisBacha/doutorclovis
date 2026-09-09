import { describe, expect, test } from "bun:test";
import { custoDaFoto, custoDaMensagem, margemMensal, MODELO_PADRAO } from "@/lib/custo-da-nutricao";
import { LIMITE_DIARIO } from "@/lib/nutricao-premium";
import { precoDe } from "@/lib/custo-da-plataforma";

describe("o custo sai da MESMA tabela de preço do painel", () => {
  test("o modelo padrão está precificado", () => {
    /* Se ele sumir da tabela, `custoEmCentavos` devolve null e esta conta
       inteira viraria zero em silêncio — que é a direção proibida num número
       de margem. */
    expect(precoDe(MODELO_PADRAO)).not.toBe(null);
  });
});

describe("quanto custa, de fato", () => {
  test("uma pergunta de texto fica entre 1 e 3 centavos", () => {
    /* A faixa é larga de propósito: o que ela trava é a ORDEM DE GRANDEZA. Se
       alguém dobrar o prompt do sistema ou soltar o teto de saída, o número
       sai daqui e o teste conta o que aconteceu. */
    expect(custoDaMensagem(0)).toBeGreaterThan(1);
    expect(custoDaMensagem(19)).toBeLessThan(3);
  });

  test("a conversa fica mais cara a cada volta — é o histórico", () => {
    expect(custoDaMensagem(9)).toBeGreaterThan(custoDaMensagem(0));
  });

  test("⚠️ a FOTO é mais barata que o texto, e isso é contraintuitivo", () => {
    /* Medido, não suposto: o texto carrega 14.600 caracteres de instrução mais
       o histórico; a foto carrega 132 caracteres e nenhum histórico. Foi por
       medir que o teto da foto não foi apertado no lugar errado. */
    expect(custoDaFoto()).toBeLessThan(custoDaMensagem(0));
  });
});

describe("O TETO EXISTE PARA A MARGEM — e é isto que ele compra", () => {
  /* ⚠️ ESTE BLOCO É A JUSTIFICATIVA DO NÚMERO `LIMITE_DIARIO`. Mexer nele sem
     olhar aqui é mudar a margem sem saber. */

  test("sem teto, o uso pesado leva a margem a NEGATIVO", () => {
    /* Era exatamente o receio do dono, e ele estava certo: a R$ 19,90 com a
       taxa cheia da loja, trinta perguntas por dia custam mais do que a
       assinatura inteira. */
    const semTeto = margemMensal({ precoMensal: 19.9, taxaDaLoja: 0.3, porDia: 30 });
    expect(semTeto.sobra).toBeLessThan(0);
  });

  test("com o teto, o PIOR caso continua positivo em todos os preços", () => {
    for (const precoMensal of [14.9, 19.9, 24.9, 29.9]) {
      for (const taxaDaLoja of [0.15, 0.3]) {
        const m = margemMensal({ precoMensal, taxaDaLoja, porDia: LIMITE_DIARIO });
        expect(m.sobra).toBeGreaterThan(0);
      }
    }
  });

  test("no preço recomendado, a IA fica em ~30% da receita — a fatia que o plano do médico já aceita", () => {
    /* `docs/custo-de-infraestrutura.md`: "a infraestrutura é 2,4% da receita.
       A IA é 30%". O preço da paciente é escolhido para cair na MESMA fatia no
       pior caso, senão os dois lados do produto teriam réguas diferentes de
       margem sem ninguém ter decidido isso. */
    const comLojaCheia = margemMensal({
      precoMensal: 24.9,
      taxaDaLoja: 0.3,
      porDia: LIMITE_DIARIO,
    });
    expect(comLojaCheia.fracaoDeIA).toBeLessThan(0.35);

    const comSmallBusiness = margemMensal({
      precoMensal: 19.9,
      taxaDaLoja: 0.15,
      porDia: LIMITE_DIARIO,
    });
    expect(comSmallBusiness.fracaoDeIA).toBeLessThan(0.35);
  });

  test("no uso realista a IA é ruído, e é isso que faz o produto valer a pena", () => {
    /* Duas perguntas por dia é o uso que se espera. O teto não é o negócio: é
       a apólice contra o caso extremo. */
    const real = margemMensal({ precoMensal: 19.9, taxaDaLoja: 0.3, porDia: 2 });
    expect(real.fracaoDeIA).toBeLessThan(0.12);
  });

  test("a infraestrutura da paciente é desprezível ao lado do modelo", () => {
    const m = margemMensal({ precoMensal: 19.9, taxaDaLoja: 0.3, porDia: LIMITE_DIARIO });
    expect(m.custoDeInfra).toBeLessThan(m.custoDeIA / 100);
  });
});
