import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  alcancaOPerfil,
  bebeDoPerfil,
  contextoDaPersona,
  entradaDoSelo,
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

describe("a linha do banco vira entrada — e é aqui que o consentimento vive", () => {
  /* ⚠️ Estes testes existem por causa de uma mutação que passou VERDE na
     verificação da Fase 1: cravar `mostrarSemana: true, mostrarBebe: true` no
     adaptador dentro do servidor desligava o consentimento inteiro e os 3.149
     testes continuavam passando — a única cobertura daquele trecho era um
     `toContain` sobre o texto do fonte. */

  test("⚠️ chave ausente vale FALSE, nunca true", () => {
    // É o que faz um banco sem as colunas se comportar como "ela não ligou
    // nada" — que é a verdade.
    const e = entradaDoSelo({ baby_name: "Helena" }, 200);
    expect(e.mostrarSemana).toBe(false);
    expect(e.mostrarBebe).toBe(false);
    expect(seloDoPerfil(e)).toEqual({ semana: null, bebe: null });
  });

  test("⚠️ e só o `true` literal liga — nem 1, nem 'sim'", () => {
    const e = entradaDoSelo({ mostrar_semana: 1 as never, mostrar_bebe: "sim" as never }, 200);
    expect(e.mostrarSemana).toBe(false);
    expect(e.mostrarBebe).toBe(false);
  });

  test("a linha inteira ausente não estoura", () => {
    expect(seloDoPerfil(entradaDoSelo(null, null))).toEqual({ semana: null, bebe: null });
  });

  test("os quatro sinais chegam íntegros", () => {
    const e = entradaDoSelo(
      {
        care_mode: true,
        birth_date: "2026-08-01",
        baby_name: " Helena ",
        mostrar_semana: true,
        mostrar_bebe: true,
      },
      200,
    );
    expect(e).toEqual({
      totalDias: 200,
      nasceu: true,
      emCuidado: true,
      mostrarSemana: true,
      mostrarBebe: true,
      nomeDoBebe: " Helena ",
    });
  });
});

describe("o contexto da prévia", () => {
  const ALVO = "11111111-1111-1111-1111-111111111111";

  test("⚠️ a estranha não segue e não é amiga — e o olho não é o meu id", () => {
    // A mutação que a verificação achou montava a prévia da estranha com o meu
    // id, e nenhum teste ficava vermelho.
    const c = contextoDaPersona("estranha", ALVO);
    expect(c.euId).toBe(OLHO_DA_PREVIA);
    expect(c.sigo.has(ALVO)).toBe(false);
    expect(c.amigas.has(ALVO)).toBe(false);
  });

  test("a seguidora segue e não é amiga", () => {
    const c = contextoDaPersona("seguidora", ALVO);
    expect(c.sigo.has(ALVO)).toBe(true);
    expect(c.amigas.has(ALVO)).toBe(false);
  });

  test("a amiga é as duas coisas", () => {
    const c = contextoDaPersona("amiga", ALVO);
    expect(c.sigo.has(ALVO)).toBe(true);
    expect(c.amigas.has(ALVO)).toBe(true);
  });

  test("nenhuma persona nasce com bloqueio", () => {
    for (const p of ["estranha", "seguidora", "amiga"] as const) {
      expect(contextoDaPersona(p, ALVO).bloqueio.size).toBe(0);
    }
  });
});

