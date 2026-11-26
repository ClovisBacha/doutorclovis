import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";
import {
  falaDaLicao,
  falaDoFimDaAula,
  falaDoNoDeHoje,
  reacaoAoHumor,
  todasAsFalasDoJogo,
  tituloDoVeredito,
} from "~/lib/bolha/falas-do-jogo";
import {
  textoDaSemanaNova,
  textoDoCuidado,
  type ContextoDoLembrete,
} from "~/lib/jornada/lembrete-da-jornada";

/**
 * A VOZ DA BOLHA NO JOGO E NOS LEMBRETES (19/11/2026). A mesma régua da
 * conversa (`conversa.test.ts`): bem-estar sem conduta e sem promessa de
 * efeito, o bebê sem gênero, e a voz do app (sem travessão, sem emoji, sem
 * exclamação em série).
 */

/** O que a Bolha NUNCA diz: conduta, clínica, promessa de efeito. */
const CONDUTA =
  /\b(m[eé]dic[oa]s?|consultas?|exames?|rem[eé]dios?|medica\w*|suplement\w*|vitaminas?|dieta|sintomas?|dores?|sangr\w*|contra[cç][aã]o|contra[cç][oõ]es|press[aã]o|glicemia|diagn[oó]stic\w*|procure|deve(ria)?|precisa|tratar|trata\w*|cura\w*|previne|preven\w*|reduz\w*|melhora\w*|garant\w*|saud[aá]vel|terapia|ansiedade|depress\w*|alivi\w*|fortalec\w*|agradece|normal é|é normal)\b/i;

const foraDaRegua = (frases: string[]) =>
  frases.flatMap((f) => {
    const m = [
      ...(f.match(new RegExp(CONDUTA.source, "gi")) ?? []),
      ...(f.match(/\b(ele|ela|dele|dela|nele|nela)\b/gi) ?? []),
      ...(/—|–/.test(f) ? ["travessão"] : []),
      ...(/\p{Extended_Pictographic}/u.test(f) ? ["emoji"] : []),
      ...(/!.*!/.test(f) ? ["exclamação em série"] : []),
    ];
    return m.length ? [`${f} → ${m.join(", ")}`] : [];
  });

/* Terça, 20 de outubro de 2026, 15:00. */
const AGORA = new Date(2026, 9, 20, 15, 0);
const ctx = (extra: Partial<ContextoDoLembrete> = {}): ContextoDoLembrete => ({
  agora: AGORA,
  modo: "gestacao",
  D: 171,
  semana: 24,
  diaNaSemana: 3,
  nomeDoBebe: "Helena",
  chama: 0,
  feitosHoje: 0,
  totalDoDia: 5,
  desafio: (D) => (D % 2 === 0 ? "um desafio" : null),
  aula: (D) => (D % 5 === 0 ? null : "Como vamos dividir o cuidado"),
  ...extra,
});

function todosOsLembretes(): string[] {
  const fora = new Set<string>();
  const contextos = [
    ctx(),
    ctx({ chama: 9 }),
    ctx({ feitosHoje: 1 }),
    ctx({ feitosHoje: 4 }),
    ctx({ nomeDoBebe: null, aula: () => null }),
    ctx({ modo: "pos", D: 27, idadeDias: 20, totalDoDia: 3 }),
    ctx({ modo: "pos", D: 27, idadeDias: 20, totalDoDia: 3, chama: 4 }),
    ctx({ modo: "pos", D: 27, idadeDias: 20, totalDoDia: 3, feitosHoje: 2 }),
    ctx({ modo: "pos", D: 97, idadeDias: 90, totalDoDia: 3 }),
    ctx({ modo: "sem-data", D: null }),
    ctx({ modo: "cuidado", nomeDoBebe: null }),
  ];
  for (const c of contextos) {
    for (let mais = 0; mais < 14; mais++) {
      const t = textoDoCuidado(c, mais);
      fora.add(t.titulo);
      fora.add(t.corpo);
      const s = textoDaSemanaNova(c, mais);
      if (s) fora.add(s.titulo);
    }
  }
  return [...fora];
}

