/**
 * A CONSULTA PARTICULAR GANHOU DATA E HORA.
 *
 * Era a única das três fontes da agenda que não sabia dizer QUANDO acontece: o
 * banco guardava `preferred_dates` — o que a PACIENTE preferiria — e nada sobre
 * o que ficou combinado.
 *
 * O risco de consertar isso não é a coluna: é o fuso. O campo que o médico
 * digita (`datetime-local`) devolve "hora de parede", sem fuso nenhum, e mandá-la
 * crua para uma coluna `timestamptz` faz o Postgres lê-la como UTC — três horas
 * de erro em toda consulta marcada no Brasil. Esse defeito já aconteceu nesta
 * base, na criação da teleconsulta. Por isso metade deste arquivo é sobre a
 * travessia navegador → servidor, e não sobre a agenda.
 */

/* ─── O FUSO DO TESTE É PARTE DO TESTE ──────────────────────────────────────
   A CI roda em UTC. Em UTC, "hora local" e "hora UTC" são a mesma coisa — e
   todo teste de fuso passa sozinho, inclusive contra o código errado. Fixar São
   Paulo (UTC−3 o ano inteiro desde que o Brasil acabou com o horário de verão)
   é o que faz o defeito de três horas ter onde aparecer. */
process.env.TZ = "America/Sao_Paulo";

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { daParticular, deCampoLocal, paraCampoLocal } from "./agenda-unificada";

describe("1. o horário combinado ganha da preferência", () => {
  test("com `scheduled_for`, a consulta vira compromisso de verdade", () => {
    /**
     * Mesma régua do pedido de consulta: o que ficou combinado manda sobre o
     * que ela pediu. Sem isto, o médico veria a consulta no dia que ela sugeriu
     * — e não naquele em que ele a marcou.
     */
    const quando = new Date(2026, 7, 20, 14, 30).toISOString();
    const e = daParticular({
      id: "a",
      consult_type: "Consulta Completa",
      preferred_dates: ["2026-08-01", "2026-08-02"],
      scheduled_for: quando,
      status: "confirmado",
    })!;
    expect(e.dia).toBe("2026-08-20");
    expect(e.hora).toBe("14:30");
    expect(e.firme).toBe(true);
    expect(e.pago).toBe(true);
  });

  test("sem `scheduled_for`, cai na primeira preferência — marcada COMO preferência", () => {
    /**
     * Esconder sumiria justamente com a consulta pela qual ele já recebeu;
     * pintar como compromisso o faria contar com uma hora que ninguém combinou.
     */
    const e = daParticular({
      id: "b",
      preferred_dates: ["2026-08-01", "2026-08-02"],
      status: "confirmado",
    })!;
    expect(e.dia).toBe("2026-08-01");
    expect(e.hora).toBeNull();
    expect(e.firme).toBe(false);
  });

  test("`scheduled_for` inválido não derruba o evento — ele recua para a preferência", () => {
    /**
     * Uma string podre vindo do banco não pode fazer a consulta desaparecer da
     * agenda: `new Date("abacaxi")` é `Invalid Date`, e `diaLocal` dele sairia
     * "NaN-NaN-NaN" — uma célula que não existe em mês nenhum.
     */
    const e = daParticular({
      id: "c",
      preferred_dates: ["2026-08-01"],
      scheduled_for: "abacaxi",
      status: "pendente_pagamento",
    })!;
    expect(e.dia).toBe("2026-08-01");
    expect(e.firme).toBe(false);
  });

  test("marcada mas ainda não paga aparece como marcada, e a pagar", () => {
    /* O horário combinado e o dinheiro recebido são duas coisas: ele pode ter
       marcado antes de conferir o PIX. */
    const e = daParticular({
      id: "d",
      preferred_dates: [],
      scheduled_for: new Date(2026, 7, 20, 9, 0).toISOString(),
      status: "pagamento_enviado",
    })!;
    expect(e.firme).toBe(true);
    expect(e.pago).toBe(false);
    expect(e.situacao).toContain("a pagar");
  });

  test("sem horário e sem preferência nenhuma, não há dia — e o evento não entra", () => {
    expect(daParticular({ id: "e", preferred_dates: [], status: "confirmado" })).toBeNull();
  });
});

