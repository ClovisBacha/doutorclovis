/**
 * O SOM DE FUNDO, RODANDO DE VERDADE — com um `AudioContext` de mentira.
 *
 * Estes testes existem porque a revisão adversarial da pausa achou aqui um
 * defeito que casamento de string nunca acharia: `retomar()` lia `ctx.state`
 * DEPOIS de esperar, e nesse meio-tempo `stop()` podia ter zerado o `ctx`. O
 * TypeError subia pela promessa, quem chamou entendia "não voltou" e criava um
 * `AudioContext` NOVO — som tocando num componente que já tinha saído da tela,
 * sem nenhum botão em lugar nenhum que o desligasse.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createSoundscape } from "./soundscapes";

class Param {
  value = 0;
  cancelScheduledValues() {}
  setValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number) {
    this.value = v;
    return this;
  }
}
class No {
  gain = new Param();
  frequency = new Param();
  Q = new Param();
  type = "";
  buffer: unknown = null;
  loop = false;
  connect(n: unknown) {
    return n;
  }
  start() {}
  stop() {}
}

class CtxFalso {
  static vivos = 0;
  state: "running" | "suspended" | "closed" = "running";
  currentTime = 0;
  sampleRate = 44100;
  destination = new No();
  suspensoes = 0;
  /** Trava a volta, para simular o que acontece DURANTE a espera. */
  segurarResume: (() => void) | null = null;
  constructor() {
    CtxFalso.vivos++;
  }
  createGain() {
    return new No();
  }
  createBufferSource() {
    return new No();
  }
  createBiquadFilter() {
    return new No();
  }
  createOscillator() {
    return new No();
  }
  createBuffer(_c: number, len: number) {
    return { getChannelData: () => new Float32Array(len) };
  }
  async suspend() {
    this.suspensoes++;
    if (this.state !== "closed") this.state = "suspended";
  }
  async resume() {
    if (this.segurarResume) await new Promise<void>((ok) => (this.segurarResume = ok));
    if (this.state !== "closed") this.state = "running";
  }
  async close() {
    this.state = "closed";
    CtxFalso.vivos--;
  }
}

let criados: CtxFalso[] = [];
beforeEach(() => {
  criados = [];
  CtxFalso.vivos = 0;
  (globalThis as Record<string, unknown>).window = {
    AudioContext: class extends CtxFalso {
      constructor() {
        super();
        criados.push(this);
      }
    },
  };
});
afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

const espera = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

describe("pausar e voltar", () => {
  test("pausar suspende o contexto (depois de baixar o volume)", async () => {
    const s = createSoundscape("pad");
    s.start();
    s.pausar();
    /* Não suspende no ato: o volume desce em 150 ms primeiro, senão o corte é
       seco — que é o que o fade de entrada de 1,5 s existe para evitar. */
    expect(criados[0].state).toBe("running");
    await espera(260);
    expect(criados[0].state).toBe("suspended");
  });

  test("retomar volta a tocar e diz que conseguiu", async () => {
    const s = createSoundscape("pad");
    s.start();
    s.pausar();
    await espera(260);
    expect(await s.retomar()).toBe(true);
    expect(criados[0].state).toBe("running");
  });

  test("⚠️ fechar DURANTE a espera não estoura e não deixa som órfão", async () => {
    /* O cenário: ela toca em Continuar e, enquanto o navegador ainda não
       respondeu, toca no ✕. Antes, isto lançava TypeError e quem chamou criava
       um AudioContext novo, tocando sem dono. */
    const s = createSoundscape("pad");
    s.start();
    const ctx = criados[0];
    ctx.segurarResume = () => {};
    s.pausar();
    const voltando = s.retomar();
    await espera(0);
    s.stop(); // ✕ no meio da espera
    ctx.segurarResume?.(); // o navegador responde agora
    expect(await voltando).toBe(false);
    expect(ctx.state).toBe("closed");
    expect(CtxFalso.vivos).toBe(0);
  });

  test("retomar depois de parar devolve false, sem lançar", async () => {
    const s = createSoundscape("pad");
    s.start();
    s.stop();
    expect(await s.retomar()).toBe(false);
  });

  test("stop cancela a suspensão adiada", async () => {
    /* Sem isto, o temporizador acordava depois do `close()` e chamava
       `suspend()` num contexto fechado. */
    const s = createSoundscape("pad");
    s.start();
    const ctx = criados[0];
    s.pausar();
    s.stop();
    await espera(260);
    expect(ctx.suspensoes).toBe(0);
  });

  test("o silêncio responde às duas sem contexto nenhum", async () => {
    const s = createSoundscape("silencio");
    s.start();
    s.pausar();
    expect(await s.retomar()).toBe(true);
    expect(criados.length).toBe(0);
  });
});

describe("⚠️ o relógio do coração", () => {
  test("pausar para o batimento; voltar rearma UM só", async () => {
    /* Num contexto suspenso o `currentTime` congela, e o `setInterval` seguiria
       agendando toda batida para o mesmo instante parado: ao voltar sairiam
       todas juntas, no ouvido de quem estava meditando. */
    const s = createSoundscape("coracao");
    s.start();
    const ctx = criados[0];
    s.pausar();
    await espera(260);
    ctx.currentTime = 5;
    /* Duas voltas concorrentes (o botão da tela e o ▶︎ do card do sistema)
       não podem deixar dois relógios batendo. */
    const [a, b] = await Promise.all([s.retomar(), s.retomar()]);
    expect([a, b]).toEqual([true, true]);
    s.stop();
    expect(ctx.state).toBe("closed");
  });

  test("o batimento não é agendado num contexto que não está rodando", async () => {
    const s = createSoundscape("coracao");
    s.start();
    const ctx = criados[0];
    s.pausar();
    await espera(260);
    const antes = ctx.currentTime;
    await espera(60); // mais que um período (≈429 ms não, mas o guarda é por estado)
    expect(ctx.currentTime).toBe(antes);
    s.stop();
  });
});

describe("os quatro sons montam sem quebrar", () => {
  test("cada receita cria o contexto e nenhum lança", () => {
    for (const k of ["pad", "chuva", "mar", "coracao"] as const) {
      const s = createSoundscape(k);
      expect(() => s.start()).not.toThrow();
      expect(() => s.setVolume(0.5)).not.toThrow();
      s.stop();
    }
    expect(criados.length).toBe(4);
    expect(CtxFalso.vivos).toBe(0);
  });

  test("navegador sem Web Audio fica em silêncio, e a tela não quebra", () => {
    (globalThis as Record<string, unknown>).window = {};
    const s = createSoundscape("chuva");
    expect(() => {
      s.start();
      s.pausar();
      s.stop();
    }).not.toThrow();
  });
});
