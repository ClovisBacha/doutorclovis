import { describe, expect, test } from "bun:test";
import { atividadesSemRecibo, bonusResolvido, diasDaReconciliacao } from "./reconciliacao";

describe("a reconciliação da aba", () => {
  test("hoje e ontem — a janela de ±1 dia do servidor —, nunca antes do dia 7", () => {
    expect(diasDaReconciliacao(171)).toEqual([171, 170]);
    expect(diasDaReconciliacao(7)).toEqual([7]);
  });

  test("paga só o que está marcado aqui e o servidor não registrou", () => {
    const flags = { desafio: true, w_movement: true, w_gratitude: true };
    expect(atividadesSemRecibo(flags, ["movement"])).toEqual(["gratitude"]);
    expect(atividadesSemRecibo(flags, ["movement", "gratitude"])).toEqual([]);
  });

  test("o zero do bônus só é final com as quatro atividades no servidor", () => {
    expect(bonusResolvido(["movement", "meditation", "bonding", "gratitude"], [])).toBe(true);
    expect(bonusResolvido(["movement", "meditation", "bonding"], ["gratitude"])).toBe(true);
    /* O pagamento da quarta falhou agora: o zero é provisório. */
    expect(bonusResolvido(["movement", "meditation", "bonding"], [])).toBe(false);
  });
});
