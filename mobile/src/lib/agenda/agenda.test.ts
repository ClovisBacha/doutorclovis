import { describe, expect, test } from "bun:test";
import {
  comCompromisso,
  contagemPorDia,
  faltaQuanto,
  lembretesDaAgenda,
  lembretesDe,
  lerAgenda,
  paraData,
  proximo,
  quandoPorExtenso,
  semanasDoMes,
  semCompromisso,
  separar,
  sugestaoDaFase,
  type Compromisso,
} from "./agenda";

/* Segunda, 19 de outubro de 2026, 10:00 (fuso dos testes: São Paulo). */
const AGORA = new Date(2026, 9, 19, 10, 0);

const c = (id: string, quando: string, extra: Partial<Compromisso> = {}): Compromisso => ({
  id,
  tipo: "consulta",
  quando,
  ...extra,
});

describe("a agenda do pré-natal", () => {
  test("a hora é local e recusa data que não existe", () => {
    const d = paraData("2026-10-23T14:30")!;
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([23, 14, 30]);
    expect(paraData("2026-02-31T10:00")).toBeNull();
    expect(paraData("2026-10-23T24:00")).toBeNull();
    expect(paraData("2026-10-23T14:30:00Z")).toBeNull();
  });

  test("lerAgenda descarta o estragado, o repetido, e põe em ordem", () => {
    const lida = lerAgenda([
      c("b", "2026-11-02T09:00"),
      c("a", "2026-10-23T14:30", { onde: "  Clínica Bem Nascer  ", titulo: "" }),
      c("a", "2026-12-01T09:00"),
      { id: "x", tipo: "festa", quando: "2026-10-23T14:30" },
      { id: "y", tipo: "exame", quando: "amanhã" },
      null,
    ]);
    expect(lida.map((x) => x.id)).toEqual(["a", "b"]);
    expect(lida[0]!.onde).toBe("Clínica Bem Nascer");
    expect(lida[0]!.titulo).toBeUndefined();
    expect(lerAgenda("lixo")).toEqual([]);
  });

  test("incluir troca pelo id; apagar tira", () => {
    let l = comCompromisso([], c("a", "2026-10-23T14:30"));
    l = comCompromisso(l, c("b", "2026-10-21T08:00"));
    l = comCompromisso(l, c("a", "2026-10-30T14:30"));
    expect(l.map((x) => `${x.id}@${x.quando}`)).toEqual([
      "b@2026-10-21T08:00",
      "a@2026-10-30T14:30",
    ]);
    expect(semCompromisso(l, "b").map((x) => x.id)).toEqual(["a"]);
  });

  test("a consulta ainda vale até uma hora depois; passadas vêm da mais recente", () => {
    const l = lerAgenda([
      c("ontem", "2026-10-18T15:00"),
      c("agora", "2026-10-19T09:30"),
      c("mes-passado", "2026-09-20T15:00"),
      c("quinta", "2026-10-22T14:00"),
    ]);
    const { proximos, passados } = separar(l, AGORA);
    expect(proximos.map((x) => x.id)).toEqual(["agora", "quinta"]);
    expect(passados.map((x) => x.id)).toEqual(["ontem", "mes-passado"]);
    expect(proximo(l, new Date(2026, 9, 19, 10, 31))!.id).toBe("quinta");
  });

  test("a data por extenso e quanto falta", () => {
    expect(quandoPorExtenso("2026-10-19T14:30", AGORA)).toBe("Hoje, 14:30");
    expect(quandoPorExtenso("2026-10-20T09:05", AGORA)).toBe("Amanhã, 9:05");
    expect(quandoPorExtenso("2026-10-22T14:00", AGORA)).toBe("Quinta, 22 de outubro · 14:00");
    expect(quandoPorExtenso("2027-01-04T08:00", AGORA)).toBe(
      "Segunda, 4 de janeiro de 2027 · 8:00",
    );
    expect(faltaQuanto("2026-10-19T23:00", AGORA)).toBe("é hoje");
    expect(faltaQuanto("2026-10-20T07:00", AGORA)).toBe("amanhã");
    expect(faltaQuanto("2026-10-24T07:00", AGORA)).toBe("em 5 dias");
    expect(faltaQuanto("2026-11-09T07:00", AGORA)).toBe("em 3 semanas");
  });

  test("os lembretes: véspera às 19h e duas horas antes, só os que ainda vêm", () => {
    const ls = lembretesDe(
      c("u", "2026-10-22T14:00", { tipo: "ultrassom", titulo: "Morfológico", onde: "Fetal Lab" }),
      AGORA,
    );
    expect(ls.map((l) => [l.id, l.quando.getDate(), l.quando.getHours()])).toEqual([
      ["u-vespera", 21, 19],
      ["u-antes", 22, 12],
    ]);
    expect(ls[0]!.titulo).toBe("Amanhã: Morfológico");
    expect(ls[0]!.corpo).toBe("Às 14:00 · Fetal Lab. Confira com a clínica se há algum preparo.");
    expect(ls[1]!.titulo).toBe("Daqui a pouco: Morfológico");

    /* Marcada hoje às 11h: a véspera já passou e as duas horas antes também. */
    expect(lembretesDe(c("h", "2026-10-19T11:00"), AGORA)).toEqual([]);
    /* Hoje às 15h: só o de duas horas antes. */
    expect(lembretesDe(c("h", "2026-10-19T15:00"), AGORA).map((l) => l.id)).toEqual(["h-antes"]);
    /* Sem título, o nome do tipo. */
    expect(lembretesDe(c("e", "2026-10-25T07:00", { tipo: "exame" }), AGORA)[0]!.titulo).toBe(
      "Amanhã: Exames",
    );
  });

  test("a agenda inteira de lembretes vem em ordem e com teto", () => {
    const l = lerAgenda(
      Array.from({ length: 15 }, (_, i) =>
        c(`c${i}`, `2026-11-${String(i + 1).padStart(2, "0")}T10:00`),
      ),
    );
    const ls = lembretesDaAgenda(l, AGORA);
    expect(ls).toHaveLength(20);
    expect(ls[0]!.id).toBe("c0-vespera");
    for (let i = 1; i < ls.length; i++)
      expect(ls[i]!.quando.getTime()).toBeGreaterThanOrEqual(ls[i - 1]!.quando.getTime());
  });

  test("o calendário do mês começa no domingo e fecha a última semana", () => {
    const s = semanasDoMes(2026, 9);
    expect(s[0]).toEqual([null, null, null, null, "2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(s.every((w) => w.length === 7)).toBe(true);
    expect(s.flat().filter(Boolean)).toHaveLength(31);
    expect(
      contagemPorDia([c("a", "2026-10-22T09:00"), c("b", "2026-10-22T15:00")]).get("2026-10-22"),
    ).toBe(2);
  });

  test("a dica da fase vem da régua do site, com o tipo a marcar", () => {
    expect(sugestaoDaFase(20).tipo).toBe("ultrassom");
    expect(sugestaoDaFase(25).tipo).toBe("exame");
    expect(sugestaoDaFase(15).tipo).toBe("consulta");
    expect(sugestaoDaFase(20).texto).toContain("morfológico");
  });
});
