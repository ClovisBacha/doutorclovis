import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { primeiraFrase } from "~/lib/jornada/lembrete-da-jornada";
import {
  abreFestaDoNascimento,
  CHAVE_FEITOS_POS,
  CHAVE_FIGURINHAS_POS,
  comprimentoPorExtenso,
  coresDaSemanaDoPos,
  desafioDoPos,
  DESAFIOS_DO_POS,
  diaNaTrilhaDoPos,
  estadoDoNoDoPos,
  FASES_DO_POS,
  faseDoPos,
  fecharDiasDoPosCompletos,
  FIGURINHAS_DO_POS,
  formou,
  humorPedeApoio,
  lerComprimentoDigitado,
  lerHoraDigitada,
  mascaraDeHora,
  lerNascimento,
  lerPesoDigitado,
  medidasPorExtenso,
  nascimentoPorExtenso,
  marcarTarefaDoPos,
  NESTA_SEMANA_DO_POS,
  nestaSemanaDoPos,
  pesoPorExtenso,
  recusaDoNascimento,
  resumoDaGestacao,
  semanaDeVida,
} from "~/lib/jornada/pos-parto";

const SITE = readFileSync(
  join(import.meta.dir, "..", "..", "..", "..", "src", "components", "gestacao-path.tsx"),
  "utf8",
);

describe("o 4º trimestre do app é o do site", () => {
  test("as fases e as figurinhas de cada semana são as mesmas", () => {
    for (const f of FASES_DO_POS) {
      expect(SITE).toContain(
        `{ n: ${f.n}, from: ${f.from}, to: ${f.to}, emoji: "${f.emoji}", name: "${f.name}" }`,
      );
    }
    for (const [semana, emoji] of Object.entries(FIGURINHAS_DO_POS))
      expect(SITE).toContain(`  ${semana}: "${emoji}",`);
  });

  test("as cores das semanas são as do posMeta", () => {
    expect(SITE).toContain('return { main: "#38bdf8", lip: "#0369a1"');
    expect(coresDaSemanaDoPos(2).main).toBe("#38bdf8");
    expect(coresDaSemanaDoPos(6).main).toBe("#8b5cf6");
    expect(coresDaSemanaDoPos(11).lip).toBe("#047857");
  });
});

describe("o dia e a semana do pós-parto", () => {
  test("D = idade + 7, presa nas 12 semanas; depois delas, formou", () => {
    expect(diaNaTrilhaDoPos(0)).toBe(7);
    expect(diaNaTrilhaDoPos(20)).toBe(27);
    expect(diaNaTrilhaDoPos(83)).toBe(90);
    expect(diaNaTrilhaDoPos(200)).toBe(90);
    expect(formou(83)).toBe(false);
    expect(formou(84)).toBe(true);
    expect(semanaDeVida(7)).toBe(1);
    expect(semanaDeVida(27)).toBe(3);
    expect(semanaDeVida(90)).toBe(12);
    expect(faseDoPos(6).name).toBe("Criando ritmo");
  });
});

describe("as três tarefas fecham o dia", () => {
  test("humor, desafio e leitura: na terceira, o dia fecha e a semana ganha a figurinha", () => {
    let b = marcarTarefaDoPos({}, 27, "humor").blob;
    const r1 = marcarTarefaDoPos(b, 27, "desafio");
    expect(r1.fechouAgora).toBe(false);
    b = r1.blob;
    const r2 = marcarTarefaDoPos(b, 27, "leitura");
    expect(r2.fechouAgora).toBe(true);
    expect(r2.figurinhaNova).toBe(3);
    expect(r2.blob[CHAVE_FEITOS_POS]).toEqual([27]);
    expect(r2.blob[CHAVE_FIGURINHAS_POS]).toEqual([3]);
    /* Marcar de novo não muda nada. */
    const r3 = marcarTarefaDoPos(r2.blob, 27, "leitura");
    expect(r3.jaEstava).toBe(true);
    expect(r3.blob).toBe(r2.blob);
  });

  test("a segunda semana fechada não ganha figurinha de novo; atividades não contam", () => {
    let b: Record<string, unknown> = {
      "dc-path-pos-day-28": { humor: true, desafio: true, w_meditation: true, w_gratitude: true },
      [CHAVE_FIGURINHAS_POS]: [4],
    };
    expect(estadoDoNoDoPos(b, 28, 30)).toEqual({ tipo: "passado", tarefas: 2, fechado: false });
    const r = marcarTarefaDoPos(b, 28, "leitura");
    expect(r.fechouAgora).toBe(true);
    expect(r.figurinhaNova).toBeNull();
    b = r.blob;
    expect(estadoDoNoDoPos(b, 28, 28)).toEqual({ tipo: "hoje", tarefas: 3, fechado: true });
    expect(estadoDoNoDoPos(b, 31, 28)).toEqual({ tipo: "futuro" });
  });

  test("o dia que completou na mescla (site + app) fecha ao puxar", () => {
    const b = {
      "dc-path-pos-day-15": { humor: true, desafio: true, leitura: true },
      "dc-path-pos-day-16": { humor: true },
      [CHAVE_FEITOS_POS]: [10],
    };
    const r = fecharDiasDoPosCompletos(b);
    expect(r.fechados).toEqual([15]);
    expect(r.blob[CHAVE_FEITOS_POS]).toEqual([10, 15]);
    expect(r.blob[CHAVE_FIGURINHAS_POS]).toEqual([2]);
    expect(fecharDiasDoPosCompletos(r.blob).blob).toBe(r.blob);
  });
});

