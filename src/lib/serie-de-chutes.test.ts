/**
 * A SÉRIE DE MOVIMENTOS, EXERCITADA.
 *
 * ⚠️ Cada asserção aqui trava uma decisão que a literatura decidiu, e não uma
 * escolha de desenho. As fontes estão no cabeçalho de `serie-de-chutes.ts`;
 * o que este arquivo garante é que o código faz o que elas dizem.
 */
import { describe, expect, test } from "bun:test";
import {
  faixaPessoal,
  FRASE_DA_LINHA_PLANA,
  leituraDeHoje,
  serieDeChutes,
  tempoAte10,
  type SessaoDeChutes,
} from "@/lib/serie-de-chutes";

const BASE = new Date("2026-09-01T21:00:00-03:00").getTime();

/** Uma sessão: quantos dias atrás, quantos minutos durou, quantos movimentos. */
function sessao(diasAtras: number, minutos: number, chutes = 10): SessaoDeChutes {
  const ini = BASE - diasAtras * 86400000;
  return {
    started_at: new Date(ini).toISOString(),
    ended_at: new Date(ini + minutos * 60000).toISOString(),
    kick_count: chutes,
  };
}

describe("o ponto da série", () => {
  test("uma sessão que chegou a dez vira minutos", () => {
    expect(tempoAte10(sessao(0, 14))).toBe(14);
  });

  test("⚠️ sessão que NÃO chegou a dez fica de fora — senão o alarme vira o pico do gráfico", () => {
    /* Misturar "4 movimentos em 2 horas" como um ponto de 120 min INVERTE o
       sinal: o alarme viraria o ponto mais alto da série e seria lido como
       "o bebê está mais lento", quando o que houve é que a contagem nem se
       completou. */
    expect(tempoAte10(sessao(0, 120, 4))).toBeNull();
  });

  test("⚠️ sessão esquecida aberta é descartada pelo teto de duas horas", () => {
    /* Uma noite inteira com o cronômetro rodando entraria como um ponto de
       oito horas e estragaria a mediana pessoal para sempre. */
    expect(tempoAte10(sessao(0, 480, 12))).toBeNull();
    /* E o limite é o piso de segurança: 120 entra, 121 não. */
    expect(tempoAte10(sessao(0, 120))).toBe(120);
    expect(tempoAte10(sessao(0, 121))).toBeNull();
  });

  test("sessão sem fim, com contagem impossível ou de duração zero, fica de fora", () => {
    expect(tempoAte10({ ...sessao(0, 14), ended_at: null })).toBeNull();
    expect(tempoAte10({ ...sessao(0, 14), kick_count: Number.NaN })).toBeNull();
    expect(tempoAte10(sessao(0, 0))).toBeNull();
    expect(tempoAte10({ ...sessao(0, 14), started_at: "não é data" })).toBeNull();
  });

  test("a série sai em ordem cronológica, do mais antigo para o mais novo", () => {
    const s = serieDeChutes([sessao(0, 20), sessao(5, 9), sessao(2, 12)]);
    expect(s.map((p) => p.valor)).toEqual([9, 12, 20]);
  });
});

