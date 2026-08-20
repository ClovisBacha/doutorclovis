import { describe, expect, test } from "bun:test";
import { deveLigarNaRede, paresDoSeguir } from "./seguir-apos-convite";

const base = {
  indicadoraEmCuidado: false,
  novaEmCuidado: false,
  mesmaPessoa: false,
  bloqueada: false,
};

describe("deveLigarNaRede", () => {
  test("o caso comum liga", () => {
    expect(deveLigarNaRede(base)).toBe(true);
  });

  /* ⚠️ Quem está em luto some da rede sem anunciar; criar um vínculo social
     para dentro do luto é o oposto disso. E vale para as DUAS — a que convidou
     pode ter entrado em Modo Cuidado depois de mandar o link. */
  test("⚠️ Modo Cuidado de qualquer uma das duas cancela", () => {
    expect(deveLigarNaRede({ ...base, indicadoraEmCuidado: true })).toBe(false);
    expect(deveLigarNaRede({ ...base, novaEmCuidado: true })).toBe(false);
  });

  test("a mesma pessoa nunca se segue", () => {
    expect(deveLigarNaRede({ ...base, mesmaPessoa: true })).toBe(false);
  });
});

describe("os pares", () => {
  /* ⚠️ `ativo` nos dois sentidos: perfil fechado não é obstáculo aqui, porque
     `alcancaOPerfil` já deixa passar quem é amiga. `pendente` criaria um pedido
     que a indicadora teria de aceitar — da amiga que ela mesma convidou. */
  test("⚠️ são DOIS, e os dois nascem ativos", () => {
    const p = paresDoSeguir("ind", "nova");
    expect(p).toHaveLength(2);
    expect(p.every((x) => x.estado === "ativo")).toBe(true);
  });

  /* ⚠️ Se a segunda falhar, o estado que sobra é o que ela PEDIU ao convidar. */
  test("⚠️ a da indicadora vem primeiro", () => {
    const [primeiro, segundo] = paresDoSeguir("ind", "nova");
    expect(primeiro).toEqual({ seguidor_id: "ind", seguido_id: "nova", estado: "ativo" });
    expect(segundo).toEqual({ seguidor_id: "nova", seguido_id: "ind", estado: "ativo" });
  });

  test("nenhum par é degenerado", () => {
    for (const p of paresDoSeguir("a", "b")) expect(p.seguidor_id).not.toBe(p.seguido_id);
  });
});

/**
 * ⚠️ O BLOQUEIO CANCELA O SEGUIR — e este era o buraco.
 *
 * `bloquear` desfaz o seguir de propósito, numa ordem escolhida a dedo para que
 * "meio bloqueio" nunca exista. Ligar as duas de volta aqui ressuscitaria
 * exatamente o vínculo que ela desfez, e sem nenhum aviso, porque o bloqueio é
 * calado. O caso é estreito — a recém-chegada acabou de criar a conta —, mas
 * uma conta antiga sem `referred_by` fixado passa por este mesmo caminho.
 */
describe("o bloqueio", () => {
  test("⚠️ bloqueio entre as duas não liga ninguém", () => {
    expect(deveLigarNaRede({ ...base, bloqueada: true })).toBe(false);
  });

  /* ⚠️ E o chamador faz a leitura FALHAR FECHADA: erro de rede vale
     "bloqueada". Um seguir a menos é um incômodo; um seguir por cima de um
     bloqueio não tem conserto, porque ninguém é avisado. */
  test("⚠️ o bloqueio vence até o caso mais comum", () => {
    expect(deveLigarNaRede({ ...base })).toBe(true);
    expect(deveLigarNaRede({ ...base, bloqueada: true })).toBe(false);
  });
});
