/**
 * "SALVAR PERFIL" FALHAVA SEMPRE — E O ESCUDO EXISTIA.
 *
 * ─── OS DOIS DEFEITOS, E POR QUE JUNTOS ─────────────────────────────────────
 *
 * `updateMyDoctor` tinha um recuo para o banco que ainda não migrou as colunas
 * do perfil rico, com um comentário explicando que sem ele "o médico perdia
 * tudo o que digitou sem entender por quê".
 *
 * 1. O RECUO NUNCA RODAVA. A condição era `error.code === "42703"` — num
 *    caminho de ESCRITA. O `postgrest.ts` desta base documenta exatamente isso:
 *    um UPDATE cujo payload tem coluna fora do schema cache volta PGRST204, do
 *    PostgREST; 42703 vem do Postgres, num SELECT. O escudo existia, tinha
 *    comentário, e não rodou uma única vez.
 *
 * 2. E MESMO SE RODASSE, ESTAVA INCOMPLETO. A lista de colunas a remover era
 *    escrita à mão e já tinha divergido de `RICH_COLS` em QUATRO campos —
 *    `consultation_currency`, `consultation_price_cents`, `focos`, `photo_url`.
 *    O recuo removeria doze e tentaria de novo com os outros quatro, falhando
 *    igual.
 *
 * Os dois juntos: num banco sem essas colunas, salvar o perfil era impossível.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const fn = readFileSync("src/lib/doctors.functions.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

describe("o recuo roda de verdade", () => {
  test("usa `colunaAusente`, que cobre os DOIS códigos", () => {
    expect(fn).toContain("if (colunaAusente(error)) ({ error } = await doUpdate(false));");
  });

  test("e o MESMO recuo do cadastro também — eram três lugares, dois errados", () => {
    /**
     * `registerDoctor` tinha a mesma comparação crua, duas vezes. Ali o upsert
     * tem `.select()` encadeado, então 42703 pode vir de verdade (do select de
     * retorno) — mas o payload com coluna fora do schema cache volta PGRST204,
     * e esse caso ficava de fora.
     *
     * É o padrão mais repetido desta madrugada: a correção existe num lugar e
     * não no irmão ao lado.
     */
    expect(fn).toContain("if (colunaAusente(error)) {");
    /* Nenhuma comparação crua sobrou em caminho de ESCRITA. As que restam são
       de leitura (SELECT), onde 42703 é o código certo. */
    const escritas = fn.split("export const registerDoctor")[1] ?? "";
    const ateFimDoRegister = escritas.slice(0, escritas.indexOf("export const"));
    expect(ateFimDoRegister).not.toContain('error.code === "42703"');
  });

  test("e `colunaAusente` de fato cobre PGRST204", () => {
    /* Se alguém "simplificar" o helper para só 42703, este recuo volta a ser
       decoração — e o teste cai aqui, junto. */
    const pg = readFileSync("src/lib/postgrest.ts", "utf8");
    expect(pg).toContain('c === "PGRST204" || c === "42703"');
  });
});

describe("a lista de colunas do recuo não pode divergir da leitura", () => {
  test("ela é DERIVADA de `RICH_COLS`", () => {
    /**
     * Escrita à mão, já tinha perdido quatro colunas. Derivar é o que impede a
     * próxima coluna nova de nascer só de um lado — que é como estas chegaram.
     */
    expect(fn).toContain('const RICH_UPDATE_KEYS = RICH_COLS.split(",");');
  });

  test("e RICH_COLS continua trazendo as quatro que faltavam", () => {
    for (const col of ["consultation_currency", "consultation_price_cents", "focos", "photo_url"]) {
      expect(fn).toContain(col);
    }
  });

  test("o recuo remove as colunas ricas e mantém as básicas", () => {
    /* Remover as básicas junto salvaria um perfil vazio — pior que falhar. */
    expect(fn).toContain("if (!richOk) for (const k of RICH_UPDATE_KEYS) delete profile[k];");
    const i = fn.indexOf("const BASE_COLS");
    expect(fn.slice(i, i + 260)).toContain("display_name");
  });
});
