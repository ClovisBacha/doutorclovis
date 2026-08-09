/**
 * O PAINEL CONTA AS PACIENTES DELE — NÃO AS DA PLATAFORMA.
 *
 * ─── O DEFEITO, ACHADO POR AUDITORIA ────────────────────────────────────────
 *
 * O mapa de atividade do Painel lia as 5000 linhas mais RECENTES de
 * `health_logs`, `journal_entries` e `kick_sessions` — da plataforma INTEIRA,
 * sem filtro nenhum — e só depois consultava o mapa pelos ids do médico.
 *
 * Nenhum dado de outro consultório chegava à tela; havia até um comentário
 * dizendo isso, e ele estava certo. O problema é outro, e é pior por ser
 * invisível: **a conta ficava errada, e cada vez mais errada.**
 *
 * Bastava a plataforma acumular 5000 registros mais novos que a última
 * atividade de uma paciente dele para ela sumir do mapa. E sumir do mapa não a
 * marca como sumida — `lastMs == null` a exclui do risco de abandono. Ou seja,
 * a paciente que parou de usar o app desaparece justamente do cartão
 * "Oportunidade de reengajar", que é onde ele iria procurá-la.
 *
 * O sintoma piora com o SUCESSO do produto: quanto mais médicos usam, menos o
 * painel de cada um funciona. E ninguém vê, porque um número menor não parece
 * defeito — parece um mês fraco.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const codigo = readFileSync("src/lib/dashboard.functions.ts", "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

describe("o mapa de atividade é recortado pelas pacientes do médico", () => {
  test("as três leituras filtram por user_id", () => {
    /* A asserção que descreve o defeito: eram três `.select(...).limit(5000)`
       sem UM filtro. */
    const i = codigo.indexOf("const porLotes");
    expect(i).toBeGreaterThan(-1);
    const bloco = codigo.slice(i, i + 700);
    expect(bloco).toContain('.in("user_id"');
  });

  test("as três tabelas passam pelo mesmo caminho", () => {
    for (const t of ["health_logs", "journal_entries", "kick_sessions"]) {
      expect(codigo).toContain(`porLotes("${t}"`);
    }
  });

  test("nenhuma delas voltou a ler a plataforma inteira", () => {
    /**
     * Um `.from("health_logs").select(...)` solto, sem `.in`, é a volta exata
     * do defeito. Como as três agora passam por `porLotes`, qualquer leitura
     * direta dessas tabelas neste arquivo é suspeita.
     */
    for (const t of ["health_logs", "journal_entries", "kick_sessions"]) {
      expect(codigo).not.toContain(`.from("${t}")\n          .select`);
    }
    expect(codigo).not.toContain("limit(5000)");
  });
});

describe("os lotes existem porque `.in()` vai na URL", () => {
  test("o lote é de 100, como no resto da base", () => {
    /**
     * Cada uuid custa 39 caracteres depois do percent-encoding da vírgula.
     * Acima de ~206 pacientes a request line passa dos 8 KB do proxy e volta
     * 414 — com `data` nula e um `error` que ninguém lê. `getEngagementData`
     * já tinha aprendido isso da pior forma: TODAS as pacientes marcadas como
     * sumidas há 45 dias, em vermelho, no dia em que o consultório passou de
     * 205 para 206.
     */
    expect(codigo).toContain("const LOTE = 100;");
    expect(codigo).toContain("ids.slice(i, i + LOTE)");
  });

  test("e o médico sem paciente nenhuma não dispara consulta", () => {
    expect(codigo).toContain("if (profiles.length === 0) return new Map<string, number>();");
  });
});
