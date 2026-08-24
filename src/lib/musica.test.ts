/**
 * A MÚSICA — e o teorema que decide a escala.
 *
 * ⚠️ Nada aqui mede COMO soa; quem ouve é `scripts/ouvir.mjs`. Aqui se prova a
 * aritmética que sustenta as decisões, e se trava o que não pode voltar.
 */

import { describe, expect, test } from "bun:test";
import { semDissonancia } from "./afinacao";
import { CICLO } from "./meditacao-sessao";
import {
  CORES,
  NOTAS_DA_ESCALA,
  PENTATONICA,
  VOZES,
  arcoDaMusica,
  aspero,
  bandaCritica,
  escalaSegura,
  eventosDoTrecho,
  hzDoGrau,
} from "./musica";

/* Sorteio determinístico, para os testes não dependerem de sorte. */
function dado(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe("⚠️ CINCO NOTAS É O TETO — e isto é um teorema, não um gosto", () => {
  test("nenhum conjunto de SEIS ou mais notas em 12-TET é seguro para sobreposição", () => {
    /* A varredura completa dos 4096 subconjuntos de Z₁₂.
     *
     * Proibir distância circular 1 (segunda menor) e 6 (trítono) é pedir um
     * conjunto independente no grafo circulante C₁₂(1,6). Em Z₁₂ os únicos
     * independentes de tamanho 6 são os dois alternados — {0,2,4,6,8,10} e os
     * ímpares — e AMBOS contêm pares antípodas, ou seja trítonos.
     *
     * Este teste é a resposta pronta para o dia em que alguém quiser "só mais
     * uma nota na escala": não dá, e não é preferência. */
    let maiorSeguro = 0;
    let quantosDeCinco = 0;
    for (let mascara = 0; mascara < 4096; mascara++) {
      const conjunto: number[] = [];
      for (let i = 0; i < 12; i++) if (mascara & (1 << i)) conjunto.push(i);
      if (!semDissonancia(conjunto)) continue;
      maiorSeguro = Math.max(maiorSeguro, conjunto.length);
      if (conjunto.length === 5) quantosDeCinco++;
    }
    expect(maiorSeguro).toBe(5);
    /* E há exatamente doze deles: as doze transposições da pentatônica. */
    expect(quantosDeCinco).toBe(12);
  });

  test("a escala escolhida é uma delas", () => {
    expect(escalaSegura()).toBe(true);
    expect(PENTATONICA.length).toBe(5);
    expect(NOTAS_DA_ESCALA.length).toBe(5);
  });

  test("⚠️ e as duas escalas alternadas de SEIS notas reprovam — as duas", () => {
    /* São os únicos candidatos de seis, e é o trítono que os derruba. */
    expect(semDissonancia([0, 2, 4, 6, 8, 10])).toBe(false);
    expect(semDissonancia([1, 3, 5, 7, 9, 11])).toBe(false);
  });
});

describe("as cinco cores, e o Modo Cuidado", () => {
  test("toda janela tem cor, e todas as cores usadas são notas da escala", () => {
    for (const m of Object.keys(CORES) as (keyof typeof CORES)[]) {
      expect(NOTAS_DA_ESCALA).toContain(CORES[m].drone);
    }
  });

  test("⚠️ o portão de luto MUDA a peça — não passa vaziamente", () => {
    /* A primeira versão deste teste passava sobre nada: nenhuma janela pousava
       na cor escura, então o portão nunca disparava, e o teste ficava verde
       igual com `luto: false` e igual com a linha do portão APAGADA. Medido:
       `JSON.stringify(arcoDaMusica(38, false))` era idêntico ao de `true`.

       A prova de que o portão existe é a diferença. */
    const normal = JSON.stringify(arcoDaMusica(38, false));
    const luto = JSON.stringify(arcoDaMusica(38, true));
    expect(luto).not.toBe(normal);
  });

  test("⚠️ e no luto a peça NÃO VIAJA — fica no recolhido do começo", () => {
    /* O arco continua existindo (densidade, cauda, vozes entrando e saindo);
       o que não acontece é a viagem harmônica. Quem está de luto não é levada
       a lugar nenhum. */
    for (const t of arcoDaMusica(38, true)) {
      expect({ momento: t.momento, drone: t.cor.drone }).toEqual({
        momento: t.momento,
        drone: "la",
      });
    }
  });

  test("a cor mais escura EXISTE fora do luto — senão não haveria o que barrar", () => {
    const cores = arcoDaMusica(38, false).map((t) => t.cor.drone);
    expect(cores).toContain("mi");
  });

  test("a volta devolve o drone ao lá do começo — é o que FECHA a sessão", () => {
    const arco = arcoDaMusica(38);
    expect(arco[0].cor.drone).toBe("la");
    expect(arco[arco.length - 1].cor.drone).toBe("la");
  });
});

describe("⚠️ os seis períodos primos — o mecanismo do Eno", () => {
  test("são primos, e nenhum é 17", () => {
    /* 17 contra o ciclo de 16 s deriva um segundo por respiração e atravessa o
       ciclo inteiro em 16 respirações: uma varredura lenta que o ouvido PEGA.
       O menor primo que serve é 19. */
    const primo = (n: number) => {
      for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
      return n > 1;
    };
    for (const v of VOZES)
      expect({ p: v.periodo, primo: primo(v.periodo) }).toEqual({ p: v.periodo, primo: true });
    expect(VOZES.map((v) => v.periodo)).not.toContain(17);
  });

  test("o mínimo múltiplo comum passa de dez anos", () => {
    /* 19 · 23 · 29 · 31 · 37 · 41 = 595.973.171 s ≈ 18,9 anos. A constelação
       não se repete dentro de uma sessão, nem de uma gestação. */
    const mmc = VOZES.reduce((a, v) => a * v.periodo, 1);
    expect(mmc).toBe(595973171);
    expect(mmc / (365 * 24 * 3600)).toBeGreaterThan(10);
  });

  test("⚠️ quem fala mais, fala mais baixo", () => {
    /* Sem isso a voz de 19 s domina e a peça vira ostinato — o defeito clássico
       de música generativa amadora. */
    const ordenadas = [...VOZES].sort((a, b) => a.periodo - b.periodo);
    for (let i = 1; i < ordenadas.length; i++) {
      expect(ordenadas[i].ganho).toBeGreaterThan(ordenadas[i - 1].ganho);
    }
  });

  test("nenhum período é múltiplo do ciclo respiratório", () => {
    /* Um período múltiplo de 16 s cairia sempre na mesma fase da respiração, e
       o ouvido leria a voz como parte do compasso. */
    for (const v of VOZES) expect(v.periodo % CICLO).not.toBe(0);
  });
});

describe("o arco", () => {
  test("cobre a sessão inteira, sem buraco e sem sobreposição", () => {
    const arco = arcoDaMusica(38);
    expect(arco[0].de).toBe(0);
    expect(arco[arco.length - 1].ate).toBe(38 * CICLO);
    for (let i = 1; i < arco.length; i++) expect(arco[i].de).toBe(arco[i - 1].ate);
  });

  test("⚠️ a densidade pica no CORPO e o silêncio é o mais esparso", () => {
    /* Se a amplitude picasse junto com a densidade, o corpo viraria clímax — e
       clímax é ativação, o oposto do trabalho desta tela. */
    const arco = arcoDaMusica(38);
    const corpo = arco.find((t) => t.momento === "corpo")!;
    const silencio = arco.find((t) => t.momento === "silencio")!;
    expect(corpo.vozes.length).toBe(6);
    expect(silencio.vozes.length).toBe(2);
    /* E o silêncio é o mais REVERBERANTE: sem isso, "esparso" lê como
       abandonada; com a cauda longa, lê como espaço. */
    expect(silencio.rt60).toBeGreaterThan(corpo.rt60);
  });

  test("a volta acrescenta massa — terminar onde começou é FECHAR", () => {
    const arco = arcoDaMusica(38);
    const silencio = arco.find((t) => t.momento === "silencio")!;
    const volta = arco.find((t) => t.momento === "volta")!;
    expect(volta.vozes.length).toBeGreaterThan(silencio.vozes.length);
  });

  test("⚠️ a duração sai dos CICLOS, então 10 minutos dão 10 minutos de música", () => {
    /* É o pedido do dono resolvido por construção. Um arquivo gravado nunca
       resolve isso; um motor generativo resolve sempre. */
    for (const ciclos of [4, 8, 19, 38]) {
      const arco = arcoDaMusica(ciclos);
      expect(arco[arco.length - 1].ate).toBe(ciclos * CICLO);
    }
  });

  test("mesmo a sessão de um minuto tem começo e fim", () => {
    const arco = arcoDaMusica(4);
    expect(arco.length).toBeGreaterThan(1);
    expect(arco[0].momento).toBe("acolhimento");
    expect(arco[arco.length - 1].momento).toBe("volta");
  });
});

describe("⚠️ nenhuma nota é cortada no meio", () => {
  test("todo evento cabe inteiro — envelope e cauda do reverb", () => {
    /* É a primeira das três travas contra "cortar no meio de uma frase". O
       último sino cai naturalmente uns treze segundos antes do fim e o drone
       termina sozinho: isso É o final, e custa zero. */
    const total = 38 * CICLO;
    for (const t of arcoDaMusica(38)) {
      for (const e of eventosDoTrecho(t, dado(7), total)) {
        expect(e.t + t.ataque + 8 + t.rt60).toBeLessThanOrEqual(total);
      }
    }
  });

  test("nenhum evento cai fora do trecho dele", () => {
    for (const t of arcoDaMusica(38)) {
      for (const e of eventosDoTrecho(t, dado(11), 38 * CICLO)) {
        expect(e.t).toBeGreaterThanOrEqual(t.de);
        expect(e.t).toBeLessThan(t.ate);
      }
    }
  });

  test("todo evento toca uma nota DA escala", () => {
    const total = 38 * CICLO;
    const permitidas = new Set<number>();
    for (const t of arcoDaMusica(38)) {
      for (let o = -1; o <= 3; o++) {
        for (const g of PENTATONICA) {
          permitidas.add(Math.round(hzDoGrau(t.cor.drone, t.cor.oitava, g, o) * 100));
        }
      }
    }
    for (const t of arcoDaMusica(38)) {
      for (const e of eventosDoTrecho(t, dado(13), total)) {
        expect(permitidas.has(Math.round(e.hz * 100))).toBe(true);
      }
    }
  });
});

describe("⚠️ a segunda régua: aspereza mede HERTZ, não semitons", () => {
  test("ré4 com mi4 é áspero; ré4 com mi5 não é", () => {
    /* As duas duplas têm as MESMAS classes de altura. `semDissonancia` não
       distingue, e é por isso que ela sozinha não basta. */
    const re4 = hzDoGrau("re", 4, 0);
    const mi4 = hzDoGrau("re", 4, 2);
    const mi5 = hzDoGrau("re", 5, 2);
    expect(aspero(re4, mi4)).toBe(true);
    expect(aspero(re4, mi5)).toBe(false);
  });

  test("a banda crítica cresce com a frequência", () => {
    expect(bandaCritica(100)).toBeLessThan(bandaCritica(1000));
    expect(bandaCritica(1000)).toBeLessThan(bandaCritica(5000));
    /* Perto de 1 kHz ela vale ~160 Hz, que é o número que decide o timbre:
       nenhuma voz passa do sexto parcial justamente para os parciais de duas
       vozes consonantes não caírem dentro dessa distância. */
    expect(bandaCritica(1000)).toBeGreaterThan(140);
    expect(bandaCritica(1000)).toBeLessThan(180);
  });

  test("a mesma nota não é áspera consigo mesma", () => {
    expect(aspero(432, 432)).toBe(false);
  });
});
