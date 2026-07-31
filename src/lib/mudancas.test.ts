/**
 * "O que mudou desde a última consulta?"
 *
 * É a pergunta que o obstetra faz toda vez, e a que o sistema não conseguia
 * responder. A conta é pura — recebe os eventos e a data-âncora — e é
 * exatamente o tipo de lógica que erra em silêncio: um `>` no lugar de `>=`
 * esconde o registro feito no dia da consulta, e ninguém percebe até alguém
 * perguntar por que a pressão de 175/115 daquela manhã não aparece.
 */

import { describe, expect, test } from "bun:test";
import { mudancasDesde, type EventoClinico } from "./clinical.functions";

const PACIENTE = "11111111-1111-1111-1111-111111111111";

function ev(over: Partial<EventoClinico> & { ocorrido_em: string }): EventoClinico {
  return {
    fonte: "health_logs",
    fonte_id: crypto.randomUUID(),
    user_id: PACIENTE,
    especie: "medida",
    dados: {},
    texto: null,
    gravidade: "normal",
    notas: [],
    tratado_em: null,
    ...over,
  };
}

const CONSULTA = "2026-07-15T14:00:00.000Z";

describe("recorte pela data da consulta", () => {
  test("o que veio antes fica fora", () => {
    const m = mudancasDesde(
      [
        ev({ ocorrido_em: "2026-07-10T10:00:00.000Z" }),
        ev({ ocorrido_em: "2026-07-20T10:00:00.000Z" }),
      ],
      CONSULTA,
    );
    expect(m.registros).toBe(1);
  });

  /* O registro feito NO DIA da consulta, depois dela, é o mais importante de
     todos — é o que aconteceu logo depois de ele mandá-la para casa. Um `>` em
     vez de `>=` no instante exato o perderia. */
  test("o instante exato da consulta conta como depois", () => {
    const m = mudancasDesde([ev({ ocorrido_em: CONSULTA })], CONSULTA);
    expect(m.registros).toBe(1);
  });

  test("sem consulta anterior, tudo é novidade — é a primeira consulta", () => {
    const m = mudancasDesde(
      [
        ev({ ocorrido_em: "2025-01-01T00:00:00.000Z" }),
        ev({ ocorrido_em: "2026-07-20T00:00:00.000Z" }),
      ],
      null,
    );
    expect(m.registros).toBe(2);
  });

  test("data ilegível não derruba a conta nem entra", () => {
    const m = mudancasDesde(
      [ev({ ocorrido_em: "ontem" }), ev({ ocorrido_em: "2026-07-20T00:00:00.000Z" })],
      CONSULTA,
    );
    expect(m.registros).toBe(1);
  });
});

describe("separação por natureza", () => {
  const eventos = [
    ev({
      ocorrido_em: "2026-07-20T10:00:00.000Z",
      gravidade: "grave",
      notas: ["Pressão em faixa grave"],
      dados: { systolic: 175, diastolic: 115 },
    }),
    ev({ ocorrido_em: "2026-07-19T10:00:00.000Z", especie: "emergencia", gravidade: "grave" }),
    ev({
      ocorrido_em: "2026-07-18T10:00:00.000Z",
      especie: "pergunta",
      dados: { respondida: false },
      texto: "posso tomar dipirona?",
    }),
    ev({ ocorrido_em: "2026-07-17T10:00:00.000Z", especie: "exame", dados: { nome: "USG" } }),
    ev({ ocorrido_em: "2026-07-16T10:00:00.000Z" }),
  ];

  test("cada coisa no seu lugar", () => {
    const m = mudancasDesde(eventos, CONSULTA);
    expect(m.registros).toBe(5);
    expect(m.episodios).toHaveLength(1);
    expect(m.perguntasAbertas).toHaveLength(1);
    expect(m.exames).toHaveLength(1);
  });

  /* O SOS não pode aparecer duas vezes — uma como episódio e outra como
     alteração. Numa tela que existe para dar peso ao que importa, contar o
     mesmo evento duas vezes é inflar o alarme. */
  test("emergência é episódio e NÃO se repete em alterações", () => {
    const m = mudancasDesde(eventos, CONSULTA);
    expect(m.alteracoes.some((e) => e.especie === "emergencia")).toBe(false);
    expect(m.alteracoes).toHaveLength(1);
  });

  test("pergunta já respondida não fica pendurada", () => {
    const m = mudancasDesde(
      [
        ev({
          ocorrido_em: "2026-07-20T00:00:00.000Z",
          especie: "pergunta",
          dados: { respondida: true },
        }),
      ],
      CONSULTA,
    );
    expect(m.perguntasAbertas).toHaveLength(0);
  });
});

describe("ordem das alterações", () => {
  test("grave antes de atenção, e o mais recente antes dentro da mesma cor", () => {
    const m = mudancasDesde(
      [
        ev({
          ocorrido_em: "2026-07-16T00:00:00.000Z",
          gravidade: "atencao",
          notas: ["antiga atenção"],
        }),
        ev({
          ocorrido_em: "2026-07-17T00:00:00.000Z",
          gravidade: "grave",
          notas: ["grave antiga"],
        }),
        ev({
          ocorrido_em: "2026-07-20T00:00:00.000Z",
          gravidade: "grave",
          notas: ["grave de hoje"],
        }),
      ],
      CONSULTA,
    );
    expect(m.alteracoes[0].notas[0]).toBe("grave de hoje");
    expect(m.alteracoes[1].notas[0]).toBe("grave antiga");
    expect(m.alteracoes[2].notas[0]).toBe("antiga atenção");
  });
});

describe("variação de peso", () => {
  /* Ganho ponderal súbito é sinal de pré-eclâmpsia — e a comparação só existe
     se o peso da consulta anterior estiver lá. */
  test("compara o registro mais recente com o peso aferido na consulta", () => {
    const m = mudancasDesde(
      [
        ev({ ocorrido_em: "2026-07-20T00:00:00.000Z", dados: { weight_kg: 76.5 } }),
        ev({ ocorrido_em: "2026-07-18T00:00:00.000Z", dados: { weight_kg: 74 } }),
      ],
      CONSULTA,
      72.4,
    );
    expect(m.deltaPeso).toBe(4.1);
  });

  test("sem peso na consulta anterior, não inventa comparação", () => {
    const m = mudancasDesde(
      [ev({ ocorrido_em: "2026-07-20T00:00:00.000Z", dados: { weight_kg: 76.5 } })],
      CONSULTA,
    );
    expect(m.deltaPeso).toBeNull();
  });

  test("sem registro de peso no período, também não inventa", () => {
    const m = mudancasDesde([ev({ ocorrido_em: "2026-07-20T00:00:00.000Z" })], CONSULTA, 72.4);
    expect(m.deltaPeso).toBeNull();
  });
});

describe("período sem nada", () => {
  /* Zero registros é informação — quer dizer que ela não abriu o app desde a
     consulta —, e é diferente de "não consegui ler". A tela precisa poder
     distinguir, então a conta nunca pode inventar um número aqui. */
  test("nenhum evento devolve zero, não indefinido", () => {
    const m = mudancasDesde([], CONSULTA);
    expect(m.registros).toBe(0);
    expect(m.alteracoes).toHaveLength(0);
    expect(m.deltaPeso).toBeNull();
  });
});
