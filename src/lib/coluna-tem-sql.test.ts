/**
 * TODA COLUNA QUE O CÓDIGO LÊ TEM DE EXISTIR EM ALGUM SQL.
 *
 * ⚠️ **ESTA CATRACA NASCEU DE CINCO COLUNAS MORTAS.** `silenciada_a/b`,
 * `saiu_a/b` (em `rede_conversas`) e `imagem_path`, `ref_tipo`, `ref_id` (em
 * `rede_mensagens`) eram lidas e gravadas pelo código e **criadas por nenhum
 * arquivo**. O código chegava a NOMEAR o SQL responsável
 * (`APLICAR_CONVERSA_SILENCIAR`) em dois comentários; o arquivo nunca tinha
 * sido escrito.
 *
 * ⚠️ **E NADA QUEBRAVA — é isso que fez durar.** Toda leitura do direct tem
 * degrau de recuo, então o app degradava em silêncio e três recursos ficavam
 * permanentemente mortos: silenciar uma conversa (o interruptor gravava no
 * nada e o push continuava chegando), sair de uma conversa, e a foto e o anexo
 * da mensagem.
 *
 * ⚠️ **`tabelas-que-existem.test.ts` não pegava**: ela confere TABELAS. Esta
 * confere COLUNAS, e é outra pergunta.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ **O RECORTE É ESTREITO DE PROPÓSITO, e isso não é preguiça.**
 *
 * Uma varredura ingênua sobre todo `.select()` do repositório dá dezenas de
 * falsos positivos — o parser de SQL erra em `CREATE TABLE` com tipos
 * compostos, em `ALTER` com várias cláusulas, em coluna citada dentro de um
 * `DO $$`. **Catraca com falso positivo é catraca que alguém desliga**, e aí
 * ela deixa de pegar o defeito de verdade.
 *
 * Então: ela cobre as tabelas da REDE SOCIAL e do DIRECT, que é onde as cinco
 * morreram e onde colunas novas nascem toda semana. Ampliar o alcance é bom —
 * desde que quem ampliar confira os falsos positivos um a um antes.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Os módulos varridos pela pergunta ampla ("a coluna existe no schema?").
 *
 * ⚠️ Lista à mão, e estreita de propósito: são os que consultam a rede e o
 * direct, onde coluna nova nasce toda semana e onde as cinco mortas viveram.
 * Acrescentar um exige rodar e conferir os achados um a um — catraca com falso
 * positivo é catraca que alguém desliga.
 */
const MODULOS = [
  "src/lib/conversa.functions.ts",
  "src/lib/rede-social.functions.ts",
  "src/lib/comentarios.functions.ts",
  "src/lib/caixinha.functions.ts",
];

/** As tabelas cobertas. Acrescentar uma exige conferir os achados à mão. */
const TABELAS = [
  "rede_conversas",
  "rede_mensagens",
  "rede_posts",
  "rede_stories",
  "rede_comentarios",
  "rede_perguntas",
];

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*--.*$/gm, " ");

function sqls(): string {
  const dirs = ["supabase", "supabase/migrations"];
  let tudo = "";
  for (const d of dirs) {
    let nomes: string[] = [];
    try {
      nomes = readdirSync(d).filter((n) => n.endsWith(".sql"));
    } catch {
      continue;
    }
    for (const n of nomes) tudo += "\n" + readFileSync(join(d, n), "utf8");
  }
  return semComentarios(tudo);
}

/**
 * As colunas que ALGUM SQL cria para uma tabela.
 *
 * ⚠️ Junta as duas formas — a lista do `CREATE TABLE` e todo `ADD COLUMN` de
 * qualquer `ALTER` — porque uma coluna pode nascer nas duas, e exigir uma delas
 * daria falso positivo em metade do schema.
 */
function colunasCriadas(sql: string, tabela: string): Set<string> {
  const fora = new Set([
    "constraint",
    "primary",
    "unique",
    "check",
    "foreign",
    "references",
    "create",
    "alter",
  ]);
  const achadas = new Set<string>();

  const cria = new RegExp(
    `CREATE TABLE(?: IF NOT EXISTS)?\\s+(?:public\\.)?${tabela}\\s*\\(([\\s\\S]*?)\\n\\s*\\)\\s*;`,
    "gi",
  );
  for (const m of sql.matchAll(cria)) {
    for (const linha of m[1].split("\n")) {
      const c = /^\s*([a-z_][a-z0-9_]*)\s+\S/i.exec(linha);
      if (c && !fora.has(c[1].toLowerCase())) achadas.add(c[1]);
    }
  }

  /* ⚠️ O `ALTER` vai até o `;`, e um `ALTER` pode ter VÁRIAS cláusulas
     `ADD COLUMN` separadas por vírgula — pegar só a primeira foi o que fez o
     meu primeiro levantamento acusar quatro colunas que existem. */
  const altera = new RegExp(`ALTER TABLE\\s+(?:public\\.)?${tabela}\\b([\\s\\S]*?);`, "gi");
  for (const m of sql.matchAll(altera)) {
    for (const c of m[1].matchAll(/ADD COLUMN(?: IF NOT EXISTS)?\s+([a-z_][a-z0-9_]*)/gi)) {
      achadas.add(c[1]);
    }
  }
  return achadas;
}

