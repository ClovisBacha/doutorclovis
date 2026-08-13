/**
 * O QUE PRECISA ESTAR CERTO NUM SOM QUE VAI TOCAR A NOITE INTEIRA.
 *
 * Duas coisas, e as duas são silenciosas quando quebram: a emenda do loop (um
 * "tec" a cada 30 s, a noite toda, para quem está tentando dormir) e o
 * cabeçalho do WAV (o navegador simplesmente não toca, sem erro nenhum).
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  aquecimentoDe,
  CAUDA_SEGS,
  LOOP_SEGS,
  SONS_CONTINUOS,
  ehSomContinuo,
  faltando,
  periodosDe,
  quandoDesligar,
  rotuloDoTempo,
  TEMPOS,
  wav,
} from "./som-continuo";

describe("⚠️ a emenda do loop", () => {
  test("o trecho é múltiplo EXATO de todo período interno de cada som", () => {
    /* É isto, e só isto, que faz o loop fechar sem costura. Foi por causa
       deste teste que a chuva passou de 0,07 Hz para 1/15 Hz e a onda do mar
       de 9 s para 10 s — diferença inaudível, emenda perfeita.
       Quem mexer num período tem de mexer aqui: um som com período que não
       divide 30 volta a dar o "tec". */
    for (const som of SONS_CONTINUOS) {
      for (const p of periodosDe(som)) {
        const voltas = LOOP_SEGS / p;
        expect({ som, p, inteiro: Math.abs(voltas - Math.round(voltas)) < 1e-9 }).toEqual({
          som,
          p,
          inteiro: true,
        });
      }
    }
  });

  test("⚠️ a cauda toca UMA vez — ela não precisa fechar, e não pode repetir", () => {
    /* A cauda não é um trecho de loop: é o desligamento, e o `desligarComFade`
       espera o evento `ended` para dizer que acabou. Em loop, `ended` NUNCA
       dispara — o player ficaria com um elemento mudo tocando para sempre e a
       promessa pendurada. Por isso ela não entra no teste da emenda acima, e
       por isso o `false` abaixo é regra. */
    const fonte = readFileSync("src/lib/som-continuo.ts", "utf8");
    const fn = fonte.slice(fonte.indexOf("async desligarComFade("), fonte.indexOf("    parar()"));
    expect(fn).toContain("trocar(blob, false)");
    expect(fn).toContain('audio.addEventListener("ended", fim)');
    expect(CAUDA_SEGS).toBeLessThan(LOOP_SEGS);
  });

  test("⚠️ o aquecimento também fecha em voltas inteiras de tudo", () => {
    /* Ele existe porque o filtro tem memória: sem descartar um pedaço inicial,
       o começo do trecho carregava um transitório que o fim já não tinha — e no
       coração isso media um degrau MAIOR que qualquer outro do arquivo, ou
       seja, um clique a cada volta. Mas um aquecimento fora de fase moveria o
       problema em vez de resolvê-lo: ele tem de ser múltiplo de todo período. */
    for (const som of SONS_CONTINUOS) {
      const a = aquecimentoDe(som);
      expect({ som, minimo: a >= 4 }).toEqual({ som, minimo: true });
      for (const p of periodosDe(som)) {
        const voltas = a / p;
        expect({ som, p, inteiro: Math.abs(voltas - Math.round(voltas)) < 1e-9 }).toEqual({
          som,
          p,
          inteiro: true,
        });
      }
    }
  });

  test("o aquecimento é o MENOR que serve — ele custa render", () => {
    /* Com 30 s para todos, o coração levava 812 ms para ficar pronto; com 6 s,
       315 ms. É o tempo que ela espera olhando "preparando…".
       ⚠️ O laço de ruído passou de 2 s para 10 s (ver `ruidoSegs`), e isso
       empurra o aquecimento junto — o do coração fica em 6 porque o laço dele
       é 6, e o da chuva em 10 porque o LFO virou 1/10 Hz. */
    expect(aquecimentoDe("coracao")).toBe(6);
    expect(aquecimentoDe("mar")).toBe(10);
    expect(aquecimentoDe("pad")).toBe(5);
    expect(aquecimentoDe("chuva")).toBe(10);
  });

  test("o coração fecha em batidas inteiras", () => {
    /* 30 s a 140 bpm = 70 batidas. Meia batida na virada seria uma arritmia
       a cada volta — num som que existe para imitar o útero. */
    expect((LOOP_SEGS * 140) / 60).toBe(70);
  });
});

