import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  MOSTRAR_BEBE_PADRAO,
  MOSTRAR_SEMANA_PADRAO,
  OLHO_DA_PREVIA,
  olharDe,
  personaAlcancaOPerfil,
  SEMANA_MAXIMA,
  seloDoPerfil,
  semanaPublica,
  type EntradaDoSelo,
} from "./selo-do-perfil";

const BASE: EntradaDoSelo = {
  totalDias: 28 * 7 + 3,
  nasceu: false,
  emCuidado: false,
  mostrarSemana: true,
  mostrarBebe: true,
  nomeDoBebe: "Helena",
};

describe("as duas chaves são independentes", () => {
  test("as duas nascem desligadas", () => {
    // Mesma razão escrita em `PERFIL_PUBLICO_PADRAO`: nascer ligado publicaria
    // a idade gestacional de toda paciente que já tem perfil público.
    expect(MOSTRAR_SEMANA_PADRAO).toBe(false);
    expect(MOSTRAR_BEBE_PADRAO).toBe(false);
  });

  test("⚠️ ligar o nome do bebê NÃO liga a semana", () => {
    // Uma chave só obrigaria quem quer publicar o nome a publicar junto o dado
    // clínico. São duas decisões, por razões diferentes.
    const r = seloDoPerfil({ ...BASE, mostrarSemana: false });
    expect(r.bebe).toBe("Helena");
    expect(r.semana).toBeNull();
  });

  test("⚠️ ligar a semana NÃO liga o nome do bebê", () => {
    const r = seloDoPerfil({ ...BASE, mostrarBebe: false });
    expect(r.semana).toBe("28 semanas");
    expect(r.bebe).toBeNull();
  });

  test("as duas desligadas é o perfil de hoje: nada", () => {
    const r = seloDoPerfil({ ...BASE, mostrarSemana: false, mostrarBebe: false });
    expect(r).toEqual({ semana: null, bebe: null });
  });
});

describe("a semana cala quando tem de calar", () => {
  test("⚠️ Modo Cuidado cala as duas", () => {
    // O portão mora AQUI e não em cada tela — mesma razão de `humorDaJornada`.
    const r = seloDoPerfil({ ...BASE, emCuidado: true });
    expect(r).toEqual({ semana: null, bebe: null });
  });

  test("⚠️ depois do parto a semana para", () => {
    // `computeGestation` conta para sempre: sem isto, quem pariu na 39ª
    // apareceria como "47 semanas" no perfil.
    expect(semanaPublica({ ...BASE, nasceu: true })).toBeNull();
    // E o nome do bebê CONTINUA — ele é o que mais faz sentido depois que nasce.
    expect(seloDoPerfil({ ...BASE, nasceu: true }).bebe).toBe("Helena");
  });

  test("sem DUM, silêncio — nunca '0 semanas' nem '—'", () => {
    expect(semanaPublica({ ...BASE, totalDias: null })).toBeNull();
    expect(semanaPublica({ ...BASE, totalDias: -3 })).toBeNull();
  });

  test(`⚠️ acima de ${SEMANA_MAXIMA} semanas cala`, () => {
    // DUM corrigida, ou parto que o app não soube: um número absurdo no perfil
    // não é só errado, é a tela dizendo a estranhos que algo deu errado com ela.
    expect(semanaPublica({ ...BASE, totalDias: SEMANA_MAXIMA * 7 })).toBe("42 semanas");
    expect(semanaPublica({ ...BASE, totalDias: (SEMANA_MAXIMA + 1) * 7 })).toBeNull();
  });

  test("nome em branco não vira selo vazio", () => {
    expect(seloDoPerfil({ ...BASE, nomeDoBebe: "   " }).bebe).toBeNull();
    expect(seloDoPerfil({ ...BASE, nomeDoBebe: null }).bebe).toBeNull();
  });
});

describe("o número é o mesmo de `idadeGestacional`", () => {
  test("floor de dias/7, e a redação é a única diferença", () => {
    // O médico lê `36s4d` porque os dias mudam a conduta; o perfil social lê
    // "36 semanas". Arredondar diferente faria a mesma paciente ser 36 numa
    // tela e 37 noutra.
    expect(semanaPublica({ ...BASE, totalDias: 36 * 7 })).toBe("36 semanas");
    expect(semanaPublica({ ...BASE, totalDias: 36 * 7 + 6 })).toBe("36 semanas");
    expect(semanaPublica({ ...BASE, totalDias: 37 * 7 })).toBe("37 semanas");
  });

  test("singular na primeira semana", () => {
    expect(semanaPublica({ ...BASE, totalDias: 7 })).toBe("1 semana");
  });
});

describe("o espelho", () => {
  test("⚠️ o olho da prévia NUNCA é o meu id", () => {
    // `podeVerPost` curto-circuita em `euId === post.autorId` ("a dona sempre vê
    // os dela"): com o meu id, TODO post passaria — inclusive os de `amigas` —
    // e a tela afirmaria que uma seguidora vê o desabafo de terça.
    for (const p of ["estranha", "seguidora", "amiga"] as const) {
      expect(olharDe(p).euId).toBe(OLHO_DA_PREVIA);
    }
    // E o sentinela não pode ser um uuid, para nunca casar com um id de verdade.
    expect(OLHO_DA_PREVIA).not.toMatch(/^[0-9a-f-]{36}$/);
  });

  test("a amiga também segue — senão a prévia dela esconde post que ela vê", () => {
    // `podeVerPost` aceita a camada `seguidores` com `sigoAtivo || somosAmigas`.
    expect(olharDe("amiga").sigoAtivo).toBe(true);
    expect(olharDe("amiga").somosAmigas).toBe(true);
    expect(olharDe("seguidora").sigoAtivo).toBe(true);
    expect(olharDe("seguidora").somosAmigas).toBe(false);
    expect(olharDe("estranha").sigoAtivo).toBe(false);
    expect(olharDe("estranha").somosAmigas).toBe(false);
  });

  test("nenhuma persona nasce bloqueada", () => {
    // Bloqueio é outra pergunta, e o espelho não é o lugar de simulá-la.
    for (const p of ["estranha", "seguidora", "amiga"] as const) {
      expect(olharDe(p).bloqueado).toBe(false);
    }
  });

  test("⚠️ com o perfil fechado, a ESTRANHA não alcança nada", () => {
    // É a informação mais útil que a tela dá à maioria das pacientes: a de que
    // elas não estão expostas a ninguém.
    expect(personaAlcancaOPerfil("estranha", false)).toBe(false);
    expect(personaAlcancaOPerfil("estranha", true)).toBe(true);
    // Quem já foi aceita continua vendo, com o perfil aberto ou fechado.
    expect(personaAlcancaOPerfil("seguidora", false)).toBe(true);
    expect(personaAlcancaOPerfil("amiga", false)).toBe(true);
  });
});

describe("⚠️ a regra das Amigas continua valendo LÁ", () => {
  test("`amigas.ts` não passa a mostrar semana nem DPP", () => {
    // A reabertura é só da rede social, e a razão está escrita em
    // `selo-do-perfil.ts`: lá o perfil continua visível no luto, aqui o Modo
    // Cuidado já torna o perfil inteiro indisponível.
    const amigas = readFileSync("src/lib/amigas.ts", "utf8");
    expect(amigas).toContain("sem semanas, sem DPP");
    const fns = readFileSync("src/lib/amigas.functions.ts", "utf8");
    for (const proibido of ["lmp_date", "due_date", "computeGestation", "semanaPublica"]) {
      expect(fns).not.toContain(proibido);
    }
  });
});
