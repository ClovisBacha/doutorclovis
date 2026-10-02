import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { semComentarios } from "@/lib/sem-comentarios";

/**
 * UMA BANCADA QUE ANDA COM O RELÓGIO NÃO SERVE PARA COMPARAR DUAS FOTOS.
 *
 * ⚠️ A rota do ciclo crava as datas dos ciclos E o "hoje", e o comentário dela
 * afirma "as DUAS pontas cravadas". O componente descartava a segunda: lia
 * `new Date()` em três pontos. Medido no navegador com o relógio forjado, na
 * MESMA URL: no dia em que a bancada foi escrita, "Dia do ciclo 13 · Ovulação";
 * nove dias depois, "Dia do ciclo 22 · Fase lútea" — ela mudou de FASE sozinha;
 * dois meses adiante, "A previsão está pausada", sem anel e sem calendário.
 *
 * ⚠️ E o `?tela=ciclo` é o estado PADRÃO da rota — a primeira URL que a
 * varredura de CI abre.
 */
const ciclo = semComentarios(readFileSync("src/components/ciclo-menstrual-tab.tsx", "utf8"));
const mulher = semComentarios(readFileSync("src/components/saude-mulher.tsx", "utf8"));

describe("o ciclo lê UM relógio, e a bancada pode cravá-lo", () => {
  test("a bancada aceita `hoje`", () => {
    expect(ciclo).toMatch(/bancada\?: \{[^}]*hoje\?: string/);
  });

  test("o `agora` é um só, e sai da bancada quando ela crava", () => {
    expect(ciclo).toMatch(
      /const agora = bancada\?\.hoje \? new Date\(bancada\.hoje\) : new Date\(\)/,
    );
  });

  test("⚠️ e nenhum outro ponto lê o relógio por conta própria", () => {
    /* A ÚNICA ocorrência legítima é o recuo da linha do `agora` acima. */
    expect(ciclo.match(/new Date\(\)/g)?.length).toBe(1);
  });

  test("o hub REPASSA o hoje para o ciclo, e não só para os preventivos", () => {
    const i = mulher.indexOf("<CicloMenstrualTab");
    expect(i).toBeGreaterThan(-1);
    expect(mulher.slice(i, i + 500)).toContain("hoje: bancada.hoje");
  });
});

describe("a data que vira DUM nasce no dia CIVIL dela", () => {
  /**
   * ⚠️ `new Date().toISOString().slice(0,10)` converte para UTC antes de
   * cortar: em São Paulo, das 21h à meia-noite o ISO já está no dia SEGUINTE, e
   * o campo abria pré-preenchido com amanhã. Esta data vira `lmp_date` e, por
   * ela, a idade gestacional e a DPP.
   */
  test("nenhum campo de data sai do ISO em UTC", () => {
    expect(ciclo).not.toMatch(/toISOString\(\)\.split\("T"\)\[0\]/);
    expect(ciclo).not.toMatch(/toISOString\(\)\.slice\(0, ?10\)/);
  });

  test("os dois campos saem do MESMO dia local", () => {
    expect(ciclo).toMatch(/const hojeLocal = agora\.toLocaleDateString\("en-CA"\)/);
    expect(ciclo.match(/useState\(hojeLocal\)/g)?.length).toBe(2);
  });
});

describe("o estado que a bancada existe para provar", () => {
  const clinica = semComentarios(readFileSync("src/routes/preview-saude-clinica.tsx", "utf8"));
  const saude = semComentarios(readFileSync("src/routes/preview-saude.tsx", "utf8"));

  test("⚠️ `campovelho` desenha as DOZE fontes verdes — que é a tese dele", () => {
    /* O cabeçalho do arquivo e o comentário da varredura afirmavam "as doze
       fontes verdes", e três saíam cinza: o alarme logo acima diz "a fonte está
       na view — por isso a lista abaixo fica verde", então o único estado cuja
       tese é essa era o que a desmentia na própria tela. */
    expect(clinica).toMatch(/if \(estado !== "campovelho" && i > 8\)/);
  });

  test("⚠️ a grade da Saúde tem `?luto=` — o único estado em que ela muda de forma", () => {
    expect(saude).toMatch(/luto: q\.luto === "1"/);
    expect(saude).toContain("careMode={luto}");
  });

  test("e a varredura de CI abre esse estado", () => {
    const varredura = readFileSync("scripts/varrer-bancadas.mjs", "utf8");
    expect(varredura).toContain("/preview-saude?w=20&luto=1");
  });
});
