/**
 * O MODO CUIDADO PRECISA VALER NOS QUATRO CAMINHOS.
 *
 * `buildClinicalBlock` foi consertado para que, em Modo Cuidado, a semana e o
 * trimestre nunca entrem no prompt. Uma varredura encontrou o conserto sendo
 * DESFEITO por quatro vizinhos:
 *
 *  1. A primeira bolha do chat, escrita pela TELA como se fosse a IA, abria com
 *     "Você está na semana 24". O servidor proibia e a tela anunciava.
 *  2. O bloco de MEMÓRIA reinjetava a gestação: o resumo é prosa construída
 *     sobre as conversas dela ("preocupada com o enxoval", "perguntou sobre o
 *     parto") e entrava sob o rótulo "fonte: sistema".
 *  3. O SUMARIZADOR que escreve esse resumo era instruído a manter "a memória
 *     de uma paciente gestante" — então o resumo renascia em termos de
 *     gestação a cada seis mensagens.
 *  4. A paciente SEM médico vinculado perdia o `clinicalBlock` inteiro — que
 *     estava calculado três linhas acima e era jogado fora. É o estado de
 *     entrada de toda paciente, e o estado de quem teve o acompanhamento
 *     encerrado.
 *
 * Uma proteção contornada por quatro caminhos não é uma proteção.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { memoryBlock } from "./chat-memory.server";
import { buildClinicalBlock } from "@/routes/api/chat";

const chat = readFileSync("src/routes/api/chat.ts", "utf8");
const tela = readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8");
const memoria = readFileSync("src/lib/chat-memory.server.ts", "utf8");

describe("1. a tela não anuncia a semana", () => {
  test("as duas abas que FALAM com ela recebem careMode", () => {
    /* Todas as outras abas já recebiam. Chat IA e Nutrição — justamente as duas
       que conversam — eram as únicas de fora. */
    expect(tela).toContain("<ChatTab profile={profile} gest={gest} careMode={careMode} />");
    expect(tela).toContain("<NutricaoTab profile={profile} gest={gest} careMode={careMode} />");
  });

  test("a saudação do chat esconde a semana em Modo Cuidado", () => {
    expect(tela).toContain("!careMode && gest");
  });
});

describe("2. a memória não reinjeta a gestação", () => {
  const RESUMO = "- preocupada com o enxoval\n- perguntou sobre o parto na semana 24";

  test("com Modo Cuidado, o bloco de memória some inteiro", () => {
    expect(memoryBlock(RESUMO, true)).toBe("");
  });

  test("sem Modo Cuidado, ele continua existindo", () => {
    /* O simétrico importa: uma proteção que apaga a memória de todo mundo teria
       passado no teste acima e destruído o recurso. */
    expect(memoryBlock(RESUMO, false)).toContain("Memória da paciente");
  });

  test("o padrão é NÃO suprimir — quem não sabe do luto não inventa", () => {
    /* `careMode` é opcional na assinatura. Se o padrão fosse `true`, qualquer
       chamador que esquecesse o argumento apagaria a memória em silêncio. */
    expect(memoryBlock(RESUMO)).toContain("Memória da paciente");
  });

  test("o chat passa o sinal — não adianta a função saber e ninguém contar", () => {
    expect(chat).toContain("memoryBlock(memorySummary, patient.careMode)");
  });
});

describe("3. o resumo para de ser escrito em termos de gestação", () => {
  test("o sumarizador recebe o sinal", () => {
    expect(memoria).toContain("careMode = false,");
    expect(memoria).toContain("A GESTAÇÃO DELA TERMINOU EM PERDA");
  });

  test("e o chat o repassa", () => {
    expect(chat).toContain("persistFor.careMode");
  });
});

describe("4. a paciente sem médico vinculado mantém tudo", () => {
  const emLutoSemMedico = {
    care_mode: true,
    lmp_date: null,
    reference_date: "2026-08-01",
    reference_weeks: 24,
    reference_days: 0,
    pregnancy_number: 1,
  };

  test("o bloco clínico dela continua trazendo o Modo Cuidado", () => {
    expect(buildClinicalBlock(emLutoSemMedico)).toContain("MODO CUIDADO");
  });

  test("e o ramo sem vínculo passou a injetá-lo", () => {
    /* Ele estava calculado e era jogado fora: `clinicalBlock` só aparecia
       dentro do ramo com médico. */
    const i = chat.indexOf("} else if (patient) {");
    expect(i).toBeGreaterThan(-1);
    expect(chat.slice(i, i + 2600)).toContain("patient.clinicalBlock");
  });

  test("e a promessa impossível é cancelada", () => {
    /* `medicalSystemPrompt` manda "diga que registrou a pergunta para ele" — e
       não há "ele". Nenhuma lacuna é gravada neste caminho. */
    const i = chat.indexOf("} else if (patient) {");
    const janela = chat.slice(i, i + 2600);
    expect(janela).toContain("NÃO diga que registrou a pergunta");
  });
});

describe("5. o histórico não traz a conduta do consultório anterior", () => {
  test("sem médico, filtra por IS NULL — não deixa de filtrar", () => {
    /* Era `if (doctorId) q = q.eq(...)`, sem `else`. Depois de encerrar o
       acompanhamento vinham as 12 últimas mensagens de QUALQUER médico —
       respostas assinadas com a conduta dele, que o modelo lê como suas. */
    expect(memoria).toContain(
      'q = doctorId ? q.eq("doctor_id", doctorId) : q.is("doctor_id", null)',
    );
  });
});
