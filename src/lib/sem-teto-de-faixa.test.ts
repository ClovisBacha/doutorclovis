/**
 * A CATRACA DO "SEM TETO" — set/2026.
 *
 * Pedido do dono, com a foto da tela na mão: ele digitou o peso e leu
 * "O peso precisa ficar entre 25 e 350 kg. Confira o número."
 *
 *   "Vai que a pessoa tem mais de 350 kg, tire esse limite e outros que
 *    podem existir."
 *
 * Um app de gestação de alto risco que RECUSA o número de uma paciente real
 * está errado duas vezes: ela não consegue registrar, e o médico não vê
 * justamente o dado que mais mudaria a conduta dele.
 *
 * ⚠️ E o teto não era só um formulário chato — ele REBAIXAVA emergência.
 * `sinalPressao(320, 190)` caía em "implausível → atenção" e ordenava ABAIXO de
 * qualquer vermelho na fila de trabalho do painel; `sinalGlicemia(950)`, idem.
 * Errar para o lado de alarmar é o único lado seguro de uma régua clínica.
 *
 * ⚠️ SOBREVIVEM DOIS MÁXIMOS, e a diferença é o que esta catraca guarda:
 * saturação (100%) e sono (24 h) são DEFINIÇÃO da grandeza, não plausibilidade.
 * 101% de oxigênio e 25 horas num dia não existem; 400 kg existem.
 *
 * A régua vive em CINCO lugares que precisam concordar — a régua da paciente, o
 * formulário do médico, o validador do servidor e os dois SQL. Um teto que
 * voltasse em qualquer um deles reapareceria como "confira o número" numa tela
 * e silêncio nas outras.
 */
import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  FAIXAS,
  foraDaFaixa,
  fraseDaFaixa,
  sinalGlicemia,
  sinalPressao,
  sinalSaturacao,
  validaEntrada,
} from "./sinais-clinicos";

/* A prosa deste repositório CITA o que ela proíbe — os comentários acima
   escrevem "350", "BETWEEN" e "max". Sem tirá-los, toda busca de texto aqui
   mentiria, e nas duas direções: aprovando o defeito documentado ou reprovando
   o conserto que o explica. */
function semComentarios(src: string): string {
  return src
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("--"));
    })
    .join("\n");
}

const REGUA = semComentarios(readFileSync("src/lib/sinais-clinicos.ts", "utf8"));
const MEDICO = semComentarios(readFileSync("src/components/registrar-consulta.tsx", "utf8"));
const SERVIDOR = semComentarios(readFileSync("src/lib/clinical.functions.ts", "utf8"));
const SQL_EVENTOS = semComentarios(readFileSync("supabase/APLICAR_EVENTOS_CLINICOS.sql", "utf8"));
const SQL_CONSULTA = semComentarios(readFileSync("supabase/APLICAR_CONSULTA.sql", "utf8"));

/** Os dois — e SÓ os dois — em que o máximo é definição, nunca plausibilidade. */
const SO_COM_TETO_POR_DEFINICAO = ["sleep_hours", "spo2"];

describe("a régua clínica não tem teto de plausibilidade", () => {
  test("só saturação e sono declaram `max` — os outros seis não", () => {
    const comTeto = Object.entries(FAIXAS)
      .filter(([, f]) => f.max != null)
      .map(([campo]) => campo)
      .sort();
    expect(comTeto).toEqual(SO_COM_TETO_POR_DEFINICAO);
  });

  test("o peso aceita qualquer número acima de zero", () => {
    expect(FAIXAS.weight_kg.max).toBe(undefined);
    expect(validaEntrada("weight_kg", "412,5")).toBe(null);
    expect(validaEntrada("weight_kg", "150")).toBe(null);
    /* O piso do peso é EXCLUSIVO: `"0"` é truthy num formulário de strings, e
       era assim que zero chegava ao banco como medida. */
    expect(validaEntrada("weight_kg", "0")).not.toBe(null);
    expect(validaEntrada("weight_kg", "-3")).not.toBe(null);
  });

  test("pressão, glicemia, frequência e passos aceitam o número alto", () => {
    expect(validaEntrada("systolic", "320")).toBe(null);
    expect(validaEntrada("diastolic", "190")).toBe(null);
    expect(validaEntrada("glucose_mg_dl", "950")).toBe(null);
    expect(validaEntrada("heart_rate_bpm", "260")).toBe(null);
    expect(validaEntrada("steps", "250000")).toBe(null);
  });

  test("os pisos continuam recusando o que não é medida", () => {
    expect(validaEntrada("systolic", "30")).not.toBe(null);
    expect(validaEntrada("diastolic", "10")).not.toBe(null);
    expect(validaEntrada("heart_rate_bpm", "12")).not.toBe(null);
  });

  test("saturação acima de 100% e sono acima de 24 h continuam impossíveis", () => {
    expect(validaEntrada("spo2", "101")).not.toBe(null);
    expect(validaEntrada("sleep_hours", "25")).not.toBe(null);
    expect(validaEntrada("spo2", "97")).toBe(null);
    expect(validaEntrada("sleep_hours", "8")).toBe(null);
  });

  test("a frase sem teto fala só do piso — nunca de uma faixa que não existe", () => {
    const doPeso = fraseDaFaixa(FAIXAS.weight_kg);
    expect(doPeso.includes("entre")).toBe(false);
    expect(doPeso.includes("maior que 0")).toBe(true);
    const daSaturacao = fraseDaFaixa(FAIXAS.spo2);
    expect(daSaturacao.includes("entre 50 e 100")).toBe(true);
  });

  test("`foraDaFaixa` respeita o piso exclusivo e a ausência de teto", () => {
    expect(foraDaFaixa(FAIXAS.weight_kg, 0)).toBe(true);
    expect(foraDaFaixa(FAIXAS.weight_kg, 0.1)).toBe(false);
    expect(foraDaFaixa(FAIXAS.weight_kg, 999)).toBe(false);
    expect(foraDaFaixa(FAIXAS.spo2, 101)).toBe(true);
  });
});

