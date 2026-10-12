import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  duracaoCurta,
  episodiosDeContracao,
  fraseDoEpisodio,
  FOLGA_ENTRE_EPISODIOS_MIN,
} from "@/lib/episodios-de-contracao";
import { itensDaLinha } from "@/lib/linha-do-tempo-clinica";
import { resumoParaAchados } from "@/lib/resumo-da-consulta";
import { semComentarios } from "@/lib/sem-comentarios";
import type { EventoClinico } from "@/lib/clinical.functions";

/**
 * O EPISÓDIO, E NÃO A CONTRAÇÃO.
 *
 * ⚠️ O defeito que este arquivo fecha: a view projeta UMA LINHA POR CONTRAÇÃO
 * e a linha do tempo do prontuário mostra as quarenta primeiras — então uma
 * noite de trabalho de parto empurrava para fora da tela a pressão alterada, o
 * sintoma e a pré-consulta da mesma semana, sem nenhum sinal. E o rascunho de
 * achados da consulta não tinha uma palavra sobre contrações: medido,
 * `grep -ci contra` naquele arquivo dava ZERO.
 */

/** Uma contração em `min` minutos depois da âncora. */
const ANCORA = Date.UTC(2026, 8, 5, 2, 0);
const c = (min: number, intensidade?: number | null, duracaoSeg?: number | null) => ({
  em: new Date(ANCORA + min * 60000).toISOString(),
  intensidade,
  duracaoSeg,
});

describe("agrupar em episódios", () => {
  test("a folga que separa é a MESMA janela de análise da tela dela", () => {
    /* Se o app já considera que uma contração de mais de duas horas atrás não
       descreve o padrão de agora, duas separadas por esse tanto não são o
       mesmo episódio. */
    expect(FOLGA_ENTRE_EPISODIOS_MIN).toBe(120);
  });

  test("uma noite inteira vira UM item", () => {
    const noite = [0, 3, 6, 9, 12, 15, 18, 21].map((m) => c(m, 3, 60));
    const eps = episodiosDeContracao(noite);
    expect(eps).toHaveLength(1);
    expect(eps[0].quantas).toBe(8);
    expect(eps[0].duracaoMin).toBe(21);
    expect(eps[0].intervaloMin).toBe(3);
  });

  test("duas noites separadas por mais de duas horas viram dois", () => {
    const eps = episodiosDeContracao([c(0, 2, 40), c(10, 2, 40), c(200, 2, 40), c(210, 2, 40)]);
    expect(eps).toHaveLength(2);
    /* ⚠️ A ordem é a da linha do tempo: mais RECENTE primeiro. */
    expect(new Date(eps[0].inicio).getTime()).toBeGreaterThan(new Date(eps[1].inicio).getTime());
  });

  test("exatamente 120 min NÃO separa; 121 separa", () => {
    expect(episodiosDeContracao([c(0), c(120)])).toHaveLength(1);
    expect(episodiosDeContracao([c(0), c(121)])).toHaveLength(2);
  });

  test("entrada desordenada é ordenada aqui dentro", () => {
    /* Os dois chamadores ordenam diferente — a leitura da view é decrescente e
       o rascunho de achados é crescente. Ordenar aqui é o que impede o
       chamador de decidir errado. */
    const eps = episodiosDeContracao([c(9, 2, 40), c(0, 2, 40), c(3, 2, 40)]);
    expect(eps).toHaveLength(1);
    expect(eps[0].quantas).toBe(3);
    expect(eps[0].duracaoMin).toBe(9);
  });

  test("o intervalo é MEDIANA — um vão longo no começo não apaga o padrão", () => {
    /* [30, 5, 5, 5] tem média 11,25 e mediana 5: é o caso real de quem começa
       a cronometrar em dúvida e só depois fica regular. */
    const eps = episodiosDeContracao([c(0), c(30), c(35), c(40), c(45)]);
    expect(eps[0].intervaloMin).toBe(5);
  });

  test("uma contração só não tem intervalo", () => {
    expect(episodiosDeContracao([c(0, 2, 40)])[0].intervaloMin).toBeNull();
  });

  test("sem contração encerrada, a duração é `null` — nunca zero", () => {
    const eps = episodiosDeContracao([c(0, 2, null), c(5, 2, null)]);
    expect(eps[0].duracaoSeg).toBeNull();
  });

  test("instante inválido é descartado sem derrubar o resto", () => {
    const eps = episodiosDeContracao([{ em: "não é data" }, c(0, 2, 40), c(5, 2, 40)]);
    expect(eps).toHaveLength(1);
    expect(eps[0].quantas).toBe(2);
  });
});