describe("o cabeçalho do WAV", () => {
  const ler = async (b: Blob) => new DataView(await b.arrayBuffer());
  const txt = (v: DataView, pos: number, n: number) =>
    String.fromCharCode(...Array.from({ length: n }, (_, i) => v.getUint8(pos + i)));

  test("RIFF/WAVE/fmt/data com os tamanhos certos", async () => {
    const v = await ler(wav(new Float32Array(100), 22050));
    expect(txt(v, 0, 4)).toBe("RIFF");
    expect(txt(v, 8, 4)).toBe("WAVE");
    expect(txt(v, 12, 4)).toBe("fmt ");
    expect(txt(v, 36, 4)).toBe("data");
    expect(v.getUint32(4, true)).toBe(36 + 200); // tamanho total menos 8
    expect(v.getUint32(40, true)).toBe(200); // 100 amostras × 2 bytes
    expect(v.byteLength).toBe(244);
  });

  test("mono, 16 bits, e a taxa que foi pedida", async () => {
    const v = await ler(wav(new Float32Array(10), 44100));
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint16(22, true)).toBe(1); // canais
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getUint32(28, true)).toBe(88200); // bytes por segundo
    expect(v.getUint16(32, true)).toBe(2);
    expect(v.getUint16(34, true)).toBe(16);
  });

  test("⚠️ pico fora da faixa é APARADO, nunca embrulhado", async () => {
    /* Sem o corte, 1,2 estoura o inteiro de 16 bits e volta pelo outro lado:
       o valor mais alto possível vira o mais BAIXO possível. No ouvido, um
       estalo alto — e ela está dormindo. */
    const v = await ler(wav(new Float32Array([1.5, -1.5, 0, 1, -1]), 22050));
    expect(v.getInt16(44, true)).toBe(32767);
    expect(v.getInt16(46, true)).toBe(-32768);
    expect(v.getInt16(48, true)).toBe(0);
    expect(v.getInt16(50, true)).toBe(32767);
    expect(v.getInt16(52, true)).toBe(-32768);
  });

  test("o tipo é audio/wav — é por ele que o <audio> decide se tenta tocar", () => {
    expect(wav(new Float32Array(4), 22050).type).toBe("audio/wav");
  });
});

describe("o temporizador", () => {
  test("o fade come os últimos 15 s do tempo pedido, não 15 s a mais", () => {
    /* Quem pede 30 minutos quer o quarto em silêncio aos 30. */
    const agora = 1_000_000;
    expect(quandoDesligar(30, agora)).toBe(agora + 30 * 60_000 - 15_000);
  });

  test('"sem limite" não agenda nada', () => {
    expect(quandoDesligar(0, 123)).toBe(null);
  });

  test("os quatro tempos, e o rótulo de cada um", () => {
    expect([...TEMPOS]).toEqual([15, 30, 60, 0]);
    expect(TEMPOS.map(rotuloDoTempo)).toEqual(["15 min", "30 min", "60 min", "Sem limite"]);
  });

  test("a conta regressiva arredonda para cima e nunca fica negativa", () => {
    /* "0 min" faltando com som ainda tocando faria ela achar que travou. */
    expect(faltando(61_000)).toBe("2 min");
    expect(faltando(59_000)).toBe("59 s");
    expect(faltando(-5000)).toBe("0 s");
  });
});

describe("quais sons entram", () => {
  test("os quatro do fundo da meditação, e o silêncio fica de fora", () => {
    expect([...SONS_CONTINUOS]).toEqual(["chuva", "mar", "coracao", "pad"]);
    expect(ehSomContinuo("silencio")).toBe(false);
    expect(ehSomContinuo("chuva")).toBe(true);
  });
});