describe("⚠️ o 'seu normal' é a MEDIANA dela, e não um corte populacional", () => {
  test("mediana, e nunca média — uma sessão longa não pode arrastar a régua", () => {
    /* [8, 9, 10, 11, 118] tem média 31,2 e mediana 10. Com a média, o "normal
       dela" viraria meia hora e a noite de vinte minutos pareceria ótima. */
    const pontos = serieDeChutes([
      sessao(5, 8),
      sessao(4, 9),
      sessao(3, 10),
      sessao(2, 11),
      sessao(1, 118),
    ]);
    const f = faixaPessoal(pontos);
    expect(f?.mediana).toBe(10);
    const media = (8 + 9 + 10 + 11 + 118) / 5;
    expect(media).toBeGreaterThan(30);
  });

  test("⚠️ abaixo de cinco sessões NÃO existe faixa", () => {
    /* Com duas, o app compararia a segunda com a primeira e chamaria ruído de
       tendência. "Ainda não sei o seu normal" é honesto; uma faixa inventada
       não é. */
    const poucos = serieDeChutes([sessao(2, 10), sessao(1, 12), sessao(0, 9)]);
    expect(faixaPessoal(poucos)).toBeNull();
    expect(faixaPessoal(serieDeChutes([sessao(4, 8), sessao(3, 9), sessao(2, 10)]))).toBeNull();
  });

  test("a janela é das últimas quatorze", () => {
    const muitas = Array.from({ length: 30 }, (_, i) => sessao(30 - i, i < 16 ? 60 : 10));
    const f = faixaPessoal(serieDeChutes(muitas));
    expect(f?.sessoes).toBe(14);
    /* As catorze últimas são as de dez minutos — as antigas de sessenta ficam
       de fora, que é o ponto de a janela existir. */
    expect(f?.mediana).toBe(10);
  });

  test("a faixa é de quartis, e a mediana fica dentro dela", () => {
    const pontos = serieDeChutes([
      sessao(6, 6),
      sessao(5, 8),
      sessao(4, 10),
      sessao(3, 12),
      sessao(2, 14),
      sessao(1, 16),
    ]);
    const f = faixaPessoal(pontos)!;
    expect(f.de).toBeLessThanOrEqual(f.mediana);
    expect(f.ate).toBeGreaterThanOrEqual(f.mediana);
  });
});

describe("a leitura de hoje", () => {
  const seis = [sessao(6, 9), sessao(5, 10), sessao(4, 11), sessao(3, 10), sessao(2, 9)];

  test("sem base, ela diz que não sabe", () => {
    expect(leituraDeHoje(serieDeChutes([sessao(1, 10)]), null)).toBe("sem-base");
    expect(leituraDeHoje([], null)).toBe("sem-base");
  });

  test("dentro, acima e abaixo do normal DELA", () => {
    const comHoje = (min: number) => {
      const pontos = serieDeChutes([...seis, sessao(0, min)]);
      return leituraDeHoje(pontos, faixaPessoal(pontos));
    };
    expect(comHoje(10)).toBe("dentro");
    expect(comHoje(40)).toBe("acima");
    expect(comHoje(3)).toBe("abaixo");
  });
});

describe("⚠️ e a frase do rodapé nega o mito, em vez de repeti-lo", () => {
  test("ela diz que a linha é PLANA e que ele não se mexe menos no fim", () => {
    /* Winje 2012: idade gestacional maior associou-se a tempos mais CURTOS,
       "refuting the wide-spread notion that fetal activity decreases in late
       pregnancy". Um gráfico com faixa esperada subindo ensinaria o mito com a
       autoridade de um desenho. */
    expect(FRASE_DA_LINHA_PLANA).toContain("plana");
    expect(FRASE_DA_LINHA_PLANA).toMatch(/não se mexe menos/i);
  });
});

describe("⚠️ e o degrau da coluna nova — a gravação não pode parar por causa dela", () => {
  test("o insert desce um degrau em PGRST204, e nunca em 42703", async () => {
    /* `strength` nasce num `APLICAR_*.sql` que o dono roda À MÃO, e o deploy
       chega ANTES — é o estado normal desta produção. Sem o degrau, GRAVAR A
       SESSÃO pararia para todo mundo por causa de uma coluna que ninguém
       pediu ainda.

       ⚠️ E o código é o do PostgREST: num INSERT quem recusa é o schema cache,
       e o pedido nem chega ao Postgres. Escrever `42703` aqui já custou três
       recursos silenciosos nesta base. */
    const { readFileSync } = await import("node:fs");
    const { semComentarios } = await import("@/lib/sem-comentarios");
    const codigo = semComentarios(readFileSync("src/components/kicks-tab.tsx", "utf8"));
    const i = codigo.indexOf("async function stop(");
    expect(`stop: ${i > -1}`).toBe("stop: true");
    const corpo = codigo.slice(i, codigo.indexOf("\n  const relogio", i));
    expect(corpo).toContain('code === "PGRST204"');
    expect(corpo).not.toContain("42703");
    /* A primeira tentativa leva a força; a segunda, a linha sem ela. */
    expect(corpo).toMatch(/insert\(\{ \.\.\.linha, strength: forca \}\)/);
    expect(corpo).toMatch(/insert\(linha\)/);
  });
});
