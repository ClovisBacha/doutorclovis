/**
 * O CUPOM DO MÉDICO — a prova de que ele SAIU, e por onde não pode voltar.
 *
 * ─── A HISTÓRIA, EM DUAS VIRADAS ────────────────────────────────────────────
 *
 * Este arquivo nasceu para guardar o caminho do dinheiro. O médico dava Premium
 * DE GRAÇA a algumas pacientes por mês; isso virou 20% de desconto nos dois
 * planos, e uma bateria de mutação tinha mostrado que os três pontos de decisão
 * do dinheiro não tinham uma linha de teste — desligar o cupom no checkout,
 * voltar a dar Premium no resgate e restringir o cupom ao anual passavam os
 * 1.285 testes verdes.
 *
 * Agora veio a segunda virada, e ela é maior: **o médico não dá mais desconto
 * nenhum — dá SEMENTINHAS.** Decisão do dono, agosto de 2026.
 *
 * ─── POR QUE O ARQUIVO NÃO FOI APAGADO ──────────────────────────────────────
 *
 * Porque remover código não é o mesmo que remover um recurso. Se este arquivo
 * sumir, some junto a única coisa no repositório que diz que aquilo acabou — e
 * a promessa volta pela porta dos fundos no dia em que alguém achar
 * `mensalComCupom` num componente antigo e "consertar" reintroduzindo a
 * constante.
 *
 * Um teste que cobra AUSÊNCIA é o que faz uma remoção ficar de pé. Cada bloco
 * abaixo trava uma das portas por onde o cupom entrava.
 *
 * ─── AS TRÊS RAZÕES DA APOSENTADORIA ────────────────────────────────────────
 *
 *  1. Desconto sai do BOLSO da plataforma — é a mesma assinatura, por menos.
 *     Sementinha custa zero: compra conteúdo estático que já está no app.
 *  2. Cupom de Stripe não funciona dentro do iOS nem do Android, e é ali que a
 *     paciente compra. O cupom prometia na tela o que a loja não podia dar.
 *  3. E desconto ADIA a assinatura; Sementinha ACELERA — ela zera a loja grátis
 *     mais rápido e passa a olhar os 57 itens que só o Premium abre.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PRECOS_PREMIUM } from "./promo";
import { BONUS_VINCULO_MEDICO } from "./economia-sementinhas";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const billing = semComentarios("src/lib/billing.functions.ts");
const invites = semComentarios("src/lib/invites.functions.ts");
const promoFns = semComentarios("src/lib/promo.functions.ts");
const promo = semComentarios("src/lib/promo.ts");
const oferta = semComentarios("src/components/oferta-premium.tsx");
const trilha = semComentarios("src/components/gestacao-path.tsx");
const preview = semComentarios("src/routes/preview-oferta.tsx");

describe("1. o resgate do código NÃO dá Premium de graça", () => {
  /**
   * Esta trava é a mais antiga e continua valendo: era o desenho original, e é
   * a que custa a assinatura inteira se voltar.
   */
  test("o caminho do convite do médico não escreve `quiz_premium`", () => {
    const i = invites.indexOf("export const redeemInviteCode");
    expect(i).toBeGreaterThan(-1);
    const corpo = invites.slice(i);
    const marca = corpo.indexOf("row.doctor_id");
    expect(marca).toBeGreaterThan(-1);
    expect(corpo.slice(marca, marca + 1500)).not.toContain("quiz_premium: true");
  });

  test("mas o cupom de PLATAFORMA continua concedendo — é outra coisa", () => {
    /* Esse é NOSSO, não do médico: campanha da plataforma, e não um desconto
       que um assinante distribui. Some junto seria remover demais. */
    expect(invites).toContain("platform_coupons");
  });
});

describe("2. as constantes do cupom não existem mais", () => {
  test("`promo.ts` não exporta nada de cupom", () => {
    for (const morta of [
      "CUPOM_MEDICO_PCT",
      "CUPOM_MEDICO_ID",
      "DESCONTO_ANUAL_COM_CUPOM_PCT",
      "comDesconto",
    ]) {
      expect(promo).not.toContain(morta);
    }
  });

  test("e sobraram DOIS preços, não quatro", () => {
    expect(Object.keys(PRECOS_PREMIUM).sort()).toEqual(["anual", "mensal"]);
  });
});

