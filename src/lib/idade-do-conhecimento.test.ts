/**
 * O CONHECIMENTO TEM IDADE — e ela precisa ser a da CONDUTA, não a da linha.
 *
 * `brain_entries` tinha `created_at` e mais nada. Uma orientação escrita há dois
 * anos entrava na resposta com exatamente a mesma confiança da de ontem, e nem
 * o médico nem o painel conseguiam dizer qual era qual.
 *
 * Em obstetrícia a conduta muda: profilaxia com AAS, rastreio de EGB, critérios
 * de indução, alvo pressórico. O cérebro guardava o que ele disse e não QUANDO
 * — e seguia respondendo em nome dele com a versão de dois anos atrás.
 *
 * ─── OS DOIS ERROS QUE ESTE ARQUIVO IMPEDE ──────────────────────────────────
 *
 *  · Usar `created_at` como substituto. Uma entrada criada há dois anos e
 *    revisada ontem apareceria como velha. O médico veria a marca errada, e é
 *    exatamente assim que um aviso morre: ele para de olhar.
 *  · Marcar cedo demais. Metade da base sinalizada ensina a ignorar o sinal.
 */

import { describe, expect, test } from "bun:test";
import {
  DIAS_PARA_REVISAR,
  diasSemRevisao,
  precisaDeRevisao,
  type BrainEntry,
} from "./secondbrain.functions";

const AGORA = new Date("2026-08-06T12:00:00.000Z").getTime();
const diasAtras = (n: number) => new Date(AGORA - n * 86_400_000).toISOString();

const entrada = (p: Partial<BrainEntry> = {}): BrainEntry => ({
  id: "e1",
  question: "Posso comer sushi?",
  answer: "Peixe cru não.",
  category: null,
  source: "manual",
  approved: true,
  created_at: diasAtras(900),
  updated_at: diasAtras(10),
  ...p,
});

describe("a idade é a da revisão, não a da criação", () => {
  test("criada há 900 dias e revisada há 10 não é velha", () => {
    /* O caso que protege a confiança na marca. Usar `created_at` marcaria esta
       entrada — e o médico, vendo a marca errada numa orientação que ele acabou
       de revisar, aprende que a marca não quer dizer nada. */
    const e = entrada({ created_at: diasAtras(900), updated_at: diasAtras(10) });
    expect(diasSemRevisao(e, AGORA)).toBe(10);
    expect(precisaDeRevisao(e, AGORA)).toBe(false);
  });

  test("criada ontem mas com revisão antiga é velha", () => {
    // O simétrico: a data que manda é a da última vez que ele olhou.
    const e = entrada({ created_at: diasAtras(1), updated_at: diasAtras(400) });
    expect(precisaDeRevisao(e, AGORA)).toBe(true);
  });

  test("sem a coluna migrada, a resposta honesta é 'não sei'", () => {
    /* `null`, e não zero nem `created_at`. Zero diria "revisada hoje" — uma
       data inventada é pior que data nenhuma, porque ninguém desconfia dela. */
    const e = entrada({ updated_at: undefined });
    expect(diasSemRevisao(e, AGORA)).toBe(null);
    expect(precisaDeRevisao(e, AGORA)).toBe(false);
  });
});

describe("o limiar", () => {
  test("exatamente um ano já pede revisão", () => {
    // `>=`: um fora-por-um aqui atrasa a base inteira em um dia.
    expect(precisaDeRevisao(entrada({ updated_at: diasAtras(DIAS_PARA_REVISAR) }), AGORA)).toBe(
      true,
    );
  });

  test("um dia antes ainda não", () => {
    expect(precisaDeRevisao(entrada({ updated_at: diasAtras(DIAS_PARA_REVISAR - 1) }), AGORA)).toBe(
      false,
    );
  });

  test("seis meses NÃO marcam — literal, e não derivado da constante", () => {
    /* Sem números literais, trocar `DIAS_PARA_REVISAR` por 30 mantinha a suíte
       verde e o médico veria metade da base marcada. Foi medido nesta base:
       exatamente essa mutação sobreviveu num limiar anterior. */
    expect(precisaDeRevisao(entrada({ updated_at: diasAtras(180) }), AGORA)).toBe(false);
  });

  test("dois anos marcam", () => {
    expect(precisaDeRevisao(entrada({ updated_at: diasAtras(730) }), AGORA)).toBe(true);
  });
});

describe("rascunho não entra na conta", () => {
  test("uma entrada não aprovada nunca pede revisão", () => {
    /* Ela não está em uso: `match_brain_entries` filtra `approved = true`.
       Cobrar revisão de rascunho encheria a tela de marcas sobre conhecimento
       que ainda não respondeu a ninguém. */
    const e = entrada({ approved: false, updated_at: diasAtras(2000) });
    expect(precisaDeRevisao(e, AGORA)).toBe(false);
    // A idade continua sendo calculável — o que muda é a cobrança.
    expect(diasSemRevisao(e, AGORA)).toBe(2000);
  });
});

describe("datas impossíveis não viram alarme", () => {
  test("revisão no futuro não conta como negativa", () => {
    // Relógio do cliente adiantado; melhor "não sei" que "-3 dias sem olhar".
    expect(diasSemRevisao(entrada({ updated_at: diasAtras(-3) }), AGORA)).toBe(null);
  });

  test("data ilegível não quebra a tela", () => {
    expect(diasSemRevisao(entrada({ updated_at: "isto não é uma data" }), AGORA)).toBe(null);
  });
});
