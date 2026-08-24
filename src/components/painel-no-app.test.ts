/**
 * O resumo do médico no app é uma tela de TRIAGEM: ele olha, e decide se
 * precisa abrir o computador. Por isso o defeito mais caro aqui não é layout —
 * é um número que diz zero quando há alguém esperando. O médico acredita,
 * fecha o app, e a paciente segue esperando.
 *
 * Estes testes leem o componente e travam as duas regras que impedem isso.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const fonte = readFileSync("src/components/painel-no-app.tsx", "utf8");

describe("o resumo não inventa zero", () => {
  test("o contador de exames só aparece quando o número existe", () => {
    /* O painel não carrega a lista de exames no shell. Renderizar "0 exames"
       ali seria afirmar que não há nenhum — sem ter olhado. */
    expect(fonte).toContain("resumo.examesNovos !== undefined &&");
  });

  test("o tipo deixa `examesNovos` opcional, não obrigatório com zero", () => {
    expect(fonte).toMatch(/examesNovos\?: number;/);
  });

  test('"nada esperando" trata ausência como ausência, não como zero', () => {
    expect(fonte).toContain("(resumo.examesNovos ?? 0) === 0");
  });
});

describe("a ordem de urgência", () => {
  test("o SOS vem antes da teleconsulta, e a teleconsulta antes dos contadores", () => {
    const sos = fonte.indexOf("resumo.sosAbertos > 0");
    const tele = fonte.indexOf("resumo.salasAbertas > 0");
    const grade = fonte.indexOf("grid grid-cols-2");
    expect(sos).toBeGreaterThan(0);
    expect(sos).toBeLessThan(tele);
    expect(tele).toBeLessThan(grade);
  });

  test("o SOS entra na conta do 'nada esperando'", () => {
    /* Se ficasse de fora, a tela diria "nada esperando por você" com um SOS
       aberto logo acima. */
    expect(fonte).toContain("resumo.sosAbertos === 0 &&");
  });
});

describe("as duas explicações que o Clóvis pediu ficam PARADAS na tela", () => {
  test("o plano no site não é toast — é bloco fixo", () => {
    expect(fonte).toContain("O plano se contrata no site");
    /* E o texto vem da regra única, não escrito à mão aqui. */
    expect(fonte).toContain("veredito.texto");
    expect(fonte).toContain('podeComprarAqui("plano_medico"');
  });

  test("diz que é a mesma conta do computador", () => {
    expect(fonte).toContain("É a mesma conta:");
  });

  test("não esconde as outras abas — só diz onde o trabalho a fundo se faz", () => {
    expect(fonte).toContain("continuam todos aqui");
  });
});
