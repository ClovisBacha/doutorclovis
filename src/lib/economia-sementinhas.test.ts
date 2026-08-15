/**
 * A ECONOMIA QUE FAZ A PACIENTE ASSINAR.
 *
 * As Sementinhas deixaram de ser um substituto do Premium e viraram um gerador
 * de demanda por ele: poucos itens grátis e baratos, de modo que em ~15 dias ela
 * já comprou todos — e a partir daí acumula moeda sem ter no que gastar,
 * olhando 57 itens bloqueados que ela JÁ pode pagar.
 *
 * O que este arquivo guarda é o CALIBRE. Um item grátis a mais, ou um preço
 * dobrado, e a parede se afasta semanas — sem nenhum erro visível, porque todos
 * os números continuam plausíveis. Foi exatamente assim que a loja chegou a
 * **241 dias** para zerar, que é o estado que este desenho veio corrigir.
 */

import { describe, expect, test } from "bun:test";
import { CANTINHO_ITEMS } from "./cantinho";
import { SEMENTINHAS } from "./sementinhas.functions";
import {
  BONUS_VINCULO_MEDICO,
  CLASSES_DE_PRESENTE,
  CURVA_GRATIS,
  CUSTO_LOJA_GRATIS,
  GANHO_DIA_MINIMO,
  GANHO_DIA_TETO,
  GANHO_DIA_TIPICO,
  GANHO_SEMANAL,
  ITENS_GRATIS,
  PRESENTE_ENTRE_AMIGAS,
  PRESENTE_SUGERIDO,
  SEMENTINHAS_POR_MENSAGEM,
  TETO_BLOCO_DE_BOAS_VINDAS,
  diasParaZerarLoja,
  entradaDeGraca,
  mesadaDoMedico,
  saldoParado,
} from "./economia-sementinhas";

describe("1. o alvo do dono: 15 dias — contra o ganho REAL", () => {
  /**
   * ─── O ERRO QUE ESTE BLOCO CORRIGE ────────────────────────────────────────
   *
   * A primeira versão afirmava `toBe(15)` e passava — contra um modelo de ganho
   * que enxergava SÓ o check-in (5 🌱/dia). Existem quatro ganhos diários no
   * app; três estavam fora da conta. O teto real é ~68 🌱/dia, quase cinco vezes
   * o modelado, e a loja de 330 🌱 que "dava 15 dias" sumia em SEIS.
   *
   * O teste passava porque o arquivo concordava consigo mesmo. É o mesmo defeito
   * que este projeto já viu no `triagem-clinica.test.ts`: derivar a expectativa
   * da mesma expressão que a implementação usa.
   *
   * Agora a projeção recebe o ganho como PARÂMETRO e os três perfis são
   * cobrados separadamente.
   */
  const COM_MEDICO = { comMedico: true, presenteDoMedico: PRESENTE_SUGERIDO };

  test("a paciente TÍPICA zera a loja perto do 15º dia", () => {
    const dias = diasParaZerarLoja({ ...COM_MEDICO, ganhoDiario: GANHO_DIA_TIPICO });
    expect(dias).toBeGreaterThanOrEqual(13);
    expect(dias).toBeLessThanOrEqual(18);
  });

  test("a mais ENGAJADA não zera antes de uma semana", () => {
    /* O limite que impede a loja de sumir no primeiro fim de semana. Quem faz
       tudo todo dia ganha ~68 🌱; se ela zerar em três dias, a curva de
       recompensa acaba antes de virar hábito. */
    expect(
      diasParaZerarLoja({ ...COM_MEDICO, ganhoDiario: GANHO_DIA_TETO }),
    ).toBeGreaterThanOrEqual(7);
  });

  test("e para quem só faz check-in a loja não vira inalcançável", () => {
    /* O outro limite. Calibrar para o teto empurraria a loja para meses de
       quem entra pouco — e aí ela nunca compra nada, nunca sente o laço, e sai. */
    expect(diasParaZerarLoja({ ...COM_MEDICO, ganhoDiario: GANHO_DIA_MINIMO })).toBeLessThanOrEqual(
      90,
    );
  });

  test("o médico ACELERA — sempre, em qualquer perfil", () => {
    for (const g of [GANHO_DIA_MINIMO, GANHO_DIA_TIPICO, GANHO_DIA_TETO]) {
      const com = diasParaZerarLoja({ ...COM_MEDICO, ganhoDiario: g });
      const sem = diasParaZerarLoja({ comMedico: false, ganhoDiario: g });
      expect(com).toBeLessThan(sem);
    }
  });

  test("o modelo conhece os QUATRO ganhos diários, não só o check-in", () => {
    /* A asserção que descreve o defeito. `SEMENTINHAS.dailyCheckin` é 5; se o
       típico voltar a ser 5, o modelo voltou a enxergar só o check-in. */
    expect(GANHO_DIA_TIPICO).toBeGreaterThan(SEMENTINHAS.dailyCheckin * 3);
    expect(GANHO_DIA_TETO).toBeGreaterThan(GANHO_DIA_TIPICO);
  });
});

