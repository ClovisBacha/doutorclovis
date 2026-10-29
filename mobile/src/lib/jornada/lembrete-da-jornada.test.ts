import { describe, expect, test } from "bun:test";
import {
  lembretesDaJornada,
  lerPreferencia,
  primeiraFrase,
  textoDaSemanaNova,
  textoDoCuidado,
  type ContextoDoLembrete,
} from "~/lib/jornada/lembrete-da-jornada";
import { nestaSemanaDoPos } from "~/lib/jornada/pos-parto";

/* Terça, 20 de outubro de 2026, 15:00 (fuso dos testes: São Paulo). */
const AGORA = new Date(2026, 9, 20, 15, 0);

const gest = (extra: Partial<ContextoDoLembrete> = {}): ContextoDoLembrete => ({
  agora: AGORA,
  modo: "gestacao",
  D: 171,
  semana: 24,
  diaNaSemana: 3,
  nomeDoBebe: "Helena",
  chama: 0,
  feitosHoje: 0,
  totalDoDia: 5,
  desafio: (D) => (D % 2 === 0 ? `Desafio do dia ${D}` : null),
  aula: (D) => (D % 3 === 0 ? `O assunto do dia ${D}` : null),
  ...extra,
});

describe("o cuidado de hoje", () => {
  test("um por dia na hora escolhida, 14 dias; hoje sai se o dia já fechou ou a hora passou", () => {
    const l = lembretesDaJornada({ hora: "20:00", semanaNova: false }, gest());
    expect(l).toHaveLength(14);
    expect(l[0]!.quando.getDate()).toBe(20);
    expect(l[0]!.quando.getHours()).toBe(20);
    expect(l[0]!.id).toBe("jornada-2026-10-20");
    expect(
      lembretesDaJornada(
        { hora: "20:00", semanaNova: false },
        gest({ feitosHoje: 5 }),
      )[0]!.quando.getDate(),
    ).toBe(21);
    expect(
      lembretesDaJornada({ hora: "09:00", semanaNova: false }, gest())[0]!.quando.getDate(),
    ).toBe(21);
    expect(lembretesDaJornada({ hora: null, semanaNova: false }, gest())).toEqual([]);
  });

  test("hoje o texto sabe da chama e do que falta; nos outros dias, do que o dia traz", () => {
    expect(textoDoCuidado(gest({ chama: 14 }), 0)).toEqual({
      titulo: "🔥 14 dias seguidos",
      corpo: "Um cuidado de hoje mantém a chama acesa. Helena agradece 💜",
    });
    expect(textoDoCuidado(gest({ feitosHoje: 3 }), 0).corpo).toBe(
      "3 de 5 cuidados feitos. Mais um gesto e o dia fecha.",
    );
    /* D 172: par → desafio (e 172 não é múltiplo de 3, então não há aula). */
    expect(textoDoCuidado(gest(), 1).corpo).toBe("Desafio de hoje: Desafio do dia 172");
    /* D 174: múltiplo de 3 → a aula, pelo assunto da própria lição. */
    expect(textoDoCuidado(gest(), 3).corpo).toBe(
      "Aula de hoje: O assunto do dia 174. Uns minutinhos para você e Helena.",
    );
    /* Sem desafio nem aula. */
    expect(textoDoCuidado(gest({ nomeDoBebe: null }), 2).corpo).toBe(
      "5 minutinhos para você e o bebê.",
    );
  });

  test("Modo Cuidado: nada de bebê, chama ou contagem", () => {
    const c = gest({ modo: "cuidado", chama: 20, feitosHoje: 2 });
    for (let d = 0; d < 6; d++) {
      const t = textoDoCuidado(c, d);
      expect(`${t.titulo} ${t.corpo}`).not.toMatch(
        /bebê|Helena|semana|chama|dias seguidos|\d de \d/i,
      );
    }
    const l = lembretesDaJornada({ hora: "20:00", semanaNova: true }, c);
    expect(l.every((x) => x.id.startsWith("jornada-"))).toBe(true);
  });

  test("no pós-parto: os três gestos, o desafio do dia; depois das 12 semanas, um minuto para ela", () => {
    const pos = gest({ modo: "pos", D: 27, idadeDias: 20, totalDoDia: 3, semana: undefined });
    expect(textoDoCuidado(pos, 0).titulo).toBe("Como você está hoje? 💜");
    expect(textoDoCuidado({ ...pos, feitosHoje: 1 }, 0).corpo).toBe("1 de 3 feitos. Sem pressa.");
    expect(textoDoCuidado(pos, 1).corpo).toBe("Desafio de hoje: Desafio do dia 28");
    expect(textoDoCuidado({ ...pos, idadeDias: 90, D: 97 }, 0).titulo).toBe(
      "Um minuto para você 💜",
    );
  });
});

describe("a semana nova", () => {
  test("às 9h do dia em que a semana começa, com o tamanho do bebê", () => {
    /* Hoje é 24s3d: a semana 25 começa em 4 dias (sábado, 24/10). */
    const t = textoDaSemanaNova(gest(), 4)!;
    expect(t.titulo).toBe("Semana 25 começou! 🌱");
    expect(t.corpo).toMatch(/^Helena agora tem o tamanho de /);
    expect(textoDaSemanaNova(gest(), 3)).toBeNull();
    const l = lembretesDaJornada({ hora: null, semanaNova: true }, gest());
    expect(l.map((x) => [x.id, x.quando.getHours()])).toEqual([
      ["semana-2026-10-24", 9],
      ["semana-2026-10-31", 9],
    ]);
  });

  test("no pós-parto, cada semana de vida, com a primeira frase do texto da semana que começa", () => {
    /* O aviso era a orientação do site: "Agende a consulta puerperal completa
       (30–40 dias): revisão geral, contracepção…". Agora é o texto do app. */
    const pos = gest({ modo: "pos", D: 27, idadeDias: 20, totalDoDia: 3 });
    const t = textoDaSemanaNova(pos, 1)!;
    expect(t.titulo).toBe("Helena completa 3 semanas 💜");
    expect(t.corpo).toBe(primeiraFrase(nestaSemanaDoPos(4)));
    expect(t.corpo).not.toBe(primeiraFrase(nestaSemanaDoPos(3)));
    expect(textoDaSemanaNova(pos, 2)).toBeNull();
  });

  test("Modo Cuidado não tem semana nova", () => {
    expect(textoDaSemanaNova(gest({ modo: "cuidado" }), 4)).toBeNull();
    expect(lembretesDaJornada({ hora: null, semanaNova: true }, gest({ modo: "cuidado" }))).toEqual(
      [],
    );
  });
});

test("a preferência guardada, validada", () => {
  expect(lerPreferencia({ hora: "20:00", semanaNova: true })).toEqual({
    hora: "20:00",
    semanaNova: true,
    dispensado: false,
  });
  expect(lerPreferencia({ hora: "25:00", dispensado: true })).toEqual({
    hora: null,
    semanaNova: false,
    dispensado: true,
  });
  expect(lerPreferencia(null).hora).toBeNull();
  expect(primeiraFrase("Uma. Duas.")).toBe("Uma.");
});
