/**
 * TODA TABELA CONSULTADA PRECISA EXISTIR NO SCHEMA.
 *
 * ─── O DEFEITO QUE ISTO PEGA ────────────────────────────────────────────────
 *
 * O cron de lembretes lia `pre_consultation_forms`. A tabela chama-se
 * `preconsulta_forms`. O efeito foi INVISÍVEL: a leitura falhava, o código
 * tratava a falha como "todas já responderam" — que é o lado seguro de errar —
 * e o pedido de pré-consulta simplesmente nunca saía. Sem erro na tela, sem
 * log, sem push, sem nada para investigar.
 *
 * `supabase-js` não valida nomes de tabela em tempo de compilação quando o
 * cliente é usado com `as any`, o que este projeto faz em quase todo lugar por
 * causa das tabelas que o `types.ts` ainda não conhece. Então a checagem tem de
 * ser esta: comparar o que o código pede com o que o schema declara.
 *
 * ─── POR QUE ISTO NÃO É UM TESTE FRÁGIL ─────────────────────────────────────
 *
 * A lista de exceções é EXPLÍCITA e pequena: são as tabelas criadas pelos
 * arquivos `APLICAR_*.sql` que o `types.ts` (gerado antes delas) ainda não
 * conhece. Cada uma está nomeada aqui e conferida contra o SQL que a cria — ou
 * seja, uma tabela nova só passa se existir num APLICAR.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

/** Os nomes que o `types.ts` gerado conhece. */
function tabelasDoSchema(): Set<string> {
  const t = readFileSync("src/integrations/supabase/types.ts", "utf8");
  const dentro = t.slice(t.indexOf("Tables: {"));
  return new Set([...dentro.matchAll(/^ {6}(\w+): \{$/gm)].map((m) => m[1]));
}

/** Os nomes que algum `APLICAR_*.sql` cria. */
function tabelasDosAplicar(): Set<string> {
  const nomes = new Set<string>();
  for (const arq of readdirSync("supabase").filter((f) => f.startsWith("APLICAR_"))) {
    const sql = readFileSync(`supabase/${arq}`, "utf8");
    for (const m of sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+public\.(\w+)/gi)) nomes.add(m[1]);
    for (const m of sql.matchAll(/CREATE TABLE\s+public\.(\w+)/gi)) nomes.add(m[1]);
    /* Views contam: o código as consulta como tabela. */
    for (const m of sql.matchAll(/CREATE\s+(?:OR REPLACE\s+)?VIEW\s+public\.(\w+)/gi))
      nomes.add(m[1]);
    for (const m of sql.matchAll(/CREATE VIEW public\.(\w+)/gi)) nomes.add(m[1]);
  }
  return nomes;
}

/** Todo `.from("x")` do código de servidor. */
function tabelasPedidas(): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  const anda = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const caminho = `${dir}/${e.name}`;
      if (e.isDirectory()) anda(caminho);
      else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".test.ts")) {
        const src = readFileSync(caminho, "utf8");
        for (const m of src.matchAll(/\.from\(\s*"([a-z_][a-z0-9_]*)"\s*\)/g)) {
          /* ─── STORAGE TAMBÉM TEM `.from()` ─────────────────────────────
             `supabase.storage.from("medicos")` é um BUCKET, não uma tabela — e
             buckets nunca aparecem no `types.ts`. Excluído pelo contexto, e não
             por uma lista de nomes permitidos: uma lista faria o próximo bucket
             quebrar o teste e alguém "consertar" adicionando o nome, que é como
             uma trava vira formalidade. */
          const antes = src.slice(Math.max(0, m.index! - 40), m.index!);
          if (/\.storage\s*$|storage\s*\.\s*$/.test(antes)) continue;
          const lista = mapa.get(m[1]) ?? [];
          lista.push(caminho);
          mapa.set(m[1], lista);
        }
      }
    }
  };
  anda("src");
  return mapa;
}