describe("2. A PAREDE — moeda parada sem ter o que comprar", () => {
  /**
   * O mecanismo inteiro. Se o saldo parado nunca sobe, o desenho não faz nada:
   * ela compra devagar para sempre e nunca sente falta de nada.
   */
  test("por volta do 15º dia a parede chega — nem antes, nem muito depois", () => {
    /* O dia exato se move quando a curva é recalibrada, e prender a um valor
       só faria o teste reprovar por ajuste em vez de por defeito. O que importa
       é a JANELA: antes do 10º dia a loja acabou cedo demais (a recompensa some
       antes de virar hábito); depois do 25º a moeda nunca acumula e a parede
       nunca chega. */
    expect(saldoParado(10, { comMedico: true, presenteDoMedico: PRESENTE_SUGERIDO })).toBe(0);
    expect(
      saldoParado(25, { comMedico: true, presenteDoMedico: PRESENTE_SUGERIDO }),
    ).toBeGreaterThan(0);
  });

  test("no dia 30 já há moeda parada", () => {
    expect(
      saldoParado(30, { comMedico: true, presenteDoMedico: PRESENTE_SUGERIDO }),
    ).toBeGreaterThan(0);
  });

  test("e no dia 45 ela já pode pagar um item premium inteiro", () => {
    /* É esta a hora de converter: ela tem no bolso o preço de um item que só a
       assinatura destrava. */
    const premium = CANTINHO_ITEMS.filter((i) => i.premium).map((i) => i.price);
    const maisBarato = Math.min(...premium);
    expect(
      saldoParado(45, { comMedico: true, presenteDoMedico: PRESENTE_SUGERIDO }),
    ).toBeGreaterThan(maisBarato);
  });

  test("o saldo parado só cresce — nunca volta a zero", () => {
    let anterior = -1;
    for (const dia of [20, 30, 45, 60, 90]) {
      const s = saldoParado(dia, { comMedico: true, presenteDoMedico: PRESENTE_SUGERIDO });
      expect(s).toBeGreaterThanOrEqual(anterior);
      anterior = s;
    }
  });
});

describe("3. a curva tem forma de jogo, não de planilha", () => {
  test("são 15 itens", () => {
    expect(ITENS_GRATIS).toBe(15);
    expect(CURVA_GRATIS).toHaveLength(15);
  });

  test("os primeiros são comprados no MESMO dia em que ela ganha", () => {
    /* O laço "ganhei → gastei → mudou a minha tela" precisa fechar várias vezes
       na primeira semana. O critério é relativo ao GANHO, não a um número fixo:
       um item de 20 🌱 era vitória imediata no modelo antigo (5 🌱/dia) e virou
       troco no real (35 🌱/dia). */
    expect(CURVA_GRATIS[0]).toBeLessThanOrEqual(GANHO_DIA_TIPICO / 2);
    expect(CURVA_GRATIS[3]).toBeLessThanOrEqual(GANHO_DIA_TIPICO);
  });

  test("e UM troféu, que é o último e custa vários dias", () => {
    const trofeu = CURVA_GRATIS[14];
    expect(trofeu).toBeGreaterThan(CURVA_GRATIS[13] * 2);
    /* Pelo menos três dias de ganho típico só nele — é o que faz ser troféu. */
    expect(trofeu).toBeGreaterThan(GANHO_DIA_TIPICO * 3);
  });

  test("o troféu custa o MEIO da faixa premium — é âncora de preço", () => {
    /* O detalhe que faz a loja premium fazer sentido depois. Ela paga 200 num
       item grátis, aprende no corpo quanto vale 200, e quando vê os premium o
       número já significa alguma coisa.

       A asserção é sobre a FAIXA (entre a mediana e o Q3), não sobre a mediana
       exata — e a diferença tem história. A primeira versão exigia a mediana
       exata e reprovou: mover 27 itens baratos de grátis para premium puxou a
       mediana de 200 para 160, e uma afirmação que era verdadeira virou falsa
       sem nenhum número mudar de lugar. Prender ao valor exato ataria a curva a
       um número que se move sozinho toda vez que a loja for reorganizada. */
    const premium = CANTINHO_ITEMS.filter((i) => i.premium)
      .map((i) => i.price)
      .sort((a, b) => a - b);
    const mediana = premium[Math.floor(premium.length * 0.5)];
    const q3 = premium[Math.floor(premium.length * 0.75)];
    expect(CURVA_GRATIS[14]).toBeGreaterThanOrEqual(mediana);
    expect(CURVA_GRATIS[14]).toBeLessThanOrEqual(q3);
  });

  test("a curva nunca desce", () => {
    for (let i = 1; i < CURVA_GRATIS.length; i++) {
      expect(CURVA_GRATIS[i]).toBeGreaterThanOrEqual(CURVA_GRATIS[i - 1]);
    }
  });
});

