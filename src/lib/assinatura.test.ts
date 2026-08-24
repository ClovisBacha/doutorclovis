import { describe, expect, test } from "bun:test";
import { origemDaAssinatura, SELO_PREMIUM, temSeloPremium } from "./assinatura";
import { SELO_OFICIAL } from "./conta-oficial";
import { readFileSync } from "node:fs";

/**
 * O SELO DE ASSINANTE NA COMUNIDADE.
 *
 * Pedido do dono: "o selo que pode se ganhar deve estar atrelado a pessoa
 * pagando o premium".
 */
describe("o selo de assinante", () => {
  const ativa = { status: "active", ateQuando: null, origem: "loja" };

  test("assinatura corrente da loja tem selo", () => {
    expect(temSeloPremium(ativa)).toBe(true);
  });

  /* ⚠️ Quem está no teste já deu o cartão e vai ser cobrada. Tirar o selo por
     sete dias e devolver depois seria o app piscando um símbolo social na cara
     dela. */
  test("⚠️ `trialing` tem selo", () => {
    expect(temSeloPremium({ ...ativa, status: "trialing" })).toBe(true);
  });

  /**
   * ⚠️ AQUI O SELO DIFERE DO ACESSO, DE PROPÓSITO.
   *
   * `AssinaturaTab` já ensina que "tem acesso" ≠ "está pagando": quem cancelou
   * continua com tudo que pagou até o fim do período. O selo é sobre a segunda
   * coisa — ela mantém o acesso e perde a marca de assinante ativa.
   */
  test("⚠️ cancelada NÃO tem selo, mesmo dentro do período pago", () => {
    const daquiUmMes = new Date(Date.now() + 30 * 86400000).toISOString();
    expect(temSeloPremium({ status: "canceled", ateQuando: daquiUmMes, origem: "loja" })).toBe(
      false,
    );
  });

  /**
   * ⚠️ O PRESENTE DO MÉDICO CONTA — a única decisão de produto desta régua.
   *
   * A paciente que ganhou o ano pelo convite do obstetra não paga nada, mas é
   * assinante ativa. Distinguir criaria uma segunda classe DENTRO do Premium,
   * visível para todo mundo, sobre um presente que o médico deu a ela.
   */
  test("⚠️ o presente do médico tem selo", () => {
    expect(temSeloPremium({ ...ativa, origem: "convite" })).toBe(true);
    expect(origemDaAssinatura("convite")).toBe("presente");
  });

  /* ⚠️ Sem linha nenhuma não tem selo — e é o caso da MAIORIA. */
  test("⚠️ sem assinatura, sem selo", () => {
    expect(temSeloPremium(null)).toBe(false);
    expect(temSeloPremium(undefined)).toBe(false);
    expect(temSeloPremium({ status: null, ateQuando: null, origem: null })).toBe(false);
  });

  test("período vencido não tem selo", () => {
    const ontem = new Date(Date.now() - 86400000).toISOString();
    expect(temSeloPremium({ ...ativa, ateQuando: ontem })).toBe(false);
  });

  /* ⚠️ Data ilegível NÃO tira o selo: o estrago de tirar por engano recai sobre
     quem está pagando. Mesma direção de `planoVigente`. */
  test("⚠️ data ilegível não rebaixa ninguém", () => {
    expect(temSeloPremium({ ...ativa, ateQuando: "não é data" })).toBe(true);
  });

  /**
   * ⚠️ E ELE NÃO É O SELO DO CONSULTÓRIO.
   *
   * São duas marcas diferentes e não podem parecer a mesma: a oficial
   * identifica a CLÍNICA. Se os dois textos convergirem, a paciente lê "conta
   * oficial" onde está escrito "assinante".
   */
  test("⚠️ o texto é distinto do selo oficial", () => {
    expect(SELO_PREMIUM.toLocaleLowerCase("pt-BR")).not.toContain("oficial");
    expect(SELO_PREMIUM.toLocaleLowerCase("pt-BR")).not.toContain("consultório");
    expect(SELO_PREMIUM).not.toBe(SELO_OFICIAL);
  });
});

