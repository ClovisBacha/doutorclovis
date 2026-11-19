import { describe, expect, test } from "bun:test";
import {
  abrirConversa,
  depois,
  destinoNoPos,
  diaDoPosFechado,
  falaDoAlbum,
  HUMORES_DA_CONVERSA,
  HUMORES_DA_CONVERSA_NO_POS,
  menu,
  ordemDaSugestao,
  ordemNoPos,
  responder,
  responderAoHumor,
  sugestao,
  todasAsFrases,
  todasAsFrasesDoPos,
  type ContextoDaBolha,
  type Fala,
} from "~/lib/bolha/conversa";
import { HUMORES_DO_POS } from "~/lib/jornada/pos-parto";
import { CONDUTA_DO_POS } from "~/lib/jornada/regua-do-pos";

const BASE: ContextoDaBolha = {
  hora: 9,
  D: 120,
  modo: "gestacao",
  nomeDela: "Marina Costa",
  nomeDoBebe: "Helena",
  semana: 24,
  feitos: [],
  chama: 3,
};

/** O que a Bolha NUNCA diz: conduta, clínica, promessa de efeito. */
const CONDUTA =
  /\b(m[eé]dic[oa]s?|consultas?|exames?|rem[eé]dios?|medica\w*|suplement\w*|vitaminas?|dieta|sintomas?|dores?|sangr\w*|contra[cç][aã]o|contra[cç][oõ]es|press[aã]o|glicemia|diagn[oó]stic\w*|procure|deve(ria)?|precisa|tratar|trata\w*|cura\w*|previne|preven\w*|reduz\w*|melhora\w*|garant\w*|saud[aá]vel|terapia|ansiedade|depress\w*|normal é|é normal)\b/i;

