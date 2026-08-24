import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  aulaDeHojeParaCompartilhar,
  CHAVE_DA_AULA,
  guardarAulaDeHoje,
  VALIDADE_HORAS,
} from "./aula-compartilhavel";

/* Um `localStorage` de mentira: o módulo é do navegador, e o teste não é. */
const armazem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => armazem.get(k) ?? null,
  setItem: (k: string, v: string) => void armazem.set(k, v),
  removeItem: (k: string) => void armazem.delete(k),
  clear: () => armazem.clear(),
  key: () => null,
  length: 0,
} as Storage;

const AGORA = new Date("2026-08-18T12:00:00Z").getTime();
const horas = (h: number) => h * 3600 * 1000;

beforeEach(() => armazem.clear());

describe("o bilhete da aula", () => {
  test("guarda e devolve o tema", () => {
    /* 139 = 19 × 7 + 6 → o sexto tema do ritmo, "revisão". */
    guardarAulaDeHoje(139, AGORA);
    expect(aulaDeHojeParaCompartilhar(AGORA)).toEqual({ tema: "revisão" });
    guardarAulaDeHoje(142, AGORA);
    expect(aulaDeHojeParaCompartilhar(AGORA)).toEqual({ tema: "nutrição" });
  });

  test("⚠️ o DIA não é guardado — só o tema", () => {
    // O dia gestacional é a semana dela disfarçada (D = semana × 7 + dia).
    // Guardá-lo aqui faria a conversão acontecer perto do servidor, e a
    // primeira "otimização" mandaria o número junto.
    guardarAulaDeHoje(139, AGORA);
    const cru = armazem.get(CHAVE_DA_AULA) ?? "";
    expect(cru).not.toContain("139");
    expect(cru).not.toContain("dia");
  });

  test("sem bilhete, nada", () => {
    expect(aulaDeHojeParaCompartilhar(AGORA)).toBeNull();
  });

  test(`vale ${VALIDADE_HORAS} horas`, () => {
    guardarAulaDeHoje(0, AGORA);
    expect(aulaDeHojeParaCompartilhar(AGORA + horas(VALIDADE_HORAS - 1))).not.toBeNull();
    expect(aulaDeHojeParaCompartilhar(AGORA + horas(VALIDADE_HORAS + 1))).toBeNull();
  });

  test("⚠️ a validade é em HORAS, não até o fim do dia", () => {
    // Ela pode fazer a aula às 23h50 e querer publicar às 00h10 — um corte de
    // calendário apagaria o bilhete no meio do gesto.
    const quaseMeiaNoite = new Date("2026-08-18T23:50:00Z").getTime();
    guardarAulaDeHoje(2, quaseMeiaNoite);
    const depoisDaVirada = new Date("2026-08-19T00:10:00Z").getTime();
    expect(aulaDeHojeParaCompartilhar(depoisDaVirada)).toEqual({ tema: "nutrição" });
  });

  test("lixo no armazém não estoura", () => {
    armazem.set(CHAVE_DA_AULA, "{isto não é json");
    expect(aulaDeHojeParaCompartilhar(AGORA)).toBeNull();
    armazem.set(CHAVE_DA_AULA, JSON.stringify({ tema: 7, quando: "ontem" }));
    expect(aulaDeHojeParaCompartilhar(AGORA)).toBeNull();
  });

  test("bilhete do futuro (relógio para trás) não vale", () => {
    armazem.set(CHAVE_DA_AULA, JSON.stringify({ tema: "corpo", quando: AGORA + horas(5) }));
    expect(aulaDeHojeParaCompartilhar(AGORA)).toBeNull();
  });
});

describe("⚠️ o banco de aulas NÃO entra na Comunidade", () => {
  test("nem este módulo nem o compositor importam o JSON de 674 KB", () => {
    // Ele desce por `import()` dinâmico de propósito: a abertura de Minha Conta
    // caiu 40% por causa disso, e um import estático aqui desfaria a divisão.
    const meu = readFileSync("src/lib/aula-compartilhavel.ts", "utf8");
    expect(meu).not.toContain("daily-quizzes");
    const rede = readFileSync("src/components/rede-instagram.tsx", "utf8");
    expect(rede).not.toContain("daily-quizzes");
  });
});
