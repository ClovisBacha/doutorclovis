import { describe, expect, test } from "bun:test";
import { ferramentasDaGestacao } from "./ferramentas";

describe("quando as ferramentas da gestação aparecem", () => {
  test("pela semana", () => {
    expect(ferramentasDaGestacao({ semanas: 12, cuidado: false, nasceu: false })).toEqual({
      movimentos: false,
      contracoes: false,
    });
    expect(ferramentasDaGestacao({ semanas: 22, cuidado: false, nasceu: false })).toEqual({
      movimentos: false,
      contracoes: true,
    });
    expect(ferramentasDaGestacao({ semanas: 30, cuidado: false, nasceu: false })).toEqual({
      movimentos: true,
      contracoes: true,
    });
  });
  test("Modo Cuidado tira os movimentos e mantém as contrações (socorro)", () => {
    expect(ferramentasDaGestacao({ semanas: 30, cuidado: true, nasceu: false })).toEqual({
      movimentos: false,
      contracoes: true,
    });
  });
  test("depois do parto, nenhuma das duas", () => {
    expect(ferramentasDaGestacao({ semanas: null, cuidado: false, nasceu: true })).toEqual({
      movimentos: false,
      contracoes: false,
    });
  });
  test("semana desconhecida mostra", () => {
    expect(ferramentasDaGestacao({ semanas: null, cuidado: false, nasceu: false }).contracoes).toBe(
      true,
    );
  });
});
