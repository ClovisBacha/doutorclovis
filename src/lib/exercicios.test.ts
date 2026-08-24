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
  NOTA_LIMITE,
  ORDEM_DAS_POSES,
  SINAIS_DE_PARADA,
  SINTOMAS,
  ajustarNotas,
  elegiveis,
  fasePara,
  ordenarPorPosicao,
  poseEmbaixo,
  quantosCabem,
  sessaoDoDia,
  trocasDePosicao,
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

  test("⚠️ e em TODA fase — a lista de queixas é a mesma da 6ª à 40ª semana", () => {
    /* O teste acima olhava o catálogo inteiro e passava; a paciente vive numa
       fase só. "Dor no osso da frente" tinha dois movimentos, os dois `t2+`, e
       no primeiro trimestre a queixa era um botão que não fazia nada. */
    for (const [semana, posParto] of [
      [8, false],
      [24, false],
      [33, false],
      [38, false],
      [null, true],
    ] as [number | null, boolean][]) {
      const pool = elegiveis(fasePara(semana, posParto), semana, posParto);
      for (const s of SINTOMAS) {
        const n = pool.filter((m) => m.alivia.includes(s.chave)).length;
        expect({ semana, posParto, sintoma: s.chave, tem: n > 0 }).toEqual({
          semana,
          posParto,
          sintoma: s.chave,
          tem: true,
        });
      }
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

  test("⚠️ ela pode PEDIR para não ir ao chão — e o pedido só soma", () => {
    /* Cama de hospital, repouso, sala do trabalho. E o inverso não existe:
       não há como pedir o chão de volta com 39 semanas. */
    expect(elegiveis("t2", 24, false, true).filter((m) => m.chao)).toEqual([]);
    expect(elegiveis("t2", 24, false, true).length).toBeGreaterThan(6);
    expect(elegiveis("parto", 38, false, false).filter((m) => m.chao)).toEqual([]);
  });
});

describe("⚠️ a sessão anda num SENTIDO SÓ", () => {
  /* O defeito que a auditoria mediu: numa sessão de dez minutos a gestante de
     38 semanas levantava do chão SETE vezes, com 6 s orçados para cada troca.
     O alongamento virava o intervalo entre os agachamentos. */
  test("nenhuma sessão faz ela subir e descer mais de uma vez", () => {
    for (const [semana, posParto] of [
      [10, false],
      [24, false],
      [33, false],
      [38, false],
      [null, true],
    ] as [number | null, boolean][]) {
      for (const minutos of DURACOES_EXERCICIO) {
        /* ⚠️ TODAS as queixas, e não três escolhidas. A primeira versão deste
           teste cobria lombar, câimbra e cansaço, e cravava `niveis === 1`:
           passava, e deixava de fora justamente a CIÁTICA, que é o pior caso
           (o alívio dela se espalha por três níveis e a varredura fecha em
           duas trocas). Medido nas 189 combinações: 49 sessões com zero, 133
           com uma, 7 com duas — as sete são ciática. Sete era o ANTES. */
        for (const sintoma of [null, ...SINTOMAS.map((x) => x.chave)] as (Sintoma | null)[]) {
          const s = sessaoDoDia({ dia: 3, minutos, semana, posParto, sintoma });
          const t = trocasDePosicao(s);
          expect({ semana, minutos, sintoma, aceitavel: t.niveis <= 2 }).toEqual({
            semana,
            minutos,
            sintoma,
            aceitavel: true,
          });
        }
      }
    }
  });

  test("⚠️ cada pose é visitada UMA vez — a varredura não volta", () => {
    /* Este é o invariante da varredura circular, e não a ordem absoluta: ela
       pode começar deitada e terminar em pé. O que não pode é ela sentar,
       deitar e sentar de novo — que é como as três trocas apareciam. */
    for (const sintoma of [null, ...SINTOMAS.map((s) => s.chave)]) {
      const s = sessaoDoDia({ dia: 3, minutos: 10, semana: 24, sintoma });
      const blocos = s.map((m) => m.pose).filter((p, i, a) => p !== a[i - 1]);
      expect({ sintoma, umBlocoPorPose: new Set(blocos).size === blocos.length }).toEqual({
        sintoma,
        umBlocoPorPose: true,
      });
    }
  });

  test("⚠️ sem queixa a sessão DESCE, e termina deitada", () => {
    /* Sem dor não há alívio a adiantar, e o fim de uma sessão é onde o corpo
       relaxa. Subir sempre a faria terminar de pé, no meio da sala. */
    const s = sessaoDoDia({ dia: 3, minutos: 10, semana: 24 });
    const niveis = s.map((m) => ORDEM_DAS_POSES.indexOf(m.pose));
    expect(niveis).toEqual([...niveis].sort((a, b) => a - b));
  });

  test("⚠️ com o alívio embaixo, a sessão SOBE — a dor no primeiro minuto", () => {
    /* Dor no púbis: os dois movimentos que a tratam são deitada. Descendo, o
       alívio dela chegava no quarto minuto, depois de rolar os ombros em pé. */
    const s = sessaoDoDia({ dia: 3, minutos: 10, semana: 24, sintoma: "pubis" });
    expect(s[0].alivia.includes("pubis")).toBe(true);
    expect(poseEmbaixo(s[0].pose)).toBe(true);
    expect(trocasDePosicao(s).niveis).toBe(1);
  });

  test("⚠️ o corte por tempo vem ANTES da ordenação", () => {
    /* Ordenar primeiro faria a sessão de dois minutos entregar o topo da
       descida em vez do que alivia a dor dela. */
    const s = sessaoDoDia({ dia: 3, minutos: 2, semana: 24, sintoma: "lombar" });
    expect(s.length).toBeGreaterThan(1);
    expect(s.every((m) => m.alivia.includes("lombar"))).toBe(true);
  });

  test("ordenarPorPosicao é estável — dentro do grupo, a queixa continua na frente", () => {
    const doGrupo = MOVIMENTOS.filter((m) => m.pose === "sentada").slice(0, 3);
    expect(ordenarPorPosicao(doGrupo).map((m) => m.id)).toEqual(doGrupo.map((m) => m.id));
  });
});

describe("⚠️ o que funcionou para ela escolhe a sessão seguinte", () => {
  test("a nota é por QUEIXA, não por movimento solto", () => {
    /* O mesmo movimento serve a quatro queixas. Uma nota global carregaria a
       evidência de uma dor para outra que ela nem tinha. */
    const n = ajustarNotas({}, [MOVIMENTOS[0]], "lombar", "Melhorou");
    const chaves = Object.keys(n);
    expect(chaves.every((k) => k.startsWith("lombar:"))).toBe(true);
  });

  test("'melhorou' põe na frente na próxima sessão", () => {
    const antes = sessaoDoDia({ dia: 3, minutos: 10, semana: 24, sintoma: "lombar" });
    const ultimo = [...antes].reverse().find((m) => m.alivia.includes("lombar"))!;
    let notas = {};
    for (let i = 0; i < 3; i++) notas = ajustarNotas(notas, [ultimo], "lombar", "Melhorou");
    const depois = sessaoDoDia({ dia: 3, minutos: 2, semana: 24, sintoma: "lombar", notas });
    expect(depois.some((m) => m.id === ultimo.id)).toBe(true);
  });

  test("⚠️ a nota NUNCA tira um movimento do poço — ela só reordena", () => {
    let notas = {};
    const alvo = MOVIMENTOS.find((m) => m.alivia.includes("lombar") && m.tipo !== "assoalho")!;
    for (let i = 0; i < 9; i++) notas = ajustarNotas(notas, [alvo], "lombar", "Piorou");
    const s = sessaoDoDia({ dia: 3, minutos: 10, semana: 24, sintoma: "lombar", notas });
    expect(s.some((m) => m.id === alvo.id)).toBe(true);
    expect(Object.values(notas as Record<string, number>)).toEqual([-NOTA_LIMITE]);
  });

  test("⚠️ o assoalho pélvico não recebe nota", () => {
    /* Ele entra por prevenção, não por dor: ninguém sente alívio de assoalho
       pélvico no mesmo dia, e uma nota negativa tiraria da sessão o exercício
       com melhor evidência da gestação por um resultado que ele não prometeu. */
    const assoalho = MOVIMENTOS.filter((m) => m.tipo === "assoalho");
    for (const s of SINTOMAS) expect(ajustarNotas({}, assoalho, s.chave, "Piorou")).toEqual({});
  });

  test("'igual' não é nota negativa, e sem queixa não há o que atribuir", () => {
    const seq = sessaoDoDia({ dia: 3, minutos: 10, semana: 24, sintoma: "lombar" });
    expect(ajustarNotas({}, seq, "lombar", "Igual")).toEqual({});
    expect(ajustarNotas({}, seq, null, "Piorou")).toEqual({});
  });

  test("sem nota nenhuma, a sessão é EXATAMENTE a de antes", () => {
    /* É o caso de quase toda paciente, quase sempre — a primeira vez. */
    for (const sintoma of ["lombar", "ciatica", "caimbra"] as Sintoma[]) {
      const a = sessaoDoDia({ dia: 5, minutos: 10, semana: 24, sintoma });
      const b = sessaoDoDia({ dia: 5, minutos: 10, semana: 24, sintoma, notas: {} });
      expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
    }
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
