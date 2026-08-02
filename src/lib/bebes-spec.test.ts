/**
 * A régua de gordura do bebê, travada em teste.
 *
 * Este arquivo existe por causa de um erro meu que só apareceu quando o Clóvis
 * olhou a imagem pronta e perguntou "todos os bebês são assim gordos?".
 *
 * A primeira leva saiu magra demais para o termo. Corrigi trocando por
 * "maximum chubbiness — thick rolls of baby fat, soft double chin" — e corrigi
 * DEMAIS: apliquei isso inclusive na semana 33, que não é termo. O resultado
 * tinha corpo de bebê de uns quatro meses de vida. Errado por vinte semanas.
 *
 * A gordura fetal se acumula quase toda no 3º trimestre, e devagar: ~3% na 28,
 * ~8% na 33, ~12% na 36, ~15% no termo. O bebê rechonchudo com dobras e papada
 * que todo mundo imagina é um bebê de TRÊS A SEIS MESES DE VIDA, que engordou
 * mamando.
 *
 * E não é preciosismo: a paciente olha a imagem por uma semana e depois vê o
 * próprio filho nascer. Se a ilustração prometeu um bebê gordo e nasce um
 * recém-nascido normal, ela pode achar que há algo errado com o dela. Num app
 * de alto risco, plantar essa dúvida é o oposto do que o produto vende.
 *
 * O teste é barato e o erro é caro: reescrever a especificação leva um minuto,
 * gerar 37 imagens erradas leva horas e créditos. Melhor o CI reprovar antes.
 */

import { describe, expect, test } from "bun:test";
import {
  SEMANAS,
  promptDa,
  ANCORAS,
  PRIMEIRA_SEMANA_ENCADEADA,
} from "../../scripts/bebes/especificacao.mjs";

/** Uma semana da especificação, com o tipo que o teste precisa enxergar. */
type Semana = {
  s: number;
  visivel: boolean;
  marco: string;
  marcoEn?: string;
  forma: string;
  pose: string;
};

const semanas = SEMANAS as Semana[];

/**
 * Afirmações de gordura exagerada. `NO double chin` é permitido — é a defesa;
 * o que não pode é AFIRMAR. Por isso a negação sai do texto antes do teste.
 */
const EXAGERO =
  /\b(double chin|thick rolls|deep rolls|maximum chubbiness|very chubby|very plump|rolls of baby fat)\b/i;

/**
 * As negações — a defesa, não a afirmação — saem antes de qualquer teste.
 *
 * A lista anterior cobria só quatro formas e a especificação passou a usar
 * outras ("NO chubbiness", "NO fat rolls"). O teste então reprovava a defesa
 * como se fosse o defeito. Aqui a negação é um PADRÃO — `NO` seguido de
 * qualquer combinação do vocabulário de gordura — em vez de uma lista que
 * precisa ser lembrada toda vez que alguém escolhe outra palavra.
 */
const NEGACAO =
  /\bNOT?\s+((deep|thick|exaggerated|baby|soft|any)\s+)*(fat\s+)?(rolls|chubbiness|chubby|plumpness|plump|double\s+chin)/gi;

function semNegacoes(texto: string): string {
  return texto.replace(NEGACAO, "");
}

describe("nenhuma semana afirma gordura de bebê de 4 meses", () => {
  for (const e of semanas) {
    test(`semana ${e.s}`, () => {
      expect(semNegacoes(e.forma)).not.toMatch(EXAGERO);
    });
  }
});

describe("a gordura CRESCE com a semana, e nunca no 1º trimestre", () => {
  test("nenhuma semana antes da 24 fala em gordura", () => {
    /* Antes da 24 o feto praticamente não tem gordura subcutânea. Um embrião
       de 8 semanas "gordinho" seria ficção, e é o tipo de ficção que a mãe
       compara com o ultrassom que ela acabou de ver. */
    /* O padrão casa o RADICAL. A versão anterior pedia a palavra inteira
       (`\bplump\b`) e por isso deixou passar exatamente o texto que causou o
       defeito: a semana 26 dizia "plumping cheeks" e o teste aprovou. Uma
       imagem mais gorda na 26 que na 28 — a curva andando para trás — nasceu
       de uma letra que faltava no fim de uma expressão regular. */
    const cedoDemais = semanas
      .filter((e) => e.s < 24)
      .filter((e) => /\b(chub\w*|plump\w*|fat|rolls|double\s+chin)\b/i.test(semNegacoes(e.forma)))
      .map((e) => e.s);
    expect(cedoDemais).toEqual([]);
  });

  test("o termo é mais cheio que o começo do 3º trimestre", () => {
    /* Não dá para medir gordura em texto, mas dá para exigir que o termo fale
       de plenitude e que a 28 fale de magreza — a direção da curva. */
    const s28 = semanas.find((e) => e.s === 28)!;
    const s40 = semanas.find((e) => e.s === 40)!;
    expect(s28.forma).toMatch(/slender|slim|still/i);
    expect(s40.forma).toMatch(/rounded|full/i);
  });

  test("o termo se declara REALISTA, não o bebê da imaginação popular", () => {
    for (const w of [37, 40]) {
      const e = semanas.find((x) => x.s === w)!;
      expect(e.forma).toMatch(/real full-term newborn/i);
      expect(e.forma).toMatch(/NOT the plump 4-month-old/i);
    }
  });
});

