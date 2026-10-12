import { describe, expect, test } from "bun:test";
import {
  contarMomentos,
  diasComAlgumMomento,
  flagsDoDia,
  marcarMomento,
  sementesDaAula,
  type Blob,
} from "./momentos";
import { chama, estadoDoNo, explicacaoDaChama } from "./trilha";

describe("marcar um momento", () => {
  test("grava no formato do site e não muta o blob antigo", () => {
    const antes: Blob = { "dc-path-day-171": { desafio: true } };
    const r = marcarMomento(antes, 171, "movement");
    expect(r.jaEstava).toBe(false);
    expect(r.fechouAgora).toBe(false);
    expect(r.blob["dc-path-day-171"]).toEqual({ desafio: true, w_movement: true, bemestar: true });
    expect(antes["dc-path-day-171"]).toEqual({ desafio: true });
  });

  test("a aula grava `desafio` e não acende o legado bemestar", () => {
    const r = marcarMomento({}, 171, "aula");
    expect(r.blob["dc-path-day-171"]).toEqual({ desafio: true });
  });

  test("marcar de novo não muda nada (mesma referência)", () => {
    const b: Blob = { "dc-path-day-171": { w_gratitude: true } };
    const r = marcarMomento(b, 171, "gratitude");
    expect(r.jaEstava).toBe(true);
    expect(r.blob).toBe(b);
  });

  test("o quinto momento fecha o dia: entra nos feitos e solta a figurinha da semana", () => {
    let b: Blob = { "dc-path-done-days": [160], "dc-path-stickers": [22] };
    for (const m of ["aula", "movement", "meditation", "bonding"] as const) {
      const r = marcarMomento(b, 171, m);
      expect(r.fechouAgora).toBe(false);
      b = r.blob;
    }
    const ultimo = marcarMomento(b, 171, "gratitude");
    expect(ultimo.fechouAgora).toBe(true);
    expect(ultimo.blob["dc-path-done-days"]).toEqual([160, 171]);
    expect(ultimo.blob["dc-path-stickers"]).toEqual([22, 24]);
  });

  test("dia que já estava nos feitos não fecha duas vezes", () => {
    const b: Blob = {
      "dc-path-done-days": [171],
      "dc-path-day-171": { desafio: true, w_movement: true, w_meditation: true, w_bonding: true },
    };
    expect(marcarMomento(b, 171, "gratitude").fechouAgora).toBe(false);
  });

  test("no pós-parto grava na chave própria e nunca fecha a gestação", () => {
    const r = marcarMomento({}, 27, "aula", { pos: true });
    expect(r.blob["dc-path-pos-day-27"]).toEqual({ desafio: true });
    expect(r.blob["dc-path-done-days"]).toBeUndefined();
  });
});

describe("contagem", () => {
  test("cinco momentos: a aula e as quatro atividades; humor e bemestar não contam", () => {
    expect(contarMomentos({ desafio: true, humor: true, bemestar: true })).toBe(1);
    expect(
      contarMomentos({
        desafio: true,
        w_movement: true,
        w_meditation: true,
        w_bonding: true,
        w_gratitude: true,
      }),
    ).toBe(5);
  });

  test("flags corrompidas viram vazio", () => {
    expect(flagsDoDia({ "dc-path-day-5": "lixo" }, 5)).toEqual({});
    expect(flagsDoDia({ "dc-path-day-5": { desafio: "sim" } }, 5)).toEqual({});
  });

  test("dias com algum momento: só chaves numéricas, só com alguma flag verdadeira", () => {
    const b: Blob = {
      "dc-path-day-170": { w_movement: true },
      "dc-path-day-171": { w_movement: false },
      "dc-path-day-notas": { x: true },
      "dc-path-day-169": "lixo",
      "dc-path-pos-day-9": { desafio: true },
    };
    expect(diasComAlgumMomento(b)).toEqual([170]);
    expect(diasComAlgumMomento(b, true)).toEqual([9]);
  });

  test("a promessa da aula: 5 + 3 por acerto", () => {
    expect(sementesDaAula(0)).toBe(5);
    expect(sementesDaAula(4)).toBe(17);
  });
});

describe("a trilha e a chama", () => {
  const b: Blob = {
    "dc-path-done-days": [169],
    "dc-path-day-169": { desafio: true },
    "dc-path-day-170": { desafio: true, w_movement: true },
  };
  test("nós: futuro, passado fechado, passado parcial, hoje", () => {
    expect(estadoDoNo(b, 172, 171)).toEqual({ tipo: "futuro" });
    expect(estadoDoNo(b, 169, 171)).toEqual({ tipo: "passado", momentos: 5, fechado: true });
    expect(estadoDoNo(b, 170, 171)).toEqual({ tipo: "passado", momentos: 2, fechado: false });
    expect(estadoDoNo(b, 171, 171)).toEqual({ tipo: "hoje", momentos: 0, fechado: false });
  });

  test("a chama conta até ontem quando hoje ainda está em branco", () => {
    expect(chama(b, 171).dias).toBe(2);
  });

  test("um dia em branco é perdoado depois de sete seguidos", () => {
    const longo: Blob = {};
    for (let d = 160; d <= 169; d++) longo[`dc-path-day-${d}`] = { desafio: true };
    // 170 em branco, 171 feito
    longo["dc-path-day-171"] = { w_gratitude: true };
    const c = chama(longo, 171);
    expect(c.dias).toBe(11);
    expect(c.perdoes).toBe(0);
  });

  test("a explicação fala do perdão e do saldo sem cobrar", () => {
    const t = explicacaoDaChama(14, 2).join(" ");
    expect(t).toContain("14 dias seguidos");
    expect(t).toContain("2 perdões guardados");
    expect(explicacaoDaChama(0, 0).join(" ")).not.toContain("perdão guardado");
  });
});
