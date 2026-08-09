/**
 * A AGENDA JUNTA TRÊS FONTES SEM MENTIR SOBRE NENHUMA.
 *
 * O risco de unificar não é a grade: é que as três fontes respondem "que dia é
 * isto?" de formas diferentes, e a que responde PIOR é justamente a que já
 * envolveu dinheiro.
 */

import { describe, expect, test } from "bun:test";
import {
  celasDoMes,
  daParticular,
  daTeleconsulta,
  diaLocal,
  doPedido,
  montarAgenda,
  porDia,
} from "./agenda-unificada";

describe("1. o pedido de consulta", () => {
  test("a data CONFIRMADA ganha da preferida", () => {
    /**
     * `preferred_date` é o que ela pediu; `confirmed_date` é o que ficou
     * combinado. Uma auditoria encontrou o Painel e o Calendário discordando
     * exatamente aqui — a mesma consulta aparecia em dois dias diferentes do
     * produto, porque cada tela escolhia um campo.
     */
    const e = doPedido({
      id: "a",
      preferred_date: "2026-08-01",
      preferred_time: "09:00",
      confirmed_date: "2026-08-20",
      confirmed_time: "14:30",
      status: "confirmed",
    })!;
    expect(e.dia).toBe("2026-08-20");
    expect(e.hora).toBe("14:30");
    expect(e.firme).toBe(true);
  });

  test("sem confirmação, cai na preferida — e NÃO é firme", () => {
    /* Pintar um pedido como compromisso faria o médico contar com uma hora que
       ninguém combinou. */
    const e = doPedido({ id: "b", preferred_date: "2026-08-03", status: "pending" })!;
    expect(e.dia).toBe("2026-08-03");
    expect(e.firme).toBe(false);
  });

  test('"manhã" não vira hora', () => {
    /* O campo aceita texto livre. Sem a checagem, a célula mostrava "manhã" no
       lugar do horário e a ordenação comparava isso com "14:30". */
    const e = doPedido({ id: "c", preferred_date: "2026-08-03", preferred_time: "manhã" })!;
    expect(e.hora).toBeNull();
  });

  test("sem data nenhuma, não entra no calendário", () => {
    expect(doPedido({ id: "d", status: "pending" })).toBeNull();
  });

  test("o estado do pagamento vem junto — é o que ele quer ver ao abrir", () => {
    expect(doPedido({ id: "e", preferred_date: "2026-08-03", payment_status: "pago" })!.pago).toBe(
      true,
    );
    expect(
      doPedido({ id: "f", preferred_date: "2026-08-03", payment_status: "sem_cobranca" })!.pago,
    ).toBe(false);
    /* Sem cobrança associada é `null`, não `false`: "não pagou" e "não há o que
       pagar" são coisas diferentes na tela. */
    expect(doPedido({ id: "g", preferred_date: "2026-08-03" })!.pago).toBeNull();
  });
});

describe("2. a teleconsulta", () => {
  test("o dia e a hora saem no fuso de quem olha", () => {
    /**
     * `scheduled_for` é `timestamptz` e chega em UTC. Cortar a string com
     * `slice(11,16)` mostraria a hora UTC — o mesmo erro de três horas que a
     * CRIAÇÃO da teleconsulta já teve nesta base.
     */
    const local = new Date(2026, 7, 10, 20, 0);
    const e = daTeleconsulta({ id: "t", scheduled_for: local.toISOString(), status: "agendada" })!;
    expect(e.dia).toBe(diaLocal(local));
    expect(e.hora).toBe("20:00");
    expect(e.firme).toBe(true);
  });

  test("sem horário marcado, não tem lugar no mês", () => {
    expect(daTeleconsulta({ id: "t2", scheduled_for: null })).toBeNull();
  });
});

describe("3. a consulta particular — a fonte que não tem data marcada", () => {
  test("cai na primeira preferência, e NÃO é firme", () => {
    /**
     * `private_consultations` não guarda data combinada: guarda as preferências
     * dela. Esconder a consulta por isso seria esconder justamente aquela pela
     * qual ele já recebeu. Mostrar a preferência marcada COMO preferência é o
     * meio-termo honesto até o banco ganhar uma data.
     */
    const e = daParticular({
      id: "p",
      preferred_dates: ["2026-08-12", "2026-08-13"],
      status: "confirmado",
      consult_type: "Plantão de dúvidas",
    })!;
    expect(e.dia).toBe("2026-08-12");
    expect(e.firme).toBe(false);
    expect(e.pago).toBe(true);
  });

  test("aguardando pagamento aparece, e diz que aguarda", () => {
    const e = daParticular({
      id: "p2",
      preferred_dates: ["2026-08-12"],
      status: "pendente_pagamento",
    })!;
    expect(e.pago).toBe(false);
    expect(e.situacao).toContain("Aguardando");
  });
});

describe("4. as três juntas", () => {
  const agenda = montarAgenda({
    pedidos: [{ id: "1", preferred_date: "2026-08-10", preferred_time: "15:00" }],
    teleconsultas: [
      { id: "2", scheduled_for: new Date(2026, 7, 10, 9, 0).toISOString(), status: "agendada" },
    ],
    particulares: [{ id: "3", preferred_dates: ["2026-08-10"], status: "confirmado" }],
  });

  test("ordena por dia e hora, com o sem-hora no fim", () => {
    /* O que ainda não tem lugar marcado vai para o fim do dia — senão empurra
       para baixo o compromisso que tem hora. */
    expect(agenda.map((e) => e.tipo)).toEqual(["teleconsulta", "presencial", "particular"]);
  });

  test("agrupa por dia sem perder ninguém", () => {
    const m = porDia(agenda);
    expect(m.get("2026-08-10")?.length).toBe(3);
  });
});

describe("5. a grade do mês", () => {
  test("sempre semanas inteiras, começando no domingo", () => {
    for (const [ano, mes] of [
      [2026, 7],
      [2026, 1],
      [2024, 1],
    ] as const) {
      const celas = celasDoMes(ano, mes);
      expect(celas.length % 7).toBe(0);
      expect(celas[0].data.getDay()).toBe(0);
    }
  });

  test("todo dia do mês aparece exatamente uma vez", () => {
    /* A cauda do mês anterior e a cabeça do seguinte entram para a grade não
       ter buraco — mas nenhum dia DO MÊS pode faltar nem repetir. */
    const celas = celasDoMes(2026, 7);
    const doMes = celas.filter((c) => c.doMes).map((c) => c.data.getDate());
    expect(doMes).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });

  test("fevereiro de ano bissexto tem os 29", () => {
    const celas = celasDoMes(2024, 1).filter((c) => c.doMes);
    expect(celas.length).toBe(29);
  });
});
