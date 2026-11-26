import { describe, expect, test } from "bun:test";
import { arrumarODiaDoPos, diasDeVoces } from "~/lib/jornada/pos-parto";

describe("o dia do pós-parto na tela", () => {
  test("nada feito: o humor no alto, o desafio em destaque e a leitura na lista", () => {
    expect(arrumarODiaDoPos({}, true)).toEqual({
      perguntarHumor: true,
      destaque: "desafio",
      lista: [{ tarefa: "leitura", feita: false }],
    });
  });

  test("o humor marcado vira uma linha feita, depois das pendentes", () => {
    expect(arrumarODiaDoPos({ humor: true }, true)).toEqual({
      perguntarHumor: false,
      destaque: "desafio",
      lista: [
        { tarefa: "leitura", feita: false },
        { tarefa: "humor", feita: true },
      ],
    });
  });

  test("o desafio feito: a leitura passa ao destaque", () => {
    expect(arrumarODiaDoPos({ humor: true, desafio: true }, true)).toEqual({
      perguntarHumor: false,
      destaque: "leitura",
      lista: [
        { tarefa: "humor", feita: true },
        { tarefa: "desafio", feita: true },
      ],
    });
  });

  test("o dia cheio: nenhum destaque, as três na lista", () => {
    const d = arrumarODiaDoPos({ humor: true, desafio: true, leitura: true }, true);
    expect(d.destaque).toBeNull();
    expect(d.lista.map((l) => l.tarefa)).toEqual(["humor", "desafio", "leitura"]);
    expect(d.lista.every((l) => l.feita)).toBe(true);
  });

  test("sem desafio (fora das 12 semanas), só a leitura", () => {
    expect(arrumarODiaDoPos({}, false)).toEqual({
      perguntarHumor: true,
      destaque: "leitura",
      lista: [],
    });
  });

  test("a etiqueta dos dias: um número só, sem contradizer a semana", () => {
    expect(diasDeVoces(0)).toBe("Nasceu hoje");
    expect(diasDeVoces(1)).toBe("1 dia de vocês");
    expect(diasDeVoces(20)).toBe("20 dias de vocês");
    expect(diasDeVoces(-3)).toBe("Nasceu hoje");
  });
});
