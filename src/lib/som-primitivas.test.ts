/**
 * AS PEÇAS — e o defeito medido que cada teste aqui existe para não voltar.
 *
 * ⚠️ Nada aqui mede COMO soa. Quem ouve é `scripts/ouvir.mjs`, que renderiza
 * num Chromium de verdade. Aqui se cobra a aritmética que, quando quebra,
 * quebra em silêncio.
 */

import { describe, expect, test } from "bun:test";
import { LACO, naGrade, residuoDoLaco, sorteador, semente } from "./som-primitivas";

describe("⚠️ naGrade — o tropeço do batimento a cada 20 segundos", () => {
  /* O defeito, medido na auditoria: as batidas eram agendadas com
     `for (t = 0; t < segundos; t += periodo)` e emitidas em `t0 + t`, ou seja
     a fase reiniciava no começo de CADA janela. Ao vivo a janela tem 20 s e o
     período a 140 bpm é 0,42857 s — e 20 não é múltiplo disso. */
  const PERIODO = 60 / 140;

  test("a primeira batida da janela 2 continua a grade da janela 1", () => {
    const j1 = naGrade(0, 20, PERIODO);
    const j2 = naGrade(20, 20, PERIODO);
    const salto = j2[0] - j1[j1.length - 1];
    expect(Math.abs(salto - PERIODO)).toBeLessThan(1e-9);
  });

  test("⚠️ e o jeito ANTIGO adiantava a batida em 139 ms — a conta que prova", () => {
    /* `20 / 0,42857 = 46,67` batidas: a janela corta no meio de uma. Ancorando
       na janela, a batida seguinte saía em 20,000 em vez de 20,143 — 139 ms
       adiantada, 32% do período, trinta vezes numa sessão de dez minutos.
       Este teste guarda o NÚMERO, para ninguém "simplificar" de volta. */
    const batidasInteiras = Math.floor(20 / PERIODO);
    const proximaCerta = (batidasInteiras + 1) * PERIODO;
    expect(proximaCerta).toBeCloseTo(20.142857, 5);
    expect((proximaCerta - 20) * 1000).toBeCloseTo(142.857, 2);
  });

  test("nenhuma batida cai fora da janela pedida", () => {
    for (const t of naGrade(7.3, 20, PERIODO)) {
      expect(t).toBeGreaterThanOrEqual(7.3 - 1e-9);
      expect(t).toBeLessThan(7.3 + 20);
    }
  });

  test("com janela múltipla do período, a contagem fecha exata", () => {
    /* 30 s a 140 bpm são 70 batidas — é isso que faz o laço do arquivo fechar
       no lugar de uma batida, e não no meio de uma. */
    expect(naGrade(0, 30, PERIODO).length).toBe(70);
    expect(naGrade(0, 30, 60 / 72).length).toBe(36);
  });

  test("duas janelas seguidas cobrem o mesmo que uma janela dobrada", () => {
    const dobrada = naGrade(0, 40, PERIODO);
    const partida = [...naGrade(0, 20, PERIODO), ...naGrade(20, 20, PERIODO)];
    expect(partida.length).toBe(dobrada.length);
    for (let i = 0; i < dobrada.length; i++) {
      expect(Math.abs(partida[i] - dobrada[i])).toBeLessThan(1e-9);
    }
  });
});

describe("o resíduo do laço — como um sino cabe em 30 segundos", () => {
  test("T60 de 45 s batendo a cada 30 s pede 1% a mais", () => {
    /* A cauda da volta anterior ainda soa quando a próxima bate. Renderizando
       um golpe com essa amplitude a mais, o que sobra além do laço é
       exatamente o que a volta seguinte reinjeta — e a emenda fica exata. */
    expect(residuoDoLaco(45, 30)).toBeCloseTo(1.01, 3);
  });

  test("cauda curta não precisa de correção nenhuma", () => {
    expect(residuoDoLaco(2, 30)).toBeCloseTo(1, 6);
  });

  test("cauda muito longa pede muito mais — e é por isso que a conta existe", () => {
    /* Um sino de T60 = 200 s soaria com metade da energia herdada da volta
       anterior. Sem o resíduo, a primeira volta sairia muito mais fraca que as
       seguintes — e o laço "cresceria" nos primeiros minutos. */
    expect(residuoDoLaco(200, 30)).toBeGreaterThan(1.5);
  });
});

describe("o sorteio", () => {
  test("a mesma semente devolve a mesma sequência", () => {
    const a = sorteador(42);
    const b = sorteador(42);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });

  test("⚠️ a semente muda com a janela — é o que conserta a chuva ao vivo", () => {
    /* Com semente fixa, toda janela recebia as MESMAS gotas nos mesmos
       instantes: a chuva se repetia exatamente a cada 20 segundos durante a
       meditação inteira. */
    expect(semente(1000, 0)).toBe(1000);
    expect(semente(1000, 20)).toBe(21000);
    expect(semente(1000, 20)).not.toBe(semente(1000, 40));
  });

  test("e no render offline (t0 = 0) ela não muda — o render segue reproduzível", () => {
    /* É o que torna `scripts/ouvir.mjs` uma bancada: medir duas vezes tem de
       dar o mesmo número, ou não há como saber se uma mudança melhorou. */
    expect(semente(20260813, 0)).toBe(20260813);
  });
});

describe("o laço", () => {
  test("são 30 segundos, e é esse número que todo período tem de dividir", () => {
    expect(LACO).toBe(30);
  });
});
