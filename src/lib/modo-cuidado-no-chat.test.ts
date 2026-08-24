/**
 * O MODO CUIDADO CHEGA AO CHAT.
 *
 * Ela ativa o Modo Cuidado quando a gestação termina em perda. O app inteiro
 * responde: some a comemoração, some o ganho de sementinhas, some a conquista,
 * some o push semanal, muda até o céu da tela. Doze arquivos sabiam.
 *
 * O chat não. `care_mode` não aparecia em `api/chat.ts` nem em
 * `secondbrain.server.ts` — os dois arquivos que decidem o que a IA DIZ — e o
 * bloco clínico seguia injetando "Semana gestacional: 24 (2º trimestre)".
 *
 * O resultado é o pior que este produto consegue produzir: a mulher que acabou
 * de perder o bebê abre o chat e a IA fala com ela sobre as semanas dela, sobre
 * o que esperar do trimestre. Vinte e quatro horas por dia, porque a IA não
 * dorme e o médico dorme.
 *
 * Testar isto lendo o arquivo seria inútil — o que importa é o TEXTO que vai
 * para o modelo. `buildClinicalBlock` é pura; dá para chamá-la.
 */

import { describe, expect, test } from "bun:test";
import { buildClinicalBlock } from "@/routes/api/chat";

const gestante = {
  care_mode: false,
  lmp_date: null,
  reference_date: "2026-08-01",
  reference_weeks: 24,
  reference_days: 0,
  pregnancy_number: 1,
};

describe("gestação em curso (o comportamento que já existia)", () => {
  test("a semana entra no prompt", () => {
    const bloco = buildClinicalBlock(gestante);
    expect(bloco).toContain("Semana gestacional");
  });
});

describe("modo cuidado", () => {
  const emLuto = { ...gestante, care_mode: true };

  test("a semana NÃO entra — nem o trimestre", () => {
    /* O teste central. Uma única linha "- Semana gestacional: 24" faz o modelo
       conversar sobre uma gestação que acabou.
       A asserção é sobre o DADO, não sobre a palavra: "trimestre" aparece de
       propósito na linha que PROÍBE falar dele, e um `not.toContain("trimestre")`
       reprovaria justamente a proteção. Errei isso na primeira tentativa. */
    const bloco = buildClinicalBlock(emLuto);
    expect(bloco).not.toContain("Semana gestacional");
    expect(bloco).not.toMatch(/\d+º trimestre/);
    expect(bloco).not.toMatch(/Semana gestacional: \d+/);
  });

  test("o modelo é avisado do que não se fala", () => {
    const bloco = buildClinicalBlock(emLuto);
    expect(bloco).toContain("MODO CUIDADO");
    expect(bloco.toLowerCase()).toContain("perda");
    // Sem isto o modelo "acolhe" e emenda numa pergunta sobre o enxoval.
    expect(bloco.toLowerCase()).toContain("parto");
  });

  test("o sinal de alarme continua valendo", () => {
    /* Acolhimento não pode virar silêncio clínico: sangramento intenso e febre
       depois de uma perda são exatamente o que a manda para o pronto-socorro.
       A asserção é sobre a INSTRUÇÃO, não sobre a palavra: "sangramento"
       também aparece na linha que lista os assuntos legítimos, e um
       `toContain("sangramento")` sobrevivia à remoção da linha de alarme —
       medido numa bateria de mutação. */
    const bloco = buildClinicalBlock(emLuto);
    expect(bloco).toContain("Sinal de alarme");
    expect(bloco.toLowerCase()).toContain("atendimento agora");
  });

  test("o histórico obstétrico SOBREVIVE ao modo cuidado", () => {
    /* Ele é o que protege a recuperação dela e uma gestação futura. Apagar
       tudo junto trocaria um erro por outro — a IA cega justamente para quem
       tem risco conhecido. */
    const bloco = buildClinicalBlock({
      ...emLuto,
      pregnancy_number: 3,
      prior_bp_elevated: true,
      prior_bp_week: 32,
    });
    expect(bloco).toContain("3ª gestação");
    expect(bloco).toContain("pressão elevada");
  });

  test("sem histórico, o bloco ainda existe — o aviso é o que importa", () => {
    /* Numa primeira gestação não há histórico nenhum. O bloco não pode voltar
       vazio: sem ele o modelo não sabe do luto. */
    const bloco = buildClinicalBlock({ ...emLuto, pregnancy_number: 1 });
    expect(bloco).toContain("MODO CUIDADO");
  });
});

describe("perfil ausente", () => {
  test("sem perfil não inventa contexto", () => {
    expect(buildClinicalBlock(null)).toBe("");
  });
});