/** As colunas que o código pede de uma tabela, num `.select("…")` literal. */
function colunasPedidas(tabela: string): Map<string, Set<string>> {
  const porColuna = new Map<string, Set<string>>();
  const arquivos: string[] = [];
  const anda = (d: string) => {
    for (const n of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, n.name);
      if (n.isDirectory()) anda(p);
      else if (/\.tsx?$/.test(n.name) && !n.name.includes(".test.")) arquivos.push(p);
    }
  };
  anda("src");

  for (const f of arquivos) {
    const codigo = readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^\s*\/\/.*$/gm, " ");
    /* ⚠️ **ASPAS **E** CRASE — e o primeiro teste que escrevi só lia aspas.**
       A escada de degraus da conversa monta o `select` com template literal
       (`${BASE_DA_CONVERSA}, silenciada_a, saiu_a`), então a catraca ficava
       VAZIA justamente para a tabela cujas colunas mortas a fizeram nascer:
       apagar a coluna do SQL passava verde. É a armadilha do teste que passa
       em vazio, cometida no teste que existe para pegar defeito silencioso.

       Do template literal aproveita-se só o texto LITERAL: o que vem de
       `${...}` é outra constante, e ela é varrida pela sua própria ocorrência
       no arquivo. */
    const re = new RegExp(
      `\\.from\\(\\s*"${tabela}"\\s*\\)[\\s\\S]{0,200}?\\.select\\(\\s*(?:"([^"]*)"|\`([^\`]*)\`)`,
      "g",
    );
    for (const m of codigo.matchAll(re)) {
      const cru = (m[1] ?? m[2] ?? "").replace(/\$\{[^}]*\}/g, ",");
      for (const bruto of cru.split(",")) {
        const c = bruto.trim();
        if (/^[a-z_][a-z0-9_]*$/.test(c) && c !== "count") {
          if (!porColuna.has(c)) porColuna.set(c, new Set());
          porColuna.get(c)!.add(f);
        }
      }
    }
  }
  return porColuna;
}

/**
 * TODA coluna criada em QUALQUER tabela do schema.
 *
 * ⚠️ **A pergunta é "existe no schema?", e não "existe NESTA tabela?".**
 * A precisa seria melhor e é impossível de fazer sem falso positivo: o
 * `select` da conversa recebe uma VARIÁVEL (`\.select(colunas)`), montada
 * numa escada de degraus em outro ponto do arquivo — então casar
 * `.from("x").select("…")` fica CEGO exatamente para a tabela cujas colunas
 * mortas fizeram esta catraca nascer. E casar todo literal do arquivo por
 * tabela misturaria as colunas das três tabelas que `conversa.functions.ts`
 * consulta, produzindo falso positivo em cascata.
 *
 * A pergunta mais fraca pega o defeito real inteiro — as cinco colunas não
 * existiam em tabela NENHUMA — e não acusa nada correto.
 */
function todasAsColunasDoSchema(sql: string): Set<string> {
  const achadas = new Set<string>();
  const fora = new Set(["constraint", "primary", "unique", "check", "foreign", "references"]);
  for (const m of sql.matchAll(
    /CREATE TABLE(?: IF NOT EXISTS)?\s+(?:public\.)?\w+\s*\(([\s\S]*?)\n\s*\)\s*;/gi,
  )) {
    for (const linha of m[1].split("\n")) {
      const c = /^\s*([a-z_][a-z0-9_]*)\s+\S/i.exec(linha);
      if (c && !fora.has(c[1].toLowerCase())) achadas.add(c[1]);
    }
  }
  for (const c of sql.matchAll(/ADD COLUMN(?: IF NOT EXISTS)?\s+([a-z_][a-z0-9_]*)/gi)) {
    achadas.add(c[1]);
  }
  /* Views e funções também expõem nomes que o código lê legitimamente. */
  for (const c of sql.matchAll(/(?:AS|as)\s+([a-z_][a-z0-9_]*)\s*(?:,|\n)/g)) achadas.add(c[1]);
  return achadas;
}

