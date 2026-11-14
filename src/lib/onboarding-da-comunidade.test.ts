/**
 * O primeiro minuto na Comunidade.
 *
 * A aba cresceu muito e não tinha uma linha explicando as duas coisas que uma
 * paciente precisa saber ANTES de publicar: que o perfil já nasce fechado, e
 * que conduta clínica não se pede nem se dá aqui.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  CARTOES_DA_COMUNIDADE,
  CHAVE_ONBOARDING_COMUNIDADE,
  chaveDoPassoDaComunidade,
  deveVerOnboarding,
  lerPassoDaComunidade,
  passoSeguinte,
  passoValido,
} from "./onboarding-da-comunidade";

const semProsa = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const COMP = semProsa(readFileSync("src/components/onboarding-da-comunidade.tsx", "utf8"));
const ABA = semProsa(readFileSync("src/components/rede-instagram.tsx", "utf8"));

describe("os cartões", () => {
  test("são quatro, e nenhum id se repete", () => {
    expect(CARTOES_DA_COMUNIDADE.length).toBe(5);
    expect(new Set(CARTOES_DA_COMUNIDADE.map((c) => c.id)).size).toBe(5);
  });

  test("⚠️ um deles diz o LIMITE CLÍNICO — é a razão da tela existir", () => {
    /**
     * As outras três se descobrem tocando; esta não. A paciente que descobre
     * tarde já escreveu a pergunta que não devia, ou já leu a resposta de uma
     * leiga como se fosse orientação.
     */
    const todos = CARTOES_DA_COMUNIDADE.map((c) => `${c.titulo} ${c.texto}`).join(" ");
    expect(todos.toLowerCase()).toContain("obstetra");
    expect(todos.toLowerCase()).toContain("sos");
  });

  test("⚠️ e outro diz que o perfil nasce FECHADO", () => {
    const todos = CARTOES_DA_COMUNIDADE.map((c) => `${c.titulo} ${c.texto}`).join(" ");
    expect(todos.toLowerCase()).toMatch(/fechad|ningu[ée]m v[êe]/);
  });

  test("⚠️ nenhum cartão COBRA publicação", () => {
    /**
     * "Comece publicando" numa gestante de alto risco que abriu a aba para ler
     * é a mesma cobrança que as frases do mascote têm regex proibindo. Ler o
     * tempo que ela quiser é um uso legítimo da aba.
     */
    const todos = CARTOES_DA_COMUNIDADE.map((c) => `${c.titulo} ${c.texto}`).join(" ");
    expect(todos.toLowerCase()).not.toMatch(
      /voc[êe] precisa|n[ãa]o deixe de|publique (agora|j[áa])|comece publicando/,
    );
  });

  test("⚠️ nenhum cartão promete resposta de outra paciente", () => {
    const todos = CARTOES_DA_COMUNIDADE.map((c) => `${c.titulo} ${c.texto}`).join(" ");
    expect(todos.toLowerCase()).not.toMatch(/algu[ée]m (vai )?te responde|tire suas d[úu]vidas/);
  });

  test("todo cartão tem título e texto — nenhum vazio", () => {
    for (const c of CARTOES_DA_COMUNIDADE) {
      expect(c.titulo.trim().length).toBeGreaterThan(4);
      expect(c.texto.trim().length).toBeGreaterThan(20);
      expect(c.emoji.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("quando abrir", () => {
  test("⚠️ NUNCA em Modo Cuidado", () => {
    expect(deveVerOnboarding({ jaViu: false, careMode: true })).toBe(false);
  });

  test('⚠️ e "não sei" também NÃO abre', () => {
    /**
     * Enquanto o perfil não chegou, abrir e descobrir o luto meio segundo
     * depois mostraria os quatro cartões para exatamente quem eles não podem
     * alcançar. Falha fechada, como o resto da aba.
     */
    expect(deveVerOnboarding({ jaViu: false, careMode: undefined })).toBe(false);
  });

  test("quem já viu não vê de novo", () => {
    expect(deveVerOnboarding({ jaViu: true, careMode: false })).toBe(false);
  });

  test("paciente nova, fora do luto: abre", () => {
    expect(deveVerOnboarding({ jaViu: false, careMode: false })).toBe(true);
  });
});

describe("o passo", () => {
  test("anda até o fim e então acaba", () => {
    expect(passoSeguinte(0)).toBe(1);
    expect(passoSeguinte(CARTOES_DA_COMUNIDADE.length - 1)).toBeNull();
  });

  test("⚠️ ele SOBREVIVE à troca de aba — a barra continua clicável", () => {
    /**
     * O véu para em `z-38` e a barra de baixo fica acesa de propósito. Tocar num
     * item troca a aba e DESMONTA este componente; com o índice num `useState`
     * lá dentro, voltar à Comunidade recomeçava do primeiro cartão. É o defeito
     * que o dono viu no tutorial do mascote, chegando por outro caminho.
     */
    expect(COMP).toContain("setPasso(lerPassoDaComunidade(uid))");
    expect(COMP).toMatch(/localStorage\.setItem\(chaveDoPassoDaComunidade\(euId\)/);
    expect(COMP).toContain("irPara(proximo)");
  });

  test("⚠️ a chave do passo NÃO é `dc-path-` — ela não sobe para a nuvem", () => {
    /**
     * O "já vi" precisa viajar entre aparelhos; o passo, não — ele é transitório
     * e morre em minutos. Subir um índice de tutorial no `journey_state` seria
     * empurrar lixo para a nuvem a cada toque em "Continuar".
     */
    expect(chaveDoPassoDaComunidade("u1").startsWith("dc-path-")).toBe(false);
    expect(chaveDoPassoDaComunidade("u1")).not.toBe(chaveDoPassoDaComunidade("u2"));
  });

  test("passo guardado fora da faixa não quebra a tela", () => {
    /**
     * Storage adulterado, ou um cartão removido depois de ela guardar o passo.
     * ⚠️ A régua é `passoValido` e não `lerPassoDaComunidade`: aquela toca
     * `window` e sai por `typeof window === "undefined"` num teste de Node,
     * então a mutação que apagava o `clamp` passava VERDE.
     */
    const ultimo = CARTOES_DA_COMUNIDADE.length - 1;
    expect(passoValido(String(CARTOES_DA_COMUNIDADE.length + 5))).toBe(ultimo);
    expect(passoValido("-3")).toBe(0);
    expect(passoValido("abc")).toBe(0);
    expect(passoValido(null)).toBe(0);
    expect(passoValido("2.9")).toBe(2);
    expect(passoSeguinte(CARTOES_DA_COMUNIDADE.length + 5)).toBeNull();
  });

  test("⚠️ e o passo é APAGADO ao terminar", () => {
    /* Senão a chave fica no aparelho para sempre, apontando para um tutorial
       que nunca mais abre. */
    expect(COMP).toContain("localStorage.removeItem(chaveDoPassoDaComunidade(euId))");
  });
});

describe("⚠️ o armazenamento", () => {
  test('⚠️ a chave tem o prefixo `dc-path-` — é o que faz o "já vi" VIAJAR', () => {
    /**
     * Chaves com esse prefixo sobem no `journey_state`. Com uma chave comum, a
     * paciente que usa celular e computador veria os quatro cartões em cada um
     * — e um tutorial que reaparece ensina que os avisos deste app não valem.
     */
    expect(CHAVE_ONBOARDING_COMUNIDADE.startsWith("dc-path-")).toBe(true);
  });

  test("⚠️ o PULL da nuvem roda ANTES de ler e de gravar", () => {
    /**
     * `lsSet` de uma chave `dc-path-` agenda um push do blob da jornada, e
     * `journey-sync` avisa em prosa que empurrar antes do pull sobrescreve a
     * jornada REAL por um blob incompleto. Esta tela vive numa aba irmã, que
     * pode ser a primeira que a paciente abre no dia.
     */
    const pull = COMP.indexOf("await ensureInitialJourneyPull()");
    const le = COMP.indexOf("lsGet<boolean>(CHAVE_ONBOARDING_COMUNIDADE");
    expect(pull).toBeGreaterThan(0);
    expect(le).toBeGreaterThan(pull);
  });

  test("⚠️ a BANCADA não grava nada", () => {
    /* Gravar "já vi" a partir de uma bancada apagaria o tutorial da conta. */
    expect(COMP).toMatch(/if \(bancada\) return;\s*try \{\s*const \{ lsSet \}/);
  });

  test('⚠️ "Pular" também marca como visto', () => {
    /* Senão ela é interrompida de novo na próxima abertura, tendo dito não. */
    const pular = COMP.indexOf(">\n            Pular");
    const antes = COMP.slice(Math.max(0, pular - 300), pular);
    expect(antes).toContain("encerrar()");
  });
});

describe("⚠️ onde ele aparece", () => {
  test("⚠️ SÓ sobre o feed — nunca sobre o perfil, o direct ou a caixinha", () => {
    /**
     * A garantia: o componente é renderizado DEPOIS de todos os
     * `if (onde.t === …) return`, que são as telas para as quais ela NAVEGOU.
     * Quatro cartões de boas-vindas por cima do direct seriam uma interrupção
     * do que ela foi fazer.
     */
    const overlay = ABA.indexOf("<OnboardingDaComunidade");
    expect(overlay).toBeGreaterThan(0);
    const desvios = [...ABA.matchAll(/if \(onde\.t === "[a-z]+"[^)]*\)\s*\{?\s*\n?\s*return/g)];
    expect(desvios.length).toBeGreaterThan(3);
    for (const d of desvios) expect(d.index!).toBeLessThan(overlay);
  });

  test("⚠️ ESPERA o ritual de boas-vindas — duas telas cheias seriam dois tutoriais", () => {
    /**
     * ⚠️ Era alcançável de verdade: `OnboardingRitual` não tem portão de aba
     * nenhum, então uma paciente recém-criada que tocasse em Comunidade antes de
     * terminá-lo receberia os quatro cartões por baixo dele. É a mesma decisão
     * que `TutorialDaBolha` já toma com `!showOnboarding`.
     */
    /* A garantia é a CONDIÇÃO em volta, nunca a forma exata do JSX: a primeira
       versão desta regex esqueceu o `(` do `&& (` e reprovou código correto. */
    const antes = ABA.slice(
      Math.max(0, ABA.indexOf("<OnboardingDaComunidade") - 120),
      ABA.indexOf("<OnboardingDaComunidade"),
    );
    expect(antes).toContain("!adiarOnboarding");
    const CONTA = semProsa(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));
    expect(CONTA).toContain("adiarOnboarding={showOnboarding}");
  });

  test("o careMode da aba é o que decide", () => {
    expect(ABA).toContain("<OnboardingDaComunidade careMode={careMode}");
  });
});

describe("⚠️ a barra de baixo continua acesa", () => {
  test("o véu para ABAIXO da barra, e o cartão a poupa", () => {
    /**
     * ⚠️ O terceiro cartão diz "use o SOS na barra de baixo". Com um véu por
     * cima de tudo, ele apontava para uma barra apagada e coberta pelo próprio
     * cartão — o tutorial escondendo justamente o que estava explicando.
     *
     * A barra vive em `z-40`. O véu tem de ficar ABAIXO disso, e o cartão tem
     * de reservar a altura dela. É a mesma solução do tutorial do mascote.
     */
    const veu = /z-\[(\d+)\]/.exec(COMP);
    expect(veu).not.toBeNull();
    expect(Number(veu![1])).toBeLessThan(40);
    expect(COMP).toContain("var(--safe-bottom)");
  });

  test("⚠️ e o cartão que cita a barra é o mesmo que o teste do SOS cobra", () => {
    /* Se o texto do SOS mudar de cartão, esta amarração continua valendo. */
    const cita = CARTOES_DA_COMUNIDADE.some((c) => /barra de baixo/i.test(c.texto));
    expect(cita).toBe(true);
  });
});
