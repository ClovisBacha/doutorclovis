import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { FONTES } from "./exportar-dados";

/**
 * ⚠️ AS COLUNAS QUE O EXPORT PEDE EXISTEM **NAQUELA TABELA**?
 *
 * ─── POR QUE ISTO PRECISOU EXISTIR ──────────────────────────────────────────
 *
 * `colunas-que-existem.test.ts` é cego para o export, e por um motivo de
 * forma: ele casa `select("…")` LITERAL colado a um `.from()`, e aqui as
 * colunas moram numa TABELA DE DADOS (`FONTES`) que um laço lê em tempo de
 * execução. Nenhum `select` literal existe no arquivo.
 *
 * O preço disso estava em produção, e não era um: eram QUATRO.
 *
 *  · `patient_profiles` pedia `pre_pregnancy_weight` (é `..._kg`) — o bloco
 *    do CADASTRO dela falhava para TODA paciente, e não em silêncio: o
 *    exportador conta `42703` como FALHA, então o arquivo saía sem o perfil e
 *    a tela dizia que aquela parte não veio. Ela baixa "todos os meus dados",
 *    lê que faltou, e o que faltou é justamente nome, DUM, alergias e contato
 *    de emergência.
 *  · `consultations` filtrava por `patient_id` (é `user_id`) — os resumos que
 *    o médico escreveu PARA ela, fora.
 *  · `sementinhas_ledger` pedia `razao, quantidade` (é `reason, amount`).
 *  · `appointment_requests` pedia `requested_date, requested_time` (é
 *    `preferred_date, preferred_time`).
 *
 * ⚠️ E A CONFERÊNCIA TEM DE SER **POR TABELA**, nunca "o nome aparece em algum
 * `.sql`". A primeira versão deste conferidor procurava no SQL inteiro e
 * deixou `quantidade` passar — a palavra existe noutra tabela. Coluna certa na
 * tabela errada é exatamente o defeito que isto existe para pegar.
 *
 * ⚠️ É uma REDE, não uma prova: ela lê os `.sql` do repositório, e não o banco
 * de produção. Uma tabela sem DDL aqui é REPROVADA em vez de ignorada —
 * ignorar em silêncio seria a mesma falha aberta que o defeito acima.
 */

function arquivos(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = `${dir}/${nome}`;
    if (statSync(p).isDirectory()) arquivos(p, out);
    else if (/\.sql$/.test(nome)) out.push(p);
  }
  return out;
}

const SQL = arquivos("supabase")
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

/** As colunas declaradas para uma tabela: o `CREATE TABLE` mais todo `ADD COLUMN`. */
export function colunasDeclaradas(tabela: string, sql = SQL): Set<string> {
  const set = new Set<string>();

  const criar = new RegExp(
    `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?${tabela}\\s*\\(([\\s\\S]*?)\\n\\);`,
    "gi",
  );
  for (const m of sql.matchAll(criar)) {
    for (const linha of m[1].split("\n")) {
      const c = linha.trim().match(/^([a-z_0-9]+)\s+[a-z]/i);
      if (c && !/^(primary|unique|foreign|constraint|check|exclude)$/i.test(c[1])) set.add(c[1]);
    }
  }

  const alterar = new RegExp(
    `ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:public\\.)?${tabela}\\b([\\s\\S]*?);`,
    "gi",
  );
  for (const m of sql.matchAll(alterar))
    for (const a of m[1].matchAll(/ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_0-9]+)/gi))
      set.add(a[1]);

  return set;
}

describe("o export da LGPD só pede coluna que existe", () => {
  test("toda tabela de FONTES tem DDL no repositório", () => {
    const sem = FONTES.filter((f) => colunasDeclaradas(f.tabela).size === 0).map((f) => f.tabela);
    expect(sem).toEqual([]);
  });

  test("toda coluna pedida existe NAQUELA tabela", () => {
    const erradas: string[] = [];
    for (const f of FONTES) {
      const existe = colunasDeclaradas(f.tabela);
      if (existe.size === 0) continue;
      const pedidas = [f.coluna, ...f.colunas.split(",").map((c) => c.trim())].filter((c) =>
        /^[a-z_0-9]+$/.test(c),
      );
      for (const c of pedidas) if (!existe.has(c)) erradas.push(`${f.tabela}.${c}`);
    }
    expect(erradas).toEqual([]);
  });

  /* A contraprova: sem ela, um conferidor que casasse tudo ficaria verde e
     ninguém saberia. Os quatro nomes abaixo são os que estavam em produção. */
  test("a conferência MORDE — os quatro nomes reais são recusados", () => {
    expect(colunasDeclaradas("patient_profiles").has("pre_pregnancy_weight")).toBe(false);
    expect(colunasDeclaradas("consultations").has("patient_id")).toBe(false);
    expect(colunasDeclaradas("sementinhas_ledger").has("razao")).toBe(false);
    expect(colunasDeclaradas("appointment_requests").has("requested_date")).toBe(false);
  });

  /* ⚠️ E ela não pode ser cega por TABELA: `quantidade` existe no schema, em
     OUTRA tabela — foi assim que a primeira versão deixou passar. */
  test("coluna certa na tabela errada é recusada", () => {
    expect(/\bquantidade\b/.test(SQL)).toBe(true);
    expect(colunasDeclaradas("sementinhas_ledger").has("quantidade")).toBe(false);
  });

  test("as certas passam", () => {
    expect(colunasDeclaradas("patient_profiles").has("pre_pregnancy_weight_kg")).toBe(true);
    expect(colunasDeclaradas("consultations").has("user_id")).toBe(true);
    expect(colunasDeclaradas("sementinhas_ledger").has("reason")).toBe(true);
    expect(colunasDeclaradas("appointment_requests").has("preferred_date")).toBe(true);
  });
});