describe("2. a travessia navegador → banco (o erro de três horas)", () => {
  /** O que o servidor exige: `z.string().datetime({ offset: true })`. */
  const doServidor = z.string().datetime({ offset: true });

  test("a string CRUA do `datetime-local` é recusada pelo servidor", () => {
    /**
     * Este é o ponto todo. "2026-08-20T14:30" não diz em que fuso são 14:30;
     * uma coluna `timestamptz` a lê como UTC, e no Brasil isso vira 11:30. O
     * validador não deixa a string entrar — o erro morre na fronteira, em vez
     * de virar uma consulta em silêncio no horário errado.
     */
    expect(doServidor.safeParse("2026-08-20T14:30").success).toBe(false);
    expect(doServidor.safeParse("2026-08-20T14:30:00").success).toBe(false);
  });

  test("o que `deCampoLocal` produz é exatamente o que o servidor aceita", () => {
    const iso = deCampoLocal("2026-08-20T14:30")!;
    expect(doServidor.safeParse(iso).success).toBe(true);
  });

  test("`deCampoLocal` lê a hora digitada como LOCAL, não como UTC", () => {
    /**
     * A regra do ECMAScript: data-e-hora sem fuso é local; só a forma "só data"
     * é UTC. É disso que depende o conserto — e é por isso que o teste compara
     * com um `Date` montado por componentes locais, e não com um literal ISO.
     */
    const iso = deCampoLocal("2026-08-20T14:30")!;
    /* Em São Paulo (UTC−3), 14:30 combinadas são 17:30 em UTC. Este literal é o
       teste inteiro: `valor + "Z"` — o atalho de quem só quer calar o validador
       — gravaria 14:30Z, que é 11:30 para o médico. */
    expect(iso).toBe("2026-08-20T17:30:00.000Z");
    expect(new Date(iso).getTime()).toBe(new Date(2026, 7, 20, 14, 30).getTime());
  });

  test("ida e volta pelo campo preserva a hora que ele digitou", () => {
    /**
     * O médico marca 14:30, sai da tela e volta: o campo tem de mostrar 14:30.
     * `iso.slice(0, 16)` — o atalho óbvio — mostraria a hora UTC.
     */
    expect(paraCampoLocal(deCampoLocal("2026-08-20T14:30"))).toBe("2026-08-20T14:30");
  });

  test("campo vazio vira `null` — que é DESMARCAR, não erro", () => {
    /* Ele combinou e desmarcou. A consulta volta a aparecer como preferência
       em vez de sumir da agenda. */
    expect(deCampoLocal("")).toBeNull();
    expect(deCampoLocal("   ")).toBeNull();
    expect(paraCampoLocal(null)).toBe("");
  });

  test("lixo não vira instante nem quebra o campo", () => {
    expect(deCampoLocal("abacaxi")).toBeNull();
    expect(paraCampoLocal("abacaxi")).toBe("");
  });

  test("o validador REAL do servidor exige fuso — e não um parecido com ele", () => {
    /**
     * Os testes acima usam uma cópia do schema. Uma cópia prova a régua, não
     * que o servidor a aplique: afrouxar `marcarHoraDaConsulta` para
     * `z.string()` passaria por eles inteirinho.
     *
     * Por isso a leitura é do arquivo, e RECORTADA na função — a mesma base já
     * teve teste satisfeito por outra ocorrência da mesma string, em função
     * vizinha.
     */
    const fonte = readFileSync(
      new URL("./consultaparticular.functions.ts", import.meta.url),
      "utf8",
    );
    const i = fonte.indexOf("export const marcarHoraDaConsulta");
    expect(i).toBeGreaterThan(-1);
    const trecho = fonte.slice(i, fonte.indexOf("\n  .handler(", i));
    expect(trecho).toContain("scheduledFor: z.string().datetime({ offset: true }).nullable()");
  });
});
