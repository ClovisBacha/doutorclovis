/**
 * OS ARQUIVOS "APLICAR" PRECISAM BASTAR-SE.
 *
 * ─── POR QUE ISTO É UMA CLASSE DE DEFEITO, NÃO UM CASO ──────────────────────
 *
 * O banco de produção deste projeto está atrás do repositório — está escrito no
 * CLAUDE.md e é assim há meses. Por isso existem os `supabase/APLICAR_*.sql`:
 * arquivos consolidados e idempotentes que o dono cola no SQL Editor.
 *
 * Quem os roda NÃO SABE quais migrations o banco dele já viu. Então um arquivo
 * APLICAR que depende de uma coluna criada numa migration pendente não é
 * "quase certo": ele falha inteiro. E falha do pior jeito, porque o SQL Editor
 * roda o arquivo numa transação — um erro no meio derruba TUDO, inclusive o
 * que já tinha passado.
 *
 * ─── OS DOIS DEFEITOS QUE UMA AUDITORIA ENCONTROU ───────────────────────────
 *
 * 1. `APLICAR_AGENDA.sql` criava um índice único sobre
 *    `confirmed_date, confirmed_time` sem nunca criar essas colunas — elas
 *    nascem em `20260610010000_doctor_scheduling.sql`, que é POSTERIOR ao corte
 *    das pendentes. O dono rodava o arquivo que o CLAUDE.md manda rodar, via um
 *    erro 42703, e ficava sem `appointment_waitlist` nenhuma — exatamente a
 *    fila de espera que ele estava tentando ligar.
 *
 * 2. `brain_gap_askers` não estava em `APLICAR_PENDENTES.sql`. A consequência
 *    não é tela vazia: é a IA quebrando uma promessa. Ela diz à paciente
 *    "registrei a sua pergunta para ele ver", e é essa tabela que liga a lacuna
 *    à paciente — `brain_gaps` é deduplicada por pergunta e não guarda quem
 *    perguntou. Sem ela o médico responde, o painel anuncia "Respondida e
 *    aprendida", e a resposta não chega a ninguém.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

const ler = (p: string) => readFileSync(`supabase/${p}`, "utf8");

describe("1. APLICAR_AGENDA cria o que ele mesmo indexa", () => {
  const sql = ler("APLICAR_AGENDA.sql");

  test("as colunas confirmadas são adicionadas ANTES do índice sobre elas", () => {
    const iColuna = sql.indexOf("ADD COLUMN IF NOT EXISTS confirmed_date");
    /* A INSTRUÇÃO, não o nome: o nome do índice também aparece no comentário
       que explica o defeito, e o comentário vem antes do ALTER. */
    const iIndice = sql.indexOf("CREATE UNIQUE INDEX IF NOT EXISTS appt_confirmed_slot");
    expect(iColuna).toBeGreaterThan(-1);
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS confirmed_time");
    expect(iIndice).toBeGreaterThan(iColuna);
  });

  test("e continua idempotente", () => {
    /* O dono roda estes arquivos à mão, às vezes duas vezes. */
    for (const alter of sql.match(/ADD COLUMN[^;,]*/g) ?? []) {
      expect(alter).toContain("IF NOT EXISTS");
    }
  });

  test("a fila de espera é criada, e é o objetivo do arquivo", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.appointment_waitlist");
  });
});

describe("2. APLICAR_PENDENTES leva TODA tabela que o produto pendura nele", () => {
  const pendentes = ler("APLICAR_PENDENTES.sql");

  test("brain_gap_askers está lá", () => {
    expect(pendentes).toContain("CREATE TABLE IF NOT EXISTS public.brain_gap_askers");
  });

  test("com RLS e sem acesso de anon/authenticated", () => {
    /**
     * A tabela liga uma dúvida a uma paciente. Deixá-la legível pelo cliente
     * entregaria "quem perguntou o quê" a qualquer sessão autenticada — e o
     * conteúdo é dúvida clínica de gestante.
     */
    const i = pendentes.indexOf("public.brain_gap_askers");
    const bloco = pendentes.slice(i);
    expect(bloco).toContain("ENABLE ROW LEVEL SECURITY");
    expect(bloco).toContain("REVOKE ALL ON public.brain_gap_askers FROM anon, authenticated");
  });

  test("as irmãs dela, que já estavam, continuam", () => {
    /* Um `brain_gap_askers` sem `brain_gaps` não serve de nada — a chave
       estrangeira dele aponta para lá. */
    expect(pendentes).toContain("brain_gaps");
    expect(pendentes).toContain("brain_feedback");
  });
});

describe("3. nenhum APLICAR indexa coluna que ele não garante", () => {
  /**
   * A regra geral, não o caso. Um `CREATE INDEX ... ON tabela (col)` dentro de
   * um APLICAR só é seguro se a coluna vier de um `ADD COLUMN IF NOT EXISTS` ou
   * de um `CREATE TABLE` do PRÓPRIO arquivo — ou se a tabela for uma das oito
   * originais, que existem em qualquer banco deste produto.
   *
   * Cobrir isso por completo exigiria um parser de SQL. O que dá para cobrar
   * sem parser, e que teria pego o defeito real, é mais estreito e mais útil:
   * as colunas de agenda são conhecidas por nome, e nenhum arquivo pode
   * indexá-las sem adicioná-las.
   */
  const arquivos = readdirSync("supabase").filter((f) => f.startsWith("APLICAR_"));
  const DEPENDENTES = ["confirmed_date", "confirmed_time", "proposed_date", "proposed_time"];

  test("há arquivos APLICAR para conferir", () => {
    /* Sem isto, renomear a pasta faria o teste passar sem conferir nada. */
    expect(arquivos.length).toBeGreaterThan(5);
  });

  for (const arq of arquivos) {
    test(`${arq} adiciona toda coluna de agenda que indexa`, () => {
      const sql = ler(arq);
      const indices = sql.match(/CREATE\s+(UNIQUE\s+)?INDEX[\s\S]*?;/gi) ?? [];
      for (const col of DEPENDENTES) {
        const indexaEssa = indices.some((i) => i.includes(col));
        if (!indexaEssa) continue;
        expect(sql).toContain(`ADD COLUMN IF NOT EXISTS ${col}`);
      }
    });
  }
});
