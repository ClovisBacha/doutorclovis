/**
 * O BACKFILL DE VETORES NÃO PODE GASTAR AS VAGAS COM RASCUNHO.
 *
 * `match_brain_entries` filtra `AND e.approved = true`: rascunho não é
 * encontrável, nem por vetor nem por palavra. Mas o backfill pegava qualquer
 * `embedding IS NULL`, sem ordem, 20 por visita — e o kit de partida instala
 * ~30 entradas como RASCUNHO.
 *
 * Duas visitas inteiras à Base de conhecimento podiam ser gastas vetorizando
 * exatamente o que a busca nunca vai devolver, enquanto a orientação APROVADA
 * do médico seguia invisível e a paciente ouvia "registrei para ele ver" sobre
 * um assunto que ele já tinha escrito. É a causa a mais do sintoma do sushi.
 *
 * ─── POR QUE ESTE ARQUIVO EXISTE ────────────────────────────────────────────
 *
 * Uma bateria de mutação mediu que REMOVER a priorização não quebrava teste
 * nenhum. A ordenação acontece no Postgres, então não havia comportamento em
 * memória para exercitar — e a única alternativa era casar string no arquivo,
 * que quebra quando alguém renomeia e passa quando alguém inverte a lógica.
 *
 * A saída foi extrair o juízo para uma função e dar a ela um construtor de
 * consulta de mentira. O que se testa é a cláusula que vai ao banco.
 */

import { describe, expect, test } from "bun:test";
import { priorizarAprovadas } from "./embeddings.server";

type Ordem = { coluna: string; ascendente: boolean };

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

  test("ordena por `approved` antes de qualquer outra coisa", () => {
    expect(ordens[0]?.coluna).toBe("approved");
  });

  test("DESCENDENTE — em Postgres `false < true`", () => {
    /* `ascending: true` poria os rascunhos na frente, ou seja, inverteria
       exatamente o conserto: o backfill gastaria as 20 vagas com o que a busca
       nunca devolve. */
    expect(ordens[0]?.ascendente).toBe(false);
  });

  test("desempata pela mais ANTIGA", () => {
    /* Entre duas aprovadas sem vetor, a que espera há mais tempo é a que está
       invisível há mais tempo. Descendente aqui atenderia primeiro quem acabou
       de ser criada, e a entrada antiga nunca sairia da fila numa base grande. */
    expect(ordens[1]).toEqual({ coluna: "created_at", ascendente: true });
  });

  test("duas ordenações, não mais — a cadeia continua para quem chama", () => {
    expect(ordens).toHaveLength(2);
    expect(priorizarAprovadas(q)).toBe(q);
  });
});