describe("o nascimento", () => {
  const HOJE = new Date(2026, 9, 20, 15, 0);

  test("a data não pode ser no futuro nem de mais de ~14 meses atrás", () => {
    expect(recusaDoNascimento("2026-10-20", HOJE)).toBeNull();
    expect(recusaDoNascimento("2026-10-21", HOJE)).toBe("futuro");
    expect(recusaDoNascimento("2025-09-01", HOJE)).toBeNull();
    expect(recusaDoNascimento("2025-08-01", HOJE)).toBe("antiga");
  });

  test("o blob guarda a data e, se ela quiser, hora, peso e comprimento plausíveis", () => {
    expect(lerNascimento({ date: "2026-10-18", hora: "6:42", pesoG: 3250, cm: 48.5 })).toEqual({
      date: "2026-10-18",
      hora: "6:42",
      pesoG: 3250,
      cm: 48.5,
    });
    expect(lerNascimento({ date: "2026-10-18", pesoG: 32500, cm: 485 })).toEqual({
      date: "2026-10-18",
    });
    expect(lerNascimento(null)).toBeNull();
    expect(lerNascimento({ date: "18/10/2026" })).toBeNull();
    expect(pesoPorExtenso(3250)).toBe("3.250 g");
    expect(comprimentoPorExtenso(48.5)).toBe("48,5 cm");
    expect(comprimentoPorExtenso(50)).toBe("50 cm");
  });

  test("a festa abre uma vez, até 30 dias depois, e nunca no Modo Cuidado", () => {
    expect(abreFestaDoNascimento({ idadeDias: 0, festejado: false, cuidado: false })).toBe(true);
    expect(abreFestaDoNascimento({ idadeDias: 0, festejado: true, cuidado: false })).toBe(false);
    expect(abreFestaDoNascimento({ idadeDias: 0, festejado: false, cuidado: true })).toBe(false);
    expect(abreFestaDoNascimento({ idadeDias: 31, festejado: false, cuidado: false })).toBe(false);
  });

  test("o resumo da gestação conta os dias de cinco estrelas e as figurinhas", () => {
    expect(
      resumoDaGestacao({ "dc-path-done-days": [8, 9, 10], "dc-path-stickers": [1, 2] }),
    ).toEqual({ diasCompletos: 3, figurinhas: 2 });
  });

  test("só 'Triste' abre o cartão de apoio", () => {
    expect(humorPedeApoio("Triste")).toBe(true);
    expect(humorPedeApoio("Cansada")).toBe(false);
    expect(humorPedeApoio(null)).toBe(false);
  });

  test("a chegada por extenso e as medidas que ela contou", () => {
    expect(nascimentoPorExtenso({ date: "2026-10-18", hora: "6:42" })).toBe(
      "18 de outubro de 2026 · 6:42",
    );
    expect(nascimentoPorExtenso({ date: "2026-01-03" })).toBe("3 de janeiro de 2026");
    expect(medidasPorExtenso({ date: "2026-10-18", pesoG: 3250, cm: 48.5 })).toBe(
      "3.250 g · 48,5 cm",
    );
    expect(medidasPorExtenso({ date: "2026-10-18", cm: 50 })).toBe("50 cm");
    expect(medidasPorExtenso({ date: "2026-10-18" })).toBeNull();
  });

  test("o peso e o comprimento como ela digita", () => {
    expect(lerPesoDigitado("3250")).toBe(3250);
    expect(lerPesoDigitado("3.250")).toBe(3250);
    expect(lerPesoDigitado("3250 g")).toBe(3250);
    expect(lerPesoDigitado("3,25")).toBe(3250);
    expect(lerPesoDigitado("3.25 kg")).toBe(3250);
    expect(lerPesoDigitado("2,8")).toBe(2800);
    expect(lerPesoDigitado("32500")).toBeNull();
    expect(lerPesoDigitado("")).toBeNull();
    expect(lerComprimentoDigitado("48,5")).toBe(48.5);
    expect(lerComprimentoDigitado("50 cm")).toBe(50);
    expect(lerComprimentoDigitado("485")).toBeNull();
  });

  test("a hora do nascimento como ela digita", () => {
    expect(mascaraDeHora("0642")).toBe("06:42");
    expect(mascaraDeHora("06")).toBe("06");
    expect(mascaraDeHora("06:4")).toBe("06:4");
    expect(lerHoraDigitada("06:42")).toBe("6:42");
    expect(lerHoraDigitada("0642")).toBe("6:42");
    expect(lerHoraDigitada("23:59")).toBe("23:59");
    expect(lerHoraDigitada("24:00")).toBeNull();
    expect(lerHoraDigitada("6:4")).toBeNull();
  });
});

