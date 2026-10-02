import { describe, expect, test } from "bun:test";

import { readFileSync } from "node:fs";

import { semComentarios } from "@/lib/sem-comentarios";
import { GLICEMIA, leituraDaGlicemia, sinalGlicemia } from "@/lib/sinais-clinicos";

/**
 * A GLICEMIA TEM DUAS PONTAS, E A TELA SÓ DESENHAVA UMA.
 *
 * Dois defeitos da mesma família, achados na mesma leva:
 *
 * 1. O cartão escrevia **"Normal"**, em VERDE, para 139 mg/dL. `sinalGlicemia`
 *    usa o limite permissivo de 140 de propósito (o app não pergunta se foi em
 *    jejum), e a tela traduzia `gravidade: "normal"` numa palavra que AFIRMA. Em
 *    jejum o alvo é 95. Os dois prompts que leem a mesma régua já tinham sido
 *    consertados com a regra escrita por extenso; a tela — a única das três que
 *    fala com ela sem um modelo no meio — ficou de pé.
 *
 * 2. A zona verde do gráfico ia de 95 até o FUNDO do desenho: uma glicemia de
 *    45 caía DENTRO da faixa apresentada como boa, com o ponto pintado de
 *    vermelho por cima dela.
 *
 * ⚠️ **O QUE ESTE ARQUIVO NÃO PODE VIRAR:** um teste que baixe o corte de
 * `sinalGlicemia` para 95. A nota dela explica por que 140 está certo — com 95,
 * toda glicemia normal medida depois do almoço viraria laranja e o médico
 * aprenderia a ignorar a cor. O defeito nunca foi a régua; era a palavra que a
 * tela punha em cima dela.
 */
describe("a glicemia não afirma o que o app não sabe", () => {
  test("a régua continua com o corte permissivo de 140 — ele NÃO desceu para 95", () => {
    expect(sinalGlicemia(118)?.gravidade).toBe("normal");
    expect(sinalGlicemia(139)?.gravidade).toBe("normal");
    expect(sinalGlicemia(140)?.gravidade).toBe("atencao");
  });

  test("as duas pontas da régua saem das constantes, e batem com os `if`", () => {
    expect(sinalGlicemia(GLICEMIA.tetoPosPrandial)?.gravidade).toBe("atencao");
    expect(sinalGlicemia(GLICEMIA.tetoPosPrandial - 1)?.gravidade).toBe("normal");
    expect(sinalGlicemia(GLICEMIA.piso)?.gravidade).toBe("normal");
    expect(sinalGlicemia(GLICEMIA.piso - 1)?.gravidade).toBe("atencao");
    /* O alvo de jejum NÃO é fronteira da régua — é fronteira do DESENHO. Se um
       dia ele virar corte, este teste fica vermelho e a decisão volta à mesa. */
    expect(sinalGlicemia(GLICEMIA.alvoJejum)?.gravidade).toBe("normal");
  });

  test("a palavra «Normal» não sai para nenhum valor", () => {
    for (const v of [61, 80, 94, 95, 100, 118, 125, 139]) {
      const r = leituraDaGlicemia(v);
      expect(r?.gravidade).toBe("normal");
      expect(r?.rotulo.toLowerCase()).not.toContain("normal");
    }
  });

  test("entre o alvo de jejum e o teto, o app diz o que NÃO sabe e pede o médico", () => {
    for (const v of [95, 118, 125, 139]) {
      const r = leituraDaGlicemia(v);
      expect(r?.orientacao).toContain("jejum");
      expect(r?.orientacao).toContain("médico");
    }
  });

  test("abaixo do alvo de jejum não há cobrança — 85 não manda procurar ninguém", () => {
    const r = leituraDaGlicemia(85);
    expect(r?.orientacao).toBe(null);
    expect(r?.rotulo).toContain(String(GLICEMIA.alvoJejum));
  });

  test("as duas pontas de alarme continuam falando", () => {
    expect(leituraDaGlicemia(45)?.gravidade).toBe("grave");
    expect(leituraDaGlicemia(45)?.orientacao).toContain("doce");
    expect(leituraDaGlicemia(55)?.gravidade).toBe("atencao");
    expect(leituraDaGlicemia(250)?.gravidade).toBe("grave");
    expect(leituraDaGlicemia(null)).toBe(null);
  });
});

describe("a zona verde do gráfico tem piso", () => {
  const tela = semComentarios(readFileSync("src/components/health-tab.tsx", "utf8"));

  test("o retângulo verde é limitado pelo piso da régua, e nunca pelo fundo do desenho", () => {
    const rect = tela.slice(tela.indexOf("<rect"), tela.indexOf("<rect") + 400);
    expect(rect).toContain("GLICEMIA.alvoJejum");
    expect(rect).toContain("GLICEMIA.piso");
    /* O defeito exato: a altura ia até `minY`, que desce junto com o menor
       valor registrado. Ele só pode aparecer DENTRO de um `Math.max` com o
       piso — que é o clamp para o retângulo não começar fora do desenho. */
    expect(rect).toMatch(/Math\.max\(GLICEMIA\.piso, minY\)/);
    expect(rect).not.toMatch(/height=\{sy\(minY\)/);
  });

  test("nenhum dos três números é escrito à mão no bloco da glicemia", () => {
    /* A quarta cópia desta escala é o que produziu os dois defeitos anteriores.
       ⚠️ O recorte é o BLOCO DA GLICEMIA, e não o arquivo: `sy(140)` e `sy(90)`
       também existem no gráfico de PRESSÃO, e ali 140 é a sistólica — casar o
       arquivo inteiro reprovaria código correto. */
    const bloco = tela.slice(tela.indexOf("Histórico de glicemia"));
    expect(bloco).not.toMatch(/sy\(60\)/);
    expect(bloco).not.toMatch(/sy\(95\)/);
    expect(bloco).not.toMatch(/sy\(140\)/);
    expect(bloco.length).toBeGreaterThan(1000);
  });

  test("a legenda diz as DUAS pontas", () => {
    const legenda = tela.slice(tela.indexOf("Referência em jejum"));
    expect(legenda.slice(0, 300)).toContain("GLICEMIA.piso");
  });
});