/**
 * Os nomes que PARECEM lista de colunas nos módulos que falam com o banco.
 *
 * ⚠️ Só literais com VÍRGULA e só tokens `snake_case` — uma frase de interface
 * não tem essa forma, e um identificador `camelCase` do TypeScript também não.
 */
function candidatasNoModulo(arquivo: string): Map<string, number> {
  const codigo = readFileSync(arquivo, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
  const achadas = new Map<string, number>();
  for (const m of codigo.matchAll(/(?:"([^"\n]{6,300})"|`([^`]{6,300})`)/g)) {
    const cru = (m[1] ?? m[2] ?? "").replace(/\$\{[^}]*\}/g, ",");
    if (!cru.includes(",")) continue;
    /* ⚠️ `filter(Boolean)` — e sem ele a catraca ficava CEGA para o caso que a
       criou. `${BASE}, silenciada_a, …` vira `, silenciada_a, …` depois de
       trocar a interpolação por vírgula, e o primeiro pedaço é VAZIO: o
       `every` abaixo reprovava o literal inteiro, e as colunas dele nunca
       eram vistas. Conferido por mutação: sem esta linha, apagar
       `silenciada_a` do SQL passa verde. */
    const pedacos = cru
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    /* Uma lista de colunas é feita SÓ de tokens snake_case. Se algum pedaço
       não for, o literal é outra coisa (uma frase, uma classe de CSS). */
    if (pedacos.length < 2) continue;
    if (!pedacos.every((x) => /^[a-z_][a-z0-9_]*$/.test(x))) continue;
    for (const c of pedacos) achadas.set(c, (achadas.get(c) ?? 0) + 1);
  }
  return achadas;
}

describe("toda coluna lida existe em algum SQL", () => {
  const doSchema = todasAsColunasDoSchema(sqls());

  test("o parser leu o schema", () => {
    /* Sem isto, um parser quebrado acusaria TODAS as colunas e alguém
       desligaria a catraca em vez de ler o que ela diz. */
    expect(doSchema.size).toBeGreaterThan(200);
  });

  for (const arquivo of MODULOS) {
    test(arquivo.replace("src/lib/", ""), () => {
      const orfas = [...candidatasNoModulo(arquivo).keys()].filter((c) => !doSchema.has(c));
      expect(orfas).toEqual([]);
    });
  }

  for (const tabela of TABELAS) {
    test(`${tabela} — select literal`, () => {
      const criadas = colunasCriadas(sqls(), tabela);
      expect(criadas.size).toBeGreaterThan(2);
      const orfas: string[] = [];
      for (const [coluna, arquivos] of colunasPedidas(tabela)) {
        if (!criadas.has(coluna)) orfas.push(`${coluna} ← ${[...arquivos].join(", ")}`);
      }
      expect(orfas).toEqual([]);
    });
  }
});

describe("o SQL que o código NOMEIA existe", () => {
  /**
   * ⚠️ **O código citava `APLICAR_CONVERSA_SILENCIAR` e o arquivo não existia.**
   * Um comentário que nomeia o SQL responsável é a promessa mais barata de
   * fazer e a mais fácil de esquecer — e enquanto ele não existe, quem lê o
   * código conclui que a coluna só depende do dono rodar.
   */
  test("nenhum comentário aponta para um APLICAR_ inexistente", () => {
    const existentes = new Set(readdirSync("supabase").filter((n) => n.endsWith(".sql")));
    const citados = new Map<string, Set<string>>();
    const anda = (d: string) => {
      for (const n of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, n.name);
        if (n.isDirectory()) anda(p);
        else if (/\.tsx?$/.test(n.name)) {
          for (const m of readFileSync(p, "utf8").matchAll(/\bAPLICAR_[A-Z0-9_]+/g)) {
            const nome = `${m[0]}.sql`;
            if (!citados.has(nome)) citados.set(nome, new Set());
            citados.get(nome)!.add(p);
          }
        }
      }
    };
    anda("src");

    /* ⚠️ **A PROSA ABREVIA, e isso não é um fantasma.** Um comentário escreve
       "rodar `APLICAR_MAIS_DEZ` depois de…" para um arquivo que se chama
       `APLICAR_MAIS_DEZ_DA_REDE.sql`. Exigir o nome exato acusaria código
       correto — e catraca que reprova o certo é catraca que a próxima pessoa
       desliga, e aí ela deixa de pegar o defeito de verdade. Vale como
       existente quem for PREFIXO de um arquivo real. */
    const fantasmas: string[] = [];
    for (const [nome, onde] of citados) {
      const base = nome.replace(/\.sql$/, "");
      const achou = [...existentes].some((e) => e === nome || e.startsWith(base));
      if (!achou) fantasmas.push(`${nome} ← ${[...onde].join(", ")}`);
    }
    expect(fantasmas).toEqual([]);
  });
});