describe("a intensidade predominante só fala com MAIORIA", () => {
  test("maioria clara vira predominante", () => {
    const eps = episodiosDeContracao([c(0, 3), c(3, 3), c(6, 3), c(9, 1)]);
    expect(eps[0].predominante).toBe(3);
  });

  test("abaixo de 60% não existe predominante", () => {
    /* Quatro leves, três moderadas e três fortes não é um episódio "leve" —
       rotulá-lo assim seria o resumo afirmando o que os números não dizem. */
    const eps = episodiosDeContracao([
      ...[0, 3, 6, 9].map((m) => c(m, 1)),
      ...[12, 15, 18].map((m) => c(m, 2)),
      ...[21, 24, 27].map((m) => c(m, 3)),
    ]);
    expect(eps[0].predominante).toBeNull();
  });

  test("empate cala", () => {
    expect(episodiosDeContracao([c(0, 1), c(3, 3)])[0].predominante).toBeNull();
  });

  test("nenhuma marcada devolve `null`", () => {
    expect(episodiosDeContracao([c(0), c(3)])[0].predominante).toBeNull();
  });

  test("valor fora de 1–3 não conta", () => {
    expect(episodiosDeContracao([c(0, 9), c(3, 9)])[0].predominante).toBeNull();
  });
});

describe("a frase do episódio", () => {
  test("diz quantas, em quanto tempo, de quanto em quanto e a força", () => {
    const eps = episodiosDeContracao([0, 3, 6, 9].map((m) => c(m, 3, 62)));
    const frase = fraseDoEpisodio(eps[0]);
    expect(frase).toBe("4 contrações, em 9 min, a cada 3 min, ~62s, fortes");
  });

  test("cada peça só aparece quando existe", () => {
    /* Sem encerrar não há duração; sem maioria não há predominante. Preencher
       qualquer uma com um padrão faria o resumo afirmar o que não foi medido. */
    const eps = episodiosDeContracao([c(0, null, null), c(5, null, null)]);
    const frase = fraseDoEpisodio(eps[0]);
    expect(frase).toContain("2 contrações");
    expect(frase).not.toContain("~");
    expect(frase).not.toMatch(/leves|moderadas|fortes/);
  });

  test("com uma só, nem duração de episódio nem intervalo", () => {
    const frase = fraseDoEpisodio(episodiosDeContracao([c(0, 3, 50)])[0]);
    expect(frase).toBe("1 contração, ~50s, forte");
  });

  test("o rótulo da força sai do CATÁLOGO ÚNICO", () => {
    const fonte = semComentarios(readFileSync("src/lib/episodios-de-contracao.ts", "utf8"));
    expect(fonte).toContain("nivelDeIntensidade");
    /* Nenhuma tabela local de palavras. */
    expect(fonte).not.toMatch(/"forte"|"leve"|"moderada"/);
  });

  test("`duracaoCurta` passa a horas acima de sessenta minutos", () => {
    expect(duracaoCurta(40)).toBe("40 min");
    expect(duracaoCurta(60)).toBe("1h");
    expect(duracaoCurta(250)).toBe("4h10");
    expect(duracaoCurta(-1)).toBe("—");
  });
});

/* ─── O RASCUNHO DE ACHADOS ──────────────────────────────────────────────── */

