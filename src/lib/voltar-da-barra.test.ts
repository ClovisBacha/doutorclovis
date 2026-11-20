import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { destinoDaBarra, rotuloDaBarra, type EstadoDaBarra } from "./voltar-da-barra";
import { semComentarios } from "./sem-comentarios";

/** As abas que o hub da Saúde CONTÉM — os cinco destinos de `HUB_SAUDE`. */
const HUB = ["Saúde", "Meu dia a dia", "Meu dia a dia", "Nutrição", "Saúde da mulher"];

const estado = (p: Partial<EstadoDaBarra>): EstadoDaBarra => ({
  hubAberto: null,
  voltarAoHub: null,
  tab: "Saúde",
  origem: null,
  secao: null,
  abasDoHub: HUB,
  ...p,
});

describe("a seta volta para o LUGAR, e não para a grade", () => {
  /**
   * O cenário do cartão vermelho: ela conta duas horas, o app manda falar com
   * o médico, ela toca — e o único botão de contato daquele minuto a despejava
   * numa grade que ela não pediu.
   */
  for (const sub of ["chutes", "contracoes"]) {
    test(`de ${sub} ao médico e de volta: volta para ${sub}, nunca para a grade`, () => {
      const d = destinoDaBarra(estado({ tab: "Consultas", origem: { tab: "Meu dia a dia", sub } }));
      expect(d).toEqual({ t: "aba", tab: "Meu dia a dia", sub });
    });
  }

  test("destino sem sub-tela continua voltando para a aba", () => {
    const d = destinoDaBarra(estado({ tab: "Perfil", origem: { tab: "Saúde", sub: null } }));
    expect(d).toEqual({ t: "aba", tab: "Saúde", sub: null });
  });
});

describe("a regra do hub só vale para aba que o hub CONTÉM", () => {
  test("uma aba da grade sobe para o hub", () => {
    expect(destinoDaBarra(estado({ tab: "Saúde", secao: "saude" }))).toEqual({
      t: "hub",
      hub: "saude",
    });
    expect(destinoDaBarra(estado({ tab: "Nutrição", secao: "saude" }))).toEqual({
      t: "hub",
      hub: "saude",
    });
  });

  /**
   * ⚠️ Bem-estar e Alertas estão na SEÇÃO e não estão na GRADE — decisão
   * escrita do dono. Com a régua antiga (`secao === "saude"`) elas subiam para
   * um hub que não as contém, descartando a tela de onde ela veio. E o caminho
   * é alcançável em MODO CUIDADO, pelo "Apoio emocional" do cartão de
   * acolhimento.
   */
  for (const tab of ["Bem-estar", "Alertas"]) {
    test(`${tab} está na seção e NÃO na grade: volta para a tela de origem`, () => {
      const d = destinoDaBarra(
        estado({ tab, secao: "saude", origem: { tab: "Caminho", sub: null } }),
      );
      expect(d).toEqual({ t: "aba", tab: "Caminho", sub: null });
    });
  }

  test("sem origem, o que não está na grade cai na home — nunca num hub errado", () => {
    expect(destinoDaBarra(estado({ tab: "Bem-estar", secao: "saude" }))).toEqual({ t: "home" });
  });

  test("`voltarAoHub` vem ANTES: Chutes abre uma aba de outra seção", () => {
    const d = destinoDaBarra(estado({ tab: "Meu dia a dia", voltarAoHub: "saude" }));
    expect(d).toEqual({ t: "hub", hub: "saude" });
  });

  test("dentro do hub, a seta não volta para o próprio hub", () => {
    const d = destinoDaBarra(
      estado({ hubAberto: "saude", tab: "Saúde", secao: "saude", voltarAoHub: "saude" }),
    );
    expect(d).toEqual({ t: "home" });
  });
});

describe("o que ela ANUNCIA é o que ela faz", () => {
  test("o rótulo do hub não nomeia a aba de origem", () => {
    /* Era `Voltar para ${origem}` solto: em Bem-estar, a seta anunciava
       "Voltar para Caminho" e a regra do hub levava para a grade da Saúde. */
    const e = estado({ tab: "Saúde", secao: "saude", origem: { tab: "Caminho", sub: null } });
    expect(destinoDaBarra(e)).toEqual({ t: "hub", hub: "saude" });
    expect(rotuloDaBarra(destinoDaBarra(e))).not.toContain("Caminho");
  });

  test("o rótulo da aba nomeia a aba para onde ela de fato vai", () => {
    const e = estado({ tab: "Consultas", origem: { tab: "Meu dia a dia", sub: "chutes" } });
    expect(rotuloDaBarra(destinoDaBarra(e))).toBe("Voltar para Meu dia a dia");
  });

  test("sem destino nomeável, o rótulo é genérico", () => {
    expect(rotuloDaBarra({ t: "home" })).toBe("Voltar");
  });
});

describe("a tela usa a régua, e deriva as abas do hub da GRADE", () => {
  const CONTA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));

  test("⚠️ `abasDoHub` sai de HUB_SAUDE, nunca de SECTION_TABS", () => {
    expect(CONTA).toMatch(/const abasDoHub = HUB_SAUDE\.map\(\(i\) => i\.destino\)/);
  });

  test("o destino da seta e o rótulo dela saem do MESMO cálculo", () => {
    const i = CONTA.indexOf("const destinoDaSeta = destinoDaBarra(");
    expect(i).toBeGreaterThan(-1);
    /* O rótulo deriva do destino — nunca de `origem` solto. */
    expect(CONTA).toContain("aria-label={rotuloDaBarra(destinoDaSeta)}");
    expect(CONTA).not.toMatch(/aria-label=\{origem \?/);
  });

  test("⚠️ a volta para uma aba RESTAURA a sub-tela", () => {
    /* Era `setConsultasSub(null)` — e é o `null` que fazia a paciente cair na
       grade em vez da tela de onde saiu. */
    const i = CONTA.indexOf("function voltarDaBarra(");
    expect(i).toBeGreaterThan(-1);
    const fn = CONTA.slice(i, CONTA.indexOf("\n  }", i));
    const k = fn.indexOf('if (d.t === "aba")');
    expect(k).toBeGreaterThan(-1);
    expect(fn.slice(k)).toContain("setConsultasSub(d.sub)");
  });

  test("⚠️ e a ida GUARDA a sub-tela, senão não há o que restaurar", () => {
    const i = CONTA.indexOf("const goToTab =");
    expect(i).toBeGreaterThan(-1);
    const fn = CONTA.slice(i, i + 900);
    expect(fn).toMatch(/setOrigem\([\s\S]*?sub: consultasSub/);
  });
});
