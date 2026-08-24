import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/** Sem comentários antes de procurar — a prosa cita as palavras proibidas. */
function semComentarios(s: string): string {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}
const REDE = semComentarios(readFileSync("src/lib/rede-social.functions.ts", "utf8"));
const REGUA = semComentarios(readFileSync("src/lib/conta-oficial.ts", "utf8"));
/**
 * ⚠️ **SEM OS COMENTÁRIOS DO SQL.** O comentário que EXPLICA por que a coluna
 * não pode nascer dentro de um `CREATE TABLE IF NOT EXISTS` contém, por
 * definição, essa mesma string — e foi assim que este teste ficou vermelho
 * sobre um arquivo correto. Prosa não é código, nas duas direções.
 */
const SQL = readFileSync("supabase/APLICAR_CONTA_OFICIAL.sql", "utf8")
  .split("\n")
  .filter((l) => !l.trimStart().startsWith("--"))
  .join("\n");

describe("a conta oficial na rede", () => {
  /* ⚠️ Ela cairia no FIM da fileira exatamente na conta nova — que é a única
     para quem ela importa. Fixar é a única forma de o dia um funcionar. */
  /**
   * ⚠️ ESTA ASSERÇÃO JÁ TRAVOU O DEFEITO NO LUGAR, e vale registrar.
   *
   * Ela cobrava `pessoas.find((p) => p.oficial)` — e `pessoas` já é o recorte de
   * `PESSOAS_SUGERIDAS` do ranking, ordenado por elos em comum. A conta oficial
   * não tem elo com ninguém: ela cai no FIM e é a primeira a ser cortada.
   * Procurá-la ali era procurar no único lugar de onde ela sempre tinha acabado
   * de sair, e `comOficialNoTopo` virava no-op silencioso — a conta do
   * consultório não aparecia para ninguém, que é o recurso inteiro do dia um.
   *
   * O teste ficou verde o tempo todo, porque ele descrevia o código em vez de
   * descrever o que o código precisa fazer. Hoje cobra a busca entre as
   * CANDIDATAS, e o comportamento está em `conta-oficial.test.ts`.
   */
  test("⚠️ vem fixada no topo, e é procurada ANTES do corte", () => {
    expect(REDE).toContain("candidatas.find((c) => ehContaOficial(c as any))");
    expect(REDE).toContain("fileiraComOficial(pessoas");
    expect(REDE).not.toContain("pessoas.find((p) => p.oficial)");
  });

  /* ⚠️ Uma coluna própria, e nunca um nome reconhecido por texto. */
  test("⚠️ o portão é `ehContaOficial`, e não uma comparação de nome", () => {
    expect(REDE).toContain("ehContaOficial(");
    expect(REDE).not.toContain('display_name === "Obstétrica"');
    expect(REDE).toContain("conta_oficial");
  });

  /* ⚠️ Ela publica e é seguida; ela NÃO lê. A decisão sobre o médico ver o feed
     das pacientes continua sendo do dono, e esta conta não a toca. */
  test("⚠️ nada aqui faz a conta oficial LER o feed de ninguém", () => {
    expect(REGUA).not.toContain("meuFeed");
    expect(REGUA).not.toContain("reagir");
    expect(REGUA).not.toContain("caixinha");
  });

  /* ⚠️ Seguir é um gesto: um app que segue coisas pela paciente ensina que a
     lista dela não é dela. O único vínculo automático do app é o do convite,
     onde há consentimento explícito dos dois lados. */
  test("⚠️ ela NÃO é seguida automaticamente", () => {
    expect(REGUA).not.toContain("rede_seguidores");
    expect(REGUA).not.toContain("seguirContaOficial");
  });
});

describe("o SQL", () => {
  /* ⚠️ Em banco que já tem a tabela, `CREATE TABLE IF NOT EXISTS` é no-op e a
     coluna nunca nasce — foi o que deixou `carimbo_semana` impossível de criar
     por uma leva inteira. */
  test("⚠️ a coluna nasce por ALTER, e não dentro de um CREATE", () => {
    expect(SQL).toContain("ADD COLUMN IF NOT EXISTS conta_oficial");
    expect(SQL).not.toContain("CREATE TABLE");
  });

  /* ⚠️ Duas contas oficiais fariam a fileira ter duas primeiras. */
  test("⚠️ só pode existir UMA", () => {
    expect(SQL).toContain("CREATE UNIQUE INDEX IF NOT EXISTS patient_profiles_uma_conta_oficial");
    expect(SQL).toContain("WHERE conta_oficial");
  });

  /* ⚠️ Ela não é paciente de ninguém e não veio de convite nenhum — sem isto
     entraria na contagem do funil como se fosse uma paciente trazida. */
  test("⚠️ o UPDATE a tira das contagens de paciente", () => {
    expect(SQL).toContain("doctor_id = NULL");
    expect(SQL).toContain("referred_by = NULL");
    expect(SQL).toContain("ref_code = NULL");
  });

  test("tem bloco de conferência, como os outros APLICAR_", () => {
    expect(SQL).toContain("AS coluna_ok");
    expect(SQL).toContain("quantas_oficiais");
  });
});
