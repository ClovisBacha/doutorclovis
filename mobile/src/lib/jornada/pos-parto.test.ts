import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { posChallenge } from "@/lib/daily-challenges";
import { join } from "node:path";
import {
  abreFestaDoNascimento,
  CHAVE_FEITOS_POS,
  CHAVE_FIGURINHAS_POS,
  comprimentoPorExtenso,
  coresDaSemanaDoPos,
  desafioDoPos,
  DESAFIOS_DO_POS_NO_APP,
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
  ORIENTACAO_DO_POS,
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
  test("as fases, as figurinhas e a orientação de cada semana são as mesmas", () => {
    for (const f of FASES_DO_POS) {
      expect(SITE).toContain(
        `{ n: ${f.n}, from: ${f.from}, to: ${f.to}, emoji: "${f.emoji}", name: "${f.name}" }`,
      );
    }
    for (const [semana, emoji] of Object.entries(FIGURINHAS_DO_POS))
      expect(SITE).toContain(`  ${semana}: "${emoji}",`);
    for (const [semana, texto] of Object.entries(ORIENTACAO_DO_POS))
      expect(SITE).toContain(`  ${semana}: "${texto}",`);
    expect(Object.keys(ORIENTACAO_DO_POS)).toHaveLength(12);
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

describe("os desafios do pós-parto no app", () => {
  test("os trocados ainda são, no site, o texto que foi trocado", () => {
    for (const [D, t] of Object.entries(DESAFIOS_DO_POS_NO_APP)) {
      expect(posChallenge(Number(D))?.label).toBe(t.site);
      expect(desafioDoPos(Number(D))?.label).toBe(t.app);
    }
  });

  test("nenhum desafio do app manda para tela que o app não tem", () => {
    for (let D = 7; D <= 90; D++) {
      const d = desafioDoPos(D);
      expect(d).not.toBeNull();
      expect(d!.label).not.toMatch(/Álbum\b|Diário|no Pós-parto|em Saúde/);
    }
    expect(desafioDoPos(91)).toBeNull();
  });
});