/**
 * ⚠️ A CORRENTE DO SELO — cada elo, e onde ele está.
 *
 * Um selo social num app de gestação de alto risco erra de dois jeitos, e os
 * dois são caros: aparecer para quem não assina (o app afirmando que alguém
 * paga) e ser forjável (qualquer paciente se dando a marca). Este bloco cobra a
 * corrente inteira.
 */
describe("a corrente do selo de assinante", () => {
  const semComentarios = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
  const SERVIDOR = semComentarios(readFileSync("src/lib/rede-social.functions.ts", "utf8"));
  const TELA = semComentarios(readFileSync("src/components/rede-instagram.tsx", "utf8"));

  /**
   * ⚠️ NUNCA UMA COLUNA DE `patient_profiles`.
   *
   * Aquela tabela é escrita direto do navegador em vários pontos do app, e a
   * policy de LINHA não distingue COLUNA. Uma coluna `tem_selo` cairia no mesmo
   * buraco que `conta_oficial` teve: qualquer paciente se daria o selo com um
   * `UPDATE`.
   */
  test("⚠️ o selo é DERIVADO da assinatura, e não uma coluna do perfil", () => {
    expect(SERVIDOR).toContain('.from("subscriptions")');
    expect(SERVIDOR).toContain("temSeloPremium");
    /* Nada de coluna nova no perfil para isto. */
    expect(SERVIDOR).not.toContain("tem_selo:  boolean");
    expect(SERVIDOR).not.toMatch(/patient_profiles[\s\S]{0,200}tem_selo/);
  });

  /* ⚠️ Uma consulta para o LOTE — este helper roda dentro de `perfisPorId`, que
     alimenta feed, perfil, busca, stories, atividade e salvos. Uma consulta por
     autor devolveria a lentidão que a leva anterior acabou de tirar. */
  test("⚠️ resolve em lote, não uma consulta por autor", () => {
    const i = SERVIDOR.indexOf("async function quemTemSelo");
    expect(i).toBeGreaterThan(-1);
    const corpo = SERVIDOR.slice(i, i + 900);
    expect(corpo).toContain('.in("user_id", ids)');
    expect(corpo).not.toMatch(/for\s*\([^)]*\)\s*\{[^}]*await sb/);
  });

  /* ⚠️ E falha devolve NINGUÉM com selo: um selo a menos por uma noite não fere
     ninguém, e um selo a mais é o app afirmando que alguém paga. */
  test("⚠️ falha ao ler devolve conjunto VAZIO", () => {
    const i = SERVIDOR.indexOf("async function quemTemSelo");
    const corpo = SERVIDOR.slice(i, i + 900);
    expect(corpo).toContain("if (error) return com");
  });

  /* A tela desenha os dois selos, e são componentes DIFERENTES. */
  test("⚠️ o selo de assinante é outro desenho, não o oficial recolorido", () => {
    expect(TELA).toContain("function SeloPremium()");
    expect(TELA).toContain("function SeloOficial()");
    expect(TELA).toContain("<SeloPremium />");
  });

  /**
   * ⚠️ E ELE APARECE NAS QUATRO SUPERFÍCIES.
   *
   * Um selo que existe no perfil e não no feed ensina que ele é aleatório — e
   * um selo aleatório é pior que nenhum, porque a paciente que paga não entende
   * por que às vezes ele some.
   */
  test("⚠️ está no feed, no post, na fileira de sugeridas e no perfil", () => {
    /* ⚠️ **CONTAGEM, e não `toContain`.** O selo do autor aparece em DOIS
       lugares (o cartão do feed e a tela do post), com indentações diferentes.
       Com `toContain`, apagar um deles continuava verde porque o outro casava —
       a mutação provou, e é a mesma armadilha que `caixinha.ts` documenta. */
    const doAutor = TELA.split("{post.autorPremium && <SeloPremium />}").length - 1;
    expect(doAutor).toBe(2);
    expect(TELA).toContain("{p.premium && <SeloPremium />}");
    expect(TELA).toContain("{perfil.premium && <SeloPremium />}");
    /* Quatro no total: feed, post, sugeridas e perfil. */
    expect(TELA.split("<SeloPremium />").length - 1).toBe(4);
  });
});

