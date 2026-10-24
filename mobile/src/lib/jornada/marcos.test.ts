import { describe, expect, test } from "bun:test";
import { festaDoExtrato, marcarVistos, marcoDoLancamento } from "./marcos";

const agora = new Date("2026-10-18T15:00:00Z");
const l = (reason: string, amount: number, created_at = "2026-10-18T12:00:00Z") => ({
  reason,
  amount,
  created_at,
});

describe("os marcos do calendário, lidos do extrato", () => {
  test("os quatro motivos que o servidor grava", () => {
    expect(marcoDoLancamento(l("Semana 22 🎉", 25))).toMatchObject({ tipo: "semana", semana: 22 });
    expect(marcoDoLancamento(l("Fim do 1º trimestre 🎊", 100))).toMatchObject({
      tipo: "trimestre",
      trimestre: 1,
    });
    expect(marcoDoLancamento(l("Bem-vindo ao mundo 🍼", 100))).toMatchObject({
      tipo: "nascimento",
    });
    expect(marcoDoLancamento(l("Bebê com 2 meses 🎉", 25))).toMatchObject({
      tipo: "mes",
      meses: 2,
    });
    expect(marcoDoLancamento(l("Bebê com 1 mês 🎉", 25))).toMatchObject({ tipo: "mes", meses: 1 });
  });

  test("o resto do extrato não é marco (atividade, conquista, gasto)", () => {
    expect(marcoDoLancamento(l("wellness:meditation", 5))).toBeNull();
    expect(marcoDoLancamento(l("spend:cantinho:planta-vaso", -60))).toBeNull();
    expect(marcoDoLancamento(l("Semana 22 🎉", -25))).toBeNull();
  });

  test("a semana 13 chega com o fim do trimestre: o título é o trimestre, a soma é das duas", () => {
    const f = festaDoExtrato(
      [l("Semana 13 🎉", 25), l("Fim do 1º trimestre 🎊", 100), l("wellness:movement", 5)],
      [],
      agora,
    );
    expect(f?.principal.tipo).toBe("trimestre");
    expect(f?.sementinhas).toBe(125);
    expect(f?.chaves.length).toBe(2);
  });

  test("o que ela já viu não volta, e marco velho (quem atualizou o app) não vira festa", () => {
    const semana = l("Semana 22 🎉", 25);
    const f = festaDoExtrato([semana], [], agora)!;
    expect(festaDoExtrato([semana], marcarVistos([], f.chaves), agora)).toBeNull();
    expect(festaDoExtrato([l("Semana 10 🎉", 25, "2026-08-01T12:00:00Z")], [], agora)).toBeNull();
  });

  test("a lista de vistos não cresce sem fim", () => {
    let v: string[] = [];
    for (let i = 0; i < 60; i++) v = marcarVistos(v, [`m${i}`]);
    expect(v.length).toBe(40);
    expect(v.at(-1)).toBe("m59");
  });
});
