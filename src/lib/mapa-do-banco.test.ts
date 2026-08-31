/**
 * O MAPA DO BANCO NÃO PODE ENVELHECER.
 *
 * ⚠️ A tela de saúde do banco existe para responder "quais `APLICAR_*.sql` eu
 * ainda não rodei?". Se o mapa ficar para trás da pasta `supabase/`, ela
 * responde **"tudo aplicado" sobre um arquivo que ela não conhece** — que é
 * pior que não ter a tela, porque agora existe um verde afirmando o contrário.
 *
 * Por isso o mapa é GERADO. Este teste regenera e compara.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { MAPA_DO_BANCO } from "./mapa-do-banco";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

describe("o mapa do banco", () => {
  test("⚠️ está em dia com a pasta supabase/", () => {
    const antes = readFileSync("src/lib/mapa-do-banco.ts", "utf8");
    execFileSync("node", ["scripts/gerar-mapa-do-banco.mjs"], { stdio: "pipe" });
    const depois = readFileSync("src/lib/mapa-do-banco.ts", "utf8");
    /* Se este teste falhar, o conserto é rodar
       `node scripts/gerar-mapa-do-banco.mjs` e commitar o resultado. */
    expect(depois).toBe(antes);
  });

  test("conhece os arquivos que o repositório de fato tem", () => {
    /* Um número solto envelheceria; o que se cobra é que a ORDEM de grandeza
       não desabe — um gerador quebrado devolvendo lista vazia passaria numa
       asserção de "existe alguma coisa". */
    expect(MAPA_DO_BANCO.length).toBeGreaterThan(40);
    expect(MAPA_DO_BANCO.every((a) => a.alvos.length > 0)).toBe(true);
  });

  test("⚠️ coluna de tabela que o próprio arquivo CRIA não vira conferência", () => {
    /* Se a tabela existe, ela nasceu com as colunas. Conferi-las daria falso
       vermelho num banco correto — e catraca com falso positivo é catraca que
       alguém desliga. */
    for (const a of MAPA_DO_BANCO) {
      const criadas = new Set(a.alvos.filter((x) => x.colunas.length === 0).map((x) => x.tabela));
      for (const x of a.alvos) {
        if (x.colunas.length > 0) expect(criadas.has(x.tabela)).toBe(false);
      }
    }
  });
});

describe("a sonda do banco", () => {
  const SONDA = semComentarios(readFileSync("src/lib/saude-do-banco.functions.ts", "utf8"));

  test('⚠️ "não consegui conferir" nunca vira "ok"', () => {
    /* Um painel de saúde de banco erra numa direção só que importa: para o
       lado de dizer que está tudo certo. */
    expect(SONDA).toMatch(/return \{ tabela, colunas, estado: "erro"/);
    expect(SONDA).toMatch(/estado === "erro"[\s\S]{0,80}"incerto"/);
  });

  test("⚠️ sem a chave de serviço ela RECUSA, em vez de medir a RLS", () => {
    const i = SONDA.indexOf("SUPABASE_SERVICE_ROLE_KEY");
    expect(i).toBeGreaterThan(-1);
    /* E vem ANTES de qualquer sonda: medir permissão e chamar de schema faria
       toda tabela com RLS aparecer como problema. */
    expect(i).toBeLessThan(SONDA.indexOf("const sondar"));
  });

  test("⚠️ nenhuma linha de paciente viaja", () => {
    /* `head: true` devolve só o cabeçalho: um painel de diagnóstico não é
       motivo para trafegar prontuário. */
    expect(SONDA).toMatch(/\{ head: true, count: "exact" \}/);
  });
});

describe("a tela do banco é alcançável", () => {
  const ADMIN = semComentarios(readFileSync("src/routes/_authenticated/admin.tsx", "utf8"));

  test("⚠️ existe aba, e ela desenha", () => {
    /* A forma exata do defeito que a fila de denúncias e os números da
       Comunidade já pagaram aqui: a função pronta, o componente escrito, e
       ninguém conseguindo chegar na tela. */
    expect(ADMIN).toMatch(/key: "banco"/);
    expect(ADMIN).toMatch(/tab === "banco" &&[\s\S]{0,80}<SaudeDoBancoTab/);
    expect(ADMIN).toContain("saudeDoBanco({");
  });
});
