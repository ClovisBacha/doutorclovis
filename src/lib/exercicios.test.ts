/**
 * OS EXERCÍCIOS — a régua que decide o que ela recebe hoje.
 *
 * O que havia antes: `day % 9`. Uma gestante de 8 semanas e uma de 39 recebiam
 * o mesmo trio, e quem estava com ciática recebia "rolar os ombros" porque era
 * terça. Estes testes cobram as três coisas que mudaram isso: a queixa manda,
 * a fase filtra, e o assoalho pélvico entra mesmo sem ninguém pedir.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  DURACOES_EXERCICIO,
  MOVIMENTOS,
  SINAIS_DE_PARADA,
  SINTOMAS,
  elegiveis,
  fasePara,
  quantosCabem,
  sessaoDoDia,
  type Sintoma,
} from "./exercicios";

describe("o catálogo", () => {
  test("todo movimento está inteiro — nada de campo faltando", () => {
    for (const m of MOVIMENTOS) {
      expect({
        id: m.id,
        ok:
          m.name.length > 3 &&
          m.cue.length > 10 &&
          m.passos.length >= 3 &&
          m.sentir.length > 8 &&
          m.parar.length > 8 &&
          m.secs >= 25 &&
          m.fases.length > 0,
      }).toEqual({ id: m.id, ok: true });
    }
  });

  test("nenhum id repetido", () => {
    const ids = MOVIMENTOS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("cresceu de nove para mais de vinte", () => {
    /* Com nove, uma semana de uso repetia tudo três vezes. */
    expect(MOVIMENTOS.length).toBeGreaterThanOrEqual(24);
  });

  test("⚠️ todo sintoma da lista tem pelo menos dois movimentos", () => {
    /* Uma queixa oferecida na tela e sem resposta é pior que não oferecer:
       ela toca, e o app entrega o mesmo de sempre. */
    for (const s of SINTOMAS) {
      const n = MOVIMENTOS.filter((m) => m.alivia.includes(s.chave)).length;
      expect({ sintoma: s.chave, n: n >= 2 }).toEqual({ sintoma: s.chave, n: true });
    }
  });

  test("todo `parar` diz o sinal DAQUELE movimento, não um genérico", () => {
    /* "Pare se sentir desconforto" todo mundo pula. */
    for (const m of MOVIMENTOS) {
      expect({ id: m.id, generico: /^se sentir desconforto/i.test(m.parar) }).toEqual({
        id: m.id,
        generico: false,
      });
    }
  });
});

describe("⚠️ o assoalho pélvico, que era o buraco clínico", () => {
  test("existe, e são três habilidades diferentes", () => {
    /* Segurar, responder rápido e SOLTAR. A terceira é a que ninguém ensina e
       a que o parto pede. */
    const a = MOVIMENTOS.filter((m) => m.tipo === "assoalho");
    expect(a.length).toBeGreaterThanOrEqual(3);
    expect(a.some((m) => /soltar/i.test(m.name))).toBe(true);
  });

  test("entra em TODA sessão de 5 min ou mais, mesmo sem ela pedir", () => {
    /* Ninguém acorda com dor no assoalho pélvico: ele previne o que ainda não
       dói, e por isso nunca seria escolhido numa lista de queixas. */
    for (const minutos of [5, 10] as const) {
      for (const dia of [0, 1, 2, 3, 7, 30]) {
        const s = sessaoDoDia({ dia, minutos, semana: 24 });
        expect({ minutos, dia, tem: s.some((m) => m.tipo === "assoalho") }).toEqual({
          minutos,
          dia,
          tem: true,
        });
      }
    }
  });

  test("na sessão de 2 minutos ele NÃO entra", () => {
    /* Dois minutos é o "não tenho tempo hoje": ali cabe o alívio da queixa, e
       o assoalho pélvico ficaria pela metade. */
    const s = sessaoDoDia({ dia: 0, minutos: 2, semana: 24, sintoma: "lombar" });
    expect(s.every((m) => m.tipo !== "assoalho")).toBe(true);
  });
});