describe("o bebê está dormindo — menos na semana em que os olhos abrem", () => {
  /**
   * Este bloco existe porque as âncoras 26, 33 e 40 saíram, todas as três, com
   * um bebê ACORDADO encarando quem olha. Vistas lado a lado pareciam a mesma
   * criança em três poses — e o que a série promete é justamente mudar.
   *
   * A causa não foi o modelo desobedecer: foi a especificação não pedir. Só
   * algumas semanas diziam "closed eyes"; treze não diziam nada sobre os olhos,
   * e "curled peacefully" / "deeply serene" não bastaram para fechá-los.
   *
   * A régua de imagem do `conferir.mjs` NÃO pega isto, e não adianta apertá-la:
   * a assinatura de 16x16 em cinza mediu 0,633 e 0,742 entre essas âncoras —
   * longe do limite de 0,97. Ela enxerga silhueta, não pálpebra. Baixar o
   * limite só produziria alarme falso em semanas vizinhas, que DEVEM se
   * parecer. O lugar certo de travar isso é o texto, aqui.
   */
  const DECLARA_FECHADO = /(closed[\w\s,-]{0,20}?eyes|eyes[\w\s,-]{0,20}?closed|asleep|sleeping)/i;

  test("da semana 8 em diante toda semana declara os olhos fechados", () => {
    /* Antes da 8 não há pálpebra desenhada — a 4 e a 5 são um broto curvo, e a
       6 e a 7 têm só uma mancha escura de olho. Exigir "olhos fechados" ali
       seria pedir anatomia que ainda não existe. */
    const caladas = semanas
      .filter((e) => e.s >= 8 && e.s !== 26)
      .filter((e) => !DECLARA_FECHADO.test(`${e.forma} ${e.pose}`))
      .map((e) => e.s);
    expect(caladas).toEqual([]);
  });

  test("só a 26 abre os olhos, e abre pouco", () => {
    const s26 = semanas.find((e) => e.s === 26)!;
    const texto = `${s26.forma} ${s26.pose}`;
    expect(texto).toMatch(/parted/i);
    /* Positivo, não negativo: a redação anterior dizia "never staring" e o
       modelo entregou exatamente o olhar arregalado proibido. */
    expect(texto).toMatch(/sliver|barely|drowsy|heavy with sleep/i);
  });

  test("nenhuma semana pede o bebê olhando para quem vê", () => {
    for (const e of semanas) {
      expect(`${e.forma} ${e.pose}`).not.toMatch(
        /\b(wide[- ]awake|looking at the (viewer|camera)|alert stare)\b/i,
      );
    }
  });
});

describe("a especificação continua íntegra", () => {
  test("cobre 4 a 42 sem buraco e sem duplicata", () => {
    const ss = semanas.map((e) => e.s);
    expect(ss).toEqual(Array.from({ length: 39 }, (_, i) => i + 4));
  });

  test("nenhum prompt sai com undefined", () => {
    /* Já aconteceu: troquei `marco` por `marcoEn` no gerador antes de criar o
       campo, e os 21 prompts de marco visível saíram com
       "the visible milestone this week: undefined". */
    for (const e of semanas) {
      expect(promptDa(e.s)).not.toContain("undefined");
    }
  });

  test("toda semana de marco visível tem a versão em inglês", () => {
    const sem = semanas.filter((e) => e.visivel && !e.marcoEn).map((e) => e.s);
    expect(sem).toEqual([]);
  });

  test("as semanas antes da 12 geram SEM âncora", () => {
    /* A âncora carrega ROSTO e PROPORÇÃO. Antes da 12 não há rosto, e dar a
       semana 8 como referência da 4 faria o modelo desenvolver o embrião cedo
       demais — a paciente de 4 semanas veria dedinhos que ainda não existem. */
    expect(PRIMEIRA_SEMANA_ENCADEADA).toBe(12);
    expect(ANCORAS).toContain(40);
  });
});

describe("o estilo é o mesmo em todas — é o que faz parecer uma obra só", () => {
  test("fundo cinza neutro, nunca chroma verde", () => {
    /* A primeira prova foi em verde e deixou franja esverdeada no cabelo
       depois do recorte. */
    for (const e of semanas.slice(0, 3)) {
      const p = promptDa(e.s);
      expect(p).toMatch(/NEUTRAL MID-GREY/);
      expect(p).not.toMatch(/chroma-key GREEN/i);
    }
  });

  test("pele clara de base — o filtro de tom do app só escurece", () => {
    /* `BabyIllustration` aplica os 5 tons por gamma SVG. Partir de pele já
       escura quebraria os quatro tons mais claros. */
    expect(promptDa(20)).toMatch(/LIGHT in value/i);
  });

  test("assunto pequeno com margem larga — o enquadramento é do código", () => {
    /* Pedir "preencha o quadro" fez o cordão sair cortado em 5 de 6 âncoras.
       O modelo desenha solto; `normalizar.mjs` reenquadra para 83%. */
    const p = promptDa(33);
    expect(p).toMatch(/SMALL subject in a LARGE empty frame/i);
    expect(p).toMatch(/Wide\s+empty margins are REQUIRED/i);
  });
});
