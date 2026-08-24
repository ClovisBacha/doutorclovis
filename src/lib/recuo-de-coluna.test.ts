import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * ⚠️ UM RECUO QUE TESTA O CÓDIGO ERRADO É UM RECUO QUE NUNCA RODA.
 *
 * São DOIS códigos, e a diferença não é cosmética (o cabeçalho de
 * `postgrest.ts` já explica):
 *
 *   · **42703** — Postgres. Sai de um SELECT/ORDER/FILTER que cita coluna
 *     ausente.
 *   · **PGRST204** — PostgREST. Sai de um INSERT/UPDATE cujo PAYLOAD tem coluna
 *     fora do schema cache. Nem chega ao Postgres — logo, **nunca 42703**.
 *
 * Quem escreve `code === "42703"` num caminho de ESCRITA escreveu um escudo
 * decorativo. Já custou três vezes nesta base:
 *
 *   · o "Salvar perfil" do médico falhava SEMPRE num banco sem as colunas do
 *     perfil rico — e o comentário ao lado dizia estar impedindo exatamente
 *     isso;
 *   · a devolutiva de exame sumia enquanto a tela dizia "✓";
 *   · **o acionamento de SOS não era gravado.** A escada de três tentativas de
 *     `panic_events` quebrava na primeira, porque o `break` disparava no erro
 *     que ela existia para tolerar. Os avisos saíam; o registro que o médico vê
 *     depois, não.
 *
 * A régua: **num caminho de escrita, o teste passa por `colunaAusente`** — ela
 * cobre os dois códigos, e assim não depende de ninguém lembrar qual é qual.
 */
function arquivosDoProjeto(dir = "src"): string[] {
  const out: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) out.push(...arquivosDoProjeto(p));
    else if (/\.(ts|tsx)$/.test(nome) && !nome.includes(".test.")) out.push(p);
  }
  return out;
}

/** Sem comentários: a prosa deste repo cita os códigos para explicá-los. */
function semComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

describe("recuo de coluna ausente usa a régua, não o código cru", () => {
  const ARQUIVOS = arquivosDoProjeto().filter((f) => f !== "src/lib/postgrest.ts");

  /**
   * ⚠️ **Só o caminho de ESCRITA é cobrado, e de propósito.**
   *
   * `42703` num SELECT está CERTO — é literalmente o código que o Postgres
   * devolve ali. Proibir o literal em todo lugar viraria uma migração de 39
   * sítios para consertar 3, e catraca que obriga refator grande é catraca que
   * alguém desliga.
   */
  test("⚠️ nenhum `42703` cru decide um recuo de INSERT/UPDATE/UPSERT", () => {
    const culpados: string[] = [];
    for (const f of ARQUIVOS) {
      const linhas = semComentarios(readFileSync(f, "utf8")).split("\n");
      linhas.forEach((l, i) => {
        if (!l.includes('"42703"')) return;
        /* A janela para trás: de onde veio o `error` que está sendo testado. */
        const janela = linhas.slice(Math.max(0, i - 25), i + 1).join("\n");
        const escrita = /\.(insert|update|upsert)\(/.test(janela);
        const leitura = /\.select\(/.test(janela);
        /* Ambíguo (select E escrita na janela) não acusa: o falso positivo
           mandaria alguém mexer em código correto, que é pior. */
        if (escrita && !leitura) culpados.push(`${f}:${i + 1}`);
      });
    }
    expect(culpados).toEqual([]);
  });

  test("a varredura olha arquivos de verdade (o teste testa algo)", () => {
    expect(ARQUIVOS.length).toBeGreaterThan(100);
    /* E `postgrest.ts`, que define os códigos, está fora — senão ele mesmo
       seria o primeiro culpado. */
    expect(ARQUIVOS).not.toContain("src/lib/postgrest.ts");
  });

  /**
   * ⚠️ O SOS é o caminho mais caro deste defeito, e por isso tem asserção
   * própria: a escada de `panic_events` existe para o banco atrás das
   * migrations, e é justamente nele que ela precisa rodar.
   */
  test("⚠️ a escada do SOS tolera coluna ausente pelos DOIS códigos", () => {
    const src = semComentarios(readFileSync("src/lib/emergencia.functions.ts", "utf8"));
    const i = src.indexOf('from("panic_events").insert');
    expect(i).toBeGreaterThan(-1);
    const trecho = src.slice(Math.max(0, i - 400), i + 400);
    expect(trecho).toContain("colunaAusente(error)");
    expect(trecho).not.toContain('"42703"');
  });
});
