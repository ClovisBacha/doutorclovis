import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { avaliar } from "@/lib/clinical.functions";
import { semComentarios } from "@/lib/sem-comentarios";

/**
 * `movimento` PASSOU A ENTRAR NA FILA DE TRABALHO DO CONSULTÓRIO — set/2026.
 *
 * A razão de ele ficar de fora estava escrita em `eventosQuePedemOlhar`:
 * "sinais de engajamento, não de deterioração". Era verdade quando o evento
 * carregava só a contagem de chutes, e venceu no dia em que a view passou a
 * projetar `duracao_min` e `avaliar` passou a classificar a sessão — porque
 * desde então uma sessão pode sair GRAVE, e redução de movimento fetal é um dos
 * nove sintomas VERMELHOS de `triage.ts`.
 *
 * ⚠️ Estes testes cobram a GARANTIA, nunca a grafia: que a régua classifica e
 * que a leitura de movimento tem ORÇAMENTO PRÓPRIO. A segunda é o que separa
 * este conserto de repetir o mecanismo que tirou `contracao` da fila.
 */

const fonte = semComentarios(readFileSync("src/lib/clinical.functions.ts", "utf8"));

/** O corpo de `eventosQuePedemOlhar`, da assinatura até o próximo `export`. */
function corpoDaFila(): string {
  const i = fonte.indexOf("export const eventosQuePedemOlhar");
  expect(i).toBeGreaterThan(-1);
  const resto = fonte.slice(i);
  const fim = resto.indexOf("\nexport ", 1);
  const corpo = fim === -1 ? resto : resto.slice(0, fim);
  /* Uma fatia que não fecha engole a função seguinte e passa a afirmar coisas
     sobre ela — é como uma asserção começa a mentir. */
  expect(corpo.length).toBeGreaterThan(400);
  expect(corpo.length).toBeLessThan(8000);
  return corpo;
}

describe("a régua já classifica a sessão de movimento", () => {
  test("duas horas com menos de dez movimentos é GRAVE", () => {
    expect(avaliar("movimento", { chutes: 4, duracao_min: 130 }).g).toBe("grave");
  });

  test("dez movimentos em oito minutos é normal", () => {
    expect(avaliar("movimento", { chutes: 10, duracao_min: 8 }).g).toBe("normal");
  });

  /* Sem `duracao_min` a régua CALA — e este é o estado de todo banco que ainda
     não rodou `APLICAR_EVENTOS_CLINICOS.sql` depois de set/2026. A ausência tem
     de significar silêncio, nunca alarme. */
  test("sem a duração projetada pela view, não alarma", () => {
    expect(avaliar("movimento", { chutes: 4 }).g).toBe("normal");
  });
});

describe("movimento chega à fila do consultório", () => {
  test("a fila busca a espécie `movimento`", () => {
    expect(corpoDaFila()).toContain('.eq("especie", "movimento")');
  });

  /* ⚠️ A GARANTIA QUE IMPORTA: orçamento PRÓPRIO. Posto no `.in()` junto com
     medida/sintoma/humor, cada contagem normal — a esmagadora maioria —
     gastaria a MESMA cota, e o teto corta ANTES do filtro de gravidade, na
     ordem `ocorrido_em DESC`: o que cairia é o evento mais antigo da janela, de
     QUALQUER paciente. É o mecanismo que tirou `contracao` daqui. */
  test("movimento NÃO entra no mesmo `.in()` das outras espécies", () => {
    const corpo = corpoDaFila();
    const lista = corpo.match(/\.in\("especie", \[[^\]]*\]\)/);
    expect(lista).not.toBeNull();
    expect(lista![0]).not.toContain("movimento");
  });

  test("são DUAS leituras, cada uma com o seu teto", () => {
    const corpo = corpoDaFila();
    expect(corpo.match(/lerEventos\(/g)?.length).toBe(2);
    expect(corpo.match(/TETO_FILA/g)?.length).toBe(2);
  });

  /* Duas idas independentes ao banco são UMA onda, não duas: em série, a fila
     do consultório passaria a custar uma latência a mais por lote. */
  test("as duas leituras saem juntas", () => {
    expect(corpoDaFila()).toMatch(/await Promise\.all\(\[\s*\n?\s*lerEventos\(/);
  });

  /* Truncar em silêncio é o defeito que `lerEventos` já consertou uma vez: a
     ausência passaria por ausência de fato. Se QUALQUER das duas cortou, a
     faixa de "não consegui ler tudo" acende. */
  test("o truncamento de qualquer uma das duas acende `incompleto`", () => {
    expect(corpoDaFila()).toMatch(/incompleto\s*=\s*\w+\.incompleto\s*\|\|\s*\w+\.incompleto/);
  });
});