describe("as tabelas que o código pede existem no schema", () => {
  const schema = tabelasDoSchema();
  const aplicar = tabelasDosAplicar();
  const pedidas = tabelasPedidas();

  test("a varredura de fato encontrou schema e chamadas", () => {
    /* Sem isto, um regex quebrado faria o teste passar sem conferir nada — que
       é exatamente o modo de falha que ele existe para impedir. */
    expect(schema.size).toBeGreaterThan(10);
    expect(pedidas.size).toBeGreaterThan(10);
    expect(aplicar.size).toBeGreaterThan(3);
  });

  test("nenhum `.from()` aponta para tabela que não existe em lugar nenhum", () => {
    /**
     * Uma tabela vale se o `types.ts` a conhece OU se algum `APLICAR_*.sql` a
     * cria. Fora disso, o nome está errado — e o erro é silencioso, porque o
     * chamador quase sempre trata falha de leitura como "lista vazia".
     */
    const orfas = [...pedidas.entries()]
      .filter(([nome]) => !schema.has(nome) && !aplicar.has(nome))
      .map(([nome, onde]) => `${nome} (em ${[...new Set(onde)].join(", ")})`);
    expect(orfas).toEqual([]);
  });

  test("o cron de lembretes lê a tabela de pré-consulta com o nome certo", () => {
    /* O caso concreto que motivou o arquivo. `pre_consultation_forms` não
       existe; `preconsulta_forms` existe.

       ⚠️ **A CONSULTA MUDOU DE ARQUIVO, e esta catraca pegou a mudança.** O
       trabalho saiu de `routes/api/lembretes-tick.ts` para
       `lib/lembretes.server.ts` quando os lembretes ganharam varredura
       preguiçosa (a outra catraca — `rotas-sem-export-solto` — exigiu a
       mudança, porque export não-rota em arquivo de rota engorda a árvore de
       rotas). O alvo aqui acompanha; a asserção é a MESMA. */
    const varredura = readFileSync("src/lib/lembretes.server.ts", "utf8");
    expect(varredura).toContain('.from("preconsulta_forms")');
    expect(varredura).not.toContain('.from("pre_consultation_forms")');
    /* E a rota continua sendo só a porta: se a consulta voltar para lá, é
       porque alguém desfez a separação.

       ⚠️ **Com a ASPA.** Sem ela a asserção casava `Buffer.from(a)`, do
       comparador de segredo em tempo constante — e reprovava um arquivo
       correto. É a mesma família dos casamentos frouxos que este repositório já
       pagou: `.includes` pegando `bloquearPeriodo`, `_complete$` pegando
       `profile_complete`. Leitura de tabela sempre tem o nome entre aspas. */
    const rota = readFileSync("src/routes/api/lembretes-tick.ts", "utf8");
    expect(rota).not.toContain('.from("');
  });
});

/**
 * ⚠️ E AS COLUNAS? — a catraca que eu TENTEI e NÃO dá para construir hoje.
 *
 * Eu escrevi, nesta mesma noite, uma consulta a `amizades.de_id` / `.para_id` /
 * `.estado`. As colunas de verdade se chamam `menor` / `maior` / `aceita`. E a
 * `companion_invites.revoked_at` que inventei também não existe — é
 * `expires_at`.
 *
 * ⚠️ **Nada teria acusado.** `tsc` não conhece o schema, o lint não olha string,
 * e o `.eq()` errado volta `42703` em tempo de execução: o contador viraria
 * `null` e o recurso ficaria **invisível, sem nunca dar erro** — a mesma falha
 * silenciosa que esta noite passou consertando, cometida por mim.
 *
 * ─── POR QUE A CATRACA NÃO EXISTE ───────────────────────────────────────────
 *
 * A fonte natural seria `types.ts`, que é GERADO do banco. Medido: ele conhece
 * **27 tabelas de 112** e **não sabe o que é `doctor_id`** — está muito atrás do
 * schema. Uma varredura sobre ele acusou **37 falsos positivos**, incluindo
 * `patient_profiles.doctor_id`, que o app inteiro usa.
 *
 * ⚠️ **Catraca com falso positivo é catraca que alguém desliga**, e aí ela deixa
 * de pegar o defeito de verdade. Preferi não ter a essa.
 *
 * ─── O QUE DESTRAVA, quando alguém quiser ───────────────────────────────────
 *
 * Regenerar `types.ts` a partir do banco (`supabase gen types typescript`).
 * Feito isso, a varredura passa a ser possível e vale a pena — o recorte certo
 * é só `.eq("col", …)` COLADO num `.from("tabela")`, no mesmo encadeamento:
 * tentar casar qualquer coluna com qualquer tabela dá falso positivo em cascata.
 *
 * Enquanto isso, a defesa é humana: **conferir a coluna no `supabase/*.sql`
 * antes de escrever o filtro.** Foi assim que este erro foi achado.
 */
