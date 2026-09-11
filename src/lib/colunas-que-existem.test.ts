import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";

/**
 * ⚠️ AS COLUNAS QUE O CÓDIGO LÊ E FILTRA EXISTEM NO SQL?
 *
 * ─── POR QUE ISTO PRECISOU EXISTIR ──────────────────────────────────────────
 *
 * **Coluna errada não faz barulho nenhum.** O PostgREST responde `42703` a
 * coluna desconhecida numa LEITURA, e este projeto engole erro de leitura de
 * propósito em quase todo lugar (para o recurso degradar em vez de derrubar a
 * tela). A soma das duas coisas é um recurso que simplesmente deixa de existir,
 * sem erro, sem log e sem nada na tela a que apontar. Os cinco casos que
 * criaram e ampliaram este teste:
 *
 *  · `/api/legenda-da-foto` filtrava `patient_profiles` por `user_id` — a chave
 *    é `id`. O botão "✨ Sugerir legenda" dizia "não consegui pensar em nada"
 *    para TODA paciente, desde o primeiro dia.
 *  · o resumo semanal da criadora lia `affiliate_earnings.amount_cents`; a
 *    coluna se chama `commission_cents`.
 *  · o contador da porta do Álbum filtrava `family_album_posts.user_id`; é
 *    `patient_user_id`. `estado-das-portas` transforma contagem ilegível em
 *    `null`, e `null` **não desenha nada** — a porta prometia "12 fotos no
 *    álbum" e entregava o subtítulo.
 *  · o contador da porta "Nome do bebê" filtrava `baby_name_entries.user_id`, e
 *    essa tabela **não tem coluna de usuário nenhuma**: o elo com a paciente
 *    passa por `baby_name_sessions.patient_user_id`.
 *  · `achievements` lia `kick_sessions.created_at`; a coluna é `started_at`.
 *    `first_kicks` e `kicks_10` eram conquistas **permanentemente impossíveis**.
 *
 * ─── O QUE MUDOU, E POR QUE A COBERTURA PÔDE CRESCER ────────────────────────
 *
 * ⚠️ **AS TABELAS SAEM DO SQL, NUNCA DE UMA LISTA À MÃO.** A primeira versão
 * conferia seis tabelas escritas aqui dentro — e foi exatamente isso que deixou
 * `kick_sessions.created_at` viver: a tabela não estava na lista. **Catraca com
 * lista à mão dá sensação de cobertura exatamente onde não há.**
 *
 * ⚠️ **E O LADO DO FILTRO ENTROU.** Ela cobria só `select("…")`, e os três
 * defeitos mais caros da lista acima estão no `.eq(…)` — que é onde mora o
 * RECORTE, ou seja a diferença entre "a consulta devolve o dado dela" e "a
 * consulta devolve nada". Medido: 1.564 colunas de `select` e 1.354 filtros
 * literais, com ZERO acusações depois dos consertos.
 *
 * ⚠️ **A VIA É O SQL, E NUNCA `types.ts`.** Uma tentativa anterior de
 * automatizar isto usou o arquivo gerado, e ele conhece **27 tabelas de 131** —
 * a varredura acusou 37 falsos positivos, inclusive `patient_profiles.doctor_id`,
 * que o app inteiro usa. Catraca com falso positivo é catraca que alguém
 * desliga, e aí ela deixa de pegar o defeito de verdade.
 *
 * ⚠️ Isto é uma REDE, não uma prova: ela vê `select`/filtro LITERAIS, não vê
 * consulta montada por variável, e não conhece o banco de produção. O que ela
 * garante é que ninguém INVENTA um nome de coluna.
 */

function arquivos(dir: string, ext: RegExp, saida: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = `${dir}/${nome}`;
    if (statSync(caminho).isDirectory()) arquivos(caminho, ext, saida);
    else if (ext.test(nome)) saida.push(caminho);
  }
  return saida;
}

/**
 * ⚠️ **TIRA OS COMENTÁRIOS DO SQL ANTES DE PROCURAR.**
 *
 * A varredura de um `ALTER TABLE` vai até o `;` que fecha o comando (é o que
 * faz ela enxergar os VÁRIOS `ADD COLUMN` de um comando só). Um comentário `--`
 * do SQL pode ter um `;` dentro — e tem: *"`aberta` enquanto pede olhar dele;
 * `resolvida` depois"*, em `APLICAR_REVISAO.sql`. Sem tirar a prosa, a janela
 * fecha no meio do comando e as colunas declaradas DEPOIS do comentário somem
 * do conjunto conhecido.
 *
 * Medido: sem isto, a varredura acusava `brain_feedback.status` de não existir
 * — uma coluna que existe, é filtrada em seis lugares e funciona em produção.
 * É a mesma lição que este repositório já pagou nos dois sentidos (prosa
 * aprovando função morta, prosa reprovando código certo), agora no SQL.
 */
