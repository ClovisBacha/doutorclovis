/**
 * O QUE A NUTRICIONISTA SABE — e o que ela nunca pode dizer.
 *
 * ⚠️ Este bloco vai para o PROMPT, então o risco é de TEXTO: em Modo Cuidado
 * a palavra "semana" aqui desfaria, pela porta dos fundos, o portão que o
 * `NUTRICAO_EM_LUTO` monta em maiúsculas.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { faixaDoImc, imcPreGestacional, iomGain, posicaoNaFaixa } from "./curva-de-ganho";
import {
  TEXTO_LIVRE_MAX,
  blocoDaPaciente,
  conviteDoMomento,
  idadeDoBebe,
  momentoDoDia,
  recortar,
  type PerfilNutricional,
} from "./nutricao-perfil";

const semProsa = (t: string) =>
  t
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

const base: PerfilNutricional = { careMode: false };

describe("a alergia é o que não pode faltar", () => {
  test("entra primeiro, com a instrução de nunca sugerir", () => {
    const b = blocoDaPaciente({ ...base, alergias: "frutos do mar, amendoim" });
    expect(b).toContain("frutos do mar, amendoim");
    expect(b).toMatch(/NUNCA sugira/);
  });

  test("⚠️ e SOBREVIVE ao Modo Cuidado — é segurança, não conteúdo de gestação", () => {
    const b = blocoDaPaciente({ ...base, careMode: true, alergias: "lactose" });
    expect(b).toContain("lactose");
  });

  test("sem alergia e sem mais nada, o bloco não existe", () => {
    expect(blocoDaPaciente(base)).toBe("");
  });

  test("texto livre é recortado — o prompt não é lugar para um romance", () => {
    expect(recortar("  a   b  ")).toBe("a b");
    expect(recortar("")).toBeNull();
    expect(recortar(null)).toBeNull();
    expect(recortar("x".repeat(900))!.length).toBe(TEXTO_LIVRE_MAX);
  });
});

describe("⚠️ Modo Cuidado apaga a gestação, e só ela", () => {
  const cheio: PerfilNutricional = {
    careMode: true,
    alergias: "glúten",
    medicacoes: "sulfato ferroso",
    semanas: 26,
    trimestre: 2,
    imc: 22,
    ganhoKg: 9,
    dmgAnterior: true,
    glicemiasAlteradas: 4,
    glicemia: { valor: 168, alterada: true, quando: "01/09/2026" },
  };
  const b = blocoDaPaciente(cheio);

  test("nada de semana, trimestre, faixa de ganho ou bebê", () => {
    expect(b).not.toMatch(/semana|trimestre|gesta[çc]|beb[êe]|parto|ganho de peso/i);
  });
  test("e nada da atenção glicêmica, que fala de gestação anterior", () => {
    expect(b).not.toMatch(/ATENÇÃO GLICÊMICA/);
  });
  test("mas alergia, medicação e a última glicemia ficam — são do corpo dela", () => {
    expect(b).toContain("glúten");
    expect(b).toContain("sulfato ferroso");
    expect(b).toContain("168");
  });
});

describe("o ganho de peso é contexto, nunca meta", () => {
  const p: PerfilNutricional = { ...base, semanas: 28, imc: 31, ganhoKg: 14 };
  const b = blocoDaPaciente(p);

  test("diz onde ela está na faixa, com os números da faixa", () => {
    expect(b).toMatch(/acima da faixa de referência/);
    expect(b).toMatch(/\d+[.,]\d–\d+[.,]\d kg/);
    expect(b).toContain("obesidade");
  });

  test("⚠️ e a proibição de restrição vem COLADA no número", () => {
    /* Solta no prompt, o modelo transforma "acima da faixa" em plano de
       emagrecimento — a coisa mais perigosa a dizer a uma gestante. */
    const i = b.indexOf("acima da faixa");
    const j = b.indexOf("NUNCA proponha restrição");
    expect(j).toBeGreaterThan(i);
    expect(j - i).toBeLessThan(400);
  });

  test("sem peso pré-gestacional ou sem altura, nada de ganho", () => {
    expect(blocoDaPaciente({ ...base, semanas: 28, ganhoKg: 14 })).not.toMatch(
      /faixa de referência/,
    );
    expect(blocoDaPaciente({ ...base, semanas: 28, imc: 22 })).not.toMatch(/faixa de referência/);
  });
});

describe("a atenção glicêmica não é um interruptor novo", () => {
  test("duas glicemias fora do alvo bastam", () => {
    const b = blocoDaPaciente({ ...base, glicemiasAlteradas: 2 });
    expect(b).toMatch(/ATENÇÃO GLICÊMICA/);
    expect(b).toMatch(/2 glicemias fora do alvo/);
  });
  test("DMG numa gestação anterior basta sozinho", () => {
    const b = blocoDaPaciente({ ...base, dmgAnterior: true });
    expect(b).toMatch(/diabetes gestacional numa gestação anterior/);
  });
  test("uma só não liga nada — medida isolada não é padrão", () => {
    expect(blocoDaPaciente({ ...base, glicemiasAlteradas: 1 })).not.toMatch(/ATENÇÃO GLICÊMICA/);
  });
  test("⚠️ e ela NUNCA diagnostica", () => {
    const b = blocoDaPaciente({ ...base, dmgAnterior: true, glicemiasAlteradas: 3 });
    expect(b).toMatch(/NUNCA diga que ela tem diabetes gestacional/);
    expect(b).toMatch(/quem diz isso é o médico/i);
  });
});

