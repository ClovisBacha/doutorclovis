/**
 * A FRASE DA SEMANA, EXERCITADA — e as cinco coisas que ela não pode dizer.
 *
 * ⚠️ As proibições aqui não são de estilo: cada uma tem dano documentado, e a
 * razão de cada uma está no cabeçalho de `nutricao-da-semana.ts`.
 */
import { describe, expect, test } from "bun:test";
import {
  FAIXAS_DA_NUTRICAO,
  FAIXAS_DO_POS_PARTO,
  nutricaoDaSemana,
  nutricaoDoPosParto,
} from "@/lib/nutricao-da-semana";

const TODAS = Array.from({ length: 39 }, (_, i) => i + 4);

describe("a cobertura", () => {
  test("toda semana de 4 a 42 tem frase", () => {
    for (const s of TODAS) {
      const f = nutricaoDaSemana(s);
      expect(`${s}: ${f != null}`).toBe(`${s}: true`);
    }
  });

  test("⚠️ sem semana conhecida, NÃO há frase", () => {
    /* Uma frase genérica com cara de personalizada é pior que nenhuma: ela
       ensina que o "para a sua semana" deste app não quer dizer nada. */
    expect(nutricaoDaSemana(null)).toBeNull();
    expect(nutricaoDaSemana(undefined)).toBeNull();
    expect(nutricaoDaSemana(Number.NaN)).toBeNull();
    /* E fora da faixa plausível também não. */
    expect(nutricaoDaSemana(2)).toBeNull();
    expect(nutricaoDaSemana(60)).toBeNull();
  });

  test("⚠️ e NADA no Modo Cuidado — o sujeito da frase é o bebê", () => {
    for (const s of [8, 20, 34, 40]) expect(nutricaoDaSemana(s, true)).toBeNull();
  });
});

describe("⚠️ o que nenhuma frase pode dizer", () => {
  const tudo = FAIXAS_DA_NUTRICAO.map((f) => `${f.titulo} ${f.texto}`).join(" \n ");

  test("nenhuma sugere suplemento — quem indica é o profissional", () => {
    /* A ACOG orienta TRIAR a dieta e o uso de suplementos. E este app já tem
       um checklist de suplementos que nasce do que o MÉDICO prescreveu. */
    expect(tudo).not.toMatch(
      /\b(tome|tomar|suplement\w*|c[áa]psula|comprimido|vitamina do complexo|[áa]cido f[óo]lico|sulfato ferroso)\b/i,
    );
  });

  test("⚠️ nenhuma fala em caloria, peso ou dieta", () => {
    /* Numa base de gestação de alto risco o dano é documentado: uso regular de
       app de dieta se associa a hábitos problemáticos com comida, e ~13% das
       puérperas têm transtorno alimentar. */
    expect(tudo).not.toMatch(
      /\b(caloria\w*|kcal|emagrec\w*|dieta|meta de peso|engordar demais)\b/i,
    );
  });

  test("⚠️ a frase do 1º trimestre NÃO fala em fechar o tubo neural", () => {
    /* Ele fecha até ~28 dias depois da concepção — antes de muitas mulheres
       saberem que estão grávidas. Na semana 8 isso não orienta: vira culpa
       retroativa pelo que ela não tinha como ter feito. */
    for (const s of [4, 6, 8, 10, 12, 13]) {
      const f = nutricaoDaSemana(s)!;
      expect(`${s}: ${/tubo neural/i.test(`${f.titulo} ${f.texto}`)}`).toBe(`${s}: false`);
    }
  });

  test("nenhuma cobra, e nenhuma promete", () => {
    expect(tudo).not.toMatch(/\bvoc[êe] (não|nao|deveria|precisa)\b/i);
    expect(tudo).not.toMatch(/\b(garante|previne|evita a|impede)\b/i);
  });

  test("elas falam de ALIMENTO, e não de nutriente abstrato", () => {
    /* "Aumente a ingestão de ácido docosa-hexaenoico" não vira jantar. */
    const comida =
      /\b(feij[ãa]o|arroz|carne|ovo|folhas|fruta|leite|queijo|iogurte|sardinha|atum|peixe|gr[ãa]o)\b/i;
    for (const f of FAIXAS_DA_NUTRICAO) {
      expect(`${f.titulo}: ${comida.test(f.texto)}`).toBe(`${f.titulo}: true`);
    }
  });
});

describe("⚠️ depois do parto a régua é OUTRA — por dias de vida do bebê", () => {
  /* `computeGestation` conta para sempre: sem estas faixas, quem pariu na 39ª
     lia "Ele está ganhando peso para nascer" com o bebê no colo. */
  test("todo dia de 0 a 365 tem frase, e nenhuma é a da semana 37–42", () => {
    const daSemana42 = nutricaoDaSemana(42)!.titulo;
    for (let d = 0; d <= 365; d++) {
      const f = nutricaoDoPosParto(d);
      expect(`${d}: ${f != null}`).toBe(`${d}: true`);
      expect(f!.titulo).not.toBe(daSemana42);
    }
  });

  test("sem data, e no Modo Cuidado, NÃO há frase", () => {
    expect(nutricaoDoPosParto(null)).toBeNull();
    expect(nutricaoDoPosParto(undefined)).toBeNull();
    expect(nutricaoDoPosParto(Number.NaN)).toBeNull();
    /* `birth_date` não é limpa num natimorto — e "Ele mama" é a frase que o
       luto existe para calar. */
    for (const d of [0, 20, 100]) expect(nutricaoDoPosParto(d, true)).toBeNull();
  });

  const tudo = FAIXAS_DO_POS_PARTO.map((f) => `${f.titulo} ${f.texto}`).join(" \n ");

  test("⚠️ nenhuma AFIRMA que ela amamenta — amamentação entra com 'se'", () => {
    /* O app não sabe se ela amamenta, e afirmar isso a quem não conseguiu é a
       pior frase possível. */
    expect(tudo).not.toMatch(/\b(você está amamentando|seu leite|o leite que você)\b/i);
    for (const f of FAIXAS_DO_POS_PARTO) {
      if (/amament/i.test(f.texto)) expect(f.texto).toMatch(/se estiver amamentando/i);
    }
  });

  test("as mesmas proibições da gestação valem aqui", () => {
    expect(tudo).not.toMatch(
      /\b(tome|tomar|suplement\w*|c[áa]psula|comprimido|[áa]cido f[óo]lico|sulfato ferroso)\b/i,
    );
    expect(tudo).not.toMatch(/\b(caloria\w*|kcal|emagrec\w*|dieta|meta de peso|voltar ao peso)\b/i);
    expect(tudo).not.toMatch(/\bvoc[êe] (não|nao|deveria|precisa)\b/i);
  });

  test("elas falam de ALIMENTO", () => {
    const comida =
      /\b(feij[ãa]o|arroz|carne|ovo|folhas|fruta|leite|queijo|iogurte|sopa|p[ãa]o|legume)\b/i;
    for (const f of FAIXAS_DO_POS_PARTO) {
      expect(`${f.titulo}: ${comida.test(f.texto)}`).toBe(`${f.titulo}: true`);
    }
  });
});
