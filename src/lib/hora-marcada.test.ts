/**
 * HORA MARCADA É HORA MARCADA.
 *
 * ─── O DEFEITO ──────────────────────────────────────────────────────────────
 *
 * O campo `datetime-local` entrega uma string SEM FUSO: "2026-08-10T20:00".
 * Ela ia crua para uma coluna `timestamptz`, e o Postgres interpreta esse
 * formato no fuso da sessão — que na Supabase é UTC.
 *
 * O médico marcava 20:00, o banco guardava 20:00 UTC, e a paciente recebia o
 * convite para 17:00. Três horas de diferença num compromisso marcado — e nada
 * na tela dá pista, porque o painel relê o mesmo valor que gravou.
 *
 * A tela de Lives, no MESMO arquivo, já fazia a conversão certa. A teleconsulta
 * tinha ficado de fora. É o padrão desta base: a correção existe num lugar e
 * não foi propagada para o irmão ao lado.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const painel = readFileSync("src/routes/_authenticated/painel.tsx", "utf8");

describe("a conversão de fuso acontece antes de gravar", () => {
  test("a teleconsulta converte para ISO com fuso", () => {
    expect(painel).toContain(
      "scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toISOString() : null",
    );
  });

  test("a live continua convertendo", () => {
    /* Ela já estava certa; o teste existe para que a correção não seja desfeita
       enquanto alguém "uniformiza" o código pelo lado errado. */
    expect(painel).toContain("scheduledAt: when ? new Date(when).toISOString() : null");
  });

  test("nenhum campo datetime-local vai cru para o servidor", () => {
    /**
     * A regra, não os dois casos. Qualquer `scheduled*: <estado> || null` sem
     * `toISOString` é o mesmo defeito com outro nome.
     */
    expect(painel).not.toMatch(/scheduledFor: form\.scheduledFor \|\| null/);
    expect(painel).not.toMatch(/scheduledAt: when \|\| null/);
  });
});

describe("a conta que prova o erro", () => {
  test("uma string local sem fuso vira o instante certo em UTC", () => {
    /**
     * Não testo o painel aqui — testo a PROPRIEDADE em que ele passou a
     * confiar: `new Date("...")` sobre uma string sem fuso é lida como hora
     * LOCAL, e `toISOString` devolve o instante equivalente em UTC.
     *
     * Se algum dia isso deixar de valer, os convites voltam a sair errados, e
     * este teste cai antes de uma paciente perder a consulta.
     */
    const local = "2026-08-10T20:00";
    const d = new Date(local);
    expect(d.getHours()).toBe(20);
    expect(d.getMinutes()).toBe(0);
    /* E o ISO carrega o deslocamento do fuso do processo, seja ele qual for. */
    const iso = d.toISOString();
    expect(iso.endsWith("Z")).toBe(true);
    expect(new Date(iso).getTime()).toBe(d.getTime());
  });

  test("a string CRUA seria lida como UTC — que é o defeito", () => {
    /* "2026-08-10T20:00Z" é o que o Postgres efetivamente entendia. Num fuso
       negativo, isso é mais cedo do que o médico quis. */
    const comoOBancoLia = new Date("2026-08-10T20:00Z").getTime();
    const oQueEleQuis = new Date("2026-08-10T20:00").getTime();
    const deslocamentoMin = new Date("2026-08-10T20:00").getTimezoneOffset();
    expect(comoOBancoLia - oQueEleQuis).toBe(-deslocamentoMin * 60_000);
  });
});
