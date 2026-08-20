import { describe, expect, test } from "bun:test";
import {
  codigoLimpo,
  fraseDoConvite,
  inicialDoConvite,
  primeiroNome,
  subtextoDoConvite,
  type QuemConvidou,
} from "./quem-convidou";

const amiga: QuemConvidou = { nome: "Marina", avatarUrl: null, tipo: "amiga" };
const criadora: QuemConvidou = { nome: "Marina", avatarUrl: null, tipo: "criadora" };

describe("o código", () => {
  test("normaliza caixa e espaço — veio de uma URL, não de um cofre", () => {
    expect(codigoLimpo(" abc123 ")).toBe("ABC123");
  });

  /* ⚠️ A validação acontece ANTES de qualquer consulta, e é ela que impede o
     campo de virar entrada para `ilike`. Um `%` que passasse daqui viraria
     curinga no PostgREST e um único caractere devolveria o primeiro nome de
     uma paciente qualquer da base. */
  test("⚠️ recusa curinga de LIKE, e qualquer coisa fora de [A-Z0-9]", () => {
    expect(codigoLimpo("%")).toBeNull();
    expect(codigoLimpo("A%C")).toBeNull();
    expect(codigoLimpo("A_C")).toBeNull();
    expect(codigoLimpo("ABC-123")).toBeNull();
    expect(codigoLimpo("ABC 123")).toBeNull();
    expect(codigoLimpo("'; drop--")).toBeNull();
  });

  test("recusa curto demais, longo demais e vazio", () => {
    expect(codigoLimpo("AB")).toBeNull();
    expect(codigoLimpo("A".repeat(13))).toBeNull();
    expect(codigoLimpo("")).toBeNull();
    expect(codigoLimpo(null)).toBeNull();
    expect(codigoLimpo(undefined)).toBeNull();
  });
});

describe("o nome", () => {
  /* ⚠️ Sobrenome identifica; primeiro nome apresenta. "Marina Costa" num
     convite que roda no grupo do trabalho é o nome completo de uma gestante
     circulando para quem ela não escolheu. */
  test("⚠️ é só o PRIMEIRO — o sobrenome não sai daqui", () => {
    expect(primeiroNome("Marina Costa Silva")).toBe("Marina");
    expect(primeiroNome("  Ana   Paula  ")).toBe("Ana");
  });

  test("lixo de cadastro vira null", () => {
    expect(primeiroNome("")).toBeNull();
    expect(primeiroNome("   ")).toBeNull();
    expect(primeiroNome("A")).toBeNull();
    expect(primeiroNome(null)).toBeNull();
  });

  test("a inicial vem em caixa alta", () => {
    expect(inicialDoConvite("marina")).toBe("M");
  });
});

describe("as frases", () => {
  test("levam o nome", () => {
    expect(fraseDoConvite(amiga)).toContain("Marina");
    expect(fraseDoConvite(criadora)).toContain("Marina");
  });

  /* ⚠️ "A Marina te chamou pra cá" dito por uma influenciadora que a paciente
     não conhece pessoalmente soa falso. É o mesmo fato sem fingir intimidade. */
  test("⚠️ a da criadora NÃO finge intimidade", () => {
    expect(fraseDoConvite(amiga)).not.toBe(fraseDoConvite(criadora));
    expect(fraseDoConvite(criadora)).toContain("convite");
  });

  /* ⚠️ Quem convidou é uma pessoa, não um anúncio: a frase não promete nada
     clínico. É a mesma proibição das frases do mascote. */
  test("⚠️ nenhuma promete cuidado, ajuda ou desfecho", () => {
    const tudo = [
      fraseDoConvite(amiga),
      fraseDoConvite(criadora),
      subtextoDoConvite(amiga),
      subtextoDoConvite(criadora),
    ]
      .join(" ")
      .toLocaleLowerCase("pt-BR");
    for (const proibido of [
      "vai te ajudar",
      "cuida de você",
      "está tudo bem",
      "seguro",
      "médico",
      "saúde",
      "tratamento",
    ]) {
      expect(tudo).not.toContain(proibido);
    }
  });

  /* A da amiga diz o que acontece se ela criar conta — é o que torna o convite
     útil, e não só simpático. */
  test("a da amiga explica o vínculo", () => {
    expect(subtextoDoConvite(amiga)).toContain("ligadas");
  });
});