describe("o número alto continua sendo EMERGÊNCIA, e não 'implausível'", () => {
  test("320/190 sai GRAVE — o teto o rebaixava para atenção", () => {
    const s = sinalPressao(320, 190);
    expect(s === null).toBe(false);
    expect(s ? s.gravidade : "").toBe("grave");
    expect(s ? s.nota.includes("implausível") : true).toBe(false);
  });

  test("glicemia de 950 sai GRAVE", () => {
    const g = sinalGlicemia(950);
    expect(g === null).toBe(false);
    expect(g ? g.gravidade : "").toBe("grave");
  });

  test("os pisos continuam sendo lidos como implausíveis", () => {
    const baixa = sinalPressao(30, 10);
    expect(baixa ? baixa.nota.includes("implausível") : false).toBe(true);
    const zero = sinalGlicemia(0);
    expect(zero ? zero.nota.includes("implausível") : false).toBe(true);
  });

  test("saturação impossível continua marcada — o teto dela é definição", () => {
    const alta = sinalSaturacao(101);
    expect(alta ? alta.nota.includes("implausível") : false).toBe(true);
  });
});

describe("os outros quatro lugares concordam com a régua", () => {
  test("o formulário do médico não tem teto e usa os helpers da régua", () => {
    const bloco = MEDICO.slice(
      MEDICO.indexOf("const FAIXAS"),
      MEDICO.indexOf("function foraDeFaixa"),
    );
    expect(bloco.length > 100).toBe(true);
    expect(bloco.includes("max:")).toBe(false);
    expect(MEDICO.includes("foraDaFaixa(faixa, v)")).toBe(true);
    expect(MEDICO.includes("fraseDaFaixa(faixa)")).toBe(true);
  });

  test("o validador do servidor não tem `.max(` nas medidas da consulta", () => {
    const i = SERVIDOR.indexOf("systolic: z.number()");
    expect(i > 0).toBe(true);
    const bloco = SERVIDOR.slice(i, SERVIDOR.indexOf("bpmFetal: z.number()", i) + 120);
    expect(bloco.includes(".max(")).toBe(false);
    expect(bloco.includes("pesoKg: z.number().positive()")).toBe(true);
  });

  test("nenhum BETWEEN sobrevive fora de saturação e sono", () => {
    for (const linha of SQL_EVENTOS.split("\n")) {
      if (!linha.includes("BETWEEN")) continue;
      const definicao = linha.includes("spo2") || linha.includes("sleep_hours");
      expect(definicao).toBe(true);
    }
    expect(SQL_CONSULTA.includes("BETWEEN")).toBe(false);
  });

  test("o laço de CHECKs REESCREVE a regra — sem isso, rodar de novo é no-op", () => {
    /* `CONTINUE WHEN EXISTS` fazia o arquivo pular a constraint já existente:
       quem já o tinha rodado ficaria com o teto antigo PARA SEMPRE. */
    const laco = SQL_EVENTOS.slice(
      SQL_EVENTOS.indexOf("DO $faixas$"),
      SQL_EVENTOS.indexOf("$faixas$;"),
    );
    expect(laco.includes("CONTINUE WHEN EXISTS")).toBe(false);
    const posDrop = laco.indexOf("DROP CONSTRAINT IF EXISTS");
    const posAdd = laco.indexOf("ADD CONSTRAINT");
    expect(posDrop > 0).toBe(true);
    expect(posAdd > posDrop).toBe(true);
  });

  test("a consulta ganha bloco próprio — `CREATE TABLE IF NOT EXISTS` não alcança tabela que já existe", () => {
    const bloco = SQL_CONSULTA.slice(SQL_CONSULTA.indexOf("DO $sem_teto$"));
    expect(bloco.length > 200).toBe(true);
    for (const coluna of ["systolic", "diastolic", "weight_kg", "fundal_height_cm", "fetal_bpm"]) {
      expect(bloco.includes(coluna)).toBe(true);
    }
    expect(bloco.includes("DROP CONSTRAINT IF EXISTS")).toBe(true);
  });

  test("as duas telas de escrita nomeiam o 23514 — o deploy chega antes do SQL", () => {
    expect(SERVIDOR.includes('"23514"')).toBe(true);
    expect(SERVIDOR.includes("teto_antigo_no_banco")).toBe(true);
    expect(MEDICO.includes("teto_antigo_no_banco")).toBe(true);
    const paciente = semComentarios(
      readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"),
    );
    expect(paciente.includes('"23514"')).toBe(true);
  });

  test("a régua não guarda nenhum dos tetos antigos", () => {
    const bloco = REGUA.slice(
      REGUA.indexOf("export const FAIXAS"),
      REGUA.indexOf("export function fraseDaFaixa"),
    );
    for (const teto of ["300", "200", "900", "350", "250", "200000"]) {
      expect(bloco.includes(teto)).toBe(false);
    }
  });
});