describe("4. a LOJA obedece à curva — a conta e o produto não podem divergir", () => {
  /**
   * `economia-sementinhas.ts` é a conta; `cantinho.ts` é a loja de verdade. Se
   * os dois discordarem, todos os testes acima passam e a paciente vê outra
   * coisa. É a mesma armadilha que pegou o backfill, o bloco do cérebro e o
   * corte da memória: provar a função e nunca o chamador.
   */
  const compraveis = CANTINHO_ITEMS.filter((i) => !i.premium && i.price > 0);

  test("são 15 itens grátis compráveis", () => {
    expect(compraveis).toHaveLength(ITENS_GRATIS);
  });

  test("e eles somam exatamente o que a curva diz", () => {
    expect(compraveis.reduce((s, i) => s + i.price, 0)).toBe(CUSTO_LOJA_GRATIS);
  });

  test("os preços da loja SÃO a curva", () => {
    const daLoja = compraveis.map((i) => i.price).sort((a, b) => a - b);
    expect(daLoja).toEqual([...CURVA_GRATIS].sort((a, b) => a - b));
  });

  test("os itens de preço zero continuam grátis — são padrão, não compra", () => {
    /* O fundo padrão e a Coroa da Coleção. Cobrar por eles seria cobrar por
       algo que ela já tem, e a Coroa é recompensa de coleção. */
    const zerados = CANTINHO_ITEMS.filter((i) => i.price === 0);
    expect(zerados.length).toBeGreaterThan(0);
    for (const i of zerados) expect(i.premium).toBe(false);
  });

  test("e a loja premium ficou grande — é ela que gera o desejo", () => {
    expect(CANTINHO_ITEMS.filter((i) => i.premium).length).toBeGreaterThan(50);
  });

  test("os grátis têm VARIEDADE de categoria — a loja precisa parecer viva", () => {
    /* Quinze itens da mesma categoria dariam a mesma soma e uma primeira
       impressão muito pior. */
    const tipos = new Set(compraveis.map((i) => i.type));
    expect(tipos.size).toBeGreaterThanOrEqual(6);
  });
});