describe("3. o CHECKOUT não aplica cupom de médico", () => {
  /**
   * Era aqui que os 20% entravam. A mutação que este bloco impede é a mais
   * barata de todas: alguém reintroduz seis linhas e a plataforma passa a dar
   * desconto que ninguém decidiu.
   */
  test("nenhuma leitura de cupom da paciente no checkout", () => {
    expect(billing).not.toContain("temCupom");
    expect(billing).not.toContain("CUPOM_MEDICO_ID");
  });

  test("mas o convite-de-paciente do MÉDICO continua — é outro produto", () => {
    /* Este é o desconto que o MÉDICO ganha por ter sido convidado por uma
       paciente, no plano DELE, comprado no site. Nunca foi o cupom dela. */
    expect(billing).toContain("convite-paciente-15");
    expect(billing).toContain("invited_by_patient");
  });
});

describe("4. o SERVIDOR de preços devolve um preço só", () => {
  test("`lerPrecos` não consulta mais `invite_codes`", () => {
    /* Duas consultas por abertura da tela de oferta, para decidir um desconto
       que não existe mais. */
    expect(promoFns).not.toContain("invite_codes");
    expect(promoFns).not.toContain("redeemed_by");
  });

  test("e não devolve `temCupom` nem `medicoDoCupom`", () => {
    expect(promoFns).not.toContain("temCupom");
    expect(promoFns).not.toContain("medicoDoCupom");
  });

  test("nem preços FINAIS separados dos cheios", () => {
    /* `mensalFinalCentavos`/`anualFinalCentavos` existiam para o caso de haver
       desconto. Sem cupom, "final" e "cheio" são a mesma coisa — e manter dois
       nomes para o mesmo número é como duas telas passam a discordar. */
    expect(promoFns).not.toContain("FinalCentavos");
  });
});

describe("5. e nenhuma TELA promete desconto do médico", () => {
  /**
   * O código do servidor pode estar limpo e a tela continuar prometendo: foi
   * assim que a página `/medicos` ficou dizendo "sem cota, sem bloqueio"
   * enquanto a cota era o produto.
   */
  for (const [onde, fonte] of [
    ["a folha de oferta", oferta],
    ["o cartaz da trilha", trilha],
    ["a tela de prova do dono", preview],
  ] as const) {
    test(`${onde} não fala em cupom`, () => {
      for (const morta of ["temCupom", "cupomPct", "medicoDoCupom", "ComCupom"]) {
        expect(fonte).not.toContain(morta);
      }
    });
  }

  test("a tela de prova não simula mais um estado que não existe", () => {
    /* Ela tinha um interruptor "com/sem cupom". Mostrar ao dono uma variante
       que a paciente nunca vai ver é a pior coisa que uma tela de prova faz. */
    expect(preview).not.toContain("comPromo");
  });
});

describe("5b. o CÓDIGO do médico anuncia o que realmente entrega", () => {
  /**
   * ─── A PROMESSA QUE SOBREVIVEU A DUAS MUDANÇAS DE PRODUTO ─────────────────
   *
   * O toast dizia **"Premium liberado pelo seu médico! 💛"** — em duas telas.
   *
   * O resgate parou de escrever `quiz_premium` quando o médico deixou de dar a
   * assinatura; depois parou de dar desconto também. A frase ficou nas duas
   * viradas. A paciente resgatava o código, lia "Premium liberado", e ia
   * procurar um Premium que não tinha sido liberado.
   *
   * É o mesmo defeito da `/medicos` dizendo "sem cota, sem bloqueio": a tela
   * guarda a versão do produto que existia quando a frase foi escrita.
   */
  const telas = [
    ["a trilha", trilha],
    ["a jornada do bebê", semComentarios("src/components/baby-journey.tsx")],
  ] as const;

  for (const [onde, fonte] of telas) {
    test(`${onde} não promete mais Premium pelo código`, () => {
      expect(fonte).not.toContain("Premium liberado pelo seu médico");
    });

    test(`${onde} anuncia as Sementinhas, e o número vem da fonte única`, () => {
      /* Escrever "200" à mão aqui seria a mesma divergência dos preços: mudar
         o bônus e a tela continuar prometendo o valor velho. */
      expect(fonte).toContain("BONUS_VINCULO_MEDICO");
    });
  }
});

describe("6. o que OCUPA o lugar do cupom existe de verdade", () => {
  /**
   * Uma remoção sem substituto é uma regressão. O que o médico dá agora é
   * Sementinha, e a paciente ganha um bônus por vinculá-lo — as duas coisas
   * precisam estar ligadas, não só escritas.
   */
  test("o bônus por vincular o médico existe e é generoso", () => {
    expect(BONUS_VINCULO_MEDICO).toBeGreaterThan(0);
  });

  test("a mesada tem tela no painel do médico", () => {
    const painel = semComentarios("src/routes/_authenticated/painel.tsx");
    expect(painel).toContain("<MesadaDoMedico");
  });

  test("e o cartão de convites premium não voltou", () => {
    const painel = semComentarios("src/routes/_authenticated/painel.tsx");
    expect(painel).not.toContain("<DoctorInviteCard");
  });
});