describe("quem alcança o perfil — a régua dos DOIS lados", () => {
  test("⚠️ perfil fechado: a estranha NÃO alcança", () => {
    // Este é o furo que a verificação encontrou: `verPerfil` nunca conferia
    // `perfil_publico`, e com o uuid em mãos qualquer paciente abria qualquer
    // perfil — agora carregando semana e nome do bebê.
    expect(
      alcancaOPerfil({ perfilPublico: false, souEu: false, sigoAtivo: false, somosAmigas: false }),
    ).toBe(false);
  });

  test("perfil aberto: qualquer uma alcança", () => {
    expect(
      alcancaOPerfil({ perfilPublico: true, souEu: false, sigoAtivo: false, somosAmigas: false }),
    ).toBe(true);
  });

  test("fechar o perfil não expulsa quem já entrou", () => {
    // Fechar é impedir gente NOVA. Quem já foi aceita, e a amiga que entrou
    // pelo convite, continuam vendo.
    expect(
      alcancaOPerfil({ perfilPublico: false, souEu: false, sigoAtivo: true, somosAmigas: false }),
    ).toBe(true);
    expect(
      alcancaOPerfil({ perfilPublico: false, souEu: false, sigoAtivo: false, somosAmigas: true }),
    ).toBe(true);
  });

  test("a dona sempre alcança o próprio perfil, mesmo fechado", () => {
    expect(
      alcancaOPerfil({ perfilPublico: false, souEu: true, sigoAtivo: false, somosAmigas: false }),
    ).toBe(true);
  });

  test("⚠️ o espelho usa a MESMA régua", () => {
    // Enquanto eram duas, uma afirmava na tela a regra que a outra não aplicava
    // no servidor.
    expect(personaAlcancaOPerfil("estranha", false)).toBe(false);
    expect(personaAlcancaOPerfil("seguidora", false)).toBe(true);
    expect(personaAlcancaOPerfil("amiga", false)).toBe(true);
    expect(personaAlcancaOPerfil("estranha", true)).toBe(true);
  });
});

describe("o piso da semana", () => {
  test("⚠️ '0 semanas' não é silêncio", () => {
    // A régua promete calar quando não há o que dizer, e devolvia um número.
    // A jornada do próprio app começa na semana 1.
    expect(semanaPublica({ ...BASE, totalDias: 0 })).toBeNull();
    expect(semanaPublica({ ...BASE, totalDias: 6 })).toBeNull();
    expect(semanaPublica({ ...BASE, totalDias: 7 })).toBe("1 semana");
  });
});

describe("a aba Do bebê", () => {
  /* A tabela injetada, com a mesma forma de `babyForWeek`. */
  const tabela = (semana: number) =>
    semana < 4 || semana > 42
      ? null
      : { size: "42,4 cm", weight: "1,7 kg", fruit: "Berinjela", desc: "Já reconhece a sua voz." };
  const emoji = () => "🍆";
  const ver = (e: Partial<EntradaDoSelo>, souEu = false) =>
    bebeDoPerfil({ ...BASE, ...e }, { souEu }, tabela, emoji);

  test("com a semana pública, a visitante vê", () => {
    expect(ver({})?.fruta).toBe("Berinjela");
  });

  test("⚠️ sem a semana pública, a visitante NÃO vê — é o mesmo fato", () => {
    // Quem sabe que ela está de 28 semanas já sabe o tamanho do bebê: publicar
    // um sem o outro seria a mesma decisão tomada duas vezes.
    expect(ver({ mostrarSemana: false })).toBeNull();
  });

  test("⚠️ mas ELA sempre vê a própria aba", () => {
    // É a jornada dela, e a aba é o lugar onde ela a vê.
    expect(ver({ mostrarSemana: false }, true)?.fruta).toBe("Berinjela");
  });

  test("⚠️ Modo Cuidado cala inclusive para ela", () => {
    // Os posts continuam (são a memória dela), mas "seu bebê está do tamanho de
    // uma berinjela" no presente é o que o Modo Cuidado existe para não dizer.
    expect(ver({ emCuidado: true }, true)).toBeNull();
    expect(ver({ emCuidado: true })).toBeNull();
  });

  test("depois do parto, a aba para", () => {
    expect(ver({ nasceu: true }, true)).toBeNull();
  });

  test("⚠️ fora da faixa da tabela, cala em vez de clampar", () => {
    // `babyForWeek` responde a semana 2 com os dados da 4 e a 50 com os da 40,
    // sem avisar — a aba mostraria uma fruta que não é a dela.
    expect(ver({ totalDias: 2 * 7 }, true)).toBeNull();
    expect(ver({ totalDias: 50 * 7 }, true)).toBeNull();
    expect(ver({ totalDias: 4 * 7 }, true)?.fruta).toBe("Berinjela");
  });

  test("sem DUM, nada", () => {
    expect(ver({ totalDias: null }, true)).toBeNull();
  });
});
