/**
 * O PLANO DA SESSÃO — o que um banco de 149 falas precisa garantir.
 *
 * A auditoria mediu o antes: numa sessão de dez minutos a voz guiada cobria
 * 34 segundos (5,5%) e o resto eram três palavras repetidas 47 vezes. Estes
 * testes são o contrato do depois.
 */

import { describe, expect, test } from "bun:test";
import {
  CICLO,
  RESPIRO,
  ciclosDe,
  densidadeDeVoz,
  falaNoCiclo,
  pesoMinimo,
  planejarSessao,
  trimestreDaSemana,
  type Densidade,
} from "./meditacao-sessao";

const DURACOES = [1, 2, 5, 10];
const TEMAS = [
  "Calma",
  "Conexão com o bebê",
  "Descanso",
  "Gratidão",
  "Sono tranquilo",
  "Coragem pro parto",
  "Aqui e agora",
];

describe("o arco existe em qualquer duração", () => {
  test("as cinco partes aparecem de 2 minutos para cima", () => {
    for (const minutos of [2, 5, 10]) {
      const p = planejarSessao({ minutos, tema: "Calma", semanas: 20 });
      const momentos = new Set(p.deixas.map((d) => d.fala.momento));
      expect({ minutos, tem: [...momentos].sort() }).toEqual({
        minutos,
        tem: ["acolhimento", "ancoragem", "corpo", "silencio", "volta"],
      });
    }
  });

  test("⚠️ na de 1 minuto, o que cai é o MEIO — nunca as pontas", () => {
    /* Com o compasso em 16 s, um minuto são quatro respirações, e cinco partes
       não cabem em quatro. A repartição antiga espremia a PRIMEIRA janela até
       zero, e a sessão abria em "deixe o ar entrar pelo nariz" — sem receber
       ninguém. Começar sem acolhimento é o mesmo defeito, pelo outro lado, de
       terminar de repente. */
    const p = planejarSessao({ minutos: 1, tema: "Calma", semanas: 20 });
    const momentos = p.deixas.map((d) => d.fala.momento);
    expect(momentos[0]).toBe("acolhimento");
    expect(momentos[momentos.length - 1]).toBe("volta");
    expect(momentos).not.toContain("silencio");
  });

  test("a sessão abre acolhendo e fecha voltando ao corpo", () => {
    for (const minutos of DURACOES) {
      const p = planejarSessao({ minutos, tema: "Descanso", semanas: 30 });
      expect(p.deixas[0].fala.momento).toBe("acolhimento");
      expect(p.deixas[p.deixas.length - 1].fala.momento).toBe("volta");
    }
  });

  test("nenhuma fala cai fora da sessão, e nunca duas no mesmo ciclo", () => {
    /* Duas ao mesmo tempo viram ruído: o canal de voz é um só. */
    for (const minutos of DURACOES) {
      for (const tema of TEMAS) {
        const p = planejarSessao({ minutos, tema, semanas: 20 });
        const ciclos = p.deixas.map((d) => d.ciclo);
        expect(ciclos.every((c) => c >= 0 && c < p.totalCiclos)).toBe(true);
        expect(new Set(ciclos).size).toBe(ciclos.length);
        /* E em ordem crescente — a tela lê o ciclo atual, não busca. */
        expect([...ciclos].sort((a, b) => a - b)).toEqual(ciclos);
      }
    }
  });
});

