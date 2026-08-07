/**
 * A CONCESSÃO MANUAL DE PLANO TINHA VIRADO UM NO-OP SILENCIOSO.
 *
 * `planoVigente` passou a rebaixar TODO plano vencido, e não só o `trial`. Foi
 * o conserto certo — a régua cara era a frouxa — e ele quebrou o único caminho
 * de escrita que não sabia renovar: o console do fundador escrevia `plan` e
 * nunca tocava em `plan_expires_at`.
 *
 * O alvo típico de uma concessão manual é justamente quem já tem data no
 * passado: a migration `20260730040000` carimbou `created_at + 14 dias` em todo
 * médico legado. Então o fundador concedia `black` de cortesia, o audit log
 * registrava `plan: "black"`, o `ok: true` voltava — e o médico seguia com
 * capacidades de `free`. Nenhum erro, nenhum log, duas telas discordando.
 *
 * Um verificador adversarial também apontou o motivo de isso ter passado: os
 * três "testes" de `planoVigente` eram grep de string. O principal afirmava
 * apenas `expect(ent).toContain("export function planoVigente(")` — passa com o
 * corpo da função sendo `return plan`, isto é, com a régua inteira removida.
 * Aqui os testes exercitam a função.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  CARENCIA_DE_RENOVACAO_MS,
  CORTESIA_PADRAO_DIAS,
  planoEfetivo,
  planoVigente,
  vencimentoDaConcessao,
} from "./entitlements.server";

const DIA = 24 * 60 * 60 * 1000;
const AGORA = Date.parse("2026-08-07T12:00:00.000Z");
const emDias = (d: number) => new Date(AGORA + d * DIA).toISOString();

describe("1. `planoVigente` exercitada — não grepada", () => {
  test("plano pago vencido há muito vira free", () => {
    expect(planoVigente("black", emDias(-30), AGORA)).toBe("free");
  });

  test("e não só o trial — era esse o defeito original", () => {
    /* A versão antiga rebaixava apenas `trial`: um `pro` vencido mantinha
       todas as capacidades pagas, indefinidamente. */
    expect(planoVigente("pro", emDias(-30), AGORA)).toBe("free");
    expect(planoVigente("elite", emDias(-30), AGORA)).toBe("free");
  });

  test("plano em dia continua valendo", () => {
    expect(planoVigente("pro", emDias(30), AGORA)).toBe("pro");
  });

  test("sem data de vencimento, nada é rebaixado", () => {
    expect(planoVigente("black", null, AGORA)).toBe("black");
    expect(planoVigente("black", undefined, AGORA)).toBe("black");
  });

  test("data ilegível não rebaixa ninguém", () => {
    /* Na dúvida o médico é atendido: o estrago de rebaixar por engano recai
       sobre a gestante do outro lado. */
    expect(planoVigente("pro", "não é uma data", AGORA)).toBe("pro");
  });
});

describe("2. a carência de renovação é um intervalo, não um enfeite", () => {
  /**
   * Três dias, porque a renovação da Stripe não é instantânea: webhook
   * atrasado, retry, cartão que aprova na segunda tentativa. Números literais
   * de propósito — um teste escrito sobre a própria constante que ele protege
   * passa quando a constante muda.
   */
  test("vencido ontem: ainda vale", () => {
    expect(planoVigente("pro", emDias(-1), AGORA)).toBe("pro");
  });

  test("vencido há 2 dias: ainda vale", () => {
    expect(planoVigente("pro", emDias(-2), AGORA)).toBe("pro");
  });

  test("vencido há 4 dias: acabou", () => {
    expect(planoVigente("pro", emDias(-4), AGORA)).toBe("free");
  });

  test("a carência é de três dias", () => {
    expect(CARENCIA_DE_RENOVACAO_MS).toBe(3 * DIA);
  });
});

