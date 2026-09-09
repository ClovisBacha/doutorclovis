/**
 * O PROMPT BASE — o que ele diz quando o CONTEXTO NÃO CHEGA.
 *
 * ⚠️ `blocoDaNutricao` falha CALADA de propósito: qualquer leitura ruim devolve
 * `""` e a nutricionista responde "como sempre respondeu". Isso é certo para
 * semana, peso e glicemia — e era um buraco para ALERGIA, que só existia dentro
 * do bloco. Numa leitura falha o prompt base não tinha uma linha sobre alergia,
 * e a nutricionista sugeria camarão para quem tem alergia a frutos do mar sem
 * nada no caminho.
 *
 * Os outros três achados desta leva são de instruções que BRIGAM entre si.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { semComentarios } from "./sem-comentarios";

const FONTE = semComentarios(readFileSync("src/routes/api/nutrition.ts", "utf8"));
const trecho = (marca: string) => {
  const i = FONTE.indexOf(marca);
  expect(i).toBeGreaterThan(-1);
  const fim = FONTE.indexOf("`;", i);
  expect(fim).toBeGreaterThan(i);
  return FONTE.slice(i, fim);
};
const BASE = trecho("const NUTRITION_SYSTEM =");
const LUTO = trecho("const NUTRICAO_EM_LUTO =");

describe("⚠️ a alergia vive no prompt BASE, e não só no bloco de contexto", () => {
  test("os dois prompts têm a regra — o luto também carrega alergia", () => {
    for (const p of [BASE, LUTO]) {
      expect(p).toMatch(/ALERGIA/);
      expect(p).toMatch(/NUNCA sugira um alimento sem conferir/);
    }
  });

  test("⚠️ e BLOCO AUSENTE não vale 'ela não tem alergia' — vale PERGUNTAR", () => {
    /* É o mesmo fail-closed do resto do app: "não sei" nunca pode significar
       a hipótese mais permissiva. Sem esta metade, a regra seria inútil
       exatamente no caso em que ela existe para valer. */
    for (const p of [BASE, LUTO]) {
      expect(p).toMatch(/pergunte antes de sugerir/i);
    }
    expect(BASE).toMatch(/NÃO quer dizer que ela não tem alergia/);
  });
});

describe("⚠️ as instruções que brigavam entre si", () => {
  test("a proibição de caloria é INCONDICIONAL — o 'sem conhecer o perfil' saiu", () => {
    /* Com o condicional, o prompt dizia ao modelo que bastava conhecer o perfil
       para dar número — e o bloco de contexto passou a entregar IMC, ganho,
       semana e glicemia. Ou seja: a exceção estava sendo satisfeita todo dia,
       numa base em que ~13% das puérperas têm transtorno alimentar. */
    expect(BASE).toMatch(/NUNCA dê valores calóricos/);
    expect(BASE).not.toMatch(/sem conhecer o perfil completo/);
    expect(BASE).toMatch(/nem quando conhecer o perfil/i);
  });

  test("o limite de frases ABRE EXCEÇÃO para prato, receita e o que tem em casa", () => {
    /* As três ferramentas da aba pedem uma lista. "Seja concisa (3–6 frases)"
       sem exceção mandava o modelo espremer uma receita em seis frases — o
       prompt brigando com o botão que a própria tela oferece. */
    expect(BASE).toMatch(/3 a 6 frases/);
    expect(BASE).toMatch(/PRATO/);
    expect(BASE).toMatch(/RECEITA/);
    expect(BASE).toMatch(/limite de frases não vale/i);
  });
});

describe("a lista de evitar cobre o que a gestante de fato pergunta", () => {
  test("cafeína, chá de erva e a higiene da toxoplasmose entraram", () => {
    /* Os três estavam FORA da lista, e são as perguntas mais comuns da
       gestação — a paciente ia buscar a resposta fora do app. */
    expect(BASE).toMatch(/CAFEÍNA/);
    expect(BASE).toMatch(/200 mg/);
    expect(BASE).toMatch(/CHÁ DE ERVA NÃO É AUTOMATICAMENTE SEGURO/);
    expect(BASE).toMatch(/toxoplasmose/i);
  });

  test("⚠️ e o chá nunca é liberado sem o médico", () => {
    expect(BASE).toMatch(/Nunca diga que um chá "pode" sem que ela confirme com o médico/);
  });

  test("álcool continua sem dose segura", () => {
    expect(BASE).toMatch(/álcool em qualquer quantidade/i);
  });
});