function ev(min: number, extra: Partial<EventoClinico> = {}): EventoClinico {
  return {
    fonte: "contraction_logs",
    fonte_id: `x-${min}`,
    ocorrido_em: new Date(ANCORA + min * 60000).toISOString(),
    especie: "contracao",
    dados: { intensidade: 3, duracao_seg: 60 },
    texto: null,
    gravidade: "normal",
    notas: [],
    tratado_em: null,
    ...extra,
  } as EventoClinico;
}

describe("as contrações entram no texto que o médico assina", () => {
  test("um episódio vira uma linha", () => {
    const t = resumoParaAchados(
      [0, 3, 6, 9].map((m) => ev(m)),
      null,
    );
    expect(t).toContain("Contrações cronometradas");
    expect(t).toContain("4 contrações");
    expect(t).toContain("a cada 3 min");
  });

  test("no máximo TRÊS episódios, e o que sobra é DITO", () => {
    /* O campo é lido em pé: um histórico de dois meses empurraria para fora a
       pressão alterada que vem acima. Cortar em silêncio é que não pode. */
    const cinco = [0, 200, 400, 600, 800].flatMap((base) => [ev(base), ev(base + 5)]);
    const t = resumoParaAchados(cinco, null);
    expect(t).toContain("+2 episódios antes");
    expect(t.match(/2 contrações/g)?.length).toBe(3);
  });

  test("a emergência continua sendo a ÚLTIMA linha", () => {
    /* É a linha que não pode ser cortada por rolagem do campo — e o bloco novo
       entrou ANTES dela de propósito. */
    const t = resumoParaAchados(
      [
        ev(0),
        ev(5),
        ev(10, {
          fonte: "panic_events",
          fonte_id: "sos",
          especie: "emergencia",
          dados: {},
          gravidade: "grave",
        }),
      ],
      null,
    );
    const contracoes = t.indexOf("Contrações cronometradas");
    const sos = t.indexOf("de emergência");
    expect(contracoes).toBeGreaterThan(0);
    expect(sos).toBeGreaterThan(contracoes);
  });

  test("sem contração no período, nenhuma linha aparece", () => {
    expect(resumoParaAchados([], null)).toBe("");
  });
});

describe("a linha do tempo do prontuário não é afogada por uma noite", () => {
  test("catorze contrações viram UM item, e o resto volta a caber", () => {
    /* ⚠️ O render mostra as QUARENTA primeiras. Sem agrupar, uma noite
       cronometrada empurrava a pressão alterada e a pré-consulta da mesma
       semana para fora da tela — sem nenhum sinal de que existiam. */
    const noite = Array.from({ length: 14 }, (_, i) => ev(i * 3));
    const pressao = ev(-600, {
      fonte: "health_logs",
      fonte_id: "pa",
      especie: "medida",
      dados: { systolic: 148, diastolic: 96 },
      gravidade: "atencao",
    });
    const itens = itensDaLinha([...noite, pressao]);
    expect(itens).toHaveLength(2);
    expect(itens.some((i) => i.rotulo === "Episódio de contrações")).toBe(true);
    /* E a pressão continua lá, com a gravidade dela. */
    const pa = itens.find((i) => i.rotulo === "Medida");
    expect(pa?.gravidade).toBe("atencao");
  });

  test("a gravidade do episódio é a MAIOR das contrações dele", () => {
    /* Hoje a view não classifica contração e todas saem `normal`; pegar a
       primeira faria o dia em que essa régua mudar passar em branco. */
    const itens = itensDaLinha([ev(0), ev(3, { gravidade: "grave" }), ev(6)]);
    expect(itens[0].gravidade).toBe("grave");
  });

  test("uma contração sozinha não vira 'episódio'", () => {
    const itens = itensDaLinha([ev(0)]);
    expect(itens[0].rotulo).toBe("Contração");
  });

  test("a ordem continua sendo a mais recente primeiro", () => {
    const itens = itensDaLinha([
      ev(0),
      ev(3),
      ev(1000, {
        fonte: "health_logs",
        fonte_id: "z",
        especie: "medida",
        dados: { weight_kg: 70 },
      }),
    ]);
    expect(itens[0].rotulo).toBe("Medida");
  });
});