describe("a queixa manda na sequência", () => {
  test("o que alivia a queixa vem PRIMEIRO", () => {
    for (const s of SINTOMAS) {
      const seq = sessaoDoDia({ dia: 3, minutos: 5, semana: 24, sintoma: s.chave });
      expect({ sintoma: s.chave, primeiro: seq[0]?.alivia.includes(s.chave) }).toEqual({
        sintoma: s.chave,
        primeiro: true,
      });
    }
  });

  test("sem queixa, gira pelo dia — dois dias seguidos não são iguais", () => {
    const a = sessaoDoDia({ dia: 1, minutos: 5, semana: 24 }).map((m) => m.id);
    const b = sessaoDoDia({ dia: 2, minutos: 5, semana: 24 }).map((m) => m.id);
    expect(a).not.toEqual(b);
  });

  test("o mesmo pedido dá a mesma sessão", () => {
    const a = sessaoDoDia({ dia: 5, minutos: 5, semana: 30, sintoma: "lombar" });
    const b = sessaoDoDia({ dia: 5, minutos: 5, semana: 30, sintoma: "lombar" });
    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
  });

  test("nenhum movimento se repete dentro da mesma sessão", () => {
    for (const minutos of DURACOES_EXERCICIO) {
      for (const s of [null, ...SINTOMAS.map((x) => x.chave)] as (Sintoma | null)[]) {
        const ids = sessaoDoDia({ dia: 4, minutos, semana: 20, sintoma: s }).map((m) => m.id);
        expect({ minutos, s, unicos: new Set(ids).size === ids.length }).toEqual({
          minutos,
          s,
          unicos: true,
        });
      }
    }
  });

  test("a sessão nunca sai vazia, em nenhuma combinação", () => {
    for (const semana of [6, 14, 24, 30, 36, 39, 41]) {
      for (const posParto of [false, true]) {
        for (const minutos of DURACOES_EXERCICIO) {
          const n = sessaoDoDia({ dia: 0, minutos, semana, posParto }).length;
          expect({ semana, posParto, minutos, n: n > 0 }).toEqual({
            semana,
            posParto,
            minutos,
            n: true,
          });
        }
      }
    }
  });
});

describe("a fase filtra, e o fim da gestação acrescenta", () => {
  test("as bordas dos trimestres", () => {
    expect(fasePara(13, false)).toBe("t1");
    expect(fasePara(14, false)).toBe("t2");
    expect(fasePara(27, false)).toBe("t2");
    expect(fasePara(28, false)).toBe("t3");
    expect(fasePara(36, false)).toBe("parto");
    expect(fasePara(20, true)).toBe("pos");
    expect(fasePara(null, false)).toBe("t2");
  });

  test("⚠️ a fase de parto ACRESCENTA, não substitui a t3", () => {
    /* Uma fase que trocasse a lista inteira faria a mulher de 38 semanas
       perder o alívio de lombar justamente quando ele mais dói. */
    const s = elegiveis("parto", 38, false);
    expect(s.some((m) => m.tipo === "parto")).toBe(true);
    expect(s.some((m) => m.alivia.includes("lombar"))).toBe(true);
  });

  test("preparação de parto NÃO aparece antes da hora", () => {
    const cedo = elegiveis("t1", 10, false);
    expect(cedo.filter((m) => m.tipo === "parto")).toEqual([]);
  });

  test("⚠️ chão sai a partir da 37ª e no pós-parto", () => {
    /* Levantar do chão com 39 semanas, ou três dias depois de uma cesárea, é o
       esforço — não o alívio. */
    expect(elegiveis("parto", 38, false).filter((m) => m.chao)).toEqual([]);
    expect(elegiveis("pos", null, true).filter((m) => m.chao)).toEqual([]);
    expect(elegiveis("t2", 24, false).some((m) => m.chao)).toBe(true);
  });

  test("o pós-parto recebe o que é dele, e não o resto", () => {
    const s = elegiveis("pos", null, true);
    expect(s.some((m) => m.id === "respiracao-diafragma")).toBe(true);
    expect(s.some((m) => m.id === "ativar-transverso")).toBe(true);
    expect(s.filter((m) => m.tipo === "parto")).toEqual([]);
  });
});

