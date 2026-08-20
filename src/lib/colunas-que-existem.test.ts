import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";

/**
 * ⚠️ AS COLUNAS QUE O CÓDIGO LÊ EXISTEM NO SQL?
 *
 * ─── POR QUE ISTO PRECISOU EXISTIR ──────────────────────────────────────────
 *
 * Duas vezes na mesma leva um `select` pediu coluna que não existe, e as duas
 * falharam **em silêncio**:
 *
 *  · `/api/legenda-da-foto` filtrava `patient_profiles` por `user_id` — coluna
 *    inexistente. O recuo repetia a leitura com o mesmo filtro errado, `perfil`
 *    vinha `null` e o botão "✨ Sugerir legenda" dizia "não consegui pensar em
 *    nada" para TODA paciente, desde o primeiro dia.
 *  · o resumo semanal da criadora lia `affiliate_earnings.amount_cents`; a
 *    coluna se chama `commission_cents`. O `try/catch` engoliria o `42703` e a
 *    linha da comissão nunca apareceria no e-mail.
 *
 * O PostgREST responde `42703` a coluna desconhecida, e este projeto engole
 * erro de leitura de propósito em quase todo lugar (para o recurso degradar em
 * vez de derrubar a tela). A soma das duas coisas é: **coluna errada não faz
 * barulho nenhum**.
 *
 * ⚠️ Este teste é uma REDE, não uma prova: ele confere as colunas que estão
 * escritas em `select("...")` literais das tabelas listadas abaixo, contra o
 * que os `.sql` do repositório declaram. Ele não vê `select` montado por
 * variável, e não conhece o banco de produção.
 */
const TABELAS = [
  "patient_profiles",
  "affiliate_earnings",
  "affiliates",
  "rede_posts",
  "rede_seguidores",
  "rede_stories",
];

function arquivos(dir: string, ext: RegExp, saida: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = `${dir}/${nome}`;
    if (statSync(caminho).isDirectory()) arquivos(caminho, ext, saida);
    else if (ext.test(nome)) saida.push(caminho);
  }
  return saida;
}

/** Tudo que os `.sql` do repositório declaram, por tabela. */
function colunasDeclaradas(): Map<string, Set<string>> {
  const mapa = new Map<string, Set<string>>();
  const sqls = [...arquivos("supabase", /\.sql$/)];
  const junto = sqls.map((f) => readFileSync(f, "utf8")).join("\n");

  for (const t of TABELAS) {
    const cols = new Set<string>();
    /* ⚠️ **Um `ALTER TABLE` pode trazer VÁRIOS `ADD COLUMN`**, separados por
       vírgula e em linhas diferentes — e a primeira versão desta função só
       pegava o primeiro, acusando `emergency_phone` e
       `pre_pregnancy_weight_kg` de não existirem. Um teste que acusa código
       correto é abandonado na segunda vez; por isso a varredura vai até o `;`
       que fecha o comando. */
    for (const m of junto.matchAll(
      new RegExp(`ALTER TABLE\\s+(?:public\\.)?${t}\\b([\\s\\S]*?);`, "gi"),
    )) {
      for (const c of m[1].matchAll(/ADD COLUMN(?:\s+IF NOT EXISTS)?\s+(\w+)/gi)) {
        cols.add(c[1]);
      }
    }
    /* O corpo de um `CREATE TABLE`. */
    for (const m of junto.matchAll(
      new RegExp(
        `CREATE TABLE(?:\\s+IF NOT EXISTS)?\\s+(?:public\\.)?${t}\\s*\\(([\\s\\S]*?)\\n\\);`,
        "gi",
      ),
    )) {
      for (const linha of m[1].split("\n")) {
        const c = /^\s*(\w+)\s+[a-z]/i.exec(linha);
        if (c && !/^(constraint|unique|primary|foreign|check)$/i.test(c[1])) cols.add(c[1]);
      }
    }
    mapa.set(t, cols);
  }
  return mapa;
}

/** Cada `.from("tabela")…select("a, b")` literal do app. */
function selectsLiterais(): { arquivo: string; tabela: string; colunas: string[] }[] {
  const saida: { arquivo: string; tabela: string; colunas: string[] }[] = [];
  for (const f of [...arquivos("src/lib", /\.tsx?$/), ...arquivos("src/routes", /\.tsx?$/)]) {
    if (/\.test\./.test(f)) continue;
    /* ⚠️ **SEM COMENTÁRIOS.** A varredura casa `.from("t")` colado no
       `.select("…")`, e um comentário entre os dois quebra a adjacência — foi
       exatamente o que aconteceu: depois de eu documentar a correção do
       `journey_state` logo acima do `select`, a mutação que reintroduzia o
       defeito passou VERDE. Um teste cego à prosa é um teste que para de
       proteger no dia em que alguém explica a decisão. */
    const src = readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    for (const m of src.matchAll(/\.from\(\s*"(\w+)"\s*\)\s*\n?\s*\.select\(\s*"([^"]+)"/g)) {
      const [, tabela, lista] = m;
      if (!TABELAS.includes(tabela)) continue;
      /* Junções (`a(b)`), contagens e `*` ficam de fora: não são colunas
         simples, e um teste que tentasse entendê-las começaria a mentir. */
      if (lista.includes("(") || lista.includes("*")) continue;
      saida.push({
        arquivo: f,
        tabela,
        colunas: lista
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
      });
    }
  }
  return saida;
}

describe("as colunas lidas existem no SQL", () => {
  const declaradas = colunasDeclaradas();
  const usos = selectsLiterais();

  test("o teste mede alguma coisa — há selects literais e colunas declaradas", () => {
    expect(usos.length).toBeGreaterThan(10);
    expect(declaradas.get("patient_profiles")!.size).toBeGreaterThan(15);
  });

  test("⚠️ nenhum `select` pede coluna que o SQL não declara", () => {
    const culpados: string[] = [];
    for (const u of usos) {
      const conhecidas = declaradas.get(u.tabela)!;
      for (const c of u.colunas) {
        if (!conhecidas.has(c)) culpados.push(`${u.arquivo}: ${u.tabela}.${c}`);
      }
    }
    expect(culpados).toEqual([]);
  });
});
