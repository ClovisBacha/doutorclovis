/**
 * TRÊS PONTAS DA ABA DE NUTRIÇÃO QUE FALHAVAM EM SILÊNCIO.
 *
 * Nenhuma quebra nada visível — e é isso que as fez sobreviver a `tsc` limpo,
 * lint limpo e à suíte inteira verde.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { semComentarios } from "./sem-comentarios";
import { colunaAusente, tabelaAusente } from "./postgrest";

const TELA = semComentarios(readFileSync("src/components/nutricao-tab.tsx", "utf8"));
const SERVIDOR = semComentarios(readFileSync("src/lib/nutricao-contexto.server.ts", "utf8"));

describe("⚠️ tabela ausente no NAVEGADOR é PGRST205, não 42P01", () => {
  test("os dois códigos passam pelo mesmo teste", () => {
    /* Do navegador, o PostgREST barra a tabela desconhecida no schema cache e
       o erro nem chega ao Postgres — então um teste escrito à mão só no 42P01
       nunca casa, e o "cala" vira um aviso por resposta da nutricionista. */
    expect(tabelaAusente({ code: "PGRST205" })).toBe(true);
    expect(tabelaAusente({ code: "42P01" })).toBe(true);
    expect(tabelaAusente({ code: "23505" })).toBe(false);
  });

  test("a gravação da memória usa o helper, e não um código à mão", () => {
    const grava = TELA.slice(TELA.indexOf('.from("nutricao_mensagens")\n        .insert'));
    expect(grava.slice(0, 400)).toMatch(/!tabelaAusente\(error\)/);
    expect(grava.slice(0, 400)).not.toMatch(/code !== "42P01"/);
  });

  test("e o campo de preferências usa `colunaAusente` — o SQL chega depois do código", () => {
    expect(colunaAusente({ code: "PGRST204" })).toBe(true);
    expect(TELA).toMatch(/if \(colunaAusente\(error\)\) \{/);
    expect(TELA).toMatch(/ainda não está disponível/);
  });
});

describe("⚠️ a porta fechada não deixa a foto pendurada na mensagem seguinte", () => {
  test("o 402 desfaz o turno E a miniatura", () => {
    /* `fotos` é indexado pela POSIÇÃO da mensagem. Com o rollback do turno e a
       miniatura de pé, o índice ficava livre e a PRÓXIMA pergunta — de texto —
       era desenhada com a foto do prato que ela tentou mandar. */
    const i = TELA.indexOf("if (res.status === 402) {");
    expect(i).toBeGreaterThan(-1);
    const ramo = TELA.slice(i, TELA.indexOf("if (!res.ok", i));
    expect(ramo).toMatch(/setMessages\(messages\)/);
    expect(ramo).toMatch(/setFotos\(/);
    expect(ramo).toMatch(/next\.length - 1/);
  });
});

describe("⚠️ o select de `health_logs` é de cinco colunas antigas — e por que isso importa", () => {
  test("ele não pede coluna que não seja das primeiras migrations", () => {
    /* Não há escada aqui de propósito: sem coluna nova a derivar, ela seria
       código morto. O risco é a PRÓXIMA coluna — um 42703 derruba o select
       inteiro e a nutricionista perde peso, glicemia E pressão de uma vez.
       Este teste é o alarme: quem acrescentar coluna aqui fica vermelho e lê
       o comentário que manda derivar a escada. */
    const i = SERVIDOR.indexOf('.from("health_logs")');
    const sel = SERVIDOR.slice(i, SERVIDOR.indexOf(".eq(", i));
    expect(sel).toContain('.select("log_date,weight_kg,glucose_mg_dl,systolic,diastolic")');
  });
});