describe("3. toda escrita de plano escreve o vencimento junto", () => {
  test("uma cortesia ganha prazo — e o plano concedido sobrevive à régua", () => {
    const venc = vencimentoDaConcessao("black", undefined, AGORA);
    expect(venc).not.toBeNull();
    /* A asserção que descreve o defeito: com `null` no lugar de `venc`, o
       médico legado (data no passado) continuaria em `free`. */
    expect(planoVigente("black", venc, AGORA)).toBe("black");
  });

  test("e o prazo é de um ano, não de um dia", () => {
    const venc = vencimentoDaConcessao("elite", undefined, AGORA);
    expect(Date.parse(venc!) - AGORA).toBe(365 * DIA);
    expect(CORTESIA_PADRAO_DIAS).toBe(365);
  });

  test("o trial concedido vence em 14 dias — o prazo do backfill", () => {
    const venc = vencimentoDaConcessao("trial", undefined, AGORA);
    expect(Date.parse(venc!) - AGORA).toBe(14 * DIA);
  });

  test("`free` não ganha data — não há do que rebaixar", () => {
    expect(vencimentoDaConcessao("free", undefined, AGORA)).toBeNull();
  });

  test("`null` explícito é escolha, `undefined` é ausência", () => {
    /* Sem a diferença, não há como conceder de propósito uma cortesia sem
       prazo — e a única saída seria voltar a deixar o plano eterno para todo
       mundo, que é o defeito que `planoVigente` existe para matar. */
    expect(vencimentoDaConcessao("black", null, AGORA)).toBeNull();
    expect(vencimentoDaConcessao("black", emDias(10), AGORA)).toBe(emDias(10));
  });
});

describe("4. a outra forma da mesma contradição: médico desativado", () => {
  test("conceder black a quem está inativo não vale nada — e agora isso é dito", () => {
    /* `planRowFor` derruba para `free` quando `active === false`. Conceder um
       plano ali também devolvia `ok: true` sem mudar coisa alguma. */
    expect(planoEfetivo("black", emDias(365), false, AGORA)).toBe("free");
  });

  test("ativo e em dia: vale o que foi concedido", () => {
    expect(planoEfetivo("black", emDias(365), true, AGORA)).toBe("black");
  });

  test("ativo e vencido: vale free", () => {
    expect(planoEfetivo("black", emDias(-30), true, AGORA)).toBe("free");
  });

  test("`active` desconhecido não rebaixa — só `false` derruba", () => {
    /* `undefined` acontece quando a coluna não veio no select. Tratar ausência
       como desativação transformaria uma leitura incompleta em rebaixamento. */
    expect(planoEfetivo("pro", null, undefined, AGORA)).toBe("pro");
  });

  test("plano nulo cai para free, nunca para nulo", () => {
    /* Quem chama usa o retorno como chave de capacidades; `null` ali viraria
       `undefined` no mapa e capacidade nenhuma — ou todas, conforme o acesso. */
    expect(planoEfetivo(null, null, true, AGORA)).toBe("free");
  });
});

describe("5. o console escreve as duas colunas e conta a verdade", () => {
  const fonte = readFileSync("src/lib/platform.functions.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const admin = readFileSync("src/routes/_authenticated/admin.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  test("`plan` e `plan_expires_at` são escritos no mesmo ramo", () => {
    const i = fonte.indexOf("if (data.plan !== undefined)");
    expect(i).toBeGreaterThan(-1);
    const ramo = fonte.slice(i, i + 300);
    expect(ramo).toContain("patch.plan = data.plan");
    expect(ramo).toContain("patch.plan_expires_at = vencimentoDaConcessao(");
  });

  test("o audit log registra o EFEITO, não só o pedido", () => {
    /* Registrar só o pedido foi o que deixou a concessão morta parecer
       bem-sucedida na única trilha que existia. */
    expect(fonte).toContain("plano_efetivo: efetivo");
    expect(fonte).toContain("expira_em:");
  });

  test("o servidor devolve o plano efetivo", () => {
    expect(fonte).toContain("planoEfetivo: efetivo");
  });

  test("e a tela avisa quando o efeito não bate com o pedido", () => {
    expect(admin).toContain("efetivo !== patch.plan");
    expect(admin).toContain("toast.warning");
  });
});
