import { describe, expect, test } from "bun:test";
import {
  codigoDeCriadoraLimpo,
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

/**
 * ⚠️ O CÓDIGO DA CRIADORA TEM OUTRA FORMA — e a régua estreita escondia a faixa
 * dela em silêncio.
 *
 * `referral_code` de paciente é gerado pelo app e é sempre alfanumérico curto.
 * `affiliates.code` é escrito À MÃO pelo dono, e o próprio app já aceita muito
 * mais: a captura de `?ref=` em `__root.tsx` valida `[a-zA-Z0-9_-]{3,24}`,
 * guarda 90 dias, atribui a assinatura e paga a comissão. Um código como
 * `DRA-ANA` funcionava de ponta a ponta na economia — e a faixa "Fulana te
 * chamou pra cá" simplesmente não aparecia, no link que ela pôs na bio.
 */
describe("o código da criadora", () => {
  test("⚠️ hífen, sublinhado e até 24 caracteres passam", () => {
    expect(codigoDeCriadoraLimpo("DRA-ANA")).toBe("DRA-ANA");
    expect(codigoDeCriadoraLimpo("dra_ana")).toBe("DRA_ANA");
    expect(codigoDeCriadoraLimpo("A".repeat(24))).toBe("A".repeat(24));
  });

  /* ⚠️ A forma é a MESMA da captura de `?ref=` em `__root.tsx`. Duas réguas
     para "que código é válido" divergem no primeiro ajuste — e a divergência
     aparece como criadora sem faixa, que é exatamente este defeito. */
  test("⚠️ é EXATAMENTE o que a captura de ?ref= aceita", () => {
    const capturaDoRoot = /^[a-zA-Z0-9_-]{3,24}$/;
    for (const c of ["DRA-ANA", "dra_ana", "abc", "A1_b-2", "A".repeat(24)]) {
      expect(capturaDoRoot.test(c)).toBe(true);
      expect(codigoDeCriadoraLimpo(c)).toBe(c.toUpperCase());
    }
    for (const c of ["ab", "A".repeat(25), "a b", "a%b", "a'b"]) {
      expect(capturaDoRoot.test(c)).toBe(false);
      expect(codigoDeCriadoraLimpo(c)).toBeNull();
    }
  });

  /* ⚠️ `%` continua fora. Ele não está no alfabeto da captura, então um código
     com `%` nunca seria atribuído — e recusá-lo mantém este arquivo seguro se
     um dia a consulta deixar de ser `.eq()`. */
  test("⚠️ o curinga do LIKE continua barrado", () => {
    expect(codigoDeCriadoraLimpo("A%C")).toBeNull();
    expect(codigoDeCriadoraLimpo("%")).toBeNull();
  });

  /* ⚠️ E a régua da PACIENTE não se mexeu: ela alimenta `linkDeIndicacao`, que
     exige a forma estreita. Afrouxá-la geraria links que o app não reconhece. */
  test("⚠️ a régua da paciente continua estreita", () => {
    expect(codigoLimpo("DRA-ANA")).toBeNull();
    expect(codigoLimpo("A".repeat(13))).toBeNull();
  });
});
