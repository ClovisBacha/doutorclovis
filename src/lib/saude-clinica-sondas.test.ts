/**
 * AS SONDAS DA SAÚDE DA FILA CLÍNICA — o que não é régua pura.
 *
 * ⚠️ Três garantias moram no handler e não têm como virar função pura: qual
 * coluna cada sonda filtra e como o erro do PostgREST é lido. Elas ficam aqui,
 * sobre o fonte SEM COMENTÁRIOS — a prosa deste arquivo cita `42703` e
 * `dados->>`, e sem tirá-la a busca aprovaria o defeito que ela existe para
 * pegar (já aconteceu doze vezes nesta base).
 */
import { readFileSync } from "node:fs";

import { describe, expect, test } from "bun:test";

import { semComentarios } from "@/lib/sem-comentarios";

const FONTE = semComentarios(readFileSync("src/lib/saude-clinica.functions.ts", "utf8"));

/** O corpo de uma função, da assinatura até a próxima do arquivo. */
function corpo(marcador: string): string {
  const i = FONTE.indexOf(marcador);
  expect(i).toBeGreaterThan(-1);
  const fim = FONTE.indexOf("\nasync function", i + 1);
  const trecho = FONTE.slice(i, fim === -1 ? undefined : fim);
  expect(trecho.length).toBeGreaterThan(60);
  return trecho;
}

describe("como o erro do PostgREST é lido", () => {
  const c = corpo("async function contar(");

  test("⚠️ 42P01 e 42703 são pendências DIFERENTES, com consertos diferentes", () => {
    /* Juntá-las mandaria o dono rodar o arquivo errado. */
    expect(c).toContain('"42P01"');
    expect(c).toContain('"42703"');
    expect(c).toMatch(/ausente:\s*error\.code === "42P01"/);
    expect(c).toMatch(/semColuna:\s*error\.code === "42703"/);
  });

  test("⚠️ nenhuma linha de paciente viaja — a sonda é só contagem", () => {
    expect(c).toContain("head: true");
    expect(c).toContain('count: "exact"');
  });
});

describe("a sonda do campo", () => {
  const h = FONTE.slice(FONTE.indexOf("CAMPOS_CLINICOS.map"));

  test("⚠️ o lado da TABELA filtra pela coluna de ORIGEM", () => {
    /* Sem o filtro, a contagem viraria o total da tabela e uma sessão ainda
       aberta faria a tela acusar view velha sem motivo. */
    expect(h).toMatch(/\.not\(c\.colunaDaTabela, "is", null\)/);
  });

  test("⚠️ o lado da VIEW filtra pela CHAVE do jsonb — e não só pela fonte", () => {
    /* Este é o defeito inteiro: contando só `fonte`, a conferência do campo
       vira a conferência da fonte, e a view velha passa verde para sempre. */
    expect(h).toMatch(/\.not\(`dados->>\$\{c\.campo\}`, "is", null\)/);
    expect(h).toMatch(/\.eq\("fonte", c\.fonte\)/);
  });

  test("⚠️ sem a view, a sonda NÃO é dada como feita", () => {
    /* `NAO_SONDADO` carrega `n: null`, que a régua lê como `ilegivel`. */
    expect(h).toContain("NAO_SONDADO");
    expect(FONTE).toMatch(/const NAO_SONDADO: Sonda = \{ n: null,/);
  });

  test("⚠️ quem decide o estado é a régua PURA, nunca um `if` aqui", () => {
    expect(h).toContain("estadoDoCampo(naTabela, naView, viewExiste)");
  });
});

describe("o que o handler devolve", () => {
  test("conta os campos fora da view — é ele que acende o alarme da tela", () => {
    expect(FONTE).toMatch(
      /camposForaDaView: campos\.filter\(\(c\) => c\.estado === "fora_da_view"\)\.length/,
    );
  });
});