/* O que o desafio e o texto da semana não dizem (21/10/2026: rede social +
   gamificação, não conselho médico) — o roteiro clínico do site, palavra por
   palavra: mamadas, lóquios, coto, vacinas, consulta puerperal, contracepção,
   "marcos esperados". "Banho" entra só como o do bebê: um banho sem pressa é
   gentileza com ela. */
const CONDUTA =
  /\b(m[eé]dic[oa]s?|pediatra|consultas?|exames?|vacinas?|rem[eé]dios?|suplement\w*|vitaminas?|puerp\w*|amament\w*|mamadas?|mamar|peito|leite|pega|mamilos?|ordenh\w*|mastite|mamadeiras?|banho (do|no) beb[eê]|dar banho|coto|umbig\w*|c[oó]licas?|febre|icter[ií]cia|chupeta|ber[cç]o|cadeirinha|bru[cç]os|teste do \w+|l[oó]quios?|sangr\w*|pontos|cicatriz\w*|assoalho|p[eé]lvic\w*|abd[oô]m\w*|contracep\w*|anticoncep\w*|exerc[ií]cios?|treinar|treino|liberad[oa]|liberou|recupera\w*|baby blues|depress\w*|ansiedade|tristeza|psic[oó]\w*|terapia|procure|diagn[oó]stic\w*|ferro|nutri\w*|dieta|hidrat\w*|dormir|durma|sono|soneca|cochil\w*|acalm\w*|ninar|normal|esperad[oa]s?|deveria|desenvolvimento|peso|gramas?|quilos?)\b/i;

const TODOS_OS_TEXTOS = [
  ...Object.entries(DESAFIOS_DO_POS).map(([D, d]) => [`D${D}`, d.label] as const),
  ...Object.entries(NESTA_SEMANA_DO_POS).map(([s, t]) => [`semana ${s}`, t] as const),
];

describe("os desafios e o texto da semana do pós-parto são do app", () => {
  test("um desafio por dia de 7 a 90, curto, com emoji, sem repetir e sem o mesmo emoji em dias seguidos", () => {
    expect(Object.keys(DESAFIOS_DO_POS).map(Number)).toEqual(
      Array.from({ length: 84 }, (_, i) => i + 7),
    );
    expect(desafioDoPos(6)).toBeNull();
    expect(desafioDoPos(91)).toBeNull();
    const vistos = new Set<string>();
    for (let D = 7; D <= 90; D++) {
      const d = desafioDoPos(D)!;
      expect(d.emoji.trim()).not.toBe("");
      expect(d.label.length).toBeLessThanOrEqual(50);
      const chave = d.label
        .toLowerCase()
        .replace(/[^\p{L}\p{N} ]/gu, "")
        .trim();
      expect(vistos.has(chave)).toBe(false);
      vistos.add(chave);
      if (D > 7) expect(d.emoji).not.toBe(desafioDoPos(D - 1)!.emoji);
    }
  });

  test("o texto de cada semana: até 200 caracteres, sem emoji, e a primeira frase diz algo sozinha", () => {
    /* A primeira frase vira o corpo do aviso da semana nova ("Helena completa
       3 semanas 💜"): "Terceira semana." sozinha não diria nada. */
    expect(Object.keys(NESTA_SEMANA_DO_POS).map(Number)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
    for (let s = 1; s <= 12; s++) {
      const t = nestaSemanaDoPos(s);
      expect(t.length).toBeLessThanOrEqual(200);
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(primeiraFrase(t).split(/\s+/).length).toBeGreaterThanOrEqual(6);
    }
    expect(nestaSemanaDoPos(13)).toBe(nestaSemanaDoPos(12));
  });

  test("nenhum desafio nem texto da semana é conduta, dá gênero ao bebê ou manda para tela que o app não tem", () => {
    const fora = TODOS_OS_TEXTOS.flatMap(([onde, t]) => {
      const m = [
        ...(t.match(new RegExp(CONDUTA.source, "gi")) ?? []),
        ...(t.match(/\b(ele|ela|dele|dela|nele|nela)\b/gi) ?? []),
        ...(t.match(
          /Álbum\b|Diário|no Pós-parto|em Saúde|Alertas|Consultas|Meditações|Bem-estar/g,
        ) ?? []),
      ];
      return m.length ? [`${onde}: ${[...new Set(m)].join(", ")}`] : [];
    });
    expect(fora).toEqual([]);
  });

  test("o app de verdade: post se reage (não se curte) e o cartão não mostra quantos comentários tem", () => {
    const fora = TODOS_OS_TEXTOS.filter(([, t]) =>
      /\bcurt\w*\b[^.]{0,20}\bposts?\b|sem coment[aá]rios?/i.test(t),
    ).map(([onde]) => onde);
    expect(fora).toEqual([]);
  });
});
