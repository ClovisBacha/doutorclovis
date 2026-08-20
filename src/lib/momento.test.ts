import { describe, expect, test } from "bun:test";
import {
  momentoDe,
  ROTULO_COMPARTILHAR,
  type EntradaDoMomento,
  type EspecieDeMomento,
} from "./momento";

const TODAS: EspecieDeMomento[] = [
  "semana",
  "cinco_estrelas",
  "trofeu",
  "chama",
  "conquista",
  "marco_gratidao",
  "album_semana",
  "aula",
];

/** Uma entrada válida por espécie — para varrer o catálogo inteiro. */
function valida(especie: EspecieDeMomento): EntradaDoMomento {
  return {
    especie,
    numero: 12,
    rotulo: especie === "aula" ? "nutrição" : especie === "conquista" ? "Primeira semana" : null,
    emoji: null,
    emCuidado: false,
  };
}

describe("o portão de Modo Cuidado", () => {
  /* ⚠️ Ele mora AQUI, e não em cada uma das oito telas — mesma decisão de
     `humorDaJornada`. E existe porque o mapeamento achou o defeito gêmeo: os
     sprites de check/estrela/cinco disparam sem portão nenhum. */
  test("⚠️ TODA espécie devolve null no luto", () => {
    for (const especie of TODAS) {
      expect(momentoDe({ ...valida(especie), emCuidado: true })).toBeNull();
    }
  });

  test("e fora do luto todas produzem um momento", () => {
    for (const especie of TODAS) {
      expect(momentoDe(valida(especie))).not.toBeNull();
    }
  });
});

describe("os números", () => {
  /* ⚠️ Um cartão "0 dias seguidos" é a paciente publicando o que ela não fez —
     e ele nasceria de um estado transitório da tela, não de uma conquista. */
  test("⚠️ zero, negativo e ausente não viram cartão", () => {
    for (const especie of [
      "semana",
      "trofeu",
      "chama",
      "marco_gratidao",
      "album_semana",
    ] as const) {
      expect(momentoDe({ ...valida(especie), numero: 0 })).toBeNull();
      expect(momentoDe({ ...valida(especie), numero: -3 })).toBeNull();
      expect(momentoDe({ ...valida(especie), numero: null })).toBeNull();
      expect(momentoDe({ ...valida(especie), numero: NaN })).toBeNull();
    }
  });

  test("o plural acompanha o número", () => {
    expect(momentoDe({ ...valida("chama"), numero: 1 })?.unidade).toBe("dia seguido");
    expect(momentoDe({ ...valida("chama"), numero: 2 })?.unidade).toBe("dias seguidos");
    expect(momentoDe({ ...valida("semana"), numero: 1 })?.unidade).toBe("semana");
  });

  test("os que não têm número não inventam um", () => {
    expect(momentoDe(valida("cinco_estrelas"))?.numero).toBeNull();
    expect(momentoDe(valida("conquista"))?.numero).toBeNull();
    expect(momentoDe(valida("aula"))?.numero).toBeNull();
  });
});

describe("os rótulos obrigatórios", () => {
  /* Conquista sem nome e aula sem tema não têm o que dizer — um cartão vazio é
     pior que nenhum. */
  test("conquista e aula exigem rótulo", () => {
    expect(momentoDe({ ...valida("conquista"), rotulo: "" })).toBeNull();
    expect(momentoDe({ ...valida("aula"), rotulo: "   " })).toBeNull();
  });
});

describe("⚠️ o que NUNCA pode estar num cartão", () => {
  const tudo = TODAS.map((especie) => {
    const m = momentoDe(valida(especie))!;
    return [m.chapeu, m.titulo, m.legenda, m.textoDeShare, m.unidade ?? ""].join(" ");
  })
    .join(" ")
    .toLocaleLowerCase("pt-BR");

  /* ⚠️ O cartão sai do aparelho dela e vai para o Instagram: ele fala do que
     ELA fez, nunca do bebê estar bem, nunca de exame, nunca de conduta. Mesma
     proibição das frases do mascote. */
  test("⚠️ nada clínico, nenhuma promessa, nenhum desfecho", () => {
    for (const proibido of [
      "tudo bem",
      "saudável",
      "saudavel",
      "exame",
      "pressão",
      "peso",
      "batimento",
      "médico",
      "medico",
      "seguro",
      "risco",
      "vai dar certo",
      "parto",
    ]) {
      expect(tudo).not.toContain(proibido);
    }
  });

  /* ⚠️ O dia gestacional é a semana disfarçada (D = semana × 7 + dia). Nenhum
     momento além do da SEMANA carrega número de dia gestacional — o troféu diz
     "dias completos", que é sobre o esforço dela. */
  test("⚠️ nenhum momento fala em 'dia gestacional' nem em 'dia N da gestação'", () => {
    expect(tudo).not.toContain("dia gestacional");
    expect(tudo).not.toContain("da gestação");
  });

  /* ⚠️ Cobrança não entra em cartão de conquista — é o oposto do momento. */
  test("⚠️ nada de cobrança", () => {
    for (const proibido of ["você não", "voce nao", "perdeu", "falta", "continue assim"]) {
      expect(tudo).not.toContain(proibido);
    }
  });
});

describe("o cartão fica pronto para virar arquivo", () => {
  test("todo momento tem nome de arquivo sem espaço nem acento", () => {
    for (const especie of TODAS) {
      const a = momentoDe(valida(especie))!.arquivo;
      expect(a).toMatch(/^[a-z0-9-]+$/);
    }
  });

  test("todo momento tem emoji, chapéu e título", () => {
    for (const especie of TODAS) {
      const m = momentoDe(valida(especie))!;
      expect(m.emoji.length).toBeGreaterThan(0);
      expect(m.chapeu.trim().length).toBeGreaterThan(2);
      expect(m.titulo.trim().length).toBeGreaterThan(4);
    }
  });

  /* ⚠️ "Compartilhar" e nunca "publicar": a folha tem DUAS saídas e não publica
     nada sozinha. "Publicar" faria metade das pacientes não tocar. */
  test("⚠️ o botão não promete publicar", () => {
    expect(ROTULO_COMPARTILHAR.toLocaleLowerCase("pt-BR")).not.toContain("publicar");
  });
});
