/**
 * O LEITOR CANÔNICO DO MODO CUIDADO FALHAVA ABERTO.
 *
 * ⚠️ `isCareModeActive` descartava o `error`: qualquer falha de leitura — rede,
 * RLS, tempo esgotado — deixava `data` nulo, `?.care_mode` virava `undefined`, e
 * `Boolean(undefined)` é **`false`**, que aqui significa "ela NÃO está de luto".
 * **Vinte e duas chamadas em doze módulos herdavam isso.**
 *
 * A assimetria é brutal, porque todas essas chamadas usam a resposta para o
 * mesmo fim — o Modo Cuidado SUPRIME (jogo, Sementinhas, push, confete) e nunca
 * concede nada:
 *
 *   · falhar ABERTO = quem acabou de perder a gestação recebe "+5 🌱", confete e
 *     um push sobre o bebê, porque uma consulta deu timeout;
 *   · falhar FECHADO = quem não está de luto deixa de ganhar um bônus.
 *
 * O primeiro é o defeito que o Modo Cuidado inteiro existe para impedir.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { isCareModeActive } from "./care-mode.functions";

/** Um Supabase de mentira: `.from().select().eq().single()` devolve o que eu mandar. */
function bancoQue(resposta: { data?: unknown; error?: unknown }) {
  const cadeia = {
    select: () => cadeia,
    eq: () => cadeia,
    single: async () => resposta,
  };
  return { from: () => cadeia } as never;
}

describe("o que o leitor responde", () => {
  test("perfil com care_mode ligado → true", async () => {
    expect(await isCareModeActive(bancoQue({ data: { care_mode: true } }), "u1")).toBe(true);
  });

  test("perfil com care_mode desligado → false", async () => {
    expect(await isCareModeActive(bancoQue({ data: { care_mode: false } }), "u1")).toBe(false);
  });

  test("⚠️ FALHA DE LEITURA → true (cala)", async () => {
    /* A forma exata do defeito: antes, isto devolvia `false` e a paciente em
       luto recebia confete porque uma consulta falhou. */
    expect(await isCareModeActive(bancoQue({ error: { code: "57014" } }), "u1")).toBe(true);
    expect(await isCareModeActive(bancoQue({ error: { message: "network" } }), "u1")).toBe(true);
  });

  test("⚠️ ZERO LINHAS (PGRST116) → false, e isso NÃO é o mesmo caso", async () => {
    /* `.single()` erra com PGRST116 quando não há linha — o que acontece com
       toda paciente antes de o perfil existir. Tratar isso como luto calaria a
       gamificação de TODA CONTA NOVA, para sempre. Sem perfil não há
       `care_mode` marcado, e isso é "não está de luto", não "não sei". */
    expect(await isCareModeActive(bancoQue({ error: { code: "PGRST116" } }), "u1")).toBe(false);
  });

  test("dado ausente sem erro → false", async () => {
    expect(await isCareModeActive(bancoQue({ data: null }), "u1")).toBe(false);
  });
});

describe("a forma do conserto", () => {
  const FONTE = readFileSync("src/lib/care-mode.functions.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

  test("⚠️ o `error` é destruturado e conferido", () => {
    expect(FONTE).toContain("const { data, error } = await client");
    expect(FONTE).toContain("if (error)");
  });

  test("⚠️ a falha é REGISTRADA — silêncio total esconderia a gamificação parada", () => {
    /* Se este log aparecer em série, o problema é a leitura, não o produto. */
    expect(FONTE).toMatch(/console\.error\("\[modo-cuidado\]/);
  });
});

describe("nenhuma chamada usa o Modo Cuidado para CONCEDER", () => {
  test("⚠️ é o que torna 'calar na dúvida' seguro", () => {
    /* Se algum dia uma chamada passar a conceder algo quando `true`, falhar
       fechado deixaria de ser a direção segura — e este teste fica vermelho
       para obrigar a decidir de novo. A varredura procura o padrão inverso:
       `if (careMode)` seguido de concessão. */
    const modulos = [
      "sementinhas",
      "achievements",
      "cantinho",
      "mesada",
      "mesada-paciente",
      "rating",
      "referral",
      "instagram",
      "influenciadora",
      "companion",
      "amigas",
    ];
    for (const m of modulos) {
      const f = readFileSync(`src/lib/${m}.functions.ts`, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/^\s*\/\/.*$/gm, " ");
      /* `grantSementinhas` / `sendPushToUser` na MESMA linha de um
         `if (await isCareModeActive(` seria concessão sob luto. */
      expect(f).not.toMatch(
        /if \(await isCareModeActive\([^)]*\)\)\s*(await )?(grantSementinhas|sendPushToUser)/,
      );
    }
  });
});
