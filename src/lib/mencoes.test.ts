/**
 * O `@` E A `#`, MEDIDOS.
 *
 * As regras de troca e de quem menciona foram copiadas do Instagram por pedido
 * do dono, e VERIFICADAS na documentação — não lembradas. Os testes travam os
 * números para que uma "simplificação" futura não os desfaça em silêncio.
 */

import { describe, expect, test } from "bun:test";
import {
  JANELA_DE_TROCA_DIAS,
  QUEM_MENCIONA_PADRAO,
  TROCAS_POR_JANELA,
  acharMencoes,
  acharTags,
  podeMencionar,
  podeTrocarHandle,
  recusaDoHandle,
  reservaVencida,
} from "./mencoes";

const AGORA = new Date("2026-08-24T12:00:00Z");
const diasAtras = (n: number) => new Date(AGORA.getTime() - n * 86400_000).toISOString();

describe("o @ em si", () => {
  test("aceita o que o Instagram aceita", () => {
    for (const h of ["marina", "marina.costa", "ana_2026", "m"]) {
      expect({ h, r: recusaDoHandle(h) }).toEqual({ h, r: null });
    }
  });

  test("recusa o que não cabe", () => {
    expect(recusaDoHandle("")).toBe("curto");
    expect(recusaDoHandle("a".repeat(31))).toBe("longo");
    expect(recusaDoHandle("maria silva")).toBe("caracteres");
    expect(recusaDoHandle("maria@casa")).toBe("caracteres");
  });

  test("⚠️ só pontos é o truque clássico de personificação", () => {
    /* `@.....` ao lado de `@obstetrica` é um nome invisível na tela. */
    expect(recusaDoHandle("....")).toBe("so_pontos");
    expect(recusaDoHandle("._._.")).toBe("so_pontos");
  });

  test("⚠️ os reservados barram a conta que finge ser do consultório", () => {
    /* Uma conta que PARECE do consultório dando conselho é o pior desfecho
       social possível neste app. */
    expect(recusaDoHandle("obstetrica")).toBe("reservado");
    expect(recusaDoHandle("SUPORTE")).toBe("reservado");
    expect(recusaDoHandle("drclovis")).toBe("reservado");
  });
});

describe("⚠️ a troca — duas a cada 14 dias, como o Instagram", () => {
  test("os números são os do Instagram, e ficam travados", () => {
    expect(TROCAS_POR_JANELA).toBe(2);
    expect(JANELA_DE_TROCA_DIAS).toBe(14);
  });

  test("a terceira troca na janela é recusada", () => {
    expect(podeTrocarHandle([], AGORA)).toBe(true);
    expect(podeTrocarHandle([diasAtras(1)], AGORA)).toBe(true);
    expect(podeTrocarHandle([diasAtras(1), diasAtras(3)], AGORA)).toBe(false);
  });

  test("⚠️ a janela é CORRIDA, não por quinzena de calendário", () => {
    /* Com quinzena, quem trocasse duas vezes no dia 14 trocaria mais duas no
       dia 15 — quatro em dois dias, que é o que o limite existe para impedir. */
    expect(podeTrocarHandle([diasAtras(15), diasAtras(16)], AGORA)).toBe(true);
    expect(podeTrocarHandle([diasAtras(13), diasAtras(16)], AGORA)).toBe(true);
    expect(podeTrocarHandle([diasAtras(13), diasAtras(12)], AGORA)).toBe(false);
  });

  test("⚠️ o @ antigo fica reservado 14 dias", () => {
    /* Sem a reserva, alguém troca de @, um estranho pega o antigo, e um post de
       três meses atrás passa a mencionar quem nunca esteve lá. */
    expect(reservaVencida(diasAtras(13), AGORA)).toBe(false);
    expect(reservaVencida(diasAtras(15), AGORA)).toBe(true);
  });
});

describe("⚠️ quem pode mencionar — as três opções do Instagram", () => {
  test("o padrão é Todos, como lá", () => {
    expect(QUEM_MENCIONA_PADRAO).toBe("todos");
    expect(podeMencionar({ config: "todos", mencionadaSegueQuemMenciona: false })).toBe(true);
  });

  test("Ninguém fecha para todo mundo", () => {
    expect(podeMencionar({ config: "ninguem", mencionadaSegueQuemMenciona: true })).toBe(false);
  });

  test('⚠️ "Sigo" é quem ELA segue, e não quem a segue', () => {
    /* É o que confunde no Instagram e é fácil de inverter: invertido, qualquer
       seguidora recém-chegada poderia mencioná-la, e a chave não protegeria de
       nada. */
    expect(podeMencionar({ config: "sigo", mencionadaSegueQuemMenciona: true })).toBe(true);
    expect(podeMencionar({ config: "sigo", mencionadaSegueQuemMenciona: false })).toBe(false);
  });
});

describe("achar no texto", () => {
  test("acha as menções e normaliza", () => {
    expect(acharMencoes("oi @Marina e @ana_2026!")).toEqual(["marina", "ana_2026"]);
  });

  test("⚠️ NÃO casa dentro de e-mail", () => {
    /* Sem o limite à esquerda, todo e-mail numa legenda viraria menção a
       `@gmail`. */
    expect(acharMencoes("me chama em fulana@gmail.com")).toEqual([]);
  });

  test("a mesma menção duas vezes conta uma", () => {
    expect(acharMencoes("@ana e de novo @ana")).toEqual(["ana"]);
  });

  test("menção inválida não vira consulta ao banco", () => {
    expect(acharMencoes("olha @..... aqui")).toEqual([]);
  });

  test("⚠️ a TAG aceita acento — é como as pacientes escrevem", () => {
    /* Uma regex `[a-z0-9]` cortaria no acento e criaria `#gesta`, que é uma tag
       que ninguém quis. */
    expect(acharTags("#gestação #gêmeos #mãedemenina")).toEqual([
      "gestação",
      "gêmeos",
      "mãedemenina",
    ]);
  });

  test("⚠️ só número não é assunto", () => {
    /* `#2026` viraria a tag mais usada do app. */
    expect(acharTags("#2026 #enxoval")).toEqual(["enxoval"]);
  });

  test("não casa dentro de URL nem em sequência de #", () => {
    expect(acharTags("veja em site.com/x#ancora")).toEqual([]);
    expect(acharTags("##dupla")).toEqual([]);
  });
});
