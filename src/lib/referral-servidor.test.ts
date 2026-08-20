import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * AS TRAVAS DA ATRIBUIÇÃO DE INDICAÇÃO, lidas na fonte.
 *
 * ⚠️ Sem comentários antes de procurar — a prosa que explica uma decisão contém
 * as palavras que o teste proíbe. Já custou um teste vermelho sobre código
 * certo, e um verde sobre código errado.
 */
function semComentarios(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}
const CODIGO = semComentarios(readFileSync("src/lib/referral.functions.ts", "utf8"));

describe("o seguir depois do convite", () => {
  /* ⚠️ A decisão sai da régua pura, com o portão de Modo Cuidado dentro — nunca
     de um `if` escrito aqui, que só seria testável lendo o fonte. */
  test("⚠️ a decisão é `deveLigarNaRede`, e recebe as DUAS em cuidado", () => {
    const i = CODIGO.indexOf("deveLigarNaRede({");
    expect(i).toBeGreaterThan(-1);
    const chamada = CODIGO.slice(i, CODIGO.indexOf("})", i));
    expect(chamada).toContain("indicadoraEmCuidado: refEmCuidado");
    expect(chamada).toContain("novaEmCuidado: await isCareModeActive(supabaseAdmin, uid)");
    expect(chamada).toContain("mesmaPessoa: referrerId === uid");
  });

  /* ⚠️ Os pares saem da régua, na ordem dela: se a segunda gravação falhar, o
     estado que sobra é "a indicadora segue a recém-chegada" — o que ela pediu
     ao mandar o convite. */
  test("⚠️ os pares vêm de `paresDoSeguir`, e não montados aqui", () => {
    expect(CODIGO).toContain("for (const par of paresDoSeguir(referrerId, uid))");
    expect(CODIGO).not.toContain('estado: "ativo" }');
  });

  /* ⚠️ `23505` é a dedupe do índice funcionando: a amiga pode já seguir a
     indicadora por conta própria, e isso é sucesso repetido, não erro. */
  test("⚠️ colidir no par é sucesso repetido", () => {
    expect(CODIGO).toContain('.from("rede_seguidores").insert(par)');
    expect(CODIGO).toContain('(error as any).code !== "23505"');
    expect(CODIGO).not.toContain('from("rede_seguidores").upsert');
  });

  /* ⚠️ Best-effort: a atribuição já está fixada. Derrubá-la aqui faria a amiga
     tentar de novo com o `referred_by` já preenchido — perdendo a indicação de
     vez, que é o oposto do que estas linhas decorativas valem. */
  test("⚠️ falhar aqui NÃO derruba a atribuição", () => {
    const i = CODIGO.indexOf("paresDoSeguir");
    const depois = CODIGO.slice(i);
    expect(depois).toContain("catch (e)");
    expect(depois).toContain("return { ok: true as const, attributed: true };");
    /* Nenhum `return { ok: false` depois do ponto em que a indicação já foi
       fixada — se houvesse, a amiga levaria erro sobre um vínculo que existe. */
    expect(depois).not.toContain("ok: false");
  });
});

describe("o Modo Cuidado da indicadora", () => {
  /* Ele decide a moeda, o push E o seguir — e este caminho roda no primeiro
     login de toda conta nova. Ler a mesma linha três vezes seguidas é
     desperdício onde ele custa a primeira impressão do app. */
  test("é lido UMA vez e reusado nas três pontas", () => {
    expect(CODIGO).toContain(
      "const refEmCuidado = await isCareModeActive(supabaseAdmin, referrerId)",
    );
    const usos = (CODIGO.match(/!refEmCuidado/g) ?? []).length;
    expect(usos).toBe(2);
    expect(CODIGO).toContain("indicadoraEmCuidado: refEmCuidado");
  });
});
