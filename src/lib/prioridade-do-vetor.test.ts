/**
 * QUEM GANHA VETOR PRIMEIRO — e por que isso é decisão de produto.
 *
 * `match_brain_entries` filtra `AND e.approved = true`: rascunho não é
 * encontrável, nem por vetor nem por palavra. Mas o backfill pegava qualquer
 * `embedding IS NULL`, sem ordem nenhuma, 20 por visita à Base de conhecimento.
 *
 * O kit de partida instala ~30 entradas como RASCUNHO. Então duas visitas
 * inteiras podiam ser gastas vetorizando exatamente o que a busca nunca vai
 * devolver — enquanto a orientação aprovada do médico seguia invisível e a
 * paciente ouvia "registrei para ele ver" sobre um assunto que ele já escreveu.
 *
 * Era o sintoma do "pode comer comida japonesa", com uma causa a mais.
 *
 * A ordem estava escondida dentro de duas chamadas de construtor de consulta —
 * o tipo de decisão que nenhum teste alcança e que uma mutação atravessa sem
 * fazer barulho. Foi medido: remover a prioridade não quebrava nada.
 */

import { describe, expect, test } from "bun:test";
import { priorizarAprovadas } from "./embeddings.server";

type Ordem = { coluna: string; ascendente: boolean };

/** Construtor de consulta que só anota a ordem pedida. */
function consultaFalsa() {
  const ordens: Ordem[] = [];
  const q: any = {
    order: (coluna: string, o: { ascending: boolean }) => {
      ordens.push({ coluna, ascendente: o.ascending });
      return q;
    },
    is: () => q,
    limit: () => q,
  };
  return { q, ordens };
}

describe("a prioridade do backfill", () => {
  const { q, ordens } = consultaFalsa();
  priorizarAprovadas(q);

  test("aprovadas primeiro", () => {
    /* DESCENDENTE porque em Postgres `false < true`. Ascendente poria os
       rascunhos na frente — o avesso exato, e com aparência de estar certo. */
    expect(ordens[0]).toEqual({ coluna: "approved", ascendente: false });
  });

  test("depois, a mais antiga — está invisível há mais tempo", () => {
    expect(ordens[1]).toEqual({ coluna: "created_at", ascendente: true });
  });

  test("nesta ordem, e não na inversa", () => {
    /* Se `created_at` viesse primeiro, ele viraria o critério principal e
       `approved` só desempataria — trinta rascunhos antigos passariam à frente
       da orientação aprovada de ontem, que é o defeito original com outra
       roupa. */
    expect(ordens.map((o) => o.coluna)).toEqual(["approved", "created_at"]);
  });

  test("duas ordens, nada além", () => {
    expect(ordens).toHaveLength(2);
  });
});
