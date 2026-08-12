/**
 * AS FRASES DO BEBÊ BOLHA — e as quatro coisas que não podem escapar.
 *
 * Ele fala com gestante de alto risco, todo dia, no canto da tela dela. As
 * regras abaixo não são preferência de estilo: cada uma existe porque a
 * violação correspondente seria sentida por quem está no pior dia da gestação.
 */

import { describe, expect, test } from "bun:test";
import {
  comNomeNaFrase,
  diaLocalDe,
  fraseDoDia,
  FRASES,
  periodoDaHora,
  type Periodo,
} from "./frases-do-mascote";

const PERIODOS: Periodo[] = ["madrugada", "manha", "tarde", "noite"];

describe("o relógio", () => {
  test("as quatro faixas cobrem as 24 horas", () => {
    expect(periodoDaHora(0)).toBe("madrugada");
    expect(periodoDaHora(4)).toBe("madrugada");
    expect(periodoDaHora(5)).toBe("manha");
    expect(periodoDaHora(11)).toBe("manha");
    expect(periodoDaHora(12)).toBe("tarde");
    expect(periodoDaHora(17)).toBe("tarde");
    expect(periodoDaHora(18)).toBe("noite");
    expect(periodoDaHora(23)).toBe("noite");
  });
});

describe("nenhuma hora fica muda", () => {
  test("existe frase para as quatro faixas, com nome e sem nome", () => {
    /* Uma faixa sem frase deixaria o mascote calado o dia inteiro para quem
       abre naquele horário — e a madrugada, que é a faixa mais frágil, é
       justamente a que tem menos frases. */
    for (const periodo of PERIODOS) {
      expect(fraseDoDia({ dia: 20_000, periodo, nome: "Ana" })).toBeTruthy();
      expect(fraseDoDia({ dia: 20_000, periodo, nome: null })).toBeTruthy();
    }
  });

  test("no Modo Cuidado também sobra frase em toda faixa", () => {
    /* O luto é onde ele mais precisa existir, e é onde a lista mais encolhe:
       se o filtro derrubasse tudo numa faixa, a paciente que perdeu a gestação
       abriria o app às 3h e encontraria o personagem mudo. */
    for (const periodo of PERIODOS) {
      expect(fraseDoDia({ dia: 20_000, periodo, nome: "Ana", careMode: true })).toBeTruthy();
    }
  });
});

describe("o que ele nunca diz", () => {
  test("nada de cobrança", () => {
    /* A carinha `preocupada` já saiu da personagem por isto: cobrança
       disfarçada de fofura continua sendo cobrança. */
    const proibido =
      /\b(você não fez|faltou|não fez|está atrasad|perdeu a sequência|vai perder|precisa fazer|devia)\b/i;
    for (const f of FRASES) expect(f.texto).not.toMatch(proibido);
  });

  test("nada de promessa clínica", () => {
    /* Ele não tranquiliza sobre sintoma, não afirma que está tudo bem e não
       receita. Quem faz isso é o médico, e a triagem tem tela própria. */
    const proibido = /\b(está tudo bem|não se preocupe|é normal sentir|vai passar|fique calma)\b/i;
    for (const f of FRASES) expect(f.texto).not.toMatch(proibido);
  });

  test("no luto, nenhuma frase fala de bebê, semana ou jogo", () => {
    const luto = FRASES.filter((f) => f.noLuto);
    expect(luto.length).toBeGreaterThan(4);
    for (const f of luto) {
      expect(f.texto).not.toMatch(/\b(bebê|semana|chutes|Caminho|aula|Sementinhas)\b/i);
    }
  });
});

describe("o nome", () => {
  test("`{nome}` vira vírgula + primeiro nome", () => {
    expect(comNomeNaFrase("Bom dia{nome} 💛", "Ana Beatriz")).toBe("Bom dia, Ana 💛");
  });

  test("sem nome, o trecho SOME — e não deixa vírgula órfã", () => {
    /* "Bom dia, !" é o defeito que aparece justamente na conta de quem pulou o
       cadastro, que é quem mais vê estas frases. */
    expect(comNomeNaFrase("Bom dia{nome} 💛", null)).toBe("Bom dia 💛");
    expect(comNomeNaFrase("Bom dia{nome} 💛", "   ")).toBe("Bom dia 💛");
  });

  test("quem não tem nome nunca recebe frase que pede nome", () => {
    for (const periodo of PERIODOS) {
      for (let dia = 20_000; dia < 20_040; dia++) {
        const f = fraseDoDia({ dia, periodo, nome: null });
        expect(f).not.toContain("{nome}");
      }
    }
  });
});

describe("uma por dia, e ela roda", () => {
  test("o mesmo dia devolve sempre a mesma frase", () => {
    /* Se mudasse a cada montagem, a home trocaria a frase a cada toque em
       "Bebê" — e o balão viraria um letreiro. */
    const a = fraseDoDia({ dia: 20_100, periodo: "tarde", nome: "Ana" });
    const b = fraseDoDia({ dia: 20_100, periodo: "tarde", nome: "Ana" });
    expect(a).toBe(b);
  });

  test("dias seguidos não repetem, e a volta percorre a lista inteira", () => {
    /* O que se cobra é a cobertura: em N dias ela viu as N frases da faixa,
       sem repetir. A primeira versão andava de 7 em 7 e a manhã, que tem 14
       frases, ficava presa em duas — este teste é o que pegou. */
    for (const periodo of PERIODOS) {
      const vistas = new Set<string>();
      const total = FRASES.filter((f) => !f.periodos || f.periodos.includes(periodo)).length;
      for (let dia = 0; dia < total * 2; dia++) {
        const f = fraseDoDia({ dia, periodo, nome: "Ana" });
        if (f) vistas.add(f);
      }
      expect(vistas.size).toBe(total);
    }
  });
});

describe("o dia vem do calendário LOCAL", () => {
  test("duas horas do mesmo dia dão o mesmo número", () => {
    const manha = new Date(2026, 7, 12, 8, 0, 0);
    const noite = new Date(2026, 7, 12, 23, 30, 0);
    expect(diaLocalDe(manha)).toBe(diaLocalDe(noite));
  });

  test("a virada da meia-noite muda o dia", () => {
    const hoje = new Date(2026, 7, 12, 23, 59, 0);
    const amanha = new Date(2026, 7, 13, 0, 1, 0);
    expect(diaLocalDe(amanha)).toBe(diaLocalDe(hoje) + 1);
  });
});
