/**
 * "IGNORAR" NÃO PODE SIGNIFICAR "NUNCA MAIS".
 *
 * A busca que reencontra uma lacuna casa por texto normalizado SEM filtrar
 * status, então uma lacuna ignorada continua sendo achada e o `hits` continua
 * subindo. Mas só `respondida` volta para `aberta`, e a fila do painel lê
 * `status = 'aberta'`.
 *
 * O médico ignorava "posso pintar o cabelo?" quando UMA paciente tinha
 * perguntado. Duzentas depois, o contador dizia 201 e ele nunca mais via
 * aquilo — enquanto cada uma das 200 ouvia da IA "registrei aqui para ele ver",
 * uma promessa que se tornou impossível de cumprir no clique dele.
 *
 * O que está sob teste é o juízo que decide o que reaparece. Ele tem dois lados
 * caros e opostos:
 *
 *   · voltar de menos → o defeito original continua, só que mais escondido;
 *   · voltar demais → ignorar deixa de significar alguma coisa, o médico
 *     aprende que o botão não funciona, e a fila vira ruído que ele ignora
 *     inteira. Uma fila em que ele não confia é pior que uma fila curta.
 */

import { describe, expect, test } from "bun:test";
import { LACUNA_VOLTA_APOS, ignoradasQueVoltaram } from "./secondbrain.functions";

type Linha = Parameters<typeof ignoradasQueVoltaram>[0][number];

const g = (id: string, hits: number, hits_ao_ignorar: number | null): Linha =>
  ({
    id,
    question: `pergunta ${id}`,
    channel: "app",
    hits,
    status: "ignorada",
    updated_at: "2026-08-01T00:00:00.000Z",
    hits_ao_ignorar,
  }) as Linha;

describe("só volta o que ganhou gente DEPOIS", () => {
  test("ignorada com 20 perguntas, e nenhuma nova, não volta", () => {
    /* O caso que protege a decisão dele: ele ignorou justamente PORQUE já eram
       muitas. Contar `hits` cru faria essa voltar na hora seguinte, e o botão
       "ignorar" viraria decoração. */
    expect(ignoradasQueVoltaram([g("a", 20, 20)])).toEqual([]);
  });

  test("ignorada com 1, e mais 3 perguntaram, volta", () => {
    const r = ignoradasQueVoltaram([g("a", 1 + LACUNA_VOLTA_APOS, 1)]);
    expect(r).toHaveLength(1);
    expect(r[0]?.perguntaramDepois).toBe(LACUNA_VOLTA_APOS);
  });

  test("uma abaixo do limiar ainda não volta", () => {
    expect(ignoradasQueVoltaram([g("a", LACUNA_VOLTA_APOS, 1)])).toEqual([]);
  });

  test("o limiar é exatamente o corte, não um a mais", () => {
    // `>=`, não `>`: um fora-por-um aqui atrasa toda lacuna em uma paciente.
    expect(ignoradasQueVoltaram([g("a", 10, 10 - LACUNA_VOLTA_APOS)])).toHaveLength(1);
  });

  /* ─── OS NÚMEROS AQUI SÃO LITERAIS, DE PROPÓSITO ────────────────────────
     Todos os testes acima derivam de `LACUNA_VOLTA_APOS`, então trocar a
     constante por 1 os mantinha todos verdes — e "ignorar" deixaria de
     significar qualquer coisa sem uma única falha. Foi medido: a mutação
     sobreviveu.
     É a mesma armadilha que deixou trocar os dois cortes de similaridade por
     0,99 com a suíte inteira passando. Um teste que só reafirma a constante
     descreve o código, não o produto. */
  test("UMA repetição isolada não traz de volta — senão o botão vira decoração", () => {
    expect(ignoradasQueVoltaram([g("a", 6, 5)])).toEqual([]);
  });

  test("DUAS ainda não — pode ser a mesma paciente voltando", () => {
    expect(ignoradasQueVoltaram([g("a", 7, 5)])).toEqual([]);
  });

  test("TRÊS pessoas diferentes é padrão, e padrão é o que a fila mostra", () => {
    expect(ignoradasQueVoltaram([g("a", 8, 5)])).toHaveLength(1);
  });
});

describe("a marca ausente é tratada pelo lado seguro", () => {
  test("hits_ao_ignorar null conta como 0 — ela reaparece uma vez", () => {
    /* `null` = ignorada antes da coluna existir. O outro caminho seria
       escondê-la para sempre, que é o defeito que este código conserta.
       Reaparecendo, ignorar de novo já grava a marca e ela sossega. */
    const r = ignoradasQueVoltaram([g("antiga", 9, null)]);
    expect(r).toHaveLength(1);
    expect(r[0]?.perguntaramDepois).toBe(9);
  });

  test("null com poucas perguntas continua fora", () => {
    expect(ignoradasQueVoltaram([g("antiga", LACUNA_VOLTA_APOS - 1, null)])).toEqual([]);
  });
});

describe("ordem e escala", () => {
  test("a mais pedida DEPOIS vem primeiro — não a com mais hits no total", () => {
    /* Ordenar por `hits` cru poria no topo a que ele já decidiu não responder.
       O que importa é a pressão NOVA. */
    const r = ignoradasQueVoltaram([
      g("muitos-hits-nada-novo", 500, 495),
      g("poucos-hits-tudo-novo", 12, 0),
    ]);
    expect(r.map((x) => x.id)).toEqual(["poucos-hits-tudo-novo", "muitos-hits-nada-novo"]);
  });

  test("lista vazia não inventa nada", () => {
    expect(ignoradasQueVoltaram([])).toEqual([]);
  });

  test("hits ausente não quebra a conta", () => {
    // Linha antiga sem contador: 0 - 0 = 0, fica de fora, sem NaN na tela.
    const r = ignoradasQueVoltaram([{ ...g("x", 0, null), hits: undefined } as unknown as Linha]);
    expect(r).toEqual([]);
  });
});
