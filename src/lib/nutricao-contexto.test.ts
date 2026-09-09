/**
 * A PACIENTE QUE A PRODUÇÃO TEM E A MÁQUINA DE DESENVOLVIMENTO NÃO: a que
 * pariu há vinte dias com a DUM ainda no perfil.
 *
 * ⚠️ Este teste RODA o adaptador puro com essa linha. Antes dele, o prompt da
 * nutricionista dizia "Está na semana 42 da gestação (3º trimestre)" para uma
 * mulher com o bebê no colo — medido em set/2026 — e nenhum teste de texto
 * tinha como pegar, porque o defeito só existe numa combinação de colunas.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { blocoDaPaciente } from "./nutricao-perfil";
import { AGUA_MAX, TOMADOS_MAX, doAparelhoDe, perfilNutricionalDe } from "./nutricao-contexto";
import { nutricaoDoPosParto } from "./nutricao-da-semana";
import { semComentarios } from "./sem-comentarios";

const AGORA = new Date("2026-09-09T15:00:00");
const dias = (n: number) => {
  const d = new Date(AGORA);
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* DUM a 300 dias: `computeGestation` devolve a semana 42 (o teto dela). */
const PARIU = { lmp_date: dias(300), birth_date: dias(20), allergies: "camarão" };

describe("⚠️ a nutricionista sabe que ela pariu", () => {
  test("com `birth_date`, a gestação é nula e o pós-parto entra com a idade do bebê", () => {
    const p = perfilNutricionalDe({ perfil: PARIU, logs: [], careMode: false, agora: AGORA });
    expect(p.posParto).toBe(true);
    expect(p.diasDoBebe).toBe(20);
    expect(p.semanas).toBeNull();
    expect(p.trimestre).toBeNull();
    /* E a alergia continua sendo a primeira coisa. */
    expect(p.alergias).toBe("camarão");
  });

  test("⚠️ o prompt não diz mais 'semana 42 da gestação' — diz puerpério", () => {
    const bloco = blocoDaPaciente(
      perfilNutricionalDe({ perfil: PARIU, logs: [], careMode: false, agora: AGORA }),
    );
    expect(bloco).not.toMatch(/semana 42|3º trimestre/);
    expect(bloco).toMatch(/JÁ TEVE O BEBÊ.*o bebê tem 2 semanas/);
    expect(bloco).toMatch(/ALERGIAS/);
  });

  test("e a frase da tela para o mesmo caso não é a da reta final", () => {
    expect(nutricaoDoPosParto(20)!.titulo).not.toMatch(/ganhando peso para nascer/);
  });

  test("sem `birth_date`, a gestação continua em curso", () => {
    const p = perfilNutricionalDe({
      perfil: { lmp_date: dias(140) },
      logs: [],
      careMode: false,
      agora: AGORA,
    });
    expect(p.posParto).toBe(false);
    expect(p.semanas).toBe(20);
    expect(p.trimestre).toBe(2);
  });

  test("⚠️ o LUTO vence: `birth_date` preenchida num natimorto NÃO vira pós-parto", () => {
    const p = perfilNutricionalDe({ perfil: PARIU, logs: [], careMode: true, agora: AGORA });
    expect(p.posParto).toBe(false);
    expect(p.diasDoBebe).toBeNull();
    expect(p.semanas).toBeNull();
    expect(blocoDaPaciente(p)).not.toMatch(/beb[êe]|amament|semana/i);
  });

  test("data de nascimento no FUTURO (erro de digitação) não vira idade negativa", () => {
    const p = perfilNutricionalDe({
      perfil: { birth_date: dias(-5) },
      logs: [],
      careMode: false,
      agora: AGORA,
    });
    expect(p.posParto).toBe(true);
    expect(p.diasDoBebe).toBeNull();
  });
});

