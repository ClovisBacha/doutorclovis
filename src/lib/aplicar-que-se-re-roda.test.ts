/**
 * O QUE A CONFERÊNCIA DO BANCO NÃO ALCANÇA.
 *
 * ⚠️ A frase que este arquivo existe para impedir é uma só: **"todo
 * `APLICAR_*.sql` que o repositório conhece já está no banco"**, dita sobre uma
 * sonda que pergunta por TABELA e COLUNA e nunca pela VERSÃO de uma view.
 */
import { readFileSync } from "node:fs";

import { describe, expect, test } from "bun:test";

import {
  comConferenciaParcial,
  oQueEscapaDaConferencia,
  SE_RE_RODA,
} from "@/lib/aplicar-que-se-re-roda";
import { semComentarios } from "@/lib/sem-comentarios";

describe("a lista", () => {
  test("⚠️ o arquivo da view está nela — é o único caso de verdade hoje", () => {
    expect(oQueEscapaDaConferencia("APLICAR_EVENTOS_CLINICOS.sql")).not.toBeNull();
  });

  test("um arquivo comum NÃO ganha ressalva", () => {
    /* Ressalva em toda linha é ressalva que ninguém lê. */
    expect(oQueEscapaDaConferencia("APLICAR_AMIZADES.sql")).toBeNull();
  });

  test("⚠️ toda entrada diz o que escapa E onde a pergunta certa é feita", () => {
    /* Uma ressalva sem destino deixa o dono sabendo que há um buraco e sem
       nada a fazer com isso. */
    for (const x of SE_RE_RODA) {
      expect(x.oQueEscapa.length).toBeGreaterThan(30);
      expect(x.ondeConferir.length).toBeGreaterThan(3);
      expect(x.arquivo).toMatch(/^APLICAR_[A-Z0-9_]+\.sql$/);
    }
  });

  test("⚠️ a lista é CURTA — ela não é 'arquivos importantes'", () => {
    expect(SE_RE_RODA.length).toBeLessThanOrEqual(3);
  });

  test("⚠️ todo arquivo da lista EXISTE no repositório", () => {
    /* Uma ressalva sobre um arquivo que não existe mais mandaria o dono
       procurar uma pendência inventada. */
    for (const x of SE_RE_RODA) {
      expect(() => readFileSync(`supabase/${x.arquivo}`, "utf8")).not.toThrow();
    }
  });

  test("⚠️ a aba apontada é o RÓTULO REAL da fita do admin", () => {
    /* Um destino que não é o nome que ele lê na tela manda o dono procurar uma
       aba que não existe — e este teste já pegou isso uma vez. */
    const admin = readFileSync("src/routes/_authenticated/admin.tsx", "utf8");
    for (const x of SE_RE_RODA) {
      expect(admin).toContain(`label: "${x.ondeConferir}"`);
    }
  });
});

describe("a ressalva só cabe sobre o que foi dado como aplicado", () => {
  test("aplicado e na lista → ressalva", () => {
    expect(comConferenciaParcial([{ arquivo: "APLICAR_EVENTOS_CLINICOS.sql" }])).toHaveLength(1);
  });

  test("⚠️ o que NÃO foi dado como aplicado não vira ressalva", () => {
    /* Ele já está na lista vermelha de "falta rodar", e repetir o mesmo
       arquivo em duas caixas com dois tons diferentes contradiz a tela. */
    expect(comConferenciaParcial([{ arquivo: "APLICAR_AMIZADES.sql" }])).toHaveLength(0);
    expect(comConferenciaParcial([])).toHaveLength(0);
  });
});

describe("a tela do Banco", () => {
  const FONTE = semComentarios(readFileSync("src/components/saude-do-banco-tab.tsx", "utf8"));

  test("⚠️ a caixa verde NÃO afirma mais que todo APLICAR_ está no banco", () => {
    /* Ela fala do que a sonda de fato perguntou: tabela e coluna. */
    expect(FONTE).not.toContain("já está no banco");
    expect(FONTE).toContain("nenhuma coluna que o");
  });

  /**
   * A CONDIÇÃO que governa o bloco da ressalva — lida de trás para a frente a
   * partir do texto dela.
   *
   * ⚠️ Procurar `parciais.length > 0` no arquivo NÃO serve: a mutação
   * `{false && parciais.length > 0 && (` CONTÉM essa string e passava verde.
   * É a armadilha de substring, e ela morde toda vez.
   */
  function condicaoDoBloco(): string {
    const fim = FONTE.indexOf("O que esta conferência");
    expect(fim).toBeGreaterThan(-1);
    const antes = FONTE.slice(0, fim);
    const abre = antes.lastIndexOf("&& (");
    const chave = antes.lastIndexOf("{", abre);
    return antes.slice(chave + 1, abre).trim();
  }

  test("⚠️ a ressalva é desenhada, e nada a neutraliza", () => {
    const cond = condicaoDoBloco();
    expect(cond).toContain("parciais");
    expect(cond).not.toContain("false");
    expect(cond.length).toBeLessThan(40);
  });

  test("⚠️ e ela fica FORA do ramo do 'nada pendente'", () => {
    /* Dentro dele, um arquivo cuja pendência a sonda não enxerga deixaria de
       ser mostrado justamente quando houvesse outros dez faltando. */
    const iVerde = FONTE.indexOf("Nada pendente");
    const iRessalva = FONTE.indexOf("O que esta conferência");
    expect(iRessalva).toBeGreaterThan(iVerde);
    expect(FONTE.slice(iVerde, iRessalva)).toContain(") : null}");
  });

  test("a régua vem do módulo, e não de um nome de arquivo escrito aqui", () => {
    expect(FONTE).toContain("comConferenciaParcial(aplicados)");
    expect(FONTE).not.toContain("APLICAR_EVENTOS_CLINICOS");
  });
});