describe("o momento do dia", () => {
  test("as fronteiras", () => {
    expect(momentoDoDia(3)).toBe("madrugada");
    expect(momentoDoDia(7)).toBe("café da manhã");
    expect(momentoDoDia(10)).toBe("lanche da manhã");
    expect(momentoDoDia(12)).toBe("almoço");
    expect(momentoDoDia(16)).toBe("lanche da tarde");
    expect(momentoDoDia(20)).toBe("jantar");
    expect(momentoDoDia(22)).toBe("ceia");
  });
  test("⚠️ de madrugada não se propõe refeição", () => {
    /* Quem está acordada às 3h numa gestação de risco não precisa de mais
       alguém sugerindo o que comer. */
    expect(conviteDoMomento(3)).not.toMatch(/vamos montar|que tal montar/i);
    expect(conviteDoMomento(3)).toMatch(/se você quiser/);
  });
  test("as 24 horas têm convite, e nenhum cobra", () => {
    for (let h = 0; h < 24; h++) {
      const c = conviteDoMomento(h);
      expect(c.length).toBeGreaterThan(10);
      expect(c).not.toMatch(/você (não|precisa|deveria)|está atrasad/i);
    }
  });
});

describe("a curva do IOM é uma régua só", () => {
  test("o componente não a define mais", () => {
    const TELA = semProsa(readFileSync("src/components/health-tab.tsx", "utf8"));
    expect(TELA).not.toMatch(/function iomGain/);
    expect(TELA).toContain('from "@/lib/curva-de-ganho"');
  });
  test("as quatro faixas de IMC", () => {
    expect(faixaDoImc(17)).toBe("baixo peso");
    expect(faixaDoImc(22)).toBe("peso adequado");
    expect(faixaDoImc(27)).toBe("sobrepeso");
    expect(faixaDoImc(33)).toBe("obesidade");
  });
  test("o IMC recusa medida implausível em vez de chutar", () => {
    expect(imcPreGestacional(62, 165)).toBeCloseTo(22.77, 1);
    expect(imcPreGestacional(10, 165)).toBeNull();
    expect(imcPreGestacional(62, 30)).toBeNull();
  });
  test("⚠️ a folga de meio quilo existe para a balança de casa", () => {
    const { min } = iomGain(28, 22);
    /* Exatamente no limite de baixo, com 0,4 kg a menos, ainda é "dentro". */
    expect(posicaoNaFaixa(min - 0.4, 28, 22)).toBe("dentro");
    expect(posicaoNaFaixa(min - 0.6, 28, 22)).toBe("abaixo");
  });
});

describe("o endpoint usa a régua", () => {
  const API = semProsa(readFileSync("src/routes/api/nutrition.ts", "utf8"));
  test("o bloco entra no system, junto do prompt certo", () => {
    expect(API).toContain("blocoDaNutricao(patientId, careMode)");
    expect(API).toMatch(/NUTRICAO_EM_LUTO : NUTRITION_SYSTEM\) \+ blocoDaPaciente/);
  });
});

describe("⚠️ ela já pariu — o bloco fala do puerpério, nunca da semana 42", () => {
  /* Medido em set/2026 com a DUM a 300 dias e `birth_date` preenchida: o
     prompt dizia "Está na semana 42 da gestação (3º trimestre)" para uma
     mulher com o bebê no colo. `posParto` SUBSTITUI a semana. */
  const b = blocoDaPaciente({
    ...base,
    posParto: true,
    diasDoBebe: 20,
    semanas: 42,
    trimestre: 3,
    imc: 22,
    ganhoKg: 12,
  });

  test("diz que ela já teve o bebê, com a idade dele", () => {
    expect(b).toMatch(/JÁ TEVE O BEBÊ/);
    expect(b).toMatch(/o bebê tem 2 semanas/);
  });

  test("⚠️ e a semana gestacional, o trimestre e a faixa de ganho SOMEM", () => {
    expect(b).not.toMatch(/semana \d+ da gestação|trimestre\)|faixa de referência/);
  });

  test("⚠️ a amamentação entra como HIPÓTESE, nunca como afirmação", () => {
    /* O app não sabe se ela amamenta, e afirmar isso a quem não conseguiu é
       a pior frase possível. */
    expect(b).toMatch(/SE ela estiver amamentando/);
    expect(b).not.toMatch(/ela (está|esta) amamentando/i);
  });

  test("⚠️ o LUTO vence o pós-parto — `birth_date` não é limpa num natimorto", () => {
    const luto = blocoDaPaciente({ ...base, careMode: true, posParto: true, diasDoBebe: 20 });
    expect(luto).toBe("");
  });

  test("a idade do bebê fala na unidade que ela usaria", () => {
    expect(idadeDoBebe(1)).toBe("o bebê nasceu há 1 dia");
    expect(idadeDoBebe(9)).toBe("o bebê nasceu há 9 dias");
    expect(idadeDoBebe(35)).toBe("o bebê tem 5 semanas");
    expect(idadeDoBebe(61)).toBe("o bebê tem 2 meses");
  });
});