function semComentariosSql(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

/** A mesma régua para o TypeScript — um comentário quebra toda busca de texto. */
function semComentariosTs(texto: string): string {
  return texto.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

type Schema = { colunas: Map<string, Set<string>>; views: Set<string> };

/** Tudo que os `.sql` do repositório declaram, tabela a tabela. */
function schemaDoRepositorio(): Schema {
  const junto = arquivos("supabase", /\.sql$/)
    .map((f) => semComentariosSql(readFileSync(f, "utf8")))
    .join("\n");

  const colunas = new Map<string, Set<string>>();
  const add = (t: string, c: string) => {
    if (!colunas.has(t)) colunas.set(t, new Set());
    colunas.get(t)!.add(c);
  };

  /* O corpo de um `CREATE TABLE`: uma coluna por linha, `nome tipo …`. */
  for (const m of junto.matchAll(
    /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\s*\);/gi,
  )) {
    if (!colunas.has(m[1])) colunas.set(m[1], new Set());
    for (const linha of m[2].split("\n")) {
      const c = /^\s*"?(\w+)"?\s+[a-z]/i.exec(linha);
      if (c && !/^(constraint|unique|primary|foreign|check|exclude|like)$/i.test(c[1]))
        add(m[1], c[1]);
    }
  }
  /* ⚠️ **Um `ALTER TABLE` pode trazer VÁRIOS `ADD COLUMN`**, separados por
     vírgula e em linhas diferentes — e uma versão anterior só pegava o
     primeiro, acusando `emergency_phone` e `pre_pregnancy_weight_kg` de não
     existirem. A varredura vai até o `;` que fecha o comando. */
  for (const m of junto.matchAll(
    /ALTER TABLE\s+(?:IF EXISTS\s+)?(?:public\.)?(\w+)\b([\s\S]*?);/gi,
  ))
    for (const c of m[2].matchAll(/ADD COLUMN(?:\s+IF NOT EXISTS)?\s+"?(\w+)"?/gi)) add(m[1], c[1]);

  /* ⚠️ **AS VIEWS FICAM DE FORA.** As colunas de uma view nascem dos ALIASES do
     `SELECT` que a monta — e `clinical_events` é montada dinamicamente, dentro
     de uma string, por um `DO` que decide as fontes em tempo de execução.
     Tentar deduzi-las faria a catraca acusar código correto. */
  const views = new Set(
    [...junto.matchAll(/CREATE (?:OR REPLACE )?VIEW\s+(?:public\.)?(\w+)/gi)].map((m) => m[1]),
  );
  return { colunas, views };
}

/** Os métodos do PostgREST que recebem um NOME DE COLUNA como primeiro argumento. */
const METODOS_DE_FILTRO = "eq|neq|gt|gte|lt|lte|like|ilike|is|in|contains|containedBy|order";

type Uso = { arquivo: string; tabela: string; coluna: string; como: string };

/** Cada `select` e cada filtro LITERAL do app, com a tabela a que pertencem. */
export function usosLiterais(schema: Schema, fonte?: { arquivo: string; texto: string }): Uso[] {
  const saida: Uso[] = [];
  const entradas = fonte
    ? [fonte]
    : arquivos("src", /\.tsx?$/)
        .filter((f) => !/\.test\./.test(f))
        .map((f) => ({ arquivo: f, texto: readFileSync(f, "utf8") }));

  for (const { arquivo, texto } of entradas) {
    const src = semComentariosTs(texto);

    /* ── O lado do SELECT ──────────────────────────────────────────────────
       ⚠️ O `.select(` tem de estar COLADO no `.from(` — é isso que amarra a
       lista de colunas àquela tabela. Um comentário entre os dois quebrava a
       adjacência e já deixou uma mutação passar verde; por isso a prosa sai
       antes. */
    for (const m of src.matchAll(/\.from\(\s*"(\w+)"\s*\)\s*\n?\s*\.select\(\s*"([^"]+)"/g)) {
      const [, tabela, lista] = m;
      if (!schema.colunas.has(tabela) || schema.views.has(tabela)) continue;
      /* Junções (`a(b)`) e `*` ficam de fora: não são colunas simples, e uma
         catraca que tentasse entendê-las começaria a mentir. */
      if (lista.includes("(") || lista.includes("*")) continue;
      for (const c of lista
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean))
        saida.push({ arquivo, tabela, coluna: c, como: "select" });
    }

    /* ── O lado do FILTRO ──────────────────────────────────────────────────
       ⚠️ A JANELA É O QUE TORNA ISTO POSSÍVEL SEM FALSO POSITIVO: a consulta
       encadeia `.from("t")….eq("col", v)`, e o encadeamento acaba no próximo
       `.from(`, numa linha em branco ou num `;`. Casar qualquer coluna com
       qualquer tabela daria falso positivo em cascata. */
    for (const m of src.matchAll(/\.from\(\s*"(\w+)"\s*\)/g)) {
      const tabela = m[1];
      if (!schema.colunas.has(tabela) || schema.views.has(tabela)) continue;
      const resto = src.slice(m.index! + m[0].length);
      const fim = resto.search(/\.from\(|\n\s*\n|;\s*\n/);
      const janela = fim === -1 ? resto.slice(0, 600) : resto.slice(0, fim);
      for (const q of janela.matchAll(
        new RegExp(`\\.(${METODOS_DE_FILTRO})\\(\\s*"([\\w.]+)"`, "g"),
      )) {
        /* `order("a", {…})` e `eq("tabela.col", …)` de junção: fica o primeiro
           segmento, que é o que precisa existir NESTA tabela. */
        saida.push({ arquivo, tabela, coluna: q[2].split(".")[0], como: q[1] });
      }
    }
  }
  return saida;
}

/**
 * A ACUSAÇÃO, numa função só.
 *
 * ⚠️ **ELA É ÚNICA PORQUE A CONTRAPROVA PRECISA MORDER A MESMA RÉGUA.** A
 * primeira versão repetia a expressão nos dois lugares — e a mutação que
 * neutraliza a asserção principal (`.filter(() => false)`) passou VERDE, porque
 * a contraprova continuava usando a cópia dela. Uma catraca com a régua
 * duplicada prova que a CÓPIA funciona, nunca que a catraca funciona.
 */
function acusacoes(schema: Schema, usos: Uso[]): string[] {
  return [
    ...new Set(
      usos
        .filter((u) => !schema.colunas.get(u.tabela)!.has(u.coluna))
        .map((u) => `${u.arquivo}: ${u.tabela}.${u.coluna} (.${u.como})`),
    ),
  ].sort();
}

describe("as colunas lidas e filtradas existem no SQL", () => {
  const schema = schemaDoRepositorio();
  const usos = usosLiterais(schema);

  test("a catraca mede alguma coisa — e mede o repositório INTEIRO", () => {
    /* ⚠️ Os pisos existem porque uma varredura que casa ZERO fica VERDE. Se um
       deles cair, o que quebrou foi a varredura, não o app. */
    expect(schema.colunas.size).toBeGreaterThan(100);
    expect(schema.colunas.get("patient_profiles")!.size).toBeGreaterThan(15);
    expect(usos.filter((u) => u.como === "select").length).toBeGreaterThan(800);
    expect(usos.filter((u) => u.como !== "select").length).toBeGreaterThan(800);
    /* A tabela que a lista à mão não cobria, e onde o defeito viveu. */
    expect(usos.some((u) => u.tabela === "kick_sessions")).toBe(true);
  });

  test("⚠️ nenhum `select` e nenhum filtro pede coluna que o SQL não declara", () => {
    expect(acusacoes(schema, usos)).toEqual([]);
  });

  /* ⚠️ **CONTRAPROVA DE QUE ELA MORDE.** Catraca que passa em vazio é catraca
     que mente — e esta já teve as duas formas de mentira (a janela cortada por
     um `;` de comentário, e a lista de seis tabelas). Os quatro casos abaixo
     são os defeitos REAIS que ela achou, reintroduzidos um a um. */
  test("a catraca pega os quatro defeitos que ela existe para pegar", () => {
    const reintroduzidos = [
      `x.from("family_album_posts").select("id").eq("user_id", eu)`,
      `x.from("baby_name_entries").select("id").eq("user_id", eu)`,
      `x.from("kick_sessions").select("created_at").eq("user_id", eu)`,
      `x.from("patient_profiles").select("id").eq("user_id", eu)`,
    ];
    for (const linha of reintroduzidos) {
      const achados = acusacoes(
        schema,
        usosLiterais(schema, { arquivo: "mutante.ts", texto: linha }),
      );
      expect(achados.length).toBeGreaterThan(0);
    }
  });

  test("⚠️ e ela NÃO acusa o que existe — o `;` dentro de um comentário do SQL", () => {
    /* `brain_feedback.status` nasce num `ALTER TABLE` cujo comentário tem um
       ponto e vírgula. Sem `semComentariosSql`, esta asserção fica vermelha
       sobre uma coluna que funciona em produção. */
    expect(schema.colunas.get("brain_feedback")!.has("status")).toBe(true);
    expect(schema.colunas.get("brain_feedback")!.has("resolved_at")).toBe(true);
  });
});
