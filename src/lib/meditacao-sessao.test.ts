/**
 * O PLANO DA SESSÃO — o que um banco de 149 falas precisa garantir.
 *
 * A auditoria mediu o antes: numa sessão de dez minutos a voz guiada cobria
 * 34 segundos (5,5%) e o resto eram três palavras repetidas 47 vezes. Estes
 * testes são o contrato do depois.
 */

import { describe, expect, test } from "bun:test";
import {
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
  test("as cinco partes aparecem, até na sessão de um minuto", () => {
    /* ⚠️ Cinco ciclos e cinco janelas: sem o piso de um ciclo por janela, a
       sessão curta perdia a volta ao corpo. Terminar de repente com a paciente
       funda é o defeito mais comum de meditação amadora. */
    for (const minutos of DURACOES) {
      const p = planejarSessao({ minutos, tema: "Calma", semanas: 20 });
      const momentos = new Set(p.deixas.map((d) => d.fala.momento));
      expect({ minutos, tem: [...momentos].sort() }).toEqual({
        minutos,
        tem: ["acolhimento", "ancoragem", "corpo", "silencio", "volta"],
      });
    }
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
  test("dez minutos guiados ficam entre 15% e 45% de voz", () => {
    /* O padrão do gênero numa sessão guiada é de um terço a metade; abaixo de
       15% volta a ser a tela muda que a auditoria encontrou, e acima de 45%
       não sobra silêncio — que é o exercício. */
    const p = planejarSessao({ minutos: 10, tema: "Calma", semanas: 20 });
    const d = densidadeDeVoz(p);
    expect(d).toBeGreaterThan(0.15);
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

describe("as contas de ciclo batem com a tela", () => {
  test("os minutos viram o número de respirações que a tela usa", () => {
    expect(ciclosDe(1)).toBe(5);
    expect(ciclosDe(2)).toBe(10);
    expect(ciclosDe(5)).toBe(25);
    expect(ciclosDe(10)).toBe(50);
  });

  test("a busca por ciclo devolve a fala daquele ciclo", () => {
    const p = planejarSessao({ minutos: 10, tema: "Calma", semanas: 20 });
    for (const d of p.deixas) expect(falaNoCiclo(p, d.ciclo)?.id).toBe(d.fala.id);
    const vazios = [...Array(p.totalCiclos).keys()].filter((c) => !falaNoCiclo(p, c));
    expect(vazios.length).toBeGreaterThan(0); // tem silêncio de verdade
  });
});