describe("⚠️ as pontas que a régua não alcança", () => {
  const SERVIDOR = semComentarios(readFileSync("src/lib/nutricao-contexto.server.ts", "utf8"));
  const TELA = semComentarios(readFileSync("src/components/nutricao-tab.tsx", "utf8"));

  test("o servidor PEDE `birth_date`, com degrau para o banco sem a coluna", () => {
    expect(SERVIDOR).toMatch(/birth_date/);
    expect(SERVIDOR).toMatch(/colunaAusente\(perfilRes\?\.error\)/);
    expect(SERVIDOR).toMatch(/replace\(",birth_date", ""\)/);
    /* E o que ele monta passa pela régua pura, COM o contexto do aparelho — sem
       ele, água e suplementos morreriam no servidor em silêncio. */
    expect(SERVIDOR).toMatch(
      /perfilNutricionalDe\(\{ perfil, logs, careMode, agora, doAparelho \}\)/,
    );
  });

  test("a tela deriva o pós-parto de `birth_date` e troca a frase, a saudação e o foco", () => {
    expect(TELA).toMatch(/const posParto = !careMode && !!profile\?\.birth_date/);
    expect(TELA).toMatch(/nutricaoDoPosParto\(diasDoBebe, careMode\)/);
    expect(TELA).toMatch(/nutricionista virtual para o pós-parto/);
    expect(TELA).toMatch(/Orientações para o seu pós-parto/);
    /* "Foco do 3º trimestre" não aparece para quem já pariu. */
    expect(TELA).toMatch(
      /\{!careMode && !posParto && \(\s*<section aria-label="Nutrientes em foco"/,
    );
  });

  test("⚠️ os dois prompts de sistema conhecem a puérpera", () => {
    const API = readFileSync("src/routes/api/nutrition.ts", "utf8");
    const FOTO = readFileSync("src/lib/foto-da-nutricao.ts", "utf8");
    expect(API).toMatch(/gestantes e puérperas/);
    expect(API).toMatch(/JÁ TEVE O BEBÊ/);
    expect(FOTO).toMatch(/JÁ TEVE O BEBÊ/);
  });
});

describe("as preferências atravessam o adaptador", () => {
  test("`food_preferences` vira `preferencias`", () => {
    const p = perfilNutricionalDe({
      perfil: { food_preferences: "vegetariana" },
      logs: [],
      careMode: false,
      agora: AGORA,
    });
    expect(p.preferencias).toBe("vegetariana");
  });

  test("⚠️ a escada do select desce UMA coluna por vez, derivada por remoção", async () => {
    const { DEGRAUS_DO_PERFIL } = await import("./nutricao-contexto.server");
    expect(DEGRAUS_DO_PERFIL).toHaveLength(3);
    expect(DEGRAUS_DO_PERFIL[0]).toMatch(/birth_date,food_preferences$/);
    expect(DEGRAUS_DO_PERFIL[1]).toMatch(/birth_date$/);
    expect(DEGRAUS_DO_PERFIL[2]).not.toMatch(/birth_date|food_preferences/);
    /* Cada degrau é prefixo do de cima: descer só TIRA. */
    for (let i = 1; i < DEGRAUS_DO_PERFIL.length; i++) {
      expect(DEGRAUS_DO_PERFIL[i - 1]!.startsWith(DEGRAUS_DO_PERFIL[i]!)).toBe(true);
    }
    for (const d of DEGRAUS_DO_PERFIL) expect(d).not.toMatch(/,,|,$/);
  });
});

describe("a pressão sai de health_logs pela régua de sinais-clinicos", () => {
  const logs = [
    { log_date: "2026-09-08", weight_kg: null, glucose_mg_dl: null, systolic: 144, diastolic: 92 },
    { log_date: "2026-09-05", weight_kg: null, glucose_mg_dl: null, systolic: 118, diastolic: 76 },
    { log_date: "2026-09-01", weight_kg: null, glucose_mg_dl: null, systolic: 141, diastolic: 88 },
    { log_date: "2026-08-30", weight_kg: 70, glucose_mg_dl: 92, systolic: null, diastolic: null },
  ];
  test("a última com os dois números, e quantas fora da faixa", () => {
    const p = perfilNutricionalDe({ perfil: {}, logs, careMode: false, agora: AGORA });
    expect(p.pressao?.sistolica).toBe(144);
    expect(p.pressao?.alterada).toBe(true);
    expect(p.pressoesAlteradas).toBe(2);
  });
  test("sem pressão registrada, nada", () => {
    const p = perfilNutricionalDe({ perfil: {}, logs: [logs[3]!], careMode: false, agora: AGORA });
    expect(p.pressao).toBeNull();
    expect(p.pressoesAlteradas).toBe(0);
  });
});

describe("⚠️ o que vem do aparelho é ENTRADA DO CLIENTE, e é saneado", () => {
  test("o caso bom passa inteiro", () => {
    expect(doAparelhoDe({ agua: 3, meta: 8, tomados: ["ferro", "ácido fólico"] })).toEqual({
      agua: { copos: 3, meta: 8 },
      tomados: ["ferro", "ácido fólico"],
    });
  });
  test("número fora do plausível, string longa e lista longa são cortados", () => {
    expect(doAparelhoDe({ agua: AGUA_MAX + 1, meta: 8 }).agua).toBeNull();
    expect(doAparelhoDe({ agua: -1, meta: 8 }).agua).toBeNull();
    expect(doAparelhoDe({ agua: 2.5, meta: 8 }).agua).toBeNull();
    expect(doAparelhoDe({ agua: 2, meta: 0 }).agua).toBeNull();
    const longa = doAparelhoDe({
      tomados: Array.from({ length: 50 }, (_, i) => `s${i} ` + "x".repeat(200)),
    });
    expect(longa.tomados).toHaveLength(TOMADOS_MAX);
    for (const t of longa.tomados!) expect(t.length).toBeLessThanOrEqual(40);
  });
  test("lixo vira nada — nunca lança", () => {
    expect(doAparelhoDe(null)).toEqual({ agua: null, tomados: null });
    expect(doAparelhoDe("x")).toEqual({ agua: null, tomados: null });
    expect(doAparelhoDe({ tomados: [1, null, { a: 1 }] }).tomados).toEqual([]);
  });
  test("e os dois endpoints passam por ele antes do bloco", () => {
    const API = readFileSync("src/routes/api/nutrition.ts", "utf8");
    const PRATO = readFileSync("src/routes/api/prato.ts", "utf8");
    expect(API).toMatch(/doAparelhoDe\(body\.contexto\)/);
    expect(PRATO).toMatch(/doAparelhoDe\(contexto\)/);
    const TAB = semComentarios(readFileSync("src/components/nutricao-tab.tsx", "utf8"));
    expect(TAB).toMatch(/contexto: doAparelho\(\)/);
    expect(TAB).toMatch(/corpo\.append\("contexto", JSON\.stringify\(doAparelho\(\)\)\)/);
  });
});
