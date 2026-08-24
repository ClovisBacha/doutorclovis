/**
 * O FILTRO NÃO PODE ESCONDER UMA PACIENTE QUE ESTÁ ALI.
 *
 * Um filtro de busca falha de um jeito só, e é o pior possível: ele diz
 * "nenhuma paciente" para uma paciente que existe. O médico não tem como saber
 * que o problema é o filtro — ele conclui que a paciente sumiu do sistema.
 */

import { describe, expect, test } from "bun:test";
import { filtrarPacientes, normalizar } from "./busca-paciente";

const LISTA = [
  { display_name: "Jéssica Conceição" },
  { display_name: "Ana Paula da Silva" },
  { display_name: "ANA BEATRIZ" },
  { display_name: null },
];

describe("1. acento não pode esconder ninguém", () => {
  test("digitado sem acento acha o nome com acento", () => {
    /* Quem procura com pressa digita "jessica". Um `includes` cru devolveria
       lista vazia para uma paciente que está na tela. */
    expect(filtrarPacientes(LISTA, "jessica")).toEqual([{ display_name: "Jéssica Conceição" }]);
    expect(filtrarPacientes(LISTA, "conceicao")).toEqual([{ display_name: "Jéssica Conceição" }]);
  });

  test("e o contrário também: digitado COM acento acha o nome sem", () => {
    /* Metade dos cadastros vem sem acento — a paciente digitou o próprio nome
       no celular. A normalização vale dos DOIS lados da comparação. */
    expect(filtrarPacientes([{ display_name: "Jessica" }], "Jéssica")).toHaveLength(1);
  });

  test("o cedilha vira C, e nenhuma letra se perde no caminho", () => {
    expect(normalizar("Conceição")).toBe("conceicao");
    expect(normalizar("  ÂNGELA  ")).toBe("angela");
    /* A régua remove SÓ as marcas combinantes. Se a faixa estivesse errada e
       comesse letras, "angela" viraria "ngela" e nada mais casaria. */
    expect(normalizar("João Gonçalves").length).toBe("João Gonçalves".length);
  });
});

describe("2. o que o médico digita", () => {
  test("busca por parte do nome, não só pelo começo", () => {
    /* Ele lembra do sobrenome. Um `startsWith` obrigaria a lembrar do primeiro
       nome, que é justamente o que se esquece numa lista de duzentas. */
    expect(filtrarPacientes(LISTA, "silva")).toEqual([{ display_name: "Ana Paula da Silva" }]);
  });

  test("as palavras podem vir em qualquer ordem", () => {
    /* "silva ana" é como as pessoas lembram de nome composto. */
    expect(filtrarPacientes(LISTA, "silva ana")).toEqual([{ display_name: "Ana Paula da Silva" }]);
  });

  test("cada palavra precisa aparecer — não basta uma delas", () => {
    /* Se bastasse uma, "ana silva" traria as duas Anas, e o filtro pararia de
       filtrar justamente quando ele digita mais para restringir. */
    const r = filtrarPacientes(LISTA, "ana silva");
    expect(r).toHaveLength(1);
    expect(r[0].display_name).toBe("Ana Paula da Silva");
  });

  test("caixa não importa", () => {
    expect(filtrarPacientes(LISTA, "BEATRIZ")).toHaveLength(1);
    expect(filtrarPacientes(LISTA, "beatriz")).toHaveLength(1);
  });
});

describe("3. o vazio e o esquisito", () => {
  test("termo vazio devolve a lista INTEIRA", () => {
    /**
     * O erro que faria o médico achar que perdeu tudo: um filtro que devolve
     * nada quando ninguém digitou nada é uma tela vazia sem explicação.
     */
    expect(filtrarPacientes(LISTA, "")).toHaveLength(LISTA.length);
    expect(filtrarPacientes(LISTA, "   ")).toHaveLength(LISTA.length);
  });

  test("paciente sem nome não quebra a busca — só não é encontrada por nome", () => {
    /* `display_name` é nulo em cadastro recém-criado. Antes de virar `?? ""`
       isto seria `null.normalize` e a tela inteira caía. */
    expect(() => filtrarPacientes(LISTA, "ana")).not.toThrow();
    expect(filtrarPacientes(LISTA, "ana").every((p) => p.display_name !== null)).toBe(true);
  });

  test("busca sem resultado devolve lista vazia, e não a lista toda", () => {
    /* O oposto do defeito acima: um filtro que ignora o termo quando não acha
       nada mostraria duzentas pacientes como se todas casassem. */
    expect(filtrarPacientes(LISTA, "zzz")).toEqual([]);
  });
});
