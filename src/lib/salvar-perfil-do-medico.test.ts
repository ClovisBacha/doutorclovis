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

describe("A CLASSE: nenhum caminho de ESCRITA confere `42703` cru", () => {
  /**
   * ─── POR QUE ISTO É UM TESTE DE VARREDURA, E NÃO DE CASO ──────────────────
   *
   * `postgrest.ts` já documentava a regra por extenso: um INSERT/UPDATE cujo
   * payload cita coluna fora do schema cache volta PGRST204, do PostgREST;
   * 42703 vem do Postgres, num SELECT. Quem escreve `42703` num caminho de
   * escrita escreveu um recuo que nunca roda.
   *
   * A regra estava escrita, e mesmo assim eu encontrei SEIS violações nesta
   * madrugada — três em `doctors.functions.ts`, uma em `lives`, uma no agente
   * de WhatsApp. E as consequências não eram cosméticas: "Salvar perfil"
   * falhava sempre, e o pedido de consulta feito pelo WhatsApp simplesmente
   * sumia, sem chegar a painel nenhum e sem deixar rastro.
   *
   * Um comentário não impede a sétima. Este teste impede.
   */
  const ESCRITAS = [".insert(", ".update(", ".upsert(", ".delete("];

  function violacoes(): string[] {
    const { execSync } = require("node:child_process");
    const saida = execSync(
      "grep -rn 'code === \"42703\"' --include=*.ts --include=*.tsx src || true",
      { encoding: "utf8" },
    );
    const achados: string[] = [];
    for (const linha of saida.split("\n")) {
      if (!linha.trim()) continue;
      const [arq, n] = linha.split(":");
      if (arq.endsWith(".test.ts") || arq.endsWith("postgrest.ts")) continue;
      const fonte = readFileSync(arq, "utf8").split("\n");
      const i = Number(n);
      /* Janela curta de propósito: olhar longe demais alcança a função
         anterior, e um SELECT vira falso positivo — foi o que aconteceu com
         `consultaparticular.functions.ts` na primeira varredura. */
      /**
       * QUAL OPERAÇÃO PRODUZIU ESTE `error` — pela mais PRÓXIMA acima, não por
       * uma janela de N linhas.
       *
       * A janela fixa errou nos dois sentidos: curta demais, um comentário de
       * catorze linhas empurrava o `.insert(` para fora e a violação passava
       * (foi o que aconteceu com o agente de WhatsApp); longa demais, alcançava
       * a função anterior e um SELECT virava falso positivo.
       *
       * Comparar a distância até a escrita e até o `.select(` responde a
       * pergunta certa: de quem é este erro.
       */
      const acima = fonte.slice(0, i).join("\n");
      const ultimaEscrita = Math.max(...ESCRITAS.map((op) => acima.lastIndexOf(op)));
      const ultimaLeitura = acima.lastIndexOf(".select(");
      const janela = ultimaEscrita > ultimaLeitura ? ".insert(" : "";
      const linha0 = fonte[i - 1].trim();
      /* Comentário não é código. Os próprios comentários que EXPLICAM este
         defeito citam `code === "42703"` para dizer o que era feito antes — e
         a primeira versão desta varredura acusava a explicação como se fosse a
         violação. */
      const ehComentario =
        linha0.startsWith("*") || linha0.startsWith("//") || linha0.startsWith("/*");
      const ehEscrita = ESCRITAS.some((op) => janela.includes(op));
      const jaCobre = linha0.includes("PGRST204");
      if (ehEscrita && !jaCobre && !ehComentario) achados.push(`${arq}:${n}`);
    }
    return achados;
  }

  test("a varredura não encontra nenhum", () => {
    expect(violacoes()).toEqual([]);
  });

  test("e a varredura de fato enxerga o código (não passa por vacuidade)", () => {
    /* Sem isto, um `grep` quebrado devolveria zero violações para sempre e o
       teste viraria decoração — que é o mesmo formato do defeito que ele
       persegue. */
    const { execSync } = require("node:child_process");
    const saida = execSync(
      "grep -rn 'code === \"42703\"' --include=*.ts --include=*.tsx src || true",
      { encoding: "utf8" },
    );
    expect(saida.split("\n").filter(Boolean).length).toBeGreaterThan(5);
  });
});