describe("a voz da Bolha no jogo", () => {
  test("nunca conduta, nunca promessa de efeito, nunca gênero para o bebê, e a voz do app", () => {
    expect(foraDaRegua(todasAsFalasDoJogo())).toEqual([]);
  });

  test("o balão do nó de hoje acompanha o dia", () => {
    expect(falaDoNoDeHoje({ feitos: 0, total: 5, fechado: false }).texto).toBe("Vamos começar?");
    expect(falaDoNoDeHoje({ feitos: 2, total: 5, fechado: false }).texto).toBe("Bora continuar?");
    expect(falaDoNoDeHoje({ feitos: 4, total: 5, fechado: false }).texto).toBe("Falta só um!");
    expect(falaDoNoDeHoje({ feitos: 2, total: 3, fechado: false }).texto).toBe("Falta só um!");
    expect(falaDoNoDeHoje({ feitos: 5, total: 5, fechado: true })).toEqual({
      texto: "Dia completo!",
      pose: "comemorando",
    });
    /* O balão cabe numa linha em cima do nó. */
    for (let feitos = 0; feitos <= 5; feitos++)
      expect(falaDoNoDeHoje({ feitos, total: 5, fechado: false }).texto.length).toBeLessThan(18);
  });

  test("a reação ao humor é curta e nunca interpreta o que ela sente", () => {
    for (const h of ["Ótima", "Bem", "Normal", "Cansada", "Enjoada"]) {
      const r = reacaoAoHumor(h).texto;
      expect(r.length).toBeLessThanOrEqual(36);
      expect(r).toMatch(/Anot/);
    }
  });

  test("a lição avisa as regras da aula, com o número certo de perguntas", () => {
    for (let D = 0; D < 3; D++) {
      expect(falaDaLicao({ D, total: 5, semana: 24 })).toContain("5 perguntas");
      expect(falaDaLicao({ D, total: 5, semana: 24 })).toMatch(/uma chance em cada/);
      expect(falaDaLicao({ D, total: 1, semana: 24 })).toContain("uma pergunta");
    }
  });

  test("o veredito é só o veredito (o Duolingo), e muda de uma pergunta para a outra", () => {
    /* 23/11/2026, o dono: "as certas estão em verde" é óbvio — sai; o porquê
       fica atrás do botão "Explicar o erro". */
    for (const multi of [false, true])
      for (let indice = 0; indice < 5; indice++) {
        const t = tituloDoVeredito({ acertou: false, multi, indice, D: 0 });
        expect(t).not.toMatch(/verde|certa|certas/i);
        expect(t.length).toBeLessThanOrEqual(22);
      }
    const titulos = [0, 1, 2].map((indice) =>
      tituloDoVeredito({ acertou: true, multi: false, indice, D: 7 }),
    );
    expect(new Set(titulos).size).toBe(3);
  });

  test("zerando a aula, a Bolha agradece e não comenta o resultado", () => {
    const zero = falaDoFimDaAula({ acertos: 0, total: 5, D: 3 });
    expect(zero).toMatch(/Obrigada/);
    expect(zero).not.toMatch(/err|acert|escap|quase/i);
    expect(falaDoFimDaAula({ acertos: 4, total: 5, D: 3 })).toMatch(/escapou/);
  });
});

describe("a voz da Bolha nos lembretes", () => {
  test("nenhum lembrete com conduta, promessa, emoji, travessão ou 'o bebê agradece'", () => {
    expect(foraDaRegua(todosOsLembretes())).toEqual([]);
  });

  test("a Bolha assina o lembrete do dia na gestação, e nunca no Modo Cuidado", () => {
    const dias = Array.from({ length: 6 }, (_, mais) => textoDoCuidado(ctx(), mais));
    expect(dias.some((t) => /Bolha/.test(t.titulo))).toBe(true);
    expect(dias.every((t) => /\b(eu|comigo|te espero)\b/i.test(`${t.titulo} ${t.corpo}`))).toBe(
      true,
    );
    for (let mais = 0; mais < 6; mais++) {
      const t = textoDoCuidado(ctx({ modo: "cuidado", nomeDoBebe: null }), mais);
      expect(`${t.titulo} ${t.corpo}`).not.toMatch(/Bolha/);
    }
  });
});

describe("a Bolha nas telas do jogo (catraca do fonte)", () => {
  const RAIZ = join(import.meta.dir, "..", "..");
  const fonte = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), "utf8"));

  test("a trilha: o nó de hoje e a pergunta do humor falam pela Bolha", () => {
    const caminho = fonte("componentes", "caminho", "caminho.tsx");
    expect(caminho).toMatch(/falaDoNoDeHoje\(/);
    expect(caminho).toMatch(/PERGUNTA_DO_HUMOR/);
    expect(caminho).toMatch(/reacaoAoHumor\(/);
    expect(caminho).not.toMatch(/"Começar"|"Continuar"|"Dia completo"/);
    expect(fonte("componentes", "caminho", "caminho-pos.tsx")).toMatch(/falaDoNoDeHoje\(/);
    /* O balão do nó é a Bolha falando: a arte dela mora nele. */
    expect(fonte("componentes", "caminho", "blocos.tsx")).toMatch(/BOLHA\[/);
  });

  test("a aula: a abertura, a lição, o veredito e o fim são falas da Bolha", () => {
    const aula = fonte("app", "jornada", "aula.tsx");
    expect(aula).toMatch(/falaDaLicao\(/);
    expect(aula).toMatch(/tituloDoVeredito\(/);
    /* O porquê mora atrás de um botão, como no Duolingo (23/11/2026). */
    expect(aula).toContain('"Explicar o erro"');
    expect(aula).toMatch(/explicando \? \(/);
    expect(aula).toMatch(/falaDoFimDaAula\(/);
    expect(aula).toMatch(/AULA_JA_FEITA/);
    const abertura = fonte("componentes", "jornada", "abertura-da-aula.tsx");
    expect(abertura).toMatch(/ABERTURA_DA_AULA/);
    expect(abertura).toMatch(/<Bolha /);
    /* Nada atrás da Bolha: os anéis da moeda saíram junto com ela. */
    expect(abertura).not.toMatch(/Moeda3D|estiloDoAnel/);
  });

  test("a festa do fim: a Bolha fala no balão, e nada brilha atrás dela", () => {
    const fim = fonte("componentes", "jornada", "fim.tsx");
    expect(fim).toMatch(/FALA_DO_DIA_COMPLETO/);
    expect(fim).toMatch(/<FalaDaBolha /);
    expect(fim).not.toMatch(/<Brilho /);
    expect(fim).not.toMatch(/Momentos de hoje|momentos de hoje/);
  });
});