describe("o tempo pedido é o tempo entregue", () => {
  test("cabe no que ela escolheu, com folga de troca", () => {
    for (const minutos of DURACOES_EXERCICIO) {
      const s = sessaoDoDia({ dia: 0, minutos, semana: 24 });
      const total = s.reduce((soma, m) => soma + m.secs + 6, 0);
      expect({ minutos, total, cabe: total <= minutos * 60 + 6 }).toEqual({
        minutos,
        total,
        cabe: true,
      });
    }
  });

  test("dois minutos entregam mais que um movimento", () => {
    expect(sessaoDoDia({ dia: 0, minutos: 2, semana: 24 }).length).toBeGreaterThanOrEqual(2);
  });

  test("dez minutos entregam bem mais que dois", () => {
    const curta = sessaoDoDia({ dia: 0, minutos: 2, semana: 24 }).length;
    const longa = sessaoDoDia({ dia: 0, minutos: 10, semana: 24 }).length;
    expect(longa).toBeGreaterThan(curta * 2);
  });

  test("quantosCabem nunca devolve zero", () => {
    expect(quantosCabem(MOVIMENTOS, 1)).toBeGreaterThanOrEqual(1);
    expect(quantosCabem([], 10)).toBe(1);
  });
});

describe("⚠️ os sinais de parada", () => {
  test("são os que mandam parar de verdade", () => {
    const t = SINAIS_DE_PARADA.join(" ").toLowerCase();
    for (const sinal of ["sangramento", "líquido", "contrações", "tontura"]) {
      expect({ sinal, tem: t.includes(sinal) }).toEqual({ sinal, tem: true });
    }
  });

  test("a tela mostra ANTES, e não como um 'li e aceito'", () => {
    const fonte = readFileSync("src/components/gestacao-path.tsx", "utf8");
    const escolha = fonte.slice(
      fonte.indexOf('{phase === "escolha" && ('),
      fonte.indexOf('{phase === "active" && cur && ('),
    );
    expect(escolha).toContain("SINAIS_DE_PARADA.map");
    expect(escolha).toContain("Hoje não é dia de exercício se você tiver");
    /* Nenhuma caixa de marcar: uma pergunta que exige um toque para prosseguir
       vira um toque automático na terceira vez. */
    expect(escolha).not.toContain('type="checkbox"');
  });
});

describe("a tela do exercício", () => {
  const fonte = readFileSync("src/components/gestacao-path.tsx", "utf8");

  test("o relógio para quando ela pausa, e o anel congela junto", () => {
    expect(fonte).toContain('if (phase !== "active" || pausado) return;');
    expect(fonte).toContain(
      'style={{ transition: pausado ? "none" : "stroke-dashoffset 1s linear" }}',
    );
  });

  test("a voz não fala por cima da pausa", () => {
    expect(fonte).toContain('if (phase !== "active" || pausado || !voz || !seq[idx]) return;');
  });

  test("⚠️ o desfecho vai para o diário SEM humor", () => {
    /* `mood` alimenta a curva emocional dela e o cérebro da IA. "Piorou" aqui
       é sobre uma dor nas costas — carimbar isso como humor faria a curva
       despencar por causa de uma lombalgia. */
    const fn = fonte.slice(
      fonte.indexOf("async function registrarExercicio("),
      fonte.indexOf("async function registrarHumorDaMeditacao("),
    );
    expect(fn).toContain("journal_entries");
    expect(fn).not.toContain("mood:");
  });

  test("a pergunta do fim só aparece quando houve queixa", () => {
    /* Sem queixa não há o que comparar, e perguntar "melhorou?" sobre nada é
       ruído. */
    expect(fonte).toContain('{sintoma ? "E agora, como está?" : "Terminou!"}');
  });
});

describe("toda pose usada tem desenho", () => {
  test("nenhum movimento fica sem figura", () => {
    /* Uma pose sem desenho renderiza um SVG vazio: a paciente vê um buraco no
       anel do cronômetro e não tem como saber o que fazer com o corpo. */
    const fig = readFileSync("src/components/figura-movimento.tsx", "utf8");
    const poses = new Set(MOVIMENTOS.map((m) => m.pose));
    for (const p of poses) {
      expect({ pose: p, desenha: fig.includes(`pose === "${p}" ?`) }).toEqual({
        pose: p,
        desenha: true,
      });
    }
  });

  test("as duas poses novas existem e são deitada/parede", () => {
    const fig = readFileSync("src/components/figura-movimento.tsx", "utf8");
    expect(fig).toContain("function Deitada(");
    expect(fig).toContain("function Parede(");
    /* A deitada usa o quadro horizontal, como o quatro apoios — no quadro em
       pé ela encolheria pela metade. */
    expect(fig).toContain('pose === "quatro" || pose === "deitada"');
  });
});
