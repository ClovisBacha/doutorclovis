import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";

/**
 * ⚠️ `patient_profiles` SE FILTRA POR `id` — nunca por `user_id`.
 *
 * ─── O DEFEITO QUE ISTO CONSERTA ────────────────────────────────────────────
 *
 * A chave primária desta tabela JÁ É o uuid de `auth.users`:
 *
 *   CREATE TABLE public.patient_profiles (
 *     id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, …
 *
 * (primeira migration do projeto). **A coluna `user_id` não existe** — e o
 * PostgREST responde `42703` a um filtro sobre coluna desconhecida.
 *
 * O endpoint da legenda sugerida (`/api/legenda-da-foto`) filtrava por
 * `user_id`. Ele tem recuo por coluna ausente, mas o recuo repete a leitura com
 * o MESMO filtro errado: as duas falhavam, `perfil` vinha `null`, e o handler
 * caía em `return json({ ok: true, sugestoes: [] })`.
 *
 * Resultado: o botão "✨ Sugerir legenda" — a ideia que o dono mais gostou —
 * **nunca funcionou para ninguém**. Ele dizia "não consegui pensar em nada"
 * desde o primeiro dia, e o `try/catch` fazia isso sem erro, sem log e sem
 * nada na tela que distinguisse "a foto não rendeu" de "está quebrado".
 *
 * Setenta e seis chamadas no repositório usam `id`; duas usavam `user_id`, e as
 * duas eram minhas.
 *
 * ⚠️ **A confusão é fácil e vai voltar**: quase toda OUTRA tabela do app tem
 * mesmo `user_id` (`health_logs`, `journal_entries`, `presente_listas`,
 * `push_subscriptions`…). Esta é a exceção, e por isso ela precisa de catraca.
 */
const PASTAS = ["src/lib", "src/routes", "src/components"];

function arquivos(dir: string, saida: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = `${dir}/${nome}`;
    if (statSync(caminho).isDirectory()) arquivos(caminho, saida);
    else if (/\.tsx?$/.test(nome) && !/\.test\./.test(nome)) saida.push(caminho);
  }
  return saida;
}

/** Sem comentários: esta própria prosa cita a string proibida. */
function semComentarios(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

describe("as consultas a patient_profiles", () => {
  const todos = PASTAS.flatMap((p) => arquivos(p));

  test("existem muitas — senão este teste não mede nada", () => {
    const n = todos.filter((f) =>
      readFileSync(f, "utf8").includes('from("patient_profiles")'),
    ).length;
    expect(n).toBeGreaterThan(10);
  });

  test("⚠️ nenhuma filtra por `user_id` — a coluna não existe", () => {
    const culpados: string[] = [];
    for (const f of todos) {
      const codigo = semComentarios(readFileSync(f, "utf8"));
      let i = codigo.indexOf('from("patient_profiles")');
      while (i !== -1) {
        /* A janela é a CADEIA daquela consulta: do `.from(` até o `maybeSingle`
           / `single` / `;` mais próximo. Sem o corte, um `.eq("user_id", …)` de
           OUTRA tabela mais abaixo no arquivo entraria na conta — que é
           exatamente como um teste destes começa a mentir. */
        const resto = codigo.slice(i, i + 600);
        const fim = Math.min(
          ...[resto.indexOf("maybeSingle("), resto.indexOf("single("), resto.indexOf(";")]
            .filter((n) => n > -1)
            .concat([resto.length]),
        );
        const cadeia = resto.slice(0, fim);
        if (cadeia.includes('.eq("user_id"') || cadeia.includes('"user_id",')) {
          culpados.push(`${f}: ${cadeia.replace(/\s+/g, " ").slice(0, 120)}`);
        }
        i = codigo.indexOf('from("patient_profiles")', i + 10);
      }
    }
    expect(culpados).toEqual([]);
  });
});
