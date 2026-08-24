/**
 * A festa cresce com a sequência?
 *
 * Antes o dia 3 e o dia 30 disparavam exatamente a mesma coisa. Recompensa que
 * não cresce ensina que continuar não vale nada — e é na terceira semana que a
 * paciente decide se o app faz parte da rotina.
 *
 * O que estes testes travam não é o valor de cada degrau (esse é gosto, e vai
 * mudar), e sim as duas propriedades que não podem se perder: a escada nunca
 * desce, e os saltos caem exatamente em 7 e 30 — as marcas que ela conta
 * sozinha, "uma semana seguida" e "um mês seguido".
 */

import { describe, expect, test } from "bun:test";
import { nivelDaSequencia } from "./celebrate";

describe("escalada da celebração", () => {
  test("o primeiro dia é o nível mais baixo", () => {
    expect(nivelDaSequencia(1)).toBe(1);
  });

  test("nunca desce conforme a sequência cresce", () => {
    let anterior = 0;
    for (let d = 0; d <= 400; d++) {
      const n = nivelDaSequencia(d);
      expect(n).toBeGreaterThanOrEqual(anterior);
      anterior = n;
    }
  });

  test("sobe de degrau exatamente em 3, 7, 14 e 30", () => {
    for (const marca of [3, 7, 14, 30]) {
      expect(nivelDaSequencia(marca)).toBeGreaterThan(nivelDaSequencia(marca - 1));
    }
  });

  test("uma semana seguida é maior que dois dias", () => {
    expect(nivelDaSequencia(7)).toBeGreaterThan(nivelDaSequencia(2));
  });

  test("um mês seguido chega ao topo, e não passa dele", () => {
    expect(nivelDaSequencia(30)).toBe(5);
    expect(nivelDaSequencia(365)).toBe(5);
  });

  test("sequência zerada não quebra nem vira nível inválido", () => {
    expect(nivelDaSequencia(0)).toBe(1);
    expect(nivelDaSequencia(-3)).toBe(1);
  });
});