describe("a voz deixou de ser 5,5% da sessão", () => {
  test("dez minutos guiados ficam entre 12% e 45% de voz", () => {
    /* ⚠️ O PISO BAIXOU DE 15% PARA 12%, e não foi para o teste ficar verde.
       O dono ouviu a sessão e disse que estava corrida; a medição deu razão a
       ele (instruções em respirações seguidas, e a palavra do compasso por
       cima delas). O espaçamento mínimo de uma respiração entre instruções
       tirou seis falas de uma sessão de dez minutos — de 24 para 18 — e a
       densidade caiu de ~20% para ~14%.

       Continua sendo 2,6 vezes o que a auditoria mediu na versão original
       (5,5%), que é o número que este teste existe para nunca mais permitir.
       O teto segue em 45%: acima disso não sobra silêncio, que é o exercício. */
    const p = planejarSessao({ minutos: 10, tema: "Calma", semanas: 20 });
    const d = densidadeDeVoz(p);
    expect(d).toBeGreaterThan(0.12);
    expect(d).toBeLessThan(0.45);
  });

  test("a sessão longa fala MAIS vezes que a curta", () => {
    const curta = planejarSessao({ minutos: 1, tema: "Calma", semanas: 20 });
    const longa = planejarSessao({ minutos: 10, tema: "Calma", semanas: 20 });
    expect(longa.deixas.length).toBeGreaterThan(curta.deixas.length * 2);
  });

  test("as três palavras da respiração calam depois da ancoragem", () => {
    /* ⚠️ Elas tocavam 47 vezes em dez minutos — 141 palavras, o grosso de tudo
       que se ouvia. Agora conduzem enquanto o desenho ensina o compasso. */
    const p = planejarSessao({ minutos: 10, tema: "Calma", semanas: 20 });
    expect(p.palavrasAte).toBeGreaterThan(0);
    expect(p.palavrasAte).toBeLessThan(p.totalCiclos / 2);
  });
});

describe("a densidade é escolha dela", () => {
  test('"só o ritmo" não tem fala nenhuma, mas mantém as palavras até o fim', () => {
    /* Sem voz e sem as palavras, quem está de olhos fechados fica sem nada. */
    const p = planejarSessao({ minutos: 10, tema: "Calma", densidade: "silenciosa", semanas: 20 });
    expect(p.deixas).toEqual([]);
    expect(p.palavrasAte).toBe(p.totalCiclos);
  });

  test('"pouca voz" fala menos que "guiada", e as duas falam', () => {
    const g = planejarSessao({ minutos: 10, tema: "Calma", densidade: "guiada", semanas: 20 });
    const p = planejarSessao({ minutos: 10, tema: "Calma", densidade: "pouca", semanas: 20 });
    expect(p.deixas.length).toBeGreaterThan(0);
    expect(p.deixas.length).toBeLessThan(g.deixas.length);
  });

  test("o peso mínimo sobe conforme a sessão encurta", () => {
    const d: Densidade = "guiada";
    expect(pesoMinimo(10, d)).toBe(1);
    expect(pesoMinimo(5, d)).toBe(2);
    expect(pesoMinimo(2, d)).toBe(3);
    expect(pesoMinimo(1, d)).toBe(3);
  });
});

describe("o app sabe em que semana ela está", () => {
  test("o acolhimento de fase entra, e é o do trimestre certo", () => {
    /* É a única coisa desta tela que o Calm estruturalmente não pode ter: eles
       não sabem nada sobre quem está do outro lado. */
    for (const [semanas, tri] of [
      [8, 1],
      [20, 2],
      [36, 3],
    ] as const) {
      const p = planejarSessao({ minutos: 10, tema: "Calma", semanas });
      const fase = p.deixas.filter((d) => d.fala.trimestre);
      expect(fase.length).toBeGreaterThan(0);
      expect(fase.every((d) => d.fala.trimestre === tri)).toBe(true);
    }
  });

  test("sem semana conhecida, nenhuma fala de fase entra", () => {
    /* Uma voz que erra sobre o corpo dela derruba a confiança na sessão
       inteira. Na dúvida, o acolhimento comum basta. */
    for (const semanas of [null, undefined]) {
      const p = planejarSessao({ minutos: 10, tema: "Calma", semanas });
      expect(p.deixas.filter((d) => d.fala.trimestre)).toEqual([]);
    }
  });

  test("as bordas do trimestre", () => {
    expect(trimestreDaSemana(13)).toBe(1);
    expect(trimestreDaSemana(14)).toBe(2);
    expect(trimestreDaSemana(27)).toBe(2);
    expect(trimestreDaSemana(28)).toBe(3);
    expect(trimestreDaSemana(null)).toBe(null);
  });
});

