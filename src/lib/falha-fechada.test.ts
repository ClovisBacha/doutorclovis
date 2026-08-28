/**
 * LEITURA CUJO SILÊNCIO LIBERA ALGUMA COISA TEM DE FALHAR FECHADA.
 *
 * ⚠️ **A pergunta de triagem, e ela vale para toda leitura nova:**
 * _"se esta consulta voltar vazia ou com erro, alguma coisa fica mais
 * PERMITIDA, mais VISÍVEL ou mais BARATA?"_ Se sim, o erro tem de RECUSAR.
 *
 * Este repositório já pagou a mesma classe cinco vezes — o luto vazando, o
 * conjunto de bloqueio virando vazio, os horários livres ignorando as férias
 * do médico, o saldo do chá relido com erro descartado. Os três abaixo são a
 * sexta, sétima e oitava.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const ler = (f: string) => semComentarios(readFileSync(f, "utf8"));

/** O corpo de uma função exportada, do `export const NOME` até o próximo. */
function corpo(fonte: string, nome: string): string {
  const i = fonte.indexOf(`export const ${nome}`);
  expect(i).toBeGreaterThan(-1);
  const j = fonte.indexOf("\nexport ", i + 10);
  return fonte.slice(i, j === -1 ? fonte.length : j);
}

describe("marcar consulta: o choque de horário", () => {
  const M = corpo(ler("src/lib/admin.functions.ts"), "marcarConsultaNoDia");

  test("⚠️ a leitura do dia RECUSA quando falha", () => {
    /* Era `const { data: doDia } = await scopedBy(...)` com o erro descartado
       e `(doDia ?? [])` na régua: falha de leitura devolvia lista vazia, o
       choque virava `undefined`, e a consulta era marcada por cima de outra.
       O índice único do banco pega só o INSTANTE exato — a sobreposição
       (10:00–10:30 vs 10:15) passa por ele. */
    expect(M).toMatch(/doDia === null/);
    expect(M).toContain("Não foi possível conferir a agenda do dia");
  });

  test("⚠️ a régua não usa mais o `?? []` que apagava o choque", () => {
    expect(M).not.toMatch(/\(doDia \?\? \[\]\)/);
  });

  test("o degrau de `duration_minutes` continua", () => {
    /* Sem a coluna, ler sem ela e usar a duração padrão é melhor que recusar
       toda marcação num banco atrasado. */
    expect(M).toContain('lerODia("id, patient_name, confirmed_time")');
  });
});

describe("a cota mensal de convites Premium", () => {
  const I = ler("src/lib/invites.functions.ts");

  test("⚠️ a contagem devolve `null`, e nunca zero", () => {
    /* `return count ?? 0` com o erro descartado transformava toda falha em
       "zero usados": `0 >= 25` é falso, e a cota deixava de existir. Cada
       convite é um ANO de Premium grátis. */
    expect(I).toMatch(/Promise<number \| null>/);
    expect(I).toMatch(/if \(error\) return null;/);
  });

  test("⚠️ gerar convite RECUSA quando não deu para contar", () => {
    expect(I).toContain('error: "cota_ilegivel"');
  });

  test("⚠️ e o painel não anuncia convites que talvez não existam", () => {
    expect(I).toContain("usedIlegivel");
  });
});

describe("o chá de bebê e o Modo Cuidado", () => {
  const P = ler("src/lib/presentes.functions.ts");

  test("⚠️ perfil ilegível FECHA a lista", () => {
    /* Era `if (p?.care_mode)`. Com `p` nulo, `?.care_mode` é `undefined` e o
       `if` não dispara: a lista continuava no ar para as trinta pessoas que já
       têm o link, depois de uma perda. É o recurso em que isso dói mais,
       porque o objeto vive FORA do aparelho dela. */
    expect(P).toMatch(/if \(!p \|\| p\.care_mode\) return null;/);
    expect(P).not.toMatch(/if \(p\?\.care_mode\) return null;/);
  });
});