/**
 * ⚠️ A TELA DE ASSINATURA NÃO TINHA COMO ASSINAR.
 *
 * Para quem NUNCA assinou — a maioria das pacientes — a tela mostrava uma
 * frase de prosa e nada mais: o bloco de botões inteiro estava atrás de
 * `temAcesso`, ou seja, só aparecia para quem JÁ pagava. A única tela do app
 * cujo assunto é a assinatura era um beco sem saída exatamente para quem
 * poderia assinar.
 */
describe("quem nunca assinou tem caminho e tem o que ler", () => {
  const TELA = readFileSync("src/components/assinatura-tab.tsx", "utf8");
  const semProsa = TELA.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");

  test("⚠️ existe um caminho para quem não tem acesso", () => {
    expect(semProsa).toContain("{!temAcesso && (");
  });

  /**
   * ⚠️ **UM botão só.** A primeira versão desta correção acrescentou um
   * "Assinar o Premium" ao lado do "Conhecer o Premium" — dois primários
   * empilhados dizendo a mesma coisa, e o de cima MORTO, porque com
   * `IAP_ATIVO = false` não há compra em canal nenhum. É o defeito de duas
   * portas que o presente entre amigas já pagou.
   */
  test("⚠️ um primário só para quem não assina", () => {
    expect(semProsa.split("Conhecer o Premium").length - 1).toBe(1);
    expect(semProsa.split("Assinar o Premium").length - 1).toBe(1);
    /* E os dois são o MESMO botão, escolhido pelo veredito. */
    expect(semProsa).toMatch(
      /vereditoDaAssinatura\.pode \? "Assinar o Premium" : "Conhecer o Premium"/,
    );
  });

  /**
   * ⚠️ **O canal sai de `podeComprarAqui`, nunca de um `if` local.** A paciente
   * assina pela loja da Apple/Google (`CANAL_DE.premium_paciente === "app"`),
   * nunca pelo Stripe. Uma segunda régua aqui diria "abra pela App Store" sobre
   * um app que não está em loja nenhuma — o defeito exato que
   * `canal-de-venda.ts` documenta ter cometido uma vez.
   */
  test("⚠️ o veredito de canal é o da régua única", () => {
    expect(semProsa).toContain('podeComprarAqui("premium_paciente", ehNativo())');
    expect(semProsa).not.toContain("IAP_ATIVO");
  });

  /**
   * ⚠️ **Nenhuma vantagem pode prometer CUIDADO.** Diário, registros, SOS,
   * conversa com o médico e lembretes são do plano gratuito e continuam sendo —
   * é o limite ético do produto. Uma linha que insinuasse acesso clínico
   * transformaria a assinatura em pedágio de saúde.
   */
  test("⚠️ as vantagens não vendem cuidado", () => {
    const bloco = TELA.slice(
      TELA.indexOf("const VANTAGENS_DO_PREMIUM"),
      TELA.indexOf("];", TELA.indexOf("const VANTAGENS_DO_PREMIUM")),
    );
    for (const proibido of ["SOS", "emergência", "diário", "lembrete", "registro", "consulta"]) {
      expect(bloco.toLocaleLowerCase("pt-BR")).not.toContain(proibido.toLocaleLowerCase("pt-BR"));
    }
    /* E a frase do limite ético continua na tela. */
    expect(TELA).toContain("Nada do seu cuidado depende da assinatura");
  });
});
