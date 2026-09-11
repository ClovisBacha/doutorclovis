import { describe, expect, test } from "bun:test";
import { custoDaFoto, custoDaMensagem, margemMensal, MODELO_PADRAO } from "@/lib/custo-da-nutricao";
import { LIMITE_DIARIO } from "@/lib/nutricao-premium";
import { precoDe } from "@/lib/custo-da-plataforma";
import { ANUAL_MENSAL_EQUIV_CENTAVOS, MENSAL_CENTAVOS } from "@/lib/promo";

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

  /* Os dois preços que a paciente de fato paga hoje: R$ 19,90 no mensal e
     ~R$ 9,16 no anual (R$ 109,90 cobrados de uma vez). Derivados de `promo.ts`
     de propósito — o dia em que o dono reajustar, esta conta reajusta junto. */
  const PRECOS_REAIS = [MENSAL_CENTAVOS / 100, ANUAL_MENSAL_EQUIV_CENTAVOS / 100];

  test("sem teto, o uso pesado leva a margem a NEGATIVO", () => {
    /* Era exatamente o receio do dono, e ele estava certo: a R$ 19,90 com a
       taxa cheia da loja, trinta perguntas por dia custam mais do que a
       assinatura inteira. */
    const semTeto = margemMensal({ precoMensal: 19.9, taxaDaLoja: 0.3, porDia: 30 });
    expect(semTeto.sobra).toBeLessThan(0);
  });

  test("com o teto, o pior caso continua positivo NOS PREÇOS QUE ELA PAGA", () => {
    /* ⚠️ OS PREÇOS SAEM DE `promo.ts`, e nunca de um número escrito aqui.
       Decisão do dono (set/2026): "de primeiro momento vamos continuar
       cobrando os preços que temos e deixar o limite de mensagens no pior
       caso". Uma cópia do preço neste arquivo divergiria no primeiro reajuste,
       e a divergência apareceria como um teste VERDE afirmando uma margem que
       o produto não tem — que é a pior mentira que um teste de margem pode
       contar. É a mesma lei do `loja-coerente.test.ts`: preço não se escreve
       em prosa. */
    for (const precoMensal of PRECOS_REAIS) {
      for (const taxaDaLoja of [0.15, 0.3]) {
        const m = margemMensal({ precoMensal, taxaDaLoja, porDia: LIMITE_DIARIO });
        expect(m.sobra).toBeGreaterThan(0);
      }
    }
  });

  test("⚠️ quem dimensiona o teto é o ANUAL, e não o mensal", () => {
    /* O anual é cobrado de uma vez e sai por ~R$ 9,16/mês — menos da METADE do
       mensal. Dimensionar o teto pelo mensal seria dimensioná-lo pelo caso
       FÁCIL: a assinante anual que usa as dez perguntas todo dia é o pior
       caso que o produto de fato tem, e é ele que o número precisa aguentar.

       Medido a R$ 9,16 com a taxa cheia da loja: a IA come ~83% do líquido e
       sobra ~R$ 1,07. É apertado, e é POSITIVO — que é exatamente o que o teto
       compra. Sem teto, a mesma assinante a 30 perguntas por dia leva a conta
       a R$ −13. */
    const anual = margemMensal({
      precoMensal: ANUAL_MENSAL_EQUIV_CENTAVOS / 100,
      taxaDaLoja: 0.3,
      porDia: LIMITE_DIARIO,
    });
    expect(anual.sobra).toBeGreaterThan(0);

    const mensal = margemMensal({
      precoMensal: MENSAL_CENTAVOS / 100,
      taxaDaLoja: 0.3,
      porDia: LIMITE_DIARIO,
    });
    expect(anual.fracaoDeIA).toBeGreaterThan(mensal.fracaoDeIA);
  });

  test("no MENSAL a IA cabe na fatia que o plano do médico já aceita", () => {
    /* `docs/custo-de-infraestrutura.md`: "a infraestrutura é 2,4% da receita.
       A IA é 30%". No mensal o pior caso do teto fica em 38% — perto dessa
       régua, e é a única das duas assinaturas que chega perto dela.

       ⚠️ ESTE TESTE JÁ MEDIU O PREÇO ERRADO. Ele nasceu cravando R$ 24,90, que
       era a minha RECOMENDAÇÃO — e o dono a recusou ("vamos continuar cobrando
       os preços que temos"). Um teste verde sobre um preço que o produto não
       tem é a pior mentira que um arquivo de margem pode contar: ele afirma
       uma folga que ninguém tem. Hoje o preço vem de `promo.ts`. */
    const mensal = margemMensal({
      precoMensal: MENSAL_CENTAVOS / 100,
      taxaDaLoja: 0.3,
      porDia: LIMITE_DIARIO,
    });
    expect(mensal.fracaoDeIA).toBeLessThan(0.4);
  });

  test("⚠️ o teto deixa o ANUAL com margem de verdade, e não um resto de conta", () => {
    /* A trava que faz o número 10 ser o número 10.

       "Sobra positiva" sozinha é fraca demais aqui: a R$ 9,16 o anual ainda é
       positivo a 12 por dia — por UM CENTAVO. Um centavo não é margem, é ruído
       de arredondamento, e um teto justificado por ele estaria justificado por
       nada.

       O piso é DERIVADO, e não escolhido: a sobra tem de ser maior que a
       própria conta de infraestrutura da paciente. Abaixo disso a assinatura
       não paga nem a linha que a hospeda. Medido a 10/dia: sobra R$ 1,07
       contra R$ 0,024 de infra — passa com folga; a 12/dia sobram R$ 0,01 e
       este teste fica VERMELHO, que é onde o teto tem de parar. */
    const anual = margemMensal({
      precoMensal: ANUAL_MENSAL_EQUIV_CENTAVOS / 100,
      taxaDaLoja: 0.3,
      porDia: LIMITE_DIARIO,
    });
    expect(anual.sobra).toBeGreaterThan(anual.custoDeInfra);
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