describe("5. a mesada do médico", () => {
  test("é mensagens × 3", () => {
    expect(SEMENTINHAS_POR_MENSAGEM).toBe(3);
    expect(mesadaDoMedico(150)).toBe(450);
    expect(mesadaDoMedico(2_500)).toBe(7_500);
  });

  test("dá para presentear TODAS as pacientes dele, todo mês", () => {
    /* A razão se calibra sozinha: uma paciente ativa consome ~15 mensagens por
       mês, então × 3 dá ~45 🌱 por paciente. Ele nunca é obrigado a escolher
       entre pacientes — e escolher entre pacientes é o tipo de decisão que ele
       não deve ter de tomar. */
    for (const msgs of [150, 600, 1_000, 2_500]) {
      const pacientes = msgs / 15;
      const presentes = mesadaDoMedico(msgs) / PRESENTE_SUGERIDO;
      expect(presentes).toBeGreaterThanOrEqual(pacientes * 0.8);
    }
  });

  test("plano maior, mesada maior — sempre", () => {
    let anterior = -1;
    for (const m of [150, 300, 600, 1_000, 1_500, 2_000, 2_500]) {
      const mesada = mesadaDoMedico(m);
      expect(mesada).toBeGreaterThan(anterior);
      anterior = mesada;
    }
  });

  test("sem plano, sem mesada — e nunca negativa", () => {
    expect(mesadaDoMedico(0)).toBe(0);
    expect(mesadaDoMedico(-500)).toBe(0);
  });

  test("o bônus de vínculo vale VÁRIOS DIAS, não um punhado de moedas", () => {
    /* Ele existe para a paciente SENTIR que vincular o médico valeu a pena.
       Um bônus que vale meio dia de jogo não muda comportamento nenhum. */
    const dias = BONUS_VINCULO_MEDICO / GANHO_DIA_TIPICO;
    expect(dias).toBeGreaterThanOrEqual(2);
  });

  test("mas ele NÃO paga metade da loja sozinho", () => {
    /* Era 200 de 704 (28%) e, somado aos presentes, entregava 85% da loja no
       dia zero — ver `TETO_BLOCO_DE_BOAS_VINDAS`. */
    expect(BONUS_VINCULO_MEDICO).toBeLessThan(CUSTO_LOJA_GRATIS / 4);
  });

  test("e ele encurta a corrida sem encurtá-la demais", () => {
    const sozinha = diasParaZerarLoja({ comMedico: false });
    const comEle = diasParaZerarLoja({ comMedico: true });
    expect(comEle).toBeLessThan(sozinha);
    /* Pelo menos dois dias de diferença, senão não é sentido; e no máximo um
       terço da caminhada, senão o vínculo vira o atalho. */
    expect(sozinha - comEle).toBeGreaterThanOrEqual(2);
    expect(sozinha - comEle).toBeLessThanOrEqual(Math.ceil(sozinha / 3));
  });
});

