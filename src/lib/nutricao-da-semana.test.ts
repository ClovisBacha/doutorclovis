/**
 * A FRASE DA SEMANA, EXERCITADA — e as cinco coisas que ela não pode dizer.
 *
 * ⚠️ As proibições aqui não são de estilo: cada uma tem dano documentado, e a
 * razão de cada uma está no cabeçalho de `nutricao-da-semana.ts`.
 */
import { describe, expect, test } from "bun:test";
import { FAIXAS_DA_NUTRICAO, nutricaoDaSemana } from "@/lib/nutricao-da-semana";

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
