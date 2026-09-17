/**
 * A MEMÓRIA CURTA E AS PREFERÊNCIAS — a régua, e as pontas que ela não alcança.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  PREFERENCIAS_MAX,
  TURNOS_DA_MEMORIA,
  limparPreferencias,
  parParaGravar,
  turnosDaMemoria,
} from "./nutricao-memoria";
import { blocoDaPaciente } from "./nutricao-perfil";
import { FONTES } from "./exportar-dados";
import { semComentarios } from "./sem-comentarios";

describe("o que volta do banco", () => {
  test("chega da mais nova para a mais velha e volta em ordem cronológica", () => {
    const t = turnosDaMemoria([
      { role: "assistant", content: "R2", assinatura: "b" },
      { role: "user", content: "P2" },
      { role: "assistant", content: "R1", assinatura: "a" },
      { role: "user", content: "P1" },
    ]);
    expect(t.map((x) => x.content)).toEqual(["P1", "R1", "P2", "R2"]);
    expect(t[1]!.assinatura).toBe("a");
  });

  test("⚠️ a primeira linha que volta é DELA — resposta órfã no começo cai", () => {
    const t = turnosDaMemoria([
      { role: "user", content: "P1" },
      { role: "assistant", content: "R0", assinatura: "z" },
    ]);
    expect(t.map((x) => x.content)).toEqual(["P1"]);
    expect(turnosDaMemoria([{ role: "assistant", content: "R0" }])).toEqual([]);
  });

  test("assinatura nula não vira campo", () => {
    const [r] = turnosDaMemoria([
      { role: "assistant", content: "R", assinatura: null },
      { role: "user", content: "P" },
    ]).slice(1);
    expect(r).toEqual({ role: "assistant", content: "R" });
  });
});

describe("o que vai para o banco", () => {
  test("sempre o PAR, pergunta antes da resposta, com o user_id nos dois", () => {
    const par = parParaGravar("u1", "posso comer sushi?", {
      content: "Cru, não.",
      assinatura: "s",
    });
    expect(par.map((l) => l.role)).toEqual(["user", "assistant"]);
    expect(par.every((l) => l.user_id === "u1")).toBe(true);
    expect(par[1]!.assinatura).toBe("s");
    expect(par[0]!.assinatura).toBeNull();
  });
  test("doze turnos são seis trocas", () => expect(TURNOS_DA_MEMORIA).toBe(12));
});

describe("as preferências", () => {
  test("recorta, colapsa espaço e devolve null para vazio", () => {
    expect(limparPreferencias("  vegetariana \n sem porco ")).toBe("vegetariana sem porco");
    expect(limparPreferencias("   ")).toBeNull();
    expect(limparPreferencias("x".repeat(500))!.length).toBe(PREFERENCIAS_MAX);
  });

  test("entram no bloco, sobrevivem ao luto, e NÃO se confundem com alergia", () => {
    const b = blocoDaPaciente({ careMode: true, preferencias: "vegetariana" });
    expect(b).toMatch(/Preferências e restrições alimentares que ELA escreveu: vegetariana/);
    expect(b).toMatch(/NÃO é alergia/);
    /* No luto o resto continua calado. */
    expect(b).not.toMatch(/semana|beb[êe]/i);
  });
});

describe("⚠️ as pontas que a régua não alcança", () => {
  const TAB = semComentarios(readFileSync("src/components/nutricao-tab.tsx", "utf8"));
  const CONTA = semComentarios(readFileSync("src/lib/conta.functions.ts", "utf8"));

  test("a tela grava a troca SÓ depois de a resposta chegar — nos dois caminhos", () => {
    /* Depois do `setMessages` com a resposta assinada, e nunca antes do fetch. */
    const conversa = TAB.indexOf("guardarTroca(msg,");
    const foto = TAB.indexOf("guardarTroca(next[next.length - 1]!.content");
    expect(conversa).toBeGreaterThan(0);
    expect(foto).toBeGreaterThan(0);
    const fim = TAB.indexOf("async function send(");
    const respostaChegou = TAB.indexOf(
      'setMessages([...next, { role: "assistant", content: acc, assinatura }])',
      fim,
    );
    expect(respostaChegou).toBeGreaterThan(0);
    expect(conversa).toBeGreaterThan(respostaChegou);
  });

  test("⚠️ nada no Modo Cuidado, nem na bancada — ler e gravar", () => {
    expect(TAB).toMatch(/if \(ehBancada \|\| careMode \|\| memoriaLida\.current\) return;/);
    expect(TAB).toMatch(/if \(ehBancada \|\| careMode \|\| !resposta\.content\.trim\(\)\) return;/);
  });

  test("a memória não empurra uma pergunta já feita nesta visita", () => {
    expect(TAB).toMatch(/atual\.length <= 1 \? \[atual\[0\], \.\.\.turnos\] : atual/);
  });

  test("a coluna que ainda não nasceu tem recado PRÓPRIO, e não 'tente de novo'", () => {
    /* ⚠️ A asserção é sobre a GARANTIA (existe recuo de coluna ausente, e o
       recado dele é o específico), nunca sobre o código escrito à mão: travar
       `code === "PGRST204"` já reprovou uma vez a troca pelo helper
       `colunaAusente`, que cobre PGRST204 **e** 42703 — ou seja, reprovou uma
       mudança que só apertou a cobertura. */
    expect(TAB).toMatch(
      /(colunaAusente\(error\)|code === "PGRST204")\)\s*\{\s*toast\.error\("Este campo ainda não está disponível/,
    );
  });

  test("'apagar minhas conversas' leva a da nutricionista junto, pela coluna certa", () => {
    expect(CONTA).toMatch(/\["nutricao_mensagens", "user_id"\]/);
  });

  test("o export leva a conversa dela, sem a assinatura do servidor", () => {
    const f = FONTES.find((x) => x.tabela === "nutricao_mensagens");
    expect(f?.coluna).toBe("user_id");
    expect(f?.colunas).not.toMatch(/assinatura|\*/);
  });
});