describe("o BLOCO do dia 0 conta as três fontes — e nenhuma pode sumir", () => {
  /**
   * ─── A MUTAÇÃO QUE SOBREVIVEU ─────────────────────────────────────────────
   *
   * Tirar o presente do médico de `entradaDeGraca` passou verde: a caminhada
   * ficou MAIOR, e todos os testes que cobram "pelo menos doze dias" ficaram
   * mais folgados. Um modelo que subestima o ganho não dispara alarme nenhum —
   * ele só faz a economia parecer mais segura do que é, que é exatamente como
   * os 600 🌱 do dia zero entraram sem ninguém perceber.
   *
   * A régua tem de ser sobre o MODELO, não só sobre o resultado dele.
   */
  test("cada fonte entra, e some quando não existe", () => {
    const nada = entradaDeGraca({ comMedico: false });
    expect(nada).toBe(0);

    const soVinculo = entradaDeGraca({ comMedico: true });
    expect(soVinculo).toBe(BONUS_VINCULO_MEDICO);

    const comPresente = entradaDeGraca({ comMedico: true, presenteDoMedico: 100 });
    expect(comPresente).toBe(BONUS_VINCULO_MEDICO + 100);

    const tudo = entradaDeGraca({ comMedico: true, presenteDoMedico: 100, presenteDeAmiga: 40 });
    expect(tudo).toBe(BONUS_VINCULO_MEDICO + 100 + 40);
  });

  test("o presente do médico só conta se ela TEM médico", () => {
    /* Sem vínculo não há quem presenteie. */
    expect(entradaDeGraca({ comMedico: false, presenteDoMedico: 100 })).toBe(0);
  });

  test("mas o da amiga conta mesmo sem médico — são caminhos independentes", () => {
    expect(entradaDeGraca({ comMedico: false, presenteDeAmiga: 40 })).toBe(40);
  });

  test("e o bloco máximo cabe no teto, com folga de no máximo dez", () => {
    /* Folga grande demais significa que os valores poderiam ser mais
       generosos; folga zero significa que o próximo ajuste estoura. */
    const maior = Math.max(...CLASSES_DE_PRESENTE.map((c) => c.quantidade));
    const bloco = BONUS_VINCULO_MEDICO + maior + PRESENTE_ENTRE_AMIGAS;
    expect(bloco).toBeLessThanOrEqual(TETO_BLOCO_DE_BOAS_VINDAS);
    expect(TETO_BLOCO_DE_BOAS_VINDAS - bloco).toBeLessThanOrEqual(10);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   ⚠️ O TETO DO CATÁLOGO — A CONTA QUE O PACOTE MAIOR NÃO PODE VENCER

   Pedido do dono, ago/2026: "a pessoa comprando dez mil sementinhas ela não
   conseguiria comprar tudo no jogo... senão ia perder a graça".

   O maior pacote entrega 15.000 🌱 (10.000 + 5.000 de bônus). Antes desta
   calibragem o catálogo custava 14.894 — ou seja, UMA compra de R$ 99,90
   entregava 101% de tudo. Ela abriria o app, compraria uma vez, e não sobraria
   mais nada para querer.

   O reajuste dobrou o preço dos itens ASPIRACIONAIS (peles da trilha,
   especiais com halo, cenários, "no ar"), e não o da loja inteira: a curva
   grátis continua somando exatamente 704 🌱, então a parede do 15º dia não se
   moveu um dia. O que mudou é o que existe DEPOIS dela.

   A régua que sai disso, e que este teste protege:

     · uma compra do maior pacote ....... ~metade do catálogo
     · nove meses jogando perfeito ...... ~metade do catálogo
     · os dois juntos ................... o catálogo inteiro

   Nenhum caminho sozinho fecha a coleção. É a mesma forma que o Fortnite usa
   (lá "tudo" custa 178× o maior pacote); aqui, num app que dura nove meses e
   não anos, a proporção é de ~2×.
   ═══════════════════════════════════════════════════════════════════════════ */
describe("⚠️ nem comprar nem jogar, sozinhos, fecham o catálogo", () => {
  const vendaveis = CANTINHO_ITEMS.filter(
    (i) => !i.aposentado && i.price > 0 && i.id !== "especial-colecao",
  );
  const catalogo = vendaveis.reduce((s, i) => s + i.price, 0);

  /** O maior pacote da loja: 10.000 + 5.000 de bônus. */
  const MAIOR_PACOTE = 15_000;
  /** Gestação inteira no ritmo típico, com todas as conquistas e conjuntos. */
  const ORGANICO_DA_GESTACAO = 294 * GANHO_DIA_TIPICO + 42 * GANHO_SEMANAL + 1_750 + 636 + 200;

  test("uma compra do maior pacote fica entre 40% e 60% do catálogo", () => {
    const fatia = MAIOR_PACOTE / catalogo;
    expect(fatia).toBeGreaterThan(0.4);
    expect(fatia).toBeLessThan(0.6);
  });

  test("⚠️ e NÃO chega perto de comprar tudo — era 101% antes do reajuste", () => {
    expect(MAIOR_PACOTE).toBeLessThan(catalogo * 0.75);
  });

  test("jogar a gestação inteira, perfeito, também não fecha sozinho", () => {
    /* Se fechasse, quem joga não teria motivo para comprar; e se ficasse longe
       demais, a coleção viraria enfeite inalcançável para quem não paga. */
    const fatia = ORGANICO_DA_GESTACAO / catalogo;
    expect(fatia).toBeGreaterThan(0.35);
    expect(fatia).toBeLessThan(0.6);
  });

  test("os dois caminhos juntos fecham — é esse o desenho", () => {
    /* ⚠️ 95%, e não igualdade exata. Hoje a conta dá 99,8% (28.926 de 28.979),
       e é tentador travar o fecho no número — mas isso seria cobrar uma
       COINCIDÊNCIA: o primeiro item novo do catálogo derrubaria o teste sem
       nada de errado ter acontecido. O que precisa continuar verdadeiro é a
       forma: jogar a gestação inteira MAIS uma compra do maior pacote põe a
       coleção ao alcance. */
    const juntos = (ORGANICO_DA_GESTACAO + MAIOR_PACOTE) / catalogo;
    expect(juntos).toBeGreaterThan(0.95);
  });

  test("⚠️ a parede dos 15 dias NÃO se moveu: a loja grátis continua em 704", () => {
    /* O reajuste é sobre o que existe DEPOIS da parede. Mexer aqui mudaria a
       mecânica de conversão, que é outra decisão e não esta. */
    const gratis = CANTINHO_ITEMS.filter((i) => !i.premium && i.price > 0);
    expect(gratis.reduce((s, i) => s + i.price, 0)).toBe(CUSTO_LOJA_GRATIS);
    expect(CUSTO_LOJA_GRATIS).toBe(704);
  });
});
