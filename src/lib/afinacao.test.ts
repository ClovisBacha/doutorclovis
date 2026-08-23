/**
 * O QUE PRECISA ESTAR CERTO NUMA AFINAÇÃO.
 *
 * Duas coisas, e a segunda é a que importa mais: a matemática (senão a emenda
 * do laço de 30 s volta a estalar) e a BOCA — nenhuma tela deste app pode
 * afirmar que uma frequência cura, acalma ou trata coisa nenhuma.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  A4_HZ,
  A4_ISO_HZ,
  ESCALAS,
  LACO_SEGS,
  cents,
  grausEmHz,
  noLaco,
  nota,
  notaNoLaco,
  SEGURAS_PARA_SOBREPOR,
  semDissonancia,
} from "./afinacao";
import { LOOP_SEGS } from "./som-continuo";

describe("a referência", () => {
  test("lá 4 é exatamente 432", () => {
    expect(nota("la", 4)).toBe(432);
    expect(A4_HZ).toBe(432);
  });

  test("as oitavas do lá dobram e dividem redondo", () => {
    expect(nota("la", 3)).toBeCloseTo(216, 9);
    expect(nota("la", 2)).toBeCloseTo(108, 9);
    expect(nota("la", 5)).toBeCloseTo(864, 9);
  });

  test("a diferença para o padrão ISO é de 31,77 cents", () => {
    /* Um terço de semitom. Audível lado a lado, imperceptível isolada — e é
       por isso que o texto da tela não pode prometer que alguém "sente". */
    expect(cents(A4_ISO_HZ, A4_HZ)).toBeCloseTo(-31.77, 1);
  });

  test("a oitava vale 1200 cents e a quinta justa 702", () => {
    expect(cents(216, 432)).toBeCloseTo(1200, 6);
    expect(cents(nota("la", 3), nota("mi", 4))).toBeCloseTo(700, 6);
  });
});

describe("⚠️ a grade do laço — é ela que impede o estalo a cada 30 s", () => {
  test("o comprimento do laço aqui é o MESMO de som-continuo", () => {
    /* Estão duplicados porque importar som-continuo daqui criaria ciclo. Se
       alguém mudar o laço lá e não aqui, toda frequência afinada passa a
       sobrar meia volta na emenda — um clique a cada volta, sem erro nenhum. */
    expect(LACO_SEGS).toBe(LOOP_SEGS);
  });

  test("noLaco devolve sempre múltiplo exato de 1/30 Hz", () => {
    for (const f of [432, 256.8687, 87.31, 1000.333, 55.5, 174.61]) {
      const voltas = noLaco(f) * LACO_SEGS;
      expect(Math.abs(voltas - Math.round(voltas))).toBeLessThan(1e-9);
    }
  });

  test("⚠️ o erro da grade segue 28,85/f cents — pior no grave, e ainda inaudível", () => {
    /* A primeira versão deste teste cobrava "abaixo de 0,2 cents" e reprovou:
       cent é RAZÃO, não diferença, então o mesmo erro de 1/60 Hz vale muito
       mais numa nota grave. A afirmação certa é a fórmula, e ela é o que o
       teste cobra agora — inclusive contra a mudança de LACO_SEGS. */
    for (let oitava = 1; oitava <= 6; oitava++) {
      for (const n of ["do", "re", "mi", "fa", "sol", "la", "si"] as const) {
        const f = nota(n, oitava);
        if (f < 40) continue;
        const teto = 1200 / (2 * LACO_SEGS * f * Math.LN2);
        expect(Math.abs(cents(f, noLaco(f)))).toBeLessThanOrEqual(teto + 1e-9);
      }
    }
  });

  test("e mesmo o pior caso do registro grave fica bem abaixo dos 5 cents audíveis", () => {
    /* 40 Hz é mais grave que qualquer coisa que o app toca. Sete vezes de
       folga contra o limiar de discriminação humana. */
    expect(1200 / (2 * LACO_SEGS * 40 * Math.LN2)).toBeLessThan(0.8);
    expect(1200 / (2 * LACO_SEGS * 432 * Math.LN2)).toBeLessThan(0.1);
  });

  test("432 já está na grade — não precisa de arredondamento", () => {
    expect(noLaco(432)).toBe(432);
    expect(notaNoLaco("la", 4)).toBe(432);
  });
});