describe("a repetição, que é a queixa nº 2 do mercado", () => {
  test("as três leituras de um tema não compartilham nenhuma fala", () => {
    /* Três versões que dizem a mesma coisa com outras palavras não adiam o
       teto — só o disfarçam por uma semana. */
    for (const tema of TEMAS) {
      const ids = [1, 2, 3].map(
        (v) =>
          new Set(
            planejarSessao({ minutos: 10, tema, variacao: v as 1 | 2 | 3, semanas: 20 })
              .deixas.filter((d) => d.fala.momento === "corpo")
              .map((d) => d.fala.id),
          ),
      );
      expect([...ids[0]].filter((x) => ids[1].has(x) || ids[2].has(x))).toEqual([]);
      expect([...ids[1]].filter((x) => ids[2].has(x))).toEqual([]);
    }
  });

  test("nenhuma rechamada se repete dentro da mesma sessão", () => {
    /* Com cinco no poço, três se repetiam em dez minutos. Agora são vinte. */
    for (let s = 0; s < 20; s++) {
      const p = planejarSessao({ minutos: 10, tema: "Calma", semanas: 20, semente: s });
      const re = p.deixas.filter((d) => d.fala.momento === "silencio").map((d) => d.fala.id);
      expect(new Set(re).size).toBe(re.length);
    }
  });

  test("sessões seguidas ouvem rechamadas diferentes", () => {
    const a = planejarSessao({ minutos: 10, tema: "Calma", semanas: 20, semente: 0 });
    const b = planejarSessao({ minutos: 10, tema: "Calma", semanas: 20, semente: 1 });
    const ids = (p: typeof a) =>
      p.deixas.filter((d) => d.fala.momento === "silencio").map((d) => d.fala.id);
    expect(ids(a)).not.toEqual(ids(b));
  });

  test("o mesmo pedido dá o mesmo plano", () => {
    /* Sem isso a tela mudaria de fala sozinha ao re-renderizar — o mesmo
       defeito que o balão do mascote teve com o clima. */
    const a = planejarSessao({ minutos: 10, tema: "Calma", semanas: 20, semente: 7 });
    const b = planejarSessao({ minutos: 10, tema: "Calma", semanas: 20, semente: 7 });
    expect(a.deixas.map((d) => d.fala.id)).toEqual(b.deixas.map((d) => d.fala.id));
  });
});

describe("o Modo Cuidado alcança as falas, não só os temas", () => {
  test("nenhuma fala do plano cita o bebê ou o parto", () => {
    /* O acolhimento e as rechamadas entram em TODOS os temas, então o filtro
       da lista de temas não bastava. */
    const proibido = /\b(beb[êe]|barriga|parto|vocês dois)\b/i;
    for (const minutos of DURACOES) {
      for (const tema of ["Só respirar", "Calma", "Descanso", "Sono tranquilo", "Aqui e agora"]) {
        const p = planejarSessao({ minutos, tema, semanas: 20, careMode: true });
        for (const d of p.deixas) {
          expect({ tema, fala: d.fala.texto, cita: proibido.test(d.fala.texto) }).toEqual({
            tema,
            fala: d.fala.texto,
            cita: false,
          });
        }
      }
    }
  });

  test("e ainda sobra sessão — o luto não fica sem exercício", () => {
    const p = planejarSessao({ minutos: 5, tema: "Calma", semanas: 20, careMode: true });
    expect(p.deixas.length).toBeGreaterThan(3);
  });
});