describe("a Bolha guia", () => {
  test("nunca conduta, nunca promessa de efeito, nunca gênero para o bebê", () => {
    const fora = todasAsFrases().flatMap((f) => {
      const m = [
        ...(f.match(new RegExp(CONDUTA.source, "gi")) ?? []),
        ...(f.match(/\b(ele|ela|dele|dela|nele|nela)\b/gi) ?? []),
      ];
      return m.length ? [`${f} → ${m.join(", ")}`] : [];
    });
    expect(fora).toEqual([]);
  });

  test("a voz do app: sem travessão, sem emoji, sem exclamação em série", () => {
    const fora = todasAsFrases().filter(
      (f) => /—|–/.test(f) || /\p{Extended_Pictographic}/u.test(f) || /!.*!/.test(f),
    );
    expect(fora).toEqual([]);
  });

  test("sem humor marcado, ela pergunta como você está, com os humores do check-in", () => {
    const f = abrirConversa(BASE);
    expect(f.texto).toContain("Bom dia");
    expect(f.texto).toContain("Como você está hoje?");
    expect(f.respostas.map((r) => r.rotulo)).toEqual([...HUMORES_DA_CONVERSA]);
  });

  test("cansada ou enjoada, a primeira sugestão é respirar", () => {
    for (const h of ["Cansada", "Enjoada"] as const) {
      const f = responderAoHumor(BASE, h);
      expect(f.respostas[0]).toMatchObject({ tipo: "abrir", destino: "meditation" });
      expect(f.pose).toBe("dormindo");
    }
  });

  test("de manhã e bem, a aula vem primeiro; o que já foi feito não volta", () => {
    expect(responderAoHumor(BASE, "Bem").respostas[0]).toMatchObject({ destino: "aula" });
    const semAula = ordemDaSugestao({ ...BASE, humor: "Bem", feitos: ["aula"] });
    expect(semAula[0]).toBe("movement");
    expect(semAula).not.toContain("aula");
  });

  test("à noite os sons entram na lista, e com o dia cheio a Bolha comemora", () => {
    const noite = { ...BASE, hora: 22, humor: "Bem" };
    expect(ordemDaSugestao(noite)).toContain("dormir");
    const cheio = sugestao({
      ...noite,
      feitos: ["aula", "movement", "meditation", "bonding", "gratitude"],
    });
    expect(cheio.pose).toBe("comemorando");
    expect(cheio.respostas[0]).toMatchObject({ destino: "dormir" });
  });

  test("a mesma fala o dia inteiro, e outra no dia seguinte", () => {
    expect(abrirConversa(BASE).texto).toBe(abrirConversa({ ...BASE }).texto);
    const hoje = sugestao({ ...BASE, humor: "Bem" }).texto;
    const amanha = sugestao({ ...BASE, humor: "Bem", D: BASE.D + 1 }).texto;
    expect(hoje).not.toBe(amanha);
  });

  test("as respostas cabem num botão e levam a algum lugar", () => {
    const k = { ...BASE, humor: "Bem" };
    for (const f of [abrirConversa(BASE), sugestao(k), menu(k), depois(k)]) {
      for (const r of f.respostas) {
        expect(r.rotulo.length).toBeLessThanOrEqual(24);
        if (r.tipo !== "abrir") expect(responder(k, r)).not.toBeNull();
      }
    }
  });

  test("o nome do bebê vai sem artigo; sem nome, 'o bebê'", () => {
    const comNome = menu({ ...BASE, humor: "Bem" }).respostas.map((r) => r.rotulo);
    expect(comNome).toContain("Ler para Helena");
    const semNome = menu({ ...BASE, humor: "Bem", nomeDoBebe: null }).respostas.map(
      (r) => r.rotulo,
    );
    expect(semNome).toContain("Ler para o bebê");
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   O 4º trimestre
   ══════════════════════════════════════════════════════════════════════════ */

const POS: ContextoDaBolha = {
  hora: 9,
  D: 27,
  modo: "pos",
  nomeDela: "Marina",
  nomeDoBebe: "Helena",
  semana: 3,
  feitos: [],
  chama: 4,
  doPos: {
    desafio: "Tire uma selfie de vocês, do jeito que estão",
    desafioFeito: false,
    leituraFeita: false,
    formou: false,
  },
};

/** Os destinos de uma fala, já lidos como o pós os lê. */
const destinos = (f: Fala) =>
  f.respostas.flatMap((r) => (r.tipo === "abrir" ? [destinoNoPos(r.destino)] : []));

describe("a Bolha guia no 4º trimestre", () => {
  test("nenhuma fala nova é conduta: a régua do pós-parto e a da gestação, as duas", () => {
    const fora = todasAsFrasesDoPos().flatMap((f) => {
      const m = [
        ...(f.match(new RegExp(CONDUTA_DO_POS.source, "gi")) ?? []),
        ...(f.match(new RegExp(CONDUTA.source, "gi")) ?? []),
        ...(f.match(/\b(ele|ela|dele|dela|nele|nela)\b/gi) ?? []),
      ];
      return m.length ? [`${f} → ${[...new Set(m)].join(", ")}`] : [];
    });
    expect(fora).toEqual([]);
  });

  test("a voz do app no pós: sem travessão, sem emoji, sem exclamação em série, nem promessa de efeito", () => {
    const fora = todasAsFrasesDoPos().filter(
      (f) =>
        /—|–/.test(f) ||
        /\p{Extended_Pictographic}/u.test(f) ||
        /!.*!/.test(f) ||
        /\b(alivi\w*|fortalec\w*|faz bem|ajuda a|você merece|do seu lado|com carinho|um dia de cada vez)\b/i.test(
          f,
        ),
    );
    expect(fora).toEqual([]);
  });

  test("sem humor, ela pergunta com os humores do pós (Triste no lugar de Enjoada), com os emojis do check-in", () => {
    const f = abrirConversa(POS);
    expect(f.texto).toContain("Bom dia, Marina.");
    expect(f.texto).toContain("Como você está hoje?");
    expect(f.respostas.map((r) => r.rotulo)).toEqual([...HUMORES_DA_CONVERSA_NO_POS]);
    expect(f.respostas.map((r) => (r.tipo === "humor" ? r.emoji : null))).toEqual(
      HUMORES_DO_POS.map((h) => h.emoji),
    );
  });

  test("triste: a Bolha acolhe, aponta o CVV e só convida a respirar junto, sem jogo", () => {
    const f = responderAoHumor(POS, "Triste");
    expect(f.texto).toContain("CVV");
    expect(f.texto).toContain("não está sozinha");
    expect(destinos(f)).toEqual(["meditation"]);
    expect(f.respostas.some((r) => r.tipo === "menu")).toBe(false);
    /* Respirar já feito hoje: nenhum convite, só "Agora não". */
    const jaRespirou = responderAoHumor({ ...POS, feitos: ["meditation"] }, "Triste");
    expect(jaRespirou.respostas.map((r) => r.tipo)).toEqual(["depois"]);
    /* E ao voltar no mesmo dia, sem o comentário da semana ou da chama. */
    const volta = abrirConversa({ ...POS, humor: "Triste", chama: 14 });
    expect(volta.texto).toContain("Estou aqui com você.");
    expect(volta.texto).not.toMatch(/chama|seguidos|Semana \d+ de vida/);
  });

  test("de manhã e bem, o desafio do dia vem primeiro, com ele escrito na fala", () => {
    const f = responderAoHumor(POS, "Bem");
    expect(destinos(f)[0]).toBe("desafio");
    expect(f.texto).toContain("tire uma selfie de vocês, do jeito que estão.");
    expect(f.respostas[0]!.rotulo).toBe("Já fiz");
  });

  test("a ordem do pós: o que falta, sem aula nem Mexer, e os sons à noite", () => {
    const bem = { ...POS, humor: "Bem" };
    expect(ordemNoPos(bem)).toEqual(["desafio", "leitura", "bonding", "meditation", "gratitude"]);
    expect(ordemNoPos({ ...bem, hora: 22 })).toEqual([
      "leitura",
      "desafio",
      "meditation",
      "gratitude",
      "bonding",
      "dormir",
    ]);
    expect(ordemNoPos({ ...bem, humor: "Cansada" })[0]).toBe("meditation");
    const feito = {
      ...bem,
      feitos: ["bonding" as const],
      doPos: { ...POS.doPos!, desafioFeito: true },
    };
    expect(ordemNoPos(feito)).toEqual(["leitura", "meditation", "gratitude"]);
    /* Depois das 12 semanas não há tarefa: só os minutos dela. */
    const formou = { ...bem, doPos: { ...POS.doPos!, desafio: null, formou: true } };
    expect(ordemNoPos(formou)).toEqual(["bonding", "meditation", "gratitude"]);
  });

  test("a ponte: desafio e leitura viajam pelas chaves que o pós não usa, e nada chega cru", () => {
    const k = { ...POS, humor: "Bem" };
    const todas = [
      abrirConversa(k),
      menu(k),
      menu({ ...k, hora: 22 }),
      responderAoHumor(k, "Triste"),
      sugestao({ ...k, doPos: { ...POS.doPos!, desafioFeito: true, leituraFeita: true } }),
      sugestao({
        ...k,
        hora: 22,
        feitos: ["meditation", "bonding", "gratitude"],
        doPos: { ...POS.doPos!, desafioFeito: true, leituraFeita: true },
      }),
    ].flatMap(destinos);
    expect(new Set(todas)).toEqual(
      new Set(["desafio", "leitura", "bonding", "meditation", "gratitude", "dormir", "trilha"]),
    );
    expect(destinoNoPos("aula")).toBe("leitura");
    expect(destinoNoPos("movement")).toBe("desafio");
    expect(destinoNoPos("meditation")).toBe("meditation");
  });

  test("o que ela acabou de fazer, a Bolha comenta e segue para o próximo", () => {
    const f = abrirConversa({
      ...POS,
      humor: "Bem",
      doPos: { ...POS.doPos!, desafioFeito: true, recem: ["desafio"] },
    });
    expect(f.texto).toMatch(/^(Desafio feito|Feito)\./);
    expect(f.texto).not.toContain("Bom dia");
    expect(destinos(f)[0]).toBe("leitura");
  });

  test("as três tarefas fechadas: a figurinha da semana de vida, e um minuto só dela", () => {
    const fechado = {
      ...POS,
      humor: "Bem",
      doPos: { ...POS.doPos!, desafioFeito: true, leituraFeita: true },
    };
    expect(diaDoPosFechado(fechado)).toBe(true);
    expect(diaDoPosFechado({ ...fechado, humor: null })).toBe(false);
    const f = sugestao(fechado);
    expect(f.pose).toBe("comemorando");
    expect(f.texto).toContain("a figurinha da semana 3 de vida é sua");
    expect(destinos(f)[0]).toBe("bonding");
    /* Tudo feito, à noite: os sons e a trilha. */
    const tudo = sugestao({
      ...fechado,
      hora: 21,
      feitos: ["meditation", "bonding", "gratitude"],
    });
    expect(destinos(tudo)).toEqual(["dormir", "trilha"]);
  });

  test("as respostas do pós cabem num botão, e o bebê vai sem artigo", () => {
    const k = { ...POS, humor: "Bem" };
    for (const f of [abrirConversa(POS), sugestao(k), menu(k), depois(k)])
      for (const r of f.respostas) {
        expect(r.rotulo.length).toBeLessThanOrEqual(24);
        if (r.tipo !== "abrir") expect(responder(k, r)).not.toBeNull();
      }
    expect(menu(k).respostas.map((r) => r.rotulo)).toContain("Ler para Helena");
    expect(menu({ ...k, nomeDoBebe: null }).respostas.map((r) => r.rotulo)).toContain(
      "Ler para o bebê",
    );
  });

  test("a gestação não mudou: o modo do pós não vaza para lá", () => {
    expect(abrirConversa(BASE).respostas.map((r) => r.rotulo)).toEqual([...HUMORES_DA_CONVERSA]);
    expect(todasAsFrases().some((f) => /desafio de hoje|semana \d+ de vida/i.test(f))).toBe(false);
  });

  test("o álbum: a Bolha explica o colado e o vazio, sem cobrar", () => {
    expect(falaDoAlbum({ ganhas: 0, pos: false })).toContain("figurinha");
    expect(falaDoAlbum({ ganhas: 5, pos: false })).toContain("sem cobrança");
    expect(falaDoAlbum({ ganhas: 5, pos: true })).toContain("12 primeiras semanas");
  });
});