describe("⚠️ as escalas não podem produzir dissonância por sorteio", () => {
  test("a pentatônica menor não tem trítono nem segunda menor entre NENHUM par", () => {
    /* É a única escala em que qualquer combinação de notas soa consonante — e
       por isso a única segura para sobreposição livre, sem revisão humana
       entre o sorteio e o ouvido da paciente. */
    expect(semDissonancia(ESCALAS.pentatonicaMenor)).toBe(true);
  });

  test("⚠️ dórico e lídio TÊM dissonância entre pares — e é por isso que não são o padrão", () => {
    /* A primeira versão deste teste afirmava o contrário, e estava errada:
       toda escala diatônica tem semitom entre graus vizinhos — é o que a faz
       diatônica. A propriedade que importa é por PAR, e por par as duas
       reprovam. Elas servem para melodia (uma nota por vez), nunca para
       camada que sobrepõe sozinha. */
    expect(semDissonancia(ESCALAS.dorico)).toBe(false);
    expect(semDissonancia(ESCALAS.lidio)).toBe(false);
  });

  test("⚠️ o lídio tem o trítono contra a PRÓPRIA TÔNICA — o dórico não", () => {
    /* A diferença decide o risco: um drone sustenta a tônica o tempo todo,
       então no lídio o trítono está sempre soando. No dórico ele só aparece se
       o 2º e o 6º grau caírem juntos. */
    expect(ESCALAS.lidio).toContain(6);
    expect(ESCALAS.dorico).not.toContain(6);
    /* mas o dórico esconde um trítono entre o 2º e o 6º grau: 9 − 3 = 6 */
    expect(ESCALAS.dorico.includes(3) && ESCALAS.dorico.includes(9)).toBe(true);
  });

  test("só a pentatônica está na lista das que podem sobrepor", () => {
    expect([...SEGURAS_PARA_SOBREPOR]).toEqual(["pentatonicaMenor"]);
    for (const nome of SEGURAS_PARA_SOBREPOR) {
      expect({ nome, segura: semDissonancia(ESCALAS[nome]) }).toEqual({ nome, segura: true });
    }
  });

  test("⚠️ e toda escala que ENTRAR na lista tem de passar na prova", () => {
    /* A catraca de verdade: alguém que acrescente uma escala à lista sem que
       ela seja consonante traz de volta o trítono acidental. O teste acima já
       cobre as de hoje; este cobre as de amanhã. */
    const seguras = (Object.keys(ESCALAS) as (keyof typeof ESCALAS)[]).filter((k) =>
      semDissonancia(ESCALAS[k]),
    );
    expect([...SEGURAS_PARA_SOBREPOR].sort()).toEqual(seguras.sort());
  });

  test("grausEmHz cobre as oitavas pedidas e sobe sempre", () => {
    const g = grausEmHz("pentatonicaMenor", nota("la", 2), 2);
    expect(g.length).toBe(10);
    for (let i = 1; i < g.length; i++) expect(g[i]).toBeGreaterThan(g[i - 1]);
    expect(g[5] / g[0]).toBeCloseTo(2, 6);
  });

  test("com aoLaco, todo grau fecha volta inteira em 30 s", () => {
    for (const f of grausEmHz("dorico", nota("la", 2), 3, true)) {
      const voltas = f * LACO_SEGS;
      expect(Math.abs(voltas - Math.round(voltas))).toBeLessThan(1e-9);
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠️ A CATRACA DA BOCA.
 *
 * Este é um app médico de gestação de alto risco. "432 Hz acalma o bebê" ao
 * lado de uma triagem de pré-eclâmpsia não é um exagero de marketing: é o app
 * ensinando a paciente que ele afirma coisas sem evidência — e a próxima
 * afirmação que ela vai desacreditar é a que importa.
 *
 * A afinação é escolha de TIMBRE. A tela pode dizer que existe; não pode dizer
 * que faz.
 */
describe("⚠️ nenhuma tela afirma efeito de saúde da frequência", () => {
  /* Percorre o `src/` inteiro: a proibição não é de um arquivo, é do produto. */
  function arquivos(dir: string, out: string[] = []): string[] {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) {
        arquivos(p, out);
      } else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.ts$/.test(nome)) {
        out.push(p);
      }
    }
    return out;
  }

  /**
   * ⚠️ TIRA OS COMENTÁRIOS ANTES DE PROCURAR.
   *
   * Esta é a sétima vez que a lição aparece no projeto, e ela quebra nos DOIS
   * sentidos: aqui, a prosa de `afinacao.ts` DESMENTE a alegação de cura — e
   * contém, por isso, todas as palavras proibidas. Um teste que lesse
   * comentários ficaria vermelho exatamente por causa do texto que existe para
   * impedir o defeito.
   */
  function semComentarios(s: string): string {
    return s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  }

  /**
   * ⚠️ O GATILHO NÃO PODE SER A PALAVRA "FREQUÊNCIA" SOLTA.
   *
   * Em português ela quer dizer "com que frequência" muito mais vezes do que
   * quer dizer hertz, e a primeira versão desta catraca reprovou por causa de
   * "Bebê começa a ser sentido com mais frequência" — uma linha da jornada
   * gestacional que não fala de som nenhum. Catraca com falso positivo é
   * catraca que alguém desliga, e aí ela para de proteger.
   *
   * O gatilho é o CONTEXTO DE ALTURA: o número 432, um número seguido de Hz,
   * a palavra hertz, ou afinação.
   */
  const SOBRE_ALTURA = /(\b432\b|\d\s*hz\b|\bhertz\b|afina[çc][ãa]o)/i;

  const CURA =
    /(cura|curar|curativ|terapêutic|terapeutic|trata|tratamento|reparo do dna|regenera|frequência sagrada|frequencia sagrada|frequência de cura|frequencia de cura|solfeggio|solfejo sagrado)/i;

  test("nenhum texto liga 432, Hz ou frequência a efeito clínico", () => {
    const culpados: string[] = [];
    for (const p of arquivos("src")) {
      const codigo = semComentarios(readFileSync(p, "utf8"));
      /* Olha só as linhas que FALAM de frequência: "tratamento" aparece o dia
         inteiro num app de obstetrícia, e proibir a palavra solta encheria o
         teste de falso positivo — catraca com falso positivo é catraca que
         alguém desliga. */
      for (const linha of codigo.split("\n")) {
        if (!SOBRE_ALTURA.test(linha)) continue;
        if (CURA.test(linha)) culpados.push(p + ": " + linha.trim().slice(0, 120));
      }
    }
    expect(culpados).toEqual([]);
  });

  test("⚠️ nem as alegações NOMEADAS que a pesquisa derrubou uma a uma", () => {
    /* Cada uma destas foi verificada e é falsa. Estão aqui pelo nome porque
       são exatamente as que aparecem em todo texto de marketing de 432 Hz — e
       porque a catraca genérica acima não pegaria "ressonância de Schumann",
       que não contém nenhum verbo clínico e mesmo assim é falsa. */
    const FALSAS = [
      /schumann/i,
      /solfeggio|solfejo sagrado/i,
      /frequ[êe]ncia (do universo|da natureza|da terra|do amor|milagre)/i,
      /repara o dna|reparo do dna/i,
      /geometria sagrada/i,
      /verdi (provou|escolheu)/i,
      /naz(ista|i)/i,
      /cientificamente comprovad/i,
    ];
    const culpados: string[] = [];
    for (const p of arquivos("src")) {
      const codigo = semComentarios(readFileSync(p, "utf8"));
      for (const linha of codigo.split("\n")) {
        for (const re of FALSAS) {
          if (re.test(linha)) culpados.push(p + ": " + linha.trim().slice(0, 100));
        }
      }
    }
    expect(culpados).toEqual([]);
  });

  test("⚠️ e nenhuma tela pode dizer que o BEBÊ responde a uma frequência", () => {
    /* A alegação sobre o feto é a mais grave possível: não há evidência
       nenhuma, e ela chega numa paciente que está justamente medindo tudo que
       o bebê faz. Numa base de alto risco, prometer resposta fetal a um som é
       o tipo de frase que faz a paciente parar de contar movimento porque "o
       som cuida disso". */
    const culpados: string[] = [];
    for (const p of arquivos("src")) {
      const codigo = semComentarios(readFileSync(p, "utf8"));
      for (const linha of codigo.split("\n")) {
        if (!SOBRE_ALTURA.test(linha)) continue;
        if (/(beb[êe]|feto|fetal|barriga|[úu]tero)/i.test(linha))
          culpados.push(p + ": " + linha.trim().slice(0, 100));
      }
    }
    expect(culpados).toEqual([]);
  });

  test("e a promessa mole também não passa — 'acalma', 'relaxa', 'reduz' com Hz junto", () => {
    /* A alegação não precisa da palavra "cura" para ser alegação. "432 Hz
       reduz a ansiedade" é exatamente o que o estudo piloto NÃO sustenta. */
    const MOLE = /(acalma|relaxa|reduz|diminui|alivia|equilibra|harmoniza|sincroniza)/i;
    const culpados: string[] = [];
    for (const p of arquivos("src")) {
      const codigo = semComentarios(readFileSync(p, "utf8"));
      for (const linha of codigo.split("\n")) {
        if (!/(432\s*hz|\b432\b.*\bhz\b)/i.test(linha)) continue;
        if (MOLE.test(linha)) culpados.push(p + ": " + linha.trim().slice(0, 120));
      }
    }
    expect(culpados).toEqual([]);
  });
});