describe("⚠️ o ritmo NÃO depende da duração escolhida", () => {
  test("o compasso é o mesmo em 1 e em 10 minutos", () => {
    /* Pedido do dono, em letras maiúsculas: "quando a gente aumenta ou diminui
       o tempo, não é pra pessoa falar mais rápido, e não é pra bolha inspirar
       e soltar mais rápido". O que muda com a duração é o NÚMERO de
       respirações, nunca a duração de uma. */
    /* ⚠️ 4-4-8, e não 4-7-8. O dono pediu "16 ou 19"; 19 seria o 4-7-8, e o
       que faz dele 19 é uma apneia de sete segundos — a parte que uma gestante
       de terceiro trimestre abandona primeiro, e que não é o que acalma. Os
       dois segundos a mais foram todos para a expiração, que é quem aciona o
       vago: solte tem agora o DOBRO de inspire. */
    expect(RESPIRO).toEqual({ in: 4, hold: 4, out: 8 });
    expect(CICLO).toBe(16);
    expect(RESPIRO.out).toBe(RESPIRO.in * 2);
    for (const minutos of DURACOES) {
      const p = planejarSessao({ minutos, tema: "Calma", semanas: 20 });
      expect({ minutos, seg: p.totalCiclos * CICLO }).toEqual({
        minutos,
        seg: ciclosDe(minutos) * 16,
      });
    }
  });

  test("o 'segure' deixou de ser mais curto que o pensamento", () => {
    /* Eram 2 s: a paciente ouvia "Segure" e já vinha "Solte". Nenhuma
       referência do gênero usa menos de 4 (box 4-4-4-4, 4-7-8, dormir 4-4-6). */
    expect(RESPIRO.hold).toBeGreaterThanOrEqual(4);
    /* E a expiração continua mais longa que a inspiração, que é a parte que
       acalma. */
    expect(RESPIRO.out).toBeGreaterThan(RESPIRO.in);
  });

  test("⚠️ duas instruções não caem em respirações seguidas", () => {
    /* Medido antes: em dez minutos, onze pares de instruções colados, e no
       primeiro minuto de qualquer sessão a voz falava em TODAS as
       respirações. Uma respiração inteira de silêncio entre uma instrução e a
       seguinte é o que dá tempo de a instrução ser cumprida, e não só ouvida.

       A sessão de 1 minuto é a exceção conhecida: cinco respirações para as
       cinco partes do arco não deixam folga, e perder a volta ao corpo é pior
       que duas falas próximas. */
    /* De 5 minutos para cima há folga para o espaçamento inteiro. Em 1 e 2
       minutos as janelas têm um ciclo cada, e aí o arco vale mais — ver a
       exceção documentada em `ESPACO_MINIMO`. */
    for (const minutos of [5, 10]) {
      const c = planejarSessao({ minutos, tema: "Calma", semanas: 20 }).deixas.map((d) => d.ciclo);
      const menor = Math.min(...c.slice(1).map((v, i) => v - c[i]));
      expect({ minutos, menor }).toEqual({ minutos, menor: 2 });
    }
  });
});

describe("as contas de ciclo batem com a tela", () => {
  test("os minutos viram o número de respirações que a tela usa", () => {
    /* O ciclo passou de 12 s para 16 s (4-4-8), e arredonda para CIMA. */
    expect(CICLO).toBe(16);
    expect(ciclosDe(1)).toBe(4);
    expect(ciclosDe(2)).toBe(8);
    expect(ciclosDe(5)).toBe(19);
    expect(ciclosDe(10)).toBe(38);
  });

  test("a busca por ciclo devolve a fala daquele ciclo", () => {
    const p = planejarSessao({ minutos: 10, tema: "Calma", semanas: 20 });
    for (const d of p.deixas) expect(falaNoCiclo(p, d.ciclo)?.id).toBe(d.fala.id);
    const vazios = [...Array(p.totalCiclos).keys()].filter((c) => !falaNoCiclo(p, c));
    expect(vazios.length).toBeGreaterThan(0); // tem silêncio de verdade
  });
});
